<#
.SYNOPSIS
  Renders LS_Stills (PNG) and/or LS_OpeningDolly (JPG) with Movie Render Queue, then copies the stills to
  <repo>\studio\stills\ue-<camera>.png (last frame of each 45-frame cut) and three dolly frames to ue-dolly-*.jpg.
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File render_mrq.ps1                 # stills + dolly
  powershell -ExecutionPolicy Bypass -File render_mrq.ps1 -Jobs stills    # stills only (look iteration)
#>
param([string]$Jobs = 'stills,dolly', [int]$TimeoutSec = 3600, [string]$Resolution = '1920x1080')
. (Join-Path $PSScriptRoot 'ov_env.ps1')
$eng = Get-OvEngine
$result = Join-Path $Saved 'ov_mrq_result.json'
if (Test-Path $result) { Remove-Item $result }
$env:OV_MRQ_JOBS = $Jobs
$env:OV_MRQ_RES = $Resolution
$log = Join-Path $Saved 'Logs\ov_mrq.log'
$r = Invoke-Engine $eng.Editor ((Q $Proj) + " $Map -ExecutePythonScript=" + (Q (Join-Path $Scripts 'render_mrq.py')) +
  " -unattended -nosplash -nop4 -NoSound -NoLiveCoding -abslog=" + (Q $log)) $TimeoutSec { Test-Path $result }
if (-not (Test-Path $result)) { throw "MRQ wrote no result ($($r.End) after $($r.Seconds) s); see $log" }
$res = Get-Content $result -Raw | ConvertFrom-Json
$stillDir = Join-Path $Repo 'studio\stills'
New-Item -ItemType Directory -Force -Path $stillDir | Out-Null
$copied = @()
if ($res.jobs.stills -and $res.jobs.stills.frames -gt 0) {
  $idx = Get-Content (Join-Path $Saved 'ov_stills.json') -Raw | ConvertFrom-Json
  foreach ($p in $idx.lastFrame.PSObject.Properties) {
    $src = Join-Path $res.jobs.stills.dir ('LS_Stills.{0:D4}.png' -f [int]$p.Value)
    $name = 'ue-' + ($p.Name -replace '^(OV_|Still_)', '').ToLower() + '.png'
    if (Test-Path $src) { Copy-Item $src (Join-Path $stillDir $name) -Force; $copied += "studio/stills/$name" }
  }
}
if ($res.jobs.village -and $res.jobs.village.frames -gt 0) {
  $idx = Get-Content (Join-Path $Saved 'ov_village_stills.json') -Raw | ConvertFrom-Json
  foreach ($p in $idx.lastFrame.PSObject.Properties) {
    $src = Join-Path $res.jobs.village.dir ('LS_VillageStills.{0:D4}.png' -f [int]$p.Value)
    $name = 'ue-village-' + ($p.Name -replace '^VStill_', '').ToLower() + '.png'
    if (Test-Path $src) { Copy-Item $src (Join-Path $stillDir $name) -Force; $copied += "studio/stills/$name" }
  }
}
if ($res.jobs.dolly -and $res.jobs.dolly.frames -gt 0) {
  foreach ($f in 0, 120, 239) {
    $src = Join-Path $res.jobs.dolly.dir ('LS_OpeningDolly.{0:D4}.jpeg' -f $f)
    if (Test-Path $src) { $n = 'ue-dolly-{0:D3}.jpg' -f $f; Copy-Item $src (Join-Path $stillDir $n) -Force; $copied += "studio/stills/$n" }
  }
}
$res | Add-Member -NotePropertyName Copied -NotePropertyValue $copied -Force
$res | Add-Member -NotePropertyName WallSeconds -NotePropertyValue $r.Seconds -Force
$res | ConvertTo-Json -Depth 5 | Set-Content $result -Encoding UTF8
Say ("MRQ ok={0} in {1} s wall; copied: {2}" -f $res.ok, $r.Seconds, ($copied -join ', '))
$res
