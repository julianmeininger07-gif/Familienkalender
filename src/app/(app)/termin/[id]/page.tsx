import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteEvent } from "@/actions/events";
import { SubmitButton } from "@/components/ui";
import { db } from "@/db";
import { categories, reminders, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { canEdit, loadVisibleEvent } from "@/lib/events";
import { formatEventTime } from "@/lib/format";
import { utcToBerlin } from "@/lib/time";
import { REMINDER_PRESETS } from "@/lib/validation";

export const metadata = { title: "Termin · Familienkalender" };

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  const { id } = await params;
  const event = await loadVisibleEvent(me, id);
  if (!event) notFound();

  const [[owner], [category], myReminders] = await Promise.all([
    db.select({ name: users.name, color: users.color }).from(users).where(eq(users.id, event.ownerId)),
    event.categoryId
      ? db.select().from(categories).where(eq(categories.id, event.categoryId))
      : Promise.resolve([] as (typeof categories.$inferSelect)[]),
    db
      .select({ minutes: reminders.minutesBefore })
      .from(reminders)
      .where(and(eq(reminders.eventId, event.id), eq(reminders.userId, me.id))),
  ]);
  const editable = canEdit(me, event);
  const start = utcToBerlin(event.startsAt).date;

  return (
    <article className="max-w-xl space-y-6">
      <Link href={`/?datum=${start}`} className="text-sm text-gray-500 hover:text-gray-900">
        ← Kalender
      </Link>
      <header className="flex items-start gap-3">
        <span className="mt-2 h-4 w-4 shrink-0 rounded-full border-4" style={{ background: owner?.color, borderColor: category?.color ?? owner?.color }} />
        <div>
          <h2 className="text-2xl font-bold">
            {event.visibility === "private" && <span title="Privat">🔒 </span>}
            {event.title}
          </h2>
          <p className="text-gray-700">{formatEventTime(event)}</p>
        </div>
      </header>

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
        <div className="flex flex-wrap items-center gap-3 border-t border-gray-200 pt-4">
          <Link href={`/termin/${event.id}/bearbeiten`} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700">
            Bearbeiten
          </Link>
          <details>
            <summary className="cursor-pointer text-sm text-red-700">Löschen …</summary>
            <form action={deleteEvent.bind(null, event.id)} className="mt-2">
              <SubmitButton variant="danger">Termin endgültig löschen</SubmitButton>
            </form>
          </details>
        </div>
      )}
    </article>
  );
}
