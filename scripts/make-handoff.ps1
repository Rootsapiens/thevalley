# Builds a handoff zip on the Desktop: project (no heavy/generated folders) + agent definitions + memory.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$date = Get-Date -Format 'yyyy-MM-dd_HHmm'
$stage = Join-Path $env:TEMP "ov-handoff-$date"
$zip = Join-Path ([Environment]::GetFolderPath('Desktop')) "OmegaValley-handoff-$date.zip"

$exclude = @('node_modules', 'dist', 'reference', '.git', 'test-results', 'playwright-report')
$unrealJunk = @('Binaries', 'Intermediate', 'Saved', 'DerivedDataCache')

New-Item -ItemType Directory -Force "$stage\project" | Out-Null
Get-ChildItem $root -Force | Where-Object { $exclude -notcontains $_.Name } | ForEach-Object {
  Copy-Item $_.FullName "$stage\project" -Recurse -Force
}
Get-ChildItem "$stage\project\unreal" -Recurse -Directory -ErrorAction SilentlyContinue |
  Where-Object { $unrealJunk -contains $_.Name } | Remove-Item -Recurse -Force

# Team (agent prompts) and Claude memory for this project
Copy-Item "$env:USERPROFILE\.claude\agents" "$stage\agents" -Recurse -Force
$mem = "$env:USERPROFILE\.claude\projects\C--Users-nadee-Desktop-OmegaValley\memory"
if (Test-Path $mem) { Copy-Item $mem "$stage\memory" -Recurse -Force }
Copy-Item "$root\HANDOFF.md" "$stage\README-FIRST.md" -Force

Compress-Archive -Path "$stage\*" -DestinationPath $zip -Force
Remove-Item $stage -Recurse -Force
"Handoff written: $zip ($([math]::Round((Get-Item $zip).Length/1MB,1)) MB)"
