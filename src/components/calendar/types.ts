export type SchoolHoliday = { id: string; name: string; startDate: string; endDate: string };

export type CalendarEvent = {
  id: string;
  title: string;
  allDay: boolean;
  start: string;
  end: string;
  ownerId: string;
  categoryId: string | null;
  visibility: "public" | "private";
  location: string | null;
};

export type CalendarData = { schoolHolidays: SchoolHoliday[]; events: CalendarEvent[] };

export type Person = { id: string; name: string; color: string };
export type Category = { id: string; name: string; color: string; shared: boolean };

/** Ausgeblendete Personen/Kategorien. "none" = Termine ohne Kategorie. */
export type Filters = { hiddenUserIds: string[]; hiddenCategoryIds: string[] };

export function isVisible(e: Pick<CalendarEvent, "ownerId" | "categoryId">, f: Filters): boolean {
  if (f.hiddenUserIds.includes(e.ownerId)) return false;
  return !f.hiddenCategoryIds.includes(e.categoryId ?? "none");
}

export type ViewName = "year" | "dayGridMonth" | "timeGridWeek" | "timeGridDay" | "list";

export const VIEW_LABELS: Record<ViewName, string> = {
  year: "Jahr",
  dayGridMonth: "Monat",
  timeGridWeek: "Woche",
  timeGridDay: "Tag",
  list: "Liste",
};

export async function fetchCalendarData(start: string, end: string): Promise<CalendarData> {
  const res = await fetch(`/api/kalender?start=${start}&end=${end}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Kalenderdaten konnten nicht geladen werden.");
  return res.json();
}
