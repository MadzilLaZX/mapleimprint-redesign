"use client";

import { SpinnerGap, UploadSimple, WarningCircle } from "@phosphor-icons/react/dist/ssr";

export interface RecentUpload {
  url: string;
  name: string;
}

/** "My Uploads" for MVP is this session's own upload history (resets on reload) — there's no
 *  per-customer account/persistent uploads table yet (Section 13 lists that as a later step: "a
 *  returning business customer should not need to upload their logo every time" needs real
 *  accounts first). Honest scope for now rather than a fake "saved forever" promise. */
export function UploadsPanel({
  onTriggerUpload,
  uploading,
  uploadError,
  recent,
  onUseRecent,
}: {
  onTriggerUpload: () => void;
  uploading: boolean;
  uploadError: string | null;
  recent: RecentUpload[];
  onUseRecent: (url: string) => void;
}) {
  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onTriggerUpload}
        disabled={uploading}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-sand py-6 text-sm font-semibold text-ink-900 transition-colors hover:border-ink-950/30 hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-60"
      >
        {uploading ? <SpinnerGap className="size-4 animate-spin" weight="bold" /> : <UploadSimple className="size-4" weight="bold" />}
        {uploading ? "Uploading…" : "Upload image or logo"}
      </button>
      <p className="text-center text-xs text-muted">PNG or JPG. We&apos;ll flag anything too low-res to print well.</p>

      {uploadError && (
        <p className="flex items-center gap-1.5 rounded-lg bg-crimson/10 px-3 py-2 text-xs font-medium text-crimson">
          <WarningCircle className="size-4 shrink-0" weight="bold" />
          {uploadError}
        </p>
      )}

      {recent.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">This session</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {recent.map((u, i) => (
              <button
                key={`${u.url}-${i}`}
                type="button"
                onClick={() => onUseRecent(u.url)}
                className="aspect-square overflow-hidden rounded-lg border border-sand bg-white transition-colors hover:border-ink-950/30"
                title={u.name}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- small panel thumbnail, not a Next/Image-worthy asset */}
                <img src={u.url} alt={u.name} className="size-full object-contain" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
