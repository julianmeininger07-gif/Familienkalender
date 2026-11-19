"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { schoolHolidays } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import type { FormState } from "@/lib/form-state";
import { firstError, formToObject, schoolHolidaySchema, schoolYearOf } from "@/lib/validation";

export async function addSchoolHoliday(_prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = schoolHolidaySchema.safeParse(formToObject(form));
  if (!parsed.success) return { error: firstError(parsed.error) };
  await db.insert(schoolHolidays).values({ ...parsed.data, schoolYear: schoolYearOf(parsed.data.startDate) });
  revalidatePath("/verwaltung/schulferien");
  return { success: `${parsed.data.name} eingetragen.` };
}

export async function deleteSchoolHoliday(form: FormData): Promise<void> {
  await requireAdmin();
  await db.delete(schoolHolidays).where(eq(schoolHolidays.id, String(form.get("id") ?? "")));
  revalidatePath("/verwaltung/schulferien");
}
