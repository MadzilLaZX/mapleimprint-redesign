// Exports published MasterProducts into a static JSON file the Next.js frontend can import
// directly, with no DB client of its own — matches the documented architecture (frontend stays
// decoupled from catalogue-engine's database until Gate A is resolved; this becomes "whichever
// platform Gate A picks" for now the static-JSON approach). Re-run this any time the catalogue
// changes; the frontend picks up new data on its next build.
//
// Pricing: retail price = wholesale cost (cheapest orderable variant offer for the product) run
// through the real pricing engine (`calculatePrice()`), which applies a MarkupRule (looked up per
// product from the DB, most-specific-match-wins) plus the client's decoration/print-cost chart on
// top. This used to export APPAREL_PRINT_TIERS/HAT_PRINT_TIERS directly as if the chart WERE the
// retail price — that was a bug (every product showed an identical $20/$12 "starting price"
// regardless of what it actually costs), not a real client decision, despite a since-removed
// comment here claiming otherwise. See PROJECT_NOTES.md for the incident writeup.
//
// A product with no orderable variant offer, or with no MarkupRule resolving for it, exports as
// priceTiers: null / startingPrice: null (quote required) — never a guessed number.
//
// Descriptions come from raw supplier HTML — stripped to plain text here before ever reaching the
// frontend, since dangerouslySetInnerHTML on un-sanitized third-party content is a real XSS risk.

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { APPAREL_PRINT_TIERS, HAT_PRINT_TIERS, PRINT_RULE_VERSION, calculatePrice } from '../dist/index.js';
import { routeFor, APPAREL_PRODUCT_TYPES, HEADWEAR_PRODUCT_TYPE } from './route-map.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(here, '..', '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let value = t.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

// Below this fraction of the previously-exported product count, refuse to overwrite the live
// file — almost certainly a bad DB read (e.g. querying mid-restore, wrong env) rather than a real
// catalogue shrink. Pass --force to override deliberately (e.g. a real, intentional mass-hide).
const MIN_SURVIVING_FRACTION = 0.5;

function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<\/(p|li|div|br)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function chartFor(productType) {
  if (APPAREL_PRODUCT_TYPES.has(productType)) return { tiers: APPAREL_PRINT_TIERS, engineType: 'apparel' };
  if (productType === HEADWEAR_PRODUCT_TYPE) return { tiers: HAT_PRINT_TIERS, engineType: 'hat' };
  return null; // no chart for this productType (e.g. bags, aprons) — quote-required, not a guess
}

/** Picks the most specific active MarkupRule that matches this product, or null if none applies.
 *  Specificity = how many of supplier/brand/category/productType are pinned (non-null) on the
 *  rule; ties broken by `priority` (higher wins). A rule only matches if every pinned field on it
 *  equals the product's value (or is null, i.e. a wildcard for that field) AND cost falls inside
 *  its min/max cost band if set. This is the resolver the DB schema's override columns were
 *  designed for but that nothing previously implemented. */
function resolveMarkupRule(rules, { supplierId, brandId, categoryId, productType, cost }) {
  const candidates = rules.filter(
    (r) =>
      (!r.supplierId || r.supplierId === supplierId) &&
      (!r.brandId || r.brandId === brandId) &&
      (!r.categoryId || r.categoryId === categoryId) &&
      (!r.productType || r.productType === productType) &&
      (r.minimumCost == null || cost >= Number(r.minimumCost)) &&
      (r.maximumCost == null || cost <= Number(r.maximumCost)),
  );
  const specificity = (r) => [r.supplierId, r.brandId, r.categoryId, r.productType].filter(Boolean).length;
  candidates.sort((a, b) => specificity(b) - specificity(a) || b.priority - a.priority);
  return candidates[0] ?? null;
}

/** Cheapest currently-orderable wholesale offer across a product's variants — "the lowest
 *  legitimate purchasable variant," not just the numerically lowest cost regardless of stock. */
function cheapestOrderableOffer(variants) {
  let best = null;
  for (const v of variants) {
    for (const offer of v.supplierOffers) {
      if (!offer.isOrderable) continue;
      const cost = Number(offer.wholesaleCost);
      if (best === null || cost < best.cost) best = { cost, currency: offer.currency, supplierId: offer.supplierProduct.supplierId };
    }
  }
  return best;
}

function buildPriceTiers(chart, engineType, cheapest, markupRule) {
  if (!chart || !cheapest || !markupRule) return null;
  const tiers = [];
  for (const tier of chart.tiers) {
    const result = calculatePrice({
      productType: engineType,
      quantity: tier.quantityMin,
      wholesaleCostPerUnit: cheapest.cost,
      wholesaleCostCurrency: cheapest.currency,
      printLocations: 1,
      markupRule: {
        type: markupRule.markupType,
        value: Number(markupRule.markupValue),
        appliesTo: 'blank', // brief's formula: retail base product = wholesale x markup, decoration cost added on top, not marked up
        version: markupRule.id,
      },
    });
    if (result.status !== 'priced') return null; // any tier failing to price -> whole product is quote_required, not partially guessed
    tiers.push({ minQty: tier.quantityMin, maxQty: tier.quantityMax, pricePerUnit: result.finalUnitPrice });
  }
  return tiers;
}

