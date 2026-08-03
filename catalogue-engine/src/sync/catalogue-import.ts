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

import type { PrismaClient } from '@prisma/client';
import type { SupplierConnector } from '../integrations/suppliers/contract.js';
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

        // Persist raw image URLs now (source: supplier, status: pending) so they exist even for
        // products nobody has promoted to a MasterProduct yet. Not linked to a MasterProduct/
        // ProductVariant here — that link happens in catalogue/promote.ts once a human/curation
        // step decides this supplier product should actually go live. Keyed loosely by
        // (supplierId, sourceUrl) since there's no unique constraint on ProductImage to upsert
        // against — re-running an import just skips URLs already recorded rather than duplicating.
        for (const image of raw.images) {
          const alreadyRecorded = await prisma.productImage.findFirst({
            where: { supplierId, sourceUrl: image.url },
            select: { id: true },
          });
          if (alreadyRecorded) continue;
          await prisma.productImage.create({
            data: {
              supplierId,
              source: 'supplier',
              sourceUrl: image.url,
              imageType: image.imageType ?? 'primary',
              colourName: image.colourName ?? null,
              sortOrder: image.sortOrder ?? 0,
              status: 'pending',
            },
          });
        }

        const offerIdByVariantId = new Map<string, string>();
        for (const variant of raw.variants) {
          const offer = await prisma.supplierVariantOffer.upsert({
            where: {
              supplierProductId_supplierVariantId: {
                supplierProductId,
                supplierVariantId: variant.supplierVariantId,
              },
            },
            create: {
              supplierProductId,
              supplierVariantId: variant.supplierVariantId,
              supplierSku: variant.supplierSku,
              colourName: variant.colourName,
              size: variant.size,
              wholesaleCost: variant.wholesaleCost,
              currency: variant.currency,
              mapPrice: variant.mapPrice ?? null,
              isOrderable: variant.isOrderable,
              lastPriceSyncAt: new Date(),
              // Overwritten below once inventory is actually fetched for this product; this
              // placeholder only matters if the inventory fetch throws before reaching it.
              lastInventorySyncAt: new Date(0),
            },
            update: {
              colourName: variant.colourName,
              size: variant.size,
              wholesaleCost: variant.wholesaleCost,
              currency: variant.currency,
              mapPrice: variant.mapPrice ?? null,
              isOrderable: variant.isOrderable,
              lastPriceSyncAt: new Date(),
            },
          });
          offerIdByVariantId.set(variant.supplierVariantId, offer.id);
          variantOffersUpserted++;
        }

        if (offerIdByVariantId.size > 0) {
          try {
            const inventoryRows = await connector.fetchInventory([...offerIdByVariantId.keys()]);
            for (const inv of inventoryRows) {
              const offerId = offerIdByVariantId.get(inv.supplierVariantId);
              if (!offerId) continue;
              await prisma.supplierWarehouseInventory.upsert({
                where: {
                  supplierVariantOfferId_warehouseCode: {
                    supplierVariantOfferId: offerId,
                    warehouseCode: inv.warehouseCode,
                  },
                },
                create: {
                  supplierVariantOfferId: offerId,
                  warehouseCode: inv.warehouseCode,
                  warehouseName: inv.warehouseName ?? null,
                  availableQty: inv.availableQty,
                  incomingQty: inv.incomingQty ?? 0,
                  expectedRestockDate: inv.expectedRestockDate
                    ? new Date(inv.expectedRestockDate)
                    : null,
                  lastSyncedAt: new Date(),
                },
                update: {
                  availableQty: inv.availableQty,
                  incomingQty: inv.incomingQty ?? 0,
                  expectedRestockDate: inv.expectedRestockDate
                    ? new Date(inv.expectedRestockDate)
                    : null,
                  lastSyncedAt: new Date(),
                },
              });
              warehouseInventoryRowsUpserted++;
            }
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
    };
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
