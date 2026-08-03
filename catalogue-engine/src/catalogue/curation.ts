// Catalogue curation workflow (architecture doc §"Catalogue Curation" — Phase 4 territory, but
// buildable and testable now with synthetic data, same as everything else in this package): "the
// system should distinguish between: Imported, Approved, Published, Hidden, Discontinued, Blocked,
// Needs review." The schema already has MasterProduct.status as this enum; nothing until now
// enforced which transitions between those states are actually valid, so a bug (or a careless
// admin action) could jump a product straight from `imported` to `published` with no review step
// at all. This module makes invalid transitions structurally impossible.

import type { PrismaClient, PublicationStatus } from '@prisma/client';

/**
 * Allowed next states per current state. Deliberately conservative:
 *  - `blocked` can only go back to `needs_review`, never straight to `published` — an unblocked
 *    product must be re-reviewed, not silently restored to its previous visibility.
 *  - `discontinued` is treated as terminal except for `blocked` (a discontinued product can still
 *    be blocked for a policy reason, but never un-discontinued back into the live catalogue by
 *    this workflow — that would need a deliberate re-import, not a status flip).
 */
export const PRODUCT_STATUS_TRANSITIONS: Record<PublicationStatus, PublicationStatus[]> = {
  imported: ['needs_review', 'approved', 'blocked'],
  needs_review: ['approved', 'blocked', 'imported'],
  approved: ['published', 'hidden', 'needs_review', 'blocked'],
  published: ['hidden', 'discontinued', 'blocked'],
  hidden: ['published', 'discontinued', 'blocked'],
  discontinued: ['blocked'],
  blocked: ['needs_review'],
};

export function isValidTransition(from: PublicationStatus, to: PublicationStatus): boolean {
  if (from === to) return false; // no-op transitions aren't "valid moves" — caller should just skip
  return PRODUCT_STATUS_TRANSITIONS[from].includes(to);
}

export interface TransitionResult {
  success: boolean;
  masterProductId: string;
  previousStatus: PublicationStatus;
  newStatus: PublicationStatus;
  reason?: string;
}

/**
 * Applies a status transition if (and only if) it's valid for the product's current state.
 * `isPublished` is kept in sync automatically — true only while status === 'published'. Never
 * throws on an invalid transition; returns `success: false` with a reason instead, so a caller
 * (e.g. an admin UI) can show a clear message rather than crash.
 */
export async function transitionProductStatus(
  prisma: PrismaClient,
  masterProductId: string,
  targetStatus: PublicationStatus,
): Promise<TransitionResult> {
  const product = await prisma.masterProduct.findUniqueOrThrow({
    where: { id: masterProductId },
    select: { status: true },
  });

  if (!isValidTransition(product.status, targetStatus)) {
    return {
      success: false,
      masterProductId,
      previousStatus: product.status,
      newStatus: product.status,
      reason: `cannot transition from '${product.status}' to '${targetStatus}' — allowed next states: ${PRODUCT_STATUS_TRANSITIONS[product.status].join(', ') || '(none, terminal)'}`,
    };
  }

  await prisma.masterProduct.update({
    where: { id: masterProductId },
    data: { status: targetStatus, isPublished: targetStatus === 'published' },
  });

  return {
    success: true,
    masterProductId,
    previousStatus: product.status,
    newStatus: targetStatus,
  };
}
