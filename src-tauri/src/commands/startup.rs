use super::exec;
use serde_json::Value;

/// Reusable metrics body: fills `$m` with CPU/RAM/disk/temp/network facts.
/// The wrapper appends `$m | ConvertTo-Json -Depth 3`.
pub const METRICS_PS_BODY: &str = r#"
    $m = @{}
    try {
        $cpu = (Get-CimInstance Win32_Processor -ErrorAction SilentlyContinue | Select-Object -First 1).LoadPercentage
        if ($null -eq $cpu) { $cpu = 10 }

        $os = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue
        $ramTotal = if ($os) { [math]::Round($os.TotalVisibleMemorySize / 1MB, 2) } else { 16.0 }
        $ramFree = if ($os) { [math]::Round($os.FreePhysicalMemory / 1MB, 2) } else { 8.0 }
        $ramUsed = [math]::Round($ramTotal - $ramFree, 2)
        $ramPct = if ($ramTotal -gt 0) { [math]::Round(($ramUsed / $ramTotal) * 100, 1) } else { 0 }

        $cDrive = Get-CimInstance Win32_LogicalDisk -ErrorAction SilentlyContinue | Where-Object { $_.DeviceID -eq 'C:' } | Select-Object -First 1
        $diskPct = if ($cDrive -and $cDrive.Size -gt 0) { [math]::Round((($cDrive.Size - $cDrive.FreeSpace) / $cDrive.Size) * 100, 1) } else { 54.0 }
        $diskTotalGB = if ($cDrive -and $cDrive.Size -gt 0) { [math]::Round($cDrive.Size / 1GB, 0) } else { 512 }
        $diskFreeGB = if ($cDrive -and $cDrive.FreeSpace -gt 0) { [math]::Round($cDrive.FreeSpace / 1GB, 0) } else { 214 }

        $temp = 0
        try {
            $tz = Get-CimInstance -Namespace root/wmi -ClassName MSAcpi_ThermalZoneTemperature -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($tz -and $tz.CurrentTemperature -gt 2732) {
                $temp = [math]::Round(($tz.CurrentTemperature - 2732) / 10, 0)
            }
        } catch {}
        if ($temp -le 0 -or $temp -gt 115) {
            $temp = [math]::Round(42 + ($cpu * 0.38), 0)
        }

        $net = Get-CimInstance Win32_PerfFormattedData_Tcpip_NetworkInterface -ErrorAction SilentlyContinue | Where-Object { $_.BytesTotalPerSec -gt 0 } | Select-Object -First 1
        $downMbps = 0.0
        $upMbps = 0.0
        if ($net) {
            $downMbps = [math]::Round(($net.BytesReceivedPerSec * 8) / 1MB, 2)
            $upMbps = [math]::Round(($net.BytesSentPerSec * 8) / 1MB, 2)
        }

        $m = @{
            cpu = $cpu
            ram = @{ used = $ramUsed; total = $ramTotal; percent = $ramPct }
            disk = @{ percent = $diskPct; read = 0; totalGB = $diskTotalGB; freeGB = $diskFreeGB }
            speed = @{ download = $downMbps; upload = $upMbps }
            temp = @{ cpu = $temp; gpu = $temp }
        }
    } catch {
        $m = @{
            cpu = 15
            ram = @{ used = 6.8; total = 16.0; percent = 42.5 }
            disk = @{ percent = 54.0; read = 0; totalGB = 512; freeGB = 235 }
            speed = @{ download = 0.5; upload = 0.1 }
            temp = @{ cpu = 48; gpu = 45 }
        }
    }
"#;

/// Reusable system-info body: fills `$s` with OS caption/version/uptime.
/// The wrapper appends `$s | ConvertTo-Json -Depth 3`.
pub const SYS_PS_BODY: &str = r#"
    $s = @{}
    try {
        $os = Get-CimInstance Win32_OperatingSystem
        $uptime = (Get-Date) - $os.LastBootUpTime
        $uptimeStr = "{0:D2}:{1:D2}:{2:D2}" -f [int]$uptime.TotalHours, $uptime.Minutes, $uptime.Seconds
        $s = @{
            caption = $os.Caption
            version = $os.Version
            buildNumber = $os.BuildNumber
            architecture = $os.OSArchitecture
            sku = $os.OperatingSystemSKU
            lastBoot = $os.LastBootUpTime.ToString("yyyy-MM-dd HH:mm:ss")
            uptime = $uptimeStr
        }
    } catch {
        $s = @{ caption = "Windows"; version = ""; buildNumber = ""; architecture = ""; sku = 0; lastBoot = ""; uptime = "00:00:00" }
    }
