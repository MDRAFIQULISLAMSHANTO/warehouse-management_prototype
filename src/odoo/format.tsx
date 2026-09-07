/**
 * Value formatting.
 *
 * One formatter per field type, used by lists, forms, tooltips, exports and
 * chart labels alike, so the same number never appears two different ways in
 * two different places.
 */

import type { ReactNode } from "react";
import { formatDate, formatDateTime } from "@/data/clock";
import type { FieldDef } from "@/query/models";

export function formatNumber(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return "";
  return value.toLocaleString("en-GB", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatInt(value: number): string {
  if (!Number.isFinite(value)) return "";
  return Math.round(value).toLocaleString("en-GB");
}

export function formatQty(value: number, uom?: string): string {
  const text = formatNumber(value, 2);
  return uom ? `${text} ${uom}` : text;
}

export function formatPct(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return "";
  return `${value.toLocaleString("en-GB", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : decimals,
    maximumFractionDigits: decimals,
  })}%`;
}

/** Format a raw field value for display, using the field definition. */
export function formatValue(
  value: unknown,
  field: FieldDef | undefined,
  row?: Record<string, unknown>,
): string {
  if (value === null || value === undefined || value === "") return "";

  switch (field?.format) {
    case "int":
      return formatInt(Number(value));
    case "qty": {
      const uom = field.unitField ? String(row?.[field.unitField] ?? "") : "";
      return formatQty(Number(value), uom || undefined);
    }
    case "pct":
      return formatPct(Number(value));
    case "weight":
      return `${formatNumber(Number(value), 0)} kg`;
    case "date":
      return formatDate(String(value));
    case "datetime":
      return formatDateTime(String(value));
    default:
      break;
  }

  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return formatNumber(value, 2);

  // Selection fields render their label, not the stored key.
  if (field?.options) {
    const match = field.options.find((o) => o.value === String(value));
    if (match) return match.label;
  }
  return String(value);
}

/**
 * Text for CSV export: no thousands separators and ISO dates, so the file
 * opens cleanly in Excel, but selection values export the label the user saw
 * on screen rather than the internal key.
 */
export function exportValue(
  value: unknown,
  field: FieldDef | undefined,
): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (field?.format === "date" || field?.format === "datetime") {
    return String(value);
  }
  if (field?.options) {
    const match = field.options.find((o) => o.value === String(value));
    if (match) return match.label;
  }
  return String(value);
}

const STATE_TONE: Record<string, string> = {
  draft: "state-draft",
  waiting: "state-waiting",
  ready: "state-ready",
  done: "state-done",
  cancel: "state-cancel",
};

const STATE_LABEL: Record<string, string> = {
  draft: "Draft",
  waiting: "Waiting",
  ready: "Ready",
  done: "Done",
  cancel: "Cancelled",
};

export function StateBadge({ value }: { value: string }) {
  const tone = STATE_TONE[value] ?? "state-draft";
  const label = STATE_LABEL[value] ?? value;
  return <span className={`o-badge ${tone}`}>{label}</span>;
}

const BADGE_TONE: Record<string, string> = {
  // pallet status
  full: "tone-ok",
  partial: "tone-warn",
  empty: "tone-neutral",
  // cell status
  occupied: "tone-ok",
  blocked: "tone-bad",
  reserved_incoming: "tone-info",
};

const BADGE_LABEL: Record<string, string> = {
  full: "Full",
  partial: "Partially filled",
  empty: "Empty",
  occupied: "Occupied",
  blocked: "Blocked",
  reserved_incoming: "Reserved for incoming",
};

export function StatusBadge({ value }: { value: string }) {
  const tone = BADGE_TONE[value] ?? "tone-neutral";
  return (
    <span className={`o-badge ${tone}`}>{BADGE_LABEL[value] ?? value}</span>
  );
}

/** Render a cell value, including badge and link decoration. */
export function renderValue(
  value: unknown,
  field: FieldDef | undefined,
  row: Record<string, unknown>,
): ReactNode {
  if (value === null || value === undefined || value === "") {
    return <span className="text-[var(--o-text-subtle)]">&mdash;</span>;
  }
  if (field?.format === "state") return <StateBadge value={String(value)} />;
  if (field?.format === "badge") return <StatusBadge value={String(value)} />;
  return formatValue(value, field, row);
}

/** Percentage rendered as a compact bar plus its number. */
export function FillBar({
  value,
  tone,
  width = 68,
}: {
  value: number | undefined;
  tone?: string;
  width?: number;
}) {
  if (value === undefined || !Number.isFinite(value)) return null;
  const clamped = Math.max(0, Math.min(100, value));
  const colour =
    tone ??
    (clamped >= 99
      ? "var(--o-success)"
      : clamped >= 60
        ? "var(--o-occ-medium)"
        : "var(--o-action)");
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="inline-block rounded-full bg-[var(--o-gray-200)] overflow-hidden"
        style={{ width, height: 6 }}
      >
        <span
          className="block h-full rounded-full"
          style={{ width: `${clamped}%`, background: colour }}
        />
      </span>
      <span className="o-tabular text-[var(--o-fs-xs)]">{formatPct(value)}</span>
    </span>
  );
}
