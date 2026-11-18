import { test } from "node:test";
import assert from "node:assert/strict";
import { syncZIndexToOrder } from "./syncZIndexToOrder.ts";
import type { DesignObjectRecord } from "./types.ts";

function fixtureObject(id: string, zIndex: number): DesignObjectRecord {
  return {
    id,
    type: "shape",
    assetUrl: null,
    content: null,
    fontFamily: null,
    fontSize: null,
    fill: "#000000",
    normalizedX: 0.1,
    normalizedY: 0.1,
    normalizedWidth: 0.3,
    normalizedHeight: 0.3,
    rotation: 0,
    opacity: 1,
    zIndex,
    name: null,
    hidden: false,
    bold: false,
    italic: false,
    align: null,
    letterSpacing: null,
    lineHeight: null,
    curve: null,
    shapeKind: "rectangle",
    strokeColor: null,
    strokeWidth: null,
    flipX: false,
    flipY: false,
    cropX: null,
    cropY: null,
    cropWidth: null,
    cropHeight: null,
    qrDestination: null,
    qrErrorCorrection: null,
    qrForegroundColor: null,
    qrBackgroundColor: null,
    qrDotStyle: null,
    qrCornerStyle: null,
    qrLogoUrl: null,
  } as DesignObjectRecord;
}

test("stamps zIndex to match each object's array position, per side", () => {
  // Deliberately seeded with every zIndex wrong/stale (the real-world bug: every object was
  // created with a hardcoded zIndex of 0 and never updated on reorder).
  const sides = {
    front: [fixtureObject("a", 0), fixtureObject("b", 0), fixtureObject("c", 0)],
    back: [fixtureObject("x", 0), fixtureObject("y", 0)],
  };
  const result = syncZIndexToOrder(sides);
  assert.deepEqual(result.front.map((o) => o.zIndex), [0, 1, 2]);
  assert.deepEqual(result.back.map((o) => o.zIndex), [0, 1]);
});

test("reordering the array (e.g. moveLayerToEdge sending the first object to the back of the array) updates zIndex to match the new order", () => {
  const reordered = {
    front: [fixtureObject("b", 0), fixtureObject("c", 0), fixtureObject("a", 0)],
  };
  const result = syncZIndexToOrder(reordered);
  assert.deepEqual(
    result.front.map((o) => [o.id, o.zIndex]),
    [
      ["b", 0],
      ["c", 1],
      ["a", 2],
    ],
  );
});

test("does not mutate the input", () => {
  const sides = { front: [fixtureObject("a", 0), fixtureObject("b", 0)] };
  const snapshot = JSON.parse(JSON.stringify(sides));
  syncZIndexToOrder(sides);
  assert.deepEqual(sides, snapshot);
});

test("returns the same object reference (no unnecessary copy) when zIndex already matches the array position", () => {
  const already = fixtureObject("a", 0);
  const sides = { front: [already] };
  const result = syncZIndexToOrder(sides);
  assert.equal(result.front[0], already);
});

test("skips sides with no objects (undefined) without throwing", () => {
  const sides = { front: [fixtureObject("a", 0)], back: undefined };
  const result = syncZIndexToOrder(sides);
  assert.deepEqual(result.front.map((o) => o.zIndex), [0]);
  assert.equal(result.back, undefined);
});
