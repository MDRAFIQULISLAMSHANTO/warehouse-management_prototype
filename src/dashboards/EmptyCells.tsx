/**
 * Empty Cell Dashboard.
 *
 * "Empty" is not one thing, and treating it as one thing is how warehouses end
 * up with put-aways that cannot be completed. This dashboard separates:
 *   - physically empty        - no pallet present
 *   - available for put-away  - empty, unblocked, not already claimed
 *   - reserved for incoming   - empty but committed to a pending operation
 *   - empty and blocked       - unusable for structural or safety reasons
 */

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { contextFacet, listUrl } from "@/app/links";
import type { CellRow } from "@/data/derive";
import { useUrlParam } from "@/hooks/useSearchState";
import { FloorPlan } from "@/map/FloorPlan";
import { ElevationLegend, RackElevation } from "@/map/RackElevation";
import { AXIS_PROPS, ChartCard, ChartTooltip, GRID_PROPS } from "@/odoo/charts";
import { formatInt, formatQty } from "@/odoo/format";
import { Badge, EmptyState } from "@/odoo/primitives";
import { cond } from "@/query/domain";
import { suggestCellsForProduct } from "@/store/apply";
import { useAppStore, useDerived } from "@/store/appStore";
import { DashboardFrame, KpiRow, PanelGrid } from "./DashboardFrame";
import { Kpi } from "./Kpi";
import { useScopedRows } from "./useScoped";

type Category = "empty" | "available" | "reserved" | "blocked";

const CATEGORY_LABEL: Record<Category, string> = {
  empty: "Physically empty",
  available: "Available for put-away",
  reserved: "Reserved for incoming stock",
  blocked: "Empty and blocked",
};

const CATEGORY_DOMAIN = {
  empty: cond("occupied", "eq", false),
  available: cond("availableForPutaway", "eq", true),
  reserved: cond("status", "eq", "reserved_incoming"),
  blocked: cond("status", "eq", "blocked"),
} as const;

export function EmptyCellDashboard() {
  return (
    <DashboardFrame
      title="Empty Cells"
      modelName="cell"
      description="Where there is room to put stock away, and where there only appears to be. Choose a category to highlight it on the map and list the exact positions."
    >
      {({ scope }) => <EmptyCellBody scope={scope} />}
    </DashboardFrame>
  );
}

