<#
.SYNOPSIS
  Play the barn slice: opening dolly (8 s), then first person. WASD move, mouse look, Space jump, Esc / Alt+F4 quit.
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File play.ps1                 # editor binary in -game mode, 1600x900 window
  powershell -ExecutionPolicy Bypass -File play.ps1 -Packaged       # the packaged build from run_trial.ps1 -Package
  powershell -ExecutionPolicy Bypass -File play.ps1 -Quality 2 -ScreenPercentage 67   # High, 67 % (faster on Iris Xe)
#>
param([switch]$Packaged, [int]$Quality = 2, [int]$ScreenPercentage = 67, [int]$ResX = 1600, [int]$ResY = 900, [switch]$Fullscreen)
. (Join-Path $PSScriptRoot 'ov_env.ps1')
$win = if ($Fullscreen) { '-fullscreen' } else { "-windowed -ResX=$ResX -ResY=$ResY" }
$cmds = "scalability $Quality,r.ScreenPercentage $ScreenPercentage"
if ($Packaged) {
  $exe = Get-ChildItem (Join-Path $UDir 'build') -Recurse -Filter 'OmegaValley.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $exe) { throw 'no packaged build: run run_trial.ps1 -SkipExport -SkipBuild -SkipStills -SkipPerf -Package' }
  Start-Process $exe.FullName -ArgumentList "$win -ExecCmds=`"$cmds`""
} else {
  $eng = Get-OvEngine
  Start-Process $eng.Editor -ArgumentList ((Q $Proj) + " $Map -game $win -nosplash -ExecCmds=`"$cmds`"")
}
Say 'started: opening dolly, then WASD + mouse look'
