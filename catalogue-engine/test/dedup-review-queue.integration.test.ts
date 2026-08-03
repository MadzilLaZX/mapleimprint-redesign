// Integration test for the dedup REVIEW QUEUE path — ambiguous matches that need a human
// decision, as opposed to orchestrator.integration.test.ts's auto-approve case. Exercises
// recordMatchResult (needs_review), approveMatch, and rejectMatch against a real database.
// Self-skips when DATABASE_URL isn't set, same pattern as orchestrator.integration.test.ts.
//
// Scenario: two supplier products from different (mock) suppliers, both plausibly the same
// Gildan tee but without a matching style number — brand matches, name is similar but not
// identical, so matcher.ts should land this in the needs_review band, never auto-approve.
// See architecture doc: "Incorrectly merging two products would be worse than temporarily
// displaying duplicates."

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { matchProduct } from '../src/sync/dedup/matcher.js';
import { recordMatchResult, approveMatch, rejectMatch } from '../src/sync/dedup/review-queue.js';

const hasDb = !!process.env.DATABASE_URL;
const describeIfDb = hasDb ? describe : describe.skip;

describeIfDb('dedup review queue — against a real database', () => {
  let prisma: import('@prisma/client').PrismaClient;
  let brandId: string;
  let categoryId: string;
  let masterProductId: string;
  let supplierAId: string;
  let supplierBId: string;
  let supplierProductAId: string; // will be approved
  let supplierProductBId: string; // will be rejected

  beforeAll(async () => {
    const { PrismaClient } = await import('@prisma/client');
    prisma = new PrismaClient();

    const brand = await prisma.brand.create({
      data: { name: 'IT Review Brand', slug: `it-review-brand-${Date.now()}`, isActive: true },
    });
    brandId = brand.id;

    const category = await prisma.category.create({
      data: { name: 'IT Review Category', slug: `it-review-category-${Date.now()}` },
    });
    categoryId = category.id;

    const masterProduct = await prisma.masterProduct.create({
      data: {
        brandId,
        primaryCategoryId: categoryId,
        slug: `it-review-master-${Date.now()}`,
        name: 'Gildan Heavy Cotton Tee',
        productType: 't_shirt',
        status: 'imported',
      },
    });
    masterProductId = masterProduct.id;

    const supplierA = await prisma.supplier.upsert({
      where: { code: 'integration_test_supplier_a' },
      update: {},
      create: { name: 'IT Test Supplier A', code: 'integration_test_supplier_a' },
    });
    supplierAId = supplierA.id;

    const supplierB = await prisma.supplier.upsert({
      where: { code: 'integration_test_supplier_b' },
      update: {},
      create: { name: 'IT Test Supplier B', code: 'integration_test_supplier_b' },
    });
    supplierBId = supplierB.id;

    // Same brand as the master product, but no style-number field recorded on either side and
    // a name that's similar-but-not-identical — exactly the ambiguous case the review queue
    // exists for.
    const supplierProductA = await prisma.supplierProduct.create({
      data: {
        supplierId: supplierAId,
        supplierStyleCode: 'A-5000',
        supplierBrandName: 'Gildan',
        supplierProductName: 'Gildan Heavy Cotton T-Shirt',
        rawPayload: { note: 'integration test fixture A' },
        lastSyncedAt: new Date(),
      },
    });
    supplierProductAId = supplierProductA.id;

    const supplierProductB = await prisma.supplierProduct.create({
      data: {
        supplierId: supplierBId,
        supplierStyleCode: 'B-5000X',
        supplierBrandName: 'Gildan',
        supplierProductName: 'Gildan Ultra Cotton Tee', // different enough to stay ambiguous
        rawPayload: { note: 'integration test fixture B' },
        lastSyncedAt: new Date(),
      },
    });
    supplierProductBId = supplierProductB.id;
  });

  afterAll(async () => {
    // See orchestrator.integration.test.ts's afterAll for why every one of these is guarded:
    // an undefined id in a Prisma `where` filter can mean "delete everything in the table"
    // instead of "delete nothing" — this already happened once for real.
    const productIds = [supplierProductAId, supplierProductBId].filter(Boolean);
    const supplierIds = [supplierAId, supplierBId].filter(Boolean);

    if (productIds.length > 0) {
      await prisma.matchCandidate.deleteMany({ where: { supplierProductId: { in: productIds } } });
      await prisma.supplierProduct.deleteMany({ where: { id: { in: productIds } } });
    }
    if (supplierIds.length > 0) {
      await prisma.supplier.deleteMany({ where: { id: { in: supplierIds } } });
    }
    if (masterProductId) await prisma.masterProduct.deleteMany({ where: { id: masterProductId } });
    if (categoryId) await prisma.category.deleteMany({ where: { id: categoryId } });
    if (brandId) await prisma.brand.deleteMany({ where: { id: brandId } });
    await prisma.$disconnect();
  });

  it('lands an ambiguous same-brand match in needs_review, never auto-approves it', async () => {
    const match = matchProduct(
      {
        brandName: 'Gildan',
        styleCode: 'A-5000',
        productName: 'Gildan Heavy Cotton T-Shirt',
        colours: ['Black', 'White'],
        sizes: ['S', 'M', 'L'],
      },
      [
        {
          id: masterProductId,
          brandName: 'Gildan',
          // deliberately no styleCode/upc recorded on the master product yet
          name: 'Gildan Heavy Cotton Tee',
          colours: ['Black', 'White', 'Navy'],
          sizes: ['S', 'M', 'L', 'XL'],
        },
      ],
    );

    expect(match).not.toBeNull();
    expect(match!.status).toBe('needs_review');
    expect(match!.confidence).toBeLessThan(0.95);

    await recordMatchResult(prisma, supplierProductAId, match!);

    const candidate = await prisma.matchCandidate.findFirstOrThrow({
      where: { supplierProductId: supplierProductAId },
    });
    expect(candidate.status).toBe('needs_review');
    expect(candidate.reviewedBy).toBeNull();

    const supplierProduct = await prisma.supplierProduct.findUniqueOrThrow({
      where: { id: supplierProductAId },
    });
    // Not linked to the master product yet — that only happens on human approval.
    expect(supplierProduct.matchStatus).toBe('needs_review');
    expect(supplierProduct.masterProductId).toBeNull();
  });

  it('approveMatch links the supplier product and stamps the reviewer', async () => {
    const candidate = await prisma.matchCandidate.findFirstOrThrow({
      where: { supplierProductId: supplierProductAId },
    });

    await approveMatch(prisma, candidate.id, 'it-test-reviewer@mapleimprint.ca');

    const updatedCandidate = await prisma.matchCandidate.findUniqueOrThrow({
      where: { id: candidate.id },
    });
    expect(updatedCandidate.status).toBe('confirmed');
    expect(updatedCandidate.reviewedBy).toBe('it-test-reviewer@mapleimprint.ca');
    expect(updatedCandidate.reviewedAt).not.toBeNull();

    const supplierProduct = await prisma.supplierProduct.findUniqueOrThrow({
      where: { id: supplierProductAId },
    });
    expect(supplierProduct.matchStatus).toBe('confirmed');
    expect(supplierProduct.masterProductId).toBe(masterProductId);
  });

  it('rejectMatch leaves the supplier product unlinked', async () => {
    const match = matchProduct(
      {
        brandName: 'Gildan',
        styleCode: 'B-5000X',
        productName: 'Gildan Ultra Cotton Tee',
        colours: ['Black'],
        sizes: ['XL'],
      },
      [
        {
          id: masterProductId,
          brandName: 'Gildan',
          name: 'Gildan Heavy Cotton Tee',
          colours: ['Black', 'White', 'Navy'],
          sizes: ['S', 'M', 'L', 'XL'],
        },
      ],
    );
    expect(match).not.toBeNull();
    expect(match!.status).toBe('needs_review');

    await recordMatchResult(prisma, supplierProductBId, match!);

    const candidate = await prisma.matchCandidate.findFirstOrThrow({
      where: { supplierProductId: supplierProductBId },
    });

    await rejectMatch(prisma, candidate.id, 'it-test-reviewer@mapleimprint.ca');

    const updatedCandidate = await prisma.matchCandidate.findUniqueOrThrow({
      where: { id: candidate.id },
    });
    expect(updatedCandidate.status).toBe('rejected');

    const supplierProduct = await prisma.supplierProduct.findUniqueOrThrow({
      where: { id: supplierProductBId },
    });
    expect(supplierProduct.matchStatus).toBe('rejected');
    // Critically: a rejected match must never end up linked to the master product.
    expect(supplierProduct.masterProductId).toBeNull();
  });
});

if (!hasDb) {
  describe('dedup-review-queue.integration.test.ts', () => {
    it.skip('skipped: DATABASE_URL not set — see README "Live staging database"', () => {});
  });
}
