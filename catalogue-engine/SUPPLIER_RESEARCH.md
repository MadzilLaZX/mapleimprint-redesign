# Supplier research — public sites, no account access

Deep extraction from the four supplier public sites the owner provided (2026-08-02), going
beyond the initial API-availability check (see `README.md`'s "Supplier research findings" for
that). This is everything meaningfully extractable **without an account login** — treat it as
groundwork for schema/category/brand mapping once real API access exists, not as verified data.
Real product data from the actual API/feed is always the source of truth over anything below.

---

## SanMar Canada (sanmarcanada.com)

**Navigation structure:** Shop By (All Products, Power Shop, New Styles, New Colours, Brands) ·
Collections · Events & Occasions · Industry Specific · Team Sports · Sustainable · Product Types.

**Product types:** Accessories, Bags, Headwear, Fleece, Ladies' Only, Pants/Shorts, Polos,
Outerwear, Protective Wear, T-Shirts, Workwear, Woven Shirts, Youth Only.

**Industry-specific lines:** Agriculture, Utility Companies, Corporate Essentials, Construction,
Food/Eateries, Hotel, Manufacturing, Medical Staff, Cleaning & Sanitation, First Responders,
Automotive, Transportation, Warehouse Teams, Retail Uniforms.

**Sustainability attributes tracked:** Eco-efficient, Organic Cotton, PFAS Free, Recycled
Materials, OEKO-TEX certification — worth modeling as variant/product attributes eventually, not
just categories.

**Brands carried:** ATC™ (sub-lines: 24EVER, Authentic Colours, Earth Wash, Essential, EuroSpun,
Everyday Collection, Flexfit, RealTree, WeRK, YP Classics), Allmade, Bulwark® FR XPRESS, Callaway,
Carhartt, Coal Harbour (+ CH Essential), Dickies, DryFrame (+ Essential), Eddie Bauer, INIVI, KOI,
New Era, Nike, OGIO, Original Penguin, Red Kap (+ Chef Designs, MIMIX), The North Face.

**Distribution centers:** BC (Vancouver, HQ), Alberta (Calgary), Ontario (Mississauga, serves
eastern Canada) — relevant later for warehouse-code mapping in `SupplierWarehouseInventory`.

**Resources offered:** Sizing Guide (PDF), eCatalogues, Image Library, Flyer Creator, Pricing
Portal, Swatch Cards, Product Posters, EDI support, ConsoliFreight (freight consolidation).

**Account:** login/register required, "Become a Customer" flow for new accounts, "Pricing Portal"
confirms pricing is gated behind login (unlike Condé/Joto — see below).

---

## S&S Activewear (ssactivewear.com)

**Note:** their domain blocks automated fetching entirely (bot protection) — everything below
came from search results and indirect sources, not a direct docs read. Verify with a human visit
before relying on specifics.

**Product categories:** Tops (T-Shirts, Sweatshirts & Fleece, Polos & Knits), Bottoms, Dresses,
Outerwear, Headwear, Accessories — plus "Shop by Gender" and "Shop by Industry" facets.

**Brands carried (60-80+ per their own claim):** Gildan, BELLA+CANVAS, American Apparel, Champion,
Adidas, Alleson Athletic, Augusta Sportswear, Badger, Boxercraft, C2 Sport, CORE365, Hanes,
Holloway, HUK, Independent Trading Co., J. America, JERZEES, Marmot, MV Sport, Next Level, North
End, Paragon, Puma Golf, Russell Athletic, Shaka Wear, Spyder, Swannies, TASC Performance, Team
365, Threadfast Apparel, TriDri, UltraClub, Under Armour, vineyard vines. (Port Authority and
Comfort Colors are commonly associated with S&S in the industry but didn't surface directly in
this search pass — confirm once real account access exists.)

**Digital catalogs:** free, downloadable, distributor-brandable PDFs — a possible fallback data
source if the API path stalls, though obviously not a live feed.

---

## Joto Imaging Supplies (jotoimagingsupplies.ca)

