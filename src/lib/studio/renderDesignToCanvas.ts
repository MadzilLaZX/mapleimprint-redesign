// Rasterizes a side's DesignObjectRecord[] onto a plain 2D canvas — the one thing CanvasStage
// (react-konva, deeply interactive: drag/transform/select) doesn't expose, and the one thing the
// 3D mug preview needs (a real bitmap to use as a Three.js texture). Deliberately a separate,
// read-only renderer rather than extending CanvasStage itself — this only ever needs to draw a
// snapshot, never handle input, so it can stay a plain Canvas2D function with no Konva/React
// dependency and no risk to the existing editor.
//
// Covers every object kind the current template library and ordinary customer use actually
// produces (text, image, and the native shape kinds). Effects (shadow/glow/curve) and the rarer
// shape kinds (speech-bubble/banner/heart/arrow) are intentionally not implemented yet — an
// object using one of those still draws its basic fill/position, just without the extra flourish,
// rather than being skipped or crashing the preview.
import type { DesignObjectRecord, ShapeKind } from "./types";

const imageCache = new Map<string, HTMLImageElement>();

function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src);
  if (cached) return Promise.resolve(cached);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = reject;
    img.src = src;
  });
}

function applyTextTransform(text: string, transform: DesignObjectRecord["textTransform"]): string {
  switch (transform) {
    case "uppercase":
      return text.toUpperCase();
    case "lowercase":
      return text.toLowerCase();
    case "title":
      return text.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
    default:
      return text;
  }
}

function drawShapePath(ctx: CanvasRenderingContext2D, kind: ShapeKind, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2;
  switch (kind) {
    case "circle": {
      const r = Math.min(w, h) / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      break;
    }
    case "ellipse":
      ctx.beginPath();
      ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
      break;
    case "rounded-rectangle": {
      const r = Math.min(w, h) * 0.15;
      ctx.beginPath();
      ctx.roundRect(0, 0, w, h, r);
      break;
    }
    case "triangle":
    case "polygon":
    case "diamond": {
      const sides = kind === "triangle" ? 3 : kind === "diamond" ? 4 : 6;
      const r = Math.min(w, h) / 2;
      ctx.beginPath();
      for (let i = 0; i < sides; i++) {
        const angle = (Math.PI * 2 * i) / sides - Math.PI / 2;
        const px = cx + r * Math.cos(angle);
        const py = cy + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }
    case "star": {
      const outerR = Math.min(w, h) / 2;
      const innerR = outerR * 0.5;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const angle = (Math.PI * i) / 5 - Math.PI / 2;
        const px = cx + r * Math.cos(angle);
        const py = cy + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }
    case "line":
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      break;
    default:
      ctx.beginPath();
      ctx.rect(0, 0, w, h);
  }
}

async function drawObject(ctx: CanvasRenderingContext2D, obj: DesignObjectRecord, boxW: number, boxH: number) {
  if (obj.hidden) return;
  const x = obj.normalizedX * boxW;
  const y = obj.normalizedY * boxH;
  const w = obj.normalizedWidth * boxW;
  const h = obj.normalizedHeight * boxH;

  ctx.save();
  ctx.globalAlpha = obj.opacity;
  // Rotate around the object's own center, matching CanvasStage's rotation convention.
  if (obj.rotation) {
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate((obj.rotation * Math.PI) / 180);
    ctx.translate(-(x + w / 2), -(y + h / 2));
  }

  if (obj.type === "image" && obj.assetUrl) {
    try {
      const img = await loadImage(obj.assetUrl);
      ctx.save();
      ctx.translate(x, y);
      if (obj.flipX || obj.flipY) {
        ctx.translate(obj.flipX ? w : 0, obj.flipY ? h : 0);
        ctx.scale(obj.flipX ? -1 : 1, obj.flipY ? -1 : 1);
      }
      if (obj.cropX !== null && obj.cropWidth !== null && obj.cropY !== null && obj.cropHeight !== null) {
        const sx = obj.cropX * img.naturalWidth;
        const sy = obj.cropY * img.naturalHeight;
        const sw = obj.cropWidth * img.naturalWidth;
        const sh = obj.cropHeight * img.naturalHeight;
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
      } else {
        ctx.drawImage(img, 0, 0, w, h);
      }
      ctx.restore();
    } catch {
      // Missing/broken image source — skip drawing it rather than leave a broken-image glyph on
      // what's meant to be a clean product preview.
    }
  } else if (obj.type === "shape" && obj.shapeKind) {
    ctx.translate(x, y);
    drawShapePath(ctx, obj.shapeKind, w, h);
    if (obj.fill) {
      ctx.fillStyle = obj.fill;
      ctx.fill();
    }
    if (obj.strokeColor && obj.strokeWidth) {
      ctx.strokeStyle = obj.strokeColor;
      ctx.lineWidth = obj.strokeWidth;
      ctx.stroke();
    }
  } else if (obj.type === "text" && obj.content) {
    const fontSize = obj.fontSize ?? 24;
    const weight = obj.bold ? "700" : "400";
    const style = obj.italic ? "italic" : "normal";
    ctx.font = `${style} ${weight} ${fontSize}px ${obj.fontFamily ?? "sans-serif"}`;
    ctx.fillStyle = obj.fill ?? "#171412";
    ctx.textBaseline = "middle";
    const align = obj.align ?? "center";
    ctx.textAlign = align;
    const text = applyTextTransform(obj.content, obj.textTransform);
    const textX = align === "left" ? x : align === "right" ? x + w : x + w / 2;
    const textY = y + h / 2;
    if (obj.letterSpacing) {
      // Canvas2D has no native letter-spacing — approximate by drawing char-by-char with manual
      // advance, centered as a block so the overall alignment still matches `align`.
      const chars = [...text];
      const widths = chars.map((c) => ctx.measureText(c).width);
      const totalWidth = widths.reduce((a, b) => a + b, 0) + obj.letterSpacing * (chars.length - 1);
      let cursor = align === "left" ? textX : align === "right" ? textX - totalWidth : textX - totalWidth / 2;
      ctx.textAlign = "left";
      for (let i = 0; i < chars.length; i++) {
        ctx.fillText(chars[i], cursor, textY);
        cursor += widths[i] + obj.letterSpacing;
      }
    } else {
      ctx.fillText(text, textX, textY);
    }
  }

  ctx.restore();
}

/** Draws every object in order (array order = z-order, matching CanvasStage) onto a freshly
 *  created canvas sized boxW x boxH CSS px, and resolves with that canvas once every image has
 *  finished loading. `background` paints behind everything (mug ceramic base colour) so a design
 *  with transparent gaps doesn't show through to whatever the texture would otherwise default to. */
export async function renderDesignToCanvas(
  objects: DesignObjectRecord[],
  boxW: number,
  boxH: number,
  background: string = "#FFFFFF",
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  const scale = 2; // supersample for a crisper texture than a 1:1 CSS-px canvas would give
  canvas.width = boxW * scale;
  canvas.height = boxH * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.scale(scale, scale);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, boxW, boxH);
  for (const obj of objects) {
    await drawObject(ctx, obj, boxW, boxH);
  }
  return canvas;
}
