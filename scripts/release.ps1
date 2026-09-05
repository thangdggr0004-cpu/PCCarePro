# Release PCCareMasterPro (portable) - auto-update via GitHub Releases API (SIMPLIFIED).
#
# Script nay thay the moi qua trinh publish phuc tap truoc kia.
# KHONG can: signing key, password, latest.json, GitHub Pages, gh-pages branch.
# Chi can: build + tao GitHub Release + upload exe.
#
# App tu dong nhan ban moi bang cach goi:
#   https://api.github.com/repos/thangdggr0004-cpu/PCCarePro/releases/latest
# (dua tren tag_name + asset pccare-master-pro.exe)
#
# Cach dung:
#   powershell -ExecutionPolicy Bypass -File .\scripts\release.ps1            # tu dong +1 patch (2.0.5 -> 2.0.6)
#   powershell -ExecutionPolicy Bypass -File .\scripts\release.ps1 -Version 2.1.0   # chi dinh version tu do
#   powershell -ExecutionPolicy Bypass -File .\scripts\release.ps1 -Notes "mo ta"   # ghi ghi chu release
#
# Luu y: NEEDS `gh` da login (token scope `repo`).

param(
  [string]$Version,                 # neu bo trong -> tu dong +1 patch tu version hien tai
  [string]$Notes   = "",            # ghi chu release (bo trong -> tu dong tao)
  [string]$Repo    = "thangdggr0004-cpu/PCCarePro",
  [switch]$KeepVersion               # khong bump version, dung version hien tai trong conf
)

$ErrorActionPreference = "Stop"

$root = Split-Path $PSScriptRoot -Parent
$src  = Join-Path $root "src-tauri"
$confFile = Join-Path $src "tauri.conf.json"
$pkgFile  = Join-Path $root "package.json"
$cargoFile = Join-Path $src "Cargo.toml"
$exe = Join-Path $src "target\release\pccare-master-pro.exe"

# ── 1) Xac dinh version ───────────────────────────────
$conf = Get-Content $confFile -Raw | ConvertFrom-Json
$curVersion = $conf.version

if ($Version -and -not $KeepVersion) {
  if (-not $Version -match '^\d+\.\d+\.\d+$') { throw "Version khong hop le (phai la x.y.z): $Version" }
} elseif ($KeepVersion) {
  $Version = $curVersion
} else {
  # tu dong +1 patch: 2.0.5 -> 2.0.6
  $parts = $curVersion.Split('.')
  $Version = "{0}.{1}.{2}" -f $parts[0], $parts[1], ([int]$parts[2] + 1)
}

Write-Host "Version hien tai: $curVersion" -ForegroundColor Cyan
Write-Host "Version se release: $Version" -ForegroundColor Green

if ($Version -eq $curVersion -and -not $KeepVersion) {
  throw "Version moi ($Version) trung voi hien tai. Dung -Version hoac -KeepVersion."
}

$tag = "v$Version"

# ── 2) Ghi version vao 3 file ─────────────────────────
# tauri.conf.json + package.json: "version": "x.y.z",
$confOld  = '"version"' + '\s*:\s*' + '"[^"]*"'
$confNew  = '"version": "' + $Version + '"'
$confRaw = Get-Content $confFile -Raw
$confRaw = $confRaw -replace $confOld, $confNew
[System.IO.File]::WriteAllText($confFile, $confRaw, [System.Text.UTF8Encoding]::new($false))

$pkgRaw = Get-Content $pkgFile -Raw
$pkgRaw = $pkgRaw -replace $confOld, $confNew
[System.IO.File]::WriteAllText($pkgFile, $pkgRaw, [System.Text.UTF8Encoding]::new($false))

# Cargo.toml: ^version = "x.y.z"
$cargoOld = '(?m)^version\s*=\s*"' + '[^"]*' + '"'
$cargoNew = 'version = "' + $Version + '"'
$cargoRaw = Get-Content $cargoFile -Raw
$cargoRaw = $cargoRaw -replace $cargoOld, $cargoNew
[System.IO.File]::WriteAllText($cargoFile, $cargoRaw, [System.Text.UTF8Encoding]::new($false))

Write-Host "Da cap nhat version -> $Version o tauri.conf.json, package.json, Cargo.toml" -ForegroundColor Gray

# Xac minh conf ghi dung
$confCheck = (Get-Content $confFile -Raw | ConvertFrom-Json).version
if ($confCheck -ne $Version) { throw "Loi khi ghi version vao conf. Dung lai." }

# ── 3) Build release ──────────────────────────────────
Write-Host "`n[build] Build release $Version ..." -ForegroundColor Cyan
Push-Location $src
cargo tauri build --no-bundle
if ($LASTEXITCODE -ne 0) { throw "Build failed (exit $LASTEXITCODE)" }
Pop-Location

if (-not (Test-Path $exe)) { throw "Khong tim thay exe sau build: $exe" }
$sizeMB = [math]::Round((Get-Item $exe).Length/1MB, 2)
Write-Host "Exe: $exe ($sizeMB MB)" -ForegroundColor Green

# ── 4) Tao / cap nhat GitHub Release ──────────────────
if (-not $Notes) { $Notes = "PCCareMasterPro v$Version - portable auto-update" }

Write-Host "`n[release] Tao release $tag ..." -ForegroundColor Cyan
$exists = $null
try { $exists = gh release view "$tag" --repo "$Repo" 2>$null } catch { }
if ($exists) {
  Write-Host "  release $tag da ton tai -> upload lai asset." -ForegroundColor Gray
  gh release upload "$tag" "$exe" --repo "$Repo" --clobber
  if ($LASTEXITCODE -ne 0) { throw "gh release upload failed (exit $LASTEXITCODE)" }
  gh release edit "$tag" --repo "$Repo" --title "$tag (portable)" --notes $Notes --latest
  if ($LASTEXITCODE -ne 0) { throw "gh release edit failed (exit $LASTEXITCODE)" }
} else {
  gh release create "$tag" "$exe" --repo "$Repo" --title "$tag (portable)" --notes $Notes --latest
  if ($LASTEXITCODE -ne 0) { throw "gh release create failed (exit $LASTEXITCODE)" }
}

# ── 5) Xac minh GitHub API (nhung gi app se goi) ──────
Write-Host "`n[verify] Kiem tra GitHub API (app se goi endpoint nay) ..." -ForegroundColor Cyan
Start-Sleep -Seconds 3
$r = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest" -Headers @{"User-Agent"="PCCareMasterPro"} -TimeoutSec 20
Write-Host "  tag_name        = $($r.tag_name)   (ky vong $tag)"
Write-Host "  asset name      = $($r.assets[0].name)"
$assetUrl = $r.assets | Where-Object { $_.name -eq "pccare-master-pro.exe" } | Select-Object -First 1 -ExpandProperty browser_download_url
Write-Host "  download url    = $assetUrl"

Write-Host "`nDONE. Release: https://github.com/$Repo/releases/tag/$tag" -ForegroundColor Green
Write-Host "App tu dong nhan ban moi qua GitHub Releases API. KHONG can latest.json / signing." -ForegroundColor Gray
