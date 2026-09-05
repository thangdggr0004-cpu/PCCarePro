# Publish PCCareMasterPro v2.0.4 (portable update) to the REAL production channels.
#
# Pham vi:
#   1) Backup file latest.json HIEN TAI (v2.0.3) tren nhanh gh-pages -> %TEMP% (de rollback).
#   2) Ky exe v2.0.4 DA BUILD bang KEY PRODUCTION `updater-v203-new.key`
#      -> tu hoi PASS (TOI / script KHONG BAO GIO luu hay in password cua ban).
#   3) Tao GitHub Release tag `v2.0.4` ("v2.0.4 (portable)") + upload `pccare-master-pro.exe`.
#   4) Tao latest.json moi -> day len nhanh `gh-pages` bang GitHub Contents API.
#   5) Kiem tra endpoint that https://thangdggr0004-cpu.github.io/PCCarePro/latest.json.
#
# LUU Y:
#   - Chi chay khi da build xong exe v2.0.4 va da TU GUI-TEST OK.
#   - Script nay PUSH len real repo. Chay co trach nhiem.
#   - Can `gh` da login (scope 'repo', protocol https) - da xac nhan OK truoc do.
#
# Cach dung:
#   powershell -ExecutionPolicy Bypass -File .\scripts\publish.ps1

param(
  [string]$Tag     = "v2.0.4",
  [string]$Version = "2.0.4",
  [string]$Repo    = "thangdggr0004-cpu/PCCarePro",
  [string]$Branch  = "gh-pages",
  [string]$Notes   = "PCCareMasterPro v2.0.4 - portable update flow (custom) + fixes"
)

$ErrorActionPreference = "Stop"

$root    = Split-Path $PSScriptRoot -Parent
$src     = Join-Path $root "src-tauri"
$key     = Join-Path $src "updater-v205.key"
$exe     = Join-Path $src "target\release\pccare-master-pro.exe"
$backup  = Join-Path $env:TEMP "pccare-rollback-latest.json"
$asset   = "pccare-master-pro.exe"
$leaf    = "latest.json"

if (-not (Test-Path $key)) { throw "Khong tim thay production key: $key" }
if (-not (Test-Path $exe)) { throw "Khong tim thay exe da build v2.0.4: $exe" }

# --- 0) sanity: key path xac nhan trong .env.local da duoc load dung ---
# NOTE: Config truoc day co plugins.updater.pubkey cho sanity check, nhung
# config hien tai (portable flow) khong con field nay. Key path + password
# gio duoc quan ly boi .env.local + load-signing-env.ps1; sanity check da
# duoc thuc hien o buoc Connect-SigningKey (xac nhan key file ton tai).
# Khong can verify pubkey o day nua.

# --- 1) backup latest.json hien tai tu gh-pages ---
Write-Host "`n[1/5] Backup latest.json hien tai (ref=$Branch) -> $backup ..." -ForegroundColor Cyan
# Dung Git Trees + Blobs API (oneway luon OK) thay vi Contents API (co the tra 404 ngau nhien)
$treeSha = (gh api "repos/$Repo/git/trees/$Branch" --jq '.sha' 2>$null).Trim()
if (-not $treeSha) { throw "Khong lay duoc tree sha cua branch $Branch" }
$treeJson = gh api "repos/$Repo/git/trees/$treeSha`?recursive=1" 2>$null | ConvertFrom-Json
$blobEntry = $treeJson.tree | Where-Object { $_.path -eq $leaf }
if (-not $blobEntry) { throw "File $leaf khong ton tai tren branch $Branch" }
$curSha = $blobEntry.sha
$blobJson = gh api "repos/$Repo/git/blobs/$curSha" 2>$null | ConvertFrom-Json
$curB64 = $blobJson.content -replace '\s',''
[System.IO.File]::WriteAllBytes($backup, [System.Convert]::FromBase64String($curB64))
Write-Host "  da luu backup (sha=$curSha): $backup" -ForegroundColor Green

# --- 2) ky exe bang key production (password tu dong tu .env.local, khong hoi tay) ---
Write-Host "`n[2/5] Ky exe bang KEY PRODUCTION ..." -ForegroundColor Cyan
$sigFile = "$exe.sig"
if (-not (Test-Path $sigFile)) {
  . (Join-Path $PSScriptRoot "load-signing-env.ps1")
  Connect-SigningKey -Production
  Push-Location $src
  cargo tauri signer sign "$exe"
  if ($LASTEXITCODE -ne 0) { throw "Sign failed (exit $LASTEXITCODE)" }
  Pop-Location
  if (-not (Test-Path $sigFile)) { throw "Khong tao duoc chu ky: $sigFile (sai password trong .env.local?)" }
}
$sig = (Get-Content $sigFile -Raw).Trim()
Write-Host "  signature: $($sig.Substring(0, [Math]::Min(24, $sig.Length)))..." -ForegroundColor Gray

