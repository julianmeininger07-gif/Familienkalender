import { and, gte, lte } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { schoolHolidays } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Kalenderdaten für einen Zeitraum: Schulferien (Feiertage rechnet der Browser selbst). */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const start = req.nextUrl.searchParams.get("start")?.slice(0, 10) ?? "";
  const end = req.nextUrl.searchParams.get("end")?.slice(0, 10) ?? "";
  if (!DATE.test(start) || !DATE.test(end) || start > end) {
    return NextResponse.json({ error: "Ungültiger Zeitraum" }, { status: 400 });
  }

  const ferien = await db
    .select({
      id: schoolHolidays.id,
      name: schoolHolidays.name,
      startDate: schoolHolidays.startDate,
      endDate: schoolHolidays.endDate,
    })
    .from(schoolHolidays)
    .where(and(lte(schoolHolidays.startDate, end), gte(schoolHolidays.endDate, start)))
    .orderBy(schoolHolidays.startDate);

  return NextResponse.json({ schoolHolidays: ferien });
}
