// Connector for SanMar Canada, integrated via the PromoStandards Bulk Data 1.0 SOAP/XML service.
//
// PROVENANCE — read this before touching field mappings:
//   (a) CONFIRMED LIVE — verified this session (2026-09-10) against production, from an
//       authorized VPS session, using real account credentials (customer 31392):
//         - WSDL:      https://edi.atc-apparel.com/bulk-data/BulkDataService.php?wsdl
//         - Method:    getBulkData (lowercase g)
//         - Auth:      { wsVersion: '1.0.0', id: <customer number>, password: <EDI email> } —
//                       passed per-request; there is no separate login/token call.
//         - Response:  ProductInventoryArray.Product[] — a FLAT array of one row per SKU
//                       (style + size + colour combination), NOT grouped by style. Every field
//                       this file reads off a raw row (productId, productName, frProductName,
//                       style, size, swatchColor, frSwatchColor, description, frDescription,
//                       brand, image, weight, caseSize, youth, discountCode, quantity, price,
//                       salePrice, saleEndDate, priceGroup) was present on a real captured
//                       response. soap.js is known (observed live) to sometimes deserialize a
//                       single-item XML array as a bare object instead of a length-1 array —
//                       every place below that walks Product[] normalizes for that defensively.
//   (b) FROM THE OFFICIAL GUIDE, NOT YET EXERCISED LIVE — SanMar Canada's 77-page PromoStandards
//       Integration Guide documents this and other services, but only Bulk Data has actually been
//       called: Bulk Data is rate-limited to ONCE PER CALENDAR DAY per account (this connector is
//       built around that constraint — see loadBulkData() below). Other services mentioned there
//       for future phases: Product Data 2.0 (GetProduct/GetProductSellable), Inventory 2.0
//       (getInventoryLevels, same EDI-email password), Purchase Order 1.0 (sendPO), Order Shipment
//       Notification 2.0, Product Pricing and Configuration 1.0, Invoice 1.0, Order Status 2.0,
//       and Media Content 1.1/1.2 (getMediaContent — needs a SEPARATE password issued by SanMar's
//       EDI team; do NOT assume it is the same as the main EDI-email password used here).
//   (c) HEURISTIC / BEST-EFFORT, NOT FROM ANY SUPPLIER DOCUMENTATION — the productType keyword
//       matcher in resolveProductType() below. SanMar's bulk data has no clean category field
//       (unlike S&S's baseCategory), so productType here is guessed from keywords in
//       productName/description. This is explicitly a first pass — see the comment on
//       PRODUCT_TYPE_KEYWORD_RULES for details and the flagged review item.
//
// Per project rule ("do not invent API endpoints, credentials, response formats, or supplier
// capabilities"): nothing in this file asserts behavior beyond (a) and (b) above as fact. Where
// this file makes a judgment call not confirmed by either source, it is called out explicitly.

import { createClientAsync, type Client } from 'soap';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

// (a) CONFIRMED LIVE.
const WSDL_URL = 'https://edi.atc-apparel.com/bulk-data/BulkDataService.php?wsdl';
const WS_VERSION = '1.0.0';

// soap.js has no built-in single "timeout" option on IOptions; per soap's own http.js
// (buildRequest()), any extra key on the per-call options object — e.g. `{ timeout }` — is
// copied straight into the underlying axios request config, so `{ timeout: SOAP_TIMEOUT_MS }`
// passed as the second argument to `getBulkDataAsync()` genuinely bounds that HTTP call. This was
// read directly out of node_modules/soap/lib/http.js this session, not assumed. `wsdl_options`
// below applies the same bound to the (separate, much smaller) WSDL-fetch request that
// createClientAsync makes. Bulk Data responses can be large, so this is generous — S&S's
// connector uses 45s for much smaller per-request payloads; the earlier real bug there was a
// timer cleared before the response body finished streaming (clearTimeout fired right after
// fetch() resolved, before res.json() completed), not the duration itself. There is no
// equivalent early-clear risk here: soap.js's own axios call owns the timeout for the full
// request+response lifecycle, so there is nothing this file needs to keep armed manually.
const SOAP_TIMEOUT_MS = 60_000;

