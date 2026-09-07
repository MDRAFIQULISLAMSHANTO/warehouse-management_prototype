/**
 * Human-readable rendering of a domain.
 *
 * Facets and saved searches show what a filter actually does in plain words -
 * "Fill % <= 50 and Warehouse is under RTW2" - rather than an opaque chip the
 * presenter cannot explain in the room.
 */

import { formatDate } from "@/data/clock";
import {
  LIST_OPERATORS,
  OPERATOR_LABELS,
  RANGE_OPERATORS,
  VALUELESS_OPERATORS,
  type Condition,
  type DomainNode,
} from "./domain";
import { getField, type ModelDef } from "./models";

export type LabelLookup = (fieldName: string, value: string) => string;

function valueText(
  model: ModelDef,
  condition: Condition,
  lookup?: LabelLookup,
): string {
  const field = getField(model, condition.field);
  const render = (raw: unknown): string => {
    const text = String(raw ?? "");
    if (!text) return "";
    if (field?.options) {
      const match = field.options.find((o) => o.value === text);
      if (match) return match.label;
    }
    if (field?.optionsKey && lookup) return lookup(condition.field, text);
    if (field?.type === "date" || field?.type === "datetime") {
      return formatDate(text);
    }
    if (field?.type === "boolean") {
      return text === "true" || text === "1" ? "Yes" : "No";
    }
    return text;
  };

  if (VALUELESS_OPERATORS.includes(condition.operator)) return "";
  if (RANGE_OPERATORS.includes(condition.operator)) {
    const pair = Array.isArray(condition.value) ? condition.value : [];
    return `${render(pair[0])} and ${render(pair[1])}`;
  }
  if (
    LIST_OPERATORS.includes(condition.operator) ||
    Array.isArray(condition.value)
  ) {
    const list = Array.isArray(condition.value)
      ? condition.value
      : [condition.value];
    return list.map(render).join(", ");
  }
  return render(condition.value);
}

export function describeCondition(
  model: ModelDef,
  condition: Condition,
  lookup?: LabelLookup,
): string {
  const field = getField(model, condition.field);
  const label = field?.label ?? condition.field;
  const operator = OPERATOR_LABELS[condition.operator] ?? condition.operator;
  const value = valueText(model, condition, lookup);
  return value ? `${label} ${operator} ${value}` : `${label} ${operator}`;
}

export function describeDomain(
  model: ModelDef,
  node: DomainNode,
  lookup?: LabelLookup,
  depth = 0,
): string {
  if (node.kind === "cond") return describeCondition(model, node, lookup);
  if (!node.children.length) return "";
  const joiner = node.op === "and" ? " and " : " or ";
  const parts = node.children
    .map((child) => describeDomain(model, child, lookup, depth + 1))
    .filter(Boolean);
  if (!parts.length) return "";
  if (parts.length === 1) return parts[0];
  const text = parts.join(joiner);
  return depth > 0 ? `(${text})` : text;
}

/** Short label for a facet chip: field names only, values in the white part. */
export function facetTitleFor(model: ModelDef, node: DomainNode): string {
  const fields = new Set<string>();
  const walk = (n: DomainNode) => {
    if (n.kind === "cond") {
      fields.add(getField(model, n.field)?.label ?? n.field);
    } else n.children.forEach(walk);
  };
  walk(node);
  const list = Array.from(fields);
  if (list.length === 1) return list[0];
  return "Custom Filter";
}