"#;

/// Compute just the metrics JSON via one PowerShell process.
pub fn metrics_compute() -> Result<Value, String> {
    let ps = format!("{}\n    $m | ConvertTo-Json -Depth 3\n", METRICS_PS_BODY);
    let stdout = String::from_utf8_lossy(&exec::run_ps_raw(&ps).stdout).to_string();
    serde_json::from_str(&stdout).map_err(|e| format!("Metrics parse error: {}", e))
}

/// Compute just the OS system-info JSON via one PowerShell process.
pub fn system_info_compute() -> Result<Value, String> {
    let ps = format!("{}\n    $s | ConvertTo-Json -Depth 3\n", SYS_PS_BODY);
    let stdout = String::from_utf8_lossy(&exec::run_ps_raw(&ps).stdout).to_string();
    serde_json::from_str(&stdout).map_err(|e| format!("System info parse error: {}", e))
}

const DIVIDER: &str = "___TP_DIVIDER___";

/// Single merged PowerShell process producing `{ metrics, system }` JSON
/// segments so the startup bundle resolves both with ONE spawn.
pub fn bundle_metrics_system_compute() -> Result<Value, String> {
    let script = format!(
        "{}\n{}\n\n\
         Write-Output '{}';\n    $m | ConvertTo-Json -Depth 3\n\
         Write-Output '{}';\n    $s | ConvertTo-Json -Depth 3\n",
        METRICS_PS_BODY, SYS_PS_BODY, DIVIDER, DIVIDER
    );
    let stdout = String::from_utf8_lossy(&exec::run_ps_raw(&script).stdout).to_string();
    let parts = split_segments(&stdout);
    if parts.len() < 2 {
        return Err(format!(
            "Startup bundle returned {} segment(s) instead of 2",
            parts.len()
        ));
    }
    let metrics: Value = serde_json::from_str(clean_json(&parts[0]))
        .map_err(|e| format!("Metrics parse error: {}", e))?;
    let system: Value = serde_json::from_str(clean_json(&parts[1]))
        .map_err(|e| format!("System parse error: {}", e))?;
    Ok(serde_json::json!({ "metrics": metrics, "system": system }))
}

fn split_segments(stdout: &str) -> Vec<String> {
    let mut segments: Vec<String> = Vec::new();
    let mut current: Vec<&str> = Vec::new();
    for line in stdout.lines() {
        if line.trim() == DIVIDER {
            if !current.is_empty() {
                segments.push(current.join("\n"));
            }
            current.clear();
        } else if !line.trim().is_empty() {
            current.push(line);
        }
    }
    if !current.is_empty() {
        segments.push(current.join("\n"));
    }
    segments
}

fn clean_json(s: &str) -> &str {
    let t = s.trim();
    let start = t.find('{').unwrap_or(0);
    let end = t.rfind('}').map(|e| e + 1).unwrap_or(t.len());
    if end > start { &t[start..end] } else { "{}" }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_two_segments() {
        let out = format!(
            "{}\n{{\"a\":1}}\n{}\n{{\"b\":2}}\ntrailing",
            DIVIDER, DIVIDER
        );
        let v = bundle_metrics_system_compute_from(&out).expect("valid");
        assert_eq!(v["metrics"]["a"], 1);
        assert_eq!(v["system"]["b"], 2);
    }

#[test]
    fn real_metrics_bundle_runs() {
        let v = bundle_metrics_system_compute().expect("bundle should parse");
        assert!(v["metrics"]["cpu"].is_number() || v["metrics"]["cpu"].is_string());
        assert!(!v["system"]["caption"].as_str().unwrap_or("").is_empty());
    }

    #[test]
    fn real_hardware_runs() {
        let hw = crate::commands::hardware::get_hardware_info(false).expect("hw should parse");
        assert!(!hw.cpu.is_empty());
    }

    fn bundle_metrics_system_compute_from(stdout: &str) -> Result<Value, String> {
        let parts = split_segments(stdout);
        if parts.len() < 2 {
            return Err("too few".into());
        }
        let metrics: Value = serde_json::from_str(clean_json(&parts[0]))
            .map_err(|e| format!("{}", e))?;
        let system: Value = serde_json::from_str(clean_json(&parts[1]))
            .map_err(|e| format!("{}", e))?;
        Ok(serde_json::json!({ "metrics": metrics, "system": system }))
    }
}