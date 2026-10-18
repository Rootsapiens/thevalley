<#
.SYNOPSIS
  One command for the UE5 barn-slice trial: find engine -> export JSON -> build level -> warm-up -> perf + screenshot
  -> studio\reports\tariq-ue-trial.md.
.DESCRIPTION
  1. find_engine.ps1: newest UE 5.x, writes EngineAssociation into OmegaValley.uproject.
  2. node scripts\export-village-json.mjs (read-only on src\) -> unreal\data\village-barn.json.
  3. UnrealEditor-Cmd -run=pythonscript -script=build_barn_level.py (falls back to the full editor with
     -ExecutePythonScript if the commandlet cannot open levels on this engine version).
  4. Warm-up game run (compiles and caches shaders), then one measured run per scalability level:
     -game, VSync off, -csvCaptureFrames, -ExecCmds "stat unit, HighResShot". It looks through OV_OpeningCam.
  5. Writes the report (numbers only, <= 12 lines) and copies the screenshot to studio\stills\ue-trial-barn-dusk.png.
  Optional -Npcs: after step 3, runs run_npcs.ps1 (export-npcs.ts + place_npcs.py) so the NPCs are in the level.
  Never installs, signs in or accepts licences. Touches nothing outside unreal\, studio\reports, studio\stills.
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File unreal\scripts\run_trial.ps1
  powershell -ExecutionPolicy Bypass -File unreal\scripts\run_trial.ps1 -SkipBuild -Scalability 2 -ScreenPercentage 67
  powershell -ExecutionPolicy Bypass -File unreal\scripts\run_trial.ps1 -Package     # also cook + package, for build size
  powershell -ExecutionPolicy Bypass -File unreal\scripts\run_trial.ps1 -Npcs        # also place the village NPCs
#>
[CmdletBinding()]
param(
  [int]$Frames = 1200,
  [int]$ResX = 1920,
  [int]$ResY = 1080,
  [int[]]$Scalability = @(3, 2),      # 3 = Epic, 2 = High (Lumen needs >= 2)
  [int]$ScreenPercentage = 100,
  [int]$TimeoutSec = 900,            # level build
  [int]$WarmupTimeoutSec = 2400,     # the first shader compile on an iGPU laptop can take 20-40 min
  [switch]$SkipExport,
  [switch]$SkipBuild,
  [switch]$SkipWarmup,
  [switch]$Package,
  [switch]$Npcs,                     # also place the village NPCs (run_npcs.ps1) before the game runs
  [ValidateSet('Commandlet', 'Editor')][string]$BuildMode = 'Commandlet'
)
$ErrorActionPreference = 'Stop'
$Inv = [Globalization.CultureInfo]::InvariantCulture

$Repo    = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$Proj    = Join-Path $Repo 'unreal\OmegaValley\OmegaValley.uproject'
$ProjDir = Split-Path $Proj
$Saved   = Join-Path $ProjDir 'Saved'
$Map     = '/Game/OmegaValley/Maps/BarnSlice'
$Report  = Join-Path $Repo 'studio\reports\tariq-ue-trial.md'
$Still   = Join-Path $Repo 'studio\stills\ue-trial-barn-dusk.png'
$Json    = Join-Path $Repo 'unreal\data\village-barn.json'
New-Item -ItemType Directory -Force -Path (Join-Path $Saved 'Logs') | Out-Null

