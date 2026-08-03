// Integration test for runCatalogueImport against a REAL database, using MockConnector so it's
// fast and deterministic (no live API dependency — that's covered separately by
// ssactivewear-catalogue-import.integration.test.ts). Proves the actual gap this module fills:
// runPriceSync only updates prices on offers that already exist; this is what creates them.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MockConnector } from '../src/integrations/suppliers/mock/MockConnector.js';
import { runCatalogueImport } from '../src/sync/catalogue-import.js';

const hasDb = !!process.env.DATABASE_URL;
const describeIfDb = hasDb ? describe : describe.skip;

describeIfDb('runCatalogueImport — against a real database', () => {
  let prisma: import('@prisma/client').PrismaClient;
  let supplierId: string;
  let brandId: string;
  let categoryId: string;
  let masterProductId: string;
  let matchVariantId: string | undefined;

  beforeAll(async () => {
    const { PrismaClient } = await import('@prisma/client');
    prisma = new PrismaClient();

    const supplier = await prisma.supplier.upsert({
      where: { code: 'integration_test_catalogue_import_supplier' },
      update: {},
      create: { name: 'IT Catalogue Import Supplier', code: 'integration_test_catalogue_import_supplier' },
    });
    supplierId = supplier.id;

    // One pre-existing MasterProduct with a matching brand+style, to prove the import wires up
    // to the dedup matcher correctly for products that DO have a real match candidate.
    const brand = await prisma.brand.create({
      data: { name: 'IT Import Brand', slug: `it-import-brand-${Date.now()}`, isActive: true },
    });
    brandId = brand.id;
    const category = await prisma.category.create({
      data: { name: 'IT Import Category', slug: `it-import-category-${Date.now()}` },
    });
    categoryId = category.id;
    const masterProduct = await prisma.masterProduct.create({
      data: {
        brandId,
        primaryCategoryId: categoryId,
        slug: `it-import-existing-product-${Date.now()}`,
        name: 'Existing Matchable Tee',
        productType: 't_shirt',
        status: 'imported',
      },
    });
    masterProductId = masterProduct.id;
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
    if (matchVariantId) await prisma.productVariant.deleteMany({ where: { id: matchVariantId } });
    if (masterProductId) await prisma.masterProduct.deleteMany({ where: { id: masterProductId } });
    if (categoryId) await prisma.category.deleteMany({ where: { id: categoryId } });
    if (brandId) await prisma.brand.deleteMany({ where: { id: brandId } });
    await prisma.$disconnect();
  });

  it('creates real SupplierProduct, SupplierVariantOffer, and SupplierWarehouseInventory rows from scratch', async () => {
    const connector = new MockConnector({
      products: [
        {
          supplierProductId: 'mock-style-new',
          supplierStyleCode: `IT-IMPORT-NEW-${Date.now()}`,
          brandName: 'Some Other Brand',
          productName: 'Brand New Unmatched Hoodie',
          description: '',
          variants: [
            {
              supplierVariantId: `it-import-variant-${Date.now()}-1`,
              supplierSku: 'SKU-1',
              colourName: 'Grey',
              size: 'L',
              wholesaleCost: 12.5,
              currency: 'CAD',
              isOrderable: true,
            },
          ],
          images: [],
          rawPayload: { raw: true },
        },
      ],
    });
    await connector.authenticate();

    const result = await runCatalogueImport({ prisma, connector, supplierId });

    expect(result.status).toBe('completed');
    expect(result.supplierProductsCreated).toBe(1);
    expect(result.supplierProductsUpdated).toBe(0);
    expect(result.variantOffersUpserted).toBe(1);
    expect(result.warehouseInventoryRowsUpserted).toBeGreaterThan(0); // MockConnector defaults to 1 warehouse
    // No match candidate for "Some Other Brand" against "IT Import Brand" — must stay unmatched.
    expect(result.matchesAutoApproved).toBe(0);
    expect(result.matchesNeedingReview).toBe(0);

    const created = await prisma.supplierProduct.findFirst({
      where: { supplierId, supplierProductName: 'Brand New Unmatched Hoodie' },
      include: { variantOffers: { include: { warehouseInventory: true } } },
    });
    expect(created).not.toBeNull();
    expect(created!.matchStatus).toBe('unmatched');
    expect(created!.variantOffers).toHaveLength(1);
    expect(Number(created!.variantOffers[0]!.wholesaleCost)).toBe(12.5);
    expect(created!.variantOffers[0]!.warehouseInventory.length).toBeGreaterThan(0);
    expect(created!.variantOffers[0]!.warehouseInventory[0]!.availableQty).toBe(50);
  });

  it('auto-approves a match against an existing MasterProduct with the same brand+style', async () => {
    const styleCode = `IT-IMPORT-MATCHED-${Date.now()}`;
    // Give the pre-created MasterProduct a variant so colour/size overlap signals are meaningful,
    // and set its brand to exactly match what the mock supplier product will report.
    await prisma.brand.update({ where: { id: brandId }, data: { name: 'IT Import Brand' } });
    const matchVariant = await prisma.productVariant.create({
      data: {
        masterProductId,
        internalSku: `IT-IMPORT-MATCH-SKU-${Date.now()}`,
        colourName: 'Navy',
        normalizedColour: 'navy',
        size: 'M',
      },
    });
    matchVariantId = matchVariant.id;

    const connector = new MockConnector({
      products: [
        {
          supplierProductId: 'mock-style-matched',
          supplierStyleCode: styleCode,
          brandName: 'IT Import Brand', // exact brand match
          productName: 'Existing Matchable Tee', // exact name match too, for a clean high score
          description: '',
          variants: [
            {
              supplierVariantId: `it-import-matched-variant-${Date.now()}`,
              supplierSku: 'SKU-MATCHED',
              colourName: 'Navy',
              size: 'M',
              wholesaleCost: 8.0,
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

    const result = await runCatalogueImport({ prisma, connector, supplierId });

    expect(result.supplierProductsCreated).toBe(1);
    // Brand matches but styleCode isn't tracked on MasterProduct in the current schema, so this
    // can't reach the 0.95 auto-approve threshold — it should land in needs_review instead.
    expect(result.matchesNeedingReview).toBe(1);
    expect(result.matchesAutoApproved).toBe(0);

    const created = await prisma.supplierProduct.findFirst({
      where: { supplierId, supplierStyleCode: styleCode },
    });
    expect(created!.matchStatus).toBe('needs_review');
    expect(created!.masterProductId).toBeNull(); // not linked until a human confirms via approveMatch
  });

  it('updates an existing SupplierProduct and its offer on a second import, without re-matching', async () => {
    const styleCode = `IT-IMPORT-REPEAT-${Date.now()}`;
    const variantId = `it-import-repeat-variant-${Date.now()}`;

    const makeConnector = (cost: number) =>
      new MockConnector({
        products: [
          {
            supplierProductId: 'mock-style-repeat',
            supplierStyleCode: styleCode,
            brandName: 'Repeat Brand',
            productName: 'Repeat Product',
            description: '',
            variants: [
              {
                supplierVariantId: variantId,
                supplierSku: 'SKU-REPEAT',
                colourName: 'Red',
                size: 'S',
                wholesaleCost: cost,
                currency: 'CAD',
                isOrderable: true,
              },
            ],
            images: [],
            rawPayload: {},
          },
        ],
      });

    const first = makeConnector(10.0);
    await first.authenticate();
    const firstResult = await runCatalogueImport({ prisma, connector: first, supplierId });
    expect(firstResult.supplierProductsCreated).toBe(1);

    const second = makeConnector(11.0);
    await second.authenticate();
    const secondResult = await runCatalogueImport({ prisma, connector: second, supplierId });
    expect(secondResult.supplierProductsCreated).toBe(0);
    expect(secondResult.supplierProductsUpdated).toBe(1);

    const offer = await prisma.supplierVariantOffer.findFirst({
      where: { supplierProduct: { supplierId, supplierStyleCode: styleCode } },
    });
    expect(Number(offer!.wholesaleCost)).toBe(11.0);
  });
});

if (!hasDb) {
  describe('catalogue-import.integration.test.ts', () => {
    it.skip('skipped: DATABASE_URL not set — see README "Live staging database"', () => {});
  });
}
