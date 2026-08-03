// Human-readable sync report, per architecture doc §"Import Safety and Change Detection":
// "For every sync, produce a report showing: New products, Updated products, Discontinued
// products, Price increases, Price decreases, ... Products requiring manual review."
// Pure formatting over the types change-detection.ts already produces — no DB/IO dependency,
// so it's independently testable and reusable by the admin dashboard, a CLI, or a notification
// (email/Slack) once one of those exists.

import type { ChangeSummary, SafetyStopResult } from './change-detection.js';

export interface SyncReportInput {
  supplierName: string;
  syncType: string;
  status: string;
  startedAt: Date;
  finishedAt: Date | null;
  summary: ChangeSummary;
  safety: SafetyStopResult;
}

export interface SyncReport {
  /** One-line summary suitable for a notification title or dashboard row. */
  headline: string;
  /** Full multi-section plain-text report suitable for a log, email body, or admin detail view. */
  text: string;
  /** True if this report represents a run that needs a human to look at it before trusting the data. */
  needsAttention: boolean;
}

function formatDuration(startedAt: Date, finishedAt: Date | null): string {
  if (!finishedAt) return 'still running';
  const ms = finishedAt.getTime() - startedAt.getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function buildSyncReport(input: SyncReportInput): SyncReport {
  const { supplierName, syncType, status, startedAt, finishedAt, summary, safety } = input;
  const lines: string[] = [];

  const needsAttention = safety.shouldAbort || safety.flaggedForReview.length > 0 || status === 'failed';

  lines.push(`Sync report: ${supplierName} (${syncType})`);
  lines.push(`Status: ${status}${needsAttention ? ' — NEEDS ATTENTION' : ''}`);
  lines.push(`Started: ${startedAt.toISOString()}`);
  lines.push(`Duration: ${formatDuration(startedAt, finishedAt)}`);
  lines.push('');

  if (safety.shouldAbort) {
    lines.push('⛔ SYNC ABORTED — safety stop triggered, no changes were committed:');
    for (const reason of safety.reasons) lines.push(`  - ${reason}`);
    lines.push('');
  }

  lines.push('Changes:');
  lines.push(`  New: ${summary.newCount}`);
  lines.push(`  Updated: ${summary.updatedCount}`);
  lines.push(`  Missing from feed: ${summary.missingCount}`);
  lines.push('');

  if (summary.priceIncreases.length > 0) {
    lines.push(`Price increases (${summary.priceIncreases.length}):`);
    for (const p of summary.priceIncreases.slice(0, 10)) {
      lines.push(`  - ${p.key}: $${p.from.toFixed(2)} -> $${p.to.toFixed(2)} (${p.ratio.toFixed(2)}x)`);
    }
    if (summary.priceIncreases.length > 10) lines.push(`  ... and ${summary.priceIncreases.length - 10} more`);
    lines.push('');
  }

  if (summary.priceDrops.length > 0) {
    lines.push(`Price drops (${summary.priceDrops.length}):`);
    for (const p of summary.priceDrops.slice(0, 10)) {
      lines.push(`  - ${p.key}: $${p.from.toFixed(2)} -> $${p.to.toFixed(2)}`);
    }
    if (summary.priceDrops.length > 10) lines.push(`  ... and ${summary.priceDrops.length - 10} more`);
    lines.push('');
  }

  if (summary.zeroedPrices.length > 0) {
    lines.push(`⚠️ Prices zeroed out (${summary.zeroedPrices.length}) — verify before trusting:`);
    for (const p of summary.zeroedPrices.slice(0, 10)) lines.push(`  - ${p.key}: was $${p.from.toFixed(2)}`);
    if (summary.zeroedPrices.length > 10) lines.push(`  ... and ${summary.zeroedPrices.length - 10} more`);
    lines.push('');
  }

  if (summary.zeroedInventory.length > 0) {
    lines.push(`⚠️ Inventory zeroed out (${summary.zeroedInventory.length}):`);
    for (const i of summary.zeroedInventory.slice(0, 10)) lines.push(`  - ${i.key}: was ${i.from}`);
    if (summary.zeroedInventory.length > 10) lines.push(`  ... and ${summary.zeroedInventory.length - 10} more`);
    lines.push('');
  }

  if (safety.flaggedForReview.length > 0) {
    lines.push(`🔍 Flagged for manual review (large price jump, ${safety.flaggedForReview.length}):`);
    for (const key of safety.flaggedForReview.slice(0, 10)) lines.push(`  - ${key}`);
    if (safety.flaggedForReview.length > 10) lines.push(`  ... and ${safety.flaggedForReview.length - 10} more`);
    lines.push('');
  }

  if (summary.missingKeys.length > 0) {
    lines.push(`Missing from feed (${summary.missingKeys.length}, possibly discontinued):`);
    for (const key of summary.missingKeys.slice(0, 10)) lines.push(`  - ${key}`);
    if (summary.missingKeys.length > 10) lines.push(`  ... and ${summary.missingKeys.length - 10} more`);
    lines.push('');
  }

  const headline = safety.shouldAbort
    ? `${supplierName} ${syncType} sync ABORTED (safety stop): ${safety.reasons[0] ?? 'unknown reason'}`
    : `${supplierName} ${syncType} sync ${status}: ${summary.newCount} new, ${summary.updatedCount} updated, ${summary.missingCount} missing`;

  return { headline, text: lines.join('\n').trimEnd(), needsAttention };
}
