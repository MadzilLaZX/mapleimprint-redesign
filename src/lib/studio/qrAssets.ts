// QR ASSET vs QR PLACEMENT (brief "CORE UX DECISION"): a generated QR is reusable content, not a
// one-off object tied to whichever print area happened to be active when it was created. A QrAsset
// is the reusable source — destination, style, and its rendered SVG — that "Recent QR Codes" and
// "My Stuff > QR Codes" list and reuse; a DesignObjectRecord of type "qr" is one PLACEMENT of an
// asset onto a specific print area (see types.ts's qrAssetId and StudioClient's placeQrAsset()).
//
// PERSISTENCE: there is no real QrAsset database table — same constraint documented in qr.ts's
// header (`DesignObject` is a fixed-column Postgres table with no migration access this session).
// A QrAsset is small, purely structural JSON (a destination string plus a handful of style enums;
// no binary blobs — the "vector source" IS the SVG data URL, which is already lightweight text), so
// unlike RecentUpload's "resets on reload" MVP scope (see UploadsPanel.tsx), it's genuinely
// practical to persist this in localStorage, scoped by the same anonymous session cookie that
// already scopes this customer's DesignProject drafts (session.ts) — same identity model, just
// backed by the browser instead of Postgres. This is an honest middle ground: it survives reload/
// tool-switch/Review exactly like the brief wants (Section "MY STUFF PERSISTENCE"), but it's
// per-browser, not a real cross-device account library — there is no login system in this app to
// attach it to (see MyStuffPanel.tsx's own existing disclosure of the same limitation for uploads).
// If/when real accounts + a QrAsset table exist, this module's storage functions are the only thing
// that needs to change — every caller already talks in QrAsset objects, not localStorage details.

import type { QrCornerStyle, QrDotStyle, QrErrorCorrection, QrFrameStyle, QrStylePresetId } from "./qr";

export interface QrAsset {
  id: string;
  /** Anonymous session token (see session.ts) that owns this asset — scopes My Stuff the same way
   *  it already scopes DesignProject drafts server-side. */
  sessionId: string;
  destination: string;
  /** One of QR_SOCIAL_PRESETS's ids ("website"/"instagram"/etc.) — presentation only, never
   *  changes what the QR encodes. */
  platform: string;
  /** Customer-editable ("Instagram QR", "Website QR" — Section "QR OBJECT LAYER NAME"); seeded from
   *  the platform label at creation. */
  displayName: string;
  stylePreset: QrStylePresetId | null;
  foregroundColor: string;
  backgroundColor: string;
  dotStyle: QrDotStyle;
  cornerStyle: QrCornerStyle;
  logoUrl: string | null;
  frameStyle: QrFrameStyle | null;
  labelText: string | null;
  errorCorrection: QrErrorCorrection;
  /** Fixed at 16 (qr.ts's non-adjustable margin) — recorded on the asset for transparency, not
   *  because it's independently editable yet. */
  quietZone: number;
  /** The full decorated render (frame/label included) — what a "Recent"/"My Stuff" card shows AND
   *  what a fresh placement's assetUrl is set to. Already a lightweight SVG data URL, so this
   *  doubles as its own thumbnail; no separate raster preview pipeline is generated or stored
   *  (Section "QR ASSET PREVIEW THUMBNAILS": "do not regenerate expensive large previews"). */
  displayDataUrl: string;
  /** The bare, undecorated code — what re-validation (moving/duplicating never needs this; style
   *  edits do) checks against. */
  bareDataUrl: string;
  scanValidated: boolean;
  validatedAt: string;
  /** Soft-delete (Section "MY STUFF — QR CODES": "deleting a QR asset that is already used in a
   *  saved DesignProject must not silently break that design") — set instead of removing the
   *  record when at least one placement in the currently loaded design still references this asset
   *  id. Archived assets are hidden from My Stuff/Recent but keep existing on-canvas placements
   *  working (a placement's own qr* fields are fully denormalized — see types.ts). */
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

function storageKey(sessionId: string): string {
  return `mi-qr-assets:${sessionId}`;
}

export function loadQrAssets(sessionId: string): QrAsset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(sessionId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QrAsset[]) : [];
  } catch {
    return [];
  }
}

export function saveQrAssets(sessionId: string, assets: QrAsset[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(sessionId), JSON.stringify(assets));
  } catch {
    // Storage full/unavailable (private browsing, quota) — QR creation itself already succeeded
    // and the placement is on canvas either way; losing reusability for this one asset is an
    // acceptable degradation, not worth surfacing as an error to the customer.
  }
}
