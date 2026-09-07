/**
 * Drill-down link builders.
 *
 * The interaction contract in one place: a widget declares the records it
 * represents, and this turns that into a URL whose filters arrive as visible,
 * removable facets. The destination therefore always shows exactly the records
 * behind the number that was clicked.
 */

import { cond, type DomainNode } from "@/query/domain";
import { getField, getModel } from "@/query/models";
import { buildDrilldownUrl, type Facet, type SearchState } from "@/query/search";

let seq = 0;

/** A labelled, removable facet carrying a drill-down condition. */
export function contextFacet(
  label: string,
  values: string[],
  domain: DomainNode,
  origin?: string,
): Facet {
  seq += 1;
  return {
    id: `ctx:${seq}:${label.toLowerCase().replace(/\s+/g, "-")}`,
    type: "context",
    label,
    values,
    domain,
    origin,
  };
}

/** Facet for a simple "field equals value" drill-down. */
export function fieldFacet(
  modelName: string,
  field: string,
  value: string | number | boolean,
  displayValue?: string,
  origin?: string,
): Facet {
  const model = getModel(modelName);
  const def = getField(model, field);
  const label = def?.label ?? field;
  const shown =
    displayValue ??
    def?.options?.find((o) => o.value === String(value))?.label ??
    String(value);
  return contextFacet(label, [shown], cond(field, "eq", value), origin);
}

/** Facet for a numeric threshold, e.g. "Quantity > 200". */
export function thresholdFacet(
  modelName: string,
  field: string,
  operator: "gt" | "gte" | "lt" | "lte",
  value: number,
  origin?: string,
): Facet {
  const model = getModel(modelName);
  const def = getField(model, field);
  const symbol = { gt: ">", gte: ">=", lt: "<", lte: "<=" }[operator];
  return contextFacet(
    def?.label ?? field,
    [`${symbol} ${value}`],
    cond(field, operator, value),
    origin,
  );
}

/** Facet restricting to a location and everything under it. */
export function locationFacet(
  modelName: string,
  field: string,
  id: string,
  displayName: string,
  origin?: string,
): Facet {
  const model = getModel(modelName);
  const def = getField(model, field);
  return contextFacet(
    def?.label ?? "Location",
    [`under ${displayName}`],
    cond(field, "child_of", id),
    origin,
  );
}

/** Build the URL for a filtered list of a model. */
export function listUrl(
  modelName: string,
  facets: Facet[],
  extra?: Partial<SearchState>,
): string {
  const model = getModel(modelName);
  return buildDrilldownUrl(model.route, model, facets, extra);
}

/** Build a URL for a report route that uses a model's list machinery. */
export function reportUrl(
  route: string,
  modelName: string,
  facets: Facet[],
  extra?: Partial<SearchState>,
): string {
  const model = getModel(modelName);
  return buildDrilldownUrl(route, model, facets, extra);
}

export const recordUrl = {
  pallet: (id: string) => `/pallets/${id}`,
  cell: (id: string) => `/locations/cells/${id}`,
  rack: (id: string) => `/locations/racks/${id}`,
  warehouse: (id: string) => `/locations/warehouses/${id}`,
  product: (id: string) => `/products/${id}`,
  lot: (id: string) => `/lots/${id}`,
  operation: (id: string) => `/operations/${id}`,
};
