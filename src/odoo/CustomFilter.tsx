/**
 * Add Custom Filter - a working condition builder.
 *
 * Conditions are built as data ({field, operator, value}) and combined with
 * Match all / Match any, including nested branches. Nothing typed by the user
 * is ever evaluated as code. Operator choices come from the field's type, and
 * a condition with a missing value is dropped on apply rather than silently
 * matching everything.
 */

import { useMemo, useState } from "react";
import { useFieldOptions, type Option } from "@/hooks/useOptions";
import {
  LIST_OPERATORS,
  OPERATORS_BY_TYPE,
  OPERATOR_LABELS,
  RANGE_OPERATORS,
  VALUELESS_OPERATORS,
  type Condition,
  type DomainGroup,
  type DomainNode,
  type Operator,
} from "@/query/domain";
import { getField, type FieldDef, type ModelDef } from "@/query/models";
import { Dialog } from "./primitives";
import { IconClose, IconPlus } from "./icons";

let uid = 0;
const nextKey = () => `c${(uid += 1)}`;

interface Props {
  model: ModelDef;
  initial?: DomainNode;
  onApply: (node: DomainNode) => void;
  onClose: () => void;
}

function defaultCondition(model: ModelDef): Condition {
  const field =
    model.fields.find((f) => f.filterable) ?? model.fields[0];
  const operators = OPERATORS_BY_TYPE[field.type];
  return { kind: "cond", field: field.name, operator: operators[0], value: "" };
}

/** Drop conditions the user left incomplete instead of matching everything. */
function prune(node: DomainNode): DomainNode | null {
  if (node.kind === "cond") {
    if (VALUELESS_OPERATORS.includes(node.operator)) return node;
    if (RANGE_OPERATORS.includes(node.operator)) {
      const pair = Array.isArray(node.value) ? node.value : [];
      const filled = pair.filter((v) => v !== "" && v !== undefined && v !== null);
      return filled.length === 2 ? node : null;
    }
    if (LIST_OPERATORS.includes(node.operator)) {
      const list = Array.isArray(node.value) ? node.value : [];
      return list.length ? node : null;
    }
    return node.value === "" || node.value === undefined || node.value === null
      ? null
      : node;
  }
  const children = node.children
    .map(prune)
    .filter((child): child is DomainNode => !!child);
  return children.length ? { ...node, children } : null;
}

export function CustomFilterDialog({ model, initial, onApply, onClose }: Props) {
  const [root, setRoot] = useState<DomainGroup>(() => {
    if (initial && initial.kind === "group") return initial;
    if (initial) return { kind: "group", op: "and", children: [initial] };
    return { kind: "group", op: "and", children: [defaultCondition(model)] };
  });
  const [error, setError] = useState<string | null>(null);

  const filterableFields = useMemo(
    () => model.fields.filter((f) => f.filterable !== false && f.label),
    [model],
  );

  const replaceAt = (path: number[], value: DomainNode | null) => {
    const clone = (node: DomainGroup, at: number[]): DomainGroup => {
      const [head, ...rest] = at;
      const children = node.children.slice();
      if (rest.length === 0) {
        if (value === null) children.splice(head, 1);
        else children[head] = value;
      } else {
        children[head] = clone(children[head] as DomainGroup, rest);
      }
      return { ...node, children };
    };
    setRoot((prev) => clone(prev, path));
  };

  const apply = () => {
    const pruned = prune(root);
    if (!pruned) {
      setError("Add at least one complete condition before applying.");
      return;
    }
    onApply(pruned);
  };

  return (
    <Dialog
      title="Add Custom Filter"
      width={760}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="o-btn o-btn-secondary" onClick={onClose}>
            Discard
          </button>
          <button type="button" className="o-btn o-btn-primary" onClick={apply}>
            Add
          </button>
        </>
      }
    >
      <GroupEditor
        model={model}
        fields={filterableFields}
        node={root}
        path={[]}
        depth={0}
        onChange={(next) => setRoot(next as DomainGroup)}
        onReplace={replaceAt}
      />
      {error && (
        <p className="mt-3 text-[var(--o-fs-sm)] text-[var(--o-danger-text)]">
          {error}
        </p>
      )}
      <p className="mt-4 text-[var(--o-fs-xs)] text-[var(--o-text-muted)]">
        Conditions are stored as structured data and evaluated by the
        application's query engine. Location conditions using{" "}
        <em>is under</em> include everything below the selected warehouse, aisle
        or rack.
      </p>
    </Dialog>
  );
}

interface GroupEditorProps {
  model: ModelDef;
  fields: FieldDef[];
  node: DomainGroup;
  path: number[];
  depth: number;
  onChange: (next: DomainNode) => void;
  onReplace: (path: number[], value: DomainNode | null) => void;
}

