/**
 * Application store.
 *
 * State = the deterministic seed, plus an ordered log of demonstration actions.
 * Only the log, saved searches and a few UI preferences are persisted, so
 * localStorage stays small and "Reset Demo" is exact: drop the log, rebuild the
 * seed. A refresh replays the log and lands on the identical state.
 */

import { create } from "zustand";
import { DEMO_NOW_ISO } from "@/data/clock";
import { deriveRows, type DerivedRows } from "@/data/derive";
import { SEED_VERSION, buildDataset } from "@/data/seed";
import type { Dataset, FavoriteRecord } from "@/data/types";
import type { ActionResult, DemoAction } from "./actions";
import { applyAction, resetIdCounter } from "./apply";

const STORAGE_KEY = "ispahani-wms.demo.v1";

export interface Notification {
  id: number;
  message: string;
  tone: "success" | "warning" | "danger" | "info";
}

interface PersistedState {
  seedVersion: string;
  log: DemoAction[];
  favorites: FavoriteRecord[];
  bannerDismissed: boolean;
}

function loadPersisted(): PersistedState {
  const empty: PersistedState = {
    seedVersion: SEED_VERSION,
    log: [],
    favorites: [],
    bannerDismissed: false,
  };
  if (typeof localStorage === "undefined") return empty;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as PersistedState;
    // A changed seed invalidates the log: replaying old ids would corrupt state.
    if (parsed.seedVersion !== SEED_VERSION) return empty;
    return {
      seedVersion: SEED_VERSION,
      log: Array.isArray(parsed.log) ? parsed.log : [],
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
      bannerDismissed: !!parsed.bannerDismissed,
    };
  } catch {
    return empty;
  }
}

function savePersisted(state: PersistedState): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage can be unavailable (private mode, blocked site data). The demo
    // still works for the current session; it just will not survive a refresh.
  }
}

function buildStateFromLog(log: DemoAction[]): Dataset {
  resetIdCounter();
  const data = buildDataset();
  for (const action of log) applyAction(data, action);
  return data;
}

// Derived rows are expensive; memoise them against the state version.
let cacheVersion = -1;
let cacheRows: DerivedRows | null = null;

export function derivedFor(data: Dataset, version: number): DerivedRows {
  if (cacheVersion === version && cacheRows) return cacheRows;
  cacheRows = deriveRows(data);
  cacheVersion = version;
  return cacheRows;
}

interface AppStore {
  data: Dataset;
  version: number;
  log: DemoAction[];
  favorites: FavoriteRecord[];
  bannerDismissed: boolean;
  notifications: Notification[];

  dispatch: (action: DemoAction) => ActionResult;
  resetDemo: () => void;
  notify: (message: string, tone?: Notification["tone"]) => void;
  dismissNotification: (id: number) => void;
  dismissBanner: () => void;

  addFavorite: (favorite: Omit<FavoriteRecord, "id" | "createdAt">) => void;
  removeFavorite: (id: string) => void;
  renameFavorite: (id: string, name: string) => void;
  setDefaultFavorite: (id: string, isDefault: boolean) => void;
}

const initial = loadPersisted();
let notificationSeq = 0;

export const useAppStore = create<AppStore>((set, get) => ({
  data: buildStateFromLog(initial.log),
  version: 0,
  log: initial.log,
  favorites: initial.favorites,
  bannerDismissed: initial.bannerDismissed,
  notifications: [],

  dispatch(action) {
    const state = get();
    const result = applyAction(state.data, action);
    if (!result.ok) {
      get().notify(result.message ?? "That action could not be completed.", "danger");
      return result;
    }
    const log = [...state.log, action];
    set({ log, version: state.version + 1, data: state.data });
    savePersisted({
      seedVersion: SEED_VERSION,
      log,
      favorites: get().favorites,
      bannerDismissed: get().bannerDismissed,
    });
    if (result.message) get().notify(result.message, "success");
    return result;
  },

  resetDemo() {
    resetIdCounter();
    const data = buildDataset();
    set({ data, log: [], version: get().version + 1 });
    savePersisted({
      seedVersion: SEED_VERSION,
      log: [],
      favorites: get().favorites,
      bannerDismissed: get().bannerDismissed,
    });
    get().notify("Demonstration data reset to the seeded state.", "info");
  },

  notify(message, tone = "info") {
    notificationSeq += 1;
    const entry: Notification = { id: notificationSeq, message, tone };
    set({ notifications: [...get().notifications, entry] });
    if (typeof window !== "undefined") {
      window.setTimeout(() => get().dismissNotification(entry.id), 5200);
    }
  },

  dismissNotification(id) {
    set({ notifications: get().notifications.filter((n) => n.id !== id) });
  },

  dismissBanner() {
    set({ bannerDismissed: true });
    savePersisted({
      seedVersion: SEED_VERSION,
      log: get().log,
      favorites: get().favorites,
      bannerDismissed: true,
    });
  },

  addFavorite(favorite) {
    const record: FavoriteRecord = {
      ...favorite,
      id: `fav_${Date.now().toString(36)}_${Math.floor(performance.now())}`,
      createdAt: DEMO_NOW_ISO,
    };
    const favorites = favorite.isDefault
      ? [
          ...get().favorites.map((f) =>
            f.route === favorite.route ? { ...f, isDefault: false } : f,
          ),
          record,
        ]
      : [...get().favorites, record];
    set({ favorites });
    savePersisted({
      seedVersion: SEED_VERSION,
      log: get().log,
      favorites,
      bannerDismissed: get().bannerDismissed,
    });
  },

  removeFavorite(id) {
    const favorites = get().favorites.filter((f) => f.id !== id);
    set({ favorites });
    savePersisted({
      seedVersion: SEED_VERSION,
      log: get().log,
      favorites,
      bannerDismissed: get().bannerDismissed,
    });
  },

  renameFavorite(id, name) {
    const favorites = get().favorites.map((f) =>
      f.id === id ? { ...f, name } : f,
    );
    set({ favorites });
    savePersisted({
      seedVersion: SEED_VERSION,
      log: get().log,
      favorites,
      bannerDismissed: get().bannerDismissed,
    });
  },

  setDefaultFavorite(id, isDefault) {
    const target = get().favorites.find((f) => f.id === id);
    const favorites = get().favorites.map((f) => {
      if (f.id === id) return { ...f, isDefault };
      if (isDefault && target && f.route === target.route) {
        return { ...f, isDefault: false };
      }
      return f;
    });
    set({ favorites });
    savePersisted({
      seedVersion: SEED_VERSION,
      log: get().log,
      favorites,
      bannerDismissed: get().bannerDismissed,
    });
  },
}));

/** Hook returning the memoised derived rows for the current state. */
export function useDerived(): DerivedRows {
  const data = useAppStore((s) => s.data);
  const version = useAppStore((s) => s.version);
  return derivedFor(data, version);
}

export function useDataset(): Dataset {
  return useAppStore((s) => s.data);
}
