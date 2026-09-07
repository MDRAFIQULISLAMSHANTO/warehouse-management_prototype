/**
 * Inventory by Product Dashboard.
 *
 * Picks one product (optionally one variant) and answers the questions a
 * planner asks about it: how much is there, how much can actually be picked,
 * which lots and pallets hold it, where it sits, how old it is and how it has
 * been moving.
 */

import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell as ReCell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { contextFacet, listUrl } from "@/app/links";
import { AGE_BUCKETS } from "@/data/clock";
import type { MovementRow, StockRow } from "@/data/derive";
import { useUrlParam } from "@/hooks/useSearchState";
import { SearchableSelect } from "@/odoo/CustomFilter";
import { AXIS_PROPS, ChartCard, ChartTooltip, GRID_PROPS, seriesColor } from "@/odoo/charts";
import { formatInt, formatNumber, formatQty } from "@/odoo/format";
import { EmptyState } from "@/odoo/primitives";
import { cond } from "@/query/domain";
import { groupKeyFor } from "@/query/group";
import { useDerived } from "@/store/appStore";
import { DashboardFrame, KpiRow, PanelGrid } from "./DashboardFrame";
import { Kpi } from "./Kpi";
import { RecordsPanel } from "./RecordsPanel";
import { distinct, useScopedRows } from "./useScoped";
import { CLICKABLE, payloadOf, useDrilldown, type DrilldownFn } from "./useDrilldown";
import type { Facet } from "@/query/search";

export function InventoryByProductDashboard() {
  return (
    <DashboardFrame
      title="Inventory by Product"
      modelName="stock"
      description="Everything held for one product: quantities, lots, pallets, locations, age and movement history."
    >
      {({ scope, state }) => (
        <ProductBody scope={scope} carry={state.facets} />
      )}
    </DashboardFrame>
  );
}

