import { useCallback, useMemo } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { useAppStore } from "@/store/appStore";
import type { ModelDef } from "@/query/models";
import {
  SEARCH_PARAM,
  paramsToSearch,
  searchToParams,
  type SearchState,
} from "@/query/search";

/**
 * Search state bound to the URL.
 *
 * Reading from the query string rather than component state is what makes
 * direct links, refreshes, the browser Back button and "copy link to this view"
 * all behave. A saved default favourite is applied only when the URL carries no
 * search of its own, so a drill-down from a dashboard is never silently
 * overwritten by someone's saved default.
 */
export function useSearchState(
  model: ModelDef,
): [SearchState, (next: SearchState | ((prev: SearchState) => SearchState)) => void] {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const favorites = useAppStore((s) => s.favorites);

  const state = useMemo(() => {
    if (!params.get(SEARCH_PARAM)) {
      const fallback = favorites.find(
        (f) => f.isDefault && f.route === location.pathname,
      );
      if (fallback) {
        return paramsToSearch(new URLSearchParams(fallback.search), model);
      }
    }
    return paramsToSearch(params, model);
  }, [params, model, favorites, location.pathname]);

  const update = useCallback(
    (next: SearchState | ((prev: SearchState) => SearchState)) => {
      const value = typeof next === "function" ? next(state) : next;
      setParams(
        (prev) => {
          // Preserve any non-search params (map selection, active tab, ...).
          const keep = new URLSearchParams(prev);
          keep.delete(SEARCH_PARAM);
          return searchToParams(value, model, keep);
        },
        { replace: false },
      );
    },
    [state, setParams, model],
  );

  return [state, update];
}

/**
 * Set several URL parameters in one navigation.
 *
 * Two calls to a single-key setter in the same handler cannot both survive:
 * react-router resolves even the functional form of `setSearchParams` against a
 * ref that is only refreshed on render, so the second call overwrites the
 * first. Selecting a position in the 3D view sets both the rack and the cell,
 * so it needs a setter that applies the whole patch in one navigation.
 *
 * Pass `null` to remove a key.
 */
export function useUrlParams(): (
  patch: Record<string, string | null>,
) => void {
  const [params, setParams] = useSearchParams();
  return useCallback(
    (patch: Record<string, string | null>) => {
      const copy = new URLSearchParams(params);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "") copy.delete(key);
        else copy.set(key, value);
      }
      setParams(copy, { replace: false });
    },
    [params, setParams],
  );
}

/**
 * Read/write a single extra URL parameter alongside the search state.
 *
 * Use `useUrlParams` when a handler changes more than one key at once.
 */
export function useUrlParam(
  key: string,
  fallback = "",
): [string, (value: string | null) => void] {
  const [params, setParams] = useSearchParams();
  const value = params.get(key) ?? fallback;
  const set = useCallback(
    (next: string | null) => {
      setParams(
        (prev) => {
          const copy = new URLSearchParams(prev);
          if (next === null || next === "") copy.delete(key);
          else copy.set(key, next);
          return copy;
        },
        { replace: false },
      );
    },
    [setParams, key],
  );
  return [value, set];
}
