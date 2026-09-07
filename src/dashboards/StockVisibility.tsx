/**
 * Stock Visibility Dashboard.
 *
 * Answers "what stock do we hold, in what state, and where is it" for RM, FG
 * and PM at once. Quantities are always shown inside one unit of measure -
 * kilograms are never added to cartons - so the unit selector is part of the
 * page, not a decoration.
 */

import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { contextFacet, listUrl, thresholdFacet } from "@/app/links";
import { AGE_BUCKETS, toDateKey } from "@/data/clock";
import type { MovementRow, StockRow } from "@/data/derive";
import { useUrlParam } from "@/hooks/useSearchState";
import {
  AXIS_PROPS,
  ChartCard,
  ChartTooltip,
  GRID_PROPS,
  MATERIAL_COLORS,
  seriesColor,
  shortLabel,
} from "@/odoo/charts";
import { formatInt, formatNumber } from "@/odoo/format";
import { and, cond, or, type DomainNode } from "@/query/domain";
import { groupKeyFor } from "@/query/group";
import type { Facet } from "@/query/search";
import { DashboardFrame, KpiRow, PanelGrid } from "./DashboardFrame";
import { Kpi } from "./Kpi";
import { SCOPE_NOTES } from "./scope";
import { distinct, sumIn, tally, unitsPresent, useScopedRows } from "./useScoped";
import { CLICKABLE, payloadOf, useDrilldown, type DrilldownFn } from "./useDrilldown";

/** Bar name built outside JSX so the patchable markup stays plain. */
const QUANTITY_LABEL = (unit: string) => `Quantity (${unit})`;

const AVAILABILITY_SERIES = [
  {
    key: "available",
    name: "Available to pick",
    field: "availableQuantity",
    fill: "var(--o-series-2)",
  },
  {
    key: "reserved",
    name: "Reserved",
    field: "reservedQuantity",
    fill: "var(--o-occ-partial)",
  },
] as const;

/**
 * A week key from `groupKeyFor` is an ISO-ish "YYYY-Www" token. The movement
 * list filters on a date range, so the key is turned back into the seven days
 * it stands for.
 */
function weekDomain(key: string): DomainNode {
  const match = /^(\d{4})-W(\d{2})$/.exec(key);
  if (!match) return cond("movementDate", "eq", key);
  const year = Number(match[1]);
  const week = Number(match[2]);
  // ISO week 1 contains 4 January.
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const isoMonday = new Date(jan4);
  isoMonday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7));
  const start = new Date(isoMonday);
  start.setUTCDate(isoMonday.getUTCDate() + (week - 1) * 7);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return and(
    cond("movementDate", "gte", start.toISOString().slice(0, 10)),
    cond("movementDate", "lte", end.toISOString().slice(0, 10)),
  );
}

const MATERIAL_LABEL: Record<string, string> = {
  RM: "Raw Material",
  FG: "Finished Goods",
  PM: "Packing Material",
};

export function StockVisibilityDashboard() {
  return (
    <DashboardFrame
      title="Stock Visibility"
      modelName="stock"
      description="Live stock across every warehouse, with reservations and what is genuinely available to pick. Each figure opens the stock lines behind it."
    >
      {({ scope, state }) => (
        <StockVisibilityBody scope={scope} carry={state.facets} />
      )}
    </DashboardFrame>
  );
}

