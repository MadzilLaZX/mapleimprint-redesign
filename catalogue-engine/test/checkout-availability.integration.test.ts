// Integration test for size-curve-aware availability checking, against a real database.
// The core scenario this proves: naively summing total available stock across an order would
// say a bulk order is fulfillable even when one specific size is short — this test builds
// exactly that trap (plenty of S/M, almost no L) and confirms checkOrderAvailability catches it
// per-line instead. Self-skips when DATABASE_URL isn't set.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { checkOrderAvailability } from '../src/checkout/availability.js';

const hasDb = !!process.env.DATABASE_URL;
const describeIfDb = hasDb ? describe : describe.skip;

describeIfDb('checkOrderAvailability — against a real database', () => {
  let prisma: import('@prisma/client').PrismaClient;
  let brandId: string;
  let categoryId: string;
  let masterProductId: string;
  let supplierId: string;
  let supplierProductId: string;
  let variantSmallId: string;
  let variantMediumId: string;
  let variantLargeId: string;
  let variantNoOfferId: string;
  let offerSmallId: string;
  let offerMediumId: string;
  let offerLargeId: string;

  beforeAll(async () => {
    const { PrismaClient } = await import('@prisma/client');
    prisma = new PrismaClient();

    const brand = await prisma.brand.create({
      data: { name: 'IT Avail Brand', slug: `it-avail-brand-${Date.now()}`, isActive: true },
    });
    brandId = brand.id;

    const category = await prisma.category.create({
      data: { name: 'IT Avail Category', slug: `it-avail-category-${Date.now()}` },
    });
    categoryId = category.id;

    const masterProduct = await prisma.masterProduct.create({
      data: {
        brandId,
        primaryCategoryId: categoryId,
        slug: `it-avail-master-${Date.now()}`,
        name: 'Availability Test Tee',
        productType: 't_shirt',
        status: 'imported',
      },
    });
    masterProductId = masterProduct.id;

    const supplier = await prisma.supplier.upsert({
      where: { code: 'integration_test_avail_supplier' },
      update: {},
      create: { name: 'IT Avail Supplier', code: 'integration_test_avail_supplier' },
    });
    supplierId = supplier.id;

    const supplierProduct = await prisma.supplierProduct.create({
      data: {
        supplierId,
        supplierStyleCode: 'AVAIL-STYLE-1',
        supplierBrandName: 'IT Avail Brand',
        supplierProductName: 'Availability Test Tee',
        rawPayload: {},
        lastSyncedAt: new Date(),
      },
    });
    supplierProductId = supplierProduct.id;

    const [small, medium, large, noOffer] = await Promise.all([
      prisma.productVariant.create({
        data: { masterProductId, internalSku: `IT-AVAIL-S-${Date.now()}`, colourName: 'Black', normalizedColour: 'black', size: 'S' },
      }),
      prisma.productVariant.create({
        data: { masterProductId, internalSku: `IT-AVAIL-M-${Date.now()}`, colourName: 'Black', normalizedColour: 'black', size: 'M' },
      }),
      prisma.productVariant.create({
        data: { masterProductId, internalSku: `IT-AVAIL-L-${Date.now()}`, colourName: 'Black', normalizedColour: 'black', size: 'L' },
      }),
      prisma.productVariant.create({
        data: { masterProductId, internalSku: `IT-AVAIL-XL-${Date.now()}`, colourName: 'Black', normalizedColour: 'black', size: 'XL' },
      }),
    ]);
    variantSmallId = small.id;
    variantMediumId = medium.id;
    variantLargeId = large.id;
    variantNoOfferId = noOffer.id; // deliberately never gets a SupplierVariantOffer

    const [offerSmall, offerMedium, offerLarge] = await Promise.all([
      prisma.supplierVariantOffer.create({
        data: {
          supplierProductId,
          productVariantId: variantSmallId,
          supplierVariantId: 'avail-variant-s',
          supplierSku: 'AVAIL-S',
          colourName: 'Black',
          size: 'S',
          wholesaleCost: 5,
          isOrderable: true,
          lastPriceSyncAt: new Date(),
          lastInventorySyncAt: new Date(),
        },
      }),
      prisma.supplierVariantOffer.create({
        data: {
          supplierProductId,
          productVariantId: variantMediumId,
          supplierVariantId: 'avail-variant-m',
          supplierSku: 'AVAIL-M',
          colourName: 'Black',
          size: 'M',
          wholesaleCost: 5,
          isOrderable: true,
          lastPriceSyncAt: new Date(),
          lastInventorySyncAt: new Date(),
        },
      }),
      prisma.supplierVariantOffer.create({
        data: {
          supplierProductId,
          productVariantId: variantLargeId,
          supplierVariantId: 'avail-variant-l',
          supplierSku: 'AVAIL-L',
          colourName: 'Black',
          size: 'L',
          wholesaleCost: 5,
          isOrderable: true,
          lastPriceSyncAt: new Date(),
          lastInventorySyncAt: new Date(),
        },
      }),
    ]);
    offerSmallId = offerSmall.id;
    offerMediumId = offerMedium.id;
    offerLargeId = offerLarge.id;

    // The trap: plenty of S and M, almost none of L. Total (50+50+2=102) comfortably exceeds a
    // 30-unit order's total quantity, but L alone cannot cover its 10-unit share.
    await Promise.all([
      prisma.supplierWarehouseInventory.create({
        data: { supplierVariantOfferId: offerSmallId, warehouseCode: 'MAIN', availableQty: 50, lastSyncedAt: new Date() },
      }),
      // Split across two warehouses to prove summing across warehouses works correctly.
      prisma.supplierWarehouseInventory.create({
        data: { supplierVariantOfferId: offerMediumId, warehouseCode: 'MAIN', availableQty: 30, lastSyncedAt: new Date() },
      }),
      prisma.supplierWarehouseInventory.create({
        data: { supplierVariantOfferId: offerMediumId, warehouseCode: 'SECONDARY', availableQty: 20, lastSyncedAt: new Date() },
      }),
      prisma.supplierWarehouseInventory.create({
        data: { supplierVariantOfferId: offerLargeId, warehouseCode: 'MAIN', availableQty: 2, lastSyncedAt: new Date() },
      }),
    ]);
  });

  afterAll(async () => {
    if (offerSmallId || offerMediumId || offerLargeId) {
      await prisma.supplierWarehouseInventory.deleteMany({
        where: { supplierVariantOfferId: { in: [offerSmallId, offerMediumId, offerLargeId].filter(Boolean) } },
      });
    }
    if (offerSmallId || offerMediumId || offerLargeId) {
      await prisma.supplierVariantOffer.deleteMany({
        where: { id: { in: [offerSmallId, offerMediumId, offerLargeId].filter(Boolean) } },
      });
    }
    if (supplierProductId) await prisma.supplierProduct.deleteMany({ where: { id: supplierProductId } });
    if (supplierId) await prisma.supplier.deleteMany({ where: { id: supplierId } });
    const variantIds = [variantSmallId, variantMediumId, variantLargeId, variantNoOfferId].filter(Boolean);
    if (variantIds.length > 0) await prisma.productVariant.deleteMany({ where: { id: { in: variantIds } } });
    if (masterProductId) await prisma.masterProduct.deleteMany({ where: { id: masterProductId } });
    if (categoryId) await prisma.category.deleteMany({ where: { id: categoryId } });
    if (brandId) await prisma.brand.deleteMany({ where: { id: brandId } });
    await prisma.$disconnect();
  });

  it('catches an insufficient size even when total cached stock across the order is plenty', async () => {
    const result = await checkOrderAvailability(prisma, [
      { productVariantId: variantSmallId, quantity: 10 },
      { productVariantId: variantMediumId, quantity: 10 },
      { productVariantId: variantLargeId, quantity: 10 }, // only 2 available — the trap
    ]);

    expect(result.fulfillable).toBe(false);
    expect(result.insufficientLines).toHaveLength(1);
    expect(result.insufficientLines[0]!.productVariantId).toBe(variantLargeId);
    expect(result.insufficientLines[0]!.availableCached).toBe(2);

    const smallLine = result.lines.find((l) => l.productVariantId === variantSmallId);
    expect(smallLine?.sufficient).toBe(true);
  });

  it('sums availability correctly across multiple warehouses for the same offer', async () => {
    const result = await checkOrderAvailability(prisma, [{ productVariantId: variantMediumId, quantity: 45 }]);
    // 30 (MAIN) + 20 (SECONDARY) = 50, comfortably covers 45
    expect(result.lines[0]!.availableCached).toBe(50);
    expect(result.fulfillable).toBe(true);
  });

  it('reports the whole order as fulfillable when every line has enough stock', async () => {
    const result = await checkOrderAvailability(prisma, [
      { productVariantId: variantSmallId, quantity: 5 },
      { productVariantId: variantMediumId, quantity: 5 },
    ]);
    expect(result.fulfillable).toBe(true);
    expect(result.insufficientLines).toHaveLength(0);
  });

  it('flags a variant with no orderable supplier offer at all as noOfferFound, not just low stock', async () => {
    const result = await checkOrderAvailability(prisma, [{ productVariantId: variantNoOfferId, quantity: 1 }]);
    expect(result.fulfillable).toBe(false);
    expect(result.lines[0]!.noOfferFound).toBe(true);
    expect(result.lines[0]!.availableCached).toBe(0);
  });
});

if (!hasDb) {
  describe('checkout-availability.integration.test.ts', () => {
    it.skip('skipped: DATABASE_URL not set — see README "Live staging database"', () => {});
  });
}
