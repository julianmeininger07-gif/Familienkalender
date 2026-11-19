/** Umrechnung zwischen deutscher Ortszeit (Europe/Berlin) und UTC, ohne Zusatzbibliothek. */

export const TZ = "Europe/Berlin";

const partsFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function berlinParts(d: Date) {
  const p = Object.fromEntries(partsFmt.formatToParts(d).map((x) => [x.type, x.value]));
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${p.hour}:${p.minute}`,
    asUtcMs: Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second),
  };
}

/** Versatz von Berlin gegenüber UTC zu einem Zeitpunkt, in Minuten (+60 Winter, +120 Sommer). */
function offsetMinutes(d: Date): number {
  return Math.round((berlinParts(d).asUtcMs - Math.floor(d.getTime() / 1000) * 1000) / 60000);
}

/** "2027-05-27" + "14:30" (Berliner Zeit) → UTC-Zeitpunkt. */
export function berlinToUtc(date: string, time = "00:00"): Date {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  // Zweimal korrigieren, damit auch die Zeitumstellung stimmt.
  let ts = guess - offsetMinutes(new Date(guess)) * 60000;
  ts = guess - offsetMinutes(new Date(ts)) * 60000;
  return new Date(ts);
}

/** UTC-Zeitpunkt → Datum und Uhrzeit in Berlin. */
export function utcToBerlin(d: Date): { date: string; time: string } {
  const p = berlinParts(d);
  return { date: p.date, time: p.time };
}
