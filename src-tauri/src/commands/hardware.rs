use serde::{Deserialize, Serialize};
use std::sync::Mutex;

static HARDWARE_CACHE: Mutex<Option<HardwareInfo>> = Mutex::new(None);

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct HardwareInfo {
    #[serde(default)]
    pub cpu: String,
    #[serde(default)]
    pub cpu_cores: u32,
    #[serde(default)]
    pub cpu_threads: u32,
    #[serde(default)]
    pub cpu_speed_ghz: f64,
    #[serde(default)]
    pub ram: String,
    #[serde(default)]
    pub ram_used: String,
    #[serde(default)]
    pub ram_speed: String,
    #[serde(default)]
    pub ram_type: String,
    #[serde(default)]
    pub ram_slots: Vec<RamSlot>,
    #[serde(default)]
    pub ram_max_upgradable: u32,
    #[serde(default)]
    pub is_all_soldered: bool,
    #[serde(default)]
    pub gpu: String,
    #[serde(default)]
    pub gpu_vram: String,
    #[serde(default)]
    pub mainboard: String,
    #[serde(default)]
    pub bios: String,
    #[serde(default)]
    pub os: String,
    #[serde(default)]
    pub disks: Vec<DiskInfo>,
    #[serde(default)]
    pub display_resolution: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RamSlot {
    #[serde(default)]
    pub slot: String,
    #[serde(default)]
    pub capacity: String,
    #[serde(default)]
    pub speed: String,
    #[serde(default)]
    pub ram_type: String,
    #[serde(default)]
    pub form_factor: String,
    #[serde(default)]
    pub manufacturer: String,
    #[serde(default)]
    pub part_number: String,
    #[serde(default)]
    pub is_soldered: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DiskInfo {
    #[serde(default)]
    pub model: String,
    #[serde(default)]
    pub interface: String,
    #[serde(default)]
    pub size: String,
    #[serde(default)]
    pub is_ssd: bool,
    #[serde(default)]
    pub health: String,
}

fn run_ps(script: &str) -> String {
    crate::commands::exec::run_ps(script)
}

fn run_ps_json(script: &str) -> serde_json::Value {
    let stdout = run_ps(script);
    serde_json::from_str(&stdout).unwrap_or(serde_json::json!({}))
}

pub const HW_PS_BODY: &str = r#"
    $r = @{}
    # CPU
    try {
        $cpu = Get-CimInstance Win32_Processor | Select -First 1
        $r.cpu = $cpu.Name.Trim()
        $r.cpu_cores = [int]$cpu.NumberOfCores
        $r.cpu_threads = [int]$cpu.NumberOfLogicalProcessors
        $r.cpu_speed_ghz = [math]::Round($cpu.MaxClockSpeed / 1000, 2)
    } catch {}

    # RAM
    try {
        $ramModules = @(Get-CimInstance Win32_PhysicalMemory)
        $memArray = Get-CimInstance Win32_PhysicalMemoryArray | Select-Object -First 1
        $totalRam = (Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory
        $r.ram = "$([math]::Round($totalRam/1GB, 2)) GB"
        $r.ram_used = "$([math]::Round((Get-CimInstance Win32_OperatingSystem).TotalVisibleMemorySize / 1MB, 2)) GB"

        function Get-RamTypeName([int]$smbiosType) {
            switch ($smbiosType) {
                20 { "DDR" }
                21 { "DDR2" }
                22 { "DDR2 FB-DIMM" }
                24 { "DDR3" }
                26 { "DDR4" }
                27 { "LPDDR" }
                28 { "LPDDR2" }
                29 { "LPDDR3" }
                30 { "LPDDR4x" }
                31 { "NVDIMM" }
                32 { "HBM" }
                33 { "HBM2" }
                34 { "DDR5" }
                35 { "LPDDR5" }
                36 { "HBM3" }
                default { "DDR4" }
            }
        }

        # Tập mã LPDDR hàn liền trên bo mạch
        $lpddrTypes = @(27, 28, 29, 30, 35)

        $solderedChips = @()
        $removableSlots = @()

        foreach ($m in $ramModules) {
            $smbiosType = [int]$m.SMBIOSMemoryType
            if ($smbiosType -in $lpddrTypes) {
                $solderedChips += $m
            } else {
                $removableSlots += $m
            }
        }

        $slots = @()
        $slotIndex = 1

        # 1. Nếu là chip LPDDR hàn liền: Gộp toàn bộ thành 1 khối On-board duy nhất
        if ($solderedChips.Count -gt 0) {
            $totalBytes = ($solderedChips | Measure-Object -Property Capacity -Sum).Sum
            $totalGB = [math]::Round($totalBytes / 1GB, 0)
            $first = $solderedChips[0]
            $typeName = Get-RamTypeName ([int]$first.SMBIOSMemoryType)
            $mfg = if ($first.Manufacturer -and $first.Manufacturer.Trim()) { $first.Manufacturer.Trim() } else { "On-board Memory" }
            $part = if ($first.PartNumber -and $first.PartNumber.Trim()) { $first.PartNumber.Trim() } else { "" }

            $slots += @{
                slot = "1"
                capacity = "$totalGB GB"
                speed = "$($first.Speed) MHz"
                ram_type = $typeName
                form_factor = "On-Board"
                manufacturer = $mfg
                part_number = $part
                is_soldered = $true
            }
            $slotIndex++
        }

        # 2. Với các khe cắm rời (SODIMM / DIMM): Giữ nguyên từng khe riêng biệt
        foreach ($m in $removableSlots) {
            $capGB = [math]::Round($m.Capacity / 1GB, 0)
            $typeName = Get-RamTypeName ([int]$m.SMBIOSMemoryType)
            $mfg = if ($m.Manufacturer -and $m.Manufacturer.Trim()) { $m.Manufacturer.Trim() } else { "OEM Module" }
            $part = if ($m.PartNumber -and $m.PartNumber.Trim()) { $m.PartNumber.Trim() } else { "" }
            $ff = if ($m.FormFactor -eq 12 -or $m.FormFactor -eq 13) { "SODIMM" } else { "DIMM" }

            $slots += @{
                slot = "$slotIndex"
                capacity = "$capGB GB"
                speed = "$($m.Speed) MHz"
                ram_type = $typeName
                form_factor = $ff
                manufacturer = $mfg
                part_number = $part
                is_soldered = $false
            }
            $slotIndex++
        }

        $r.ram_slots = $slots

        if ($ramModules.Count -gt 0) {
            $r.ram_speed = "$($ramModules[0].Speed) MHz"
            $r.ram_type = Get-RamTypeName ([int]$ramModules[0].SMBIOSMemoryType)
        }

        # Lấy dung lượng tối đa qua MaxCapacityEx / MaxCapacity
        $maxCapKB = 0
        if ($memArray) {
            if ($memArray.MaxCapacityEx -and [int64]$memArray.MaxCapacityEx -gt 0) {
                $maxCapKB = [int64]$memArray.MaxCapacityEx
            } elseif ($memArray.MaxCapacity -and [int64]$memArray.MaxCapacity -gt 0) {
                $maxCapKB = [int64]$memArray.MaxCapacity
            }
        }
        $r.ram_max_upgradable = if ($maxCapKB -gt 0) { [math]::Round($maxCapKB / 1MB, 0) } else { 0 }
        $r.is_all_soldered = ($removableSlots.Count -eq 0 -and $solderedChips.Count -gt 0)
    } catch {}


    # GPU
    try {
        $gpu = Get-CimInstance Win32_VideoController | Select -First 1
        $r.gpu = $gpu.Name
        $vram = [math]::Round($gpu.AdapterRAM / 1MB, 0)
        $r.gpu_vram = "${vram} MB"
        $r.display_resolution = "$($gpu.CurrentHorizontalResolution)x$($gpu.CurrentVerticalResolution)"
    } catch {}

    # Mainboard
    try {
        $mb = Get-CimInstance Win32_BaseBoard | Select -First 1
        $r.mainboard = "$($mb.Manufacturer) $($mb.Product)"
    } catch {}

    # BIOS
    try {
        $b = Get-CimInstance Win32_BIOS | Select -First 1
        $r.bios = "$($b.Manufacturer) $($b.SMBIOSBIOSVersion) v$($b.SMBIOSMajorVersion).$($b.SMBIOSMinorVersion)"
    } catch {}

    # OS
    try {
        $os = Get-CimInstance Win32_OperatingSystem | Select -First 1
        $r.os = $os.Caption
    } catch {}

    # Disks
    try {
        $physMap = @{}
        try {
            Get-PhysicalDisk -ErrorAction SilentlyContinue | ForEach-Object {
                if ($_.FriendlyName) { $physMap[$_.FriendlyName] = $_.MediaType }
                if ($null -ne $_.DeviceId) { $physMap["$($_.DeviceId)"] = $_.MediaType }
            }
        } catch {}

        $disks = Get-CimInstance Win32_DiskDrive -ErrorAction SilentlyContinue | Select-Object Model, InterfaceType, Size, MediaType, Index
        $dList = @()
        foreach ($d in $disks) {
            $mType = $physMap[$d.Model]
            if (-not $mType -and $null -ne $d.Index) { $mType = $physMap["$($d.Index)"] }
            $isSsd = ($mType -eq 'SSD') -or ($d.MediaType -match "SSD|NVMe") -or ($d.Model -match "(?i)SSD|NVMe|NVC|KIOXIA|Samsung|Kingston|WD|Crucial|Hailan|Lexar|Micron|Solid|Flash")
            $sizeGB = [math]::Round($d.Size / 1GB, 2)
            $dList += @{
                model = $d.Model
                interface = if ($isSsd) { if ($d.Model -match "(?i)NVMe") { "NVMe" } else { "SATA" } } else { $d.InterfaceType }
                size = "${sizeGB} GB"
                is_ssd = $isSsd
                health = "OK"
            }
        }
        $r.disks = $dList
    } catch {}
"#;

pub fn get_hardware_info(force_refresh: bool) -> Result<HardwareInfo, String> {
    if !force_refresh {
        if let Ok(cache) = HARDWARE_CACHE.lock() {
            if let Some(ref info) = *cache {
                return Ok(info.clone());
            }
        }
    }

    let ps_script = format!("{}\n    $r | ConvertTo-Json -Depth 4\n", HW_PS_BODY);

    let val = run_ps_json(&ps_script);

    let info = HardwareInfo {
        cpu: val["cpu"].as_str().unwrap_or("N/A").into(),
        cpu_cores: val["cpu_cores"].as_u64().unwrap_or(0) as u32,
        cpu_threads: val["cpu_threads"].as_u64().unwrap_or(0) as u32,
        cpu_speed_ghz: val["cpu_speed_ghz"].as_f64().unwrap_or(0.0),
        ram: val["ram"].as_str().unwrap_or("N/A").into(),
        ram_used: val["ram_used"].as_str().unwrap_or("N/A").into(),
        ram_speed: val["ram_speed"].as_str().unwrap_or("N/A").into(),
        ram_type: val["ram_type"].as_str().unwrap_or("N/A").into(),
        ram_max_upgradable: val["ram_max_upgradable"].as_u64().unwrap_or(0) as u32,
        is_all_soldered: val["is_all_soldered"].as_bool().unwrap_or(false),
        gpu: val["gpu"].as_str().unwrap_or("N/A").into(),
        gpu_vram: val["gpu_vram"].as_str().unwrap_or("N/A").into(),
        mainboard: val["mainboard"].as_str().unwrap_or("N/A").into(),
        bios: val["bios"].as_str().unwrap_or("N/A").into(),
        os: val["os"].as_str().unwrap_or("N/A").into(),
        display_resolution: val["display_resolution"].as_str().unwrap_or("N/A").into(),
        ram_slots: serde_json::from_value(val["ram_slots"].clone()).unwrap_or_default(),
        disks: serde_json::from_value(val["disks"].clone()).unwrap_or_default(),
    };


    if let Ok(mut cache) = HARDWARE_CACHE.lock() {
        *cache = Some(info.clone());
    }

    Ok(info)
}

pub fn get_battery_health() -> Result<serde_json::Value, String> {
    let ps = r#"
    try {
        $b = Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue | Select-Object -First 1
        if (-not $b) {
            @{ noBattery=$true; percent=0; isCharging=$false; designCapacity=0; fullChargeCapacity=0; cycleCount=0; healthPercent=0; timeRemaining=-1 } | ConvertTo-Json
            return
        }

        $xmlPath = "$env:TEMP\tp_batt.xml"
        powercfg /batteryreport /xml /output $xmlPath 2>&1 | Out-Null
        $design = 0
        $full = 0
        $cycles = 0

        if (Test-Path $xmlPath) {
            try {
                [xml]$xml = Get-Content $xmlPath -Raw -ErrorAction SilentlyContinue
                $batInfo = $xml.BatteryReport.Batteries.Battery | Select-Object -First 1
                if ($batInfo) {
                    $design = [int]($batInfo.DesignCapacity)
                    $full = [int]($batInfo.FullChargeCapacity)
                    $cycles = [int]($batInfo.CycleCount)
                }
            } catch {}
        }

        if ($design -eq 0 -and $b.DesignCapacity) { $design = [int]$b.DesignCapacity }
        if ($full -eq 0 -and $b.FullChargeCapacity) { $full = [int]$b.FullChargeCapacity }

        $hp = if ($design -gt 0 -and $full -gt 0) { [math]::Round(($full / $design) * 100, 1) } else { 100 }
        $tr = if ($b.EstimatedRunTime -and $b.EstimatedRunTime -ne 71582788) { $b.EstimatedRunTime } else { -1 }

        @{
            noBattery = $false
            percent = [int]$b.EstimatedChargeRemaining
            isCharging = ($b.BatteryStatus -eq 2 -or $b.BatteryStatus -eq 6)
            designCapacity = $design
            fullChargeCapacity = $full
            cycleCount = $cycles
            healthPercent = $hp
            timeRemaining = $tr
        } | ConvertTo-Json
    } catch {
        @{ noBattery=$true; percent=0; isCharging=$false; designCapacity=0; fullChargeCapacity=0; cycleCount=0; healthPercent=0; timeRemaining=-1 } | ConvertTo-Json
    }
    "#;
    let stdout = run_ps(ps);
    serde_json::from_str(&stdout).map_err(|e| format!("Parse error: {}", e))
}

pub fn get_disk_health() -> Result<serde_json::Value, String> {
    let ps = r#"
    try {
        $disks = Get-CimInstance Win32_DiskDrive -ErrorAction SilentlyContinue | Select-Object DeviceID, PNPDeviceID, Model, MediaType, Size, InterfaceType
        $physical = Get-PhysicalDisk -ErrorAction SilentlyContinue
        $smart = Get-CimInstance -Namespace root\wmi -ClassName MSStorageDriver_FailurePredictStatus -ErrorAction SilentlyContinue
        $result = @()

        foreach ($d in $disks) {
            $hasFailure = $false
            $reason = ''
            if ($smart -and $d.PNPDeviceID) {
                $s = $smart | Where-Object { $_.InstanceName -like "*$($d.PNPDeviceID)*" } | Select-Object -First 1
                if ($s -and $s.PredictiveFailure) { $hasFailure = $true; $reason = $s.Reason }
            }

            $media = "SSD"
            if ($physical) {
                $p = $physical | Where-Object { $d.Model -like "*$($_.FriendlyName)*" -or $_.FriendlyName -like "*$($d.Model)*" } | Select-Object -First 1
                if ($p -and $p.MediaType) { $media = $p.MediaType }
            } elseif ($d.MediaType) {
                $media = $d.MediaType
            }

            $result += @{
                FriendlyName = if ($d.Model) { $d.Model.Trim() } else { "Ổ đĩa lưu trữ" }
                MediaType = $media
                Size = if ($d.Size) { [long]$d.Size } else { 536870912000 }
                InterfaceType = if ($d.InterfaceType) { $d.InterfaceType } else { "NVMe/SATA" }
                HealthStatus = if ($hasFailure) { 'Failing' } else { 'Healthy' }
                reason = $reason
            }
        }
        $result | ConvertTo-Json -Depth 3
    } catch { @() | ConvertTo-Json }
    "#;
    let stdout = run_ps(ps);
    let parsed: serde_json::Value = serde_json::from_str(&stdout).unwrap_or(serde_json::json!([]));
    let arr = if parsed.is_array() { parsed } else if !parsed.is_null() { serde_json::json!([parsed]) } else { serde_json::json!([]) };
    Ok(serde_json::json!({
        "success": true,
        "data": arr
    }))
}

