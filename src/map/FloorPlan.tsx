/**
 * Interactive warehouse floor plan.
 *
 * SCHEMATIC, NOT TRACED. The supplied PDFs could not be rendered to geometry in
 * this environment, so rack runs are laid out to the drawn building proportions
 * and the declared bay counts rather than to surveyed coordinates. Every rack,
 * bay count, level count and position total *is* taken from the drawings.
 *
 * Supports pan, zoom, fit-to-view, rack selection and search highlighting.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RackRow, WarehouseRow } from "@/data/derive";
import { PLAN_WIDTH } from "@/data/seed";
import { formatPct } from "@/odoo/format";
import { IconSearch } from "@/odoo/icons";
import { useDerived } from "@/store/appStore";

export interface FloorPlanProps {
  warehouse: WarehouseRow;
  racks: RackRow[];
  selectedRackId?: string;
  onSelectRack?: (rackId: string) => void;
  /** Highlight racks matching this term (rack code, aisle, product, lot). */
  highlightIds?: Set<string>;
  height?: number;
  /** Colour racks by this measure. */
  measure?: "occupancy" | "available" | "blocked" | "partial";
}

const PADDING = 26;

export function occupancyColor(pct: number): string {
  if (pct >= 95) return "var(--o-occ-full)";
  if (pct >= 80) return "var(--o-occ-high)";
  if (pct >= 55) return "var(--o-occ-medium)";
  if (pct > 0) return "var(--o-occ-low)";
  return "var(--o-occ-empty)";
}