function ProductBody({
  scope,
  carry,
}: {
  scope: ReturnType<typeof import("./scope").buildScope>;
  carry: Facet[];
}) {
  const derived = useDerived();
  const rows = useScopedRows(scope);
  const drill = useDrilldown(carry);
  const [productId, setProductId] = useUrlParam("product");
  const [variantId, setVariantId] = useUrlParam("variant");

  const products = derived.products;
  const activeProductId = productId || products.find((p) => p.onHand > 0)?.id || products[0]?.id || "";
  const product = products.find((p) => p.id === activeProductId);

  const variants = useMemo(
    () =>
      Array.from(derived.index.variantById.values()).filter(
        (v) => v.productId === activeProductId,
      ),
    [derived, activeProductId],
  );

  const stock = useMemo(() => {
    let list = rows.stock.filter((r) => r.productId === activeProductId);
    if (variantId) list = list.filter((r) => r.variantId === variantId);
    return list;
  }, [rows.stock, activeProductId, variantId]);

  const movements = useMemo(
    () => rows.movements.filter((m) => m.productId === activeProductId),
    [rows.movements, activeProductId],
  );

  if (!product) {
    return <EmptyState title="No product in scope" />;
  }

  const onHand = stock.reduce((s, r) => s + r.quantity, 0);
  const reserved = stock.reduce((s, r) => s + r.reservedQuantity, 0);
  const available = stock.reduce((s, r) => s + r.availableQuantity, 0);
  const unit = product.uom;

  const productFacet = contextFacet(
    "Product",
    [product.name],
    cond("productId", "eq", product.id),
  );
  const variantFacet = variantId
    ? [contextFacet("Variant", [derived.index.variantById.get(variantId)?.name ?? ""], cond("variantId", "eq", variantId))]
    : [];

  return (
    <>
      <section className="o-card p-3 flex items-center gap-3 flex-wrap">
        <span className="text-[var(--o-fs-sm)] font-medium text-[var(--o-gray-700)]">
          Product
        </span>
        <SearchableSelect
          options={products.map((p) => ({ value: p.id, label: `${p.code} - ${p.name}` }))}
          value={activeProductId}
          onChange={(value) => {
            setProductId(value);
            setVariantId(null);
          }}
          width={340}
        />
        <span className="text-[var(--o-fs-sm)] font-medium text-[var(--o-gray-700)] ml-2">
          Variant
        </span>
        <select
          className="o-input"
          style={{ width: 300 }}
          value={variantId}
          onChange={(e) => setVariantId(e.target.value || null)}
          aria-label="Variant"
        >
          <option value="">All variants ({variants.length})</option>
          {variants.map((variant) => (
            <option key={variant.id} value={variant.id}>
              {variant.name}
            </option>
          ))}
        </select>
        <span className="ml-auto flex gap-2">
          <Link className="o-btn o-btn-secondary o-btn-sm" to={`/products/${product.id}`}>
            Open product record
          </Link>
        </span>
      </section>

      <KpiRow>
        <Kpi
          label={`On hand (${unit})`}
          value={formatNumber(onHand, 2)}
          sub={`${product.code} · ${product.categoryName}`}
          to={listUrl("stock", [productFacet, ...variantFacet])}
        />
        <Kpi
          label={`Reserved (${unit})`}
          value={formatNumber(reserved, 2)}
          tone="warn"
          sub="Committed to open operations"
          to={listUrl("stock", [
            productFacet,
            contextFacet("Reserved", ["> 0"], cond("reservedQuantity", "gt", 0)),
          ])}
        />
        <Kpi
          label={`Available (${unit})`}
          value={formatNumber(available, 2)}
          tone="ok"
          bar={onHand ? (available / onHand) * 100 : 0}
          sub={`${formatNumber(onHand ? (available / onHand) * 100 : 0, 1)}% of on hand`}
          to={listUrl("stock", [
            productFacet,
            contextFacet("Available", ["> 0"], cond("availableQuantity", "gt", 0)),
          ])}
        />
        <Kpi
          label="Lots"
          value={formatInt(distinct(stock, "lotId"))}
          tone="action"
          sub="Distinct lots holding this product"
          to={listUrl("lot", [
            contextFacet("Product", [product.name], cond("productId", "eq", product.id)),
          ])}
        />
        <Kpi
          label="Pallets"
          value={formatInt(distinct(stock, "palletId"))}
          tone="action"
          sub="Distinct pallets"
          to={listUrl("pallet", [
            contextFacet("Product", [product.name], cond("productId", "eq", product.id)),
          ])}
        />
        <Kpi
          label="Positions used"
          value={formatInt(distinct(stock, "locationId"))}
          sub={`Pallet capacity basis: ${formatQty(product.capacityQty, unit)}`}
        />
      </KpiRow>

      <PanelGrid>
        <ChartCard
          title={`Section distribution (${unit})`}
          hint="Which section of the building holds this product."
          height={230}
        >
          <DistributionChart stock={stock} field="sectionCode" unit={unit} drill={drill} />
        </ChartCard>
        <ChartCard
          title={`Location distribution (${unit})`}
          hint="Aisle-level spread inside the warehouses."
          height={230}
        >
          <DistributionChart stock={stock} field="aisleCode" unit={unit} limit={12} drill={drill} />
        </ChartCard>
      </PanelGrid>

      <PanelGrid>
        <ChartCard
          title={`Lot distribution (${unit})`}
          hint="Quantity held by each lot, oldest first."
          height={250}
          footer="Select a bar to open the stock lines for that lot."
        >
          <LotChart stock={stock} unit={unit} drill={drill} />
        </ChartCard>
        <ChartCard
          title="Stock aging"
          hint="Age measured from the original receipt date."
          height={250}
        >
          <AgingChart stock={stock} unit={unit} drill={drill} />
        </ChartCard>
      </PanelGrid>

      <ChartCard
        title="Movement trend"
        hint="Completed movement lines for this product, by week."
        height={220}
        footer="Movement filters affect this chart only; the stock figures above always show the current position."
      >
        <MovementChart movements={movements} />
      </ChartCard>

      <PalletTable stock={stock} />
    </>
  );
}