function StockVisibilityBody({
  scope,
  carry,
}: {
  scope: ReturnType<typeof import("./scope").buildScope>;
  carry: Facet[];
}) {
  const rows = useScopedRows(scope);
  const stock = rows.stock;
  const [unit, setUnit] = useUrlParam("unit");
  // Every chart click opens the records behind the slice, carrying the
  // dashboard's own filters with it.
  const drill = useDrilldown(carry);

  const units = useMemo(() => unitsPresent(stock), [stock]);
  const activeUnit = unit || units[0]?.unit || "kg";
  const inUnit = useMemo(
    () => stock.filter((row) => row.uom === activeUnit),
    [stock, activeUnit],
  );

  const onHand = sumIn(stock, "quantity", activeUnit);
  const reserved = sumIn(stock, "reservedQuantity", activeUnit);
  const available = sumIn(stock, "availableQuantity", activeUnit);

  // -------------------------------------------------------------- KPI links
  const stockLink = (facets: Parameters<typeof listUrl>[1]) =>
    listUrl("stock", facets);

  const unitFacet = contextFacet("Unit", [activeUnit], cond("uom", "eq", activeUnit));

  return (
    <>
      <KpiRow>
        <Kpi
          label="Products in stock"
          value={formatInt(distinct(stock, "productId"))}
          sub="Distinct products with stock on hand"
          to={listUrl("product", [
            contextFacet("Availability", ["In stock"], cond("onHand", "gt", 0)),
          ])}
          hint="Counts distinct products, and opens exactly that many product records."
        />
        <Kpi
          label="Active lots"
          value={formatInt(distinct(stock, "lotId"))}
          sub="Lots currently holding stock"
          tone="action"
          to={listUrl("lot", [
            contextFacet("Availability", ["In stock"], cond("onHand", "gt", 0)),
          ])}
        />
        <Kpi
          label="Loaded pallets"
          value={formatInt(distinct(stock, "palletId"))}
          sub="Distinct pallets carrying stock"
          tone="action"
          to={listUrl("pallet", [
            contextFacet("Availability", ["In stock"], cond("quantity", "gt", 0)),
          ])}
          hint="A distinct count of pallets. The list it opens holds one row per pallet, never a row per stock line."
        />
        <Kpi
          label={`On hand (${activeUnit})`}
          value={formatNumber(onHand, 0)}
          sub={`${units.length} unit${units.length === 1 ? "" : "s"} of measure in scope`}
          to={stockLink([unitFacet])}
          hint={SCOPE_NOTES.units}
        />
        <Kpi
          label={`Reserved (${activeUnit})`}
          value={formatNumber(reserved, 0)}
          tone="warn"
          sub="Committed to operations that are not yet validated"
          to={stockLink([
            unitFacet,
            contextFacet("Reserved", ["> 0"], cond("reservedQuantity", "gt", 0)),
          ])}
          hint="Reservations reduce what is available. They never reduce on-hand quantity."
        />
        <Kpi
          label={`Available to pick (${activeUnit})`}
          value={formatNumber(available, 0)}
          tone="ok"
          sub={`${formatNumber(onHand ? (available / onHand) * 100 : 0, 1)}% of on hand`}
          bar={onHand ? (available / onHand) * 100 : 0}
          to={stockLink([
            unitFacet,
            contextFacet("Available", ["> 0"], cond("availableQuantity", "gt", 0)),
          ])}
        />
      </KpiRow>

      <UnitPanel
        units={units}
        stock={stock}
        activeUnit={activeUnit}
        onSelect={(value) => setUnit(value)}
      />

      <PanelGrid>
        <ChartCard
          title={`Stock by section (${activeUnit})`}
          hint="On-hand quantity in each section of the building, split by material group."
          footer="Select a bar to open the stock lines for that section."
        >
          <WarehouseChart rows={inUnit} unit={activeUnit} drill={drill} />
        </ChartCard>

        <ChartCard
          title="Distribution by material group"
          hint="Loaded pallets per material group. Counted in pallets rather than quantity so RM, FG and PM stay comparable across their different units of measure."
          footer="Counted in pallets, not quantity, because the three groups use different units."
        >
          <MaterialChart rows={stock} drill={drill} />
        </ChartCard>
      </PanelGrid>

      <PanelGrid>
        <ChartCard
          title={`Availability analysis (${activeUnit})`}
          hint="Available versus reserved quantity in each section."
          height={260}
          footer="Reserved plus available equals on hand. Reservations never reduce on-hand quantity."
        >
          <AvailabilityChart rows={inUnit} unit={activeUnit} drill={drill} />
        </ChartCard>

        <ChartCard
          title={`Product quantity analysis (${activeUnit})`}
          hint="The twelve largest products by on-hand quantity in the selected unit."
          height={260}
          footer="Select a bar to open that product's stock breakdown."
        >
          <ProductChart rows={inUnit} unit={activeUnit} drill={drill} />
        </ChartCard>
      </PanelGrid>

      <PanelGrid>
        <ChartCard
          title="Stock aging"
          hint="Age measured from the original receipt date; relocation never resets it."
          height={240}
          footer="Select a bucket to open the stock lines in that age band."
        >
          <AgingChart rows={stock} unit={activeUnit} drill={drill} />
        </ChartCard>

        <ChartCard
          title="Receipt, dispatch and internal transfer trend"
          hint="Completed movement lines per week."
          height={240}
          footer={SCOPE_NOTES.movementPeriod}
        >
          <TrendChart rows={rows.movements} drill={drill} />
        </ChartCard>
      </PanelGrid>

      <LinkedRecords stock={stock} activeUnit={activeUnit} />
    </>
  );
}

