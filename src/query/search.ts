/**
 * Search state: facets, grouping, ordering, paging - and its URL encoding.
 *
 * The URL is the state. Every list and dashboard round-trips its whole search
 * through the query string, so a link can be copied, refreshed, bookmarked or
 * sent to a colleague and reopen exactly the same view. Drill-downs arrive as
 * "context" facets: visible, labelled and removable, exactly like the facets a
 * user creates by hand.
 */

import { and, type DomainNode, type OrderBy } from "./domain";
import { filterSelectionToDomain, type ModelDef } from "./models";

export type FacetType = "search" | "filter" | "custom" | "context";

export interface Facet {
  id: string;
  type: FacetType;
  /** Shown in the coloured part of the chip. */
  label: string;
  /** Shown in the white part of the chip, joined with "or". */
  values: string[];
  domain: DomainNode;
  /** Predefined filter ids, so the Filters menu can show ticks. */
  filterIds?: string[];
  /** Search facets remember which field they searched. */
  field?: string;
  /** Where a context facet came from, for the "back to" affordance. */
  origin?: string;
}

export type ViewMode = "list" | "graph" | "pivot" | "map";

export interface SearchState {
  facets: Facet[];
  groupBy: string[];
  orderBy: OrderBy[];
  page: number;
  pageSize: number;
  view: ViewMode;
  /** Expanded group paths when grouping is active. */
  expanded: string[];
  /** Optional columns switched on by the user. */
  columns: string[];
  /** Chart measure for the graph view. */
  measure?: string;
  /** Pivot column grouping. */
  pivotCols?: string[];
}

export const DEFAULT_PAGE_SIZE = 80;

export function defaultSearchState(model: ModelDef): SearchState {
  return {
    facets: [],
    groupBy: [],
    orderBy: model.defaultOrder.slice(),
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    view: "list",
    expanded: [],
    columns: [],
    pivotCols: [],
  };
}

/** AND of the base scope and every facet. */
export function effectiveDomain(
  state: SearchState,
  base?: DomainNode | null,
): DomainNode {
  return and(base ?? null, ...state.facets.map((f) => f.domain));
}

// ------------------------------------------------------------ mutations

export function withFacet(state: SearchState, facet: Facet): SearchState {
  const existing = state.facets.findIndex((f) => f.id === facet.id);
  const facets =
    existing >= 0
      ? state.facets.map((f, i) => (i === existing ? facet : f))
      : [...state.facets, facet];
  return { ...state, facets, page: 1 };
}

export function withoutFacet(state: SearchState, id: string): SearchState {
  return { ...state, facets: state.facets.filter((f) => f.id !== id), page: 1 };
}

export function clearFacets(state: SearchState): SearchState {
  return { ...state, facets: [], page: 1 };
}

/** Toggle a predefined filter, rebuilding the single "Filters" facet. */
export function toggleFilter(
  state: SearchState,
  model: ModelDef,
  filterId: string,
): SearchState {
  const current = state.facets.find((f) => f.type === "filter");
  const selected = new Set(current?.filterIds ?? []);
  if (selected.has(filterId)) selected.delete(filterId);
  else selected.add(filterId);

  const ids = Array.from(selected);
  if (!ids.length) return withoutFacet(state, "filters");

  const labels = ids
    .map((id) => model.filters.find((f) => f.id === id)?.label ?? id)
    .filter(Boolean);

  return withFacet(state, {
    id: "filters",
    type: "filter",
    label: "Filters",
    values: labels,
    filterIds: ids,
    domain: filterSelectionToDomain(model, ids),
  });
}

export function selectedFilterIds(state: SearchState): string[] {
  return state.facets.find((f) => f.type === "filter")?.filterIds ?? [];
}

export function withGroupBy(state: SearchState, tokens: string[]): SearchState {
  return { ...state, groupBy: tokens, page: 1, expanded: [] };
}

