// Independent, full-scale cross-check of a staged products.json export's pricing -- built
// 2026-11-11 after a 6-sample spot-check turned out not to be enough: running this same
// methodology across all 1310 published+orderable products caught one genuine bug (a pagination
// ordering gap in export-products-via-supabase-rest.mjs, since fixed) that none of the 6 samples
// happened to hit. Re-run this any time a new staged export needs to be trusted before promotion.
//
// Deliberately does NOT reuse export-products-via-supabase-rest.mjs's own data-fetching code --
// that would just be checking the script against itself. This re-derives each product's cheapest
// orderable wholesale cost with its own independent query, then runs it through the SAME real
// chartFor/resolveMarkupRule/buildPriceTiers functions (never reimplemented) and compares the
// full result -- not just startingPrice -- against the staged file.
//
// Prints only counts and pass/fail -- never the underlying wholesale cost or markup figures,
// consistent with keeping that data out of this (committed, public-repo) script's output.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { chartFor, resolveMarkupRule, buildPriceTiers, resolveShippingWeightLb } from './export-products-for-frontend.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(here, '..', '..', '.env.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let value = t.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
}

const SUPABASE_URL = 'https://ovqkwedpwmuusnijbxro.supabase.co';
const PAGE_SIZE = 1000;

function requireServiceRoleKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set.');
  return key;
}

