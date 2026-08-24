import type { DesignSideType } from "./types";

// MVP print-area template: one representative geometry per location, applied uniformly rather
// than per-product-per-size. This is a deliberate simplification, not a real registered
// print-area spec — a real one needs Maple's actual production measurements per garment/size,
// which isn't in the current supplier data. `PRINT_AREA_TEMPLATE_VERSION` is stored on every
// DesignProject specifically so if/when real per-product geometry replaces this, existing designs
// keep the geometry they were created under rather than silently shifting.
//
// Only three locations are offered: full front, full back, and left chest — all real, physically
// plausible print positions for a standard tee, and all coverable with the photography this site
// already has (left-chest just uses the front photo with a smaller, upper-body-positioned print
// box — it isn't a separate camera angle). Sleeve, collar, shoulder, and upper-back/nape are
// deliberately NOT offered yet: S&S's product photography here is front/back only, so there is no
// real image to show a customer what a sleeve print would look like on THIS garment, and Maple
// hasn't confirmed those positions are physically supported across the catalogue's construction
// types. Adding a location here without a matching mockup photo would show the customer a front
// view while claiming to preview a sleeve print — exactly the kind of "mystery" placement the
// brief warns against. Extend this file (and mockupImages) once real per-location photography or
// confirmed shop capability exists.
export const PRINT_AREA_TEMPLATE_VERSION = "v2-apparel-front-back-leftchest";

export const PRINT_AREAS: Record<DesignSideType, { widthIn: number; heightIn: number; safeMarginIn: number }> = {
  front: { widthIn: 12, heightIn: 16, safeMarginIn: 0.25 },
  back: { widthIn: 12, heightIn: 16, safeMarginIn: 0.25 },
  // Industry-standard "left chest" logo area — small and fixed-size rather than scaled to the
  // garment, matching how chest-logo decoration is conventionally sized regardless of shirt size.
  "left-chest": { widthIn: 4, heightIn: 4, safeMarginIn: 0.15 },
};

/** Where each location's print area sits over its garment product photo, as a fraction of the
 *  image's own width/height. S&S product photos are front-facing flat-lay/ghost-mannequin shots
 *  with the garment roughly centered and filling most of the frame, so fixed boxes are a
 *  reasonable MVP approximation across products — not a per-product calibrated overlay.
 *  left-chest's box sits in the wearer's upper-left chest area of the SAME front photo used for
 *  the "front" location (mirrored: appears on the garment's right side visually, chest-left on
 *  the wearer, matching real-world chest-logo placement convention). */
export const MOCKUP_PRINT_AREA_BOX: Record<DesignSideType, { xFrac: number; yFrac: number; widthFrac: number; heightFrac: number }> = {
  front: { xFrac: 0.3, yFrac: 0.22, widthFrac: 0.4, heightFrac: 0.36 },
  back: { xFrac: 0.3, yFrac: 0.22, widthFrac: 0.4, heightFrac: 0.36 },
  "left-chest": { xFrac: 0.56, yFrac: 0.22, widthFrac: 0.14, heightFrac: 0.11 },
};

/** left-chest reuses the front garment photo — there's no distinct camera angle for it. */
export function mockupViewFor(location: DesignSideType): DesignSideType {
  return location === "left-chest" ? "front" : location;
}

/** Only apparel with a real torso silhouette gets the left-chest option — hats/bags/aprons don't
 *  have a "chest," and offering it there would be a location with no physical meaning. */
export function locationsFor(categorySlug: string): DesignSideType[] {
  const isApparel = categorySlug === "custom-apparel" || categorySlug === "workwear-uniforms";
  return isApparel ? ["front", "left-chest", "back"] : ["front", "back"];
}
