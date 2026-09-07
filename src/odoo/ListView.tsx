/**
 * Odoo-style list view.
 *
 * Sorting, row selection with "select all matching", pagination, optional
 * columns, collapsible groups with real subtotals, numeric footers and CSV
 * export of the filtered scope - all reading the same rows the dashboards use.
 */

import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { AggregateDef, AggValue } from "@/query/group";
import { aggregate, formatAgg, groupRows } from "@/query/group";
import { getField, type FieldDef, type ModelDef } from "@/query/models";
import { toggleExpanded, withOrder, type SearchState } from "@/query/search";
import { exportValue, renderValue } from "./format";
import { IconChevronDown, IconChevronRight, IconDownload, IconSettings } from "./icons";
import { Dropdown, EmptyState, MenuItem, MenuTitle } from "./primitives";

type Row = Record<string, unknown>;

export interface ListViewProps {
  model: ModelDef;
  rows: Row[];
  state: SearchState;
  onState: (next: SearchState | ((prev: SearchState) => SearchState)) => void;
  /** Link target for the record in each row. */
  linkFor?: (row: Row) => string | undefined;
  /** Per-field custom cell rendering. */
  cellRenderers?: Record<string, (row: Row) => ReactNode>;
  emptyTitle?: string;
  emptyHint?: string;
  /** Rows shown per expanded group before a "more" note appears. */
  groupRowLimit?: number;
  height?: string;
}

const MAX_GROUP_ROWS = 200;

