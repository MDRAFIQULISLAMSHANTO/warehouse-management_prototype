/**
 * Warehouse Occupancy Dashboard.
 *
 * Physical storage, not stock value: how many pallet positions exist, how many
 * hold a pallet, how many are genuinely available for put-away, and where they
 * are. Physical occupancy is deliberately kept separate from restrictions and
 * reservations - a blocked position is not "occupied", and a position reserved
 * for an incoming pallet is not "available".
 *
 * Occupancy = occupied installed positions / installed positions in scope.
 * A partially filled pallet, and an empty pallet still standing in the rack,
 * both occupy their position.
 */

import { Suspense, lazy, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell as ReCell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { contextFacet, listUrl, locationFacet } from "@/app/links";
import type { CellRow, RackRow } from "@/data/derive";
import { useUrlParam, useUrlParams } from "@/hooks/useSearchState";
import { CellPreview } from "@/map/CellPreview";
import { FloorPlan, occupancyColor } from "@/map/FloorPlan";
import { ElevationLegend, RackElevation } from "@/map/RackElevation";
import { useDerived } from "@/store/appStore";

/** three.js is ~400 kB; it must not sit in the main presentation bundle. */
const Warehouse3D = lazy(() =>
  import("@/map/Warehouse3D").then((m) => ({ default: m.Warehouse3D })),
);
import {
  AXIS_PROPS,
  ChartCard,
  ChartTooltip,
  GRID_PROPS,
  PALLET_STATUS_COLORS,
} from "@/odoo/charts";
import { formatInt, formatPct } from "@/odoo/format";
import { EmptyState } from "@/odoo/primitives";
import { cond } from "@/query/domain";
import { DashboardFrame, KpiRow, PanelGrid } from "./DashboardFrame";
import { Kpi } from "./Kpi";
import { SCOPE_NOTES } from "./scope";
import { useScopedRows } from "./useScoped";

export function WarehouseOccupancyDashboard() {
  return (
    <DashboardFrame
      title="Warehouse Occupancy"
      modelName="cell"
      description="Installed pallet positions and how they are used, by warehouse, aisle, rack and level. Select any rack to open its elevation and any position to inspect it."
    >
      {({ scope }) => <OccupancyBody scope={scope} />}
    </DashboardFrame>
  );
}

function OccupancyBody({
  scope,
}: {
  scope: ReturnType<typeof import("./scope").buildScope>;
}) {
  const rows = useScopedRows(scope);
  const cells = rows.cells;
  const highlighted = rows.cellsHighlighted;

  const [warehouseId] = useUrlParam("wh");
  const [rackId, setRackId] = useUrlParam("rack");
  const [cellId, setCellId] = useUrlParam("cell");
  const [view, setView] = useUrlParam("view");
  const is3D = view === "3d";
  const rackById = useDerived().index.rackById;
  // Handlers below change two or three keys at once, which needs a single
  // navigation rather than a sequence of single-key setters.
  const setParams = useUrlParams();

  const warehouses = rows.warehouses;
  const activeWarehouseId = warehouseId || warehouses[0]?.id || "";
  const warehouse = warehouses.find((w) => w.id === activeWarehouseId);

  const warehouseRacks = useMemo(
    () => rows.racks.filter((r) => r.warehouseId === activeWarehouseId),
    [rows.racks, activeWarehouseId],
  );

  // Keep the rack selection valid when the warehouse or filters change.
  useEffect(() => {
    if (rackId && !warehouseRacks.some((r) => r.id === rackId)) setRackId(null);
  }, [rackId, warehouseRacks, setRackId]);

  const rack = warehouseRacks.find((r) => r.id === rackId);
  const rackCells = useMemo(
    () => (rack ? cells.filter((c) => c.rackId === rack.id) : []),
    [cells, rack],
  );
  const selectedCell = cells.find((c) => c.id === cellId);

  const highlightRackIds = useMemo(() => {
    if (highlighted.length === cells.length) return undefined;
    return new Set(highlighted.map((c) => c.rackId));
  }, [highlighted, cells.length]);

  const highlightCellIds = useMemo(() => {
    if (highlighted.length === cells.length) return undefined;
    return new Set(highlighted.map((c) => c.id));
  }, [highlighted, cells.length]);

  // ------------------------------------------------------------------ KPIs
  const installed = cells.length;
  const occupied = cells.filter((c) => c.occupied).length;
  const blocked = cells.filter((c) => c.blocked).length;
  const reservedIncoming = cells.filter((c) => c.reservedIncoming).length;
  const physicallyEmpty = cells.filter((c) => !c.occupied && !c.blocked).length;
  const availablePutaway = cells.filter((c) => c.availableForPutaway).length;
  const occupancyPct = installed ? (occupied / installed) * 100 : 0;

  const cellLink = (facets: Parameters<typeof listUrl>[1]) => listUrl("cell", facets);

  return (
    <>
      <KpiRow>
        <Kpi
          label="Installed positions"
          value={formatInt(installed)}
          sub="From the MinMax capacity tables"
          to={cellLink([])}
          hint="Input, output and staging areas are not rack positions and are excluded."
        />
        <Kpi
          label="Occupied"
          value={formatInt(occupied)}
          tone="action"
          sub="Positions holding a pallet"
          bar={occupancyPct}
          to={cellLink([
            contextFacet("Occupancy Status", ["Occupied"], cond("status", "eq", "occupied")),
          ])}
        />
        <Kpi
          label="Physically empty"
          value={formatInt(physicallyEmpty)}
          sub="No pallet present, blocked positions excluded"
          to={cellLink([
            contextFacet(
              "Occupancy",
              ["No pallet, not blocked"],
              cond("occupied", "eq", false),
            ),
            contextFacet("Blocked", ["No"], cond("blocked", "eq", false)),
          ])}
        />
        <Kpi
          label="Blocked"
          value={formatInt(blocked)}
          tone="bad"
          sub="Unavailable for structural or safety reasons"
          to={cellLink([
            contextFacet("Occupancy Status", ["Blocked"], cond("status", "eq", "blocked")),
          ])}
        />
        <Kpi
          label="Available for put-away"
          value={formatInt(availablePutaway)}
          tone="ok"
          sub={`${formatInt(reservedIncoming)} more reserved for incoming stock`}
          to={cellLink([
            contextFacet(
              "Available for Put-Away",
              ["Yes"],
              cond("availableForPutaway", "eq", true),
            ),
          ])}
          hint="Empty, unblocked and not already claimed by a pending operation."
        />
        <Kpi
          label="Physical occupancy"
          value={formatPct(occupancyPct)}
          tone={occupancyPct > 85 ? "warn" : "brand"}
          sub={`${formatInt(occupied)} of ${formatInt(installed)} positions`}
          bar={occupancyPct}
          hint={SCOPE_NOTES.capacity}
        />
      </KpiRow>

      <PanelGrid>
        <ChartCard
          title="Occupancy comparison by warehouse"
          hint="Occupied, empty, blocked and reserved positions per warehouse."
          height={230}
          footer="Select a warehouse bar to load its floor plan below."
        >
          <WarehouseComparison
            rows={rows.cells}
            warehouses={warehouses.map((w) => ({ id: w.id, code: w.code }))}
            onSelect={(id) => setParams({ wh: id, rack: null, cell: null })}
          />
        </ChartCard>

        <ChartCard
          title="Pallet utilisation"
          hint="How the pallets standing in racking are filled."
          height={230}
          footer="An empty pallet still occupies its position until it is removed or relocated."
        >
          <PalletUtilisation cells={cells} />
        </ChartCard>
      </PanelGrid>

      <section className="o-card p-3">
        <div className="flex items-center gap-3 flex-wrap mb-3">
          <h3 className="o-section-heading text-[var(--o-fs-lg)]">
            {is3D ? "Interactive 3D warehouse" : "Interactive floor plan"}
          </h3>
          <div className="o-statusbar" role="group" aria-label="View mode">
            <button
              type="button"
              className="o-status-step"
              data-active={!is3D ? "true" : undefined}
              onClick={() => setView(null)}
            >
              2D plan
            </button>
            <button
              type="button"
              className="o-status-step"
              data-active={is3D ? "true" : undefined}
              onClick={() => setView("3d")}
            >
              3D
            </button>
          </div>
          <select
            className="o-input"
            style={{ width: 280 }}
            value={activeWarehouseId}
            onChange={(e) =>
              setParams({ wh: e.target.value, rack: null, cell: null })
            }
            aria-label="Warehouse"
          >
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} - {w.name}
              </option>
            ))}
          </select>
          {warehouse && (
            <>
              <span className="text-[var(--o-fs-xs)] text-[var(--o-text-muted)]">
                {formatInt(warehouse.occupied)} of {formatInt(warehouse.positions)}{" "}
                positions occupied ({formatPct(warehouse.occupancyPct)})
              </span>
              {!warehouse.materialGroupConfirmed && (
                <span className="o-badge tone-warn" title={warehouse.sourceNote}>
                  Use unconfirmed
                </span>
              )}
              <Link
                className="o-btn o-btn-secondary o-btn-sm ml-auto"
                to={`/locations/warehouses/${warehouse.id}`}
              >
                Open warehouse
              </Link>
            </>
          )}
        </div>

        {warehouse ? (
          <div className="grid gap-3 grid-cols-1 xl:grid-cols-[1fr_300px]">
            <div className="min-w-0">
              {is3D ? (
                <Suspense
                  fallback={
                    <div
                      className="rounded-[var(--o-radius-md)] border border-[var(--o-border)] flex items-center justify-center text-[var(--o-fs-sm)] text-[var(--o-text-muted)]"
                      style={{ height: 430 }}
                    >
                      Loading the 3D view...
                    </div>
                  }
                >
                  <Warehouse3D
                    warehouse={warehouse}
                    racks={warehouseRacks}
                    cells={cells.filter((c) => c.warehouseId === warehouse.id)}
                    rackById={rackById}
                    selectedCellId={cellId ?? undefined}
                    highlightCellIds={highlightCellIds}
                    onSelectCell={(id) => {
                      const picked = cells.find((c) => c.id === id);
                      setParams({ rack: picked?.rackId ?? null, cell: id });
                    }}
                    height={430}
                  />
                </Suspense>
              ) : (
                <FloorPlan
                  warehouse={warehouse}
                  racks={warehouseRacks}
                  selectedRackId={rack?.id}
                  highlightIds={highlightRackIds}
                  onSelectRack={(id) => setParams({ rack: id, cell: null })}
                  height={430}
                />
              )}
            </div>
            <WarehouseSummary
              warehouse={warehouse}
              cells={cells.filter((c) => c.warehouseId === warehouse.id)}
              rackCount={warehouseRacks.length}
            />
          </div>
        ) : (
          <EmptyState
            title="No warehouse in scope"
            hint="The active filters exclude every rack position."
          />
        )}
      </section>

      {rack && (
        <section className="o-card p-3">
          <div className="flex items-center gap-3 flex-wrap mb-2">
            <h3 className="text-[var(--o-fs-sm)] font-medium text-[var(--o-gray-700)] m-0">
              Rack elevation - {rack.code}
            </h3>
            <span className="text-[var(--o-fs-xs)] text-[var(--o-text-muted)]">
              Profile {rack.profileCode} · {rack.bays} bays × {rack.levels} levels ×{" "}
              {rack.positionsPerBayLevel} per level = {formatInt(rack.positions)}{" "}
              positions · {formatPct(rack.occupancyPct)} occupied
            </span>
            <div className="ml-auto flex gap-2">
              <Link className="o-btn o-btn-secondary o-btn-sm" to={`/locations/racks/${rack.id}`}>
                Open rack
              </Link>
              <Link
                className="o-btn o-btn-secondary o-btn-sm"
                to={cellLink([locationFacet("cell", "id", rack.id, rack.code)])}
              >
                Open its positions
              </Link>
              <button
                type="button"
                className="o-btn o-btn-ghost o-btn-sm"
                onClick={() => {
                  setRackId(null);
                  setCellId(null);
                }}
              >
                Close
              </button>
            </div>
          </div>

          <div className="grid gap-3 grid-cols-1 xl:grid-cols-[1fr_340px]">
            <div className="flex flex-col gap-2 min-w-0">
              <RackElevation
                rack={rack}
                cells={rackCells}
                selectedCellId={selectedCell?.id}
                highlightIds={highlightCellIds}
                onSelectCell={(id) => setCellId(id)}
              />
              <ElevationLegend />
            </div>
            <div>
              {selectedCell ? (
                <CellPreview cell={selectedCell} onClose={() => setCellId(null)} />
              ) : (
                <div className="o-card p-4 text-[var(--o-fs-sm)] text-[var(--o-text-muted)]">
                  Select a position in the elevation to see its full address,
                  pallet, contents, capacity and reservation state.
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      <PanelGrid>
        <ChartCard
          title="Occupancy by aisle"
          hint="Occupied against installed positions for each aisle in the selected warehouse."
          height={250}
          footer="Select a bar to open the positions in that aisle."
        >
          <AisleChart cells={cells.filter((c) => c.warehouseId === activeWarehouseId)} />
        </ChartCard>

        <ChartCard
          title="Occupancy by level"
          hint="Ground positions fill first in most warehouses; upper levels show the reserve capacity."
          height={250}
          footer="Level 0 is the ground position."
        >
          <LevelChart cells={cells.filter((c) => c.warehouseId === activeWarehouseId)} />
        </ChartCard>
      </PanelGrid>

      <RackTable racks={warehouseRacks} onSelect={(id) => setRackId(id)} />
    </>
  );
}

/** Side panel next to the floor plan: the drawing facts and today's usage. */
function WarehouseSummary({
  warehouse,
  cells,
  rackCount,
}: {
  warehouse: { code: string; name: string; declaredPositions: number; drawingRef: string; sourceNote: string; materialGroup: string; materialGroupConfirmed: boolean };
  cells: CellRow[];
  rackCount: number;
}) {
  const occupied = cells.filter((c) => c.occupied).length;
  const partial = cells.filter((c) => c.palletStatus === "partial").length;
  const emptyPallets = cells.filter((c) => c.palletStatus === "empty").length;
  const rows: { label: string; value: string }[] = [
    { label: "Installed positions", value: formatInt(cells.length) },
    { label: "Declared on the drawing", value: formatInt(warehouse.declaredPositions) },
    { label: "Rack runs", value: formatInt(rackCount) },
    { label: "Occupied", value: formatInt(occupied) },
    { label: "Partially filled pallets", value: formatInt(partial) },
    { label: "Empty pallets in position", value: formatInt(emptyPallets) },
    { label: "Blocked", value: formatInt(cells.filter((c) => c.blocked).length) },
    {
      label: "Available for put-away",
      value: formatInt(cells.filter((c) => c.availableForPutaway).length),
    },
  ];

  return (
    <aside className="o-card p-3 flex flex-col gap-2 self-start">
      <div>
        <div className="text-[var(--o-fs-xxs)] uppercase tracking-wide text-[var(--o-text-subtle)]">
          Warehouse
        </div>
        <div className="font-medium">{warehouse.name}</div>
      </div>
      <table className="o-list">
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td className="text-[var(--o-text-muted)]">{row.label}</td>
              <td className="num font-medium">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-[var(--o-fs-xxs)] text-[var(--o-text-subtle)] leading-snug">
        <div className="mb-1">
          <strong>Material group:</strong> {warehouse.materialGroup}
          {!warehouse.materialGroupConfirmed && " (unconfirmed)"}
        </div>
        {warehouse.sourceNote}
      </div>
    </aside>
  );
}

// ------------------------------------------------------------------ charts

function WarehouseComparison({
  rows,
  warehouses,
  onSelect,
}: {
  rows: CellRow[];
  warehouses: { id: string; code: string }[];
  onSelect: (id: string) => void;
}) {
  const data = useMemo(
    () =>
      warehouses.map((w) => {
        const list = rows.filter((c) => c.warehouseId === w.id);
        return {
          id: w.id,
          label: w.code,
          occupied: list.filter((c) => c.occupied).length,
          empty: list.filter((c) => !c.occupied && !c.blocked && !c.reservedIncoming)
            .length,
          reserved: list.filter((c) => c.reservedIncoming).length,
          blocked: list.filter((c) => c.blocked).length,
        };
      }),
    [rows, warehouses],
  );

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="label" {...AXIS_PROPS} />
        <YAxis {...AXIS_PROPS} width={56} allowDecimals={false} />
        <Tooltip content={<ChartTooltip unit="positions" />} cursor={{ fill: "var(--o-hover-bg)" }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar maxBarSize={64}
          dataKey="occupied"
          name="Occupied"
          stackId="a"
          fill="var(--o-action)"
          cursor="pointer"
          onClick={(entry) => onSelect((entry as unknown as { id: string }).id)}
        />
        <Bar maxBarSize={64} dataKey="empty" name="Physically empty" stackId="a" fill="var(--o-occ-empty)" />
        <Bar maxBarSize={64} dataKey="reserved" name="Reserved for incoming" stackId="a" fill="var(--o-occ-reserved)" />
        <Bar maxBarSize={64}
          dataKey="blocked"
          name="Blocked"
          stackId="a"
          fill="var(--o-occ-blocked)"
          radius={[3, 3, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

function PalletUtilisation({ cells }: { cells: CellRow[] }) {
  const data = useMemo(() => {
    const occupied = cells.filter((c) => c.occupied);
    return (["full", "partial", "empty"] as const).map((status) => ({
      key: status,
      label:
        status === "full"
          ? "Full pallets"
          : status === "partial"
            ? "Partially filled"
            : "Empty pallets in position",
      value: occupied.filter((c) => c.palletStatus === status).length,
    }));
  }, [cells]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Tooltip content={<ChartTooltip unit="pallets" />} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Pie data={data} dataKey="value" nameKey="label" innerRadius={48} outerRadius={86}>
          {data.map((entry) => (
            <ReCell
              key={entry.key}
              fill={PALLET_STATUS_COLORS[entry.key as keyof typeof PALLET_STATUS_COLORS]}
            />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}

function AisleChart({ cells }: { cells: CellRow[] }) {
  const data = useMemo(() => {
    const byAisle = new Map<string, { label: string; occupied: number; free: number }>();
    for (const cell of cells) {
      const entry =
        byAisle.get(cell.aisleCode) ?? { label: cell.aisleCode, occupied: 0, free: 0 };
      if (cell.occupied) entry.occupied += 1;
      else entry.free += 1;
      byAisle.set(cell.aisleCode, entry);
    }
    return Array.from(byAisle.values()).sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { numeric: true }),
    );
  }, [cells]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="label" {...AXIS_PROPS} />
        <YAxis {...AXIS_PROPS} width={56} allowDecimals={false} />
        <Tooltip content={<ChartTooltip unit="positions" />} cursor={{ fill: "var(--o-hover-bg)" }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar maxBarSize={64} dataKey="occupied" name="Occupied" stackId="a" fill="var(--o-action)" />
        <Bar maxBarSize={64}
          dataKey="free"
          name="Not occupied"
          stackId="a"
          fill="var(--o-occ-empty)"
          radius={[3, 3, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

function LevelChart({ cells }: { cells: CellRow[] }) {
  const data = useMemo(() => {
    const byLevel = new Map<number, { level: number; occupied: number; total: number }>();
    for (const cell of cells) {
      const entry = byLevel.get(cell.level) ?? { level: cell.level, occupied: 0, total: 0 };
      entry.total += 1;
      if (cell.occupied) entry.occupied += 1;
      byLevel.set(cell.level, entry);
    }
    return Array.from(byLevel.values())
      .sort((a, b) => a.level - b.level)
      .map((entry) => ({
        label: entry.level === 0 ? "Ground" : `L${entry.level}`,
        occupancy: entry.total ? Math.round((entry.occupied / entry.total) * 1000) / 10 : 0,
        occupied: entry.occupied,
        total: entry.total,
      }));
  }, [cells]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="label" {...AXIS_PROPS} />
        <YAxis {...AXIS_PROPS} width={48} unit="%" domain={[0, 100]} />
        <Tooltip
          content={
            <ChartTooltip
              valueFormatter={(value, entry) => {
                const payload = entry.payload as
                  | { occupied: number; total: number }
                  | undefined;
                return payload
                  ? `${formatPct(value)} (${payload.occupied}/${payload.total})`
                  : formatPct(value);
              }}
            />
          }
          cursor={{ fill: "var(--o-hover-bg)" }}
        />
        <Bar maxBarSize={64} dataKey="occupancy" name="Occupancy" radius={[3, 3, 0, 0]}>
          {data.map((entry) => (
            <ReCell key={entry.label} fill={occupancyColor(entry.occupancy)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function RackTable({
  racks,
  onSelect,
}: {
  racks: RackRow[];
  onSelect: (id: string) => void;
}) {
  const sorted = useMemo(
    () => racks.slice().sort((a, b) => b.occupancyPct - a.occupancyPct).slice(0, 12),
    [racks],
  );

  return (
    <section className="o-card p-3">
      <div className="flex items-baseline justify-between gap-3 mb-2 flex-wrap">
        <h3 className="text-[var(--o-fs-sm)] font-medium text-[var(--o-gray-700)] m-0">
          Busiest racks in this warehouse
        </h3>
        <Link className="o-btn o-btn-secondary o-btn-sm" to="/locations/racks">
          All racks
        </Link>
      </div>
      <table className="o-list">
        <thead>
          <tr>
            <th>Rack</th>
            <th>Aisle</th>
            <th>Profile</th>
            <th style={{ textAlign: "right" }}>Positions</th>
            <th style={{ textAlign: "right" }}>Occupied</th>
            <th style={{ textAlign: "right" }}>Available</th>
            <th style={{ textAlign: "right" }}>Blocked</th>
            <th style={{ textAlign: "right" }}>Occupancy</th>
            <th style={{ width: 90 }} />
          </tr>
        </thead>
        <tbody>
          {sorted.map((rack) => (
            <tr key={rack.id}>
              <td>
                <Link to={`/locations/racks/${rack.id}`}>{rack.code}</Link>
              </td>
              <td>{rack.aisleCode}</td>
              <td>{rack.profileCode}</td>
              <td className="num">{formatInt(rack.positions)}</td>
              <td className="num">{formatInt(rack.occupied)}</td>
              <td className="num">{formatInt(rack.availableForPutaway)}</td>
              <td className="num">{formatInt(rack.blocked)}</td>
              <td className="num">{formatPct(rack.occupancyPct)}</td>
              <td>
                <button
                  type="button"
                  className="o-btn o-btn-secondary o-btn-sm"
                  onClick={() => onSelect(rack.id)}
                >
                  Elevation
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
