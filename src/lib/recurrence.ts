import { addDays, daysInMonth, parseYmd, ymd } from "./dates";
import { berlinToUtc, utcToBerlin } from "./time";

/**
 * Wiederkehrende Termine. Gespeichert als RFC-5545-Regel (Teilmenge):
 *   FREQ=DAILY|WEEKLY|MONTHLY|YEARLY;INTERVAL=n;UNTIL=YYYYMMDD;COUNT=n
 * Gerechnet wird in Berliner Ortszeit, damit "jeden Montag 18 Uhr" auch nach der
 * Zeitumstellung 18 Uhr bleibt.
 */
export type Freq = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
export type Rule = { freq: Freq; interval: number; until?: string; count?: number };

export const FREQ_LABELS: Record<Freq, string> = {
  DAILY: "täglich",
  WEEKLY: "wöchentlich",
  MONTHLY: "monatlich",
  YEARLY: "jährlich",
};

export function formatRule(r: Rule): string {
  const parts = [`FREQ=${r.freq}`];
  if (r.interval > 1) parts.push(`INTERVAL=${r.interval}`);
  if (r.until) parts.push(`UNTIL=${r.until.replaceAll("-", "")}`);
  if (r.count) parts.push(`COUNT=${r.count}`);
  return parts.join(";");
}

export function parseRule(s: string): Rule | null {
  const map = Object.fromEntries(s.split(";").map((p) => p.split("=") as [string, string]));
  if (!["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(map.FREQ)) return null;
  const rule: Rule = { freq: map.FREQ as Freq, interval: Math.max(1, Number(map.INTERVAL ?? 1) || 1) };
  if (map.UNTIL && /^\d{8}/.test(map.UNTIL)) {
    const u = map.UNTIL;
    rule.until = `${u.slice(0, 4)}-${u.slice(4, 6)}-${u.slice(6, 8)}`;
  }
  if (map.COUNT) rule.count = Math.max(1, Number(map.COUNT) || 1);
  return rule;
}

/** Lesbare Beschreibung, z. B. "alle 2 Wochen, bis 31.12.2027". */
export function describeRule(r: Rule): string {
  const unit = { DAILY: ["täglich", "Tage"], WEEKLY: ["wöchentlich", "Wochen"], MONTHLY: ["monatlich", "Monate"], YEARLY: ["jährlich", "Jahre"] }[r.freq];
  let s = r.interval === 1 ? unit[0] : `alle ${r.interval} ${unit[1]}`;
  if (r.until) {
    const { year, month, day } = parseYmd(r.until);
    s += `, bis ${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${year}`;
  }
  if (r.count) s += `, ${r.count}-mal`;
  return s;
}

/** n-tes Vorkommen (0 = erstes) als lokales Datum, oder null wenn es den Tag nicht gibt (31. Feb.). */
function nthDate(start: string, r: Rule, n: number): string | null {
  const { year, month, day } = parseYmd(start);
  switch (r.freq) {
    case "DAILY":
      return addDays(start, n * r.interval);
    case "WEEKLY":
      return addDays(start, n * 7 * r.interval);
    case "MONTHLY": {
      const m0 = month - 1 + n * r.interval;
      const y = year + Math.floor(m0 / 12);
      const m = (m0 % 12) + 1;
      return day <= daysInMonth(y, m) ? ymd(y, m, day) : null;
    }
    case "YEARLY": {
      const y = year + n * r.interval;
      return day <= daysInMonth(y, month) ? ymd(y, month, day) : null;
    }
  }
}

export type Occurrence = { startsAt: Date; endsAt: Date };

/**
 * Alle Vorkommen, die [from, to) berühren. allDay-Termine laufen über lokale Mitternacht.
 * Begrenzt auf 2000 Schritte als Schutz gegen Endlosschleifen.
 */
export function expand(
  ev: { startsAt: Date; endsAt: Date; allDay: boolean },
  rule: Rule,
  from: Date,
  to: Date,
): Occurrence[] {
  const s = utcToBerlin(ev.startsAt);
  const e = utcToBerlin(ev.endsAt);
  // Dauer in ganzen Tagen + Uhrzeit des Endes, damit mehrtägige Termine mitwandern.
  const spanDays = Math.round((Date.parse(e.date) - Date.parse(s.date)) / 86400000);
  const durationMs = ev.endsAt.getTime() - ev.startsAt.getTime();
  const out: Occurrence[] = [];
  // Täglich/wöchentlich: direkt in die Nähe des Zeitraums springen (dort fällt kein Datum aus).
  let first = 0;
  if (rule.freq === "DAILY" || rule.freq === "WEEKLY") {
    const step = (rule.freq === "DAILY" ? 1 : 7) * rule.interval;
    const diffDays = Math.floor((from.getTime() - ev.startsAt.getTime()) / 86400000) - spanDays - 1;
    first = Math.max(0, Math.floor(diffDays / step));
  }
  let produced = first;
  for (let n = first; n < first + 2000; n++) {
    const date = nthDate(s.date, rule, n);
    if (date === null) continue; // z. B. kein 31. in diesem Monat: überspringen, zählt nicht
    if (rule.until && date > rule.until) break;
    if (rule.count && produced >= rule.count) break;
    produced++;
    const startsAt = berlinToUtc(date, ev.allDay ? "00:00" : s.time);
    const endsAt = ev.allDay
      ? berlinToUtc(addDays(date, spanDays), "00:00")
      : spanDays > 0
        ? berlinToUtc(addDays(date, spanDays), e.time)
        : new Date(startsAt.getTime() + durationMs);
    if (startsAt >= to) break;
    if (endsAt > from) out.push({ startsAt, endsAt });
  }
  return out;
}

/** Ende der Serie (Ende des letzten Vorkommens) oder null, wenn sie unbegrenzt ist. */
export function seriesEnd(ev: { startsAt: Date; endsAt: Date; allDay: boolean }, rule: Rule): Date | null {
  if (!rule.until && !rule.count) return null;
  const all = expand(ev, rule, ev.startsAt, new Date(8.64e15));
  return all.length ? all[all.length - 1].endsAt : ev.endsAt;
}