async function main() {
  const force = process.argv.includes('--force');
  const prisma = new PrismaClient();

  const [products, markupRules] = await Promise.all([
    prisma.masterProduct.findMany({
      where: { status: 'published', isPublished: true },
      include: {
        brand: true,
        primaryCategory: true,
        variants: {
          where: { status: 'active' },
          include: {
            supplierOffers: {
              where: { isOrderable: true },
              select: { wholesaleCost: true, currency: true, isOrderable: true, supplierProduct: { select: { supplierId: true } } },
            },
          },
        },
        images: { where: { status: 'published' }, orderBy: { sortOrder: 'asc' } },
      },
    }),
    prisma.markupRule.findMany({ where: { isActive: true } }),
  ]);

  const exported = [];
  let quoteRequiredCount = 0;

  for (const p of products) {
    const route = routeFor(p.productType, p.name);
    if (!route) {
      console.warn(`Skipping "${p.name}" — no frontend route mapped for productType "${p.productType}"`);
      continue;
    }

    const colours = [...new Set(p.variants.map((v) => v.colourName))];
    const sizes = [...new Set(p.variants.map((v) => v.size))].sort((a, b) => {
      const va = p.variants.find((v) => v.size === a)?.sizeSortOrder ?? 99;
      const vb = p.variants.find((v) => v.size === b)?.sizeSortOrder ?? 99;
      return va - vb;
    });

    const chart = chartFor(p.productType);
    const cheapest = cheapestOrderableOffer(p.variants);
    const markupRule = cheapest
      ? resolveMarkupRule(markupRules, {
          supplierId: cheapest.supplierId,
          brandId: p.brandId,
          categoryId: p.primaryCategoryId,
          productType: p.productType,
          cost: cheapest.cost,
        })
      : null;
    const priceTiers = buildPriceTiers(chart, chart?.engineType, cheapest, markupRule);
    if (!priceTiers) quoteRequiredCount++;

    // Colour swatches are tiny colour-chip thumbnails (a few pixels), not product photos — never
    // usable as a lead/gallery image, since stretched to tile size they render as a misleading
    // flat colour block instead of an actual photo. Exclude them entirely here; a product with
    // only swatch rows in the DB (S&S provided no real photo for it) correctly falls through to
    // an honest "no image yet" placeholder on the frontend rather than a fake-looking colour tile.
    const realPhotos = p.images.filter((img) => img.imageType !== 'swatch');
    const imageTypeRank = { front: 0, back: 1, side: 2, primary: 0 };
    const sortedImages = [...realPhotos].sort(
      (a, b) => (imageTypeRank[a.imageType] ?? 9) - (imageTypeRank[b.imageType] ?? 9),
    );

    exported.push({
      slug: p.slug,
      name: p.name,
      brandName: p.brand.name,
      categorySlug: route.categorySlug,
      subcategorySlug: route.subcategorySlug,
      description: stripHtml(p.fullDescription),
      images: sortedImages.map((img) => ({
        url: img.sourceUrl,
        colourName: img.colourName,
        imageType: img.imageType,
      })),
      colours,
      sizes,
      variants: p.variants.map((v) => ({ colourName: v.colourName, size: v.size })),
      priceTiers,
      startingPrice: priceTiers ? priceTiers[0].pricePerUnit : null,
      printRuleVersion: PRINT_RULE_VERSION,
    });
  }

  const outDir = resolve(here, '..', '..', 'src', 'lib', 'generated');
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, 'products.json');

  if (existsSync(outPath)) {
    const previous = JSON.parse(readFileSync(outPath, 'utf-8'));
    if (!force && previous.length > 0 && exported.length < previous.length * MIN_SURVIVING_FRACTION) {
      console.error(
        `Refusing to write: exported ${exported.length} products, previous file had ${previous.length} ` +
          `(below ${MIN_SURVIVING_FRACTION * 100}% survival threshold). This is almost always a bad DB read, ` +
          `not a real catalogue shrink. Re-run with --force if this drop is genuinely intended.`,
      );
      await prisma.$disconnect();
      process.exit(1);
    }
  }

  writeFileSync(outPath, JSON.stringify(exported, null, 2), 'utf-8');

  console.log(`Exported ${exported.length} products to ${outPath}`);
  console.log(`  ${exported.length - quoteRequiredCount} priced, ${quoteRequiredCount} quote_required (no orderable offer or no matching MarkupRule)`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('Export failed:', err);
  process.exit(1);
});
