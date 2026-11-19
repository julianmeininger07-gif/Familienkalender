import { requireUser } from "@/lib/auth";

export default async function CalendarPage() {
  const user = await requireUser();
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">Hallo {user.name}!</h2>
      <p className="text-gray-600">
        Hier erscheint der Kalender mit Monats-, Wochen-, Tages- und Jahresansicht, Feiertagen und
        Schulferien. Er kommt im nächsten Schritt.
      </p>
    </section>
  );
}