**Confirmed: appears to run on Shopify** (`/collections/...`, `/pages/...` URL structure). No
public API found anywhere — expect a manual data-feed conversation, not self-serve API access
(see `README.md`'s outreach draft #3).

**Product categories:**
- Sublimation blanks (drinkware, textiles, ornaments, home décor)
- Sublimation mugs & tumblers
- Sublimation paper (multiple weights: 80gsm, 105gsm, 120gsm)
- Heat transfer vinyl
- Laser & inkjet transfer papers
- Heat presses (clamshell, swing-away, mug press, tumbler press, cap press)
- Vinyl cutters (third-party brands, see below)
- Engraving supplies (drinkware, home décor)

**Private-label product lines (Joto's own brand names, not third-party brands):**
- **Pearl Coating™** — sublimation blank coating technology, claimed up to 5000 washes
- **Paropy™** — sublimation transfer paper line (SubliCotton Light/Dark, Tacky variants)
- **Multicut™** — heat transfer vinyl line (One-4-All™ variant)

**Third-party equipment brands carried:** Graphtec, Roland (vinyl cutters).

**Pricing:** appears to be **publicly visible** for equipment (e.g. Elite Pro Tumbler Heat Press
$549, Digital Tumbler Mug Press $649) — same pattern as Condé, different from SanMar/S&S which
gate pricing behind login. Worth confirming whether blanks/consumables pricing is also public or
just equipment.

**Business note:** their product range (Pearl Coating, sublimation blanks) closely matches
BestSub, a known Chinese sublimation equipment/blanks manufacturer — Joto may be a North American
distributor/reseller of BestSub-manufactured goods rebranded under their own names. Not confirmed,
but explains the private-label naming pattern; worth asking about directly if it affects supply
continuity or minimum order quantities.

---

## Condé Systems (conde.com)

**No API found.** Reads as a standard e-commerce storefront. **Pricing is publicly visible**
throughout (unlike SanMar/S&S).

**Product categories:**
- Sublimation: blanks (drinkware, apparel, ornaments, plaques, photo panels, metal/insert panels,
  home/office), paper, supplies, ink
- Drinkware: tumblers, ceramic mugs, water bottles, shot glasses, steins
- Apparel: aprons, socks, "Vapor" line, bandanas, fleece blankets, t-shirts, hoodies
- Awards & recognition: plaques, trophy components, trophy disks, columns
- Personalization: ornaments (felt, aluminum, hardboard, porcelain, FRP), key rings/tags, pet
  tags, license plates, luggage tags, name badges, coasters, mousepads
- Heat application: heat presses (flatbed, cap, mug), heat transfer vinyl, heat tape
- Laser engraving: metal/plastic blanks, drinkware, gift boxes
- Printing technology: white toner printers, DTG printers, UV LED printers
- Paper: sublimation paper (sheets/rolls), transfer paper (inkjet/laser), label supplies

**Brands carried:** ChromaLuxe, ColorLyte, DyeTrans, DynaSub, Epson, eufyMake, Gemini, Geo Knight,
Hotronix, IronClad, LumaSteel, LuminaEtch, Polar Camel, Siser, SubliLinen, SubliSlate, Unisub,
Vapor. (**ChromaLuxe and Unisub are widely-recognized, industry-standard sublimation-blank
brands** — not Condé private labels; likely to also appear at other suppliers, useful as a
cross-supplier brand-matching signal for the dedup matcher once real data flows in.)

**Sample public pricing observed:** MAXX 250 16x20 Heat Press $899.00, Epson F570 Printer
$2,495.00, Epson Ink $24.95.

---

## Cross-supplier observations worth acting on later

1. **Pricing visibility differs by supplier**: SanMar and S&S gate pricing behind login (as
   expected for apparel wholesale); **Condé and Joto show pricing publicly** for at least some
   product lines. This affects the `SupplierVariantOffer.mapPrice` field's usefulness and
   whether a "public price" scrape could ever be a fallback data source for those two — worth
   remembering if API access for Condé/Joto never materializes.
2. **ChromaLuxe/Unisub (Condé) are industry-standard brands**, not exclusive to one supplier —
   if Maple Imprint ever gets an S&S or another sublimation supplier's catalogue, watch for the
   same brand names recurring. This is a strong, ready-made signal for the dedup matcher's
   brand-match check (`src/sync/dedup/matcher.ts`) once cross-supplier data actually exists.
3. **Joto's private-label naming** (Pearl Coating, Paropy, Multicut) means their `supplierBrandName`
   field in a future sync will likely be "Joto" or a private line name, not a recognizable
   third-party brand — the dedup matcher will almost never auto-match Joto products against
   SanMar/S&S products, which is probably correct (they're genuinely different product lines: t-shirt
   blanks vs. sublimation hard-goods barely overlap in practice).
4. **Deliberately not seeded into the live database.** Brand/Category rows were NOT bulk-created
   from this research — real API responses will have canonical spellings/casing that should be
   the actual source of truth, and pre-seeding guessed names risks silent duplicates (e.g. "Bella
   Canvas" vs "BELLA+CANVAS" vs "Bella+Canvas") that the dedup matcher would then have to untangle
   later. This document is reference material for when real sync mapping starts, not schema data.
