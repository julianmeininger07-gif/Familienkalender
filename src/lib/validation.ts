import { z } from "zod";
import { MIN_PASSWORD_LENGTH } from "./password";

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
