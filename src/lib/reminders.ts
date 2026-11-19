import "server-only";
import { and, eq, gt, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { eventExceptions, events, reminders } from "@/db/schema";
import { shortWhen } from "./notify";
import { sendPush } from "./push";
import { expand, parseRule } from "./recurrence";

const MAX_LEAD_MIN = 10080; // 1 Woche, längste Vorlage
const GRACE_MS = 15 * 60 * 1000; // verpasste Erinnerungen höchstens 15 Minuten nachholen

function leadText(min: number): string {
  if (min === 0) return "Jetzt";
  if (min < 60) return `In ${min} Minuten`;
  if (min < 1440) return min === 60 ? "In 1 Stunde" : `In ${min / 60} Stunden`;
  if (min < 10080) return min === 1440 ? "Morgen" : `In ${min / 1440} Tagen`;
  return "In 1 Woche";
}

/**
 * Prüft fällige Erinnerungen und verschickt sie. Läuft jede Minute.
 * lastSentFor merkt sich das Vorkommen, für das zuletzt erinnert wurde (wichtig bei Serien).
 */
export async function processDueReminders(now = new Date()): Promise<number> {
  return db.transaction(async (tx) => {
    // Nur ein Prozess gleichzeitig (falls mehrere Instanzen laufen).
    const [{ locked }] = (await tx.execute(sql`select pg_try_advisory_xact_lock(4712) as locked`)).rows as { locked: boolean }[];
    if (!locked) return 0;

    const horizon = new Date(now.getTime() + MAX_LEAD_MIN * 60000);
    const rows = await tx
      .select({ r: reminders, e: events })
      .from(reminders)
      .innerJoin(events, eq(events.id, reminders.eventId))
      .where(
        and(
          lte(events.startsAt, horizon),
          or(
            and(isNull(events.rrule), gt(events.startsAt, new Date(now.getTime() - GRACE_MS))),
            and(isNotNull(events.rrule), or(isNull(events.repeatUntil), gt(events.repeatUntil, now))),
          ),
        ),
      );

    const seriesIds = [...new Set(rows.filter((x) => x.e.rrule).map((x) => x.e.id))];
    const cancelled = seriesIds.length
      ? await tx
          .select({ eventId: eventExceptions.eventId, originalStart: eventExceptions.originalStart })
          .from(eventExceptions)
          .where(and(inArray(eventExceptions.eventId, seriesIds), eq(eventExceptions.cancelled, true)))
      : [];
    const skip = new Set(cancelled.map((c) => `${c.eventId}|${c.originalStart.toISOString()}`));

    let sent = 0;
    for (const { r, e } of rows) {
      const lead = r.minutesBefore * 60000;
      // Vorkommen, deren Erinnerungszeit in (now - GRACE, now] liegt.
      const windowFrom = new Date(now.getTime() - GRACE_MS + lead);
      const windowTo = new Date(now.getTime() + lead + 1);
      const rule = e.rrule ? parseRule(e.rrule) : null;
      const starts = rule
        ? expand(e, rule, windowFrom, new Date(windowTo.getTime() + (e.endsAt.getTime() - e.startsAt.getTime())))
            .map((o) => o.startsAt)
            .filter((s) => s >= windowFrom && s < windowTo && !skip.has(`${e.id}|${s.toISOString()}`))
        : [e.startsAt].filter((s) => s >= windowFrom && s < windowTo);
      const due = starts.filter((s) => !r.lastSentFor || s > r.lastSentFor).sort((a, b) => a.getTime() - b.getTime()).at(-1);
      if (!due) continue;

      await tx.update(reminders).set({ lastSentFor: due }).where(eq(reminders.id, r.id));
      await sendPush([r.userId], {
        title: `${leadText(r.minutesBefore)}: ${e.title}`,
        body: [shortWhen({ startsAt: due, allDay: e.allDay }), e.location].filter(Boolean).join(" · "),
        url: e.rrule ? `/termin/${e.id}?am=${encodeURIComponent(due.toISOString())}` : `/termin/${e.id}`,
        tag: `erinnerung-${e.id}-${due.toISOString()}`,
      }).catch((err) => console.error("Erinnerung fehlgeschlagen", err));
      sent++;
    }
    return sent;
  });
}

let timer: ReturnType<typeof setInterval> | null = null;

/** Startet den Erinnerungs-Takt im Serverprozess (jede Minute). */
export function startReminderScheduler(): void {
  if (timer) return;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const n = await processDueReminders();
      if (n) console.log(`${n} Erinnerung(en) verschickt.`);
    } catch (err) {
      console.error("Erinnerungen konnten nicht geprüft werden:", err);
    } finally {
      running = false;
    }
  };
  timer = setInterval(tick, 60_000);
  setTimeout(tick, 5_000);
}
