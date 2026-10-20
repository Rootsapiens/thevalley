<#
.SYNOPSIS
  Full village blockout in UE: export (node, read-only on src\) -> build_village.py -> /Game/OmegaValley/Maps/Village.
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File run_village.ps1
  powershell -ExecutionPolicy Bypass -File run_village.ps1 -SkipExport
#>
param([switch]$SkipExport, [int]$TimeoutSec = 2400)
. (Join-Path $PSScriptRoot 'ov_env.ps1')
$eng = Get-OvEngine
if (-not $SkipExport) {
  $repoData = Join-Path $Repo 'unreal\data'
  & node (Join-Path $Repo 'scripts\export-village-json.mjs') (Join-Path $repoData 'village-barn.json')
  if ($LASTEXITCODE -ne 0) { throw 'export-village-json.mjs failed' }
  if ($repoData -ne $DataDir) { Copy-Item (Join-Path $repoData 'village-*') $DataDir -Force }
}
$res = Join-Path $Saved 'ov_village_result.json'
if (Test-Path $res) { Remove-Item $res }
$log = Join-Path $Saved 'Logs\ov_village.log'
$r = Invoke-Engine $eng.EditorCmd ((Q $Proj) + " -run=pythonscript -script=" + (Q (Join-Path $Scripts 'build_village.py')) +
  " -unattended -nosplash -nop4 -NoSound -abslog=" + (Q $log)) $TimeoutSec
if (-not (Test-Path $res)) { throw "village build wrote no result; see $log" }
$v = Get-Content $res -Raw | ConvertFrom-Json
Say ("village: ok={0} {1} actors {2} s script / {3} s wall | terrain err {4} cm | tower {5}" -f $v.ok, $v.actors, $v.seconds, $r.Seconds, $v.terrain.maxErrCm, ($v.tower.got -join ','))
$v
