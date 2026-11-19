import { and, asc, desc, gt, isNull } from "drizzle-orm";
import {
  changeRole,
  createInvitation,
  createPasswordResetLink,
  deleteUser,
  revokeInvitation,
  setUserLocked,
} from "@/actions/admin";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { Field, Input, Select, SubmitButton } from "@/components/ui";
import { db } from "@/db";
import { invitations, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { ROLE_LABELS, ROLES } from "@/lib/validation";

export const metadata = { title: "Verwaltung · Familienkalender" };

const dateFmt = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeZone: "Europe/Berlin" });

export default async function AdminPage() {
  const me = await requireAdmin();
  const allUsers = await db.select().from(users).orderBy(asc(users.name));
  const openInvites = await db
    .select()
    .from(invitations)
    .where(and(isNull(invitations.acceptedAt), isNull(invitations.revokedAt), gt(invitations.expiresAt, new Date())))
    .orderBy(desc(invitations.createdAt));

  return (
    <div className="space-y-10">
      <nav className="flex flex-wrap gap-2 text-sm">
        <Link href="/verwaltung/schulferien" className="rounded-lg border border-gray-300 px-3 py-1.5 font-medium hover:bg-gray-50">
          <span className="mr-1 inline-block h-3 w-3 rounded-sm bg-ferien align-middle" /> Schulferien pflegen
        </Link>
      </nav>
      <section className="max-w-lg">
        <h2 className="mb-1 text-xl font-semibold">Person einladen</h2>
        <p className="mb-4 text-sm text-gray-500">
          Du bekommst einen Link, den du z. B. per WhatsApp weitergibst. Damit legt die Person ihr Konto an.
        </p>
        <ActionForm action={createInvitation}>
          <Field label="Name">
            <Input name="name" required placeholder="z. B. Oma Gerda" />
          </Field>
          <Field label="E-Mail (optional)" hint="Wird im Formular vorausgefüllt. Die Person kann sie noch ändern.">
            <Input name="email" type="email" />
          </Field>
          <Field label="Rolle">
            <Select name="role" defaultValue="member">
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </Select>
          </Field>
          <SubmitButton>Einladungslink erstellen</SubmitButton>
        </ActionForm>
      </section>

      {openInvites.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-semibold">Offene Einladungen</h2>
          <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200">
            {openInvites.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <div className="font-medium">{inv.name}</div>
                  <div className="text-gray-500">
                    {ROLE_LABELS[inv.role]} · gültig bis {dateFmt.format(inv.expiresAt)}
                  </div>
                </div>
                <form action={revokeInvitation}>
                  <input type="hidden" name="id" value={inv.id} />
                  <SubmitButton variant="danger">Zurückziehen</SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-xl font-semibold">Benutzer ({allUsers.length})</h2>
        <ul className="space-y-3">
          {allUsers.map((u) => {
            const isMe = u.id === me.id;
            return (
              <li key={u.id} className="rounded-xl border border-gray-200 p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ background: u.color }} />
                  <span className="font-semibold">{u.name}</span>
                  {isMe && <span className="text-xs text-gray-500">(du)</span>}
                  {u.status === "locked" && (
                    <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">gesperrt</span>
                  )}
                  <span className="text-sm text-gray-500">{u.email}</span>
                </div>
                <div className="flex flex-wrap items-start gap-3">
                  <ActionForm resetOnSuccess={false} action={changeRole} className="flex items-center gap-2">
                    <input type="hidden" name="userId" value={u.id} />
                    <Select name="role" defaultValue={u.role} className="w-auto py-1.5 text-sm" aria-label="Rolle">
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </Select>
                    <SubmitButton variant="secondary">Rolle speichern</SubmitButton>
                  </ActionForm>

                  <ActionForm action={createPasswordResetLink} className="space-y-2">
                    <input type="hidden" name="userId" value={u.id} />
                    <SubmitButton variant="secondary">Passwort-Link</SubmitButton>
                  </ActionForm>

                  {!isMe && (
                    <ActionForm action={setUserLocked} className="space-y-2">
                      <input type="hidden" name="userId" value={u.id} />
                      <input type="hidden" name="locked" value={u.status === "locked" ? "false" : "true"} />
                      <SubmitButton variant={u.status === "locked" ? "secondary" : "danger"}>
                        {u.status === "locked" ? "Entsperren" : "Sperren"}
                      </SubmitButton>
                    </ActionForm>
                  )}

                  {!isMe && (
                    <details className="text-sm">
                      <summary className="cursor-pointer py-2 text-red-700">Löschen …</summary>
                      <ActionForm action={deleteUser} className="mt-2 space-y-2">
                        <input type="hidden" name="userId" value={u.id} />
                        <p className="text-xs text-gray-600">
                          Löscht das Konto und alle Termine dieser Person. Zum Bestätigen den Namen eintippen.
                        </p>
                        <Input name="confirm" placeholder={u.name} className="py-1.5 text-sm" />
                        <SubmitButton variant="danger">Endgültig löschen</SubmitButton>
                      </ActionForm>
                    </details>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