function EmptyCellBody({
  scope,
}: {
  scope: ReturnType<typeof import("./scope").buildScope>;
}) {
  const rows = useScopedRows(scope);
  const cells = rows.cells;
  const [category, setCategory] = useUrlParam("cat", "available");
  const active = (category as Category) || "available";
  const [warehouseId, setWarehouseId] = useUrlParam("wh");
  const [rackId, setRackId] = useUrlParam("rack");

  const buckets = useMemo(
    () => ({
      empty: cells.filter((c) => !c.occupied),
      available: cells.filter((c) => c.availableForPutaway),
      reserved: cells.filter((c) => c.reservedIncoming),
      blocked: cells.filter((c) => c.blocked && !c.occupied),
    }),
    [cells],
  );

  const selected = buckets[active];
  const warehouses = rows.warehouses;
  const activeWarehouseId = warehouseId || warehouses[0]?.id || "";
  const warehouse = warehouses.find((w) => w.id === activeWarehouseId);
  const warehouseRacks = rows.racks.filter((r) => r.warehouseId === activeWarehouseId);
  const rack = warehouseRacks.find((r) => r.id === rackId);

  const highlightRacks = useMemo(
    () => new Set(selected.map((c) => c.rackId)),
    [selected],
  );
  const highlightCells = useMemo(
    () => new Set(selected.map((c) => c.id)),
    [selected],
  );

  const cellLink = (cat: Category) =>
    listUrl("cell", [
      contextFacet("Category", [CATEGORY_LABEL[cat]], CATEGORY_DOMAIN[cat]),
    ]);

  return (
    <>
      <KpiRow>
        <Kpi
          label="Physically empty"
          value={formatInt(buckets.empty.length)}
          sub="No pallet in the position"
          to={cellLink("empty")}
        />
        <Kpi
          label="Available for put-away"
          value={formatInt(buckets.available.length)}
          tone="ok"
          sub="Empty, unblocked and unreserved"
          to={cellLink("available")}
          hint="This is the number an operator can actually use right now."
        />
        <Kpi
          label="Reserved for incoming"
          value={formatInt(buckets.reserved.length)}
          tone="action"
          sub="Committed to a pending put-away or transfer"
          to={cellLink("reserved")}
        />
        <Kpi
          label="Empty and blocked"
          value={formatInt(buckets.blocked.length)}
          tone="bad"
          sub="Structural, safety or maintenance restriction"
          to={cellLink("blocked")}
        />
        <Kpi
          label="Installed positions"
          value={formatInt(cells.length)}
          sub="In the current filter scope"
          to={listUrl("cell", [])}
        />
        <Kpi
          label="Usable free space"
          value={`${formatInt(
            cells.length ? Math.round((buckets.available.length / cells.length) * 100) : 0,
          )}%`}
          sub="Available positions as a share of installed"
          bar={cells.length ? (buckets.available.length / cells.length) * 100 : 0}
        />
      </KpiRow>

      <section className="o-card p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[var(--o-fs-sm)] font-medium text-[var(--o-gray-700)]">
            Highlight category
          </span>
          {(Object.keys(CATEGORY_LABEL) as Category[]).map((key) => (
            <button
              key={key}
              type="button"
              className="o-btn o-btn-secondary o-btn-sm"
              aria-pressed={active === key}
              style={
                active === key
                  ? {
                      background: "var(--o-brand-primary)",
                      color: "white",
                      borderColor: "var(--o-brand-primary)",
                    }
                  : undefined
              }
              onClick={() => setCategory(key)}
            >
              {CATEGORY_LABEL[key]} ({formatInt(buckets[key].length)})
            </button>
          ))}
          <Link className="o-btn o-btn-secondary o-btn-sm ml-auto" to={cellLink(active)}>
            Open the {formatInt(selected.length)} positions
          </Link>
        </div>
      </section>

      <PanelGrid>
        <ChartCard
          title="Available capacity by warehouse"
          hint="Positions available for put-away in each warehouse."
          height={230}
        >
          <CapacityChart cells={cells} bucket={buckets[active]} keyField="warehouseCode" />
        </ChartCard>
        <ChartCard
          title={`${CATEGORY_LABEL[active]} by level`}
          hint="Which levels carry the free space."
          height={230}
        >
          <CapacityChart cells={cells} bucket={buckets[active]} keyField="level" />
        </ChartCard>
      </PanelGrid>

      <section className="o-card p-3">
        <div className="flex items-center gap-3 flex-wrap mb-3">
          <h3 className="text-[var(--o-fs-sm)] font-medium text-[var(--o-gray-700)] m-0">
            {CATEGORY_LABEL[active]} on the floor plan
          </h3>
          <select
            className="o-input"
            style={{ width: 260 }}
            value={activeWarehouseId}
            onChange={(e) => {
              setWarehouseId(e.target.value);
              setRackId(null);
            }}
            aria-label="Warehouse"
          >
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} - {w.name}
              </option>
            ))}
          </select>
          <span className="text-[var(--o-fs-xs)] text-[var(--o-text-muted)]">
            Highlighted racks contain at least one position in this category.
          </span>
        </div>

        {warehouse ? (
          // The map sits beside the suggestion panel: a near-square building
          // plan would otherwise be stranded in the middle of a wide card.
          <div className="grid gap-4 grid-cols-1 xl:grid-cols-[1fr_440px] items-start">
            <div className="min-w-0">
              <FloorPlan
                warehouse={warehouse}
                racks={warehouseRacks}
                selectedRackId={rack?.id}
                highlightIds={highlightRacks}
                onSelectRack={(id) => setRackId(id)}
                height={400}
                measure={active === "blocked" ? "blocked" : "available"}
              />
            </div>
            <SuggestionPanel warehouseId={activeWarehouseId} />
          </div>
        ) : (
          <EmptyState title="No warehouse in scope" />
        )}

        {rack && (
          <div className="mt-3">
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <h4 className="text-[var(--o-fs-sm)] font-medium m-0">
                {rack.code} elevation
              </h4>
              <span className="text-[var(--o-fs-xs)] text-[var(--o-text-muted)]">
                {formatInt(rack.availableForPutaway)} of {formatInt(rack.positions)}{" "}
                positions available for put-away
              </span>
              <button
                type="button"
                className="o-btn o-btn-ghost o-btn-sm ml-auto"
                onClick={() => setRackId(null)}
              >
                Close
              </button>
            </div>
            <RackElevation
              rack={rack}
              cells={cells.filter((c) => c.rackId === rack.id)}
              highlightIds={highlightCells}
            />
            <div className="mt-2">
              <ElevationLegend />
            </div>
          </div>
        )}
      </section>

      <CellTable cells={selected} category={active} />
    </>
  );
}

