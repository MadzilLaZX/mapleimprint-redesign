// Confidence-based product matching (architecture doc §"Product Deduplication").
// Never auto-merge below MERGE_THRESHOLD — incorrectly merging two distinct products is worse
// than temporarily showing duplicates. Matches below that go to the MatchCandidate review queue.

export interface MatchableSupplierProduct {
  brandName: string;
  styleCode: string;
  productName: string;
  upc?: string;
  material?: string;
  colours: string[];
  sizes: string[];
}

export interface MatchableMasterProduct {
  id: string;
  brandName: string;
  styleCode?: string; // manufacturer style number, if recorded on the master product
  name: string;
  upc?: string;
  material?: string;
  colours: string[];
  sizes: string[];
}

export interface MatchSignals {
  brandMatch: boolean;
  styleNumberMatch: boolean;
  upcMatch: boolean;
  nameSimilarity: number; // 0-1
  materialMatch: boolean;
  colourOverlap: number; // 0-1, fraction of supplier colours present on the master product
  sizeOverlap: number; // 0-1
}

export interface MatchResult {
  masterProductId: string;
  confidence: number;
  signals: MatchSignals;
  /** auto_approved only when confidence >= AUTO_APPROVE_THRESHOLD; otherwise needs_review. */
  status: 'auto_approved' | 'needs_review' | 'rejected';
}

export const AUTO_APPROVE_THRESHOLD = 0.95;
export const REVIEW_THRESHOLD = 0.55; // below this, don't even queue for review — too weak a signal

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Token-overlap similarity (Jaccard on words) — simple, explainable, no external NLP dependency. */
export function nameSimilarity(a: string, b: string): number {
  const tokensA = new Set(normalize(a).split(' ').filter(Boolean));
  const tokensB = new Set(normalize(b).split(' ').filter(Boolean));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let intersection = 0;
  for (const t of tokensA) if (tokensB.has(t)) intersection++;
  const union = tokensA.size + tokensB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function overlapFraction(a: string[], b: string[]): number {
  if (a.length === 0) return 0;
  const setB = new Set(b.map(normalize));
  const hits = a.filter((x) => setB.has(normalize(x))).length;
  return hits / a.length;
}

export function computeMatchSignals(
  supplierProduct: MatchableSupplierProduct,
  candidate: MatchableMasterProduct,
): MatchSignals {
  return {
    brandMatch: normalize(supplierProduct.brandName) === normalize(candidate.brandName),
    styleNumberMatch:
      !!supplierProduct.styleCode &&
      !!candidate.styleCode &&
      normalize(supplierProduct.styleCode) === normalize(candidate.styleCode),
    upcMatch: !!supplierProduct.upc && !!candidate.upc && supplierProduct.upc === candidate.upc,
    nameSimilarity: nameSimilarity(supplierProduct.productName, candidate.name),
    materialMatch:
      !!supplierProduct.material &&
      !!candidate.material &&
      normalize(supplierProduct.material) === normalize(candidate.material),
    colourOverlap: overlapFraction(supplierProduct.colours, candidate.colours),
    sizeOverlap: overlapFraction(supplierProduct.sizes, candidate.sizes),
  };
}

/**
 * Confidence scoring per architecture doc's matching hierarchy:
 *   exact brand+style            -> high confidence, auto-approvable
 *   brand+UPC                    -> high confidence, auto-approvable
 *   brand + strong data overlap  -> review queue
 *   weak name similarity only    -> never merge
 */
export function scoreMatch(signals: MatchSignals): number {
  if (signals.brandMatch && signals.styleNumberMatch) return 1.0;
  if (signals.brandMatch && signals.upcMatch) return 0.98;

  if (!signals.brandMatch) {
    // Without a brand match, cap confidence hard — name similarity alone is never enough.
    return Math.min(0.4, signals.nameSimilarity * 0.4);
  }

  // Brand matches but no hard identifier: weighted blend of soft signals, capped below auto-approve.
  const soft =
    signals.nameSimilarity * 0.35 +
    signals.colourOverlap * 0.2 +
    signals.sizeOverlap * 0.15 +
    (signals.materialMatch ? 0.2 : 0) +
    0.1; // brand match itself contributes a base amount
  return Math.min(0.85, soft);
}

export function matchProduct(
  supplierProduct: MatchableSupplierProduct,
  candidates: MatchableMasterProduct[],
): MatchResult | null {
  let best: MatchResult | null = null;

  for (const candidate of candidates) {
    const signals = computeMatchSignals(supplierProduct, candidate);
    const confidence = scoreMatch(signals);
    if (confidence < REVIEW_THRESHOLD) continue;

    const status: MatchResult['status'] =
      confidence >= AUTO_APPROVE_THRESHOLD ? 'auto_approved' : 'needs_review';

    if (!best || confidence > best.confidence) {
      best = { masterProductId: candidate.id, confidence, signals, status };
    }
  }

  return best;
}
