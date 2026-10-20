<# Imports only the six CC0 Ottoman figures already mapped to story-safe web NPC roles. #>
[CmdletBinding()]
param([int]$TimeoutSec = 900, [switch]$InspectOnly)
. (Join-Path $PSScriptRoot 'ov_env.ps1')
$eng = Get-OvEngine
$result = Join-Path $Saved 'ov_ottoman_npc_import_result.json'
if (Test-Path $result) { Remove-Item -LiteralPath $result }
$log = Join-Path $Saved 'Logs\ov_ottoman_npc_import.log'
$script = Join-Path $Scripts 'import_ottoman_npcs.py'
if ($InspectOnly) { $env:OV_OTTOMAN_INSPECT = '1' }
$r = Invoke-Engine $eng.EditorCmd ((Q $Proj) + ' -run=pythonscript -script=' + (Q $script) + ' -unattended -nosplash -nop4 -NoSound -abslog=' + (Q $log)) $TimeoutSec
Remove-Item Env:OV_OTTOMAN_INSPECT -ErrorAction SilentlyContinue
if (-not (Test-Path $result)) { throw "Ottoman NPC import wrote no result (exit $($r.ExitCode)); see $log" }
$res = Get-Content $result -Raw | ConvertFrom-Json
Say "Ottoman NPC import: ok=$($res.ok), exit=$($r.ExitCode), wall=$($r.Seconds)s"
if (-not $res.ok) { throw "Ottoman NPC import failed: $($res.error)" }
foreach ($character in $res.characters.PSObject.Properties) {
  $meshes = @($character.Value.assets | Where-Object { $_.class -eq 'SkeletalMesh' })
  $anims = @($character.Value.assets | Where-Object { $_.class -eq 'AnimSequence' })
  $skeletons = @($character.Value.assets | Where-Object { $_.class -eq 'Skeleton' })
  Say "$($character.Name): $($meshes.Count) skeletal parts, $($skeletons.Count) skeleton(s), $($anims.Count) animations"
  foreach ($mesh in @($meshes | Select-Object -First 2)) { Say "  $($mesh.path) half extents $($mesh.halfExtentCm -join ', ') cm" }
  Say "  clips: $(($anims | ForEach-Object { Split-Path $_.path -Leaf }) -join ', ')"
}
