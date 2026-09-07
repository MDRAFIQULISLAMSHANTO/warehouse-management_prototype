/**
 * Generic record list page.
 *
 * Every list, report and drill-down destination in the application is this
 * component with a different model and base scope, which is what makes the
 * filtering, grouping, exporting and URL behaviour identical everywhere.
 */

import { useEffect, useMemo, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { useSearchState } from "@/hooks/useSearchState";
import { ControlPanel, type Crumb } from "@/odoo/ControlPanel";
import { GraphView } from "@/odoo/GraphView";
import { ListView } from "@/odoo/ListView";
import { PivotView } from "@/odoo/PivotView";
import { filterRows, sortRows, type DomainNode } from "@/query/domain";
import { fieldResolver, getModel, type ModelDef } from "@/query/models";
import {
  SEARCH_PARAM,
  effectiveDomain,
  searchToParams,
  toggleFilter,
  withFacet,
  type ViewMode,
} from "@/query/search";
import { contextFacet } from "@/app/links";
import { cond } from "@/query/domain";
import { useDerived } from "@/store/appStore";

export interface RecordListProps {
  modelName: string;
  title: ReactNode;
  breadcrumbs?: Crumb[];
  /** Page-level scope, always AND-ed with the user's filters. */
  baseDomain?: DomainNode | null;
  /** Explanation shown under the title. */
  description?: ReactNode;
  actions?: ReactNode;
  views?: ViewMode[];
  linkFor?: (row: Record<string, unknown>) => string | undefined;
  cellRenderers?: Record<string, (row: Record<string, unknown>) => ReactNode>;
  emptyTitle?: string;
  emptyHint?: string;
  /** Applied once when the URL carries no search of its own. */
  initialFilterIds?: string[];
  initialGroupBy?: string[];
  initialOrder?: { field: string; dir: "asc" | "desc" }[];
}

/**
 * Menu links use `?preset=<filter id>` to open a pre-filtered list.
 *
 * The preset is consumed in a single URL write that both applies the filter and
 * removes the `preset` parameter. Doing it in two writes would leave `preset`
 * in the address bar, and a refresh would then toggle the filter straight back
 * off again.
 */
function usePreset(model: ModelDef) {
  const [params, setParams] = useSearchParams();
  const [state] = useSearchState(model);
  const preset = params.get("preset");

  useEffect(() => {
    if (!preset) return;
    const known = model.filters.some((f) => f.id === preset);
    const next = known ? toggleFilter(state, model, preset) : state;

    const keep = new URLSearchParams(params);
    keep.delete("preset");
    keep.delete(SEARCH_PARAM);
    setParams(searchToParams(next, model, keep), { replace: true });
    // Only reacts to the preset arriving in the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);
}

export function RecordList({
  modelName,
  title,
  breadcrumbs,
  baseDomain,
  description,
  actions,
  views,
  linkFor,
  cellRenderers,
  emptyTitle,
  emptyHint,
  initialFilterIds,
  initialGroupBy,
  initialOrder,
}: RecordListProps) {
  const model = getModel(modelName);
  const derived = useDerived();
  const [state, setState] = useSearchState(model);
  usePreset(model);

  // A page can open with a default scope; the URL always wins once it has one.
  const [params] = useSearchParams();
  const hasUrlSearch = !!params.get("q");
  useEffect(() => {
    if (hasUrlSearch) return;
    if (!initialFilterIds?.length && !initialGroupBy?.length && !initialOrder?.length) {
      return;
    }
    let next = state;
    for (const id of initialFilterIds ?? []) next = toggleFilter(next, model, id);
    if (initialGroupBy?.length) next = { ...next, groupBy: initialGroupBy };
    if (initialOrder?.length) next = { ...next, orderBy: initialOrder };
    setState(next);
    // Runs once per mount for a page that declares its own default view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resolve = useMemo(() => fieldResolver(model), [model]);
  const allRows = useMemo(() => model.rows(derived), [model, derived]);

  const rows = useMemo(() => {
    const domain = effectiveDomain(state, baseDomain);
    const filtered = filterRows(allRows, domain, resolve);
    return sortRows(filtered, state.orderBy, resolve);
  }, [allRows, state, baseDomain, resolve]);

  const link = linkFor ?? ((row) => model.recordRoute?.(String(row.id)));

  const pageFrom = rows.length ? (state.page - 1) * state.pageSize + 1 : 0;
  const pageTo = Math.min(state.page * state.pageSize, rows.length);

  return (
    <>
      <ControlPanel
        title={title}
        breadcrumbs={breadcrumbs}
        model={model}
        state={state}
        onState={setState}
        count={rows.length}
        actions={actions}
        views={views ?? model.views}
        subtitle={description}
        pager={
          state.view === "list" && state.groupBy.length === 0
            ? {
                from: pageFrom,
                to: pageTo,
                total: rows.length,
                onPrev: () =>
                  setState((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) })),
                onNext: () =>
                  setState((prev) => ({
                    ...prev,
                    page:
                      prev.page * prev.pageSize < rows.length
                        ? prev.page + 1
                        : prev.page,
                  })),
              }
            : undefined
        }
      />

      {state.view === "graph" ? (
        <GraphView
          model={model}
          rows={rows}
          state={state}
          onState={setState}
          onDrill={(field, key, label) =>
            setState((prev) =>
              withFacet(prev, contextFacet(label ? field : field, [label], cond(field, "eq", key))),
            )
          }
        />
      ) : state.view === "pivot" ? (
        <PivotView model={model} rows={rows} state={state} onState={setState} />
      ) : (
        <ListView
          model={model}
          rows={rows}
          state={state}
          onState={setState}
          linkFor={link}
          cellRenderers={cellRenderers}
          emptyTitle={emptyTitle}
          emptyHint={emptyHint}
        />
      )}
    </>
  );
}
