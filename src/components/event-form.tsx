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
};

type Cat = { id: string; name: string; color: string; shared: boolean };

/** Eingabemaske für Termine: Pflichtfelder oben, alles Weitere darunter. */
export function EventForm({
  action,
  values,
  categories,
  submitLabel,
  cancelHref,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  values: EventFormValues;
  categories: Cat[];
  submitLabel: string;
  cancelHref: string;
}) {
  const [allDay, setAllDay] = useState(values.allDay);
  const [startDate, setStartDate] = useState(values.startDate);
  const [endDate, setEndDate] = useState(values.endDate);
  const [more, setMore] = useState(
    Boolean(values.location || values.notes || values.categoryId || values.visibility === "private" || values.reminders.length),
  );

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
            <p className="mt-1 text-xs text-gray-500">Die Benachrichtigung kommt aufs Handy, sobald Push eingerichtet ist.</p>
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
