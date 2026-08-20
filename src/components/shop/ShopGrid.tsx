"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import Link from "next/link";
import type { ShopProduct } from "@/lib/shopProducts";
import { ProductCard } from "@/components/shop/ProductCard";

const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
};

export function ShopGrid({ products, gridKey }: { products: ShopProduct[]; gridKey: string }) {
  const reduce = useReducedMotion();

  if (products.length === 0) {
    return (
      <div className="mt-6 rounded-2xl bg-white p-10 text-center">
        <p className="font-display text-lg font-semibold text-ink-900">No products match that filter</p>
        <p className="mt-2 text-sm text-muted">Try a different category, or search for something else.</p>
        <Link
          href="/shop"
          className="mt-4 inline-flex items-center justify-center rounded-full bg-maple-gradient px-5 py-2.5 text-sm font-semibold text-ink-950"
        >
          View all products
        </Link>
      </div>
    );
  }

  return (
    <motion.div
      key={gridKey}
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
  );
}
