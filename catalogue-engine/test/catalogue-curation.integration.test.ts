// Integration test for transitionProductStatus against a real database. Proves the DB write
// actually happens on a valid transition, isPublished stays in sync with status, and an invalid
// transition is rejected WITHOUT writing anything (rather than silently applying it or throwing
// an unhandled exception). Self-skips when DATABASE_URL isn't set.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { transitionProductStatus } from '../src/catalogue/curation.js';

const hasDb = !!process.env.DATABASE_URL;
const describeIfDb = hasDb ? describe : describe.skip;

describeIfDb('transitionProductStatus — against a real database', () => {
  let prisma: import('@prisma/client').PrismaClient;
  let brandId: string;
  let categoryId: string;
  let masterProductId: string;

  beforeAll(async () => {
    const { PrismaClient } = await import('@prisma/client');
    prisma = new PrismaClient();

    const brand = await prisma.brand.create({
      data: { name: 'IT Curation Brand', slug: `it-curation-brand-${Date.now()}`, isActive: true },
    });
    brandId = brand.id;

    const category = await prisma.category.create({
      data: { name: 'IT Curation Category', slug: `it-curation-category-${Date.now()}` },
    });
    categoryId = category.id;

    const masterProduct = await prisma.masterProduct.create({
      data: {
        brandId,
        primaryCategoryId: categoryId,
        slug: `it-curation-product-${Date.now()}`,
        name: 'Curation Test Product',
        productType: 't_shirt',
        status: 'imported', // schema default, explicit here for clarity
        isPublished: false,
      },
    });
    masterProductId = masterProduct.id;
  });

  afterAll(async () => {
    if (masterProductId) await prisma.masterProduct.deleteMany({ where: { id: masterProductId } });
    if (categoryId) await prisma.category.deleteMany({ where: { id: categoryId } });
    if (brandId) await prisma.brand.deleteMany({ where: { id: brandId } });
    await prisma.$disconnect();
  });

  it('rejects an invalid transition (imported -> published) and writes nothing', async () => {
    const result = await transitionProductStatus(prisma, masterProductId, 'published');
    expect(result.success).toBe(false);
    expect(result.reason).toMatch(/cannot transition from 'imported' to 'published'/);

    const stillImported = await prisma.masterProduct.findUniqueOrThrow({ where: { id: masterProductId } });
    expect(stillImported.status).toBe('imported');
    expect(stillImported.isPublished).toBe(false);
  });

  it('applies a valid transition and updates the real row', async () => {
    const result = await transitionProductStatus(prisma, masterProductId, 'needs_review');
    expect(result.success).toBe(true);
    expect(result.previousStatus).toBe('imported');
    expect(result.newStatus).toBe('needs_review');

    const updated = await prisma.masterProduct.findUniqueOrThrow({ where: { id: masterProductId } });
    expect(updated.status).toBe('needs_review');
  });

  it('keeps isPublished in sync: true only while status is published', async () => {
    await transitionProductStatus(prisma, masterProductId, 'approved');
    const publishResult = await transitionProductStatus(prisma, masterProductId, 'published');
    expect(publishResult.success).toBe(true);

    const published = await prisma.masterProduct.findUniqueOrThrow({ where: { id: masterProductId } });
    expect(published.status).toBe('published');
    expect(published.isPublished).toBe(true);

    const hideResult = await transitionProductStatus(prisma, masterProductId, 'hidden');
    expect(hideResult.success).toBe(true);

    const hidden = await prisma.masterProduct.findUniqueOrThrow({ where: { id: masterProductId } });
    expect(hidden.status).toBe('hidden');
    expect(hidden.isPublished).toBe(false); // must flip back off when leaving published
  });

  it('blocking a published-then-hidden product requires going through needs_review before it can be published again', async () => {
    const blockResult = await transitionProductStatus(prisma, masterProductId, 'blocked');
    expect(blockResult.success).toBe(true);

    const straightToPublished = await transitionProductStatus(prisma, masterProductId, 'published');
    expect(straightToPublished.success).toBe(false);

    const toReview = await transitionProductStatus(prisma, masterProductId, 'needs_review');
    expect(toReview.success).toBe(true);
  });
});

if (!hasDb) {
  describe('catalogue-curation.integration.test.ts', () => {
    it.skip('skipped: DATABASE_URL not set — see README "Live staging database"', () => {});
  });
}
