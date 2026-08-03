// Wires a SupplierConnector to the staging/diff/safety-stop pipeline. This is the one file in
// the package that needs a real Prisma client + database to run — everything it calls into
// (diffRecords, evaluateSafetyStop, matchProduct) is pure and independently tested.
//
// Flow (see architecture doc §6): receive -> validate -> stage -> diff -> safety-stop check ->
// commit in one transaction, or abort and leave the live catalogue untouched.

import type { PrismaClient } from '@prisma/client';
import type { SupplierConnector } from '../integrations/suppliers/contract.js';
import {
  diffRecords,
  evaluateSafetyStop,
  type ExistingRecord,
  type IncomingRecord,
  DEFAULT_SAFETY_THRESHOLDS,
  type SafetyStopThresholds,
} from './change-detection.js';

export interface RunPriceSyncOptions {
  prisma: PrismaClient;
  connector: SupplierConnector;
  supplierId: string;
  thresholds?: SafetyStopThresholds;
}

export interface RunPriceSyncResult {
  jobId: string | null;
  status: 'completed' | 'completed_with_warnings' | 'aborted_safety_stop' | 'failed' | 'skipped_locked';
  changeSummary: ReturnType<typeof diffRecords>;
  abortReasons: string[];
}

/**
 * True if this supplier already has a sync job in `running` status. Architecture doc §10 flags
 * this as a real, previously-unaddressed risk: "If a nightly full sync is still running when an
 * hourly inventory sync fires, you need a lock/skip strategy per supplier — a classic source of
 * a corrupted staging table." The lock is per-supplier (not per-syncType) because a full-catalogue
 * sync and a concurrent inventory sync for the SAME supplier can still race on the same rows
 * (e.g. a product the catalogue sync is mid-creating that the inventory sync tries to reference).
 */
export async function isSyncLocked(prisma: PrismaClient, supplierId: string): Promise<boolean> {
  const runningCount = await prisma.supplierSyncJob.count({
    where: { supplierId, status: 'running' },
  });
  return runningCount > 0;
}

/**
 * Price-delta sync for a single supplier: fetch current offers from the DB, fetch fresh prices
 * from the connector, diff, safety-check, and only then commit. Nothing here writes partial or
 * unvalidated data to SupplierVariantOffer — a failed/aborted run leaves it untouched.
 *
 * Checks isSyncLocked() first and refuses to start (no job row created) if another sync for the
 * same supplier is already running — see isSyncLocked's comment for why.
 */
export async function runPriceSync(opts: RunPriceSyncOptions): Promise<RunPriceSyncResult> {
  const { prisma, connector, supplierId, thresholds = DEFAULT_SAFETY_THRESHOLDS } = opts;

  if (await isSyncLocked(prisma, supplierId)) {
    return {
      jobId: null,
      status: 'skipped_locked',
      changeSummary: diffRecords([], []),
      abortReasons: ['another sync job is already running for this supplier'],
    };
  }

  // isSyncLocked() above is a fast pre-check, not the real guarantee — two calls could both pass
  // it in the same instant (classic check-then-act race). The actual enforcement is a partial
  // unique index in the database (migration: add_one_running_sync_per_supplier_constraint),
  // which rejects a second concurrent insert outright. Catch that specific failure here and
  // treat it the same as a pre-check miss, rather than surfacing a raw DB error.
  let job: { id: string };
  try {
    job = await prisma.supplierSyncJob.create({
      data: { supplierId, syncType: 'price_delta', status: 'running' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('supplier_sync_job_one_running_per_supplier')) {
      return {
        jobId: null,
        status: 'skipped_locked',
        changeSummary: diffRecords([], []),
        abortReasons: ['another sync job is already running for this supplier'],
      };
    }
    throw err;
  }

  try {
    const existingOffers = await prisma.supplierVariantOffer.findMany({
      where: { supplierProduct: { supplierId } },
      select: { supplierVariantId: true, wholesaleCost: true },
    });

    const existing: ExistingRecord[] = existingOffers.map((o) => ({
      key: o.supplierVariantId,
      price: Number(o.wholesaleCost),
    }));

    const supplierVariantIds = existing.map((e) => e.key);
    const freshPrices = await connector.fetchPricing(supplierVariantIds);

    const incoming: IncomingRecord[] = freshPrices.map((p) => ({
      key: p.supplierVariantId,
      price: p.wholesaleCost,
    }));

    const summary = diffRecords(existing, incoming);
    const safety = evaluateSafetyStop(summary, existing.length, thresholds);

    if (safety.shouldAbort) {
      await prisma.supplierSyncJob.update({
        where: { id: job.id },
        data: {
          status: 'aborted_safety_stop',
          changeSummary: summary as unknown as object,
          errorSummary: safety.reasons.join('; '),
          finishedAt: new Date(),
          recordsReceived: incoming.length,
        },
      });
      return {
        jobId: job.id,
        status: 'aborted_safety_stop',
        changeSummary: summary,
        abortReasons: safety.reasons,
      };
    }

    await prisma.$transaction(
      freshPrices.map((p) =>
        prisma.supplierVariantOffer.updateMany({
          where: { supplierVariantId: p.supplierVariantId, supplierProduct: { supplierId } },
          data: {
            wholesaleCost: p.wholesaleCost,
            currency: p.currency,
            mapPrice: p.mapPrice ?? null,
            lastPriceSyncAt: new Date(),
          },
        }),
      ),
    );

    const status = safety.flaggedForReview.length > 0 ? 'completed_with_warnings' : 'completed';

    await prisma.supplierSyncJob.update({
      where: { id: job.id },
      data: {
        status,
        changeSummary: summary as unknown as object,
        finishedAt: new Date(),
        recordsReceived: incoming.length,
        recordsUpdated: summary.updatedCount,
        recordsCreated: summary.newCount,
      },
    });

    await prisma.supplier.update({
      where: { id: supplierId },
      data: { lastSuccessfulSyncAt: new Date() },
    });

    return { jobId: job.id, status, changeSummary: summary, abortReasons: [] };
  } catch (err) {
    await prisma.supplierSyncJob.update({
      where: { id: job.id },
      data: {
        status: 'failed',
        errorSummary: err instanceof Error ? err.message : String(err),
        finishedAt: new Date(),
      },
    });
    await prisma.supplier.update({
      where: { id: supplierId },
      data: { lastFailedSyncAt: new Date() },
    });
    return {
      jobId: job.id,
      status: 'failed',
      changeSummary: diffRecords([], []),
      abortReasons: [err instanceof Error ? err.message : String(err)],
    };
  }
}
