"use client";

import { useState } from "react";
import { ProductGallery } from "@/components/products/ProductGallery";
import { ProductCustomizer } from "@/components/products/ProductCustomizer";
import { blankUnitPrice, calculateCustomizePrice } from "@/lib/studio/pricing";
import type { CatalogueProduct } from "@/lib/products";

export function ProductDetail({ product, categoryName }: { product: CatalogueProduct; categoryName: string }) {
  const [selectedColour, setSelectedColour] = useState(product.colours[0] ?? "");

  // The ONLY two calls that ever compute this product's price on this page — the panel below
  // calls the exact same functions, so this headline can never drift from it the way the old
  // `product.startingPrice` headline (labelled "custom printed" but missing the design fee the
  // panel correctly added) did. See PROJECT_NOTES.md for that incident's writeup.
  const blank = blankUnitPrice(product);
  const customizeFrom = calculateCustomizePrice(product, 1, 1);

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <div>
        <ProductGallery key={selectedColour} product={product} selectedColour={selectedColour} />
      </div>
      <div>
        {blank !== null && customizeFrom !== null && (
          <p className="font-display text-3xl font-semibold text-ink-900">
            Blank ${blank.toFixed(2)}
            <span className="text-base font-normal text-muted"> / unit</span>
            <span className="ml-2 text-lg font-normal text-muted">
              · Customize from ${customizeFrom.total.toFixed(2)}
            </span>
          </p>
        )}
        {product.description && (
          <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-muted">{product.description}</p>
        )}
        <div className="mt-6">
          <ProductCustomizer
            product={product}
            categoryName={categoryName}
            selectedColour={selectedColour}
            onColourChange={setSelectedColour}
          />
        </div>
      </div>
    </div>
  );
}
