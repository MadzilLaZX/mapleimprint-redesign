// A generic decorator around any SupplierConnector that narrows fetchProductCatalogue() to only
// the products a predicate accepts. Everything else (fetchInventory, fetchPricing, etc.) passes
// straight through unchanged. Exists so a first real import against a huge live catalogue (S&S
// has ~1092 styles) can be scoped to something meaningful and fast (e.g. "just T-shirts") without
// teaching the generic sync pipeline (runCatalogueImport) anything supplier-specific — the filter
// predicate reads whatever fields the connector already puts on RawSupplierProduct (productType,
// brandName, etc.), nothing supplier-native leaks past this file.

import type { SupplierConnector, RawSupplierProduct } from '../contract.js';

export class FilteredCatalogueConnector implements SupplierConnector {
  readonly supplierCode: string;

  constructor(
    private readonly inner: SupplierConnector,
    private readonly predicate: (product: RawSupplierProduct) => boolean,
  ) {
    this.supplierCode = inner.supplierCode;
  }

  authenticate() {
    return this.inner.authenticate();
  }

  async *fetchProductCatalogue(opts?: { since?: Date }) {
    for await (const product of this.inner.fetchProductCatalogue(opts)) {
      if (this.predicate(product)) yield product;
    }
  }

  fetchInventory(supplierVariantIds: string[]) {
    return this.inner.fetchInventory(supplierVariantIds);
  }

  fetchPricing(supplierVariantIds: string[]) {
    return this.inner.fetchPricing(supplierVariantIds);
  }

  checkLiveAvailability(supplierSku: string, warehouseCode?: string) {
    return this.inner.checkLiveAvailability(supplierSku, warehouseCode);
  }

  submitOrder(order: Parameters<SupplierConnector['submitOrder']>[0]) {
    return this.inner.submitOrder(order);
  }

  getShipmentStatus(supplierOrderId: string) {
    return this.inner.getShipmentStatus(supplierOrderId);
  }

  healthCheck() {
    return this.inner.healthCheck();
  }
}
