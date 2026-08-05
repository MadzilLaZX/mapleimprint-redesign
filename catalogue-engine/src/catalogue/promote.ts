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

import type { PrismaClient } from '@prisma/client';
import { transitionProductStatus } from './curation.js';

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
  const variantIdByKey = new Map<string, string>();
  let variantsCreated = 0;
  const sizeOrder: Record<string, number> = {
    xs: 1, s: 2, m: 3, l: 4, xl: 5, '2xl': 6, xxl: 6, '3xl': 7, xxxl: 7, '4xl': 8, xxxxl: 8,
  };

  for (const offer of supplierProduct.variantOffers) {
    const key = `${offer.colourName}|${offer.size}`;
    let variantId = variantIdByKey.get(key);

    if (!variantId) {
      const normalizedColour = slugify(offer.colourName);
      const internalSku = await uniqueSlug(
        prisma,
        `MI-${slugify(supplierProduct.supplierStyleCode)}-${normalizedColour}-${slugify(offer.size)}`.toUpperCase(),
        async (sku) => {
          const existing = await prisma.productVariant.findUnique({ where: { internalSku: sku } });
          return existing !== null;
        },
      );

      const variant = await prisma.productVariant.create({
        data: {
          masterProductId: masterProduct.id,
          internalSku,
          colourName: offer.colourName,
          normalizedColour,
          size: offer.size,
          sizeSortOrder: sizeOrder[offer.size.trim().toLowerCase()] ?? 99,
        },
      });
      variantId = variant.id;
      variantIdByKey.set(key, variantId);
      variantsCreated++;
    }

    await prisma.supplierVariantOffer.update({
      where: { id: offer.id },
      data: { productVariantId: variantId },
    });
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