// ------------------------------------------------------------------ panels

function UnitPanel({
  units,
  stock,
  activeUnit,
  onSelect,
}: {
  units: { unit: string; total: number }[];
  stock: StockRow[];
  activeUnit: string;
  onSelect: (unit: string) => void;
}) {
  return (
    <section className="o-card p-3">
      <div className="flex items-baseline justify-between gap-3 mb-2 flex-wrap">
        <h3 className="text-[var(--o-fs-sm)] font-medium text-[var(--o-gray-700)] m-0">
          On hand, reserved and available by unit of measure
        </h3>
        <span className="text-[var(--o-fs-xxs)] text-[var(--o-text-subtle)]">
          {SCOPE_NOTES.units}
        </span>
      </div>
      <table className="o-list">
        <thead>
          <tr>
            <th>Unit of measure</th>
            <th style={{ textAlign: "right" }}>On hand</th>
            <th style={{ textAlign: "right" }}>Reserved</th>
            <th style={{ textAlign: "right" }}>Available to pick</th>
            <th style={{ textAlign: "right" }}>Stock lines</th>
            <th style={{ textAlign: "right" }}>Pallets</th>
            <th style={{ width: 130 }} />
          </tr>
        </thead>
        <tbody>
          {units.map(({ unit }) => {
            const inUnit = stock.filter((r) => r.uom === unit);
            return (
              <tr key={unit} data-selected={unit === activeUnit ? "true" : undefined}>
                <td className="font-medium">{unit}</td>
                <td className="num">{formatNumber(sumIn(stock, "quantity", unit), 2)}</td>
                <td className="num">
                  {formatNumber(sumIn(stock, "reservedQuantity", unit), 2)}
                </td>
                <td className="num">
                  {formatNumber(sumIn(stock, "availableQuantity", unit), 2)}
                </td>
                <td className="num">{formatInt(inUnit.length)}</td>
                <td className="num">{formatInt(distinct(inUnit, "palletId"))}</td>
                <td>
                  <div className="flex gap-1 justify-end">
                    <button
                      type="button"
                      className="o-btn o-btn-secondary o-btn-sm"
                      onClick={() => onSelect(unit)}
                      aria-pressed={unit === activeUnit}
                    >
                      {unit === activeUnit ? "Charted" : "Chart this"}
                    </button>
                    <Link
                      className="o-btn o-btn-secondary o-btn-sm"
                      to={listUrl("stock", [
                        contextFacet("Unit", [unit], cond("uom", "eq", unit)),
                      ])}
                    >
                      Open
                    </Link>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function WarehouseChart({
  rows,
  unit,
  drill,
}: {
  rows: StockRow[];
  unit: string;
  drill: DrilldownFn;
}) {
  const data = useMemo(() => {
    const byWarehouse = new Map<
      string,
      { label: string; RM: number; FG: number; PM: number }
    >();
    for (const row of rows) {
      const key = row.sectionCode || "-";
      const entry =
        byWarehouse.get(key) ?? { label: key, RM: 0, FG: 0, PM: 0 };
      entry[row.materialGroup] += row.quantity;
      byWarehouse.set(key, entry);
    }
    return Array.from(byWarehouse.values()).map((e) => ({
      ...e,
      RM: Math.round(e.RM),
      FG: Math.round(e.FG),
      PM: Math.round(e.PM),
    }));
  }, [rows]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="label" {...AXIS_PROPS} />
        <YAxis {...AXIS_PROPS} width={72} tickFormatter={(v: number) => formatNumber(v, 0)} />
        <Tooltip content={<ChartTooltip unit={unit} />} cursor={{ fill: "var(--o-hover-bg)" }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {(["RM", "FG", "PM"] as const).map((group) => (
          <Bar
            maxBarSize={64}
            key={group}
            dataKey={group}
            name={MATERIAL_LABEL[group]}
            stackId="a"
            fill={MATERIAL_COLORS[group]}
            radius={group === "PM" ? [3, 3, 0, 0] : undefined}
            style={CLICKABLE}
            onClick={(arg: unknown) => {
              const datum = payloadOf<{ label: string }>(arg);
              if (!datum) return;
              drill({
                model: "stock",
                facets: [
                  contextFacet(
                    "Section",
                    [datum.label],
                    cond("sectionCode", "eq", datum.label),
                  ),
                  contextFacet(
                    "Material Group",
                    [MATERIAL_LABEL[group]],
                    cond("materialGroup", "eq", group),
                  ),
                ],
              });
            }}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

function MaterialChart({ rows, drill }: { rows: StockRow[]; drill: DrilldownFn }) {
  const data = useMemo(
    () =>
      tally(rows, "materialGroup", (list) => {
        const pallets = new Set<string>();
        for (const row of list) if (row.palletId) pallets.add(row.palletId);
        return pallets.size;
      }).map((entry) => ({ ...entry, label: MATERIAL_LABEL[entry.key] ?? entry.key })),
    [rows],
  );

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Tooltip content={<ChartTooltip unit="pallets" />} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          innerRadius={52}
          outerRadius={92}
          style={CLICKABLE}
          onClick={(arg: unknown) => {
            const datum = payloadOf<{ key: string; label: string }>(arg);
            if (!datum) return;
            drill({
              model: "pallet",
              facets: [
                contextFacet(
                  "Material Group",
                  [datum.label],
                  cond("materialGroup", "eq", datum.key),
                ),
              ],
            });
          }}
        >
          {data.map((entry) => (
            <Cell
              key={entry.key}
              fill={MATERIAL_COLORS[entry.key as keyof typeof MATERIAL_COLORS] ?? seriesColor(0)}
            />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}

function AvailabilityChart({
  rows,
  unit,
  drill,
}: {
  rows: StockRow[];
  unit: string;
  drill: DrilldownFn;
}) {
  const data = useMemo(() => {
    const byWarehouse = new Map<string, { label: string; available: number; reserved: number }>();
    for (const row of rows) {
      const key = row.sectionCode || "-";
      const entry = byWarehouse.get(key) ?? { label: key, available: 0, reserved: 0 };
      entry.available += row.availableQuantity;
      entry.reserved += row.reservedQuantity;
      byWarehouse.set(key, entry);
    }
    return Array.from(byWarehouse.values()).map((e) => ({
      label: e.label,
      available: Math.round(e.available),
      reserved: Math.round(e.reserved),
    }));
  }, [rows]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="label" {...AXIS_PROPS} />
        <YAxis {...AXIS_PROPS} width={72} tickFormatter={(v: number) => formatNumber(v, 0)} />
        <Tooltip content={<ChartTooltip unit={unit} />} cursor={{ fill: "var(--o-hover-bg)" }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {AVAILABILITY_SERIES.map((series) => (
          <Bar
            maxBarSize={64}
            key={series.key}
            dataKey={series.key}
            name={series.name}
            stackId="a"
            fill={series.fill}
            radius={series.key === "reserved" ? [3, 3, 0, 0] : undefined}
            style={CLICKABLE}
            onClick={(arg: unknown) => {
              const datum = payloadOf<{ label: string }>(arg);
              if (!datum) return;
              drill({
                model: "stock",
                facets: [
                  contextFacet(
                    "Section",
                    [datum.label],
                    cond("sectionCode", "eq", datum.label),
                  ),
                  contextFacet(series.name, ["> 0"], cond(series.field, "gt", 0)),
                ],
              });
            }}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

function ProductChart({
  rows,
  unit,
  drill,
}: {
  rows: StockRow[];
  unit: string;
  drill: DrilldownFn;
}) {
  const data = useMemo(
    () =>
      tally(
        rows,
        "productName",
        (list) => Math.round(list.reduce((s, r) => s + r.quantity, 0)),
        12,
      ),
    [rows],
  );

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
      >
        <CartesianGrid {...GRID_PROPS} horizontal={false} vertical />
        <XAxis type="number" {...AXIS_PROPS} tickFormatter={(v: number) => formatNumber(v, 0)} />
        <YAxis
          type="category"
          dataKey="label"
          {...AXIS_PROPS}
          width={190}
          interval={0}
          tick={{ fontSize: 10, fill: "var(--o-gray-600)" }}
          tickFormatter={(v: string) => shortLabel(v, 26)}
        />
        <Tooltip content={<ChartTooltip unit={unit} />} cursor={{ fill: "var(--o-hover-bg)" }} />
        <Bar
          maxBarSize={64}
          dataKey="value"
          name="On hand"
          radius={[0, 3, 3, 0]}
          style={CLICKABLE}
          onClick={(arg: unknown) => {
            const datum = payloadOf<{ label: string }>(arg);
            if (!datum) return;
            drill({
              model: "stock",
              facets: [
                contextFacet(
                  "Product",
                  [datum.label],
                  cond("productName", "eq", datum.label),
                ),
              ],
            });
          }}
        >
          {data.map((entry, i) => (
            <Cell key={entry.key} fill={seriesColor(i)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function AgingChart({
  rows,
  unit,
  drill,
}: {
  rows: StockRow[];
  unit: string;
  drill: DrilldownFn;
}) {
  const data = useMemo(
    () =>
      AGE_BUCKETS.map((bucket) => {
        const list = rows.filter((r) => r.ageBucket === bucket.id);
        return {
          key: bucket.id,
          label: bucket.label,
          lines: list.length,
          quantity: Math.round(
            list.filter((r) => r.uom === unit).reduce((s, r) => s + r.quantity, 0),
          ),
        };
      }),
    [rows, unit],
  );

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="label" {...AXIS_PROPS} />
        <YAxis
          {...AXIS_PROPS}
          width={72}
          tickFormatter={(v: number) => formatNumber(v, 0)}
        />
        {/* One series only: stock-line counts and kilogram totals differ by
            three orders of magnitude, so plotting both on one axis makes the
            smaller series invisible. The line count is in the tooltip. */}
        <Tooltip
          content={
            <ChartTooltip
              valueFormatter={(value, entry) => {
                const payload = entry.payload as { lines: number } | undefined;
                return `${formatNumber(value, 0)} ${unit}${
                  payload ? ` · ${payload.lines} stock lines` : ""
                }`;
              }}
            />
          }
          cursor={{ fill: "var(--o-hover-bg)" }}
        />
        <Bar
          maxBarSize={64}
          dataKey="quantity"
          name={QUANTITY_LABEL(unit)}
          fill="var(--o-series-1)"
          radius={[3, 3, 0, 0]}
          style={CLICKABLE}
          onClick={(arg: unknown) => {
            const datum = payloadOf<{ key: string; label: string }>(arg);
            if (!datum) return;
            drill({
              model: "stock",
              facets: [
                contextFacet(
                  "Stock Age",
                  [datum.label],
                  cond("ageBucket", "eq", datum.key),
                ),
              ],
            });
          }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

function TrendChart({ rows, drill }: { rows: MovementRow[]; drill: DrilldownFn }) {
  const data = useMemo(() => {
    const done = rows.filter((r) => r.state === "done" && r.doneAt);
    const byWeek = new Map<
      string,
      { label: string; key: string; receipts: number; dispatch: number; internal: number }
    >();
    for (const row of done) {
      const { key, label } = groupKeyFor(row, {
        field: "movementDate",
        granularity: "week",
        token: "movementDate:week",
      });
      const entry =
        byWeek.get(key) ?? { key, label, receipts: 0, dispatch: 0, internal: 0 };
      if (row.kind === "receipt") entry.receipts += 1;
      else if (row.kind === "delivery" || row.kind === "pick") entry.dispatch += 1;
      else entry.internal += 1;
      byWeek.set(key, entry);
    }
    return Array.from(byWeek.values())
      .sort((a, b) => a.key.localeCompare(b.key))
      .slice(-16);
  }, [rows]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={data}
        margin={{ top: 4, right: 8, bottom: 4, left: 0 }}
        style={CLICKABLE}
        onClick={(arg: unknown) => {
          const datum = payloadOf<{ key: string; label: string }>(arg);
          if (!datum) return;
          drill({
            model: "movement",
            facets: [
              contextFacet(
                "Movement Week",
                [datum.label],
                weekDomain(datum.key),
              ),
            ],
          });
        }}
      >
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="label" {...AXIS_PROPS} interval="preserveStartEnd" />
        <YAxis {...AXIS_PROPS} width={48} allowDecimals={false} />
        <Tooltip content={<ChartTooltip />} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line
          type="monotone"
          dataKey="receipts"
          name="Receipt lines"
          stroke="var(--o-series-2)"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="dispatch"
          name="Pick and delivery lines"
          stroke="var(--o-series-3)"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="internal"
          name="Internal transfer lines"
          stroke="var(--o-series-4)"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/**
 * Ways out of the dashboard.
 *
 * This deliberately holds no records. A dashboard that prints its own table of
 * stock lines is just a worse list view: it cannot be sorted, grouped, paged or
 * exported, and it invites people to read eight rows and assume they have seen
 * the data. Every figure and every chart segment on this page already opens the
 * real list; these are the shortcuts that do not correspond to a single visual.
 */
function LinkedRecords({
  stock,
  activeUnit,
}: {
  stock: StockRow[];
  activeUnit: string;
}) {
  const lines = stock.filter((row) => row.uom === activeUnit).length;

  return (
    <section className="o-card p-3">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h3 className="o-section-heading text-[var(--o-fs-lg)]">
            Open the records
          </h3>
          <p className="mt-0.5 mb-0 text-[var(--o-fs-xs)] text-[var(--o-text-muted)]">
            Select any figure or chart segment above to open exactly the records
            behind it. These shortcuts cover the scopes that do not have a
            visual of their own.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link
            className="o-btn o-btn-primary o-btn-sm"
            to={listUrl("stock", [
              contextFacet("Unit", [activeUnit], cond("uom", "eq", activeUnit)),
            ])}
          >
            All {formatInt(lines)} stock lines in {activeUnit}
          </Link>
          <Link
            className="o-btn o-btn-secondary o-btn-sm"
            to={listUrl("stock", [
              contextFacet(
                "Availability",
                ["Reserved or unavailable"],
                or(
                  cond("reservedQuantity", "gt", 0),
                  cond("availableQuantity", "lte", 0),
                ),
              ),
            ])}
          >
            Reserved or unavailable
          </Link>
          <Link
            className="o-btn o-btn-secondary o-btn-sm"
            to={listUrl("stock", [thresholdFacet("stock", "ageDays", "gt", 180)])}
          >
            Older than 180 days
          </Link>
          <Link className="o-btn o-btn-secondary o-btn-sm" to="/pallets">
            Pallets
          </Link>
          <Link className="o-btn o-btn-secondary o-btn-sm" to="/lots">
            Lots
          </Link>
          <Link className="o-btn o-btn-secondary o-btn-sm" to="/movements">
            Movements
          </Link>
        </div>
      </div>
    </section>
  );
}

export { toDateKey };