function CapacityChart({
  cells,
  bucket,
  keyField,
}: {
  cells: CellRow[];
  bucket: CellRow[];
  keyField: "warehouseCode" | "level";
}) {
  const data = useMemo(() => {
    const totals = new Map<string, { label: string; total: number; matching: number }>();
    const keyOf = (cell: CellRow) =>
      keyField === "level"
        ? cell.level === 0
          ? "Ground"
          : `L${cell.level}`
        : cell.warehouseCode;
    for (const cell of cells) {
      const key = keyOf(cell);
      const entry = totals.get(key) ?? { label: key, total: 0, matching: 0 };
      entry.total += 1;
      totals.set(key, entry);
    }
    for (const cell of bucket) {
      const key = keyOf(cell);
      const entry = totals.get(key);
      if (entry) entry.matching += 1;
    }
    return Array.from(totals.values()).sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { numeric: true }),
    );
  }, [cells, bucket, keyField]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="label" {...AXIS_PROPS} />
        <YAxis {...AXIS_PROPS} width={56} allowDecimals={false} />
        <Tooltip content={<ChartTooltip unit="positions" />} cursor={{ fill: "var(--o-hover-bg)" }} />
        <Bar maxBarSize={64} dataKey="matching" name="In this category" fill="var(--o-action)" radius={[3, 3, 0, 0]} />
        <Bar maxBarSize={64} dataKey="total" name="Installed positions" fill="var(--o-occ-empty)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Compatibility-based suggestions.
 *
 * Selecting a product asks the same routine the put-away flow uses, and every
 * suggestion states why it qualifies. The ranking is a documented proximity and
 * accessibility heuristic - it is not a measured forklift route.
 */
