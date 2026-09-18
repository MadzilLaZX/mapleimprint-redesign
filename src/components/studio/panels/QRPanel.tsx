"use client";

import { useState } from "react";
import { Check, LinkSimple, QrCode as QrCodeIcon, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";
import { destinationHost, isLikelyUrl, QR_SOCIAL_PRESETS } from "@/lib/studio/qr";
import type { QrAsset } from "@/lib/studio/qrAssets";
import type { DesignObjectRecord } from "@/lib/studio/types";

/** Section "NEW LEFT TOOL — QR CODE" / "QR PANEL": the entry point only creates a code from a
 *  destination — every style/colour/logo/frame control lives in the right Inspector once the
 *  object exists (Section "QR LIVE EDITING"), so this stays a single simple step. Also shows
 *  "CURRENT QR" (Section 28, when the selected canvas object is a QR) and "RECENT QR CODES"
 *  (Section 4) so a previously generated code is reusable without regenerating it. */
export function QRPanel({
  onCreate,
  creating,
  recentAssets,
  onUseRecent,
  currentQr,
  onEditCurrentDestination,
}: {
  onCreate: (destination: string, platform: string) => void;
  creating: boolean;
  recentAssets: QrAsset[];
  onUseRecent: (assetId: string) => void;
  currentQr: DesignObjectRecord | null;
  onEditCurrentDestination: () => void;
}) {
  const [platform, setPlatform] = useState(QR_SOCIAL_PRESETS[0].id);
  const [destination, setDestination] = useState("");
  const [touched, setTouched] = useState(false);

  const active = QR_SOCIAL_PRESETS.find((p) => p.id === platform) ?? QR_SOCIAL_PRESETS[0];
  const valid = isLikelyUrl(destination);
  const showError = touched && destination.trim().length > 0 && !valid;

  return (
    <div className="space-y-4">
      <div>
        <p className="flex items-center gap-1.5 font-display text-sm font-semibold text-ink-900">
          <QrCodeIcon className="size-4" weight="bold" /> QR Code
        </p>
        <p className="mt-1 text-xs text-muted">Turn a link into a printable, reusable QR code.</p>
      </div>

      {/* Section "QR SECTION SHOULD SHOW ACTIVE ASSET" */}
      {currentQr && (
        <div className="flex items-center gap-2.5 rounded-xl border border-sand bg-canvas p-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element -- small panel thumbnail */}
          <img src={currentQr.assetUrl ?? ""} alt="" className="size-11 shrink-0 rounded-lg border border-sand bg-white object-contain" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-ink-900">{currentQr.name ?? "QR Code"}</p>
            <p className="truncate text-[11px] text-muted">{currentQr.qrDestination ? destinationHost(currentQr.qrDestination) : ""}</p>
          </div>
          {currentQr.qrValidated ? (
            <Check className="size-4 shrink-0 text-ink-900/60" weight="bold" />
          ) : (
            <WarningCircle className="size-4 shrink-0 text-crimson" weight="bold" />
          )}
          <button
            type="button"
            onClick={onEditCurrentDestination}
            className="shrink-0 rounded-full border border-sand px-2.5 py-1 text-[11px] font-semibold text-ink-900 hover:bg-white"
          >
            Edit QR
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {QR_SOCIAL_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPlatform(p.id)}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
              platform === p.id ? "bg-ink-950 text-white" : "bg-canvas text-ink-900/70 hover:bg-sand/60",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div>
        <label className="text-xs font-medium text-ink-900/70">Destination</label>
        <div className="relative mt-1">
          <LinkSimple className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" weight="bold" />
          <input
            type="text"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder={active.placeholder}
            className={cn(
              "w-full rounded-xl border py-2 pl-9 pr-3 text-sm outline-none",
              showError ? "border-crimson focus:border-crimson" : "border-sand focus:border-ink-950/30",
            )}
          />
        </div>
        <p className="mt-1.5 text-[11px] text-muted">{active.help}</p>
        {showError && (
          <p className="mt-1 flex items-center gap-1 text-[11px] text-crimson">
            <WarningCircle className="size-3.5" weight="bold" /> That doesn&apos;t look like a valid link yet.
          </p>
        )}
      </div>

      <button
        type="button"
        disabled={!valid || creating}
        onClick={() => onCreate(destination, platform)}
        className="flex w-full items-center justify-center gap-1.5 rounded-full bg-maple-gradient px-4 py-2.5 text-sm font-semibold text-ink-950 transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
      >
        {creating ? "Creating…" : "Create QR Code"}
      </button>

      <p className="text-[11px] leading-relaxed text-muted">
        Generated entirely in your browser and checked that it actually scans before it&apos;s placed —
        nothing is sent to a third-party QR service.
      </p>

      {/* Section "QR PANEL — RECENT QR CODES": clicking one reuses it (a new placement of the same
          asset) — never regenerates or re-validates it, since nothing about the code changed. */}
      {recentAssets.length > 0 && (
        <div className="border-t border-sand pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Recent QR Codes</p>
          <div className="mt-2 space-y-1.5">
            {recentAssets.slice(0, 8).map((asset) => (
              <button
                key={asset.id}
                type="button"
                onClick={() => onUseRecent(asset.id)}
                className="flex w-full items-center gap-2.5 rounded-xl border border-sand p-2 text-left transition-colors hover:border-ink-950/30 hover:bg-canvas"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- small panel thumbnail */}
                <img src={asset.displayDataUrl} alt="" className="size-9 shrink-0 rounded-lg border border-sand bg-white object-contain" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-ink-900">{asset.displayName}</p>
                  <p className="truncate text-[11px] text-muted">{destinationHost(asset.destination)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
