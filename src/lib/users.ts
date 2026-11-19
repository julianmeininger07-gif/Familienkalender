import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

export async function userCount(): Promise<number> {
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
  return count;
}
