// Real connector for S&S Activewear Canada, built and verified against the live API on
// 2026-08-02 using MapleImprint's actual dealer credentials (account C05087). Every field name,
// endpoint, and constraint documented below was confirmed by calling the live API directly —
// nothing here is guessed from generic docs. See README.md in this folder for the full
// verification log (raw sample responses, what was tried, what didn't work).
//
// KEY CONSTRAINT (verified live, not documented anywhere public): the /products/ endpoint
// ONLY filters by `style=` (comma-separated styleIDs). Every other query param tested —
// `sku=`, `skuid=`, arbitrary garbage — is silently IGNORED and returns the ENTIRE catalogue
// (~80MB+). There is no working single-SKU lookup endpoint. Because of this, every method
// below that needs to resolve a specific SKU encodes the styleID directly into
// `supplierVariantId` as `${styleID}:${sku}` — an opaque composite key per the contract's own
// rule that nothing outside this folder should interpret supplier-native identifiers. This
// avoids ever needing a whole-catalogue pull just to check one SKU.

import type {
  SupplierConnector,
  RawSupplierProduct,
  RawSupplierVariant,
  RawSupplierImage,
  RawInventoryRecord,
  RawPriceRecord,
  LiveAvailability,
  SupplierOrderRequest,
  SupplierOrderResult,
  ShipmentStatus,
  HealthCheckResult,
} from '../contract.js';
import { NotImplementedError } from '../contract.js';

const API_BASE = 'https://api-ca.ssactivewear.com/v2';
const IMAGE_BASE = 'https://cdn.ssactivewear.com';

// Confirmed via response header X-Rate-Limit-Remaining during verification: 60 requests/minute.
// One request per 1.1s stays comfortably under that even with clock jitter.
const MIN_REQUEST_INTERVAL_MS = 1100;

// /products/?style=id1,id2,... — kept small enough to keep URLs short and batches fast;
// not a documented API limit, just a conservative choice verified to work (tested at 2 styles).
const STYLE_BATCH_SIZE = 40;

export interface SSActivewearCredentials {
  accountNumber: string;
  apiKey: string;
}

// --- Raw shapes of the live API responses, as actually observed (not the full field list —
// only what this connector reads). Extra fields on the real payloads are ignored. ---

interface SSStyle {
  styleID: number;
  partNumber: string;
  brandName: string;
  styleName: string;
  title: string;
  description: string;
  baseCategory: string;
  // Comma-separated S&S internal category tag IDs (verified live 2026-08-03 via /v2/categories/,
  // 622 total tags e.g. "Youth", "Aprons", "Corporate Uniforms" — much finer-grained than
  // baseCategory). Used by SPECIAL_CATEGORY_OVERRIDES below to route use-case-specific product
  // lines (workwear, youth, aprons) that baseCategory alone can't distinguish.
  categories: string;
}

// S&S's own `baseCategory` values, confirmed live by pulling the full /styles/ list and counting
// distinct values (2026-08-02) — see ssactivewear/README.md. Every value below was seen in that
// real distribution (197 Outerwear, 162 T-Shirts - Premium, 153 Polos, 115 Knits & Layering, 100
// Headwear, 71 Wovens, 61 T-Shirts - Long Sleeve, 59 Fleece - Premium - Hood, 48 Bottoms, 43 Bags,
// 37 Fleece - Premium - Crew, 16 Accessories, 13 Fleece - Core - Hood, 10 T-Shirts - Core, 6
// Fleece - Core - Crew, 1 Office Use). Deliberately NOT mapped: "Knits & Layering" and "Wovens"
// (no clean fit to any of the site's Custom Apparel subcategories — guessing would misfile real
// products), "Bottoms"/"Accessories"/"Office Use" (no matching site subcategory at all).
const BASE_CATEGORY_TO_PRODUCT_TYPE: Record<string, string> = {
  'T-Shirts - Premium': 't_shirt',
  'T-Shirts - Core': 't_shirt',
  'T-Shirts - Long Sleeve': 't_shirt', // still a tee for site-routing/pricing purposes
  Polos: 'polo',
  'Fleece - Premium - Hood': 'hoodie',
  'Fleece - Core - Hood': 'hoodie',
  'Fleece - Premium - Crew': 'crewneck',
  'Fleece - Core - Crew': 'crewneck',
  Outerwear: 'jacket',
  Headwear: 'headwear', // caps vs beanies/toques split by product name — see export script
  Bags: 'bag',
};

