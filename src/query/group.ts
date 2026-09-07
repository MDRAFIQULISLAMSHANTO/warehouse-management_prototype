/**
 * Grouping and aggregation.
 *
 * Rules that matter for correctness and are enforced here:
 *  - quantities are only summed within one unit of measure; a group holding
 *    kg and cartons reports "mixed", never a meaningless total;
 *  - percentages are never summed. Occupancy and fill are recomputed from
 *    their own numerator and denominator at every group level;
 *  - distinct counts are real distinct counts, so a card that counts unique
 *    pallets opens a list of that many unique pallets.
 */

import { formatDate } from "@/data/clock";

export type AggregateKind =
  | "sum"
  | "avg"
  | "min"
  | "max"
  | "count"
  | "distinct"
  | "ratio"
  | "none";

export interface AggregateDef {
  kind: AggregateKind;
  /** Field holding the unit; sums split by unit and report "mixed". */
  unitField?: string;
  /** For kind "ratio": percentage = sum(numerator) / count-or-sum(denominator). */
  numerator?: string;
  denominator?: string;
  /** For kind "ratio": count rows matching a boolean field instead of summing. */
  numeratorFlag?: string;
  denominatorFlag?: string;
  /** For kind "distinct": the field whose distinct values are counted. */
  of?: string;
  decimals?: number;
  suffix?: string;
}

export interface AggValue {
  kind: AggregateKind;
  value: number | null;
  unit?: string;
  mixed?: boolean;
  byUnit?: Record<string, number>;
  decimals?: number;
  suffix?: string;
}

type Row = Record<string, unknown>;

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const truthy = (v: unknown): boolean => v === true || v === "true" || v === 1;

export function aggregate(
  rows: readonly Row[],
  field: string,
  def: AggregateDef,
): AggValue {
  const decimals = def.decimals ?? 2;

  switch (def.kind) {
    case "count":
      return { kind: "count", value: rows.length, decimals: 0 };

    case "distinct": {
      const key = def.of ?? field;
      const seen = new Set<string>();
      for (const row of rows) {
        const v = row[key];
        if (v !== null && v !== undefined && v !== "") seen.add(String(v));
      }
      return { kind: "distinct", value: seen.size, decimals: 0 };
    }

    case "ratio": {
      let numerator = 0;
      let denominator = 0;
      for (const row of rows) {
        numerator += def.numeratorFlag
          ? truthy(row[def.numeratorFlag])
            ? 1
            : 0
          : num(row[def.numerator ?? field]);
        denominator += def.denominatorFlag
          ? truthy(row[def.denominatorFlag])
            ? 1
            : 0
          : def.denominator
            ? num(row[def.denominator])
            : 1;
      }
      return {
        kind: "ratio",
        value: denominator > 0 ? (numerator / denominator) * 100 : null,
        decimals: def.decimals ?? 1,
        suffix: def.suffix ?? "%",
      };
    }

    case "min":
    case "max": {
      let best: number | null = null;
      for (const row of rows) {
        const v = row[field];
        if (v === null || v === undefined || v === "") continue;
        const n = num(v);
        if (best === null) best = n;
        else best = def.kind === "min" ? Math.min(best, n) : Math.max(best, n);
      }
      return { kind: def.kind, value: best, decimals };
    }

    case "avg": {
      let total = 0;
      let n = 0;
      for (const row of rows) {
        const v = row[field];
        if (v === null || v === undefined || v === "") continue;
        total += num(v);
        n += 1;
      }
      return { kind: "avg", value: n ? total / n : null, decimals };
    }

    case "sum": {
      if (!def.unitField) {
        let total = 0;
        for (const row of rows) total += num(row[field]);
        return { kind: "sum", value: round(total, decimals), decimals };
      }
      const byUnit: Record<string, number> = {};
      for (const row of rows) {
        const v = row[field];
        if (v === null || v === undefined || v === "") continue;
        const unit = String(row[def.unitField] ?? "");
        if (!unit) continue;
        byUnit[unit] = (byUnit[unit] ?? 0) + num(v);
      }
      const units = Object.keys(byUnit);
      for (const unit of units) byUnit[unit] = round(byUnit[unit], decimals);
      if (units.length === 0) return { kind: "sum", value: 0, decimals };
      if (units.length === 1) {
        return {
          kind: "sum",
          value: byUnit[units[0]],
          unit: units[0],
          byUnit,
          decimals,
        };
      }
      // Incompatible units: report them separately, never as one number.
      return { kind: "sum", value: null, mixed: true, byUnit, decimals };
    }

    case "none":
    default:
      return { kind: "none", value: null };
  }
}