async function fetchAll(supabase, table, { select, filters = (q) => q, orderBy = 'id' }) {
  const rows = [];
  let from = 0;
  for (;;) {
    let query = supabase.from(table).select(select).order(orderBy, { ascending: true }).order('id', { ascending: true }).range(from, from + PAGE_SIZE - 1);
    query = filters(query);
    const { data, error } = await query;
    if (error) throw new Error(`Fetching ${table} failed: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** `.in()` filters have a practical URL-length limit (PostgREST uses GET) -- chunk large id
 *  lists rather than risk a 400 Bad Request on the full list. */
async function fetchAllIn(supabase, table, { select, idColumn, ids, extraFilter = (q) => q }) {
  if (ids.length === 0) return [];
  const rows = [];
  for (const idChunk of chunk(ids, 200)) {
    rows.push(...(await fetchAll(supabase, table, { select, filters: (q) => extraFilter(q.in(idColumn, idChunk)), orderBy: idColumn })));
  }
  return rows;
}

async function main() {
  const stagedPath = process.argv[2] ?? resolve(here, '..', '..', 'src', 'lib', 'generated', 'products.staged-via-rest.json');
  const staged = JSON.parse(readFileSync(stagedPath, 'utf-8'));
  const stagedBySlug = new Map(staged.map((p) => [p.slug, p]));

  const supabase = createClient(SUPABASE_URL, requireServiceRoleKey(), { auth: { persistSession: false } });

  console.log('Fetching every published product + its orderable offers directly (independent of the export script)...');
  const published = await fetchAll(supabase, 'MasterProduct', {
    select: 'id, slug, "productType", "brandId", "primaryCategoryId"',
    filters: (q) => q.eq('status', 'published').eq('isPublished', true),
  });
  const publishedIds = published.map((p) => p.id);

  const activeVariants = await fetchAllIn(supabase, 'ProductVariant', {
    select: 'id, "masterProductId"',
    idColumn: 'masterProductId',
    ids: publishedIds,
    extraFilter: (q) => q.eq('status', 'active'),
  });
  const variantIds = activeVariants.map((v) => v.id);
  const masterProductIdByVariantId = new Map(activeVariants.map((v) => [v.id, v.masterProductId]));

  const offers = await fetchAllIn(supabase, 'SupplierVariantOffer', {
    select: '"productVariantId", "supplierProductId", "wholesaleCost", currency',
    idColumn: 'productVariantId',
    ids: variantIds,
    extraFilter: (q) => q.eq('isOrderable', true),
  });
  const supplierProductIds = [...new Set(offers.map((o) => o.supplierProductId))];
  const supplierProducts = await fetchAllIn(supabase, 'SupplierProduct', {
    select: 'id, "supplierId", "unitWeightLb", "weightConfidence"',
    idColumn: 'id',
    ids: supplierProductIds,
  });
  const supplierProductById = new Map(supplierProducts.map((sp) => [sp.id, sp]));

  const markupRules = await fetchAll(supabase, 'MarkupRule', {
    select: 'id, "supplierId", "brandId", "categoryId", "productType", "minimumCost", "maximumCost", "markupType", "markupValue", priority',
    filters: (q) => q.eq('isActive', true),
  });

  // Cheapest orderable offer per product, re-derived from scratch (not reusing cheapestOrderableOffer()).
  // Weight is carried from the SAME winning offer's SupplierProduct -- the point being verified
  // here is that price and weight always come from one consistent offer, never two different ones.
  const cheapestByProductId = new Map();
  for (const offer of offers) {
    const masterProductId = masterProductIdByVariantId.get(offer.productVariantId);
    if (!masterProductId) continue;
    const cost = Number(offer.wholesaleCost);
    const current = cheapestByProductId.get(masterProductId);
    if (!current || cost < current.cost) {
      const sp = supplierProductById.get(offer.supplierProductId) ?? {};
      cheapestByProductId.set(masterProductId, {
        cost,
        currency: offer.currency,
        supplierId: sp.supplierId,
        unitWeightLb: sp.unitWeightLb === null || sp.unitWeightLb === undefined ? null : Number(sp.unitWeightLb),
        weightConfidence: sp.weightConfidence ?? null,
      });
    }
  }

  let checked = 0, exactMatch = 0, correctlyQuoteRequired = 0, weightMatch = 0;
  const mismatches = [];
  const weightMismatches = [];
  const missingFromStaged = [];

  for (const p of published) {
    const sp = stagedBySlug.get(p.slug);
    if (!sp) {
      missingFromStaged.push(p.slug);
      continue;
    }
    checked++;

    const cheapest = cheapestByProductId.get(p.id) ?? null;
    const chart = chartFor(p.productType);
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
    const expected = priceTiers ? priceTiers[0].pricePerUnit : null;

    if (expected === null && sp.startingPrice === null) {
      correctlyQuoteRequired++;
    } else if (expected !== null && sp.startingPrice !== null && expected === sp.startingPrice && JSON.stringify(priceTiers) === JSON.stringify(sp.priceTiers)) {
      exactMatch++;
    } else {
      mismatches.push({ slug: p.slug, expectedStartingPrice: expected, stagedStartingPrice: sp.startingPrice });
    }

    // Weight must come from the SAME winning offer price was computed from -- verify that
    // guarantee empirically, not just by reading the code.
    const expectedWeight = cheapest ? resolveShippingWeightLb(cheapest) : null;
    const stagedWeight = sp.shippingWeightLb ?? null;
    if (expectedWeight !== stagedWeight) {
      weightMismatches.push({ slug: p.slug, expectedWeight, stagedWeight });
    } else {
      weightMatch++;
    }
  }

  console.log(`\nPublished products checked: ${checked} (of ${published.length} total published)`);
  console.log(`Missing from staged file entirely: ${missingFromStaged.length}`, missingFromStaged.slice(0, 10));
  console.log(`Exact price match (startingPrice + full priceTiers): ${exactMatch}`);
  console.log(`Correctly quote_required on both sides: ${correctlyQuoteRequired}`);
  console.log(`PRICE MISMATCHES: ${mismatches.length}`);
  console.log(`Exact shippingWeightLb match: ${weightMatch} / ${checked}`);
  console.log(`WEIGHT MISMATCHES: ${weightMismatches.length}`);
  if (mismatches.length || weightMismatches.length) {
    if (mismatches.length) console.log('Price mismatches:', JSON.stringify(mismatches, null, 2));
    if (weightMismatches.length) console.log('Weight mismatches:', JSON.stringify(weightMismatches, null, 2));
    process.exitCode = 1;
  } else {
    console.log('\nAll checked products match exactly on both price and weight. Staged export is verified.');
  }
}

main().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
