$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$css = Join-Path $root 'dev\assets\css\admin.css'
$backup = Join-Path $PSScriptRoot 'admin.css.with-stage1'

if (Test-Path $backup) {
  Copy-Item -Force $backup $css
  Write-Host 'Apply OK: admin.css.with-stage1 -> admin.css'
  exit 0
}

$content = Get-Content $css -Raw -Encoding UTF8
if ($content -like "*Mobile: nesting depth flattening*") {
  Write-Host 'Stufe 1 ist bereits aktiv.'
  exit 0
}

$block = @'

/* Mobile: nesting depth flattening (Shooting > Event > Tag > Location-Picker) */
@media(max-width:740px){
  .day-group{
    border-left:0;
    padding-left:0;
    margin-left:0;
    gap:10px;
  }
  .day-heading{
    padding-top:8px;
    border-top:1px solid rgba(247,241,232,.1);
    margin-top:2px;
  }
  .day-group:first-child .day-heading{
    border-top:0;
    padding-top:0;
    margin-top:0;
  }
  .project-summary{padding:12px 10px}
  .spot-card>.editor{padding:0 8px 12px}
  .editor-subpanel-summary{padding:10px 10px}
  .editor-subpanel-body{padding:0 8px 10px}
  .editor-subpanel[open] .editor-subpanel-summary{margin-bottom:8px}
  .editor-subpanel-body .location-finder,
  .location-picker-block .location-finder{
    border:0;
    background:transparent;
    padding:0;
    border-radius:0;
    gap:8px;
  }
  .location-finder .location-setup-panel.editor-subpanel{
    border:0;
    background:transparent;
    border-radius:0;
    margin-top:4px;
  }
  .location-finder .location-setup-panel .editor-subpanel-summary{
    padding:8px 0;
  }
  .location-finder .location-setup-panel[open] .editor-subpanel-summary{
    margin-bottom:6px;
  }
  .location-finder .location-setup-panel .editor-subpanel-body{
    padding:0 0 6px;
  }
  .location-finder-hint-block{padding:4px 0 0}
  .location-group-items{padding:8px 4px 10px}
  .location-group-summary{padding:10px 12px}
  .location-editor{padding:0 6px 12px}
  .location-summary{padding:12px 10px}
  .location-image-block{padding:10px}
  .location-geo-manual{padding:10px}
  .sticky-actions{margin-inline:-2px}
}

'@

$marker = '/* Timeline Divider Sections */'
if ($content -notlike "*$marker*") {
  throw 'Marker nicht gefunden in admin.css'
}

$content = $content.Replace('.project-days{padding:12px}', '.project-days{padding:8px 6px 10px}')
$content = $content.Replace($marker, ($block + $marker))
Set-Content -Path $css -Value $content -Encoding UTF8 -NoNewline
Write-Host 'Apply OK: Stufe-1-Block in admin.css eingefuegt.'
