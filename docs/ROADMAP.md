# Roadmap

## Strategie

**Erst Admin perfekt für den ersten Nutzer (Fotografin)** → dann Kunden-Ansicht / Share-Links → dann Multi-Tenant + Abo.

Das reduziert Risiko: echtes Feedback aus dem Alltag, bevor Hosting, Stripe und Mandanten-RLS.

---

## Phase 0 — Jetzt (Admin-Fokus)

Ziele:

- Events + Shootings + Locations in einem flüssigen Workflow
- Mobile-tauglich, wenig Klicks, klare Übersicht (Filter, Gruppen, Suche)
- Stabile Speicherung, klare Fehlermeldungen

Mögliche Arbeitspakete (priorisieren wir gemeinsam):

1. **Admin-UX:** Schnellmenü, Duplizieren, Bulk-Aktionen, bessere Location-Übernahme
2. **Events-Tabelle absichern:** RLS-Policies für `events` prüfen/ergänzen
3. **Notizen & Status:** `shooting_note`, `project_status` / Archiv im Alltag nutzbar machen
4. **Maps/Adresse:** Worker + „Infos erkennen“ zuverlässiger
5. **Dokumentation:** Schema-CSV bei DB-Änderungen aktualisieren
6. **Kalender-Import:** `.ics`-Button → später Auto-Sync (siehe [CALENDAR-IMPORT.md](CALENDAR-IMPORT.md))

**Kunden-`index.html` (später in Phase 0b):**

- Kurze Produkt-/Roadmap-Preview
- Button „Login“ / „Admin“
- Optional: Link „Timeline ansehen“ nur für bekannte Event-URL (Dolomiten-Demo)

---

## Phase 1 — Ein Event sauber teilen

- Öffentliche URL mit Event-Slug oder Token
- Timeline zeigt nur Shootings dieses Events, ohne Archiv/Entwurf
- Kein Zugriff auf fremde Fotografen-Daten (erste RLS-Verschärfung)

---

## Phase 2 — Multi-Tenant MVP

- Account pro Fotograf (`organizations`)
- Branding-Felder (Name, Logo, Farben)
- RLS: Daten pro Mandant

---

## Phase 3 — SaaS & Abo-Stufen

Beispiel-Logik (noch nicht implementiert):

| Stufe | Shootings | Events (verkettet) | Kalender-Timeline | Share-Link |
|-------|-----------|-------------------|-------------------|------------|
| Gold | ja | nein | nein | ja |
| Pro | ja | ja | ja | ja |

Technik: Feature-Flags in `subscriptions` + UI/RLS prüfen.

- Stripe + Demo-Trial
- Onboarding
- Hosting + Custom Domain / Subdomains

---

## Nächster konkreter Schritt

1. Service-Role in Supabase **rotieren** (falls im Chat geleakt).
2. Im Dashboard prüfen: **RLS auf `events`?** Policies vorhanden?
3. **Ein Admin-Schmerzpunkt** nennen (z. B. „neues Shooting anlegen dauert zu lang“) → daran als erstes Feature arbeiten.

Aktualisieren: nach jedem größeren Meilenstein diese Datei kurz anpassen.
