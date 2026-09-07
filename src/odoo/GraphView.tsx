/**
 * Graph view.
 *
 * Charts the same filtered rows the list shows, grouped by the same Group By
 * selection. Switching to Graph never changes the dataset - only its shape.
 */

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { aggregate, groupRows, type AggregateDef } from "@/query/group";
import { getField, type ModelDef } from "@/query/models";
import type { SearchState } from "@/query/search";
import { AXIS_PROPS, ChartTooltip, GRID_PROPS, seriesColor, shortLabel } from "./charts";
import { formatNumber } from "./format";
import { EmptyState } from "./primitives";

type Row = Record<string, unknown>;
type ChartKind = "bar" | "line" | "pie";

export function GraphView({
  model,
  rows,
  state,
  onState,
  onDrill,
}: {
  model: ModelDef;
  rows: Row[];
  state: SearchState;
  onState: (next: SearchState | ((prev: SearchState) => SearchState)) => void;
  onDrill?: (field: string, key: string, label: string) => void;
}) {
  const [kind, setKind] = useState<ChartKind>("bar");
  const navigate = useNavigate();
  void navigate;

  const measures = useMemo(
    () => model.fields.filter((f) => f.agg && f.agg.kind !== "none"),
    [model],
  );

  const measureName = state.measure ?? measures[0]?.name ?? "";
  const measureField = getField(model, measureName);
  const measureDef: AggregateDef =
    measureField?.agg ?? { kind: "count", decimals: 0 };

  const groupToken =
    state.groupBy[0] ?? model.groupBys[0] ?? model.fields[0]?.name ?? "";

  const data = useMemo(() => {
    if (!groupToken) return [];
    const nodes = groupRows(rows, [groupToken], { [measureName]: measureDef });
    return nodes
      .map((node) => {
        const agg = node.aggregates[measureName];
        return {
          key: node.key,
          label: node.label,
          value: agg?.value ?? node.count,
          count: node.count,
          mixed: !!agg?.mixed,
          byUnit: agg?.byUnit,
        };
      })
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
      .slice(0, 30);
  }, [rows, groupToken, measureName, measureDef]);

  const anyMixed = data.some((d) => d.mixed);
  const groupField = getField(model, groupToken.split(":")[0]);

  if (!data.length) {
    return (
      <div className="o-card m-4">
        <EmptyState title="Nothing to chart" hint="Widen the filters to see data." />
      </div>
    );
  }

  const handleClick = (entry: { key: string; label: string }) => {
    if (onDrill && groupField) onDrill(groupField.name, entry.key, entry.label);
  };

  return (
    <div className="p-4">
      <div className="o-card p-3">
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <label className="text-[var(--o-fs-xs)] text-[var(--o-text-muted)]">
            Measure
          </label>
          <select
            className="o-input"
            style={{ width: 190 }}
            value={measureName}
            onChange={(e) => onState({ ...state, measure: e.target.value })}
          >
            {measures.map((field) => (
              <option key={field.name} value={field.name}>
                {field.label}
              </option>
            ))}
          </select>

          <label className="text-[var(--o-fs-xs)] text-[var(--o-text-muted)] ml-2">
            Grouped by
          </label>
          <select
            className="o-input"
            style={{ width: 190 }}
            value={groupToken}
            onChange={(e) =>
              onState({ ...state, groupBy: [e.target.value], expanded: [] })
            }
          >
            {model.groupBys.map((token) => {
              const [name, granularity] = token.split(":");
              const field = getField(model, name);
              return (
                <option key={token} value={token}>
                  {field?.label ?? name}
                  {granularity ? ` (${granularity})` : ""}
                </option>
              );
            })}
          </select>

          <div className="ml-auto flex gap-1">
            {(["bar", "line", "pie"] as ChartKind[]).map((option) => (
              <button
                key={option}
                type="button"
                className="o-btn o-btn-secondary o-btn-sm"
                style={
                  kind === option
                    ? { background: "var(--o-brand-primary)", color: "white", borderColor: "var(--o-brand-primary)" }
                    : undefined
                }
                onClick={() => setKind(option)}
              >
                {option[0].toUpperCase() + option.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {anyMixed && (
          <p className="mb-2 text-[var(--o-fs-xs)] text-[var(--o-warning-text)]">
            Some groups mix units of measure. Those bars are omitted rather than
            adding kilograms to cartons - group by Unit, or filter to one unit,
            to chart them.
          </p>
        )}

        <div style={{ height: 380 }}>
          <ResponsiveContainer width="100%" height="100%">
            {kind === "bar" ? (
              <BarChart data={data} margin={{ top: 8, right: 16, bottom: 60, left: 8 }}>
                <CartesianGrid {...GRID_PROPS} />
                <XAxis
                  dataKey="label"
                  {...AXIS_PROPS}
                  angle={-35}
                  textAnchor="end"
                  height={70}
                  interval={0}
                  tickFormatter={(v: string) => shortLabel(v, 16)}
                />
                <YAxis {...AXIS_PROPS} width={70} tickFormatter={(v: number) => formatNumber(v, 0)} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--o-hover-bg)" }} />
                <Bar
                  dataKey="value"
                  name={measureField?.label ?? "Value"}
                  radius={[3, 3, 0, 0]}
                  onClick={(entry) => handleClick(entry as unknown as { key: string; label: string })}
                  cursor={onDrill ? "pointer" : undefined}
                >
                  {data.map((entry, i) => (
                    <Cell key={entry.key} fill={seriesColor(i)} />
                  ))}
                </Bar>
              </BarChart>
            ) : kind === "line" ? (
              <LineChart data={data} margin={{ top: 8, right: 16, bottom: 60, left: 8 }}>
                <CartesianGrid {...GRID_PROPS} />
                <XAxis
                  dataKey="label"
                  {...AXIS_PROPS}
                  angle={-35}
                  textAnchor="end"
                  height={70}
                  interval={0}
                  tickFormatter={(v: string) => shortLabel(v, 16)}
                />
                <YAxis {...AXIS_PROPS} width={70} tickFormatter={(v: number) => formatNumber(v, 0)} />
                <Tooltip content={<ChartTooltip />} />
                <Line
                  type="monotone"
                  dataKey="value"
                  name={measureField?.label ?? "Value"}
                  stroke="var(--o-action)"
                  strokeWidth={2}
                  dot={{ r: 2.5 }}
                />
              </LineChart>
            ) : (
              <PieChart>
                <Tooltip content={<ChartTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 11 }}
                  formatter={(value: string) => shortLabel(value, 22)}
                />
                <Pie
                  data={data.slice(0, 12)}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={60}
                  outerRadius={130}
                  paddingAngle={1}
                  onClick={(entry) => handleClick(entry as unknown as { key: string; label: string })}
                  cursor={onDrill ? "pointer" : undefined}
                >
                  {data.slice(0, 12).map((entry, i) => (
                    <Cell key={entry.key} fill={seriesColor(i)} />
                  ))}
                </Pie>
              </PieChart>
            )}
          </ResponsiveContainer>
        </div>

        <p className="mt-2 text-[var(--o-fs-xxs)] text-[var(--o-text-subtle)]">
          {rows.length.toLocaleString("en-GB")} records in scope
          {data.length === 30 ? ", showing the top 30 groups" : ""}.
          {onDrill ? " Select a segment to open its records." : ""}
        </p>
      </div>
    </div>
  );
}

/** Aggregate helper re-exported so dashboards can reuse the same maths. */
export { aggregate };
