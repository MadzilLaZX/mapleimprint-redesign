// Integration test for the sync orchestrator + dedup review queue against a REAL database.
// Skips itself automatically when DATABASE_URL isn't set, so `npm test` stays green without a
// live database (see test/pricing-*.test.ts etc. for the pure, always-run unit tests).
//
// To run this for real: fill in DATABASE_URL in catalogue-engine/.env (see README's "Live
// staging database" section for where to get the Supabase project's password), then:
//   npx prisma db push   (or apply migration_init.sql again if pointed at a fresh database)
//   npm test
//
// Deliberately targets the maple-imprint-catalogue Supabase project's schema/shape, but is
// written to work against any Postgres instance the schema has been applied to — nothing here
// is Supabase-specific.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MockConnector } from '../src/integrations/suppliers/mock/MockConnector.js';
import { runPriceSync } from '../src/sync/orchestrator.js';
import { matchProduct } from '../src/sync/dedup/matcher.js';
import { recordMatchResult } from '../src/sync/dedup/review-queue.js';

const hasDb = !!process.env.DATABASE_URL;
const describeIfDb = hasDb ? describe : describe.skip;

describeIfDb('runPriceSync + dedup — against a real database', () => {
  // Imported lazily so this file doesn't fail to load (via @prisma/client requiring a generated
  // client) in environments that only ever run the unit suite.
  let prisma: import('@prisma/client').PrismaClient;
  let supplierId: string;
  let masterProductId: string;
  let variantId: string;
  let supplierProductId: string;
  let offerId: string;
  let brandId: string;
  let categoryId: string;

  beforeAll(async () => {
    const { PrismaClient } = await import('@prisma/client');
    prisma = new PrismaClient();

    const brand = await prisma.brand.create({
      data: { name: 'IT Test Brand', slug: `it-test-brand-${Date.now()}`, isActive: true },
    });
    brandId = brand.id;
    const category = await prisma.category.create({
      data: { name: 'IT Test Category', slug: `it-test-category-${Date.now()}` },
    });
    categoryId = category.id;
    const masterProduct = await prisma.masterProduct.create({
      data: {
        brandId: brand.id,
        primaryCategoryId: category.id,
        slug: `it-test-product-${Date.now()}`,
        name: 'Integration Test Tee',
        productType: 't_shirt',
        status: 'imported',
      },
    });
    masterProductId = masterProduct.id;

    const variant = await prisma.productVariant.create({
      data: {
        masterProductId,
        internalSku: `IT-SKU-${Date.now()}`,
        colourName: 'Black',
        normalizedColour: 'black',
        size: 'M',
      },
    });
    variantId = variant.id;

    // Use a distinct supplier code so this never collides with the seeded real suppliers.
    const supplier = await prisma.supplier.upsert({
      where: { code: 'integration_test_supplier' },
      update: {},
      create: { name: 'Integration Test Supplier', code: 'integration_test_supplier' },
    });
    supplierId = supplier.id;

    const supplierProduct = await prisma.supplierProduct.create({
      data: {
        supplierId,
        masterProductId,
        supplierStyleCode: 'IT-STYLE-1',
        supplierBrandName: 'IT Test Brand',
        supplierProductName: 'Integration Test Tee',
        rawPayload: { note: 'integration test fixture' },
        lastSyncedAt: new Date(),
      },
    });
    supplierProductId = supplierProduct.id;

    const offer = await prisma.supplierVariantOffer.create({
      data: {
        supplierProductId,
        productVariantId: variantId,
        supplierVariantId: 'it-variant-1',
        supplierSku: 'IT-SKU-VARIANT-1',
        colourName: 'Black',
        size: 'M',
        wholesaleCost: 5.0,
        lastPriceSyncAt: new Date(),
        lastInventorySyncAt: new Date(),
      },
    });
    offerId = offer.id;
  });

  afterAll(async () => {
    // GUARD, don't just delete: if beforeAll threw partway through (timeout, network blip),
    // some *Id variables below are still `undefined`. Prisma treats `where: { id: undefined }`
    // as "no filter on this field" — deleteMany would then delete EVERY row in the table. This
    // happened for real once (wiped the 18 seeded PricingRule rows via a similar pattern in
    // dashboard-queries.integration.test.ts) — never remove these guards.
    // Reverse-dependency-order cleanup, same pattern as the schema's FK constraints require.
    if (supplierProductId) await prisma.matchCandidate.deleteMany({ where: { supplierProductId } });
    if (supplierId) await prisma.supplierSyncJob.deleteMany({ where: { supplierId } });
    if (offerId) await prisma.supplierVariantOffer.deleteMany({ where: { id: offerId } });
    if (supplierProductId) await prisma.supplierProduct.deleteMany({ where: { id: supplierProductId } });
    if (variantId) await prisma.productVariant.deleteMany({ where: { id: variantId } });
    if (masterProductId) await prisma.masterProduct.deleteMany({ where: { id: masterProductId } });
    if (supplierId) await prisma.supplier.deleteMany({ where: { id: supplierId } });
    if (categoryId) await prisma.category.deleteMany({ where: { id: categoryId } });
    if (brandId) await prisma.brand.deleteMany({ where: { id: brandId } });
    await prisma.$disconnect();
  });

  it('runs a price sync via the mock connector and updates the real offer row', async () => {
    const connector = new MockConnector({
      products: [
        {
          supplierProductId: 'it-style-1',
          supplierStyleCode: 'IT-STYLE-1',
          brandName: 'IT Test Brand',
          productName: 'Integration Test Tee',
          description: '',
          variants: [
            {
              supplierVariantId: 'it-variant-1',
              supplierSku: 'IT-SKU-VARIANT-1',
              colourName: 'Black',
              size: 'M',
              wholesaleCost: 6.25, // changed from the seeded 5.00
              currency: 'CAD',
              isOrderable: true,
            },
          ],
          images: [],
          rawPayload: {},
        },
      ],
    });
    await connector.authenticate();

    const result = await runPriceSync({ prisma, connector, supplierId });

    expect(result.status).toBe('completed');
    expect(result.jobId).not.toBeNull();
    expect(result.changeSummary.updatedCount).toBe(1);

    const updatedOffer = await prisma.supplierVariantOffer.findUniqueOrThrow({
      where: { id: offerId },
    });
    expect(Number(updatedOffer.wholesaleCost)).toBe(6.25);

    const job = await prisma.supplierSyncJob.findUnique({ where: { id: result.jobId! } });
    expect(job?.status).toBe('completed');
  });

  it('records an auto-approved match candidate and links the supplier product', async () => {
    const match = matchProduct(
      {
        brandName: 'IT Test Brand',
        styleCode: 'IT-STYLE-1',
        productName: 'Integration Test Tee',
        colours: ['Black'],
        sizes: ['M'],
      },
      [
        {
          id: masterProductId,
          brandName: 'IT Test Brand',
          styleCode: 'IT-STYLE-1',
          name: 'Integration Test Tee',
          colours: ['Black'],
          sizes: ['M'],
        },
      ],
    );
    expect(match).not.toBeNull();
    expect(match!.status).toBe('auto_approved');

    await recordMatchResult(prisma, supplierProductId, match!);

    const updated = await prisma.supplierProduct.findUniqueOrThrow({
      where: { id: supplierProductId },
    });
    expect(updated.matchStatus).toBe('auto_matched');
    expect(updated.masterProductId).toBe(masterProductId);
  });
});

if (!hasDb) {
  describe('orchestrator.integration.test.ts', () => {
    it.skip('skipped: DATABASE_URL not set — see README "Live staging database"', () => {});
  });
}
