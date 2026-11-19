"use server";

import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { invitations, passwordResets, users } from "@/db/schema";
import { createSession, destroyAllSessions, destroySession, requireUser } from "@/lib/auth";
import type { FormState } from "@/lib/form-state";
import { hashPassword, verifyPassword } from "@/lib/password";
import { clearFailures, isRateLimited, recordFailure } from "@/lib/rate-limit";
import { hashToken } from "@/lib/tokens";
import {
  acceptInvitationSchema,
  changePasswordSchema,
  firstError,
  formToObject,
  loginSchema,
  resetPasswordSchema,
  setupSchema,
  USER_COLORS,
} from "@/lib/validation";

// Ein fester Hash, damit ein Login mit unbekannter E-Mail genauso lange dauert wie mit bekannter.
let dummyHash: Promise<string> | null = null;

export async function login(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(formToObject(form));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { email, password } = parsed.data;
  const key = `login:${email}`;
  if (isRateLimited(key)) return { error: "Zu viele Versuche. Bitte in 15 Minuten erneut probieren." };

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  dummyHash ??= hashPassword("dummy-password-for-timing");
  const ok = await verifyPassword(user?.passwordHash ?? (await dummyHash), password);
  if (!user || !ok) {
    recordFailure(key);
    return { error: "E-Mail oder Passwort ist falsch." };
  }
  if (user.status !== "active") return { error: "Dieses Konto ist gesperrt. Bitte wende dich an den Admin." };

  clearFailures(key);
  await createSession(user.id);
  redirect("/");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}

/** Ersteinrichtung: legt den ersten Benutzer als Admin an. Geht nur, solange es noch keinen Benutzer gibt. */
export async function setupAdmin(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = setupSchema.safeParse(formToObject(form));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { name, email, password } = parsed.data;
  const passwordHash = await hashPassword(password);

  const created = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(4711)`);
    const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` }).from(users);
    if (count > 0) return null;
    const [u] = await tx
      .insert(users)
      .values({ name, email, passwordHash, role: "admin", color: USER_COLORS[0] })
      .returning({ id: users.id });
    return u;
  });
  if (!created) return { error: "Die App ist bereits eingerichtet. Bitte melde dich an." };

  await createSession(created.id);
  redirect("/");
}

export async function acceptInvitation(token: string, _prev: FormState, form: FormData): Promise<FormState> {
  const parsed = acceptInvitationSchema.safeParse(formToObject(form));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { name, email, password } = parsed.data;
  const passwordHash = await hashPassword(password);

  const result = await db.transaction(async (tx) => {
    const [existing] = await tx.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing) return { error: "Diese E-Mail-Adresse ist bereits registriert." } as const;

    // Einladung atomar "verbrauchen", damit ein Link nur einmal funktioniert.
    const [inv] = await tx
      .update(invitations)
      .set({ acceptedAt: new Date() })
      .where(
        and(
          eq(invitations.tokenHash, hashToken(token)),
          isNull(invitations.acceptedAt),
          isNull(invitations.revokedAt),
          gt(invitations.expiresAt, new Date()),
        ),
      )
      .returning();
    if (!inv) return { error: "Diese Einladung ist abgelaufen oder wurde schon benutzt." } as const;

    const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` }).from(users);
    const [u] = await tx
      .insert(users)
      .values({ name, email, passwordHash, role: inv.role, color: USER_COLORS[count % USER_COLORS.length] })
      .returning({ id: users.id });
    await tx.update(invitations).set({ acceptedBy: u.id }).where(eq(invitations.id, inv.id));
    return { userId: u.id } as const;
  });

  if ("error" in result) return { error: result.error };
  await createSession(result.userId);
  redirect("/");
}

export async function resetPassword(token: string, _prev: FormState, form: FormData): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse(formToObject(form));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const passwordHash = await hashPassword(parsed.data.password);

  const [reset] = await db
    .update(passwordResets)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(passwordResets.tokenHash, hashToken(token)),
        isNull(passwordResets.usedAt),
        gt(passwordResets.expiresAt, new Date()),
      ),
    )
    .returning();
  if (!reset) return { error: "Dieser Link ist abgelaufen oder wurde schon benutzt." };

  await db.update(users).set({ passwordHash }).where(eq(users.id, reset.userId));
  await destroyAllSessions(reset.userId);
  await createSession(reset.userId);
  redirect("/");
}

export async function changePassword(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser();
  const parsed = changePasswordSchema.safeParse(formToObject(form));
  if (!parsed.success) return { error: firstError(parsed.error) };

  const [user] = await db.select().from(users).where(eq(users.id, me.id)).limit(1);
  if (!(await verifyPassword(user.passwordHash, parsed.data.currentPassword))) {
    return { error: "Das aktuelle Passwort ist falsch." };
  }
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(parsed.data.password) })
    .where(eq(users.id, me.id));
  // Andere Geräte abmelden, dieses Gerät angemeldet lassen.
  await destroyAllSessions(me.id);
  await createSession(me.id);
  return { success: "Passwort geändert. Andere Geräte wurden abgemeldet." };
}
