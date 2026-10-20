<#
.SYNOPSIS
  Imports and previews the male and female tactical player models in Unreal.
#>
[CmdletBinding()]
param([int]$TimeoutSec = 600)
. (Join-Path $PSScriptRoot 'ov_env.ps1')
$eng = Get-OvEngine
$resFile = Join-Path $Saved 'ov_player_characters_result.json'
if (Test-Path $resFile) { Remove-Item $resFile }
$log = Join-Path $Saved 'Logs\ov_player_characters.log'
$r = Invoke-Engine $eng.EditorCmd ((Q $Proj) + ' -run=pythonscript -script=' + (Q (Join-Path $Scripts 'import_player_characters.py')) + ' -unattended -nosplash -nop4 -NoSound -abslog=' + (Q $log)) $TimeoutSec
if (-not (Test-Path $resFile)) { throw "character import wrote no result (exit $($r.ExitCode)); see $log" }
$res = Get-Content $resFile -Raw | ConvertFrom-Json
Say "character import: ok=$($res.ok), exit=$($r.ExitCode), wall=$($r.Seconds)s"
if (-not $res.ok) { throw "character import failed: $($res.error)" }
foreach ($c in $res.characters.PSObject.Properties) {
  Say "$($c.Name): $($c.Value.mesh) ($($c.Value.state), $($c.Value.materials) material slots)"
}