// Use-case-specific product lines that baseCategory can't express (a "Corporate Uniforms" style
// might have baseCategory "Polos" same as a plain polo). Checked in order, first match wins, and
// checked BEFORE the baseCategory fallback above — a style tagged "Aprons" or "Safety" should
// route to that dedicated site section instead of wherever its raw garment type would otherwise
// land. Category IDs verified live against /v2/categories/ + real /styles/ tag membership
// (2026-08-03) — see README.md's "Category mapping" section for counts and sample titles.
const SPECIAL_CATEGORY_OVERRIDES: Array<{ categoryIds: number[]; productType: string }> = [
  { categoryIds: [1, 1196], productType: 'apron' }, // Aprons / Silo Accessories - Aprons/Chefwear
  { categoryIds: [1127, 314], productType: 'workwear_healthcare' }, // Medical & Med Spa Staff Uniforms / Scrubs
  { categoryIds: [1103], productType: 'workwear_hospitality' }, // Restaurant & Hospitality Staff Uniforms
  { categoryIds: [1101], productType: 'workwear_construction' }, // Industrial & Workwear - In the Field
  { categoryIds: [40], productType: 'workwear_safety' }, // Safety
  { categoryIds: [1066], productType: 'workwear_business' }, // Corporate Uniforms
];
// Youth is only routed to its own section when the underlying garment is one we already sell as
// apparel (t-shirt/polo/hoodie/crewneck/jacket) — a youth apron or youth cap stays an apron/cap.
const YOUTH_CATEGORY_ID = 28;

function resolveProductType(style: SSStyle): string | undefined {
  const styleCategoryIds = new Set(
    (style.categories ?? '')
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n)),
  );

  for (const rule of SPECIAL_CATEGORY_OVERRIDES) {
    if (rule.categoryIds.some((id) => styleCategoryIds.has(id))) return rule.productType;
  }

  const baseType = BASE_CATEGORY_TO_PRODUCT_TYPE[style.baseCategory];
  if (
    styleCategoryIds.has(YOUTH_CATEGORY_ID) &&
    baseType &&
    ['t_shirt', 'polo', 'hoodie', 'crewneck', 'jacket'].includes(baseType)
  ) {
    return 'youth_apparel';
  }
  return baseType;
}

interface SSWarehouse {
  warehouseAbbr: string;
  qty: number;
  closeout: boolean;
}

interface SSProductRow {
  sku: string;
  gtin: string;
  styleID: number;
  colorName: string;
  sizeName: string;
  mapPrice: number;
  customerPrice: number;
  qty: number;
  colorFrontImage: string;
  colorBackImage: string;
  colorSwatchImage: string;
  warehouses: SSWarehouse[];
}

function encodeVariantId(styleID: number, sku: string): string {
  return `${styleID}:${sku}`;
}

