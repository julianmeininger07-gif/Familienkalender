"use client";

import deLocale from "@fullcalendar/core/locales/de";
import type { DayCellContentArg, EventInput, EventSourceFuncArg } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { useCallback, useEffect, useRef, useState } from "react";
import { addDays, todayInBerlin, weekday } from "@/lib/dates";
import { bavarianHolidays, holidaysBetween } from "@/lib/holidays";
import { fetchCalendarData, VIEW_LABELS, type ViewName } from "./types";
import { AgendaView } from "./agenda-view";
import { YearView } from "./year-view";

const VIEW_KEY = "fk:view";
const VIEWS: ViewName[] = ["year", "dayGridMonth", "timeGridWeek", "timeGridDay", "list"];

function toYmd(d: Date): string {
  // FullCalendar liefert lokale Mitternacht; als Kalenderdatum lesen.
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Feiertage und Schulferien als Kalender-Einträge. */
async function loadEntries(info: EventSourceFuncArg): Promise<EventInput[]> {
  const start = toYmd(info.start);
  const end = toYmd(info.end);
  const { schoolHolidays } = await fetchCalendarData(start, end);
  const ferien: EventInput[] = schoolHolidays.flatMap((f) => [
    {
      id: `ferien-bg-${f.id}`,
      start: f.startDate,
      end: addDays(f.endDate, 1), // Ende ist bei FullCalendar exklusiv
      allDay: true,
      display: "background",
      classNames: ["fk-ferien-bg"],
    },
    {
      id: `ferien-${f.id}`,
      title: f.name,
      start: f.startDate,
      end: addDays(f.endDate, 1),
      allDay: true,
      classNames: ["fk-ferien"],
      extendedProps: { kind: "ferien" },
    },
  ]);
  const feiertage: EventInput[] = holidaysBetween(start, end).map((h) => ({
    id: `feiertag-${h.date}`,
    title: h.name,
    start: h.date,
    allDay: true,
    classNames: ["fk-feiertag"],
    extendedProps: { kind: "feiertag" },
  }));
  return [...feiertage, ...ferien];
}

const holidayCache = new Map<number, Set<string>>();
function isHoliday(date: string): boolean {
  const year = Number(date.slice(0, 4));
  let set = holidayCache.get(year);
  if (!set) {
    set = new Set(bavarianHolidays(year).map((h) => h.date));
    holidayCache.set(year, set);
  }
  return set.has(date);
}

/** Stabile Funktion (außerhalb der Komponente), damit FullCalendar nicht ständig neu lädt. */
function eventSource(info: EventSourceFuncArg, ok: (e: EventInput[]) => void, fail: (e: Error) => void) {
  loadEntries(info).then(ok, fail);
}

function dayCellClassNames(arg: DayCellContentArg): string[] {
  const d = toYmd(arg.date);
  return isHoliday(d) || weekday(d) === 0 ? ["fk-red"] : [];
}

const MONTH_NAMES = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

function shiftMonths(date: string, n: number): string {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7)) - 1 + n;
  const d = new Date(Date.UTC(y, m, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

const isFcView = (v: ViewName) => v !== "year" && v !== "list";

export function CalendarView() {
  const ref = useRef<FullCalendar>(null);
  const [view, setView] = useState<ViewName>("dayGridMonth");
  const [ready, setReady] = useState(false);
  const [title, setTitle] = useState("");
  // Das Datum, um das sich die Ansicht dreht; wird zwischen den Ansichten mitgenommen.
  const [cursor, setCursor] = useState(() => todayInBerlin());

  // Zuletzt benutzte Ansicht merken (pro Gerät).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_KEY) as ViewName | null;
      if (saved && VIEWS.includes(saved)) setView(saved);
      else if (window.matchMedia("(max-width: 640px)").matches) setView("list");
    } catch {
      /* ohne Speicher einfach Standard */
    }
    setReady(true);
  }, []);

  const changeView = useCallback(
    (v: ViewName, date?: string) => {
      const target = date ?? cursor;
      if (date) setCursor(date);
      try {
        localStorage.setItem(VIEW_KEY, v);
      } catch {}
      const api = ref.current?.getApi();
      if (isFcView(v) && isFcView(view) && api) api.changeView(v, target);
      setView(v);
    },
    [cursor, view],
  );

  const nav = (dir: -1 | 0 | 1) => {
    if (dir === 0 && !isFcView(view)) return setCursor(todayInBerlin());
    if (view === "year") return setCursor((c) => `${Number(c.slice(0, 4)) + dir}-01-01`);
    if (view === "list") return setCursor((c) => shiftMonths(c, dir));
    const api = ref.current?.getApi();
    if (!api) return;
    if (dir === 0) api.today();
    else if (dir < 0) api.prev();
    else api.next();
  };

  const year = Number(cursor.slice(0, 4));
  const month = Number(cursor.slice(5, 7));
  const heading =
    view === "year" ? String(year) : view === "list" ? `${MONTH_NAMES[month - 1]} ${year}` : title;

  return (
    <div className="fk-calendar">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => nav(-1)} className="rounded-lg border border-gray-300 px-3 py-1.5" aria-label="Zurück">
            ‹
          </button>
          <button type="button" onClick={() => nav(0)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium">
            Heute
          </button>
          <button type="button" onClick={() => nav(1)} className="rounded-lg border border-gray-300 px-3 py-1.5" aria-label="Weiter">
            ›
          </button>
        </div>
        <h2 className="min-w-0 flex-1 truncate text-lg font-bold sm:text-xl">{heading}</h2>
        <div className="flex w-full overflow-hidden rounded-lg border border-gray-300 sm:w-auto" role="tablist">
          {VIEWS.map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => changeView(v)}
              className={`flex-1 px-3 py-1.5 text-sm ${view === v ? "bg-gray-900 font-semibold text-white" : "bg-white hover:bg-gray-50"}`}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>
      </div>

      {!ready ? null : view === "year" ? (
        <YearView year={year} onPickDay={(d) => changeView("timeGridDay", d)} />
      ) : view === "list" ? (
        <AgendaView year={year} month={month} onPickDay={(d) => changeView("timeGridDay", d)} />
      ) : (
        <FullCalendar
          ref={ref}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={view}
          initialDate={cursor}
          locale={deLocale}
          headerToolbar={false}
          height="auto"
          firstDay={1}
          weekNumbers
          weekText="KW"
          nowIndicator
          dayMaxEvents={4}
          scrollTime="07:00:00"
          slotMinTime="06:00:00"
          allDayText="ganzt."
          events={eventSource}
          datesSet={(arg) => {
            setTitle(arg.view.title);
            setCursor(toYmd(arg.view.currentStart));
          }}
          dayCellClassNames={dayCellClassNames}
          navLinks
          navLinkDayClick={(date) => changeView("timeGridDay", toYmd(date))}
        />
      )}
    </div>
  );
}
