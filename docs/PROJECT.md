# Shooting Planer — Projektüberblick

## Was ist das?

Web-App für Fotografen, um **Events** (z. B. Dolomiten-Reise) mit mehreren **Shootings** zu planen und Models/Kunden eine **Timeline-Übersicht** zu geben (Treffpunkt, Shooting-Zeit, Location, Wetter, Links).

- **Ursprung:** Ein konkretes Event für eine Fotografin (13 Stories Photography) — Dolomiten, mehrere Tage, mehrere Spots.
- **Langfristige Vision:** SaaS im Abo — Fotografen planen selbst; Kunden/Models sehen eine gebrandete Frontpage (Share-Link). Abo-Stufen (z. B. „Gold“) können Features begrenzen (nur Einzel-Shootings, keine Event-Ketten, keine Kalender-Timeline, …).

## Aktuelle Priorität (Stand Juni 2026)

**Admin zuerst ausreifen** — alles, was die Fotografin täglich braucht (Events, Shootings, Locations, Übersicht, Mobile), bevor Go-to-Market und Multi-Tenant.

Die **Kunden-Timeline** (`dev/index.html`) bleibt vorerst Referenz/MVP; später: Roadmap-Preview + Login-Button statt vollständiger Live-Timeline für Fremde.

## Repo-Struktur

| Pfad | Rolle |
|------|--------|
| `dev/` | **Haupt-Entwicklungsbereich** — hier bauen wir Features |
| `dev/admin.html` + `dev/assets/js/*` | Admin (Login, Events, Shootings, Locations) |
| `dev/index.html` | Öffentliche Timeline (später schlanker Landing/Preview) |
| `/` (Root) | Produktions-Kopien (`index.html`, `admin.html`) — Sync wenn stabil |

## Externe Dienste

- **Supabase** — Auth (Admin), DB (`shootings`, `events`, `locations`)
- **Open-Meteo** — Wetter in der Kunden-Timeline
- **Cloudflare Worker** — Maps-Link-Auflösung inkl. `share.google` (`workers/maps-resolver/`, `MAPS_RESOLVER_URL` in `admin-core.js`)

## Branding

- Heute: „13 Stories“ / Dolomiten als erstes reales Event.
- Ziel: **White-Label** pro Fotograf (Name, Logo, Farben auf Kunden- und Admin-Oberfläche).

## Nicht im Repo

- Service-Role-Key, Stripe-Keys, Passwörter → nur lokal oder Hosting-Secrets (siehe `docs/SUPABASE.md`).
