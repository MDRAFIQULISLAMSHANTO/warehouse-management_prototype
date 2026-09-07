/**
 * Dashboard frame.
 *
 * Gives every dashboard the same control panel, the same global filters (drawn
 * from its primary model's field registry) and the same translated scope, so a
 * filter set on one dashboard behaves identically on the next one.
 */

import { useMemo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useSearchState } from "@/hooks/useSearchState";
import { ControlPanel, type Crumb } from "@/odoo/ControlPanel";
import { IconInfo } from "@/odoo/icons";
import { getField, getModel } from "@/query/models";
import type { SearchState } from "@/query/search";
import { buildScope, type DashboardScope, type Target } from "./scope";
import type { DomainNode } from "@/query/domain";

export interface DashboardFrameProps {
  title: string;
  modelName: string;
  description?: ReactNode;
  breadcrumbs?: Crumb[];
  base?: Partial<Record<Target, DomainNode>>;
  actions?: ReactNode;
  children: (ctx: {
    scope: DashboardScope;
    state: SearchState;
    setState: (next: SearchState | ((prev: SearchState) => SearchState)) => void;
  }) => ReactNode;
}

export function DashboardFrame({
  title,
  modelName,
  description,
  breadcrumbs = [{ label: "Dashboards" }],
  base,
  actions,
  children,
}: DashboardFrameProps) {
  const model = getModel(modelName);
  const [state, setState] = useSearchState(model);

  const scope = useMemo(
    () => buildScope(state, modelName, base),
    [state, modelName, base],
  );

  return (
    <>
      <ControlPanel
        title={title}
        breadcrumbs={breadcrumbs}
        model={model}
        state={state}
        onState={setState}
        actions={actions}
        subtitle={description}
      />
      <div className="p-4 flex flex-col gap-4">
        <ScopeNotice model={modelName} scope={scope} />
        {children({ scope, state, setState })}
      </div>
    </>
  );
}

/** Tells the user when a filter could not be applied to part of the page. */
function ScopeNotice({
  model,
  scope,
}: {
  model: string;
  scope: DashboardScope;
}) {
  const modelDef = getModel(model);
  const messages: string[] = [];

  const label = (field: string) =>
    getField(modelDef, field)?.label ?? field;

  const droppedFromCells = Array.from(new Set(scope.dropped.cell)).filter(
    (f) => !scope.dropped.cellHighlight.includes(f),
  );
  if (droppedFromCells.length) {
    messages.push(
      `${droppedFromCells.map(label).join(", ")} narrows stock figures and highlights matching positions on the maps, but does not change installed capacity.`,
    );
  }

  const droppedFromStock = Array.from(new Set(scope.dropped.stock));
  if (droppedFromStock.length) {
    messages.push(
      `${droppedFromStock.map(label).join(", ")} does not apply to current stock balances.`,
    );
  }

  if (!messages.length) return null;

  return (
    <div className="flex items-start gap-2 px-3 py-2 rounded-[var(--o-radius-md)] bg-[var(--o-info-bg)] text-[var(--o-fs-xs)]">
      <IconInfo size={13} className="mt-[2px] text-[var(--o-info-text)]" />
      <div>
        <strong>Filter scope.</strong>{" "}
        {messages.join(" ")}{" "}
        <Link to="/about/filters">See the full applicability map</Link>.
      </div>
    </div>
  );
}

/** Standard grid wrappers so panels line up across dashboards. */
export function KpiRow({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
      {children}
    </div>
  );
}

export function PanelGrid({
  children,
  cols = 2,
}: {
  children: ReactNode;
  cols?: 1 | 2 | 3;
}) {
  const className =
    cols === 1
      ? "grid gap-4 grid-cols-1"
      : cols === 3
        ? "grid gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3"
        : "grid gap-4 grid-cols-1 lg:grid-cols-2";
  return <div className={className}>{children}</div>;
}
