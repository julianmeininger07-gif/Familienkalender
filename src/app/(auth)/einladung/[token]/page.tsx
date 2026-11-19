import { and, eq, gt, isNull } from "drizzle-orm";
import Link from "next/link";
import { acceptInvitation } from "@/actions/auth";
import { ActionForm } from "@/components/action-form";
import { Field, Input, SubmitButton } from "@/components/ui";
import { db } from "@/db";
import { invitations } from "@/db/schema";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";
import { hashToken } from "@/lib/tokens";
import { ROLE_LABELS } from "@/lib/validation";

export const metadata = { title: "Einladung · Familienkalender" };

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [inv] = await db
    .select()
    .from(invitations)
    .where(
      and(
        eq(invitations.tokenHash, hashToken(token)),
        isNull(invitations.acceptedAt),
        isNull(invitations.revokedAt),
        gt(invitations.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!inv) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-gray-700">Diese Einladung ist abgelaufen oder wurde schon benutzt.</p>
        <Link href="/login" className="text-sm font-semibold underline">
          Zur Anmeldung
        </Link>
      </div>
    );
  }

  return (
    <>
      <p className="mb-6 text-sm text-gray-600">
        Hallo {inv.name}, du wurdest zum Familienkalender eingeladen (Rolle: {ROLE_LABELS[inv.role]}). Lege
        jetzt dein Konto an.
      </p>
      <ActionForm action={acceptInvitation.bind(null, token)}>
        <Field label="Name">
          <Input name="name" defaultValue={inv.name} autoComplete="name" required />
        </Field>
        <Field label="E-Mail" hint="Damit meldest du dich später an.">
          <Input name="email" type="email" defaultValue={inv.email ?? ""} autoComplete="email" required />
        </Field>
        <Field label="Passwort" hint={`Mindestens ${MIN_PASSWORD_LENGTH} Zeichen.`}>
          <Input name="password" type="password" autoComplete="new-password" required minLength={MIN_PASSWORD_LENGTH} />
        </Field>
        <Field label="Passwort wiederholen">
          <Input name="passwordRepeat" type="password" autoComplete="new-password" required />
        </Field>
        <SubmitButton className="w-full">Konto anlegen</SubmitButton>
      </ActionForm>
    </>
  );
}
