import { useMemo } from "react";
import type {
  CellRow,
  MovementRow,
  PalletRow,
  RackRow,
  StockRow,
  WarehouseRow,
} from "@/data/derive";
import { filterRows, type DomainNode } from "@/query/domain";
import { fieldResolver, getModel } from "@/query/models";
import { useDerived } from "@/store/appStore";
import type { DashboardScope } from "./scope";

/**
 * Apply a dashboard scope to each dataset once, so every panel on the page
 * reads the same rows. Panels must never filter for themselves.
 */
export function useScopedRows(scope: DashboardScope): {
  stock: StockRow[];
  cells: CellRow[];
  cellsHighlighted: CellRow[];
  pallets: PalletRow[];
  movements: MovementRow[];
  racks: RackRow[];
  warehouses: WarehouseRow[];
  allCells: CellRow[];
} {
  const derived = useDerived();

  return useMemo(() => {
    const stockResolver = fieldResolver(getModel("stock"));
    const cellResolver = fieldResolver(getModel("cell"));
    const palletResolver = fieldResolver(getModel("pallet"));
    const movementResolver = fieldResolver(getModel("movement"));

    const cells = filterRows(derived.cells, scope.cell, cellResolver);
    const cellsHighlighted = filterRows(
      derived.cells,
      scope.cellHighlight,
      cellResolver,
    );

    // Racks and warehouses inherit the physical cell scope so that a rack list
    // and the map behind it always describe the same positions.
    const rackIds = new Set(cells.map((c) => c.rackId));
    const warehouseIds = new Set(cells.map((c) => c.warehouseId));

    return {
      stock: filterRows(derived.stock, scope.stock, stockResolver),
      cells,
      cellsHighlighted,
      pallets: filterRows(derived.pallets, scope.pallet, palletResolver),
      movements: filterRows(derived.movements, scope.movement, movementResolver),
      racks: derived.racks.filter((r) => rackIds.has(r.id)),
      warehouses: derived.warehouses.filter((w) => warehouseIds.has(w.id)),
      allCells: derived.cells,
    };
  }, [derived, scope]);
}

/** Distinct count of a field across rows, ignoring blanks. */
export function distinct<T extends Record<string, unknown>>(
  rows: readonly T[],
  field: keyof T & string,
): number {
  const seen = new Set<string>();
  for (const row of rows) {
    const value = row[field];
    if (value === null || value === undefined || value === "") continue;
    seen.add(String(value));
  }
  return seen.size;
}

/** Sum a numeric field, restricted to one unit of measure. */
export function sumIn<T extends Record<string, unknown>>(
  rows: readonly T[],
  field: keyof T & string,
  unit: string,
  unitField: keyof T & string = "uom" as keyof T & string,
): number {
  let total = 0;
  for (const row of rows) {
    if (String(row[unitField] ?? "") !== unit) continue;
    const value = Number(row[field]);
    if (Number.isFinite(value)) total += value;
  }
  return Math.round(total * 100) / 100;
}

/** Units present in a set of rows, ordered by total quantity. */
export function unitsPresent<T extends Record<string, unknown>>(
  rows: readonly T[],
  field: keyof T & string = "quantity" as keyof T & string,
  unitField: keyof T & string = "uom" as keyof T & string,
): { unit: string; total: number }[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const unit = String(row[unitField] ?? "");
    if (!unit) continue;
    const value = Number(row[field]);
    totals.set(unit, (totals.get(unit) ?? 0) + (Number.isFinite(value) ? value : 0));
  }
  return Array.from(totals.entries())
    .map(([unit, total]) => ({ unit, total: Math.round(total * 100) / 100 }))
    .sort((a, b) => b.total - a.total);
}

/** Group rows into a chart series with a stable, sorted shape. */
export function tally<T extends Record<string, unknown>>(
  rows: readonly T[],
  keyField: keyof T & string,
  valueFn: (rows: T[]) => number,
  limit?: number,
): { key: string; label: string; value: number; rows: T[] }[] {
  const buckets = new Map<string, T[]>();
  for (const row of rows) {
    const key = String(row[keyField] ?? "");
    if (!key) continue;
    const list = buckets.get(key);
    if (list) list.push(row);
    else buckets.set(key, [row]);
  }
  const out = Array.from(buckets.entries()).map(([key, list]) => ({
    key,
    label: key,
    value: valueFn(list),
    rows: list,
  }));
  out.sort((a, b) => b.value - a.value);
  return limit ? out.slice(0, limit) : out;
}

export type { DomainNode };
