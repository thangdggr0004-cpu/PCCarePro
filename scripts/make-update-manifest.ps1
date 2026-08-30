param(
  [Parameter(Mandatory = $true)][string]$Tag,
  [string]$Repo = "thangdggr0004-cpu/PCCarePro",
  [string]$Notes = "",
  [string]$BundleDir = "",
  [switch]$Portable
)

$ErrorActionPreference = "Stop"

if ($Portable) {
  if (-not $BundleDir) {
    $BundleDir = Join-Path $PSScriptRoot "..\src-tauri\target\release"
  }
  $artifact = Get-Item (Join-Path $BundleDir "pccare-master-pro.exe") -ErrorAction Stop
  $version = (Get-Content (Join-Path $PSScriptRoot "..\src-tauri\tauri.conf.json") -Raw | ConvertFrom-Json).version
} else {
  if (-not $BundleDir) {
    $BundleDir = Join-Path $PSScriptRoot "..\src-tauri\target\release\bundle\nsis"
  }
  $artifact = Get-ChildItem (Join-Path $BundleDir "*_x64-setup.exe") -ErrorAction Stop |
    Sort-Object LastWriteTime | Select-Object -Last 1
  if (-not $artifact) { throw "No NSIS setup found in $BundleDir" }
  $version = $artifact.BaseName -replace '^PCCareMasterPro_', '' -replace '_x64-setup$', ''
}

$sigFile = "$($artifact.FullName).sig"
if (-not (Test-Path $sigFile)) { throw "Missing signature: $sigFile. Build with TAURI_SIGNING_PRIVATE_KEY + TAURI_SIGNING_PRIVATE_KEY_PASSWORD set." }

$sig = (Get-Content $sigFile -Raw).Trim()

$manifest = @{
  version = $version
  notes   = $Notes
  pub_date = (Get-Date).ToUniversalTime().ToString("o")
  platforms = @{
    "windows-x86_64" = @{
      signature = $sig
      url       = "https://github.com/$Repo/releases/download/$Tag/$(Split-Path $artifact -Leaf)"
    }
  }
}

$out = Join-Path $BundleDir "latest.json"
$json = $manifest | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText($out, $json, [System.Text.UTF8Encoding]::new($false))
Write-Output "Wrote $out (version=$version)"