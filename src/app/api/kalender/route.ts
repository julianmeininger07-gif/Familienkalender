import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { eventAttendees, schoolHolidays } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { addDays } from "@/lib/dates";
import { occurrencesInRange } from "@/lib/events";
import { berlinToUtc, utcToBerlin } from "@/lib/time";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Kalenderdaten für einen Zeitraum: Termine und Schulferien (Feiertage rechnet der Browser selbst). */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const start = req.nextUrl.searchParams.get("start")?.slice(0, 10) ?? "";
  const end = req.nextUrl.searchParams.get("end")?.slice(0, 10) ?? "";
  if (!DATE.test(start) || !DATE.test(end) || start > end) {
    return NextResponse.json({ error: "Ungültiger Zeitraum" }, { status: 400 });
  }

  const [ferien, rows] = await Promise.all([
    db
      .select({
        id: schoolHolidays.id,
        name: schoolHolidays.name,
        startDate: schoolHolidays.startDate,
        endDate: schoolHolidays.endDate,
      })
      .from(schoolHolidays)
      .where(and(lte(schoolHolidays.startDate, end), gte(schoolHolidays.endDate, start)))
      .orderBy(schoolHolidays.startDate),
    occurrencesInRange(user, berlinToUtc(start), berlinToUtc(addDays(end, 1))),
  ]);

  const ids = [...new Set(rows.map((r) => r.event.id))];
  const mine = ids.length
    ? await db
        .select({ eventId: eventAttendees.eventId, response: eventAttendees.response, required: eventAttendees.responseRequired })
        .from(eventAttendees)
        .where(and(eq(eventAttendees.userId, user.id), inArray(eventAttendees.eventId, ids)))
    : [];
  const myStatus = new Map(mine.map((m) => [m.eventId, m]));

  const events = rows.map(({ event: e, startsAt, endsAt, recurring }) => ({
    id: e.id,
    // Vorkommen einer Serie: Beginn als Schlüssel, damit Klick und Absage das richtige treffen.
    occurrence: recurring ? startsAt.toISOString() : null,
    title: e.title,
    allDay: e.allDay,
    // Ganztägig: reine Kalenderdaten (Ende exklusiv), sonst Zeitpunkte.
    start: e.allDay ? utcToBerlin(startsAt).date : startsAt.toISOString(),
    end: e.allDay ? utcToBerlin(endsAt).date : endsAt.toISOString(),
    ownerId: e.ownerId,
    categoryId: e.categoryId,
    visibility: e.visibility,
    location: e.location,
    invitation: myStatus.get(e.id) ? { response: myStatus.get(e.id)!.response, required: myStatus.get(e.id)!.required } : null,
  }));

  return NextResponse.json({ schoolHolidays: ferien, events });
}
