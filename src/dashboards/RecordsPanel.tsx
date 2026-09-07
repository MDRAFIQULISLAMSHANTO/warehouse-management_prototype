/**
 * "Open the records" panel.
 *
 * Dashboards deliberately hold no record tables. A dashboard that prints its
 * own list of pallets or stock lines is a worse list view: it cannot be sorted,
 * grouped, paged or exported, it shows an arbitrary handful of rows, and it
 * invites people to read those rows and believe they have seen the data.
 *
 * Every figure, chart segment and map cell on a dashboard already opens the
 * real list with the right filter attached. This panel is the same contract
 * made explicit: it states how many records the current scope holds and hands
 * the user to the list view that owns them.
 */

import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { listUrl } from "@/app/links";
import { formatInt } from "@/odoo/format";
import type { Facet } from "@/query/search";

export interface RecordsPanelProps {
  /** What the records are, e.g. "positions available for put-away". */
  label: string;
  count: number;
  /** Model and facets defining the primary destination. */
  model: string;
  facets: Facet[];
  /** Extra scopes worth one click of their own. */
  extra?: { label: string; model: string; facets: Facet[] }[];
  /** Optional line explaining what the destination contains. */
  note?: ReactNode;
  children?: ReactNode;
}

export function RecordsPanel({
  label,
  count,
  model,
  facets,
  extra = [],
  note,
  children,
}: RecordsPanelProps) {
  return (
    <section className="o-card p-3">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h3 className="o-section-heading text-[var(--o-fs-lg)]">
            Open the records
          </h3>
          <p className="mt-0.5 mb-0 text-[var(--o-fs-sm)] text-[var(--o-text-muted)]">
            <strong className="o-tabular text-[var(--o-text)]">
              {formatInt(count)}
            </strong>{" "}
            {label} in the current scope. Select any figure, chart segment or map
            position above to open a narrower set.
          </p>
          {note && (
            <p className="mt-1 mb-0 text-[var(--o-fs-xs)] text-[var(--o-text-subtle)]">
              {note}
            </p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {children}
          {extra.map((entry) => (
            <Link
              key={entry.label}
              className="o-btn o-btn-secondary o-btn-sm"
              to={listUrl(entry.model, entry.facets)}
            >
              {entry.label}
            </Link>
          ))}
          <Link
            className="o-btn o-btn-primary o-btn-sm"
            to={listUrl(model, facets)}
          >
            Open all {formatInt(count)}
          </Link>
        </div>
      </div>
    </section>
  );
}
