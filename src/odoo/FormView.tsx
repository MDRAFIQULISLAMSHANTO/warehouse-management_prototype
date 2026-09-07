/**
 * Odoo-style form shell.
 *
 * Title and reference, contextual action buttons, a status bar for operations,
 * related-record smart buttons, a summary block, tabs, and previous/next
 * navigation through the record set the user arrived from.
 */

import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ControlPanel, type Crumb } from "./ControlPanel";
import { IconChevronLeft, IconChevronRight } from "./icons";

export interface StatusStep {
  id: string;
  label: string;
}

export interface FormViewProps {
  title: ReactNode;
  subtitle?: ReactNode;
  breadcrumbs?: Crumb[];
  /** Buttons on the left of the control panel. */
  actions?: ReactNode;
  /** Status bar steps, Odoo-style, left to right. */
  statusSteps?: StatusStep[];
  statusActive?: string;
  statusDone?: string[];
  smartButtons?: ReactNode;
  /** Key/value summary block under the title. */
  fields?: { label: string; value: ReactNode; hint?: string }[];
  tabs?: { id: string; label: string; count?: number; content: ReactNode }[];
  activeTab?: string;
  onTab?: (id: string) => void;
  children?: ReactNode;
  /** Previous / next within the originating record set. */
  siblings?: { ids: string[]; index: number; routeFor: (id: string) => string };
  banner?: ReactNode;
}

export function FormView({
  title,
  subtitle,
  breadcrumbs,
  actions,
  statusSteps,
  statusActive,
  statusDone = [],
  smartButtons,
  fields,
  tabs,
  activeTab,
  onTab,
  children,
  siblings,
  banner,
}: FormViewProps) {
  const navigate = useNavigate();
  const current = tabs?.find((t) => t.id === activeTab) ?? tabs?.[0];

  return (
    <>
      <ControlPanel
        title={title}
        breadcrumbs={breadcrumbs}
        actions={actions}
        subtitle={subtitle}
        pager={
          siblings && siblings.ids.length > 1
            ? {
                from: siblings.index + 1,
                to: siblings.index + 1,
                total: siblings.ids.length,
                onPrev: () => {
                  const prev = siblings.ids[siblings.index - 1];
                  if (prev) navigate(siblings.routeFor(prev));
                },
                onNext: () => {
                  const next = siblings.ids[siblings.index + 1];
                  if (next) navigate(siblings.routeFor(next));
                },
              }
            : undefined
        }
      />

      <div className="p-4">
        {banner}
        <div className="o-sheet max-w-[1500px] mx-auto">
          {statusSteps && statusSteps.length > 0 && (
            <div className="flex items-center justify-between gap-3 px-4 pt-3 flex-wrap">
              <div className="o-statusbar">
                {statusSteps.map((step) => (
                  <span
                    key={step.id}
                    className="o-status-step"
                    data-active={step.id === statusActive ? "true" : undefined}
                    data-done={statusDone.includes(step.id) ? "true" : undefined}
                  >
                    {step.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {smartButtons && (
            <div className="flex flex-wrap gap-2 px-4 pt-3">{smartButtons}</div>
          )}

          <div className="px-4 pt-3 pb-1">
            <h2 className="text-[var(--o-fs-2xl)] font-bold m-0 leading-tight">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 mb-0 text-[var(--o-fs-sm)] text-[var(--o-text-muted)]">
                {subtitle}
              </p>
            )}
          </div>

          {fields && fields.length > 0 && (
            <dl className="grid gap-x-8 gap-y-1.5 px-4 py-3 m-0 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
              {fields.map((field) => (
                <div
                  key={field.label}
                  className="flex gap-3 border-b border-[var(--o-border-subtle)] py-1"
                >
                  <dt
                    className="text-[var(--o-fs-sm)] text-[var(--o-text-muted)] m-0 min-w-[150px]"
                    title={field.hint}
                  >
                    {field.label}
                  </dt>
                  <dd className="text-[var(--o-fs-sm)] m-0 font-medium min-w-0 break-words">
                    {field.value}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {children && <div className="px-4 pb-3">{children}</div>}

          {tabs && tabs.length > 0 && (
            <div className="px-4 pb-4">
              <div
                role="tablist"
                className="flex gap-1 border-b border-[var(--o-border)] overflow-x-auto"
              >
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    role="tab"
                    type="button"
                    className="o-tab"
                    aria-selected={tab.id === current?.id}
                    onClick={() => onTab?.(tab.id)}
                  >
                    {tab.label}
                    {tab.count !== undefined && (
                      <span className="ml-1.5 text-[var(--o-fs-xs)] text-[var(--o-text-subtle)]">
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <div className="pt-3">{current?.content}</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/** Compact previous/next control for embedding elsewhere. */
export function SiblingNav({
  ids,
  index,
  routeFor,
}: {
  ids: string[];
  index: number;
  routeFor: (id: string) => string;
}) {
  if (ids.length <= 1) return null;
  const prev = ids[index - 1];
  const next = ids[index + 1];
  return (
    <div className="flex items-center gap-1 text-[var(--o-fs-xs)]">
      <span className="o-tabular">
        {index + 1} / {ids.length}
      </span>
      {prev ? (
        <Link className="o-btn o-btn-ghost o-btn-sm" to={routeFor(prev)} aria-label="Previous">
          <IconChevronLeft size={12} />
        </Link>
      ) : (
        <span className="o-btn o-btn-ghost o-btn-sm opacity-40">
          <IconChevronLeft size={12} />
        </span>
      )}
      {next ? (
        <Link className="o-btn o-btn-ghost o-btn-sm" to={routeFor(next)} aria-label="Next">
          <IconChevronRight size={12} />
        </Link>
      ) : (
        <span className="o-btn o-btn-ghost o-btn-sm opacity-40">
          <IconChevronRight size={12} />
        </span>
      )}
    </div>
  );
}

/** A small table used inside form tabs for related records. */
export function RelatedTable({
  columns,
  rows,
  empty = "Nothing related yet.",
}: {
  columns: { key: string; label: string; align?: "left" | "right"; width?: number }[];
  rows: Record<string, ReactNode>[];
  empty?: string;
}) {
  if (!rows.length) {
    return (
      <p className="text-[var(--o-fs-sm)] text-[var(--o-text-muted)] py-3 m-0">
        {empty}
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="o-list">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                style={{
                  width: column.width,
                  textAlign: column.align === "right" ? "right" : "left",
                }}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={String(row.__key ?? i)}>
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={column.align === "right" ? "num" : undefined}
                >
                  {row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
