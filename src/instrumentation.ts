/** Beim Serverstart: Datenbank-Migrationen einspielen und den Erinnerungs-Takt starten. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.SKIP_MIGRATIONS !== "1") {
    const { runMigrations } = await import("./db/run-migrations");
    await runMigrations();
  }
  if (process.env.DISABLE_REMINDERS !== "1") {
    const { startReminderScheduler } = await import("./lib/reminders");
    startReminderScheduler();
  }
}
