"use client";

import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { formatUnitPrice } from "@/lib/pricing/formatUnitPrice";
import { ProductImage } from "@/components/ui/ProductImage";
import type { ShopProduct } from "@/lib/shopProducts";

export function ProductCard({ product }: { product: ShopProduct }) {
  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-2xl bg-white">
      <Link
        href={product.href}
        className="relative block aspect-[4/5] w-full shrink-0 overflow-hidden bg-white"
      >
        <ProductImage
          src={product.image}
          alt={product.name}
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          className="object-contain p-4 transition-transform duration-700 ease-[var(--ease-premium)] group-hover:scale-105"
        />
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
              From {formatUnitPrice(product.startingPrice)}
              <span className="font-normal text-muted"> / {product.priceUnit}</span>
            </>
          ) : (
            <span className="font-normal text-muted">Quote required</span>
          )}
        </p>
        <Link
          href={product.href}
          className="group/cta mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-ink-950 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 ease-[var(--ease-premium)] hover:bg-maple-gradient hover:text-ink-950 focus-visible:bg-maple-gradient focus-visible:text-ink-950"
        >
          View Item
          <ArrowRight
            className="size-3.5 transition-transform duration-200 ease-[var(--ease-premium)] group-hover/cta:translate-x-0.5"
            weight="bold"
          />
        </Link>
      </div>
    </div>
  );
}