// Bulk Data is rate-limited to ONCE PER CALENDAR DAY per account (confirmed in the official
// integration guide, not yet stress-tested live). Caching by calendar date — rather than a
// rolling "N hours since last fetch" window — is a deliberate, conservative reading of "once per
// day": it can never call twice within the same calendar day no matter how the process restarts,
// at the cost of being slightly more conservative right after local midnight. Relative to this
// file's own location, not process.cwd(), so it behaves the same regardless of where the
// import script is invoked from.
const CACHE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../.cache');

function cacheFilePath(dateKey: string): string {
  return path.join(CACHE_DIR, `sanmar-bulkdata-${dateKey}.json`);
}

function todayKey(): string {
  // UTC calendar day, so cache-file naming doesn't depend on server-local timezone.
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

export interface SanMarCredentials {
  customerId: string;
  ediEmail: string;
}

// --- Raw shape of a single row in the live getBulkData response, as actually observed (a). Only
// the fields this connector reads are declared; the real payload may carry more. ---
interface SanMarBulkRow {
  productId: string;
  productName?: string;
  frProductName?: string;
  style: string;
  size?: string;
  swatchColor?: string;
  frSwatchColor?: string;
  description?: string;
  frDescription?: string;
  brand?: string;
  image?: string;
  weight?: string;
  caseSize?: string;
  youth?: boolean;
  discountCode?: string; // non-empty => discontinued/limited availability, per the guide (b)
  quantity?: string; // string decimal; summed across warehouses, NOT real-time (b)
  price?: string;
  salePrice?: string | null;
  saleEndDate?: string | null;
  priceGroup?: string;
}

// PromoStandards-standardized error signal, per the official integration guide (b) — not yet
// observed live, but documented as the convention services use to report a request-level failure
// (as opposed to a SOAP fault) inside an otherwise "successful" envelope.
interface SanMarServiceMessage {
  code?: string;
  description?: string;
  severity?: string;
}

interface GetBulkDataResponse {
  ProductInventoryArray?: {
    Product?: SanMarBulkRow | SanMarBulkRow[];
  };
  ServiceMessageArray?: {
    ServiceMessage?: SanMarServiceMessage | SanMarServiceMessage[];
  };
}

// (b) FROM THE OFFICIAL GUIDE — standardized PromoStandards error codes (shared 100/104/105/110/
// 115/120/125 convention), with the Bulk-Data-specific text for each. 125 is the one directly
// relevant to today's observed failure: "reached maximum limit of call" is exactly the once-per-
// day quota this connector's disk cache exists to respect.
const PROMOSTANDARDS_ERROR_MESSAGES: Record<string, string> = {
  '100': 'Sender not Authorized to access this end point',
  '104': 'Invalid Service',
  '105': 'Unable to process request',
  '110': 'Invalid Credentials',
  '115': 'Account is on hold, please contact PromoStandards Supplier',
  '120': 'productId is invalid',
  '125': 'Reached maximum limit of call',
};

// PromoStandards code 200 = "No Error - Information Requested" — a SUCCESS signal, not a failure.
// OBSERVED LIVE 2026-09-11 (production VPS, real getBulkData call): SanMar attaches a single
// `ServiceMessage` with code 200 to an otherwise-successful Bulk Data response. The earlier
// version of extractServiceMessageError() treated ANY ServiceMessage as an error and threw before
// reading ProductInventoryArray, silently discarding a good full-catalogue pull (and burning that
// day's once-per-day quota for nothing). Only codes in PROMOSTANDARDS_ERROR_MESSAGES — plus any
// other non-200 code — are real errors.
const PROMOSTANDARDS_SUCCESS_CODES = new Set(['200']);

/** Pulls a human-readable error string out of a ServiceMessageArray, if a real error is present.
 *  Returns undefined when there is no ServiceMessageArray, it is empty, or every message is a
 *  success/informational signal (code 200) — those are all the normal/success case. */
function extractServiceMessageError(response: GetBulkDataResponse): string | undefined {
  const messages = asArray(response.ServiceMessageArray?.ServiceMessage).filter(
    (m) => !PROMOSTANDARDS_SUCCESS_CODES.has(String(m.code ?? '').trim()),
  );
  if (messages.length === 0) return undefined;
  return messages
    .map((m) => {
      const known = m.code ? PROMOSTANDARDS_ERROR_MESSAGES[m.code] : undefined;
      const text = m.description || known || 'Unknown error';
      return m.code ? `[${m.code}] ${text}` : text;
    })
    .join('; ');
}

// --- Degenerate/placeholder-response detection ---------------------------------------------
//
// OBSERVED LIVE TODAY (2026-09-10, production VPS, real confirmed test — not a hypothetical):
// a manual raw-SOAP test script made the day's first getBulkData call and got back a full, real
// product list. Later the same day, this connector's own getBulkData call (the SECOND call that
// day, via scripts/import-sanmar-catalogue.mjs) almost certainly tripped SanMar's once-per-day
// server-side quota. Instead of a SOAP fault or a ServiceMessageArray error, it came back as an
// otherwise "successful" envelope whose ProductInventoryArray.Product was a SINGLE row with every
// field empty/null (productId: "", style: "", productName: "", ..., quantity: null, price: null).
// That got silently treated downstream as "0 distinct styles, 0 classified, 0 unclassified" —
// i.e. swallowed as if it were a legitimately empty catalogue. This exact silent-empty-data shape
// already caused a real 177-product data-loss bug earlier in this project (a different supplier),
// so it must never again be allowed to pass as valid data.
//
// The check below is deliberately narrow and shape-based, NOT a literal match on the observed
// example: exactly one row whose primary identifier fields (productId, style) are both empty. A
// genuinely empty response (rows.length === 0) is NOT flagged by this — nothing in the docs rules
// out a legitimately empty catalogue, and conflating "zero rows" with "one degenerate placeholder
// row" would risk false-positiving on a real edge case that has never actually been observed. The
// discriminator is the placeholder SHAPE (one row, empty identifiers), not "few/no rows" generally.
function isDegeneratePlaceholderRow(row: SanMarBulkRow): boolean {
  return !row.productId && !row.style;
}

function looksLikeDegenerateBulkDataResponse(rows: SanMarBulkRow[]): boolean {
  if (rows.length !== 1) return false;
  const [only] = rows;
  return only !== undefined && isDegeneratePlaceholderRow(only);
}

/** soap.js can deserialize a single-item XML array as a bare object — normalize both cases. (a) */
function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function parseDecimal(value: string | undefined | null): number {
  if (value === undefined || value === null || value === '') return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// SanMar's `description`/`frDescription` fields come back HTML-ish with entities like `&nbsp;`
// (a). Rather than pull in an HTML-parsing dependency for a first pass, just decode the small set
// of entities actually observed live and strip tags — good enough for downstream display; not a
// general-purpose HTML sanitizer.
function cleanDescription(html: string | undefined): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&reg;/gi, '®')
    .replace(/&trade;/gi, '™')
    .replace(/\s+/g, ' ')
    .trim();
}

