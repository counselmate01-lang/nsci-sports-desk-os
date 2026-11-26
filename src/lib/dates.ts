// Date helpers. All "today" logic uses the team's time zone (Settings),
// not the server's, because Vercel servers run in UTC.

export const DEFAULT_TZ = "Asia/Kolkata";

/** YYYY-MM-DD for "now" in the given time zone. */
export function todayIn(tz: string = DEFAULT_TZ, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** HH:MM (24h) for "now" in the given time zone. */
export function timeIn(tz: string = DEFAULT_TZ, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.UTC(+fromIso.slice(0, 4), +fromIso.slice(5, 7) - 1, +fromIso.slice(8, 10));
  const b = Date.UTC(+toIso.slice(0, 4), +toIso.slice(5, 7) - 1, +toIso.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

export function weekdayName(isoDate: string): string {
  return new Date(isoDate + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });
}

/** "24 Nov" or "24 Nov 2027" when not this year. */
export function formatDate(isoDate: string | null | undefined, today?: string): string {
  if (!isoDate) return "—";
  const d = new Date(isoDate.slice(0, 10) + "T00:00:00Z");
  const sameYear = today ? today.slice(0, 4) === isoDate.slice(0, 4) : false;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
    timeZone: "UTC",
  });
}

export function formatDateTime(iso: string | null | undefined, tz: string = DEFAULT_TZ): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: tz,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Relative label for a due date: "Today", "Tomorrow", "3 days overdue"... */
export function dueLabel(isoDate: string | null, today: string): string {
  if (!isoDate) return "No due date";
  const diff = daysBetween(today, isoDate);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff < 0) return `${-diff} days overdue`;
  if (diff < 7) return weekdayName(isoDate);
  return formatDate(isoDate, today);
}

/**
 * Converts a wall-clock time in a time zone ("2026-11-24", "10:00", "Asia/Kolkata")
 * into a UTC Date.
 */
export function zonedToUtc(date: string, time: string, tz: string = DEFAULT_TZ): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(guess);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asIfUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  const offset = asIfUtc - guess.getTime();
  return new Date(guess.getTime() - offset);
}
