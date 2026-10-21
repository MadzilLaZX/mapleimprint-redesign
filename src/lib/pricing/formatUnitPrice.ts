const UNIT_PRICE = new Intl.NumberFormat("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 4 });

/** Per-unit prices can be fractions of a cent on bulk print tiers (e.g. $0.238, $0.2028) — show
 *  them exactly as priced instead of rounding to cents; whole-cent prices still read "$0.35". */
export function formatUnitPrice(n: number): string {
  return `$${UNIT_PRICE.format(n)}`;
}
