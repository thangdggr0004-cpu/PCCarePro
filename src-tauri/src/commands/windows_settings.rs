use crate::commands::exec;
use std::sync::{Mutex, OnceLock};

fn run_ps(script: &str) -> String {
    exec::run_ps(script)
}

// ── read-windows-settings cache (parity: Electron `__windowsSettingsCache` L2107, TTL 10s) ──

struct SettingsCache {
    ts: std::time::Instant,
    data: serde_json::Value,
}

static WINDOWS_SETTINGS_CACHE: OnceLock<Mutex<Option<SettingsCache>>> = OnceLock::new();

fn cache_get(force_refresh: bool) -> Option<serde_json::Value> {
    if force_refresh {
        return None;
    }
    let lock = WINDOWS_SETTINGS_CACHE.get_or_init(|| Mutex::new(None));
    let guard = lock.lock().unwrap_or_else(|p| p.into_inner());
    match guard.as_ref() {
        Some(c) if c.ts.elapsed().as_secs() < 10 => Some(c.data.clone()),
        _ => None,
    }
}

fn cache_set(data: serde_json::Value) {
    let lock = WINDOWS_SETTINGS_CACHE.get_or_init(|| Mutex::new(None));
    let mut guard = lock.lock().unwrap_or_else(|p| p.into_inner());
    *guard = Some(SettingsCache { ts: std::time::Instant::now(), data });
}

fn cache_clear() {
    let lock = WINDOWS_SETTINGS_CACHE.get_or_init(|| Mutex::new(None));
    let mut guard = lock.lock().unwrap_or_else(|p| p.into_inner());
    *guard = None;
}

