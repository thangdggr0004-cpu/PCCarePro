use crate::commands::exec;
use std::os::windows::process::CommandExt;

fn run_ps(script: &str) -> String {
    exec::run_ps(script)
}

fn run_reg_add(key: &str, value_name: &str, value: &str) -> Result<(), String> {
    let output = exec::run_cmd_quiet("reg", &["add", key, "/v", value_name, "/t", "REG_DWORD", "/d", value, "/f"]);
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    Ok(())
}

/// Read Windows settings
pub fn read_windows_settings() -> Result<serde_json::Value, String> {
    let ps = r#"
    $s = @{}

    # Taskbar
    $s.hideSearch = if ((Get-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Search" -ErrorAction SilentlyContinue).SearchBoxTaskbarCollapsed -eq 1) { $true } else { $false }
    $s.hideTaskView = if ((Get-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -ErrorAction SilentlyContinue).ShowTaskViewButton -eq 0) { $true } else { $false }

    # System
    $s.darkMode = if ((Get-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize" -ErrorAction SilentlyContinue).AppsUseLightTheme -eq 0) { $true } else { $false }

    # Explorer
    $s.classicContextMenu = if ((Get-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -ErrorAction SilentlyContinue).UseClassicSignIn -eq 1) { $true } else { $false }

    # Power plan
    $active = powercfg /getactivescheme 2>&1
    $s.activePowerPlan = $active

    $s | ConvertTo-Json -Depth 2
    "#;
    let stdout = run_ps(ps);
    serde_json::from_str(&stdout).map_err(|e| format!("Parse error: {}", e))
}

/// Apply Windows settings
pub fn apply_windows_settings(state: serde_json::Value) -> Result<(), String> {
    if let Some(dark) = state["darkMode"].as_bool() {
        let val = if dark { "0" } else { "1" };
        let _ = run_reg_add(
            "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize",
            "AppsUseLightTheme",
            val,
        );
    }
    if let Some(hide) = state["hideSearch"].as_bool() {
        let val = if hide { "1" } else { "0" };
        let _ = run_reg_add(
            "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Search",
            "SearchBoxTaskbarCollapsed",
            val,
        );
    }
    if let Some(hide) = state["hideTaskView"].as_bool() {
        let val = if hide { "0" } else { "1" };
        let _ = run_reg_add(
            "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced",
            "ShowTaskViewButton",
            val,
        );
    }
    Ok(())
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
    // Spawn as detached background process
    let _ = std::process::Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-Command", ps])
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .creation_flags(exec::CREATE_NO_WINDOW | exec::DETACHED_PROCESS)
        .spawn();
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

    for key in &keys {
        let _ = exec::run_cmd_quiet("reg", &["export", key, &path.to_string_lossy(), "/y"]);
    }

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
        name
    );
    let _ = run_ps(&ps);
    Ok(())
}

/// Apply advanced optimization (HPET, network throttling, game mode, background apps, etc.)
pub fn apply_advanced_optimization(options: serde_json::Value) -> Result<(), String> {
    // Disable HPET for better timer resolution
    if options["disableHpet"].as_bool().unwrap_or(false) {
        let _ = run_ps("bcdedit /set disabledynamictick yes");
        let _ = run_ps("bcdedit /set useplatformtick yes");
    }

    // Disable network throttling
    if options["disableNetworkThrottling"].as_bool().unwrap_or(false) {
        let _ = run_reg_add(
            "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile",
            "NetworkThrottlingIndex",
            "ffffffff",
        );
    }

    // Disable Nagle's algorithm
    if options["disableNagle"].as_bool().unwrap_or(false) {
        let ps = r#"
        $adapters = Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters\Interfaces\*" -ErrorAction SilentlyContinue
        foreach ($a in $adapters.PSObject.Properties) {
            if ($a.Value.DhcpIPAddress) {
                Set-ItemProperty -Path $a.Name -Name "TcpAckFrequency" -Value 1 -ErrorAction SilentlyContinue
                Set-ItemProperty -Path $a.Name -Name "TCPNoDelay" -Value 1 -ErrorAction SilentlyContinue
            }
        }
        "#;
        let _ = run_ps(ps);
    }

    // Disable background apps
    if options["disableBackgroundApps"].as_bool().unwrap_or(false) {
        let _ = run_reg_add(
            "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\BackgroundAccessApplications",
            "GlobalUserDisabled",
            "1",
        );
    }

    // Game mode on
    if options["enableGameMode"].as_bool().unwrap_or(false) {
        let _ = run_reg_add(
            "HKCU\\Software\\Microsoft\\GameBar",
            "AllowAutoGameMode",
            "1",
        );
    }

    // Disable visual effects for performance
    if options["disableVisualEffects"].as_bool().unwrap_or(false) {
        let ps = r#"
        $key = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects"
        Set-ItemProperty -Path $key -Name "VisualFXSetting" -Value 2 -ErrorAction SilentlyContinue
        "#;
        let _ = run_ps(ps);
    }

    Ok(())
}

/// Restore advanced optimization to defaults
pub fn restore_advanced_optimization() -> Result<(), String> {
    let _ = run_ps("bcdedit /set disabledynamictick no");
    let _ = run_ps("bcdedit /set useplatformtick no");

    let _ = run_reg_add(
        "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile",
        "NetworkThrottlingIndex",
        "10",
    );

    let ps = r#"
    $adapters = Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters\Interfaces\*" -ErrorAction SilentlyContinue
    foreach ($a in $adapters.PSObject.Properties) {
        if ($a.Value.DhcpIPAddress) {
            Remove-ItemProperty -Path $a.Name -Name "TcpAckFrequency" -ErrorAction SilentlyContinue
            Remove-ItemProperty -Path $a.Name -Name "TCPNoDelay" -ErrorAction SilentlyContinue
        }
    }
    "#;
    let _ = run_ps(ps);
    Ok(())
}

/// Run SFC / DISM system file checker (fire-and-forget: spawns background process)
pub fn run_windows_fixer() -> Result<serde_json::Value, String> {
    let ps = r#"
    $results = @{}

    # DISM first
    try {
        $dism = & DISM /Online /Cleanup-Image /ScanHealth 2>&1 | Out-String
        $results.dism = $dism.Trim()
    } catch { $results.dism = "Failed: $($_.Exception.Message)" }

    # SFC
    try {
        $sfc = & sfc /scannow 2>&1 | Out-String
        $results.sfc = $sfc.Trim()
    } catch { $results.sfc = "Failed: $($_.Exception.Message)" }

    @{ success=$true; results=$results } | ConvertTo-Json -Depth 3
    "#;
    // Spawn as detached background process so frontend is not blocked
    let _ = std::process::Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-Command", ps])
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .creation_flags(exec::CREATE_NO_WINDOW | exec::DETACHED_PROCESS) // DETACHED_PROCESS
        .spawn();
    Ok(serde_json::json!({ "success": true, "message": "System file checker started in background" }))
}

/// Reset Windows Update components
pub fn reset_windows_update() -> Result<(), String> {
    let ps = r#"
    Stop-Service -Name BITS, wuauserv, appidsvc, cryptsvc -Force -ErrorAction SilentlyContinue
    Start-Sleep 2

    Remove-Item "C:\Windows\SoftwareDistribution\Download\*" -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item "C:\Windows\System32\catroot2\*" -Recurse -Force -ErrorAction SilentlyContinue

    regsvr32.exe /s atl.dll
    regsvr32.exe /s urlmon.dll
    regsvr32.exe /s mshtml.dll
    regsvr32.exe /s shdocvw.dll
    regsvr32.exe /s browseui.dll
    regsvr32.exe /s jscript.dll
    regsvr32.exe /s vbscript.dll
    regsvr32.exe /s scrrun.dll
    regsvr32.exe /s msxml.dll
    regsvr32.exe /s msxml3.dll
    regsvr32.exe /s msxml6.dll
    regsvr32.exe /s actxprxy.dll
    regsvr32.exe /s softpub.dll
    regsvr32.exe /s wintrust.dll
    regsvr32.exe /s dssenh.dll
    regsvr32.exe /s rsaenh.dll
    regsvr32.exe /s gpkcsp.dll
    regsvr32.exe /s sccbase.dll
    regsvr32.exe /s slbcsp.dll
    regsvr32.exe /s cryptdlg.dll
    regsvr32.exe /s oleaut32.dll
    regsvr32.exe /s ole32.dll
    regsvr32.exe /s shell32.dll
    regsvr32.exe /s wuaueng.dll
    regsvr32.exe /s wuaueng1.dll
    regsvr32.exe /s wucltui.dll
    regsvr32.exe /s wups.dll
    regsvr32.exe /s wups2.dll
    regsvr32.exe /s wuweb.dll
    regsvr32.exe /s qmgr.dll
    regsvr32.exe /s qmgrprxy.dll
    regsvr32.exe /s wucltux.dll
    regsvr32.exe /s muweb.dll
    regsvr32.exe /s wuwebv.dll

    Start-Service -Name BITS, wuauserv, appidsvc, cryptsvc -ErrorAction SilentlyContinue
    "#;
    // Spawn as detached background process
    let _ = std::process::Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-Command", ps])
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .creation_flags(exec::CREATE_NO_WINDOW | exec::DETACHED_PROCESS)
        .spawn();
    Ok(())
}

/// Rebuild icon cache
pub fn rebuild_icon_cache() -> Result<(), String> {
    let ps = r#"
    Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
    Start-Sleep 1
    Remove-Item "$env:LOCALAPPDATA\IconCache.db" -Force -ErrorAction SilentlyContinue
    Remove-Item "$env:LOCALAPPDATA\Microsoft\Windows\Explorer\iconcache*" -Force -ErrorAction SilentlyContinue
    Start-Process explorer
    @{ success=$true } | ConvertTo-Json
    "#;
    let _ = run_ps(ps);
    Ok(())
}

/// Apply system optimization (services, OneDrive, Xbox, etc.)
pub fn apply_system_optimization(state: serde_json::Value) -> Result<(), String> {
    // Disable OneDrive
    if state["disableOneDrive"].as_bool().unwrap_or(false) {
        let _ = run_ps("Stop-Process -Name OneDrive -Force -ErrorAction SilentlyContinue");
        let _ = run_ps("Uninstall-OnlineOneDrive -ErrorAction SilentlyContinue");
        let _ = run_reg_add(
            "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\Skydrive",
            "DisableFileSync",
            "1",
        );
    }

    // Disable Xbox services
    if state["disableXbox"].as_bool().unwrap_or(false) {
        let services = vec![
            "XblAuthManager", "XblGameSave", "XboxGipSvc", "XboxNetApiSvc",
        ];
        for svc in &services {
            let _ = exec::run_ps(&format!("Stop-Service -Name {} -Force -ErrorAction SilentlyContinue; Set-Service -Name {} -StartupType Disabled -ErrorAction SilentlyContinue", svc, svc));
        }
    }

    // Disable telemetry
    if state["disableTelemetry"].as_bool().unwrap_or(false) {
        let _ = run_reg_add(
            "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection",
            "AllowTelemetry",
            "0",
        );
    }

    // Disable Cortana
    if state["disableCortana"].as_bool().unwrap_or(false) {
        let _ = run_reg_add(
            "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\Windows Search",
            "AllowCortana",
            "0",
        );
    }

    // Disable tips/suggestions
    if state["disableTips"].as_bool().unwrap_or(false) {
        let _ = run_reg_add(
            "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager",
            "SoftLandingEnabled",
            "0",
        );
    }

    Ok(())
}

pub fn get_system_info() -> Result<serde_json::Value, String> {
    let ps = format!("{}\n    $s | ConvertTo-Json -Depth 3\n", super::startup::SYS_PS_BODY);
    let stdout = String::from_utf8_lossy(&exec::run_ps_raw(&ps).stdout).to_string();
    let val: serde_json::Value = serde_json::from_str(&stdout).map_err(|e| e.to_string())?;
    Ok(val)
}
