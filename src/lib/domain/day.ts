/**
 * Day boundaries. A text drops at 5am in the reader's home time zone and stays
 * open for 24 hours, so the issue date for a moment is the local calendar date
 * shifted back by the drop hour. All of this runs on server time.
 */

export const DROP_HOUR = 5;
export const TIMEZONE_CHANGE_COOLDOWN_DAYS = 30;

export type LocalParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let fmt = formatterCache.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    formatterCache.set(timeZone, fmt);
  }
  return fmt;
}

/** True when the string names a time zone this runtime knows. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function localPartsIn(at: Date, timeZone: string): LocalParts {
  const parts = formatterFor(timeZone).formatToParts(at);
  const read = (type: Intl.DateTimeFormatPartTypes) => {
    const found = parts.find((p) => p.type === type);
    if (!found) throw new Error(`missing ${type} for time zone ${timeZone}`);
    return Number(found.value);
  };
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

function toIsoDate(year: number, month: number, day: number): string {
  const utc = new Date(Date.UTC(year, month - 1, day));
  return utc.toISOString().slice(0, 10);
}

export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  return utc.toISOString().slice(0, 10);
}

export function daysBetween(fromIsoDate: string, toIsoDate_: string): number {
  const parse = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((parse(toIsoDate_) - parse(fromIsoDate)) / 86_400_000);
}

/**
 * The issue date a reader is currently on. Before 5am local the reader is still
 * on yesterday's text.
 */
export function issueDateFor(at: Date, timeZone: string, dropHour = DROP_HOUR): string {
  const local = localPartsIn(at, timeZone);
  const date = toIsoDate(local.year, local.month, local.day);
  return local.hour < dropHour ? addDays(date, -1) : date;
}

/** Milliseconds until the next 5am local drop. Always positive. */
export function msUntilNextDrop(at: Date, timeZone: string, dropHour = DROP_HOUR): number {
  const local = localPartsIn(at, timeZone);
  const secondsIntoDay = local.hour * 3600 + local.minute * 60 + local.second;
  const dropSeconds = dropHour * 3600;
  const ahead = secondsIntoDay < dropSeconds ? dropSeconds - secondsIntoDay : 86_400 - secondsIntoDay + dropSeconds;
  return ahead * 1000 - at.getMilliseconds();
}

export function canChangeTimezone(
  timezoneChangedAt: Date | null,
  at: Date,
  cooldownDays = TIMEZONE_CHANGE_COOLDOWN_DAYS,
): boolean {
  if (!timezoneChangedAt) return true;
  const elapsedDays = (at.getTime() - timezoneChangedAt.getTime()) / 86_400_000;
  return elapsedDays >= cooldownDays;
}
