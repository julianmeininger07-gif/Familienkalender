import { and, eq, gt, isNull } from "drizzle-orm";
import Link from "next/link";
import { resetPassword } from "@/actions/auth";
import { ActionForm } from "@/components/action-form";
import { Field, Input, SubmitButton } from "@/components/ui";
import { db } from "@/db";
import { passwordResets, users } from "@/db/schema";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";
import { hashToken } from "@/lib/tokens";

export const metadata = { title: "Neues Passwort · Familienkalender" };

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [row] = await db
    .select({ name: users.name })
    .from(passwordResets)
    .innerJoin(users, eq(users.id, passwordResets.userId))
    .where(
      and(
        eq(passwordResets.tokenHash, hashToken(token)),
        isNull(passwordResets.usedAt),
        gt(passwordResets.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!row) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-gray-700">Dieser Link ist abgelaufen oder wurde schon benutzt.</p>
        <Link href="/login" className="text-sm font-semibold underline">
          Zur Anmeldung
        </Link>
      </div>
    );
  }

  return (
    <>
      <p className="mb-6 text-sm text-gray-600">Hallo {row.name}, lege ein neues Passwort fest.</p>
      <ActionForm action={resetPassword.bind(null, token)}>
        <Field label="Neues Passwort" hint={`Mindestens ${MIN_PASSWORD_LENGTH} Zeichen.`}>
          <Input name="password" type="password" autoComplete="new-password" required minLength={MIN_PASSWORD_LENGTH} />
        </Field>
        <Field label="Passwort wiederholen">
          <Input name="passwordRepeat" type="password" autoComplete="new-password" required />
        </Field>
        <SubmitButton className="w-full">Passwort speichern</SubmitButton>
      </ActionForm>
    </>
  );
}
