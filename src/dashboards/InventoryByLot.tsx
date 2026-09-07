/**
 * Inventory by Lot Dashboard.
 *
 * Lot-level traceability: what the lot is, when it was received, how old it is,
 * how much survives, which pallets and positions hold it, and every movement it
 * has been through. Stock age is measured from the original receipt date and is
 * never reset by relocating the pallet.
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
import { contextFacet, listUrl } from "@/app/links";
import { formatDate, formatDateTime } from "@/data/clock";
import type { MovementRow, StockRow } from "@/data/derive";
import { useUrlParam } from "@/hooks/useSearchState";
import { CellPreview } from "@/map/CellPreview";
import { FloorPlan } from "@/map/FloorPlan";
import { SearchableSelect } from "@/odoo/CustomFilter";
import { AXIS_PROPS, ChartCard, ChartTooltip, GRID_PROPS, seriesColor } from "@/odoo/charts";
import { FillBar, formatInt, formatNumber, formatQty } from "@/odoo/format";
import { Badge, EmptyState } from "@/odoo/primitives";
import { StateBadge } from "@/odoo/format";
import { cond } from "@/query/domain";
import { useDerived } from "@/store/appStore";
import { DashboardFrame, KpiRow, PanelGrid } from "./DashboardFrame";
import { Kpi } from "./Kpi";
import { useScopedRows } from "./useScoped";

export function InventoryByLotDashboard() {
  return (
    <DashboardFrame
      title="Inventory by Lot"
      modelName="lot"
      description="Full traceability for one lot: receipt, age, quantities, the pallets and positions holding it, and its movement history."
    >
      {({ scope }) => <LotBody scope={scope} />}
    </DashboardFrame>
  );
}

function LotBody({
  scope,
}: {
  scope: ReturnType<typeof import("./scope").buildScope>;
}) {
  const derived = useDerived();
  const rows = useScopedRows(scope);
  const [lotId, setLotId] = useUrlParam("lot");

  const lots = derived.lots;
  const activeLotId = lotId || lots.find((l) => l.onHand > 0)?.id || lots[0]?.id || "";
  const lot = lots.find((l) => l.id === activeLotId);

  const stock = useMemo(
    () => rows.stock.filter((r) => r.lotId === activeLotId),
    [rows.stock, activeLotId],
  );
  const movements = useMemo(
    () =>
      derived.movements
        .filter((m) => m.lotId === activeLotId)
        .sort((a, b) => b.movementDate.localeCompare(a.movementDate)),
    [derived.movements, activeLotId],
  );

  const [cellId, setCellId] = useUrlParam("cell");
  const selectedCell = derived.cells.find((c) => c.id === cellId);

  const lotCells = useMemo(() => {
    const ids = new Set(stock.map((r) => r.locationId));
    return derived.cells.filter((c) => ids.has(c.id));
  }, [stock, derived.cells]);

  const warehouseOfLot = useMemo(() => {
    const first = lotCells[0];
    return first ? derived.warehouses.find((w) => w.id === first.warehouseId) : undefined;
  }, [lotCells, derived.warehouses]);

  if (!lot) return <EmptyState title="No lot in scope" />;

  const lotFacet = contextFacet("Lot", [lot.name], cond("lotId", "eq", lot.id));

  return (
    <>
      <section className="o-card p-3 flex items-center gap-3 flex-wrap">
        <span className="text-[var(--o-fs-sm)] font-medium text-[var(--o-gray-700)]">
          Lot / Serial
        </span>
        <SearchableSelect
          options={lots.map((l) => ({
            value: l.id,
            label: `${l.name} - ${l.productName}`,
          }))}
          value={activeLotId}
          onChange={(value) => {
            setLotId(value);
            setCellId(null);
          }}
          width={380}
        />
        <Badge tone={lot.onHand > 0 ? "ok" : "neutral"}>
          {lot.onHand > 0 ? "In stock" : "Fully consumed"}
        </Badge>
        <span className="ml-auto flex gap-2">
          <Link className="o-btn o-btn-secondary o-btn-sm" to={`/lots/${lot.id}`}>
            Open lot record
          </Link>
          <Link className="o-btn o-btn-secondary o-btn-sm" to={`/products/${lot.productId}`}>
            Open product
          </Link>
        </span>
      </section>

      <section className="o-card p-3">
        <h3 className="o-section-heading text-[var(--o-fs-lg)] mb-2">
          Identification and original receipt
        </h3>
        <dl className="grid gap-x-6 gap-y-1 text-[var(--o-fs-sm)] m-0 grid-cols-2 md:grid-cols-4">
          <Field label="Lot reference" value={lot.name} />
          <Field
            label="Product"
            value={<Link to={`/products/${lot.productId}`}>{lot.productName}</Link>}
          />
          <Field label="Variant" value={lot.variantName} />
          <Field label="Material group" value={lot.materialGroup} />
          <Field label="Receipt date" value={formatDate(lot.receiptDate)} />
          <Field label="Stock age" value={`${formatInt(lot.ageDays)} days`} />
          <Field label="Supplier" value={lot.supplierRef ?? "-"} />
          <Field label="Origin / garden mark" value={lot.origin ?? lot.gardenMark ?? "-"} />
        </dl>
        <p className="mt-2 text-[var(--o-fs-xxs)] text-[var(--o-text-subtle)]">
          Age is measured from this receipt date. Relocating a pallet between
          positions never changes it.
        </p>
      </section>

      <KpiRow>
        <Kpi
          label={`On hand (${lot.uom})`}
          value={formatNumber(lot.onHand, 2)}
          to={listUrl("stock", [lotFacet])}
        />
        <Kpi
          label={`Reserved (${lot.uom})`}
          value={formatNumber(lot.reserved, 2)}
          tone="warn"
          to={listUrl("stock", [
            lotFacet,
            contextFacet("Reserved", ["> 0"], cond("reservedQuantity", "gt", 0)),
          ])}
        />
        <Kpi
          label={`Available (${lot.uom})`}
          value={formatNumber(lot.available, 2)}
          tone="ok"
          bar={lot.onHand ? (lot.available / lot.onHand) * 100 : 0}
        />
        <Kpi
          label="Pallets"
          value={formatInt(lot.palletCount)}
          tone="action"
          sub="Distinct pallets holding this lot"
          to={listUrl("pallet", [contextFacet("Lot", [lot.name], cond("lotId", "eq", lot.id))])}
        />
        <Kpi
          label="Positions"
          value={formatInt(lot.locationCount)}
          sub={lot.warehouseCodes || "-"}
        />
        <Kpi
          label="Stock age"
          value={`${formatInt(lot.ageDays)} d`}
          tone={lot.ageDays > 180 ? "bad" : lot.ageDays > 90 ? "warn" : "brand"}
          sub={lot.ageBucket}
          to={listUrl("stock", [
            contextFacet("Stock Age", [lot.ageBucket], cond("ageBucket", "eq", lot.ageBucket)),
          ])}
        />
      </KpiRow>

      <PanelGrid>
        <ChartCard
          title={`Distribution across pallets (${lot.uom})`}
          hint="How this lot is split between pallets."
          height={240}
        >
          <PalletChart stock={stock} unit={lot.uom} />
        </ChartCard>
        <ChartCard
          title={`Distribution across locations (${lot.uom})`}
          hint="Which positions hold it."
          height={240}
        >
          <LocationChart stock={stock} unit={lot.uom} />
        </ChartCard>
      </PanelGrid>

      {/* Map and the pallets holding the lot share one row: a near-square
          building plan would otherwise be stranded in a very wide card. */}
      <div className="grid gap-4 grid-cols-1 xl:grid-cols-[520px_1fr] items-start">
        {warehouseOfLot && (
          <section className="o-card p-3">
            <h3 className="o-section-heading text-[var(--o-fs-lg)] mb-2">
              Where this lot sits - {warehouseOfLot.code}
            </h3>
            <FloorPlan
              warehouse={warehouseOfLot}
              racks={derived.racks.filter((r) => r.warehouseId === warehouseOfLot.id)}
              highlightIds={new Set(lotCells.map((c) => c.rackId))}
              onSelectRack={() => undefined}
              height={340}
            />
            <p className="mt-2 text-[var(--o-fs-xs)] text-[var(--o-text-muted)]">
              Highlighted racks hold at least one pallet of {lot.name}.
            </p>
          </section>
        )}

        <section className="o-card p-3">
          <h3 className="o-section-heading text-[var(--o-fs-lg)] mb-2">
            Pallets and positions
          </h3>
          {stock.length === 0 ? (
            <EmptyState
              title="This lot holds no stock"
              hint="It has been fully consumed. Its movement history below still shows what happened to it."
            />
          ) : (
            <div className="grid gap-3 grid-cols-1 2xl:grid-cols-[1fr_320px]">
              <table className="o-list">
              <thead>
                <tr>
                  <th>Pallet</th>
                  <th>Position</th>
                  <th style={{ textAlign: "right" }}>On hand</th>
                  <th style={{ textAlign: "right" }}>Reserved</th>
                  <th style={{ textAlign: "right" }}>Available</th>
                  <th style={{ width: 130 }}>Fill</th>
                  <th style={{ width: 90 }} />
                </tr>
              </thead>
              <tbody>
                {stock.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {row.palletId ? (
                        <Link to={`/pallets/${row.palletId}`}>{row.palletName}</Link>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="o-truncate">{row.completeName}</td>
                    <td className="num">{formatQty(row.quantity, row.uom)}</td>
                    <td className="num">{formatQty(row.reservedQuantity, row.uom)}</td>
                    <td className="num">{formatQty(row.availableQuantity, row.uom)}</td>
                    <td>
                      <FillBar value={row.fillPct} width={70} />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="o-btn o-btn-secondary o-btn-sm"
                        onClick={() => setCellId(row.locationId)}
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
              {selectedCell && (
                <CellPreview cell={selectedCell} onClose={() => setCellId(null)} />
              )}
            </div>
          )}
        </section>
      </div>

      <section className="o-card p-3">
        <div className="flex items-baseline justify-between gap-3 mb-2 flex-wrap">
          <h3 className="text-[var(--o-fs-sm)] font-medium text-[var(--o-gray-700)] m-0">
            Movement history
          </h3>
          <Link
            className="o-btn o-btn-secondary o-btn-sm"
            to={listUrl("movement", [
              contextFacet("Lot", [lot.name], cond("lotId", "eq", lot.id)),
            ])}
          >
            Open all {formatInt(movements.length)} movements
          </Link>
        </div>
        {movements.length === 0 ? (
          <EmptyState
            title="No recorded movements"
            hint="This lot arrived as part of the opening balance loaded before the demonstration window."
          />
        ) : (
          <table className="o-list">
            <thead>
              <tr>
                <th>Date</th>
                <th>Reference</th>
                <th>Type</th>
                <th>From</th>
                <th>To</th>
                <th>Pallet</th>
                <th style={{ textAlign: "right" }}>Quantity</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {movements.slice(0, 25).map((row: MovementRow) => (
                <tr key={row.id}>
                  <td>{formatDateTime(row.movementDate)}</td>
                  <td>
                    <Link to={`/operations/${row.operationId}`}>{row.operationName}</Link>
                  </td>
                  <td>{row.kind}</td>
                  <td className="o-truncate">{row.sourceLocationName}</td>
                  <td className="o-truncate">{row.destLocationName}</td>
                  <td>
                    {row.palletId ? (
                      <Link to={`/pallets/${row.palletId}`}>{row.palletName}</Link>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="num">{formatQty(row.doneQty || row.quantity, row.uom)}</td>
                  <td>
                    <StateBadge value={row.state} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[var(--o-fs-xxs)] uppercase tracking-wide text-[var(--o-text-subtle)] m-0">
        {label}
      </dt>
      <dd className="m-0">{value}</dd>
    </div>
  );
}

function PalletChart({ stock, unit }: { stock: StockRow[]; unit: string }) {
  const data = useMemo(
    () =>
      stock
        .filter((r) => r.palletId)
        .map((r) => ({
          id: r.palletId!,
          label: r.palletName ?? r.palletId!,
          value: Math.round(r.quantity * 100) / 100,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 14),
    [stock],
  );

  if (!data.length) return <EmptyState title="No pallets hold this lot" />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 8 }}>
        <CartesianGrid {...GRID_PROPS} horizontal={false} vertical />
        <XAxis type="number" {...AXIS_PROPS} tickFormatter={(v: number) => formatNumber(v, 0)} />
        <YAxis type="category" dataKey="label" {...AXIS_PROPS} width={110} />
        <Tooltip content={<ChartTooltip unit={unit} />} cursor={{ fill: "var(--o-hover-bg)" }} />
        <Bar maxBarSize={64} dataKey="value" name={`Quantity (${unit})`} radius={[0, 3, 3, 0]}>
          {data.map((entry, i) => (
            <ReCell key={entry.id} fill={seriesColor(i)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function LocationChart({ stock, unit }: { stock: StockRow[]; unit: string }) {
  const data = useMemo(() => {
    const totals = new Map<string, number>();
    for (const row of stock) {
      const key = row.rackCode ?? row.completeName;
      totals.set(key, (totals.get(key) ?? 0) + row.quantity);
    }
    return Array.from(totals.entries())
      .map(([label, value]) => ({ label, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 14);
  }, [stock]);

  if (!data.length) return <EmptyState title="No positions hold this lot" />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 40, left: 0 }}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="label" {...AXIS_PROPS} angle={-30} textAnchor="end" height={54} interval={0} />
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