function DistributionChart({
  drill,
  stock,
  field,
  unit,
  limit,
}: {
  stock: StockRow[];
  field: "sectionCode" | "aisleCode";
  unit: string;
  limit?: number;
  drill: DrilldownFn;
}) {
  const data = useMemo(() => {
    const totals = new Map<string, number>();
    for (const row of stock) {
      // Stock waiting in an input or staging area has no aisle; name it rather
      // than leaving an unexplained blank bucket on the axis.
      const raw = row[field];
      const key =
        raw === undefined || raw === null || raw === ""
          ? "Not in racking"
          : String(raw);
      totals.set(key, (totals.get(key) ?? 0) + row.quantity);
    }
    const list = Array.from(totals.entries())
      .map(([label, value]) => ({ label, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value);
    return limit ? list.slice(0, limit) : list;
  }, [stock, field, limit]);

  if (!data.length) return <EmptyState title="No stock in scope" />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="label" {...AXIS_PROPS} />
        <YAxis {...AXIS_PROPS} width={72} tickFormatter={(v: number) => formatNumber(v, 0)} />
        <Tooltip content={<ChartTooltip unit={unit} />} cursor={{ fill: "var(--o-hover-bg)" }} />
        <Bar
          maxBarSize={64}
          dataKey="value"
          name={`Quantity (${unit})`}
          radius={[3, 3, 0, 0]}
          style={CLICKABLE}
          onClick={(arg: unknown) => {
            const datum = payloadOf<{ label: string }>(arg);
            if (!datum) return;
            drill({
              model: "stock",
              facets: [
                contextFacet(
                  field === "aisleCode" ? "Aisle" : "Section",
                  [datum.label],
                  cond(field, "eq", datum.label),
                ),
              ],
            });
          }}
        >
          {data.map((entry, i) => (
            <ReCell key={entry.label} fill={seriesColor(i)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function LotChart({
  stock,
  unit,
  drill,
}: {
  stock: StockRow[];
  unit: string;
  drill: DrilldownFn;
}) {
  const data = useMemo(() => {
    const totals = new Map<string, { label: string; id: string; value: number; inDate: string }>();
    for (const row of stock) {
      if (!row.lotId) continue;
      const entry =
        totals.get(row.lotId) ?? {
          id: row.lotId,
          label: row.lotName ?? row.lotId,
          value: 0,
          inDate: row.inDate,
        };
      entry.value += row.quantity;
      if (row.inDate < entry.inDate) entry.inDate = row.inDate;
      totals.set(row.lotId, entry);
    }
    return Array.from(totals.values())
      .sort((a, b) => a.inDate.localeCompare(b.inDate))
      .slice(0, 14)
      .map((entry) => ({ ...entry, value: Math.round(entry.value * 100) / 100 }));
  }, [stock]);

  if (!data.length) return <EmptyState title="No lots in scope" />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 40, left: 0 }}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis
          dataKey="label"
          {...AXIS_PROPS}
          angle={-35}
          textAnchor="end"
          height={56}
          interval={0}
        />
        <YAxis {...AXIS_PROPS} width={72} tickFormatter={(v: number) => formatNumber(v, 0)} />
        <Tooltip content={<ChartTooltip unit={unit} />} cursor={{ fill: "var(--o-hover-bg)" }} />
        <Bar
          maxBarSize={64}
          dataKey="value"
          name={`Quantity (${unit})`}
          radius={[3, 3, 0, 0]}
          style={CLICKABLE}
          onClick={(arg: unknown) => {
            const datum = payloadOf<{ label: string }>(arg);
            if (!datum) return;
            drill({
              model: "stock",
              facets: [
                contextFacet("Lot", [datum.label], cond("lotName", "eq", datum.label)),
              ],
            });
          }}
        >
          {data.map((entry, i) => (
            <ReCell key={entry.id} fill={seriesColor(i)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function AgingChart({
  stock,
  unit,
  drill,
}: {
  stock: StockRow[];
  unit: string;
  drill: DrilldownFn;
}) {
  const data = AGE_BUCKETS.map((bucket) => {
    const list = stock.filter((r) => r.ageBucket === bucket.id);
    return {
      label: bucket.label,
      value: Math.round(list.reduce((s, r) => s + r.quantity, 0) * 100) / 100,
      lines: list.length,
    };
  });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="label" {...AXIS_PROPS} />
        <YAxis {...AXIS_PROPS} width={72} tickFormatter={(v: number) => formatNumber(v, 0)} />
        <Tooltip content={<ChartTooltip unit={unit} />} cursor={{ fill: "var(--o-hover-bg)" }} />
        <Bar
          maxBarSize={64}
          dataKey="value"
          name={`Quantity (${unit})`}
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

function MovementChart({ movements }: { movements: MovementRow[] }) {
  const data = useMemo(() => {
    const done = movements.filter((m) => m.state === "done");
    const byWeek = new Map<string, { key: string; label: string; in: number; out: number }>();
    for (const row of done) {
      const { key, label } = groupKeyFor(row, {
        field: "movementDate",
        granularity: "week",
        token: "movementDate:week",
      });
      const entry = byWeek.get(key) ?? { key, label, in: 0, out: 0 };
      if (row.kind === "receipt" || row.kind === "putaway") entry.in += row.doneQty;
      else entry.out += row.doneQty;
      byWeek.set(key, entry);
    }
    return Array.from(byWeek.values())
      .sort((a, b) => a.key.localeCompare(b.key))
      .slice(-16);
  }, [movements]);

  if (!data.length) return <EmptyState title="No completed movements for this product" />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="label" {...AXIS_PROPS} interval="preserveStartEnd" />
        <YAxis {...AXIS_PROPS} width={64} tickFormatter={(v: number) => formatNumber(v, 0)} />
        <Tooltip content={<ChartTooltip />} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line type="monotone" dataKey="in" name="Inbound" stroke="var(--o-series-2)" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="out" name="Outbound and internal" stroke="var(--o-series-3)" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function PalletTable({ stock }: { stock: StockRow[] }) {
  const pallets = new Set(stock.map((row) => row.palletId).filter(Boolean));
  return (
    <RecordsPanel
      label="stock lines holding this product"
      count={stock.length}
      model="stock"
      facets={[]}
      note={`Held on ${pallets.size} distinct pallets. The list shows position, lot, quantity, reservation, fill and age for each one.`}
    />
  );
}

