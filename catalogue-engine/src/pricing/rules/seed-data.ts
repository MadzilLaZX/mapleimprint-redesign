// Seed pricing data straight from the client's current cost sheet (architecture doc §"Current
// ... Printing Rules"). This is EDITABLE STARTING DATA, not a permanent source of truth — the
// real system stores these as PricingRule rows so staff can change them without a deploy. This
// file exists so the engine has something real to run against before that admin UI exists, and
// so tests can assert against known, client-provided numbers.

export interface QuantityTier {
  quantityMin: number;
  quantityMax: number | null; // null = unbounded (the "100+" / "36+" style tier)
}

export interface ApparelPrintTier extends QuantityTier {
  firstPrintCost: number;
  additionalLocationCost: number;
}

export interface HatPrintTier extends QuantityTier {
  firstPrintCost: number;
  secondPrintCost: number;
}

export interface MugPrintTier extends QuantityTier {
  oneSideCost: number;
  wrapAroundCost: number;
}

// Quantity 1-2 / 3-10 / 11-35 / 36-70 / 71-99 / 100+
export const APPAREL_PRINT_TIERS: ApparelPrintTier[] = [
  { quantityMin: 1, quantityMax: 2, firstPrintCost: 20.0, additionalLocationCost: 5.0 },
  { quantityMin: 3, quantityMax: 10, firstPrintCost: 18.0, additionalLocationCost: 4.5 },
  { quantityMin: 11, quantityMax: 35, firstPrintCost: 15.0, additionalLocationCost: 4.0 },
  { quantityMin: 36, quantityMax: 70, firstPrintCost: 12.0, additionalLocationCost: 3.5 },
  { quantityMin: 71, quantityMax: 99, firstPrintCost: 9.0, additionalLocationCost: 3.25 },
  { quantityMin: 100, quantityMax: null, firstPrintCost: 7.0, additionalLocationCost: 3.0 },
];

export const HAT_PRINT_TIERS: HatPrintTier[] = [
  { quantityMin: 1, quantityMax: 2, firstPrintCost: 12.0, secondPrintCost: 3.0 },
  { quantityMin: 3, quantityMax: 10, firstPrintCost: 10.0, secondPrintCost: 2.5 },
  { quantityMin: 11, quantityMax: 35, firstPrintCost: 8.0, secondPrintCost: 2.0 },
  { quantityMin: 36, quantityMax: 70, firstPrintCost: 7.0, secondPrintCost: 1.75 },
  { quantityMin: 71, quantityMax: 99, firstPrintCost: 6.5, secondPrintCost: 1.5 },
  { quantityMin: 100, quantityMax: null, firstPrintCost: 5.99, secondPrintCost: 1.0 },
];

export const MUG_PRINT_TIERS: MugPrintTier[] = [
  { quantityMin: 1, quantityMax: 2, oneSideCost: 10.0, wrapAroundCost: 15.0 },
  { quantityMin: 3, quantityMax: 10, oneSideCost: 8.0, wrapAroundCost: 12.0 },
  { quantityMin: 11, quantityMax: 35, oneSideCost: 7.5, wrapAroundCost: 10.0 },
  { quantityMin: 36, quantityMax: 70, oneSideCost: 7.0, wrapAroundCost: 9.0 },
  { quantityMin: 71, quantityMax: 99, oneSideCost: 6.5, wrapAroundCost: 8.0 },
  { quantityMin: 100, quantityMax: null, oneSideCost: 5.99, wrapAroundCost: 7.0 },
];

export function findTier<T extends QuantityTier>(tiers: T[], quantity: number): T | null {
  return (
    tiers.find(
      (t) => quantity >= t.quantityMin && (t.quantityMax === null || quantity <= t.quantityMax),
    ) ?? null
  );
}

export const PRINT_RULE_VERSION = '2026-08-01-client-sheet-v1';
