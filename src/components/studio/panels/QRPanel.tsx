"use client";

import { useState } from "react";
import { LinkSimple, QrCode as QrCodeIcon, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";
import { isLikelyUrl, QR_SOCIAL_PRESETS } from "@/lib/studio/qr";

/** Section "NEW LEFT TOOL — QR CODE" / "QR PANEL": the entry point only creates a code from a
 *  destination — every style/colour/logo/frame control lives in the right Inspector once the
 *  object exists (Section "QR LIVE EDITING"), so this stays a single simple step. */
export function QRPanel({ onCreate, creating }: { onCreate: (destination: string) => void; creating: boolean }) {
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
        <p className="mt-1 text-xs text-muted">Turn a link into a printable QR code.</p>
      </div>

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
        onClick={() => onCreate(destination)}
        className="flex w-full items-center justify-center gap-1.5 rounded-full bg-maple-gradient px-4 py-2.5 text-sm font-semibold text-ink-950 transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
      >
        {creating ? "Creating…" : "Create QR Code"}
      </button>

      <p className="text-[11px] leading-relaxed text-muted">
        Generated entirely in your browser and checked that it actually scans before it&apos;s placed —
        nothing is sent to a third-party QR service.
      </p>
    </div>
  );
}
