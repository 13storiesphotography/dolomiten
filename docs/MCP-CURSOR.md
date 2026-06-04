# Supabase MCP in Cursor einrichten

Ziel: Der Agent kann Schema, RLS und SQL **im richtigen Projekt** prüfen — ohne Keys im Chat oder Git.

**Projekt-Ref:** `hidqxungaqlzyzsxjfqb`

---

## Methode A — Supabase Dashboard (am einfachsten)

1. Öffne (eingeloggt bei Supabase):

   **https://supabase.com/dashboard/project/hidqxungaqlzyzsxjfqb?showConnect=true&connectTab=mcp**

2. Wähle **Cursor** als Client.
3. Folge **„Add to Cursor“** / Kopieren der Konfiguration.
4. Beim ersten Mal: Browser öffnet sich → **Supabase-Login** → Zugriff erlauben (OAuth, **kein** manueller Token nötig).

---

## Methode B — Datei im Repo (bereits vorbereitet)

Im Projekt liegt `.cursor/mcp.json` mit der **hosted** Supabase-URL (read-only, nur dieses Projekt).

### Cursor: Wo ist „MCP“?

Je nach Cursor-Version heißt der Menüpunkt unterschiedlich. Probiere in dieser Reihenfolge:

1. **Cursor Settings** (nicht nur „VS Code Settings“):
   - Mac: Menü **Cursor → Settings → Cursor Settings**
   - Oder: Command Palette `Cmd + Shift + P` → **„Cursor Settings“** tippen
2. Links suchen: **Tools & MCP** oder **Features → MCP** oder **MCP Servers**
3. Dort: Server **supabase** sollte erscheinen → **einschalten** (Toggle)
4. Fenster neu laden: `Cmd + Shift + P` → **Developer: Reload Window**

**Global statt nur Projekt:** dieselbe JSON-Struktur in `~/.cursor/mcp.json` (in deinem Home-Verzeichnis).

### Nach dem Einschalten

- Beim ersten Connect: OAuth im Browser bestätigen.
- In den MCP-Einstellungen sollte stehen: z. B. **X tools enabled** (nicht „0 tools“).

---

## Methode C — Personal Access Token (falls OAuth hakt)

1. https://supabase.com/dashboard/account/tokens → **Generate new token** (Name z. B. `cursor-mcp`)
2. Token kopieren (`sbp_…`) — **nur einmal sichtbar**
3. In `~/.cursor/mcp.json` (global, nicht committen):

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server-supabase@latest",
        "--project-ref",
        "hidqxungaqlzyzsxjfqb",
        "--read-only"
      ],
      "env": {
        "SUPABASE_ACCESS_TOKEN": "DEIN_sbp_TOKEN_HIER"
      }
    }
  }
}
```

4. Cursor neu laden. Token **nie** ins Git-Repo legen.

**macOS + nvm:** Wenn „0 tools“ oder „Client closed“: in `command` den **vollen Pfad** zu `npx` setzen (z. B. `~/.nvm/versions/node/v20.x.x/bin/npx`).

---

## Troubleshooting

| Problem | Lösung |
|--------|--------|
| Finde „MCP“ nicht | **Cursor Settings**, nicht „Settings“ von VS Code |
| 0 tools enabled | Reload Window; OAuth erneut; oder Methode C |
| Client closed | `npx clear-npx-cache`, Node ≥ 18, Cursor neu starten |
| Zwei Supabase-Einträge | Plugin-Server in Tools & MCP **aus**, nur `.cursor/mcp.json` nutzen |

---

## Sicherheit

- `read_only=true` in der URL (Standard in dieser Repo-`mcp.json`) — keine Daten löschen per MCP.
- Service-Role-Key **nicht** für MCP verwenden.

Wenn es läuft, im Chat schreiben: **„MCP eingerichtet“**.
