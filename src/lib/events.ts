import "server-only";
import { and, eq, exists, gt, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { eventAttendees, events } from "@/db/schema";
import type { CurrentUser } from "./auth";
import { addDays } from "./dates";
import { berlinToUtc } from "./time";
import type { EventInputData } from "./validation";

export type EventRow = typeof events.$inferSelect;

/** Darf der Benutzer den Termin sehen? Öffentlich, eigener oder eingeladen. */
export function visibleTo(userId: string) {
  return or(
    eq(events.visibility, "public"),
    eq(events.ownerId, userId),
    exists(
      db
        .select({ one: sql`1` })
        .from(eventAttendees)
        .where(and(eq(eventAttendees.eventId, events.id), eq(eventAttendees.userId, userId))),
    ),
  );
}

export function canCreate(user: CurrentUser): boolean {
  return user.role !== "reader";
}

export function canEdit(user: CurrentUser, event: Pick<EventRow, "ownerId">): boolean {
  return event.ownerId === user.id || user.role === "admin";
}

/** Termine, die den Zeitraum [from, to) berühren und für den Benutzer sichtbar sind. */
export async function eventsInRange(user: CurrentUser, from: Date, to: Date) {
  return db
    .select()
    .from(events)
    .where(and(visibleTo(user.id), lt(events.startsAt, to), gt(events.endsAt, from)));
}

/** Formular-Daten → Beginn/Ende in UTC. Ganztägige Termine: Ende exklusiv (Mitternacht danach). */
export function toTimes(v: EventInputData): { startsAt: Date; endsAt: Date } | { error: string } {
  if (v.allDay) {
    const endDate = v.endDate || v.startDate;
    if (endDate < v.startDate) return { error: "Das Ende liegt vor dem Beginn." };
    return { startsAt: berlinToUtc(v.startDate), endsAt: berlinToUtc(addDays(endDate, 1)) };
  }
  const startsAt = berlinToUtc(v.startDate, v.startTime);
  const endsAt = v.endTime
    ? berlinToUtc(v.endDate || v.startDate, v.endTime)
    : new Date(startsAt.getTime() + 60 * 60 * 1000); // ohne Ende: 1 Stunde
  if (endsAt < startsAt) return { error: "Das Ende liegt vor dem Beginn." };
  return { startsAt, endsAt };
}

/** Einen Termin laden, aber nur, wenn der Benutzer ihn sehen darf. */
export async function loadVisibleEvent(user: CurrentUser, id: string): Promise<EventRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [e] = await db
    .select()
    .from(events)
    .where(and(eq(events.id, id), visibleTo(user.id)))
    .limit(1);
  return e ?? null;
}
