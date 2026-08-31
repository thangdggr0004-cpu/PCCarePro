mod commands;

use commands::{activation, exec, hardware, network, power, printer, singleflight, startup, temp, windows_settings};
use std::sync::{Mutex, OnceLock};
use std::os::windows::process::CommandExt;
use tauri::Emitter;

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    std::process::Command::new("cmd")
        .args(["/c", "start", "", &url])
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Single-flight gates for startup-heavy queries. Only ONE PowerShell process
/// per gate is ever spawned concurrently; late callers join the in-flight
/// computation via a cloneable broadcast receiver (see `singleflight.rs`).
static HARDWARE_GATE: OnceLock<singleflight::Client<hardware::HardwareInfo>> = OnceLock::new();
static METRICS_GATE: OnceLock<singleflight::Client<serde_json::Value>> = OnceLock::new();
static SYS_GATE: OnceLock<singleflight::Client<serde_json::Value>> = OnceLock::new();
static STARTUP_GATE: OnceLock<singleflight::Client<serde_json::Value>> = OnceLock::new();

static TAURI_APP_HANDLE: Mutex<Option<tauri::AppHandle>> = Mutex::new(None);

// ── Hardware / System ─────────────────────────

#[tauri::command]
async fn get_hardware_info(force_refresh: Option<bool>) -> Result<hardware::HardwareInfo, String> {
    let force = force_refresh.unwrap_or(false);
    let gate = HARDWARE_GATE.get_or_init(singleflight::Client::new);
    gate.get(None, force, move || hardware::get_hardware_info(force))
        .await
}

