/**
 * Rack elevation.
 *
 * A front view of one rack: bays across, levels up, one clickable tile per
 * pallet position. Level 0 is the ground position, drawn at the bottom, which
 * is how a warehouse operator reads a rack.
 */

import { useMemo } from "react";
import type { CellRow, RackRow } from "@/data/derive";
import { formatPct } from "@/odoo/format";

export interface RackElevationProps {
  rack: RackRow;
  cells: CellRow[];
  selectedCellId?: string;
  onSelectCell?: (cellId: string) => void;
  highlightIds?: Set<string>;
  maxWidth?: number;
}

export function cellColor(cell: CellRow): string {
  if (cell.blocked) return "var(--o-occ-blocked)";
  if (cell.reservedIncoming) return "var(--o-occ-reserved)";
  if (!cell.occupied) return "var(--o-occ-empty)";
  if (cell.palletStatus === "empty") return "var(--o-gray-400)";
  if (cell.palletStatus === "partial") return "var(--o-occ-partial)";
  return "var(--o-series-2)";
}

export function cellStatusLabel(cell: CellRow): string {
  if (cell.blocked) return `Blocked - ${cell.blockNote ?? cell.blockReason ?? ""}`;
  if (cell.reservedIncoming) return "Empty, reserved for an incoming move";
  if (!cell.occupied) return "Physically empty";
  if (cell.palletStatus === "empty") return "Empty pallet in position";
  if (cell.palletStatus === "partial")
    return `Partially filled pallet - ${formatPct(cell.fillPct ?? 0)}`;
  return "Full pallet";
}

export function RackElevation({
  rack,
  cells,
  selectedCellId,
  onSelectCell,
  highlightIds,
  maxWidth = 980,
}: RackElevationProps) {
  const slots = rack.positionsPerBayLevel ?? 1;

  const { grid, tileW, tileH, width, height } = useMemo(() => {
    const columns = rack.bays * slots;
    const tileW = Math.max(14, Math.min(46, Math.floor((maxWidth - 46) / columns)));
    const tileH = Math.max(16, Math.min(34, tileW));
    const grid = new Map<string, CellRow>();
    for (const cell of cells) {
      grid.set(`${cell.bay}:${cell.level}:${cell.slot}`, cell);
    }
    return {
      grid,
      tileW,
      tileH,
      width: 46 + columns * tileW,
      height: 30 + rack.levels * tileH,
    };
  }, [rack, cells, slots, maxWidth]);

  return (
    <div className="overflow-x-auto">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`Elevation of rack ${rack.code}`}
        style={{ minWidth: width }}
      >
        {/* level labels */}
        {Array.from({ length: rack.levels }, (_, level) => {
          const y = height - 30 - (level + 1) * tileH;
          return (
            <text
              key={`lvl${level}`}
              x={38}
              y={y + tileH / 2 + 4}
              fontSize={10}
              textAnchor="end"
              fill="var(--o-text-subtle)"
            >
              {level === 0 ? "G" : `L${level}`}
            </text>
          );
        })}

        {Array.from({ length: rack.bays }, (_, bayIndex) => {
          const bay = bayIndex + 1;
          return (
            <g key={`bay${bay}`}>
              {Array.from({ length: rack.levels }, (_, level) =>
                Array.from({ length: slots }, (_, slotIndex) => {
                  const slot = slotIndex + 1;
                  const cell = grid.get(`${bay}:${level}:${slot}`);
                  const x = 46 + (bayIndex * slots + slotIndex) * tileW;
                  const y = height - 30 - (level + 1) * tileH;
                  if (!cell) {
                    return (
                      <rect
                        key={`${bay}-${level}-${slot}`}
                        x={x + 1}
                        y={y + 1}
                        width={tileW - 2}
                        height={tileH - 2}
                        fill="var(--o-gray-100)"
                      />
                    );
                  }
                  const selected = cell.id === selectedCellId;
                  const dim = highlightIds && !highlightIds.has(cell.id);
                  return (
                    <rect
                      key={cell.id}
                      className="o-map-cell"
                      x={x + 1}
                      y={y + 1}
                      width={tileW - 2}
                      height={tileH - 2}
                      rx={2}
                      fill={cellColor(cell)}
                      opacity={dim ? 0.25 : 1}
                      stroke={selected ? "var(--o-brand-primary)" : "var(--o-border)"}
                      strokeWidth={selected ? 2.2 : 0.6}
                      onClick={() => onSelectCell?.(cell.id)}
                      tabIndex={0}
                      role="button"
                      aria-label={`${cell.completeName}: ${cellStatusLabel(cell)}`}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSelectCell?.(cell.id);
                        }
                      }}
                    >
                      <title>
                        {`${cell.completeName}\n${cellStatusLabel(cell)}${
                          cell.palletName ? `\nPallet ${cell.palletName}` : ""
                        }${cell.productName ? `\n${cell.productName}` : ""}${
                          cell.lotName ? `\nLot ${cell.lotName}` : ""
                        }${
                          cell.quantity
                            ? `\n${cell.quantity} ${cell.uom ?? ""} of ${cell.capacityQty ?? "?"}`
                            : ""
                        }`}
                      </title>
                    </rect>
                  );
                }),
              )}
              {/* bay label every other bay when tiles are narrow */}
              {(tileW >= 22 || bay % 2 === 1) && (
                <text
                  x={46 + bayIndex * slots * tileW + (slots * tileW) / 2}
                  y={height - 12}
                  fontSize={10}
                  textAnchor="middle"
                  fill="var(--o-text-subtle)"
                >
                  {bay}
                </text>
              )}
            </g>
          );
        })}

        <text x={4} y={14} fontSize={10} fill="var(--o-text-subtle)">
          Level
        </text>
        <text
          x={width - 4}
          y={height - 12}
          fontSize={10}
          textAnchor="end"
          fill="var(--o-text-subtle)"
        >
          Column / bay
        </text>
      </svg>
    </div>
  );
}

export function ElevationLegend() {
  const items = [
    { label: "Full pallet", color: "var(--o-series-2)" },
    { label: "Partially filled", color: "var(--o-occ-partial)" },
    { label: "Empty pallet in position", color: "var(--o-gray-400)" },
    { label: "Physically empty", color: "var(--o-occ-empty)" },
    { label: "Reserved for incoming", color: "var(--o-occ-reserved)" },
    { label: "Blocked", color: "var(--o-occ-blocked)" },
  ];
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5 text-[var(--o-fs-xxs)]">
          <span
            className="inline-block w-3 h-3 rounded-sm border border-[var(--o-border)]"
            style={{ background: item.color }}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}
