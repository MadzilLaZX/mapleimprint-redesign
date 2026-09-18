// Native QR Code tool (STUDIO V4 brief). Generation runs entirely client-side via qr-code-styling
// (MIT license, https://github.com/kozakdenys/qr-code-styling) — a destination URL never leaves
// the browser to any paid/third-party QR-generation API. Scannability is verified the same way:
// decoded locally with jsQR (Apache-2.0, https://github.com/cozmo/jsQR), never uploaded anywhere.
//
// PERSISTENCE NOTE: `DesignObject` is a real Postgres table (see src/app/api/studio/[id]/route.ts)
// with a fixed column set, and this session has no Supabase migration access (schema tooling
// disconnected) — adding new columns isn't safely possible right now. So a QR object's rich
// config is NOT stored as new top-level DesignObjectRecord columns; it's JSON-encoded into the
// existing, already-nullable `content` string column, with `type` written to the wire as the
// already-accepted "image" (a QR is, once rendered, just an image with special editing behavior).
// `qrObjectToWire()`/`wireObjectToQr()` below are the only two places that conversion happens —
// everywhere else in the app (Inspector, CanvasStage, StudioClient) works with the rich,
// first-class `type: "qr"` shape with individual `qrDestination`/`qrForegroundColor`/etc. fields,
// exactly like every other object type. If/when a real migration becomes available, promoting
// these to dedicated columns is a pure storage-layer change — nothing above this file changes.

import type { DesignObjectRecord } from "./types";

export type QrDotStyle = "square" | "dots" | "rounded" | "classy" | "classy-rounded" | "extra-rounded";
export type QrCornerStyle = "square" | "dot" | "extra-rounded";
export type QrErrorCorrection = "L" | "M" | "Q" | "H";
export type QrFrameStyle = "none" | "border";
export type QrStylePresetId = "classic" | "rounded" | "soft" | "bold" | "minimal";

export interface QrPreset {
  id: QrStylePresetId;
  label: string;
  dotStyle: QrDotStyle;
  cornerStyle: QrCornerStyle;
  foregroundColor: string;
  backgroundColor: string;
}

// Section "QR PRESETS": "Keep presets tasteful... approximately five. Do not create twenty
// gimmicky styles." All five stay high-contrast (dark modules on light background, or true
// black/white) — nothing here trades scannability for a look.
export const QR_PRESETS: QrPreset[] = [
  { id: "classic", label: "Classic", dotStyle: "square", cornerStyle: "square", foregroundColor: "#171412", backgroundColor: "#FFFFFF" },
  { id: "rounded", label: "Rounded", dotStyle: "rounded", cornerStyle: "extra-rounded", foregroundColor: "#171412", backgroundColor: "#FFFFFF" },
  { id: "soft", label: "Soft", dotStyle: "dots", cornerStyle: "dot", foregroundColor: "#5b5348", backgroundColor: "#F6F1E9" },
  { id: "bold", label: "Bold", dotStyle: "classy-rounded", cornerStyle: "square", foregroundColor: "#000000", backgroundColor: "#FFFFFF" },
  { id: "minimal", label: "Minimal", dotStyle: "classy", cornerStyle: "square", foregroundColor: "#171412", backgroundColor: "#FFFFFF" },
];

export function qrPresetFor(id: string | null | undefined): QrPreset {
  return QR_PRESETS.find((p) => p.id === id) ?? QR_PRESETS[0];
}

export interface QrStoredConfig {
  destination: string;
  errorCorrection: QrErrorCorrection;
  foregroundColor: string;
  backgroundColor: string;
  dotStyle: QrDotStyle;
  cornerStyle: QrCornerStyle;
  logoUrl: string | null;
  stylePreset: QrStylePresetId | null;
  frameStyle: QrFrameStyle | null;
  labelText: string | null;
  /** Last-known result of validateQrScans() against `destination` at save time — shown as a
   *  stale-but-useful hint on reload; StudioClient re-validates on every field change regardless. */
  validated: boolean | null;
  /** Links back to the reusable QrAsset this placement was created from (see qrAssets.ts) — null
   *  for a placement with no known/still-existing asset. Carried through the same JSON-in-`content`
   *  channel as every other qr* field, for the same Postgres-column reason (see this file's header). */
  assetId: string | null;
}

const QR_CONTENT_PREFIX = "maple-qr:v1:";

export function encodeQrContent(config: QrStoredConfig): string {
  return QR_CONTENT_PREFIX + JSON.stringify(config);
}

export function decodeQrContent(content: string | null): QrStoredConfig | null {
  if (!content || !content.startsWith(QR_CONTENT_PREFIX)) return null;
  try {
    return JSON.parse(content.slice(QR_CONTENT_PREFIX.length)) as QrStoredConfig;
  } catch {
    return null;
  }
}

