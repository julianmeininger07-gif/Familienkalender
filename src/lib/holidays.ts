import { addDays, weekday, ymd } from "./dates";

export type Holiday = { date: string; name: string };

/** Ostersonntag nach der Gaußschen Osterformel (Variante von Meeus/Jones/Butcher, gregorianisch). */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return ymd(year, month, day);
}

/**
 * Gesetzliche Feiertage in Bayern.
 * Mariä Himmelfahrt gilt offiziell nur in Gemeinden mit überwiegend katholischer Bevölkerung
 * (das ist die große Mehrheit); wir zeigen ihn wie auf gedruckten Bayern-Kalendern für alle an.
 * Das Augsburger Friedensfest (nur Stadt Augsburg) ist bewusst nicht dabei.
 */
export function bavarianHolidays(year: number): Holiday[] {
  const easter = easterSunday(year);
  return [
    { date: ymd(year, 1, 1), name: "Neujahr" },
    { date: ymd(year, 1, 6), name: "Heilige Drei Könige" },
    { date: addDays(easter, -2), name: "Karfreitag" },
    { date: easter, name: "Ostersonntag" },
    { date: addDays(easter, 1), name: "Ostermontag" },
    { date: ymd(year, 5, 1), name: "Tag der Arbeit" },
    { date: addDays(easter, 39), name: "Christi Himmelfahrt" },
    { date: addDays(easter, 49), name: "Pfingstsonntag" },
    { date: addDays(easter, 50), name: "Pfingstmontag" },
    { date: addDays(easter, 60), name: "Fronleichnam" },
    { date: ymd(year, 8, 15), name: "Mariä Himmelfahrt" },
    { date: ymd(year, 10, 3), name: "Tag der Deutschen Einheit" },
    { date: ymd(year, 11, 1), name: "Allerheiligen" },
    { date: ymd(year, 12, 25), name: "1. Weihnachtstag" },
    { date: ymd(year, 12, 26), name: "2. Weihnachtstag" },
  ].sort((x, y) => x.date.localeCompare(y.date));
}

/** Buß- und Bettag: Mittwoch vor dem 23. November. In Bayern schulfrei, aber kein gesetzlicher Feiertag. */
export function bussUndBettag(year: number): string {
  let d = ymd(year, 11, 22);
  while (weekday(d) !== 3) d = addDays(d, -1);
  return d;
}

/** Alle Feiertage, die in den Zeitraum [from, to] (inklusive) fallen. */
export function holidaysBetween(from: string, to: string): Holiday[] {
  const startYear = Number(from.slice(0, 4));
  const endYear = Number(to.slice(0, 4));
  const out: Holiday[] = [];
  for (let y = startYear; y <= endYear; y++) {
    for (const h of bavarianHolidays(y)) if (h.date >= from && h.date <= to) out.push(h);
  }
  return out;
}
