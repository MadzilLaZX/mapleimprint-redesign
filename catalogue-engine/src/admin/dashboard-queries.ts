// Read-only query layer for the admin dashboard described in the architecture doc
// ("Supplier Overview", "Catalogue Review", "Inventory Risks", "Pricing Risks", "Sync Activity").
// Deliberately just data — no UI framework assumed, since Gate A (which platform serves the
// storefront) hasn't been decided and shouldn't gate whether staff can see sync/pricing health.
// Every function takes a PrismaClient so callers control connection lifecycle/transactions.

import type { PrismaClient } from '@prisma/client';

export interface SupplierOverviewRow {
  id: string;
  name: string;
  code: string;
  integrationStatus: string;
  isActive: boolean;
  lastSuccessfulSyncAt: Date | null;
  lastFailedSyncAt: Date | null;
  importedProductCount: number;
  recentFailedSyncCount: number; // failed/aborted jobs in the last 7 days
  credentialStatus: 'configured' | 'missing';
}

export async function getSupplierOverview(prisma: PrismaClient): Promise<SupplierOverviewRow[]> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const suppliers = await prisma.supplier.findMany({ orderBy: { name: 'asc' } });

  return Promise.all(
    suppliers.map(async (supplier) => {
      const [importedProductCount, recentFailedSyncCount] = await Promise.all([
        prisma.supplierProduct.count({ where: { supplierId: supplier.id } }),
        prisma.supplierSyncJob.count({
          where: {
            supplierId: supplier.id,
            status: { in: ['failed', 'aborted_safety_stop'] },
            startedAt: { gte: sevenDaysAgo },
          },
        }),
      ]);

      return {
        id: supplier.id,
        name: supplier.name,
        code: supplier.code,
        integrationStatus: supplier.integrationStatus,
        isActive: supplier.isActive,
        lastSuccessfulSyncAt: supplier.lastSuccessfulSyncAt,
        lastFailedSyncAt: supplier.lastFailedSyncAt,
        importedProductCount,
        recentFailedSyncCount,
        credentialStatus: supplier.credentialsRef ? 'configured' : 'missing',
      };
    }),
  );
}

export type CatalogueReviewCounts = Record<
  'imported' | 'needs_review' | 'approved' | 'published' | 'hidden' | 'discontinued' | 'blocked',
  number
>;

/** Also reports how many SupplierProducts are stuck unmatched — a leading indicator of dedup backlog. */
export async function getCatalogueReviewCounts(
  prisma: PrismaClient,
): Promise<{ byStatus: CatalogueReviewCounts; unmatchedSupplierProducts: number; pendingMatchCandidates: number }> {
  const statuses = [
    'imported',
    'needs_review',
    'approved',
    'published',
    'hidden',
    'discontinued',
    'blocked',
  ] as const;

  const counts = await Promise.all(
    statuses.map((status) => prisma.masterProduct.count({ where: { status } })),
  );

  const byStatus = Object.fromEntries(
    statuses.map((status, i) => [status, counts[i]]),
  ) as CatalogueReviewCounts;

  const [unmatchedSupplierProducts, pendingMatchCandidates] = await Promise.all([
    prisma.supplierProduct.count({ where: { matchStatus: 'unmatched' } }),
    prisma.matchCandidate.count({ where: { status: 'needs_review' } }),
  ]);

  return { byStatus, unmatchedSupplierProducts, pendingMatchCandidates };
}

export interface SyncActivitySummary {
  runningJobs: { id: string; supplierId: string; syncType: string; startedAt: Date }[];
  recentFailedJobs: {
    id: string;
    supplierId: string;
    syncType: string;
    status: string;
    errorSummary: string | null;
    startedAt: Date;
  }[];
  recentCompletedJobs: {
    id: string;
    supplierId: string;
    syncType: string;
    status: string;
    recordsUpdated: number;
    finishedAt: Date | null;
  }[];
}

export async function getSyncActivity(
  prisma: PrismaClient,
  opts: { limit?: number } = {},
): Promise<SyncActivitySummary> {
  const limit = opts.limit ?? 20;

  const [runningJobs, recentFailedJobs, recentCompletedJobs] = await Promise.all([
    prisma.supplierSyncJob.findMany({
      where: { status: 'running' },
      orderBy: { startedAt: 'desc' },
      select: { id: true, supplierId: true, syncType: true, startedAt: true },
    }),
    prisma.supplierSyncJob.findMany({
      where: { status: { in: ['failed', 'aborted_safety_stop'] } },
      orderBy: { startedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        supplierId: true,
        syncType: true,
        status: true,
        errorSummary: true,
        startedAt: true,
      },
    }),
    prisma.supplierSyncJob.findMany({
      where: { status: { in: ['completed', 'completed_with_warnings'] } },
      orderBy: { startedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        supplierId: true,
        syncType: true,
        status: true,
        recordsUpdated: true,
        finishedAt: true,
      },
    }),
  ]);

  return { runningJobs, recentFailedJobs, recentCompletedJobs };
}

export interface PricingRisks {
  /** wholesaleCost of 0 is never legitimate — always a data problem, never a real free product. */
  zeroCostOffers: { id: string; supplierProductId: string; supplierSku: string }[];
  /** isActive: true but effectiveUntil has already passed — a rule nobody remembered to renew or retire. */
  expiredButActiveRules: { id: string; name: string; effectiveUntil: Date | null }[];
}

export async function getPricingRisks(prisma: PrismaClient): Promise<PricingRisks> {
  const now = new Date();

  const [zeroCostOffers, expiredButActiveRules] = await Promise.all([
    prisma.supplierVariantOffer.findMany({
      where: { wholesaleCost: 0 },
      select: { id: true, supplierProductId: true, supplierSku: true },
    }),
    prisma.pricingRule.findMany({
      where: { isActive: true, effectiveUntil: { lt: now } },
      select: { id: true, name: true, effectiveUntil: true },
    }),
  ]);

  return { zeroCostOffers, expiredButActiveRules };
}

export interface InventoryRisks {
  outOfStock: { id: string; supplierVariantOfferId: string; warehouseCode: string }[];
  /** availableQty > 0 but lastSyncedAt older than staleAfterMinutes — don't trust it at checkout. */
  staleInventory: { id: string; supplierVariantOfferId: string; lastSyncedAt: Date }[];
}

export async function getInventoryRisks(
  prisma: PrismaClient,
  staleAfterMinutes = 60,
): Promise<InventoryRisks> {
  const staleCutoff = new Date(Date.now() - staleAfterMinutes * 60 * 1000);

  const [outOfStock, staleInventory] = await Promise.all([
    prisma.supplierWarehouseInventory.findMany({
      where: { availableQty: 0 },
      select: { id: true, supplierVariantOfferId: true, warehouseCode: true },
    }),
    prisma.supplierWarehouseInventory.findMany({
      where: { availableQty: { gt: 0 }, lastSyncedAt: { lt: staleCutoff } },
      select: { id: true, supplierVariantOfferId: true, lastSyncedAt: true },
    }),
  ]);

  return { outOfStock, staleInventory };
}
