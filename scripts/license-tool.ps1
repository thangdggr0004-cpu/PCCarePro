# =====================================================================
# license-tool.ps1 - Cong cu noi bo tao va quan ly License PCCareMasterPro
#
# Cach dung:
#   1. Tao cap khoa ky moi (chi lam 1 lan ban dau):
#      .\scripts\license-tool.ps1 -GenerateKey
#
#   2. Xuat file license cho khach hang:
#      .\scripts\license-tool.ps1 -Customer "Nguyen Van A"
#      .\scripts\license-tool.ps1 -Customer "Cong Ty TNHH ABC" -Out "D:\Licenses\ABC.lic"
# =====================================================================

param(
  [switch]$GenerateKey,
  [string]$Customer,
  [string]$Out,
  [string]$Type = "lifetime",
  [string]$Notes = "Ban quyen vinh vien - Thien Phat Tech"
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$src  = Join-Path $root "src-tauri"

Push-Location $src
try {
  if ($GenerateKey) {
    Write-Host "[*] Dang tao cap khoa ky Ed25519 cho License..." -ForegroundColor Cyan
    cargo run --bin licgen -- generate-key
  } elseif ($Customer) {
    Write-Host "[*] Dang xuat license cho: $Customer ..." -ForegroundColor Cyan
    $cargoArgs = @("run", "--bin", "licgen", "--", "issue", "--customer", $Customer, "--type", $Type, "--notes", $Notes)
    if ($Out) {
      $cargoArgs += @("--out", $Out)
    }
    & cargo $cargoArgs
  } else {
    Write-Host "PCCareMasterPro License Tool" -ForegroundColor Yellow
    Write-Host "Cu phap:"
    Write-Host "  .\scripts\license-tool.ps1 -Customer ""Nguyen Van A"" [-Out ""pccare.lic""]"
    Write-Host "  .\scripts\license-tool.ps1 -GenerateKey"
  }
} finally {
  Pop-Location
}
