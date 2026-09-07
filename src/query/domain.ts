/**
 * Structured query model.
 *
 * Filters are data, never code: a condition is a {field, operator, value}
 * triple and groups combine with AND / OR. Nothing entered by a user is ever
 * evaluated as JavaScript. One evaluator serves dashboards, lists, charts,
 * maps, pivots and CSV export, so a KPI and the list behind it cannot drift.
 */

export type FieldType =
  | "text"
  | "number"
  | "date"
  | "datetime"
  | "selection"
  | "relation"
  | "boolean"
  | "location";

export type Operator =
  // text / reference
  | "contains"
  | "not_contains"
  | "eq"
  | "ne"
  | "set"
  | "not_set"
  // number
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "between"
  // date
  | "on"
  | "before"
  | "after"
  | "on_or_before"
  | "on_or_after"
  // selection / relation
  | "in"
  | "not_in"
  // location hierarchy
  | "child_of";

export interface Condition {
  kind: "cond";
  field: string;
  operator: Operator;
  value?: unknown;
}

export interface DomainGroup {
  kind: "group";
  op: "and" | "or";
  children: DomainNode[];
}

export type DomainNode = Condition | DomainGroup;

export const TRUE_DOMAIN: DomainGroup = { kind: "group", op: "and", children: [] };

export function and(...children: (DomainNode | null | undefined)[]): DomainGroup {
  return {
    kind: "group",
    op: "and",
    children: children.filter((c): c is DomainNode => !!c),
  };
}

export function or(...children: (DomainNode | null | undefined)[]): DomainGroup {
  return {
    kind: "group",
    op: "or",
    children: children.filter((c): c is DomainNode => !!c),
  };
}

export function cond(
  field: string,
  operator: Operator,
  value?: unknown,
): Condition {
  return { kind: "cond", field, operator, value };
}

/** Operators offered per field type, in the order the builder shows them. */
export const OPERATORS_BY_TYPE: Record<FieldType, Operator[]> = {
  text: ["contains", "not_contains", "eq", "ne", "set", "not_set"],
  number: ["eq", "ne", "gt", "gte", "lt", "lte", "between"],
  date: ["on", "before", "after", "on_or_before", "on_or_after", "between", "set", "not_set"],
  datetime: ["on", "before", "after", "on_or_before", "on_or_after", "between", "set", "not_set"],
  selection: ["eq", "ne", "in", "not_in"],
  relation: ["eq", "ne", "in", "not_in", "set", "not_set"],
  boolean: ["eq"],
  location: ["child_of", "eq", "ne", "in", "not_in"],
};

export const OPERATOR_LABELS: Record<Operator, string> = {
  contains: "contains",
  not_contains: "does not contain",
  eq: "=",
  ne: "!=",
  set: "is set",
  not_set: "is not set",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
  between: "is between",
  on: "is on",
  before: "is before",
  after: "is after",
  on_or_before: "is on or before",
  on_or_after: "is on or after",
  in: "is in",
  not_in: "is not in",
  child_of: "is under",
};

/** Operators that take no value. */
export const VALUELESS_OPERATORS: Operator[] = ["set", "not_set"];
/** Operators that take a pair of values. */
export const RANGE_OPERATORS: Operator[] = ["between"];
/** Operators that take a list of values. */
export const LIST_OPERATORS: Operator[] = ["in", "not_in"];

// ------------------------------------------------------------- evaluation

export interface EvalField {
  type: FieldType;
  /** For type "location": the row properties forming the ancestor chain. */
  hierarchyFields?: string[];
}

export type FieldResolver = (field: string) => EvalField | undefined;

type Row = Record<string, unknown>;

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function asText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

/** Dates compare as day keys so "on 12 Aug" matches any time that day. */
function asDayKey(value: unknown): string | undefined {
  if (!value) return undefined;
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const time = Date.parse(text);
  if (Number.isNaN(time)) return undefined;
  return new Date(time).toISOString().slice(0, 10);
}

