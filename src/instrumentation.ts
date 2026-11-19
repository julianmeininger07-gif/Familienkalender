/** Beim Serverstart: Datenbank-Migrationen einspielen, damit ein Update ohne Extraschritt läuft. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.SKIP_MIGRATIONS !== "1") {
    const { runMigrations } = await import("./db/run-migrations");
    await runMigrations();
  }
}
