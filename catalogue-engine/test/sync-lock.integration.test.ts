// Integration test for the sync-overlap lock (architecture doc §10: "Sync job overlap... a
// classic source of a corrupted staging table"). Proves both layers work: the fast isSyncLocked()
// pre-check, AND the database-level partial unique index that's the real enforcement (see the
// comment above SupplierSyncJob in schema.prisma and above the try/catch in orchestrator.ts).
// Self-skips when DATABASE_URL isn't set, same pattern as the other integration tests.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MockConnector } from '../src/integrations/suppliers/mock/MockConnector.js';
import { runPriceSync, isSyncLocked } from '../src/sync/orchestrator.js';

const hasDb = !!process.env.DATABASE_URL;
const describeIfDb = hasDb ? describe : describe.skip;

describeIfDb('sync job overlap lock — against a real database', () => {
  let prisma: import('@prisma/client').PrismaClient;
  let supplierId: string;
  let runningJobId: string | null = null;

  beforeAll(async () => {
    const { PrismaClient } = await import('@prisma/client');
    prisma = new PrismaClient();

    const supplier = await prisma.supplier.upsert({
      where: { code: 'integration_test_lock_supplier' },
      update: {},
      create: { name: 'IT Lock Test Supplier', code: 'integration_test_lock_supplier' },
    });
    supplierId = supplier.id;
  });

  afterAll(async () => {
    if (runningJobId) {
      await prisma.supplierSyncJob.deleteMany({ where: { id: runningJobId } });
    }
    await prisma.supplierSyncJob.deleteMany({ where: { supplierId } });
    if (supplierId) await prisma.supplier.deleteMany({ where: { id: supplierId } });
    await prisma.$disconnect();
  });

  it('isSyncLocked reports false when no job is running for this supplier', async () => {
    expect(await isSyncLocked(prisma, supplierId)).toBe(false);
  });

  it('runPriceSync refuses to start (skipped_locked) when a job is already running, and creates no new job row', async () => {
    const runningJob = await prisma.supplierSyncJob.create({
      data: { supplierId, syncType: 'full_catalogue', status: 'running' },
    });
    runningJobId = runningJob.id;

    expect(await isSyncLocked(prisma, supplierId)).toBe(true);

    const jobCountBefore = await prisma.supplierSyncJob.count({ where: { supplierId } });

    const connector = new MockConnector({ products: [] });
    await connector.authenticate();

    const result = await runPriceSync({ prisma, connector, supplierId });

    expect(result.status).toBe('skipped_locked');
    expect(result.jobId).toBeNull();

    const jobCountAfter = await prisma.supplierSyncJob.count({ where: { supplierId } });
    expect(jobCountAfter).toBe(jobCountBefore); // no new job row was created

    // Clean up this test's own fixture so the next test starts unlocked.
    await prisma.supplierSyncJob.deleteMany({ where: { id: runningJobId } });
    runningJobId = null;
  });

  it('the database itself rejects a second concurrent "running" row for the same supplier', async () => {
    const first = await prisma.supplierSyncJob.create({
      data: { supplierId, syncType: 'inventory', status: 'running' },
    });
    runningJobId = first.id;

    await expect(
      prisma.supplierSyncJob.create({
        data: { supplierId, syncType: 'price_delta', status: 'running' },
      }),
    ).rejects.toThrow();

    await prisma.supplierSyncJob.deleteMany({ where: { id: runningJobId } });
    runningJobId = null;
  });

  it('runPriceSync proceeds normally once the running job is no longer "running"', async () => {
    expect(await isSyncLocked(prisma, supplierId)).toBe(false);

    const connector = new MockConnector({ products: [] });
    await connector.authenticate();

    const result = await runPriceSync({ prisma, connector, supplierId });
    expect(result.status).not.toBe('skipped_locked');

    // This run's own job is now 'completed', not 'running' — clean it up too.
    if (result.jobId) {
      await prisma.supplierSyncJob.deleteMany({ where: { id: result.jobId } });
    }
  });
});

if (!hasDb) {
  describe('sync-lock.integration.test.ts', () => {
    it.skip('skipped: DATABASE_URL not set — see README "Live staging database"', () => {});
  });
}