function isEmpty(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

function evalCondition(
  row: Row,
  condition: Condition,
  resolve: FieldResolver,
): boolean {
  const def = resolve(condition.field);
  const type = def?.type ?? "text";
  const raw = row[condition.field];
  const { operator, value } = condition;

  switch (operator) {
    case "set":
      return !isEmpty(raw);
    case "not_set":
      return isEmpty(raw);
    case "child_of": {
      const targets = Array.isArray(value) ? value.map(String) : [String(value)];
      const chain = def?.hierarchyFields ?? [condition.field];
      return chain.some((f) => {
        const v = row[f];
        return v !== undefined && v !== null && targets.includes(String(v));
      });
    }
    default:
      break;
  }

  if (type === "boolean") {
    const want = value === true || value === "true" || value === 1;
    const have = raw === true || raw === "true" || raw === 1;
    return operator === "ne" ? have !== want : have === want;
  }

  if (type === "number") {
    const left = asNumber(raw);
    if (operator === "between") {
      const pair = Array.isArray(value) ? value : [];
      const lo = asNumber(pair[0]);
      const hi = asNumber(pair[1]);
      if (left === undefined) return false;
      if (lo !== undefined && left < lo) return false;
      if (hi !== undefined && left > hi) return false;
      return true;
    }
    const right = asNumber(value);
    if (left === undefined || right === undefined) return false;
    switch (operator) {
      case "eq":
        return left === right;
      case "ne":
        return left !== right;
      case "gt":
        return left > right;
      case "gte":
        return left >= right;
      case "lt":
        return left < right;
      case "lte":
        return left <= right;
      default:
        return false;
    }
  }

  if (type === "date" || type === "datetime") {
    const left = asDayKey(raw);
    if (operator === "between") {
      const pair = Array.isArray(value) ? value : [];
      const lo = asDayKey(pair[0]);
      const hi = asDayKey(pair[1]);
      if (!left) return false;
      if (lo && left < lo) return false;
      if (hi && left > hi) return false;
      return true;
    }
    const right = asDayKey(value);
    if (!left || !right) return false;
    switch (operator) {
      case "on":
      case "eq":
        return left === right;
      case "ne":
        return left !== right;
      case "before":
        return left < right;
      case "after":
        return left > right;
      case "on_or_before":
        return left <= right;
      case "on_or_after":
        return left >= right;
      default:
        return false;
    }
  }

  // text, selection, relation
  const left = asText(raw);
  switch (operator) {
    case "contains":
      return left.toLowerCase().includes(asText(value).toLowerCase());
    case "not_contains":
      return !left.toLowerCase().includes(asText(value).toLowerCase());
    case "eq":
      return left === asText(value);
    case "ne":
      return left !== asText(value);
    case "in": {
      const list = (Array.isArray(value) ? value : [value]).map(asText);
      return list.includes(left);
    }
    case "not_in": {
      const list = (Array.isArray(value) ? value : [value]).map(asText);
      return !list.includes(left);
    }
    default:
      return false;
  }
}

export function evaluate(
  row: Row,
  node: DomainNode,
  resolve: FieldResolver,
): boolean {
  if (node.kind === "cond") return evalCondition(row, node, resolve);
  if (node.children.length === 0) return true;
  return node.op === "and"
    ? node.children.every((child) => evaluate(row, child, resolve))
    : node.children.some((child) => evaluate(row, child, resolve));
}

export function filterRows<T extends Row>(
  rows: readonly T[],
  node: DomainNode,
  resolve: FieldResolver,
): T[] {
  if (node.kind === "group" && node.children.length === 0) return rows.slice();
  return rows.filter((row) => evaluate(row, node, resolve));
}

/** True when the domain imposes no restriction at all. */
export function isEmptyDomain(node: DomainNode): boolean {
  if (node.kind === "cond") return false;
  return node.children.every(isEmptyDomain);
}

// ---------------------------------------------------------------- sorting

export interface OrderBy {
  field: string;
  dir: "asc" | "desc";
}

export function sortRows<T extends Row>(
  rows: T[],
  order: OrderBy[],
  resolve: FieldResolver,
): T[] {
  if (!order.length) return rows;
  const sorted = rows.slice();
  sorted.sort((a, b) => {
    for (const { field, dir } of order) {
      const type = resolve(field)?.type ?? "text";
      const av = a[field];
      const bv = b[field];
      let result = 0;
      if (isEmpty(av) && isEmpty(bv)) result = 0;
      else if (isEmpty(av)) result = 1; // empties last, as Odoo does
      else if (isEmpty(bv)) result = -1;
      else if (type === "number") result = (asNumber(av) ?? 0) - (asNumber(bv) ?? 0);
      else if (type === "date" || type === "datetime")
        result = String(av).localeCompare(String(bv));
      else result = asText(av).localeCompare(asText(bv), undefined, { numeric: true });
      if (result !== 0) return dir === "desc" ? -result : result;
    }
    return 0;
  });
  return sorted;
}
