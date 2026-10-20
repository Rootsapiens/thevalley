<#
.SYNOPSIS
  One command for the UE5 barn-slice trial: export JSON -> template -> build level -> MRQ stills (= shader warm-up)
  -> perf runs -> <repo>\studio\reports\tariq-ue-trial.md (numbers only, <= 12 lines).
.DESCRIPTION
  Project: the mirror %USERPROFILE%\OVUnreal\unreal\OmegaValley (see ov_env.ps1). Repo: Desktop\OmegaValley.
  1. find_engine.ps1: newest UE 5.x.
  2. node <repo>\scripts\export-village-json.mjs (read-only on src\) -> <repo>\unreal\data\village-barn.json, copied to the project's data\.
  3. install_fp_template.ps1 (engine First Person template, WASD + mouse look), then
     UnrealEditor-Cmd -run=pythonscript -script=build_barn_level.py (textures, materials, level, LS_OpeningDolly, LS_Stills).
  4. render_mrq.ps1: Movie Render Queue stills + dolly. MRQ waits for every shader, so this is also the warm-up.
  5. Perf: one -game run per config (default Epic/High x 100/67 %), VSync off, -csvCaptureFrames. The first 15 s of each
     capture are dropped (level load + the 8 s opening dolly); the view is then the player's at the spawn (opening framing).
  6. Optional -Package: RunUAT BuildCookRun Win64 Shipping -> unreal\build (size + seconds).
  Never installs, signs in or accepts licences.
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File run_trial.ps1
  powershell -ExecutionPolicy Bypass -File run_trial.ps1 -SkipExport -SkipBuild -SkipStills -Configs 2:67
#>
[CmdletBinding()]
param(
  [int]$Frames = 1500,
  [int]$ResX = 1920,
  [int]$ResY = 1080,
  [string]$Configs = '3:100,2:100,3:67,2:67',   # scalability:screen-percentage, comma list (3 Epic, 2 High)
  [double]$SkipSeconds = 15,
  [int]$TimeoutSec = 1800,
  [switch]$SkipExport,
  [switch]$SkipBuild,
  [switch]$SkipStills,
  [switch]$SkipPerf,
  [switch]$Package,
  [string]$MrqJobs = 'stills,dolly'
)
. (Join-Path $PSScriptRoot 'ov_env.ps1')
$Report = Join-Path $Repo 'studio\reports\tariq-ue-trial.md'
$Json = Join-Path $DataDir 'village-barn.json'
$eng = Get-OvEngine
$state = Join-Path $Saved 'ov_trial_state.json'      # numbers from earlier steps survive -Skip* re-runs
$S = if (Test-Path $state) { Get-Content $state -Raw | ConvertFrom-Json } else { [pscustomobject]@{} }
function Keep([string]$k, $v) { $S | Add-Member -NotePropertyName $k -NotePropertyValue $v -Force; $S | ConvertTo-Json -Depth 6 | Set-Content $state -Encoding UTF8 }

# ---------- 2. Export ----------
if (-not $SkipExport) {
  $sw = [Diagnostics.Stopwatch]::StartNew()
  $repoJson = Join-Path $Repo 'unreal\data\village-barn.json'
  & node (Join-Path $Repo 'scripts\export-village-json.mjs') $repoJson
  if ($LASTEXITCODE -ne 0) { throw 'export-village-json.mjs failed' }
  if ($repoJson -ne $Json) { Copy-Item $repoJson $Json -Force }
  Keep 'exportSec' ([math]::Round($sw.Elapsed.TotalSeconds, 1))
}

# ---------- 3. Template + build ----------
if (-not $SkipBuild) {
  & (Join-Path $PSScriptRoot 'install_fp_template.ps1')
  $resultFile = Join-Path $Saved 'ov_build_result.json'
  if (Test-Path $resultFile) { Remove-Item $resultFile }
  $env:OV_DATA = $Json
  $log = Join-Path $Saved 'Logs\ov_build.log'
  $r = Invoke-Engine $eng.EditorCmd ((Q $Proj) + " -run=pythonscript -script=" + (Q (Join-Path $Scripts 'build_barn_level.py')) +
    " -unattended -nosplash -nop4 -NoSound -abslog=" + (Q $log)) $TimeoutSec
  if (-not (Test-Path $resultFile)) { throw "build wrote no result; see $log" }
  $b = Get-Content $resultFile -Raw | ConvertFrom-Json
  if (-not $b.ok) { throw ("build failed: " + $b.error) }
  $b | Add-Member -NotePropertyName WallSeconds -NotePropertyValue $r.Seconds -Force
  Keep 'build' $b
  Say ("level built: {0} actors, {1} s script, {2} s wall" -f $b.actors, $b.seconds, $r.Seconds)
}

# ---------- 4. Stills (MRQ) ----------
if (-not $SkipStills) {
  $m = & (Join-Path $PSScriptRoot 'render_mrq.ps1') -Jobs $MrqJobs | Select-Object -Last 1
  Keep 'mrq' $m
}

