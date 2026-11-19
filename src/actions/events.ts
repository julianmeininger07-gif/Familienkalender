"use server";

import { and, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { categories, eventAttendees, eventExceptions, events, reminders, users } from "@/db/schema";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { canCreate, canEdit, loadVisibleEvent, toRecurrence, toTimes } from "@/lib/events";
import type { FormState } from "@/lib/form-state";
import { notifyInvited, notifyResponse } from "@/lib/notify";
import { addDays } from "@/lib/dates";
import { utcToBerlin } from "@/lib/time";
import { firstError, parseEventForm, type EventInputData } from "@/lib/validation";

const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86400000);

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function categoryAllowed(ownerId: string, categoryId: string | null): Promise<boolean> {
  if (!categoryId) return true;
  const [c] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, categoryId), or(isNull(categories.ownerId), eq(categories.ownerId, ownerId))))
    .limit(1);
  return Boolean(c);
}

async function setMyReminders(tx: Tx, eventId: string, userId: string, minutes: number[]) {
  await tx.delete(reminders).where(and(eq(reminders.eventId, eventId), eq(reminders.userId, userId)));
  if (minutes.length) {
    await tx.insert(reminders).values(minutes.map((m) => ({ eventId, userId, minutesBefore: m })));
  }
}

/** Nur aktive Benutzer außer dem Ersteller können eingeladen werden. */
async function cleanAttendees(ownerId: string, list: EventInputData["attendees"]) {
  const ids = list.map((a) => a.userId).filter((id) => id !== ownerId);
  if (!ids.length) return [];
  const valid = await db
    .select({ id: users.id })
    .from(users)
    .where(and(inArray(users.id, ids), eq(users.status, "active")));
  const ok = new Set(valid.map((v) => v.id));
  return list.filter((a) => ok.has(a.userId) && a.userId !== ownerId);
}

/**
 * Teilnehmer abgleichen: Neue kommen dazu (Antwort offen), Entfernte fliegen raus,
 * Bestehende behalten ihre Antwort – außer die Zeit hat sich geändert.
 * Gibt die neu Eingeladenen zurück (für die Benachrichtigung).
 */
async function syncAttendees(tx: Tx, eventId: string, wanted: EventInputData["attendees"], timeChanged: boolean) {
  const current = await tx.select().from(eventAttendees).where(eq(eventAttendees.eventId, eventId));
  const wantedIds = new Set(wanted.map((w) => w.userId));
  const removed = current.filter((c) => !wantedIds.has(c.userId)).map((c) => c.userId);
  if (removed.length) {
    await tx.delete(eventAttendees).where(and(eq(eventAttendees.eventId, eventId), inArray(eventAttendees.userId, removed)));
  }
  const added: string[] = [];
  for (const w of wanted) {
    const existing = current.find((c) => c.userId === w.userId);
    if (!existing) {
      await tx.insert(eventAttendees).values({ eventId, userId: w.userId, responseRequired: w.required });
      added.push(w.userId);
    } else {
      const reset = timeChanged || (w.required && !existing.responseRequired);
      await tx
        .update(eventAttendees)
        .set({
          responseRequired: w.required,
          ...(reset ? { response: "pending" as const, respondedAt: null } : {}),
        })
        .where(and(eq(eventAttendees.eventId, eventId), eq(eventAttendees.userId, w.userId)));
    }
  }
  return added;
}

function fieldsFrom(v: EventInputData) {
  return {
    title: v.title,
    location: v.location,
    notes: v.notes,
    allDay: v.allDay,
    categoryId: v.categoryId,
    visibility: v.visibility,
  };
}

export async function createEvent(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser();
  if (!canCreate(me)) return { error: "Mit der Rolle „Nur lesen“ kannst du keine Termine anlegen." };
  const parsed = parseEventForm(form);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const v = parsed.data;
  const times = toTimes(v);
  if ("error" in times) return { error: times.error };
  if (!(await categoryAllowed(me.id, v.categoryId))) return { error: "Diese Kategorie gibt es nicht." };
  const attendees = await cleanAttendees(me.id, v.attendees);

  const id = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(events)
      .values({ ownerId: me.id, ...fieldsFrom(v), ...times, ...toRecurrence(v, times) })
      .returning({ id: events.id });
    await setMyReminders(tx, created.id, me.id, v.reminders);
    await syncAttendees(tx, created.id, attendees, false);
    return created.id;
  });
  await notifyInvited(id, attendees.map((a) => a.userId), me);
  revalidatePath("/");
  redirect(`/?datum=${v.startDate}`);
}

/**
 * Termin ändern. Bei Serien: scope "series" ändert alle Vorkommen,
 * scope "single" löst das gewählte Vorkommen heraus und macht daraus einen eigenen Termin.
 */
