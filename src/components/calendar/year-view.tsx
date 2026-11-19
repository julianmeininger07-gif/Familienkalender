"use client";

import { useEffect, useMemo, useState } from "react";
import { daysInMonth, isoWeek, todayInBerlin, weekday, ymd } from "@/lib/dates";
import { bavarianHolidays } from "@/lib/holidays";
import { fetchCalendarData, type SchoolHoliday } from "./types";

const MONTHS = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];
const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

const short = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "UTC" });
const fmt = (s: string) => short.format(new Date(`${s}T00:00:00Z`));

/**
 * Jahresübersicht im Stil eines gedruckten Bayern-Kalenders:
 * zwölf Monate, Feiertage rot, Schulferien neongelb hinterlegt.
 */
export function YearView({ year, onPickDay }: { year: number; onPickDay: (date: string) => void }) {
  const [ferien, setFerien] = useState<SchoolHoliday[]>([]);
  const [error, setError] = useState<string | null>(null);
  const today = todayInBerlin();

  useEffect(() => {
    let alive = true;
    fetchCalendarData(ymd(year, 1, 1), ymd(year, 12, 31))
      .then((d) => alive && (setFerien(d.schoolHolidays), setError(null)))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [year]);

  const holidays = useMemo(() => new Map(bavarianHolidays(year).map((h) => [h.date, h.name])), [year]);
  const ferienOf = (date: string) => ferien.find((f) => f.startDate <= date && f.endDate >= date);

  return (
    <div>
      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {MONTHS.map((name, idx) => {
          const month = idx + 1;
          const first = ymd(year, month, 1);
          const offset = (weekday(first) + 6) % 7; // Montag = 0
          const total = daysInMonth(year, month);
          const cells: (string | null)[] = [
            ...Array.from({ length: offset }, () => null),
            ...Array.from({ length: total }, (_, i) => ymd(year, month, i + 1)),
          ];
          while (cells.length % 7) cells.push(null);
          const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));

          return (
            <section key={name} aria-label={`${name} ${year}`}>
              <h3 className="mb-1 border-b-2 border-gray-900 pb-1 text-sm font-bold uppercase tracking-wide">
                {name}
              </h3>
              <table className="w-full table-fixed border-collapse text-center text-xs">
                <thead>
                  <tr className="text-gray-500">
                    <th className="w-7 py-1 font-normal text-gray-400">KW</th>
                    {WEEKDAYS.map((d, i) => (
                      <th key={d} className={`py-1 font-semibold ${i === 6 ? "text-feiertag" : ""}`}>
                        {d}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {weeks.map((week, wi) => {
                    const firstDay = week.find(Boolean)!;
                    return (
                      <tr key={wi}>
                        <td className="py-0.5 text-[10px] text-gray-400">{isoWeek(firstDay)}</td>
                        {week.map((date, di) => {
                          if (!date) return <td key={di} />;
                          const holiday = holidays.get(date);
                          const f = ferienOf(date);
                          const red = holiday || di === 6;
                          const isToday = date === today;
                          return (
                            <td key={date} className={`p-0 ${f ? "bg-ferien" : ""}`}>
                              <button
                                type="button"
                                onClick={() => onPickDay(date)}
                                title={[holiday, f?.name].filter(Boolean).join(" · ") || undefined}
                                className={`h-7 w-full text-xs tabular-nums hover:bg-gray-900/10 ${red ? "font-bold text-feiertag" : di === 5 ? "text-gray-600" : ""} ${isToday ? "rounded-full ring-2 ring-gray-900 ring-inset" : ""}`}
                              >
                                {Number(date.slice(8))}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <ul className="mt-1 space-y-0.5 text-[11px] leading-tight text-gray-600">
                {[...holidays]
                  .filter(([d]) => d.slice(5, 7) === String(month).padStart(2, "0"))
                  .map(([d, n]) => (
                    <li key={d}>
                      <span className="font-semibold text-feiertag">{Number(d.slice(8))}.</span> {n}
                    </li>
                  ))}
              </ul>
            </section>
          );
        })}
      </div>

      <div className="mt-10 border-t border-gray-200 pt-4">
        <h3 className="mb-2 text-sm font-bold">Schulferien Bayern {year}</h3>
        {ferien.length === 0 && !error ? (
          <p className="text-sm text-gray-500">Für dieses Jahr sind noch keine Schulferien eingetragen.</p>
        ) : (
          <ul className="flex flex-wrap gap-2 text-xs">
            {ferien.map((f) => (
              <li key={f.id} className="rounded bg-ferien px-2 py-1">
                <span className="font-semibold">{f.name}</span>{" "}
                {f.startDate === f.endDate ? fmt(f.startDate) : `${fmt(f.startDate)} – ${fmt(f.endDate)}`}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500">
          <span>
            <span className="font-bold text-feiertag">rot</span> = Feiertag / Sonntag
          </span>
          <span>
            <span className="bg-ferien px-1">gelb</span> = Schulferien
          </span>
        </p>
      </div>
    </div>
  );
}