export function toggleGroupBy(state: SearchState, token: string): SearchState {
  const has = state.groupBy.includes(token);
  const groupBy = has
    ? state.groupBy.filter((t) => t !== token)
    : [...state.groupBy, token];
  return withGroupBy(state, groupBy);
}

export function withOrder(state: SearchState, field: string): SearchState {
  const current = state.orderBy[0];
  const dir: OrderBy["dir"] =
    current && current.field === field && current.dir === "asc" ? "desc" : "asc";
  return { ...state, orderBy: [{ field, dir }] };
}

export function toggleExpanded(state: SearchState, path: string): SearchState {
  const has = state.expanded.includes(path);
  return {
    ...state,
    expanded: has
      ? state.expanded.filter((p) => p !== path)
      : [...state.expanded, path],
  };
}

// -------------------------------------------------------------- encoding

interface EncodedState {
  f?: Facet[];
  g?: string[];
  o?: OrderBy[];
  p?: number;
  s?: number;
  v?: ViewMode;
  e?: string[];
  c?: string[];
  m?: string;
  pc?: string[];
}

const PARAM = "q";

export function encodeSearch(state: SearchState, model: ModelDef): string {
  const payload: EncodedState = {};
  if (state.facets.length) payload.f = state.facets;
  if (state.groupBy.length) payload.g = state.groupBy;
  if (JSON.stringify(state.orderBy) !== JSON.stringify(model.defaultOrder)) {
    payload.o = state.orderBy;
  }
  if (state.page !== 1) payload.p = state.page;
  if (state.pageSize !== DEFAULT_PAGE_SIZE) payload.s = state.pageSize;
  if (state.view !== "list") payload.v = state.view;
  if (state.expanded.length) payload.e = state.expanded;
  if (state.columns.length) payload.c = state.columns;
  if (state.measure) payload.m = state.measure;
  if (state.pivotCols?.length) payload.pc = state.pivotCols;
  if (!Object.keys(payload).length) return "";
  return JSON.stringify(payload);
}

export function decodeSearch(
  raw: string | null,
  model: ModelDef,
): SearchState {
  const base = defaultSearchState(model);
  if (!raw) return base;
  try {
    const payload = JSON.parse(raw) as EncodedState;
    return {
      facets: Array.isArray(payload.f) ? payload.f : [],
      groupBy: Array.isArray(payload.g) ? payload.g : [],
      orderBy: Array.isArray(payload.o) ? payload.o : base.orderBy,
      page: typeof payload.p === "number" ? payload.p : 1,
      pageSize: typeof payload.s === "number" ? payload.s : DEFAULT_PAGE_SIZE,
      view: payload.v ?? "list",
      expanded: Array.isArray(payload.e) ? payload.e : [],
      columns: Array.isArray(payload.c) ? payload.c : [],
      measure: payload.m,
      pivotCols: Array.isArray(payload.pc) ? payload.pc : [],
    };
  } catch {
    // A malformed link should open the default view, not a blank screen.
    return base;
  }
}

export function searchToParams(
  state: SearchState,
  model: ModelDef,
  existing?: URLSearchParams,
): URLSearchParams {
  const params = new URLSearchParams(existing ?? undefined);
  const encoded = encodeSearch(state, model);
  if (encoded) params.set(PARAM, encoded);
  else params.delete(PARAM);
  return params;
}

export function paramsToSearch(
  params: URLSearchParams,
  model: ModelDef,
): SearchState {
  return decodeSearch(params.get(PARAM), model);
}

export const SEARCH_PARAM = PARAM;

/** Build the link a drill-down should navigate to. */
export function buildDrilldownUrl(
  route: string,
  model: ModelDef,
  facets: Facet[],
  extra?: Partial<SearchState>,
): string {
  const state: SearchState = {
    ...defaultSearchState(model),
    ...extra,
    facets,
  };
  const params = searchToParams(state, model);
  const query = params.toString();
  return query ? `${route}?${query}` : route;
}
