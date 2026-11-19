# Familienkalender

Gemeinsamer Kalender für Familie und Freunde (ca. 10 Personen). Läuft im Browser und lässt sich auf
iPhone und Android als App zum Home-Bildschirm hinzufügen (PWA). Bayerische Feiertage und Schulferien
sind eingetragen.

## Stand

| Meilenstein | Inhalt | Status |
| --- | --- | --- |
| 1 | Grundgerüst, Login, Einladungen, Benutzerverwaltung | fertig |
| 2 | Kalender-Ansichten, Feiertage, Schulferien | fertig |
| 3 | Termine, Kategorien, Filter | offen |
| 4 | Wiederholung, Einladungen mit Zu-/Absage | offen |
| 5 | Push-Benachrichtigungen und Erinnerungen | offen |
| 6 | PWA, Feinschliff, Anleitung | offen |

## Starten mit Docker (empfohlen)

Voraussetzung: [Docker](https://docs.docker.com/get-docker/) mit Docker Compose.

```bash
docker compose up -d --build
```

Dann <http://localhost:3000> öffnen. Beim allerersten Aufruf legst du das Admin-Konto an.

Für den echten Betrieb:

- `DB_PASSWORD` auf ein eigenes Passwort setzen (z. B. in einer `.env`-Datei neben `docker-compose.yml`).
- `APP_URL` auf die öffentliche Adresse setzen, z. B. `https://kalender.example.de`. Daraus werden die
  Einladungslinks gebaut.
- Die App braucht HTTPS, sonst erlauben Handys weder Installation noch Push-Nachrichten. Am einfachsten
  mit einem Reverse Proxy wie Caddy davor.

Datenbank-Updates laufen beim Start der App automatisch.

## Benutzer

- **Admin:** lädt Personen ein, ändert Rollen, sperrt oder löscht Konten, erstellt Links zum Zurücksetzen
  des Passworts.
- **Mitglied:** sieht alle Kalender und pflegt eigene Termine.
- **Nur lesen:** sieht alle Kalender und antwortet auf Einladungen.

Es gibt keinen E-Mail-Versand. Einladungen und Passwort-Links erzeugt der Admin unter „Verwaltung“ und
gibt sie z. B. per WhatsApp weiter. Jeder Link funktioniert genau einmal.

## Entwicklung

```bash
cp .env.example .env          # Datenbank-Adresse anpassen
npm install
npm run db:migrate            # Tabellen anlegen
npm run dev                   # http://localhost:3000
```

| Befehl | Zweck |
| --- | --- |
| `npm run lint` | TypeScript-Prüfung |
| `npm test` | Unit-Tests (Vitest) |
| `npm run db:generate` | Neue Migration aus `src/db/schema.ts` erzeugen |

Technik: Next.js 16 (React 19, TypeScript), Tailwind CSS 4, PostgreSQL mit Drizzle ORM, Passwörter mit
Argon2id, Sitzungen per HttpOnly-Cookie (in der Datenbank nur als Hash).

## Feiertage und Schulferien

- **Feiertage** rechnet die App für jedes Jahr selbst aus (`src/lib/holidays.ts`, Osterformel). Enthalten
  sind alle gesetzlichen Feiertage in Bayern inklusive Mariä Himmelfahrt; das Augsburger Friedensfest
  ist bewusst nicht dabei.
- **Schulferien** legt das Kultusministerium fest. Die Schuljahre 2026/27 und 2027/28 sind vorbelegt
  (`src/lib/school-holidays-data.ts`), weitere trägt der Admin unter „Verwaltung → Schulferien pflegen“ ein.
