// Flat 30% margin over VistaPrint's real published retail price, applied transparently at quote
// time — never baked into the lookup tables in banners.ts/businessCards.ts/flyers.ts, so the base
// data there always stays auditable against VistaPrint's own listed price. Matches the existing
// taxProvider.ts/shippingProvider.ts "swappable, loudly-commented provider" convention: change
// this one constant, no caller changes.
export const HOUSE_PRODUCT_MARGIN = 1.3;

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function applyHouseMargin(basePrice: number): number {
  return round2(basePrice * HOUSE_PRODUCT_MARGIN);
}