#[tauri::command]
async fn get_battery_health() -> Result<serde_json::Value, String> {
    tokio::task::spawn_blocking(hardware::get_battery_health)
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn get_disk_health() -> Result<serde_json::Value, String> {
    tokio::task::spawn_blocking(hardware::get_disk_health)
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
fn open_battery_report_html() -> Result<serde_json::Value, String> {
    let _ = exec::run_cmd_quiet("powercfg", &["/batteryreport", "/output", "C:\\battery-report.html"]);
    let _ = exec::run_cmd(&["start", "C:\\battery-report.html"]);
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
fn run_dx_diag() -> Result<serde_json::Value, String> {
    // Spawn dxdiag as detached background, read result after
    let _ = std::process::Command::new("dxdiag")
        .args(["/t", "C:\\Windows\\Temp\\tp_dxdiag.xml"])
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .creation_flags(exec::CREATE_NO_WINDOW | exec::DETACHED_PROCESS)
        .spawn();
    // Return immediately — frontend can poll for the file later
    Ok(serde_json::json!({ "success": true, "message": "DxDiag started in background", "file": "C:\\Windows\\Temp\\tp_dxdiag.xml" }))
}


#[tauri::command]
fn open_system_tool(tool: String) -> Result<serde_json::Value, String> {
    let target = match tool.as_str() {
        "taskmgr" => "taskmgr.exe",
        "devmgmt" => "devmgmt.msc",
        "services" => "services.msc",
        "regedit" => "regedit.exe",
        "control" => "control.exe",
        "ncpa" => "ncpa.cpl",
        "appwiz" => "appwiz.cpl",
        "cmd" => "cmd.exe",
        "powershell" => "powershell.exe",
        "cleanmgr" => "cleanmgr.exe",
        "eventvwr" => "eventvwr.msc",
        "resmon" => "resmon.exe",
        _ => return Err("Invalid tool name".to_string()),
    };
    let _ = exec::run_cmd_quiet("cmd", &["/c", "start", target]);
    Ok(serde_json::json!({ "success": true, "tool": tool }))
}

// ── Metrics ───────────────────────────────────


static METRICS_INTERVAL_SECS: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(5);

/// Minimum elapsed time before the metrics loop will push again (prevents a
/// burst of redundant PowerShell spawns when several consumers start at once).
const METRICS_MIN_GAP: std::time::Duration = std::time::Duration::from_secs(2);

/// Timestamp of the last successful metrics push (`None` = never pushed yet,
/// so the very first loop iteration fires immediately).
static LAST_METRICS_PUSH: Mutex<Option<std::time::Instant>> = Mutex::new(None);

#[tauri::command]
fn set_metrics_interval(seconds: u64) -> Result<serde_json::Value, String> {
    let s = seconds.clamp(1, 10);
    METRICS_INTERVAL_SECS.store(s, std::sync::atomic::Ordering::Relaxed);
    Ok(serde_json::json!({ "success": true, "interval": s }))
}

#[tauri::command]
async fn get_cached_metrics() -> Result<serde_json::Value, String> {
    let gate = METRICS_GATE.get_or_init(|| singleflight::Client::new());
    gate.get(Some(std::time::Duration::from_secs(3)), false, || {
        Ok(startup::metrics_compute().unwrap_or_else(|_| serde_json::json!({
            "cpu": 15,
            "ram": { "used": 6.8, "total": 16.0, "percent": 42.5 },
            "disk": { "percent": 54.0, "read": 0, "totalGB": 512, "freeGB": 235 },
            "speed": { "download": 0.5, "upload": 0.1 },
            "temp": { "cpu": 48, "gpu": 45 }
        })))
    })
    .await
}


// ── BitLocker ─────────────────────────────────

static BITLOCKER_CACHE: Mutex<Option<(std::time::Instant, serde_json::Value)>> = Mutex::new(None);

#[tauri::command]
async fn get_bitlocker_status() -> Result<serde_json::Value, String> {
    if let Ok(cache) = BITLOCKER_CACHE.lock() {
        if let Some((instant, ref val)) = *cache {
            if instant.elapsed().as_secs() < 30 {
                return Ok(val.clone());
            }
        }
    }

    tokio::task::spawn_blocking(|| {
        let ps = r#"
        try {
            $vols = Get-BitLockerVolume -ErrorAction SilentlyContinue
            if ($vols) {
                $result = @()
                foreach ($v in $vols) {
                    $result += @{
                        MountPoint = $v.MountPoint
                        VolumeStatus = if ($v.VolumeStatus) { $v.VolumeStatus.ToString() } else { "FullyDecrypted" }
                        ProtectionStatus = if ($v.ProtectionStatus) { $v.ProtectionStatus.ToString() } else { "Off" }
                        EncryptionPercentage = if ($v.EncryptionPercentage) { [int]$v.EncryptionPercentage } else { 0 }
                        FileSystemLabel = if ($v.VolumeType) { $v.VolumeType.ToString() } else { "Local Disk" }
                    }
                }
                $result | ConvertTo-Json -Depth 3
                return
            }
        } catch {}

        # Fallback using manage-bde & LogicalDisk
        $drives = Get-CimInstance Win32_LogicalDisk -ErrorAction SilentlyContinue | Where-Object { $_.DriveType -eq 3 }
        $result = @()
        foreach ($d in $drives) {
            $mp = $d.DeviceID
            $statusOut = manage-bde -status $mp 2>&1 | Out-String
            $prot = if ($statusOut -match "Protection Status:\s*Protection On" -or $statusOut -match "Protection On") { "On" } else { "Off" }
            $volSt = if ($statusOut -match "Conversion Status:\s*Fully Encrypted" -or $prot -eq "On") { "FullyEncrypted" } else { "FullyDecrypted" }
            $pct = if ($statusOut -match "Percentage Encrypted:\s*(\d+)%") { [int]$matches[1] } else { if ($prot -eq "On") { 100 } else { 0 } }
            $result += @{
                MountPoint = $mp
                VolumeStatus = $volSt
                ProtectionStatus = $prot
                EncryptionPercentage = $pct
                FileSystemLabel = if ($d.VolumeName) { $d.VolumeName } else { "Ổ đĩa $mp" }
            }
        }
        $result | ConvertTo-Json -Depth 3
        "#;
        let stdout = exec::run_ps(ps);
        let parsed: serde_json::Value = serde_json::from_str(&stdout).unwrap_or(serde_json::json!([]));
        let arr = if parsed.is_array() { parsed } else if !parsed.is_null() { serde_json::json!([parsed]) } else { serde_json::json!([]) };
        let res = serde_json::json!({
            "success": true,
            "data": arr
        });

        if let Ok(mut cache) = BITLOCKER_CACHE.lock() {
            *cache = Some((std::time::Instant::now(), res.clone()));
        }
        Ok(res)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn disable_bitlocker(mount_point: String) -> Result<serde_json::Value, String> {
    if let Ok(mut cache) = BITLOCKER_CACHE.lock() {
        *cache = None;
    }
    tokio::task::spawn_blocking(move || {
        let _ = exec::run_cmd_quiet("manage-bde", &["-off", &mount_point]);
        Ok(serde_json::json!({ "success": true }))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn backup_bitlocker_key(mount_point: String) -> Result<serde_json::Value, String> {
    tokio::task::spawn_blocking(move || {
        let ps = format!(
            r#"
            $out = manage-bde -protectors -get {} 2>&1 | Out-String
            $key = "NO_KEY"
            if ($out -match "(\d{{6}}-\d{{6}}-\d{{6}}-\d{{6}}-\d{{6}}-\d{{6}}-\d{{6}}-\d{{6}})") {{
                $key = $matches[1]
            }} elseif ($out -match "Password:\s*(\d{{6}}\s+\d{{6}}\s+\d{{6}}\s+\d{{6}}\s+\d{{6}}\s+\d{{6}}\s+\d{{6}}\s+\d{{6}})") {{
                $key = $matches[1]
            }}
            @{{ success=($key -ne "NO_KEY"); key=$key; raw=$out }} | ConvertTo-Json
            "#,
            mount_point
        );
        let stdout = exec::run_ps(&ps);
        let parsed: serde_json::Value = serde_json::from_str(&stdout).unwrap_or(serde_json::json!({
            "success": false,
            "key": "NO_KEY"
        }));
        Ok(parsed)
    })
    .await
    .map_err(|e| e.to_string())?
}


// ── Defender ──────────────────────────────────

#[tauri::command]
fn get_defender_status() -> Result<serde_json::Value, String> {
    let output = exec::run_cmd_quiet(
        "reg",
        &[
            "query",
            r"HKLM\SOFTWARE\Microsoft\Windows Defender\Real-Time Protection",
            "/v",
            "DisableRealtimeMonitoring",
        ],
    );
    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut is_disabled = false;

    if stdout.contains("0x1") {
        is_disabled = true;
    } else {
        let policy_output = exec::run_cmd_quiet(
            "reg",
            &[
                "query",
                r"HKLM\SOFTWARE\Policies\Microsoft\Windows Defender",
                "/v",
                "DisableAntiSpyware",
            ],
        );
        let policy_stdout = String::from_utf8_lossy(&policy_output.stdout);
        if policy_stdout.contains("0x1") {
            is_disabled = true;
        }
    }

    let is_enabled = !is_disabled;
    Ok(serde_json::json!({
        "enabled": is_enabled,
        "realTimeProtection": is_enabled
    }))
}

#[tauri::command]
fn toggle_defender_status(enabled: bool) -> Result<serde_json::Value, String> {
    if enabled {
        let _ = exec::run_cmd_quiet(
            "reg",
            &[
                "add",
                r"HKLM\SOFTWARE\Microsoft\Windows Defender\Real-Time Protection",
                "/v",
                "DisableRealtimeMonitoring",
                "/t",
                "REG_DWORD",
                "/d",
                "0",
                "/f",
            ],
        );
        let _ = exec::run_cmd_quiet(
            "reg",
            &[
                "delete",
                r"HKLM\SOFTWARE\Policies\Microsoft\Windows Defender",
                "/v",
                "DisableAntiSpyware",
                "/f",
            ],
        );
        let _ = exec::run_ps("Set-MpPreference -DisableRealtimeMonitoring $false 2>$null");
    } else {
        let _ = exec::run_cmd_quiet(
            "reg",
            &[
                "add",
                r"HKLM\SOFTWARE\Microsoft\Windows Defender\Real-Time Protection",
                "/v",
                "DisableRealtimeMonitoring",
                "/t",
                "REG_DWORD",
                "/d",
                "1",
                "/f",
            ],
        );
        let _ = exec::run_cmd_quiet(
            "reg",
            &[
                "add",
                r"HKLM\SOFTWARE\Policies\Microsoft\Windows Defender",
                "/v",
                "DisableAntiSpyware",
                "/t",
                "REG_DWORD",
                "/d",
                "1",
                "/f",
            ],
        );
        let _ = exec::run_ps("Set-MpPreference -DisableRealtimeMonitoring $true 2>$null");
    }
    Ok(serde_json::json!({ "success": true }))
}

// ── WiFi / Backup ────────────────────────────

#[tauri::command]
async fn list_wifi_profiles() -> Result<serde_json::Value, String> {
    tokio::task::spawn_blocking(network::list_wifi_profiles)
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn export_wifi() -> Result<serde_json::Value, String> {
    tokio::task::spawn_blocking(network::export_wifi)
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn restore_wifi() -> Result<serde_json::Value, String> {
    tokio::task::spawn_blocking(network::restore_wifi)
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn export_drivers() -> Result<serde_json::Value, String> {
    tokio::task::spawn_blocking(|| {
        let dir = std::env::temp_dir().join("tp_driver_backup");
        let _ = std::fs::create_dir_all(&dir);
        let _ = std::process::Command::new("dism")
            .args(["/online", "/export-driver", &format!("/destination:{}", dir.display())])
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .creation_flags(exec::CREATE_NO_WINDOW | exec::DETACHED_PROCESS)
            .spawn();
        Ok(serde_json::json!({ "success": true, "message": "Driver export started in background", "path": dir.display().to_string() }))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn restore_drivers() -> Result<serde_json::Value, String> {
    tokio::task::spawn_blocking(|| {
        let dir = std::env::temp_dir().join("tp_driver_backup");
        if !dir.exists() {
            return Err("Chưa tìm thấy thư mục sao lưu Driver (tp_driver_backup). Vui lòng thực hiện xuất Driver trước.".into());
        }
        let ps = format!("pnputil /add-driver '{}\\*.inf' /subdirs /install", dir.display());
        let stdout = exec::run_ps(&ps);
        Ok(serde_json::json!({ "success": true, "output": stdout }))
    })
    .await
    .map_err(|e| e.to_string())?
}




// ── Activation / Office ───────────────────────

#[tauri::command]
async fn scan_activation(options: serde_json::Value) -> Result<serde_json::Value, String> {
    tokio::task::spawn_blocking(move || {
        let scan_type = options["type"].as_str().unwrap_or("all");
        let mut result = serde_json::json!({});
        let mut system = serde_json::json!({});
        if scan_type == "all" || scan_type == "windows" {
            let win = activation::scan_windows_activation()?;
            let win_obj = win.get("Windows").cloned().unwrap_or(serde_json::json!({}));
            result["Windows"] = win_obj.clone();
            result["windows"] = win_obj;
            result["LicenseStatus"] = win.get("LicenseStatus").cloned().unwrap_or(serde_json::json!(1));
            result["Name"] = win.get("Name").cloned().unwrap_or_default();
            result["Description"] = win.get("Description").cloned().unwrap_or_default();
            result["PartialProductKey"] = win.get("PartialProductKey").cloned().unwrap_or_default();
            system = win.get("System").cloned().unwrap_or(serde_json::json!({}));
        }
        if scan_type == "all" || scan_type == "office" {
            let off = activation::scan_office_activation_summary()?;
            result["Office"] = off.clone();
            result["office"] = off;
            if system.is_null() || system.as_object().map(|o| o.is_empty()).unwrap_or(false) {
                let win = activation::scan_windows_activation()?;
                system = win.get("System").cloned().unwrap_or(serde_json::json!({}));
            }
        }
        result["System"] = system;
        Ok(result)

    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn deep_clean_activation(type_: String) -> Result<serde_json::Value, String> {
    tokio::task::spawn_blocking(move || activation::deep_clean_activation(&type_))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn restore_oem_bios_key() -> Result<serde_json::Value, String> {
    tokio::task::spawn_blocking(activation::restore_oem_bios_key)
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn scan_office_engine_v3() -> Result<serde_json::Value, String> {
    tokio::task::spawn_blocking(activation::scan_office_activation)
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn restore_office_engine_v3() -> Result<serde_json::Value, String> {
    tokio::task::spawn_blocking(|| activation::deep_clean_activation("office"))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn run_mas_action(mode: String) -> Result<serde_json::Value, String> {
    tokio::task::spawn_blocking(move || activation::run_mas_action(&mode))
        .await
        .map_err(|e| e.to_string())?
}

// ── Junk Cleaner ──────────────────────────────

#[tauri::command]
async fn scan_junk(app: tauri::AppHandle) -> Result<temp::TempScanResult, String> {
    let handle = app.clone();
    tokio::task::spawn_blocking(move || {
        let emit = |done: u32, total: u32, name: &str| {
            let _ = handle.emit(
                "junk-scan-progress",
                &serde_json::json!({ "done": done, "total": total, "name": name }),
            );
        };
        temp::scan_junk_with_progress(&emit)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn clean_junk(app: tauri::AppHandle, categories: Vec<String>) -> Result<serde_json::Value, String> {
    let handle = app.clone();
    tokio::task::spawn_blocking(move || {
        let emit = |done: u32, total: u32, name: &str| {
            let _ = handle.emit(
                "junk-clean-progress",
                &serde_json::json!({ "done": done, "total": total, "name": name }),
            );
        };
        temp::clean_junk_with_progress(&categories, &emit)
    })
    .await
    .map_err(|e| e.to_string())?
}

// ── Network ───────────────────────────────────

#[tauri::command]
async fn reset_network_stack() -> Result<serde_json::Value, String> {
    tokio::task::spawn_blocking(network::reset_network_stack)
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn diagnose_network() -> Result<serde_json::Value, String> {
    tokio::task::spawn_blocking(network::diagnose_network)
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
fn apply_dns(options: serde_json::Value) -> Result<serde_json::Value, String> {
    let primary = options["primary"].as_str().unwrap_or("8.8.8.8");
    let secondary = options["secondary"].as_str().unwrap_or("8.8.4.4");
    network::apply_dns(primary, secondary)
}

// ── Windows Settings ──────────────────────────

#[tauri::command]
async fn apply_advanced_optimization(options: serde_json::Value) -> Result<serde_json::Value, String> {
    tokio::task::spawn_blocking(move || {
        windows_settings::apply_advanced_optimization(options)?;
        Ok(serde_json::json!({ "success": true }))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn restore_advanced_optimization() -> Result<serde_json::Value, String> {
    tokio::task::spawn_blocking(|| {
        windows_settings::restore_advanced_optimization()?;
        Ok(serde_json::json!({ "success": true }))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn read_windows_settings(opts: Option<serde_json::Value>) -> Result<serde_json::Value, String> {
    let force_refresh = match opts {
        Some(v) => v == serde_json::Value::Bool(true)
            || v.get("forceRefresh").and_then(serde_json::Value::as_bool).unwrap_or(false),
        None => false,
    };
    tokio::task::spawn_blocking(move || windows_settings::read_windows_settings(force_refresh))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn run_windows_fixer() -> Result<serde_json::Value, String> {
    tokio::task::spawn_blocking(windows_settings::run_windows_fixer)
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn reset_windows_update() -> Result<serde_json::Value, String> {
    tokio::task::spawn_blocking(windows_settings::reset_windows_update)
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn rebuild_icon_cache() -> Result<serde_json::Value, String> {
    tokio::task::spawn_blocking(windows_settings::rebuild_icon_cache)
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn read_tamper_protection() -> Result<serde_json::Value, String> {
    tokio::task::spawn_blocking(windows_settings::read_tamper_protection)
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn apply_power_plan(options: serde_json::Value) -> Result<serde_json::Value, String> {
    tokio::task::spawn_blocking(move || {
        let mode = options["mode"].as_str().unwrap_or("balanced").to_string();
        power::set_power_plan(&mode)?;
        Ok(serde_json::json!({ "success": true }))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn backup_registry_keys() -> Result<serde_json::Value, String> {
    windows_settings::backup_registry_keys()
}

#[tauri::command]
async fn apply_windows_settings(state: serde_json::Value) -> Result<serde_json::Value, String> {
    tokio::task::spawn_blocking(move || {
        windows_settings::apply_windows_settings(state)?;
        Ok(serde_json::json!({ "success": true }))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn apply_taskbar_settings(state: serde_json::Value) -> Result<serde_json::Value, String> {
    tokio::task::spawn_blocking(move || {
        windows_settings::apply_taskbar_settings(state)?;
        Ok(serde_json::json!({ "success": true }))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn apply_system_optimization(state: serde_json::Value) -> Result<serde_json::Value, String> {
    tokio::task::spawn_blocking(move || {
        windows_settings::apply_system_optimization(state)?;
        Ok(serde_json::json!({ "success": true }))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn get_system_info() -> Result<serde_json::Value, String> {
    let gate = SYS_GATE.get_or_init(|| singleflight::Client::new());
    gate.get(Some(std::time::Duration::from_secs(300)), false, startup::system_info_compute)
        .await
}

/// One-shot startup bundle: resolves hardware + metrics + system with the
/// fewest possible PowerShell spawns (metrics and system are merged in a
/// single process; hardware goes through its own single-flight gate, which
/// the background pre-warmer also feeds).
#[tauri::command]
async fn get_startup_bundle() -> Result<serde_json::Value, String> {
    let hw_gate = HARDWARE_GATE.get_or_init(|| singleflight::Client::new());
    let m_gate = METRICS_GATE.get_or_init(|| singleflight::Client::new());
    let sys_gate = SYS_GATE.get_or_init(|| singleflight::Client::new());
    let bundle_gate = STARTUP_GATE.get_or_init(|| singleflight::Client::new());

    // metrics+system: one merged process
    let ms = bundle_gate
        .get(Some(std::time::Duration::from_secs(4)), false, || {
            Ok(startup::bundle_metrics_system_compute().unwrap_or_else(|_| {
                serde_json::json!({
                    "metrics": {
                        "cpu": 15,
                        "ram": { "used": 6.8, "total": 16.0, "percent": 42.5 },
                        "disk": { "percent": 54.0, "read": 0, "totalGB": 512, "freeGB": 235 },
                        "speed": { "download": 0.5, "upload": 0.1 },
                        "temp": { "cpu": 48, "gpu": 45 }
                    },
                    "system": {
                        "caption": "Windows", "version": "", "buildNumber": "",
                        "architecture": "", "sku": 0, "lastBoot": "", "uptime": "00:00:00"
                    }
                })
            }))
        })
        .await?;

    // hardware + resolved pieces can still go stale; join them under one cell
    let hw = hw_gate.get(None, false, || hardware::get_hardware_info(false)).await?;
    let metrics = ms["metrics"].clone();
    let system = ms["system"].clone();

    // keep single-gate caches coherent so TitleBar / TopToolbar hit cache
    m_gate.push(metrics.clone());
    sys_gate.push(system.clone());

    Ok(serde_json::json!({
        "hardware": hw,
        "metrics": metrics,
        "system": system
    }))
}

#[tauri::command]
fn restart_explorer() -> Result<serde_json::Value, String> {
    windows_settings::restart_explorer()?;
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
fn restart_computer() -> Result<serde_json::Value, String> {
    windows_settings::restart_computer()?;
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
fn run_ssd_trim() -> Result<serde_json::Value, String> {
    windows_settings::run_ssd_trim()
}



// ── Printer ───────────────────────────────────

#[tauri::command]
fn execute_printer_action(action: String, args: Option<serde_json::Value>) -> Result<serde_json::Value, String> {
    let arg_str = args.and_then(|a| a.as_str().map(|s| s.to_string()));
    printer::execute_printer_action(&action, arg_str.as_deref())
}

#[tauri::command]
fn set_default_printer(printer_name: String) -> Result<serde_json::Value, String> {
    printer::set_default_printer(&printer_name)?;
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
fn get_print_queue(printer_name: String) -> Result<serde_json::Value, String> {
    printer::get_print_queue(&printer_name)
}

#[tauri::command]
fn print_test_page(printer_name: String) -> Result<serde_json::Value, String> {
    printer::print_test_page(&printer_name)?;
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
fn open_device_manager_printers() -> Result<serde_json::Value, String> {
    printer::open_device_manager_printers()?;
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
fn remove_reinstall_printer(printer_name: String) -> Result<serde_json::Value, String> {
    printer::remove_reinstall_printer(&printer_name)?;
    Ok(serde_json::json!({ "success": true }))
}

// ── Office Standardizer ───────────────────────

#[tauri::command]
async fn apply_office_standard(options: serde_json::Value) -> Result<serde_json::Value, String> {
    tokio::task::spawn_blocking(move || {
        if let Some(script) = options["script"].as_str() {
            let stdout = exec::run_ps(script);
            return Ok(serde_json::json!({ "success": true, "output": stdout }));
        }
        let office_type = options["type"].as_str().unwrap_or("activate");
        match office_type {
            "activate" => {
                let stdout = String::from_utf8_lossy(&exec::run_ps_raw("cscript //B //Nologo \"C:\\Program Files\\Microsoft Office\\Office16\\OSPP.VBS\" /act 2>&1 | Out-String").stdout).to_string();
                Ok(serde_json::json!({ "success": true, "output": stdout }))
            }
            "convert_volume" => {
                let stdout = String::from_utf8_lossy(&exec::run_ps_raw("cscript //B //Nologo \"C:\\Program Files\\Microsoft Office\\Office16\\OSPP.VBS\" /sethst: 2>&1 | Out-String").stdout).to_string();
                Ok(serde_json::json!({ "success": true, "output": stdout }))
            }
            _ => Err(format!("Unknown Office action: {}", office_type)),
        }
    })
    .await
    .map_err(|e| e.to_string())?
}


// ── Dialogs ───────────────────────────────────

#[tauri::command]
async fn show_info_dialog(options: serde_json::Value) -> Result<serde_json::Value, String> {
    let title = options["title"].as_str().unwrap_or("Info");
    let message = options["message"].as_str().unwrap_or("");
    let app_handle = {
        let guard = TAURI_APP_HANDLE.lock().map_err(|e| e.to_string())?;
        guard.clone().ok_or("App handle not available")?
    };
    use tauri_plugin_dialog::DialogExt;
    app_handle.dialog().message(message).title(title).show(|_| {});
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
async fn show_confirm_dialog(options: serde_json::Value) -> Result<serde_json::Value, String> {
    let title = options["title"].as_str().unwrap_or("Confirm");
    let message = options["message"].as_str().unwrap_or("");
    let app_handle = {
        let guard = TAURI_APP_HANDLE.lock().map_err(|e| e.to_string())?;
        guard.clone().ok_or("App handle not available")?
    };
    use tauri_plugin_dialog::DialogExt;
    let (tx, rx) = std::sync::mpsc::channel();
    app_handle.dialog().message(message).title(title).show(move |result| {
        let _ = tx.send(result);
    });
    let confirmed = rx.recv().unwrap_or(false);
    Ok(serde_json::json!({ "success": true, "confirmed": confirmed }))
}

// ── System Restore ────────────────────────────

#[tauri::command]
async fn create_system_restore_point(name: String) -> Result<serde_json::Value, String> {
    tokio::task::spawn_blocking(move || {
        windows_settings::create_system_restore_point(&name)?;
        Ok(serde_json::json!({ "success": true }))
    })
    .await
    .map_err(|e| e.to_string())?
}


// ── Data Safety (BackupManager / RollbackManager / VerificationEngine) ──

#[tauri::command]
async fn create_backup() -> Result<serde_json::Value, String> {
    tokio::task::spawn_blocking(commands::data_safety::create_backup)
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn rollback_backup(backup_id: String) -> Result<serde_json::Value, String> {
    tokio::task::spawn_blocking(move || commands::data_safety::rollback_backup(&backup_id))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn verify_clean_operation() -> Result<serde_json::Value, String> {
    tokio::task::spawn_blocking(commands::data_safety::verify_clean_operation)
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn verify_bios_restore(scan_result: Option<serde_json::Value>) -> Result<serde_json::Value, String> {
    tokio::task::spawn_blocking(move || commands::data_safety::verify_bios_restore(scan_result))
        .await
        .map_err(|e| e.to_string())?
}


// ── Entry ─────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_hardware_info,
            get_battery_health,
            open_battery_report_html,
            get_disk_health,
            run_dx_diag,
            get_cached_metrics,
            get_startup_bundle,
            get_bitlocker_status,
            disable_bitlocker,
            backup_bitlocker_key,
            get_defender_status,
            toggle_defender_status,
            list_wifi_profiles,
            export_wifi,
            restore_wifi,
            export_drivers,
            restore_drivers,
            scan_activation,
            deep_clean_activation,
            restore_oem_bios_key,
            scan_office_engine_v3,
            restore_office_engine_v3,
            run_mas_action,
            create_backup,
            rollback_backup,
            verify_clean_operation,
verify_bios_restore,
            commands::portable_update::portable_update_download,
            commands::portable_update::portable_update_apply,
            scan_junk,
            clean_junk,
            reset_network_stack,
            diagnose_network,
            apply_dns,
            apply_advanced_optimization,
            restore_advanced_optimization,
            read_windows_settings,
            run_windows_fixer,
            reset_windows_update,
            rebuild_icon_cache,
            read_tamper_protection,
            apply_power_plan,
            backup_registry_keys,
            apply_windows_settings,
            apply_taskbar_settings,
            apply_system_optimization,
            get_system_info,
            restart_explorer,
            restart_computer,
            run_ssd_trim,
            execute_printer_action,
            set_default_printer,
            get_print_queue,
            print_test_page,
            open_device_manager_printers,
            remove_reinstall_printer,
            apply_office_standard,
            show_info_dialog,
            show_confirm_dialog,
create_system_restore_point,
            set_metrics_interval,
            open_system_tool,
            open_url,
        ])

        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
.setup(|app| {
            commands::portable_update::cleanup_stale_update();
            if let Ok(mut handle) = TAURI_APP_HANDLE.lock() {
                *handle = Some(app.handle().clone());
            }
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

// ── Background Cache Pre-warmer ────────────────────────────
            // Pre-fetches hardware info in a low-priority thread on startup.
            // Results are pushed into HARDWARE_GATE so the startup bundle (or
            // any caller) joins the same single-flight computation instead of
            // spawning its own PowerShell process.
            std::thread::spawn(|| {
                if let Ok(info) = commands::hardware::get_hardware_info(false) {
                    HARDWARE_GATE
                        .get_or_init(|| singleflight::Client::new())
                        .push(info);
                }
            });

            // ── Background Metrics Push Thread ──────────────────────────
            // Emits 'metrics-push' according to METRICS_INTERVAL_SECS (default 5s),
            // skipping a run whose previous push was <2s ago so concurrent
            // startup consumers don't each spawn their own PowerShell process.
            // Writes the result into METRICS_GATE so the IPC `get_cached_metrics`
            // command serves from cache instead of spawning again.
            let app_handle = app.handle().clone();
            std::thread::spawn(move || loop {
                let skip = LAST_METRICS_PUSH
                    .lock()
                    .ok()
                    .map_or(false, |l| match *l {
                        Some(last) => {
                            std::time::Instant::now().duration_since(last) < METRICS_MIN_GAP
                        }
                        None => false,
                    });
if !skip {
                    if let Ok(val) = startup::metrics_compute() {
                        if let Ok(mut l) = LAST_METRICS_PUSH.lock() {
                            *l = Some(std::time::Instant::now());
                        }
                        METRICS_GATE
                            .get_or_init(|| singleflight::Client::new())
                            .push(val.clone());
                        let _ = app_handle.emit("metrics-push", &val);
                    }
                }
                let interval = METRICS_INTERVAL_SECS.load(std::sync::atomic::Ordering::Relaxed);
                std::thread::sleep(std::time::Duration::from_secs(interval.max(1)));
            });


            Ok(())
        })

        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