// (c) HEURISTIC — first-pass productType inference from keywords in productName/description.
// SanMar's bulk data has no category field to map from (unlike S&S's baseCategory, which is a
// real, confirmed-live enum handled in the S&S connector). This is a best-effort guess only, and
// deliberately uses the SAME productType vocabulary the rest of the pipeline already understands
// (see SSActivewearConnector.ts's BASE_CATEGORY_TO_PRODUCT_TYPE and scripts/route-map.mjs's
// MAPPED_PRODUCT_TYPES) so route-map.mjs and everything downstream work unchanged for SanMar
// products too — it is NOT introducing any new productType values.
//
// FLAGGED FOR HUMAN REVIEW: unlike S&S's category mapping (verified against a real distinct-value
// count from the live API), this keyword list has not been checked against SanMar's actual live
// product-name distribution. Order matters (first match wins) — more specific terms are checked
// before generic ones (e.g. "hoodie" before the generic "sweatshirt" that would otherwise also
// match a crewneck). Treat this as a starting point to refine once real SanMar product names are
// available to audit against.
// 2026-09-12 update: audited against the real distinct-style-name distribution from a live pull
// (671 styles) — the original 8 rules left 123 styles unclassified. Added rules below in the same
// first-match-wins, most-specific-first spirit, informed by what those 123 names actually were
// (see catalogue-engine README/PROJECT_NOTES for the audit). Still a keyword heuristic, not a
// confirmed category field — same caveat as the original list.
const PRODUCT_TYPE_KEYWORD_RULES: Array<{ pattern: RegExp; productType: string }> = [
  // "Flexfit" is a headwear-specific brand (Yupoong's Flexfit line) — its styles use knit-fabric
  // jargon like "wooly combed" or "mini pique" that would otherwise read as apparel, not caps.
  { pattern: /\b(cap|trucker|hat|beanie|toque|visor|flexfit|snapback)\b/i, productType: 'headwear' },
  // Bag-shaped items beyond the original duffel/backpack/tote list: messenger bags, packable
  // spinners/luggage, hip/fanny/cinch/generic packs, soft coolers (e.g. "CARHARTT LUNCH 6-CAN
  // COOLER" is a cooler bag, not drinkware) — all route to the same no-chart "bags" shelf.
  { pattern: /\b(messenger|spinner|hip pack|fanny pack|cinch pack|\bpack\b|cooler)\b/i, productType: 'bag' },
  // Small worn/carried accessories with no print-cost chart — same bucket as socks/scarves/gloves.
  { pattern: /\b(scarf|gaiter|face mask|wristband|headband)\b/i, productType: 'accessory' },
  // Brand- or keyword-flagged industrial/safety workwear (Red Kap, Bulwark, Dickies are all
  // workwear-specific brands on SanMar; "coverall"/"bib overall"/"hi-visibility"/"FR " catch the
  // rest) — checked before the generic woven-shirt/pants rules below so e.g. a Red Kap work shirt
  // doesn't fall into the plain "woven_shirt" bucket instead.
  { pattern: /\b(red kap|bulwark|dickies|coverall|bib overall|hi-visibility|\bfr\b)\b/i, productType: 'workwear_safety' },
  { pattern: /\b(woven|work shirt|twill shirt|oxford)\b/i, productType: 'woven_shirt' },
  // Pullovers/zips that aren't hoodies belong with the existing "knits & layering" category
  // (quarter-zips, cardigans — see SSActivewearConnector.ts's identical mapping), not a new type.
  { pattern: /\b(1\/4 zip|quarter zip|1\/2 zip|half zip|full zip|pullover)\b/i, productType: 'knit_layering' },
  { pattern: /\b(hoodie|hooded sweatshirt)\b/i, productType: 'hoodie' },
  // Bare "crew" (no "neck"/"sweatshirt") shows up on athletic-brand crewneck tops, e.g. "OGIO
  // ENDURANCE PULSE CREW" or "NIKE CLUB FLEECE SLEEVE SWOOSH CREW" — same garment, different
  // supplier's naming convention.
  { pattern: /\b(crewneck|crew neck|sweatshirt|fleece crew|\bcrew\b)\b/i, productType: 'crewneck' },
  { pattern: /\bpolo\b/i, productType: 'polo' },
  { pattern: /\b(jacket|outerwear|softshell|windbreaker|parka|vest|trench)\b/i, productType: 'jacket' },
  // Sweatpants/joggers/athletic shorts — decorated on the same apparel chart as tees (see
  // route-map.mjs's APPAREL_PRODUCT_TYPES). Checked after workwear/woven rules above so a Red Kap
  // work pant still lands in workwear_safety, not here.
  { pattern: /\b(sweatpants|jogger|\bshorts?\b|\bpants?\b)\b/i, productType: 'bottoms' },
  // Tanks, henleys and jerseys are still just decorated apparel priced on the same tee chart.
  { pattern: /\b(t-?shirt|tee|tank|henley|jersey)\b/i, productType: 't_shirt' },
  { pattern: /\b(duffel|backpack|tote bag|tote|bag)\b/i, productType: 'bag' },
  { pattern: /\bapron\b/i, productType: 'apron' },
];

