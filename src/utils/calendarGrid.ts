// Month grids and month/year arithmetic for the Governance Schedule's
// calendar views. Ported from Homeviz's domain/calendar.ts.
//
// Everything here works on calendar days as ISO strings ("2026-03-31"), with
// the arithmetic done in UTC so a day never shifts with the browser's
// timezone. "Today" is the one input that comes from the local clock — see
// todayIso() — which is the same day scheduledActivities.ts's deriveStatus()
// compares against.

const DAY_MS = 86_400_000;
const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

export interface GridDay {
  date: string;
  // False for the leading and trailing days borrowed from neighbouring months.
  inMonth: boolean;
  isToday: boolean;
  // 0 is Sunday, matching the column order the grid renders.
  weekday: number;
}

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Today's calendar day in the browser's own timezone, as an ISO string.
export function todayIso(now = new Date()): string {
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${m}-${d}`;
}

export function parseMonth(month: string): { year: number; month: number } {
  const match = MONTH_PATTERN.exec(month);
  if (!match) throw new Error(`Expected a month as YYYY-MM, received "${month}".`);
  return { year: Number(match[1]), month: Number(match[2]) };
}

export function shiftMonth(month: string, delta: number): string {
  const { year, month: index } = parseMonth(month);
  const zeroBased = index - 1 + delta;
  const targetYear = year + Math.floor(zeroBased / 12);
  const targetMonth = ((zeroBased % 12) + 12) % 12;
  return `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}`;
}

// "March 2026"
export function monthLabel(month: string): string {
  const { year, month: index } = parseMonth(month);
  return `${MONTH_NAMES[index - 1]} ${year}`;
}

// The twelve months of a year, January first.
export function monthsIn(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
}

// The days a month grid draws, Sunday first: whole weeks, only as many rows
// as the month needs (4–6).
export function monthGrid(month: string, today: string): GridDay[] {
  const { year, month: index } = parseMonth(month);
  const first = new Date(Date.UTC(year, index - 1, 1));
  const last = new Date(Date.UTC(year, index, 0));
  const leading = first.getUTCDay();
  const trailing = 6 - last.getUTCDay();
  const total = leading + last.getUTCDate() + trailing;
  const start = first.getTime() - leading * DAY_MS;

  return Array.from({ length: total }, (_, offset) => {
    const date = new Date(start + offset * DAY_MS);
    const iso = toIso(date);
    return {
      date: iso,
      inMonth: iso.slice(0, 7) === month,
      isToday: iso === today,
      weekday: date.getUTCDay(),
    };
  });
}

// The weekday (0 = Sunday) of an ISO day.
export function weekdayOf(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
