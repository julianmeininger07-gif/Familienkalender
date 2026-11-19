"use client";

import deLocale from "@fullcalendar/core/locales/de";
import type { DayCellContentArg, EventClickArg, EventInput, EventSourceFuncArg } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, { type DateClickArg } from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { saveFilterPreferences } from "@/actions/preferences";
import { addDays, todayInBerlin, weekday } from "@/lib/dates";
import { bavarianHolidays, holidaysBetween } from "@/lib/holidays";
import { AgendaView } from "./agenda-view";
import { FilterPanel } from "./filter-panel";
import {
  fetchCalendarData,
  isVisible,
  VIEW_LABELS,
  type CalendarEvent,
  type Category,
  type Filters,
  type Person,
  type ViewName,
} from "./types";
import { YearView } from "./year-view";

const VIEW_KEY = "fk:view";
const VIEWS: ViewName[] = ["year", "dayGridMonth", "timeGridWeek", "timeGridDay", "list"];
const MONTH_NAMES = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

function toYmd(d: Date): string {
  // FullCalendar liefert lokale Mitternacht; als Kalenderdatum lesen.
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shiftMonths(date: string, n: number): string {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7)) - 1 + n;
  const d = new Date(Date.UTC(y, m, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
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

function dayCellClassNames(arg: DayCellContentArg): string[] {
  const d = toYmd(arg.date);
  return isHoliday(d) || weekday(d) === 0 ? ["fk-red"] : [];
}

const isFcView = (v: ViewName) => v !== "year" && v !== "list";

export type CalendarContext = {
  people: Person[];
  categories: Category[];
  filters: Filters;
};

/** Ein Termin als FullCalendar-Eintrag: Farbe der Person, Rand in Kategoriefarbe. */
export function toFcEvent(e: CalendarEvent, ctx: CalendarContext): EventInput {
  const owner = ctx.people.find((p) => p.id === e.ownerId);
  const cat = ctx.categories.find((c) => c.id === e.categoryId);
  const color = owner?.color ?? "#475569";
  return {
    id: e.id,
    title: `${e.visibility === "private" ? "🔒 " : ""}${e.title}`,
    start: e.start,
    end: e.end,
    allDay: e.allDay,
    backgroundColor: color,
    borderColor: cat?.color ?? color,
    textColor: "#ffffff",
    classNames: ["fk-termin", cat ? "fk-mit-kategorie" : ""],
    extendedProps: { kind: "termin", location: e.location },
  };
}

export function CalendarView({
  people,
  categories,
  initialFilters,
  canCreate,
  initialDate,
}: {
  people: Person[];
  categories: Category[];
  initialFilters: Filters;
  canCreate: boolean;
  initialDate?: string;
}) {
  const router = useRouter();
  const ref = useRef<FullCalendar>(null);
  const [view, setView] = useState<ViewName>("dayGridMonth");
  const [ready, setReady] = useState(false);
  const [title, setTitle] = useState("");
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [showFilters, setShowFilters] = useState(false);
  // Das Datum, um das sich die Ansicht dreht; wird zwischen den Ansichten mitgenommen.
  const [cursor, setCursor] = useState(() => initialDate ?? todayInBerlin());

  // Aktueller Stand für die (stabile) Datenquelle von FullCalendar.
  const ctxRef = useRef<CalendarContext>({ people, categories, filters });
  ctxRef.current = { people, categories, filters };

  const eventSource = useCallback(
    (info: EventSourceFuncArg, ok: (e: EventInput[]) => void, fail: (e: Error) => void) => {
      const start = toYmd(info.start);
      const end = toYmd(info.end);
      fetchCalendarData(start, end)
        .then(({ schoolHolidays, events }) => {
          const ctx = ctxRef.current;
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
          const termine = events.filter((e) => isVisible(e, ctx.filters)).map((e) => toFcEvent(e, ctx));
          ok([...feiertage, ...ferien, ...termine]);
        })
        .catch(fail);
    },
    [],
  );

  // Gemerkte Ansicht laden (pro Gerät).
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

  // Filter geändert: Kalender neu zeichnen und Einstellung speichern.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    ref.current?.getApi().refetchEvents();
    const t = setTimeout(() => saveFilterPreferences(filters).catch(() => {}), 400);
    return () => clearTimeout(t);
  }, [filters]);

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

  const onEventClick = (arg: EventClickArg) => {
    if (arg.event.extendedProps.kind === "termin") router.push(`/termin/${arg.event.id}`);
  };

  const onDateClick = (arg: DateClickArg) => {
    if (!canCreate) return;
    const date = toYmd(arg.date);
    const time = arg.allDay ? "" : `&zeit=${String(arg.date.getHours()).padStart(2, "0")}:${String(arg.date.getMinutes()).padStart(2, "0")}`;
    router.push(`/termin/neu?datum=${date}${time}`);
  };

  const year = Number(cursor.slice(0, 4));
  const month = Number(cursor.slice(5, 7));
  const heading = view === "year" ? String(year) : view === "list" ? `${MONTH_NAMES[month - 1]} ${year}` : title;
  const hiddenCount = filters.hiddenUserIds.length + filters.hiddenCategoryIds.length;
  const ctx: CalendarContext = { people, categories, filters };

  return (
    <div className="fk-calendar flex gap-6">
      <aside className={`${showFilters ? "block" : "hidden"} fixed inset-0 z-30 overflow-y-auto bg-white p-4 lg:static lg:z-auto lg:block lg:w-56 lg:shrink-0 lg:p-0`}>
        <div className="mb-4 flex items-center justify-between lg:hidden">
          <h2 className="text-lg font-bold">Anzeigen</h2>
          <button type="button" onClick={() => setShowFilters(false)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm">
            Fertig
          </button>
        </div>
        {canCreate && (
          <Link
            href={`/termin/neu?datum=${isFcView(view) || view === "list" ? cursor : todayInBerlin()}`}
            className="mb-6 hidden w-full rounded-lg bg-gray-900 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-gray-700 lg:block"
          >
            + Neuer Termin
          </Link>
        )}
        <FilterPanel people={people} categories={categories} filters={filters} onChange={setFilters} />
      </aside>

      <div className="min-w-0 flex-1">
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
          <button
            type="button"
            onClick={() => setShowFilters(true)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm lg:hidden"
          >
            Filter{hiddenCount > 0 ? ` (${hiddenCount})` : ""}
          </button>
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
          <AgendaView year={year} month={month} ctx={ctx} onPickDay={(d) => changeView("timeGridDay", d)} />
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
            eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
            events={eventSource}
            eventClick={onEventClick}
            dateClick={onDateClick}
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

      {canCreate && (
        <Link
          href={`/termin/neu?datum=${view === "year" ? todayInBerlin() : cursor}`}
          aria-label="Neuer Termin"
          className="fixed right-4 bottom-20 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-gray-900 text-3xl text-white shadow-lg lg:hidden"
        >
          +
        </Link>
      )}
    </div>
  );
}