# ---------- 5. Perf ----------
function New-Csv([datetime]$since) {
  $dirs = Saved-Dirs $eng | ForEach-Object { Join-Path $_ 'Profiling\CSV' } | Where-Object { Test-Path $_ }
  if (-not $dirs) { return $null }
  Get-ChildItem $dirs -Filter *.csv -File | Where-Object { $_.LastWriteTime -gt $since -and $_.Length -gt 0 } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
}
function Read-Perf($csvFile) {
  if (-not $csvFile -or $csvFile.Length -eq 0) { return $null }
  $lines = @(Get-Content $csvFile.FullName)
  if ($lines.Count -lt 3) { return $null }
  $hdr = $lines[0].Split(',') | ForEach-Object { $_.Trim() }
  $names = 'FrameTime', 'GameThreadTime', 'RenderThreadTime', 'GPUTime'
  $col = @{}; foreach ($n in $names) { $col[$n] = [array]::IndexOf($hdr, $n) }
  if ($col['FrameTime'] -lt 0) { return $null }
  $rows = New-Object System.Collections.Generic.List[double[]]
  foreach ($l in $lines[1..($lines.Count - 1)]) {
    $c = $l.Split(','); $v = New-Object double[] 4; $i = 0; $ok = $true
    foreach ($n in $names) {
      $x = 0.0
      if ($col[$n] -ge 0 -and $col[$n] -lt $c.Count -and [double]::TryParse($c[$col[$n]], [Globalization.NumberStyles]::Float, $Inv, [ref]$x)) { $v[$i] = $x }
      elseif ($n -eq 'FrameTime') { $ok = $false }
      $i++
    }
    if ($ok) { $rows.Add($v) }
  }
  $t = 0.0; $use = New-Object System.Collections.Generic.List[double[]]
  foreach ($v in $rows) { $t += $v[0] / 1000.0; if ($t -gt $SkipSeconds) { $use.Add($v) } }
  if ($use.Count -lt 30) { return $null }
  $ft = @($use | ForEach-Object { $_[0] } | Sort-Object)
  $avg = { param($k) ($use | ForEach-Object { $_[$k] } | Measure-Object -Average).Average }
  $q = { param($p) $ft[[int][math]::Floor($p * ($ft.Count - 1))] }
  [pscustomobject]@{ Frames = $ft.Count; Fps = 1000.0 / (& $avg 0); P50 = (& $q 0.5); P95 = (& $q 0.95); P99 = (& $q 0.99)
    GameMs = (& $avg 1); RenderMs = (& $avg 2); GpuMs = (& $avg 3); Csv = $csvFile.FullName }
}
if (-not $SkipPerf) {
  $perf = @()
  foreach ($cfg in ($Configs -split '[,\s]+' | Where-Object { $_ })) {
    $sg, $sp = $cfg.Split(':') | ForEach-Object { [int]$_ }
    $since = Get-Date
    $cmds = @('t.MaxFPS 0', 'r.VSync 0', "scalability $sg", "r.ScreenPercentage $sp")
    $tag = "sg${sg}_sp${sp}"
    $a = (Q $Proj) + " $Map -game -windowed -ResX=$ResX -ResY=$ResY -nosplash -unattended -nop4 -NoSound -NoVerifyGC -log" +
      " -csvCaptureFrames=$Frames -csvExitOnCompletion -ExecCmds=" + (Q ($cmds -join ',')) + " -abslog=" + (Q (Join-Path $Saved "Logs\ov_game_$tag.log"))
    # -csvExitOnCompletion does not quit this build, so stop once the log says the CSV is written.
    $glog = Join-Path $Saved "Logs\ov_game_$tag.log"
    if (Test-Path $glog) { Remove-Item $glog -Force }      # an old log already says "CSV finalize time"
    # The CSV file is created empty at start and filled when the capture ends ("CSV finalize time" in the log).
    $r = Invoke-Engine $eng.Editor $a (600 + [int]($Frames / 5)) { (Test-Path $glog) -and (Select-String -Path $glog -Pattern "CSV finalize time" -Quiet) }
    $p = Read-Perf (New-Csv $since)
    $perf += [pscustomobject]@{ Sg = $sg; Sp = $sp; Perf = $p; Seconds = $r.Seconds }
    if ($p) { Say ("{0}: {1} fps avg, p50 {2} ms, p95 {3} ms, GPU {4} ms" -f $tag, (F $p.Fps), (F $p.P50), (F $p.P95), (F $p.GpuMs)) } else { Say "${tag}: no CSV" }
  }
  # Merge with earlier runs: a -Configs subset only replaces the configs it measured.
  $old = @(@($S.perf) | Where-Object { $o = $_; $o -and -not ($perf | Where-Object { $_.Sg -eq $o.Sg -and $_.Sp -eq $o.Sp }) })
  Keep 'perf' (@($old) + @($perf) | Sort-Object @{e = { - [int]$_.Sg } }, @{e = { - [int]$_.Sp } })
}

