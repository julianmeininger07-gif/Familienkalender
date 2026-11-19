# Familienkalender ins Internet stellen

Damit alle den Kalender auf dem Handy nutzen können, muss er unter einer eigenen Adresse mit **HTTPS**
erreichbar sein. Ohne HTTPS lassen iPhone und Android weder das Installieren als App noch
Push-Nachrichten zu.

Die App ist ein Docker-Paket aus zwei Teilen (App und Postgres-Datenbank) und läuft überall, wo Docker
läuft. Diese Anleitung beschreibt den einfachsten Weg: ein kleiner gemieteter Server plus Caddy für
HTTPS.

## Was du brauchst

| Was | Beispiel | Kosten (ca.) |
| --- | --- | --- |
| Kleiner Linux-Server (1 CPU, 2 GB RAM reichen für 10 Personen) | Hetzner Cloud CX22, netcup, IONOS | 4–6 € im Monat |
| Eine Domain oder Subdomain | `kalender.meine-familie.de` | ab 1 € im Monat, oft schon vorhanden |

Alternativ geht auch ein Raspberry Pi oder NAS zu Hause. Dann muss der Router die Ports 80 und 443 an
das Gerät weiterleiten und die Domain auf die Heim-IP zeigen (DynDNS). Der Server-Weg ist einfacher.

## Schritt für Schritt

1. **Server anlegen** mit Ubuntu 24.04. Die IP-Adresse notieren.
2. **Domain auf den Server zeigen lassen:** beim Domain-Anbieter einen `A`-Eintrag für
   `kalender.meine-familie.de` auf die IP des Servers setzen. Das kann bis zu einer Stunde dauern.
3. **Auf dem Server anmelden** (`ssh root@<IP>`) und Docker installieren:
   ```bash
   curl -fsSL https://get.docker.com | sh
   ```
4. **Code holen:**
   ```bash
   git clone https://github.com/julianmeininger07-gif/Familienkalender.git
   cd Familienkalender
   ```
   Das Repo ist privat. GitHub fragt dann nach Benutzername und einem
   [Personal Access Token](https://github.com/settings/tokens) statt Passwort.
5. **Einstellungen anlegen:**
   ```bash
   cp .env.example .env
   nano .env
   ```
   - `DOMAIN` = deine Domain, z. B. `kalender.meine-familie.de`
   - `APP_URL` = `https://` plus Domain
   - `DB_PASSWORD` = ein langes Zufallspasswort (z. B. aus `openssl rand -hex 24`). Danach nicht mehr ändern.
   - `VAPID_SUBJECT` = `mailto:` plus deine E-Mail-Adresse
6. **Starten:**
   ```bash
   docker compose --profile https up -d --build
   ```
   Der erste Build dauert ein paar Minuten. Caddy holt automatisch ein HTTPS-Zertifikat.
7. **`https://kalender.meine-familie.de` öffnen** und das Admin-Konto anlegen. Danach unter
   „Verwaltung“ die anderen einladen.

## Updates einspielen

```bash
cd Familienkalender
git pull
docker compose --profile https up -d --build
```

Datenbank-Änderungen laufen beim Start automatisch.

## Sicherung

Die Termine liegen im Docker-Volume `db-data`. Eine Sicherung als Datei:

```bash
docker compose exec -T db pg_dump -U kalender kalender | gzip > kalender-$(date +%F).sql.gz
```

Zurückspielen (überschreibt den aktuellen Stand):

```bash
gunzip -c kalender-2027-01-01.sql.gz | docker compose exec -T db psql -U kalender kalender
```

Am besten die Sicherung per Cron täglich laufen lassen und die Datei zusätzlich woanders ablegen.

## Push-Schlüssel

Die Schlüssel für Push-Nachrichten erzeugt die App beim ersten Bedarf selbst und speichert sie in der
Datenbank. Solange die Datenbank bleibt, bleiben auch die Schlüssel. Wer sie lieber selbst verwaltet:

```bash
docker compose exec app npx --yes web-push generate-vapid-keys
```

und die beiden Werte als `VAPID_PUBLIC_KEY` und `VAPID_PRIVATE_KEY` in `.env` eintragen. Werden die
Schlüssel später geändert, muss jedes Gerät die Benachrichtigungen einmal neu einschalten.

## Wenn etwas nicht geht

| Problem | Lösung |
| --- | --- |
| Seite nicht erreichbar | `docker compose ps` zeigt, ob alles läuft. `docker compose logs caddy` zeigt Zertifikatsfehler, meist zeigt die Domain noch nicht auf den Server. |
| Einladungslinks zeigen auf `localhost` | `APP_URL` in `.env` setzen und neu starten. |
| Keine Push-Nachrichten | Läuft die Seite über `https://`? Auf dem iPhone muss der Kalender vom Home-Bildschirm aus geöffnet sein. In den Einstellungen der App „Test-Nachricht“ probieren. |
| Admin-Passwort vergessen | Ein zweiter Admin kann einen Link zum Zurücksetzen erstellen. Gibt es keinen, hilft `docker compose exec db psql -U kalender kalender` und ein Entwickler. |
