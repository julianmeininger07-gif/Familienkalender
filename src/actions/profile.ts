"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import type { FormState } from "@/lib/form-state";
import { firstError, formToObject, profileSchema } from "@/lib/validation";

export async function updateProfile(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser();
  const parsed = profileSchema.safeParse(formToObject(form));
  if (!parsed.success) return { error: firstError(parsed.error) };
  await db.update(users).set(parsed.data).where(eq(users.id, me.id));
  revalidatePath("/", "layout");
  return { success: "Gespeichert." };
}
