import { and, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { updateEvent } from "@/actions/events";
import { EventForm } from "@/components/event-form";
import { db } from "@/db";
import { eventAttendees, reminders } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { addDays } from "@/lib/dates";
import { canEdit, loadVisibleEvent } from "@/lib/events";
import { activePeople, categoriesFor } from "@/lib/people";
import { parseRule } from "@/lib/recurrence";
import { utcToBerlin } from "@/lib/time";

export const metadata = { title: "Termin bearbeiten · Familienkalender" };

export default async function EditEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ am?: string }>;
}) {
  const me = await requireUser();
  const { id } = await params;
  const { am } = await searchParams;
  const event = await loadVisibleEvent(me, id);
  if (!event) notFound();
  if (!canEdit(me, event)) redirect(`/termin/${id}`);

  const [mine, attendees, people] = await Promise.all([
    db
      .select({ minutes: reminders.minutesBefore })
      .from(reminders)
      .where(and(eq(reminders.eventId, id), eq(reminders.userId, me.id))),
    db.select().from(eventAttendees).where(eq(eventAttendees.eventId, id)),
    activePeople(),
  ]);

  // Bei einem Serien-Vorkommen dessen Datum vorbelegen (für "nur diesen Termin").
  const occurrence = event.rrule && am && !Number.isNaN(Date.parse(am)) ? new Date(am) : null;
  const duration = event.endsAt.getTime() - event.startsAt.getTime();
  const startsAt = occurrence ?? event.startsAt;
  const endsAt = occurrence ? new Date(occurrence.getTime() + duration) : event.endsAt;
  const s = utcToBerlin(startsAt);
  const e = utcToBerlin(endsAt);
  const rule = event.rrule ? parseRule(event.rrule) : null;
  const backHref = occurrence ? `/termin/${id}?am=${encodeURIComponent(occurrence.toISOString())}` : `/termin/${id}`;

  return (
    <div>
      <h2 className="mb-6 text-xl font-semibold">Termin bearbeiten</h2>
      <EventForm
        action={updateEvent.bind(null, id, occurrence?.toISOString() ?? null)}
        categories={await categoriesFor({ id: event.ownerId })}
        people={people.filter((p) => p.id !== event.ownerId)}
        seriesScope={Boolean(occurrence)}
        submitLabel="Änderungen speichern"
        cancelHref={backHref}
        values={{
          title: event.title,
          allDay: event.allDay,
          startDate: s.date,
          startTime: event.allDay ? "09:00" : s.time,
          endDate: event.allDay ? addDays(e.date, -1) : e.date,
          endTime: event.allDay ? "10:00" : e.time,
          location: event.location ?? "",
          notes: event.notes ?? "",
          categoryId: event.categoryId ?? "",
          visibility: event.visibility,
          reminders: mine.map((r) => r.minutes),
          repeat: Boolean(rule),
          freq: rule?.freq ?? "WEEKLY",
          interval: rule?.interval ?? 1,
          repeatEnd: rule?.until ? "until" : rule?.count ? "count" : "never",
          until: rule?.until ?? "",
          count: rule?.count ?? 10,
          attendees: attendees.map((a) => ({ userId: a.userId, required: a.responseRequired, response: a.response })),
        }}
      />
    </div>
  );
}
