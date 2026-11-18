import type { DesignObjectRecord } from "@/lib/studio/types";

/** Stamps each object's `zIndex` to match its position in the array, for every side.
 *
 *  Extracted as a pure function (rather than left inline in StudioClient.tsx) specifically so it
 *  can be unit-tested -- this codebase's test runner cannot load .tsx files at all (confirmed via
 *  ERR_UNKNOWN_FILE_EXTENSION), the same reason src/components/ui/productImageFallback.ts exists
 *  as its own file.
 *
 *  Why this exists: array order is already the real, authoritative stacking order while editing
 *  (Konva/React render in array order), but `zIndex` was previously written once as a hardcoded
 *  `0` on object creation and never updated on reorder (moveLayer, moveLayerToEdge,
 *  duplicateLayer all just reordered the in-memory array). loadProjectRecord.ts sorts loaded
 *  objects by `zIndex` to reconstruct stacking order on reload -- with every object's zIndex
 *  stuck at 0, that sort was a no-op, so a saved design's front/back order on reopen depended on
 *  whatever order the database happened to return rows in, not the customer's chosen order.
 *
 *  Preserves object identity (returns the same object reference) when its zIndex already matches
 *  its index, so this is cheap to call on every commit without creating needless new objects for
 *  unrelated re-render/memoization checks. */
export function syncZIndexToOrder<T extends Partial<Record<string, DesignObjectRecord[]>>>(sides: T): T {
  const result = { ...sides } as T;
  for (const side of Object.keys(sides) as (keyof T)[]) {
    const objects = sides[side];
    if (!objects) continue;
    result[side] = objects.map((o, i) => (o.zIndex === i ? o : { ...o, zIndex: i })) as T[keyof T];
  }
  return result;
}
