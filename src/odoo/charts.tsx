/**
 * Shared chart styling.
 *
 * Every chart in the application pulls its colours, axis treatment and tooltip
 * from here, so the dashboards read as one system rather than eight separate
 * experiments. Colours come from the design tokens, not from Recharts defaults.
 */

import type { ReactNode } from "react";
import { formatNumber } from "./format";

export const SERIES_COLORS = [
  "var(--o-series-1)",
  "var(--o-series-2)",
  "var(--o-series-3)",
  "var(--o-series-4)",
  "var(--o-series-5)",
  "var(--o-series-6)",
  "var(--o-series-7)",
  "var(--o-series-8)",
];

export const OCCUPANCY_COLORS = {
  occupied: "var(--o-action)",
  empty: "var(--o-occ-empty)",
  blocked: "var(--o-occ-blocked)",
  reserved_incoming: "var(--o-occ-reserved)",
} as const;

export const PALLET_STATUS_COLORS = {
  full: "var(--o-series-2)",
  partial: "var(--o-occ-partial)",
  empty: "var(--o-gray-400)",
} as const;

export const MATERIAL_COLORS = {
  RM: "var(--o-series-1)",
  FG: "var(--o-series-2)",
  PM: "var(--o-series-3)",
} as const;

export function seriesColor(index: number): string {
  return SERIES_COLORS[index % SERIES_COLORS.length];
}

export const AXIS_PROPS = {
  tick: { fontSize: 11, fill: "var(--o-gray-600)" },
  axisLine: { stroke: "var(--o-border)" },
  tickLine: false,
} as const;

export const GRID_PROPS = {
  stroke: "var(--o-border-subtle)",
  strokeDasharray: "3 3",
  vertical: false,
} as const;

interface TooltipEntry {
  name?: string | number;
  value?: number | string;
  color?: string;
  payload?: Record<string, unknown>;
}

/** Tooltip matching Odoo's compact popover styling. */
export function ChartTooltip({
  active,
  payload,
  label,
  unit,
  valueFormatter,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  unit?: string;
  valueFormatter?: (value: number, entry: TooltipEntry) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="o-popover px-2.5 py-1.5 text-[var(--o-fs-xs)]">
      {label !== undefined && label !== "" && (
        <div className="font-medium mb-1">{String(label)}</div>
      )}
      {payload.map((entry, i) => {
        const numeric = typeof entry.value === "number" ? entry.value : Number(entry.value);
        const text = valueFormatter
          ? valueFormatter(numeric, entry)
          : `${formatNumber(numeric, 2)}${unit ? ` ${unit}` : ""}`;
        return (
          <div key={i} className="flex items-center gap-2 whitespace-nowrap">
            <span
              className="inline-block w-2 h-2 rounded-sm"
              style={{ background: entry.color }}
            />
            <span className="text-[var(--o-text-muted)]">{entry.name}</span>
            <span className="ml-auto o-tabular font-medium">{text}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Card wrapper used by every dashboard panel. */
export function ChartCard({
  title,
  hint,
  right,
  children,
  height = 240,
  footer,
  className = "",
}: {
  title: ReactNode;
  hint?: string;
  right?: ReactNode;
  children: ReactNode;
  height?: number;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`o-card p-3 flex flex-col ${className}`}>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        {/* Teal panel headings, as in the current Odoo dashboards. */}
        <h3 className="o-section-heading text-[var(--o-fs-lg)]" title={hint}>
          {title}
        </h3>
        {right}
      </div>
      <div style={{ height }} className="min-w-0">
        {children}
      </div>
      {footer && (
        <div className="mt-2 text-[var(--o-fs-xxs)] text-[var(--o-text-subtle)]">
          {footer}
        </div>
      )}
    </section>
  );
}

/** Truncate long category labels so axes stay readable. */
export function shortLabel(value: string, max = 18): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}
