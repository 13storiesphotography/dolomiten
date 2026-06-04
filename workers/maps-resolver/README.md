# Maps-Link-Resolver (Cloudflare Worker)

Löst Kurzlinks und **Google-Share-Links** (`https://share.google/…`) in echte Maps-URLs mit Koordinaten auf. Der Admin ruft den Worker über `MAPS_RESOLVER_URL` in `dev/assets/js/admin-core.js` auf.

## In Cloudflare eintragen (ohne Wrangler)

1. [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages**
2. Worker **`maps-resolveryournameworkersdev`** (oder wie deiner heißt) öffnen
3. **Edit code** → gesamten Inhalt durch `workers/maps-resolver/src/index.js` aus diesem Repo ersetzen  
   (Wichtigste Änderung: `https://share.google/` in der erlaubten Liste)
4. **Deploy** / **Save and deploy**

`MAPS_RESOLVER_URL` in `dev/assets/js/admin-core.js` bleibt gleich, solange du denselben Worker aktualisierst.

## Deploy per Wrangler (optional)

```bash
cd workers/maps-resolver
npx wrangler deploy
```

Falls die URL neu ist, in `MAPS_RESOLVER_URL` eintragen.

## Unterstützte Eingaben

- `https://maps.app.goo.gl/…`
- `https://goo.gl/maps/…`
- `https://www.google.com/maps/…`
- `https://share.google/…` (neu)

## API

`GET ?url=<encoded maps or share link>` → `{ "resolvedUrl": "https://www.google.com/maps/..." }`
