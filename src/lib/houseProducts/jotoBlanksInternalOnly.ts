// INTERNAL-ONLY reference data for sublimation-blank products sourced from Joto Imaging Supplies
// Canada (jotoimagingsupplies.ca), added beyond the xTool M1 sheet per the owner's explicit
// request to pull in Joto's full catalog. Same non-negotiable separation rule as
// engravingInternalOnly.ts (same directory) — DO NOT import this file from jotoBlanksCatalogDraft.ts,
// catalogue.ts, or any customer-facing module. Blank cost is internal cost data, not a price shown
// to customers.
//
// Verified at the time this file was written (2026-10-21): grepped the whole src/ tree for
// `jotoBlanksInternalOnly` — the only match is this file's own declaration below.
//
// Pricing method: Joto's regular (non-sale) listed price is used as the cost baseline, divided by
// pack size, same convention established for the B03 slate-ornament correction in
// engravingInternalOnly.ts — sale prices are promotional and not a stable basis for margin.
//
// DATA-PULL LIMITATION: jotoimagingsupplies.ca blocks direct page fetches (403) and its Shopify
// products.json/collections.json endpoints are also blocked, so this data was gathered via web
// search snippets of individual product/collection pages, not a full programmatic catalog pull.
// This is a representative sample of Joto's sublimation-blanks range, NOT their complete catalog —
// several product types (license plates, mugs sold by the case, phone cases, pet accessories) were
// found to exist but had no reliable price snippet and were deliberately left out rather than
// guessed. See the task report for the full list of what was skipped and why.

export interface JotoBlankCostRecord {
  /** Matches the slug in jotoBlanksCatalogDraft.ts */
  slug: string;
  packSize: number;
  packCostCad: number;
  costPerUnitCad: number;
  sourceUrl: string;
}

export const JOTO_BLANK_COSTS_INTERNAL: JotoBlankCostRecord[] = [
  {
    slug: "sublimation-aluminum-bookmark",
    packSize: 10,
    packCostCad: 24.9,
    costPerUnitCad: 2.49,
    sourceUrl: "https://jotoimagingsupplies.ca/products/sublimation-aluminum-bookmark-wholesale",
  },
  {
    slug: "sublimation-acrylic-photo-panel",
    packSize: 20,
    packCostCad: 166.0,
    costPerUnitCad: 8.3,
    sourceUrl: "https://jotoimagingsupplies.ca/products/sublimation-acrylic-blanks-pack-20",
  },
  {
    slug: "sublimation-aluminum-photo-panel",
    packSize: 10,
    packCostCad: 28.5,
    costPerUnitCad: 2.85,
    sourceUrl: "https://jotoimagingsupplies.ca/collections/hd-photo-panels",
  },
  {
    slug: "sublimation-pot-holder-pearl-coating",
    packSize: 10,
    packCostCad: 40.1,
    costPerUnitCad: 4.01,
    sourceUrl: "https://jotoimagingsupplies.ca/products/sublimation-pot-holder-pack-of-10",
  },
  {
    slug: "sublimation-pot-holder-craft-express",
    packSize: 2,
    packCostCad: 9.99,
    costPerUnitCad: 4.995,
    sourceUrl: "https://jotoimagingsupplies.ca/products/sublimation-pot-holders",
  },
  {
    slug: "sublimation-pot-holder-double-mitts",
    packSize: 5,
    packCostCad: 29.75,
    costPerUnitCad: 5.95,
    sourceUrl: "https://jotoimagingsupplies.com/products/pearl-coating-sublimation-double-mitts-long-pot-holder-pack-of-5",
  },
  {
    slug: "sublimation-keychain-rectangle",
    packSize: 10,
    packCostCad: 14.99,
    costPerUnitCad: 1.499,
    sourceUrl: "https://jotoimagingsupplies.ca/collections/sublimation-supplies",
  },
  {
    slug: "sublimation-keychain-leather",
    packSize: 10,
    packCostCad: 31.5,
    costPerUnitCad: 3.15,
    sourceUrl: "https://jotoimagingsupplies.ca/collections/sublimation-supplies",
  },
  {
    slug: "sublimation-ceramic-ornament",
    packSize: 25,
    packCostCad: 59.75,
    costPerUnitCad: 2.39,
    sourceUrl: "https://jotoimagingsupplies.ca/products/sublimation-ceramic-ornaments-pack-of-25",
  },
  {
    slug: "sublimation-photo-ornament",
    packSize: 10,
    packCostCad: 18.8,
    costPerUnitCad: 1.88,
    sourceUrl: "https://jotoimagingsupplies.ca/collections/sublimation-home-decor",
  },
];
