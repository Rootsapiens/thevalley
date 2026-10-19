<#
.SYNOPSIS
  One command for the village NPCs in UE5: find engine -> export JSON -> place NPC actors in BarnSlice.
.DESCRIPTION
  1. find_engine.ps1: newest UE 5.x, writes EngineAssociation into OmegaValley.uproject.
  2. node scripts\export-npcs.ts (read-only on src\) -> unreal\data\village-npcs.json.
  3. UnrealEditor-Cmd -run=pythonscript -script=place_npcs.py (falls back to the full editor with
     -ExecutePythonScript if the commandlet cannot open levels on this engine version). If BarnSlice does not exist,
     place_npcs.py builds it first with build_barn_level.py. Re-runs replace the NPC actors (tag OV_NPC).
  Prints the result from Saved\ov_npcs_result.json. Never installs, signs in or accepts licences.
  run_trial.ps1 -Npcs calls this script after the level build.
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File unreal\scripts\run_npcs.ps1
  powershell -ExecutionPolicy Bypass -File unreal\scripts\run_npcs.ps1 -SkipExport -BuildMode Editor
#>
[CmdletBinding()]
param(
  [int]$TimeoutSec = 900,
  [switch]$SkipExport,
  [ValidateSet('Commandlet', 'Editor')][string]$BuildMode = 'Commandlet'
)
. (Join-Path $PSScriptRoot 'ov_env.ps1')     # $Repo (git), $Proj (mirror project), $DataDir, Invoke-Engine
$Json = Join-Path $DataDir 'village-npcs.json'

# ---------- 1. Engine ----------
$eng = & (Join-Path $PSScriptRoot 'find_engine.ps1') -Project $Proj | Select-Object -Last 1

# ---------- 2. Export the NPCs ----------
if (-not $SkipExport) {
  if (Get-Command node -ErrorAction SilentlyContinue) {
    & node (Join-Path $Repo 'scripts\export-npcs.ts') $Json
    if ($LASTEXITCODE -ne 0) { throw 'export-npcs.ts failed' }
  } elseif (-not (Test-Path $Json)) { throw 'node not found and unreal\data\village-npcs.json missing' }
  else { Say 'node not found: using the existing village-npcs.json' }
}

# ---------- 3. Place the NPCs ----------
$resultFile = Join-Path $Saved 'ov_npcs_result.json'
$script = Join-Path $Scripts 'place_npcs.py'
$env:OV_NPC_DATA = $Json
$res = $null
$modes = if ($BuildMode -eq 'Commandlet') { @('Commandlet', 'Editor') } else { @('Editor') }
foreach ($mode in $modes) {
  if (Test-Path $resultFile) { Remove-Item $resultFile }
  $log = Join-Path $Saved "Logs\ov_npcs_$mode.log"
  if ($mode -eq 'Commandlet') {
    $r = Invoke-Engine $eng.EditorCmd ((Q $Proj) + " -run=pythonscript -script=" + (Q $script) + " -unattended -nosplash -nop4 -NoSound -abslog=" + (Q $log)) $TimeoutSec
  } else {
    $wrap = Join-Path $Saved 'ov_npcs_and_quit.py'
    $code = "import runpy, unreal`ntry:`n    runpy.run_path(r'$script', run_name='__ov__')`nfinally:`n    unreal.SystemLibrary.quit_editor()`n"
    [IO.File]::WriteAllText($wrap, $code, (New-Object System.Text.UTF8Encoding($false)))
    $r = Invoke-Engine $eng.Editor ((Q $Proj) + " -ExecutePythonScript=" + (Q $wrap) + " -unattended -nosplash -nop4 -NoSound -abslog=" + (Q $log)) $TimeoutSec
  }
  if (Test-Path $resultFile) {
    $res = Get-Content $resultFile -Raw | ConvertFrom-Json
    if ($res.ok) { break }
    Say ("NPC placement ($mode) reported a problem: " + $res.error)
  } else { Say "NPC placement ($mode) wrote no result; see $log" }
}
if (-not $res -or -not $res.ok) { throw "NPC placement failed. Logs: $Saved\Logs\ov_npcs_*.log" }
Say ("placed {0} NPCs (removed {1} old), {2} s in script, {3} s wall | floor_to_confirm: {4}" -f $res.placed, $res.removed, $res.seconds, $r.Seconds, ($res.floorToConfirm -join ', '))
Say ("sample npc_farmer actor at ({0}) cm, expected (-1250, 850, 90)" -f ($res.sampleCm -join ', '))
