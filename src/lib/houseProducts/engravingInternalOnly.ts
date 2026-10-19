// INTERNAL-ONLY reference data from the xTool M1 Developer Catalog's "Blank costs" and "Canadian
// suppliers" sheets, preserved here for whenever this data is needed again (e.g. building a real
// cost/margin review before any engravingCatalogDraft.ts entry is published).
//
// DO NOT import this file from any customer-facing module — not from engravingCatalogDraft.ts,
// not from catalogue.ts, not from any component, API route, or page. The source brief's
// "Developer brief" sheet is explicit and non-negotiable on this: "Exclude Blank costs and
// Canadian suppliers from all public feeds" / "Supplier and purchase data are internal and must
// not appear on customer product pages."
//
// Verified at the time this file was written (2026-10-20): grepped the whole src/ tree for
// `engravingInternalOnly` — the only match is this file's own declaration below. No component,
// page, API route, or other catalogue file imports it. If anything ever does, that's the bug —
// delete the import, don't make this file "safer"; the data in it is simply never allowed to
// reach a public response or rendered page.
//
// This file is NOT spread into HOUSE_PRODUCTS, NOT exported from catalogue.ts, and has no
// relationship to CatalogueProduct at all — it is a flat internal lookup keyed by SKU, kept
// entirely separate from the public catalogue shape so there's no field to accidentally forget to
// strip later.

export interface EngravingBlankCostRecord {
  sku: string;
  blankId: string;
  blanksPerSale: number;
  /** "Blank cost / sale CAD" from the Products sheet — raw cost, NOT a customer-facing price. */
  blankCostPerSaleCad: number;
  supplierId: string;
}

// Keyed by SKU — one row per engravingCatalogDraft.ts entry, from the Products sheet's
// Blank ID / Blanks per sale / Blank cost / sale CAD / Supplier ID columns.
export const ENGRAVING_BLANK_COSTS_INTERNAL: EngravingBlankCostRecord[] = [
  { sku: "M1-001", blankId: "B01", blanksPerSale: 1, blankCostPerSaleCad: 2.25, supplierId: "S01" },
  { sku: "M1-002", blankId: "B02", blanksPerSale: 4, blankCostPerSaleCad: 15.0, supplierId: "S02" },
  { sku: "M1-003", blankId: "B03", blanksPerSale: 1, blankCostPerSaleCad: 0.99, supplierId: "S02" },
  { sku: "M1-004", blankId: "B04", blanksPerSale: 1, blankCostPerSaleCad: 7.31, supplierId: "S02" },
  { sku: "M1-005", blankId: "B05", blanksPerSale: 1, blankCostPerSaleCad: 2.95, supplierId: "S01" },
  { sku: "M1-006", blankId: "B06", blanksPerSale: 1, blankCostPerSaleCad: 3.99, supplierId: "S02" },
  { sku: "M1-009", blankId: "B09", blanksPerSale: 1, blankCostPerSaleCad: 1.75, supplierId: "S03" },
  { sku: "M1-010", blankId: "B10", blanksPerSale: 1, blankCostPerSaleCad: 2.69, supplierId: "S02" },
  { sku: "M1-016", blankId: "B01", blanksPerSale: 25, blankCostPerSaleCad: 56.25, supplierId: "S01" },
  { sku: "M1-017", blankId: "B06", blanksPerSale: 1, blankCostPerSaleCad: 3.99, supplierId: "S02" },
  { sku: "M1-018", blankId: "B03", blanksPerSale: 1, blankCostPerSaleCad: 0.99, supplierId: "S02" },
  { sku: "M1-019", blankId: "B04", blanksPerSale: 1, blankCostPerSaleCad: 7.31, supplierId: "S02" },
  { sku: "M1-020", blankId: "B09", blanksPerSale: 25, blankCostPerSaleCad: 43.75, supplierId: "S03" },
  { sku: "M1-021", blankId: "B02", blanksPerSale: 4, blankCostPerSaleCad: 15.0, supplierId: "S02" },
  { sku: "M1-022", blankId: "B10", blanksPerSale: 1, blankCostPerSaleCad: 2.69, supplierId: "S02" },
  { sku: "M1-023", blankId: "B10", blanksPerSale: 1, blankCostPerSaleCad: 2.69, supplierId: "S02" },
  { sku: "M1-025", blankId: "B05", blanksPerSale: 25, blankCostPerSaleCad: 73.75, supplierId: "S01" },
  { sku: "M1-007", blankId: "B07", blanksPerSale: 1, blankCostPerSaleCad: 2.99, supplierId: "S03" },
  { sku: "M1-008", blankId: "B08", blanksPerSale: 4, blankCostPerSaleCad: 15.96, supplierId: "S03" },
  { sku: "M1-012", blankId: "B12", blanksPerSale: 1, blankCostPerSaleCad: 4.99, supplierId: "S03" },
  { sku: "M1-024", blankId: "B07", blanksPerSale: 10, blankCostPerSaleCad: 29.9, supplierId: "S03" },
  { sku: "M1-011", blankId: "B11", blanksPerSale: 1, blankCostPerSaleCad: 3.99, supplierId: "S02" },
  { sku: "M1-013", blankId: "B13", blanksPerSale: 1, blankCostPerSaleCad: 9.99, supplierId: "S03" },
  { sku: "M1-014", blankId: "B14", blanksPerSale: 1, blankCostPerSaleCad: 13.49, supplierId: "S03" },
  { sku: "M1-015", blankId: "B15", blanksPerSale: 1, blankCostPerSaleCad: 9.99, supplierId: "S03" },
];

export interface EngravingSupplierRecord {
  supplierId: string;
  supplierName: string;
  canadianLocation: string;
  website: string;
  relevantBlanks: string;
  phone: string;
  contact: string;
}

// From the "Canadian suppliers" sheet — internal sourcing contacts only, never customer-facing.
export const ENGRAVING_SUPPLIERS_INTERNAL: EngravingSupplierRecord[] = [
  {
    supplierId: "S01",
    supplierName: "Craft Enablers",
    canadianLocation: "Greely / Ottawa, Ontario",
    website: "https://craftenablers.com",
    relevantBlanks: "Wooden keychains; magnetic wooden bottle openers",
    phone: "343-649-2202",
    contact: "craftenablers@gmail.com",
  },
  {
    supplierId: "S02",
    supplierName: "Joto Imaging Supplies Canada",
    canadianLocation: "Coquitlam, BC; Mississauga, ON",
    website: "https://jotoimagingsupplies.ca",
    relevantBlanks: "Slate; notebooks; bamboo boards; marble/wood coasters",
    phone: "1-800-565-5686",
    contact: "Use website contact form",
  },
  {
    supplierId: "S03",
    supplierName: "Maverick Laser Supplies",
    canadianLocation: "Hinton, Alberta",
    website: "https://www.mavericklasersupplies.ca",
    relevantBlanks: "Pens; laserable leatherette; coated drinkware",
    phone: "See website contact page",
    contact: "Use website contact form",
  },
];
