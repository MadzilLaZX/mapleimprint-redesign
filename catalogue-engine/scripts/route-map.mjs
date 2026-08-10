// Shared by import-ss-catalogue.mjs and export-products-for-frontend.mjs so the "which productType
// goes to which site category/subcategory" mapping only lives in one place. Matches
// mapleimprint-redesign/src/lib/constants.ts's PRODUCT_CATEGORIES slugs exactly.

const CUSTOM_APPAREL = 'custom-apparel';
const HATS_ACCESSORIES = 'hats-accessories';

// Every productType this catalogue currently knows how to route. Add here (and to
// SSActivewearConnector's BASE_CATEGORY_TO_PRODUCT_TYPE) before importing a new category.
const WORKWEAR_UNIFORMS = 'workwear-uniforms';

export const MAPPED_PRODUCT_TYPES = [
  't_shirt',
  'polo',
  'hoodie',
  'crewneck',
  'jacket',
  'headwear',
  'bag',
  'apron',
  'youth_apparel',
  'workwear_business',
  'workwear_construction',
  'workwear_hospitality',
  'workwear_healthcare',
  'workwear_safety',
  'woven_shirt',
  'knit_layering',
];

/** productType (+ product name, for headwear's caps-vs-beanies split) -> {categorySlug, subcategorySlug}. */
export function routeFor(productType, productName) {
  switch (productType) {
    case 't_shirt':
      return { categorySlug: CUSTOM_APPAREL, subcategorySlug: 't-shirts' };
    case 'polo':
      return { categorySlug: CUSTOM_APPAREL, subcategorySlug: 'polos' };
    case 'hoodie':
    case 'crewneck':
      return { categorySlug: CUSTOM_APPAREL, subcategorySlug: 'hoodies-sweatshirts' };
    case 'jacket':
      return { categorySlug: CUSTOM_APPAREL, subcategorySlug: 'jackets-outerwear' };
    case 'youth_apparel':
      return { categorySlug: CUSTOM_APPAREL, subcategorySlug: 'youth-performance' };
    case 'woven_shirt':
      return { categorySlug: CUSTOM_APPAREL, subcategorySlug: 'button-ups-wovens' };
    case 'knit_layering':
      return { categorySlug: CUSTOM_APPAREL, subcategorySlug: 'sweaters-layering' };
    case 'bag':
      return { categorySlug: HATS_ACCESSORIES, subcategorySlug: 'bags' };
    case 'apron':
      return { categorySlug: HATS_ACCESSORIES, subcategorySlug: 'aprons' };
    case 'headwear': {
      const isBeanie = /beanie|toque|knit cap|cuff cap/i.test(productName ?? '');
      return { categorySlug: HATS_ACCESSORIES, subcategorySlug: isBeanie ? 'beanies-toques' : 'caps' };
    }
    case 'workwear_business':
      return { categorySlug: WORKWEAR_UNIFORMS, subcategorySlug: 'business-uniforms' };
    case 'workwear_construction':
      return { categorySlug: WORKWEAR_UNIFORMS, subcategorySlug: 'construction' };
    case 'workwear_hospitality':
      return { categorySlug: WORKWEAR_UNIFORMS, subcategorySlug: 'hospitality' };
    case 'workwear_healthcare':
      return { categorySlug: WORKWEAR_UNIFORMS, subcategorySlug: 'healthcare' };
    case 'workwear_safety':
      return { categorySlug: WORKWEAR_UNIFORMS, subcategorySlug: 'safety-apparel' };
    default:
      return null;
  }
}

// Only apparel + headwear have a client-provided print-cost chart (the "Printing Cost" image
// covers "Printing on Apparels" and "Printing on Hat/Cap" — nothing else). Bags and aprons: no
// chart, so callers should export/price them as quote-required, never a guessed number. Youth and
// workwear lines are still ordinary printed apparel (tees/polos/jackets sold under a different
// site section) so the same apparel chart applies to them.
export const APPAREL_PRODUCT_TYPES = new Set([
  't_shirt',
  'polo',
  'hoodie',
  'crewneck',
  'jacket',
  'youth_apparel',
  'workwear_business',
  'workwear_construction',
  'workwear_hospitality',
  'workwear_healthcare',
  'workwear_safety',
  'woven_shirt',
  'knit_layering',
]);
export const HEADWEAR_PRODUCT_TYPE = 'headwear';
