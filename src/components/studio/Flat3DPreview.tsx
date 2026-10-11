"use client";

// Generic 3D preview for every flat-printed product (business cards, postcards, flyers, posters,
// banners, stickers, and the gifts-promo/packaging "accessory" family) — the same role
// Mug3DPreview plays for drinkware, just for a print piece that's a physical rectangle rather than
// a vessel. Renders the live design as a texture on a thin card-like object: a backing box (plain
// stock color on every face) plus a separate design plane layered just in front of it, rather than
// a per-face BoxGeometry material array — this app's camera/controls setup puts the design-facing
// side at local -Z (confirmed empirically against this exact Canvas/OrbitControls configuration,
// not assumed from Three.js docs in the abstract), so the plane sits at -(depth/2) and is rotated
// 180° on Y so its textured face — not its back — is what actually points at the camera. Sized at
// the print area's own real aspect ratio so nothing looks stretched. Not every accessory-family
// product (tote bags, pens, phone stands) is literally a flat rectangle in real life — this is an
// honest "see your design as a rotatable 3D object" stand-in for those, not a bespoke sculpt of
// each item's real shape.
import { useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import type { DesignObjectRecord } from "@/lib/studio/types";
import { renderDesignToCanvas } from "@/lib/studio/renderDesignToCanvas";

const MAX_DIM_UNITS = 2.6; // same overall scale Mug3DPreview's body occupies in its scene

function LoadingSpinnerOverlay() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-canvas/60">
      <div className="size-8 animate-spin rounded-full border-2 border-sand border-t-ink-950" />
    </div>
  );
}

function PieceModel({ texture, width, height, depth }: { texture: THREE.CanvasTexture | null; width: number; height: number; depth: number }) {
  return (
    <group>
      {/* Backing/edge box — plain stock color on every face; the front face sits just behind the
          design plane below so it never shows through or z-fights with it. */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color="#E4DCCB" roughness={0.8} metalness={0} />
      </mesh>
      {/* Design plane — see this file's header comment for why -Z + a 180° Y rotation is what
          actually faces the camera in this scene, not the more "obvious" unrotated +Z placement. */}
      <mesh position={[0, 0, -(depth / 2 + 0.0015)]} rotation={[0, Math.PI, 0]} castShadow>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial map={texture ?? undefined} roughness={0.55} metalness={0} />
      </mesh>
    </group>
  );
}

/** `objects` is the live design for the active location; `widthIn`/`heightIn` are that location's
 *  real print-area dimensions (PRINT_AREAS[activeSide], with the banner override applied by the
 *  caller) — this is what keeps the box's proportions honest across every very differently-shaped
 *  product (a 3.5x2 card vs an 8x30 banner) without hardcoding per-product numbers here. */
export function Flat3DPreview({
  objects,
  widthIn,
  heightIn,
}: {
  objects: DesignObjectRecord[];
  widthIn: number;
  heightIn: number;
}) {
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  const [loading, setLoading] = useState(true);

  const boxW = 1024;
  const boxH = Math.round(boxW * (heightIn / widthIn));

  useEffect(() => {
    let cancelled = false;
    renderDesignToCanvas(objects, boxW, boxH, "#FFFFFF").then((canvas) => {
      if (cancelled) return;
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      setTexture((prev) => {
        prev?.dispose();
        return tex;
      });
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(objects), boxW, boxH]);

  useEffect(() => () => texture?.dispose(), [texture]);

  const dims = useMemo(() => {
    const maxDim = Math.max(widthIn, heightIn);
    const scale = MAX_DIM_UNITS / maxDim;
    const width = widthIn * scale;
    const height = heightIn * scale;
    // Thin but visible — a real printed piece has an edge, even a business card; capped so a
    // huge banner's depth doesn't look like a slab relative to its own face.
    const depth = Math.min(0.08, Math.max(0.025, Math.min(width, height) * 0.03));
    return { width, height, depth };
  }, [widthIn, heightIn]);

  // A mild 3/4 product-shot angle, mostly front-on — a small azimuth turn (not 45°+, which would
  // foreshorten a wide piece like a banner down to a sliver) plus a gentle elevation, matching the
  // same "slightly off dead-center" framing Mug3DPreview uses for its own default camera angle.
  const cameraPosition = useMemo<[number, number, number]>(() => {
    const maxDim = Math.max(dims.width, dims.height);
    const distance = maxDim * 1.9;
    const azimuth = (18 * Math.PI) / 180;
    const elevation = (12 * Math.PI) / 180;
    const x = distance * Math.sin(azimuth) * Math.cos(elevation);
    const y = distance * Math.sin(elevation);
    const z = distance * Math.cos(azimuth) * Math.cos(elevation);
    return [x, y, z];
  }, [dims]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-3xl bg-canvas">
      {loading && <LoadingSpinnerOverlay />}
      <Canvas shadows camera={{ position: cameraPosition, fov: 32 }} dpr={[1, 2]}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 4, 3]} intensity={1.1} castShadow shadow-mapSize={[1024, 1024]} />
        <directionalLight position={[-3, 2, -2]} intensity={0.35} />
        <PieceModel texture={texture} width={dims.width} height={dims.height} depth={dims.depth} />
        <ContactShadows position={[0, -dims.height / 2 - 0.01, 0]} opacity={0.3} scale={Math.max(dims.width, dims.height) * 3} blur={2.2} far={2} />
        <Environment preset="apartment" environmentIntensity={0.5} />
        <OrbitControls
          enablePan={false}
          minDistance={Math.max(dims.width, dims.height) * 1.1}
          maxDistance={Math.max(dims.width, dims.height) * 5}
          minPolarAngle={Math.PI / 3.5}
          maxPolarAngle={Math.PI / 1.7}
          autoRotate
          autoRotateSpeed={1.2}
        />
      </Canvas>
    </div>
  );
}
