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

export interface MockCatalogueFixture {
  products: RawSupplierProduct[];
  /** Simulates transient failures/edge cases without touching a real API. */
  behavior?: {
    failAuthentication?: boolean;
    inventoryForVariant?: (supplierVariantId: string) => RawInventoryRecord[];
  };
}

/**
 * A fully in-memory connector so the sync/staging/dedup/pricing pipeline can be built and
 * tested before any real supplier account exists. Swap for a real connector by implementing
 * the same SupplierConnector interface — nothing else in the codebase changes.
 */
export class MockConnector implements SupplierConnector {
  readonly supplierCode = 'mock';

  private authenticated = false;

  constructor(private readonly fixture: MockCatalogueFixture) {}

  async authenticate(): Promise<void> {
    if (this.fixture.behavior?.failAuthentication) {
      throw new Error('mock: authentication failed (simulated)');
    }
    this.authenticated = true;
  }

  async *fetchProductCatalogue(): AsyncGenerator<RawSupplierProduct> {
    this.requireAuth();
    for (const product of this.fixture.products) {
      yield product;
    }
  }

  async fetchInventory(supplierVariantIds: string[]): Promise<RawInventoryRecord[]> {
    this.requireAuth();
    const records: RawInventoryRecord[] = [];
    for (const id of supplierVariantIds) {
      const custom = this.fixture.behavior?.inventoryForVariant?.(id);
      if (custom) {
        records.push(...custom);
        continue;
      }
      records.push({
        supplierVariantId: id,
        warehouseCode: 'MAIN',
        availableQty: 50,
        incomingQty: 0,
      });
    }
    return records;
  }

  async fetchPricing(supplierVariantIds: string[]): Promise<RawPriceRecord[]> {
    this.requireAuth();
    const priced: RawPriceRecord[] = [];
    for (const product of this.fixture.products) {
      for (const variant of product.variants) {
        if (supplierVariantIds.includes(variant.supplierVariantId)) {
          priced.push({
            supplierVariantId: variant.supplierVariantId,
            wholesaleCost: variant.wholesaleCost,
            currency: variant.currency,
            mapPrice: variant.mapPrice,
          });
        }
      }
    }
    return priced;
  }

  async checkLiveAvailability(supplierSku: string, warehouseCode?: string): Promise<LiveAvailability> {
    this.requireAuth();
    return {
      supplierSku,
      warehouseCode: warehouseCode ?? null,
      availableQty: 50,
      checkedAt: new Date().toISOString(),
    };
  }

  async submitOrder(_order: SupplierOrderRequest): Promise<SupplierOrderResult> {
    throw new NotImplementedError(this.supplierCode, 'submitOrder');
  }

  async getShipmentStatus(_supplierOrderId: string): Promise<ShipmentStatus> {
    throw new NotImplementedError(this.supplierCode, 'getShipmentStatus');
  }

  async healthCheck(): Promise<HealthCheckResult> {
    return { ok: this.authenticated };
  }

  private requireAuth(): void {
    if (!this.authenticated) {
      throw new Error('mock: call authenticate() first');
    }
  }
}
