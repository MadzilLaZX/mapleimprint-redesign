"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Check, SpinnerGap, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { useCart } from "@/components/cart/CartProvider";
import { ReviewPanel } from "@/components/studio/ReviewPanel";
import { PreviewMode } from "@/components/studio/PreviewMode";
import { CropModal, type CropFraction } from "@/components/studio/CropModal";
import { ToolRail } from "@/components/studio/shell/ToolRail";
import { SecondaryPanel } from "@/components/studio/shell/SecondaryPanel";
import { TopBar } from "@/components/studio/shell/TopBar";
import { LocationSelector } from "@/components/studio/shell/LocationSelector";
import { ZoomControls } from "@/components/studio/shell/ZoomControls";
import { Inspector, type BgRemovalState } from "@/components/studio/shell/Inspector";
import { UploadsPanel, type RecentUpload } from "@/components/studio/panels/UploadsPanel";
import { TextPanel, type TextPreset } from "@/components/studio/panels/TextPanel";
import { ShapesPanel } from "@/components/studio/panels/ShapesPanel";
import { GraphicsPanel } from "@/components/studio/panels/GraphicsPanel";
import { DesignsPanel } from "@/components/studio/panels/DesignsPanel";
import { MyStuffPanel } from "@/components/studio/panels/MyStuffPanel";
import { decorationProfileFor } from "@/lib/studio/productDecorationProfile";
import { mockupViewFor, GENERIC_PLACEMENT_MOCKUP } from "@/lib/studio/printAreas";
import { resolveTemplateAssets, type DesignTemplate } from "@/lib/studio/templates";
import type { DesignAsset } from "@/lib/studio/assetProviders";
import type { StudioToolId } from "@/lib/studio/tools";
import type { DesignObjectRecord, DesignProjectRecord, DesignSideType, ShapeKind } from "@/lib/studio/types";

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

