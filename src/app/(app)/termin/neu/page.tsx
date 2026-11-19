import Link from "next/link";
import { createEvent } from "@/actions/events";
import { EventForm } from "@/components/event-form";
import { requireUser } from "@/lib/auth";
import { todayInBerlin } from "@/lib/dates";
import { canCreate } from "@/lib/events";
import { categoriesFor } from "@/lib/people";
import { utcToBerlin } from "@/lib/time";

export const metadata = { title: "Neuer Termin · Familienkalender" };

function plusHour(t: string): string {
  const [h, m] = t.split(":").map(Number);
  return `${String(Math.min(h + 1, 23)).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default async function NewEventPage({ searchParams }: { searchParams: Promise<{ datum?: string; zeit?: string }> }) {
  const user = await requireUser();
  if (!canCreate(user)) {
    return (
      <p className="text-gray-700">
        Mit der Rolle „Nur lesen“ kannst du keine Termine anlegen. <Link href="/" className="underline">Zurück</Link>
      </p>
    );
  }
  const sp = await searchParams;
  const date = sp.datum && /^\d{4}-\d{2}-\d{2}$/.test(sp.datum) ? sp.datum : todayInBerlin();
  // Ohne Uhrzeit: nächste volle Stunde.
  const now = utcToBerlin(new Date(Date.now() + 60 * 60 * 1000));
  const time = sp.zeit && /^\d{2}:\d{2}$/.test(sp.zeit) ? sp.zeit : `${now.time.slice(0, 2)}:00`;

  return (
    <div>
      <h2 className="mb-6 text-xl font-semibold">Neuer Termin</h2>
      <EventForm
        action={createEvent}
        categories={await categoriesFor(user)}
        submitLabel="Termin speichern"
        cancelHref={`/?datum=${date}`}
        values={{
          title: "",
          allDay: false,
          startDate: date,
          startTime: time,
          endDate: date,
          endTime: plusHour(time),
          location: "",
          notes: "",
          categoryId: "",
          visibility: "public",
          reminders: [],
        }}
      />
    </div>
  );
}
