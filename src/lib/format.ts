import { addDays } from "./dates";
import { utcToBerlin } from "./time";

const dateFmt = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
export const showDate = (d: string) => dateFmt.format(new Date(`${d}T00:00:00Z`));

/** "Donnerstag, 27. Mai 2027, 14:00–15:00 Uhr" usw. */
export function formatEventTime(e: { allDay: boolean; startsAt: Date; endsAt: Date }): string {
  const s = utcToBerlin(e.startsAt);
  const en = utcToBerlin(e.endsAt);
  if (e.allDay) {
    const last = addDays(en.date, -1);
    return last === s.date ? `${showDate(s.date)}, ganztägig` : `${showDate(s.date)} bis ${showDate(last)}`;
  }
  if (s.date === en.date) return `${showDate(s.date)}, ${s.time}–${en.time} Uhr`;
  return `${showDate(s.date)}, ${s.time} Uhr bis ${showDate(en.date)}, ${en.time} Uhr`;
}
