// Size-curve-aware order availability check. Architecture doc §10 flags this as a real gap:
// "A 100-shirt order spanning 8 sizes x 1 colour needs size-curve-aware availability checking
// (do you have enough of each size, not just 100 units total)." Summing total stock across an
// order and comparing to total quantity would say an order is fulfillable when, say, all 100
// units are in Medium and the order needs 20 of each size S-XXL — this function exists so that
// mistake is structurally impossible: every line item is checked independently.
//
// This checks CACHED inventory (SupplierWarehouseInventory) — the fast, first-pass check. A
// final live check via SupplierConnector.checkLiveAvailability (per architecture doc
// §"Checkout Inventory Protection") belongs in the actual checkout flow right before payment
// capture, not here; this module only answers "does what we've cached support this order,"
// which is enough to catch the common case (wrong size mix) before that live check ever runs.

import type { PrismaClient } from '@prisma/client';

export interface OrderLineItem {
  productVariantId: string;
  quantity: number;
}

export interface LineAvailability {
  productVariantId: string;
  requested: number;
  /** Sum of cached availableQty across every orderable supplier offer + warehouse for this variant. */
  availableCached: number;
  sufficient: boolean;
  /** True if no orderable supplier offer exists for this variant at all — a data problem, not just low stock. */
  noOfferFound: boolean;
  /** Oldest lastSyncedAt among the warehouse rows contributing to availableCached, or null if none. */
  oldestSyncAt: Date | null;
}

export interface OrderAvailabilityResult {
  fulfillable: boolean;
  lines: LineAvailability[];
  insufficientLines: LineAvailability[];
}

/**
 * Checks whether cached inventory supports every line of an order independently. `fulfillable`
 * is true only if every single line is sufficient — never derived from a total-quantity sum.
 */
export async function checkOrderAvailability(
  prisma: PrismaClient,
  lineItems: OrderLineItem[],
): Promise<OrderAvailabilityResult> {
  const lines: LineAvailability[] = [];

  for (const item of lineItems) {
    const offers = await prisma.supplierVariantOffer.findMany({
      where: { productVariantId: item.productVariantId, isOrderable: true },
      select: {
        warehouseInventory: {
          select: { availableQty: true, lastSyncedAt: true },
        },
      },
    });

    const warehouseRows = offers.flatMap((o) => o.warehouseInventory);
    const availableCached = warehouseRows.reduce((sum, w) => sum + w.availableQty, 0);
    const oldestSyncAt =
      warehouseRows.length === 0
        ? null
        : warehouseRows.reduce(
            (oldest, w) => (w.lastSyncedAt < oldest ? w.lastSyncedAt : oldest),
            warehouseRows[0]!.lastSyncedAt,
          );

    lines.push({
      productVariantId: item.productVariantId,
      requested: item.quantity,
      availableCached,
      sufficient: availableCached >= item.quantity,
      noOfferFound: offers.length === 0,
      oldestSyncAt,
    });
  }

  const insufficientLines = lines.filter((l) => !l.sufficient);

  return {
    fulfillable: insufficientLines.length === 0,
    lines,
    insufficientLines,
  };
}
