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
import { AGE_BUCKETS, formatDate } from "@/data/clock";
import type { MovementRow, StockRow } from "@/data/derive";
import { useUrlParam } from "@/hooks/useSearchState";
import { SearchableSelect } from "@/odoo/CustomFilter";
import { AXIS_PROPS, ChartCard, ChartTooltip, GRID_PROPS, seriesColor } from "@/odoo/charts";
import { FillBar, formatInt, formatNumber, formatQty } from "@/odoo/format";
import { EmptyState } from "@/odoo/primitives";
import { cond } from "@/query/domain";
import { groupKeyFor } from "@/query/group";
import { useDerived } from "@/store/appStore";
import { DashboardFrame, KpiRow, PanelGrid } from "./DashboardFrame";
import { Kpi } from "./Kpi";
import { distinct, useScopedRows } from "./useScoped";

export function InventoryByProductDashboard() {
  return (
    <DashboardFrame
      title="Inventory by Product"
      modelName="stock"
      description="Everything held for one product: quantities, lots, pallets, locations, age and movement history."
    >
      {({ scope }) => <ProductBody scope={scope} />}
    </DashboardFrame>
  );
}

function ProductBody({
  scope,
}: {
  scope: ReturnType<typeof import("./scope").buildScope>;
}) {
  const derived = useDerived();
  const rows = useScopedRows(scope);
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
          title={`Warehouse distribution (${unit})`}
          hint="Where this product is stored."
          height={230}
        >
          <DistributionChart stock={stock} field="warehouseCode" unit={unit} />
        </ChartCard>
        <ChartCard
          title={`Location distribution (${unit})`}
          hint="Aisle-level spread inside the warehouses."
          height={230}
        >
          <DistributionChart stock={stock} field="aisleCode" unit={unit} limit={12} />
        </ChartCard>
      </PanelGrid>

      <PanelGrid>
        <ChartCard
          title={`Lot distribution (${unit})`}
          hint="Quantity held by each lot, oldest first."
          height={250}
          footer="Select a bar to open that lot."
        >
          <LotChart stock={stock} unit={unit} />
        </ChartCard>
        <ChartCard
          title="Stock aging"
          hint="Age measured from the original receipt date."
          height={250}
        >
          <AgingChart stock={stock} unit={unit} />
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
  stock,
  field,
  unit,
  limit,
}: {
  stock: StockRow[];
  field: "warehouseCode" | "aisleCode";
  unit: string;
  limit?: number;
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
        <Bar maxBarSize={64} dataKey="value" name={`Quantity (${unit})`} radius={[3, 3, 0, 0]}>
          {data.map((entry, i) => (
            <ReCell key={entry.label} fill={seriesColor(i)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function LotChart({ stock, unit }: { stock: StockRow[]; unit: string }) {
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
        <Bar maxBarSize={64} dataKey="value" name={`Quantity (${unit})`} radius={[3, 3, 0, 0]}>
          {data.map((entry, i) => (
            <ReCell key={entry.id} fill={seriesColor(i)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function AgingChart({ stock, unit }: { stock: StockRow[]; unit: string }) {
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
        <Bar maxBarSize={64} dataKey="value" name={`Quantity (${unit})`} fill="var(--o-series-1)" radius={[3, 3, 0, 0]} />
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
  const shown = useMemo(
    () => stock.slice().sort((a, b) => a.inDate.localeCompare(b.inDate)).slice(0, 20),
    [stock],
  );

  return (
    <section className="o-card p-3">
      <h3 className="o-section-heading text-[var(--o-fs-lg)] mb-2">
        Pallets and positions holding this product (oldest first)
      </h3>
      {shown.length === 0 ? (
        <EmptyState title="No stock for this product in the current filters" />
      ) : (
        <table className="o-list">
          <thead>
            <tr>
              <th>Pallet</th>
              <th>Lot</th>
              <th>Position</th>
              <th style={{ textAlign: "right" }}>On hand</th>
              <th style={{ textAlign: "right" }}>Available</th>
              <th style={{ width: 140 }}>Pallet fill</th>
              <th>Received</th>
              <th style={{ textAlign: "right" }}>Age</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr key={row.id}>
                <td>
                  {row.palletId ? (
                    <Link to={`/pallets/${row.palletId}`}>{row.palletName}</Link>
                  ) : (
                    "-"
                  )}
                </td>
                <td>{row.lotId ? <Link to={`/lots/${row.lotId}`}>{row.lotName}</Link> : "-"}</td>
                <td className="o-truncate">{row.completeName}</td>
                <td className="num">{formatQty(row.quantity, row.uom)}</td>
                <td className="num">{formatQty(row.availableQuantity, row.uom)}</td>
                <td>
                  <FillBar value={row.fillPct} width={80} />
                </td>
                <td>{formatDate(row.inDate)}</td>
                <td className="num">{formatInt(row.ageDays)} d</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
