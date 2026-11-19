export type SchoolHoliday = { id: string; name: string; startDate: string; endDate: string };

export type CalendarData = { schoolHolidays: SchoolHoliday[] };

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
