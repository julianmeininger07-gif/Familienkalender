/** Kalenderdaten als "YYYY-MM-DD"-Strings, ohne Zeitzonen-Fallen (UTC-Rechnung). */

export function ymd(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseYmd(s: string): { year: number; month: number; day: number } {
  const [year, month, day] = s.split("-").map(Number);
  return { year, month, day };
}

export function addDays(s: string, days: number): string {
  const { year, month, day } = parseYmd(s);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Wochentag: 0 = Sonntag ... 6 = Samstag */
export function weekday(s: string): number {
  const { year, month, day } = parseYmd(s);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** ISO-Kalenderwoche (Montag als Wochenbeginn), wie in deutschen Kalendern. */
export function isoWeek(s: string): number {
  const { year, month, day } = parseYmd(s);
  const d = new Date(Date.UTC(year, month - 1, day));
  const dow = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dow);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** Heutiges Datum in Deutschland. */
export function todayInBerlin(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
}
