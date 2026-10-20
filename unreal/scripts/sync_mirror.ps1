<#
.SYNOPSIS
  Copies the text side of the UE project between the mirror (the project Unreal builds) and the git repo.
  -ToRepo (default): mirror -> repo   (after working in %USERPROFILE%\OVUnreal\unreal)
  -ToMirror:         repo   -> mirror (after a git pull)
  Copies unreal\scripts\*.{py,ps1}, unreal\data\*.json, unreal\README.md, OmegaValley\Config\*.ini, OmegaValley.uproject.
  Never copies Content\, Saved\, Intermediate\, DerivedDataCache\, Binaries\ or build\ (binaries stay out of git; the
  scripts rebuild Content\ from the repo's data and art).
#>
param([switch]$ToMirror)
$Repo = if ($env:OV_REPO) { $env:OV_REPO } else { Join-Path $env:USERPROFILE 'Desktop\OmegaValley' }
$Mirror = Join-Path $env:USERPROFILE 'OVUnreal'
$src, $dst = if ($ToMirror) { $Repo, $Mirror } else { $Mirror, $Repo }
$n = 0
foreach ($spec in @(@('unreal\scripts', '*.py'), @('unreal\scripts', '*.ps1'), @('unreal\data', '*.json'), @('unreal', 'README.md'),
                    @('unreal\OmegaValley\Config', '*.ini'), @('unreal\OmegaValley', 'OmegaValley.uproject'))) {
  $from = Join-Path $src $spec[0]; $to = Join-Path $dst $spec[0]
  if (-not (Test-Path $from)) { continue }
  New-Item -ItemType Directory -Force -Path $to | Out-Null
  foreach ($f in Get-ChildItem $from -Filter $spec[1] -File) {
    $t = Join-Path $to $f.Name
    if (-not (Test-Path $t) -or (Get-FileHash $f.FullName).Hash -ne (Get-FileHash $t).Hash) { Copy-Item $f.FullName $t -Force; $n++; Write-Host "  $($spec[0])\$($f.Name)" }
  }
}
Write-Host "[sync] $n files $src -> $dst"
