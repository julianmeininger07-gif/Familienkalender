"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { addDays, daysInMonth, todayInBerlin, weekday, ymd } from "@/lib/dates";
import { holidaysBetween } from "@/lib/holidays";
import type { CalendarContext } from "./calendar-view";
import { fetchCalendarData, isVisible, type CalendarEvent, type SchoolHoliday } from "./types";

const dayFmt = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const shortFmt = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
const timeFmt = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
const dateOfFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" });
const asDate = (s: string) => new Date(`${s}T00:00:00Z`);

type Item =
  | { kind: "feiertag"; title: string }
  | { kind: "termin"; event: CalendarEvent; time: string };

/** Alle Kalendertage, die ein Termin berührt (für mehrtägige Termine). */
function daysOf(e: CalendarEvent): string[] {
  const first = e.allDay ? e.start : dateOfFmt.format(new Date(e.start));
  const last = e.allDay ? addDays(e.end, -1) : dateOfFmt.format(new Date(new Date(e.end).getTime() - 1));
  const out: string[] = [];
  for (let d = first; d <= last && out.length < 62; d = addDays(d, 1)) out.push(d);
  return out.length ? out : [first];
}

/**
 * Listenansicht eines Monats, fürs Handy gedacht: Schulferien einmal oben als Band,
 * darunter nur die Tage, an denen etwas ist.
 */
export function AgendaView({
  year,
  month,
  ctx,
  onPickDay,
}: {
  year: number;
  month: number;
  ctx: CalendarContext;
  onPickDay: (d: string) => void;
}) {
  const [ferien, setFerien] = useState<SchoolHoliday[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const start = ymd(year, month, 1);
  const end = ymd(year, month, daysInMonth(year, month));
  const today = todayInBerlin();

  useEffect(() => {
    let alive = true;
    fetchCalendarData(start, end)
      .then((d) => {
        if (!alive) return;
        setFerien(d.schoolHolidays);
        setEvents(d.events);
        setError(null);
      })
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [start, end]);

  const byDay = new Map<string, Item[]>();
  const add = (d: string, item: Item) => byDay.set(d, [...(byDay.get(d) ?? []), item]);
  for (const h of holidaysBetween(start, end)) add(h.date, { kind: "feiertag", title: h.name });
  const sorted = events.filter((e) => isVisible(e, ctx.filters)).sort((a, b) => a.start.localeCompare(b.start));
  for (const e of sorted) {
    for (const d of daysOf(e)) {
      if (d < start || d > end) continue;
      const time = e.allDay ? "ganztägig" : `${timeFmt.format(new Date(e.start))}–${timeFmt.format(new Date(e.end))}`;
      add(d, { kind: "termin", event: e, time });
    }
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
            const items = byDay.get(d)!;
            const inFerien = ferien.some((f) => f.startDate <= d && f.endDate >= d);
            const red = weekday(d) === 0 || items.some((i) => i.kind === "feiertag");
            return (
              <li key={d} className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => onPickDay(d)}
                  className={`mb-1 text-left text-sm ${red ? "font-bold text-feiertag" : "font-semibold"} ${d === today ? "underline" : ""}`}
                >
                  {dayFmt.format(asDate(d))}
                  {inFerien && <span className="ml-2 inline-block h-2.5 w-2.5 rounded-full bg-ferien align-middle" />}
                </button>
                <ul className="space-y-1">
                  {items.map((item, i) =>
                    item.kind === "feiertag" ? (
                      <li key={i} className="text-sm font-semibold text-feiertag">
                        {item.title}
                      </li>
                    ) : (
                      <li key={i}>
                        <Link
                          href={`/termin/${item.event.id}`}
                          className="flex items-start gap-2 rounded-lg px-1 py-1 text-sm hover:bg-gray-50"
                        >
                          <span
                            className="mt-1 h-3 w-3 shrink-0 rounded-full border-2"
                            style={{
                              background: ctx.people.find((p) => p.id === item.event.ownerId)?.color ?? "#475569",
                              borderColor:
                                ctx.categories.find((c) => c.id === item.event.categoryId)?.color ??
                                ctx.people.find((p) => p.id === item.event.ownerId)?.color ??
                                "#475569",
                            }}
                          />
                          <span className="w-24 shrink-0 tabular-nums text-gray-500">{item.time}</span>
                          <span className="min-w-0">
                            <span className="font-medium">
                              {item.event.visibility === "private" && "🔒 "}
                              {item.event.title}
                            </span>
                            {item.event.location && <span className="block truncate text-xs text-gray-500">{item.event.location}</span>}
                          </span>
                        </Link>
                      </li>
                    ),
                  )}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
