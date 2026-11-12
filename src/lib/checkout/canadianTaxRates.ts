/**
 * Canadian sales tax rates by province/territory, as published by the CRA and provincial revenue
 * authorities. These are real, publicly documented rates — NOT invented — but tax law changes by
 * provincial budget, so VERIFY EACH RATE AGAINST THE CURRENT OFFICIAL SOURCE before this provider
 * is ever activated:
 *   https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-gst-hst-rates.html
 *
 * Last checked against publicly known rates: 2026-11-01. Nova Scotia's HST dropped from 15% to
 * 14% effective 2025-04-01 — a reminder that these numbers move and this file needs a re-check,
 * not a one-time entry, before go-live and periodically afterward.
 *
 * type: "HST" = one combined rate (replaces GST+PST). type: "GST_PST" = GST charged separately
 * from a provincial tax (PST/RST/QST — different names, same mechanism). type: "GST_ONLY" = no
 * provincial sales tax at all.
 */

export type ProvinceTaxType = "HST" | "GST_PST" | "GST_ONLY";

export interface ProvinceTaxRate {
  type: ProvinceTaxType;
  gstRate: number;
  /** Combined HST rate when type is "HST" (already includes the GST component). */
  hstRate?: number;
  /** Separate provincial rate when type is "GST_PST" (PST/RST/QST, named per province). */
  pstRate?: number;
  pstLabel?: string;
}

export const CANADA_GST_RATE = 0.05;

export const PROVINCE_TAX_RATES: Record<string, ProvinceTaxRate> = {
  ON: { type: "HST", gstRate: 0.05, hstRate: 0.13 },
  NB: { type: "HST", gstRate: 0.05, hstRate: 0.15 },
  NL: { type: "HST", gstRate: 0.05, hstRate: 0.15 },
  NS: { type: "HST", gstRate: 0.05, hstRate: 0.14 },
  PE: { type: "HST", gstRate: 0.05, hstRate: 0.15 },
  BC: { type: "GST_PST", gstRate: 0.05, pstRate: 0.07, pstLabel: "BC PST" },
  SK: { type: "GST_PST", gstRate: 0.05, pstRate: 0.06, pstLabel: "SK PST" },
  MB: { type: "GST_PST", gstRate: 0.05, pstRate: 0.07, pstLabel: "MB RST" },
  QC: { type: "GST_PST", gstRate: 0.05, pstRate: 0.09975, pstLabel: "QST" },
  AB: { type: "GST_ONLY", gstRate: 0.05 },
  YT: { type: "GST_ONLY", gstRate: 0.05 },
  NT: { type: "GST_ONLY", gstRate: 0.05 },
  NU: { type: "GST_ONLY", gstRate: 0.05 },
};
