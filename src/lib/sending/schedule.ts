/**
 * Business-hours scheduling in the recipient's timezone (no external libraries).
 * Business hours: Monday–Friday, 09:00–17:00 local time. Public holidays are not considered.
 */

export const BUSINESS_START_HOUR = 9;
export const BUSINESS_END_HOUR = 17;
export const MIN_BUSINESS_DAYS_BETWEEN_STEPS = 3;

export function safeTimezone(tz: string | null | undefined, fallback = "UTC"): string {
  for (const candidate of [tz, fallback, "UTC"]) {
    if (!candidate) continue;
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: candidate });
      return candidate;
    } catch {
      // try the next one
    }
  }
  return "UTC";
}

type Parts = { year: number; month: number; day: number; hour: number; minute: number; second: number; weekday: number };

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string) {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    formatters.set(tz, f);
  }
  return f;
}

/** Wall-clock parts of `date` in `tz`. weekday: 0 = Sunday … 6 = Saturday. */
export function zonedParts(date: Date, tz: string): Parts {
  const p: Record<string, number> = {};
  for (const part of formatter(tz).formatToParts(date)) {
    if (part.type !== "literal") p[part.type] = Number(part.value);
  }
  const weekday = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
  return { year: p.year, month: p.month, day: p.day, hour: p.hour, minute: p.minute, second: p.second, weekday };
}

function offsetMs(utcMs: number, tz: string): number {
  const p = zonedParts(new Date(utcMs), tz);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(utcMs / 1000) * 1000;
}

/** The UTC instant at which the clock in `tz` shows the given local date and time. */
export function zonedTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, tz: string): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  let ts = guess - offsetMs(guess, tz);
  ts = guess - offsetMs(ts, tz); // second pass handles DST transitions
  return new Date(ts);
}

/** Local calendar date `days` after the given local date (pure calendar arithmetic). */
function shiftDate(year: number, month: number, day: number, days: number) {
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), weekday: d.getUTCDay() };
}

const isWeekday = (weekday: number) => weekday >= 1 && weekday <= 5;

export function isBusinessHours(date: Date, tz: string): boolean {
  const p = zonedParts(date, tz);
  return isWeekday(p.weekday) && p.hour >= BUSINESS_START_HOUR && p.hour < BUSINESS_END_HOUR;
}

/** Same local time, `n` business days (Mon–Fri) later. */
export function addBusinessDays(date: Date, n: number, tz: string): Date {
  const p = zonedParts(date, tz);
  let offset = 0;
  let counted = 0;
  while (counted < n) {
    offset++;
    if (isWeekday(shiftDate(p.year, p.month, p.day, offset).weekday)) counted++;
  }
  const d = shiftDate(p.year, p.month, p.day, offset);
  return zonedTimeToUtc(d.year, d.month, d.day, p.hour, p.minute, tz);
}

/** Start of the local calendar day containing `date`, as a UTC instant. */
export function startOfLocalDay(date: Date, tz: string): Date {
  const p = zonedParts(date, tz);
  return zonedTimeToUtc(p.year, p.month, p.day, 0, 0, tz);
}

/**
 * A random moment inside business hours, no earlier than `after` (+1 minute).
 * Uses the rest of today's window if at least 10 minutes remain, else the next business day.
 */
export function nextBusinessSlot(after: Date, tz: string, random: () => number = Math.random): Date {
  const earliest = after.getTime() + 60_000;
  const p = zonedParts(after, tz);
  for (let offset = 0; offset < 14; offset++) {
    const d = shiftDate(p.year, p.month, p.day, offset);
    if (!isWeekday(d.weekday)) continue;
    const open = zonedTimeToUtc(d.year, d.month, d.day, BUSINESS_START_HOUR, 0, tz).getTime();
    const close = zonedTimeToUtc(d.year, d.month, d.day, BUSINESS_END_HOUR, 0, tz).getTime();
    const start = Math.max(open, earliest);
    if (close - start < 10 * 60_000) continue;
    // Stop 2 minutes before closing so a slightly late cron run still lands inside hours.
    return new Date(start + Math.floor(random() * (close - 2 * 60_000 - start)));
  }
  throw new Error("No business slot found in the next two weeks.");
}

/** When the next step may go out: at least 3 business days after the previous send, in business hours. */
export function followUpSlot(previousSentAt: Date, now: Date, tz: string, random: () => number = Math.random): Date {
  const earliest = addBusinessDays(previousSentAt, MIN_BUSINESS_DAYS_BETWEEN_STEPS, tz);
  return nextBusinessSlot(new Date(Math.max(earliest.getTime(), now.getTime())), tz, random);
}

/** Default out-of-office pause when the auto-reply gives no return date. */
export const OOO_DEFAULT_BUSINESS_DAYS = 7;

/**
 * When to resume after an out-of-office reply: a business-hours slot on the next business day
 * after the stated return date (YYYY-MM-DD, in the recipient's timezone), or 7 business days
 * after the reply if no date was given. Past dates count as "back now"; dates more than 60 days
 * out are capped.
 */
export function outOfOfficeResumeAt(returnDate: string | null, receivedAt: Date, tz: string, random: () => number = Math.random): Date {
  const m = returnDate?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  let after: Date;
  if (m) {
    after = zonedTimeToUtc(Number(m[1]), Number(m[2]), Number(m[3]) + 1, 0, 0, tz); // start of the day after
  } else {
    after = addBusinessDays(receivedAt, OOO_DEFAULT_BUSINESS_DAYS, tz);
  }
  const min = receivedAt.getTime();
  const max = receivedAt.getTime() + 60 * 86_400_000;
  return nextBusinessSlot(new Date(Math.min(Math.max(after.getTime(), min), max)), tz, random);
}