function decodeVariantId(supplierVariantId: string): { styleID: number; sku: string } {
  const sepIndex = supplierVariantId.indexOf(':');
  if (sepIndex === -1) {
    throw new Error(
      `ssactivewear: '${supplierVariantId}' is not a valid supplierVariantId — expected ` +
        `'{styleID}:{sku}' as produced by fetchProductCatalogue. This connector cannot resolve ` +
        `a bare SKU without a styleID because the live API has no working single-SKU filter.`,
    );
  }
  const styleID = Number(supplierVariantId.slice(0, sepIndex));
  const sku = supplierVariantId.slice(sepIndex + 1);
  if (!Number.isFinite(styleID) || !sku) {
    throw new Error(`ssactivewear: could not parse styleID/sku out of '${supplierVariantId}'`);
  }
  return { styleID, sku };
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export class SSActivewearConnector implements SupplierConnector {
  readonly supplierCode = 'ssactivewear';

  private readonly authHeader: string;
  private lastRequestAt = 0;

  constructor(private readonly credentials: SSActivewearCredentials) {
    const encoded = Buffer.from(`${credentials.accountNumber}:${credentials.apiKey}`).toString(
      'base64',
    );
    this.authHeader = `Basic ${encoded}`;
  }

  private async throttle(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestAt;
    if (elapsed < MIN_REQUEST_INTERVAL_MS) {
      await new Promise((resolve) => setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - elapsed));
    }
    this.lastRequestAt = Date.now();
  }

  private async apiGet<T>(path: string): Promise<T> {
    await this.throttle();
    // Plain fetch() has no default timeout — a stalled connection to S&S would otherwise hang
    // this call (and the whole import) forever with no error, no log line, nothing to act on.
    // Observed live 2026-08-08: an import genuinely hung for 6+ minutes with zero output.
    //
    // The timer MUST stay armed through res.json(), not just the initial fetch(): headers can
    // arrive fine and then the body stream (batches run up to ~8MB) stalls mid-download. An
    // earlier version cleared the timeout as soon as fetch() resolved, leaving res.json() with
    // zero timeout protection — confirmed live 2026-08-09 as the actual cause of repeated
    // multi-minute silent hangs (no error, no log line, DB writes just stop) that a 45s-on-
    // fetch-only timer never caught.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        headers: { Authorization: this.authHeader, Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`ssactivewear: GET ${path} failed with ${res.status}: ${body.slice(0, 300)}`);
      }
      return (await res.json()) as T;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`ssactivewear: GET ${path} timed out after 45s`);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  async authenticate(): Promise<void> {
    // Basic Auth has no separate login step — the real test is whether a call succeeds.
    // /categories/ is small (~35KB) and cheap, confirmed working during verification.
    await this.apiGet<unknown>('/categories/');
  }

  async healthCheck(): Promise<HealthCheckResult> {
    try {
      await this.apiGet<unknown>('/categories/');
      return { ok: true };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  async *fetchProductCatalogue(_opts?: { since?: Date }): AsyncIterable<RawSupplierProduct> {
    // The live API has no lastModified/since field on styles or products (confirmed by
    // inspecting real responses) — there is no way to ask S&S for "what changed." `since` is
    // accepted for interface compatibility but ignored; incremental detection happens downstream
    // via sync/change-detection.ts diffing this full pull against what's already stored.
    const styles = await this.apiGet<SSStyle[]>('/styles/');

    for (const styleBatch of chunk(styles, STYLE_BATCH_SIZE)) {
      const styleIds = styleBatch.map((s) => s.styleID).join(',');
      const rows = await this.apiGet<SSProductRow[]>(`/products/?style=${styleIds}`);

      const rowsByStyle = new Map<number, SSProductRow[]>();
      for (const row of rows) {
        const list = rowsByStyle.get(row.styleID) ?? [];
        list.push(row);
        rowsByStyle.set(row.styleID, list);
      }

      for (const style of styleBatch) {
        const styleRows = rowsByStyle.get(style.styleID);
        if (!styleRows || styleRows.length === 0) continue; // style has no purchasable SKUs

        yield {
          supplierProductId: String(style.styleID),
          supplierStyleCode: style.partNumber,
          brandName: style.brandName,
          productName: style.title || style.styleName,
          description: style.description ?? '', // raw HTML as returned by S&S, not sanitized here
          productType: resolveProductType(style),
          variants: styleRows.map((row): RawSupplierVariant => {
            // A SKU counts as orderable if at least one warehouse carries it and isn't a closeout.
            const orderableWarehouse = row.warehouses.some((w) => !w.closeout && w.qty > 0);
            return {
              supplierVariantId: encodeVariantId(row.styleID, row.sku),
              supplierSku: row.sku,
              colourName: row.colorName,
              size: row.sizeName,
              // customerPrice is this dealer account's actual negotiated cost (verified: it's
              // account-specific, not the same as retailPrice/mapPrice on the live response).
              wholesaleCost: row.customerPrice,
              currency: 'CAD', // api-ca.ssactivewear.com — confirmed Canadian-dollar endpoint
              mapPrice: row.mapPrice,
              isOrderable: orderableWarehouse,
              upc: row.gtin || undefined,
            };
          }),
          images: dedupeImages(styleRows),
          rawPayload: { style, sampleRow: styleRows[0] },
        };
      }
    }
  }

  async fetchInventory(supplierVariantIds: string[]): Promise<RawInventoryRecord[]> {
    const decoded = supplierVariantIds.map((id) => ({ id, ...decodeVariantId(id) }));
    const styleIds = [...new Set(decoded.map((d) => d.styleID))];
    const bySku = await this.fetchRowsForStyles(styleIds);

    const out: RawInventoryRecord[] = [];
    for (const { id, sku } of decoded) {
      const row = bySku.get(sku);
      if (!row) continue; // SKU no longer exists on S&S's side — caller's diff will flag it missing
      for (const wh of row.warehouses) {
        out.push({
          supplierVariantId: id,
          warehouseCode: wh.warehouseAbbr,
          availableQty: wh.qty,
        });
      }
    }
    return out;
  }

  async fetchPricing(supplierVariantIds: string[]): Promise<RawPriceRecord[]> {
    const decoded = supplierVariantIds.map((id) => ({ id, ...decodeVariantId(id) }));
    const styleIds = [...new Set(decoded.map((d) => d.styleID))];
    const bySku = await this.fetchRowsForStyles(styleIds);

    const out: RawPriceRecord[] = [];
    for (const { id, sku } of decoded) {
      const row = bySku.get(sku);
      if (!row) continue;
      out.push({
        supplierVariantId: id,
        wholesaleCost: row.customerPrice,
        currency: 'CAD',
        mapPrice: row.mapPrice,
      });
    }
    return out;
  }

  async checkLiveAvailability(supplierSku: string, warehouseCode?: string): Promise<LiveAvailability> {
    // NOTE: despite the interface calling this parameter `supplierSku`, this connector requires
    // the composite `{styleID}:{sku}` form (same string as RawSupplierVariant.supplierVariantId)
    // because — verified live — there is no API filter that resolves a bare SKU without pulling
    // the entire ~80MB catalogue. Any caller must have gone through fetchProductCatalogue first
    // and kept the supplierVariantId around; there is no cheaper path available from S&S today.
    const { styleID, sku } = decodeVariantId(supplierSku);
    const rows = await this.apiGet<SSProductRow[]>(`/products/?style=${styleID}`);
    const row = rows.find((r) => r.sku === sku);
    if (!row) {
      return { supplierSku: sku, warehouseCode: warehouseCode ?? null, availableQty: 0, checkedAt: new Date().toISOString() };
    }
    if (warehouseCode) {
      const wh = row.warehouses.find((w) => w.warehouseAbbr === warehouseCode);
      return {
        supplierSku: sku,
        warehouseCode,
        availableQty: wh?.qty ?? 0,
        checkedAt: new Date().toISOString(),
      };
    }
    const total = row.warehouses.reduce((sum, w) => sum + w.qty, 0);
    return { supplierSku: sku, warehouseCode: null, availableQty: total, checkedAt: new Date().toISOString() };
  }

  // Order placement was deliberately NOT tested against the live API — doing so would place a
  // real order on MapleImprint's actual S&S account. Endpoint exists (POST /orders/, confirmed
  // via api.ssactivewear.com/V2/Orders_Post.aspx docs) but its request/response shape has not
  // been verified against a real call. Implement and test this deliberately, with a sandbox or
  // a tiny real test order, before relying on it — same "Phase 8 territory" rule as every other
  // connector in this codebase.
  async submitOrder(_order: SupplierOrderRequest): Promise<SupplierOrderResult> {
    throw new NotImplementedError(this.supplierCode, 'submitOrder');
  }

  async getShipmentStatus(_supplierOrderId: string): Promise<ShipmentStatus> {
    throw new NotImplementedError(this.supplierCode, 'getShipmentStatus');
  }

  private async fetchRowsForStyles(styleIds: number[]): Promise<Map<string, SSProductRow>> {
    const bySku = new Map<string, SSProductRow>();
    for (const batch of chunk(styleIds, STYLE_BATCH_SIZE)) {
      const rows = await this.apiGet<SSProductRow[]>(`/products/?style=${batch.join(',')}`);
      for (const row of rows) bySku.set(row.sku, row);
    }
    return bySku;
  }
}

function dedupeImages(rows: SSProductRow[]): RawSupplierImage[] {
  const seenColours = new Set<string>();
  const images: RawSupplierImage[] = [];
  for (const row of rows) {
    if (seenColours.has(row.colorName)) continue;
    seenColours.add(row.colorName);
    if (row.colorFrontImage) {
      images.push({
        url: `${IMAGE_BASE}/${row.colorFrontImage}`,
        colourName: row.colorName,
        imageType: 'front',
      });
    }
    if (row.colorBackImage) {
      images.push({
        url: `${IMAGE_BASE}/${row.colorBackImage}`,
        colourName: row.colorName,
        imageType: 'back',
      });
    }
    if (row.colorSwatchImage) {
      images.push({
        url: `${IMAGE_BASE}/${row.colorSwatchImage}`,
        colourName: row.colorName,
        imageType: 'swatch',
      });
    }
  }
  return images;
}