const QR_NULL_FIELDS = {
  qrDestination: null,
  qrErrorCorrection: null,
  qrForegroundColor: null,
  qrBackgroundColor: null,
  qrDotStyle: null,
  qrCornerStyle: null,
  qrLogoUrl: null,
  qrStylePreset: null,
  qrFrameStyle: null,
  qrLabelText: null,
  qrValidated: null,
  qrAssetId: null,
} as const;

export type WireDesignObject = Omit<DesignObjectRecord, keyof typeof QR_NULL_FIELDS>;

/** Converts an in-app object into the shape actually sent to the API/DB. `DesignObject` is a real
 *  Postgres table with a fixed column set that has no qr* columns at all (see this file's header
 *  comment) — so EVERY object, not just `type: "qr"` ones, must have every qr* key stripped
 *  before going on the wire, or Supabase's insert 502s on the unrecognized columns (this was a
 *  real bug: only QR objects were being stripped, so any ordinary text/image/shape object — which
 *  all carry qr* keys defaulted to null by emptyObject()/template seeds — broke autosave). QR
 *  objects additionally go out as `type: "image"` with their rich fields collapsed into `content`. */
export function qrObjectToWire(obj: DesignObjectRecord): WireDesignObject {
  const {
    qrDestination,
    qrErrorCorrection,
    qrForegroundColor,
    qrBackgroundColor,
    qrDotStyle,
    qrCornerStyle,
    qrLogoUrl,
    qrStylePreset,
    qrFrameStyle,
    qrLabelText,
    qrValidated,
    qrAssetId,
    ...stripped
  } = obj;
  if (obj.type !== "qr") return stripped;
  const config: QrStoredConfig = {
    destination: qrDestination ?? "",
    errorCorrection: qrErrorCorrection ?? "M",
    foregroundColor: qrForegroundColor ?? "#171412",
    backgroundColor: qrBackgroundColor ?? "#FFFFFF",
    dotStyle: qrDotStyle ?? "square",
    cornerStyle: qrCornerStyle ?? "square",
    logoUrl: qrLogoUrl,
    stylePreset: qrStylePreset,
    frameStyle: qrFrameStyle,
    labelText: qrLabelText,
    validated: qrValidated,
    assetId: qrAssetId,
  };
  return { ...stripped, type: "image", content: encodeQrContent(config) };
}

/** Reverse of qrObjectToWire() — run on every object loaded from the API (which genuinely has no
 *  qr* keys at all, matching WireDesignObject) so the rest of the app never has to know QR objects
 *  are secretly stored as images. */
export function wireObjectToAppObject(obj: WireDesignObject): DesignObjectRecord {
  if (obj.type !== "image") return { ...QR_NULL_FIELDS, ...obj };
  const decoded = decodeQrContent(obj.content);
  if (!decoded) return { ...QR_NULL_FIELDS, ...obj };
  return {
    ...obj,
    type: "qr",
    content: null,
    qrDestination: decoded.destination,
    qrErrorCorrection: decoded.errorCorrection,
    qrForegroundColor: decoded.foregroundColor,
    qrBackgroundColor: decoded.backgroundColor,
    qrDotStyle: decoded.dotStyle,
    qrCornerStyle: decoded.cornerStyle,
    qrLogoUrl: decoded.logoUrl,
    qrStylePreset: decoded.stylePreset,
    qrFrameStyle: decoded.frameStyle,
    qrLabelText: decoded.labelText,
    qrValidated: decoded.validated,
    qrAssetId: decoded.assetId ?? null,
  };
}

export function isLikelyUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    return Boolean(url.hostname) && url.hostname.includes(".");
  } catch {
    return false;
  }
}

/** Adds a scheme if the customer typed a bare domain ("example.com") — never changes what the QR
 *  standard itself encodes (Section "SOCIAL PLATFORM PRESETS": "it is still simply a URL"). */
