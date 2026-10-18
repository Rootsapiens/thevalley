<#
.SYNOPSIS
  Finds the newest installed Unreal Engine 5.x and writes its version into OmegaValley.uproject (EngineAssociation).
.DESCRIPTION
  Read-only on the engine: it never installs, signs in or accepts anything. Search order:
    1. $env:UE_ROOT (an engine root folder, e.g. D:\Epic\UE_5.6)
    2. Epic Games Launcher install list: C:\ProgramData\Epic\UnrealEngineLauncher\LauncherInstalled.dat
    3. Registry: HKLM:\SOFTWARE\EpicGames\Unreal Engine\<version>  (InstalledDirectory)
    4. Folders named UE_5.* under "<drive>:\Program Files\Epic Games" and "<drive>:\Epic Games" on every fixed drive
  An install counts only if Engine\Binaries\Win64\UnrealEditor-Cmd.exe exists.
  Returns an object: Root, Version (e.g. 5.6.1), Association (e.g. 5.6), Editor, EditorCmd, RunUAT, Project.
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File unreal\scripts\find_engine.ps1
  powershell -ExecutionPolicy Bypass -File unreal\scripts\find_engine.ps1 -NoWrite   # only report
#>
[CmdletBinding()]
param(
  [string]$Project = (Join-Path $PSScriptRoot '..\OmegaValley\OmegaValley.uproject'),
  [string]$Version = '',      # pin a version, e.g. 5.6 (default: newest 5.x found)
  [switch]$NoWrite
)
$ErrorActionPreference = 'Stop'

function Get-EngineVersion([string]$root) {
  $bv = Join-Path $root 'Engine\Build\Build.version'
  if (Test-Path $bv) {
    $j = Get-Content $bv -Raw | ConvertFrom-Json
    return [version]("{0}.{1}.{2}" -f $j.MajorVersion, $j.MinorVersion, $j.PatchVersion)
  }
  $m = [regex]::Match((Split-Path $root -Leaf), 'UE_(\d+)\.(\d+)')
  if ($m.Success) { return [version]("{0}.{1}.0" -f $m.Groups[1].Value, $m.Groups[2].Value) }
  return $null
}

$roots = New-Object System.Collections.Generic.List[string]
if ($env:UE_ROOT) { $roots.Add($env:UE_ROOT) }

$dat = Join-Path $env:ProgramData 'Epic\UnrealEngineLauncher\LauncherInstalled.dat'
if (Test-Path $dat) {
  try {
    foreach ($i in (Get-Content $dat -Raw | ConvertFrom-Json).InstallationList) {
      if ($i.AppName -like 'UE_5*' -and $i.InstallLocation) { $roots.Add($i.InstallLocation) }
    }
  } catch { Write-Verbose "LauncherInstalled.dat unreadable: $_" }
}

foreach ($hive in 'HKLM:\SOFTWARE\EpicGames\Unreal Engine', 'HKLM:\SOFTWARE\WOW6432Node\EpicGames\Unreal Engine') {
  if (Test-Path $hive) {
    foreach ($k in Get-ChildItem $hive -ErrorAction SilentlyContinue) {
      $d = (Get-ItemProperty $k.PSPath -ErrorAction SilentlyContinue).InstalledDirectory
      if ($d) { $roots.Add($d) }
    }
  }
}

foreach ($drv in (Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Root -match '^[A-Z]:\\$' })) {
  foreach ($base in 'Program Files\Epic Games', 'Epic Games') {
    $p = Join-Path $drv.Root $base
    if (Test-Path $p) {
      foreach ($d in Get-ChildItem $p -Directory -Filter 'UE_5*' -ErrorAction SilentlyContinue) { $roots.Add($d.FullName) }
    }
  }
}

$found = @()
foreach ($r in ($roots | Select-Object -Unique)) {
  $cmd = Join-Path $r 'Engine\Binaries\Win64\UnrealEditor-Cmd.exe'
  if (-not (Test-Path $cmd)) { continue }
  $v = Get-EngineVersion $r
  if (-not $v -or $v.Major -ne 5) { continue }
  $found += [pscustomobject]@{
    Root        = (Resolve-Path $r).Path
    Version     = $v.ToString()
    Association = "{0}.{1}" -f $v.Major, $v.Minor
    Editor      = Join-Path $r 'Engine\Binaries\Win64\UnrealEditor.exe'
    EditorCmd   = $cmd
    RunUAT      = Join-Path $r 'Engine\Build\BatchFiles\RunUAT.bat'
    Project     = $null
  }
}
if ($Version) { $found = @($found | Where-Object { $_.Association -eq $Version -or $_.Version -eq $Version }) }
if (-not $found -or $found.Count -eq 0) {
  throw ("No Unreal Engine 5.x found. Install it from the Epic Games Launcher (see unreal\README.md), " +
    "or set `$env:UE_ROOT to the engine folder (the one that contains Engine\Binaries).")
}
$eng = $found | Sort-Object { [version]$_.Version } -Descending | Select-Object -First 1

$proj = (Resolve-Path $Project).Path
$eng.Project = $proj
if (-not $NoWrite) {
  $text = [IO.File]::ReadAllText($proj)
  $new = [regex]::Replace($text, '"EngineAssociation"\s*:\s*"[^"]*"', ('"EngineAssociation": "{0}"' -f $eng.Association))
  if ($new -ne $text) {
    $null = $new | ConvertFrom-Json        # still valid JSON before writing
    [IO.File]::WriteAllText($proj, $new, (New-Object System.Text.UTF8Encoding($false)))
    Write-Host ("find_engine: EngineAssociation -> {0}" -f $eng.Association)
  }
}
Write-Host ("find_engine: UE {0} at {1}" -f $eng.Version, $eng.Root)
$eng
