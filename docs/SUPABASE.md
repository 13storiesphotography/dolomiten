# Supabase — Schema, RLS, Keys

**Projekt:** `hidqxungaqlzyzsxjfqb`  
**URL:** `https://hidqxungaqlzyzsxjfqb.supabase.co`

Der **Publishable Key** steht in `dev/assets/js/admin-core.js` und `dev/index.html` (für die Browser-App). Keine weiteren Secrets in Git committen.

---

## Tabellen

### `events`

| Spalte | Typ | Nullable |
|--------|-----|----------|
| id | text | NO |
| name | text | NO |
| status | text | YES |
| created_at | timestamptz | YES |
| updated_at | timestamptz | YES |

Verknüpfung zur App: `shootings.project_name` entspricht meist `events.name` (logisch, kein FK in DB).

### `locations`

| Spalte | Typ | Nullable |
|--------|-----|----------|
| id | uuid | NO |
| name | text | NO |
| country, region, area, category | text | YES |
| address, maps_link, meeting_place, image_url, image_focus, description | text | YES — `image_focus` z. B. `50% 50%` (Bildausschnitt) |
| tags, seasons | ARRAY | YES |
| active | boolean | YES |
| is_favorite | boolean | YES |
| usage_count | integer | YES |
| last_used_at | timestamptz | YES |
| created_at, updated_at | timestamptz | YES |

### `shootings`

| Spalte | Typ | Nullable |
|--------|-----|----------|
| id | text | NO |
| sort_order | integer | NO |
| day_label, date_label, title | text | NO |
| subtitle, meeting_time, meeting_place, shooting_time, end_time | text | YES — `shooting_time` = Start Session (Kunden-App), `end_time` = optionales Ende |
| location_name, meeting_link, location_link, image_url | text | YES |
| weather_id, weather_label | text | YES |
| badges | ARRAY | YES |
| route_after | text | YES |
| location_id | uuid | YES → `locations.id` |
| shooting_note | text | YES |
| project_name, project_status | text | YES |
| workflow_status | text | YES — Planungsstatus für Shootings **ohne** `project_name` (z. B. angefragt, fix); `NULL` wenn an Event gebunden |
| updated_at | timestamptz | YES |

### `profiles`

| Spalte | Typ | Nullable |
|--------|-----|----------|
| id | uuid | NO → `auth.users.id` |
| display_name | text | YES |
| studio_name | text | YES |
| role | text | YES (Default `admin`) |
| created_at, updated_at | timestamptz | YES |

Migration: `docs/migrations/add_profiles.sql` (angewendet via Supabase MCP).

Vollständiger Export: `docs/supabase-schema-export.csv`

---

## Row Level Security (RLS)

### `shootings`

| Policy | Rollen | Befehl | Bedeutung |
|--------|--------|--------|-----------|
| Public can read shootings | `anon`, `authenticated` | SELECT | **Jeder** kann alle Shootings lesen (Kunden-Timeline ohne Login). |
| Allow authenticated inserts | `authenticated` | INSERT | Nur eingeloggte Admins legen an. |
| Authenticated can update | `authenticated` | UPDATE | Nur eingeloggte Admins ändern. |
| Allow authenticated deletes | `authenticated` | DELETE | Nur eingeloggte Admins löschen. |

`qual` / `with_check` = `true` → noch **keine** Mandanten-Trennung (alle Zeilen für alle Auth-User).

### `locations`

| Policy | Rollen | Befehl |
|--------|--------|--------|
| locations_select | `authenticated` | SELECT |
| locations_insert | `authenticated` | INSERT |
| locations_update | `authenticated` | UPDATE |
| locations_delete | `authenticated` | DELETE |

**Anon kann Locations nicht lesen** — passt: Bibliothek nur im Admin nach Login.

### `events`

| Policy | Rollen | Befehl | Bedeutung |
|--------|--------|--------|-----------|
| events_select | `authenticated` | SELECT | Nur Admin nach Login |
| events_insert | `authenticated` | INSERT | Nur Admin |
| events_update | `authenticated` | UPDATE | Nur Admin |
| events_delete | `authenticated` | DELETE | Nur Admin |

**Anon hat keinen Zugriff** (Events bleiben intern). Migration: `events_rls_policies_for_authenticated`.

### `profiles`

| Policy | Rollen | Befehl | Bedeutung |
|--------|--------|--------|-----------|
| profiles_select_own | `authenticated` | SELECT | Nur eigenes Profil |
| profiles_insert_own | `authenticated` | INSERT | Nur eigenes Profil anlegen |
| profiles_update_own | `authenticated` | UPDATE | Nur eigenes Profil ändern |

---

## Konsequenzen für die Produkt-Roadmap

| Heute | Später (SaaS) |
|-------|----------------|
| Eine DB, alle Shootings öffentlich lesbar | `organization_id` / `event_id` + SELECT nur für Share-Token oder Event-Slug |
| Ein Admin-Login (Supabase User) | Fotograf-Accounts, RLS pro Mandant |
| `project_name` als Event-Name | FK `event_id`, öffentliche URL filtert darauf |

---

## Auth — Passwort zurücksetzen (Redirect-URLs)

**Einmalig im Dashboard** (nicht per SQL/MCP):  
[Authentication → URL Configuration](https://supabase.com/dashboard/project/hidqxungaqlzyzsxjfqb/auth/url-configuration)

| Feld | Wert (Stand Projekt) |
|------|----------------------|
| **Site URL** | `https://13storiesphotography.github.io/dolomiten/dev/admin` |
| **Redirect URLs** | `https://13storiesphotography.github.io/dolomiten/dev/admin` |
| | `https://13storiesphotography.github.io/dolomiten/dev/admin.html` |
| | `https://13storiesphotography.github.io/**` |
| | `http://localhost:8080/dev/admin.html` |
| | `http://127.0.0.1:8080/**` |
| | `http://192.168.*.*:8080/**` (iPhone im WLAN) |

Die App sendet beim Reset `redirectTo` = aktuelle Seiten-URL (Live) bzw. die GitHub-Pages-URL, wenn du lokal per `file://` öffnest — **`file://` geht in Supabase nicht** als Redirect.

Lokal testen: `python -m http.server 8080` im Ordner `dev/` → `http://localhost:8080/admin.html`

Ohne Eintrag landet der Link aus der E-Mail nicht in der App.

---

## Keys — was wofür?

| Key | Verwendung | Im Repo? |
|-----|------------|----------|
| **Publishable / anon** | Browser (`createClient` in HTML/JS) | Ja (öffentlich) |
| **Service role** | Nur Server, Migrationen, Notfall-Admin — **umgeht RLS** | **Niemals** |

**Wichtig:** Service-Role-Key, der einmal in Chat/Logs stand, in Supabase unter **Settings → API → Rotate service role key** erneuern. Neuen Key nur in `.env.local` oder Cursor Secrets, nicht committen.

Beispiel `.env.local` (lokal, gitignored):

```env
SUPABASE_URL=https://hidqxungaqlzyzsxjfqb.supabase.co
SUPABASE_ANON_KEY=<publishable aus Dashboard>
# Optional nur für lokale Tools / MCP:
SUPABASE_SERVICE_ROLE_KEY=<nach Rotation neu>
```

---

## Schema erneut exportieren

Im **SQL Editor** (nicht `supabase db dump` als SQL ausführen):

```sql
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('shootings', 'events', 'locations')
ORDER BY table_name, ordinal_position;
```

```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public';
```

Ergebnis nach `docs/supabase-schema-export.csv` kopieren, wenn sich etwas ändert.
