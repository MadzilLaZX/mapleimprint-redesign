// Alternate products.json regeneration path, built 2026-11-11. Does NOT use Prisma or
// DATABASE_URL at all -- authenticates purely via SUPABASE_SERVICE_ROLE_KEY (already present in
// the website's .env.local, used all engagement for ad-hoc admin queries via
// src/lib/server/supabaseAdmin.ts) against Supabase's PostgREST API. This exists because every
// sandbox this engagement has ever run in has had that key but never a real DATABASE_URL -- see
// docs/regenerate-products-json.md for the original Prisma-based procedure, which remains the
// primary path for whoever does have DATABASE_URL.
//
// Deliberately reuses the REAL pricing/formatting logic from export-products-for-frontend.mjs
// (chartFor, resolveMarkupRule, cheapestOrderableOffer, buildPriceTiers, stripHtml,
// resolveShippingWeightLb) and calculatePrice() from the built catalogue-engine package --
// nothing about HOW a price or a description is computed is reimplemented here, only HOW THE
// ROWS ARE FETCHED differs (REST pagination instead of a single deep Prisma `include`).
//
// SAFETY: writes to a STAGED file, never the live src/lib/generated/products.json, per standing
// instruction ("do not overwrite the production catalog without validation and approval"). Never
// prints, logs, or writes the service role key anywhere -- it is read into process.env in-memory
// for this process only, the same pattern export-products-for-frontend.mjs already uses for a
// local .env file.

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { PRINT_RULE_VERSION } from '../dist/index.js';
import { routeFor } from './route-map.mjs';
import {
  stripHtml,
  chartFor,
  resolveMarkupRule,
  cheapestOrderableOffer,
  buildPriceTiers,
  resolveShippingWeightLb,
} from './export-products-for-frontend.mjs';

const here = dirname(fileURLToPath(import.meta.url));

// Reads the WEBSITE's .env.local (not catalogue-engine's own .env) -- that's where
// SUPABASE_SERVICE_ROLE_KEY actually lives in this repo (src/lib/server/supabaseAdmin.ts reads
// it from there at request time). Same hand-rolled parser export-products-for-frontend.mjs uses
// for its own .env, kept identical rather than adding a dependency for one script.
const envPath = resolve(here, '..', '..', '.env.local');
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

// Same project URL constant as src/lib/server/supabaseAdmin.ts -- not a secret, it's a public
// project ref, never the thing this script is careful about.
const SUPABASE_URL = 'https://ovqkwedpwmuusnijbxro.supabase.co';
const MIN_SURVIVING_FRACTION = 0.5;
const PAGE_SIZE = 1000; // PostgREST's own default max rows per request

function requireServiceRoleKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set (checked process.env and .env.local). This script ' +
        'deliberately never falls back to DATABASE_URL or any other credential -- set this one ' +
        'specifically, the same variable src/lib/server/supabaseAdmin.ts already uses.',
    );
  }
  return key;
}

/** Pages through a table with `.range()` until a page returns fewer than PAGE_SIZE rows --
 *  PostgREST never tells you the total up front, so this is the standard way to drain a table
 *  larger than its single-request row cap. */
