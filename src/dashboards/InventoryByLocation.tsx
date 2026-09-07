/**
 * Inventory by Location Dashboard.
 *
 * Walks the location hierarchy the SRS asks for -
 * Warehouse -> Aisle -> Rack -> Column -> Row -> Cell -> Pallet - showing the
 * stock and the distinct pallet count at whatever level is selected, and the
 * distribution across the level below it.
 */

import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell as ReCell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { contextFacet, listUrl, locationFacet } from "@/app/links";
import type { StockRow } from "@/data/derive";
import { useUrlParam } from "@/hooks/useSearchState";
import { CellPreview } from "@/map/CellPreview";
import { FloorPlan, occupancyColor } from "@/map/FloorPlan";
import { ElevationLegend, RackElevation } from "@/map/RackElevation";
import { AXIS_PROPS, ChartCard, ChartTooltip, GRID_PROPS } from "@/odoo/charts";
import { formatInt, formatNumber, formatPct } from "@/odoo/format";
import { EmptyState } from "@/odoo/primitives";
import { cond } from "@/query/domain";
import { DashboardFrame, KpiRow } from "./DashboardFrame";
import { Kpi } from "./Kpi";
import { RecordsPanel } from "./RecordsPanel";
import { distinct, unitsPresent, useScopedRows } from "./useScoped";

type Level = "site" | "warehouse" | "aisle" | "rack" | "cell";

export function InventoryByLocationDashboard() {
  return (
    <DashboardFrame
      title="Inventory by Location"
      modelName="stock"
      description="Drill from the whole site down to a single pallet position. Every level shows what is stored there and how it is spread across the level below."
    >
      {({ scope }) => <LocationBody scope={scope} />}
    </DashboardFrame>
  );
}

