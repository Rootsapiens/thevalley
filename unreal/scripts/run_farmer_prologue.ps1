<#
.SYNOPSIS
  Builds the inspectable, non-autoplay Farmer prologue search sequence in BarnSlice.
#>
[CmdletBinding()]
param([int]$TimeoutSec = 600)
. (Join-Path $PSScriptRoot 'ov_env.ps1')
& (Join-Path $PSScriptRoot 'run_npcs.ps1') -TimeoutSec $TimeoutSec
$idleClip = Join-Path $ProjDir 'Content\OmegaValley\Characters\Farmer\Animations\Worker_Male_Anim_CharacterArmature_Idle.uasset'
$walkClip = Join-Path $ProjDir 'Content\OmegaValley\Characters\Farmer\Animations\Worker_Male_Anim_CharacterArmature_Walk.uasset'
if (-not (Test-Path $idleClip) -or -not (Test-Path $walkClip)) {
  & (Join-Path $PSScriptRoot 'run_player_characters.ps1') -TimeoutSec $TimeoutSec
}
$eng = Get-OvEngine
$resultFile = Join-Path $Saved 'ov_farmer_prologue_result.json'
if (Test-Path $resultFile) { Remove-Item $resultFile }
$script = Join-Path $Scripts 'make_farmer_prologue.py'
$log = Join-Path $Saved 'Logs\ov_farmer_prologue.log'
$r = Invoke-Engine $eng.EditorCmd ((Q $Proj) + ' -run=pythonscript -script=' + (Q $script) +
  ' -unattended -nosplash -nop4 -NoSound -abslog=' + (Q $log)) $TimeoutSec
if (-not (Test-Path $resultFile)) { throw "Farmer prologue build wrote no result (exit $($r.ExitCode)); see $log" }
$res = Get-Content $resultFile -Raw | ConvertFrom-Json
if (-not $res.ok) { throw "Farmer prologue build failed: $($res.error)" }
Say "Built $($res.sequence), $($res.durationSeconds)s, autoplay=$($res.autoPlay)"