function GroupEditor({
  model,
  fields,
  node,
  path,
  depth,
  onChange,
  onReplace,
}: GroupEditorProps) {
  const setOp = (op: "and" | "or") => onChange({ ...node, op });

  const addCondition = () =>
    onChange({ ...node, children: [...node.children, defaultCondition(model)] });

  const addBranch = () =>
    onChange({
      ...node,
      children: [
        ...node.children,
        {
          kind: "group",
          op: node.op === "and" ? "or" : "and",
          children: [defaultCondition(model)],
        },
      ],
    });

  return (
    <div
      className={
        depth > 0
          ? "border-l-2 border-[var(--o-border-strong)] pl-3 ml-1 py-2"
          : ""
      }
    >
      <div className="flex items-center gap-2 mb-2 text-[var(--o-fs-sm)]">
        <span>Match</span>
        <select
          className="o-input"
          style={{ width: 90 }}
          value={node.op}
          onChange={(e) => setOp(e.target.value as "and" | "or")}
        >
          <option value="and">all</option>
          <option value="any">any</option>
        </select>
        <span>of the following rules:</span>
      </div>

      <div className="flex flex-col gap-2">
        {node.children.map((child, i) =>
          child.kind === "group" ? (
            <div key={`g${i}`} className="relative">
              <button
                type="button"
                className="o-btn o-btn-ghost o-btn-sm absolute right-0 top-0"
                onClick={() => onReplace([...path, i], null)}
                aria-label="Remove branch"
              >
                <IconClose size={11} />
              </button>
              <GroupEditor
                model={model}
                fields={fields}
                node={child}
                path={[...path, i]}
                depth={depth + 1}
                onChange={(next) => onReplace([...path, i], next)}
                onReplace={onReplace}
              />
            </div>
          ) : (
            <ConditionRow
              key={`c${i}`}
              model={model}
              fields={fields}
              condition={child}
              onChange={(next) => onReplace([...path, i], next)}
              onRemove={() => onReplace([...path, i], null)}
            />
          ),
        )}
      </div>

      <div className="flex gap-2 mt-2">
        <button type="button" className="o-btn o-btn-secondary o-btn-sm" onClick={addCondition}>
          <IconPlus size={11} /> New Rule
        </button>
        {depth < 2 && (
          <button type="button" className="o-btn o-btn-secondary o-btn-sm" onClick={addBranch}>
            <IconPlus size={11} /> Add Branch
          </button>
        )}
      </div>
    </div>
  );
}

function ConditionRow({
  model,
  fields,
  condition,
  onChange,
  onRemove,
}: {
  model: ModelDef;
  fields: FieldDef[];
  condition: Condition;
  onChange: (next: Condition) => void;
  onRemove: () => void;
}) {
  const field = getField(model, condition.field) ?? fields[0];
  const operators = OPERATORS_BY_TYPE[field.type];

  const changeField = (name: string) => {
    const next = getField(model, name)!;
    const ops = OPERATORS_BY_TYPE[next.type];
    onChange({
      kind: "cond",
      field: name,
      operator: ops.includes(condition.operator) ? condition.operator : ops[0],
      value: LIST_OPERATORS.includes(condition.operator) ? [] : "",
    });
  };

  const changeOperator = (operator: Operator) => {
    const wasList = LIST_OPERATORS.includes(condition.operator);
    const isList = LIST_OPERATORS.includes(operator);
    const isRange = RANGE_OPERATORS.includes(operator);
    let value = condition.value;
    if (isList && !wasList) value = condition.value ? [condition.value] : [];
    else if (!isList && wasList) value = "";
    if (isRange) value = ["", ""];
    onChange({ ...condition, operator, value });
  };

  return (
    <div className="flex items-start gap-2 flex-wrap bg-[var(--o-gray-100)] border border-[var(--o-border)] rounded-[var(--o-radius)] px-2 py-2">
      <select
        className="o-input"
        style={{ width: 200 }}
        value={condition.field}
        onChange={(e) => changeField(e.target.value)}
        aria-label="Field"
      >
        {fields.map((f) => (
          <option key={f.name} value={f.name}>
            {f.label}
          </option>
        ))}
      </select>

      <select
        className="o-input"
        style={{ width: 150 }}
        value={condition.operator}
        onChange={(e) => changeOperator(e.target.value as Operator)}
        aria-label="Operator"
      >
        {operators.map((op) => (
          <option key={op} value={op}>
            {OPERATOR_LABELS[op]}
          </option>
        ))}
      </select>

      <ValueEditor
        field={field}
        operator={condition.operator}
        value={condition.value}
        onChange={(value) => onChange({ ...condition, value })}
      />

      <button
        type="button"
        className="o-btn o-btn-ghost o-btn-sm ml-auto"
        onClick={onRemove}
        aria-label="Remove condition"
      >
        <IconClose size={11} />
      </button>
    </div>
  );
}

