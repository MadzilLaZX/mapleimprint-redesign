export const SOLUTION_DETAILS: Record<
  string,
  { headline: string; points: string[]; categories: string[] }
> = {
  businesses: {
    headline: "One account for uniforms, signage and recurring print",
    points: [
      "Volume pricing shown as unit price and total together",
      "A saved reorder history for repeat staff sizing",
      "Invoice-ready paperwork for procurement and finance",
      "A single point of contact instead of a support queue",
    ],
    categories: ["workwear-uniforms", "signs-banners", "business-printing"],
  },
  "teams-schools": {
    headline: "Spirit wear and fundraising merchandise, simplified",
    points: [
      "A size-collection link you can share with parents or players",
      "Names and numbers handled as one coordinated print run",
      "Clear fundraising minimums stated before you commit",
      "One deadline, one proof, one delivery date for the whole group",
    ],
    categories: ["custom-apparel", "hats-accessories", "drinkware"],
  },
  "events-fundraisers": {
    headline: "Coordinated apparel, signage and print for a firm date",
    points: [
      "Signage, banners and apparel scoped as one project",
      "A firm delivery date confirmed before payment",
      "Rush options shown when your timeline is tight",
      "One proof approval across every item in the package",
    ],
    categories: ["signs-banners", "custom-apparel", "stickers-labels"],
  },
  "creators-clothing-brands": {
    headline: "Small runs and repeat drops on premium blanks",
    points: [
      "Sample-friendly minimums for testing a new design",
      "Consistent colour and print quality across repeat drops",
      "Print-method guidance for detailed or multi-colour artwork",
      "A saved design library for fast reorders between drops",
    ],
    categories: ["custom-apparel", "hats-accessories"],
  },
  "corporate-merchandise": {
    headline: "Branded kits for staff, clients and conferences",
    points: [
      "Mixed-item kits (apparel, drinkware, print) as one order",
      "Consistent branding across every item in the kit",
      "Individual or bulk shipping options at checkout",
      "A dedicated contact for recurring conference orders",
    ],
    categories: ["gifts-promo", "drinkware", "business-printing"],
  },
  "bulk-orders": {
    headline: "Volume pricing with one proof for the whole run",
    points: [
      "Unit price and order total shown together at every tier",
      "One digital proof approval before the full run begins",
      "Mixed sizing and colours handled within a single order",
      "A clear production and delivery estimate before you pay",
    ],
    categories: ["custom-apparel", "workwear-uniforms", "signs-banners"],
  },
};
