"use client";

// Generic human-scale size reference for any large-format product (banners, posters, yard signs,
// rigid signs) — originally built just for vinyl banners (as BannerScaleVisualizer) but the
// component itself was always generic on widthFt/heightFt alone, so it's renamed/reused here
// rather than duplicated per product family. The same idea as VistaPrint's own real photo of a
// person beside a product mockup with dimension tick-lines.
// public/images/height-reference-person.webp is an AI-generated illustration the client supplied
// directly (originally "Minimal Male Outfit Flat Illustration.png") — client-owned generated
// output, not sourced from a stock site, so no third-party license to track here. Cropped tight to
// head-to-feet so its own height in the image exactly represents HUMAN_HEIGHT_FT with no baked-in
// padding to throw off the comparison. One shared feet-per-unit scale for both the product and the
// figure (SVG viewBox, feet as the coordinate unit) guarantees they're always genuinely
// proportional. The preview box itself is a FIXED pixel height — `preserveAspectRatio` letterboxes
// the drawing to fit inside it — rather than deriving the rendered height from the real-world
// aspect ratio: a 4'x30' banner's true aspect ratio is absurdly tall/narrow, and a container that
// followed it literally would blow out to thousands of pixels tall and wreck the page layout.
const HUMAN_HEIGHT_FT = 5.75; // ~5'9", an average adult reference height — not the figure's depicted height
const PERSON_IMAGE_ASPECT = 277 / 900; // height-reference-person.webp's own width/height ratio — preserves its real proportions rather than stretching it to an arbitrary width
const HUMAN_WIDTH_FT = HUMAN_HEIGHT_FT * PERSON_IMAGE_ASPECT;
const PAD_FT = 0.6;
const GAP_TO_HUMAN_FT = 1.0;
const TOP_PAD_FT = 0.5;
const TICK_LEN_FT = 0.16;
// Minimum dimension-zone sizes (space reserved right-of/below the product for its tick-line +
// label) — the actual zone used is Math.max(this, enough feet to hold THIS item's pixel-targeted
// label text; see labelSize/captionSize below). Fixed constants alone broke for a tall banner:
// label text grows (in feet) with totalHeightFt to hold a constant on-screen pixel size, but a
// fixed-feet zone doesn't grow with it — so for a 4'x30' banner the "30'" label and the person's
// caption no longer fit in the old budget and got clipped by the SVG's own viewBox boundary (a
// correctness bug, not just tight spacing).
const HEIGHT_DIM_ZONE_MIN_FT = 1.1;
const WIDTH_DIM_ZONE_MIN_FT = 0.9;
// Must match the preview box's fixed CSS height — used only to convert a target ON-SCREEN pixel
// size for label text back into viewBox (feet) units for THIS item's specific zoom level. Font
// size set in plain feet units (the old approach) breaks down for an extreme aspect ratio: a
// 4'x30' banner's ~32ft-tall viewBox squeezed into a 420px box is a scale where even a capped
// label would render unreadably small — not a readability tweak, a different bug than the
// layout-blowout one above. Assumes height is the binding constraint (true for the tall/narrow
// sizes this most needed fixing for); for a very wide/short item where width binds instead, this
// slightly UNDER-sizes text rather than over — the safe direction, since the box per se never
// overflows either way.
const BOX_HEIGHT_PX = 420;
const TARGET_LABEL_PX = 16;
const TARGET_CAPTION_PX = 11;
// Wall/floor room-scene backdrop — a soft vertical wall gradient above groundY, a flatter floor
// tone below it, both filling the entire viewBox so the backdrop reads as one continuous room
// regardless of how the letterboxing (see the preserveAspectRatio comment above) crops into it at
// extreme aspect ratios. Shadow blur is sized proportional to totalHeightFt (same reasoning as
// labelSize/captionSize above) so it reads as "soft" at any zoom level rather than a fixed-feet
// blur that'd turn into a hard edge when heavily zoomed out, or an oversized smudge when zoomed in.
const WALL_TOP_COLOR = "#F7F5F1";
const WALL_BOTTOM_COLOR = "#E8E4DC";
const FLOOR_TOP_COLOR = "#DDD8CD";
const FLOOR_BOTTOM_COLOR = "#CFC9BC";