// Debug-level visibility into how many SKUs this pass couldn't classify, so the silent-drop
// pattern is discoverable rather than invisible — the same silent-drop shape cost 177 products
// with S&S earlier this session. Reset per fetchProductCatalogue() call; read via
// getUnclassifiedProductTypeCount() after iterating the generator to completion.
function resolveProductType(productName: string | undefined, description: string | undefined): string | undefined {
  const haystack = `${productName ?? ''} ${description ?? ''}`;
  for (const rule of PRODUCT_TYPE_KEYWORD_RULES) {
    if (rule.pattern.test(haystack)) return rule.productType;
  }
  return undefined; // matches SSActivewearConnector's convention: unmapped items stay undefined,
  // not guessed — caller decides how to handle products with no productType.
}

// No per-warehouse breakdown exists in the Bulk Data response (a) — `quantity` is a single summed
// total. No existing convention for a single-warehouse supplier was found elsewhere in this
// codebase (MockConnector uses a generic 'MAIN', which would collide across suppliers in the DB),
// so this uses a supplier-namespaced synthetic code instead.
const SANMAR_WAREHOUSE_CODE = 'SANMAR-TOTAL';

export class SanMarConnector implements SupplierConnector {
  readonly supplierCode = 'sanmar';

  private soapClient: Client | undefined;
  // In-memory cache for the life of this connector instance — avoids re-parsing the (potentially
  // large) bulk response, and avoids re-reading the disk cache, on every method call within one
  // import run.
  private bulkDataCache: SanMarBulkRow[] | undefined;
  private bulkDataCacheDateKey: string | undefined;
  private unclassifiedProductTypeCount = 0;

