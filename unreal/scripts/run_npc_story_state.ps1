<#
.SYNOPSIS
  Apply a validated NPC story snapshot to the loaded BarnSlice or Village map in Unreal.
.PARAMETER StateFile
  JSON snapshot with chapter/day/events plus optional prologue, medicalCheckComplete,
  transportActive, josephLate, and maryamConfirmedMissing fields.
  Events must be an exact prefix of the approved order in studio/npc/README.md.
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File unreal/scripts/run_npc_story_state.ps1 -StateFile unreal/data/day1-post.json
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$StateFile,
  [int]$TimeoutSec = 300,
  [ValidateSet('Commandlet', 'Editor')][string]$BuildMode = 'Commandlet'
)
. (Join-Path $PSScriptRoot 'ov_env.ps1')
$StatePath = (Resolve-Path $StateFile).Path
$eng = Get-OvEngine
$resultFile = Join-Path $Saved 'ov_npc_story_state_result.json'
if (Test-Path $resultFile) { Remove-Item -LiteralPath $resultFile }
$env:OV_NPC_DATA = Join-Path $DataDir 'village-npcs.json'
$env:OV_NPC_STORY_REQUEST = $StatePath
$script = Join-Path $Scripts 'apply_npc_story_state.py'
$log = Join-Path $Saved 'Logs\ov_npc_story_state.log'
if ($BuildMode -eq 'Commandlet') {
  $r = Invoke-Engine $eng.EditorCmd ((Q $Proj) + ' -run=pythonscript -script=' + (Q $script) +
    ' -unattended -nosplash -nop4 -NoSound -abslog=' + (Q $log)) $TimeoutSec
} else {
  $wrap = Join-Path $Saved 'ov_npc_story_state_and_quit.py'
  $code = "import runpy, unreal`ntry:`n    runpy.run_path(r'$script', run_name='__ov__')`nfinally:`n    unreal.SystemLibrary.quit_editor()`n"
  [IO.File]::WriteAllText($wrap, $code, (New-Object System.Text.UTF8Encoding($false)))
  $r = Invoke-Engine $eng.Editor ((Q $Proj) + ' -ExecutePythonScript=' + (Q $wrap) +
    ' -unattended -nosplash -nop4 -NoSound -abslog=' + (Q $log)) $TimeoutSec
}
if (-not (Test-Path $resultFile)) { throw "No story-state result (exit $($r.ExitCode)); see $log" }
$res = Get-Content $resultFile -Raw | ConvertFrom-Json
if (-not $res.ok) { throw "NPC story-state rejected or failed: $($res.error); see $log" }
Say ("Applied {0} NPC states in {1}; visible: {2}" -f $res.applied.Count, $res.map, ($res.visible -join ', '))
foreach ($warning in $res.warnings) { Say ("WARNING: " + $warning) }
