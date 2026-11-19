import { and, asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteEvent, respondToEvent } from "@/actions/events";
import { SubmitButton } from "@/components/ui";
import { db } from "@/db";
import { categories, eventAttendees, reminders, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { canEdit, loadVisibleEvent } from "@/lib/events";
import { formatEventTime } from "@/lib/format";
import { describeRule, parseRule } from "@/lib/recurrence";
import { utcToBerlin } from "@/lib/time";
import { REMINDER_PRESETS } from "@/lib/validation";

export const metadata = { title: "Termin · Familienkalender" };

const RESPONSE_LABEL = {
  pending: { text: "offen", cls: "bg-gray-100 text-gray-700" },
  accepted: { text: "zugesagt", cls: "bg-green-100 text-green-800" },
  declined: { text: "abgesagt", cls: "bg-red-100 text-red-800" },
} as const;

export default async function EventPage({
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

  const [[owner], [category], myReminders, attendees] = await Promise.all([
    db.select({ name: users.name, color: users.color }).from(users).where(eq(users.id, event.ownerId)),
    event.categoryId
      ? db.select().from(categories).where(eq(categories.id, event.categoryId))
      : Promise.resolve([] as (typeof categories.$inferSelect)[]),
    db
      .select({ minutes: reminders.minutesBefore })
      .from(reminders)
      .where(and(eq(reminders.eventId, event.id), eq(reminders.userId, me.id))),
    db
      .select({
        userId: eventAttendees.userId,
        name: users.name,
        color: users.color,
        required: eventAttendees.responseRequired,
        response: eventAttendees.response,
      })
      .from(eventAttendees)
      .innerJoin(users, eq(users.id, eventAttendees.userId))
      .where(eq(eventAttendees.eventId, event.id))
      .orderBy(asc(users.name)),
  ]);

  const rule = event.rrule ? parseRule(event.rrule) : null;
  const occurrence = rule && am && !Number.isNaN(Date.parse(am)) ? new Date(am) : null;
  const duration = event.endsAt.getTime() - event.startsAt.getTime();
  const shown = occurrence
    ? { allDay: event.allDay, startsAt: occurrence, endsAt: new Date(occurrence.getTime() + duration) }
    : event;
  const editable = canEdit(me, event);
  const start = utcToBerlin(shown.startsAt).date;
  const amParam = occurrence ? `?am=${encodeURIComponent(occurrence.toISOString())}` : "";
  const myInvite = attendees.find((a) => a.userId === me.id);
  const here = `/termin/${event.id}${amParam}`;

  return (
    <article className="max-w-xl space-y-6">
      <Link href={`/?datum=${start}`} className="text-sm text-gray-500 hover:text-gray-900">
        ← Kalender
      </Link>
      <header className="flex items-start gap-3">
        <span
          className="mt-2 h-4 w-4 shrink-0 rounded-full border-4"
          style={{ background: owner?.color, borderColor: category?.color ?? owner?.color }}
        />
        <div>
          <h2 className="text-2xl font-bold">
            {event.visibility === "private" && <span title="Privat">🔒 </span>}
            {event.title}
          </h2>
          <p className="text-gray-700">{formatEventTime(shown)}</p>
          {rule && <p className="text-sm text-gray-500">🔁 Wiederholt sich {describeRule(rule)}</p>}
        </div>
      </header>

      {myInvite && (
        <section className={`rounded-xl p-4 ${myInvite.required && myInvite.response === "pending" ? "bg-ferien-soft" : "bg-gray-50"}`}>
          <p className="mb-3 text-sm">
            {owner?.name} hat dich eingeladen.{" "}
            {myInvite.required ? "Bitte sag zu oder ab." : "Eine Antwort ist nicht nötig, du kannst aber trotzdem Bescheid geben."}
            {myInvite.response !== "pending" && (
              <>
                {" "}
                Deine Antwort: <strong>{RESPONSE_LABEL[myInvite.response].text}</strong>.
              </>
            )}
          </p>
          <div className="flex gap-2">
            <form action={respondToEvent.bind(null, event.id, "accepted", here)}>
              <SubmitButton variant={myInvite.response === "accepted" ? "primary" : "secondary"}>✓ Zusagen</SubmitButton>
            </form>
            <form action={respondToEvent.bind(null, event.id, "declined", here)}>
              <SubmitButton variant={myInvite.response === "declined" ? "danger" : "secondary"}>✗ Absagen</SubmitButton>
            </form>
          </div>
          {rule && <p className="mt-2 text-xs text-gray-500">Die Antwort gilt für die ganze Serie.</p>}
        </section>
      )}

      <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-2 text-sm">
        {event.location && (
          <>
            <dt className="text-gray-500">Ort</dt>
            <dd>
              <a
                className="underline"
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`}
                target="_blank"
                rel="noreferrer"
              >
                {event.location}
              </a>
            </dd>
          </>
        )}
        <dt className="text-gray-500">Kalender von</dt>
        <dd className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: owner?.color }} />
          {owner?.name}
        </dd>
        <dt className="text-gray-500">Kategorie</dt>
        <dd>
          {category ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: category.color }} />
              {category.name}
            </span>
          ) : (
            "–"
          )}
        </dd>
        <dt className="text-gray-500">Sichtbar für</dt>
        <dd>{event.visibility === "private" ? "Nur Ersteller und Eingeladene" : "Alle"}</dd>
        {attendees.length > 0 && (
          <>
            <dt className="text-gray-500">Eingeladen</dt>
            <dd>
              <ul className="space-y-1">
                {attendees.map((a) => (
                  <li key={a.userId} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: a.color }} />
                    {a.name}
                    {a.required || a.response !== "pending" ? (
                      <span className={`rounded px-1.5 py-0.5 text-xs ${RESPONSE_LABEL[a.response].cls}`}>
                        {RESPONSE_LABEL[a.response].text}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500">zur Info</span>
                    )}
                  </li>
                ))}
              </ul>
            </dd>
          </>
        )}
        {myReminders.length > 0 && (
          <>
            <dt className="text-gray-500">Erinnerung</dt>
            <dd>
              {myReminders
                .map((r) => REMINDER_PRESETS.find((p) => p.minutes === r.minutes)?.label ?? `${r.minutes} Min. vorher`)
                .join(", ")}
            </dd>
          </>
        )}
      </dl>

      {event.notes && <p className="whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm">{event.notes}</p>}

      {editable && (
        <div className="flex flex-wrap items-start gap-3 border-t border-gray-200 pt-4">
          <Link
            href={`/termin/${event.id}/bearbeiten${amParam}`}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
          >
            Bearbeiten
          </Link>
          <details>
            <summary className="cursor-pointer py-2 text-sm text-red-700">Löschen …</summary>
            <form action={deleteEvent.bind(null, event.id, occurrence?.toISOString() ?? null)} className="mt-2 space-y-2">
              {occurrence && (
                <div className="space-y-1 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="radio" name="scope" value="single" defaultChecked /> Nur diesen Termin
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="scope" value="series" /> Die ganze Serie
                  </label>
                </div>
              )}
              <SubmitButton variant="danger">Endgültig löschen</SubmitButton>
            </form>
          </details>
        </div>
      )}
    </article>
  );
}
