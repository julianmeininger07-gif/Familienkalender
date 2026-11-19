"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { invitations, passwordResets, users } from "@/db/schema";
import { destroyAllSessions, requireAdmin } from "@/lib/auth";
import { appUrl } from "@/lib/app-url";
import type { FormState } from "@/lib/form-state";
import { hashToken, randomToken } from "@/lib/tokens";
import { firstError, formToObject, inviteSchema, roleSchema } from "@/lib/validation";

const INVITE_DAYS = 7;
const RESET_HOURS = 24;

export async function createInvitation(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = inviteSchema.safeParse(formToObject(form));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { name, email, role } = parsed.data;

  if (email) {
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing) return { error: "Mit dieser E-Mail-Adresse gibt es schon ein Konto." };
  }

  const token = randomToken();
  await db.insert(invitations).values({
    tokenHash: hashToken(token),
    name,
    email,
    role,
    createdBy: admin.id,
    expiresAt: new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000),
  });
  revalidatePath("/verwaltung");
  return {
    success: `Einladung für ${name} erstellt. Der Link gilt ${INVITE_DAYS} Tage und funktioniert einmal.`,
    link: `${await appUrl()}/einladung/${token}`,
  };
}

export async function revokeInvitation(form: FormData): Promise<void> {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  await db.update(invitations).set({ revokedAt: new Date() }).where(eq(invitations.id, id));
  revalidatePath("/verwaltung");
}

async function otherActiveAdmins(userId: string): Promise<number> {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.status, "active"), ne(users.id, userId)));
  return count;
}

export async function changeRole(_prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const userId = String(form.get("userId") ?? "");
  const role = roleSchema.safeParse(form.get("role"));
  if (!role.success) return { error: "Ungültige Rolle." };

  const [target] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!target) return { error: "Benutzer nicht gefunden." };
  if (target.role === "admin" && role.data !== "admin" && (await otherActiveAdmins(userId)) === 0) {
    return { error: "Es muss mindestens ein Admin bleiben." };
  }
  await db.update(users).set({ role: role.data }).where(eq(users.id, userId));
  revalidatePath("/verwaltung");
  return { success: "Rolle geändert." };
}

export async function setUserLocked(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const userId = String(form.get("userId") ?? "");
  const locked = form.get("locked") === "true";
  if (userId === admin.id) return { error: "Du kannst dich nicht selbst sperren." };

  const [target] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!target) return { error: "Benutzer nicht gefunden." };
  if (locked && target.role === "admin" && (await otherActiveAdmins(userId)) === 0) {
    return { error: "Es muss mindestens ein aktiver Admin bleiben." };
  }
  await db.update(users).set({ status: locked ? "locked" : "active" }).where(eq(users.id, userId));
  if (locked) await destroyAllSessions(userId);
  revalidatePath("/verwaltung");
  return { success: locked ? `${target.name} ist gesperrt.` : `${target.name} ist wieder aktiv.` };
}

export async function createPasswordResetLink(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const userId = String(form.get("userId") ?? "");
  const [target] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!target) return { error: "Benutzer nicht gefunden." };

  const token = randomToken();
  await db.insert(passwordResets).values({
    tokenHash: hashToken(token),
    userId,
    createdBy: admin.id,
    expiresAt: new Date(Date.now() + RESET_HOURS * 60 * 60 * 1000),
  });
  return {
    success: `Link zum Zurücksetzen für ${target.name}. Er gilt ${RESET_HOURS} Stunden und funktioniert einmal.`,
    link: `${await appUrl()}/passwort/${token}`,
  };
}

export async function deleteUser(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const userId = String(form.get("userId") ?? "");
  if (userId === admin.id) return { error: "Du kannst dich nicht selbst löschen." };
  const [target] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!target) return { error: "Benutzer nicht gefunden." };
  if (form.get("confirm") !== target.name) {
    return { error: `Zum Bestätigen bitte genau „${target.name}“ eintippen.` };
  }
  await db.delete(users).where(eq(users.id, userId));
  revalidatePath("/verwaltung");
  return { success: `${target.name} wurde gelöscht.` };
}