export function FloorPlan({
  warehouse,
  racks,
  selectedRackId,
  onSelectRack,
  highlightIds,
  height = 420,
  measure = "occupancy",
}: FloorPlanProps) {
  const derived = useDerived();
  const [term, setTerm] = useState("");
  const svgRef = useRef<SVGSVGElement>(null);

  // Canvas keeps the building's drawn proportions; the seed lays racks out on
  // exactly this canvas, so the two always agree.
  const planHeight = useMemo(
    () => Math.round((PLAN_WIDTH * getDepth(warehouse)) / getWidth(warehouse)),
    [warehouse],
  );

  const fullBox = useMemo(
    () => ({
      x: -PADDING,
      y: -PADDING,
      w: PLAN_WIDTH + PADDING * 2,
      h: planHeight + PADDING * 2,
    }),
    [planHeight],
  );

  const [box, setBox] = useState(fullBox);
  useEffect(() => setBox(fullBox), [fullBox]);

  // Size the drawing frame to the plan's aspect ratio within the available
  // width, so the SVG never letterboxes inside an over-wide container.
  const frameRef = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(0);
  useEffect(() => {
    const node = frameRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      setAvailable(entry.contentRect.width);
    });
    observer.observe(node);
    setAvailable(node.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

  const fitted = useMemo(() => {
    const aspect = fullBox.w / fullBox.h;
    const width = available || 900;
    const byHeight = { width: Math.round(height * aspect), height };
    if (byHeight.width <= width) return byHeight;
    return { width, height: Math.round(width / aspect) };
  }, [available, height, fullBox]);

  const aisleLabels = useMemo(() => {
    const map = new Map<string, { code: string; y: number }>();
    for (const rack of racks) {
      const geo = derived.index.rackById.get(rack.id);
      if (!geo) continue;
      const existing = map.get(rack.aisleId);
      if (!existing || geo.y < existing.y) {
        map.set(rack.aisleId, { code: rack.aisleCode, y: geo.y });
      }
    }
    return Array.from(map.values());
  }, [racks, derived]);

  const matches = useMemo(() => {
    const needle = term.trim().toLowerCase();
    if (!needle) return null;
    const found = new Set<string>();
    for (const rack of racks) {
      if (
        rack.code.toLowerCase().includes(needle) ||
        rack.aisleCode.toLowerCase().includes(needle) ||
        rack.profileCode.toLowerCase().includes(needle)
      ) {
        found.add(rack.id);
      }
    }
    // Also match on stock held in the rack, so "Zareen" or a lot lands here.
    for (const cell of derived.cells) {
      if (cell.warehouseId !== warehouse.id) continue;
      if (
        cell.productName?.toLowerCase().includes(needle) ||
        cell.lotName?.toLowerCase().includes(needle) ||
        cell.palletName?.toLowerCase().includes(needle)
      ) {
        found.add(cell.rackId);
      }
    }
    return found;
  }, [term, racks, derived, warehouse.id]);

  const effectiveHighlight = matches ?? highlightIds;

  const zoom = useCallback((factor: number, cx?: number, cy?: number) => {
    setBox((prev) => {
      const w = Math.max(120, Math.min(prev.w * factor, fullBox.w * 3));
      const h = (w / prev.w) * prev.h;
      const anchorX = cx ?? prev.x + prev.w / 2;
      const anchorY = cy ?? prev.y + prev.h / 2;
      return {
        x: anchorX - ((anchorX - prev.x) * w) / prev.w,
        y: anchorY - ((anchorY - prev.y) * h) / prev.h,
        w,
        h,
      };
    });
  }, [fullBox.w]);

  const drag = useRef<{ x: number; y: number; box: typeof box } | null>(null);

  const toSvg = (clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: box.x + ((clientX - rect.left) / rect.width) * box.w,
      y: box.y + ((clientY - rect.top) / rect.height) * box.h,
    };
  };

  const value = (rack: RackRow) => {
    switch (measure) {
      case "available":
        return rack.positions ? (rack.availableForPutaway / rack.positions) * 100 : 0;
      case "blocked":
        return rack.positions ? (rack.blocked / rack.positions) * 100 : 0;
      case "partial":
        return rack.positions ? (rack.partialPallets / rack.positions) * 100 : 0;
      default:
        return rack.occupancyPct;
    }
  };

  const fill = (rack: RackRow) => {
    if (measure === "occupancy") return occupancyColor(rack.occupancyPct);
    const pct = value(rack);
    if (measure === "available") {
      return pct > 40 ? "var(--o-occ-low)" : pct > 10 ? "var(--o-occ-medium)" : "var(--o-occ-full)";
    }
    if (measure === "blocked") {
      return pct > 0 ? "var(--o-occ-blocked)" : "var(--o-occ-empty)";
    }
    return pct > 20 ? "var(--o-occ-partial)" : "var(--o-occ-empty)";
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <span className="absolute left-2 top-[7px] text-[var(--o-text-subtle)]">
            <IconSearch size={12} />
          </span>
          <input
            className="o-input pl-7"
            style={{ width: 230 }}
            placeholder="Find rack, aisle, product, lot"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            aria-label="Search the floor plan"
          />
        </div>
        <div className="flex gap-1">
          <button type="button" className="o-btn o-btn-secondary o-btn-sm" onClick={() => zoom(0.8)}>
            Zoom in
          </button>
          <button type="button" className="o-btn o-btn-secondary o-btn-sm" onClick={() => zoom(1.25)}>
            Zoom out
          </button>
          <button
            type="button"
            className="o-btn o-btn-secondary o-btn-sm"
            onClick={() => setBox(fullBox)}
          >
            Fit to view
          </button>
        </div>
        {matches && (
          <span className="text-[var(--o-fs-xs)] text-[var(--o-text-muted)]">
            {matches.size} rack{matches.size === 1 ? "" : "s"} matched
          </span>
        )}
        <Legend measure={measure} />
      </div>

      {/* The frame hugs the plan's own proportions so a near-square building
          does not sit marooned inside a wide empty box. */}
      <div ref={frameRef} className="w-full flex justify-center">
        <div
          className="o-card overflow-hidden bg-[var(--o-surface-sunken)]"
          style={{ height: fitted.height, width: fitted.width }}
        >
        <svg
          ref={svgRef}
          viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
          width="100%"
          height="100%"
          role="img"
          aria-label={`Schematic floor plan of ${warehouse.name}`}
          style={{ cursor: drag.current ? "grabbing" : "grab", touchAction: "none" }}
          onWheel={(e) => {
            const point = toSvg(e.clientX, e.clientY);
            zoom(e.deltaY > 0 ? 1.12 : 0.89, point.x, point.y);
          }}
          onPointerDown={(e) => {
            drag.current = { x: e.clientX, y: e.clientY, box };
            (e.target as Element).setPointerCapture?.(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            const rect = svgRef.current?.getBoundingClientRect();
            if (!rect) return;
            const dx = ((e.clientX - drag.current.x) / rect.width) * drag.current.box.w;
            const dy = ((e.clientY - drag.current.y) / rect.height) * drag.current.box.h;
            setBox({ ...drag.current.box, x: drag.current.box.x - dx, y: drag.current.box.y - dy });
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
          onPointerLeave={() => {
            drag.current = null;
          }}
        >
          {/* Building outline */}
          <rect
            x={0}
            y={0}
            width={PLAN_WIDTH}
            height={planHeight}
            fill="var(--o-view-bg)"
            stroke="var(--o-border-strong)"
            strokeWidth={1.5}
          />

          {aisleLabels.map((aisle) => (
            <text
              key={aisle.code}
              x={-8}
              y={aisle.y + 8}
              fontSize={11}
              textAnchor="end"
              fill="var(--o-text-subtle)"
            >
              {aisle.code}
            </text>
          ))}

          {racks.map((rack) => {
            const geo = derived.index.rackById.get(rack.id);
            if (!geo) return null;
            const isSelected = rack.id === selectedRackId;
            const isMatch = effectiveHighlight?.has(rack.id);
            const dim = effectiveHighlight && !isMatch;
            return (
              <g
                key={rack.id}
                className="o-map-rack"
                onClick={() => onSelectRack?.(rack.id)}
                opacity={dim ? 0.28 : 1}
              >
                <title>
                  {`${rack.code} (${rack.profileCode})\n${rack.bays} bays x ${rack.levels} levels = ${rack.positions} positions\nOccupied ${rack.occupied} (${formatPct(rack.occupancyPct)})\nAvailable for put-away ${rack.availableForPutaway}, blocked ${rack.blocked}`}
                </title>
                <rect
                  className="o-map-rack-body"
                  x={geo.x}
                  y={geo.y}
                  width={geo.width}
                  height={geo.depth}
                  rx={2}
                  fill={fill(rack)}
                  stroke={
                    isSelected
                      ? "var(--o-brand-primary)"
                      : isMatch
                        ? "var(--o-action)"
                        : "var(--o-border-strong)"
                  }
                  strokeWidth={isSelected ? 2.4 : isMatch ? 1.8 : 0.6}
                />
                {geo.width > 46 && (
                  <text
                    x={geo.x + geo.width / 2}
                    y={geo.y + geo.depth / 2 + 3.4}
                    fontSize={Math.min(9, geo.depth * 0.5)}
                    textAnchor="middle"
                    fill="var(--o-gray-900)"
                    style={{ pointerEvents: "none", fontWeight: 500 }}
                  >
                    {rack.code.split("-").pop()}
                  </text>
                )}
              </g>
            );
          })}
          </svg>
        </div>
      </div>

      <p className="text-[var(--o-fs-xxs)] text-[var(--o-text-subtle)]">
        Schematic layout. Rack runs, bay counts, level counts and position totals
        come from {warehouse.drawingRef}; plan positions are approximate and not
        traced from the drawing geometry.
      </p>
    </div>
  );
}

function Legend({ measure }: { measure: string }) {
  const items =
    measure === "occupancy"
      ? [
          { label: "Empty", color: "var(--o-occ-empty)" },
          { label: "< 55%", color: "var(--o-occ-low)" },
          { label: "55-80%", color: "var(--o-occ-medium)" },
          { label: "80-95%", color: "var(--o-occ-high)" },
          { label: "95%+", color: "var(--o-occ-full)" },
        ]
      : measure === "available"
        ? [
            { label: "Plenty free", color: "var(--o-occ-low)" },
            { label: "Some free", color: "var(--o-occ-medium)" },
            { label: "Nearly full", color: "var(--o-occ-full)" },
          ]
        : measure === "blocked"
          ? [
              { label: "Has blocked positions", color: "var(--o-occ-blocked)" },
              { label: "None blocked", color: "var(--o-occ-empty)" },
            ]
          : [
              { label: "Partial pallets present", color: "var(--o-occ-partial)" },
              { label: "None", color: "var(--o-occ-empty)" },
            ];

  return (
    <div className="ml-auto flex items-center gap-2.5 flex-wrap">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1 text-[var(--o-fs-xxs)]">
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

function getWidth(warehouse: WarehouseRow): number {
  return WAREHOUSE_FOOTPRINTS[warehouse.code]?.width ?? 100;
}

function getDepth(warehouse: WarehouseRow): number {
  return WAREHOUSE_FOOTPRINTS[warehouse.code]?.depth ?? 80;
}

/** Building proportions as drawn, used only to shape the schematic canvas. */
const WAREHOUSE_FOOTPRINTS: Record<string, { width: number; depth: number }> = {
  RTW2: { width: 100, depth: 94.67 },
  FGW: { width: 100, depth: 50.17 },
  R56: { width: 59, depth: 119.42 },
  WH2: { width: 203, depth: 79.67 },
};
