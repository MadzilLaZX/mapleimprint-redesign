// Thin persistence layer around matcher.ts's pure scoring. Auto-approved matches still get a
// MatchCandidate row (audit trail of every match decision, not just the uncertain ones) —
// see architecture doc: "Create an administrative review queue for uncertain matches."

import type { PrismaClient } from '@prisma/client';
import type { MatchResult } from './matcher.js';

export async function recordMatchResult(
  prisma: PrismaClient,
  supplierProductId: string,
  result: MatchResult,
): Promise<void> {
  await prisma.matchCandidate.create({
    data: {
      supplierProductId,
      candidateMasterProductId: result.masterProductId,
      confidence: result.confidence,
      matchSignals: result.signals as unknown as object,
      status: result.status === 'auto_approved' ? 'confirmed' : 'needs_review',
    },
  });

  if (result.status === 'auto_approved') {
    await prisma.supplierProduct.update({
      where: { id: supplierProductId },
      data: {
        masterProductId: result.masterProductId,
        matchStatus: 'auto_matched',
        matchConfidence: result.confidence,
      },
    });
  } else {
    await prisma.supplierProduct.update({
      where: { id: supplierProductId },
      data: { matchStatus: 'needs_review', matchConfidence: result.confidence },
    });
  }
}

export async function approveMatch(
  prisma: PrismaClient,
  matchCandidateId: string,
  reviewedBy: string,
): Promise<void> {
  const candidate = await prisma.matchCandidate.update({
    where: { id: matchCandidateId },
    data: { status: 'confirmed', reviewedBy, reviewedAt: new Date() },
  });

  await prisma.supplierProduct.update({
    where: { id: candidate.supplierProductId },
    data: { masterProductId: candidate.candidateMasterProductId, matchStatus: 'confirmed' },
  });
}

export async function rejectMatch(
  prisma: PrismaClient,
  matchCandidateId: string,
  reviewedBy: string,
): Promise<void> {
  const candidate = await prisma.matchCandidate.update({
    where: { id: matchCandidateId },
    data: { status: 'rejected', reviewedBy, reviewedAt: new Date() },
  });

  await prisma.supplierProduct.update({
    where: { id: candidate.supplierProductId },
    data: { matchStatus: 'rejected' },
  });
}
