/**
 * Partially Filled Pallet Dashboard.
 *
 * A partial pallet occupies a whole position while holding less than a whole
 * load, so it is the clearest lever on warehouse capacity. Every fill figure on
 * this page states its basis: the explicit pallet capacity of the product or
 * variant, never the 800 kg structural rating of the rack position.
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
import { contextFacet, listUrl, thresholdFacet } from "@/app/links";
import type { PalletRow } from "@/data/derive";
import { useUrlParam } from "@/hooks/useSearchState";
import { AXIS_PROPS, ChartCard, ChartTooltip, GRID_PROPS, seriesColor } from "@/odoo/charts";
import { FillBar, formatInt, formatNumber, formatQty } from "@/odoo/format";
import { EmptyState } from "@/odoo/primitives";
import { cond } from "@/query/domain";
import { suggestConsolidation } from "@/store/apply";
import { useAppStore } from "@/store/appStore";
import { DashboardFrame, KpiRow, PanelGrid } from "./DashboardFrame";
import { Kpi } from "./Kpi";
import { distinct, unitsPresent, useScopedRows } from "./useScoped";

const BANDS = [
  { id: "0-25", label: "1-25%", min: 0.0001, max: 25 },
  { id: "25-50", label: "26-50%", min: 25, max: 50 },
  { id: "50-75", label: "51-75%", min: 50, max: 75 },
  { id: "75-99", label: "76-99%", min: 75, max: 99.9999 },
];

export function PartialPalletDashboard() {
  return (
    <DashboardFrame
      title="Partially Filled Pallets"
      modelName="pallet"
      description="Pallets holding stock but not a full load. Consolidating them frees whole positions without moving any stock off site."
      base={{ pallet: cond("status", "eq", "partial") }}
    >
      {({ scope }) => <PartialBody scope={scope} />}
    </DashboardFrame>
  );
}

function PartialBody({
  scope,
}: {
  scope: ReturnType<typeof import("./scope").buildScope>;
}) {
  const rows = useScopedRows(scope);
  const partials = rows.pallets;
  const [band, setBand] = useUrlParam("band");

  const units = useMemo(() => unitsPresent(partials, "remainingQty"), [partials]);

  const banded = useMemo(() => {
    if (!band) return partials;
    const def = BANDS.find((b) => b.id === band);
    if (!def) return partials;
    return partials.filter(
      (p) => (p.fillPct ?? 0) > def.min && (p.fillPct ?? 0) <= def.max,
    );
  }, [partials, band]);

  const avgFill = partials.length
    ? partials.reduce((sum, p) => sum + (p.fillPct ?? 0), 0) / partials.length
    : 0;

  const palletLink = (facets: Parameters<typeof listUrl>[1]) =>
    listUrl("pallet", [
      contextFacet("Pallet Status", ["Partially filled"], cond("status", "eq", "partial")),
      ...facets,
    ]);

  return (
    <>
      <KpiRow>
        <Kpi
          label="Partial pallets"
          value={formatInt(partials.length)}
          sub="Distinct pallets holding a part load"
          to={palletLink([])}
          hint="A distinct count of pallets. The list it opens holds exactly this many rows."
        />
        <Kpi
          label="Rack positions they occupy"
          value={formatInt(distinct(partials.filter((p) => p.rackId), "locationId"))}
          tone="action"
          sub={(() => {
            const offRack = partials.filter((p) => !p.rackId).length;
            return offRack
              ? `One position each; ${formatInt(offRack)} more are in input or staging areas`
              : "One rack position each";
          })()}
          to={listUrl("cell", [
            contextFacet(
              "Pallet Status",
              ["Partially filled"],
              cond("palletStatus", "eq", "partial"),
            ),
          ])}
          hint="Counts rack positions only. A partial pallet still waiting in the input area does not occupy an installed position."
        />
        <Kpi
          label="Average fill"
          value={`${formatNumber(avgFill, 1)}%`}
          tone={avgFill < 50 ? "warn" : "brand"}
          sub="Against each product's own pallet capacity"
          bar={avgFill}
        />
        <Kpi
          label="Under 25% full"
          value={formatInt(partials.filter((p) => (p.fillPct ?? 0) <= 25).length)}
          tone="bad"
          sub="Best consolidation candidates"
          to={palletLink([thresholdFacet("pallet", "fillPct", "lte", 25)])}
        />
        <Kpi
          label="Products affected"
          value={formatInt(distinct(partials, "productId"))}
          sub="Distinct products with a part load"
          to={listUrl("product", [
            contextFacet("Availability", ["In stock"], cond("onHand", "gt", 0)),
          ])}
        />
        <Kpi
          label="Warehouses affected"
          value={formatInt(distinct(partials, "warehouseId"))}
          sub="Distinct warehouses"
        />
      </KpiRow>

      <section className="o-card p-3">
        <h3 className="o-section-heading text-[var(--o-fs-lg)] mb-2">
          Remaining capacity by unit of measure
        </h3>
        <table className="o-list">
          <thead>
            <tr>
              <th>Unit</th>
              <th style={{ textAlign: "right" }}>Pallets</th>
              <th style={{ textAlign: "right" }}>Stock held</th>
              <th style={{ textAlign: "right" }}>Remaining capacity</th>
              <th style={{ textAlign: "right" }}>Average fill</th>
            </tr>
          </thead>
          <tbody>
            {units.map(({ unit }) => {
              const list = partials.filter((p) => p.uom === unit);
              const held = list.reduce((s, p) => s + p.quantity, 0);
              const remaining = list.reduce((s, p) => s + (p.remainingQty ?? 0), 0);
              const fill = list.length
                ? list.reduce((s, p) => s + (p.fillPct ?? 0), 0) / list.length
                : 0;
              return (
                <tr key={unit}>
                  <td className="font-medium">{unit}</td>
                  <td className="num">{formatInt(list.length)}</td>
                  <td className="num">{formatQty(held, unit)}</td>
                  <td className="num">{formatQty(remaining, unit)}</td>
                  <td className="num">{formatNumber(fill, 1)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-2 text-[var(--o-fs-xxs)] text-[var(--o-text-subtle)]">
          Remaining capacity is the product's own full-pallet quantity minus what
          is on the pallet. Units are never added together.
        </p>
      </section>

      <PanelGrid>
        <ChartCard
          title="Fill percentage distribution"
          hint="How full the partial pallets are."
          height={240}
          footer="Select a band to filter the pallet table below."
        >
          <BandChart
            partials={partials}
            active={band}
            onSelect={(id) => setBand(id === band ? null : id)}
          />
        </ChartCard>

        <ChartCard
          title="Partial pallets by warehouse"
          hint="Where the part loads are."
          height={240}
        >
          <GroupChart rows={partials} field="warehouseCode" />
        </ChartCard>
      </PanelGrid>

      <PanelGrid>
        <ChartCard
          title="Partial pallets by product"
          hint="The twelve products with the most part loads."
          height={260}
        >
          <GroupChart rows={partials} field="productName" limit={12} horizontal />
        </ChartCard>

        <ChartCard
          title="Locations of partial pallets"
          hint="Aisle distribution, so a consolidation run can be planned by area."
          height={260}
        >
          <GroupChart rows={partials} field="aisleCode" />
        </ChartCard>
      </PanelGrid>

      <PalletTable pallets={banded} band={band} onClearBand={() => setBand(null)} />
    </>
  );
}

function BandChart({
  partials,
  active,
  onSelect,
}: {
  partials: PalletRow[];
  active: string;
  onSelect: (id: string) => void;
}) {
  const data = useMemo(
    () =>
      BANDS.map((band) => ({
        id: band.id,
        label: band.label,
        value: partials.filter(
          (p) => (p.fillPct ?? 0) > band.min && (p.fillPct ?? 0) <= band.max,
        ).length,
      })),
    [partials],
  );

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="label" {...AXIS_PROPS} />
        <YAxis {...AXIS_PROPS} width={56} allowDecimals={false} />
        <Tooltip content={<ChartTooltip unit="pallets" />} cursor={{ fill: "var(--o-hover-bg)" }} />
        <Bar maxBarSize={64}
          dataKey="value"
          name="Pallets"
          radius={[3, 3, 0, 0]}
          cursor="pointer"
          onClick={(entry) => onSelect((entry as unknown as { id: string }).id)}
        >
          {data.map((entry, i) => (
            <ReCell
              key={entry.id}
              fill={active === entry.id ? "var(--o-brand-primary)" : seriesColor(i)}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function GroupChart({
  rows,
  field,
  limit,
  horizontal,
}: {
  rows: PalletRow[];
  field: "warehouseCode" | "productName" | "aisleCode";
  limit?: number;
  horizontal?: boolean;
}) {
  const data = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      // Pallets waiting in an input or staging area have no aisle; say so
      // rather than showing an unexplained blank bucket.
      const raw = row[field];
      const key =
        raw === undefined || raw === null || raw === ""
          ? "Not in racking"
          : String(raw);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const list = Array.from(counts.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
    return limit ? list.slice(0, limit) : list;
  }, [rows, field, limit]);

  if (!data.length) return <EmptyState title="Nothing in scope" />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        layout={horizontal ? "vertical" : "horizontal"}
        margin={{ top: 4, right: 12, bottom: 4, left: horizontal ? 8 : 0 }}
      >
        <CartesianGrid {...GRID_PROPS} horizontal={!horizontal} vertical={horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" {...AXIS_PROPS} allowDecimals={false} />
            <YAxis type="category" dataKey="label" {...AXIS_PROPS} width={168} />
          </>
        ) : (
          <>
            <XAxis dataKey="label" {...AXIS_PROPS} />
            <YAxis {...AXIS_PROPS} width={56} allowDecimals={false} />
          </>
        )}
        <Tooltip content={<ChartTooltip unit="pallets" />} cursor={{ fill: "var(--o-hover-bg)" }} />
        <Bar maxBarSize={64}
          dataKey="value"
          name="Partial pallets"
          radius={horizontal ? [0, 3, 3, 0] : [3, 3, 0, 0]}
        >
          {data.map((entry, i) => (
            <ReCell key={entry.label} fill={seriesColor(i)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function PalletTable({
  pallets,
  band,
  onClearBand,
}: {
  pallets: PalletRow[];
  band: string;
  onClearBand: () => void;
}) {
  const data = useAppStore((s) => s.data);
  const shown = useMemo(
    () => pallets.slice().sort((a, b) => (a.fillPct ?? 0) - (b.fillPct ?? 0)).slice(0, 20),
    [pallets],
  );

  return (
    <section className="o-card p-3">
      <div className="flex items-baseline justify-between gap-3 mb-2 flex-wrap">
        <h3 className="text-[var(--o-fs-sm)] font-medium text-[var(--o-gray-700)] m-0">
          Partial pallets and consolidation candidates
          {band && (
            <button type="button" className="o-btn o-btn-link ml-2" onClick={onClearBand}>
              clear {band}% band
            </button>
          )}
        </h3>
        <Link
          className="o-btn o-btn-secondary o-btn-sm"
          to={listUrl("pallet", [
            contextFacet(
              "Pallet Status",
              ["Partially filled"],
              cond("status", "eq", "partial"),
            ),
          ])}
        >
          Open all {formatInt(pallets.length)}
        </Link>
      </div>

      <table className="o-list">
        <thead>
          <tr>
            <th>Pallet</th>
            <th>Location</th>
            <th>Product</th>
            <th>Lot</th>
            <th style={{ textAlign: "right" }}>On pallet</th>
            <th style={{ textAlign: "right" }}>Capacity basis</th>
            <th style={{ textAlign: "right" }}>Remaining</th>
            <th style={{ width: 150 }}>Fill</th>
            <th>Consolidate into</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((pallet) => {
            const candidates = suggestConsolidation(data, pallet.id, 2);
            return (
              <tr key={pallet.id}>
                <td>
                  <Link to={`/pallets/${pallet.id}`}>{pallet.name}</Link>
                </td>
                <td className="o-truncate" title={pallet.completeName}>
                  {pallet.completeName}
                </td>
                <td className="o-truncate">{pallet.productName}</td>
                <td>
                  {pallet.lotId ? (
                    <Link to={`/lots/${pallet.lotId}`}>{pallet.lotName}</Link>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="num">{formatQty(pallet.quantity, pallet.uom)}</td>
                <td className="num" title="Explicit product or variant pallet capacity">
                  {formatQty(pallet.capacityQty ?? 0, pallet.uom)}
                </td>
                <td className="num">{formatQty(pallet.remainingQty ?? 0, pallet.uom)}</td>
                <td>
                  <FillBar value={pallet.fillPct} width={80} />
                </td>
                <td>
                  {candidates.length ? (
                    <div className="flex flex-col gap-0.5">
                      {candidates.map((candidate) => (
                        <Link
                          key={candidate.palletId}
                          to={`/pallets/${candidate.palletId}`}
                          className="text-[var(--o-fs-xs)]"
                          title={`${candidate.completeName} - ${formatQty(candidate.remaining, candidate.uom)} of room`}
                        >
                          {candidate.palletName} (+
                          {formatNumber(candidate.remaining, 0)} {candidate.uom})
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[var(--o-text-subtle)] text-[var(--o-fs-xs)]">
                      No compatible pallet
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="mt-2 text-[var(--o-fs-xxs)] text-[var(--o-text-subtle)]">
        Consolidation rule used here is deliberately conservative: same product,
        same variant, same lot, and enough remaining capacity to absorb the whole
        quantity. Anything looser would need a business decision about mixing
        lots on one pallet.
      </p>
    </section>
  );
}
