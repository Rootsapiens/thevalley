<#
.SYNOPSIS
  One command for the UE5 weapons and root bots: import guns -> weapon rig -> bot Blueprint -> BotArena + bots,
  then (optional) a hands-off game test.
.DESCRIPTION
  1. Headless commandlets (UnrealEditor-Cmd -run=pythonscript), one per script, in order:
       import_guns.py   4 Quaternius CC0 FBX -> /Game/OmegaValley/Weapons/Meshes (skipped when present)
       make_weapons.py  BP_OV_WeaponRig from data\weapons.json
       make_bots.py     BP_OV_RootBot from data\bots.json
       place_bots.py    /Game/OmegaValley/Maps/BotArena: arena, navmesh bounds, rig (OV_WEAPON), bots (OV_BOT)
     Results: Saved\ov_guns_result.json, ov_weapons_result.json, ov_bots_result.json, ov_place_bots_result.json.
  2. -Test: starts the editor binary in -game mode on BotArena with -ovautotest. The rig aims at the nearest bot,
     fires, cycles the three weapons, takes two screenshots and quits with a "[OV TEST] ... fps=..." line.
     Prints that line and the bot state changes; copies the screenshots to studio\stills\ue-bots-*.png.
  Never installs, signs in or accepts licences.
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File unreal\scripts\run_bots.ps1
  powershell -ExecutionPolicy Bypass -File unreal\scripts\run_bots.ps1 -SkipImport -Test
#>
[CmdletBinding()]
param(
  [int]$TimeoutSec = 900,
  [switch]$SkipImport,
  [switch]$Test,
  [int]$TestTimeoutSec = 900,
  [int]$Quality = 2,
  [int]$ScreenPercentage = 67
)
. (Join-Path $PSScriptRoot 'ov_env.ps1')     # $Repo, $Proj (mirror), $Scripts, $Saved, Invoke-Engine
$eng = Get-OvEngine

# ---------- 1. Build: one commandlet per step ----------
# One process per Blueprint: building a second Blueprint in the same editor session crashed 5.8.3 (GC after
# BlueprintGraphEditor use), so every step gets a fresh UnrealEditor-Cmd. About 10 s of script, 40 s of start-up each.
$steps = [ordered]@{ import_guns = 'ov_guns_result.json'; make_weapons = 'ov_weapons_result.json';
                     make_bots = 'ov_bots_result.json'; place_bots = 'ov_place_bots_result.json' }
if ($SkipImport) { $steps.Remove('import_guns') }
foreach ($name in $steps.Keys) {
  $resFile = Join-Path $Saved $steps[$name]
  if (Test-Path $resFile) { Remove-Item $resFile }
  $log = Join-Path $Saved "Logs\ov_$name.log"
  $r = Invoke-Engine $eng.EditorCmd ((Q $Proj) + " -run=pythonscript -script=" + (Q (Join-Path $Scripts "$name.py")) + " -unattended -nosplash -nop4 -NoSound -abslog=" + (Q $log)) $TimeoutSec
  if (-not (Test-Path $resFile)) { throw "$name wrote no result (exit $($r.ExitCode)); see $log" }
  $res = Get-Content $resFile -Raw | ConvertFrom-Json
  Say ("{0}: ok {1}, exit {2}, {3} s script, {4} s wall" -f $name, $res.ok, $r.ExitCode, $res.seconds, $r.Seconds)
  if (-not $res.ok) { throw "$name failed: $($res.error)" }
}
$pb = Get-Content (Join-Path $Saved 'ov_place_bots_result.json') -Raw | ConvertFrom-Json
Say ("BotArena: {0} bots; landmark {1} feet ({2}) cm, expected ({3}), err {4} cm" -f $pb.bots, $pb.landmark.id, ($pb.landmark.feetCm -join ', '), ($pb.landmark.expectedCm -join ', '), $pb.landmark.errCm)
if (-not $Test) { return }

# ---------- 2. Hands-off game test ----------
$glog = Join-Path $Saved 'Logs\ov_bots_game.log'
if (Test-Path $glog) { Remove-Item $glog }
$start = Get-Date
$cmds = "scalability $Quality,r.ScreenPercentage $ScreenPercentage"
$args2 = (Q $Proj) + " /Game/OmegaValley/Maps/BotArena -game -windowed -ResX=1280 -ResY=720 -nosplash -NoSound -ovautotest -ExecCmds=`"$cmds`" -abslog=" + (Q $glog)
$g = Invoke-Engine $eng.Editor $args2 $TestTimeoutSec { (Test-Path $glog) -and (Select-String -Path $glog -Pattern '\[OV TEST\] seconds=' -Quiet) }
$sum = Select-String -Path $glog -Pattern '\[OV TEST\] seconds=.*' | Select-Object -Last 1
if (-not $sum) { throw "game test gave no [OV TEST] summary ($($g.End), exit $($g.ExitCode)); see $glog" }
Say ($sum.Matches[0].Value + " | Scalability $Quality, $ScreenPercentage %, 1280x720, exit $($g.ExitCode), $($g.Seconds) s wall")
Select-String -Path $glog -Pattern '\[OV BOT\] .* -> [A-Z]+' | ForEach-Object { ($_.Line -replace '^.*\[OV BOT\]', '[OV BOT]') } |
  Group-Object { ($_ -split ' -> ')[1] -replace ' .*$', '' } | ForEach-Object { Say ("state {0}: {1} entries" -f $_.Name, $_.Count) }
$shots = foreach ($d in (Saved-Dirs $eng)) { Get-ChildItem (Join-Path $d 'Screenshots') -Recurse -Filter *.png -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -gt $start } }
$i = 0
foreach ($s in ($shots | Sort-Object LastWriteTime)) {
  $i++
  $dst = Join-Path $Repo ("studio\stills\ue-bots-{0}.png" -f $i)
  Copy-Item $s.FullName $dst -Force
  Say "screenshot -> $dst"
}
if ($i -eq 0) { Say 'no screenshot found (HighResShot)' }
