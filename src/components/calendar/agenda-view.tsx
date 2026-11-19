"use client";

import { useEffect, useState } from "react";
import { daysInMonth, todayInBerlin, weekday, ymd } from "@/lib/dates";
import { holidaysBetween } from "@/lib/holidays";
import { fetchCalendarData, type SchoolHoliday } from "./types";

const dayFmt = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const shortFmt = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
const asDate = (s: string) => new Date(`${s}T00:00:00Z`);

type AgendaItem = { kind: "feiertag"; title: string };

/**
 * Listenansicht eines Monats, fürs Handy gedacht: Schulferien einmal oben als Band,
 * darunter nur die Tage, an denen etwas ist.
 */
export function AgendaView({ year, month, onPickDay }: { year: number; month: number; onPickDay: (d: string) => void }) {
  const [ferien, setFerien] = useState<SchoolHoliday[]>([]);
  const [error, setError] = useState<string | null>(null);
  const start = ymd(year, month, 1);
  const end = ymd(year, month, daysInMonth(year, month));
  const today = todayInBerlin();

  useEffect(() => {
    let alive = true;
    fetchCalendarData(start, end)
      .then((d) => alive && (setFerien(d.schoolHolidays), setError(null)))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [start, end]);

  const byDay = new Map<string, AgendaItem[]>();
  for (const h of holidaysBetween(start, end)) {
    byDay.set(h.date, [...(byDay.get(h.date) ?? []), { kind: "feiertag", title: h.name }]);
  }
  const days = [...byDay.keys()].sort();

  return (
    <div className="space-y-4">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}

      {ferien.length > 0 && (
        <ul className="space-y-2">
          {ferien.map((f) => (
            <li key={f.id} className="rounded-lg bg-ferien px-3 py-2 text-sm">
              <span className="font-semibold">{f.name}</span>{" "}
              {f.startDate === f.endDate
                ? shortFmt.format(asDate(f.startDate))
                : `${shortFmt.format(asDate(f.startDate))} – ${shortFmt.format(asDate(f.endDate))}`}
            </li>
          ))}
        </ul>
      )}

      {days.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">Keine Einträge in diesem Monat.</p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200">
          {days.map((d) => {
            const inFerien = ferien.some((f) => f.startDate <= d && f.endDate >= d);
            const red = weekday(d) === 0 || byDay.get(d)!.some((i) => i.kind === "feiertag");
            return (
              <li key={d}>
                <button
                  type="button"
                  onClick={() => onPickDay(d)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-gray-50"
                >
                  <span
                    className={`w-40 shrink-0 text-sm ${red ? "font-bold text-feiertag" : "font-medium"} ${d === today ? "underline" : ""}`}
                  >
                    {dayFmt.format(asDate(d))}
                    {inFerien && <span className="ml-2 inline-block h-2.5 w-2.5 rounded-full bg-ferien align-middle" />}
                  </span>
                  <span className="space-y-1 text-sm">
                    {byDay.get(d)!.map((item, i) => (
                      <span key={i} className={`block ${item.kind === "feiertag" ? "font-semibold text-feiertag" : ""}`}>
                        {item.title}
                      </span>
                    ))}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

