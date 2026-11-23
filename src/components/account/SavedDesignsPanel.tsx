"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText } from "@phosphor-icons/react/dist/ssr";

interface SavedDesign {
  id: string;
  productName: string;
  colourName: string | null;
  totalQuantity: number;
  status: "draft" | "reviewed" | "ordered";
  mockupImages: Partial<Record<string, string>>;
  updatedAt: string;
}

/** Real "saved designs" list, scoped to this browser's own mi-session cookie -- see /api/studio's
 *  GET handler for the authorization model. Replaces the permanently-disabled placeholder panel
 *  that used to live inline in account/page.tsx; the other three panels (Orders, Quotes & proofs,
 *  Invoices) stay disabled because they genuinely need a real account/login system to work across
 *  devices -- this one doesn't, since it only ever recovers what THIS browser can already reach. */
export function SavedDesignsPanel() {
  const [designs, setDesigns] = useState<SavedDesign[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/studio")
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json.error) setError(json.error);
        else setDesigns(json.projects ?? []);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load your saved designs.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="rounded-2xl bg-white p-5">
      <FileText className="size-5 text-crimson" weight="duotone" />
      <p className="mt-3 font-display font-semibold text-ink-900">Saved designs</p>
      <p className="mt-1 text-sm leading-relaxed text-muted">Reopen a design you started on this device.</p>

      {error && <p className="mt-3 text-xs text-crimson">{error}</p>}

      {designs === null && !error && <p className="mt-3 text-xs text-muted">Loading…</p>}

      {designs && designs.length === 0 && (
        <p className="mt-3 text-xs text-muted">No designs saved on this browser yet.</p>
      )}

      {designs && designs.length > 0 && (
        <ul className="mt-3 space-y-2">
          {designs.map((d) => {
            const thumb = d.mockupImages.front ?? d.mockupImages.back ?? Object.values(d.mockupImages)[0];
            return (
              <li key={d.id}>
                <Link href={`/studio/${d.id}`} className="flex items-center gap-3 rounded-xl p-2 hover:bg-canvas">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element -- a stored, stable mockup URL, not a signed one
                    <img src={thumb} alt="" className="size-10 rounded-lg object-cover" />
                  ) : (
                    <span className="flex size-10 items-center justify-center rounded-lg bg-canvas text-xs text-muted">—</span>
                  )}
                  <span className="text-sm text-ink-900">
                    {d.productName}
                    {d.colourName ? ` (${d.colourName})` : ""}
                    <span className="block text-xs text-muted">
                      {d.status === "ordered" ? "Ordered" : d.status === "reviewed" ? "Approved" : "In progress"} · ×{d.totalQuantity}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
