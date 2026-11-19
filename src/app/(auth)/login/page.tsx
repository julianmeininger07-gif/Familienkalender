import { redirect } from "next/navigation";
import { login } from "@/actions/auth";
import { ActionForm } from "@/components/action-form";
import { Field, Input, SubmitButton } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { userCount } from "@/lib/users";

export const metadata = { title: "Anmelden · Familienkalender" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  if ((await userCount()) === 0) redirect("/einrichtung");
  return (
    <>
      <ActionForm action={login}>
        <Field label="E-Mail">
          <Input name="email" type="email" autoComplete="email" required autoFocus />
        </Field>
        <Field label="Passwort">
          <Input name="password" type="password" autoComplete="current-password" required />
        </Field>
        <SubmitButton className="w-full">Anmelden</SubmitButton>
      </ActionForm>
      <p className="mt-6 text-center text-sm text-gray-500">
        Passwort vergessen? Der Admin kann dir einen Link zum Zurücksetzen schicken.
      </p>
    </>
  );
}
