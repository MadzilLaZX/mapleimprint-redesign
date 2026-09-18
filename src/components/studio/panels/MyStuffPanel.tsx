"use client";

import { useState } from "react";
import { Copy, PencilSimple, PlusCircle, QrCode, Trash } from "@phosphor-icons/react/dist/ssr";
import { destinationHost } from "@/lib/studio/qr";
import type { QrAsset } from "@/lib/studio/qrAssets";
import type { RecentUpload } from "./UploadsPanel";

/** MVP scope for Section 13: this session's uploads, plus an honest note about what's not built
 *  yet. A persistent cross-visit "My Uploads"/"Saved Templates" library needs real customer
 *  accounts (this app currently identifies Studio sessions by an anonymous cookie, not a login) —
 *  deferred rather than faked. QR Codes (Section "MY STUFF — QR CODES") is the one exception: it
 *  genuinely does persist across reloads within this session/browser — see qrAssets.ts's header
 *  for why that's practical for QR (small structured data) where it wasn't for uploads (images). */
export function MyStuffPanel({
  recent,
  onUseRecent,
  qrAssets,
  onAddQrToDesign,
  onEditQr,
  onDuplicateQr,
  onDeleteQr,
  onRenameQr,
}: {
  recent: RecentUpload[];
  onUseRecent: (url: string) => void;
  qrAssets: QrAsset[];
  onAddQrToDesign: (assetId: string) => void;
  onEditQr: (assetId: string) => void;
  onDuplicateQr: (assetId: string) => void;
  onDeleteQr: (assetId: string) => void;
  onRenameQr: (assetId: string, name: string) => void;
}) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");

  function commitRename(assetId: string) {
    onRenameQr(assetId, nameDraft);
    setRenamingId(null);
  }
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">This session&apos;s uploads</p>
        {recent.length === 0 ? (
          <p className="mt-2 text-xs text-muted">Nothing uploaded yet — anything you upload will show up here.</p>
        ) : (
          <div className="mt-2 grid grid-cols-3 gap-2">
            {recent.map((u, i) => (
              <button
                key={`${u.url}-${i}`}
                type="button"
                onClick={() => onUseRecent(u.url)}
                className="aspect-square overflow-hidden rounded-lg border border-sand bg-white transition-colors hover:border-ink-950/30"
                title={u.name}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u.url} alt={u.name} className="size-full object-contain" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Section "MY STUFF — QR CODES" */}
      <div className="border-t border-sand pt-4">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
          <QrCode className="size-3.5" weight="bold" /> QR Codes
        </p>
        {qrAssets.length === 0 ? (
          <p className="mt-2 text-xs text-muted">Nothing created yet — use the QR Code tool to generate one; it&apos;ll show up here, reusable on any print area.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {qrAssets.map((asset) => (
              <li key={asset.id} className="rounded-xl border border-sand p-2">
                <div className="flex items-center gap-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element -- small panel thumbnail */}
                  <img src={asset.displayDataUrl} alt="" className="size-10 shrink-0 rounded-lg border border-sand bg-white object-contain" />
                  <div className="min-w-0 flex-1">
                    {renamingId === asset.id ? (
                      <input
                        autoFocus
                        value={nameDraft}
                        onChange={(e) => setNameDraft(e.target.value)}
                        onBlur={() => commitRename(asset.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitRename(asset.id);
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                        className="w-full rounded border border-ink-950/30 bg-white px-1 py-0.5 text-xs font-semibold text-ink-900 outline-none"
                      />
                    ) : (
                      <p
                        className="truncate text-xs font-semibold text-ink-900"
                        title="Click to rename"
                        onClick={() => {
                          setNameDraft(asset.displayName);
                          setRenamingId(asset.id);
                        }}
                      >
                        {asset.displayName}
                      </p>
                    )}
                    <p className="truncate text-[11px] text-muted">{destinationHost(asset.destination)}</p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => onAddQrToDesign(asset.id)}
                    className="flex items-center gap-1 rounded-full bg-ink-950 px-2.5 py-1 text-[11px] font-semibold text-white"
                  >
                    <PlusCircle className="size-3" weight="bold" /> Add to Design
                  </button>
                  <button
                    type="button"
                    onClick={() => onEditQr(asset.id)}
                    className="flex items-center gap-1 rounded-full border border-sand px-2.5 py-1 text-[11px] font-semibold text-ink-900 hover:bg-canvas"
                  >
                    <PencilSimple className="size-3" weight="bold" /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onDuplicateQr(asset.id)}
                    className="flex items-center gap-1 rounded-full border border-sand px-2.5 py-1 text-[11px] font-semibold text-ink-900 hover:bg-canvas"
                  >
                    <Copy className="size-3" weight="bold" /> Duplicate
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteQr(asset.id)}
                    className="ml-auto flex items-center gap-1 rounded-full border border-sand px-2.5 py-1 text-[11px] font-semibold text-crimson hover:bg-crimson/5"
                  >
                    <Trash className="size-3" weight="bold" /> Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl bg-canvas p-3 text-xs leading-relaxed text-muted">
        Saved logos and designs that follow your account across visits need a Maple account to
        store them — reach out to our team and we&apos;ll keep your logo on file for next time.
      </div>
    </div>
  );
}
