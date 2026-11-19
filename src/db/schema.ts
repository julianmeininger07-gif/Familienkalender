import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["admin", "member", "reader"]);
export const userStatusEnum = pgEnum("user_status", ["active", "locked"]);
export const visibilityEnum = pgEnum("visibility", ["public", "private"]);
export const responseEnum = pgEnum("attendee_response", ["pending", "accepted", "declined"]);

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

/** Benutzer der App. Rolle: admin (verwaltet alles), member (eigene Termine), reader (nur lesen + antworten). */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    color: text("color").notNull().default("#2563eb"),
    role: roleEnum("role").notNull().default("member"),
    status: userStatusEnum("status").notNull().default("active"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

/** Login-Sitzungen. Gespeichert wird nur der SHA-256-Hash des Cookie-Tokens. */
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/** Einladungen: der Admin erzeugt einen Link und gibt ihn weiter (z. B. per WhatsApp). */
export const invitations = pgTable("invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  tokenHash: text("token_hash").notNull().unique(),
  name: text("name").notNull(),
  email: text("email"),
  role: roleEnum("role").notNull().default("member"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  acceptedBy: uuid("accepted_by").references(() => users.id, { onDelete: "set null" }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: createdAt(),
});

/** Links zum Zurücksetzen des Passworts, vom Admin erzeugt (kein E-Mail-Versand). */
export const passwordResets = pgTable("password_resets", {
  id: uuid("id").primaryKey().defaultRandom(),
  tokenHash: text("token_hash").notNull().unique(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

/** Kategorien (Arbeit, Privat, ...). ownerId = null heißt: für alle sichtbar, vom Admin gepflegt. */
export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#64748b"),
  ownerId: uuid("owner_id").references(() => users.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
});

/** Termine. rrule enthält bei Serien eine RFC-5545-Regel (z. B. FREQ=WEEKLY;BYDAY=MO). */
export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    location: text("location"),
    notes: text("notes"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    allDay: boolean("all_day").notNull().default(false),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    visibility: visibilityEnum("visibility").notNull().default("public"),
    rrule: text("rrule"),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("events_owner_idx").on(t.ownerId), index("events_range_idx").on(t.startsAt, t.endsAt)],
);

/** Abweichungen einzelner Vorkommen einer Serie (abgesagt oder verschoben). */
export const eventExceptions = pgTable(
  "event_exceptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    originalStart: timestamp("original_start", { withTimezone: true }).notNull(),
    cancelled: boolean("cancelled").notNull().default(false),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    title: text("title"),
  },
  (t) => [uniqueIndex("event_exceptions_unique").on(t.eventId, t.originalStart)],
);

/** Eingeladene Personen. responseRequired = Haken "Zu-/Absage erforderlich". */
export const eventAttendees = pgTable(
  "event_attendees",
  {
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    responseRequired: boolean("response_required").notNull().default(false),
    response: responseEnum("response").notNull().default("pending"),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.userId] })],
);

/** Erinnerungen pro Termin und Person, z. B. 60 Minuten oder 1440 Minuten (1 Tag) vorher. */
export const reminders = pgTable(
  "reminders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    minutesBefore: integer("minutes_before").notNull(),
    /** Beginn des letzten Vorkommens, für das schon erinnert wurde (wichtig bei Serien). */
    lastSentFor: timestamp("last_sent_for", { withTimezone: true }),
  },
  (t) => [index("reminders_event_idx").on(t.eventId)],
);

/** Web-Push-Abos, eines pro Gerät/Browser. */
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: text("user_agent"),
  createdAt: createdAt(),
});

/** Schulferien Bayern, gepflegte Liste (lassen sich nicht berechnen). Enddatum inklusive. */
export const schoolHolidays = pgTable("school_holidays", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  schoolYear: text("school_year").notNull(),
});

/** Persönliche Ansichts-Einstellungen: welche Personen/Kategorien ausgeblendet sind. */
export const userPreferences = pgTable("user_preferences", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  hiddenUserIds: uuid("hidden_user_ids").array().notNull().default([]),
  hiddenCategoryIds: uuid("hidden_category_ids").array().notNull().default([]),
  showUncategorized: boolean("show_uncategorized").notNull().default(true),
  defaultView: text("default_view").notNull().default("month"),
  defaultReminderMinutes: integer("default_reminder_minutes"),
});

export type User = typeof users.$inferSelect;
export type Role = User["role"];
