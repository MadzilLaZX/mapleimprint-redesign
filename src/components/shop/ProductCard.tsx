"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, ShoppingBagOpen } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";
import { useCart } from "@/components/cart/CartProvider";
import type { ShopProduct } from "@/lib/shopProducts";

export function ProductCard({ product }: { product: ShopProduct }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  function handleAdd() {
    addItem({
      id: product.id,
      name: product.name,
      image: product.image,
      categorySlug: product.categorySlug,
      categoryName: product.categoryName,
      startingPrice: product.startingPrice,
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1600);
  }

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl bg-white">
      <Link
        href={product.href}
        className="relative block aspect-[4/5] w-full overflow-hidden"
      >
        <Image
          src={product.image}
          alt=""
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          className="object-cover transition-transform duration-700 ease-[var(--ease-premium)] group-hover:scale-105"
        />
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
          {product.categoryName}
        </p>
        <h3 className="mt-1 font-display font-semibold text-ink-900">{product.name}</h3>
        {product.startingPrice !== null && (
          <p className="mt-1 text-sm font-semibold text-ink-900">
            From ${product.startingPrice.toFixed(2)}
            <span className="font-normal text-muted"> / unit</span>
          </p>
        )}
        <button
          type="button"
          onClick={handleAdd}
          className={cn(
            "mt-4 inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors",
            added ? "bg-ink-950 text-white" : "bg-maple-gradient text-ink-950",
          )}
        >
          {added ? (
            <>
              <Check className="size-4" weight="bold" /> Added
            </>
          ) : (
            <>
              <ShoppingBagOpen className="size-4" weight="bold" /> Add to Cart
            </>
          )}
        </button>
      </div>
    </div>
  );
}
