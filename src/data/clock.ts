/**
 * Demonstration clock.
 *
 * Every date in the prototype is derived from one fixed instant so that
 * screenshots, aging buckets, "This Month" filters and movement charts stay
 * identical across machines and across days. Real deployments would use the
 * server clock; this is called out in the docs as a demo device.
 */

/** Asia/Dhaka is UTC+6 with no daylight saving. */
export const DEMO_TIMEZONE = "Asia/Dhaka (UTC+06:00)";
export const DEMO_TZ_OFFSET_MINUTES = 6 * 60;

/** Fixed "now" for the demonstration: 06 September 2026, 10:00 Dhaka time. */
export const DEMO_NOW_ISO = "2026-09-06T04:00:00.000Z";

export function demoNow(): Date {
  return new Date(DEMO_NOW_ISO);
}

export function demoToday(): Date {
  const d = demoNow();
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0),
  );
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 3600_000);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  return Math.floor((to - from) / 86_400_000);
}

/** Whole days of stock age at the demo instant. */
export function ageInDays(iso: string): number {
  return daysBetween(iso, DEMO_NOW_ISO);
}

const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const DATETIME_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

/** Odoo shows dates in the user's timezone; we render the fixed demo zone. */
export function formatDate(iso: string | undefined | null): string {
  if (!iso) return "";
  return DATE_FMT.format(shiftToDemoZone(iso));
}

export function formatDateTime(iso: string | undefined | null): string {
  if (!iso) return "";
  return DATETIME_FMT.format(shiftToDemoZone(iso));
}

function shiftToDemoZone(iso: string): Date {
  return new Date(new Date(iso).getTime() + DEMO_TZ_OFFSET_MINUTES * 60_000);
}

/** yyyy-mm-dd in the demo timezone, for grouping and date inputs. */
export function toDateKey(iso: string): string {
  return shiftToDemoZone(iso).toISOString().slice(0, 10);
}

export function isoFromDateKey(key: string): string {
  return new Date(`${key}T00:00:00.000Z`).toISOString();
}

/** Stock aging buckets used consistently by every aging visual. */
export const AGE_BUCKETS = [
  { id: "0-30", label: "0-30 days", min: 0, max: 30 },
  { id: "31-60", label: "31-60 days", min: 31, max: 60 },
  { id: "61-90", label: "61-90 days", min: 61, max: 90 },
  { id: "91-180", label: "91-180 days", min: 91, max: 180 },
  { id: "181+", label: "181+ days", min: 181, max: Number.MAX_SAFE_INTEGER },
] as const;

export type AgeBucketId = (typeof AGE_BUCKETS)[number]["id"];

export function ageBucketOf(iso: string): AgeBucketId {
  const age = ageInDays(iso);
  for (const bucket of AGE_BUCKETS) {
    if (age >= bucket.min && age <= bucket.max) return bucket.id;
  }
  return "181+";
}
