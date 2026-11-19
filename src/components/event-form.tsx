"use client";

import Link from "next/link";
import { useState } from "react";
import type { FormState } from "@/lib/form-state";
import { REMINDER_PRESETS } from "@/lib/validation";
import { ActionForm } from "./action-form";
import { Field, Input, Select, SubmitButton } from "./ui";

export type EventFormValues = {
  title: string;
  allDay: boolean;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  location: string;
  notes: string;
  categoryId: string;
  visibility: "public" | "private";
  reminders: number[];
  repeat: boolean;
  freq: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval: number;
  repeatEnd: "never" | "until" | "count";
  until: string;
  count: number;
  attendees: { userId: string; required: boolean; response?: "pending" | "accepted" | "declined" }[];
};

type PersonOption = { id: string; name: string; color: string };

type Cat = { id: string; name: string; color: string; shared: boolean };

/** Eingabemaske für Termine: Pflichtfelder oben, alles Weitere darunter. */
export function EventForm({
  action,
  values,
  categories,
  submitLabel,
  cancelHref,
  people,
  seriesScope = false,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  values: EventFormValues;
  categories: Cat[];
  submitLabel: string;
  cancelHref: string;
  /** Personen, die eingeladen werden können (ohne Ersteller). */
  people: PersonOption[];
  /** Beim Bearbeiten eines Serien-Vorkommens: fragen, ob nur dieses oder alle. */
  seriesScope?: boolean;
}) {
  const [allDay, setAllDay] = useState(values.allDay);
  const [startDate, setStartDate] = useState(values.startDate);
  const [endDate, setEndDate] = useState(values.endDate);
  const [repeat, setRepeat] = useState(values.repeat);
  const [repeatEnd, setRepeatEnd] = useState(values.repeatEnd);
  const [scope, setScope] = useState<"single" | "series">("series");
  const [invited, setInvited] = useState<Map<string, boolean>>(
    () => new Map(values.attendees.map((a) => [a.userId, a.required])),
  );
  const [more, setMore] = useState(
    Boolean(values.location || values.notes || values.categoryId || values.visibility === "private" || values.reminders.length),
  );
  const showRepeat = !(seriesScope && scope === "single");

  return (
    <ActionForm action={action} className="max-w-xl space-y-5" resetOnSuccess={false}>
      <Field label="Beschreibung *">
        <Input name="title" defaultValue={values.title} required maxLength={120} placeholder="z. B. Zahnarzt, Geburtstag Oma" autoFocus />
      </Field>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="allDay" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="h-4 w-4" />
        Ganztägig
      </label>

      <div className="grid grid-cols-2 gap-3">
        <Field label={allDay ? "Von *" : "Datum *"}>
          <Input
            name="startDate"
            type="date"
            required
            value={startDate}
            onChange={(e) => {
              const v = e.target.value;
              // Ende mitziehen, wenn es sonst vor dem Beginn läge.
              if (!endDate || endDate < v || endDate === startDate) setEndDate(v);
              setStartDate(v);
            }}
          />
        </Field>
        {!allDay && (
          <Field label="Uhrzeit *">
            <Input name="startTime" type="time" required defaultValue={values.startTime} />
          </Field>
        )}
        <Field label={allDay ? "Bis" : "Ende Datum"}>
          <Input name="endDate" type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
        </Field>
        {!allDay && (
          <Field label="Ende Uhrzeit">
            <Input name="endTime" type="time" defaultValue={values.endTime} />
          </Field>
        )}
      </div>

      {seriesScope && (
        <fieldset className="rounded-lg border border-gray-300 p-3">
          <legend className="px-1 text-sm font-medium text-gray-700">Dieser Termin gehört zu einer Serie</legend>
          <div className="flex flex-col gap-2 text-sm sm:flex-row sm:gap-6">
            <label className="flex items-center gap-2">
              <input type="radio" name="scope" value="series" defaultChecked onChange={() => setScope("series")} />
              Alle Termine der Serie ändern
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="scope" value="single" onChange={() => setScope("single")} />
              Nur diesen einen Termin
            </label>
          </div>
        </fieldset>
      )}

      {showRepeat && (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="repeat" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} className="h-4 w-4" />
            Wiederholen
          </label>
          {repeat && (
            <div className="space-y-3 rounded-lg bg-gray-50 p-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span>alle</span>
                <Input name="interval" type="number" min={1} max={99} defaultValue={values.interval} className="w-20 py-1" aria-label="Abstand" />
                <Select name="freq" defaultValue={values.freq} className="w-auto py-1" aria-label="Rhythmus">
                  <option value="DAILY">Tage</option>
                  <option value="WEEKLY">Wochen</option>
                  <option value="MONTHLY">Monate</option>
                  <option value="YEARLY">Jahre</option>
                </Select>
              </div>
              <fieldset className="space-y-2 text-sm">
                <legend className="mb-1 font-medium text-gray-700">Endet</legend>
                <label className="flex items-center gap-2">
                  <input type="radio" name="repeatEnd" value="never" checked={repeatEnd === "never"} onChange={() => setRepeatEnd("never")} />
                  nie
                </label>
                <label className="flex flex-wrap items-center gap-2">
                  <input type="radio" name="repeatEnd" value="until" checked={repeatEnd === "until"} onChange={() => setRepeatEnd("until")} />
                  am
                  <Input name="until" type="date" defaultValue={values.until} min={startDate} disabled={repeatEnd !== "until"} className="w-auto py-1" aria-label="Endet am" />
                </label>
                <label className="flex flex-wrap items-center gap-2">
                  <input type="radio" name="repeatEnd" value="count" checked={repeatEnd === "count"} onChange={() => setRepeatEnd("count")} />
                  nach
                  <Input name="count" type="number" min={1} max={500} defaultValue={values.count} disabled={repeatEnd !== "count"} className="w-20 py-1" aria-label="Anzahl" />
                  Terminen
                </label>
              </fieldset>
            </div>
          )}
        </div>
      )}

      {people.length > 0 && (
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-gray-700">Personen einladen</legend>
          <p className="mb-2 text-xs text-gray-500">
            Eingeladene werden benachrichtigt und sehen den Termin auch, wenn er privat ist. Mit dem zweiten Haken
            müssen sie zu- oder absagen.
          </p>
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
            {people.map((p) => {
              const on = invited.has(p.id);
              const response = values.attendees.find((a) => a.userId === p.id)?.response;
              return (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="attendees"
                      value={p.id}
                      checked={on}
                      onChange={(e) => {
                        const next = new Map(invited);
                        if (e.target.checked) next.set(p.id, false);
                        else next.delete(p.id);
                        setInvited(next);
                      }}
                      className="h-4 w-4"
                    />
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
                    {p.name}
                    {response && response !== "pending" && (
                      <span className="text-xs text-gray-500">({response === "accepted" ? "hat zugesagt" : "hat abgesagt"})</span>
                    )}
                  </label>
                  {on && (
                    <label className="flex items-center gap-2 text-xs text-gray-700">
                      <input
                        type="checkbox"
                        name={`required_${p.id}`}
                        checked={invited.get(p.id) ?? false}
                        onChange={(e) => setInvited(new Map(invited).set(p.id, e.target.checked))}
                      />
                      Zu-/Absage erforderlich
                    </label>
                  )}
                </li>
              );
            })}
          </ul>
        </fieldset>
      )}

      {!more ? (
        <button type="button" onClick={() => setMore(true)} className="text-sm font-semibold text-gray-700 underline">
          + Ort, Kategorie, privat, Erinnerung, Notizen
        </button>
      ) : (
        <div className="space-y-5 border-t border-gray-200 pt-5">
          <Field label="Ort">
            <Input name="location" defaultValue={values.location} maxLength={200} placeholder="z. B. Praxis Dr. Huber, Rosenheim" />
          </Field>

          <Field label="Kategorie">
            <Select name="categoryId" defaultValue={values.categoryId}>
              <option value="">Ohne Kategorie</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.shared ? "" : " (eigene)"}
                </option>
              ))}
            </Select>
          </Field>

          <fieldset>
            <legend className="mb-1 text-sm font-medium text-gray-700">Wer sieht den Termin?</legend>
            <div className="flex flex-col gap-2 text-sm sm:flex-row sm:gap-6">
              <label className="flex items-center gap-2">
                <input type="radio" name="visibility" value="public" defaultChecked={values.visibility === "public"} />
                Öffentlich (alle)
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="visibility" value="private" defaultChecked={values.visibility === "private"} />
                🔒 Privat (nur ich und Eingeladene)
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-1 text-sm font-medium text-gray-700">Erinnern (für dich)</legend>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              {REMINDER_PRESETS.map((r) => (
                <label key={r.minutes} className="flex items-center gap-2">
                  <input type="checkbox" name="reminders" value={r.minutes} defaultChecked={values.reminders.includes(r.minutes)} />
                  {r.label}
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-gray-500">Kommt als Push-Nachricht; einschalten unter Einstellungen → Benachrichtigungen.</p>
          </fieldset>

          <Field label="Notizen">
            <textarea
              name="notes"
              defaultValue={values.notes}
              maxLength={2000}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-base outline-none focus:border-gray-900"
            />
          </Field>
        </div>
      )}

      <div className="flex items-center gap-3">
        <SubmitButton>{submitLabel}</SubmitButton>
        <Link href={cancelHref} className="text-sm text-gray-600 hover:text-gray-900">
          Abbrechen
        </Link>
      </div>
    </ActionForm>
  );
}
