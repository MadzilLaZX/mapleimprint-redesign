// The contract every supplier connector implements. Nothing outside integrations/suppliers/*
// should ever read a supplier-native field name (styleID, partNumber, itemNumber, ...) directly —
// if you find yourself doing that, the abstraction has leaked and needs fixing here instead.

export interface RawSupplierImage {
  url: string;
  colourName?: string;
  imageType?: string; // 'primary' | 'front' | 'back' | 'side' | 'lifestyle' | 'swatch' | 'detail'
  sortOrder?: number;
}

export interface RawSupplierVariant {
  supplierVariantId: string;
  supplierSku: string;
  colourName: string;
  size: string;
  wholesaleCost: number;
  currency: 'CAD' | 'USD';
  mapPrice?: number;
  isOrderable: boolean;
  upc?: string;
}

export interface RawSupplierProduct {
  supplierProductId: string;
  supplierStyleCode: string;
  brandName: string;
  productName: string;
  description: string;
  productType?: string;
  variants: RawSupplierVariant[];
  images: RawSupplierImage[];
  rawPayload: Record<string, unknown>;
}

export interface RawInventoryRecord {
  supplierVariantId: string;
  warehouseCode: string;
  warehouseName?: string;
  availableQty: number;
  incomingQty?: number;
  expectedRestockDate?: string; // ISO date
}

export interface RawPriceRecord {
  supplierVariantId: string;
  wholesaleCost: number;
  currency: 'CAD' | 'USD';
  mapPrice?: number;
}

export interface LiveAvailability {
  supplierSku: string;
  warehouseCode: string | null;
  availableQty: number;
  checkedAt: string; // ISO timestamp
}

export interface SupplierOrderRequest {
  supplierSku: string;
  quantity: number;
  warehouseCode?: string;
  referenceId: string; // Maple Imprint's own order/PO reference
}

export interface SupplierOrderResult {
  supplierOrderId: string;
  status: 'accepted' | 'rejected' | 'pending';
  estimatedShipDate?: string;
}

export interface ShipmentStatus {
  supplierOrderId: string;
  status: 'processing' | 'shipped' | 'delivered' | 'cancelled';
  trackingNumber?: string;
  trackingUrl?: string;
}

export interface HealthCheckResult {
  ok: boolean;
  message?: string;
}

/**
 * One implementation per supplier under integrations/suppliers/<code>/.
 * Bulk methods (fetchProductCatalogue/fetchInventory/fetchPricing) feed the staging pipeline —
 * they must never be called in a request/response path. checkLiveAvailability is the one
 * exception: narrow, synchronous, used only at checkout for the specific SKU being purchased.
 */
export interface SupplierConnector {
  readonly supplierCode: string;

  authenticate(): Promise<void>;

  fetchProductCatalogue(opts?: { since?: Date }): AsyncIterable<RawSupplierProduct>;
  fetchInventory(supplierVariantIds: string[]): Promise<RawInventoryRecord[]>;
  fetchPricing(supplierVariantIds: string[]): Promise<RawPriceRecord[]>;

  checkLiveAvailability(supplierSku: string, warehouseCode?: string): Promise<LiveAvailability>;

  // Phase 8 territory — real connectors may throw NotImplementedError until then.
  submitOrder(order: SupplierOrderRequest): Promise<SupplierOrderResult>;
  getShipmentStatus(supplierOrderId: string): Promise<ShipmentStatus>;

  healthCheck(): Promise<HealthCheckResult>;
}

export class NotImplementedError extends Error {
  constructor(supplierCode: string, method: string) {
    super(`${supplierCode} connector does not implement ${method} yet`);
    this.name = 'NotImplementedError';
  }
}
