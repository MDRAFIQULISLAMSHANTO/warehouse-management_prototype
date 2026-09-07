/**
 * Chart drill-down.
 *
 * Every chart segment on a dashboard represents a set of records. Clicking it
 * must open exactly those records, with the condition arriving in the
 * destination as a visible, removable facet - the same contract the KPI cards
 * already follow.
 *
 * The dashboard's own active filters travel with the click: `carry` is the
 * facet list already in force, so a drill-down from a filtered dashboard lands
 * on a list filtered the same way plus the clicked condition.
 */

import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { listUrl } from "@/app/links";
import type { Facet } from "@/query/search";

/** A chart datum that knows which records it stands for. */
export interface DrilldownTarget {
  /** Model to open: "stock", "pallet", "cell", "lot", "product", "movement". */
  model: string;
  /** Facets describing the clicked slice. */
  facets: Facet[];
}

export type DrilldownFn = (target: DrilldownTarget | null | undefined) => void;

/**
 * Returns a navigate function for chart clicks.
 *
 * `carry` is prepended to the clicked facets so the dashboard's own scope is
 * preserved. Passing a null target is a no-op, which keeps the recharts click
 * handlers simple: they can map a datum to a target or to nothing.
 */
export function useDrilldown(carry: Facet[] = []): DrilldownFn {
  const navigate = useNavigate();
  return useCallback(
    (target) => {
      if (!target) return;
      navigate(listUrl(target.model, [...carry, ...target.facets]));
    },
    [navigate, carry],
  );
}

/**
 * Recharts hands click handlers a payload whose shape differs between chart
 * types. This pulls the datum out of any of them.
 */
export function payloadOf<T>(arg: unknown): T | undefined {
  if (!arg || typeof arg !== "object") return undefined;
  const holder = arg as { payload?: unknown; activePayload?: { payload?: unknown }[] };
  if (holder.activePayload?.length) {
    return holder.activePayload[0]?.payload as T | undefined;
  }
  if (holder.payload) {
    // Bars and pie cells nest the datum one level deep, sometimes twice.
    const inner = holder.payload as { payload?: unknown };
    return (inner.payload ?? holder.payload) as T;
  }
  return arg as T;
}

/** Cursor and hover affordance shared by every clickable chart. */
export const CLICKABLE = { cursor: "pointer" } as const;