async function fetchAll(supabase, table, { select, filters = (q) => q, orderBy = 'id' }) {
  const rows = [];
  let from = 0;
  for (;;) {
    let query = supabase.from(table).select(select).order(orderBy, { ascending: true }).range(from, from + PAGE_SIZE - 1);
    query = filters(query);
    const { data, error } = await query;
    if (error) throw new Error(`Fetching ${table} failed: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

/** `.in()` filters have a practical URL-length limit -- chunk large id lists rather than risk a
 *  single oversized request failing or silently truncating. */
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function fetchAllIn(supabase, table, { select, idColumn, ids, extraFilter = (q) => q }) {
  if (ids.length === 0) return [];
  const rows = [];
  for (const idChunk of chunk(ids, 200)) {
    const rowsForChunk = await fetchAll(supabase, table, {
      select,
      filters: (q) => extraFilter(q.in(idColumn, idChunk)),
      orderBy: idColumn,
    });
    rows.push(...rowsForChunk);
  }
  return rows;
}

function pushTo(map, key, value) {
  const existing = map.get(key);
  if (existing) existing.push(value);
  else map.set(key, [value]);
}

async function main() {
  const force = process.argv.includes('--force');
  const supabase = createClient(SUPABASE_URL, requireServiceRoleKey(), { auth: { persistSession: false } });

  console.log('Fetching published MasterProducts...');
  const products = await fetchAll(supabase, 'MasterProduct', {
    select: 'id, slug, name, brandId, primaryCategoryId, productType, fullDescription, status, isPublished',
    filters: (q) => q.eq('status', 'published').eq('isPublished', true),
  });
  console.log(`  ${products.length} published products.`);

  const brandIds = [...new Set(products.map((p) => p.brandId))];
  const productIds = products.map((p) => p.id);

  console.log('Fetching brands, variants, images, markup rules, size specs...');
  const [brands, variants, images, markupRules, specRows] = await Promise.all([
    fetchAllIn(supabase, 'Brand', { select: 'id, name', idColumn: 'id', ids: brandIds }),
    fetchAllIn(supabase, 'ProductVariant', {
      select: 'id, masterProductId, colourName, size, sizeSortOrder, status',
      idColumn: 'masterProductId',
      ids: productIds,
      extraFilter: (q) => q.eq('status', 'active'),
    }),
    fetchAllIn(supabase, 'ProductImage', {
      select: 'masterProductId, sourceUrl, colourName, imageType, sortOrder, status',
      idColumn: 'masterProductId',
      ids: productIds,
      extraFilter: (q) => q.eq('status', 'published'),
    }),
    fetchAll(supabase, 'MarkupRule', {
      select: 'id, supplierId, brandId, categoryId, productType, minimumCost, maximumCost, markupType, markupValue, priority, isActive',
      filters: (q) => q.eq('isActive', true),
    }),
    fetchAllIn(supabase, 'SupplierProductSpec', {
      select: 'masterProductId, sizeName, sizeOrder, specName, normalizedSpecType, value, unit',
      idColumn: 'masterProductId',
      ids: productIds,
      extraFilter: (q) => q.not('masterProductId', 'is', null),
    }),
  ]);
  console.log(`  ${brands.length} brands, ${variants.length} active variants, ${images.length} published images, ${markupRules.length} active markup rules, ${specRows.length} size-spec rows.`);

  const variantIds = variants.map((v) => v.id);
  console.log('Fetching orderable supplier offers for those variants...');
  const offers = await fetchAllIn(supabase, 'SupplierVariantOffer', {
    select: 'productVariantId, supplierProductId, wholesaleCost, currency, isOrderable',
    idColumn: 'productVariantId',
    ids: variantIds,
    extraFilter: (q) => q.eq('isOrderable', true),
  });
  console.log(`  ${offers.length} orderable offers.`);

  const supplierProductIds = [...new Set(offers.map((o) => o.supplierProductId))];
  // unitWeightLb/weightConfidence -- migration 008 was applied and the backfill run 2026-11-11
  // (see canada-post-activation-plan.md); these columns now carry real data for every sanmar/
  // ss_activewear SupplierProduct row, so they're selected here for real this time.
  console.log('Fetching supplier ids for those offers...');
  const supplierProducts = await fetchAllIn(supabase, 'SupplierProduct', {
    select: 'id, supplierId, unitWeightLb, weightConfidence',
    idColumn: 'id',
    ids: supplierProductIds,
  });

  // --- Reassemble the exact nested shape export-products-for-frontend.mjs's own functions expect
  // (variants -> supplierOffers -> supplierProduct), so cheapestOrderableOffer/buildPriceTiers/
  // resolveShippingWeightLb run completely unmodified against this REST-sourced data. ---
  const brandById = new Map(brands.map((b) => [b.id, b]));
  const supplierProductById = new Map(supplierProducts.map((sp) => [sp.id, sp]));
  const offersByVariantId = new Map();
  for (const offer of offers) {
    const supplierProduct = supplierProductById.get(offer.supplierProductId) ?? { supplierId: null, unitWeightLb: null, weightConfidence: null };
    pushTo(offersByVariantId, offer.productVariantId, {
      wholesaleCost: offer.wholesaleCost,
      currency: offer.currency,
      isOrderable: offer.isOrderable,
      supplierProduct: {
        supplierId: supplierProduct.supplierId,
        unitWeightLb: supplierProduct.unitWeightLb === null ? null : Number(supplierProduct.unitWeightLb),
        weightConfidence: supplierProduct.weightConfidence,
      },
    });
  }
  const variantsByProductId = new Map();
  for (const v of variants) {
    pushTo(variantsByProductId, v.masterProductId, { ...v, supplierOffers: offersByVariantId.get(v.id) ?? [] });
  }
  const imagesByProductId = new Map();
  for (const img of images) {
    pushTo(imagesByProductId, img.masterProductId, img);
  }

  console.log('Computing prices and building export rows...');
  const exported = [];
  let quoteRequiredCount = 0;

  for (const p of products) {
    const route = routeFor(p.productType, p.name);
    if (!route) {
      console.warn(`Skipping "${p.name}" — no frontend route mapped for productType "${p.productType}"`);
      continue;
    }

    const productVariants = variantsByProductId.get(p.id) ?? [];
    const colours = [...new Set(productVariants.map((v) => v.colourName))];
    const sizes = [...new Set(productVariants.map((v) => v.size))].sort((a, b) => {
      const va = productVariants.find((v) => v.size === a)?.sizeSortOrder ?? 99;
      const vb = productVariants.find((v) => v.size === b)?.sizeSortOrder ?? 99;
      return va - vb;
    });

    const chart = chartFor(p.productType);
    const cheapest = cheapestOrderableOffer(productVariants);
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

    const realPhotos = (imagesByProductId.get(p.id) ?? []).filter((img) => img.imageType !== 'swatch');
    const imageTypeRank = { front: 0, back: 1, side: 2, primary: 0 };
    const sortedImages = [...realPhotos].sort((a, b) => (imageTypeRank[a.imageType] ?? 9) - (imageTypeRank[b.imageType] ?? 9));

    exported.push({
      slug: p.slug,
      name: p.name,
      brandName: brandById.get(p.brandId)?.name ?? '',
      categorySlug: route.categorySlug,
      subcategorySlug: route.subcategorySlug,
      description: stripHtml(p.fullDescription),
      images: sortedImages.map((img) => ({ url: img.sourceUrl, colourName: img.colourName, imageType: img.imageType })),
      colours,
      sizes,
      variants: productVariants.map((v) => ({ colourName: v.colourName, size: v.size })),
      priceTiers,
      startingPrice: priceTiers ? priceTiers[0].pricePerUnit : null,
      shippingWeightLb: resolveShippingWeightLb(cheapest),
      printRuleVersion: PRINT_RULE_VERSION,
    });
  }

  const outDir = resolve(here, '..', '..', 'src', 'lib', 'generated');
  mkdirSync(outDir, { recursive: true });
  // STAGED output -- never the live file this script's sibling writes to. Comparing this against
  // src/lib/generated/products.json is the validation step before anyone decides to promote it.
  const outPath = resolve(outDir, 'products.staged-via-rest.json');

  const livePath = resolve(outDir, 'products.json');
  if (existsSync(livePath)) {
    const previous = JSON.parse(readFileSync(livePath, 'utf-8'));
    if (!force && previous.length > 0 && exported.length < previous.length * MIN_SURVIVING_FRACTION) {
      console.error(
        `Refusing to write: exported ${exported.length} products, live file has ${previous.length} ` +
          `(below ${MIN_SURVIVING_FRACTION * 100}% survival threshold). This is almost always a bad ` +
          `read, not a real catalogue shrink. Re-run with --force if this drop is genuinely intended.`,
      );
      process.exit(1);
    }
  }

  writeFileSync(outPath, JSON.stringify(exported, null, 2), 'utf-8');
  console.log(`\nStaged ${exported.length} products to ${outPath} (NOT the live products.json).`);
  console.log(`  ${exported.length - quoteRequiredCount} priced, ${quoteRequiredCount} quote_required.`);

  const specsOutPath = resolve(outDir, 'sizeSpecs.staged-via-rest.json');
  const sizeSpecs = {};
  const slugByProductId = new Map(products.map((p) => [p.id, p.slug]));
  for (const row of specRows) {
    const slug = slugByProductId.get(row.masterProductId);
    if (!slug) continue;
    (sizeSpecs[slug] ??= []).push({
      sizeName: row.sizeName,
      sizeOrder: row.sizeOrder,
      specName: row.specName,
      normalizedSpecType: row.normalizedSpecType,
      value: row.value,
      unit: row.unit,
    });
  }
  writeFileSync(specsOutPath, JSON.stringify(sizeSpecs, null, 2), 'utf-8');
  console.log(`Staged size specs for ${Object.keys(sizeSpecs).length} products to ${specsOutPath}.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error('Staged export failed:', err);
    process.exit(1);
  });
}
