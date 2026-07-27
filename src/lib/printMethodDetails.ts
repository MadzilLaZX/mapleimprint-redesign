export const PRINT_METHOD_DETAILS: Record<
  string,
  { bestFor: string; considerations: string[] }
> = {
  "screen-printing": {
    bestFor: "Larger runs of the same design in one to a few solid colours.",
    considerations: [
      "Most cost-effective as quantity increases",
      "Each additional colour adds a separate screen and setup step",
      "Bold, opaque colour that holds up to repeated washing",
    ],
  },
  embroidery: {
    bestFor: "Logos on workwear, headwear and structured garments.",
    considerations: [
      "Best for simpler shapes and up to roughly a dozen thread colours",
      "Very fine detail or gradients don't translate well to stitching",
      "Higher perceived quality and durability than printed logos",
    ],
  },
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
};
