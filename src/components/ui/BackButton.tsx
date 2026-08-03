"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";

export function BackButton({ className = "" }: { className?: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className={`group mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white/75 transition-colors hover:border-white/25 hover:bg-white/10 hover:text-white ${className}`}
    >
      <ArrowLeft
        className="size-4 transition-transform duration-200 ease-[var(--ease-premium)] group-hover:-translate-x-0.5"
        weight="bold"
      />
      Back
    </button>
  );
}
