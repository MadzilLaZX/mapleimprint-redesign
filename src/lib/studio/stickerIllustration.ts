// Recognizable sticker-surface illustration, used as the 2D editing background for sticker/label
// products — replacing the plain neutral printPieceSchematicSvg() card with a die-cut sticker
// (rounded square, peeled top-right corner, soft drop shadow) sitting on a flat surface. Same
// division of responsibility as drinkwareIllustrations.ts: this draws a recognizable visual aid
// roughly behind where CanvasStage overlays the real dashed print-area box
// (PLACEMENT_GEOMETRY["sticker-face"], a centered ~1:1 square) — it is NOT a dimensionally-accurate
// production template, and never claims to be a specific die-cut shape (roll labels, kiss-cut
// sheets, etc. all still get their real shape/size confirmed before production, same as today).

const C = {
  bg: "#F6F1E9",
  surface: "#FFFFFF",
  surfaceShadow: "#00000014",
  sticker: "#FDFBF6",
  stickerStroke: "#D8CFC0",
  peelShade: "#E7DFD1",
  peelStroke: "#C9BEA9",
  label: "#8C816E",
};

export function stickerIllustrationSvg(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="650">
    <rect width="520" height="650" fill="${C.bg}"/>
    <ellipse cx="260" cy="480" rx="190" ry="18" fill="${C.surfaceShadow}"/>
    <rect x="70" y="100" width="380" height="380" rx="28" fill="${C.surface}"/>
    <rect x="88" y="118" width="344" height="344" rx="18" fill="${C.sticker}" stroke="${C.stickerStroke}" stroke-width="2.5"/>
    <path d="M372 118 L432 118 L432 178 Q400 150 372 148 Z" fill="${C.peelShade}" stroke="${C.peelStroke}" stroke-width="2"/>
    <path d="M372 148 Q400 150 432 178" fill="none" stroke="${C.peelStroke}" stroke-width="1.5" opacity="0.7"/>
    <text x="260" y="628" font-family="sans-serif" font-size="12" font-weight="600" letter-spacing="1.5" fill="${C.label}" text-anchor="middle">CUSTOM STICKER — SHAPE CONFIRMED BEFORE PRODUCTION</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
