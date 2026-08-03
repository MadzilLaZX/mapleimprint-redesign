// TEMPLATE — copy this file into integrations/suppliers/<supplier-code>/ and fill in the TODOs
// once real API credentials and documentation exist. This is not wired into any sync job or
// export — it exists purely as a compiling, type-checked starting point so implementing a real
// connector is a fill-in-the-blanks exercise instead of a from-scratch design exercise.
//
// See ../_template/README.md for the full step-by-step guide.
//
// Non-negotiable rule this template enforces by construction: nothing outside this file (or its
// real counterpart) should ever see the supplier's native field names. Every method here returns
// the shapes defined in ../contract.ts, never the supplier's raw response shape directly.

import type {
  SupplierConnector,
  RawSupplierProduct,
  RawInventoryRecord,
  RawPriceRecord,
  LiveAvailability,
  SupplierOrderRequest,
  SupplierOrderResult,
  ShipmentStatus,
  HealthCheckResult,
} from '../contract.js';
import { NotImplementedError } from '../contract.js';

export interface TemplateConnectorConfig {
  /** Base URL for the supplier's API. TODO: replace with the real one from their docs. */
  baseUrl: string;
  /**
   * The actual secret value, injected by the caller (e.g. read from an env var or secrets
   * manager at startup) — this class must never read process.env or a file itself, and this
   * value must never be logged or included in error messages.
   */
  apiKey: string;
}

export class TemplateConnector implements SupplierConnector {
  // TODO: set this to the real Supplier.code value seeded in the database
  // (e.g. 'sanmar' | 'ss_activewear' | 'joto' | 'conde').
  readonly supplierCode = 'template';

  constructor(private readonly config: TemplateConnectorConfig) {}

  async authenticate(): Promise<void> {
    // TODO: most APIs are either:
    //   (a) a static API key sent as a header on every request — nothing to do here, or
    //   (b) an OAuth-style token exchange — call it here and cache the token + expiry on `this`.
    // Throw a clear error on failure; don't silently continue with a broken connector.
    throw new NotImplementedError(this.supplierCode, 'authenticate');
  }

  async *fetchProductCatalogue(_opts?: { since?: Date }): AsyncGenerator<RawSupplierProduct> {
    // TODO:
    //  1. Call the supplier's product-list endpoint (paginate if needed — most wholesale APIs
    //     paginate; don't assume one response has everything).
    //  2. For each supplier-native product record, map it into RawSupplierProduct — this is
    //     the ONE place that should know the supplier's field names (e.g. `styleID`, `partNumber`).
    //  3. `yield` each mapped product one at a time (this is an async generator) so the sync
    //     orchestrator can stream large catalogues instead of holding everything in memory.
    //
    // Example shape of the mapping step (uncomment and adapt once you have real field names):
    //
    // const response = await fetch(`${this.config.baseUrl}/products`, {
    //   headers: { Authorization: `Bearer ${this.config.apiKey}` },
    // });
    // const data = await response.json();
    // for (const supplierProduct of data.products) {
    //   yield {
    //     supplierProductId: String(supplierProduct.id),          // TODO: real field name
    //     supplierStyleCode: supplierProduct.styleNumber,          // TODO: real field name
    //     brandName: supplierProduct.brand,                        // TODO: real field name
    //     productName: supplierProduct.name,                       // TODO: real field name
    //     description: supplierProduct.description ?? '',
    //     variants: supplierProduct.variants.map((v: unknown) => ({ /* map each variant */ })),
    //     images: supplierProduct.images.map((i: unknown) => ({ /* map each image */ })),
    //     rawPayload: supplierProduct, // keep the verbatim response for debugging/re-mapping
    //   };
    // }
    throw new NotImplementedError(this.supplierCode, 'fetchProductCatalogue');
  }

  async fetchInventory(_supplierVariantIds: string[]): Promise<RawInventoryRecord[]> {
    // TODO: most APIs support batch inventory lookup by variant/SKU id — check the docs for a
    // batch endpoint before looping one-by-one (loops will hit rate limits fast on a real
    // catalogue). Map each warehouse's stock into one RawInventoryRecord per (variant, warehouse).
    throw new NotImplementedError(this.supplierCode, 'fetchInventory');
  }

  async fetchPricing(_supplierVariantIds: string[]): Promise<RawPriceRecord[]> {
    // TODO: same batching consideration as fetchInventory. Confirm the currency the API returns
    // prices in — do not assume CAD.
    throw new NotImplementedError(this.supplierCode, 'fetchPricing');
  }

  async checkLiveAvailability(_supplierSku: string, _warehouseCode?: string): Promise<LiveAvailability> {
    // TODO: this is the ONE method called synchronously during checkout, not from a background
    // sync job — keep it fast (single SKU, no pagination) and make sure it has a short timeout
    // with a sane fallback (see architecture doc §"Checkout Inventory Protection").
    throw new NotImplementedError(this.supplierCode, 'checkLiveAvailability');
  }

  async submitOrder(_order: SupplierOrderRequest): Promise<SupplierOrderResult> {
    // Phase 8 territory — leave this throwing until purchase-order automation is actually being
    // built, well after the catalogue/pricing/inventory sync above is proven with real data.
    throw new NotImplementedError(this.supplierCode, 'submitOrder');
  }

  async getShipmentStatus(_supplierOrderId: string): Promise<ShipmentStatus> {
    throw new NotImplementedError(this.supplierCode, 'getShipmentStatus');
  }

  async healthCheck(): Promise<HealthCheckResult> {
    // TODO: a cheap, fast call that proves the API key still works — e.g. fetch account info,
    // or a single known product. Used by the admin dashboard's Supplier Overview.
    throw new NotImplementedError(this.supplierCode, 'healthCheck');
  }
}
