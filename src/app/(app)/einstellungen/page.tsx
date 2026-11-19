import { changePassword } from "@/actions/auth";
import { updateProfile } from "@/actions/profile";
import { ActionForm } from "@/components/action-form";
import { Field, Input, SubmitButton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";
import { ROLE_LABELS, USER_COLORS } from "@/lib/validation";

export const metadata = { title: "Einstellungen · Familienkalender" };

export default async function SettingsPage() {
  const user = await requireUser();
  return (
    <div className="max-w-lg space-y-10">
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