function Say([string]$m) { Write-Host ("[run_trial] " + $m) }
function Q([string]$s) { '"' + $s + '"' }
function MB([string]$path) {
  if (-not (Test-Path $path)) { return $null }
  $b = (Get-ChildItem $path -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
  [math]::Round([double]$b / 1MB, 1)
}
function F([double]$v, [int]$d = 1) { $v.ToString("F$d", $Inv) }

# Runs an engine process with a hard timeout. $Until (optional) is polled; when it returns $true the process is stopped.
function Invoke-Engine([string]$Exe, [string]$ArgLine, [int]$Timeout, [scriptblock]$Until = $null) {
  Say ("> " + (Split-Path $Exe -Leaf) + " " + $ArgLine)
  $p = Start-Process -FilePath $Exe -ArgumentList $ArgLine -PassThru -WindowStyle Normal
  $null = $p.Handle                                      # keeps ExitCode readable after exit
  $sw = [Diagnostics.Stopwatch]::StartNew()
  while (-not $p.HasExited) {
    Start-Sleep -Seconds 2
    if ($Until -and (& $Until)) { Say 'capture complete, closing'; Start-Sleep -Seconds 3; if (-not $p.HasExited) { $p.Kill() }; break }
    if ($sw.Elapsed.TotalSeconds -gt $Timeout) { Say "timeout after $Timeout s, killing"; $p.Kill(); break }
  }
  $p.WaitForExit()
  [pscustomobject]@{ Seconds = [math]::Round($sw.Elapsed.TotalSeconds, 1); ExitCode = $p.ExitCode }
}

# ---------- 1. Engine ----------
$eng = & (Join-Path $PSScriptRoot 'find_engine.ps1') -Project $Proj | Select-Object -Last 1

# ---------- 2. Export the barn slice ----------
$exportSec = $null
if (-not $SkipExport) {
  if (Get-Command node -ErrorAction SilentlyContinue) {
    $sw = [Diagnostics.Stopwatch]::StartNew()
    & node (Join-Path $Repo 'scripts\export-village-json.mjs') $Json
    if ($LASTEXITCODE -ne 0) { throw 'export-village-json.mjs failed' }
    $exportSec = [math]::Round($sw.Elapsed.TotalSeconds, 1)
  } elseif (-not (Test-Path $Json)) { throw 'node not found and unreal\data\village-barn.json missing' }
  else { Say 'node not found: using the committed village-barn.json' }
}

# ---------- 3. Build the level ----------
$resultFile = Join-Path $Saved 'ov_build_result.json'
$build = $null
if (-not $SkipBuild) {
  $script = Join-Path $PSScriptRoot 'build_barn_level.py'
  $env:OV_DATA = $Json
  $modes = if ($BuildMode -eq 'Commandlet') { @('Commandlet', 'Editor') } else { @('Editor') }
  foreach ($mode in $modes) {
    if (Test-Path $resultFile) { Remove-Item $resultFile }
    $log = Join-Path $Saved "Logs\ov_build_$mode.log"
    if ($mode -eq 'Commandlet') {
      $r = Invoke-Engine $eng.EditorCmd ((Q $Proj) + " -run=pythonscript -script=" + (Q $script) + " -unattended -nosplash -nop4 -NoSound -abslog=" + (Q $log)) $TimeoutSec
    } else {
      $wrap = Join-Path $Saved 'ov_build_and_quit.py'
      $code = "import runpy, unreal`ntry:`n    runpy.run_path(r'$script', run_name='__ov__')`nfinally:`n    unreal.SystemLibrary.quit_editor()`n"
      [IO.File]::WriteAllText($wrap, $code, (New-Object System.Text.UTF8Encoding($false)))
      $r = Invoke-Engine $eng.Editor ((Q $Proj) + " -ExecutePythonScript=" + (Q $wrap) + " -unattended -nosplash -nop4 -NoSound -abslog=" + (Q $log)) $TimeoutSec
    }
    if (Test-Path $resultFile) {
      $build = Get-Content $resultFile -Raw | ConvertFrom-Json
      $build | Add-Member -NotePropertyName WallSeconds -NotePropertyValue $r.Seconds -Force
      $build | Add-Member -NotePropertyName Mode -NotePropertyValue $mode -Force
      if ($build.ok) { break }
      Say ("build ($mode) reported a problem: " + $build.error)
    } else { Say "build ($mode) wrote no result; see $log" }
  }
  if (-not $build -or -not $build.ok) { throw "Level build failed. Logs: $Saved\Logs\ov_build_*.log" }
  Say ("level built: {0} actors, {1} s in script, {2} s wall ({3})" -f $build.actors, $build.seconds, $build.WallSeconds, $build.Mode)
}

# ---------- 3b. Optional: village NPCs ----------
if ($Npcs) {
  $npcArgs = @{ TimeoutSec = $TimeoutSec; BuildMode = $BuildMode }
  if ($SkipExport) { $npcArgs.SkipExport = $true }
  & (Join-Path $PSScriptRoot 'run_npcs.ps1') @npcArgs
}

# ---------- 4. Warm-up + measured runs ----------
$csvDir = Join-Path $Saved 'Profiling\CSV'
$shotDir = Join-Path $Saved 'Screenshots'
function New-Csv([datetime]$since) {
  if (-not (Test-Path $csvDir)) { return $null }
  Get-ChildItem $csvDir -Filter *.csv -File | Where-Object { $_.LastWriteTime -gt $since } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
}
function Game-Args([int]$sg, [int]$frames, [bool]$shot) {
  $cmds = @('t.MaxFPS 0', 'r.VSync 0', "scalability $sg", "r.ScreenPercentage $ScreenPercentage", 'stat unit')
  if ($shot) { $cmds += "HighResShot ${ResX}x${ResY}" }
  (Q $Proj) + " $Map -game -windowed -ResX=$ResX -ResY=$ResY -nosplash -unattended -nop4 -NoSound -NoVerifyGC -log" +
    " -csvCaptureFrames=$frames -csvExitOnCompletion -ExecCmds=" + (Q ($cmds -join ','))
}
function Run-Game([int]$sg, [int]$frames, [bool]$shot, [string]$tag) {
  $since = Get-Date
  # Stop once the CSV has been quiet for 30 s (in case this engine version ignores -csvExitOnCompletion).
  $until = { $c = New-Csv $since; $c -and ((Get-Date) - $c.LastWriteTime).TotalSeconds -gt 30 }
  $limit = if ($tag -eq 'warmup') { $WarmupTimeoutSec } else { 300 + [int]($frames / 10) }
  $r = Invoke-Engine $eng.Editor ((Game-Args $sg $frames $shot) + " -abslog=" + (Q (Join-Path $Saved "Logs\ov_game_$tag.log"))) $limit $until
  [pscustomobject]@{ Since = $since; Seconds = $r.Seconds; Csv = (New-Csv $since) }
}
function Read-Perf($csvFile) {
  if (-not $csvFile) { return $null }
  $lines = @(Get-Content $csvFile.FullName)
  if ($lines.Count -lt 3) { return $null }
  $hdr = $lines[0].Split(',') | ForEach-Object { $_.Trim() }
  $col = @{}
  foreach ($n in 'FrameTime', 'GameThreadTime', 'RenderThreadTime', 'GPUTime') { $col[$n] = [array]::IndexOf($hdr, $n) }
  if ($col['FrameTime'] -lt 0) { return $null }
  $rows = New-Object System.Collections.Generic.List[double[]]
  foreach ($l in $lines[1..($lines.Count - 1)]) {
    $c = $l.Split(','); $v = New-Object double[] 4; $ok = $true; $i = 0
    foreach ($n in 'FrameTime', 'GameThreadTime', 'RenderThreadTime', 'GPUTime') {
      $x = 0.0
      if ($col[$n] -ge 0 -and $col[$n] -lt $c.Count -and [double]::TryParse($c[$col[$n]], [Globalization.NumberStyles]::Float, $Inv, [ref]$x)) { $v[$i] = $x }
      elseif ($n -eq 'FrameTime') { $ok = $false }
      $i++
    }
    if ($ok) { $rows.Add($v) }
  }
  $skip = [int]($rows.Count * 0.1)                       # drop the first 10 % (load hitches)
  $use = $rows | Select-Object -Skip $skip
  if (-not $use) { return $null }
  $ft = @($use | ForEach-Object { $_[0] } | Sort-Object)
  $avg = { param($k) ($use | ForEach-Object { $_[$k] } | Measure-Object -Average).Average }
  $mean = & $avg 0
  [pscustomobject]@{
    Frames = $ft.Count; Fps = 1000.0 / $mean; FrameMs = $mean
    P95 = $ft[[int][math]::Floor(0.95 * ($ft.Count - 1))]; P99 = $ft[[int][math]::Floor(0.99 * ($ft.Count - 1))]
    GameMs = (& $avg 1); RenderMs = (& $avg 2); GpuMs = (& $avg 3)
  }
}

$warm = $null
if (-not $SkipWarmup) { Say 'warm-up run (shader compile + cache)'; $warm = Run-Game $Scalability[0] 600 $false 'warmup' }
$runs = @()
$first = $true
foreach ($sg in $Scalability) {
  Say "measured run, scalability $sg"
  $g = Run-Game $sg $Frames $first "sg$sg"
  $runs += [pscustomobject]@{ Sg = $sg; Perf = (Read-Perf $g.Csv); Since = $g.Since; Csv = $g.Csv }
  if ($first) {
    $shot = if (Test-Path $shotDir) { Get-ChildItem $shotDir -Recurse -Filter *.png -File | Where-Object { $_.LastWriteTime -gt $g.Since } | Sort-Object LastWriteTime -Descending | Select-Object -First 1 }
    if ($shot) { Copy-Item $shot.FullName $Still -Force }
  }
  $first = $false
}

# ---------- 5. Optional package (build size) ----------
$pkgMB = $null; $pkgSec = $null
if ($Package) {
  $out = Join-Path $Repo 'unreal\build'
  $sw = [Diagnostics.Stopwatch]::StartNew()
  & cmd /c ((Q $eng.RunUAT) + " BuildCookRun -project=" + (Q $Proj) + " -noP4 -platform=Win64 -clientconfig=Shipping -cook -map=$Map" +
    " -stage -pak -iostore -compressed -archive -archivedirectory=" + (Q $out) + " -unattended -utf8output -nocompileeditor")
  $pkgSec = [math]::Round($sw.Elapsed.TotalSeconds, 0)
  if ($LASTEXITCODE -eq 0) { $pkgMB = MB $out } else { Say "BuildCookRun failed ($LASTEXITCODE)" }
}

# ---------- 6. Report (numbers only, <= 12 lines) ----------
$gpu = (Get-CimInstance Win32_VideoController | Select-Object -First 1).Name
$ramGB = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 0)
$lines = @()
$lines += "# Tariq: UE5 trial, barn slice ($(Get-Date -Format 'yyyy-MM-dd HH:mm'))"
$lines += "- UE $($eng.Version) | $gpu | $ramGB GB RAM | ${ResX}x${ResY} windowed, VSync off, screen % $ScreenPercentage"
foreach ($r in $runs) {
  $name = @{ 0 = 'Low'; 1 = 'Medium'; 2 = 'High'; 3 = 'Epic'; 4 = 'Cinematic' }[$r.Sg]
  if ($r.Perf) {
    $p = $r.Perf; $pass = if ($p.Fps -ge 60) { 'PASS' } else { 'FAIL' }
    $lines += "- $name (sg $($r.Sg)): $(F $p.Fps) fps avg | p95 $(F $p.P95) ms | 1% low $(F (1000.0 / $p.P99)) fps | game $(F $p.GameMs) / render $(F $p.RenderMs) / GPU $(F $p.GpuMs) ms | $($p.Frames) frames | 60 fps $pass"
  } else { $lines += "- $name (sg $($r.Sg)): no CSV captured (see Saved\Logs\ov_game_sg$($r.Sg).log)" }
}
if ($build) {
  $lines += "- Level rebuild from JSON: $($build.seconds) s script, $($build.WallSeconds) s incl. editor start | $($build.actors) actors | JSON export $exportSec s"
  $lc = $build.landmark
  $lines += "- Landmark shrine: expected (2255, -3730) cm, got ($($lc.shrineCm[0]), $($lc.shrineCm[1])) | sun pitch/yaw $($lc.sunPitchYaw[0]) / $($lc.sunPitchYaw[1]) (expect -4 / -30)"
}
if ($warm) { $lines += "- Warm-up run (shader compile): $($warm.Seconds) s" }
$webMB = MB (Join-Path $Repo 'dist')
$ueMB = (MB (Join-Path $ProjDir 'Content')) + (MB (Join-Path $ProjDir 'Config'))
$pk = if ($pkgMB) { "$pkgMB MB packaged Win64 Shipping ($pkgSec s)" } else { 'package not run (-Package)' }
$lines += "- Size: UE Content+Config $ueMB MB | $pk | web dist $webMB MB"
$lines += "- Screenshot: " + $(if (Test-Path $Still) { 'studio/stills/ue-trial-barn-dusk.png (frame 1 after warm-up)' } else { 'none captured' })
$lines = $lines | Select-Object -First 12
[IO.File]::WriteAllText($Report, (($lines -join "`r`n") + "`r`n"), (New-Object System.Text.UTF8Encoding($false)))
Say "report: $Report"
$lines | ForEach-Object { Write-Host $_ }
