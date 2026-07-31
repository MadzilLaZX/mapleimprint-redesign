import type { NormalizedInquiry } from "./types";

const RUSH_WINDOW_DAYS = 7;
const DECORATION_KEYWORDS = ["embroider", "dtf", "dtg", "screen print", "sublimat", "vinyl", "laser engrav"];
const BULK_PROJECT_TYPES = new Set(["uniforms", "mixed"]);

function daysUntil(dateStr: string | undefined): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  if (Number.isNaN(target.getTime())) return null;
  const diffMs = target.getTime() - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/** Detects quantity signals like "500+", "500", "1000 units" in free text. */
function parsesAsLargeQuantity(quantity: string | undefined): boolean {
  if (!quantity) return false;
  const match = quantity.replace(/,/g, "").match(/(\d{3,})/);
  if (!match) return false;
  return Number(match[1]) >= 250;
}

/** Detects budget signals like "$2500+", "$2,500 - $5000" in free text. */
function parsesAsHighBudget(budgetRange: string | undefined): boolean {
  if (!budgetRange) return false;
  const numbers = [...budgetRange.replace(/,/g, "").matchAll(/(\d{3,})/g)].map((m) => Number(m[1]));
  if (numbers.length === 0) return false;
  return Math.max(...numbers) >= 2500;
}

/**
 * Scores and tags a normalized inquiry. Base weights follow the original
 * spec (general question ~10, quote ~40, bulk/large-quantity/high-budget/
 * rush bumps), adapted to the fields the live forms actually collect —
 * quantity/budget are free text here rather than the spec's dropdown tiers,
 * so they're parsed with lightweight heuristics instead of exact lookups.
 */
export function scoreInquiry(inquiry: NormalizedInquiry): { score: number; tags: string[] } {
  const tags = new Set<string>();
  let score: number;

  switch (inquiry.source) {
    case "contact":
      score = 10;
      tags.add("general-inquiry");
      break;
    case "appointment":
      score = 30;
      tags.add("appointment");
      break;
    case "quote":
    default:
      score = 40;
      tags.add("quote");
      break;
  }

  if (inquiry.organization?.trim()) {
    score += 10;
    tags.add("b2b");
  }

  if (inquiry.projectType && BULK_PROJECT_TYPES.has(inquiry.projectType)) {
    score += 10;
    tags.add("bulk-order");
  }

  if (parsesAsLargeQuantity(inquiry.quantity)) {
    score += 15;
    tags.add("large-order");
  }

  if (parsesAsHighBudget(inquiry.budgetRange)) {
    score += 10;
    tags.add("high-budget");
  }

  const daysToDeadline = daysUntil(inquiry.neededBy);
  if (daysToDeadline !== null && daysToDeadline >= 0 && daysToDeadline <= RUSH_WINDOW_DAYS) {
    score += 15;
    tags.add("urgent");
  }

  if (inquiry.designHelp) {
    score += 5;
    tags.add("design-required");
  }

  const decoration = inquiry.decorationMethod?.toLowerCase() ?? "";
  for (const keyword of DECORATION_KEYWORDS) {
    if (decoration.includes(keyword)) {
      tags.add(keyword.replace(/\s+/g, "-"));
      break;
    }
  }

  if (inquiry.fileNames && inquiry.fileNames.length > 0) {
    tags.add("has-artwork");
  }

  return { score: Math.min(score, 100), tags: [...tags] };
}
