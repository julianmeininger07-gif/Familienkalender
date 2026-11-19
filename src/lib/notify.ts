import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { events } from "@/db/schema";
import type { CurrentUser } from "./auth";
import { sendPush } from "./push";
import { utcToBerlin } from "./time";

const shortDate = new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "Europe/Berlin" });

/** "Mo., 15.03., 18:00" bzw. "Mo., 15.03." bei ganztägig. */
export function shortWhen(e: { startsAt: Date; allDay: boolean }): string {
  const d = shortDate.format(e.startsAt);
  return e.allDay ? d : `${d}, ${utcToBerlin(e.startsAt).time}`;
}

/** Benachrichtigt neu eingeladene Personen. */
export async function notifyInvited(eventId: string, userIds: string[], by: CurrentUser): Promise<void> {
  if (!userIds.length) return;
  const [e] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (!e) return;
  await sendPush(userIds, {
    title: `Einladung von ${by.name}`,
    body: `${e.title} · ${shortWhen(e)}`,
    url: `/termin/${e.id}`,
    tag: `einladung-${e.id}`,
  }).catch((err) => console.error("Einladungs-Push fehlgeschlagen", err));
}

/** Benachrichtigt den Ersteller über eine Zu- oder Absage. */
export async function notifyResponse(eventId: string, by: CurrentUser, response: "accepted" | "declined"): Promise<void> {
  const [e] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (!e || e.ownerId === by.id) return;
  await sendPush([e.ownerId], {
    title: `${by.name} hat ${response === "accepted" ? "zugesagt ✓" : "abgesagt ✗"}`,
    body: `${e.title} · ${shortWhen(e)}`,
    url: `/termin/${e.id}`,
    tag: `antwort-${e.id}-${by.id}`,
  }).catch((err) => console.error("Antwort-Push fehlgeschlagen", err));
}