function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

// --------------------------------------------------------------- grouping

export type DateGranularity = "day" | "week" | "month" | "quarter" | "year";

export interface GroupSpec {
  field: string;
  granularity?: DateGranularity;
  /** The original "field:granularity" token. */
  token: string;
}

export function parseGroupSpec(token: string): GroupSpec {
  const [field, granularity] = token.split(":");
  return {
    field,
    granularity: granularity as DateGranularity | undefined,
    token,
  };
}

export function groupKeyFor(row: Row, spec: GroupSpec): { key: string; label: string } {
  const raw = row[spec.field];
  if (raw === null || raw === undefined || raw === "") {
    return { key: "__none__", label: "None" };
  }
  if (!spec.granularity) {
    return { key: String(raw), label: String(raw) };
  }
  const date = new Date(String(raw));
  if (Number.isNaN(date.getTime())) {
    return { key: String(raw), label: String(raw) };
  }
  const year = date.getUTCFullYear();
  switch (spec.granularity) {
    case "year":
      return { key: `${year}`, label: `${year}` };
    case "quarter": {
      const q = Math.floor(date.getUTCMonth() / 3) + 1;
      return { key: `${year}-Q${q}`, label: `Q${q} ${year}` };
    }
    case "month": {
      const m = String(date.getUTCMonth() + 1).padStart(2, "0");
      const label = new Intl.DateTimeFormat("en-GB", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(date);
      return { key: `${year}-${m}`, label };
    }
    case "week": {
      const { isoYear, isoWeek } = isoWeekOf(date);
      return {
        key: `${isoYear}-W${String(isoWeek).padStart(2, "0")}`,
        label: `W${isoWeek} ${isoYear}`,
      };
    }
    case "day":
    default: {
      const key = date.toISOString().slice(0, 10);
      return { key, label: formatDate(date.toISOString()) };
    }
  }
}

function isoWeekOf(date: Date): { isoYear: number; isoWeek: number } {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const isoYear = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const isoWeek = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { isoYear, isoWeek };
}

export interface GroupNode<T extends Row = Row> {
  /** Stable identity for expand/collapse state and URLs. */
  path: string;
  field: string;
  key: string;
  label: string;
  count: number;
  depth: number;
  rows: T[];
  children: GroupNode<T>[];
  aggregates: Record<string, AggValue>;
}

export function groupRows<T extends Row>(
  rows: readonly T[],
  tokens: string[],
  aggregates: Record<string, AggregateDef>,
  depth = 0,
  parentPath = "",
): GroupNode<T>[] {
  if (!tokens.length) return [];
  const spec = parseGroupSpec(tokens[0]);
  const buckets = new Map<string, { label: string; rows: T[] }>();

  for (const row of rows) {
    const { key, label } = groupKeyFor(row, spec);
    const bucket = buckets.get(key);
    if (bucket) bucket.rows.push(row);
    else buckets.set(key, { label, rows: [row] });
  }

  const nodes: GroupNode<T>[] = [];
  for (const [key, bucket] of buckets) {
    const path = parentPath ? `${parentPath}//${key}` : key;
    const aggValues: Record<string, AggValue> = {};
    for (const [field, def] of Object.entries(aggregates)) {
      aggValues[field] = aggregate(bucket.rows, field, def);
    }
    nodes.push({
      path,
      field: spec.field,
      key,
      label: bucket.label,
      count: bucket.rows.length,
      depth,
      rows: bucket.rows,
      children: groupRows(bucket.rows, tokens.slice(1), aggregates, depth + 1, path),
      aggregates: aggValues,
    });
  }

  nodes.sort((a, b) => {
    if (a.key === "__none__") return 1;
    if (b.key === "__none__") return -1;
    return a.label.localeCompare(b.label, undefined, { numeric: true });
  });
  return nodes;
}

export function formatAgg(value: AggValue | undefined): string {
  if (!value || value.value === null) {
    if (value?.mixed && value.byUnit) {
      return Object.entries(value.byUnit)
        .map(([unit, n]) => `${formatNumber(n, value.decimals ?? 2)} ${unit}`)
        .join(" / ");
    }
    return "";
  }
  const text = formatNumber(value.value, value.decimals ?? 2);
  if (value.suffix) return `${text}${value.suffix}`;
  if (value.unit) return `${text} ${value.unit}`;
  return text;
}

export function formatNumber(n: number, decimals = 2): string {
  return n.toLocaleString("en-GB", {
    minimumFractionDigits: Number.isInteger(n) ? 0 : decimals,
    maximumFractionDigits: decimals,
  });
}
