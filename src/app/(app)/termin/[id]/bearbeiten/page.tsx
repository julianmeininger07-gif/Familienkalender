import { and, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { updateEvent } from "@/actions/events";
import { EventForm } from "@/components/event-form";
import { db } from "@/db";
import { reminders } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { addDays } from "@/lib/dates";
import { canEdit, loadVisibleEvent } from "@/lib/events";
import { categoriesFor } from "@/lib/people";
import { utcToBerlin } from "@/lib/time";

export const metadata = { title: "Termin bearbeiten · Familienkalender" };

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  const { id } = await params;
  const event = await loadVisibleEvent(me, id);
  if (!event) notFound();
  if (!canEdit(me, event)) redirect(`/termin/${id}`);

  const mine = await db
    .select({ minutes: reminders.minutesBefore })
    .from(reminders)
    .where(and(eq(reminders.eventId, id), eq(reminders.userId, me.id)));
  const s = utcToBerlin(event.startsAt);
  const e = utcToBerlin(event.endsAt);

  return (
    <div>
      <h2 className="mb-6 text-xl font-semibold">Termin bearbeiten</h2>
      <EventForm
        action={updateEvent.bind(null, id)}
        categories={await categoriesFor({ id: event.ownerId })}
        submitLabel="Änderungen speichern"
        cancelHref={`/termin/${id}`}
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
        }}
      />
    </div>
  );
}
