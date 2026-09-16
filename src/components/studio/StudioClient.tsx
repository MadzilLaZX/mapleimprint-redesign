"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Check, SpinnerGap, WarningCircle, X } from "@phosphor-icons/react/dist/ssr";
import { useCart } from "@/components/cart/CartProvider";
import { ReviewPanel } from "@/components/studio/ReviewPanel";
import { PreviewMode } from "@/components/studio/PreviewMode";
import { PostCartConfirmation } from "@/components/studio/PostCartConfirmation";
import { CropModal, type CropFraction } from "@/components/studio/CropModal";
import { ToolRail } from "@/components/studio/shell/ToolRail";
import { SecondaryPanel } from "@/components/studio/shell/SecondaryPanel";
import { TopBar } from "@/components/studio/shell/TopBar";
import { LocationSelector } from "@/components/studio/shell/LocationSelector";
import { TextToolbar } from "@/components/studio/shell/TextToolbar";
import { ZoomControls } from "@/components/studio/shell/ZoomControls";
import { Inspector, type BgRemovalState } from "@/components/studio/shell/Inspector";
import { InspectorDock } from "@/components/studio/shell/InspectorDock";
import { UploadsPanel, type RecentUpload } from "@/components/studio/panels/UploadsPanel";
import { TextPanel, type TextPreset } from "@/components/studio/panels/TextPanel";
import { ShapesPanel } from "@/components/studio/panels/ShapesPanel";
import { GraphicsPanel } from "@/components/studio/panels/GraphicsPanel";
import { DesignsPanel } from "@/components/studio/panels/DesignsPanel";
import { MyStuffPanel } from "@/components/studio/panels/MyStuffPanel";
import { decorationProfileFor } from "@/lib/studio/productDecorationProfile";
import { backgroundUrlFor, printAreaPixelBox, printAreasOverlap } from "@/lib/studio/printAreas";
import { viewGroupFor } from "@/lib/studio/garmentViews";
import { resolveTemplateAssets, scaleTemplateObjects, type DesignTemplate } from "@/lib/studio/templates";
import type { DesignAsset } from "@/lib/studio/assetProviders";
import type { StudioToolId } from "@/lib/studio/tools";
import type { DesignObjectRecord, DesignProjectRecord, DesignSideType, ShapeKind } from "@/lib/studio/types";
import type { CanvasLayerSpec } from "@/components/studio/CanvasStage";

const CanvasStage = dynamic(() => import("@/components/studio/CanvasStage").then((m) => m.CanvasStage), {
  ssr: false,
  loading: () => (
    <div className="mx-auto flex aspect-[4/5] w-full max-w-[520px] items-center justify-center rounded-3xl bg-white">
      <SpinnerGap className="size-6 animate-spin text-muted" weight="bold" />
    </div>
  ),
});

type SidesState = Partial<Record<DesignSideType, DesignObjectRecord[]>>;

const AUTOSAVE_DELAY_MS = 900;

function emptyObject(type: "text" | "image" | "shape", overrides: Partial<DesignObjectRecord>): DesignObjectRecord {
  return {
    id: crypto.randomUUID(),
    type,
    assetUrl: null,
    content: null,
    fontFamily: null,
    fontSize: null,
    fill: null,
    normalizedX: 0.25,
    normalizedY: 0.4,
    normalizedWidth: 0.5,
    normalizedHeight: 0.2,
    rotation: 0,
    opacity: 1,
    zIndex: 0,
    name: null,
    hidden: false,
    bold: false,
    italic: false,
    align: null,
    letterSpacing: null,
    lineHeight: null,
    curve: null,
    shapeKind: null,
    strokeColor: null,
    strokeWidth: null,
    flipX: false,
    flipY: false,
    cropX: null,
    cropY: null,
    cropWidth: null,
    cropHeight: null,
    ...overrides,
  };
}

/** Where a freshly-added asset lands (STUDIO V3 brief, Section 5: "do NOT place it arbitrarily or
 *  make it enormous"). Sizes it to `coverage` (60-75%) of whichever axis the box constrains first,
 *  preserving the asset's own aspect ratio against the print area's REAL pixel aspect ratio (not
 *  assuming the box is square), then centers it — the Canva-like "add object, it appears in a
 *  sensible position" feel instead of a fixed-fraction box that ignores both the asset's shape and
 *  the print area's. */
function autoFitNormalized(location: DesignSideType, naturalAspect: number, coverage = 0.68) {
  const box = printAreaPixelBox(location);
  const boxAspect = box.width / box.height;
  let wFrac: number;
  let hFrac: number;
  if (naturalAspect > boxAspect) {
    wFrac = coverage;
    hFrac = coverage * (boxAspect / naturalAspect);
  } else {
    hFrac = coverage;
    wFrac = coverage * (naturalAspect / boxAspect);
  }
  return {
    normalizedWidth: wFrac,
    normalizedHeight: hFrac,
    normalizedX: (1 - wFrac) / 2,
    normalizedY: (1 - hFrac) / 2,
  };
}

