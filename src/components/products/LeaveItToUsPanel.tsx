"use client";

import { useState } from "react";
import { X, Check, SpinnerGap, UploadSimple } from "@phosphor-icons/react/dist/ssr";
import { useCart } from "@/components/cart/CartProvider";
import type { CatalogueProduct } from "@/lib/products";

type DesignStatus = "have-logo" | "need-help" | "not-sure";
type Placement = "front" | "back" | "left-chest" | "sleeve" | "recommend-for-me";

const DESIGN_STATUS_OPTIONS: { value: DesignStatus; label: string }[] = [
  { value: "have-logo", label: "I have a logo/design" },
  { value: "need-help", label: "I have an idea but need help" },
  { value: "not-sure", label: "I'm not sure yet" },
];

const PLACEMENT_OPTIONS: { value: Placement; label: string }[] = [
  { value: "front", label: "Front" },
  { value: "back", label: "Back" },
  { value: "left-chest", label: "Left chest" },
  { value: "sleeve", label: "Sleeve" },
  { value: "recommend-for-me", label: "Not sure — recommend it for me" },
];

export function LeaveItToUsPanel({
  product,
  categoryName,
  selectedColour,
  sizeBreakdown,
  totalQuantity,
  onClose,
}: {
  product: CatalogueProduct;
  categoryName: string;
  selectedColour: string;
  sizeBreakdown: { size: string; qty: number }[];
  totalQuantity: number;
  onClose: () => void;
}) {
  const { addItem } = useCart();
  const [designStatus, setDesignStatus] = useState<DesignStatus>("have-logo");
  const [placement, setPlacement] = useState<Placement>("front");
  const [notes, setNotes] = useState("");
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleUpload(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/studio/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");
      setUploadedFileUrl(data.url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function handleSubmit() {
    addItem(
      {
        id: `assisted-${product.categorySlug}-${product.subcategorySlug}-${product.slug}-${selectedColour}-${Date.now()}`,
        name: product.name,
        image: product.images[0]?.url ?? "",
        categorySlug: product.categorySlug,
        categoryName,
        colourName: selectedColour,
        sizeBreakdown,
        customizationType: "MAPLE_ASSISTED",
        assistanceBrief: { designStatus, placement, notes, uploadedFileUrl: uploadedFileUrl ?? undefined },
      },
      totalQuantity,
    );
    setSubmitted(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/50 sm:items-center sm:p-6">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-white p-6 sm:rounded-[28px]">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink-900">Leave it to us</h2>
            <p className="mt-1 text-sm text-muted">
              Tell us what you have in mind — Maple Imprint will help prepare the design.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-full p-1.5 text-muted transition-colors hover:bg-canvas hover:text-ink-900"
          >
            <X className="size-5" />
          </button>
        </div>

        {submitted ? (
          <div className="mt-8 flex flex-col items-center text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-crimson/10 text-crimson">
              <Check className="size-6" weight="bold" />
            </span>
            <p className="mt-4 font-display font-semibold text-ink-900">Added to your cart</p>
            <p className="mt-1.5 text-sm text-muted">
              We&apos;ve saved your brief with this item. Get a quote when you&apos;re ready and we&apos;ll take it from there.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 rounded-full bg-ink-950 px-5 py-2.5 text-sm font-semibold text-white"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            <div className="rounded-2xl bg-canvas p-4 text-sm text-ink-900">
              <p className="font-semibold">{product.name}</p>
              <p className="mt-0.5 text-muted">
                {selectedColour} · {sizeBreakdown.map((s) => `${s.size} ×${s.qty}`).join(", ")} · {totalQuantity} total
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">What would you like printed?</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {DESIGN_STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDesignStatus(opt.value)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      designStatus === opt.value
                        ? "border-transparent bg-ink-950 text-white"
                        : "border-sand text-ink-900/70 hover:border-ink-950/25"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Upload artwork (optional)</p>
              <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-sand px-4 py-3 text-sm text-muted transition-colors hover:border-ink-950/25">
                {uploading ? (
                  <SpinnerGap className="size-4 animate-spin" weight="bold" />
                ) : (
                  <UploadSimple className="size-4" weight="bold" />
                )}
                {uploadedFileUrl ? "Replace file" : "Choose a file"}
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUpload(file);
                  }}
                />
              </label>
              {uploadedFileUrl && <p className="mt-1.5 text-xs text-crimson">File attached ✓</p>}
              {uploadError && <p className="mt-1.5 text-xs text-crimson">{uploadError}</p>}
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Where do you think you want it?</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {PLACEMENT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPlacement(opt.value)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      placement === opt.value
                        ? "border-transparent bg-ink-950 text-white"
                        : "border-sand text-ink-900/70 hover:border-ink-950/25"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="assist-notes" className="text-xs font-semibold uppercase tracking-wide text-muted">
                What should we know?
              </label>
              <textarea
                id="assist-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Optional"
                className="mt-2 w-full rounded-xl border border-sand px-3 py-2 text-sm text-ink-900 outline-none focus:border-ink-950/25"
              />
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              className="w-full rounded-full bg-maple-gradient px-6 py-3 text-sm font-semibold text-ink-950"
            >
              Let Maple handle it
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
