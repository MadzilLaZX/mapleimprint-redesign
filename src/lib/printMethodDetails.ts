export const PRINT_METHOD_DETAILS: Record<
  string,
  { bestFor: string; considerations: string[] }
> = {
  "dtf-dtg": {
    bestFor: "Full-colour or photographic designs, especially smaller runs.",
    considerations: [
      "No minimum quantity, practical for one-off or small orders",
      "Handles gradients and detailed artwork that screen printing can't",
      "Per-unit cost stays flatter across quantities than screen printing",
    ],
  },
  sublimation: {
    bestFor: "All-over colour on drinkware, performance fabrics and hard surfaces.",
    considerations: [
      "Colour becomes part of the material, not a surface layer",
      "Requires polyester or poly-coated substrates to bond properly",
      "Excellent fade resistance for long-term use",
    ],
  },
  "large-format": {
    bestFor: "Business cards, brochures, signage and banners at any size.",
    considerations: [
      "Paper stock and finish affect both feel and price",
      "Outdoor signage uses weatherproof material and lamination",
      "Proof colour can vary slightly from screen to final print",
    ],
  },
  "laser-engraving": {
    bestFor: "Permanent marking on wood, metal, glass and other hard-surface gifts and awards.",
    considerations: [
      "Etches into the material itself rather than adding a surface layer",
      "Single-colour result that follows the natural tone of the material",
      "No thread or ink to fade, crack or wash out over time",
    ],
  },
};
