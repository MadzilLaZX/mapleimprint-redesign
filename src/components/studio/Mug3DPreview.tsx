"use client";

// Real-time 3D mug preview — "so customers can see the design they picked on the actual
// drinkware," not just the flat wrap schematic. The mug itself is procedural geometry (a
// cylinder + a partial-torus handle), not an imported 3D model — same reasoning as the Designs
// panel's icon library (assetProviders.ts's "CORE BUSINESS DECISION": no paid/unverified-license
// asset source). The one thing this DOES load dynamically is the customer's own design, rasterized
// from their live DesignObjectRecord[] via renderDesignToCanvas and applied as a texture on a
// partial cylinder "decal" wrapped around the body — this is what makes it a live preview of THIS
// design, not a generic mug render.
import { useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import type { DesignObjectRecord } from "@/lib/studio/types";
import { renderDesignToCanvas } from "@/lib/studio/renderDesignToCanvas";
import { PRINT_AREAS } from "@/lib/studio/printAreas";

const MUG_RADIUS = 1.15;
const MUG_HEIGHT = 2.3;
const WALL_THICKNESS = 0.07;

function degToRad(d: number) {
  return (d * Math.PI) / 180;
}

// Three.js's CylinderGeometry places theta=0 at local (0, y, radius) — i.e. +Z, not +X — and
// sweeps as x = radius*sin(theta), z = radius*cos(theta). Every angle below is defined in that
// SAME convention and derived from it (polarXZ), rather than hand-placed by eye, specifically
// because mismatching the handle's hardcoded position against the decal geometry's own theta=0
// was the actual bug here (confirmed empirically: the two were 90° apart, which silently pointed
// the default camera at the blank gap instead of the design).
function polarXZ(angleDeg: number, radius: number): [number, number] {
  const rad = degToRad(angleDeg);
  return [radius * Math.sin(rad), radius * Math.cos(rad)];
}

const HANDLE_ANGLE_DEG = 90; // local +X, where the handle mesh's own position prop puts it
const GAP_HALF_WIDTH_DEG = 30;
// Real mug wraps don't cover the full circumference — a gap is left where the handle attaches.
// Centered on the handle's own angle (not an independently-guessed one), so the two always agree
// regardless of what HANDLE_ANGLE_DEG is set to.
const DESIGN_START_DEG = HANDLE_ANGLE_DEG + GAP_HALF_WIDTH_DEG;
const DESIGN_ARC_DEG = 360 - GAP_HALF_WIDTH_DEG * 2;
// The design's own center angle, diametrically opposite the handle — this is what the camera
// needs to look at, not theta=0.
const DESIGN_CENTER_DEG = HANDLE_ANGLE_DEG + 180;

function MugModel({ texture }: { texture: THREE.CanvasTexture | null }) {
  return (
    <group rotation={[0, 0, 0]}>
      {/* Outer ceramic body */}
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[MUG_RADIUS, MUG_RADIUS, MUG_HEIGHT, 64, 1, true]} />
        <meshStandardMaterial color="#FAFAF7" roughness={0.35} metalness={0.04} side={THREE.DoubleSide} />
      </mesh>
      {/* Inner wall — visible looking down into the mug, keeps it from reading as a hollow shell */}
      <mesh position={[0, MUG_HEIGHT * 0.01, 0]}>
        <cylinderGeometry args={[MUG_RADIUS - WALL_THICKNESS, MUG_RADIUS - WALL_THICKNESS, MUG_HEIGHT * 0.97, 64, 1, true]} />
        <meshStandardMaterial color="#EDEAE2" roughness={0.55} side={THREE.BackSide} />
      </mesh>
      {/* Bottom */}
      <mesh position={[0, -MUG_HEIGHT / 2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[MUG_RADIUS, 64]} />
        <meshStandardMaterial color="#FAFAF7" roughness={0.35} />
      </mesh>
      {/* Rim ring — caps the open-top wall edge so it doesn't read as paper-thin */}
      <mesh position={[0, MUG_HEIGHT / 2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[MUG_RADIUS - WALL_THICKNESS, MUG_RADIUS, 64]} />
        <meshStandardMaterial color="#FAFAF7" roughness={0.3} side={THREE.DoubleSide} />
      </mesh>
      {/* Design wrap — a thin decal cylinder just outside the body, textured with the live design */}
      {texture && (
        <mesh>
          <cylinderGeometry
            args={[MUG_RADIUS + 0.006, MUG_RADIUS + 0.006, MUG_HEIGHT * 0.74, 64, 1, true, degToRad(DESIGN_START_DEG), degToRad(DESIGN_ARC_DEG)]}
          />
          <meshStandardMaterial map={texture} roughness={0.42} side={THREE.DoubleSide} />
        </mesh>
      )}
      {/* Handle — a partial torus, attached on the +X side */}
      <mesh position={[MUG_RADIUS + 0.3, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <torusGeometry args={[0.44, 0.115, 16, 48, Math.PI * 1.35]} />
        <meshStandardMaterial color="#FAFAF7" roughness={0.35} />
      </mesh>
    </group>
  );
}

function LoadingSpinnerOverlay() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-canvas/60">
      <div className="size-8 animate-spin rounded-full border-2 border-sand border-t-ink-950" />
    </div>
  );
}

/** `objects` is the live `sides["mug-wrap"]` array — re-rasterized to a fresh texture whenever it
 *  changes, so rotating the mug always shows the customer's current edits, not a stale snapshot. */
export function Mug3DPreview({ objects }: { objects: DesignObjectRecord[] }) {
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  const [loading, setLoading] = useState(true);
  const printArea = PRINT_AREAS["mug-wrap"];
  // Real 8in x 3.3in wrap aspect, rendered at a fixed pixel density — matches the decal cylinder's
  // own height*circumference-arc aspect closely enough that the texture doesn't look stretched.
  const boxW = 1024;
  const boxH = Math.round(boxW * (printArea.heightIn / printArea.widthIn));

  useEffect(() => {
    let cancelled = false;
    // Loading starts true (useState default) for the first render; a re-run from here on only
    // happens when `objects` changes (a live edit), which regenerates fast enough not to need the
    // spinner again — and re-asserting it synchronously in the effect body is what React's
    // set-state-in-effect rule flags (same fix as StickerConfigurator's shape-change handler).
    renderDesignToCanvas(objects, boxW, boxH, "#FAFAF7").then((canvas) => {
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
  }, [JSON.stringify(objects)]);

  useEffect(() => () => texture?.dispose(), [texture]);

  // Faces the design's actual center angle (diametrically opposite the handle), not an arbitrary
  // fixed axis — see DESIGN_CENTER_DEG's comment for why that distinction was the real bug here.
  // A small extra rotation off dead-center gives a more natural three-quarter product-shot angle
  // rather than a flat, perfectly head-on view.
  const cameraPosition = useMemo<[number, number, number]>(() => {
    const [x, z] = polarXZ(DESIGN_CENTER_DEG - 18, 7.2);
    return [x, 0.35, z];
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-3xl bg-canvas">
      {loading && <LoadingSpinnerOverlay />}
      <Canvas shadows camera={{ position: cameraPosition, fov: 32 }} dpr={[1, 2]}>
        <ambientLight intensity={0.65} />
        <directionalLight position={[3, 4, 3]} intensity={1.1} castShadow shadow-mapSize={[1024, 1024]} />
        <directionalLight position={[-3, 2, -2]} intensity={0.35} />
        <MugModel texture={texture} />
        <ContactShadows position={[0, -MUG_HEIGHT / 2 - 0.01, 0]} opacity={0.35} scale={6} blur={2.2} far={2} />
        <Environment preset="apartment" environmentIntensity={0.5} />
        <OrbitControls
          enablePan={false}
          minDistance={4}
          maxDistance={10}
          minPolarAngle={Math.PI / 3.2}
          maxPolarAngle={Math.PI / 1.7}
          autoRotate
          autoRotateSpeed={1.2}
        />
      </Canvas>
    </div>
  );
}