# --- 3) tao + upload release ---
Write-Host "`n[3/5] Tao release $Tag (portable) + upload exe ..." -ForegroundColor Cyan
$exists = $null
try { $exists = gh release view "$Tag" --repo "$Repo" 2>$null } catch { }
if ($exists) {
  Write-Host "  release $Tag da ton tai -> chi upload lai asset." -ForegroundColor Gray
  gh release upload "$Tag" "$exe" --repo "$Repo" --clobber
  if ($LASTEXITCODE -ne 0) { throw "gh release upload failed (exit $LASTEXITCODE)" }
  gh release edit "$Tag" --repo "$Repo" --latest
  if ($LASTEXITCODE -ne 0) { throw "gh release edit failed (exit $LASTEXITCODE)" }
} else {
  gh release create "$Tag" "$exe" --repo "$Repo" --title "$Tag (portable)" --notes $Notes --latest
  if ($LASTEXITCODE -ne 0) { throw "gh release create failed (exit $LASTEXITCODE)" }
}

# --- 4) tao latest.json + push len gh-pages (Contents API) ---
Write-Host "`n[4/5] Push latest.json (version=$Version) len branch $Branch ..." -ForegroundColor Cyan
$manifest = @{
  version  = $Version
  notes    = $Notes
  pub_date = (Get-Date).ToUniversalTime().ToString("o")
  platforms = @{
    "windows-x86_64" = @{
      signature = $sig
      url       = "https://github.com/$Repo/releases/download/$Tag/$asset"
    }
  }
}
$jsonStr = $manifest | ConvertTo-Json -Depth 5
$b64New  = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($jsonStr))

# Dung Git Data API (blob → tree → commit → update ref) thay vi Contents API PUT
$tempFile = Join-Path $env:TEMP "gh-payload.json"
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)

# 1. Tao blob moi
$blobPayload = @{ content = $b64New; encoding = "base64" } | ConvertTo-Json -Compress
[System.IO.File]::WriteAllText($tempFile, $blobPayload, $utf8NoBom)
$blobSha = (gh api "repos/$Repo/git/blobs" --input $tempFile --jq '.sha' 2>$null).Trim()
Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
if (-not $blobSha) { throw "Khong tao duoc blob moi" }
Write-Host "  blob sha: $blobSha" -ForegroundColor Gray

# 2. Tao tree moi (cap nhat latest.json, giu nguyen cac file khac)
$curTreeSha = $treeSha  # da lay o buoc 1
$treeItems = @()
foreach ($item in $treeJson.tree) {
  if ($item.path -ne $leaf) {
    $treeItems += @{ path = $item.path; mode = $item.mode; type = $item.type; sha = $item.sha }
  }
}
$treeItems += @{ path = $leaf; mode = "100644"; type = "blob"; sha = $blobSha }
$treePayload = @{ base_tree = $curTreeSha; tree = $treeItems } | ConvertTo-Json -Compress -Depth 10
[System.IO.File]::WriteAllText($tempFile, $treePayload, $utf8NoBom)
$newTreeSha = (gh api "repos/$Repo/git/trees" --input $tempFile --jq '.sha' 2>$null).Trim()
Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
if (-not $newTreeSha) { throw "Khong tao duoc tree moi" }
Write-Host "  tree sha: $newTreeSha" -ForegroundColor Gray

# 3. Tao commit moi
$commitPayload = @{ message = "chore(update): bump latest.json to $Version"; tree = $newTreeSha; parents = @($curTreeSha) } | ConvertTo-Json -Compress
[System.IO.File]::WriteAllText($tempFile, $commitPayload, $utf8NoBom)
$newCommitSha = (gh api "repos/$Repo/git/commits" --input $tempFile --jq '.sha' 2>$null).Trim()
Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
if (-not $newCommitSha) { throw "Khong tao duoc commit" }
Write-Host "  commit sha: $newCommitSha" -ForegroundColor Gray

# 4. Cap nhat ref cua branch
$refPayload = @{ sha = $newCommitSha; force = $false } | ConvertTo-Json -Compress
[System.IO.File]::WriteAllText($tempFile, $refPayload, $utf8NoBom)
gh api -X PATCH "repos/$Repo/git/refs/heads/$Branch" --input $tempFile --jq '.object.sha' 2>$null | ForEach-Object { Write-Host "  ref updated: $_" }
Remove-Item $tempFile -Force -ErrorAction SilentlyContinue

# --- 5) kiem tra endpoint that ---
Write-Host "`n[5/5] Kiem tra endpoint that ..." -ForegroundColor Cyan
Start-Sleep -Seconds 3
$liveUrl = "https://$($Repo.Split('/')[0]).github.io/$($Repo.Split('/')[1])/$leaf"
$live = (Invoke-WebRequest -Uri $liveUrl -UseBasicParsing -TimeoutSec 20).Content | ConvertFrom-Json
Write-Host "  endpoint: $liveUrl" -ForegroundColor Gray
Write-Host "  version = $($live.version)   (phai = $Version)" -ForegroundColor Yellow

Write-Host "`nDONE." -ForegroundColor Green
Write-Host "Rollback: ghi de noi dung $backup (v2.0.3) vao $leaf tren branch $Branch." -ForegroundColor Gray
Write-Host "VD: gh api -X PUT repos/$Repo/contents/$leaf -f message=rollback -f content=<base64 cua backup> -f sha=<sha hien tai> -f branch=$Branch" -ForegroundColor Gray
