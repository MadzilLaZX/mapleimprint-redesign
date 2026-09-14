"use client";

import { useEffect } from "react";

// Written on every /shop render, read once by "Continue Shopping" after a Studio approval (see
// PostCartConfirmation.tsx). The shop's entire browsable state (category, subcategory, sort,
// search, page) already lives in the URL's query string — nothing new to track, so remembering
// "the last full /shop URL the customer was on" is enough to return them to the same category/
// filter/sort/page they came from, without a separate state-restoration system. Deliberately does
// NOT also try to restore scroll position — content height varies with the products shown, making
// a remembered scrollY fragile in exactly the way this is meant to avoid; landing at the top of the
// right page/filter is the honest, robust version of this feature.
export const LAST_SHOP_URL_KEY = "mi-last-shop-url";

export function ShopUrlMemory({ url }: { url: string }) {
  useEffect(() => {
    try {
      window.sessionStorage.setItem(LAST_SHOP_URL_KEY, url);
    } catch {
      // Storage unavailable (private mode, etc.) — Continue Shopping just falls back to /shop.
    }
  }, [url]);

  return null;
}