export function ValueEditor({
  field,
  operator,
  value,
  onChange,
}: {
  field: FieldDef;
  operator: Operator;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const dynamic = useFieldOptions(field.optionsKey);
  const options: Option[] = field.options ?? dynamic;

  if (VALUELESS_OPERATORS.includes(operator)) {
    return (
      <span className="text-[var(--o-fs-sm)] text-[var(--o-text-muted)] self-center">
        no value needed
      </span>
    );
  }

  if (RANGE_OPERATORS.includes(operator)) {
    const pair = Array.isArray(value) ? value : ["", ""];
    const inputType =
      field.type === "date" || field.type === "datetime" ? "date" : "number";
    return (
      <span className="flex items-center gap-1">
        <input
          className="o-input"
          style={{ width: 130 }}
          type={inputType}
          value={String(pair[0] ?? "")}
          onChange={(e) => onChange([e.target.value, pair[1] ?? ""])}
          aria-label="From"
        />
        <span className="text-[var(--o-fs-xs)]">and</span>
        <input
          className="o-input"
          style={{ width: 130 }}
          type={inputType}
          value={String(pair[1] ?? "")}
          onChange={(e) => onChange([pair[0] ?? "", e.target.value])}
          aria-label="To"
        />
      </span>
    );
  }

  if (LIST_OPERATORS.includes(operator) && options.length) {
    const selected = Array.isArray(value) ? value.map(String) : [];
    return <MultiSelect options={options} selected={selected} onChange={onChange} />;
  }

  if (field.type === "boolean") {
    return (
      <select
        className="o-input"
        style={{ width: 130 }}
        value={String(value ?? "true")}
        onChange={(e) => onChange(e.target.value === "true")}
        aria-label="Value"
      >
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    );
  }

  if (options.length) {
    return (
      <SearchableSelect
        options={options}
        value={String(value ?? "")}
        onChange={onChange}
      />
    );
  }

  if (field.type === "number") {
    return (
      <input
        className="o-input"
        style={{ width: 150 }}
        type="number"
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        aria-label="Value"
      />
    );
  }

  if (field.type === "date" || field.type === "datetime") {
    return (
      <input
        className="o-input"
        style={{ width: 160 }}
        type="date"
        value={String(value ?? "").slice(0, 10)}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Value"
      />
    );
  }

  return (
    <input
      className="o-input"
      style={{ width: 220 }}
      type="text"
      value={String(value ?? "")}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Value"
      placeholder="Value"
    />
  );
}

/** Type-ahead single select; renders only a slice so 4,600 cells stay usable. */
export function SearchableSelect({
  options,
  value,
  onChange,
  width = 240,
  placeholder = "Select...",
}: {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  width?: number;
  placeholder?: string;
}) {
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);

  const matches = useMemo(() => {
    const needle = term.trim().toLowerCase();
    const source = needle
      ? options.filter((o) => o.label.toLowerCase().includes(needle))
      : options;
    return source.slice(0, 40);
  }, [options, term]);

  return (
    <span className="relative" style={{ width }}>
      <input
        className="o-input"
        value={open ? term : (current?.label ?? "")}
        placeholder={placeholder}
        onFocus={() => {
          setOpen(true);
          setTerm("");
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 140)}
        onChange={(e) => setTerm(e.target.value)}
        aria-label="Value"
      />
      {open && (
        <span
          className="o-popover absolute left-0 top-[30px] py-1 block max-h-64 overflow-y-auto"
          style={{ width }}
        >
          {matches.length === 0 && (
            <span className="block px-3 py-1.5 text-[var(--o-fs-xs)] text-[var(--o-text-muted)]">
              No match
            </span>
          )}
          {matches.map((option) => (
            <button
              key={option.value}
              type="button"
              className="o-menu-item"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(option.value);
                setOpen(false);
              }}
            >
              <span className="o-truncate">{option.label}</span>
            </button>
          ))}
          {options.length > matches.length && (
            <span className="block px-3 py-1 text-[var(--o-fs-xxs)] text-[var(--o-text-subtle)]">
              Showing {matches.length} of {options.length}. Type to narrow.
            </span>
          )}
        </span>
      )}
    </span>
  );
}

export function MultiSelect({
  options,
  selected,
  onChange,
  width = 280,
}: {
  options: Option[];
  selected: string[];
  onChange: (value: string[]) => void;
  width?: number;
}) {
  const [term, setTerm] = useState("");
  const matches = useMemo(() => {
    const needle = term.trim().toLowerCase();
    const source = needle
      ? options.filter((o) => o.label.toLowerCase().includes(needle))
      : options;
    return source.slice(0, 200);
  }, [options, term]);

  const toggle = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    );
  };

  return (
    <span className="inline-block" style={{ width }}>
      <input
        className="o-input"
        placeholder={
          selected.length ? `${selected.length} selected - type to filter` : "Type to filter"
        }
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        aria-label="Filter options"
      />
      <span className="block mt-1 max-h-40 overflow-y-auto border border-[var(--o-border)] rounded-[var(--o-radius)] bg-white">
        {matches.map((option) => (
          <label
            key={option.value}
            className="flex items-center gap-2 px-2 py-1 text-[var(--o-fs-sm)] hover:bg-[var(--o-hover-bg)] cursor-pointer"
          >
            <input
              type="checkbox"
              checked={selected.includes(option.value)}
              onChange={() => toggle(option.value)}
            />
            <span className="o-truncate">{option.label}</span>
          </label>
        ))}
        {!matches.length && (
          <span className="block px-2 py-1 text-[var(--o-fs-xs)] text-[var(--o-text-muted)]">
            No match
          </span>
        )}
      </span>
    </span>
  );
}

export { nextKey };
