import type { QuoteCartHandoff } from "@/components/cart/CartProvider";
import type { ProjectType } from "@/components/contact/quoteProjectType";

export type DeliveryMethod = "pickup" | "shipping";
export type ContactMethod = "email" | "phone";

export type UploadedFile = { fileId: string; fileName: string; webViewLink: string | null; assetId?: string };

export type QuoteData = {
  projectType: ProjectType | null;
  productDescription: string;
  quantity: string;
  sizesVariants: string;
  budgetRange: string;
  decorationMethod: string;
  placements: string;
  personalization: boolean;
  designHelp: boolean;
  fileNotes: string;
  fileNames: string[];
  uploadedFiles: UploadedFile[];
  neededBy: string;
  eventDate: string;
  deliveryMethod: DeliveryMethod | null;
  postalCode: string;
  name: string;
  organization: string;
  email: string;
  phone: string;
  preferredContact: ContactMethod | null;
  consent: boolean;
};

export const initialQuoteData: QuoteData = {
  projectType: null,
  productDescription: "",
  quantity: "",
  sizesVariants: "",
  budgetRange: "",
  decorationMethod: "",
  placements: "",
  personalization: false,
  designHelp: false,
  fileNotes: "",
  fileNames: [],
  uploadedFiles: [],
  neededBy: "",
  eventDate: "",
  deliveryMethod: null,
  postalCode: "",
  name: "",
  organization: "",
  email: "",
  phone: "",
  preferredContact: null,
  consent: false,
};

const QUOTE_DRAFT_KEY = "mi-quote-draft";
// Bump whenever QuoteData's shape changes -- an old draft written under a previous version is
// discarded outright rather than partially merged into a shape it was never written for (a stale
// draft missing a newly-required field is worse than no draft at all).
const QUOTE_DRAFT_VERSION = 1;
// A week-old draft describes a project whose details (budget, deadline, decoration method) have
// likely moved on -- past this, treat it as nothing worth resuming rather than resurrecting
// probably-stale information.
const QUOTE_DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface QuoteDraft {
  step: number;
  data: QuoteData;
  cartLines: QuoteCartHandoff[];
  idempotencyKey: string;
}

interface StoredQuoteDraft extends QuoteDraft {
  version: number;
  savedAt: number;
}

/** Only a draft with real customer-entered content is worth offering to resume -- an empty wizard
 *  someone opened and immediately left isn't a "draft" worth a resume prompt on their next visit. */
function hasRealContent(data: QuoteData): boolean {
  return Boolean(data.projectType || data.productDescription.trim() || data.name.trim() || data.email.trim());
}

/** Best-effort read, matching this codebase's established try/catch-around-storage convention
 *  (see saveUpload.ts's Drive mirroring) -- sessionStorage can throw in private-browsing modes,
 *  and a malformed/outdated/too-old value must fail open to "no draft" rather than throw or
 *  resurrect something half-valid. */
export function loadQuoteDraft(): QuoteDraft | null {
  try {
    const raw = window.sessionStorage.getItem(QUOTE_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredQuoteDraft;
    if (parsed.version !== QUOTE_DRAFT_VERSION) return null;
    if (typeof parsed.savedAt !== "number" || Date.now() - parsed.savedAt > QUOTE_DRAFT_MAX_AGE_MS) return null;
    if (!parsed.data || !hasRealContent(parsed.data)) return null;
    return { step: parsed.step, data: parsed.data, cartLines: parsed.cartLines ?? [], idempotencyKey: parsed.idempotencyKey };
  } catch {
    return null;
  }
}

export function saveQuoteDraft(draft: QuoteDraft): void {
  try {
    if (!hasRealContent(draft.data)) return;
    const stored: StoredQuoteDraft = { ...draft, version: QUOTE_DRAFT_VERSION, savedAt: Date.now() };
    window.sessionStorage.setItem(QUOTE_DRAFT_KEY, JSON.stringify(stored));
  } catch {
    // Best-effort -- losing draft recovery is never worse than the quote flow itself erroring.
  }
}

export function clearQuoteDraft(): void {
  try {
    window.sessionStorage.removeItem(QUOTE_DRAFT_KEY);
  } catch {
    // Same best-effort rationale as saveQuoteDraft.
  }
}
