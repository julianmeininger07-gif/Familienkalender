"use server";

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { sendPush } from "@/lib/push";

const subSchema = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

/** Speichert das Push-Abo dieses Geräts. */
export async function savePushSubscription(input: unknown): Promise<{ ok: boolean }> {
  const me = await requireUser();
  const sub = subSchema.parse(input);
  const userAgent = (await headers()).get("user-agent")?.slice(0, 300) ?? null;
  await db
    .insert(pushSubscriptions)
    .values({ userId: me.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId: me.id, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent },
    });
  return { ok: true };
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  const me = await requireUser();
  await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, me.id)));
}

export async function sendTestPush(): Promise<{ sent: number }> {
  const me = await requireUser();
  const sent = await sendPush([me.id], {
    title: "Familienkalender",
    body: "So sehen Benachrichtigungen aus. 🎉",
    url: "/einstellungen",
    tag: "test",
  });
  return { sent };
}
