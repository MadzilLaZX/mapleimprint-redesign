"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { buildShopUrl, type ShopSearchParams } from "@/lib/shopQuery";

// Keyed by params.q at the call site (see shop/page.tsx) so this remounts — resetting `value`
// from the fresh initial state below — whenever the URL's q changes from outside this input
// (a filter chip, browser back/forward), rather than syncing via a useState-in-effect.
export function ShopSearchInput({ params }: { params: ShopSearchParams }) {
  const router = useRouter();
  const [value, setValue] = useState(params.q ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function handleChange(next: string) {
    setValue(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      router.push(buildShopUrl(params, { q: next || undefined }));
    }, 400);
  }

  return (
    <div className="relative w-full max-w-xs">
      <MagnifyingGlass className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" weight="bold" />
      <input
        type="search"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Search products"
        aria-label="Search products"
        className="w-full rounded-full border border-sand bg-white py-2.5 pl-10 pr-4 text-sm text-ink-900 outline-none transition-colors placeholder:text-muted focus:border-ink-950/25"
      />
    </div>
  );
}
