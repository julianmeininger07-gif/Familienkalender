import "server-only";
import { asc, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { categories, userPreferences, users } from "@/db/schema";
import type { CurrentUser } from "./auth";

/** Alle aktiven Personen (für Filter, Farben, Einladungen). */
export async function activePeople() {
  return db
    .select({ id: users.id, name: users.name, color: users.color })
    .from(users)
    .where(eq(users.status, "active"))
    .orderBy(asc(users.name));
}

/** Kategorien, die der Benutzer sieht und benutzen darf: gemeinsame und eigene. */
export async function categoriesFor(user: Pick<CurrentUser, "id">) {
  const rows = await db
    .select()
    .from(categories)
    .where(or(isNull(categories.ownerId), eq(categories.ownerId, user.id)))
    .orderBy(asc(categories.name));
  return rows.map((c) => ({ id: c.id, name: c.name, color: c.color, shared: c.ownerId === null }));
}

/** Alle Kategorien (für die Anzeige fremder Termine mit fremden Kategorien). */
export async function allCategories() {
  const rows = await db.select().from(categories).orderBy(asc(categories.name));
  return rows.map((c) => ({ id: c.id, name: c.name, color: c.color, shared: c.ownerId === null }));
}

export async function filtersFor(user: Pick<CurrentUser, "id">) {
  const [p] = await db.select().from(userPreferences).where(eq(userPreferences.userId, user.id)).limit(1);
  return {
    hiddenUserIds: p?.hiddenUserIds ?? [],
    hiddenCategoryIds: [...(p?.hiddenCategoryIds ?? []), ...(p && !p.showUncategorized ? ["none"] : [])],
  };
}