# ---------- 6. Package ----------
if ($Package) {
  $out = Join-Path $UDir 'build'
  $sw = [Diagnostics.Stopwatch]::StartNew()
  & cmd /c ((Q $eng.RunUAT) + " BuildCookRun -project=" + (Q $Proj) + " -noP4 -platform=Win64 -clientconfig=Shipping -cook -map=$Map" +
    " -stage -pak -iostore -compressed -archive -archivedirectory=" + (Q $out) + " -unrealexe=" + (Q $eng.EditorCmd) + " -unattended -utf8output -nodebuginfo" +
    " > " + (Q (Join-Path $Saved 'Logs\ov_package.log')) + " 2>&1")
  $ok = $LASTEXITCODE -eq 0
  Keep 'package' ([pscustomobject]@{ ok = $ok; seconds = [math]::Round($sw.Elapsed.TotalSeconds, 0); mb = $(if ($ok) { MB $out } else { $null }); dir = $out })
  Say ("package: ok={0} {1} s {2} MB" -f $ok, $S.package.seconds, $S.package.mb)
}

# ---------- 7. Report (numbers only, <= 12 lines) ----------
$gpu = (Get-CimInstance Win32_VideoController | Select-Object -First 1).Name
$ramGB = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 0)
$L = @("# Tariq: UE5 trial, barn slice ($(Get-Date -Format 'yyyy-MM-dd HH:mm'))")
$others = @(Get-Process UnrealEditor -ErrorAction SilentlyContinue).Count
$L += "- UE $($eng.Version) | $gpu | $ramGB GB | ${ResX}x${ResY} windowed, VSync off, TSR | first $SkipSeconds s dropped | other UE editors open now: $others"
$nm = @{ 0 = 'Low'; 1 = 'Medium'; 2 = 'High'; 3 = 'Epic'; 4 = 'Cinematic' }
foreach ($x in @($S.perf)) {
  if (-not $x) { continue }
  $p = $x.Perf
  if ($p) { $L += "- $($nm[[int]$x.Sg]) $($x.Sp)%: $(F $p.Fps) fps avg | p50 $(F $p.P50) ms | p95 $(F $p.P95) ms | GPU $(F $p.GpuMs) / game $(F $p.GameMs) / render $(F $p.RenderMs) ms | $($p.Frames) frames | 60 fps $(if ($p.Fps -ge 60) {'PASS'} else {'FAIL'})" }
  else { $L += "- $($nm[[int]$x.Sg]) $($x.Sp)%: no CSV captured" }
}
if ($S.build) {
  $b = $S.build; $lc = $b.landmark
  $L += "- Rebuild from JSON: $($b.seconds) s script / $($b.WallSeconds) s wall | $($b.actors) actors | $($b.materials.textured) textured + $($b.materials.flat) flat materials | export $($S.exportSec) s"
  $L += "- Landmark shrine: expected (2255, -3730) cm, got ($($lc.shrineCm[0]), $($lc.shrineCm[1])) | sun pitch/yaw $($lc.sunPitchYaw[0]) / $($lc.sunPitchYaw[1]) (expect -4 / -30)"
}
$vr = Join-Path $Saved 'ov_village_result.json'
if (Test-Path $vr) {
  $v = Get-Content $vr -Raw | ConvertFrom-Json
  $L += "- Village map (run_village.ps1): ok $($v.ok) | $($v.actors) actors, $($v.seconds) s script | terrain bounds err $($v.terrain.maxErrCm) cm | tower got ($($v.tower.got -join ', ')) cm, expected (250, 2750) | stills studio/stills/ue-village-*.png"
}
if ($S.mrq) { $L += "- MRQ (incl. shader warm-up): $($S.mrq.WallSeconds) s wall | stills $($S.mrq.jobs.stills.frames) frames | dolly $($S.mrq.jobs.dolly.frames) frames" }
$ueMB = (MB (Join-Path $ProjDir 'Content')) + (MB (Join-Path $ProjDir 'Config'))
$pk = if ($S.package -and $S.package.ok) { "$($S.package.mb) MB packaged Win64 Shipping ($($S.package.seconds) s)" } else { 'package: not run / failed' }
$L += "- Size: UE Content+Config $ueMB MB | $pk | web dist $(MB (Join-Path $Repo 'dist')) MB"
if ($S.mrq -and $S.mrq.Copied) { $L += "- Stills: " + (@($S.mrq.Copied) -join ', ') }
$L = $L | Select-Object -First 12
[IO.File]::WriteAllText($Report, (($L -join "`r`n") + "`r`n"), (New-Object System.Text.UTF8Encoding($false)))
Say "report: $Report"
$L | ForEach-Object { Write-Host $_ }
