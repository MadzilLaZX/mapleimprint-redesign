import { describe, it, expect } from 'vitest';
import { buildSyncReport } from '../src/sync/report.js';
import { diffRecords, evaluateSafetyStop } from '../src/sync/change-detection.js';

const startedAt = new Date('2026-08-02T10:00:00Z');
const finishedAt = new Date('2026-08-02T10:00:03.500Z');

describe('buildSyncReport', () => {
  it('produces a clean report for a normal successful sync', () => {
    const existing = [
      { key: 'A', price: 10 },
      { key: 'B', price: 20 },
    ];
    const incoming = [
      { key: 'A', price: 11 }, // price increase, not large enough to flag
      { key: 'B', price: 20 },
      { key: 'C', price: 5 }, // new
    ];
    const summary = diffRecords(existing, incoming);
    const safety = evaluateSafetyStop(summary, existing.length);

    const report = buildSyncReport({
      supplierName: 'S&S Activewear',
      syncType: 'price_delta',
      status: 'completed',
      startedAt,
      finishedAt,
      summary,
      safety,
    });

    expect(report.needsAttention).toBe(false);
    expect(report.headline).toMatch(/S&S Activewear price_delta sync completed/);
    expect(report.headline).toMatch(/1 new, 1 updated, 0 missing/);
    expect(report.text).toMatch(/Price increases \(1\)/);
    expect(report.text).toMatch(/A: \$10\.00 -> \$11\.00/);
    expect(report.text).not.toMatch(/ABORTED/);
  });

  it('flags a report as needing attention when a safety stop aborts the sync', () => {
    const existing = Array.from({ length: 100 }, (_, i) => ({ key: `sku-${i}`, price: 10 }));
    const incoming = existing.slice(0, 50); // 50% missing -> should abort
    const summary = diffRecords(existing, incoming);
    const safety = evaluateSafetyStop(summary, existing.length);

    const report = buildSyncReport({
      supplierName: 'SanMar Canada',
      syncType: 'full_catalogue',
      status: 'aborted_safety_stop',
      startedAt,
      finishedAt,
      summary,
      safety,
    });

    expect(safety.shouldAbort).toBe(true);
    expect(report.needsAttention).toBe(true);
    expect(report.headline).toMatch(/ABORTED \(safety stop\)/);
    expect(report.text).toMatch(/⛔ SYNC ABORTED/);
    expect(report.text).toMatch(/missing from feed/);
  });

  it('flags a report as needing attention when a large price increase is flagged for review', () => {
    const existing = [{ key: 'A', price: 10 }];
    const incoming = [{ key: 'A', price: 40 }]; // 4x — flagged, doesn't abort
    const summary = diffRecords(existing, incoming);
    const safety = evaluateSafetyStop(summary, existing.length);

    const report = buildSyncReport({
      supplierName: 'Joto',
      syncType: 'price_delta',
      status: 'completed_with_warnings',
      startedAt,
      finishedAt,
      summary,
      safety,
    });

    expect(safety.shouldAbort).toBe(false);
    expect(report.needsAttention).toBe(true); // flagged, even though not aborted
    expect(report.text).toMatch(/🔍 Flagged for manual review/);
    expect(report.text).toMatch(/- A/);
  });

  it('marks a failed job as needing attention even with an otherwise empty diff', () => {
    const summary = diffRecords([], []);
    const safety = evaluateSafetyStop(summary, 0);

    const report = buildSyncReport({
      supplierName: 'SanMar Canada',
      syncType: 'inventory',
      status: 'failed',
      startedAt,
      finishedAt,
      summary,
      safety,
    });

    expect(report.needsAttention).toBe(true);
  });

  it('reports duration correctly and handles a still-running job', () => {
    const summary = diffRecords([], []);
    const safety = evaluateSafetyStop(summary, 0);

    const finished = buildSyncReport({
      supplierName: 'S&S Activewear',
      syncType: 'price_delta',
      status: 'completed',
      startedAt,
      finishedAt,
      summary,
      safety,
    });
    expect(finished.text).toMatch(/Duration: 3\.5s/);

    const running = buildSyncReport({
      supplierName: 'S&S Activewear',
      syncType: 'price_delta',
      status: 'running',
      startedAt,
      finishedAt: null,
      summary,
      safety,
    });
    expect(running.text).toMatch(/Duration: still running/);
  });
});
