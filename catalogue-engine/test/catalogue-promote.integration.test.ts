// Integration test for promoteSupplierProductToCatalogue against a real database. Proves it
// creates a MasterProduct + one ProductVariant per distinct colour/size, links offers and images,
// walks the product all the way to `published`, and is idempotent (a second call on an
// already-promoted SupplierProduct doesn't create a duplicate MasterProduct).

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promoteSupplierProductToCatalogue } from '../src/catalogue/promote.js';

const hasDb = !!process.env.DATABASE_URL;
const describeIfDb = hasDb ? describe : describe.skip;

describeIfDb('promoteSupplierProductToCatalogue — against a real database', () => {
  let prisma: import('@prisma/client').PrismaClient;
  let supplierId: string;
  let categoryId: string;
  let supplierProductId: string;
  let masterProductId: string | undefined;
  let brandId: string | undefined;
  let variantIds: string[] = [];

  beforeAll(async () => {
    const { PrismaClient } = await import('@prisma/client');
    prisma = new PrismaClient();

    const supplier = await prisma.supplier.upsert({
      where: { code: 'integration_test_promote_supplier' },
      update: {},
      create: { name: 'IT Promote Supplier', code: 'integration_test_promote_supplier' },
    });
    supplierId = supplier.id;

    const category = await prisma.category.upsert({
      where: { slug: `it-promote-category-${Date.now()}` },
      update: {},
      create: { name: 'IT Promote Category', slug: `it-promote-category-${Date.now()}` },
    });
    categoryId = category.id;

    const supplierProduct = await prisma.supplierProduct.create({
      data: {
        supplierId,
        supplierStyleCode: `IT-PROMOTE-${Date.now()}`,
        supplierBrandName: 'IT Promote Brand',
        supplierProductName: 'IT Promote Tee',
        rawPayload: { style: { description: '<p>A <b>great</b> tee.</p>' } },
        lastSyncedAt: new Date(),
      },
    });
    supplierProductId = supplierProduct.id;

    await prisma.supplierVariantOffer.createMany({
      data: [
        {
          supplierProductId,
          supplierVariantId: `it-promote-variant-${Date.now()}-1`,
          supplierSku: 'PROMOTE-SKU-1',
          colourName: 'Black',
          size: 'M',
          wholesaleCost: 6,
          lastPriceSyncAt: new Date(),
          lastInventorySyncAt: new Date(),
        },
        {
          supplierProductId,
          supplierVariantId: `it-promote-variant-${Date.now()}-2`,
          supplierSku: 'PROMOTE-SKU-2',
          colourName: 'Black',
          size: 'L',
          wholesaleCost: 6,
          lastPriceSyncAt: new Date(),
          lastInventorySyncAt: new Date(),
        },
        {
          supplierProductId,
          supplierVariantId: `it-promote-variant-${Date.now()}-3`,
          supplierSku: 'PROMOTE-SKU-3',
          colourName: 'White',
          size: 'M',
          wholesaleCost: 6,
          lastPriceSyncAt: new Date(),
          lastInventorySyncAt: new Date(),
        },
      ],
    });

    await prisma.productImage.create({
      data: {
        supplierId,
        source: 'supplier',
        sourceUrl: `https://example.test/it-promote-black-${Date.now()}.jpg`,
        imageType: 'front',
        colourName: 'Black',
        status: 'pending',
      },
    });
  });

  afterAll(async () => {
    if (variantIds.length > 0) {
      await prisma.supplierVariantOffer.updateMany({
        where: { productVariantId: { in: variantIds } },
        data: { productVariantId: null },
      });
      await prisma.productVariant.deleteMany({ where: { id: { in: variantIds } } });
    }
    if (supplierProductId) {
      await prisma.matchCandidate.deleteMany({ where: { supplierProductId } });
      await prisma.supplierVariantOffer.deleteMany({ where: { supplierProductId } });
      await prisma.supplierProduct.deleteMany({ where: { id: supplierProductId } });
    }
    if (supplierId) {
      await prisma.productImage.deleteMany({ where: { supplierId } });
      await prisma.supplier.deleteMany({ where: { id: supplierId } });
    }
    if (masterProductId) await prisma.masterProduct.deleteMany({ where: { id: masterProductId } });
    if (categoryId) await prisma.category.deleteMany({ where: { id: categoryId } });
    if (brandId) await prisma.brand.deleteMany({ where: { id: brandId } });
    await prisma.$disconnect();
  });

  it('creates a MasterProduct, one ProductVariant per colour+size, links offers and images, and publishes it', async () => {
    const category = await prisma.category.findUniqueOrThrow({ where: { id: categoryId } });

    const result = await promoteSupplierProductToCatalogue({
      prisma,
      supplierProductId,
      categorySlug: category.slug,
      productType: 't_shirt',
    });

    expect(result.alreadyPromoted).toBe(false);
    expect(result.variantsCreated).toBe(3); // Black/M, Black/L, White/M
    expect(result.imagesLinked).toBe(1);
    masterProductId = result.masterProductId;

    const masterProduct = await prisma.masterProduct.findUniqueOrThrow({
      where: { id: masterProductId },
      include: { variants: true, brand: true, images: true },
    });
    brandId = masterProduct.brandId;
    variantIds = masterProduct.variants.map((v) => v.id);

    expect(masterProduct.status).toBe('published');
    expect(masterProduct.isPublished).toBe(true);
    expect(masterProduct.brand.name).toBe('IT Promote Brand');
    expect(masterProduct.variants).toHaveLength(3);
    expect(masterProduct.images).toHaveLength(1);
    expect(masterProduct.images[0]!.colourName).toBe('Black');

    const offers = await prisma.supplierVariantOffer.findMany({ where: { supplierProductId } });
    expect(offers.every((o) => o.productVariantId !== null)).toBe(true);
  });

  it('is idempotent — a second call on an already-promoted product returns the same id without duplicating', async () => {
    const category = await prisma.category.findUniqueOrThrow({ where: { id: categoryId } });

    const second = await promoteSupplierProductToCatalogue({
      prisma,
      supplierProductId,
      categorySlug: category.slug,
      productType: 't_shirt',
    });

    expect(second.alreadyPromoted).toBe(true);
    expect(second.masterProductId).toBe(masterProductId);
    expect(second.variantsCreated).toBe(0);

    const count = await prisma.masterProduct.count({ where: { slug: { contains: 'it-promote-tee' } } });
    expect(count).toBe(1);
  });
});

if (!hasDb) {
  describe('catalogue-promote.integration.test.ts', () => {
    it.skip('skipped: DATABASE_URL not set — see README "Live staging database"', () => {});
  });
}
