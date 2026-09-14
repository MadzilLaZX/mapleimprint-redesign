// GarmentView vs PrintArea (STUDIO V3 brief, Section 8/27): a VIEW answers "what surface is the
// customer looking at" (the front photo, the back photo, the left-sleeve schematic...); a PRINT
// AREA answers "which production region owns these design objects" (front, left-chest, right-chest
// are three separate print areas that all happen to sit on the same front-photo view). Collapsing
// these two was the root cause of "designing Left Chest makes the Front artwork disappear" — this
// file is the one place that groups a product's open print areas back into their shared views, so
// StudioClient/PreviewMode/ReviewPanel can composite a view's artwork together without merging the
// underlying per-location DesignSide records (which stay completely separate — see StudioClient).

import { backgroundKindFor, type BackgroundKind } from "./printAreas";
import type { DecorationLocation } from "./productDecorationProfile";
import type { DesignSideType } from "./types";

export interface GarmentViewGroup {
  /** Which shared background this view renders — also the stable grouping key. */
  view: BackgroundKind;
  /** Every location in this group, in profile order (first is treated as the "primary" location
   *  for labeling purposes, e.g. Preview/Review tab titles). */
  locations: DesignSideType[];
}

/** Groups a set of print-area ids (typically `openSides`, i.e. locations that actually have a
 *  DesignSide row) by shared GarmentView, preserving the product profile's own location order.
 *  Locations not present in `profile` are ignored (defensive — shouldn't happen in practice). */
export function groupLocationsByView(locationIds: DesignSideType[], profile: DecorationLocation[]): GarmentViewGroup[] {
  const groups = new Map<BackgroundKind, DesignSideType[]>();
  for (const loc of profile) {
    if (!locationIds.includes(loc.id)) continue;
    const key = backgroundKindFor(loc.viewType);
    const existing = groups.get(key);
    if (existing) existing.push(loc.id);
    else groups.set(key, [loc.id]);
  }
  return [...groups.entries()].map(([view, locations]) => ({ view, locations }));
}

/** The full group (open or not) that a given location belongs to, among every location the
 *  product's family supports — used by the editor to know which OTHER locations' artwork should
 *  stay visible while this one is being edited, even before they have their own DesignSide row. */
export function viewGroupFor(locationId: DesignSideType, profile: DecorationLocation[]): DesignSideType[] {
  const loc = profile.find((l) => l.id === locationId);
  if (!loc) return [locationId];
  const key = backgroundKindFor(loc.viewType);
  return profile.filter((l) => backgroundKindFor(l.viewType) === key).map((l) => l.id);
}
