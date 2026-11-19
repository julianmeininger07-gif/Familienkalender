"use server";

import { and, eq, isNull, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import type { FormState } from "@/lib/form-state";
import { categorySchema, firstError, formToObject } from "@/lib/validation";

export async function createCategory(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser();
  const parsed = categorySchema.safeParse(formToObject(form));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const forAll = form.get("forAll") === "on" && me.role === "admin";
  await db.insert(categories).values({ ...parsed.data, ownerId: forAll ? null : me.id });
  revalidatePath("/einstellungen");
  return { success: `Kategorie „${parsed.data.name}“ angelegt.` };
}

export async function deleteCategory(form: FormData): Promise<void> {
  const me = await requireUser();
  const id = String(form.get("id") ?? "");
  // Eigene Kategorien darf jeder löschen, gemeinsame nur der Admin. Termine behalten, Kategorie wird leer.
  const allowed = me.role === "admin" ? or(isNull(categories.ownerId), eq(categories.ownerId, me.id)) : eq(categories.ownerId, me.id);
  await db.delete(categories).where(and(eq(categories.id, id), allowed));
  revalidatePath("/einstellungen");
}