export function ListView({
  model,
  rows,
  state,
  onState,
  linkFor,
  cellRenderers,
  emptyTitle = "No records found",
  emptyHint = "Adjust the filters above to widen the search.",
  groupRowLimit = MAX_GROUP_ROWS,
  height = "calc(100vh - 190px)",
}: ListViewProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allMatching, setAllMatching] = useState(false);

  const columns = useMemo(() => {
    const names = [...model.defaultColumns, ...state.columns];
    const seen = new Set<string>();
    return names
      .filter((name) => (seen.has(name) ? false : (seen.add(name), true)))
      .map((name) => getField(model, name))
      .filter((f): f is FieldDef => !!f);
  }, [model, state.columns]);

  const optionalColumns = useMemo(
    () =>
      model.fields.filter(
        (f) => !model.defaultColumns.includes(f.name) && f.label && f.format !== undefined,
      ),
    [model],
  );

  const aggregates = useMemo(() => {
    const map: Record<string, AggregateDef> = {};
    for (const field of columns) {
      if (field.agg) map[field.name] = field.agg;
    }
    return map;
  }, [columns]);

  const grouped = state.groupBy.length > 0;

  const pageRows = useMemo(() => {
    if (grouped) return rows;
    const start = (state.page - 1) * state.pageSize;
    return rows.slice(start, start + state.pageSize);
  }, [rows, grouped, state.page, state.pageSize]);

  const groups = useMemo(
    () => (grouped ? groupRows(rows, state.groupBy, aggregates) : []),
    [grouped, rows, state.groupBy, aggregates],
  );

  const totals = useMemo(() => {
    const out: Record<string, AggValue> = {};
    for (const [name, def] of Object.entries(aggregates)) {
      out[name] = aggregate(rows, name, def);
    }
    return out;
  }, [rows, aggregates]);

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setAllMatching(false);
  };

  const toggleAllVisible = () => {
    const ids = pageRows.map((r) => String(r.id));
    const everySelected = ids.every((id) => selected.has(id));
    setSelected(everySelected ? new Set() : new Set(ids));
    setAllMatching(false);
  };

  const exportCsv = () => {
    const scope = allMatching || selected.size === 0
      ? rows
      : rows.filter((r) => selected.has(String(r.id)));
    downloadCsv(model, columns, scope);
  };

  const selectionCount = allMatching ? rows.length : selected.size;

  if (!rows.length) {
    return (
      <div className="o-card m-4">
        <EmptyState title={emptyTitle} hint={emptyHint} />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-0">
      {selectionCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-1.5 bg-[var(--o-action-tint)] border-b border-[var(--o-border)] text-[var(--o-fs-sm)]">
          <span>
            <strong className="o-tabular">{selectionCount.toLocaleString("en-GB")}</strong>{" "}
            selected
          </span>
          {!allMatching && selected.size < rows.length && (
            <button
              type="button"
              className="o-btn o-btn-link"
              onClick={() => setAllMatching(true)}
            >
              Select all {rows.length.toLocaleString("en-GB")} matching records
            </button>
          )}
          <button
            type="button"
            className="o-btn o-btn-link"
            onClick={() => {
              setSelected(new Set());
              setAllMatching(false);
            }}
          >
            Clear selection
          </button>
          <button type="button" className="o-btn o-btn-secondary o-btn-sm ml-auto" onClick={exportCsv}>
            <IconDownload size={11} /> Export selection
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 px-4 py-1.5 border-b border-[var(--o-border-subtle)]">
        <span className="text-[var(--o-fs-xs)] text-[var(--o-text-muted)] o-tabular">
          {rows.length.toLocaleString("en-GB")} {model.labelPlural.toLowerCase()}
          {grouped ? ` in ${groups.length} groups` : ""}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" className="o-btn o-btn-secondary o-btn-sm" onClick={exportCsv}>
            <IconDownload size={11} /> Export CSV
          </button>
          <Dropdown
            label={<IconSettings size={13} />}
            buttonClassName="o-btn o-btn-secondary o-btn-sm"
            width={260}
            align="right"
            title="Optional columns"
          >
            {() => (
              <>
                <MenuTitle>Optional columns</MenuTitle>
                {optionalColumns.map((field) => (
                  <MenuItem
                    key={field.name}
                    selected={state.columns.includes(field.name)}
                    onClick={() =>
                      onState((prev) => ({
                        ...prev,
                        columns: prev.columns.includes(field.name)
                          ? prev.columns.filter((c) => c !== field.name)
                          : [...prev.columns, field.name],
                      }))
                    }
                  >
                    <span className="w-3 inline-block">
                      {state.columns.includes(field.name) ? "✓" : ""}
                    </span>
                    {field.label}
                  </MenuItem>
                ))}
              </>
            )}
          </Dropdown>
        </div>
      </div>

      <div className="overflow-auto" style={{ maxHeight: height }}>
        <table className="o-list">
          <thead>
            <tr>
              <th style={{ width: 32 }}>
                <input
                  type="checkbox"
                  aria-label="Select all visible rows"
                  checked={
                    pageRows.length > 0 &&
                    pageRows.every((r) => selected.has(String(r.id)))
                  }
                  onChange={toggleAllVisible}
                />
              </th>
              {columns.map((field) => (
                <th
                  key={field.name}
                  style={{
                    width: field.width,
                    textAlign: field.align === "right" ? "right" : "left",
                    cursor: field.sortable ? "pointer" : "default",
                  }}
                  onClick={() =>
                    field.sortable && onState((prev) => withOrder(prev, field.name))
                  }
                  title={field.help}
                  aria-sort={
                    state.orderBy[0]?.field === field.name
                      ? state.orderBy[0].dir === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                >
                  {field.label}
                  {state.orderBy[0]?.field === field.name && (
                    <span className="ml-1 text-[var(--o-text-subtle)]">
                      {state.orderBy[0].dir === "asc" ? "▲" : "▼"}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {grouped
              ? groups.map((group) => (
                  <GroupRows
                    key={group.path}
                    group={group}
                    columns={columns}
                    state={state}
                    onState={onState}
                    model={model}
                    linkFor={linkFor}
                    cellRenderers={cellRenderers}
                    selected={selected}
                    onToggleRow={toggleRow}
                    limit={groupRowLimit}
                  />
                ))
              : pageRows.map((row) => (
                  <DataRow
                    key={String(row.id)}
                    row={row}
                    columns={columns}
                    linkFor={linkFor}
                    cellRenderers={cellRenderers}
                    selected={selected.has(String(row.id))}
                    onToggle={() => toggleRow(String(row.id))}
                    indent={0}
                  />
                ))}
          </tbody>

          {Object.keys(totals).length > 0 && (
            <tfoot>
              <tr>
                <td />
                {columns.map((field) => (
                  <td
                    key={field.name}
                    className={field.align === "right" ? "num" : undefined}
                  >
                    <AggCell value={totals[field.name]} />
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

/**
 * Aggregate cell. A group holding several units of measure lists each unit on
 * its own compact line rather than adding kilograms to cartons.
 */
function AggCell({ value }: { value: AggValue | undefined }) {
  if (!value) return null;
  if (value.mixed && value.byUnit) {
    const entries = Object.entries(value.byUnit);
    return (
      <span
        className="inline-flex flex-col items-end leading-tight"
        title={`Mixed units of measure: ${entries
          .map(([unit, n]) => `${n} ${unit}`)
          .join(", ")}. These are never added together.`}
      >
        {entries.map(([unit, n]) => (
          <span key={unit} className="text-[var(--o-fs-xxs)] whitespace-nowrap">
            {n.toLocaleString("en-GB", { maximumFractionDigits: 2 })}{" "}
            <span className="text-[var(--o-text-subtle)]">{unit}</span>
          </span>
        ))}
      </span>
    );
  }
  return <span className="whitespace-nowrap">{formatAgg(value)}</span>;
}

function GroupRows({
  group,
  columns,
  state,
  onState,
  model,
  linkFor,
  cellRenderers,
  selected,
  onToggleRow,
  limit,
}: {
  group: ReturnType<typeof groupRows>[number];
  columns: FieldDef[];
  state: SearchState;
  onState: (next: SearchState | ((prev: SearchState) => SearchState)) => void;
  model: ModelDef;
  linkFor?: (row: Row) => string | undefined;
  cellRenderers?: Record<string, (row: Row) => ReactNode>;
  selected: Set<string>;
  onToggleRow: (id: string) => void;
  limit: number;
}) {
  const open = state.expanded.includes(group.path);
  const field = getField(model, group.field);
  const label =
    field?.options?.find((o) => o.value === group.key)?.label ?? group.label;

  return (
    <>
      <tr
        className="cursor-pointer"
        style={{ background: group.depth === 0 ? "var(--o-gray-100)" : "var(--o-surface-hover)" }}
        onClick={() => onState((prev) => toggleExpanded(prev, group.path))}
      >
        <td />
        <td colSpan={1} style={{ paddingLeft: 8 + group.depth * 16 }}>
          <span className="inline-flex items-center gap-1.5 font-medium">
            {open ? <IconChevronDown size={11} /> : <IconChevronRight size={11} />}
            {label}
            <span className="text-[var(--o-text-subtle)] font-normal">
              ({group.count.toLocaleString("en-GB")})
            </span>
          </span>
        </td>
        {columns.slice(1).map((column) => (
          <td
            key={column.name}
            className={column.align === "right" ? "num font-medium" : "font-medium"}
          >
            <AggCell value={group.aggregates[column.name]} />
          </td>
        ))}
      </tr>

      {open &&
        (group.children.length > 0
          ? group.children.map((child) => (
              <GroupRows
                key={child.path}
                group={child}
                columns={columns}
                state={state}
                onState={onState}
                model={model}
                linkFor={linkFor}
                cellRenderers={cellRenderers}
                selected={selected}
                onToggleRow={onToggleRow}
                limit={limit}
              />
            ))
          : (
              <>
                {group.rows.slice(0, limit).map((row) => (
                  <DataRow
                    key={String(row.id)}
                    row={row}
                    columns={columns}
                    linkFor={linkFor}
                    cellRenderers={cellRenderers}
                    selected={selected.has(String(row.id))}
                    onToggle={() => onToggleRow(String(row.id))}
                    indent={group.depth + 1}
                  />
                ))}
                {group.rows.length > limit && (
                  <tr>
                    <td />
                    <td
                      colSpan={columns.length}
                      className="text-[var(--o-fs-xs)] text-[var(--o-text-muted)]"
                    >
                      Showing the first {limit.toLocaleString("en-GB")} of{" "}
                      {group.rows.length.toLocaleString("en-GB")} records in this
                      group. Narrow the filters or add another grouping level to
                      see the rest.
                    </td>
                  </tr>
                )}
              </>
            ))}
    </>
  );
}

function DataRow({
  row,
  columns,
  linkFor,
  cellRenderers,
  selected,
  onToggle,
  indent,
}: {
  row: Row;
  columns: FieldDef[];
  linkFor?: (row: Row) => string | undefined;
  cellRenderers?: Record<string, (row: Row) => ReactNode>;
  selected: boolean;
  onToggle: () => void;
  indent: number;
}) {
  const href = linkFor?.(row);

  return (
    <tr data-selected={selected ? "true" : undefined}>
      <td onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          aria-label="Select row"
          checked={selected}
          onChange={onToggle}
        />
      </td>
      {columns.map((field, i) => {
        const custom = cellRenderers?.[field.name];
        const content = custom ? custom(row) : renderValue(row[field.name], field, row);
        const isFirst = i === 0;
        return (
          <td
            key={field.name}
            className={field.align === "right" ? "num" : undefined}
            style={isFirst ? { paddingLeft: 8 + indent * 16 } : undefined}
          >
            {isFirst && href ? (
              <Link to={href} className="text-[var(--o-text-link)]">
                {content}
              </Link>
            ) : field.format === "link" && href ? (
              <Link to={href} className="text-[var(--o-text-link)]">
                {content}
              </Link>
            ) : (
              content
            )}
          </td>
        );
      })}
    </tr>
  );
}

// ------------------------------------------------------------------- csv

export function downloadCsv(
  model: ModelDef,
  columns: FieldDef[],
  rows: Row[],
): void {
  const escape = (value: string) =>
    /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

  const header = columns.map((c) => escape(c.label)).join(",");
  const body = rows
    .map((row) =>
      columns.map((c) => escape(exportValue(row[c.name], c))).join(","),
    )
    .join("\r\n");

  // A BOM keeps Excel happy with UTF-8 on Windows, which is where this will be
  // opened during the presentation.
  const blob = new Blob([`﻿${header}\r\n${body}`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${model.name}-export.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