  constructor(private readonly credentials: SanMarCredentials) {}

  /** Number of distinct SKUs from the most recent fetchProductCatalogue() run that resolveProductType()
   *  could not classify. 0 before any run. Intended for a human to review periodically — see the
   *  FLAGGED FOR HUMAN REVIEW comment above PRODUCT_TYPE_KEYWORD_RULES. */
  getUnclassifiedProductTypeCount(): number {
    return this.unclassifiedProductTypeCount;
  }

  private async getSoapClient(): Promise<Client> {
    if (this.soapClient) return this.soapClient;
    this.soapClient = await createClientAsync(WSDL_URL, {
      wsdl_options: { timeout: SOAP_TIMEOUT_MS },
    });
    return this.soapClient;
  }

  authenticate(): Promise<void> {
    // SOAP has no separate login/token step (a) — credentials are passed per-request inside
    // getBulkData's own args. Deliberately does NOT call getBulkData here: that method is
    // rate-limited to once per calendar day (b), and burning that quota on a routine
    // "is auth working" check would leave nothing left for the actual import. Instead this
    // proves basic connectivity by fetching/parsing the WSDL itself, which is a separate,
    // unlimited, lightweight request — confirmed via soap.js's own createClientAsync behavior
    // (it only fetches the WSDL document; it does not invoke any SOAP method).
    return this.getSoapClient().then(() => undefined);
  }

