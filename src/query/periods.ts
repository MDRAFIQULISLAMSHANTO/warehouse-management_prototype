/**
 * Relative and calendar date periods.
 *
 * All periods are computed from the fixed demonstration clock (see
 * data/clock.ts), not the machine clock, so "This Month" means the same thing
 * in every screenshot and on every machine.
 */

import { DEMO_TIMEZONE, addDays, demoToday } from "@/data/clock";
import { cond, type DomainNode } from "./domain";

export interface PeriodDef {
  id: string;
  label: string;
  /** Inclusive day range, yyyy-mm-dd. */
  range: () => { from: string; to: string };
}

const key = (d: Date) => d.toISOString().slice(0, 10);

function startOfWeek(date: Date): Date {
  const d = new Date(date.getTime());
  const day = d.getUTCDay() || 7; // Monday = 1
  return addDays(d, -(day - 1));
}

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function startOfQuarter(date: Date): Date {
  const q = Math.floor(date.getUTCMonth() / 3) * 3;
  return new Date(Date.UTC(date.getUTCFullYear(), q, 1));
}

function startOfYear(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
}

export const PERIODS: PeriodDef[] = [
  {
    id: "today",
    label: "Today",
    range: () => {
      const t = demoToday();
      return { from: key(t), to: key(t) };
    },
  },
  {
    id: "yesterday",
    label: "Yesterday",
    range: () => {
      const t = addDays(demoToday(), -1);
      return { from: key(t), to: key(t) };
    },
  },
  {
    id: "this_week",
    label: "This Week",
    range: () => {
      const start = startOfWeek(demoToday());
      return { from: key(start), to: key(addDays(start, 6)) };
    },
  },
  {
    id: "last_week",
    label: "Last Week",
    range: () => {
      const start = addDays(startOfWeek(demoToday()), -7);
      return { from: key(start), to: key(addDays(start, 6)) };
    },
  },
  {
    id: "this_month",
    label: "This Month",
    range: () => {
      const start = startOfMonth(demoToday());
      const end = new Date(
        Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0),
      );
      return { from: key(start), to: key(end) };
    },
  },
  {
    id: "last_month",
    label: "Last Month",
    range: () => {
      const today = demoToday();
      const start = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1),
      );
      const end = new Date(
        Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0),
      );
      return { from: key(start), to: key(end) };
    },
  },
  {
    id: "this_quarter",
    label: "This Quarter",
    range: () => {
      const start = startOfQuarter(demoToday());
      const end = new Date(
        Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 3, 0),
      );
      return { from: key(start), to: key(end) };
    },
  },
  {
    id: "this_year",
    label: "This Year",
    range: () => {
      const start = startOfYear(demoToday());
      return {
        from: key(start),
        to: key(new Date(Date.UTC(start.getUTCFullYear(), 11, 31))),
      };
    },
  },
  {
    id: "last_7",
    label: "Last 7 Days",
    range: () => {
      const today = demoToday();
      return { from: key(addDays(today, -6)), to: key(today) };
    },
  },
  {
    id: "last_30",
    label: "Last 30 Days",
    range: () => {
      const today = demoToday();
      return { from: key(addDays(today, -29)), to: key(today) };
    },
  },
  {
    id: "last_90",
    label: "Last 90 Days",
    range: () => {
      const today = demoToday();
      return { from: key(addDays(today, -89)), to: key(today) };
    },
  },
];

export function periodDomain(field: string, periodId: string): DomainNode | null {
  const period = PERIODS.find((p) => p.id === periodId);
  if (!period) return null;
  const { from, to } = period.range();
  return cond(field, "between", [from, to]);
}

export function customRangeDomain(
  field: string,
  from: string,
  to: string,
): DomainNode {
  return cond(field, "between", [from, to]);
}

export const PERIOD_TIMEZONE_NOTE = `Periods are calculated against the fixed demonstration date and ${DEMO_TIMEZONE}.`;
