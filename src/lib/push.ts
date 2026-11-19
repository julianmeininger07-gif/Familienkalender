import "server-only";
import { eq, inArray } from "drizzle-orm";
import webpush from "web-push";
import { db } from "@/db";
import { appSettings, pushSubscriptions } from "@/db/schema";

type Keys = { publicKey: string; privateKey: string };
let keysPromise: Promise<Keys> | null = null;

/**
 * VAPID-Schlüssel für Web Push. Aus der Umgebung (VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY),
 * sonst beim ersten Bedarf erzeugt und in der Datenbank gespeichert – damit es ohne Einrichtung läuft.
 */
export function vapidKeys(): Promise<Keys> {
  keysPromise ??= (async () => {
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
    }
    const [row] = await db.select().from(appSettings).where(eq(appSettings.key, "vapid")).limit(1);
    if (row) return JSON.parse(row.value) as Keys;
    const fresh = webpush.generateVAPIDKeys();
    await db.insert(appSettings).values({ key: "vapid", value: JSON.stringify(fresh) }).onConflictDoNothing();
    // Falls ein zweiter Prozess gleichzeitig erzeugt hat: den gespeicherten nehmen.
    const [saved] = await db.select().from(appSettings).where(eq(appSettings.key, "vapid")).limit(1);
    return JSON.parse(saved.value) as Keys;
  })();
  return keysPromise;
}

/** Absender-Kennung für die Push-Dienste: nur https:- oder mailto:-Adressen sind erlaubt. */
function vapidSubject(): string {
  for (const v of [process.env.VAPID_SUBJECT, process.env.APP_URL]) {
    if (!v) continue;
    if (v.startsWith("https://") || v.startsWith("mailto:")) return v;
    if (v.includes("@") && !v.includes("/")) return `mailto:${v}`;
  }
  return "mailto:admin@localhost";
}

export type PushPayload = { title: string; body: string; url: string; tag?: string };

/** Schickt eine Nachricht an alle Geräte der Benutzer. Abgelaufene Abos werden entfernt. */
export async function sendPush(userIds: string[], payload: PushPayload): Promise<number> {
  if (!userIds.length) return 0;
  const keys = await vapidKeys();
  const subject = vapidSubject();
  const subs = await db.select().from(pushSubscriptions).where(inArray(pushSubscriptions.userId, userIds));
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { vapidDetails: { subject, ...keys }, TTL: 60 * 60 * 24 },
        );
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id));
        } else {
          console.error("Push fehlgeschlagen:", status ?? "", (err as Error).message);
        }
      }
    }),
  );
  return sent;
}
