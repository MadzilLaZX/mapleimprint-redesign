// Turns an imported SupplierProduct (raw supplier data, sitting in staging tables after
// catalogue-import.ts) into a real, customer-facing MasterProduct: creates/reuses a Brand,
// creates one ProductVariant per distinct colour+size combination, links each
// SupplierVariantOffer to its ProductVariant, links any already-ingested supplier images
// (see catalogue-import.ts's image-persistence step) by matching colourName, and walks the
// result through curation.ts's status state machine all the way to `published`.
//
// This is a deliberate bootstrap path for a product's FIRST supplier — there's no existing
// MasterProduct to match against yet for a brand-new catalogue, so this doesn't go through the
// dedup matcher (that's for reconciling a SECOND+ supplier's data against what's already here).
// Calling this on a SupplierProduct that's already promoted (masterProductId already set) is a
// no-op that returns the existing link rather than creating a duplicate.
//
// Walking the curation state machine to `published` here means whoever calls this function IS
// the review/approval step — treat every call as a deliberate "yes, put this on the site" action,
// not something to run unattended over an entire unreviewed catalogue import.

import { randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { transitionProductStatus } from './curation.js';

const BATCH_WRITE_CHUNK_SIZE = 150;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export interface PromoteToCatalogueOptions {
  prisma: PrismaClient;
  supplierProductId: string;
  categorySlug: string; // must already exist — see sync/seed-categories.ts
  productType: string;
}

export interface PromoteToCatalogueResult {
  masterProductId: string;
  alreadyPromoted: boolean;
  variantsCreated: number;
  imagesLinked: number;
}

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');
}

async function uniqueSlug(
  prisma: PrismaClient,
  base: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  let slug = base || 'product';
  let suffix = 1;
  while (await exists(slug)) {
    suffix++;
    slug = `${base}-${suffix}`;
  }
  return slug;
}

// Links a SupplierProduct's already-ingested images (persisted by catalogue-import.ts) to a
// MasterProduct, scoped by supplierProductId — NOT by colourName alone. Colour names like
// "Black" or "White" repeat across many different styles, so matching on colour without also
// pinning the exact style would let whichever product promotes first claim every unlinked image
// of that colour, regardless of which style it actually came from. Exported separately from
// promoteSupplierProductToCatalogue so a repair pass can re-run this for products that were
// promoted before this scoping fix existed, without redoing the whole promotion.
export async function linkSupplierProductImages(
  prisma: PrismaClient,
  supplierProductId: string,
  masterProductId: string,
): Promise<number> {
  const result = await prisma.productImage.updateMany({
    where: { supplierProductId, masterProductId: null },
    data: { masterProductId, status: 'published' },
  });
  return result.count;
}