/// Read Windows settings. Parity 1:1 with Electron `read-windows-settings`
/// (electron.cjs L2110): full 22-key state + legacy mappings + active power plan,
/// cached 10s (no registry reads on every re-render). Returns `{ success, data }`.
pub fn read_windows_settings(force_refresh: bool) -> Result<serde_json::Value, String> {
    if let Some(cached) = cache_get(force_refresh) {
        return Ok(cached);
    }
    let ps = r#"
function Get-RegDWord ($path, $name, $default = 0) {
    try {
        $val = (Get-ItemProperty -Path $path -Name $name -ErrorAction SilentlyContinue).$name
        if ($null -ne $val) { return $val }
    } catch {}
    return $default
}

$state = @{}

# System Settings
$state.thisPc = (Get-RegDWord 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced' 'LaunchTo' 2) -eq 1
$state.classicMenu = (Test-Path 'HKCU:\Software\Classes\CLSID\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\InprocServer32')
$state.photoViewer = (Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows Photo Viewer\Capabilities\FileAssociations')
$state.hideTaskbarIcons = (Get-RegDWord 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer' 'EnableAutoTray' 0) -eq 1
try {
    $languages = Get-WinUserLanguageList -ErrorAction SilentlyContinue | Select-Object -ExpandProperty LanguageTag
    $state.removeLangs = ($languages -contains 'en-US' -and $languages -contains 'vi' -and $languages.Count -le 2)
} catch {
    $state.removeLangs = $false
}
$state.disableAutoBrightness = (Get-RegDWord 'HKLM:\SOFTWARE\Intel\Display\igfxcui\powersettings' 'FeatureTestControl' 0) -ne 0

# Taskbar Settings
$state.hideSearch = (Get-RegDWord 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Search' 'SearchboxTaskbarMode' 1) -eq 0
$state.hideTaskView = (Get-RegDWord 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced' 'ShowTaskViewButton' 1) -eq 0
$state.hideWidgets = (Get-RegDWord 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced' 'TaskbarDa' 1) -eq 0
$state.hideChat = (Get-RegDWord 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced' 'TaskbarMn' 1) -eq 0
$state.hideCopilot = (Get-RegDWord 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced' 'ShowCopilotButton' 1) -eq 0
$state.hideNews = (Get-RegDWord 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\Windows Feeds' 'EnableFeeds' 1) -eq 0
$state.taskbarLeft = (Get-RegDWord 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced' 'TaskbarAl' 1) -eq 0

# System Optimization (True = Disabled for optimization)
$state.disableHibernate = (Get-RegDWord 'HKLM:\SYSTEM\CurrentControlSet\Control\Power' 'HibernateEnabled' 1) -eq 0
$state.disableFastStartup = (Get-RegDWord 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Power' 'HiberbootEnabled' 1) -eq 0
$state.disablePrefetch = (Get-RegDWord 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management\PrefetchParameters' 'EnablePrefetcher' 3) -eq 0
$state.disableSysMain = ((Get-Service -Name 'SysMain' -ErrorAction SilentlyContinue).StartType -eq 'Disabled')
$state.disableRemoteDesktop = (Get-RegDWord 'HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server' 'fDenyTSConnections' 1) -eq 1
$state.disableErrorReporting = (Get-RegDWord 'HKLM:\SOFTWARE\Microsoft\Windows\Windows Error Reporting' 'Disabled' 0) -eq 1
$state.disableSearchIndexing = ((Get-Service -Name 'WSearch' -ErrorAction SilentlyContinue).StartType -eq 'Disabled')
$state.disablePrintSpooler = ((Get-Service -Name 'Spooler' -ErrorAction SilentlyContinue).StartType -eq 'Disabled')
$state.disableDefender = (Get-RegDWord 'HKLM:\SOFTWARE\Policies\Microsoft\Windows Defender' 'DisableAntiSpyware' 0) -eq 1
$state.disableTelemetry = (Get-RegDWord 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\DataCollection' 'AllowTelemetry' 1) -eq 0
$state.disableXboxServices = ((Get-Service -Name 'XboxGipSvc' -ErrorAction SilentlyContinue).StartType -eq 'Disabled')
$state.disableOneDrive = (-not (Test-Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run\OneDrive'))

# Legacy backward compatibility mappings
$state.hibernate = (-not $state.disableHibernate)
$state.fastStartup = (-not $state.disableFastStartup)
$state.prefetch = (-not $state.disablePrefetch)
$state.sysMain = (-not $state.disableSysMain)
$state.remoteDesktop = (-not $state.disableRemoteDesktop)
$state.errorReporting = (-not $state.disableErrorReporting)
$state.searchIndexing = (-not $state.disableSearchIndexing)
$state.printSpooler = (-not $state.disablePrintSpooler)
$state.defender = (-not $state.disableDefender)
$state.telemetry = (-not $state.disableTelemetry)
$state.xboxServices = (-not $state.disableXboxServices)
$state.oneDrive = (-not $state.disableOneDrive)

# Active Power Plan
$activePower = (powercfg /getactivescheme)
if ($activePower -match '([0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12})') {
    $state.activePowerPlan = $matches[1]
}

$state | ConvertTo-Json -Depth 3
"#;
    let stdout = run_ps(ps);
    let data: serde_json::Value =
        serde_json::from_str(exec::extract_json(&stdout)).map_err(|e| format!("Parse error: {}", e))?;
    let res = serde_json::json!({ "success": true, "data": data });
    cache_set(res.clone());
    Ok(res)
}

/// Apply Windows settings (Card 1 - System). Parity 1:1 with Electron
/// `apply-windows-settings` (electron.cjs L2199): thisPc (LaunchTo), classicMenu
/// (CLSID 86ca1aa0...), photoViewer (file associations), hideTaskbarIcons
/// (EnableAutoTray), disableAutoBrightness (FeatureTestControl=512), removeLangs
/// (Set-WinUserLanguageList). ONE elevated PowerShell per Electron. Also clears the
/// read cache like Electron does.
pub fn apply_windows_settings(state: serde_json::Value) -> Result<(), String> {
    cache_clear();
    let mut ps = String::new();

    // thisPc: always sets LaunchTo (1 when checked, else 2)
    let val = if state["thisPc"].as_bool().unwrap_or(false) { 1 } else { 2 };
    ps.push_str(&format!(
        "Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' -Name 'LaunchTo' -Value {} -Force -ErrorAction SilentlyContinue\n",
        val
    ));

    // classicMenu: register CLSID when checked, remove recursively when not
    if state["classicMenu"].as_bool().unwrap_or(false) {
        ps.push_str("New-Item -Path 'HKCU:\\Software\\Classes\\CLSID\\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\\InprocServer32' -Force -ErrorAction SilentlyContinue | Out-Null\n");
        ps.push_str("Set-ItemProperty -Path 'HKCU:\\Software\\Classes\\CLSID\\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\\InprocServer32' -Name '(Default)' -Value '' -Force\n");
    } else {
        ps.push_str("Remove-Item -Path 'HKCU:\\Software\\Classes\\CLSID\\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}' -Recurse -Force -ErrorAction SilentlyContinue\n");
    }

    // photoViewer: register associations when checked (no else, exactly like Electron)
    if state["photoViewer"].as_bool().unwrap_or(false) {
        ps.push_str("$pvPath = 'HKLM:\\SOFTWARE\\Microsoft\\Windows Photo Viewer\\Capabilities\\FileAssociations'\n");
        ps.push_str("New-Item -Path $pvPath -Force -ErrorAction SilentlyContinue | Out-Null\n");
        ps.push_str("Set-ItemProperty -Path $pvPath -Name '.jpg' -Value 'PhotoViewer.FileAssoc.Tiff' -Force -ErrorAction SilentlyContinue\n");
        ps.push_str("Set-ItemProperty -Path $pvPath -Name '.jpeg' -Value 'PhotoViewer.FileAssoc.Tiff' -Force -ErrorAction SilentlyContinue\n");
        ps.push_str("Set-ItemProperty -Path $pvPath -Name '.png' -Value 'PhotoViewer.FileAssoc.Tiff' -Force -ErrorAction SilentlyContinue\n");
        ps.push_str("Set-ItemProperty -Path $pvPath -Name '.bmp' -Value 'PhotoViewer.FileAssoc.Tiff' -Force -ErrorAction SilentlyContinue\n");
    }

    // disableAutoBrightness: FeatureTestControl=512 when checked (only-if true)
    if state["disableAutoBrightness"].as_bool().unwrap_or(false) {
        ps.push_str("Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Intel\\Display\\igfxcui\\powersettings' -Name 'FeatureTestControl' -Value 512 -Force -ErrorAction SilentlyContinue\n");
    }

    // hideTaskbarIcons: always sets EnableAutoTray (1 when checked, else 0)
    let tray = if state["hideTaskbarIcons"].as_bool().unwrap_or(false) { 1 } else { 0 };
    ps.push_str(&format!(
        "Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer' -Name 'EnableAutoTray' -Value {} -Force -ErrorAction SilentlyContinue\n",
        tray
    ));

    // removeLangs: en-US + vi only (only-if true)
    if state["removeLangs"].as_bool().unwrap_or(false) {
        ps.push_str("Set-WinUserLanguageList -LanguageList 'en-US', 'vi' -Force -ErrorAction SilentlyContinue\n");
    }

    exec::run_ps_elevated(&ps).map(|_| ())
}

/// Apply Taskbar settings (Card 2). Parity 1:1 with Electron `apply-taskbar-settings`
/// (electron.cjs L2267): TaskbarAl, SearchboxTaskbarMode, ShowTaskViewButton, TaskbarDa,
/// TaskbarMn, ShowCopilotButton, EnableFeeds (HKLM). Writes run elevated, then restarts
/// Explorer using the codebase's existing `restart_explorer` mechanism.
pub fn apply_taskbar_settings(state: serde_json::Value) -> Result<(), String> {
    cache_clear();
    let b = |key: &str| state[key].as_bool().unwrap_or(false);
    let mut ps = String::new();

    let v = |flag: bool| if flag { 0 } else { 1 };
    let advanced = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced";

    ps.push_str(&format!("Set-ItemProperty -Path '{}' -Name 'TaskbarAl' -Value {} -Force -ErrorAction SilentlyContinue\n", advanced, v(b("taskbarLeft"))));
    ps.push_str(&format!("Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Search' -Name 'SearchboxTaskbarMode' -Value {} -Force -ErrorAction SilentlyContinue\n", v(b("hideSearch"))));
    ps.push_str(&format!("Set-ItemProperty -Path '{}' -Name 'ShowTaskViewButton' -Value {} -Force -ErrorAction SilentlyContinue\n", advanced, v(b("hideTaskView"))));
    ps.push_str(&format!("Set-ItemProperty -Path '{}' -Name 'TaskbarDa' -Value {} -Force -ErrorAction SilentlyContinue\n", advanced, v(b("hideWidgets"))));
    ps.push_str(&format!("Set-ItemProperty -Path '{}' -Name 'TaskbarMn' -Value {} -Force -ErrorAction SilentlyContinue\n", advanced, v(b("hideChat"))));
    ps.push_str(&format!("Set-ItemProperty -Path '{}' -Name 'ShowCopilotButton' -Value {} -Force -ErrorAction SilentlyContinue\n", advanced, v(b("hideCopilot"))));

    ps.push_str("New-Item -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\Windows Feeds' -Force -ErrorAction SilentlyContinue | Out-Null\n");
    ps.push_str(&format!("Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\Windows Feeds' -Name 'EnableFeeds' -Value {} -Force -ErrorAction SilentlyContinue\n", v(b("hideNews"))));

    exec::run_ps_elevated(&ps)?;
    restart_explorer()
}

/// Run SSD TRIM (fire-and-forget)
pub fn run_ssd_trim() -> Result<serde_json::Value, String> {
    let ps = r#"
    $vols = Get-CimInstance Win32_Volume | Where-Object { $_.DriveLetter }
    foreach ($v in $vols) {
        $letter = $v.DriveLetter
        & defrag "${letter}:" /O /U 2>&1 | Out-Null
    }
    "#;
    // Spawn as elevated background process (defrag /O /U needs admin)
    exec::spawn_ps_elevated(ps)?;
    Ok(serde_json::json!({ "success": true, "message": "SSD TRIM started in background" }))
}

/// Backup registry keys
pub fn backup_registry_keys() -> Result<serde_json::Value, String> {
    let dir = std::env::temp_dir().join("tp_registry_backup");
    let _ = std::fs::create_dir_all(&dir);
    let path = dir.join("registry_backup.reg");

    let keys = vec![
        "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion",
        "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer",
        "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize",
        "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Search",
    ];

    let mut ps = String::new();
    for key in &keys {
        ps.push_str(&format!(
            "reg export '{}' '{}' /y 2>$null\n",
            key,
            path.to_string_lossy().replace('\'', "''")
        ));
    }
    exec::run_ps_elevated(&ps)?;

    Ok(serde_json::json!({ "path": dir.display().to_string() }))
}

/// Restart explorer.exe
pub fn restart_explorer() -> Result<(), String> {
    let _ = exec::run_cmd(&["taskkill", "/f", "/im", "explorer.exe"]);
    std::thread::sleep(std::time::Duration::from_millis(500));
    let _ = std::process::Command::new("explorer.exe").spawn();
    Ok(())
}


/// Restart computer
pub fn restart_computer() -> Result<(), String> {
    let _ = exec::run_cmd_quiet("shutdown", &["/r", "/t", "0"]);
    Ok(())
}

/// Create system restore point
pub fn create_system_restore_point(name: &str) -> Result<(), String> {
    let ps = format!(
        "Checkpoint-Computer -Description '{}' -RestorePointType MODIFY_SETTINGS",
        name.replace('\'', "''")
    );
    exec::run_ps_elevated(&ps).map(|_| ())
}

/// Apply advanced optimization. Parity 1:1 with Electron `apply-advanced-optimization`
/// (electron.cjs L2616-2708): restore point, HPET, network throttling, delivery
/// optimization, background apps, game mode, startup delay, purge standby RAM, SSD trim.
/// Runs as ONE elevated PowerShell (like Electron `runPowerShellScriptElevated`), so
/// admin ops (bcdedit, HKLM, services, restore point) all succeed via single UAC.
pub fn apply_advanced_optimization(options: serde_json::Value) -> Result<(), String> {
    cache_clear();
    let mut ps = String::new();

    // Create system restore point before any tweak
    if options["createRestorePoint"].as_bool().unwrap_or(false) {
        ps.push_str(
            "try {\n  Enable-ComputerRestore -Drive 'C:\\' -ErrorAction SilentlyContinue\n  Checkpoint-Computer -Description \"ThienPhatTech_PreOptimization\" -RestorePointType \"MODIFY_SETTINGS\" -ErrorAction SilentlyContinue\n} catch {}\n",
        );
    }

    // Disable HPET for better timer resolution (Electron: deletevalue useplatformclock + disabledynamictick yes)
    if options["disableHpet"].as_bool().unwrap_or(false) {
        ps.push_str("bcdedit /deletevalue useplatformclock\n");
        ps.push_str("bcdedit /set disabledynamictick yes\n");
    }

    // Disable network throttling (Electron: NetworkThrottlingIndex 0xFFFFFFFF + SystemResponsiveness 0)
    if options["disableNetworkThrottling"].as_bool().unwrap_or(false) {
        ps.push_str(
            "Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile' -Name 'NetworkThrottlingIndex' -Value 0xFFFFFFFF -Type DWord -Force -ErrorAction SilentlyContinue\n",
        );
        ps.push_str(
            "Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile' -Name 'SystemResponsiveness' -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue\n",
        );
    }

    // Disable Delivery Optimization (DODownloadMode 0 + stop/disable dosvc)
    if options["disableDeliveryOptimization"].as_bool().unwrap_or(false) {
        ps.push_str("Stop-Service -Name dosvc -Force -ErrorAction SilentlyContinue; Set-Service -Name dosvc -StartupType Disabled -ErrorAction SilentlyContinue\n");
        ps.push_str(
            "Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DeliveryOptimization' -Name 'DODownloadMode' -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue\n",
        );
    }

    // Disable background apps
    if options["disableBackgroundApps"].as_bool().unwrap_or(false) {
        ps.push_str(
            "Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\BackgroundAccessApplications' -Name 'GlobalUserDisabled' -Value 1 -Type DWord -Force -ErrorAction SilentlyContinue\n",
        );
    }

    // Game mode on (Electron: AllowAutoGameMode 1 + AutoGameModeEnabled 1)
    if options["enableGameMode"].as_bool().unwrap_or(false) {
        ps.push_str(
            "Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\GameBar' -Name 'AllowAutoGameMode' -Value 1 -Type DWord -Force -ErrorAction SilentlyContinue\n",
        );
        ps.push_str(
            "Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\GameBar' -Name 'AutoGameModeEnabled' -Value 1 -Type DWord -Force -ErrorAction SilentlyContinue\n",
        );
    }

    // Disable startup delay (Serialize\StartupDelayInMSec 0)
    if options["disableStartupDelay"].as_bool().unwrap_or(false) {
        ps.push_str(
            "New-Item -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer' -Name 'Serialize' -Force -ErrorAction SilentlyContinue | Out-Null\nSet-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Serialize' -Name 'StartupDelayInMSec' -Value 0 -Type DWord -Force\n",
        );
    }

    // Purge standby RAM via EmptyWorkingSet on all processes
    if options["purgeStandbyRam"].as_bool().unwrap_or(false) {
        ps.push_str(
            "try {\n  $code = @\"\nusing System;\nusing System.Runtime.InteropServices;\npublic class WinRamCleaner {\n    [DllImport(\"psapi.dll\")]\n    public static extern int EmptyWorkingSet(IntPtr hProcess);\n}\n\"@\n  Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue\n  Get-Process -ErrorAction SilentlyContinue | ForEach-Object {\n    try { [WinRamCleaner]::EmptyWorkingSet($_.Handle) } catch {}\n  }\n} catch {}\n[System.GC]::Collect()\n[System.GC]::WaitForPendingFinalizers()\n",
        );
    }

    // Enable SSD trim (DisableDeleteNotification 0 + defrag /L C:)
    if options["enableSsdTrim"].as_bool().unwrap_or(false) {
        ps.push_str(
            "Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\FileSystem' -Name 'DisableDeleteNotification' -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue\n",
        );
        ps.push_str("defrag /L C: 2>$null\n");
    }

    // Disable Nagle's algorithm (existing Tauri-only extra, not sent by the frontend)
    if options["disableNagle"].as_bool().unwrap_or(false) {
        ps.push_str(
            "$adapters = Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces\\*' -ErrorAction SilentlyContinue\nforeach ($a in $adapters.PSObject.Properties) {\n    if ($a.Value.DhcpIPAddress) {\n        Set-ItemProperty -Path $a.Name -Name 'TcpAckFrequency' -Value 1 -ErrorAction SilentlyContinue\n        Set-ItemProperty -Path $a.Name -Name 'TCPNoDelay' -Value 1 -ErrorAction SilentlyContinue\n    }\n}\n",
        );
    }

    // Disable visual effects for performance (existing Tauri-only extra, not sent by the frontend)
    if options["disableVisualEffects"].as_bool().unwrap_or(false) {
        ps.push_str(
            "Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects' -Name 'VisualFXSetting' -Value 2 -Force -ErrorAction SilentlyContinue\n",
        );
    }

    if ps.is_empty() {
        return Ok(());
    }
    exec::run_ps_elevated(&ps).map(|_| ())
}

/// Restore advanced optimization to defaults. Parity 1:1 with Electron
/// `restore-advanced-optimization` (electron.cjs L2710-2745). Runs as ONE elevated
/// PowerShell like Electron (bcdedit/HKLM/service revert all need admin).
pub fn restore_advanced_optimization() -> Result<(), String> {
    cache_clear();
    let mut ps = String::new();

    // Reset HPET & Dynamic Tick (Electron: deletevalue disabledynamictick + useplatformclock true)
    ps.push_str("bcdedit /deletevalue disabledynamictick\n");
    ps.push_str("bcdedit /set useplatformclock true\n");

    // Reset Network Throttling (Electron: NetworkThrottlingIndex 10 + SystemResponsiveness 20)
    ps.push_str(
        "Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile' -Name 'NetworkThrottlingIndex' -Value 10 -Type DWord -Force -ErrorAction SilentlyContinue\n",
    );
    ps.push_str(
        "Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile' -Name 'SystemResponsiveness' -Value 20 -Type DWord -Force -ErrorAction SilentlyContinue\n",
    );

    // Reset Delivery Optimization (DODownloadMode 1 + dosvc auto/start)
    ps.push_str(
        "Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DeliveryOptimization' -Name 'DODownloadMode' -Value 1 -Type DWord -Force -ErrorAction SilentlyContinue\n",
    );
    ps.push_str("Set-Service -Name dosvc -StartupType Automatic -ErrorAction SilentlyContinue; Start-Service -Name dosvc -ErrorAction SilentlyContinue\n");

    // Reset Background Apps
    ps.push_str(
        "Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\BackgroundAccessApplications' -Name 'GlobalUserDisabled' -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue\n",
    );

    // Reset Startup Delay (remove StartupDelayInMSec)
    ps.push_str("Remove-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Serialize' -Name 'StartupDelayInMSec' -Force -ErrorAction SilentlyContinue\n");

    // Reset Game Mode
    ps.push_str(
        "Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\GameBar' -Name 'AllowAutoGameMode' -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue\n",
    );
    ps.push_str(
        "Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\GameBar' -Name 'AutoGameModeEnabled' -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue\n",
    );

    // Reset Nagle tweaks (existing Tauri-only extra)
    ps.push_str(
        "$adapters = Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces\\*' -ErrorAction SilentlyContinue\nforeach ($a in $adapters.PSObject.Properties) {\n    if ($a.Value.DhcpIPAddress) {\n        Remove-ItemProperty -Path $a.Name -Name 'TcpAckFrequency' -ErrorAction SilentlyContinue\n        Remove-ItemProperty -Path $a.Name -Name 'TCPNoDelay' -ErrorAction SilentlyContinue\n    }\n}\n",
    );

    exec::run_ps_elevated(&ps).map(|_| ())
}

/// Run SFC / DISM system file checker. Enhanced beyond Electron (electron.cjs L3158-3181):
/// still runs ONE elevated PowerShell, but now parses the REAL output of `sfc /scannow`
/// (3 fixed states) and `DISM /RestoreHealth` instead of emitting static labels, and
/// returns `{ success, details, sfcStatus, sfcCode, dismStatus }` for the UI.
/// Uses a long poll deadline because both commands can take minutes.
pub fn run_windows_fixer() -> Result<serde_json::Value, String> {
    let ps = r#"
function Get-SfcStatus($text) {
    if ($text -match 'did not find any integrity violations') { return 'Clean' }
    if ($text -match 'found corrupt files and successfully repaired') { return 'Repaired' }
    if ($text -match 'was unable to fix some of them') { return 'Failed' }
    if ($text -match 'could not perform the requested operation') { return 'CannotRun' }
    return 'Unknown'
}

# sfc /scannow writes wide-char console output; when piped through Out-String it can
# come back interleaved with NUL bytes (UTF-16LE read as ASCII). Strip NULs + normalize
# before parsing so the real conclusion phrase is matchable on all Windows versions.
function Sanitize($text) {
    return (($text -replace [char]0, '' ) -replace '\s+', ' ').Trim()
}

$results = @()

# Run SFC
$sfcRaw = Sanitize ((& sfc /scannow 2>&1 | Out-String))
$sfcCode = Get-SfcStatus $sfcRaw
$results += "SFC /SCANNOW: $sfcCode"

# Run DISM
$dismRaw = Sanitize ((& DISM /Online /Cleanup-Image /RestoreHealth 2>&1 | Out-String))
if ($dismRaw -match 'no component store corruption was detected') {
    $dismStatus = 'Clean'
} elseif ($dismRaw -match 'the component store corruption was repaired') {
    $dismStatus = 'Repaired'
} elseif ($dismRaw -match 'restore operation completed successfully') {
    $dismStatus = 'Clean'
} else {
    $dismStatus = 'Unknown'
}
$results += "DISM RestoreHealth: $dismStatus"

Write-Output ($results -join "|")
"#;
    let output = exec::run_ps_elevated_timeout(ps, 3600)?;
    let details: Vec<String> = output
        .split('|')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(String::from)
        .collect();

    // Extract sfcStatus / dismStatus from the "KEY: value" detail lines
    let mut sfc_status = "Unknown".to_string();
    let mut dism_status = "Unknown".to_string();
    for d in &details {
        if let Some(stripped) = d.strip_prefix("SFC /SCANNOW:") {
            sfc_status = stripped.trim().to_string();
        } else if let Some(stripped) = d.strip_prefix("DISM RestoreHealth:") {
            dism_status = stripped.trim().to_string();
        }
    }

    Ok(serde_json::json!({
        "success": true,
        "details": details,
        "sfcStatus": sfc_status,
        "dismStatus": dism_status
    }))
}


/// Reset Windows Update components. Parity 1:1 with Electron `reset-windows-update`
/// (electron.cjs L3183-3218): stop BITS/wuauserv/appidsvc/cryptsvc, remove the WHOLE
/// `SoftwareDistribution` and `catroot2` folders (Recurse on the root, not just contents,
/// as Electron does), restart services. Electron has NO regsvr32/kb971058 block, so it is
/// dropped here. Runs ONE elevated PowerShell and returns `details` joined by `|`.
pub fn reset_windows_update() -> Result<serde_json::Value, String> {
    let ps = r#"
$results = @()

# Stop services
Stop-Service -Name BITS, wuauserv, appidsvc, cryptsvc -Force -ErrorAction SilentlyContinue
$results += "Đã dừng BITS, wuauserv, appidsvc, cryptsvc"

# Remove SoftwareDistribution (whole folder)
if (Test-Path "$env:windir\SoftwareDistribution") {
    Remove-Item "$env:windir\SoftwareDistribution" -Recurse -Force -ErrorAction SilentlyContinue
    $results += "Đã xóa SoftwareDistribution"
}

# Remove catroot2 (whole folder)
if (Test-Path "$env:windir\system32\catroot2") {
    Remove-Item "$env:windir\system32\catroot2" -Recurse -Force -ErrorAction SilentlyContinue
    $results += "Đã xóa catroot2"
}

# Restart services
Start-Service -Name BITS, wuauserv, appidsvc, cryptsvc -ErrorAction SilentlyContinue
$results += "Đã khởi động lại services"

Write-Output ($results -join "|")
"#;
    let output = exec::run_ps_elevated(ps)?;
    let details: Vec<String> = output
        .split('|')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(String::from)
        .collect();
    Ok(serde_json::json!({ "success": true, "details": details }))
}

/// Rebuild icon/thumbnail cache. Parity 1:1 with Electron `rebuild-icon-cache`
/// (electron.cjs L3220-3263): stop explorer, remove `iconcache*` AND `thumbcache*` leaf
/// files plus `IconCache.db`, restart explorer. Electron runs this NON-elevated
/// (`runPowerShellScript`), so it uses `run_ps` here too. Returns `details` joined by `|`.
pub fn rebuild_icon_cache() -> Result<serde_json::Value, String> {
    let ps = r#"
$results = @()

# Stop Explorer
Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
$results += "Đã dừng Explorer"

# Remove icon cache files
$iconCacheFiles = Get-ChildItem "$env:localappdata\Microsoft\Windows\Explorer\iconcache*" -ErrorAction SilentlyContinue
if ($iconCacheFiles) {
    Remove-Item "$env:localappdata\Microsoft\Windows\Explorer\iconcache*" -Force -ErrorAction SilentlyContinue
    $results += "Đã xóa $($iconCacheFiles.Count) file icon cache"
}

# Remove thumb cache files
$thumbCacheFiles = Get-ChildItem "$env:localappdata\Microsoft\Windows\Explorer\thumbcache*" -ErrorAction SilentlyContinue
if ($thumbCacheFiles) {
    Remove-Item "$env:localappdata\Microsoft\Windows\Explorer\thumbcache*" -Force -ErrorAction SilentlyContinue
    $results += "Đã xóa $($thumbCacheFiles.Count) file thumb cache"
}

# Remove IconCache.db
if (Test-Path "$env:localappdata\IconCache.db") {
    Remove-Item "$env:localappdata\IconCache.db" -Force -ErrorAction SilentlyContinue
    $results += "Đã xóa IconCache.db"
}

# Restart Explorer
Start-Process explorer
$results += "Đã khởi động lại Explorer"

Write-Output ($results -join "|")
"#;
    let output = run_ps(ps);
    let details: Vec<String> = output
        .split('|')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(String::from)
        .collect();
    Ok(serde_json::json!({ "success": true, "details": details }))
}

/// Apply system optimization. Parity 1:1 with Electron `apply-system-optimization`
/// (electron.cjs L2318-2401): every item always contributes one branch (disable OR
/// enable), and the whole script runs ONCE elevated (`runPowerShellScriptElevated`).
pub fn apply_system_optimization(state: serde_json::Value) -> Result<(), String> {
    cache_clear();
    let is_disable = |disable_key: &str, enable_key: &str| {
        state.get(disable_key).and_then(|v| v.as_bool()) == Some(true)
            || state.get(enable_key).and_then(|v| v.as_bool()) == Some(false)
    };

    let mut ps = String::new();

    // 1. Hibernate
    if is_disable("disableHibernate", "hibernate") {
        ps.push_str("powercfg.exe /hibernate off\n");
    } else {
        ps.push_str("powercfg.exe /hibernate on\n");
    }

    // 2. SysMain (Superfetch)
    if is_disable("disableSysMain", "sysMain") {
        ps.push_str("Stop-Service -Name 'SysMain' -Force -ErrorAction SilentlyContinue; Set-Service -Name 'SysMain' -StartupType Disabled\n");
    } else {
        ps.push_str("Set-Service -Name 'SysMain' -StartupType Automatic; Start-Service -Name 'SysMain' -ErrorAction SilentlyContinue\n");
    }

    // 3. Defender Policy
    if is_disable("disableDefender", "defender") {
        ps.push_str("New-Item -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows Defender' -Force -ErrorAction SilentlyContinue | Out-Null; Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows Defender' -Name 'DisableAntiSpyware' -Value 1 -Force -ErrorAction SilentlyContinue\n");
    } else {
        ps.push_str("Remove-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows Defender' -Name 'DisableAntiSpyware' -Force -ErrorAction SilentlyContinue\n");
    }

    // 4. Fast Startup
    if is_disable("disableFastStartup", "fastStartup") {
        ps.push_str("Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Power' -Name 'HiberbootEnabled' -Value 0 -Force -ErrorAction SilentlyContinue\n");
    } else {
        ps.push_str("Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Power' -Name 'HiberbootEnabled' -Value 1 -Force -ErrorAction SilentlyContinue\n");
    }

    // 5. Remote Desktop
    if is_disable("disableRemoteDesktop", "remoteDesktop") {
        ps.push_str("Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Terminal Server' -Name 'fDenyTSConnections' -Value 1 -Force -ErrorAction SilentlyContinue\n");
    } else {
        ps.push_str("Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Terminal Server' -Name 'fDenyTSConnections' -Value 0 -Force -ErrorAction SilentlyContinue\n");
    }

    // 6. Error Reporting
    if is_disable("disableErrorReporting", "errorReporting") {
        ps.push_str("New-Item -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\Windows Error Reporting' -Force -ErrorAction SilentlyContinue | Out-Null; Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\Windows Error Reporting' -Name 'Disabled' -Value 1 -Force -ErrorAction SilentlyContinue\n");
    } else {
        ps.push_str("Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\Windows Error Reporting' -Name 'Disabled' -Value 0 -Force -ErrorAction SilentlyContinue\n");
    }

    // 7. Telemetry
    if is_disable("disableTelemetry", "telemetry") {
        ps.push_str("New-Item -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection' -Force -ErrorAction SilentlyContinue | Out-Null; Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection' -Name 'AllowTelemetry' -Value 0 -Force -ErrorAction SilentlyContinue\n");
    } else {
        ps.push_str("Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection' -Name 'AllowTelemetry' -Value 1 -Force -ErrorAction SilentlyContinue\n");
    }

    // 8. Prefetch
    if is_disable("disablePrefetch", "prefetch") {
        ps.push_str("Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management\\PrefetchParameters' -Name 'EnablePrefetcher' -Value 0 -Force -ErrorAction SilentlyContinue\n");
    } else {
        ps.push_str("Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management\\PrefetchParameters' -Name 'EnablePrefetcher' -Value 3 -Force -ErrorAction SilentlyContinue\n");
    }

    // 9. Windows Search Indexing
    if is_disable("disableSearchIndexing", "searchIndexing") {
        ps.push_str("Stop-Service -Name 'WSearch' -Force -ErrorAction SilentlyContinue; Set-Service -Name 'WSearch' -StartupType Disabled\n");
    } else {
        ps.push_str("Set-Service -Name 'WSearch' -StartupType Automatic; Start-Service -Name 'WSearch' -ErrorAction SilentlyContinue\n");
    }

    // 10. Print Spooler
    if is_disable("disablePrintSpooler", "printSpooler") {
        ps.push_str("Stop-Service -Name 'Spooler' -Force -ErrorAction SilentlyContinue; Set-Service -Name 'Spooler' -StartupType Disabled\n");
    } else {
        ps.push_str("Set-Service -Name 'Spooler' -StartupType Automatic; Start-Service -Name 'Spooler' -ErrorAction SilentlyContinue\n");
    }

    // 11. Xbox Services
    if is_disable("disableXboxServices", "xboxServices") {
        ps.push_str("Get-Service -Name 'XboxGipSvc', 'XblAuthManager', 'XblGameSave', 'XboxNetApiSvc' -ErrorAction SilentlyContinue | ForEach-Object {\n  Stop-Service -Name $_.Name -Force -ErrorAction SilentlyContinue\n  Set-Service -Name $_.Name -StartupType Disabled -ErrorAction SilentlyContinue\n}\n");
    } else {
        ps.push_str("Get-Service -Name 'XboxGipSvc', 'XblAuthManager', 'XblGameSave', 'XboxNetApiSvc' -ErrorAction SilentlyContinue | ForEach-Object {\n  Set-Service -Name $_.Name -StartupType Manual -ErrorAction SilentlyContinue\n}\n");
    }

    // 12. OneDrive Auto-start
    if is_disable("disableOneDrive", "oneDrive") {
        ps.push_str("Remove-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' -Name 'OneDrive' -Force -ErrorAction SilentlyContinue\n");
    }

    exec::run_ps_elevated(&ps).map(|_| ())
}

pub fn get_system_info() -> Result<serde_json::Value, String> {
    let ps = format!("{}\n    $s | ConvertTo-Json -Depth 3\n", super::startup::SYS_PS_BODY);
    let stdout = String::from_utf8_lossy(&exec::run_ps_raw(&ps).stdout).to_string();
    let val: serde_json::Value = serde_json::from_str(&stdout).map_err(|e| e.to_string())?;
    Ok(val)
}

/// Read Tamper Protection status from Windows Defender.
/// Registry: HKLM:\SOFTWARE\Microsoft\Windows Defender\Features\TamperProtection
/// Returns: { "enabled": bool, "managed": bool, "value": u32 }
pub fn read_tamper_protection() -> Result<serde_json::Value, String> {
    let ps = r#"
    try {
        $val = (Get-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows Defender\Features' -Name 'TamperProtection' -ErrorAction SilentlyContinue).TamperProtection
        if ($null -ne $val) {
            @{ value = $val; enabled = $val -eq 1 -or $val -eq 4; managed = $val -eq 4 } | ConvertTo-Json
        } else {
            @{ value = 0; enabled = $false; managed = $false } | ConvertTo-Json
        }
    } catch {
        @{ value = 0; enabled = $false; managed = $false; error = $_.Exception.Message } | ConvertTo-Json
    }
    "#;
    let stdout = run_ps(ps);
    let val: serde_json::Value = serde_json::from_str(exec::extract_json(&stdout)).map_err(|e| format!("Parse error: {}", e))?;
    Ok(serde_json::json!({ "success": true, "data": val }))
}
