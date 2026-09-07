/**
 * KPI card.
 *
 * Every card states what it counts and links to the records that produced it.
 * A card that counts distinct pallets opens a list of that many distinct
 * pallets - the destination is part of the card's definition, not an
 * afterthought.
 */

import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { IconArrowRight } from "@/odoo/icons";

export interface KpiProps {
  label: string;
  value: ReactNode;
  /** Small line under the value, e.g. "of 4,593 installed". */
  sub?: ReactNode;
  hint?: string;
  to?: string;
  tone?: "brand" | "action" | "ok" | "warn" | "bad" | "neutral" | "info";
  /** Optional inline bar, 0-100. */
  bar?: number;
}

/**
 * Value colours. The current Odoo dashboard sits each KPI on a soft pastel
 * wash and prints the figure in a darker tone of the same hue, which is what
 * `.o-tile.tone-*` in index.css provides.
 */
const TONE_COLOR: Record<string, string> = {
  brand: "var(--o-brand-primary)",
  action: "var(--o-action-dark)",
  ok: "var(--o-success-text)",
  warn: "var(--o-warning-text)",
  bad: "var(--o-danger-text)",
  neutral: "var(--o-gray-800)",
  info: "var(--o-info-text)",
};

export function Kpi({ label, value, sub, hint, to, tone = "brand", bar }: KpiProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[var(--o-fs-xs)] font-medium text-[var(--o-gray-700)] leading-snug">
          {label}
        </span>
        {to && (
          <span className="text-[var(--o-text-subtle)] opacity-0 group-hover:opacity-100 transition-opacity">
            <IconArrowRight size={12} />
          </span>
        )}
      </div>
      <div
        className="text-[var(--o-fs-3xl)] font-bold leading-tight o-tabular mt-0.5"
        style={{ color: TONE_COLOR[tone] }}
      >
        {value}
      </div>
      {bar !== undefined && (
        <div className="mt-1.5 h-1.5 rounded-full bg-[rgba(255,255,255,0.75)] overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.max(0, Math.min(100, bar))}%`,
              background: TONE_COLOR[tone],
            }}
          />
        </div>
      )}
      {sub && (
        <div className="mt-1 text-[var(--o-fs-xs)] text-[var(--o-text-muted)] leading-snug">
          {sub}
        </div>
      )}
    </>
  );

  const className = `o-tile tone-${tone} flex flex-col group no-underline text-[var(--o-text)] min-w-0`;

  if (to) {
    return (
      <Link
        to={to}
        className={`${className} transition-shadow hover:shadow-[var(--o-shadow-sm)]`}
        title={hint}
      >
        {body}
      </Link>
    );
  }
  return (
    <div className={className} title={hint}>
      {body}
    </div>
  );
}
