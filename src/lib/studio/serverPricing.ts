// Server-side pricing for a new Studio design (/api/studio). The product page sends WHAT the
// customer chose (stock, size, material, add-ons, quantity) as `pricingOptions`; the price itself
// is always computed here, from the catalogue and the same quote functions the product page uses.
// /api/studio then signs it (studio/pricingSignature.ts) and priceCartItem only charges a design
// whose signature verifies, so a price sent or edited by the browser is never what a customer pays.
import type { CatalogueProduct } from "@/lib/products";
import type { PricingSnapshot, SizeQty } from "@/lib/studio/types";
import { calculateCustomizePrice } from "@/lib/studio/pricing";
import { isQuoteError, type QuoteError } from "@/lib/houseProducts/pricing/types";
import { quoteBusinessCard, type CardStock } from "@/lib/houseProducts/pricing/businessCards";
import { quotePostcard, type PostcardStock } from "@/lib/houseProducts/pricing/postcards";
import { quoteFlyer, type FlyerStock } from "@/lib/houseProducts/pricing/flyers";
import { quoteBanner, type BannerMaterial } from "@/lib/houseProducts/pricing/banners";
import { allowedStickerShapesFor, quoteSticker, type StickerMaterial, type StickerShape } from "@/lib/houseProducts/pricing/stickers";
import { quoteLabel, type LabelFormat, type LabelMaterial } from "@/lib/houseProducts/pricing/labels";
import { quotePoster } from "@/lib/houseProducts/pricing/posters";
import { quoteDrinkware, type DrinkwareKind } from "@/lib/houseProducts/pricing/drinkware";
import { quotePromo, type PromoKind } from "@/lib/houseProducts/pricing/promo";
import { quoteSign, type SignKind, type SignMaterial } from "@/lib/houseProducts/pricing/signs";
import { quotePackaging, type PackagingKind } from "@/lib/houseProducts/pricing/packaging";
import { quotePriceList } from "@/lib/houseProducts/pricing/priceList";

/** The customer's choices from the product page — every field optional and untrusted; the quote
 *  functions below reject anything that isn't a real offered combination. */
export type StudioPricingOptions = Record<string, unknown>;

export type ServerPriceResult = { ok: true; snapshot: PricingSnapshot } | { ok: false; error: string };

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const bool = (v: unknown): boolean => v === true;

function flatSnapshot(
  product: CatalogueProduct,
  quantity: number,
  quote: { unitPriceCents: number; totalCents: number } | QuoteError,
): ServerPriceResult {
  if (isQuoteError(quote)) return { ok: false, error: quote.error };
  return {
    ok: true,
    snapshot: {
      unitBasePrice: quote.unitPriceCents / 100,
      designFee: 0,
      chartFirstLocationCost: 0,
      chartAdditionalLocationCost: 0,
      quantity,
      total: quote.totalCents / 100,
      printRuleVersion: product.printRuleVersion,
    },
  };
}

