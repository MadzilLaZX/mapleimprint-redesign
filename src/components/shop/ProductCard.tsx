"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ImageBroken } from "@phosphor-icons/react/dist/ssr";
import type { ShopProduct } from "@/lib/shopProducts";

export function ProductCard({ product }: { product: ShopProduct }) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-2xl bg-white">
      <Link
        href={product.href}
        className="relative block aspect-[4/5] w-full shrink-0 overflow-hidden bg-white"
      >
        {imageFailed ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-canvas text-muted">
            <ImageBroken className="size-8" weight="light" />
            <span className="text-xs">Image coming soon</span>
          </div>
        ) : (
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-contain p-4 transition-transform duration-700 ease-[var(--ease-premium)] group-hover:scale-105"
            onError={() => setImageFailed(true)}
          />
        )}
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
          {product.categoryName}
        </p>
        <h3 className="mt-1 line-clamp-2 min-h-[2.5rem] font-display font-semibold text-ink-900">
          <Link href={product.href} className="hover:underline">
            {product.name}
          </Link>
        </h3>
        <p className="mt-1 text-sm font-semibold text-ink-900">
          {product.startingPrice !== null ? (
            <>
              From ${product.startingPrice.toFixed(2)}
              <span className="font-normal text-muted"> / unit</span>
            </>
          ) : (
            <span className="font-normal text-muted">Quote required</span>
          )}
        </p>
        <Link
          href={product.href}
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-maple-gradient px-4 py-2.5 text-sm font-semibold text-ink-950 transition-transform duration-300 ease-[var(--ease-premium)] hover:scale-[1.02]"
        >
          Customize
          <ArrowRight className="size-3.5" weight="bold" />
        </Link>
      </div>
    </div>
  );
}
