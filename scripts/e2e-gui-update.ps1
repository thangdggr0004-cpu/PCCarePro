# E2E GUI test cho luong portable update (KHONG dung production).
#
# Muc dich: tao moi truong LOCAL de ban (user) chay that toan bo chu trinh GUI:
#   app 2.0.3 (lower, endpoint -> localhost) -> phat hien 2.0.4 -> tai -> xac minh
#   -> doi file .exe (.next -> exe) -> khoi dong lai thanh 2.0.4.
#
# KIEN TRUC HIEN TAI: updater dung portable custom flow (Rust hardcoded GitHub
# API endpoint). Script se:
#   1. Set env var PORTABLE_UPDATE_ENDPOINT de redirect check ve localhost.
#   2. Build OLD 2.0.3 (version trong tauri.conf.json).
#   3. Build NEW 2.0.4 (version trong tauri.conf.json).
#   4. Sign exe + tao latest.json (GhRelease format) + start local server.
#   5. Launch old exe voi env var PORTABLE_UPDATE_ENDPOINT -> no check localhost.
#
# KHONG chay lenh nay neu app dang build/chay. Script TAM THOI sua tauri.conf.json
# >=2 lan va tu khoi phuc lai FULL (ke ca khi loi), nen an toan cho working tree.
#
# Cach dung:  powershell -ExecutionPolicy Bypass -File .\scripts\e2e-gui-update.ps1
#
# Sau khi script xong no se in ra cac buoc bang tay de ban bam GUI.

$ErrorActionPreference = "Stop"

$root   = Split-Path $PSScriptRoot -Parent                        # repo root
$src    = Join-Path $root "src-tauri"
$conf   = Join-Path $src "tauri.conf.json"
$site   = Join-Path $env:TEMP "pccare-e2e-site"                    # local test server docroot
$port   = 8642
$endpoint = "http://127.0.0.1:$port/latest.json"

# --- 1) backup + save original config (full restore finally) ---
$orig = Get-Content $conf -Raw

function Reset-Config {
  [System.IO.File]::WriteAllText($conf, $orig, [System.Text.UTF8Encoding]::new($false))
}
try {
  function Set-TestConfig([string]$version) {
    $j = Get-Content $conf -Raw | ConvertFrom-Json
    $j.version = $version
    $j.bundle.active = $false
    ($j | ConvertTo-Json -Depth 10) | Set-Content $conf
  }

  # --- 2) build OLD app (2.0.3) pointing at localhost ---
  Write-Host "`n[1/4] Building OLD 2.0.3 (endpoint -> localhost)..." -ForegroundColor Cyan
  Set-TestConfig "2.0.3"
  Push-Location $src
  cargo tauri build --no-bundle
  if ($LASTEXITCODE -ne 0) { throw "Build OLD 2.0.3 failed (exit $LASTEXITCODE)" }
  Pop-Location
  $oldExe = Join-Path $src "target\release\pccare-master-pro.exe"
  $oldOut = Join-Path $env:TEMP "pccare-e2e-old"
  New-Item -ItemType Directory -Force -Path $oldOut | Out-Null
  Copy-Item $oldExe (Join-Path $oldOut "pccare-master-pro.exe") -Force

  # --- 3) build NEW app (2.0.4), sign, manifest, serve ---
  Write-Host "`n[2/4] Building NEW 2.0.4 (endpoint -> localhost)..." -ForegroundColor Cyan
  Set-TestConfig "2.0.4"
  Push-Location $src
  cargo tauri build --no-bundle
  if ($LASTEXITCODE -ne 0) { throw "Build NEW 2.0.4 failed (exit $LASTEXITCODE)" }
  Pop-Location
  $newExe = $oldExe   # same path, now 2.0.4

  Write-Host "`n[3/4] Signing new exe + writing latest.json..." -ForegroundColor Cyan
  New-Item -ItemType Directory -Force -Path $site | Out-Null
  Copy-Item $newExe (Join-Path $site "pccare-master-pro.exe") -Force
  # Load E2E signing key + password from .env.local (no interactive prompt).
  . (Join-Path $PSScriptRoot "load-signing-env.ps1")
  Connect-SigningKey -E2E
  cargo tauri signer sign "$site\pccare-master-pro.exe"
  if ($LASTEXITCODE -ne 0) { throw "Sign failed (exit $LASTEXITCODE)" }

  # tao latest.json trong GhRelease format (tag_name, body, assets) —
  # format ma Rust portable_update_check/download thuc su parse, KHONG phai
  # format Tauri plugin updater (platforms.windows-x86_64).
  $manifest = @{
    tag_name = "v2.0.4"
    body     = "E2E: build that v2.0.4, ky key production - hay click 'Tai & Cap Nhat'"
    assets   = @(@{
      name = "pccare-master-pro.exe"
      browser_download_url = "http://127.0.0.1:$port/pccare-master-pro.exe"
    })
  }
  ($manifest | ConvertTo-Json -Depth 5) | Set-Content (Join-Path $site "latest.json")

  # --- 4) start local server + launch old app voi env var ---
  Write-Host "`n[4/4] Starting local server http://127.0.0.1:$port ..." -ForegroundColor Cyan
  $server = Start-Process python -ArgumentList "-m","http.server","$port","--bind","127.0.0.1","--directory","$site" -PassThru -WindowStyle Hidden

  # Launch old exe voi PORTABLE_UPDATE_ENDPOINT de Rust code redirect check ve localhost.
  $oldExePath = Join-Path $oldOut "pccare-master-pro.exe"
  $env:PORTABLE_UPDATE_ENDPOINT = $endpoint
  Write-Host "`n  Launching old 2.0.3 app (PORTABLE_UPDATE_ENDPOINT=$endpoint)..." -ForegroundColor Cyan
  Start-Process $oldExePath

  Write-Host "`n======================================================" -ForegroundColor Green
  Write-Host "GUI E2E - thuc hien cac buoc sau:" -ForegroundColor Green
  Write-Host "  1. App OLD 2.0.3 se tu dong kiem tra ban moi sau ~5s" -ForegroundColor Yellow
  Write-Host "  2. Xuat hien banner 'Ban Cap Nhat Moi Co San' v2.0.4" -ForegroundColor Yellow
  Write-Host "  3. Bam 'Tai & Cap Nhat' -> thanh tien trinh chay -> 'Cap nhat thanh cong'" -ForegroundColor Yellow
  Write-Host "  4. Bam 'Tat App & Mo Ban Moi' -> app doi exe (~16s) va khoi dong lai" -ForegroundColor Yellow
  Write-Host "  5. Kiem tra: moi khoi dong, PHIEN BAN the hien v2.0.4 (cap nhat thanh cong)" -ForegroundColor Yellow
  Write-Host "     - 'Cung cap' button trong Dashboard: 'Khong co ban cap nhat moi hon'" -ForegroundColor Yellow
  Write-Host "======================================================" -ForegroundColor Green
  Write-Host "`nNhan ENTER de dung server va khoi phuc tauri.conf.json..." -ForegroundColor Cyan
  Read-Host | Out-Null
  if ($server -and -not $server.HasExited) { Stop-Process -Id $server.Id -Force }
} finally {
  # clean up env var
  Remove-Item Env:\PORTABLE_UPDATE_ENDPOINT -ErrorAction SilentlyContinue
  Reset-Config
  Write-Host "`ntauri.conf.json da duoc khoi phuc lai nguyen ban." -ForegroundColor Green
}
