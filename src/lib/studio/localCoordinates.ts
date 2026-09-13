// Pure math for mapping a point inside a print area's LOCAL (unrotated) coordinate frame to its
// actual position on the Konva stage, once that print area's Group has been translated to its
// mockup position and rotated (see CanvasStage.tsx). Kept separate from CanvasStage/Konva entirely
// so it's plain, testable geometry — the same reason DesignObjectRecord's normalizedX/Y never
// depend on rotation: Konva's own Group transform does the rotating, this only exists for the one
// case that can't lean on Konva directly (the HTML text-edit overlay, which is a real DOM element
// positioned on top of the canvas, not a Konva node).

export interface RotatedFrame {
  /** Stage-space center of the print area (post-rotation pivot point). */
  centerX: number;
  centerY: number;
  /** Local (unrotated) width/height of the print area. */
  width: number;
  height: number;
  rotationDeg: number;
}

/** Maps a point given in the print area's local, top-left-origin, unrotated coordinate space
 *  (the same space DesignObjectRecord's normalizedX/Y * box.width/height live in) to its real
 *  stage coordinates after the frame's translation + rotation. */
export function localPointToStage(localX: number, localY: number, frame: RotatedFrame): { x: number; y: number } {
  const rad = (frame.rotationDeg * Math.PI) / 180;
  const dx = localX - frame.width / 2;
  const dy = localY - frame.height / 2;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: frame.centerX + dx * cos - dy * sin,
    y: frame.centerY + dx * sin + dy * cos,
  };
}
