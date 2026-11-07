import { formatDate, isValidISODate, todayISO } from "@/lib/dates";

export type DateRange = {
  from: string;
  to: string;
};

/** First day of the month containing `iso`. */
export function startOfMonth(iso: string) {
  return `${iso.slice(0, 7)}-01`;
}

/** Default report period: the current month up to today. */
export function defaultPeriod(today = todayISO()): DateRange {
  return { from: startOfMonth(today), to: today };
}

/**
 * Validates user-supplied dates and keeps `from <= to`.
 * Missing or malformed values fall back to the supplied period.
 */
export function normalizeRange(
  from: string | undefined,
  to: string | undefined,
  fallback: DateRange = defaultPeriod(),
): DateRange {
  let nextFrom = from && isValidISODate(from) ? from : fallback.from;
  let nextTo = to && isValidISODate(to) ? to : fallback.to;

  if (nextFrom > nextTo) {
    [nextFrom, nextTo] = [nextTo, nextFrom];
  }

  return { from: nextFrom, to: nextTo };
}

/**
 * Saturday-start week key for an ISO date. Egypt's business week starts on
 * Saturday, so a Sunday belongs to the Saturday before it.
 */
export function startOfWeek(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  // getDay(): 0 Sunday … 6 Saturday. Days since the latest Saturday:
  // Saturday → 0, Sunday → 1, … Friday → 6.
  date.setDate(date.getDate() - ((date.getDay() + 1) % 7));

  return todayISO(date);
}

export function monthKey(iso: string) {
  return iso.slice(0, 7);
}

/** `2026-11` → `11/2026` with Latin digits. */
export function formatMonthLabel(key: string) {
  const [year, month] = key.split("-");
  return `${month}/${year}`;
}

/**
 * Human label for a collections grouping key. The screen and the CSV export
 * both call this, so a printed row and an exported row read identically.
 */
export function formatGroupLabel(
  groupBy: "day" | "week" | "month",
  key: string,
) {
  if (groupBy === "month") return `شهر ${formatMonthLabel(key)}`;
  if (groupBy === "week") return `أسبوع ${formatDate(key)}`;
  return formatDate(key);
}

/** Whole days from `from` to `to`, independent of the machine timezone. */
export function daysBetween(from: string, to: string) {
  const [fromYear, fromMonth, fromDay] = from.split("-").map(Number);
  const [toYear, toMonth, toDay] = to.split("-").map(Number);

  const start = Date.UTC(fromYear, fromMonth - 1, fromDay);
  const end = Date.UTC(toYear, toMonth - 1, toDay);

  return Math.round((end - start) / 86_400_000);
}
