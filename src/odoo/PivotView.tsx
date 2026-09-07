/**
 * Pivot view.
 *
 * Rows come from Group By, columns from a second grouping chosen here, and the
 * measure is any aggregable field. It reads the same filtered rows as the list,
 * and it refuses to add incompatible units: a cell mixing kilograms and cartons
 * shows both figures instead of a wrong single number.
 */

import { useMemo, useState } from "react";
import { aggregate, formatAgg, groupKeyFor, parseGroupSpec, type AggregateDef } from "@/query/group";
import { getField, type ModelDef } from "@/query/models";
import type { SearchState } from "@/query/search";
import { EmptyState } from "./primitives";

type Row = Record<string, unknown>;

export function PivotView({
  model,
  rows,
  state,
  onState,
}: {
  model: ModelDef;
  rows: Row[];
  state: SearchState;
  onState: (next: SearchState | ((prev: SearchState) => SearchState)) => void;
}) {
  const measures = useMemo(
    () => model.fields.filter((f) => f.agg && f.agg.kind !== "none"),
    [model],
  );
  const [measureName, setMeasureName] = useState(
    state.measure ?? measures[0]?.name ?? "",
  );
  const measureField = getField(model, measureName);
  const measureDef: AggregateDef = measureField?.agg ?? { kind: "count", decimals: 0 };

  const rowToken = state.groupBy[0] ?? model.groupBys[0] ?? "";
  const colToken = state.pivotCols?.[0] ?? "";

  const { rowKeys, colKeys, matrix, rowTotals, colTotals, grand } = useMemo(() => {
    const rowSpec = parseGroupSpec(rowToken || "id");
    const colSpec = colToken ? parseGroupSpec(colToken) : null;

    const cells = new Map<string, Row[]>();
    const rowLabels = new Map<string, string>();
    const colLabels = new Map<string, string>();

    for (const row of rows) {
      const r = groupKeyFor(row, rowSpec);
      rowLabels.set(r.key, r.label);
      const c = colSpec ? groupKeyFor(row, colSpec) : { key: "__total__", label: "Total" };
      colLabels.set(c.key, c.label);
      const key = `${r.key}||${c.key}`;
      const bucket = cells.get(key);
      if (bucket) bucket.push(row);
      else cells.set(key, [row]);
    }

    const rowKeys = Array.from(rowLabels.entries()).sort((a, b) =>
      a[1].localeCompare(b[1], undefined, { numeric: true }),
    );
    const colKeys = Array.from(colLabels.entries()).sort((a, b) =>
      a[1].localeCompare(b[1], undefined, { numeric: true }),
    );

    const matrix = new Map<string, ReturnType<typeof aggregate>>();
    for (const [key, bucket] of cells) {
      matrix.set(key, aggregate(bucket, measureName, measureDef));
    }

    const rowTotals = new Map<string, ReturnType<typeof aggregate>>();
    for (const [rk] of rowKeys) {
      const bucket = rows.filter(
        (row) => groupKeyFor(row, rowSpec).key === rk,
      );
      rowTotals.set(rk, aggregate(bucket, measureName, measureDef));
    }

    const colTotals = new Map<string, ReturnType<typeof aggregate>>();
    for (const [ck] of colKeys) {
      const bucket = colSpec
        ? rows.filter((row) => groupKeyFor(row, colSpec).key === ck)
        : rows;
      colTotals.set(ck, aggregate(bucket, measureName, measureDef));
    }

    return {
      rowKeys,
      colKeys,
      matrix,
      rowTotals,
      colTotals,
      grand: aggregate(rows, measureName, measureDef),
    };
  }, [rows, rowToken, colToken, measureName, measureDef]);

  if (!rows.length) {
    return (
      <div className="o-card m-4">
        <EmptyState title="Nothing to pivot" hint="Widen the filters to see data." />
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="o-card p-3">
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <label className="text-[var(--o-fs-xs)] text-[var(--o-text-muted)]">Measure</label>
          <select
            className="o-input"
            style={{ width: 190 }}
            value={measureName}
            onChange={(e) => {
              setMeasureName(e.target.value);
              onState({ ...state, measure: e.target.value });
            }}
          >
            {measures.map((field) => (
              <option key={field.name} value={field.name}>
                {field.label}
              </option>
            ))}
          </select>

          <label className="text-[var(--o-fs-xs)] text-[var(--o-text-muted)] ml-2">Rows</label>
          <select
            className="o-input"
            style={{ width: 190 }}
            value={rowToken}
            onChange={(e) => onState({ ...state, groupBy: [e.target.value] })}
          >
            {model.groupBys.map((token) => (
              <option key={token} value={token}>
                {labelForToken(model, token)}
              </option>
            ))}
          </select>

          <label className="text-[var(--o-fs-xs)] text-[var(--o-text-muted)] ml-2">Columns</label>
          <select
            className="o-input"
            style={{ width: 190 }}
            value={colToken}
            onChange={(e) =>
              onState({ ...state, pivotCols: e.target.value ? [e.target.value] : [] })
            }
          >
            <option value="">(none)</option>
            {model.groupBys.map((token) => (
              <option key={token} value={token}>
                {labelForToken(model, token)}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 300px)" }}>
          <table className="o-list">
            <thead>
              <tr>
                <th style={{ minWidth: 220 }}>{labelForToken(model, rowToken)}</th>
                {colKeys.map(([key, label]) => (
                  <th key={key} style={{ textAlign: "right", minWidth: 120 }}>
                    {label}
                  </th>
                ))}
                <th style={{ textAlign: "right", minWidth: 130 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {rowKeys.map(([rk, rowLabel]) => (
                <tr key={rk}>
                  <td className="font-medium">{rowLabel}</td>
                  {colKeys.map(([ck]) => (
                    <td key={ck} className="num">
                      {formatAgg(matrix.get(`${rk}||${ck}`))}
                    </td>
                  ))}
                  <td className="num font-medium">{formatAgg(rowTotals.get(rk))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                {colKeys.map(([ck]) => (
                  <td key={ck} className="num">
                    {formatAgg(colTotals.get(ck))}
                  </td>
                ))}
                <td className="num">{formatAgg(grand)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <p className="mt-2 text-[var(--o-fs-xxs)] text-[var(--o-text-subtle)]">
          {rows.length.toLocaleString("en-GB")} records in scope. Percentages and
          incompatible units are never summed; a cell holding more than one unit
          lists each unit separately.
        </p>
      </div>
    </div>
  );
}

function labelForToken(model: ModelDef, token: string): string {
  if (!token) return "";
  const [name, granularity] = token.split(":");
  const field = getField(model, name);
  return granularity ? `${field?.label ?? name} (${granularity})` : field?.label ?? name;
}
