import "server-only";
import { and, eq, exists, gt, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { eventAttendees, eventExceptions, events } from "@/db/schema";
import type { CurrentUser } from "./auth";
import { addDays } from "./dates";
import { expand, formatRule, parseRule, seriesEnd, type Rule } from "./recurrence";
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

export type Occurrence = { event: EventRow; startsAt: Date; endsAt: Date; recurring: boolean };

/**
 * Alle Vorkommen im Zeitraum [from, to), die der Benutzer sehen darf.
 * Serien werden aufgefächert, abgesagte Einzeltermine fallen weg.
 */
export async function occurrencesInRange(user: CurrentUser, from: Date, to: Date): Promise<Occurrence[]> {
  const rows = await db
    .select()
    .from(events)
    .where(
      and(
        visibleTo(user.id),
        lt(events.startsAt, to),
        or(
          and(isNull(events.rrule), gt(events.endsAt, from)),
          and(isNotNull(events.rrule), or(isNull(events.repeatUntil), gt(events.repeatUntil, from))),
        ),
      ),
    );

  const seriesIds = rows.filter((r) => r.rrule).map((r) => r.id);
  const cancelled = seriesIds.length
    ? await db
        .select({ eventId: eventExceptions.eventId, originalStart: eventExceptions.originalStart })
        .from(eventExceptions)
        .where(and(inArray(eventExceptions.eventId, seriesIds), eq(eventExceptions.cancelled, true)))
    : [];
  const skip = new Set(cancelled.map((c) => `${c.eventId}|${c.originalStart.toISOString()}`));

  const out: Occurrence[] = [];
  for (const ev of rows) {
    const rule = ev.rrule ? parseRule(ev.rrule) : null;
    if (!rule) {
      out.push({ event: ev, startsAt: ev.startsAt, endsAt: ev.endsAt, recurring: false });
      continue;
    }
    for (const o of expand(ev, rule, from, to)) {
      if (skip.has(`${ev.id}|${o.startsAt.toISOString()}`)) continue;
      out.push({ event: ev, ...o, recurring: true });
    }
  }
  return out;
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

/** Wiederholungsregel aus dem Formular, inklusive Serienende für die Abfrage. */
export function toRecurrence(
  v: EventInputData,
  times: { startsAt: Date; endsAt: Date },
): { rrule: string | null; repeatUntil: Date | null } {
  if (!v.repeat) return { rrule: null, repeatUntil: null };
  const rule: Rule = { freq: v.freq, interval: v.interval };
  if (v.repeatEnd === "until" && v.until) rule.until = v.until;
  if (v.repeatEnd === "count") rule.count = v.count;
  return { rrule: formatRule(rule), repeatUntil: seriesEnd({ ...times, allDay: v.allDay }, rule) };
}
