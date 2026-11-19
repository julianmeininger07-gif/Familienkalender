"use client";

import type { Category, Filters, Person } from "./types";

function toggle(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

/** Häkchen pro Person und pro Kategorie: was in der Übersicht angezeigt wird. */
export function FilterPanel({
  people,
  categories,
  filters,
  onChange,
}: {
  people: Person[];
  categories: Category[];
  filters: Filters;
  onChange: (f: Filters) => void;
}) {
  const allPeopleShown = filters.hiddenUserIds.length === 0;
  const allCatsShown = filters.hiddenCategoryIds.length === 0;

  return (
    <div className="space-y-6 text-sm">
      <fieldset>
        <legend className="mb-2 flex w-full items-center justify-between font-semibold">
          Personen
          <button
            type="button"
            className="text-xs font-normal text-gray-500 hover:text-gray-900"
            onClick={() => onChange({ ...filters, hiddenUserIds: allPeopleShown ? people.map((p) => p.id) : [] })}
          >
            {allPeopleShown ? "keine" : "alle"}
          </button>
        </legend>
        <ul className="space-y-1">
          {people.map((p) => (
            <li key={p.id}>
              <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={!filters.hiddenUserIds.includes(p.id)}
                  onChange={() => onChange({ ...filters, hiddenUserIds: toggle(filters.hiddenUserIds, p.id) })}
                  className="h-4 w-4"
                  style={{ accentColor: p.color }}
                />
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
                {p.name}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <fieldset>
        <legend className="mb-2 flex w-full items-center justify-between font-semibold">
          Kategorien
          <button
            type="button"
            className="text-xs font-normal text-gray-500 hover:text-gray-900"
            onClick={() =>
              onChange({ ...filters, hiddenCategoryIds: allCatsShown ? [...categories.map((c) => c.id), "none"] : [] })
            }
          >
            {allCatsShown ? "keine" : "alle"}
          </button>
        </legend>
        <ul className="space-y-1">
          {[...categories, { id: "none", name: "Ohne Kategorie", color: "#d1d5db", shared: true }].map((c) => (
            <li key={c.id}>
              <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={!filters.hiddenCategoryIds.includes(c.id)}
                  onChange={() => onChange({ ...filters, hiddenCategoryIds: toggle(filters.hiddenCategoryIds, c.id) })}
                  className="h-4 w-4"
                  style={{ accentColor: c.color }}
                />
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: c.color }} />
                {c.name}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <div className="space-y-1 border-t border-gray-200 pt-4 text-xs text-gray-500">
        <p>
          <span className="font-bold text-feiertag">Rot</span> = Feiertag
        </p>
        <p>
          <span className="bg-ferien px-1 text-gray-900">Gelb</span> = Schulferien
        </p>
        <p>🔒 = privat, nur für dich und Eingeladene sichtbar</p>
      </div>
    </div>
  );
}
