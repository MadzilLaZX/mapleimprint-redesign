"use client";

// Generic 3D preview for every flat-printed product (business cards, postcards, flyers, posters,
// banners, stickers, and most of the gifts-promo/packaging "accessory" family) — the same role
// Mug3DPreview plays for drinkware, just for a print piece that's a physical rectangle rather than
// a vessel. Renders the live design as a texture on a thin card-like object: a backing box (plain
// stock color on every face) plus a separate design plane layered just in front of it, rather than
// a per-face BoxGeometry material array — this app's camera/controls setup puts the design-facing
// side at local +Z (confirmed empirically against this exact Canvas/OrbitControls configuration,
// not assumed from Three.js docs in the abstract — the default camera position's x/y/z are all
// positive, looking back toward the origin, so the box face nearer the camera is +Z), so the plane
// sits just outside the box's own +Z face with no extra rotation. Sized at the print area's own
// real aspect ratio so nothing looks stretched.
//
// (Fixed as part of this change: the design plane previously sat at -Z with a 180°-Y rotation,
// which put it on the box's FAR side — fully occluded by the box itself at every default camera
// angle, so the "flat" preview silently rendered a blank backing box for every product using it,
// not just the four below. Confirmed by live-rendering an unmodified control product (keychains)
// before and after this fix.)
//
// Four accessory-family products look obviously wrong as a flat card — tote bags, pens, notebooks,
// phone stands — so they get a bespoke procedural shape below (same "no imported 3D model, every
// shape is primitives" policy as Mug3DPreview's header comment), following the exact same
// VesselParams-table pattern Mug3DPreview already proved scales to several very different
// silhouettes in one component. Every other accessory product (stickers, keychains, magnets,
// coasters, packaging boxes, etc.) keeps rendering through the plain `PieceModel` box below,
// completely unchanged in shape — `kind` defaults to "flat" for exactly that reason, and now
// actually shows the design on it too.
import { useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import type { DesignObjectRecord } from "@/lib/studio/types";
import type { AccessoryKind } from "@/lib/studio/preview3d";
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
      {/* Design plane — this app's camera/controls setup puts the design-facing side at local
          +Z for this exact Canvas/OrbitControls configuration (default camera position's x/y/z are
          all positive, looking back toward the origin — so the box face nearer the camera, the one
          that must carry the decal, is +Z, not -Z). Confirmed empirically by live-rendering an
          unmodified flat product: a +Z/no-rotation plane shows the design at the default angle,
          while the previous -Z + 180°-Y-rotation placement rendered a blank backing box — the
          decal was sitting on the box's FAR side, fully occluded, at every default camera angle.
          Positioned just outside the box's own +Z face so it doesn't z-fight with it. */}
      <mesh position={[0, 0, depth / 2 + 0.0015]} castShadow>
        <planeGeometry args={[width, height]} />
        {/* toneMapped={false}: this plane is a UI-like printed design, not a lit physical surface
            whose color should respond to the scene's filmic tone-mapping curve — with tone mapping
            on, the curve compresses/brightens mid-tones, which is exactly what was quietly washing
            out a template's lighter secondary text (confirmed by comparing the same text's color
            directly in the 2D canvas, which reads clearly, against the 3D render, which didn't,
            with geometry/facing/camera angle all otherwise already correct). */}
        <meshStandardMaterial map={texture ?? undefined} roughness={0.55} metalness={0} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------------------------
// Bespoke accessory shapes. Each one reuses PieceModel's already-proven decal-plane technique
// verbatim wherever it needs a flat printed face — never re-deriving which local axis faces the
// camera, only composing proven pieces (plus, where a shape needs the design on a face other than
// the default front, a single whole-group rotation applied AROUND that proven piece, confirmed
// live in-browser since a composed rotation can't be reasoned about purely on paper — see the
// per-shape notes below).
// ---------------------------------------------------------------------------------------------

interface AccessoryBodyParams {
  width: number;
  depth: number;
  bodyColor: string;
  roughness: number;
  metalness: number;
  /** Camera elevation/azimuth overrides — most bespoke shapes keep Flat3DPreview's default
   *  mild three-quarter angle, but a couple (notebook) need a steeper look-down to actually see
   *  the face the design lives on. */
  cameraElevationDeg: number;
  cameraAzimuthDeg: number;
}

// Tote bag: a flattened fabric-like box using the exact same proven PieceModel decal (fabric tone
// instead of card stock — PieceModel's color is hardcoded, so this rebuilds its two meshes rather
// than parameterizing color into it) plus two handle loops. torusGeometry's own theta=0 sits at
// local (radius,0,0), sweeping through local (0,radius,0) at theta=90° — so a thetaLength of PI
// starting at theta=0 traces exactly the UPPER half of the ring (y >= 0 throughout), i.e. a "∩"
// arc. Its two attach points (at theta=0 and theta=PI) sit at y=0 relative to the torus's own
// center, so that center is positioned AT the bag's top edge (TOTE_HEIGHT/2) — not above it — so
// the loop's feet actually meet the bag body instead of floating disconnected above it (an earlier
// version placed the center a radius above the edge, confirmed by a live screenshot showing the
// handles floating free in space).
const TOTE_PARAMS: AccessoryBodyParams = {
  width: 2.15,
  depth: 0.34,
  bodyColor: "#D9C7A1", // natural canvas tan
  roughness: 0.92,
  metalness: 0,
  cameraElevationDeg: 12,
  cameraAzimuthDeg: 18,
};
const TOTE_HEIGHT = 2.5;
const TOTE_HANDLE_RADIUS = 0.42;
const TOTE_HANDLE_TUBE = 0.055;

function ToteBagModel({ texture }: { texture: THREE.CanvasTexture | null }) {
  const handleX = TOTE_PARAMS.width * 0.28;
  const handleY = TOTE_HEIGHT / 2;
  const handleMaterial = (
    <meshStandardMaterial color={TOTE_PARAMS.bodyColor} roughness={TOTE_PARAMS.roughness} metalness={0} />
  );
  return (
    <group>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[TOTE_PARAMS.width, TOTE_HEIGHT, TOTE_PARAMS.depth]} />
        <meshStandardMaterial color={TOTE_PARAMS.bodyColor} roughness={TOTE_PARAMS.roughness} metalness={TOTE_PARAMS.metalness} />
      </mesh>
      {/* Design plane — same +Z, no-rotation placement as PieceModel's own (see this file's header
          comment), sized slightly smaller than the body so it reads as a printed panel on fabric
          rather than edge-to-edge coverage. */}
      <mesh position={[0, 0, TOTE_PARAMS.depth / 2 + 0.0015]} castShadow>
        <planeGeometry args={[TOTE_PARAMS.width * 0.82, TOTE_HEIGHT * 0.82]} />
        {/* toneMapped={false} — see PieceModel's own decal plane comment above. */}
        <meshStandardMaterial map={texture ?? undefined} roughness={0.6} metalness={0} toneMapped={false} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * handleX, handleY, 0]} castShadow>
          <torusGeometry args={[TOTE_HANDLE_RADIUS, TOTE_HANDLE_TUBE, 16, 32, Math.PI]} />
          {handleMaterial}
        </mesh>
      ))}
    </group>
  );
}

