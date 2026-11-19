import path from "node:path";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { DEFAULT_SCHOOL_HOLIDAYS } from "@/lib/school-holidays-data";
import { db } from "./index";
import { schoolHolidays } from "./schema";

export async function runMigrations(): Promise<void> {
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  // Schulferien einmalig vorbelegen, wenn die Liste noch leer ist.
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(schoolHolidays);
  if (count === 0) await db.insert(schoolHolidays).values(DEFAULT_SCHOOL_HOLIDAYS);
  console.log("Datenbank ist auf dem neuesten Stand.");
}