export function StudioClient({ projectId }: { projectId: string }) {
  const { addItem } = useCart();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [project, setProject] = useState<DesignProjectRecord | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sides, setSides] = useState<SidesState>({});
  const [activeSide, setActiveSide] = useState<DesignSideType>("front");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [recentUploads, setRecentUploads] = useState<RecentUpload[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [mode, setMode] = useState<"edit" | "preview" | "review" | "post-cart">("edit");
  // "adding" while the status PATCH is in flight, "success" once it lands (the button itself shows
  // "✓ Added to Cart" for a beat before `mode` advances to "post-cart" — see handleApproveAndAddToCart),
  // "error" if it failed (never silently treated as success). Initialized from the loaded project's
  // own status, not just local interaction — reopening an already-ordered design (fresh load, or
  // browser Back after approving) must never present a fresh, clickable Approve button that would
  // add a second cart line for the same design (Section 18/34).
  const [approveState, setApproveState] = useState<"idle" | "adding" | "success" | "error">("idle");
  const [activeTool, setActiveTool] = useState<StudioToolId | null>(null);
  // Per-location, not a single shared value — Section 22 wants Inner Neck to auto-fit rather than
  // inherit whatever zoom level Front happened to be at, and Front to come back the way the
  // customer left it rather than staying zoomed in on a collar schematic's scale. Keying by
  // location and defaulting to 1 (fit) gives both for free: a location's first visit is always a
  // fresh fit, and revisiting it restores whatever the customer last set.
  const [zoomByLocation, setZoomByLocation] = useState<Partial<Record<DesignSideType, number>>>({});
  const [addingLocation, setAddingLocation] = useState<DesignSideType | null>(null);
  const [cropTargetId, setCropTargetId] = useState<string | null>(null);
  const [bgRemoval, setBgRemoval] = useState<BgRemovalState>({ forObjectId: null, status: "idle" });
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [backNavigating, setBackNavigating] = useState(false);

  const [history, setHistory] = useState<{ past: SidesState[]; future: SidesState[] }>({ past: [], future: [] });
  // Text toolbar's "Copy style" / "Paste style" — deliberately NOT part of undo history (copying a
  // style is a read, not a design mutation) and deliberately NOT persisted with the project (a
  // clipboard that outlives the tab would be surprising) — plain component state is the right home.
  const [copiedStyle, setCopiedStyle] = useState<Partial<DesignObjectRecord> | null>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dirtySinceLoad = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/studio/${projectId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Design not found.");
        return res.json() as Promise<DesignProjectRecord>;
      })
      .then((data) => {
        if (cancelled) return;
        setProject(data);
        const nextSides: SidesState = {};
        for (const side of data.sides) nextSides[side.sideType] = side.objects;
        setSides(nextSides);
        setActiveSide(data.sides[0]?.sideType ?? "front");
        const hasAnyObject = data.sides.some((s) => s.objects.length > 0);
        // Section 1: no full-screen "choose one of four options" gate. A brand-new design opens
        // straight into the Designs panel (template-first, Canva-style first impression) with a
        // small dismissible hint instead of a modal blocking the product; a design that already has
        // objects (returning customer) opens straight into plain editing.
        setShowOnboarding(!hasAnyObject);
        if (!hasAnyObject) setActiveTool("designs");
        if (data.status === "ordered") setApproveState("success");
      })
      .catch((err: Error) => {
        if (!cancelled) setLoadError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const pushHistory = useCallback((before: SidesState) => {
    setHistory((h) => ({ past: [...h.past.slice(-49), JSON.parse(JSON.stringify(before))], future: [] }));
  }, []);

  const applySides = useCallback((next: SidesState) => {
    setSides(next);
    dirtySinceLoad.current = true;
  }, []);

  function undo() {
    if (history.past.length === 0) return;
    const prev = history.past[history.past.length - 1];
    setHistory((h) => ({ past: h.past.slice(0, -1), future: [...h.future, JSON.parse(JSON.stringify(sides))] }));
    setSides(prev);
    dirtySinceLoad.current = true;
  }

  function redo() {
    if (history.future.length === 0) return;
    const next = history.future[history.future.length - 1];
    setHistory((h) => ({ past: [...h.past, JSON.parse(JSON.stringify(sides))], future: h.future.slice(0, -1) }));
    setSides(next);
    dirtySinceLoad.current = true;
  }

  // Extracted so "Back to Product" can flush a pending save immediately instead of either losing
  // it (a plain navigation would abandon the debounce timer) or forcing the customer through a
  // "you have unsaved changes" confirmation modal for something Studio can just finish on its own.
  const saveNow = useCallback(
    async (sidesToSave: SidesState) => {
      const payload = {
        sides: (Object.entries(sidesToSave) as [DesignSideType, DesignObjectRecord[]][]).map(([sideType, objects]) => ({
          sideType,
          objects: objects.map(({ id: _id, ...rest }) => rest),
        })),
      };
      try {
        const res = await fetch(`/api/studio/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setSaveStatus(res.ok ? "saved" : "error");
      } catch {
        setSaveStatus("error");
      }
    },
    [projectId],
  );

  useEffect(() => {
    if (!project || !dirtySinceLoad.current) return;
    setSaveStatus("saving");
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      autosaveTimer.current = undefined;
      saveNow(sides);
    }, AUTOSAVE_DELAY_MS);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [sides, project, projectId, saveNow]);

  /** Resolves once any pending autosave has actually landed — a save already in flight or already
   *  "saved" resolves immediately; a still-debounced one is fired right now instead of waiting out
   *  the rest of its delay. Nothing to confirm with the customer either way: the design was never
   *  actually at risk, so "Back to Product" never needs a blocking "unsaved changes" dialog. */
  const flushPendingSave = useCallback(async () => {
    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current);
      autosaveTimer.current = undefined;
      await saveNow(sides);
    }
  }, [sides, saveNow]);

  async function handleBackToProduct(productHref: string) {
    setBackNavigating(true);
    await flushPendingSave();
    router.push(productHref);
  }

  // Keyboard precision (Section 17): Delete/Backspace, Cmd/Ctrl+D duplicate, Cmd/Ctrl+Z undo,
  // Cmd/Ctrl+Shift+Z or Ctrl+Y redo, arrow keys nudge (Shift = 10x). Every shortcut backs off the
  // instant the inline text editor is open or focus is anywhere inside an input/textarea/
  // contenteditable — a customer typing "Delete" as part of their own copy must never delete the
  // object they're editing.
  useEffect(() => {
    function isTypingTarget(el: EventTarget | null): boolean {
      if (!(el instanceof HTMLElement)) return false;
      return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable;
    }
    function onKeyDown(e: KeyboardEvent) {
      if (mode !== "edit" || editingTextId || isTypingTarget(e.target)) return;
      const meta = e.metaKey || e.ctrlKey;
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        deleteSelected();
        return;
      }
      if (meta && e.key.toLowerCase() === "d" && selectedId) {
        e.preventDefault();
        duplicateSelected();
        return;
      }
      if (meta && selectedObject?.type === "text" && ["b", "i", "u"].includes(e.key.toLowerCase())) {
        e.preventDefault();
        const key = e.key.toLowerCase();
        if (key === "b") commitObjectPatch(selectedObject.id, { bold: !selectedObject.bold });
        if (key === "i") commitObjectPatch(selectedObject.id, { italic: !selectedObject.italic });
        if (key === "u") commitObjectPatch(selectedObject.id, { underline: !selectedObject.underline });
        return;
      }
      if (meta && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if (meta && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
        return;
      }
      if (selectedId && (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault();
        const step = e.shiftKey ? 0.02 : 0.002;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        const obj = activeObjects.find((o) => o.id === selectedId);
        if (obj) commitObjectPatch(selectedId, { normalizedX: obj.normalizedX + dx, normalizedY: obj.normalizedY + dy });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, editingTextId, selectedId, sides, activeSide, history]);

  // Mobile has no permanent right-hand panel (there's no room) — selecting something is the
  // customer's clearest signal they want its properties, so the details sheet opens itself rather
  // than requiring an extra tap to discover it. (Desktop ignores this entirely — InspectorDock's
  // `mobileOpen` prop only affects its `lg:hidden` mobile rendering.) Adjusted during render, not
  // in an effect, per the "derived state from a changed value" pattern already used in
  // PageTransition.tsx — avoids the extra render pass a useEffect-based setState would cause.
  if (selectedId !== lastSelectedId) {
    setLastSelectedId(selectedId);
    if (selectedId) setMobileInspectorOpen(true);
  }

  const activeObjects = sides[activeSide] ?? [];
  const selectedObject = activeObjects.find((o) => o.id === selectedId) ?? null;
  const openSides = project?.sides.map((s) => s.sideType) ?? [];
  const hasBackPhoto = Boolean(project?.mockupImages.back);
  const profile = project ? decorationProfileFor(project.categorySlug, project.subcategorySlug, hasBackPhoto).locations : [];
  const activeLocation = profile.find((l) => l.id === activeSide) ?? null;
  const zoom = zoomByLocation[activeSide] ?? 1;
  const setZoom = (next: number) => setZoomByLocation((prev) => ({ ...prev, [activeSide]: next }));

  // GarmentView vs PrintArea (STUDIO V3 brief, Section 8): every OPEN location that shares the
  // active location's view (front/left-chest/right-chest all sit on the same front photo, etc.)
  // gets composited into the same canvas so switching to Left Chest never makes Front's artwork
  // disappear — only the active one is actually editable. Production data stays fully separate:
  // this is rendering-only, `sides` itself is never merged (Section 17).
  const compositeLocations = viewGroupFor(activeSide, profile).filter((loc) => openSides.includes(loc));
  const compositeLayers: CanvasLayerSpec[] = compositeLocations.map((loc) => ({
    location: loc,
    objects: sides[loc] ?? [],
    active: loc === activeSide,
  }));
  // Gentle, non-blocking collision hint (Section 8's "overlapping locations") — only surfaced when
  // two open, ARTWORKED locations in the same view actually occupy overlapping print-area boxes;
  // never auto-blocks anything.
  const overlappingWith = compositeLocations.find(
    (loc) => loc !== activeSide && (sides[loc]?.length ?? 0) > 0 && (activeObjects.length ?? 0) > 0 && printAreasOverlap(activeSide, loc),
  );

  function addText(preset: TextPreset) {
    pushHistory(sides);
    const width = 0.55;
    const height = 0.12;
    const obj = emptyObject("text", {
      content: preset.label === "Body text" ? "Your text" : preset.label,
      fontFamily: "Manrope, sans-serif",
      fontSize: preset.fontSize,
      fill: "#171412",
      bold: preset.bold,
      align: "center",
      normalizedWidth: width,
      normalizedHeight: height,
      // Centered within the current print area, never x=0/y=0 (Section 21) — a fresh text object
      // should read as "placed for you," not "dropped in the corner."
      normalizedX: (1 - width) / 2,
      normalizedY: (1 - height) / 2,
    });
    applySides({ ...sides, [activeSide]: [...activeObjects, obj] });
    setSelectedId(obj.id);
    setEditingTextId(obj.id);
    setShowOnboarding(false);
    setActiveTool(null);
  }

  function addShape(kind: ShapeKind) {
    pushHistory(sides);
    const width = kind === "line" ? 0.5 : 0.3;
    const height = kind === "line" ? 0.01 : 0.3;
    const obj = emptyObject("shape", {
      shapeKind: kind,
      fill: "#D41414",
      normalizedWidth: width,
      normalizedHeight: height,
      normalizedX: (1 - width) / 2,
      normalizedY: (1 - height) / 2,
    });
    applySides({ ...sides, [activeSide]: [...activeObjects, obj] });
    setSelectedId(obj.id);
    setShowOnboarding(false);
    setActiveTool(null);
  }

  function addGraphic(asset: DesignAsset) {
    pushHistory(sides);
    const obj = emptyObject("image", {
      assetUrl: asset.productionSource,
      name: asset.title,
      normalizedWidth: 0.35,
      normalizedHeight: 0.35,
      normalizedX: 0.325,
      normalizedY: 0.15,
    });
    applySides({ ...sides, [activeSide]: [...activeObjects, obj] });
    setSelectedId(obj.id);
    setShowOnboarding(false);
    setActiveTool(null);
  }

  async function applyTemplate(template: DesignTemplate) {
    pushHistory(sides);
    // QA pass (Section "TEMPLATE GROUP SCALING"): every template is authored against the "front"
    // print area's own box size — scale absolute-unit fields (fontSize/letterSpacing/strokeWidth;
    // position/size fields are already box-relative fractions and need no change) by how much
    // smaller/larger the ACTUAL active box is, so a badge template applied to Left Chest or a
    // sleeve renders proportionally, not at full "front" scale inside a much smaller box. See
    // scaleTemplateObjects's own doc comment for why this is the correct place to do it once,
    // rather than re-tuning every template's numbers per print area.
    const referenceBox = printAreaPixelBox("front");
    const activeBox = printAreaPixelBox(activeSide);
    const scale = Math.min(activeBox.width / referenceBox.width, activeBox.height / referenceBox.height);
    const scaledSeeds = scaleTemplateObjects(template.objects, scale);
    const resolved = await resolveTemplateAssets(scaledSeeds);
    const newObjects = resolved.map((seed) => ({ ...seed, id: crypto.randomUUID() }));
    applySides({ ...sides, [activeSide]: [...activeObjects, ...newObjects] });
    setSelectedId(null);
    setShowOnboarding(false);
    setActiveTool(null);
  }

  async function handleUploadFile(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/studio/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");

      const img = new Image();
      img.src = data.url;
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      });
      const naturalAspect = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1;
      const fit = autoFitNormalized(activeSide, naturalAspect);

      pushHistory(sides);
      const obj = emptyObject("image", {
        assetUrl: data.url,
        normalizedWidth: fit.normalizedWidth,
        normalizedHeight: fit.normalizedHeight,
        normalizedX: fit.normalizedX,
        normalizedY: fit.normalizedY,
      });
      applySides({ ...sides, [activeSide]: [...activeObjects, obj] });
      setSelectedId(obj.id);
      setShowOnboarding(false);
      setRecentUploads((prev) => [{ url: data.url, name: file.name }, ...prev].slice(0, 12));
      setActiveTool(null);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function useRecentUpload(url: string) {
    pushHistory(sides);
    const obj = emptyObject("image", { assetUrl: url, normalizedX: 0.25, normalizedY: 0.3 });
    applySides({ ...sides, [activeSide]: [...activeObjects, obj] });
    setSelectedId(obj.id);
    setShowOnboarding(false);
    setActiveTool(null);
  }

  function commitObjectPatch(id: string, patch: Partial<DesignObjectRecord>, side: DesignSideType = activeSide) {
    pushHistory(sides);
    applySides({
      ...sides,
      [side]: (sides[side] ?? []).map((o) => (o.id === id ? { ...o, ...patch } : o)),
    });
  }

  // Curved-text/mirroring brief: "live visual update while dragging, then commit a history state
  // when interaction ends" — a slider's onChange fires on every tick of a drag, and
  // commitObjectPatch pushes one history entry per call, so wiring a slider straight to it would
  // spam dozens of undo steps per gesture. This coalesces an entire drag into exactly one history
  // entry: the first live-patch of a gesture pushes history (capturing the pre-drag state, exactly
  // like commitObjectPatch always has), every subsequent one during the same gesture just updates
  // `sides` directly; liveEditEndRef flags the next call to start a new gesture again. Genuinely
  // discrete interactions (clicks, drag-end, blur) keep using commitObjectPatch unchanged.
  const liveEditActiveRef = useRef(false);
  function livePatchObject(id: string, patch: Partial<DesignObjectRecord>, side: DesignSideType = activeSide) {
    if (!liveEditActiveRef.current) {
      pushHistory(sides);
      liveEditActiveRef.current = true;
    }
    applySides({
      ...sides,
      [side]: (sides[side] ?? []).map((o) => (o.id === id ? { ...o, ...patch } : o)),
    });
  }
  function endLivePatch() {
    liveEditActiveRef.current = false;
  }

  async function handleRemoveBackground(objectId: string, imageUrl: string) {
    setBgRemoval({ forObjectId: objectId, status: "processing" });
    try {
      const res = await fetch("/api/studio/remove-background", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "We couldn't remove this background automatically.");
      setBgRemoval({ forObjectId: objectId, status: "ready", resultUrl: data.url });
    } catch (err) {
      setBgRemoval({
        forObjectId: objectId,
        status: "error",
        error: err instanceof Error ? err.message : "We couldn't remove this background automatically.",
      });
    }
  }

  function acceptRemovedBackground(objectId: string) {
    if (bgRemoval.status !== "ready" || !bgRemoval.resultUrl) return;
    commitObjectPatch(objectId, { assetUrl: bgRemoval.resultUrl });
    setBgRemoval({ forObjectId: null, status: "idle" });
  }

  function dismissBackgroundRemoval() {
    setBgRemoval({ forObjectId: null, status: "idle" });
  }

  function commitTextEdit(id: string, content: string) {
    setEditingTextId(null);
    pushHistory(sides);
    applySides({
      ...sides,
      [activeSide]: activeObjects.map((o) => (o.id === id ? { ...o, content } : o)),
    });
  }

  function deleteSelected() {
    if (!selectedId) return;
    pushHistory(sides);
    applySides({ ...sides, [activeSide]: activeObjects.filter((o) => o.id !== selectedId) });
    setSelectedId(null);
  }

  function duplicateSelected() {
    if (!selectedObject) return;
    pushHistory(sides);
    const copy: DesignObjectRecord = {
      ...selectedObject,
      id: crypto.randomUUID(),
      normalizedX: Math.min(0.9, selectedObject.normalizedX + 0.04),
      normalizedY: Math.min(0.9, selectedObject.normalizedY + 0.04),
    };
    applySides({ ...sides, [activeSide]: [...activeObjects, copy] });
    setSelectedId(copy.id);
  }

  function moveLayer(id: string, direction: "up" | "down") {
    const index = activeObjects.findIndex((o) => o.id === id);
    if (index === -1) return;
    const swapWith = direction === "up" ? index + 1 : index - 1;
    if (swapWith < 0 || swapWith >= activeObjects.length) return;
    pushHistory(sides);
    const next = [...activeObjects];
    [next[index], next[swapWith]] = [next[swapWith], next[index]];
    applySides({ ...sides, [activeSide]: next });
  }

  // Text toolbar's "To front" / "To back" — moveLayer only swaps one adjacent step at a time
  // (matches the Layers panel's up/down arrows); this splices straight to either end of the
  // z-order array in one history entry instead of requiring N calls to moveLayer.
  // Text toolbar's "Copy style" / "Paste style" (format painter) — deliberately excludes `content`
  // (never copy the actual wording) and position/size/rotation fields (those describe placement,
  // not typography). Reused verbatim as the Partial<DesignObjectRecord> patch onPasteStyle commits.
  const STYLE_FIELDS = [
    "fontFamily",
    "fontSize",
    "fill",
    "bold",
    "italic",
    "underline",
    "strikethrough",
    "textTransform",
    "align",
    "letterSpacing",
    "lineHeight",
    "opacity",
    "curve",
    "effectType",
    "shadowColor",
    "shadowOpacity",
    "shadowBlur",
    "shadowOffsetX",
    "shadowOffsetY",
    "bgColor",
    "bgPadding",
    "bgCornerRadius",
    "strokeColor",
    "strokeWidth",
  ] as const satisfies readonly (keyof DesignObjectRecord)[];

  function copyStyle() {
    if (!selectedObject) return;
    const style: Partial<DesignObjectRecord> = {};
    for (const key of STYLE_FIELDS) (style as Record<string, unknown>)[key] = selectedObject[key];
    setCopiedStyle(style);
  }

  function pasteStyle() {
    if (!selectedObject || !copiedStyle) return;
    commitObjectPatch(selectedObject.id, copiedStyle);
  }

  function moveLayerToEdge(id: string, edge: "front" | "back") {
    const index = activeObjects.findIndex((o) => o.id === id);
    if (index === -1) return;
    pushHistory(sides);
    const next = [...activeObjects];
    const [obj] = next.splice(index, 1);
    if (edge === "front") next.push(obj);
    else next.unshift(obj);
    applySides({ ...sides, [activeSide]: next });
  }

  function toggleLayerHidden(id: string) {
    commitObjectPatch(id, { hidden: !activeObjects.find((o) => o.id === id)?.hidden });
  }

  function duplicateLayer(id: string) {
    const obj = activeObjects.find((o) => o.id === id);
    if (!obj) return;
    pushHistory(sides);
    const copy = { ...obj, id: crypto.randomUUID(), normalizedX: Math.min(0.9, obj.normalizedX + 0.04), normalizedY: Math.min(0.9, obj.normalizedY + 0.04) };
    applySides({ ...sides, [activeSide]: [...activeObjects, copy] });
    setSelectedId(copy.id);
  }

  function deleteLayer(id: string) {
    pushHistory(sides);
    applySides({ ...sides, [activeSide]: activeObjects.filter((o) => o.id !== id) });
    if (selectedId === id) setSelectedId(null);
  }

  // Every location the product's family supports is already visible in the strip (Section 1 — no
  // "More" dropdown to hide the create-on-demand step behind), so selecting one that doesn't have
  // a real DesignSide row yet needs to transparently create it first — the customer never sees a
  // separate "add this location" action, just a brief pending spinner on that pill.
  async function handleSelectLocation(side: DesignSideType) {
    if (!project) return;
    if (openSides.includes(side)) {
      setActiveSide(side);
      setSelectedId(null);
      return;
    }
    setAddingLocation(side);
    try {
      const res = await fetch(`/api/studio/${projectId}/locations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sideType: side }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProject((p) => (p ? { ...p, sides: [...p.sides, { id: `pending-${side}`, sideType: side, printAreaWidth: 0, printAreaHeight: 0, objects: [] }] } : p));
      setSides((s) => ({ ...s, [side]: s[side] ?? [] }));
      setActiveSide(side);
      setSelectedId(null);
    } catch {
      // Silent no-op — the location simply doesn't switch; the customer can just click it again.
    } finally {
      setAddingLocation(null);
    }
  }

  const locationsWithArt = openSides.filter((s) => (sides[s]?.length ?? 0) > 0).length;

  const priceBreakdown = (() => {
    const snapshot = project?.pricingSnapshot;
    if (!snapshot) return null;
    const locations = Math.max(1, locationsWithArt);
    const perUnitPrinting = snapshot.chartFirstLocationCost + snapshot.chartAdditionalLocationCost * (locations - 1);
    const blankSubtotal = snapshot.unitBasePrice * snapshot.quantity;
    const printingSubtotal = perUnitPrinting * snapshot.quantity;
    const total = blankSubtotal + snapshot.designFee + printingSubtotal;
    return {
      blankSubtotal: Math.round(blankSubtotal * 100) / 100,
      designFee: snapshot.designFee,
      printingSubtotal: Math.round(printingSubtotal * 100) / 100,
      total: Math.round(total * 100) / 100,
      quantity: snapshot.quantity,
      locations,
    };
  })();

  const hasAnyDesign = openSides.some((s) => (sides[s]?.length ?? 0) > 0);

  // The PATCH (marking this DesignProject revision as ordered/frozen) is awaited and happens
  // BEFORE the local cart mutation, deliberately — a failed PATCH must never leave a cart line
  // pointing at a project the server still considers a draft. `approveState` guards against a
  // double-click or a stray extra call re-running this mid-flight or after it already succeeded
  // (Section 18); reopening an already-"ordered" project starts in "success" already (see the load
  // effect above), so browser Back after approving can't reach a fresh, clickable button either.
  async function handleApproveAndAddToCart() {
    if (!project || !priceBreakdown) return;
    if (approveState === "adding" || approveState === "success") return;
    setApproveState("adding");
    try {
      const res = await fetch(`/api/studio/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ordered" }),
      });
      if (!res.ok) throw new Error("Couldn't save your approval.");
      addItem(
        {
          id: `studio-${project.id}`,
          name: project.productName,
          image: project.mockupImages.front ?? project.mockupImages.back ?? "",
          categorySlug: project.categorySlug,
          categoryName: project.categorySlug,
          colourName: project.colourName,
          sizeBreakdown: project.sizeBreakdown,
          startingPrice: priceBreakdown.total / project.totalQuantity,
          customizationType: "CUSTOM",
          designProjectId: project.id,
          designRevision: project.revision,
        },
        project.totalQuantity,
      );
      setApproveState("success");
      // A short beat showing the button's own "✓ Added to Cart" state (Section 2's "success
      // moment") before advancing to the full post-cart header+tray view — long enough to
      // register, short enough not to feel like a delay.
      window.setTimeout(() => setMode("post-cart"), 400);
    } catch {
      setApproveState("error");
    }
  }

  const productHref = project ? `/products/${project.categorySlug}/${project.subcategorySlug}/${project.productSlug}` : "/shop";

  let content: React.ReactNode;

  if (loadError) {
    content = (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
        <WarningCircle className="size-10 text-crimson" weight="light" />
        <p className="font-display text-lg font-semibold text-ink-900">We couldn&apos;t open this design</p>
        <p className="max-w-sm text-sm text-muted">{loadError}</p>
      </div>
    );
  } else if (!project) {
    content = (
      <div className="flex h-full items-center justify-center bg-canvas">
        <SpinnerGap className="size-8 animate-spin text-muted" weight="bold" />
      </div>
    );
  } else if (mode === "post-cart") {
    content = <PostCartConfirmation project={project} onClose={() => setMode("review")} />;
  } else if (mode === "review") {
    content = (
      <ReviewPanel
        project={project}
        sides={sides}
        profile={profile}
        priceBreakdown={priceBreakdown}
        onBack={() => setMode("edit")}
        onApprove={handleApproveAndAddToCart}
        approveState={approveState}
      />
    );
  } else if (mode === "preview") {
    content = (
      <PreviewMode
        openSides={openSides}
        sides={sides}
        activeSide={activeSide}
        onSelectSide={setActiveSide}
        mockupImages={project.mockupImages}
        colourName={project.colourName}
        profile={profile}
        onBack={() => setMode("edit")}
      />
    );
  } else {
    const mockupUrl = activeLocation
      ? backgroundUrlFor(activeLocation.viewType, project.mockupImages, project.colourName, activeLocation.usesPlacementPreview)
      : null;
    const cropTarget = cropTargetId ? activeObjects.find((o) => o.id === cropTargetId) ?? null : null;

    content = (
      // h-full + overflow-hidden: this shell fills exactly the (studio) route layout's `h-dvh`
      // box and never grows past it — the document itself has nothing left to scroll. Every
      // scrollable surface below (SecondaryPanel, InspectorDock) manages its OWN overflow
      // internally instead.
      <div className="flex h-full flex-col overflow-hidden bg-canvas">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUploadFile(file);
            e.target.value = "";
          }}
        />

        <div className="shrink-0">
          <TopBar
            onBack={() => handleBackToProduct(productHref)}
            backPending={backNavigating}
            productName={project.productName}
            colourName={project.colourName}
            canUndo={history.past.length > 0}
            canRedo={history.future.length > 0}
            onUndo={undo}
            onRedo={redo}
            saveStatus={saveStatus}
            priceTotal={priceBreakdown?.total ?? null}
            canPreview={hasAnyDesign}
            onPreview={() => setMode("preview")}
            onReview={() => setMode("review")}
          />
        </div>

        {/* min-h-0 is what lets this row actually shrink to "remaining space after the toolbar"
            instead of growing to fit its tallest child (the classic nested-flex trap) — every
            descendant below that needs to scroll internally, rather than pushing this row taller,
            repeats the same min-h-0 rule down the tree. */}
        <div className="flex min-h-0 flex-1">
          <ToolRail activeTool={activeTool} onSelectTool={(t) => setActiveTool((cur) => (cur === t ? null : t))} />
          {activeTool && (
            <SecondaryPanel
              title={{ designs: "Designs", uploads: "Uploads", text: "Text", graphics: "Graphics", shapes: "Shapes", "my-stuff": "My Stuff" }[activeTool]}
              onClose={() => setActiveTool(null)}
            >
              {activeTool === "designs" && <DesignsPanel family={decorationProfileFor(project.categorySlug, project.subcategorySlug, hasBackPhoto).family} onApplyTemplate={applyTemplate} />}
              {activeTool === "uploads" && (
                <UploadsPanel
                  onTriggerUpload={() => fileInputRef.current?.click()}
                  uploading={uploading}
                  uploadError={uploadError}
                  recent={recentUploads}
                  onUseRecent={useRecentUpload}
                />
              )}
              {activeTool === "text" && <TextPanel onAddText={addText} />}
              {activeTool === "graphics" && <GraphicsPanel onAddGraphic={addGraphic} />}
              {activeTool === "shapes" && <ShapesPanel onAddShape={addShape} />}
              {activeTool === "my-stuff" && <MyStuffPanel recent={recentUploads} onUseRecent={useRecentUpload} />}
            </SecondaryPanel>
          )}

          {/* Canvas — min-h-0/min-w-0/overflow-hidden so the workspace never expands past its
              share of the shell; zoom controls float over it (absolute) instead of sitting in
              flow, so they can never add to this column's height. */}
          <main className="relative flex min-h-0 min-w-0 flex-1 flex-col items-center gap-4 overflow-hidden p-6 pb-20 lg:pb-6">
            <div className="shrink-0 space-y-2">
              <LocationSelector
                profile={profile}
                activeSide={activeSide}
                sidesWithArt={new Set(openSides.filter((s) => (sides[s]?.length ?? 0) > 0))}
                onSelect={handleSelectLocation}
                pendingLocation={addingLocation}
              />
              {/* The strip itself only carries a quiet dot for REVIEW_REQUIRED (Section 4) — the
                  actual explanation shows here, only for whichever location is currently active,
                  so it never clutters the selector for the other eight locations. */}
              {activeLocation?.status === "REVIEW_REQUIRED" && (
                <p className="px-1 text-xs text-orange">
                  Special placement — our team will confirm this location before production.
                </p>
              )}
              {overlappingWith && (
                <p className="px-1 text-xs text-orange">
                  These two print placements overlap. Adjust one design to prevent printing conflicts.
                </p>
              )}
            </div>

            {/* Contextual text toolbar — fast access to the formatting customers reach for most;
                the Inspector panel still carries every control in full detail underneath this. */}
            {selectedObject?.type === "text" && (
              <div className="w-full max-w-full shrink-0">
                <TextToolbar
                  obj={selectedObject}
                  onPatch={(patch) => commitObjectPatch(selectedObject.id, patch)}
                  onLivePatch={(patch) => livePatchObject(selectedObject.id, patch)}
                  onLivePatchEnd={endLivePatch}
                  onDuplicate={duplicateSelected}
                  onDelete={deleteSelected}
                  onMoveLayer={(direction) => moveLayer(selectedObject.id, direction)}
                  onMoveLayerToEdge={(edge) => moveLayerToEdge(selectedObject.id, edge)}
                  onCopyStyle={copyStyle}
                  onPasteStyle={pasteStyle}
                  hasCopiedStyle={copiedStyle !== null}
                />
              </div>
            )}

            {/* No items-center/justify-center here on purpose — CanvasStage's own root div needs
                to actually stretch to fill this box's real width AND height (default flex
                align-items: stretch) so its ResizeObserver has real dimensions to fit against;
                it centers the rendered stage inside itself once it knows how much space it has. */}
            <div className="relative flex min-h-0 min-w-0 w-full flex-1">
              {uploadError && (
                <div className="absolute left-1/2 top-0 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-crimson/10 px-4 py-2 text-xs font-medium text-crimson">
                  <WarningCircle className="size-4" weight="bold" />
                  {uploadError}
                </div>
              )}
              <CanvasStage
                layers={compositeLayers}
                mockupUrl={mockupUrl}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onCommitObject={(id, patch) => commitObjectPatch(id, patch)}
                editingTextId={editingTextId}
                onEditRequest={setEditingTextId}
                onEditCommit={commitTextEdit}
                onSwitchLocation={handleSelectLocation}
                placementPreview={activeLocation?.usesPlacementPreview ?? false}
                zoom={zoom}
              />

              {/* Section 1: subtle, dismissible hint — never covers the product, never blocks
                  interaction. The Designs panel is already open beside it (see the load effect
                  above), so this is just a one-line pointer rather than a gate the customer must
                  clear before touching anything. */}
              {showOnboarding && (
                <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center px-4">
                  <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-ink-950/90 py-1.5 pl-3.5 pr-1.5 text-xs font-medium text-white shadow-lg">
                    <span>Pick a template to start, or upload/add your own.</span>
                    <button
                      type="button"
                      aria-label="Dismiss hint"
                      onClick={() => setShowOnboarding(false)}
                      className="rounded-full p-1 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                    >
                      <X className="size-3.5" weight="bold" />
                    </button>
                  </div>
                </div>
              )}

              {/* Floating canvas toolbar — deliberately absolute/out-of-flow so it can never add
                  to the workspace's height (previously it sat in normal flow below the canvas and
                  was part of what forced the whole page to scroll). */}
              <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
                <div className="pointer-events-auto">
                  <ZoomControls zoom={zoom} onZoomChange={setZoom} />
                </div>
              </div>

              {/* Mobile has no permanent price/details panel — this pill is the entry point into
                  InspectorDock's bottom sheet when nothing is selected on canvas. */}
              {priceBreakdown && (
                <button
                  type="button"
                  onClick={() => setMobileInspectorOpen(true)}
                  className="absolute right-3 top-3 z-10 rounded-full bg-ink-950/90 px-3 py-1.5 text-xs font-semibold text-white shadow-lg lg:hidden"
                >
                  ${priceBreakdown.total.toFixed(2)} · Details
                </button>
              )}
            </div>
          </main>

          <InspectorDock mobileOpen={mobileInspectorOpen} onCloseMobile={() => setMobileInspectorOpen(false)}>
            <Inspector
              selectedObject={selectedObject}
              onPatch={(id, patch) => commitObjectPatch(id, patch)}
              onLivePatch={(id, patch) => livePatchObject(id, patch)}
              onLivePatchEnd={endLivePatch}
              onDuplicate={duplicateSelected}
              onDelete={deleteSelected}
              onOpenCrop={() => selectedObject && setCropTargetId(selectedObject.id)}
              bgRemoval={bgRemoval}
              onRemoveBackground={() => selectedObject?.assetUrl && handleRemoveBackground(selectedObject.id, selectedObject.assetUrl)}
              onAcceptRemovedBackground={() => selectedObject && acceptRemovedBackground(selectedObject.id)}
              onDismissBackgroundRemoval={dismissBackgroundRemoval}
              activeSide={activeSide}
              layerObjects={activeObjects}
              selectedId={selectedId}
              onSelectLayer={setSelectedId}
              onMoveLayer={moveLayer}
              onToggleHiddenLayer={toggleLayerHidden}
              onDuplicateLayer={duplicateLayer}
              onDeleteLayer={deleteLayer}
              productName={project.productName}
              brandName={project.brandName}
              colourName={project.colourName}
              sizeBreakdown={project.sizeBreakdown}
              totalQuantity={project.totalQuantity}
              priceBreakdown={priceBreakdown}
            />
          </InspectorDock>
        </div>

        {approveState === "success" && (
          <div className="fixed bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink-950 px-4 py-2.5 text-sm font-semibold text-white shadow-xl">
            <Check className="size-4" weight="bold" />
            Added to cart
          </div>
        )}

        {cropTarget && cropTarget.assetUrl && (
          <CropModal
            imageUrl={cropTarget.assetUrl}
            initialCrop={
              cropTarget.cropWidth && cropTarget.cropHeight
                ? { x: cropTarget.cropX ?? 0, y: cropTarget.cropY ?? 0, width: cropTarget.cropWidth, height: cropTarget.cropHeight }
                : null
            }
            onCancel={() => setCropTargetId(null)}
            onConfirm={(crop: CropFraction | null) => {
              commitObjectPatch(cropTarget.id, {
                cropX: crop?.x ?? null,
                cropY: crop?.y ?? null,
                cropWidth: crop?.width ?? null,
                cropHeight: crop?.height ?? null,
              });
              setCropTargetId(null);
            }}
          />
        )}
      </div>
    );
  }

  return (
    // The one-time "I was configuring my shirt, now I'm designing it" entrance (180-250ms fade +
    // subtle scale) — mounted once for StudioClient's whole lifetime, so switching between
    // edit/preview/review afterward (which swaps `content`, not this wrapper) never replays it.
    <motion.div
      className="h-full"
      initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
    >
      {content}
    </motion.div>
  );
}
