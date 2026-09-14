"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Check, X } from "@phosphor-icons/react/dist/ssr";
import { Header } from "@/components/layout/Header";
import { LAST_SHOP_URL_KEY } from "@/components/shop/ShopUrlMemory";
import { DURATION, EASE_PREMIUM } from "@/lib/motion";
import type { DesignProjectRecord } from "@/lib/studio/types";

const EXIT_DELAY_MS = 160;

/** Shown after a successful Approve & Add to Cart, still on /studio/[id] — this is the bridge
 *  between DESIGN MODE and SHOPPING MODE the brief describes, not a new route. It mounts the real
 *  `Header` component (never a second, hand-copied header implementation) and animates it in from
 *  above, then reveals a confirmation tray beneath it. Reduced-motion users get the same content
 *  with instant/fade-only state changes instead of the translate entrances. */
export function PostCartConfirmation({
  project,
  onClose,
}: {
  project: DesignProjectRecord;
  onClose: () => void;
}) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [exiting, setExiting] = useState<"cart" | "shop" | null>(null);

  const previewImage = project.mockupImages.front ?? project.mockupImages.back ?? null;
  const sizeSummary = project.sizeBreakdown.map((s) => `${s.size} ×${s.qty}`).join(", ");

  function navigateAfterExit(destination: "cart" | "shop") {
    setExiting(destination);
    const go = () => router.push(destination === "cart" ? "/cart" : lastShopUrl());
    if (reduce) {
      go();
      return;
    }
    window.setTimeout(go, EXIT_DELAY_MS);
  }

  function lastShopUrl(): string {
    try {
      return window.sessionStorage.getItem(LAST_SHOP_URL_KEY) ?? "/shop";
    } catch {
      return "/shop";
    }
  }

  return (
    <motion.div
      animate={exiting ? { opacity: 0, y: reduce ? 0 : -4 } : { opacity: 1, y: 0 }}
      transition={{ duration: exiting ? EXIT_DELAY_MS / 1000 : 0, ease: EASE_PREMIUM }}
      className="flex h-full flex-col overflow-y-auto bg-canvas"
    >
      {/* Height animates open alongside the header sliding into it (Section 16, option B) — the
          alternative, letting the wrapper snap to full height immediately, is exactly the "shove
          the content down by 80px with no transition" the brief calls out. */}
      <motion.div
        initial={reduce ? false : { height: 0 }}
        animate={{ height: "auto" }}
        transition={{ duration: DURATION.mode, ease: EASE_PREMIUM }}
        className="shrink-0 overflow-hidden"
      >
        <motion.div
          initial={reduce ? false : { y: "-100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: DURATION.mode, ease: EASE_PREMIUM }}
        >
          <Header />
        </motion.div>
      </motion.div>

      <div className="flex flex-1 items-start justify-center px-4 py-6 sm:py-10">
        <motion.div
          role="region"
          aria-label="Added to cart"
          initial={reduce ? false : { y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: DURATION.panel, ease: EASE_PREMIUM, delay: reduce ? 0 : 0.1 }}
          className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-xl"
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 rounded-full p-1.5 text-ink-900/40 transition-colors hover:bg-canvas hover:text-ink-900"
          >
            <X className="size-4" weight="bold" />
          </button>

          {/* Announced once for screen readers — the visible checkmark/copy above is presentational. */}
          <p role="status" aria-live="polite" className="sr-only">
            Custom {project.productName} added to cart.
          </p>

          <div className="flex items-center gap-2 text-ink-900">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-crimson/10 text-crimson">
              <Check className="size-4" weight="bold" />
            </span>
            <p className="font-display text-base font-semibold">Your design was added to the cart</p>
          </div>

          <div className="mt-5 flex items-center gap-3 rounded-2xl bg-canvas p-3">
            {previewImage && (
              <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-white">
                <Image src={previewImage} alt="" fill sizes="64px" className="object-contain p-1.5" />
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-semibold text-ink-900">{project.productName}</p>
              <p className="truncate text-xs text-muted">
                {project.colourName}
                {sizeSummary ? ` · ${sizeSummary}` : ""}
              </p>
              <p className="mt-1 inline-flex items-center rounded-full bg-crimson/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-crimson">
                Customized
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => navigateAfterExit("cart")}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-ink-950 px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              View Cart →
            </button>
            <button
              type="button"
              onClick={() => navigateAfterExit("shop")}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-sand px-4 py-2.5 text-sm font-semibold text-ink-900 transition-colors hover:bg-canvas"
            >
              Continue Shopping
            </button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
