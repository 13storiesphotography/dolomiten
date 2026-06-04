# Kalender-Import & externe Termine

Roadmap für iCloud / Google / Outlook → Admin-Kalender (Tag/Monat/Jahr).

## Prinzip

| Typ | Quelle | Speicher | Anzeige |
|-----|--------|----------|---------|
| **Shootings** | Admin (Supabase) | `shootings` | Grün/Gold/Grau nach Status |
| **Externe Termine** | Import / Sync | `imported_events` (geplant) | Eigene Farbe (z. B. blau), Label „Kalender“ |

Shootings bleiben die „Wahrheit“ für Drehs; externe Termine ergänzen (Kundengespräche, Reisen, Blocker).

## Phasen

### Phase 1 — `.ics` Import ✅ (in `dev/`)

**Für:** 13 Stories jetzt, alle Fotografen später.

- Button im Kalender: **„Kalender importieren (.ics)“**
- Datei wählen → Vorschau (Datum, Zeit, Titel, Ort, Status neu/bereits)
- **Nur im Kalender anzeigen** → `localStorage`, Ebene **Importiert**, UID-Deduplizierung
- **Als Shooting-Entwürfe** → Liste mit vorausgefüllten Feldern, Speichern im Admin
- **Anzeige leeren** entfernt importierte Termine lokal

**Export bei Apple:** Kalender.app → Kalender markieren → Ablage → Exportieren… → `.ics`

Speicher: Browser `localStorage` (`dolomiten.imported.events.v1`) — Phase 2 migriert nach Supabase.

### Phase 2 — Persistenz in Supabase

Tabelle z. B. `imported_events`:

- `id`, `account_id` (später Multi-Tenant)
- `source_uid`, `source` (`ics` | `webcal` | `caldav`)
- `title`, `starts_at`, `ends_at`, `location`, `raw`
- `linked_shooting_id` (optional)

RLS: nur `authenticated`, pro Mandant scoped.

Kalender-JS merged `shootings` + `imported_events` pro Tag.

### Phase 3 — Auto-Sync (Webcal)

- Fotograf trägt **öffentliche Webcal-URL** ein (iCloud: Kalender veröffentlichen) oder Google „Geheime Adresse“
- Cloudflare Worker (analog Maps-Resolver) holt Feed alle 15–60 Min
- Worker schreibt nach Supabase (`imported_events`)

**Hinweis:** Webcal-URL ist ein geheimer Link — in DB verschlüsselt/hinten, nicht im Frontend loggen.

### Phase 4 — CalDAV (optional, Premium)

- App-spezifisches Passwort (Apple), CalDAV-URL
- Nur im Worker, Credentials in Supabase Vault / Worker Secrets
- Für Fotografen, die keine öffentliche URL wollen

## Was wir bewusst nicht im Kalender zeigen

- **Locations-Ebene** entfernt — Locations haben kein Datum; Zuordnung läuft über Shootings und Tab „Locations“.

## Nächster Implementierungsschritt

Phase 1 in `dev/`: Import-Dialog + Parser + Anzeige im Kalender (lokal oder direkt Supabase je nach Aufwand).
