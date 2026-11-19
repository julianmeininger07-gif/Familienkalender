import { z } from "zod";
/** Mindestlänge für Passwörter (hier statt in password.ts, damit Client-Code kein Argon2 lädt). */
export const MIN_PASSWORD_LENGTH = 8;

export const ROLES = ["admin", "member", "reader"] as const;

export const ROLE_LABELS: Record<(typeof ROLES)[number], string> = {
  admin: "Admin",
  member: "Mitglied",
  reader: "Nur lesen",
};

/** Farbpalette für Personen. Gut unterscheidbar, auf weißem Grund lesbar. */
export const USER_COLORS = [
  "#2563eb", // Blau
  "#dc2626", // Rot
  "#16a34a", // Grün
  "#9333ea", // Lila
  "#ea580c", // Orange
  "#0891b2", // Türkis
  "#db2777", // Pink
  "#65a30d", // Hellgrün
  "#7c3aed", // Violett
  "#b45309", // Braun
  "#0f766e", // Petrol
  "#475569", // Grau
] as const;

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: "Bitte eine gültige E-Mail-Adresse eingeben." }));

const name = z
  .string()
  .trim()
  .min(1, "Bitte einen Namen eingeben.")
  .max(60, "Der Name ist zu lang (max. 60 Zeichen).");

const password = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Das Passwort braucht mindestens ${MIN_PASSWORD_LENGTH} Zeichen.`)
  .max(200, "Das Passwort ist zu lang.");

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Ungültige Farbe.");

function withRepeat<T extends z.ZodRawShape>(shape: T) {
  return z
    .object({ ...shape, password, passwordRepeat: z.string() })
    .refine((v) => (v as { password: string }).password === (v as { passwordRepeat: string }).passwordRepeat, {
      message: "Die Passwörter stimmen nicht überein.",
      path: ["passwordRepeat"],
    });
}

export const loginSchema = z.object({ email, password: z.string().min(1, "Bitte das Passwort eingeben.") });

export const setupSchema = withRepeat({ name, email });

export const acceptInvitationSchema = withRepeat({ name, email });

export const resetPasswordSchema = withRepeat({});

export const changePasswordSchema = withRepeat({ currentPassword: z.string().min(1, "Bitte das aktuelle Passwort eingeben.") });

export const profileSchema = z.object({ name, color });

export const inviteSchema = z.object({
  name,
  email: z.union([z.literal(""), email]).transform((v) => (v === "" ? null : v)),
  role: z.enum(ROLES),
});

export const roleSchema = z.enum(ROLES);

/** Wandelt FormData in ein einfaches Objekt aus Strings. */
export function formToObject(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") out[k] = v;
  return out;
}

/** Erste Fehlermeldung aus einem Zod-Fehler, für die Anzeige im Formular. */
export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Ungültige Eingabe.";
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Bitte ein gültiges Datum wählen.");

export const schoolHolidaySchema = z
  .object({
    name: z.string().trim().min(1, "Bitte einen Namen eingeben.").max(60),
    startDate: isoDate,
    endDate: isoDate,
  })
  .refine((v) => v.startDate <= v.endDate, { message: "Das Ende liegt vor dem Beginn.", path: ["endDate"] });

/** Schuljahr aus dem Datum: ab August zählt das neue Schuljahr (z. B. 2027-09-14 → "2027/28"). */
export function schoolYearOf(date: string): string {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7));
  const start = m >= 8 ? y : y - 1;
  return `${start}/${String((start + 1) % 100).padStart(2, "0")}`;
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Bitte höchstens ${max} Zeichen.`)
    .transform((v) => (v === "" ? null : v));

const time = z.string().regex(/^\d{2}:\d{2}$/, "Bitte eine gültige Uhrzeit wählen.");

/** Erinnerungs-Vorlagen in Minuten vor Beginn. */
export const REMINDER_PRESETS: { minutes: number; label: string }[] = [
  { minutes: 0, label: "Zu Beginn" },
  { minutes: 10, label: "10 Minuten vorher" },
  { minutes: 30, label: "30 Minuten vorher" },
  { minutes: 60, label: "1 Stunde vorher" },
  { minutes: 120, label: "2 Stunden vorher" },
  { minutes: 1440, label: "1 Tag vorher" },
  { minutes: 2880, label: "2 Tage vorher" },
  { minutes: 10080, label: "1 Woche vorher" },
];

export const eventSchema = z
  .object({
    title: z.string().trim().min(1, "Bitte eine Beschreibung eingeben.").max(120, "Die Beschreibung ist zu lang (max. 120 Zeichen)."),
    allDay: z.boolean(),
    startDate: isoDate,
    startTime: z.union([time, z.literal("")]),
    endDate: z.union([isoDate, z.literal("")]),
    endTime: z.union([time, z.literal("")]),
    location: optionalText(200),
    notes: optionalText(2000),
    categoryId: z.union([z.uuid(), z.literal("")]).transform((v) => (v === "" ? null : v)),
    visibility: z.enum(["public", "private"]),
    reminders: z.array(z.number().int().min(0).max(40320)).max(5, "Höchstens 5 Erinnerungen."),
    repeat: z.boolean(),
    freq: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]),
    interval: z.coerce.number().int().min(1, "Der Abstand muss mindestens 1 sein.").max(99),
    repeatEnd: z.enum(["never", "until", "count"]),
    until: z.union([isoDate, z.literal("")]),
    count: z.coerce.number().int().min(1).max(500),
    attendees: z.array(z.object({ userId: z.uuid(), required: z.boolean() })).max(50),
  })
  .superRefine((v, ctx) => {
    if (!v.allDay && !v.startTime) ctx.addIssue({ code: "custom", message: "Bitte eine Uhrzeit angeben.", path: ["startTime"] });
    if (v.repeat && v.repeatEnd === "until" && (!v.until || v.until < v.startDate)) {
      ctx.addIssue({ code: "custom", message: "Bitte ein Enddatum für die Wiederholung nach dem Beginn wählen.", path: ["until"] });
    }
  });

export type EventInputData = z.infer<typeof eventSchema>;

/** FormData des Termin-Formulars → geprüfte Daten. */
export function parseEventForm(form: FormData) {
  const o = formToObject(form);
  return eventSchema.safeParse({
    title: o.title ?? "",
    allDay: o.allDay === "on",
    startDate: o.startDate ?? "",
    startTime: o.startTime ?? "",
    endDate: o.endDate ?? "",
    endTime: o.endTime ?? "",
    location: o.location ?? "",
    notes: o.notes ?? "",
    categoryId: o.categoryId ?? "",
    visibility: o.visibility === "private" ? "private" : "public",
    reminders: [...new Set(form.getAll("reminders").map((r) => Number(r)))],
    repeat: o.repeat === "on",
    freq: o.freq ?? "WEEKLY",
    interval: o.interval || "1",
    repeatEnd: o.repeatEnd ?? "never",
    until: o.until ?? "",
    count: o.count || "10",
    attendees: [...new Set(form.getAll("attendees").map(String))].map((userId) => ({
      userId,
      required: o[`required_${userId}`] === "on",
    })),
  });
}

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Bitte einen Namen eingeben.").max(40),
  color,
});
