import type { DesignSideType } from "./types";

// MVP print-area template: one representative geometry for apparel front/back, applied uniformly
// rather than per-product-per-size. This is a deliberate simplification, not a real registered
// print-area spec — a real one needs Maple's actual production measurements per garment/size,
// which isn't in the current supplier data. `PRINT_AREA_TEMPLATE_VERSION` is stored on every
// DesignProject specifically so if/when real per-product geometry replaces this, existing designs
// keep the geometry they were created under rather than silently shifting.
export const PRINT_AREA_TEMPLATE_VERSION = "v1-apparel-front-back";

export const PRINT_AREAS: Record<DesignSideType, { widthIn: number; heightIn: number; safeMarginIn: number }> = {
  front: { widthIn: 12, heightIn: 16, safeMarginIn: 0.25 },
  back: { widthIn: 12, heightIn: 16, safeMarginIn: 0.25 },
};

/** Where the print area sits over a garment product photo, as a fraction of the image's own
 *  width/height. S&S product photos are front-facing flat-lay/ghost-mannequin shots with the
 *  garment roughly centered and filling most of the frame, so a fixed centered box is a
 *  reasonable MVP approximation across products — not a per-product calibrated overlay. */
export const MOCKUP_PRINT_AREA_BOX = { xFrac: 0.3, yFrac: 0.22, widthFrac: 0.4, heightFrac: 0.36 };
