"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type CartItemPriceTier = { minQty: number; maxQty: number | null; pricePerUnit: number };

export type CartItem = {
  id: string;
  name: string;
  image: string;
  categorySlug: string;
  categoryName: string;
  quantity: number;
  /** Price at the lowest quantity tier, from the real print-cost chart — null when this item has
   *  no real catalogue product yet (shown as quote-only in the cart, never a guessed number). */
  startingPrice?: number | null;
  /** Set only by the product customizer (colour + per-size quantity picker). When present, the
   *  cart prices this item off the tier matching its CURRENT quantity rather than startingPrice's
   *  fixed lowest-tier number — so the price stays accurate if the customer adjusts quantity from
   *  the cart, instead of quietly showing a stale 1-2-unit price for a 50-unit order. */
  priceTiers?: CartItemPriceTier[];
  colourName?: string;
  sizeBreakdown?: { size: string; qty: number }[];
};

type CartContextValue = {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">, qty?: number) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, qty: number) => void;
  clearCart: () => void;
  totalCount: number;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "mi-cart";

// Written by the cart page's "Get a quote" action, read once by QuoteWizard
// on mount to prefill the product description — a plain sessionStorage
// handoff rather than routing state, so it survives the full navigation.
export const QUOTE_PREFILL_KEY = "mi-quote-prefill";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // One-time sync from a browser-only external store (localStorage) on
    // mount, to avoid an SSR/client hydration mismatch — not a candidate for
    // useSyncExternalStore since this is a one-shot read, not a subscription.
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setItems(JSON.parse(raw));
    } catch {
      // Ignore malformed/unavailable storage — cart just starts empty.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  const addItem = useCallback((item: Omit<CartItem, "quantity">, qty = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) => {
          if (i.id !== item.id) return i;
          // Merge per-size quantities (same colour/product re-configured) rather than losing the
          // original breakdown — sizes in common get summed, new sizes get appended.
          const mergedSizes = item.sizeBreakdown
            ? [...(i.sizeBreakdown ?? [])]
            : i.sizeBreakdown;
          if (item.sizeBreakdown && mergedSizes) {
            for (const incoming of item.sizeBreakdown) {
              const match = mergedSizes.find((s) => s.size === incoming.size);
              if (match) match.qty += incoming.qty;
              else mergedSizes.push({ ...incoming });
            }
          }
          return { ...i, quantity: i.quantity + qty, sizeBreakdown: mergedSizes ?? item.sizeBreakdown };
        });
      }
      return [...prev, { ...item, quantity: qty }];
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const updateQuantity = useCallback((id: string, qty: number) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, quantity: Math.max(1, qty) } : i)),
    );
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const totalCount = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);

  const value = useMemo(
    () => ({ items, addItem, removeItem, updateQuantity, clearCart, totalCount }),
    [items, addItem, removeItem, updateQuantity, clearCart, totalCount],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
