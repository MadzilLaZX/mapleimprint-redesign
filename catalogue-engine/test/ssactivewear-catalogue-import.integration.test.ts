// The real proof-of-concept: runs runCatalogueImport against the REAL S&S Activewear Canada API
// AND the real database, end to end. Deliberately scoped to `limit: 2` styles — this is meant to
// prove the pipeline works with real data landing in real tables, not to run a full production
// import (that's ~1092 styles and belongs in a deliberate, monitored run, not a test suite).
// Self-skips when either DATABASE_URL or the S&S credentials are missing. Cleans up everything
// it creates, including a dedicated test-only Supplier row so it never touches the real seeded
// 'ss_activewear' supplier record.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SSActivewearConnector } from '../src/integrations/suppliers/ssactivewear/SSActivewearConnector.js';
import { runCatalogueImport } from '../src/sync/catalogue-import.js';

const hasDb = !!process.env.DATABASE_URL;
const hasCreds = !!process.env.SSACTIVEWEAR_ACCOUNT_NUMBER && !!process.env.SSACTIVEWEAR_API_KEY;
const canRun = hasDb && hasCreds;
const describeIfReady = canRun ? describe : describe.skip;

describeIfReady('runCatalogueImport — against the REAL S&S API and a real database', () => {
  let prisma: import('@prisma/client').PrismaClient;
  let supplierId: string;

  beforeAll(async () => {
    const { PrismaClient } = await import('@prisma/client');
    prisma = new PrismaClient();

    const supplier = await prisma.supplier.upsert({
      where: { code: 'integration_test_ssactivewear_import' },
      update: {},
      create: {
        name: 'IT S&S Catalogue Import Test',
        code: 'integration_test_ssactivewear_import',
        integrationType: 'api',
      },
    });
    supplierId = supplier.id;
  });

  afterAll(async () => {
    if (supplierId) {
      const products = await prisma.supplierProduct.findMany({ where: { supplierId }, select: { id: true } });
      const productIds = products.map((p) => p.id).filter(Boolean);
      if (productIds.length > 0) {
        await prisma.matchCandidate.deleteMany({ where: { supplierProductId: { in: productIds } } });
        const offers = await prisma.supplierVariantOffer.findMany({
          where: { supplierProductId: { in: productIds } },
          select: { id: true },
        });
        const offerIds = offers.map((o) => o.id).filter(Boolean);
        if (offerIds.length > 0) {
          await prisma.supplierWarehouseInventory.deleteMany({
            where: { supplierVariantOfferId: { in: offerIds } },
          });
          await prisma.supplierVariantOffer.deleteMany({ where: { id: { in: offerIds } } });
        }
        await prisma.supplierProduct.deleteMany({ where: { id: { in: productIds } } });
      }
      await prisma.supplierSyncJob.deleteMany({ where: { supplierId } });
      await prisma.supplier.deleteMany({ where: { id: supplierId } });
    }
    await prisma.$disconnect();
  });

  it('imports 2 real styles from the live S&S catalogue into real database rows', async () => {
    const connector = new SSActivewearConnector({
      accountNumber: process.env.SSACTIVEWEAR_ACCOUNT_NUMBER!,
      apiKey: process.env.SSACTIVEWEAR_API_KEY!,
    });

    const result = await runCatalogueImport({ prisma, connector, supplierId, limit: 2 });

    expect(['completed', 'completed_with_warnings']).toContain(result.status);
    expect(result.supplierProductsProcessed).toBe(2);
    expect(result.supplierProductsCreated).toBe(2);
    expect(result.variantOffersUpserted).toBeGreaterThan(0);
    expect(result.warehouseInventoryRowsUpserted).toBeGreaterThan(0);

    const rows = await prisma.supplierProduct.findMany({
      where: { supplierId },
      include: { variantOffers: { include: { warehouseInventory: true } } },
    });
    expect(rows).toHaveLength(2);

    for (const product of rows) {
      expect(product.supplierBrandName).toBeTruthy();
      expect(product.variantOffers.length).toBeGreaterThan(0);
      const offer = product.variantOffers[0]!;
      expect(Number(offer.wholesaleCost)).toBeGreaterThan(0);
      expect(offer.currency).toBe('CAD');
      // Real warehouse inventory, not a placeholder — this is the actual point of this test.
      expect(offer.warehouseInventory.length).toBeGreaterThan(0);
      expect(offer.warehouseInventory[0]!.availableQty).toBeGreaterThanOrEqual(0);
    }

    const job = await prisma.supplierSyncJob.findUnique({ where: { id: result.jobId! } });
    expect(job?.syncType).toBe('full_catalogue');
    expect(['completed', 'completed_with_warnings']).toContain(job?.status);
  }, 120000);
});

if (!canRun) {
  describe('ssactivewear-catalogue-import.integration.test.ts', () => {
    it.skip('skipped: needs DATABASE_URL + SSACTIVEWEAR_ACCOUNT_NUMBER/SSACTIVEWEAR_API_KEY', () => {});
  });
}