export function normalizeDestination(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export interface QrGenerateInput {
  destination: string;
  errorCorrection: QrErrorCorrection;
  foregroundColor: string;
  backgroundColor: string;
  dotStyle: QrDotStyle;
  cornerStyle: QrCornerStyle;
  logoUrl: string | null;
  frameStyle: QrFrameStyle | null;
  labelText: string | null;
}

const QR_RENDER_SIZE = 400;
// Section "QR LOGO": "Do not allow logo to cover too much QR data" — kept well under the ~30%
// ceiling past which error correction can no longer reliably reconstruct covered modules.
const LOGO_SIZE_RATIO = 0.2;

/** The bare, undecorated QR — this exact SVG is what gets validated (never the framed/labeled
 *  version below, since that composition adds pixels OUTSIDE the code's own module grid and
 *  quiet zone, never over it, so validating the bare code is validating the real scannable unit). */
async function generateBareQrSvg(input: QrGenerateInput): Promise<string> {
  const { default: QRCodeStyling } = await import("qr-code-styling");
  const hasLogo = Boolean(input.logoUrl);
  const qr = new QRCodeStyling({
    type: "svg",
    width: QR_RENDER_SIZE,
    height: QR_RENDER_SIZE,
    data: input.destination,
    // Fixed, non-adjustable quiet zone (Section "QR QUIET ZONE": "Do not let customer crop the QR
    // modules to the edge") — margin is qr-code-styling's own built-in quiet-zone control, and
    // nothing in the UI exposes a way to reduce it.
    margin: 16,
    qrOptions: {
      // A logo always forces the highest error-correction tier regardless of what was requested —
      // enough of the code has to survive being partially covered (Section "QR LOGO").
      errorCorrectionLevel: hasLogo ? "H" : input.errorCorrection,
    },
    dotsOptions: { type: input.dotStyle, color: input.foregroundColor },
    cornersSquareOptions: { type: input.cornerStyle, color: input.foregroundColor },
    cornersDotOptions: { type: input.cornerStyle === "dot" ? "dot" : input.dotStyle, color: input.foregroundColor },
    backgroundOptions: { color: input.backgroundColor },
    image: input.logoUrl ?? undefined,
    // qr-code-styling reads `imageOptions.hideBackgroundDots` unconditionally while drawing dots
    // — even with no `image` set at all — so this must always be a real object; passing
    // `imageOptions: undefined` (e.g. via a ternary) throws "Cannot read properties of undefined
    // (reading 'hideBackgroundDots')" the moment a customer creates a QR with no logo, which is
    // the common case. Harmless to always supply — it's simply unused when `image` is unset.
    imageOptions: { imageSize: LOGO_SIZE_RATIO, margin: 4, hideBackgroundDots: true, crossOrigin: "anonymous" },
  });
  const blob = await qr.getRawData("svg");
  if (!blob || !(blob instanceof Blob)) throw new Error("We couldn't generate this QR code.");
  return blob.text();
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Wraps the bare QR with an optional border "Frame" and/or "SCAN ME"-style "Label" — composed
 *  into ONE flattened SVG so the whole thing drags/resizes/rotates as a single DesignObject,
 *  matching how every other object type works. Both additions sit strictly outside the bare QR's
 *  own box, never overlapping its modules or quiet zone. */
function composeDisplaySvg(bareSvg: string, input: QrGenerateInput): string {
  const inner = bareSvg.replace(/^<\?xml[^>]*\?>/, "");
  const hasLabel = Boolean(input.labelText?.trim());
  const labelHeight = hasLabel ? 56 : 0;
  const framePad = input.frameStyle === "border" ? 20 : 0;
  const totalSize = QR_RENDER_SIZE + framePad * 2 + labelHeight;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalSize}" height="${totalSize}" viewBox="0 0 ${totalSize} ${totalSize}">
    <rect width="${totalSize}" height="${totalSize}" fill="${input.backgroundColor}"/>
    ${input.frameStyle === "border" ? `<rect x="4" y="4" width="${totalSize - 8}" height="${totalSize - 8}" rx="14" fill="none" stroke="${input.foregroundColor}" stroke-width="4"/>` : ""}
    <g transform="translate(${framePad}, ${framePad})">${inner}</g>
    ${
      hasLabel
        ? `<text x="${totalSize / 2}" y="${totalSize - framePad - 14}" font-family="sans-serif" font-size="22" font-weight="700" letter-spacing="1.5" fill="${input.foregroundColor}" text-anchor="middle">${escapeXml(input.labelText!.trim().toUpperCase())}</text>`
        : ""
    }
  </svg>`;
}

export interface QrGenerateResult {
  /** What actually gets shown on canvas (assetUrl) — includes frame/label if set. */
  displayDataUrl: string;
  /** The bare code only — what validateQrScans() checks. */
  bareDataUrl: string;
}

export async function generateQr(input: QrGenerateInput): Promise<QrGenerateResult> {
  const bareSvg = await generateBareQrSvg(input);
  return {
    bareDataUrl: `data:image/svg+xml,${encodeURIComponent(bareSvg)}`,
    displayDataUrl: `data:image/svg+xml,${encodeURIComponent(composeDisplaySvg(bareSvg, input))}`,
  };
}

export interface QrValidationResult {
  scans: boolean;
  decodedText: string | null;
}

/** Renders the bare QR to an offscreen canvas and decodes it with jsQR — the one place Studio
 *  actually confirms a code is readable instead of assuming a well-formed-looking one always
 *  scans (Section "QR SCANNABILITY": "A QR that looks nice but does not scan is unacceptable"). */
export async function validateQrScans(bareDataUrl: string, expectedDestination: string): Promise<QrValidationResult> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Couldn't load this QR code to check it."));
    img.src = bareDataUrl;
  });
  const size = 400;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { scans: false, decodedText: null };
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(img, 0, 0, size, size);
  const imageData = ctx.getImageData(0, 0, size, size);
  const { default: jsQR } = await import("jsqr");
  const result = jsQR(imageData.data, size, size, { inversionAttempts: "attemptBoth" });
  if (!result) return { scans: false, decodedText: null };
  return { scans: result.data === expectedDestination, decodedText: result.data };
}

/** "Fix QR" (Section "QR QUALITY STATES") — the customer never has to understand contrast ratios
 *  or error-correction math; this just reverts to the single known-safest configuration (true
 *  black/white, square modules, no logo, highest error correction). */
export function safestQrConfig(input: QrGenerateInput): QrGenerateInput {
  return {
    ...input,
    foregroundColor: "#000000",
    backgroundColor: "#FFFFFF",
    dotStyle: "square",
    cornerStyle: "square",
    errorCorrection: "H",
    logoUrl: null,
  };
}

/** Social-platform presets (Section "SOCIAL QR PRESETS"/"PLATFORM PRESET STRUCTURE"). Selecting a
 *  platform now does more than swap placeholder/help copy — it also picks a recommended
 *  `stylePreset` (one of QR_PRESETS above) so an Instagram QR reads differently from a LinkedIn
 *  one at a glance. What it deliberately does NOT do is embed any platform's logo/glyph: Maple has
 *  no verified, written brand-usage approval for Instagram/TikTok/YouTube/LinkedIn/Facebook (the
 *  brief specifically flags TikTok's developer guidelines requiring prior written permission —
 *  independent research found the other platforms are no more permissive by default), so
 *  `approvedLogoAssetId` is null for every single one and stays that way until Maple actually
 *  secures and records that approval somewhere real (see BrandAsset below). The QR's encoded DATA
 *  is always just the destination URL regardless of platform — this only ever changes presentation. */
export interface QrPlatformPreset {
  id: string;
  label: string;
  placeholder: string;
  help: string;
  stylePreset: QrStylePresetId;
  /** id of a Maple-owned, license-verified brand mark for this platform — always null today (see
   *  this const's own doc comment). Kept as a real field, not hardcoded away, so the day Maple gets
   *  written permission for one platform, turning its center-logo option on is a one-line change
   *  here rather than new architecture. */
  approvedLogoAssetId: string | null;
  ctaExamples: string[];
}

export const QR_SOCIAL_PRESETS: QrPlatformPreset[] = [
  { id: "website", label: "Website", placeholder: "https://example.com", help: "Paste your website link.", stylePreset: "classic", approvedLogoAssetId: null, ctaExamples: ["Visit our site", "Learn more"] },
  { id: "instagram", label: "Instagram", placeholder: "https://instagram.com/yourname", help: "Paste your Instagram profile link.", stylePreset: "rounded", approvedLogoAssetId: null, ctaExamples: ["Scan to follow", "Follow @yourname"] },
  { id: "tiktok", label: "TikTok", placeholder: "https://tiktok.com/@yourname", help: "Paste your TikTok profile link.", stylePreset: "bold", approvedLogoAssetId: null, ctaExamples: ["Scan to follow", "Watch on TikTok"] },
  { id: "youtube", label: "YouTube", placeholder: "https://youtube.com/@yourname", help: "Paste your YouTube channel link.", stylePreset: "bold", approvedLogoAssetId: null, ctaExamples: ["Subscribe", "Watch now"] },
  { id: "linkedin", label: "LinkedIn", placeholder: "https://linkedin.com/in/yourname", help: "Paste your LinkedIn profile link.", stylePreset: "minimal", approvedLogoAssetId: null, ctaExamples: ["Connect with me", "View my profile"] },
  { id: "facebook", label: "Facebook", placeholder: "https://facebook.com/yourpage", help: "Paste your Facebook page link.", stylePreset: "classic", approvedLogoAssetId: null, ctaExamples: ["Like our page", "Follow us"] },
];

export function platformPresetFor(id: string | null | undefined): QrPlatformPreset {
  return QR_SOCIAL_PRESETS.find((p) => p.id === id) ?? QR_SOCIAL_PRESETS[0];
}

/** Best-effort human label for a QrAsset's destination, e.g. "instagram.com" — used as the
 *  secondary line on Recent QR Codes / My Stuff cards (Section "MY STUFF — QR CODES"). Falls back
 *  to the raw destination if it somehow isn't a parseable URL (shouldn't happen — every stored
 *  destination already passed isLikelyUrl — but this is display code, not a validator). */
export function destinationHost(destination: string): string {
  try {
    return new URL(destination).hostname.replace(/^www\./, "");
  } catch {
    return destination;
  }
}