export function StudioClient({ projectId }: { projectId: string }) {
  const { addItem } = useCart();
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
  const [mode, setMode] = useState<"edit" | "preview" | "review">("edit");
  const [addedToCart, setAddedToCart] = useState(false);
  const [activeTool, setActiveTool] = useState<StudioToolId | null>(null);
  const [zoom, setZoom] = useState(1);
  const [addingLocation, setAddingLocation] = useState<DesignSideType | null>(null);
  const [cropTargetId, setCropTargetId] = useState<string | null>(null);
  const [bgRemoval, setBgRemoval] = useState<BgRemovalState>({ forObjectId: null, status: "idle" });

  const [history, setHistory] = useState<{ past: SidesState[]; future: SidesState[] }>({ past: [], future: [] });
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
        setShowOnboarding(!hasAnyObject);
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

  useEffect(() => {
    if (!project || !dirtySinceLoad.current) return;
    setSaveStatus("saving");
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      const payload = {
        sides: (Object.entries(sides) as [DesignSideType, DesignObjectRecord[]][]).map(([sideType, objects]) => ({
          sideType,
          objects: objects.map(({ id: _id, ...rest }) => rest),
        })),
      };
      fetch(`/api/studio/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then((res) => setSaveStatus(res.ok ? "saved" : "error"))
        .catch(() => setSaveStatus("error"));
    }, AUTOSAVE_DELAY_MS);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [sides, project, projectId]);

  const activeObjects = sides[activeSide] ?? [];
  const selectedObject = activeObjects.find((o) => o.id === selectedId) ?? null;
  const openSides = project?.sides.map((s) => s.sideType) ?? [];
  const hasBackPhoto = Boolean(project?.mockupImages.back);
  const profile = project ? decorationProfileFor(project.categorySlug, project.subcategorySlug, hasBackPhoto).locations : [];
  const activeLocation = profile.find((l) => l.id === activeSide) ?? null;

  function closePanelAnd<T>(fn: () => T): T {
    setActiveTool(null);
    return fn();
  }

  function addText(preset: TextPreset) {
    pushHistory(sides);
    const obj = emptyObject("text", {
      content: preset.label === "Body text" ? "Your text" : preset.label,
      fontFamily: "Manrope, sans-serif",
      fontSize: preset.fontSize,
      fill: "#171412",
      bold: preset.bold,
      align: "center",
      normalizedWidth: 0.55,
      normalizedHeight: 0.12,
    });
    applySides({ ...sides, [activeSide]: [...activeObjects, obj] });
    setSelectedId(obj.id);
    setEditingTextId(obj.id);
    setShowOnboarding(false);
    setActiveTool(null);
  }

  function addShape(kind: ShapeKind) {
    pushHistory(sides);
    const obj = emptyObject("shape", {
      shapeKind: kind,
      fill: "#D41414",
      normalizedWidth: kind === "line" ? 0.5 : 0.3,
      normalizedHeight: kind === "line" ? 0.01 : 0.3,
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
    const resolved = await resolveTemplateAssets(template.objects);
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
      const width = 0.5;
      const height = Math.min(0.6, width / naturalAspect);

      pushHistory(sides);
      const obj = emptyObject("image", {
        assetUrl: data.url,
        normalizedWidth: width,
        normalizedHeight: height,
        normalizedX: (1 - width) / 2,
        normalizedY: (1 - height) / 2,
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

  async function handleSelectLocation(side: DesignSideType) {
    setActiveSide(side);
    setSelectedId(null);
  }

  async function handleAddLocation(side: DesignSideType) {
    if (!project) return;
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
      // Silent no-op — the location simply doesn't appear; the customer can try again from More.
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

  function handleApproveAndAddToCart() {
    if (!project || !priceBreakdown) return;
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
    fetch(`/api/studio/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ordered" }),
    }).catch(() => {});
    setAddedToCart(true);
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
        <WarningCircle className="size-10 text-crimson" weight="light" />
        <p className="font-display text-lg font-semibold text-ink-900">We couldn&apos;t open this design</p>
        <p className="max-w-sm text-sm text-muted">{loadError}</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <SpinnerGap className="size-8 animate-spin text-muted" weight="bold" />
      </div>
    );
  }

  if (mode === "review") {
    return (
      <ReviewPanel
        project={project}
        sides={sides}
        profile={profile}
        priceBreakdown={priceBreakdown}
        onBack={() => setMode("edit")}
        onApprove={handleApproveAndAddToCart}
        addedToCart={addedToCart}
      />
    );
  }

  if (mode === "preview") {
    const view = mockupViewFor(activeSide);
    const mockupUrl = project.mockupImages[view] ?? (activeLocation?.usesPlacementPreview ? GENERIC_PLACEMENT_MOCKUP : null);
    return (
      <PreviewMode
        openSides={openSides}
        activeSide={activeSide}
        onSelectSide={setActiveSide}
        mockupUrl={mockupUrl}
        objects={activeObjects}
        profile={profile}
        onBack={() => setMode("edit")}
      />
    );
  }

  const view = mockupViewFor(activeSide);
  const mockupUrl = project.mockupImages[view] ?? (activeLocation?.usesPlacementPreview ? GENERIC_PLACEMENT_MOCKUP : null);
  const cropTarget = cropTargetId ? activeObjects.find((o) => o.id === cropTargetId) ?? null : null;

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
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

      <TopBar
        productHref={`/products/${project.categorySlug}/${project.subcategorySlug}/${project.productSlug}`}
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

      <div className="flex flex-1 flex-col pb-16 lg:flex-row lg:pb-0">
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

        {/* Canvas */}
        <main className="relative flex flex-1 flex-col items-center justify-center gap-4 p-6">
          <LocationSelector
            profile={profile}
            openSides={openSides}
            activeSide={activeSide}
            sidesWithArt={new Set(openSides.filter((s) => (sides[s]?.length ?? 0) > 0))}
            onSelect={handleSelectLocation}
            onAddLocation={handleAddLocation}
            addingLocation={addingLocation}
          />

          <div className="relative flex w-full flex-1 items-center justify-center">
            {uploadError && (
              <div className="absolute left-1/2 top-0 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-crimson/10 px-4 py-2 text-xs font-medium text-crimson">
                <WarningCircle className="size-4" weight="bold" />
                {uploadError}
              </div>
            )}
            <CanvasStage
              location={activeSide}
              mockupUrl={mockupUrl}
              objects={activeObjects}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onCommitObject={(id, patch) => commitObjectPatch(id, patch)}
              editingTextId={editingTextId}
              onEditRequest={setEditingTextId}
              onEditCommit={commitTextEdit}
              placementPreview={activeLocation?.usesPlacementPreview ?? false}
              zoom={zoom}
            />

            {showOnboarding && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-ink-950/40 p-6">
                <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-xl">
                  <h2 className="font-display text-lg font-semibold text-ink-900">Start your design</h2>
                  <p className="mt-1.5 text-sm text-muted">Use a template, upload your own, or add text — you can always add more.</p>
                  <div className="mt-5 flex flex-col gap-2">
                    <button type="button" onClick={() => closePanelAnd(() => setActiveTool("designs"))} className="rounded-full bg-maple-gradient px-4 py-2.5 text-sm font-semibold text-ink-950">
                      Use a template
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowOnboarding(false);
                        fileInputRef.current?.click();
                      }}
                      className="rounded-full border border-sand px-4 py-2.5 text-sm font-semibold text-ink-900 hover:bg-canvas"
                    >
                      Upload my design
                    </button>
                    <button type="button" onClick={() => addText({ label: "Body text", sampleSize: "text-sm", fontSize: 32, bold: false })} className="rounded-full border border-sand px-4 py-2.5 text-sm font-semibold text-ink-900 hover:bg-canvas">
                      Add text
                    </button>
                    <button type="button" onClick={() => setShowOnboarding(false)} className="mt-1 text-xs font-medium text-muted hover:text-ink-900">
                      I&apos;ll start on my own
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <ZoomControls zoom={zoom} onZoomChange={setZoom} />
        </main>

        {/* Right inspector */}
        <aside className="shrink-0 border-t border-sand bg-white p-4 lg:w-72 lg:border-l lg:border-t-0">
          <Inspector
            selectedObject={selectedObject}
            onPatch={(id, patch) => commitObjectPatch(id, patch)}
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
        </aside>
      </div>

      {addedToCart && (
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
