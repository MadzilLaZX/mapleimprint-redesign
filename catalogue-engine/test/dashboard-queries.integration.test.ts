// Integration test for the admin dashboard read layer, against a real database.
// Self-skips when DATABASE_URL isn't set, same pattern as the other *.integration.test.ts files.
//
// Assertions use "does our fixture's id/row appear in the result" rather than exact counts,
// since other integration test files may run concurrently against the same database — asserting
// exact totals would be flaky by construction, not a real bug.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  getSupplierOverview,
  getCatalogueReviewCounts,
  getSyncActivity,
  getPricingRisks,
  getInventoryRisks,
} from '../src/admin/dashboard-queries.js';

const hasDb = !!process.env.DATABASE_URL;
const describeIfDb = hasDb ? describe : describe.skip;

describeIfDb('admin dashboard queries — against a real database', () => {
  let prisma: import('@prisma/client').PrismaClient;
  let brandId: string;
  let categoryId: string;
  let masterProductId: string;
  let variantId: string;
  let supplierId: string;
  let supplierProductId: string;
  let zeroCostOfferId: string;
  let outOfStockInvId: string;
  let staleInvId: string;
  let runningJobId: string;
  let failedJobId: string;
  let completedJobId: string;
  let expiredRuleId: string;

  beforeAll(async () => {
    const { PrismaClient } = await import('@prisma/client');
    prisma = new PrismaClient();

    const brand = await prisma.brand.create({
      data: { name: 'IT Dashboard Brand', slug: `it-dash-brand-${Date.now()}`, isActive: true },
    });
    brandId = brand.id;

    const category = await prisma.category.create({
      data: { name: 'IT Dashboard Category', slug: `it-dash-category-${Date.now()}` },
    });
    categoryId = category.id;

    const masterProduct = await prisma.masterProduct.create({
      data: {
        brandId,
        primaryCategoryId: categoryId,
        slug: `it-dash-master-${Date.now()}`,
        name: 'Dashboard Test Product',
        productType: 't_shirt',
        status: 'imported',
      },
    });
    masterProductId = masterProduct.id;

    const variant = await prisma.productVariant.create({
      data: {
        masterProductId,
        internalSku: `IT-DASH-SKU-${Date.now()}`,
        colourName: 'Blue',
        normalizedColour: 'blue',
        size: 'L',
      },
    });
    variantId = variant.id;

    const supplier = await prisma.supplier.upsert({
      where: { code: 'integration_test_dashboard_supplier' },
      update: {},
      create: { name: 'IT Dashboard Supplier', code: 'integration_test_dashboard_supplier' },
    });
    supplierId = supplier.id;

    const supplierProduct = await prisma.supplierProduct.create({
      data: {
        supplierId,
        supplierStyleCode: 'DASH-STYLE-1',
        supplierBrandName: 'IT Dashboard Brand',
        supplierProductName: 'Dashboard Test Product',
        rawPayload: { note: 'dashboard integration test fixture' },
        lastSyncedAt: new Date(),
        matchStatus: 'unmatched',
      },
    });
    supplierProductId = supplierProduct.id;

    // Zero-cost offer — always a data problem, this is the pricing-risk case.
    const zeroCostOffer = await prisma.supplierVariantOffer.create({
      data: {
        supplierProductId,
        productVariantId: variantId,
        supplierVariantId: 'it-dash-variant-1',
        supplierSku: 'IT-DASH-SKU-VARIANT-1',
        colourName: 'Black',
        size: 'M',
        wholesaleCost: 0,
        lastPriceSyncAt: new Date(),
        lastInventorySyncAt: new Date(),
      },
    });
    zeroCostOfferId = zeroCostOffer.id;

    const outOfStockInv = await prisma.supplierWarehouseInventory.create({
      data: {
        supplierVariantOfferId: zeroCostOfferId,
        warehouseCode: 'DASH-MAIN',
        availableQty: 0,
        lastSyncedAt: new Date(),
      },
    });
    outOfStockInvId = outOfStockInv.id;

    const staleInv = await prisma.supplierWarehouseInventory.create({
      data: {
        supplierVariantOfferId: zeroCostOfferId,
        warehouseCode: 'DASH-SECONDARY',
        availableQty: 25,
        lastSyncedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours old
      },
    });
    staleInvId = staleInv.id;

    const runningJob = await prisma.supplierSyncJob.create({
      data: { supplierId, syncType: 'price_delta', status: 'running' },
    });
    runningJobId = runningJob.id;

    const failedJob = await prisma.supplierSyncJob.create({
      data: {
        supplierId,
        syncType: 'inventory',
        status: 'failed',
        errorSummary: 'dashboard integration test simulated failure',
        finishedAt: new Date(),
      },
    });
    failedJobId = failedJob.id;

    const completedJob = await prisma.supplierSyncJob.create({
      data: {
        supplierId,
        syncType: 'price_delta',
        status: 'completed',
        recordsUpdated: 7,
        finishedAt: new Date(),
      },
    });
    completedJobId = completedJob.id;

    const expiredRule = await prisma.pricingRule.create({
      data: {
        name: 'IT Dashboard Expired Rule',
        productType: 't_shirt',
        printMethod: 'screen_print',
        quantityMinimum: 1,
        quantityMaximum: 10,
        basePrintCost: 20,
        isActive: true,
        effectiveUntil: new Date(Date.now() - 24 * 60 * 60 * 1000), // expired yesterday
      },
    });
    expiredRuleId = expiredRule.id;
  });

  afterAll(async () => {
    // INCIDENT, 2026-08-02: an earlier version of this exact afterAll ran with expiredRuleId
    // still undefined (beforeAll had hit vitest's default 10s hook timeout partway through, on
    // WAN latency to a pooled Supabase connection, before reaching the pricingRule.create call).
    // `prisma.pricingRule.deleteMany({ where: { id: undefined } })` does NOT mean "delete
    // nothing" — Prisma strips undefined keys from `where`, so it means "no filter," and it
    // deleted all 18 real seeded PricingRule rows. They were restored, and every deleteMany
    // below is now guarded. Do not remove these guards, and do not add a new deleteMany call to
    // this file (or any other *.integration.test.ts) without the same guard.
    const jobIds = [runningJobId, failedJobId, completedJobId].filter(Boolean);
    const invIds = [outOfStockInvId, staleInvId].filter(Boolean);

    if (expiredRuleId) await prisma.pricingRule.deleteMany({ where: { id: expiredRuleId } });
    if (jobIds.length > 0) await prisma.supplierSyncJob.deleteMany({ where: { id: { in: jobIds } } });
    if (invIds.length > 0) {
      await prisma.supplierWarehouseInventory.deleteMany({ where: { id: { in: invIds } } });
    }
    if (zeroCostOfferId) await prisma.supplierVariantOffer.deleteMany({ where: { id: zeroCostOfferId } });
    if (supplierProductId) await prisma.supplierProduct.deleteMany({ where: { id: supplierProductId } });
    if (supplierId) await prisma.supplier.deleteMany({ where: { id: supplierId } });
    if (variantId) await prisma.productVariant.deleteMany({ where: { id: variantId } });
    if (masterProductId) await prisma.masterProduct.deleteMany({ where: { id: masterProductId } });
    if (categoryId) await prisma.category.deleteMany({ where: { id: categoryId } });
    if (brandId) await prisma.brand.deleteMany({ where: { id: brandId } });
    await prisma.$disconnect();
  });

  it('getSupplierOverview reports the fixture supplier with correct counts and credential status', async () => {
    const rows = await getSupplierOverview(prisma);
    const row = rows.find((r) => r.id === supplierId);

    expect(row).toBeDefined();
    expect(row!.credentialStatus).toBe('missing'); // no credentialsRef set on this fixture
    expect(row!.importedProductCount).toBeGreaterThanOrEqual(1);
    expect(row!.recentFailedSyncCount).toBeGreaterThanOrEqual(1);
  });

  it('getCatalogueReviewCounts includes the fixture master product and unmatched supplier product', async () => {
    const result = await getCatalogueReviewCounts(prisma);
    expect(result.byStatus.imported).toBeGreaterThanOrEqual(1);
    expect(result.unmatchedSupplierProducts).toBeGreaterThanOrEqual(1);
  });

  it('getSyncActivity surfaces the running, failed, and completed fixture jobs', async () => {
    const activity = await getSyncActivity(prisma);

    expect(activity.runningJobs.some((j) => j.id === runningJobId)).toBe(true);
    const failedRow = activity.recentFailedJobs.find((j) => j.id === failedJobId);
    expect(failedRow).toBeDefined();
    expect(failedRow!.errorSummary).toBe('dashboard integration test simulated failure');

    const completedRow = activity.recentCompletedJobs.find((j) => j.id === completedJobId);
    expect(completedRow).toBeDefined();
    expect(completedRow!.recordsUpdated).toBe(7);
  });

  it('getPricingRisks flags the zero-cost offer and the expired-but-active rule', async () => {
    const risks = await getPricingRisks(prisma);
    expect(risks.zeroCostOffers.some((o) => o.id === zeroCostOfferId)).toBe(true);
    expect(risks.expiredButActiveRules.some((r) => r.id === expiredRuleId)).toBe(true);
  });

  it('getInventoryRisks flags out-of-stock and stale inventory rows separately', async () => {
    const risks = await getInventoryRisks(prisma, 60); // stale threshold: 60 minutes
    expect(risks.outOfStock.some((r) => r.id === outOfStockInvId)).toBe(true);
    expect(risks.staleInventory.some((r) => r.id === staleInvId)).toBe(true);
    // The out-of-stock row is 0 qty, so it must never show up as "stale" (that label implies
    // non-zero cached stock we don't trust — a different risk from genuinely zero stock).
    expect(risks.staleInventory.some((r) => r.id === outOfStockInvId)).toBe(false);
  });
});

if (!hasDb) {
  describe('dashboard-queries.integration.test.ts', () => {
    it.skip('skipped: DATABASE_URL not set — see README "Live staging database"', () => {});
  });
}
