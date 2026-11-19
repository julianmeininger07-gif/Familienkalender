import { and, gte, lte } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { schoolHolidays } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { addDays } from "@/lib/dates";
import { eventsInRange } from "@/lib/events";
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
    eventsInRange(user, berlinToUtc(start), berlinToUtc(addDays(end, 1))),
  ]);

  const events = rows.map((e) => ({
    id: e.id,
    title: e.title,
    allDay: e.allDay,
    // Ganztägig: reine Kalenderdaten (Ende exklusiv), sonst Zeitpunkte.
    start: e.allDay ? utcToBerlin(e.startsAt).date : e.startsAt.toISOString(),
    end: e.allDay ? utcToBerlin(e.endsAt).date : e.endsAt.toISOString(),
    ownerId: e.ownerId,
    categoryId: e.categoryId,
    visibility: e.visibility,
    location: e.location,
  }));

  return NextResponse.json({ schoolHolidays: ferien, events });
}
