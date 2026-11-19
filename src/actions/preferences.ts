"use server";

import { z } from "zod";
import { db } from "@/db";
import { userPreferences } from "@/db/schema";
import { requireUser } from "@/lib/auth";

const prefsSchema = z.object({
  hiddenUserIds: z.array(z.uuid()).max(200),
  hiddenCategoryIds: z.array(z.string().max(40)).max(200),
});

/** Speichert, welche Personen/Kategorien in der Übersicht ausgeblendet sind. */
export async function saveFilterPreferences(input: { hiddenUserIds: string[]; hiddenCategoryIds: string[] }) {
  const me = await requireUser();
  const v = prefsSchema.parse(input);
  // "none" steht für "Ohne Kategorie"; uuid[] verträgt das nicht, darum getrennt speichern.
  const hiddenCategoryIds = v.hiddenCategoryIds.filter((id) => z.uuid().safeParse(id).success);
  const showUncategorized = !v.hiddenCategoryIds.includes("none");
  await db
    .insert(userPreferences)
    .values({ userId: me.id, hiddenUserIds: v.hiddenUserIds, hiddenCategoryIds, showUncategorized })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { hiddenUserIds: v.hiddenUserIds, hiddenCategoryIds, showUncategorized },
    });
}
