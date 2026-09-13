// Per-character arc layout for curved text (Section 7). Konva has no built-in curved-text node, so
// curved text is rendered as one Konva.Text per character, each placed and rotated along a circular
// arc — the standard technique for canvas-based curved type. `curve` is a unitless -100..100 knob
// (not a physical radius): magnitude controls how tight the arc is, sign controls direction
// (positive arcs upward/"smile", negative arcs downward/"frown"). 0 (or null) means straight text
// and callers should skip this entirely and render a single flat Konva.Text instead.

export interface CurvedGlyph {
  char: string;
  x: number;
  y: number;
  rotationDeg: number;
}

// Empirically-chosen scale, not a physical unit: at curve=100 a ~200px-wide string arcs into a
// clearly-curved band without letters overlapping; at curve=10 it's barely perceptible.
const RADIUS_CONSTANT = 14000;

export function layoutCurvedText(text: string, fontSize: number, letterSpacing: number, curve: number): CurvedGlyph[] {
  if (!curve) return [];
  const radius = RADIUS_CONSTANT / Math.abs(curve);
  const direction = curve > 0 ? 1 : -1;

  // Rough monospace-ish advance estimate per character (avoids needing a canvas text-measure pass
  // just to lay out the arc) — good enough for the visual curve; actual glyph widths still render
  // correctly via Konva, only the arc spacing is approximate.
  const glyphs = [...text];
  const advances = glyphs.map((c) => (c === " " ? fontSize * 0.28 : fontSize * 0.58) + letterSpacing);
  const totalWidth = advances.reduce((a, b) => a + b, 0);
  const totalAngle = totalWidth / radius;

  let angle = -totalAngle / 2;
  const out: CurvedGlyph[] = [];
  for (let i = 0; i < glyphs.length; i++) {
    angle += advances[i] / radius / 2;
    const theta = angle * direction;
    out.push({
      char: glyphs[i],
      x: radius * Math.sin(theta),
      y: direction * (radius - radius * Math.cos(theta)) * -1,
      rotationDeg: theta * (180 / Math.PI),
    });
    angle += advances[i] / radius / 2;
  }
  return out;
}