  async healthCheck(): Promise<HealthCheckResult> {
    try {
      await this.getSoapClient();
      return { ok: true };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Loads the full Bulk Data response, using the calendar-day disk cache when available so a
   * same-day rerun of an import script never re-calls the rate-limited getBulkData method.
   * `forceRefresh` bypasses both the in-memory and disk cache and calls the live API — use only
   * when deliberately re-pulling for the day (e.g. a manual retry after a known bad response),
   * never as a default.
   */
  private async loadBulkData(forceRefresh = false): Promise<SanMarBulkRow[]> {
    const dateKey = todayKey();

    if (!forceRefresh && this.bulkDataCache && this.bulkDataCacheDateKey === dateKey) {
      return this.bulkDataCache;
    }

    if (!forceRefresh) {
      const diskCached = await this.readDiskCache(dateKey);
      if (diskCached) {
        this.bulkDataCache = diskCached;
        this.bulkDataCacheDateKey = dateKey;
        return diskCached;
      }
    }

    const rows = await this.fetchBulkDataLive();
    this.bulkDataCache = rows;
    this.bulkDataCacheDateKey = dateKey;
    await this.writeDiskCache(dateKey, rows).catch(() => {
      // Disk cache is a best-effort optimization, not a correctness requirement — a write
      // failure (e.g. read-only filesystem) should not fail the import that just successfully
      // fetched live data.
    });
    return rows;
  }

  private async readDiskCache(dateKey: string): Promise<SanMarBulkRow[] | undefined> {
    const filePath = cacheFilePath(dateKey);
    if (!existsSync(filePath)) return undefined;
    try {
      const raw = await readFile(filePath, 'utf-8');
      const parsed = JSON.parse(raw) as SanMarBulkRow[];
      return Array.isArray(parsed) ? parsed : undefined;
    } catch {
      // Corrupt/unreadable cache file — fall through to a live fetch rather than throwing, since
      // this is the getBulkData quota's one and only fetch for the day.
      return undefined;
    }
  }

  private async writeDiskCache(dateKey: string, rows: SanMarBulkRow[]): Promise<void> {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(cacheFilePath(dateKey), JSON.stringify(rows), 'utf-8');
  }

  private async fetchBulkDataLive(): Promise<SanMarBulkRow[]> {
    const client = await this.getSoapClient();
    // (a) CONFIRMED LIVE shape of the request args and response envelope.
    const args = {
      wsVersion: WS_VERSION,
      id: this.credentials.customerId,
      password: this.credentials.ediEmail,
    };
    const soapMethod = (client as unknown as Record<string, unknown>)['getBulkDataAsync'] as
      | ((a: unknown, opts?: unknown) => Promise<[GetBulkDataResponse, ...unknown[]]>)
      | undefined;
    if (!soapMethod) {
      throw new Error(
        "sanmar: WSDL did not expose a 'getBulkData' operation (looked for 'getBulkDataAsync' on " +
          'the generated soap client) — the WSDL at the confirmed URL may have changed since this ' +
          'connector was verified live.',
      );
    }
    const [result] = await soapMethod.call(client, args, { timeout: SOAP_TIMEOUT_MS });

    // Check for a standardized PromoStandards error signal first — if SanMar DID surface a real
    // error/code (e.g. 125 = "Reached maximum limit of call"), surface that real code/message
    // rather than inventing generic text.
    const serviceMessageError = extractServiceMessageError(result);
    if (serviceMessageError) {
      throw new Error(
        `sanmar: getBulkData returned a ServiceMessageArray error: ${serviceMessageError}. ` +
          'If this is a "maximum limit of call" (125) error, it means today\'s once-per-day Bulk ' +
          'Data quota has already been used — try again after the next UTC day boundary.',
      );
    }

    const rows = asArray(result?.ProductInventoryArray?.Product);

    // See the "Degenerate/placeholder-response detection" block above SanMarConnector for the
    // full reasoning — this is a REAL failure mode confirmed by live testing today (2026-09-10),
    // not a hypothetical. SanMar does not always signal the once-per-day quota via a SOAP fault or
    // a ServiceMessageArray error (handled above); it can instead return a "successful" envelope
    // containing exactly one placeholder row with every field empty/null. Treat that as a failure,
    // never as "zero real products" — and deliberately do NOT disk-cache it (the caller here is
    // fetchBulkDataLive; loadBulkData() only writes the disk cache after this function returns
    // successfully, so throwing here already prevents that).
    if (looksLikeDegenerateBulkDataResponse(rows)) {
      throw new Error(
        'sanmar: Bulk Data returned a degenerate/empty response — exactly one product row with ' +
          'every field empty/null. This usually means today\'s once-per-day rate limit was already ' +
          'used by another process (confirmed live 2026-09-10: a separate manual test script made ' +
          "the day's first getBulkData call successfully; this connector's own call, made later the " +
          'same day, got this placeholder back instead of real data). Try again after the next UTC ' +
          'day boundary. This response has NOT been written to the disk cache.',
      );
    }

    return rows;
  }

  async *fetchProductCatalogue(_opts?: { since?: Date }): AsyncGenerator<RawSupplierProduct> {
    // Bulk Data has no lastModified/since concept in the confirmed response shape (a) — `since`
    // is accepted for interface compatibility only, same as SSActivewearConnector's fetchProductCatalogue.
    const rows = await this.loadBulkData();

    this.unclassifiedProductTypeCount = 0;

    const rowsByStyle = new Map<string, SanMarBulkRow[]>();
    for (const row of rows) {
      if (!row.style) continue; // defensive: a row with no style can't be grouped into a product
      const list = rowsByStyle.get(row.style) ?? [];
      list.push(row);
      rowsByStyle.set(row.style, list);
    }

    for (const [style, styleRows] of rowsByStyle) {
      const first = styleRows[0];
      if (!first) continue;
      const cleanedDescription = cleanDescription(first.description);
      // OBSERVED LIVE 2026-09-12: productName comes back with the same HTML-entity encoding as
      // description ("CARHARTT&reg;", "CH ESSENTIAL&reg;") but was previously used raw — every
      // promoted product name showed literal "&reg;" instead of "®" on the site. cleanDescription()
      // already does exactly the right entity decode (plus a harmless no-op tag-strip; SanMar names
      // have never been observed to contain tags), so reuse it here too rather than duplicating the
      // entity list. Classification below still runs on the raw name — decoding doesn't change
      // which keywords match.
      const cleanedProductName = cleanDescription(first.productName);
      const productType = resolveProductType(first.productName, cleanedDescription);
      if (!productType) this.unclassifiedProductTypeCount += 1;

      yield {
        // SanMar's bulk data has only ONE style-level identifier (`style`) — unlike S&S, which
        // has a numeric internal styleID *and* a separate customer-facing partNumber, SanMar
        // gives us just this one string. Using it for both is the accurate representation of
        // what SanMar actually provides, not a guess.
        supplierProductId: style,
        supplierStyleCode: style,
        brandName: first.brand ?? '',
        productName: cleanedProductName,
        description: cleanedDescription,
        productType,
        variants: styleRows.map((row): RawSupplierVariant => {
          const isDiscontinued = Boolean(row.discountCode && row.discountCode.trim() !== '');
          const quantity = parseDecimal(row.quantity);
          return {
            // (a) confirmed: productId is SanMar's own unique per-SKU key.
            supplierVariantId: row.productId,
            // SanMar's bulk data has no separate customer-facing SKU distinct from productId —
            // using the same value for both, unlike S&S where `sku` and the composite variant id
            // differ. Flag: if a later PromoStandards service (e.g. Product Data 2.0) exposes a
            // distinct SKU field, prefer that over this fallback.
            supplierSku: row.productId,
            colourName: row.swatchColor ?? '',
            size: row.size ?? '',
            wholesaleCost: parseDecimal(row.price),
            // edi.atc-apparel.com is SanMar's *Canada* EDI backend (per the confirmed WSDL host,
            // not sanmarcanada.com) — CAD is a reasonable inference from that, matching how
            // SSActivewearConnector infers CAD from its api-ca.ssactivewear.com host, but unlike
            // S&S's case this has not been independently confirmed against a labeled currency
            // field in the live response. Flag for confirmation once a real order/invoice is
            // available to cross-check against.
            currency: 'CAD',
            // No distinct MAP-price field was present in the confirmed live response (only
            // `price` and `salePrice`, neither of which is documented as a minimum-advertised-
            // price concept) — leaving mapPrice unset rather than guessing which field it might be.
            isOrderable: !isDiscontinued && quantity > 0,
            // No UPC/GTIN field observed in the confirmed live response — left unset rather than
            // guessed, unlike S&S where `gtin` is a real, observed field.
          };
        }),
        images: dedupeImages(styleRows),
        // Kept intentionally small (one sample row + count), same convention as
        // SSActivewearConnector's rawPayload, rather than the full per-style row array which can
        // run into dozens of size/colour rows for one style.
        rawPayload: { sampleRow: first, variantCount: styleRows.length },
      };
    }
  }

  async fetchInventory(supplierVariantIds: string[]): Promise<RawInventoryRecord[]> {
    const rows = await this.loadBulkData();
    const byProductId = new Map(rows.map((r) => [r.productId, r] as const));

    const out: RawInventoryRecord[] = [];
    for (const id of supplierVariantIds) {
      const row = byProductId.get(id);
      if (!row) continue; // SKU not present in the most recent bulk pull — caller's diff will flag it missing
      out.push({
        supplierVariantId: id,
        // No per-warehouse breakdown available (a) — see SANMAR_WAREHOUSE_CODE comment above.
        warehouseCode: SANMAR_WAREHOUSE_CODE,
        availableQty: parseDecimal(row.quantity),
      });
    }
    return out;
  }

  async fetchPricing(supplierVariantIds: string[]): Promise<RawPriceRecord[]> {
    const rows = await this.loadBulkData();
    const byProductId = new Map(rows.map((r) => [r.productId, r] as const));

    const out: RawPriceRecord[] = [];
    for (const id of supplierVariantIds) {
      const row = byProductId.get(id);
      if (!row) continue;
      out.push({
        supplierVariantId: id,
        wholesaleCost: parseDecimal(row.price),
        currency: 'CAD', // see currency comment in fetchProductCatalogue
      });
    }
    return out;
  }

  async checkLiveAvailability(supplierSku: string, _warehouseCode?: string): Promise<LiveAvailability> {
    // IMPORTANT LIMITATION, not invented behavior: unlike SSActivewearConnector's
    // checkLiveAvailability (which makes a real live request every call), this method reads from
    // the SAME calendar-day-cached Bulk Data used by the bulk sync methods above — Bulk Data's
    // documented once-per-day rate limit (b) makes a true per-call live lookup impossible with
    // this service alone. That means the number returned here can be up to ~24h stale, and
    // `quantity` itself is documented as "NOT real-time" even within a single Bulk Data pull (a).
    // A genuinely live per-SKU check would need SanMar's separate Inventory 2.0 service
    // (getInventoryLevels), which is documented in the guide (b) but has not been implemented or
    // exercised — left for a future phase rather than assumed to behave the same way.
    const rows = await this.loadBulkData();
    const row = rows.find((r) => r.productId === supplierSku);
    const qty = row ? parseDecimal(row.quantity) : 0;
    return {
      supplierSku,
      // Always null: there is no per-warehouse breakdown to select from (a); accepting the
      // `warehouseCode` param only for interface compatibility, same spirit as SSActivewearConnector
      // accepting it as optional.
      warehouseCode: null,
      availableQty: qty,
      checkedAt: new Date().toISOString(),
    };
  }

  // Phase 8 territory, same as every other connector in this codebase — Purchase Order 1.0
  // (sendPO) exists per the guide (b) but its request/response shape has not been verified
  // against a real call, and testing it live would place a real order on the account.
  async submitOrder(_order: SupplierOrderRequest): Promise<SupplierOrderResult> {
    throw new NotImplementedError(this.supplierCode, 'submitOrder');
  }

  async getShipmentStatus(_supplierOrderId: string): Promise<ShipmentStatus> {
    throw new NotImplementedError(this.supplierCode, 'getShipmentStatus');
  }
}

function dedupeImages(rows: SanMarBulkRow[]): RawSupplierImage[] {
  const seenColours = new Set<string>();
  const images: RawSupplierImage[] = [];
  for (const row of rows) {
    const colour = row.swatchColor ?? '';
    if (seenColours.has(colour)) continue;
    seenColours.add(colour);
    if (row.image) {
      // Bulk Data gives exactly one image URL per row (a) — no separate front/back/swatch shots
      // like S&S provides, so this is tagged 'primary' rather than guessing which angle it is.
      images.push({ url: row.image, colourName: colour, imageType: 'primary' });
    }
  }
  return images;
}
