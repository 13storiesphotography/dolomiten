# Backup: Mobile Nesting Flatten (Stufe 1)

**Datum:** 2026-06-08  
**Betroffene Datei:** `dev/assets/css/admin.css`

## Was Stufe 1 ändert

- Weniger horizontales Padding auf schmalen Screens (`max-width: 740px`)
- Tages-Gruppen ohne linke Border-Einrückung
- Doppelte Boxen im Location-Picker (Finder + Setup-Subpanel) aufgelöst
- Schlankere Abstände in Locations-Admin

## Schnell zurück (Revert)

PowerShell im Projektroot:

```powershell
.\dev\backups\mobile-nesting-flatten\revert-stage1.ps1
```

Oder manuell: Block `/* Mobile: nesting depth flattening ... */` in `admin.css` löschen und in der Zeile darüber `.project-days{padding:12px}` wiederherstellen (statt `padding:8px 6px 10px`).

## Wieder aktivieren

```powershell
.\dev\backups\mobile-nesting-flatten\apply-stage1.ps1
```

## Dateien

| Datei | Zweck |
|-------|--------|
| `admin.css.with-stage1` | Vollständige CSS **mit** Stufe 1 (Referenz) |
| `admin.css.before-stage1` | Vollständige CSS **ohne** Stufe 1 (Revert-Ziel) |
| `revert-stage1.ps1` | Stellt `before` wieder her |
| `apply-stage1.ps1` | Wendet `with-stage1` an |
