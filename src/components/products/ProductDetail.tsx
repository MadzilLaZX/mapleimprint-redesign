"use client";

import { useState } from "react";
import { ProductGallery } from "@/components/products/ProductGallery";
import { ProductCustomizer } from "@/components/products/ProductCustomizer";
import type { CatalogueProduct } from "@/lib/products";

export function ProductDetail({ product, categoryName }: { product: CatalogueProduct; categoryName: string }) {
  const [selectedColour, setSelectedColour] = useState(product.colours[0] ?? "");

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <div>
        <ProductGallery key={selectedColour} product={product} selectedColour={selectedColour} />
      </div>
      <div>
        {product.startingPrice !== null && (
          <p className="font-display text-3xl font-semibold text-ink-900">
            From ${product.startingPrice.toFixed(2)}
            <span className="text-base font-normal text-muted"> / unit, custom printed</span>
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