export async function promoteSupplierProductToCatalogue(
  opts: PromoteToCatalogueOptions,
): Promise<PromoteToCatalogueResult> {
  const { prisma, supplierProductId, categorySlug, productType } = opts;

  const supplierProduct = await prisma.supplierProduct.findUniqueOrThrow({
    where: { id: supplierProductId },
    include: { variantOffers: true },
  });

  if (supplierProduct.masterProductId) {
    return {
      masterProductId: supplierProduct.masterProductId,
      alreadyPromoted: true,
      variantsCreated: 0,
      imagesLinked: 0,
    };
  }

  const category = await prisma.category.findUniqueOrThrow({ where: { slug: categorySlug } });

  const brandSlug = slugify(supplierProduct.supplierBrandName);
  const brand = await prisma.brand.upsert({
    where: { slug: brandSlug },
    update: {},
    create: { name: supplierProduct.supplierBrandName, slug: brandSlug, isActive: true },
  });

  const masterSlugBase = slugify(`${supplierProduct.supplierBrandName}-${supplierProduct.supplierProductName}`);
  const masterSlug = await uniqueSlug(prisma, masterSlugBase, async (slug) => {
    const existing = await prisma.masterProduct.findUnique({ where: { slug } });
    return existing !== null;
  });

  const rawStyle = (supplierProduct.rawPayload as { style?: { description?: string } } | null)?.style;

  const masterProduct = await prisma.masterProduct.create({
    data: {
      brandId: brand.id,
      primaryCategoryId: category.id,
      slug: masterSlug,
      name: supplierProduct.supplierProductName,
      fullDescription: rawStyle?.description ?? null,
      productType,
      status: 'imported',
    },
  });

  // One ProductVariant per distinct (colourName, size) pair across this supplier's offers —
  // multiple offers can share a variant (e.g. if a future second supplier also offers M/Black).
  //
  // Batched instead of one findUnique + create + update round trip per offer — a core blank
  // style can carry 400+ variants, and at ~280ms per sequential DB call that was 10+ minutes
  // per product (confirmed live 2026-08-10, same root cause as catalogue-import.ts's variant
  // sync loop). Candidate SKU uniqueness is checked in one batch query up front; the (extremely
  // rare in practice, since SKUs already encode style+colour+size) collision case falls back to
  // the original per-item uniqueSlug loop.
  const sizeOrder: Record<string, number> = {
    xs: 1, s: 2, m: 3, l: 4, xl: 5, '2xl': 6, xxl: 6, '3xl': 7, xxxl: 7, '4xl': 8, xxxxl: 8,
  };

  const distinctByKey = new Map<
    string,
    { colourName: string; size: string; normalizedColour: string; candidateSku: string }
  >();
  for (const offer of supplierProduct.variantOffers) {
    const key = `${offer.colourName}|${offer.size}`;
    if (distinctByKey.has(key)) continue;
    const normalizedColour = slugify(offer.colourName);
    distinctByKey.set(key, {
      colourName: offer.colourName,
      size: offer.size,
      normalizedColour,
      candidateSku:
        `MI-${slugify(supplierProduct.supplierStyleCode)}-${normalizedColour}-${slugify(offer.size)}`.toUpperCase(),
    });
  }
  const distinct = [...distinctByKey.entries()];

  const conflicting = new Set(
    (
      await prisma.productVariant.findMany({
        where: { internalSku: { in: distinct.map(([, v]) => v.candidateSku) } },
        select: { internalSku: true },
      })
    ).map((r) => r.internalSku),
  );

  const toInsert: Array<{
    key: string;
    id: string;
    internalSku: string;
    colourName: string;
    normalizedColour: string;
    size: string;
    sizeSortOrder: number;
  }> = [];
  for (const [key, v] of distinct) {
    const internalSku = conflicting.has(v.candidateSku)
      ? await uniqueSlug(prisma, v.candidateSku, async (sku) => {
          const existing = await prisma.productVariant.findUnique({ where: { internalSku: sku } });
          return existing !== null;
        })
      : v.candidateSku;
    toInsert.push({
      key,
      id: randomUUID(),
      internalSku,
      colourName: v.colourName,
      normalizedColour: v.normalizedColour,
      size: v.size,
      sizeSortOrder: sizeOrder[v.size.trim().toLowerCase()] ?? 99,
    });
  }

  for (const batch of chunk(toInsert, BATCH_WRITE_CHUNK_SIZE)) {
    if (batch.length === 0) continue;
    const values = Prisma.join(
      batch.map(
        (v) =>
          Prisma.sql`(${v.id}, ${masterProduct.id}, ${v.internalSku}, ${v.colourName}, ${v.normalizedColour}, ${v.size}, ${v.sizeSortOrder})`,
      ),
    );
    await prisma.$executeRaw`
      INSERT INTO "ProductVariant"
        (id, "masterProductId", "internalSku", "colourName", "normalizedColour", "size", "sizeSortOrder")
      VALUES ${values}
    `;
  }
  const variantsCreated = toInsert.length;
  const variantIdByKey = new Map(toInsert.map((v) => [v.key, v.id]));

  const offerLinks = supplierProduct.variantOffers.map((offer) => ({
    offerId: offer.id,
    variantId: variantIdByKey.get(`${offer.colourName}|${offer.size}`),
  }));
  for (const batch of chunk(offerLinks, BATCH_WRITE_CHUNK_SIZE)) {
    const rows = batch.filter(
      (r): r is { offerId: string; variantId: string } => r.variantId !== undefined,
    );
    if (rows.length === 0) continue;
    const values = Prisma.join(
      rows.map((r) => Prisma.sql`(${r.offerId}, ${r.variantId})`),
    );
    await prisma.$executeRaw`
      UPDATE "SupplierVariantOffer" AS t
      SET "productVariantId" = v.variant_id
      FROM (VALUES ${values}) AS v(offer_id, variant_id)
      WHERE t.id = v.offer_id
    `;
  }

  const imagesLinked = await linkSupplierProductImages(prisma, supplierProductId, masterProduct.id);

  // Link the SupplierProduct back to its new MasterProduct — without this, a second call would
  // never see masterProductId set and would create a duplicate MasterProduct every time.
  await prisma.supplierProduct.update({
    where: { id: supplierProductId },
    data: { masterProductId: masterProduct.id, matchStatus: 'confirmed' },
  });

  // Walk the curation state machine to published — see file header: calling this function IS
  // the approval decision, not an automatic bypass of review.
  await transitionProductStatus(prisma, masterProduct.id, 'needs_review');
  await transitionProductStatus(prisma, masterProduct.id, 'approved');
  await transitionProductStatus(prisma, masterProduct.id, 'published');

  return {
    masterProductId: masterProduct.id,
    alreadyPromoted: false,
    variantsCreated,
    imagesLinked,
  };
}
