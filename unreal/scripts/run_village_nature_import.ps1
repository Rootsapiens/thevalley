<# Imports and measures four CC0 Quaternius tree meshes; does not edit a level. #>
[CmdletBinding()]
param([int]$TimeoutSec = 900)
. (Join-Path $PSScriptRoot 'ov_env.ps1')
$eng = Get-OvEngine
$result = Join-Path $Saved 'ov_village_nature_import_result.json'
if (Test-Path $result) { Remove-Item -LiteralPath $result }
$log = Join-Path $Saved 'Logs\ov_village_nature_import.log'
$script = Join-Path $Scripts 'import_village_nature.py'
$r = Invoke-Engine $eng.EditorCmd ((Q $Proj) + ' -run=pythonscript -script=' + (Q $script) + ' -unattended -nosplash -nop4 -NoSound -abslog=' + (Q $log)) $TimeoutSec
if (-not (Test-Path $result)) { throw "nature import wrote no result (exit $($r.ExitCode)); see $log" }
$res = Get-Content $result -Raw | ConvertFrom-Json
Say "nature import: ok=$($res.ok), exit=$($r.ExitCode), wall=$($r.Seconds)s"
if (-not $res.ok) { throw "nature import failed: $($res.error)" }
foreach ($tree in $res.trees.PSObject.Properties) {
  Say "$($tree.Name): $($tree.Value.asset), half extents cm $($tree.Value.halfExtentCm -join ', '), triangles $($tree.Value.triangles)"
}
