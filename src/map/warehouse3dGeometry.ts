/**
 * Geometry and colour rules for the 3D warehouse view.
 *
 * Kept separate from the React layer so the placement maths and the colour
 * scale can be reasoned about (and reused by the legend) without pulling in
 * three.js.
 *
 * SCHEMATIC, NOT SURVEYED. Positions derive from the same schematic rack runs
 * the 2D floor plan uses: bay counts, level counts and positions per level all
 * come from the MinMax drawings, but plan coordinates are approximate.
 */

import type { CellRow } from "@/data/derive";
import type { Rack } from "@/data/types";

/** Plan units are ~1000 wide; scale down so the scene sits in a sane range. */
export const PLAN_SCALE = 0.1;
/** Height of one storage level in world units. */
export const LEVEL_HEIGHT = 1.5;
/** Thickness of the beam drawn under each level. */
export const BEAM_HEIGHT = 0.12;

export type CellVisual =
  | "overload"
  | "almost_full"
  | "free_space"
  | "empty"
  | "blocked"
  | "reserved";

export interface CellBox {
  cellId: string;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
  visual: CellVisual;
}

export const VISUAL_LEGEND: {
  id: CellVisual;
  label: string;
  color: string;
  hint: string;
}[] = [
  {
    id: "overload",
    // Odoo labels this band "Overload". A position exactly at capacity is not
    // literally overloaded, and most full pallets here sit at exactly 100%, so
    // calling 709 of them an overload would overstate a problem that does not
    // exist. The band is defined as available space <= 0 and named for that.
    label: "Full / Overload",
    color: "#e2001a",
    hint: "No space left: available space is zero, or negative if a position ever exceeded its capacity.",
  },
  {
    id: "almost_full",
    label: "Almost Full",
    color: "#f2c500",
    hint: "80% or more of the pallet's capacity is used.",
  },
  {
    id: "free_space",
    label: "Free Space Available",
    color: "#00a651",
    hint: "A partly filled pallet: it holds stock and still has room.",
  },
  {
    id: "reserved",
    label: "Reserved for Incoming",
    color: "#3d6fd6",
    hint: "Empty, but already claimed by a pending put-away or transfer.",
  },
  {
    id: "empty",
    label: "No Product/Load",
    color: "#b6bcc2",
    hint: "No pallet in the position, or a pallet standing empty.",
  },
  {
    id: "blocked",
    label: "Blocked",
    color: "#6b7580",
    hint: "Unavailable for structural, safety or maintenance reasons.",
  },
];

export const VISUAL_COLOR: Record<CellVisual, string> = Object.fromEntries(
  VISUAL_LEGEND.map((entry) => [entry.id, entry.color]),
) as Record<CellVisual, string>;

/**
 * Colour rule. Deliberately the same semantics as the 2D map and the
 * dashboards: a blocked position is never "occupied", a reserved-but-empty
 * position is not "available", and an empty pallet standing in a position
 * reads as no load rather than as stock.
 */
export function cellVisual(cell: CellRow): CellVisual {
  if (cell.blocked) return "blocked";
  if (!cell.occupied) return cell.reservedIncoming ? "reserved" : "empty";
  const fill = cell.fillPct ?? 0;
  if (fill <= 0) return "empty"; // pallet present but carrying nothing
  if (fill >= 99.5) return "overload";
  if (fill >= 80) return "almost_full";
  return "free_space";
}

/**
 * Lay the cells of one warehouse out in 3D.
 *
 * X and Z come from the rack's schematic plan rectangle, split across its bays
 * and the positions within each bay. Y comes from the level index, so the
 * ground position sits on the floor and levels stack above it exactly as the
 * rack elevation draws them.
 */
export function buildCellBoxes(
  cells: CellRow[],
  rackById: Map<string, Rack>,
): CellBox[] {
  const boxes: CellBox[] = [];

  for (const cell of cells) {
    const rack = rackById.get(cell.rackId);
    if (!rack) continue;

    const perBay = rack.width / rack.bays;
    const perSlot = perBay / rack.positionsPerBayLevel;

    // bay is 1-based, slot is 1-based.
    const slotIndex = (cell.bay - 1) * rack.positionsPerBayLevel + (cell.slot - 1);
    const centreX = rack.x + (slotIndex + 0.5) * perSlot;
    const centreZ = rack.y + rack.depth / 2;

    boxes.push({
      cellId: cell.id,
      x: (centreX - 500) * PLAN_SCALE,
      z: (centreZ - 250) * PLAN_SCALE,
      y: cell.level * LEVEL_HEIGHT + LEVEL_HEIGHT / 2,
      // Neighbours nearly touch. Separation comes from the wireframe edges
      // drawn over the boxes, which is how Odoo's own 3D view reads.
      width: Math.max(0.25, perSlot * PLAN_SCALE * 0.98),
      depth: Math.max(0.6, rack.depth * PLAN_SCALE * 0.96),
      height: LEVEL_HEIGHT * 0.9,
      visual: cellVisual(cell),
    });
  }

  return boxes;
}

/** Bounding box of a laid-out warehouse, used to frame the camera. */
export function boundsOf(boxes: CellBox[]): {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  maxY: number;
  centreX: number;
  centreZ: number;
  span: number;
} {
  if (!boxes.length) {
    return { minX: -10, maxX: 10, minZ: -10, maxZ: 10, maxY: 5, centreX: 0, centreZ: 0, span: 20 };
  }
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  let maxY = 0;
  for (const box of boxes) {
    minX = Math.min(minX, box.x - box.width);
    maxX = Math.max(maxX, box.x + box.width);
    minZ = Math.min(minZ, box.z - box.depth);
    maxZ = Math.max(maxZ, box.z + box.depth);
    maxY = Math.max(maxY, box.y + box.height);
  }
  return {
    minX,
    maxX,
    minZ,
    maxZ,
    maxY,
    centreX: (minX + maxX) / 2,
    centreZ: (minZ + maxZ) / 2,
    span: Math.max(maxX - minX, maxZ - minZ),
  };
}
