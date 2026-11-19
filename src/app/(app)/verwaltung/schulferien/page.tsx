import { asc } from "drizzle-orm";
import Link from "next/link";
import { addSchoolHoliday, deleteSchoolHoliday } from "@/actions/school-holidays";
import { ActionForm } from "@/components/action-form";
import { Field, Input, SubmitButton } from "@/components/ui";
import { db } from "@/db";
import { schoolHolidays } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Schulferien · Familienkalender" };

const fmt = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeZone: "UTC" });
const show = (d: string) => fmt.format(new Date(`${d}T00:00:00Z`));

export default async function SchoolHolidaysPage() {
  await requireAdmin();
  const rows = await db.select().from(schoolHolidays).orderBy(asc(schoolHolidays.startDate));
  const years = [...new Set(rows.map((r) => r.schoolYear))];

  return (
    <div className="space-y-8">
      <Link href="/verwaltung" className="text-sm text-gray-500 hover:text-gray-900">
        ← Verwaltung
      </Link>
      <section className="max-w-lg">
        <h2 className="mb-1 text-xl font-semibold">Schulferien Bayern</h2>
        <p className="mb-4 text-sm text-gray-500">
          Die Termine legt das Kultusministerium fest, sie lassen sich nicht berechnen. Neue Schuljahre hier
          nachtragen (Quelle: km.bayern.de, „Ferientermine“). Einzelne schulfreie Tage wie den Buß- und Bettag
          trägst du mit gleichem Beginn und Ende ein.
        </p>
        <ActionForm action={addSchoolHoliday}>
          <Field label="Name">
            <Input name="name" required placeholder="z. B. Herbstferien" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Erster Ferientag">
              <Input name="startDate" type="date" required />
            </Field>
            <Field label="Letzter Ferientag">
              <Input name="endDate" type="date" required />
            </Field>
          </div>
          <SubmitButton>Eintragen</SubmitButton>
        </ActionForm>
      </section>

      {years.map((y) => (
        <section key={y}>
          <h3 className="mb-2 font-semibold">Schuljahr {y}</h3>
          <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200">
            {rows
              .filter((r) => r.schoolYear === y)
              .map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                  <span>
                    <span className="mr-2 inline-block h-3 w-3 rounded-sm bg-ferien align-middle" />
                    <span className="font-medium">{r.name}</span>{" "}
                    <span className="text-gray-500">
                      {r.startDate === r.endDate ? show(r.startDate) : `${show(r.startDate)} – ${show(r.endDate)}`}
                    </span>
                  </span>
                  <form action={deleteSchoolHoliday}>
                    <input type="hidden" name="id" value={r.id} />
                    <SubmitButton variant="danger" className="px-2 py-1 text-xs">
                      Entfernen
                    </SubmitButton>
                  </form>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