// Pen: a slim cylinder barrel wrapped in the design (same partial/full-wrap decal technique
// Mug3DPreview already uses for its handle-less vessels — a thin outer cylinder, open-ended, with
// the design texture mapped around nearly the full circumference minus a small seam) plus a
// tapered cone nib and a small flattened clip. Wrapping (nearly) the full barrel rather than
// picking one camera-facing arc sidesteps needing a second independent "which angle faces the
// camera" derivation for a cylindrical surface in this file — the design is visible from any
// rotation, which also happens to be how real promotional pen barrel prints usually wrap anyway.
const PEN_BODY_RADIUS = 0.11;
const PEN_BODY_LENGTH = 3.3;
const PEN_TIP_LENGTH = 0.5;
const PEN_CLIP_LENGTH = 1.05;

function PenModel({ texture }: { texture: THREE.CanvasTexture | null }) {
  const bodyColor = "#23262B";
  const trimColor = "#C9CCD1";
  const seamGapDeg = 6;
  const arc = ((360 - seamGapDeg) * Math.PI) / 180;
  const start = (-(360 - seamGapDeg) / 2) * (Math.PI / 180);
  return (
    // The barrel lies along local X here (rotated 90° about Z from cylinderGeometry's native
    // Y-axis) so the pen reads as lying on its side, the natural way a promotional pen is shown.
    <group rotation={[0, 0, Math.PI / 2]}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[PEN_BODY_RADIUS, PEN_BODY_RADIUS, PEN_BODY_LENGTH, 48]} />
        <meshStandardMaterial color={bodyColor} roughness={0.3} metalness={0.5} />
      </mesh>
      {/* Design wrap — thin decal cylinder just outside the body, nearly full circumference. */}
      {texture && (
        <mesh>
          <cylinderGeometry args={[PEN_BODY_RADIUS + 0.004, PEN_BODY_RADIUS + 0.004, PEN_BODY_LENGTH * 0.82, 48, 1, true, start, arc]} />
          {/* toneMapped={false} — see PieceModel's own decal plane comment above. */}
          <meshStandardMaterial map={texture} roughness={0.4} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      )}
      {/* Tip */}
      <mesh position={[0, PEN_BODY_LENGTH / 2 + PEN_TIP_LENGTH / 2, 0]} castShadow>
        <coneGeometry args={[PEN_BODY_RADIUS, PEN_TIP_LENGTH, 48]} />
        <meshStandardMaterial color={trimColor} roughness={0.2} metalness={0.7} />
      </mesh>
      {/* Cap end */}
      <mesh position={[0, -PEN_BODY_LENGTH / 2 - 0.05, 0]} castShadow>
        <cylinderGeometry args={[PEN_BODY_RADIUS * 0.96, PEN_BODY_RADIUS * 0.96, 0.1, 48]} />
        <meshStandardMaterial color={trimColor} roughness={0.2} metalness={0.7} />
      </mesh>
      {/* Clip — a thin flattened box riding the top of the barrel near the cap end. The barrel's
          own long axis is local Y (cylinderGeometry's native height axis, before this whole group
          gets rotated 90° about Z to lie on its side) — the clip's length must run along that same
          Y axis too, offset radially outward on X, not the other way around (an earlier version of
          this put the length offset on X, which sent the clip ~1 unit sideways off the barrel
          entirely, confirmed by a live screenshot showing it floating disconnected from the pen). */}
      <mesh position={[PEN_BODY_RADIUS + 0.03, -PEN_BODY_LENGTH / 2 + PEN_CLIP_LENGTH / 2 + 0.1, 0]} castShadow>
        <boxGeometry args={[0.06, PEN_CLIP_LENGTH, 0.05]} />
        <meshStandardMaterial color={trimColor} roughness={0.25} metalness={0.7} />
      </mesh>
    </group>
  );
}

