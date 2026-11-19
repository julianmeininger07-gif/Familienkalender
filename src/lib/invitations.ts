import "server-only";
import { and, asc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { eventAttendees, events, users } from "@/db/schema";

/** Noch nicht vorbei: Einzeltermin endet in der Zukunft, oder Serie läuft noch. */
const notOver = () =>
  or(and(isNull(events.rrule), gt(events.endsAt, new Date())), and(sql`${events.rrule} is not null`, or(isNull(events.repeatUntil), gt(events.repeatUntil, new Date()))));

/** Anzahl offener Einladungen mit Antwortpflicht (für die Zahl am Menüpunkt). */
export async function openInvitationCount(userId: string): Promise<number> {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(eventAttendees)
    .innerJoin(events, eq(events.id, eventAttendees.eventId))
    .where(
      and(eq(eventAttendees.userId, userId), eq(eventAttendees.responseRequired, true), eq(eventAttendees.response, "pending"), notOver()),
    );
  return count;
}

/** Alle aktuellen Einladungen des Benutzers, offene mit Antwortpflicht zuerst. */
export async function myInvitations(userId: string) {
  return db
    .select({
      eventId: events.id,
      title: events.title,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      allDay: events.allDay,
      rrule: events.rrule,
      ownerName: users.name,
      ownerColor: users.color,
      required: eventAttendees.responseRequired,
      response: eventAttendees.response,
    })
    .from(eventAttendees)
    .innerJoin(events, eq(events.id, eventAttendees.eventId))
    .innerJoin(users, eq(users.id, events.ownerId))
    .where(and(eq(eventAttendees.userId, userId), notOver()))
    .orderBy(asc(events.startsAt));
}
