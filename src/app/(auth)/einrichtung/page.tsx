import { redirect } from "next/navigation";
import { setupAdmin } from "@/actions/auth";
import { ActionForm } from "@/components/action-form";
import { Field, Input, SubmitButton } from "@/components/ui";
import { userCount } from "@/lib/users";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";

export const metadata = { title: "Einrichtung · Familienkalender" };

export default async function SetupPage() {
  if ((await userCount()) > 0) redirect("/login");
  return (
    <>
      <p className="mb-6 text-sm text-gray-600">
        Willkommen! Lege jetzt das Admin-Konto an. Danach kannst du weitere Personen einladen.
      </p>
      <ActionForm action={setupAdmin}>
        <Field label="Dein Name">
          <Input name="name" autoComplete="name" required autoFocus />
        </Field>
        <Field label="E-Mail">
          <Input name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Passwort" hint={`Mindestens ${MIN_PASSWORD_LENGTH} Zeichen.`}>
          <Input name="password" type="password" autoComplete="new-password" required minLength={MIN_PASSWORD_LENGTH} />
        </Field>
        <Field label="Passwort wiederholen">
          <Input name="passwordRepeat" type="password" autoComplete="new-password" required />
        </Field>
        <SubmitButton className="w-full">Admin-Konto anlegen</SubmitButton>
      </ActionForm>
    </>
  );
}
