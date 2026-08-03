"use client";

import { useState } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import { SHOP_PRODUCTS } from "@/lib/shopProducts";
import { slugify } from "@/lib/slugify";
import { cn } from "@/lib/cn";
import { ProductCard } from "@/components/shop/ProductCard";

const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
};

function FilterChip({
  active,
  onClick,
  children,
  small,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "whitespace-nowrap rounded-full border font-medium transition-colors",
        small ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm",
        active
          ? "border-transparent bg-ink-950 text-white"
          : "border-sand bg-white text-ink-900/70 hover:border-ink-950/25",
      )}
    >
      {children}
    </button>
  );
}

export function ShopGrid({
  initialCategory,
  initialSubcategory,
}: {
  initialCategory: string | null;
  initialSubcategory: string | null;
}) {
  const [category, setCategory] = useState<string | null>(initialCategory);
  const [subcategory, setSubcategory] = useState<string | null>(initialSubcategory);
  const reduce = useReducedMotion();

  const activeCategory = PRODUCT_CATEGORIES.find((c) => c.slug === category) ?? null;

  const products = SHOP_PRODUCTS.filter((p) => {
    if (category && p.categorySlug !== category) return false;
    if (subcategory && p.subcategorySlug !== subcategory) return false;
    return true;
  });

  function selectCategory(slug: string | null) {
    setCategory(slug);
    setSubcategory(null);
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <FilterChip active={category === null} onClick={() => selectCategory(null)}>
          All Products
        </FilterChip>
        {PRODUCT_CATEGORIES.map((c) => (
          <FilterChip key={c.slug} active={category === c.slug} onClick={() => selectCategory(c.slug)}>
            {c.name}
          </FilterChip>
        ))}
      </div>

      {activeCategory && (
        <div className="mt-3 flex flex-wrap gap-2">
          <FilterChip small active={subcategory === null} onClick={() => setSubcategory(null)}>
            All {activeCategory.name}
          </FilterChip>
          {activeCategory.subcategories.map((sub) => {
            const subSlug = slugify(sub);
            return (
              <FilterChip
                key={subSlug}
                small
                active={subcategory === subSlug}
                onClick={() => setSubcategory(subSlug)}
              >
                {sub}
              </FilterChip>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-sm text-muted">
        {products.length} product{products.length === 1 ? "" : "s"}
      </p>

      {products.length > 0 ? (
        <motion.div
          key={`${category ?? "all"}-${subcategory ?? "all"}`}
          className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
          initial={reduce ? false : "hidden"}
          animate="show"
          variants={containerVariants}
        >
          {products.map((product) => (
            <motion.div key={product.id} variants={itemVariants}>
              <ProductCard product={product} />
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <div className="mt-6 rounded-2xl bg-white p-10 text-center">
          <p className="font-display text-lg font-semibold text-ink-900">No products match that filter</p>
          <p className="mt-2 text-sm text-muted">Try a different category.</p>
        </div>
      )}
    </div>
  );
}
