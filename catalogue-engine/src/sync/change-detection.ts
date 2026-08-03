// Pure diff + safety-stop logic. No DB/Prisma dependency, so it can be tested in isolation and
// reused identically whether it's diffing full-catalogue, price-delta, or inventory syncs.

export interface ExistingRecord {
  key: string; // e.g. supplierSku
  price?: number;
  inventoryQty?: number;
}

export interface IncomingRecord {
  key: string;
  price?: number;
  inventoryQty?: number;
}

export interface ChangeSummary {
  newCount: number;
  updatedCount: number;
  missingCount: number; // present before, absent now
  priceIncreases: { key: string; from: number; to: number; ratio: number }[];
  priceDrops: { key: string; from: number; to: number }[];
  zeroedPrices: { key: string; from: number }[];
  zeroedInventory: { key: string; from: number }[];
  newKeys: string[];
  missingKeys: string[];
}

export interface SafetyStopThresholds {
  /** Abort if more than this fraction of previously-known records are missing from the new feed. */
  maxMissingFraction: number;
  /** Abort if more than this fraction of prices become zero/null. */
  maxZeroedPriceFraction: number;
  /** Abort if more than this fraction of inventory records suddenly read zero. */
  maxZeroedInventoryFraction: number;
  /** Flag (not abort) any single price increase at or above this multiple of the previous price. */
  priceIncreaseReviewMultiple: number;
}

export const DEFAULT_SAFETY_THRESHOLDS: SafetyStopThresholds = {
  maxMissingFraction: 0.3,
  maxZeroedPriceFraction: 0.2,
  maxZeroedInventoryFraction: 0.5,
  priceIncreaseReviewMultiple: 3,
};

export function diffRecords(
  existing: ExistingRecord[],
  incoming: IncomingRecord[],
): ChangeSummary {
  const existingByKey = new Map(existing.map((r) => [r.key, r]));
  const incomingByKey = new Map(incoming.map((r) => [r.key, r]));

  const newKeys: string[] = [];
  const missingKeys: string[] = [];
  const priceIncreases: ChangeSummary['priceIncreases'] = [];
  const priceDrops: ChangeSummary['priceDrops'] = [];
  const zeroedPrices: ChangeSummary['zeroedPrices'] = [];
  const zeroedInventory: ChangeSummary['zeroedInventory'] = [];
  let updatedCount = 0;

  for (const [key, inc] of incomingByKey) {
    const prev = existingByKey.get(key);
    if (!prev) {
      newKeys.push(key);
      continue;
    }

    let changed = false;

    if (prev.price !== undefined && inc.price !== undefined && prev.price !== inc.price) {
      changed = true;
      if (inc.price === 0 && prev.price > 0) {
        zeroedPrices.push({ key, from: prev.price });
      } else if (inc.price > prev.price) {
        priceIncreases.push({ key, from: prev.price, to: inc.price, ratio: inc.price / prev.price });
      } else {
        priceDrops.push({ key, from: prev.price, to: inc.price });
      }
    }

    if (
      prev.inventoryQty !== undefined &&
      inc.inventoryQty !== undefined &&
      prev.inventoryQty !== inc.inventoryQty
    ) {
      changed = true;
      if (inc.inventoryQty === 0 && prev.inventoryQty > 0) {
        zeroedInventory.push({ key, from: prev.inventoryQty });
      }
    }

    if (changed) updatedCount++;
  }

  for (const key of existingByKey.keys()) {
    if (!incomingByKey.has(key)) missingKeys.push(key);
  }

  return {
    newCount: newKeys.length,
    updatedCount,
    missingCount: missingKeys.length,
    priceIncreases,
    priceDrops,
    zeroedPrices,
    zeroedInventory,
    newKeys,
    missingKeys,
  };
}

export interface SafetyStopResult {
  shouldAbort: boolean;
  reasons: string[];
  flaggedForReview: string[]; // keys needing manual review even if the sync as a whole proceeds
}

/**
 * Decides whether a sync's changes are safe to commit. This runs against the diff produced by
 * diffRecords() and is deliberately conservative: it is much cheaper to require a manual refresh
 * than to silently publish a broken feed (see architecture doc §6).
 */
export function evaluateSafetyStop(
  summary: ChangeSummary,
  existingCount: number,
  thresholds: SafetyStopThresholds = DEFAULT_SAFETY_THRESHOLDS,
): SafetyStopResult {
  const reasons: string[] = [];

  if (existingCount > 0) {
    const missingFraction = summary.missingCount / existingCount;
    if (missingFraction > thresholds.maxMissingFraction) {
      reasons.push(
        `${(missingFraction * 100).toFixed(1)}% of existing records missing from feed ` +
          `(threshold ${(thresholds.maxMissingFraction * 100).toFixed(0)}%)`,
      );
    }

    const zeroedPriceFraction = summary.zeroedPrices.length / existingCount;
    if (zeroedPriceFraction > thresholds.maxZeroedPriceFraction) {
      reasons.push(
        `${(zeroedPriceFraction * 100).toFixed(1)}% of prices zeroed out ` +
          `(threshold ${(thresholds.maxZeroedPriceFraction * 100).toFixed(0)}%)`,
      );
    }

    const zeroedInventoryFraction = summary.zeroedInventory.length / existingCount;
    if (zeroedInventoryFraction > thresholds.maxZeroedInventoryFraction) {
      reasons.push(
        `${(zeroedInventoryFraction * 100).toFixed(1)}% of inventory records zeroed ` +
          `(threshold ${(thresholds.maxZeroedInventoryFraction * 100).toFixed(0)}%)`,
      );
    }
  }

  const flaggedForReview = summary.priceIncreases
    .filter((p) => p.ratio >= thresholds.priceIncreaseReviewMultiple)
    .map((p) => p.key);

  return {
    shouldAbort: reasons.length > 0,
    reasons,
    flaggedForReview,
  };
}
