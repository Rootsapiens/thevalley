<#
.SYNOPSIS
  Copies the engine's own First Person template (BP only) into the project: WASD + mouse look character.
.DESCRIPTION
  From <engine>\Templates\TP_FirstPersonBP and its shared packs (TemplateResources\High):
    Content\FirstPerson\{Blueprints,Anims}  ->  /Game/FirstPerson   (BP_FirstPersonGameMode / Character / Controller)
    Input\Content                           ->  /Game/Input         (IMC_Default, IA_Move, IA_Look, IA_Jump ...)
    Characters\Content                      ->  /Game/Characters    (Manny arms, ABP_Unarmed)
  Epic content bundled with the engine, used under the UE EULA (logged in CREDITS.md). Not Valve, not Half-Life.
  Skips files already present (use -Force to overwrite). Engine-free: a plain file copy.
#>
param([switch]$Force)
. (Join-Path $PSScriptRoot 'ov_env.ps1')
$eng = Get-OvEngine
$T = Join-Path $eng.Root 'Templates'
$Content = Join-Path $ProjDir 'Content'
$pairs = @(
  @((Join-Path $T 'TP_FirstPersonBP\Content\FirstPerson\Blueprints'), (Join-Path $Content 'FirstPerson\Blueprints')),
  @((Join-Path $T 'TP_FirstPersonBP\Content\FirstPerson\Anims'), (Join-Path $Content 'FirstPerson\Anims')),
  @((Join-Path $T 'TemplateResources\High\Input\Content'), (Join-Path $Content 'Input')),
  @((Join-Path $T 'TemplateResources\High\Characters\Content'), (Join-Path $Content 'Characters'))
)
$n = 0
foreach ($p in $pairs) {
  if (-not (Test-Path $p[0])) { throw "template folder missing: $($p[0]) (install 'Templates and Feature Packs' in the Launcher)" }
  Get-ChildItem $p[0] -Recurse -File | ForEach-Object {
    $dst = Join-Path $p[1] $_.FullName.Substring($p[0].Length).TrimStart('\')
    if ($Force -or -not (Test-Path $dst)) {
      New-Item -ItemType Directory -Force -Path (Split-Path $dst) | Out-Null
      Copy-Item $_.FullName $dst -Force
      $n++
    }
  }
}
Say "first-person template: $n files copied into $Content ($(MB (Join-Path $Content 'Characters')) MB Characters)"
