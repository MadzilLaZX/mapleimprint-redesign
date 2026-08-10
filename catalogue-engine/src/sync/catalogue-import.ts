// Turns a connector's fetchProductCatalogue() output into real SupplierProduct /
// SupplierVariantOffer / SupplierWarehouseInventory rows. This is distinct from (and runs before)
// runPriceSync in orchestrator.ts, which only refreshes PRICES on offers that already exist —
// nothing previously created those rows in the first place. This is that missing first step.
//
// Per product: upsert SupplierProduct (keyed on supplierId+supplierStyleCode), run the dedup
// matcher against existing MasterProducts for newly-created products only (an already-imported
// product's match status isn't re-decided here — that's the review queue's job), upsert each
// variant as a SupplierVariantOffer, then fetch and upsert live warehouse inventory for those
// variants. One item failing doesn't abort the run — it's recorded in itemErrors and the job
// finishes as 'completed_with_warnings', consistent with how partial supplier data problems are
// meant to surface (per architecture doc: don't let one bad product take down a whole sync).
//
// NOTE on match quality: MatchableMasterProduct's styleCode/upc/material fields can't be
// populated from the current schema — MasterProduct has no styleCode/upc/material columns yet.
// This caps matching at the "brand + soft signals" tier (max 0.85, per matcher.ts), never the
// styleNumberMatch/upcMatch fast path that reaches auto-approve (0.95+). Until the schema grows
// those columns, expect everything that matches at all to land in needs_review, not auto-approved
// — that's a real schema gap, not a bug in this file.

import { randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import type {
  RawInventoryRecord,
  RawSupplierVariant,
  SupplierConnector,
} from '../integrations/suppliers/contract.js';
import {
  matchProduct,
  type MatchableMasterProduct,
  type MatchableSupplierProduct,
} from './dedup/matcher.js';
import { recordMatchResult } from './dedup/review-queue.js';
import { isSyncLocked } from './orchestrator.js';

export interface RunCatalogueImportOptions {
  prisma: PrismaClient;
  connector: SupplierConnector;
  supplierId: string;
  /** Caps how many supplier products this run processes — a safety valve for a first test run
   *  against a large real catalogue, not a permanent limit. Omit for a full import. */
  limit?: number;
}

export interface RunCatalogueImportResult {
  jobId: string | null;
  status: 'completed' | 'completed_with_warnings' | 'failed' | 'skipped_locked';
  supplierProductsProcessed: number;
  supplierProductsCreated: number;
  supplierProductsUpdated: number;
  variantOffersUpserted: number;
  warehouseInventoryRowsUpserted: number;
  matchesAutoApproved: number;
  matchesNeedingReview: number;
  itemErrors: string[];
  /** Exactly which SupplierProduct rows this run touched (created or updated) — the only safe
   *  way for a caller to know which rows belong to this run, e.g. before promoting them. Re-querying
   *  "any unpromoted row for this supplier" is NOT safe when running several imports back to back
   *  (a filtered-by-productType import followed by another), since a row a previous run failed to
   *  promote would still be sitting there with no masterProductId and get mis-attributed. */
  supplierProductIds: string[];
}

function emptyResult(
  status: RunCatalogueImportResult['status'],
  jobId: string | null,
  itemErrors: string[] = [],
): RunCatalogueImportResult {
  return {
    jobId,
    status,
    supplierProductsProcessed: 0,
    supplierProductsCreated: 0,
    supplierProductsUpdated: 0,
    variantOffersUpserted: 0,
    warehouseInventoryRowsUpserted: 0,
    matchesAutoApproved: 0,
    matchesNeedingReview: 0,
    itemErrors,
    supplierProductIds: [],
  };
}

export async function runCatalogueImport(
  opts: RunCatalogueImportOptions,
): Promise<RunCatalogueImportResult> {
  const { prisma, connector, supplierId, limit } = opts;

  if (await isSyncLocked(prisma, supplierId)) {
    return emptyResult('skipped_locked', null, [
      'another sync job is already running for this supplier',
    ]);
  }

  let job: { id: string };
  try {
    job = await prisma.supplierSyncJob.create({
      data: { supplierId, syncType: 'full_catalogue', status: 'running' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('supplier_sync_job_one_running_per_supplier')) {
      return emptyResult('skipped_locked', null, [
        'another sync job is already running for this supplier',
      ]);
    }
    throw err;
  }

  const matchCandidates = await loadMatchCandidates(prisma);

  let processed = 0;
  let created = 0;
  let updated = 0;
  let variantOffersUpserted = 0;
  let warehouseInventoryRowsUpserted = 0;
  let autoApproved = 0;
  let needsReview = 0;
  const itemErrors: string[] = [];
  const supplierProductIds: string[] = [];

  try {
    for await (const raw of connector.fetchProductCatalogue()) {
      if (limit && processed >= limit) break;
      processed++;

      try {
        const existing = await prisma.supplierProduct.findUnique({
          where: {
            supplierId_supplierStyleCode: { supplierId, supplierStyleCode: raw.supplierStyleCode },
          },
        });

        let supplierProductId: string;
        if (existing) {
          await prisma.supplierProduct.update({
            where: { id: existing.id },
            data: {
              supplierBrandName: raw.brandName,
              supplierProductName: raw.productName,
              rawPayload: raw.rawPayload as object,
              lastSyncedAt: new Date(),
              status: 'active',
            },
          });
          supplierProductId = existing.id;
          updated++;
        } else {
          const createdRow = await prisma.supplierProduct.create({
            data: {
              supplierId,
              supplierStyleCode: raw.supplierStyleCode,
              supplierBrandName: raw.brandName,
              supplierProductName: raw.productName,
              rawPayload: raw.rawPayload as object,
              lastSyncedAt: new Date(),
            },
          });
          supplierProductId = createdRow.id;
          created++;

          const matchable: MatchableSupplierProduct = {
            brandName: raw.brandName,
            styleCode: raw.supplierStyleCode,
            productName: raw.productName,
            colours: [...new Set(raw.variants.map((v) => v.colourName))],
            sizes: [...new Set(raw.variants.map((v) => v.size))],
            upc: raw.variants.find((v) => v.upc)?.upc,
          };
          const match = matchProduct(matchable, matchCandidates);
          if (match) {
            await recordMatchResult(prisma, supplierProductId, match);
            if (match.status === 'auto_approved') autoApproved++;
            else needsReview++;
          }
        }

        supplierProductIds.push(supplierProductId);

        // Persist raw image URLs now (source: supplier, status: pending) so they exist even for
        // products nobody has promoted to a MasterProduct yet. Not linked to a MasterProduct/
        // ProductVariant here — that link happens in catalogue/promote.ts once a human/curation
        // step decides this supplier product should actually go live. Keyed by
        // (supplierProductId, sourceUrl), NOT just (supplierId, sourceUrl) — S&S sometimes reuses
        // the exact same photo across companion styles (e.g. a "Tall" size sharing images with the
        // regular version). Deduping by URL alone would let the first style to see that URL claim
        // it and leave every other style that legitimately shares the same photo with nothing.
        // Batched instead of one findFirst+create round trip per image — a mega-SKU style (see
        // batchUpsertVariantOffers below) can carry 200+ images, and sequential per-image calls
        // were adding minutes on their own.
        if (raw.images.length > 0) {
          const existingUrls = new Set(
            (
              await prisma.productImage.findMany({
                where: { supplierProductId },
                select: { sourceUrl: true },
              })
            ).map((r) => r.sourceUrl),
          );
          const newImages = raw.images.filter((img) => !existingUrls.has(img.url));
          if (newImages.length > 0) {
            await prisma.productImage.createMany({
              data: newImages.map((image) => ({
                supplierId,
                supplierProductId,
                source: 'supplier',
                sourceUrl: image.url,
                imageType: image.imageType ?? 'primary',
                colourName: image.colourName ?? null,
                sortOrder: image.sortOrder ?? 0,
                status: 'pending',
              })),
              skipDuplicates: true,
            });
          }
        }

        // Batched bulk upsert instead of one upsert-per-variant round trip. Real cause of
        // multi-minute per-product stalls confirmed live 2026-08-10: a core blank like "Jersey
        // Tee" carries 500+ variants and 1000+ warehouse rows — at ~280ms per sequential DB
        // round trip that's 10+ minutes for a single product. Collapsing each product's variants
        // (and separately, its warehouse rows) into one multi-row INSERT ... ON CONFLICT turns
        // that into a handful of statements.
        const offerIdByVariantId = await batchUpsertVariantOffers(
          prisma,
          supplierProductId,
          raw.variants,
        );
        variantOffersUpserted += offerIdByVariantId.size;

        if (offerIdByVariantId.size > 0) {
          try {
            const inventoryRows = await connector.fetchInventory([...offerIdByVariantId.keys()]);
            const rowsToWrite = inventoryRows
              .map((inv) => {
                const offerId = offerIdByVariantId.get(inv.supplierVariantId);
                return offerId ? { ...inv, offerId } : null;
              })
              .filter((r): r is NonNullable<typeof r> => r !== null);
            await batchUpsertWarehouseInventory(prisma, rowsToWrite);
            warehouseInventoryRowsUpserted += rowsToWrite.length;

            await prisma.supplierVariantOffer.updateMany({
              where: { id: { in: [...offerIdByVariantId.values()] } },
              data: { lastInventorySyncAt: new Date() },
            });
          } catch (invErr) {
            itemErrors.push(
              `${raw.supplierStyleCode}: inventory fetch failed — ${invErr instanceof Error ? invErr.message : String(invErr)}`,
            );
          }
        }
      } catch (itemErr) {
        itemErrors.push(
          `${raw.supplierStyleCode}: ${itemErr instanceof Error ? itemErr.message : String(itemErr)}`,
        );
      }
    }

    const status = itemErrors.length > 0 ? 'completed_with_warnings' : 'completed';

    await prisma.supplierSyncJob.update({
      where: { id: job.id },
      data: {
        status,
        finishedAt: new Date(),
        recordsReceived: processed,
        recordsCreated: created,
        recordsUpdated: updated,
        recordsFailed: itemErrors.length,
        errorSummary: itemErrors.length > 0 ? itemErrors.slice(0, 20).join('; ') : null,
      },
    });
    await prisma.supplier.update({
      where: { id: supplierId },
      data: { lastSuccessfulSyncAt: new Date() },
    });

    return {
      jobId: job.id,
      status,
      supplierProductsProcessed: processed,
      supplierProductsCreated: created,
      supplierProductsUpdated: updated,
      variantOffersUpserted,
      warehouseInventoryRowsUpserted,
      matchesAutoApproved: autoApproved,
      matchesNeedingReview: needsReview,
      itemErrors,
      supplierProductIds,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.supplierSyncJob.update({
      where: { id: job.id },
      data: { status: 'failed', errorSummary: message, finishedAt: new Date() },
    });
    await prisma.supplier.update({
      where: { id: supplierId },
      data: { lastFailedSyncAt: new Date() },
    });
    return {
      jobId: job.id,
      status: 'failed',
      supplierProductsProcessed: processed,
      supplierProductsCreated: created,
      supplierProductsUpdated: updated,
      variantOffersUpserted,
      warehouseInventoryRowsUpserted,
      matchesAutoApproved: autoApproved,
      matchesNeedingReview: needsReview,
      itemErrors: [...itemErrors, message],
      supplierProductIds,
    };
  }
}

const BATCH_WRITE_CHUNK_SIZE = 150;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// Bulk upsert via a single multi-row INSERT ... ON CONFLICT per chunk, instead of one upsert
// round trip per variant. Returns supplierVariantId -> row id, same shape callers previously
// built up manually from N individual upsert() results.
async function batchUpsertVariantOffers(
  prisma: PrismaClient,
  supplierProductId: string,
  variants: RawSupplierVariant[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (variants.length === 0) return result;

  const now = new Date();
  for (const batch of chunk(variants, BATCH_WRITE_CHUNK_SIZE)) {
    const values = Prisma.join(
      batch.map(
        (v) =>
          Prisma.sql`(${randomUUID()}, ${supplierProductId}, ${v.supplierVariantId}, ${v.supplierSku}, ${v.colourName}, ${v.size}, ${v.wholesaleCost}, ${v.currency}, ${v.mapPrice ?? null}, ${v.isOrderable}, ${now}, ${new Date(0)})`,
      ),
    );
    const rows = await prisma.$queryRaw<Array<{ id: string; supplierVariantId: string }>>`
      INSERT INTO "SupplierVariantOffer"
        (id, "supplierProductId", "supplierVariantId", "supplierSku", "colourName", "size", "wholesaleCost", "currency", "mapPrice", "isOrderable", "lastPriceSyncAt", "lastInventorySyncAt")
      VALUES ${values}
      ON CONFLICT ("supplierProductId", "supplierVariantId") DO UPDATE SET
        "supplierSku" = EXCLUDED."supplierSku",
        "colourName" = EXCLUDED."colourName",
        "size" = EXCLUDED."size",
        "wholesaleCost" = EXCLUDED."wholesaleCost",
        "currency" = EXCLUDED."currency",
        "mapPrice" = EXCLUDED."mapPrice",
        "isOrderable" = EXCLUDED."isOrderable",
        "lastPriceSyncAt" = EXCLUDED."lastPriceSyncAt"
      RETURNING id, "supplierVariantId"
    `;
    for (const row of rows) result.set(row.supplierVariantId, row.id);
  }
  return result;
}

async function batchUpsertWarehouseInventory(
  prisma: PrismaClient,
  rows: Array<RawInventoryRecord & { offerId: string }>,
): Promise<void> {
  if (rows.length === 0) return;
  const now = new Date();
  for (const batch of chunk(rows, BATCH_WRITE_CHUNK_SIZE)) {
    const values = Prisma.join(
      batch.map(
        (r) =>
          Prisma.sql`(${randomUUID()}, ${r.offerId}, ${r.warehouseCode}, ${r.warehouseName ?? null}, ${r.availableQty}, ${r.incomingQty ?? 0}, ${r.expectedRestockDate ? new Date(r.expectedRestockDate) : null}, ${now})`,
      ),
    );
    await prisma.$executeRaw`
      INSERT INTO "SupplierWarehouseInventory"
        (id, "supplierVariantOfferId", "warehouseCode", "warehouseName", "availableQty", "incomingQty", "expectedRestockDate", "lastSyncedAt")
      VALUES ${values}
      ON CONFLICT ("supplierVariantOfferId", "warehouseCode") DO UPDATE SET
        "warehouseName" = EXCLUDED."warehouseName",
        "availableQty" = EXCLUDED."availableQty",
        "incomingQty" = EXCLUDED."incomingQty",
        "expectedRestockDate" = EXCLUDED."expectedRestockDate",
        "lastSyncedAt" = EXCLUDED."lastSyncedAt"
    `;
  }
}

async function loadMatchCandidates(prisma: PrismaClient): Promise<MatchableMasterProduct[]> {
  const products = await prisma.masterProduct.findMany({
    include: { brand: true, variants: true },
  });
  return products.map((p) => ({
    id: p.id,
    brandName: p.brand.name,
    name: p.name,
    colours: [...new Set(p.variants.map((v) => v.colourName))],
    sizes: [...new Set(p.variants.map((v) => v.size))],
  }));
}
