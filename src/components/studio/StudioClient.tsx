"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUUpLeft,
  ArrowUUpRight,
  Check,
  Copy,
  SpinnerGap,
  TextT,
  Trash,
  UploadSimple,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";
import { useCart } from "@/components/cart/CartProvider";
import type { DesignObjectRecord, DesignProjectRecord, DesignSideType } from "@/lib/studio/types";
import { ReviewPanel } from "@/components/studio/ReviewPanel";

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
const FONT_CHOICES = ["Manrope, sans-serif", "Bricolage Grotesque, sans-serif", "Georgia, serif", "Courier New, monospace"];

function emptyObject(type: "text" | "image", overrides: Partial<DesignObjectRecord>): DesignObjectRecord {
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
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [mode, setMode] = useState<"edit" | "review">("edit");
  const [addedToCart, setAddedToCart] = useState(false);

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

  // Called with the sides state as it was BEFORE the mutation about to happen, from the same
  // synchronous handler that then calls applySides — snapshotting via a closure argument rather
  // than a ref, so history stays real React state (readable during render for the undo/redo
  // buttons' disabled state) instead of a mutable ref the compiler can't safely track.
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

  // Autosave: debounce writes, always saving the latest sides state after the pause.
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
  const availableSides = project?.sides.map((s) => s.sideType) ?? [];

  function addText() {
    pushHistory(sides);
    const obj = emptyObject("text", {
      content: "Your text",
      fontFamily: FONT_CHOICES[0],
      fontSize: 32,
      fill: "#171412",
      normalizedWidth: 0.55,
      normalizedHeight: 0.12,
    });
    applySides({ ...sides, [activeSide]: [...activeObjects, obj] });
    setSelectedId(obj.id);
    setEditingTextId(obj.id);
    setShowOnboarding(false);
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
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function commitObjectPatch(id: string, patch: Partial<DesignObjectRecord>) {
    pushHistory(sides);
    applySides({
      ...sides,
      [activeSide]: activeObjects.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    });
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

  const locationsWithArt = availableSides.filter((s) => (sides[s]?.length ?? 0) > 0).length;

  // Cheap arithmetic on a handful of numbers — plain computation each render, no memoization
  // needed (and the object literal in the deps array meant this could never be preserved anyway).
  const priceBreakdown = (() => {
    const snapshot = project?.pricingSnapshot;
    if (!snapshot) return null;
    const locations = Math.max(1, locationsWithArt);
    const perUnitPrinting =
      snapshot.chartFirstLocationCost + snapshot.chartAdditionalLocationCost * (locations - 1);
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

  const hasAnyDesign = availableSides.some((s) => (sides[s]?.length ?? 0) > 0);

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
        <Link href="/shop" className="rounded-full bg-ink-950 px-5 py-2.5 text-sm font-semibold text-white">
          Back to shop
        </Link>
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
        priceBreakdown={priceBreakdown}
        onBack={() => setMode("edit")}
        onApprove={handleApproveAndAddToCart}
        addedToCart={addedToCart}
      />
    );
  }

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

      {/* Top bar */}
      <header className="flex items-center justify-between gap-3 border-b border-sand bg-white px-4 py-3 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={`/products/${project.categorySlug}/${project.subcategorySlug}/${project.productSlug}`}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-sand px-3 py-1.5 text-xs font-semibold text-ink-900 transition-colors hover:border-ink-950/25"
          >
            <ArrowLeft className="size-3.5" weight="bold" />
            Product
          </Link>
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-semibold text-ink-900">{project.productName}</p>
            <p className="text-xs text-muted">{project.colourName}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Undo"
            disabled={history.past.length === 0}
            onClick={undo}
            className="rounded-full p-2 text-ink-900 transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ArrowUUpLeft className="size-4" weight="bold" />
          </button>
          <button
            type="button"
            aria-label="Redo"
            disabled={history.future.length === 0}
            onClick={redo}
            className="rounded-full p-2 text-ink-900 transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ArrowUUpRight className="size-4" weight="bold" />
          </button>
          <span className="hidden text-xs text-muted sm:inline">
            {saveStatus === "saving" && "Saving…"}
            {saveStatus === "saved" && "Saved ✓"}
            {saveStatus === "error" && "Couldn't save — retrying"}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {priceBreakdown && (
            <p className="hidden font-display text-sm font-semibold text-ink-900 sm:block">
              ${priceBreakdown.total.toFixed(2)}
            </p>
          )}
          <button
            type="button"
            disabled={!hasAnyDesign}
            onClick={() => setMode("review")}
            className="rounded-full bg-maple-gradient px-4 py-2 text-sm font-semibold text-ink-950 transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            Review
          </button>
        </div>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row">
        {/* Left toolbar */}
        <aside className="flex shrink-0 gap-2 overflow-x-auto border-b border-sand bg-white p-3 lg:w-40 lg:flex-col lg:border-b-0 lg:border-r lg:p-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-900 transition-colors hover:bg-canvas lg:w-full"
          >
            {uploading ? <SpinnerGap className="size-4 animate-spin" weight="bold" /> : <UploadSimple className="size-4" weight="bold" />}
            Upload
          </button>
          <button
            type="button"
            onClick={addText}
            className="flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-900 transition-colors hover:bg-canvas lg:w-full"
          >
            <TextT className="size-4" weight="bold" />
            Text
          </button>

          {availableSides.length > 1 && (
            <div className="ml-auto flex shrink-0 gap-1 rounded-full border border-sand p-1 lg:ml-0 lg:mt-4">
              {availableSides.map((side) => (
                <button
                  key={side}
                  type="button"
                  onClick={() => {
                    setActiveSide(side);
                    setSelectedId(null);
                  }}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition-colors",
                    activeSide === side ? "bg-ink-950 text-white" : "text-ink-900/70 hover:bg-canvas",
                  )}
                >
                  {side}
                </button>
              ))}
            </div>
          )}
        </aside>

        {/* Canvas */}
        <main className="relative flex flex-1 items-center justify-center p-6">
          {uploadError && (
            <div className="absolute left-1/2 top-4 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-crimson/10 px-4 py-2 text-xs font-medium text-crimson">
              <WarningCircle className="size-4" weight="bold" />
              {uploadError}
            </div>
          )}
          <CanvasStage
            mockupUrl={project.mockupImages[activeSide] ?? null}
            objects={activeObjects}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onCommitObject={commitObjectPatch}
            editingTextId={editingTextId}
            onEditRequest={setEditingTextId}
            onEditCommit={commitTextEdit}
          />

          {showOnboarding && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-ink-950/40 p-6">
              <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-xl">
                <h2 className="font-display text-lg font-semibold text-ink-900">What would you like to add?</h2>
                <p className="mt-1.5 text-sm text-muted">Start with a logo, or add some text — you can always add more.</p>
                <div className="mt-5 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowOnboarding(false);
                      fileInputRef.current?.click();
                    }}
                    className="rounded-full bg-maple-gradient px-4 py-2.5 text-sm font-semibold text-ink-950"
                  >
                    Upload a logo or design
                  </button>
                  <button
                    type="button"
                    onClick={addText}
                    className="rounded-full border border-sand px-4 py-2.5 text-sm font-semibold text-ink-900 hover:bg-canvas"
                  >
                    Add text
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowOnboarding(false)}
                    className="mt-1 text-xs font-medium text-muted hover:text-ink-900"
                  >
                    I&apos;ll start on my own
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Right inspector */}
        <aside className="shrink-0 border-t border-sand bg-white p-4 lg:w-64 lg:border-l lg:border-t-0">
          {!selectedObject ? (
            <p className="text-sm text-muted">Select something on the shirt to edit it.</p>
          ) : (
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                {selectedObject.type === "text" ? "Text" : "Image"}
              </p>

              {selectedObject.type === "text" && (
                <>
                  <div>
                    <label className="text-xs font-medium text-ink-900/70">Font</label>
                    <select
                      value={selectedObject.fontFamily ?? FONT_CHOICES[0]}
                      onChange={(e) => commitObjectPatch(selectedObject.id, { fontFamily: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-sand px-2 py-1.5 text-sm"
                    >
                      {FONT_CHOICES.map((f) => (
                        <option key={f} value={f} style={{ fontFamily: f }}>
                          {f.split(",")[0]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-ink-900/70">Size</label>
                    <input
                      type="range"
                      min={12}
                      max={80}
                      value={selectedObject.fontSize ?? 32}
                      onChange={(e) => commitObjectPatch(selectedObject.id, { fontSize: Number(e.target.value) })}
                      className="mt-1 w-full"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-ink-900/70">Colour</label>
                    <input
                      type="color"
                      value={selectedObject.fill ?? "#171412"}
                      onChange={(e) => commitObjectPatch(selectedObject.id, { fill: e.target.value })}
                      className="mt-1 h-9 w-full rounded-lg border border-sand"
                    />
                  </div>
                </>
              )}

              {selectedObject.type === "image" && (
                <div>
                  <label className="text-xs font-medium text-ink-900/70">Opacity</label>
                  <input
                    type="range"
                    min={0.2}
                    max={1}
                    step={0.05}
                    value={selectedObject.opacity}
                    onChange={(e) => commitObjectPatch(selectedObject.id, { opacity: Number(e.target.value) })}
                    className="mt-1 w-full"
                  />
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={duplicateSelected}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-sand py-2 text-xs font-semibold text-ink-900 hover:bg-canvas"
                >
                  <Copy className="size-3.5" weight="bold" />
                  Duplicate
                </button>
                <button
                  type="button"
                  onClick={deleteSelected}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-sand py-2 text-xs font-semibold text-crimson hover:bg-crimson/5"
                >
                  <Trash className="size-3.5" weight="bold" />
                  Delete
                </button>
              </div>
            </div>
          )}

          {priceBreakdown && (
            <div className="mt-6 space-y-1.5 border-t border-sand pt-4 text-xs">
              <div className="flex justify-between text-ink-900/70">
                <span>Shirts × {priceBreakdown.quantity}</span>
                <span>${priceBreakdown.blankSubtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-ink-900/70">
                <span>Design/customization</span>
                <span>${priceBreakdown.designFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-ink-900/70">
                <span>Printing ({priceBreakdown.locations} {priceBreakdown.locations === 1 ? "location" : "locations"})</span>
                <span>${priceBreakdown.printingSubtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-sand pt-1.5 font-semibold text-ink-900">
                <span>Total</span>
                <span>${priceBreakdown.total.toFixed(2)}</span>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Mobile bottom bar */}
      <div className="flex items-center justify-around border-t border-sand bg-white p-2 lg:hidden">
        <button type="button" onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-1 p-2 text-xs font-medium text-ink-900">
          <UploadSimple className="size-5" weight="bold" />
          Upload
        </button>
        <button type="button" onClick={addText} className="flex flex-col items-center gap-1 p-2 text-xs font-medium text-ink-900">
          <TextT className="size-5" weight="bold" />
          Text
        </button>
        {selectedObject && (
          <>
            <button type="button" onClick={duplicateSelected} className="flex flex-col items-center gap-1 p-2 text-xs font-medium text-ink-900">
              <Copy className="size-5" weight="bold" />
              Duplicate
            </button>
            <button type="button" onClick={deleteSelected} className="flex flex-col items-center gap-1 p-2 text-xs font-medium text-crimson">
              <Trash className="size-5" weight="bold" />
              Delete
            </button>
          </>
        )}
      </div>
      {addedToCart && (
        <div className="fixed bottom-20 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink-950 px-4 py-2.5 text-sm font-semibold text-white shadow-xl lg:bottom-6">
          <Check className="size-4" weight="bold" />
          Added to cart
        </div>
      )}
    </div>
  );
}
