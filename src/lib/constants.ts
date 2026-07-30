export const SITE_URL = "https://mapleimprint.ca";

export const BUSINESS = {
  name: "Maple Imprint Ltd.",
  tagline: "Let's print your story.",
  city: "Ottawa",
  region: "Ontario",
  country: "Canada",
} as const;

export const NAV_LINKS = [
  { label: "Products", href: "/products" },
  { label: "Solutions", href: "/solutions" },
  { label: "How It Works", href: "/how-it-works" },
  { label: "Our Work", href: "/our-work" },
  { label: "Resources", href: "/resources" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
] as const;

export const PRIMARY_CTA = { label: "Start Designing", href: "/products" };
export const SECONDARY_CTA = { label: "Get a Quote", href: "/contact?type=quote" };

export const PRODUCT_CATEGORIES = [
  {
    slug: "custom-apparel",
    name: "Custom Apparel",
    blurb: "T-shirts, hoodies, polos and premium blanks, decorated to spec.",
    subcategories: ["T-shirts", "Polos", "Hoodies & sweatshirts", "Jackets & outerwear", "Youth & performance"],
    cover: "/images/products/custom-apparel.jpg",
  },
  {
    slug: "workwear-uniforms",
    name: "Workwear & Uniforms",
    blurb: "Consistent staff apparel for business, trade and hospitality teams.",
    subcategories: ["Business uniforms", "Construction", "Hospitality", "Healthcare", "Safety apparel"],
    cover: "/images/products/workwear-uniforms.jpg",
  },
  {
    slug: "hats-accessories",
    name: "Hats & Accessories",
    blurb: "Caps, toques, bags and aprons for everyday branding.",
    subcategories: ["Caps", "Beanies & toques", "Bags", "Aprons"],
    cover: "/images/products/hats-accessories.jpg",
  },
  {
    slug: "business-printing",
    name: "Business Printing",
    blurb: "Cards, brochures and presentation materials that hold up in hand.",
    subcategories: ["Business cards", "Postcards", "Brochures & flyers", "Posters"],
    cover: "/images/products/business-printing.jpg",
  },
  {
    slug: "signs-banners",
    name: "Signs & Banners",
    blurb: "Indoor and outdoor signage built for events and storefronts.",
    subcategories: ["Vinyl banners", "Indoor signs", "Outdoor signs", "Decals"],
    cover: "/images/products/signs-banners.jpg",
  },
  {
    slug: "stickers-labels",
    name: "Stickers & Labels",
    blurb: "Die-cut, kiss-cut and product labels in any shape.",
    subcategories: ["Die-cut", "Kiss-cut", "Clear", "Sheets"],
    cover: "/images/products/stickers-labels.jpg",
  },
  {
    slug: "drinkware",
    name: "Drinkware",
    blurb: "Mugs, tumblers and bottles for gifts and daily use.",
    subcategories: ["Mugs", "Tumblers", "Bottles"],
    cover: "/images/products/drinkware.jpg",
  },
  {
    slug: "gifts-promo",
    name: "Gifts & Promotional Products",
    blurb: "Coasters, magnets and keepsakes for events and giveaways.",
    subcategories: ["Coasters", "Magnets", "Photo panels", "Stationery"],
    cover: "/images/products/gifts-promo.jpg",
  },
] as const;

export const SOLUTIONS = [
  {
    slug: "businesses",
    name: "For Businesses",
    blurb: "Recurring staff apparel, signage and print with one point of contact.",
    cover: "/images/solutions/businesses.jpg",
  },
  {
    slug: "teams-schools",
    name: "Teams & Schools",
    blurb: "Spirit wear and fundraising merchandise with simple size collection.",
    cover: "/images/solutions/teams-schools.jpg",
  },
  {
    slug: "events-fundraisers",
    name: "Events & Fundraisers",
    blurb: "Coordinated apparel, signage and cards for a firm event date.",
    cover: "/images/solutions/events-fundraisers.jpg",
  },
  {
    slug: "creators-clothing-brands",
    name: "Creators & Clothing Brands",
    blurb: "Small runs, samples and repeat drops on premium blanks.",
    cover: "/images/solutions/creators-clothing-brands.jpg",
  },
  {
    slug: "corporate-merchandise",
    name: "Corporate Merchandise",
    blurb: "Branded gifts and kits for staff, clients and conferences.",
    cover: "/images/solutions/corporate-merchandise.jpg",
  },
  {
    slug: "bulk-orders",
    name: "Bulk Orders",
    blurb: "Volume pricing and one proof approval across the full run.",
    cover: "/images/solutions/bulk-orders.jpg",
  },
] as const;

export const PRINT_METHODS = [
  {
    slug: "screen-printing",
    name: "Screen Printing",
    blurb: "The standard for bold, opaque colour on larger apparel runs.",
  },
  {
    slug: "embroidery",
    name: "Embroidery",
    blurb: "Stitched logos for a durable, premium finish on workwear.",
  },
  {
    slug: "dtf-dtg",
    name: "DTF & DTG Printing",
    blurb: "Full-colour detail with no minimums, ideal for smaller runs.",
  },
  {
    slug: "sublimation",
    name: "Sublimation",
    blurb: "All-over, fade-resistant colour for drinkware and performance wear.",
  },
  {
    slug: "large-format",
    name: "Paper & Large Format",
    blurb: "Business printing, signage and banners at any size.",
  },
] as const;
