<#
  Shared setup, dot-sourced by every runner:  . (Join-Path $PSScriptRoot 'ov_env.ps1')
  The UE project lives in the mirror  %USERPROFILE%\OVUnreal\unreal\OmegaValley  (Unreal cannot save packages under
  Desktop on this machine). The git repo (src\, public\art, studio\, CREDITS.md) stays at  Desktop\OmegaValley.
    $Repo      git repo root            (override: $env:OV_REPO)
    $Proj      .uproject that is built  (override: $env:OV_UPROJECT; default: the mirror if it exists)
    $UDir      <...>\unreal next to $Proj (data\, scripts\)
  Launched from the repo copy of the scripts while the mirror exists: scripts\, data\, Config\ and the .uproject are
  copied repo -> mirror first, so the copy you launch is the copy that runs. sync_mirror.ps1 copies them back.
#>
$ErrorActionPreference = 'Stop'
$Inv = [Globalization.CultureInfo]::InvariantCulture
$HereUnreal = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$MirrorUnreal = Join-Path $env:USERPROFILE 'OVUnreal\unreal'

function Say([string]$m) { Write-Host ("[ov] " + $m) }
function Q([string]$s) { '"' + $s + '"' }
function F([double]$v, [int]$d = 1) { $v.ToString("F$d", $Inv) }
function MB([string]$path) {
  if (-not (Test-Path $path)) { return $null }
  $b = (Get-ChildItem $path -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
  [math]::Round([double]$b / 1MB, 1)
}

function Find-Repo {
  foreach ($c in @($env:OV_REPO, (Split-Path $HereUnreal), (Join-Path $env:USERPROFILE 'Desktop\OmegaValley'))) {
    if ($c -and (Test-Path (Join-Path $c 'package.json'))) { return (Resolve-Path $c).Path }
  }
  throw 'git repo not found (package.json): set $env:OV_REPO'
}
$Repo = Find-Repo
$env:OV_REPO = $Repo

if ($env:OV_UPROJECT) { $Proj = $env:OV_UPROJECT }
elseif (Test-Path (Join-Path $MirrorUnreal 'OmegaValley\OmegaValley.uproject')) { $Proj = Join-Path $MirrorUnreal 'OmegaValley\OmegaValley.uproject' }
else { $Proj = Join-Path $HereUnreal 'OmegaValley\OmegaValley.uproject' }
$ProjDir = Split-Path $Proj
$UDir = Split-Path $ProjDir
$Saved = Join-Path $ProjDir 'Saved'
$Scripts = Join-Path $UDir 'scripts'
$DataDir = Join-Path $UDir 'data'
$Map = '/Game/OmegaValley/Maps/BarnSlice'
New-Item -ItemType Directory -Force -Path (Join-Path $Saved 'Logs') | Out-Null

# Launched from the repo copy while the project is the mirror: push this copy's scripts/data/config to the mirror.
if ((Resolve-Path $HereUnreal).Path -ne (Resolve-Path $UDir).Path) {
  Say "scripts launched from $HereUnreal; syncing them to the project at $UDir"
  foreach ($d in 'scripts', 'data') {
    New-Item -ItemType Directory -Force -Path (Join-Path $UDir $d) | Out-Null
    Get-ChildItem (Join-Path $HereUnreal $d) -File | Where-Object { $_.Extension -ne '.pyc' } | Copy-Item -Destination (Join-Path $UDir $d) -Force
  }
  Copy-Item (Join-Path $HereUnreal 'OmegaValley\Config\*.ini') (Join-Path $ProjDir 'Config') -Force
  Copy-Item (Join-Path $HereUnreal 'OmegaValley\OmegaValley.uproject') $Proj -Force
}

# Runs an engine process with a hard timeout. $Until (optional) is polled; when it returns $true the process is stopped.
function Invoke-Engine([string]$Exe, [string]$ArgLine, [int]$Timeout, [scriptblock]$Until = $null) {
  Say ("> " + (Split-Path $Exe -Leaf) + " " + $ArgLine)
  $p = Start-Process -FilePath $Exe -ArgumentList $ArgLine -PassThru -WindowStyle Normal
  $null = $p.Handle                                      # keeps ExitCode readable after exit
  $sw = [Diagnostics.Stopwatch]::StartNew()
  $why = 'exit'
  while (-not $p.HasExited) {
    Start-Sleep -Seconds 2
    if ($Until -and (& $Until)) { $why = 'done'; Say 'done, closing'; Start-Sleep -Seconds 3; if (-not $p.HasExited) { $p.Kill() }; break }
    if ($sw.Elapsed.TotalSeconds -gt $Timeout) { $why = 'timeout'; Say "timeout after $Timeout s, killing"; $p.Kill(); break }
  }
  $p.WaitForExit()
  [pscustomobject]@{ Seconds = [math]::Round($sw.Elapsed.TotalSeconds, 1); ExitCode = $p.ExitCode; End = $why }
}

function Get-OvEngine { & (Join-Path $PSScriptRoot 'find_engine.ps1') -Project $Proj | Select-Object -Last 1 }

# The -game runs of an installed engine write Saved\ under %LOCALAPPDATA%\UnrealEngine\<major.minor> (seen on 5.8.3).
function Saved-Dirs($eng) {
  $v = ($eng.Version -split '\.')[0..1] -join '.'
  @($Saved, (Join-Path $env:LOCALAPPDATA "UnrealEngine\$v\Saved")) | Where-Object { Test-Path $_ }
}