function quoteFor(product: CatalogueProduct, quantity: number, o: StudioPricingOptions, sizeBreakdown: SizeQty[]): ServerPriceResult {
  const kind = product.houseProductKind;

  if (kind === "business-card") {
    const sides = o.sides === "double" ? "double" : "single";
    return flatSnapshot(product, quantity, quoteBusinessCard({ stock: str(o.stock) as CardStock, quantity, sides, roundedCorners: bool(o.roundedCorners) }));
  }
  if (kind === "postcard") {
    const sides = o.sides === "double" ? "double" : "single";
    return flatSnapshot(product, quantity, quotePostcard({ stock: str(o.stock) as PostcardStock, quantity, sides }));
  }
  if (kind === "flyer") {
    const sides = o.sides === "double" ? "double" : "single";
    return flatSnapshot(product, quantity, quoteFlyer({ stock: str(o.stock) as FlyerStock, sides, quantity }));
  }
  if (kind === "banner") {
    return flatSnapshot(
      product,
      quantity,
      quoteBanner({
        sizeKey: str(o.sizeKey),
        material: str(o.material) as BannerMaterial,
        quantity,
        grommets: bool(o.grommets),
        reinforcedEdges: bool(o.reinforcedEdges),
        windFlaps: bool(o.windFlaps),
        doubleSided: bool(o.doubleSided),
        orientation: o.orientation === "landscape" ? "landscape" : "portrait",
      }),
    );
  }
  if (kind === "sticker") {
    const shape = str(o.shape) as StickerShape;
    if (!allowedStickerShapesFor(product.subcategorySlug).includes(shape)) {
      return { ok: false, error: "That shape isn't available for this product." };
    }
    return flatSnapshot(product, quantity, quoteSticker({ shape, sizeKey: str(o.sizeKey), material: str(o.material) as StickerMaterial, quantity }));
  }
  if (kind === "label") {
    return flatSnapshot(
      product,
      quantity,
      quoteLabel({ sizeKey: str(o.sizeKey), material: str(o.material) as LabelMaterial, format: str(o.format) as LabelFormat, quantity }),
    );
  }
  if (kind === "poster") {
    return flatSnapshot(product, quantity, quotePoster({ sizeKey: str(o.sizeKey), quantity }));
  }
  if (kind?.startsWith("drinkware-")) {
    const drinkwareKind = kind.slice("drinkware-".length) as DrinkwareKind;
    return flatSnapshot(product, quantity, quoteDrinkware({ kind: drinkwareKind, variantKey: str(o.variantKey), quantity }));
  }
  if (kind?.startsWith("promo-")) {
    const promoKind = kind.slice("promo-".length) as PromoKind;
    return flatSnapshot(product, quantity, quotePromo({ kind: promoKind, variantKey: str(o.variantKey), quantity }));
  }
  if (kind === "sign-yard" || kind === "sign-rigid" || kind === "sign-window-cling") {
    const signKind = kind.slice("sign-".length) as SignKind;
    return flatSnapshot(product, quantity, quoteSign({ kind: signKind, sizeKey: str(o.sizeKey), material: str(o.material) as SignMaterial, quantity }));
  }
  if (kind?.startsWith("packaging-")) {
    const packagingKind = (kind === "packaging-tape" ? "packaging-tape" : kind.slice("packaging-".length)) as PackagingKind;
    const weight = o.weight === 10 || o.weight === 18 || o.weight === 30 ? o.weight : undefined;
    return flatSnapshot(
      product,
      quantity,
      quotePackaging({ kind: packagingKind, sizeKey: str(o.sizeKey) || undefined, rollKey: str(o.rollKey) || undefined, weight, quantity }),
    );
  }
  if (kind === "price-list") {
    const quote = product.studioCanvas ? quotePriceList(product, quantity) : null;
    if (!quote) return { ok: false, error: "That quantity isn't available for this product." };
    return flatSnapshot(product, quantity, { unitPriceCents: Math.round(quote.unitPrice * 10000) / 100, totalCents: Math.round(quote.total * 100) });
  }
  if (kind === undefined && !product.bundlePricing?.length) {
    // Supplier apparel: blank + one print location; Studio and checkout add further locations from
    // the per-location chart costs stored here. Sizes must add up to the quantity being priced.
    const sizedQty = sizeBreakdown.reduce((sum, s) => sum + (Number.isInteger(s.qty) && s.qty > 0 ? s.qty : NaN), 0);
    if (sizedQty !== quantity) return { ok: false, error: "Your sizes don't add up to your quantity." };
    const p = calculateCustomizePrice(product, quantity, 1);
    if (!p) return { ok: false, error: "This item requires a custom quote." };
    return {
      ok: true,
      snapshot: {
        unitBasePrice: p.blankUnitPrice,
        designFee: p.designFee,
        chartFirstLocationCost: p.chartFirstLocationCost,
        chartAdditionalLocationCost: p.chartAdditionalLocationCost,
        quantity,
        total: p.total,
        printRuleVersion: product.printRuleVersion,
      },
    };
  }
  return { ok: false, error: "This product can't be designed online." };
}

/** Prices a new Studio design entirely from the catalogue. Any thrown lookup (an option value the
 *  pricing tables don't know) is a rejection, never a fallback to a client-sent price. */
export function priceStudioDesign(
  product: CatalogueProduct,
  quantity: number,
  options: StudioPricingOptions,
  sizeBreakdown: SizeQty[],
): ServerPriceResult {
  if (!Number.isInteger(quantity) || quantity < 1) return { ok: false, error: "Invalid quantity." };
  try {
    return quoteFor(product, quantity, options ?? {}, sizeBreakdown);
  } catch {
    return { ok: false, error: "That option isn't available for this product." };
  }
}