// Notebook: previewed lying closed, cover-up — not standing like a card. Built by taking the
// already-proven PieceModel decal box (design on its local +Z face — see this file's header
// comment) and wrapping the WHOLE thing in a group rotated -90° about X. For a box with (width,
// height, depth) = (coverWidth, pageLength, thickness), that rotation sends local +Z (the proven
// design-facing axis) to world +Y (straight up) and local +Y (the box's "height" arg) to world -Z
// (front-to-back) — i.e. the box's "height" becomes the notebook's page-length and its "depth"
// becomes the vertical thickness, which is exactly a notebook's real proportions (wide, thin,
// long), with the cover now facing up at the camera instead of forward. The pages strip sits along
// local +X (width doesn't move under an X-axis rotation), so it stays a visible side edge under the
// same transform.
const NOTEBOOK_COVER_WIDTH = 2.1;
const NOTEBOOK_PAGE_LENGTH = 2.7;
const NOTEBOOK_THICKNESS = 0.42;

function NotebookModel({ texture }: { texture: THREE.CanvasTexture | null }) {
  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      <PieceModel texture={texture} width={NOTEBOOK_COVER_WIDTH} height={NOTEBOOK_PAGE_LENGTH} depth={NOTEBOOK_THICKNESS} />
      {/* Pages edge — a thin, lighter inset strip along one long (local +X) edge so the closed
          book reads as paper, not a solid block. */}
      <mesh position={[NOTEBOOK_COVER_WIDTH / 2 - 0.03, 0, 0]} castShadow>
        <boxGeometry args={[0.05, NOTEBOOK_PAGE_LENGTH * 0.985, NOTEBOOK_THICKNESS * 0.9]} />
        <meshStandardMaterial color="#F4EFE2" roughness={0.9} metalness={0} />
      </mesh>
    </group>
  );
}

