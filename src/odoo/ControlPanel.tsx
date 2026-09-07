/**
 * Odoo control panel: breadcrumbs, actions, search with facets, Filters,
 * Group By, Favorites, record count, pager and the view switcher.
 *
 * One component serves every list and every dashboard, which is what keeps
 * filtering behaviour identical across the application.
 */

import { useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useDomainLookup, useFieldOptions } from "@/hooks/useOptions";
import { DEMO_TIMEZONE } from "@/data/clock";
import { and, cond, type DomainNode } from "@/query/domain";
import { describeDomain, facetTitleFor } from "@/query/describe";
import { getField, type ModelDef } from "@/query/models";
import { PERIODS, customRangeDomain, periodDomain } from "@/query/periods";
import {
  clearFacets,
  selectedFilterIds,
  toggleFilter,
  toggleGroupBy,
  withFacet,
  withGroupBy,
  withoutFacet,
  type Facet,
  type SearchState,
  type ViewMode,
} from "@/query/search";
import { useAppStore } from "@/store/appStore";
import { CustomFilterDialog } from "./CustomFilter";
import {
  IconChart,
  IconChevronLeft,
  IconChevronRight,
  IconClose,
  IconLink,
  IconList,
  IconMap,
  IconPivot,
  IconSearch,
  IconStar,
} from "./icons";
import { Dialog, Dropdown, MenuItem, MenuSeparator, MenuTitle } from "./primitives";

export interface Crumb {
  label: string;
  to?: string;
}

interface ControlPanelProps {
  title: ReactNode;
  breadcrumbs?: Crumb[];
  model?: ModelDef;
  state?: SearchState;
  onState?: (next: SearchState | ((prev: SearchState) => SearchState)) => void;
  count?: number;
  total?: number;
  actions?: ReactNode;
  views?: ViewMode[];
  subtitle?: ReactNode;
  pager?: { from: number; to: number; total: number; onPrev: () => void; onNext: () => void };
}

export function ControlPanel({
  title,
  breadcrumbs = [],
  model,
  state,
  onState,
  count,
  actions,
  views,
  subtitle,
  pager,
}: ControlPanelProps) {
  return (
    <div className="sticky top-0 z-30 bg-[var(--o-view-bg)] border-b border-[var(--o-border)]">
      <div className="flex items-center gap-3 px-4 min-h-[var(--o-control-panel-h)] flex-wrap">
        <div className="flex items-center gap-1.5 min-w-0">
          {breadcrumbs.map((crumb) => (
            <span key={crumb.label} className="flex items-center gap-1.5 min-w-0">
              {crumb.to ? (
                <Link
                  to={crumb.to}
                  className="text-[var(--o-fs-sm)] text-[var(--o-text-link)] o-truncate max-w-[220px]"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-[var(--o-fs-sm)] text-[var(--o-text-muted)] o-truncate max-w-[220px]">
                  {crumb.label}
                </span>
              )}
              <span className="text-[var(--o-text-subtle)]">/</span>
            </span>
          ))}
          <h1 className="text-[var(--o-fs-lg)] font-medium m-0 o-truncate max-w-[520px]">
            {title}
          </h1>
          {count !== undefined && (
            <span className="ml-1 text-[var(--o-fs-xs)] text-[var(--o-text-subtle)] o-tabular whitespace-nowrap">
              ({count.toLocaleString("en-GB")})
            </span>
          )}
        </div>

        {actions && <div className="flex items-center gap-2">{actions}</div>}

        <div className="ml-auto flex items-center gap-2">
          {pager && pager.total > 0 && (
            <div className="flex items-center gap-1 text-[var(--o-fs-xs)] o-tabular">
              <span>
                {pager.from}-{pager.to} / {pager.total.toLocaleString("en-GB")}
              </span>
              <button
                type="button"
                className="o-btn o-btn-ghost o-btn-sm"
                onClick={pager.onPrev}
                disabled={pager.from <= 1}
                aria-label="Previous page"
              >
                <IconChevronLeft size={12} />
              </button>
              <button
                type="button"
                className="o-btn o-btn-ghost o-btn-sm"
                onClick={pager.onNext}
                disabled={pager.to >= pager.total}
                aria-label="Next page"
              >
                <IconChevronRight size={12} />
              </button>
            </div>
          )}
          {views && views.length > 1 && state && onState && (
            <ViewSwitcher
              views={views}
              active={state.view}
              onChange={(view) => onState({ ...state, view })}
            />
          )}
        </div>
      </div>

      {subtitle && (
        <div className="px-4 pb-2 text-[var(--o-fs-xs)] text-[var(--o-text-muted)]">
          {subtitle}
        </div>
      )}

      {model && state && onState && (
        <SearchArea model={model} state={state} onState={onState} />
      )}
    </div>
  );
}