function LocationBody({
  scope,
}: {
  scope: ReturnType<typeof import("./scope").buildScope>;
}) {
  const rows = useScopedRows(scope);
  const [warehouseId, setWarehouseId] = useUrlParam("wh");
  const [aisleId, setAisleId] = useUrlParam("aisle");
  const [rackId, setRackId] = useUrlParam("rack");
  const [cellId, setCellId] = useUrlParam("cell");

  const level: Level = cellId
    ? "cell"
    : rackId
      ? "rack"
      : aisleId
        ? "aisle"
        : warehouseId
          ? "warehouse"
          : "site";

  // Stock and positions in the current scope of the hierarchy.
  const stock = useMemo(() => {
    let list = rows.stock;
    if (warehouseId) list = list.filter((r) => r.warehouseId === warehouseId);
    if (aisleId) list = list.filter((r) => r.aisleId === aisleId);
    if (rackId) list = list.filter((r) => r.rackId === rackId);
    if (cellId) list = list.filter((r) => r.locationId === cellId);
    return list;
  }, [rows.stock, warehouseId, aisleId, rackId, cellId]);

  const cells = useMemo(() => {
    let list = rows.cells;
    if (warehouseId) list = list.filter((c) => c.warehouseId === warehouseId);
    if (aisleId) list = list.filter((c) => c.aisleId === aisleId);
    if (rackId) list = list.filter((c) => c.rackId === rackId);
    if (cellId) list = list.filter((c) => c.id === cellId);
    return list;
  }, [rows.cells, warehouseId, aisleId, rackId, cellId]);

  const warehouse = rows.warehouses.find((w) => w.id === warehouseId);
  const rack = rows.racks.find((r) => r.id === rackId);
  const selectedCell = rows.cells.find((c) => c.id === cellId);
  const aisleCode = cells[0]?.aisleCode;

  const units = unitsPresent(stock);
  const occupied = cells.filter((c) => c.occupied).length;
  const occupancy = cells.length ? (occupied / cells.length) * 100 : 0;

  const scopeFacet = () => {
    if (cellId && selectedCell)
      return [locationFacet("stock", "locationId", cellId, selectedCell.completeName)];
    if (rackId && rack) return [locationFacet("stock", "locationId", rackId, rack.code)];
    if (aisleId && aisleCode)
      return [locationFacet("stock", "locationId", aisleId, `Aisle ${aisleCode}`)];
    if (warehouseId && warehouse)
      return [locationFacet("stock", "locationId", warehouseId, warehouse.code)];
    return [];
  };

  // -------------------------------------------------------- child breakdown
  const children = useMemo(() => {
    if (level === "site") {
      return rows.warehouses.map((w) => ({
        id: w.id,
        label: `${w.code} - ${w.name}`,
        short: w.code,
        onSelect: () => {
          setWarehouseId(w.id);
          setAisleId(null);
          setRackId(null);
          setCellId(null);
        },
        positions: w.positions,
        occupied: w.occupied,
        stock: rows.stock.filter((r) => r.warehouseId === w.id),
      }));
    }
    if (level === "warehouse") {
      const aisles = new Map<string, { id: string; code: string }>();
      for (const cell of cells) aisles.set(cell.aisleId, { id: cell.aisleId, code: cell.aisleCode });
      return Array.from(aisles.values())
        .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
        .map((aisle) => {
          const list = cells.filter((c) => c.aisleId === aisle.id);
          return {
            id: aisle.id,
            label: `Aisle ${aisle.code}`,
            onSelect: () => {
              setAisleId(aisle.id);
              setRackId(null);
              setCellId(null);
            },
            positions: list.length,
            occupied: list.filter((c) => c.occupied).length,
            stock: stock.filter((r) => r.aisleId === aisle.id),
          };
        });
    }
    if (level === "aisle") {
      const racks = new Map<string, string>();
      for (const cell of cells) racks.set(cell.rackId, cell.rackCode);
      return Array.from(racks.entries())
        .sort((a, b) => a[1].localeCompare(b[1], undefined, { numeric: true }))
        .map(([id, code]) => {
          const list = cells.filter((c) => c.rackId === id);
          return {
            id,
            label: code,
            onSelect: () => {
              setRackId(id);
              setCellId(null);
            },
            positions: list.length,
            occupied: list.filter((c) => c.occupied).length,
            stock: stock.filter((r) => r.rackId === id),
          };
        });
    }
    if (level === "rack") {
      const bays = new Map<number, typeof cells>();
      for (const cell of cells) {
        const list = bays.get(cell.bay) ?? [];
        list.push(cell);
        bays.set(cell.bay, list);
      }
      return Array.from(bays.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([bay, list]) => ({
          id: `bay-${bay}`,
          label: `Column / bay ${bay}`,
          onSelect: undefined,
          positions: list.length,
          occupied: list.filter((c) => c.occupied).length,
          stock: stock.filter((r) => r.bay === bay),
        }));
    }
    return [];
  }, [level, rows, cells, stock, setWarehouseId, setAisleId, setRackId, setCellId]);

  return (
    <>
      <nav className="flex items-center gap-1.5 text-[var(--o-fs-sm)] flex-wrap">
        <button
          type="button"
          className="o-btn o-btn-link"
          onClick={() => {
            setWarehouseId(null);
            setAisleId(null);
            setRackId(null);
            setCellId(null);
          }}
        >
          All warehouses
        </button>
        {warehouse && (
          <>
            <span className="text-[var(--o-text-subtle)]">/</span>
            <button
              type="button"
              className="o-btn o-btn-link"
              onClick={() => {
                setAisleId(null);
                setRackId(null);
                setCellId(null);
              }}
            >
              {warehouse.code}
            </button>
          </>
        )}
        {aisleId && aisleCode && (
          <>
            <span className="text-[var(--o-text-subtle)]">/</span>
            <button
              type="button"
              className="o-btn o-btn-link"
              onClick={() => {
                setRackId(null);
                setCellId(null);
              }}
            >
              Aisle {aisleCode}
            </button>
          </>
        )}
        {rack && (
          <>
            <span className="text-[var(--o-text-subtle)]">/</span>
            <button
              type="button"
              className="o-btn o-btn-link"
              onClick={() => setCellId(null)}
            >
              {rack.code}
            </button>
          </>
        )}
        {selectedCell && (
          <>
            <span className="text-[var(--o-text-subtle)]">/</span>
            <span className="text-[var(--o-text-muted)]">{selectedCell.name}</span>
          </>
        )}
      </nav>

      <KpiRow>
        <Kpi
          label="Installed positions"
          value={formatInt(cells.length)}
          sub="At the selected level"
        />
        <Kpi
          label="Occupied positions"
          value={formatInt(occupied)}
          tone="action"
          bar={occupancy}
          sub={formatPct(occupancy)}
        />
        <Kpi
          label="Distinct pallets"
          value={formatInt(distinct(stock, "palletId"))}
          sub="Pallets holding stock here"
          to={listUrl("pallet", [
            ...(warehouseId
              ? [contextFacet("Warehouse", [warehouse?.code ?? ""], cond("warehouseId", "eq", warehouseId))]
              : []),
          ])}
        />
        <Kpi
          label="Distinct products"
          value={formatInt(distinct(stock, "productId"))}
          sub="Products stored here"
        />
        <Kpi
          label="Distinct lots"
          value={formatInt(distinct(stock, "lotId"))}
          sub="Lots stored here"
        />
        <Kpi
          label="Stock lines"
          value={formatInt(stock.length)}
          sub="Product / lot / pallet / position rows"
          to={listUrl("stock", scopeFacet())}
        />
      </KpiRow>

      <section className="o-card p-3">
        <h3 className="o-section-heading text-[var(--o-fs-lg)] mb-2">
          Quantity held here, by unit of measure
        </h3>
        {units.length === 0 ? (
          <EmptyState title="No stock at this location" />
        ) : (
          <div className="flex flex-wrap gap-4">
            {units.map(({ unit, total }) => (
              <div key={unit} className="min-w-[160px]">
                <div className="text-[var(--o-fs-xxs)] uppercase tracking-wide text-[var(--o-text-subtle)]">
                  {unit}
                </div>
                <div className="text-[var(--o-fs-xl)] font-bold o-tabular">
                  {formatNumber(total, 2)}
                </div>
                <div className="text-[var(--o-fs-xs)] text-[var(--o-text-muted)]">
                  available {formatNumber(
                    stock
                      .filter((r) => r.uom === unit)
                      .reduce((s, r) => s + r.availableQuantity, 0),
                    2,
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {children.length > 0 && (
        <ChartCard
          title={`Distribution across ${
            level === "site"
              ? "warehouses"
              : level === "warehouse"
                ? "aisles"
                : level === "aisle"
                  ? "racks"
                  : "columns / bays"
          }`}
          hint="Occupancy of each child location, coloured on the same scale used by the maps."
          height={210}
          footer="Select a bar to drill into that location."
        >
          <ChildChart children={children} />
        </ChartCard>
      )}

      {level !== "site" && warehouse && !rack && (
        <section className="o-card p-3">
          <h3 className="o-section-heading text-[var(--o-fs-lg)] mb-2">
            {warehouse.code} floor plan
          </h3>
          <FloorPlan
            warehouse={warehouse}
            racks={rows.racks.filter(
              (r) =>
                r.warehouseId === warehouse.id && (!aisleId || r.aisleId === aisleId),
            )}
            onSelectRack={(id) => {
              const target = rows.racks.find((r) => r.id === id);
              if (target) setAisleId(target.aisleId);
              setRackId(id);
              setCellId(null);
            }}
            height={320}
          />
        </section>
      )}

      {rack && (
        <section className="o-card p-3">
          <div className="flex items-center gap-3 flex-wrap mb-2">
            <h3 className="text-[var(--o-fs-sm)] font-medium text-[var(--o-gray-700)] m-0">
              {rack.code} elevation
            </h3>
            <Link className="o-btn o-btn-secondary o-btn-sm ml-auto" to={`/locations/racks/${rack.id}`}>
              Open rack
            </Link>
          </div>
          <div className="grid gap-3 grid-cols-1 xl:grid-cols-[1fr_340px]">
            <div className="min-w-0">
              <RackElevation
                rack={rack}
                cells={rows.cells.filter((c) => c.rackId === rack.id)}
                selectedCellId={cellId || undefined}
                onSelectCell={(id) => setCellId(id)}
              />
              <div className="mt-2">
                <ElevationLegend />
              </div>
            </div>
            {selectedCell && <CellPreview cell={selectedCell} onClose={() => setCellId(null)} />}
          </div>
        </section>
      )}

      <ChildTable children={children} level={level} />

      <StockTable stock={stock} facets={scopeFacet()} />
    </>
  );
}

interface ChildEntry {
  id: string;
  label: string;
  /** Compact label for chart axes; falls back to `label`. */
  short?: string;
  onSelect?: () => void;
  positions: number;
  occupied: number;
  stock: StockRow[];
}

function ChildChart({ children }: { children: ChildEntry[] }) {
  const data = children.map((child) => ({
    id: child.id,
    label: child.short ?? child.label,
    occupancy: child.positions
      ? Math.round((child.occupied / child.positions) * 1000) / 10
      : 0,
    occupied: child.occupied,
    positions: child.positions,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="label" {...AXIS_PROPS} interval={0} height={28} />
        <YAxis {...AXIS_PROPS} width={48} unit="%" domain={[0, 100]} />
        <Tooltip
          content={
            <ChartTooltip
              valueFormatter={(value, entry) => {
                const payload = entry.payload as
                  | { occupied: number; positions: number }
                  | undefined;
                return payload
                  ? `${formatPct(value)} (${payload.occupied}/${payload.positions})`
                  : formatPct(value);
              }}
            />
          }
          cursor={{ fill: "var(--o-hover-bg)" }}
        />
        <Bar maxBarSize={64}
          dataKey="occupancy"
          name="Occupancy"
          radius={[3, 3, 0, 0]}
          cursor="pointer"
          onClick={(entry) => {
            const id = (entry as unknown as { id: string }).id;
            children.find((c) => c.id === id)?.onSelect?.();
          }}
        >
          {data.map((entry) => (
            <ReCell key={entry.id} fill={occupancyColor(entry.occupancy)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function ChildTable({ children, level }: { children: ChildEntry[]; level: Level }) {
  if (!children.length) return null;
  return (
    <section className="o-card p-3">
      <h3 className="o-section-heading text-[var(--o-fs-lg)] mb-2">
        {level === "site"
          ? "Warehouses"
          : level === "warehouse"
            ? "Aisles"
            : level === "aisle"
              ? "Racks"
              : "Columns / bays"}
      </h3>
      <table className="o-list">
        <thead>
          <tr>
            <th>Location</th>
            <th style={{ textAlign: "right" }}>Positions</th>
            <th style={{ textAlign: "right" }}>Occupied</th>
            <th style={{ textAlign: "right" }}>Occupancy</th>
            <th style={{ textAlign: "right" }}>Distinct pallets</th>
            <th style={{ textAlign: "right" }}>Stock lines</th>
            <th style={{ width: 90 }} />
          </tr>
        </thead>
        <tbody>
          {children.map((child) => (
            <tr key={child.id}>
              <td className="font-medium">{child.label}</td>
              <td className="num">{formatInt(child.positions)}</td>
              <td className="num">{formatInt(child.occupied)}</td>
              <td className="num">
                {formatPct(child.positions ? (child.occupied / child.positions) * 100 : 0)}
              </td>
              <td className="num">{formatInt(distinct(child.stock, "palletId"))}</td>
              <td className="num">{formatInt(child.stock.length)}</td>
              <td>
                {child.onSelect && (
                  <button
                    type="button"
                    className="o-btn o-btn-secondary o-btn-sm"
                    onClick={child.onSelect}
                  >
                    Open
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function StockTable({
  stock,
  facets,
}: {
  stock: StockRow[];
  facets: Parameters<typeof listUrl>[1];
}) {
  return (
    <RecordsPanel
      label="stock lines at this location"
      count={stock.length}
      model="stock"
      facets={facets}
      extra={[{ label: "Pallets here", model: "pallet", facets }]}
      note="Stock lines carry product, variant, lot, pallet, quantity, reservation and age, and can be grouped to any level of the hierarchy."
    />
  );
}

