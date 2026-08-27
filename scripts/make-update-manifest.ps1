param(
  [Parameter(Mandatory = $true)][string]$Tag,
  [string]$Repo = "thangdggr0004-cpu/PCCarePro",
  [string]$Notes = "",
  [string]$BundleDir = ""
)

$ErrorActionPreference = "Stop"

if (-not $BundleDir) {
  $BundleDir = Join-Path $PSScriptRoot "..\src-tauri\target\release\bundle\nsis"
}

$setup = Get-ChildItem (Join-Path $BundleDir "*_x64-setup.exe") -ErrorAction Stop |
  Sort-Object LastWriteTime | Select-Object -Last 1
if (-not $setup) { throw "No NSIS setup found in $BundleDir" }

$sigFile = "$($setup.FullName).sig"
if (-not (Test-Path $sigFile)) { throw "Missing signature: $sigFile. Build with TAURI_SIGNING_PRIVATE_KEY + TAURI_SIGNING_PRIVATE_KEY_PASSWORD set." }

$version = $setup.BaseName -replace '^PCCareMasterPro_', '' -replace '_x64-setup$', ''
$sig = (Get-Content $sigFile -Raw).Trim()

$manifest = @{
  version = $version
  notes   = $Notes
  pub_date = (Get-Date).ToUniversalTime().ToString("o")
  platforms = @{
    "windows-x86_64" = @{
      signature = $sig
      url       = "https://github.com/$Repo/releases/download/$Tag/$(Split-Path $setup -Leaf)"
    }
  }
}

$out = Join-Path $BundleDir "latest.json"
$manifest | ConvertTo-Json -Depth 5 | Set-Content -Path $out -Encoding utf8
Write-Output "Wrote $out (version=$version)"