// Phone stand: a flat base plus an angled face panel (again, PieceModel's proven decal box) hinged
// at the base's back edge and tilted back by a modest angle — small enough that the design, which
// faces the camera head-on at zero tilt (PieceModel's own proven orientation), stays clearly
// visible rather than foreshortening away. No phone mesh: the product being sold is the stand
// itself, viewed as it would actually sit empty on a desk.
const STAND_BASE_WIDTH = 1.6;
const STAND_BASE_DEPTH = 0.95;
const STAND_BASE_THICKNESS = 0.2;
const STAND_FACE_HEIGHT = 1.15;
const STAND_FACE_THICKNESS = 0.12;
const STAND_TILT_DEG = 18;

function PhoneStandModel({ texture }: { texture: THREE.CanvasTexture | null }) {
  const tiltRad = (STAND_TILT_DEG * Math.PI) / 180;
  return (
    <group>
      {/* Base */}
      <mesh position={[0, -STAND_BASE_THICKNESS / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[STAND_BASE_WIDTH, STAND_BASE_THICKNESS, STAND_BASE_DEPTH]} />
        <meshStandardMaterial color="#35363B" roughness={0.45} metalness={0.2} />
      </mesh>
      {/* A low front lip the phone would actually rest its bottom edge against */}
      <mesh position={[0, -STAND_BASE_THICKNESS / 2 + 0.11, STAND_BASE_DEPTH / 2 - 0.08]} castShadow>
        <boxGeometry args={[STAND_BASE_WIDTH, 0.22, 0.16]} />
        <meshStandardMaterial color="#35363B" roughness={0.45} metalness={0.2} />
      </mesh>
      {/* Angled face, hinged at the base's back edge, tilted back away from the viewer */}
      <group position={[0, 0, -STAND_BASE_DEPTH / 2 + STAND_FACE_THICKNESS / 2]} rotation={[-tiltRad, 0, 0]}>
        <group position={[0, STAND_FACE_HEIGHT / 2, 0]}>
          <PieceModel texture={texture} width={STAND_BASE_WIDTH} height={STAND_FACE_HEIGHT} depth={STAND_FACE_THICKNESS} />
        </group>
      </group>
    </group>
  );
}

/** `objects` is the live design for the active location; `widthIn`/`heightIn` are that location's
 *  real print-area dimensions (PRINT_AREAS[activeSide], with the banner override applied by the
 *  caller) — this is what keeps the box's proportions honest across every very differently-shaped
 *  product (a 3.5x2 card vs an 8x30 banner) without hardcoding per-product numbers here. `kind`
 *  defaults to "flat" — today's generic card box — and only the four bespoke accessory kinds
 *  switch to their own procedural shape and camera framing below. */
export function Flat3DPreview({
  objects,
  widthIn,
  heightIn,
  kind = "flat",
}: {
  objects: DesignObjectRecord[];
  widthIn: number;
  heightIn: number;
  kind?: AccessoryKind;
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
      // Anisotropic filtering — without this, fine/small template text (a business card's
      // secondary lines, a postcard's fine print) blurs into near-illegibility the moment the
      // decal plane is viewed at anything but dead-on, because WebGL's default texture filtering
      // only accounts for minification, not the extra foreshortening an oblique view angle adds
      // along one axis. A bold, large mark (this app's own hand-built graphics, a big icon) hides
      // this well enough to look fine; small template body text does not. 16 is a safe, broadly
      // supported ceiling — WebGL clamps to the GPU's real max automatically if lower.
      tex.anisotropy = 16;
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

  // Each bespoke shape reports its own real-world bounding box (independent of widthIn/heightIn,
  // which is a fixed 4x4 placeholder for every accessory product today — see StudioClient's
  // flatPrintAreaIn comment) so the shared camera-distance math below frames IT, not the flat
  // card's square footprint. "flat" keeps using `dims` exactly as before.
  const bounds = useMemo(() => {
    switch (kind) {
      case "tote-bag":
        return { width: TOTE_PARAMS.width + TOTE_HANDLE_RADIUS * 0.5, height: TOTE_HEIGHT + TOTE_HANDLE_RADIUS * 1.8, elevationDeg: 12, azimuthDeg: 18 };
      case "pen":
        return { width: PEN_BODY_LENGTH + PEN_TIP_LENGTH, height: PEN_BODY_RADIUS * 2 + 0.3, elevationDeg: 16, azimuthDeg: 24 };
      case "notebook":
        return { width: NOTEBOOK_COVER_WIDTH, height: NOTEBOOK_PAGE_LENGTH, elevationDeg: 52, azimuthDeg: 22 };
      case "phone-stand":
        // Extra margin beyond the raw geometry extent (not just base+face) — the face panel is
        // hinged at the BACK of the base and tilts further back/up from there, so its visible top
        // reaches noticeably higher than a naive height sum; an earlier version under-margined
        // this and the panel's top edge rendered cropped off the top of the canvas.
        return { width: STAND_BASE_WIDTH + 0.5, height: STAND_FACE_HEIGHT + STAND_BASE_THICKNESS + 0.9, elevationDeg: 20, azimuthDeg: 20 };
      default:
        return { width: dims.width, height: dims.height, elevationDeg: 12, azimuthDeg: 18 };
    }
  }, [kind, dims]);

  // A mild 3/4 product-shot angle, mostly front-on — a small azimuth turn (not 45°+, which would
  // foreshorten a wide piece like a banner down to a sliver) plus a gentle elevation, matching the
  // same "slightly off dead-center" framing Mug3DPreview uses for its own default camera angle.
  // Bespoke shapes may override the elevation/azimuth (e.g. the notebook needs a steep look-down
  // to see its cover) via `bounds` above.
  const cameraPosition = useMemo<[number, number, number]>(() => {
    const maxDim = Math.max(bounds.width, bounds.height);
    const distance = maxDim * 1.9;
    const azimuth = (bounds.azimuthDeg * Math.PI) / 180;
    const elevation = (bounds.elevationDeg * Math.PI) / 180;
    const x = distance * Math.sin(azimuth) * Math.cos(elevation);
    const y = distance * Math.sin(elevation);
    const z = distance * Math.cos(azimuth) * Math.cos(elevation);
    return [x, y, z];
  }, [bounds]);

  const shadowScale = Math.max(bounds.width, bounds.height) * 3;
  const shadowY = kind === "notebook" ? -NOTEBOOK_THICKNESS / 2 - 0.01 : -bounds.height / 2 - 0.01;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-3xl bg-canvas">
      {loading && <LoadingSpinnerOverlay />}
      <Canvas shadows camera={{ position: cameraPosition, fov: 32 }} dpr={[1, 2]}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 4, 3]} intensity={1.1} castShadow shadow-mapSize={[1024, 1024]} />
        <directionalLight position={[-3, 2, -2]} intensity={0.35} />
        {kind === "tote-bag" && <ToteBagModel texture={texture} />}
        {kind === "pen" && <PenModel texture={texture} />}
        {kind === "notebook" && <NotebookModel texture={texture} />}
        {kind === "phone-stand" && <PhoneStandModel texture={texture} />}
        {kind === "flat" && <PieceModel texture={texture} width={dims.width} height={dims.height} depth={dims.depth} />}
        <ContactShadows position={[0, shadowY, 0]} opacity={0.3} scale={shadowScale} blur={2.2} far={2} />
        <Environment preset="apartment" environmentIntensity={0.5} />
        <OrbitControls
          enablePan={false}
          minDistance={Math.max(bounds.width, bounds.height) * 1.1}
          maxDistance={Math.max(bounds.width, bounds.height) * 5}
          minPolarAngle={Math.PI / 3.5}
          maxPolarAngle={Math.PI / 1.7}
          autoRotate
          autoRotateSpeed={1.2}
        />
      </Canvas>
    </div>
  );
}
