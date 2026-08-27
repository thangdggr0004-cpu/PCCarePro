use serde::{Deserialize, Serialize};
use crate::commands::exec;

#[derive(Debug, Serialize, Deserialize)]
pub struct DiskInfo {
    pub model: String,
    pub interface: String,
    pub size: String,
    pub health: String,
    pub temperature: Option<i32>,
    pub is_ssd: bool,
}

/// Get disk information via WMI
pub fn get_disk_info() -> Result<Vec<DiskInfo>, String> {
    let ps_script = r#"
    $disks = Get-CimInstance -ClassName Win32_DiskDrive | Select-Object Model, InterfaceType, Size, MediaType
    $result = @()
    foreach ($disk in $disks) {
        $isSsd = $disk.MediaType -match "SSD"
        $sizeGB = [math]::Round($disk.Size / 1GB, 2)
        $result += @{
            model = $disk.Model
            interface = $disk.InterfaceType
            size = "${sizeGB} GB"
            health = "OK"
            is_ssd = $isSsd
        }
    }
    $result | ConvertTo-Json -Depth 3
    "#;

    let output = exec::run_ps_raw(ps_script);

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    if stdout.trim().is_empty() {
        return Ok(vec![]);
    }

    let parsed: serde_json::Value =
        serde_json::from_str(&stdout).map_err(|e| format!("Parse error: {}", e))?;

    let mut disks = Vec::new();
    if let Some(arr) = parsed.as_array() {
        for item in arr {
            disks.push(DiskInfo {
                model: item["model"].as_str().unwrap_or("Unknown").to_string(),
                interface: item["interface"].as_str().unwrap_or("Unknown").to_string(),
                size: item["size"].as_str().unwrap_or("Unknown").to_string(),
                health: item["health"].as_str().unwrap_or("OK").to_string(),
                temperature: item["temperature"].as_i64().map(|t| t as i32),
                is_ssd: item["is_ssd"].as_bool().unwrap_or(false),
            });
        }
    }

    Ok(disks)
}

/// Run SSD TRIM on all SSD volumes
pub fn run_ssd_trim() -> Result<serde_json::Value, String> {
    let ps_script = r#"
    $volumes = Get-CimInstance -ClassName Win32_Volume | Where-Object { $_.DriveLetter }
    $results = @()
    foreach ($vol in $volumes) {
        try {
            $letter = $vol.DriveLetter
            $result = & defrag "${letter}:" /O /U 2>&1 | Out-String
            $results += @{ drive = $letter; success = $true; output = $result.Trim() }
        } catch {
            $results += @{ drive = $vol.DriveLetter; success = $false; output = $_.Exception.Message }
        }
    }
    @{ success = $true; results = $results } | ConvertTo-Json -Depth 3
    "#;

    let output = exec::run_ps_raw(ps_script);

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let parsed: serde_json::Value =
        serde_json::from_str(&stdout).unwrap_or(serde_json::json!({ "success": false }));

    Ok(parsed)
}
