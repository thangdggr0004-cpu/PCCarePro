# =====================================================================
# load-signing-env.ps1 - loads signing secrets from the LOCAL config file
# `.env.local` (repo root) into the process environment, for scripted
# (passwordless) signing of the portable updater.
#
# SECURITY CONTRACT:
#   * NEVER prints, logs, or echoes any secret VALUE (password / key content).
#   * On success it prints only the key FILENAME (never the password).
#   * `.env.local` is gitignored and must NEVER be committed.
#
# USAGE (dot-source from build/release scripts):
#   . "$PSScriptRoot\load-signing-env.ps1"
#   Connect-SigningKey -Production        # sets env for scripts/publish.ps1
#   Connect-SigningKey -E2E               # sets env for scripts/e2e-gui-update.ps1
#
# The Tauri tooling reads these two env vars:
#   TAURI_SIGNING_PRIVATE_KEY_PATH
#   TAURI_SIGNING_PRIVATE_KEY_PASSWORD
# =====================================================================

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

function Get-SigningEnvFile {
  $root = Split-Path $PSScriptRoot -Parent
  return Join-Path $root ".env.local"
}

# Parse .env.local into a hashtable of KEY->VALUE (lowercased keys).
function Read-SigningEnv {
  param([string]$Path)
  $map = @{}
  if (-not (Test-Path -LiteralPath $Path)) { return $map }
  foreach ($line in [System.IO.File]::ReadAllLines($Path)) {
    $t = $line.Trim()
    if (-not $t) { continue }
    if ($t.StartsWith('#')) { continue }
    $eq = $t.IndexOf('=')
    if ($eq -le 0) { continue }
    $k = $t.Substring(0, $eq).Trim().ToLower()
    $v = $t.Substring($eq + 1).Trim()
    if (-not $map.ContainsKey($k)) { $map[$k] = $v }
  }
  return $map
}

# Set the two Tauri env vars for a given key path + password WITHOUT printing
# the password. Throws a clear (non-sensitive) message when missing/blank.
function Connect-SigningKey {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory = $false)][switch]$Production,
    [Parameter(Mandatory = $false)][switch]$E2E
  )

  $file = Get-SigningEnvFile
  if (-not (Test-Path -LiteralPath $file)) {
    throw "Thieu file cau hinh: $file`nTao file nay (xem huong dan trong @scripts/README hoac .env.local)."
  }

  $map = Read-SigningEnv -Path $file

  $pathKey = $null
  $passKey = $null
  if ($Production) {
    $pathKey = "tauri_signing_private_key_path"
    $passKey = "tauri_signing_private_key_password"
  } elseif ($E2E) {
    $pathKey = "e2e_signing_key_path"
    $passKey = "e2e_signing_key_password"
  } else {
    throw "Vui long truyen -Production hoac -E2E."
  }

  $keyPath = $null
  if ($map.ContainsKey($pathKey)) { $keyPath = $map[$pathKey] }
  $pass = $null
  if ($map.ContainsKey($passKey)) { $pass = $map[$passKey] }

  if (-not $keyPath) {
    throw "Cau hinh thieu '$pathKey' trong $file. Hay them dong: $($pathKey.ToUpper())=<ten file .key>"
  }
  # Normalize to an absolute path anchored at src-tauri (where the keys live).
  $src = Join-Path (Split-Path $PSScriptRoot -Parent) "src-tauri"
  $abs = $keyPath
  if (-not [System.IO.Path]::IsPathRooted($abs)) {
    $abs = Join-Path $src $keyPath
  }
  if (-not (Test-Path -LiteralPath $abs)) {
    throw "Khong tim thay key: $abs (ghi trong $file)."
  }

  # Do NOT leak the password even if it is blank-but-intended: require a value
  # unless the key file was created without encryption (rare). We cannot detect
  # that reliably here, so require the password var to be NON-BLANK to proceed
  # with signer. If a key is truly passwordless, set the var to "nopw".
  if ([string]::IsNullOrEmpty($pass)) {
    throw "Cau hinh '$passKey' dang RONG trong $file. Hay dien mat khau (hoac 'nopw' neu key khong co pass)."
  }

  # Resolve "nopw" sentinel to an empty password (matches the key that was
  # created passwordless) so tauri signer does not fail on a blank pass.
  if ($pass -ieq "nopw") { $pass = "" }

  $env:TAURI_SIGNING_PRIVATE_KEY_PATH = $abs
  $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = $pass

  Write-Host "  [signing-env] dung key: $(Split-Path $abs -Leaf)" -ForegroundColor Gray
}