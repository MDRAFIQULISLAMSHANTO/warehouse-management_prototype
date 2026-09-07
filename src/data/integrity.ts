/**
 * Dataset self-checks.
 *
 * These run against live state, not just the seed, so they also catch a bad
 * outcome from a demonstrated operation. The results are shown on the About
 * page: if a presenter ever sees a red row, the number on screen is not to be
 * trusted, and that is far better than quietly showing a wrong total.
 */

import { DEMO_NOW_ISO } from "./clock";
import type { DerivedRows } from "./derive";
import { WAREHOUSE_SPECS, TOTAL_DECLARED_POSITIONS } from "./layout";
import type { Dataset } from "./types";

export interface CheckResult {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function runIntegrityChecks(
  data: Dataset,
  derived: DerivedRows,
): CheckResult[] {
  const results: CheckResult[] = [];

  // 1. Installed positions must match the MinMax capacity tables exactly.
  for (const spec of WAREHOUSE_SPECS) {
    const built = derived.cells.filter((c) => c.warehouseId === spec.id).length;
    results.push({
      id: `positions_${spec.code}`,
      label: `${spec.code} installed positions match the drawing`,
      ok: built === spec.declaredPositions,
      detail: `${built} generated vs ${spec.declaredPositions} declared on ${spec.sheet}`,
    });
  }

  const totalPositions = derived.cells.length;
  results.push({
    id: "positions_total",
    label: "Total installed positions match the combined drawing total",
    ok: totalPositions === TOTAL_DECLARED_POSITIONS,
    detail: `${totalPositions} generated vs ${TOTAL_DECLARED_POSITIONS} declared`,
  });

  // 2. A reservation can never exceed what is on hand.
  const overReserved = data.quants.filter(
    (q) => q.reservedQuantity > q.quantity + 0.0001,
  );
  results.push({
    id: "reserved_le_onhand",
    label: "Reserved quantity never exceeds on-hand quantity",
    ok: overReserved.length === 0,
    detail: overReserved.length
      ? `${overReserved.length} stock line(s) over-reserved`
      : `${data.quants.length} stock lines checked`,
  });

  // 3. Reservation records must reconcile with the reserved field.
  const reservedByQuant = new Map<string, number>();
  for (const r of data.reservations) {
    reservedByQuant.set(
      r.quantId,
      round2((reservedByQuant.get(r.quantId) ?? 0) + r.quantity),
    );
  }
  const mismatched = data.quants.filter(
    (q) =>
      Math.abs((reservedByQuant.get(q.id) ?? 0) - q.reservedQuantity) > 0.011,
  );
  results.push({
    id: "reservations_reconcile",
    label: "Reservation records reconcile with reserved quantities",
    ok: mismatched.length === 0,
    detail: mismatched.length
      ? `${mismatched.length} stock line(s) disagree with their reservation records`
      : `${data.reservations.length} reservation records checked`,
  });

  // 4. One pallet per cell. Buffer areas (Input, Output, Staging) are not rack
  //    positions and are expected to hold several pallets at once.
  const cellIds = new Set(
    data.locations.filter((l) => l.kind === "cell").map((l) => l.id),
  );
  const byLocation = new Map<string, number>();
  for (const pallet of data.pallets) {
    if (!pallet.locationId || !cellIds.has(pallet.locationId)) continue;
    byLocation.set(pallet.locationId, (byLocation.get(pallet.locationId) ?? 0) + 1);
  }
  const doubled = Array.from(byLocation.values()).filter((n) => n > 1).length;
  results.push({
    id: "one_pallet_per_cell",
    label: "At most one pallet occupies each rack position",
    ok: doubled === 0,
    detail: doubled ? `${doubled} position(s) hold more than one pallet` : `${byLocation.size} occupied positions checked`,
  });

  // 5. Every stock line points at a location that exists.
  const locationIds = new Set(data.locations.map((l) => l.id));
  const orphanQuants = data.quants.filter((q) => !locationIds.has(q.locationId));
  results.push({
    id: "quants_have_locations",
    label: "Every stock line points at a real location",
    ok: orphanQuants.length === 0,
    detail: orphanQuants.length
      ? `${orphanQuants.length} orphan stock line(s)`
      : `${data.quants.length} stock lines checked`,
  });

  // 6. Occupancy: the KPI denominator and the cell rows must agree.
  const occupiedCells = derived.cells.filter((c) => c.occupied).length;
  const palletsInCells = data.pallets.filter(
    (p) => p.locationId && cellIds.has(p.locationId),
  ).length;
  results.push({
    id: "occupancy_reconciles",
    label: "Occupied positions equal pallets placed in racking",
    ok: occupiedCells === palletsInCells,
    detail: `${occupiedCells} occupied cells vs ${palletsInCells} pallets in rack positions`,
  });

  // 7. Distinct pallet counting: a pallet may not appear twice in the rows.
  const palletIds = new Set(derived.pallets.map((p) => p.id));
  results.push({
    id: "pallets_distinct",
    label: "Pallet rows are distinct records",
    ok: palletIds.size === derived.pallets.length,
    detail: `${palletIds.size} distinct ids across ${derived.pallets.length} rows`,
  });

  // 8. No stock dated in the future relative to the demonstration clock.
  const future = data.lots.filter((l) => l.receiptDate > DEMO_NOW_ISO);
  results.push({
    id: "no_future_lots",
    label: "No lot carries a receipt date in the future",
    ok: future.length === 0,
    detail: future.length ? `${future.length} future-dated lot(s)` : `${data.lots.length} lots checked`,
  });

  // 9. Fill percentage must use an explicit product capacity, not the rack rating.
  const badFill = derived.pallets.filter(
    (p) => p.quantity > 0 && (!p.capacityQty || p.capacityQty <= 0),
  );
  results.push({
    id: "fill_basis",
    label: "Every loaded pallet has an explicit capacity basis for Fill %",
    ok: badFill.length === 0,
    detail: badFill.length
      ? `${badFill.length} loaded pallet(s) without a capacity basis`
      : "All loaded pallets carry a product or variant pallet capacity",
  });

  // 10. No two pending operations claim the same exclusive destination.
  const claims = new Map<string, number>();
  for (const move of data.moves) {
    const op = data.operations.find((o) => o.id === move.operationId);
    if (!op || op.state === "done" || op.state === "cancel") continue;
    const dest = data.locations.find((l) => l.id === move.destLocationId);
    if (!dest || dest.kind !== "cell") continue;
    claims.set(dest.id, (claims.get(dest.id) ?? 0) + 1);
  }
  const contested = Array.from(claims.entries()).filter(([, n]) => n > 1);
  results.push({
    id: "no_conflicting_destinations",
    label: "No rack position is claimed by two pending operations",
    ok: contested.length === 0,
    detail: contested.length
      ? `${contested.length} position(s) claimed more than once`
      : `${claims.size} pending destination(s) checked`,
  });

  return results;
}
