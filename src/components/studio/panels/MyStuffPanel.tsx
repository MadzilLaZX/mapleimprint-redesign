"use client";

import type { RecentUpload } from "./UploadsPanel";

/** MVP scope for Section 13: this session's uploads, plus an honest note about what's not built
 *  yet. A persistent cross-visit "My Uploads"/"Saved Templates" library needs real customer
 *  accounts (this app currently identifies Studio sessions by an anonymous cookie, not a login) —
 *  deferred rather than faked. */
export function MyStuffPanel({ recent, onUseRecent }: { recent: RecentUpload[]; onUseRecent: (url: string) => void }) {
  return (
    <div className="space-y-4">
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

      <div className="rounded-xl bg-canvas p-3 text-xs leading-relaxed text-muted">
        Saved logos and designs that follow your account across visits need a Maple account to
        store them — reach out to our team and we&apos;ll keep your logo on file for next time.
      </div>
    </div>
  );
}
