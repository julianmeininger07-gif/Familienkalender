"use server";

import { and, eq, isNull, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { categories, events, reminders } from "@/db/schema";
import { requireUser, type CurrentUser } from "@/lib/auth";
import { canCreate, canEdit, toTimes } from "@/lib/events";
import type { FormState } from "@/lib/form-state";
import { firstError, parseEventForm } from "@/lib/validation";

async function categoryAllowed(user: CurrentUser, categoryId: string | null): Promise<boolean> {
  if (!categoryId) return true;
  const [c] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, categoryId), or(isNull(categories.ownerId), eq(categories.ownerId, user.id))))
    .limit(1);
  return Boolean(c);
}

async function setMyReminders(eventId: string, userId: string, minutes: number[]) {
  await db.delete(reminders).where(and(eq(reminders.eventId, eventId), eq(reminders.userId, userId)));
  if (minutes.length) {
    await db.insert(reminders).values(minutes.map((m) => ({ eventId, userId, minutesBefore: m })));
  }
}

export async function createEvent(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser();
  if (!canCreate(me)) return { error: "Mit der Rolle „Nur lesen“ kannst du keine Termine anlegen." };
  const parsed = parseEventForm(form);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const v = parsed.data;
  const times = toTimes(v);
  if ("error" in times) return { error: times.error };
  if (!(await categoryAllowed(me, v.categoryId))) return { error: "Diese Kategorie gibt es nicht." };

  const [created] = await db
    .insert(events)
    .values({
      ownerId: me.id,
      title: v.title,
      location: v.location,
      notes: v.notes,
      allDay: v.allDay,
      categoryId: v.categoryId,
      visibility: v.visibility,
      ...times,
    })
    .returning({ id: events.id });
  await setMyReminders(created.id, me.id, v.reminders);
  revalidatePath("/");
  redirect(`/?datum=${v.startDate}`);
}

export async function updateEvent(eventId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser();
  const [existing] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (!existing || !canEdit(me, existing)) return { error: "Diesen Termin darfst du nicht bearbeiten." };
  const parsed = parseEventForm(form);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const v = parsed.data;
  const times = toTimes(v);
  if ("error" in times) return { error: times.error };
  // Kategorien gehören dem Ersteller; beim Bearbeiten durch den Admin die des Erstellers zulassen.
  const owner: CurrentUser = { ...me, id: existing.ownerId };
  if (!(await categoryAllowed(owner, v.categoryId))) return { error: "Diese Kategorie gibt es nicht." };

  await db
    .update(events)
    .set({
      title: v.title,
      location: v.location,
      notes: v.notes,
      allDay: v.allDay,
      categoryId: v.categoryId,
      visibility: v.visibility,
      updatedAt: new Date(),
      ...times,
    })
    .where(eq(events.id, eventId));
  await setMyReminders(eventId, me.id, v.reminders);
  revalidatePath("/");
  redirect(`/termin/${eventId}`);
}

export async function deleteEvent(eventId: string): Promise<void> {
  const me = await requireUser();
  const [existing] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (!existing || !canEdit(me, existing)) redirect("/");
  await db.delete(events).where(eq(events.id, eventId));
  revalidatePath("/");
  redirect("/");
}
