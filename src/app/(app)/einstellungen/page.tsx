import { changePassword } from "@/actions/auth";
import { createCategory, deleteCategory } from "@/actions/categories";
import { updateProfile } from "@/actions/profile";
import { ActionForm } from "@/components/action-form";
import { InstallApp } from "@/components/install-app";
import { PushSettings } from "@/components/push-settings";
import { Field, Input, SubmitButton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { categoriesFor } from "@/lib/people";
import { vapidKeys } from "@/lib/push";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";
import { ROLE_LABELS, USER_COLORS } from "@/lib/validation";

export const metadata = { title: "Einstellungen · Familienkalender" };

export default async function SettingsPage() {
  const user = await requireUser();
  const [cats, keys] = await Promise.all([categoriesFor(user), vapidKeys()]);
  return (
    <div className="max-w-lg space-y-10">
      <section>
        <h2 className="mb-3 text-xl font-semibold">Als App aufs Handy</h2>
        <InstallApp />
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">Benachrichtigungen</h2>
        <PushSettings publicKey={keys.publicKey} />
      </section>

      <section>
        <h2 className="mb-1 text-xl font-semibold">Profil</h2>
        <p className="mb-4 text-sm text-gray-500">
          {user.email} · {ROLE_LABELS[user.role]}
        </p>
        <ActionForm resetOnSuccess={false} action={updateProfile}>
          <Field label="Name">
            <Input name="name" defaultValue={user.name} required />
          </Field>
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-gray-700">Deine Farbe im Kalender</legend>
            <div className="flex flex-wrap gap-2">
              {USER_COLORS.map((c) => (
                <label key={c} className="cursor-pointer">
                  <input type="radio" name="color" value={c} defaultChecked={c === user.color} className="peer sr-only" />
                  <span
                    className="block h-9 w-9 rounded-full ring-offset-2 peer-checked:ring-2 peer-checked:ring-gray-900 peer-focus-visible:ring-2"
                    style={{ background: c }}
                    aria-label={c}
                  />
                </label>
              ))}
            </div>
          </fieldset>
          <SubmitButton>Speichern</SubmitButton>
        </ActionForm>
      </section>

      <section>
        <h2 className="mb-1 text-xl font-semibold">Kategorien</h2>
        <p className="mb-4 text-sm text-gray-500">
          Gemeinsame Kategorien kann jeder benutzen{user.role === "admin" ? " (du als Admin pflegst sie)" : ""}. Eigene siehst nur du in der Auswahl.
        </p>
        <ul className="mb-4 divide-y divide-gray-200 rounded-xl border border-gray-200">
          {cats.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm" style={{ background: c.color }} />
                {c.name}
                <span className="text-xs text-gray-500">{c.shared ? "gemeinsam" : "eigene"}</span>
              </span>
              {(!c.shared || user.role === "admin") && (
                <form action={deleteCategory}>
                  <input type="hidden" name="id" value={c.id} />
                  <SubmitButton variant="danger" className="px-2 py-1 text-xs">
                    Entfernen
                  </SubmitButton>
                </form>
              )}
            </li>
          ))}
        </ul>
        <ActionForm action={createCategory} className="flex flex-wrap items-end gap-3">
          <Field label="Neue Kategorie">
            <Input name="name" required maxLength={40} placeholder="z. B. Sport" />
          </Field>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Farbe</span>
            <input name="color" type="color" defaultValue="#0891b2" className="h-10 w-14 rounded-lg border border-gray-300" />
          </label>
          {user.role === "admin" && (
            <label className="flex items-center gap-2 pb-2 text-sm">
              <input type="checkbox" name="forAll" /> für alle
            </label>
          )}
          <SubmitButton>Anlegen</SubmitButton>
        </ActionForm>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">Passwort ändern</h2>
        <ActionForm action={changePassword}>
          <Field label="Aktuelles Passwort">
            <Input name="currentPassword" type="password" autoComplete="current-password" required />
          </Field>
          <Field label="Neues Passwort" hint={`Mindestens ${MIN_PASSWORD_LENGTH} Zeichen.`}>
            <Input name="password" type="password" autoComplete="new-password" required minLength={MIN_PASSWORD_LENGTH} />
          </Field>
          <Field label="Neues Passwort wiederholen">
            <Input name="passwordRepeat" type="password" autoComplete="new-password" required />
          </Field>
          <SubmitButton>Passwort ändern</SubmitButton>
        </ActionForm>
      </section>
    </div>
  );
}
