// Integration test that hits the REAL S&S Activewear Canada API using MapleImprint's actual
// dealer credentials. Deliberately narrow in scope: fetches a small slice of the catalogue
// (2 styles) rather than the full ~1092-style catalogue, to keep the test fast and avoid
// hammering S&S's rate limit on every test run. Self-skips when credentials aren't present.
//
// This does NOT call submitOrder/getShipmentStatus — those are untested against the live API
// on purpose (see src/integrations/suppliers/ssactivewear/README.md).

import { describe, it, expect } from 'vitest';
import { SSActivewearConnector } from '../src/integrations/suppliers/ssactivewear/SSActivewearConnector.js';
import type { RawSupplierProduct } from '../src/integrations/suppliers/contract.js';

const hasCreds = !!process.env.SSACTIVEWEAR_ACCOUNT_NUMBER && !!process.env.SSACTIVEWEAR_API_KEY;
const describeIfCreds = hasCreds ? describe : describe.skip;

describeIfCreds('SSActivewearConnector — against the real live API', () => {
  const connector = new SSActivewearConnector({
    accountNumber: process.env.SSACTIVEWEAR_ACCOUNT_NUMBER!,
    apiKey: process.env.SSACTIVEWEAR_API_KEY!,
  });

  it('authenticates and passes a health check', async () => {
    await expect(connector.authenticate()).resolves.not.toThrow();
    const health = await connector.healthCheck();
    expect(health.ok).toBe(true);
  }, 30000);

  it('streams real products with variants, warehouse-backed inventory, and CAD pricing', async () => {
    const products = await collectFew(connector, 2);

    expect(products.length).toBeGreaterThan(0);
    const first = products[0]!;

    expect(first.supplierProductId).toBeTruthy();
    expect(first.brandName).toBeTruthy();
    expect(first.variants.length).toBeGreaterThan(0);

    const variant = first.variants[0]!;
    expect(variant.supplierVariantId).toContain(':'); // composite {styleID}:{sku} form
    expect(variant.currency).toBe('CAD');
    expect(variant.wholesaleCost).toBeGreaterThan(0);
    expect(typeof variant.isOrderable).toBe('boolean');
  }, 60000);

  it('fetchInventory returns per-warehouse rows for a real variant', async () => {
    const products = await collectFew(connector, 1);
    const variant = products[0]?.variants[0];
    expect(variant).toBeTruthy();

    const inventory = await connector.fetchInventory([variant!.supplierVariantId]);
    expect(inventory.length).toBeGreaterThan(0);
    for (const row of inventory) {
      expect(row.supplierVariantId).toBe(variant!.supplierVariantId);
      expect(row.warehouseCode).toBeTruthy();
      expect(row.availableQty).toBeGreaterThanOrEqual(0);
    }
  }, 60000);

  it('fetchPricing returns a CAD wholesale cost for a real variant', async () => {
    const products = await collectFew(connector, 1);
    const variant = products[0]?.variants[0];
    expect(variant).toBeTruthy();

    const pricing = await connector.fetchPricing([variant!.supplierVariantId]);
    expect(pricing).toHaveLength(1);
    expect(pricing[0]!.currency).toBe('CAD');
    expect(pricing[0]!.wholesaleCost).toBeGreaterThan(0);
  }, 60000);

  it('checkLiveAvailability resolves a real composite variant id to a live quantity', async () => {
    const products = await collectFew(connector, 1);
    const variant = products[0]?.variants[0];
    expect(variant).toBeTruthy();

    const availability = await connector.checkLiveAvailability(variant!.supplierVariantId);
    expect(availability.availableQty).toBeGreaterThanOrEqual(0);
    expect(availability.checkedAt).toBeTruthy();
  }, 60000);

  it('checkLiveAvailability rejects a bare SKU with a clear error instead of guessing', async () => {
    await expect(connector.checkLiveAvailability('not-a-composite-id')).rejects.toThrow(
      /not a valid supplierVariantId/,
    );
  });
});

if (!hasCreds) {
  describe('ssactivewear-connector.integration.test.ts', () => {
    it.skip('skipped: SSACTIVEWEAR_ACCOUNT_NUMBER / SSACTIVEWEAR_API_KEY not set', () => {});
  });
}

async function collectFew(
  connector: SSActivewearConnector,
  styleLimit: number,
): Promise<RawSupplierProduct[]> {
  const out: RawSupplierProduct[] = [];
  for await (const product of connector.fetchProductCatalogue()) {
    out.push(product);
    if (out.length >= styleLimit) break;
  }
  return out;
}
