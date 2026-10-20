<# Imports Quaternius' free CC0 RPG character FBXs and textures, then builds VillagerShowcase. #>
[CmdletBinding()]
param([int]$TimeoutSec = 900)
. (Join-Path $PSScriptRoot 'ov_env.ps1')
$eng = Get-OvEngine
$resFile = Join-Path $Saved 'ov_villager_characters_result.json'
if (Test-Path $resFile) { Remove-Item $resFile }
$log = Join-Path $Saved 'Logs\ov_villager_characters.log'
$script = Join-Path $Scripts 'import_villager_characters.py'
$r = Invoke-Engine $eng.EditorCmd ((Q $Proj) + ' -run=pythonscript -script=' + (Q $script) + ' -unattended -nosplash -nop4 -NoSound -abslog=' + (Q $log)) $TimeoutSec
if (-not (Test-Path $resFile)) { throw "villager import wrote no result (exit $($r.ExitCode)); see $log" }
$res = Get-Content $resFile -Raw | ConvertFrom-Json
Say "villager import: ok=$($res.ok), exit=$($r.ExitCode), wall=$($r.Seconds)s"
if (-not $res.ok) { throw "villager import failed: $($res.error)" }
foreach ($c in $res.characters.PSObject.Properties) {
  Say "$($c.Name): $($c.Value.mesh), $($c.Value.materialSlots) slots ($($c.Value.meshState))"
}
Say "showcase: $($res.showcase)"