function ViewSwitcher({
  views,
  active,
  onChange,
}: {
  views: ViewMode[];
  active: ViewMode;
  onChange: (view: ViewMode) => void;
}) {
  const icon = (view: ViewMode) => {
    switch (view) {
      case "graph":
        return <IconChart size={13} />;
      case "pivot":
        return <IconPivot size={13} />;
      case "map":
        return <IconMap size={13} />;
      default:
        return <IconList size={13} />;
    }
  };
  const label: Record<ViewMode, string> = {
    list: "List",
    graph: "Graph",
    pivot: "Pivot",
    map: "Map",
  };
  return (
    <div className="flex border border-[var(--o-border-strong)] rounded-[var(--o-radius)] overflow-hidden">
      {views.map((view) => (
        <button
          key={view}
          type="button"
          title={`${label[view]} view`}
          aria-label={`${label[view]} view`}
          aria-pressed={active === view}
          className="px-2 py-1 bg-white border-r last:border-r-0 border-[var(--o-border)]"
          style={
            active === view
              ? { background: "var(--o-brand-primary)", color: "white" }
              : undefined
          }
          onClick={() => onChange(view)}
        >
          {icon(view)}
        </button>
      ))}
    </div>
  );
}

// ------------------------------------------------------------- search area

function SearchArea({
  model,
  state,
  onState,
}: {
  model: ModelDef;
  state: SearchState;
  onState: (next: SearchState | ((prev: SearchState) => SearchState)) => void;
}) {
  const [term, setTerm] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [customOpen, setCustomOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const lookup = useDomainLookup(model);

  const suggestions = useMemo(() => {
    const needle = term.trim();
    if (!needle) return [];
    return model.searchFields
      .map((name) => getField(model, name))
      .filter((f): f is NonNullable<typeof f> => !!f)
      .map((field) => ({
        field: field.name,
        label: field.label,
        term: needle,
      }));
  }, [term, model]);

  const applySearch = (fieldName: string, value: string) => {
    const field = getField(model, fieldName);
    const id = `search:${fieldName}:${value.toLowerCase()}`;
    onState((prev) =>
      withFacet(prev, {
        id,
        type: "search",
        label: field?.label ?? fieldName,
        values: [value],
        field: fieldName,
        domain: cond(fieldName, "contains", value),
      }),
    );
    setTerm("");
    setHighlight(0);
  };

  return (
    <>
      <div className="flex items-start gap-2 px-4 pb-2">
        <div className="flex-1 min-w-0 flex items-start gap-1.5 flex-wrap border border-[var(--o-border-strong)] rounded-[var(--o-radius)] bg-white px-2 py-1.5 focus-within:shadow-[var(--o-focus-ring-soft)]">
          <IconSearch size={13} className="mt-[3px] text-[var(--o-text-subtle)]" />

          {state.facets.map((facet) => (
            <FacetChip
              key={facet.id}
              facet={facet}
              onRemove={() => onState((prev) => withoutFacet(prev, facet.id))}
            />
          ))}

          {state.groupBy.length > 0 && (
            <span className="o-facet" title="Grouping">
              <span className="o-facet-label">Group By</span>
              <span className="o-facet-values">
                {state.groupBy
                  .map((token) => {
                    const [name, granularity] = token.split(":");
                    const label = getField(model, name)?.label ?? name;
                    return granularity ? `${label} (${granularity})` : label;
                  })
                  .join(" > ")}
              </span>
              <button
                type="button"
                className="o-facet-remove"
                aria-label="Remove grouping"
                onClick={() => onState((prev) => withGroupBy(prev, []))}
              >
                <IconClose size={10} />
              </button>
            </span>
          )}

          <div className="relative flex-1 min-w-[160px]">
            <input
              ref={inputRef}
              className="w-full border-0 outline-none text-[var(--o-fs-sm)] bg-transparent h-[20px]"
              placeholder={
                state.facets.length ? "" : `Search ${model.labelPlural}...`
              }
              value={term}
              onChange={(e) => {
                setTerm(e.target.value);
                setHighlight(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setHighlight((h) => Math.max(h - 1, 0));
                } else if (e.key === "Enter" && suggestions.length) {
                  e.preventDefault();
                  const pick = suggestions[highlight] ?? suggestions[0];
                  applySearch(pick.field, pick.term);
                } else if (
                  e.key === "Backspace" &&
                  term === "" &&
                  state.facets.length
                ) {
                  const last = state.facets[state.facets.length - 1];
                  onState((prev) => withoutFacet(prev, last.id));
                }
              }}
              aria-label={`Search ${model.labelPlural}`}
            />
            {suggestions.length > 0 && (
              <div
                className="o-popover absolute left-0 top-[26px] py-1"
                style={{ minWidth: 320 }}
                role="listbox"
              >
                {suggestions.map((s, i) => (
                  <button
                    key={s.field}
                    type="button"
                    role="option"
                    aria-selected={i === highlight}
                    className="o-menu-item"
                    data-selected={i === highlight ? "true" : undefined}
                    onMouseEnter={() => setHighlight(i)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      applySearch(s.field, s.term);
                    }}
                  >
                    Search <strong>{s.label}</strong> for:{" "}
                    <span className="text-[var(--o-text-link)]">{s.term}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {state.facets.length > 0 && (
            <button
              type="button"
              className="o-btn o-btn-ghost o-btn-sm ml-auto"
              onClick={() => onState((prev) => clearFacets(prev))}
              title="Remove every active filter"
            >
              Clear All
            </button>
          )}
        </div>

        <FiltersMenu
          model={model}
          state={state}
          onState={onState}
          onCustom={() => setCustomOpen(true)}
        />
        <GroupByMenu model={model} state={state} onState={onState} />
        <FavoritesMenu model={model} state={state} onState={onState} />
      </div>

      {customOpen && (
        <CustomFilterDialog
          model={model}
          onClose={() => setCustomOpen(false)}
          onApply={(node) => {
            const id = `custom:${Date.now().toString(36)}`;
            onState((prev) =>
              withFacet(prev, {
                id,
                type: "custom",
                label: facetTitleFor(model, node),
                values: [describeDomain(model, node, lookup)],
                domain: node,
              }),
            );
            setCustomOpen(false);
          }}
        />
      )}
    </>
  );
}

function FacetChip({ facet, onRemove }: { facet: Facet; onRemove: () => void }) {
  return (
    <span className="o-facet" title={facet.values.join(" or ")}>
      <span className="o-facet-label">{facet.label}</span>
      <span className="o-facet-values">{facet.values.join(" or ")}</span>
      <button
        type="button"
        className="o-facet-remove"
        aria-label={`Remove ${facet.label} filter`}
        onClick={onRemove}
      >
        <IconClose size={10} />
      </button>
    </span>
  );
}

// ------------------------------------------------------------ filters menu

function FiltersMenu({
  model,
  state,
  onState,
  onCustom,
}: {
  model: ModelDef;
  state: SearchState;
  onState: (next: SearchState | ((prev: SearchState) => SearchState)) => void;
  onCustom: () => void;
}) {
  const [rangeOpen, setRangeOpen] = useState(false);
  const active = selectedFilterIds(state);

  const groups = useMemo(() => {
    const map = new Map<string, typeof model.filters>();
    for (const filter of model.filters) {
      const list = map.get(filter.group) ?? [];
      list.push(filter);
      map.set(filter.group, list);
    }
    return Array.from(map.values());
  }, [model]);

  const dateField = useMemo(
    () =>
      model.fields.find(
        (f) => (f.type === "date" || f.type === "datetime") && f.filterable,
      ),
    [model],
  );

  const applyPeriod = (periodId: string, label: string) => {
    if (!dateField) return;
    const domain = periodDomain(dateField.name, periodId);
    if (!domain) return;
    onState((prev) =>
      withFacet(prev, {
        id: "period",
        type: "custom",
        label: dateField.label,
        values: [label],
        domain,
      }),
    );
  };

  return (
    <>
      <Dropdown
        label="Filters"
        buttonClassName="o-btn o-btn-secondary"
        width={300}
        active={active.length > 0}
      >
        {(close) => (
          <>
            {groups.map((group, i) => (
              <div key={group[0]?.group ?? i}>
                {i > 0 && <MenuSeparator />}
                {group.map((filter) => (
                  <MenuItem
                    key={filter.id}
                    selected={active.includes(filter.id)}
                    title={filter.help}
                    onClick={() => onState((prev) => toggleFilter(prev, model, filter.id))}
                  >
                    <span className="w-3 inline-block">
                      {active.includes(filter.id) ? "✓" : ""}
                    </span>
                    {filter.label}
                  </MenuItem>
                ))}
              </div>
            ))}

            {dateField && (
              <>
                <MenuSeparator />
                <MenuTitle>{dateField.label}</MenuTitle>
                {PERIODS.map((period) => (
                  <MenuItem
                    key={period.id}
                    onClick={() => {
                      applyPeriod(period.id, period.label);
                      close();
                    }}
                  >
                    <span className="w-3 inline-block" />
                    {period.label}
                  </MenuItem>
                ))}
                <MenuItem
                  onClick={() => {
                    setRangeOpen(true);
                    close();
                  }}
                >
                  <span className="w-3 inline-block" />
                  Custom Range...
                </MenuItem>
                <div className="px-3 py-1 text-[var(--o-fs-xxs)] text-[var(--o-text-subtle)]">
                  Filters {dateField.label}. {DEMO_TIMEZONE}.
                </div>
              </>
            )}

            <MenuSeparator />
            <MenuItem
              onClick={() => {
                onCustom();
                close();
              }}
            >
              <span className="w-3 inline-block" />
              Add Custom Filter
            </MenuItem>
          </>
        )}
      </Dropdown>

      {rangeOpen && dateField && (
        <CustomRangeDialog
          label={dateField.label}
          onClose={() => setRangeOpen(false)}
          onApply={(from, to) => {
            onState((prev) =>
              withFacet(prev, {
                id: "period",
                type: "custom",
                label: dateField.label,
                values: [`${from} to ${to}`],
                domain: customRangeDomain(dateField.name, from, to),
              }),
            );
            setRangeOpen(false);
          }}
        />
      )}
    </>
  );
}

function CustomRangeDialog({
  label,
  onApply,
  onClose,
}: {
  label: string;
  onApply: (from: string, to: string) => void;
  onClose: () => void;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  return (
    <Dialog
      title={`Custom range - ${label}`}
      width={420}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="o-btn o-btn-secondary" onClick={onClose}>
            Discard
          </button>
          <button
            type="button"
            className="o-btn o-btn-primary"
            disabled={!from || !to}
            onClick={() => onApply(from, to)}
          >
            Apply
          </button>
        </>
      }
    >
      <div className="flex items-center gap-3">
        <label className="flex-1">
          <span className="block text-[var(--o-fs-xs)] mb-1">From</span>
          <input
            type="date"
            className="o-input"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="flex-1">
          <span className="block text-[var(--o-fs-xs)] mb-1">To</span>
          <input
            type="date"
            className="o-input"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
      </div>
      <p className="mt-3 text-[var(--o-fs-xs)] text-[var(--o-text-muted)]">
        Both ends are included. {DEMO_TIMEZONE}.
      </p>
    </Dialog>
  );
}

// ----------------------------------------------------------- group by menu

const DATE_GRANULARITIES = ["day", "week", "month", "quarter", "year"] as const;

function GroupByMenu({
  model,
  state,
  onState,
}: {
  model: ModelDef;
  state: SearchState;
  onState: (next: SearchState | ((prev: SearchState) => SearchState)) => void;
}) {
  const [customOpen, setCustomOpen] = useState(false);

  const groupableFields = useMemo(
    () => model.fields.filter((f) => f.groupable),
    [model],
  );

  return (
    <>
      <Dropdown
        label="Group By"
        buttonClassName="o-btn o-btn-secondary"
        width={280}
        active={state.groupBy.length > 0}
      >
        {() => (
          <>
            {model.groupBys.map((token) => {
              const [name, granularity] = token.split(":");
              const field = getField(model, name);
              if (!field) return null;
              const label = granularity
                ? `${field.label} (${granularity})`
                : field.label;
              return (
                <MenuItem
                  key={token}
                  selected={state.groupBy.includes(token)}
                  onClick={() => onState((prev) => toggleGroupBy(prev, token))}
                >
                  <span className="w-3 inline-block">
                    {state.groupBy.includes(token) ? "✓" : ""}
                  </span>
                  {label}
                </MenuItem>
              );
            })}
            <MenuSeparator />
            <MenuItem onClick={() => setCustomOpen(true)}>
              <span className="w-3 inline-block" />
              Add Custom Group
            </MenuItem>
            {state.groupBy.length > 0 && (
              <MenuItem onClick={() => onState((prev) => withGroupBy(prev, []))}>
                <span className="w-3 inline-block" />
                Remove all grouping
              </MenuItem>
            )}
          </>
        )}
      </Dropdown>

      {customOpen && (
        <Dialog
          title="Add Custom Group"
          width={460}
          onClose={() => setCustomOpen(false)}
        >
          <div className="max-h-[50vh] overflow-y-auto">
            {groupableFields.map((field) => {
              const isDate = field.type === "date" || field.type === "datetime";
              return (
                <div
                  key={field.name}
                  className="flex items-center justify-between gap-2 py-1 border-b border-[var(--o-border-subtle)]"
                >
                  <span className="text-[var(--o-fs-sm)]">{field.label}</span>
                  <span className="flex gap-1">
                    {isDate ? (
                      DATE_GRANULARITIES.map((granularity) => (
                        <button
                          key={granularity}
                          type="button"
                          className="o-btn o-btn-secondary o-btn-sm"
                          onClick={() => {
                            onState((prev) =>
                              toggleGroupBy(prev, `${field.name}:${granularity}`),
                            );
                            setCustomOpen(false);
                          }}
                        >
                          {granularity}
                        </button>
                      ))
                    ) : (
                      <button
                        type="button"
                        className="o-btn o-btn-secondary o-btn-sm"
                        onClick={() => {
                          onState((prev) => toggleGroupBy(prev, field.name));
                          setCustomOpen(false);
                        }}
                      >
                        Group
                      </button>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </Dialog>
      )}
    </>
  );
}

// ---------------------------------------------------------- favorites menu

function FavoritesMenu({
  model,
  state,
  onState,
}: {
  model: ModelDef;
  state: SearchState;
  onState: (next: SearchState | ((prev: SearchState) => SearchState)) => void;
}) {
  const favorites = useAppStore((s) => s.favorites);
  const addFavorite = useAppStore((s) => s.addFavorite);
  const removeFavorite = useAppStore((s) => s.removeFavorite);
  const renameFavorite = useAppStore((s) => s.renameFavorite);
  const setDefaultFavorite = useAppStore((s) => s.setDefaultFavorite);
  const notify = useAppStore((s) => s.notify);

  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");
  const [asDefault, setAsDefault] = useState(false);

  const route = typeof window !== "undefined" ? window.location.pathname : "";
  const mine = favorites.filter((f) => f.route === route);

  const save = () => {
    const search = typeof window !== "undefined" ? window.location.search.replace(/^\?/, "") : "";
    addFavorite({
      name: name.trim() || `${model.labelPlural} view`,
      route,
      search,
      isDefault: asDefault,
    });
    setSaveOpen(false);
    setName("");
    setAsDefault(false);
    notify("Saved to your favourites on this browser.", "success");
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      notify("Link to this filtered view copied to the clipboard.", "success");
    } catch {
      notify("Copy failed. The link is in the address bar.", "warning");
    }
  };

  return (
    <>
      <Dropdown
        label={
          <span className="flex items-center gap-1.5">
            <IconStar size={12} filled={mine.length > 0} />
            Favorites
          </span>
        }
        buttonClassName="o-btn o-btn-secondary"
        width={310}
        align="right"
      >
        {(close) => (
          <>
            {mine.length > 0 && <MenuTitle>Saved searches</MenuTitle>}
            {mine.map((favorite) => (
              <div key={favorite.id} className="flex items-center gap-1 pr-2">
                <MenuItem
                  className="flex-1"
                  onClick={() => {
                    const url = `${favorite.route}${favorite.search ? `?${favorite.search}` : ""}`;
                    window.history.pushState({}, "", url);
                    window.dispatchEvent(new PopStateEvent("popstate"));
                    close();
                  }}
                >
                  <IconStar size={11} filled={favorite.isDefault} />
                  <span className="o-truncate">{favorite.name}</span>
                </MenuItem>
                <button
                  type="button"
                  className="o-btn o-btn-ghost o-btn-sm"
                  title={
                    favorite.isDefault
                      ? "Stop using as the default view"
                      : "Use as the default view for this screen"
                  }
                  onClick={() => setDefaultFavorite(favorite.id, !favorite.isDefault)}
                >
                  {favorite.isDefault ? "Default" : "Set default"}
                </button>
                <button
                  type="button"
                  className="o-btn o-btn-ghost o-btn-sm"
                  title="Rename"
                  onClick={() => {
                    const next = window.prompt("Rename favourite", favorite.name);
                    if (next) renameFavorite(favorite.id, next);
                  }}
                >
                  Rename
                </button>
                <button
                  type="button"
                  className="o-btn o-btn-ghost o-btn-sm"
                  title="Delete"
                  onClick={() => removeFavorite(favorite.id)}
                  aria-label={`Delete ${favorite.name}`}
                >
                  <IconClose size={10} />
                </button>
              </div>
            ))}

            {mine.length > 0 && <MenuSeparator />}
            <MenuItem
              onClick={() => {
                setSaveOpen(true);
                close();
              }}
            >
              <IconStar size={11} />
              Save current search
            </MenuItem>
            <MenuItem onClick={copyLink}>
              <IconLink size={11} />
              Copy link to this view
            </MenuItem>
            {state.facets.length > 0 && (
              <MenuItem onClick={() => onState((prev) => clearFacets(prev))}>
                <IconClose size={11} />
                Clear all filters
              </MenuItem>
            )}
            <div className="px-3 pt-2 pb-1 text-[var(--o-fs-xxs)] text-[var(--o-text-subtle)]">
              Favourites are stored in this browser only. In Odoo they are user
              records and can be shared; nothing is shared between users here.
            </div>
          </>
        )}
      </Dropdown>

      {saveOpen && (
        <Dialog
          title="Save current search"
          width={440}
          onClose={() => setSaveOpen(false)}
          footer={
            <>
              <button
                type="button"
                className="o-btn o-btn-secondary"
                onClick={() => setSaveOpen(false)}
              >
                Discard
              </button>
              <button type="button" className="o-btn o-btn-primary" onClick={save}>
                Save
              </button>
            </>
          }
        >
          <label className="block">
            <span className="block text-[var(--o-fs-xs)] mb-1">Name</span>
            <input
              className="o-input"
              autoFocus
              value={name}
              placeholder={`${model.labelPlural} view`}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 mt-3 text-[var(--o-fs-sm)]">
            <input
              type="checkbox"
              checked={asDefault}
              onChange={(e) => setAsDefault(e.target.checked)}
            />
            Use by default on this screen
          </label>
          <p className="mt-3 text-[var(--o-fs-xs)] text-[var(--o-text-muted)]">
            A default applies only when you open the screen without filters of
            its own. Arriving from a dashboard drill-down keeps that
            drill-down's filters.
          </p>
        </Dialog>
      )}
    </>
  );
}

/** Convenience for pages that need the same AND-combination the panel uses. */
export function combineDomains(...nodes: (DomainNode | null | undefined)[]) {
  return and(...nodes);
}

export { useFieldOptions };