export async function updateEvent(eventId: string, occurrence: string | null, _prev: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser();
  const [existing] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (!existing || !canEdit(me, existing)) return { error: "Diesen Termin darfst du nicht bearbeiten." };
  const parsed = parseEventForm(form);
  if (!parsed.success) return { error: firstError(parsed.error) };
  let v = parsed.data;
  const single = Boolean(form.get("scope") === "single" && existing.rrule && occurrence);
  if (!single && existing.rrule && occurrence) {
    // Serie über ein späteres Vorkommen bearbeitet: Datum auf den Serienbeginn zurückrechnen,
    // damit die Serie nicht erst ab diesem Vorkommen läuft.
    const back = daysBetween(utcToBerlin(new Date(occurrence)).date, utcToBerlin(existing.startsAt).date);
    v = { ...v, startDate: addDays(v.startDate, back), endDate: v.endDate ? addDays(v.endDate, back) : v.endDate };
  }
  const times = toTimes(v);
  if ("error" in times) return { error: times.error };
  if (!(await categoryAllowed(existing.ownerId, v.categoryId))) return { error: "Diese Kategorie gibt es nicht." };
  const attendees = await cleanAttendees(existing.ownerId, v.attendees);

  if (single && occurrence) {
    const originalStart = new Date(occurrence);
    const newId = await db.transaction(async (tx) => {
      await tx
        .insert(eventExceptions)
        .values({ eventId, originalStart, cancelled: true })
        .onConflictDoUpdate({ target: [eventExceptions.eventId, eventExceptions.originalStart], set: { cancelled: true } });
      const [created] = await tx
        .insert(events)
        .values({ ownerId: existing.ownerId, ...fieldsFrom({ ...v, repeat: false }), ...times })
        .returning({ id: events.id });
      await setMyReminders(tx, created.id, me.id, v.reminders);
      await syncAttendees(tx, created.id, attendees, false);
      return created.id;
    });
    revalidatePath("/");
    redirect(`/termin/${newId}`);
  }

  const timeChanged =
    existing.startsAt.getTime() !== times.startsAt.getTime() ||
    existing.endsAt.getTime() !== times.endsAt.getTime() ||
    existing.allDay !== v.allDay;
  const recurrence = toRecurrence(v, times);
  const added = await db.transaction(async (tx) => {
    await tx
      .update(events)
      .set({ ...fieldsFrom(v), ...times, ...recurrence, updatedAt: new Date() })
      .where(eq(events.id, eventId));
    // Neue Regel oder keine Serie mehr: alte Ausnahmen passen nicht mehr.
    // Nur verschoben: Ausnahmen (z. B. gelöschte Einzeltermine) mitverschieben.
    if (recurrence.rrule !== existing.rrule) {
      await tx.delete(eventExceptions).where(eq(eventExceptions.eventId, eventId));
    } else if (timeChanged) {
      const shiftMs = times.startsAt.getTime() - existing.startsAt.getTime();
      await tx
        .update(eventExceptions)
        .set({ originalStart: sql`${eventExceptions.originalStart} + make_interval(secs => ${shiftMs / 1000})` })
        .where(eq(eventExceptions.eventId, eventId));
    }
    await setMyReminders(tx, eventId, me.id, v.reminders);
    return syncAttendees(tx, eventId, attendees, timeChanged);
  });
  await notifyInvited(eventId, added, me);
  revalidatePath("/");
  redirect(`/termin/${eventId}`);
}

/** Löschen: ganzer Termin bzw. ganze Serie, oder nur ein Vorkommen der Serie. */
export async function deleteEvent(eventId: string, occurrence: string | null, form: FormData): Promise<void> {
  const me = await requireUser();
  const [existing] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (!existing || !canEdit(me, existing)) redirect("/");
  if (form.get("scope") === "single" && existing.rrule && occurrence) {
    await db
      .insert(eventExceptions)
      .values({ eventId, originalStart: new Date(occurrence), cancelled: true })
      .onConflictDoUpdate({ target: [eventExceptions.eventId, eventExceptions.originalStart], set: { cancelled: true } });
    revalidatePath("/");
    redirect(`/?datum=${utcToBerlin(new Date(occurrence)).date}`);
  }
  await db.delete(events).where(eq(events.id, eventId));
  revalidatePath("/");
  redirect("/");
}

/** Eingeladene Person sagt zu oder ab (gilt für den ganzen Termin bzw. die ganze Serie). */
export async function respondToEvent(eventId: string, response: "accepted" | "declined", returnTo: string): Promise<void> {
  const me = await requireUser();
  const [row] = await db
    .update(eventAttendees)
    .set({ response, respondedAt: new Date() })
    .where(and(eq(eventAttendees.eventId, eventId), eq(eventAttendees.userId, me.id), ne(eventAttendees.response, response)))
    .returning();
  if (row) await notifyResponse(eventId, me, response);
  revalidatePath("/", "layout");
  redirect(returnTo.startsWith("/") ? returnTo : "/");
}

/** Eigene Erinnerungen für einen sichtbaren Termin setzen (auch für fremde Termine). */
export async function saveMyReminders(eventId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser();
  const event = await loadVisibleEvent(me, eventId);
  if (!event) return { error: "Termin nicht gefunden." };
  const minutes = [...new Set(form.getAll("reminders").map(Number))].filter((m) => Number.isInteger(m) && m >= 0 && m <= 40320).slice(0, 5);
  await db.transaction((tx) => setMyReminders(tx, eventId, me.id, minutes));
  revalidatePath(`/termin/${eventId}`);
  return { success: minutes.length ? "Erinnerung gespeichert." : "Erinnerung entfernt." };
}