function formatFt(n: number): string {
  return `${Number.isInteger(n) ? n : n.toString()}'`;
}

/** `widthFt`/`heightFt` are the DISPLAY dimensions, already oriented by the caller — this
 *  component never flips/reorients anything itself, so a banner's landscape/portrait toggle
 *  (BannerConfigurator) just swaps which raw dimension it passes in as width vs height. `itemLabel`
 *  names the shape being compared (defaults to "product") for the "W × H" callout text. */
export function SizeReferenceVisualizer({
  widthFt,
  heightFt,
  itemLabel = "product",
}: {
  widthFt: number;
  heightFt: number;
  itemLabel?: string;
}) {
  const groundFt = Math.max(heightFt, HUMAN_HEIGHT_FT);

  // Pass 1: approximate totalHeightFt (using the minimum zone sizes) just to get a first estimate
  // of the pixel-targeted label/caption sizes, which the real zone sizes below depend on.
  const approxTotalHeightFt = TOP_PAD_FT + groundFt + WIDTH_DIM_ZONE_MIN_FT;
  const approxLabelSize = (TARGET_LABEL_PX * approxTotalHeightFt) / BOX_HEIGHT_PX;
  const approxCaptionSize = (TARGET_CAPTION_PX * approxTotalHeightFt) / BOX_HEIGHT_PX;

  // Zone sizes big enough to actually hold that text: the height-zone holds a short horizontal
  // label ("30'") to the right of the product — width roughly 2.2x font size is a safe estimate
  // for 2-3 numeral+apostrophe characters. The width-zone holds the width label below the product
  // PLUS the taller person-caption text further down — 1.6x captionSize's own line-height offset,
  // same as where it's actually drawn (see the final <text> below).
  const heightDimZoneFt = Math.max(HEIGHT_DIM_ZONE_MIN_FT, approxLabelSize * 2.2 + TICK_LEN_FT + 0.15);
  const widthDimZoneFt = Math.max(WIDTH_DIM_ZONE_MIN_FT, approxCaptionSize * 1.6 + TICK_LEN_FT + 0.15);

  // The "~5'9" person" caption is centered on the person and is WIDER than the person image
  // itself, so a flat PAD_FT margin on the right wasn't enough once captionSize grew past a
  // certain point — the same class of bug as the dimension-label zones above (fixed-feet padding
  // vs. pixel-targeted text that grows in feet with totalHeightFt). ~7.5x captionSize is a
  // rough-but-safe average-character-width estimate for this specific 13-character string at a
  // normal sans-serif weight.
  const approxCaptionWidthFt = approxCaptionSize * 7.5;
  const rightPadFt = Math.max(PAD_FT, approxCaptionWidthFt / 2 - HUMAN_WIDTH_FT / 2 + 0.15);

  const totalWidthFt = PAD_FT + widthFt + heightDimZoneFt + GAP_TO_HUMAN_FT + HUMAN_WIDTH_FT + rightPadFt;
  const totalHeightFt = TOP_PAD_FT + groundFt + widthDimZoneFt;

  const groundY = TOP_PAD_FT + groundFt;
  const itemX = PAD_FT;
  const itemY = groundY - heightFt;
  const heightTickX = itemX + widthFt + heightDimZoneFt * 0.35;
  const widthTickY = groundY + widthDimZoneFt * 0.35;
  const humanCenterX = itemX + widthFt + heightDimZoneFt + GAP_TO_HUMAN_FT + HUMAN_WIDTH_FT / 2;

  // Pass 2: final label/caption sizes from the real (slightly larger, now that zones are counted)
  // totalHeightFt — close to the pass-1 estimate since the zones are a small correction on top of
  // groundFt, but recomputed for accuracy rather than reusing the approximation.
  const labelSize = (TARGET_LABEL_PX * totalHeightFt) / BOX_HEIGHT_PX;
  const captionSize = (TARGET_CAPTION_PX * totalHeightFt) / BOX_HEIGHT_PX;
  const shadowBlur = totalHeightFt * 0.012;
  const uid = `${widthFt}x${heightFt}`;

  // Soft cast shadow under the person, offset toward the item (as if lit from the opposite side)
  // rather than a plain centered blob — a cheap way to suggest the reference scene's directional
  // lighting without needing an actual rendered/photographed shadow asset.
  const personShadowCx = humanCenterX - HUMAN_WIDTH_FT * 0.18;
  const personShadowRx = HUMAN_WIDTH_FT * 0.95;
  const personShadowRy = HUMAN_WIDTH_FT * 0.16;

  return (
    <div className="overflow-hidden rounded-2xl border border-sand">
      <div className="flex items-baseline justify-between gap-2 bg-white px-4 pt-4 pb-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/70">Size reference</p>
        <p className="font-display text-sm font-semibold text-ink-900">
          {formatFt(widthFt)} W × {formatFt(heightFt)} H
        </p>
      </div>
      {/* The row's height is a bounded RANGE (min-h-56..max-h, not a fixed height) and the inner
          box's width is resolved via min(100%, idealPx) with height auto-derived from the
          aspect-ratio — two changes that work together, not interchangeably:
          - A fixed-height row alone caps every item, narrow or wide, to the same short box —
            correctly proportioned inside it, but never able to grow taller for a narrow/tall item
            that has vertical room to spare, so it rendered small.
          - width:100%/height:100% on the SVG directly always stretched the SVG's own box to fill
            the row regardless of content shape, so a narrow/tall item's correctly-scaled content
            sat inside an oversized box — real empty wall/floor pillarboxing, not just a cosmetic gap.
          - `maxWidth`/`maxHeight` alone with no explicit dimension didn't reliably resolve either —
            CSS aspect-ratio needs at least one DEFINITE dimension to derive the other from, and
            max-* constraints alone don't count as definite.
          Resolving width via min() against the row's max-height first, then letting both the box's
          own height AND the row's height auto-derive from the aspect-ratio, gives a narrow/tall
          item room to actually grow taller (up to the max-height cap) instead of being squeezed
          into the same short row a wide item uses — while the max-height cap itself is still what
          prevents a page-blowout bug for an extreme aspect ratio. */}
      <div className="flex min-h-56 max-h-[26.25rem] items-center justify-center overflow-hidden">
        <div style={{ width: `min(100%, ${BOX_HEIGHT_PX * (totalWidthFt / totalHeightFt)}px)`, aspectRatio: `${totalWidthFt} / ${totalHeightFt}` }}>
          <svg
            viewBox={`0 0 ${totalWidthFt} ${totalHeightFt}`}
            preserveAspectRatio="xMidYMid meet"
            style={{ width: "100%", height: "100%", display: "block" }}
          >
          <defs>
            <linearGradient id={`item-fill-${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#3A3632" />
              <stop offset="55%" stopColor="#231F1C" />
              <stop offset="100%" stopColor="#171412" />
            </linearGradient>
            <linearGradient id="wall-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={WALL_TOP_COLOR} />
              <stop offset="100%" stopColor={WALL_BOTTOM_COLOR} />
            </linearGradient>
            <linearGradient id="floor-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={FLOOR_TOP_COLOR} />
              <stop offset="100%" stopColor={FLOOR_BOTTOM_COLOR} />
            </linearGradient>
            <filter id="scene-shadow-blur" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation={shadowBlur} />
            </filter>
          </defs>

          {/* Room backdrop — a wall above the ground line, a floor below it, filling the whole
              frame so the letterboxed box (see this file's top comment) always reads as "inside a
              room" rather than empty space around the subject. */}
          <rect x={0} y={0} width={totalWidthFt} height={groundY} fill="url(#wall-fill)" />
          <rect x={0} y={groundY} width={totalWidthFt} height={totalHeightFt - groundY} fill="url(#floor-fill)" />
          <line x1={0} y1={groundY} x2={totalWidthFt} y2={groundY} stroke="#C9C2B3" strokeWidth={0.012} />

          {/* Soft contact shadow where the item meets the wall, and under the person's feet —
              grounds both subjects in the scene instead of looking like cutouts floating on it. */}
          <ellipse
            cx={itemX + widthFt / 2}
            cy={groundY}
            rx={widthFt * 0.48}
            ry={Math.min(heightFt, groundFt) * 0.025}
            fill="#171412"
            opacity={0.22}
            filter="url(#scene-shadow-blur)"
          />
          <ellipse
            cx={personShadowCx}
            cy={groundY}
            rx={personShadowRx}
            ry={personShadowRy}
            fill="#171412"
            opacity={0.18}
            filter="url(#scene-shadow-blur)"
          />

          {/* Product mockup — dark gradient with a soft diagonal sheen, echoing a photographed
              surface rather than a flat colour swatch. Works for any flat large-format item
              (banner, poster, sign) since it's just a proportioned rectangle. */}
          <rect x={itemX} y={itemY} width={widthFt} height={heightFt} rx={Math.min(widthFt, heightFt) * 0.02} fill={`url(#item-fill-${uid})`} />
          <path
            d={`M ${itemX} ${itemY} L ${itemX + widthFt * 0.55} ${itemY} L ${itemX} ${itemY + heightFt * 0.55} Z`}
            fill="#FFFFFF"
            opacity={0.06}
          />

          {/* Height dimension — architectural tick line to the right of the item. */}
          <g stroke="#171412" strokeWidth={0.018} opacity={0.8}>
            <line x1={heightTickX} y1={itemY} x2={heightTickX} y2={groundY} />
            <line x1={heightTickX - TICK_LEN_FT / 2} y1={itemY} x2={heightTickX + TICK_LEN_FT / 2} y2={itemY} />
            <line x1={heightTickX - TICK_LEN_FT / 2} y1={groundY} x2={heightTickX + TICK_LEN_FT / 2} y2={groundY} />
          </g>
          <text
            x={heightTickX + TICK_LEN_FT}
            y={(itemY + groundY) / 2}
            fontSize={labelSize}
            fill="#171412"
            fontWeight={700}
            dominantBaseline="middle"
          >
            {formatFt(heightFt)}
          </text>

          {/* Width dimension — architectural tick line below the item. */}
          <g stroke="#171412" strokeWidth={0.018} opacity={0.8}>
            <line x1={itemX} y1={widthTickY} x2={itemX + widthFt} y2={widthTickY} />
            <line x1={itemX} y1={widthTickY - TICK_LEN_FT / 2} x2={itemX} y2={widthTickY + TICK_LEN_FT / 2} />
            <line x1={itemX + widthFt} y1={widthTickY - TICK_LEN_FT / 2} x2={itemX + widthFt} y2={widthTickY + TICK_LEN_FT / 2} />
          </g>
          <text x={itemX + widthFt / 2} y={widthTickY + TICK_LEN_FT * 1.8} fontSize={labelSize} fill="#171412" fontWeight={700} textAnchor="middle">
            {formatFt(widthFt)}
          </text>

          {/* Human reference figure — a real illustration (see this file's top comment for
              provenance), not a drawn silhouette. HUMAN_WIDTH_FT is already derived from the
              image's own aspect ratio, so the default "meet" fit (rather than "none", which would
              stretch) just guards against distortion from any floating-point rounding, not an
              expected mismatch. */}
          <image
            href="/images/height-reference-person.webp"
            x={humanCenterX - HUMAN_WIDTH_FT / 2}
            y={groundY - HUMAN_HEIGHT_FT}
            width={HUMAN_WIDTH_FT}
            height={HUMAN_HEIGHT_FT}
            preserveAspectRatio="xMidYMid meet"
          />
          <text x={humanCenterX} y={groundY + captionSize * 1.6} fontSize={captionSize} textAnchor="middle" fill="#8A8172">
            ~5&apos;9&quot; person
          </text>
          </svg>
        </div>
      </div>
      <p className="bg-white px-4 py-2 text-center text-[11px] text-muted">
        This {itemLabel} shown to scale next to an average-height adult (5&apos;9&quot;).
      </p>
    </div>
  );
}