function SuggestionPanel({ warehouseId }: { warehouseId: string }) {
  const derived = useDerived();
  const data = useAppStore((s) => s.data);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");

  const products = derived.products;
  const product = products.find((p) => p.id === productId) ?? products[0];
  const qty = Number(quantity) || product?.capacityQty || 0;

  const suggestions = useMemo(() => {
    if (!product) return [];
    return suggestCellsForProduct(data, product.id, undefined, qty, {
      warehouseId,
      limit: 6,
    });
  }, [data, product, qty, warehouseId]);

  return (
    <section className="o-card p-3">
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <h3 className="text-[var(--o-fs-sm)] font-medium text-[var(--o-gray-700)] m-0">
          Compatible destination suggestions
        </h3>
        <select
          className="o-input"
          style={{ width: 300 }}
          value={product?.id ?? ""}
          onChange={(e) => setProductId(e.target.value)}
          aria-label="Product"
        >
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} - {p.name}
            </option>
          ))}
        </select>
        <input
          className="o-input"
          style={{ width: 140 }}
          type="number"
          min={0}
          placeholder={`Qty (${product?.uom ?? ""})`}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          aria-label="Quantity"
        />
        {product && (
          <span className="text-[var(--o-fs-xs)] text-[var(--o-text-muted)]">
            Full pallet basis: {formatQty(product.capacityQty, product.uom)} ·
            weight {Math.round(qty * (product.capacityQty ? 1 : 1))} × unit weight
          </span>
        )}
      </div>

      {suggestions.length === 0 ? (
        <EmptyState
          title="No compatible position found"
          hint="Every position in this warehouse is occupied, blocked, already reserved, or its storage category does not accept this material group."
        />
      ) : (
        <ol className="list-none p-0 m-0 flex flex-col gap-1.5">
          {suggestions.map((suggestion, i) => (
            <li
              key={suggestion.locationId}
              className="flex items-start gap-2 border-b border-[var(--o-border-subtle)] pb-1.5"
            >
              <span
                className="flex items-center justify-center rounded-full shrink-0 text-[var(--o-fs-xxs)] font-medium mt-0.5"
                style={{
                  width: 20,
                  height: 20,
                  background: "var(--o-brand-primary-tint)",
                  color: "var(--o-brand-primary)",
                }}
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-medium o-truncate">{suggestion.completeName}</div>
                {/* Top reasons inline; the rest are in the tooltip so the panel
                    stays the same height as the map beside it. */}
                <div
                  className="flex flex-wrap gap-1 mt-0.5"
                  title={suggestion.reasons.join(" · ")}
                >
                  {suggestion.reasons.slice(0, 2).map((reason) => (
                    <Badge key={reason} tone="neutral">
                      {reason}
                    </Badge>
                  ))}
                  {suggestion.reasons.length > 2 && (
                    <Badge tone="neutral">
                      +{suggestion.reasons.length - 2} more
                    </Badge>
                  )}
                </div>
              </div>
              <Link
                className="o-btn o-btn-secondary o-btn-sm shrink-0"
                to={`/locations/cells/${suggestion.locationId}`}
              >
                Open
              </Link>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-2 text-[var(--o-fs-xxs)] text-[var(--o-text-subtle)]">
        Ranking basis: storage-category compatibility and position weight rating
        first, then accessibility - ground positions and bays near the head of a
        run score higher. This is a documented heuristic, not a measured
        shortest forklift route; a route model would need the aisle graph and
        truck data, which are not part of this prototype.
      </p>
    </section>
  );
}

function CellTable({ cells, category }: { cells: CellRow[]; category: Category }) {
  const shown = cells.slice(0, 25);
  return (
    <section className="o-card p-3">
      <div className="flex items-baseline justify-between gap-3 mb-2 flex-wrap">
        <h3 className="text-[var(--o-fs-sm)] font-medium text-[var(--o-gray-700)] m-0">
          {CATEGORY_LABEL[category]} positions
        </h3>
        <Link
          className="o-btn o-btn-secondary o-btn-sm"
          to={listUrl("cell", [
            contextFacet(
              "Category",
              [CATEGORY_LABEL[category]],
              CATEGORY_DOMAIN[category],
            ),
          ])}
        >
          Open all {formatInt(cells.length)}
        </Link>
      </div>
      <table className="o-list">
        <thead>
          <tr>
            <th>Position</th>
            <th>Warehouse</th>
            <th>Aisle</th>
            <th>Rack</th>
            <th style={{ textAlign: "right" }}>Bay</th>
            <th style={{ textAlign: "right" }}>Level</th>
            <th>Storage category</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((cell) => (
            <tr key={cell.id}>
              <td>
                <Link to={`/locations/cells/${cell.id}`}>{cell.completeName}</Link>
              </td>
              <td>{cell.warehouseCode}</td>
              <td>{cell.aisleCode}</td>
              <td>
                <Link to={`/locations/racks/${cell.rackId}`}>{cell.rackCode}</Link>
              </td>
              <td className="num">{cell.bay}</td>
              <td className="num">{cell.level === 0 ? "G" : cell.level}</td>
              <td>{cell.storageCategoryName ?? "-"}</td>
              <td className="text-[var(--o-text-muted)]">
                {cell.blocked
                  ? cell.blockNote
                  : cell.reservedIncoming
                    ? "Destination of a pending operation"
                    : "Ready for put-away"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {cells.length > shown.length && (
        <p className="mt-2 text-[var(--o-fs-xxs)] text-[var(--o-text-subtle)]">
          Showing {shown.length} of {formatInt(cells.length)}. Use the button
          above to open the full filtered list.
        </p>
      )}
    </section>
  );
}
