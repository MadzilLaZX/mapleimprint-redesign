"use client";

// New feature, not a VistaPrint copy (their configurator has no equivalent WIDGET, though they do
// show a real photo of a person beside a banner mockup with dimension tick-lines — this is the
// same idea, generated rather than photographed, since there's no real photo asset for every one
// of the 28 banner sizes). One shared feet-per-unit scale for both shapes (SVG viewBox, feet as
// the coordinate unit) guarantees they're always genuinely proportional. CSS aspect-ratio (not a
// fixed pixel height) lets the same drawing logic work sensibly whether the banner is a tall
// narrow strip or a very wide short one.
const HUMAN_HEIGHT_FT = 5.75; // ~5'9", an average adult reference height — not a real person
const HUMAN_WIDTH_FT = 1.3;
const PAD_FT = 0.6;
const HEIGHT_DIM_ZONE_FT = 1.1; // gap + tick-line + label for the height dimension, right of the banner
const GAP_TO_HUMAN_FT = 1.0;
const WIDTH_DIM_ZONE_FT = 0.9; // gap + tick-line + label for the width dimension, below the banner
const TOP_PAD_FT = 0.5;
const TICK_LEN_FT = 0.16;

function formatFt(n: number): string {
  return `${Number.isInteger(n) ? n : n.toString()}'`;
}

export function BannerScaleVisualizer({ widthFt, heightFt }: { widthFt: number; heightFt: number }) {
  const groundFt = Math.max(heightFt, HUMAN_HEIGHT_FT);
  const totalWidthFt = PAD_FT + widthFt + HEIGHT_DIM_ZONE_FT + GAP_TO_HUMAN_FT + HUMAN_WIDTH_FT + PAD_FT;
  const totalHeightFt = TOP_PAD_FT + groundFt + WIDTH_DIM_ZONE_FT;

  const groundY = TOP_PAD_FT + groundFt;
  const bannerX = PAD_FT;
  const bannerY = groundY - heightFt;
  const heightTickX = bannerX + widthFt + HEIGHT_DIM_ZONE_FT * 0.35;
  const widthTickY = groundY + WIDTH_DIM_ZONE_FT * 0.35;
  const humanCenterX = bannerX + widthFt + HEIGHT_DIM_ZONE_FT + GAP_TO_HUMAN_FT + HUMAN_WIDTH_FT / 2;

  const headR = HUMAN_HEIGHT_FT * 0.07;
  const headCy = groundY - HUMAN_HEIGHT_FT + headR;
  const shoulderY = headCy + headR * 1.4;
  const hipY = groundY - HUMAN_HEIGHT_FT * 0.46;
  const shoulderHalfWidth = HUMAN_WIDTH_FT * 0.32;
  const waistHalfWidth = HUMAN_WIDTH_FT * 0.16;

  const labelSize = Math.min(0.32, totalHeightFt * 0.035);
  const captionSize = Math.min(0.26, totalHeightFt * 0.03);
  const uid = `${widthFt}x${heightFt}`;

  return (
    <div className="rounded-2xl border border-sand bg-white p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-900/70">Size reference</p>
      <svg viewBox={`0 0 ${totalWidthFt} ${totalHeightFt}`} style={{ width: "100%", aspectRatio: `${totalWidthFt} / ${totalHeightFt}` }}>
        <defs>
          <linearGradient id={`banner-fill-${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3A3632" />
            <stop offset="55%" stopColor="#231F1C" />
            <stop offset="100%" stopColor="#171412" />
          </linearGradient>
        </defs>

        <line x1={0} y1={groundY} x2={bannerX + widthFt} y2={groundY} stroke="#E9E2D3" strokeWidth={0.015} />

        {/* Banner mockup — dark gradient with a soft diagonal sheen, echoing a photographed vinyl surface rather than a flat colour swatch. */}
        <rect x={bannerX} y={bannerY} width={widthFt} height={heightFt} rx={Math.min(widthFt, heightFt) * 0.02} fill={`url(#banner-fill-${uid})`} />
        <path
          d={`M ${bannerX} ${bannerY} L ${bannerX + widthFt * 0.55} ${bannerY} L ${bannerX} ${bannerY + heightFt * 0.55} Z`}
          fill="#FFFFFF"
          opacity={0.06}
        />

        {/* Height dimension — architectural tick line to the right of the banner. */}
        <g stroke="#B9AD98" strokeWidth={0.012}>
          <line x1={heightTickX} y1={bannerY} x2={heightTickX} y2={groundY} />
          <line x1={heightTickX - TICK_LEN_FT / 2} y1={bannerY} x2={heightTickX + TICK_LEN_FT / 2} y2={bannerY} />
          <line x1={heightTickX - TICK_LEN_FT / 2} y1={groundY} x2={heightTickX + TICK_LEN_FT / 2} y2={groundY} />
        </g>
        <text
          x={heightTickX + TICK_LEN_FT}
          y={(bannerY + groundY) / 2}
          fontSize={labelSize}
          fill="#171412"
          fontWeight={600}
          dominantBaseline="middle"
        >
          {formatFt(heightFt)}
        </text>

        {/* Width dimension — architectural tick line below the banner. */}
        <g stroke="#B9AD98" strokeWidth={0.012}>
          <line x1={bannerX} y1={widthTickY} x2={bannerX + widthFt} y2={widthTickY} />
          <line x1={bannerX} y1={widthTickY - TICK_LEN_FT / 2} x2={bannerX} y2={widthTickY + TICK_LEN_FT / 2} />
          <line x1={bannerX + widthFt} y1={widthTickY - TICK_LEN_FT / 2} x2={bannerX + widthFt} y2={widthTickY + TICK_LEN_FT / 2} />
        </g>
        <text x={bannerX + widthFt / 2} y={widthTickY + TICK_LEN_FT * 1.8} fontSize={labelSize} fill="#171412" fontWeight={600} textAnchor="middle">
          {formatFt(widthFt)}
        </text>

        {/* Human reference figure — a minimal croquis silhouette, not a stick figure. */}
        <g fill="#171412">
          <circle cx={humanCenterX} cy={headCy} r={headR} />
          <path
            d={`M ${humanCenterX - shoulderHalfWidth} ${shoulderY}
                Q ${humanCenterX - waistHalfWidth} ${(shoulderY + hipY) / 2} ${humanCenterX - waistHalfWidth} ${hipY}
                L ${humanCenterX - waistHalfWidth * 1.3} ${groundY}
                L ${humanCenterX - waistHalfWidth * 0.4} ${groundY}
                L ${humanCenterX} ${hipY + (groundY - hipY) * 0.55}
                L ${humanCenterX + waistHalfWidth * 0.4} ${groundY}
                L ${humanCenterX + waistHalfWidth * 1.3} ${groundY}
                L ${humanCenterX + waistHalfWidth} ${hipY}
                Q ${humanCenterX + waistHalfWidth} ${(shoulderY + hipY) / 2} ${humanCenterX + shoulderHalfWidth} ${shoulderY}
                Q ${humanCenterX} ${shoulderY - headR * 0.6} ${humanCenterX - shoulderHalfWidth} ${shoulderY}
                Z`}
          />
        </g>
        <text x={humanCenterX} y={groundY + captionSize * 1.6} fontSize={captionSize} textAnchor="middle" fill="#9C9284">
          ~5&apos;9&quot; person
        </text>
      </svg>
    </div>
  );
}
