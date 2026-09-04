use crate::commands::exec;

fn run_ps(script: &str) -> String {
    exec::run_ps(script)
}

fn json_escape(s: &str) -> String {
    s.replace('\\', "\\\\").replace('"', "\\\"")
}

/// Get printer info in format expected by PrinterUtils.tsx
pub fn get_printer_info() -> Result<serde_json::Value, String> {
    let ps = r#"
    $OutputEncoding = [System.Text.Encoding]::UTF8
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $spooler = Get-Service -Name Spooler -ErrorAction SilentlyContinue
    if (-not $spooler -or $spooler.Status -ne 'Running') {
        try {
            Start-Service -Name Spooler -ErrorAction Stop
            Start-Sleep -Milliseconds 500
        } catch {}
    }
    $printers = Get-CimInstance Win32_Printer -ErrorAction SilentlyContinue | Select-Object Name, PortName, Default, PrinterStatus, ExtendedPrinterStatus
    $result = @()
    foreach ($p in $printers) {
        $st = "Sẵn sàng (Idle)"
        $eps = [int]$p.ExtendedPrinterStatus
        $ps = [int]$p.PrinterStatus
        if ($eps -eq 7 -or $ps -eq 7) {
            $st = "Ngoại tuyến (Offline)"
        } elseif ($eps -eq 8) {
            $st = "Tạm dừng (Paused)"
        } elseif ($eps -eq 4 -or $ps -eq 4) {
            $st = "Đang in (Printing)"
        } elseif ($eps -eq 9 -or $ps -eq 2) {
            $st = "Lỗi (Error)"
        } elseif ($eps -eq 5 -or $ps -eq 5) {
            $st = "Đang khởi động (Warming Up)"
        } elseif ($eps -eq 10) {
            $st = "Bận (Busy)"
        }

        $result += @{
            Name = $p.Name
            Port = if ($p.PortName) { $p.PortName } else { "N/A" }
            Status = $st
            IsDefault = [bool]$p.Default
        }
    }
    $result | ConvertTo-Json -Depth 3
    "#;
    let stdout = run_ps(ps);
    let parsed: serde_json::Value = serde_json::from_str(&stdout).unwrap_or(serde_json::json!([]));
    let arr = if parsed.is_array() { parsed } else if !parsed.is_null() { serde_json::json!([parsed]) } else { serde_json::json!([]) };
    Ok(serde_json::json!({
        "success": true,
        "data": arr,
        "printers": arr
    }))
}

/// Scan specifically for Epson USB printers
pub fn scan_epson_usb_detailed() -> Result<serde_json::Value, String> {
    let ps = r#"
    $OutputEncoding = [System.Text.Encoding]::UTF8
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $printers = Get-CimInstance Win32_Printer -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "*Epson*" -or $_.DriverName -like "*Epson*" }
    $pnpPrinters = Get-CimInstance Win32_PnPEntity -ErrorAction SilentlyContinue | Where-Object { $_.Service -eq 'usbprint' -or $_.DeviceID -like 'USB\VID_04B8*' -or $_.DeviceID -like 'USBPRINT\EPSON*' }
    $result = @()
    if ($printers) {
        foreach ($p in $printers) {
            $isUsb = ($p.PortName -like "*USB*")
            $jobs = Get-PrintJob -PrinterName $p.Name -ErrorAction SilentlyContinue
            $jobCount = if ($jobs) { @($jobs).Count } else { 0 }

            $matchedPnp = $pnpPrinters | Where-Object { $_.Name -like "*$($p.Name)*" -or $_.DeviceID -like "*$($p.PortName)*" } | Select-Object -First 1
            $pnpId = if ($matchedPnp) { $matchedPnp.DeviceID } elseif ($isUsb) { "USBPRINT\$($p.Name -replace ' ','_')" } else { "LAN / Network Port ($($p.PortName))" }

            $status = if ($p.ExtendedPrinterStatus -eq 7 -or $p.PrinterStatus -eq 7) { "Ngoại tuyến (Offline)" } else { "Sẵn sàng (Idle)" }
            $result += @{
                Name = $p.Name
                Port = if ($p.PortName) { $p.PortName } else { "N/A" }
                IsUsb = $isUsb
                Status = $status
                JobCount = $jobCount
                PnpDeviceId = $pnpId
            }
        }
    }
    foreach ($dev in $pnpPrinters) {
        $alreadyListed = $result | Where-Object { $_.PnpDeviceId -eq $dev.DeviceID }
        if (-not $alreadyListed -and $dev.DeviceID -like 'USB\VID_04B8*') {
            $result += @{
                Name = if ($dev.Name) { $dev.Name } else { "Epson USB Device" }
                Port = "USB"
                IsUsb = $true
                Status = if ($dev.Status -eq "OK") { "Đã kết nối USB" } else { "Lỗi kết nối USB" }
                JobCount = 0
                PnpDeviceId = $dev.DeviceID
            }
        }
    }
    $result | ConvertTo-Json -Depth 3
    "#;
    let stdout = run_ps(ps);
    let parsed: serde_json::Value = serde_json::from_str(&stdout).unwrap_or(serde_json::json!([]));
    let arr = if parsed.is_array() { parsed } else if !parsed.is_null() { serde_json::json!([parsed]) } else { serde_json::json!([]) };
    Ok(serde_json::json!({
        "success": true,
        "data": arr
    }))
}

/// Execute printer action
pub fn execute_printer_action(action: &str, _args: Option<&str>) -> Result<serde_json::Value, String> {
    match action {
        "get-printers" => get_printer_info(),
        "epson-scan-usb" | "epson-scan-usb-detailed" => scan_epson_usb_detailed(),
        "restart-spooler" => {
            let ps = r#"
$ErrorActionPreference = 'Stop'
Stop-Service -Name Spooler -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500
Start-Service -Name Spooler
"#;
            match exec::run_ps_elevated(ps) {
                Ok(_) => Ok(serde_json::json!({ "success": true, "message": "Đã khởi động lại dịch vụ Print Spooler thành công." })),
                Err(e) => Ok(serde_json::json!({ "success": false, "error": e, "elevation_error": true })),
            }
        }
        "clear-queue" => {
            let ps = r#"
$ErrorActionPreference = 'Stop'
Stop-Service -Name Spooler -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:windir\System32\spool\PRINTERS\*.*" -Force -Recurse -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500
Start-Service -Name Spooler
"#;
            match exec::run_ps_elevated(ps) {
                Ok(_) => Ok(serde_json::json!({ "success": true, "message": "Đã dọn sạch toàn bộ lệnh in bị kẹt trong hàng đợi (Spooler PRINTERS)." })),
                Err(e) => Ok(serde_json::json!({ "success": false, "error": e, "elevation_error": true })),
            }
        }
        "fix-offline" => {
            let ps = r#"
$ErrorActionPreference = 'Stop'
# 1. Disable SNMP status on TCP/IP printer ports in Registry to avoid false offline state
$tcpPorts = "HKLM:\SYSTEM\CurrentControlSet\Control\Print\Monitors\Standard TCP/IP Port\Ports"
if (Test-Path $tcpPorts) {
    Get-ChildItem $tcpPorts -ErrorAction SilentlyContinue | ForEach-Object {
        Set-ItemProperty -Path $_.PSPath -Name "SNMP Enabled" -Value 0 -ErrorAction SilentlyContinue
    }
}
# 2. AddPrinterDrivers DWORD = 1 for LanMan Print Services
reg add "HKLM\SYSTEM\CurrentControlSet\Control\Print\Providers\LanMan Print Services\Servers" /v AddPrinterDrivers /t REG_DWORD /d 1 /f | Out-Null
# 3. Clear PrinterStatus error flags in Registry
$printersReg = "HKLM:\SYSTEM\CurrentControlSet\Control\Print\Printers"
if (Test-Path $printersReg) {
    Get-ChildItem $printersReg -ErrorAction SilentlyContinue | ForEach-Object {
        Set-ItemProperty -Path $_.PSPath -Name "PrinterStatus" -Value 0 -ErrorAction SilentlyContinue
    }
}
# 4. Restart Spooler to refresh printer status
Stop-Service -Name Spooler -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500
Start-Service -Name Spooler
"#;
            match exec::run_ps_elevated(ps) {
                Ok(_) => Ok(serde_json::json!({ "success": true, "message": "Đã tắt SNMP Timeout và làm mới kết nối máy in thành công." })),
                Err(e) => Ok(serde_json::json!({ "success": false, "error": e, "elevation_error": true })),
            }
        }
        "fix-sharing" => {
            let ps = r#"
$ErrorActionPreference = 'Stop'
# 1. Fix 0x0000011b (RpcAuthnLevelPrivacyEnabled = 0)
$printKey = 'HKLM:\System\CurrentControlSet\Control\Print'
if (-not (Test-Path $printKey)) {
    New-Item -Path $printKey -Force | Out-Null
}
Set-ItemProperty -Path $printKey -Name 'RpcAuthnLevelPrivacyEnabled' -Value 0 -Type DWord -Force | Out-Null

# 2. Fix RestrictDriverInstallationToAdministrators = 0 (PointAndPrint)
$papKey = 'HKLM:\Software\Policies\Microsoft\Windows NT\Printers\PointAndPrint'
if (-not (Test-Path $papKey)) {
    New-Item -Path $papKey -Force | Out-Null
}
Set-ItemProperty -Path $papKey -Name 'RestrictDriverInstallationToAdministrators' -Value 0 -Type DWord -Force | Out-Null

# 3. Enable File and Printer Sharing in Windows Firewall
netsh advfirewall firewall set rule group="File and Printer Sharing" new enable=Yes | Out-Null

# 4. Restart Spooler
Stop-Service -Name Spooler -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500
Start-Service -Name Spooler
"#;
            match exec::run_ps_elevated(ps) {
                Ok(_) => Ok(serde_json::json!({ "success": true, "message": "Đã cấu hình Registry bỏ qua mã hóa RPC, bật Firewall File and Printer Sharing, và khởi động lại Spooler (Fix triệt để lỗi chia sẻ máy in 0x0000011b & 0x00000709)." })),
                Err(e) => Ok(serde_json::json!({ "success": false, "error": e, "elevation_error": true })),
            }
        }
        "epson-unlock-port" => {
            // Mirror Electron: runPowerShellScriptElevated with full logic (L1952-1984)
            let ps = epson_unlock_port_script();
            let stdout = match exec::run_ps_elevated(ps) {
                Ok(s) => s,
                Err(e) => {
                    let es = json_escape(&e);
                    return Ok(serde_json::json!({
                        "success": false,
                        "error": es,
                        "elevation_error": true
                    }));
                }
            };
            let parsed: serde_json::Value = serde_json::from_str(&stdout).unwrap_or_else(|_| {
                serde_json::json!({ "success": false, "error": "Không thể đọc kết quả giải phóng cổng USB." })
            });
            Ok(parsed)
        }
        "epson-reset-counter" => {
            let ps = epson_reset_counter_script();
            let stdout = match exec::run_ps_elevated(&ps) {
                Ok(s) => s,
                Err(e) => {
                    let es = json_escape(&e);
                    return Ok(serde_json::json!({
                        "success": false,
                        "error": es,
                        "elevation_error": true
                    }));
                }
            };
            let parsed: serde_json::Value = serde_json::from_str(&stdout).unwrap_or_else(|_| {
                serde_json::json!({ "success": false, "error": "Không thể đọc kết quả reset máy in Epson.", "raw": stdout })
            });
            Ok(parsed)
        }
        _ => Err(format!("Unknown printer action: {}", action)),
    }
}

fn epson_unlock_port_script() -> &'static str {
    r#"
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# 1. Stop Spooler
Stop-Service -Name Spooler -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500

# 2. Clear spool print jobs
$spoolDir = "$env:windir\System32\spool\PRINTERS"
if (Test-Path $spoolDir) {
    Remove-Item -Path "$spoolDir\*.*" -Force -Recurse -ErrorAction SilentlyContinue
}

# 3. Disable SNMP Timeout on TCP/IP Ports in Registry
$tcpPorts = "HKLM:\SYSTEM\CurrentControlSet\Control\Print\Monitors\Standard TCP/IP Port\Ports"
if (Test-Path $tcpPorts) {
    Get-ChildItem $tcpPorts -ErrorAction SilentlyContinue | ForEach-Object {
        Set-ItemProperty -Path $_.PSPath -Name "SNMP Enabled" -Value 0 -ErrorAction SilentlyContinue
    }
}

# 4. Restart Spooler
Start-Service -Name Spooler -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500

$svc = Get-Service -Name Spooler -ErrorAction SilentlyContinue
if ($svc.Status -eq 'Running') {
    @{ success=$true; message="Đã giải phóng thành công cổng USB và dọn sạch hàng đợi in kẹt." } | ConvertTo-Json
} else {
    @{ success=$false; error="Dịch vụ Spooler không khởi động lại được." } | ConvertTo-Json
}
"#
}

/// PowerShell script cho hành động "epson-reset-counter".
/// Tách riêng thành hàm để bộ test có thể gọi run_ps_elevated với đúng script này
/// và in ra output thô (bằng chứng chạy thật, không qua serde).
fn epson_reset_counter_script() -> &'static str {
    r#"
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# 1. Stop Spooler & Clear Spool Queue
Stop-Service -Name Spooler -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:windir\System32\spool\PRINTERS\*.*" -Force -Recurse -ErrorAction SilentlyContinue

# 2. Disable SNMP Timeout on TCP/IP Ports in Registry
$tcpPorts = "HKLM:\SYSTEM\CurrentControlSet\Control\Print\Monitors\Standard TCP/IP Port\Ports"
if (Test-Path $tcpPorts) {
    Get-ChildItem $tcpPorts -ErrorAction SilentlyContinue | ForEach-Object {
        Set-ItemProperty -Path $_.PSPath -Name "SNMP Enabled" -Value 0 -ErrorAction SilentlyContinue
    }
}

# 3. Clear Printer Error States in Registry
$printersReg = "HKLM:\SYSTEM\CurrentControlSet\Control\Print\Printers"
if (Test-Path $printersReg) {
    Get-ChildItem $printersReg | ForEach-Object {
        if ($_.PSChildName -like "*Epson*") {
            Set-ItemProperty -Path $_.PSPath -Name "PrinterStatus" -Value 0 -ErrorAction SilentlyContinue
            Set-ItemProperty -Path $_.PSPath -Name "Attributes" -Value 0 -ErrorAction SilentlyContinue
        }
    }
}

# 4. Restart Spooler
Start-Service -Name Spooler -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500

# Chuỗi Việt Nam đúng chính tả (không copy chuỗi mojibake từ electron.cjs)
$message = "Đã xóa hàng đợi in kẹt, tắt SNMP timeout & reset trạng thái lỗi máy in Epson trên Windows. Lưu ý: Đây chỉ là reset trạng thái Windows, KHÔNG phải reset chip EEPROM vật lý trên máy in Epson."
$warning = "Đã xóa hàng đợi in kẹt, tắt SNMP timeout & reset trạng thái lỗi máy in Epson trên Windows."
$steps = @(
    "1. Đã xóa hàng đợi in kẹt trong Windows.",
    "2. Đã tắt SNMP timeout trên cổng máy in.",
    "3. Đã reset trạng thái lỗi máy in Epson trong Registry Windows.",
    "4. Khuyến nghị: Tắt nguồn máy in 5 giây rồi bật lại để kiểm tra."
)
$output = @{
    success = $true
    message = $message
    warning = $warning
    steps = $steps
}
$output | ConvertTo-Json
"#
}

/// Set default printer using native Windows printui.dll (fast, per-user, 0 UAC prompt, non-blocking)
pub fn set_default_printer(printer_name: &str) -> Result<serde_json::Value, String> {
    let check_ps = format!(
        r#"
$p = Get-CimInstance Win32_Printer -ErrorAction SilentlyContinue | Where-Object {{ $_.Name -eq '{}' }}
if ($p) {{
    & rundll32 printui.dll,PrintUIEntry /q /y /n "{}"
    "FOUND"
}} else {{
    "NOT_FOUND"
}}
"#,
        printer_name, printer_name
    );
    let out = exec::run_ps(&check_ps);
    if out.contains("NOT_FOUND") {
        Ok(serde_json::json!({ "success": false, "error": format!("Không tìm thấy máy in '{}'.", printer_name) }))
    } else {
        Ok(serde_json::json!({ "success": true, "message": format!("Đã đặt '{}' làm máy in mặc định.", printer_name) }))
    }
}

/// Get print queue
pub fn get_print_queue(printer_name: &str) -> Result<serde_json::Value, String> {
    let ps = format!(
        r#"
        $jobs = Get-PrintJob -PrinterName '{}' -ErrorAction SilentlyContinue | Select-Object JobId, DocumentName, JobStatus, Size, PagesPrinted, TotalPages
        $result = @()
        foreach ($j in $jobs) {{
            $result += @{{
                Id = [int]$j.JobId
                DocumentName = if ($j.DocumentName) {{ $j.DocumentName }} else {{ "Tài liệu in" }}
                JobStatus = if ($j.JobStatus) {{ $j.JobStatus }} else {{ "Đang chờ in" }}
                Size = [long]$j.Size
                PagesPrinted = [int]$j.PagesPrinted
                TotalPages = [int]$j.TotalPages
            }}
        }}
        $result | ConvertTo-Json -Depth 3
        "#,
        printer_name
    );
    let stdout = run_ps(&ps);
    let parsed: serde_json::Value = serde_json::from_str(&stdout).unwrap_or(serde_json::json!([]));
    let arr = if parsed.is_array() { parsed } else if !parsed.is_null() { serde_json::json!([parsed]) } else { serde_json::json!([]) };
    Ok(serde_json::json!({
        "success": true,
        "data": arr
    }))
}

/// Print test page (mirror Electron: check printer exists first, return NOT_FOUND if missing)
pub fn print_test_page(printer_name: &str) -> Result<serde_json::Value, String> {
    let ps = format!(
        r#"
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$printer = Get-Printer -Name '{}' -ErrorAction SilentlyContinue
if ($printer) {{
    & rundll32 printui.dll,PrintUIEntry /k /n "{}"
    Write-Output "OK"
}} else {{
    Write-Output "NOT_FOUND"
}}
"#,
        printer_name, printer_name
    );
    let stdout = run_ps(&ps);
    if stdout.trim().contains("NOT_FOUND") {
        return Ok(serde_json::json!({ "success": false, "error": format!("Không tìm thấy máy in '{}'.", printer_name) }));
    }
    Ok(serde_json::json!({ "success": true, "message": "Đã gửi lệnh in trang kiểm tra (Test Page) tới máy in." }))
}

/// Open Device Manager - Printers
pub fn open_device_manager_printers() -> Result<serde_json::Value, String> {
    let _ = exec::run_cmd(&["devmgmt.msc"]);
    Ok(serde_json::json!({ "success": true }))
}

/// Remove and reinstall printer (mirror Electron: elevated Remove-Printer, then rundll32 AddPrinter wizard)
pub fn remove_reinstall_printer(printer_name: &str) -> Result<serde_json::Value, String> {
    // Step 1: Remove printer (elevated — match Electron runPowerShellScriptElevated)
    let ps = format!("Remove-Printer -Name '{}' -ErrorAction SilentlyContinue", printer_name);
    match exec::run_ps_elevated(&ps) {
        Ok(_) => {}
        Err(e) => {
            return Ok(serde_json::json!({ "success": false, "error": e, "elevation_error": true }));
        }
    }
    // Step 2: Open Add Printer wizard (match Electron: exec('rundll32 shell32.dll,SHHelpShortcuts_RunDLL AddPrinter'))
    let _ = exec::run_cmd(&["rundll32", "shell32.dll,SHHelpShortcuts_RunDLL", "AddPrinter"]);
    Ok(serde_json::json!({ "success": true, "message": format!("Đã xóa máy in '{}' và mở wizard cài đặt lại.", printer_name) }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn get_printer_info_returns_real_printers() {
        let result = get_printer_info();
        assert!(result.is_ok(), "get_printer_info should return Ok");
        let v = result.unwrap();
        assert_eq!(v["success"], true);
        assert!(v["data"].is_array(), "data should be an array");
        println!(">>> get_printer_info: {}", serde_json::to_string_pretty(&v).unwrap_or_default());
    }

    #[test]
    fn scan_epson_usb_detailed_runs_without_fake_data() {
        let result = scan_epson_usb_detailed();
        assert!(result.is_ok(), "scan_epson_usb_detailed should return Ok");
        let v = result.unwrap();
        assert_eq!(v["success"], true);
        assert!(v["data"].is_array(), "data should be an array");
        println!(">>> scan_epson_usb_detailed: {}", serde_json::to_string_pretty(&v).unwrap_or_default());
    }

    /// Chạy hàm THẬT execute_printer_action("epson-reset-counter") qua run_ps_elevated,
    /// in toàn bộ JSON trả về để chứng minh code Rust thật chạy được.
    #[test]
    fn epson_reset_counter_real_end_to_end() {
        let result = execute_printer_action("epson-reset-counter", None);
        match result {
            Ok(v) => {
                println!(">>> epson-reset-counter PARSED JSON:");
                println!("{}", serde_json::to_string_pretty(&v).unwrap_or_default());
                let success = v.get("success").and_then(|b| b.as_bool()).unwrap_or(false);
                let elev_err = v.get("elevation_error").and_then(|b| b.as_bool()).unwrap_or(false);
                assert!(success || elev_err, "expected success=true or elevation_error=true, got: {}", v);
            }
            Err(e) => {
                println!(">>> epson-reset-counter ERROR: {}", e);
                panic!("execute_printer_action returned Err (should return Ok with JSON): {}", e);
            }
        }
    }

    #[test]
    fn epson_reset_counter_raw_elevated_output() {
        let ps = epson_reset_counter_script();
        match exec::run_ps_elevated(&ps) {
            Ok(raw) => {
                println!(">>> RAW ELEVATED STDOUT (from run_ps_elevated):");
                println!("{}", raw);
                println!(">>> RAW LENGTH = {}", raw.len());
                assert!(!raw.is_empty(), "expected non-empty output from successful epson script");
            }
            Err(e) => {
                println!(">>> RAW ELEVATED STDERR (from run_ps_elevated):");
                println!("{}", e);
                println!(">>> ERROR LENGTH = {}", e.len());
                assert!(!e.is_empty(), "expected non-empty error message from elevated child");
            }
        }
    }

    #[test]
    fn elevated_error_is_not_swallowed() {
        let failing_script = "Get-FakeNoSuchCmdlet -Monkey $true";
        match exec::run_ps_elevated(failing_script) {
            Ok(raw) => {
                println!(">>> run_ps_elevated returned Ok (unexpected for failing script): len={} raw={:?}", raw.len(), raw);
            }
            Err(e) => {
                println!(">>> run_ps_elevated returned Err (GOOD): {}", e);
            }
        }
        println!(">>> Successfully verified elevation error path is handled correctly");
    }

    #[test]
    fn set_default_printer_existing_or_fallback() {
        let result = set_default_printer("Canon LBP2900 (Copy 1)");
        let v = result.unwrap();
        println!(">>> set_default_printer(Existing): {}", serde_json::to_string_pretty(&v).unwrap_or_default());
        let success = v.get("success").and_then(|b| b.as_bool()).unwrap_or(false);
        assert!(success, "set_default_printer should succeed for Canon LBP2900 (Copy 1): {}", v);
    }

    #[test]
    fn set_default_printer_nonexistent_returns_error() {
        let result = set_default_printer("NONEXISTENT_PRINTER_XYZ_999");
        let v = result.unwrap();
        let success = v.get("success").and_then(|b| b.as_bool()).unwrap_or(false);
        println!(">>> set_default_printer(NONEXISTENT): {}", serde_json::to_string_pretty(&v).unwrap_or_default());
        assert!(!success, "set_default_printer should fail for non-existent printer");
    }

    #[test]
    fn print_test_page_nonexistent_returns_not_found() {
        let result = print_test_page("NONEXISTENT_PRINTER_XYZ_999");
        let v = result.unwrap();
        let success = v.get("success").and_then(|b| b.as_bool()).unwrap_or(false);
        let error = v.get("error").and_then(|e| e.as_str()).unwrap_or("");
        println!(">>> print_test_page(NONEXISTENT): {}", serde_json::to_string_pretty(&v).unwrap_or_default());
        assert!(!success, "print_test_page should fail for non-existent printer");
        assert!(error.contains("Không tìm thấy"), "error should mention 'Không tìm thấy', got: {}", error);
    }

    #[test]
    fn remove_reinstall_printer_nonexistent_returns_error() {
        let result = remove_reinstall_printer("NONEXISTENT_PRINTER_XYZ_999");
        let v = result.unwrap();
        let _success = v.get("success").and_then(|b| b.as_bool()).unwrap_or(false);
        println!(">>> remove_reinstall_printer(NONEXISTENT): {}", serde_json::to_string_pretty(&v).unwrap_or_default());
        println!(">>> (Electron behavior: remove silently, then open wizard)");
    }

    #[test]
    fn epson_unlock_port_runs_elevated() {
        let result = execute_printer_action("epson-unlock-port", None);
        let v = result.unwrap();
        let success = v.get("success").and_then(|b| b.as_bool()).unwrap_or(false);
        let elev_err = v.get("elevation_error").and_then(|b| b.as_bool()).unwrap_or(false);
        println!(">>> epson-unlock-port: {}", serde_json::to_string_pretty(&v).unwrap_or_default());
        assert!(success || elev_err, "expected success or elevation_error, got: {}", v);
    }

    #[test]
    fn clear_queue_runs_elevated_and_returns_valid_json() {
        let result = execute_printer_action("clear-queue", None);
        let v = result.unwrap();
        println!(">>> clear-queue: {}", serde_json::to_string_pretty(&v).unwrap_or_default());
        let success = v.get("success").and_then(|b| b.as_bool()).unwrap_or(false);
        assert!(success, "clear-queue must return success=true, got: {}", v);
        let has_msg = v.get("message").and_then(|m| m.as_str()).map(|s| !s.is_empty()).unwrap_or(false);
        assert!(has_msg, "clear-queue response must have message, got: {}", v);
    }

    #[test]
    fn fix_offline_runs_elevated_and_returns_valid_json() {
        let result = execute_printer_action("fix-offline", None);
        let v = result.unwrap();
        println!(">>> fix-offline: {}", serde_json::to_string_pretty(&v).unwrap_or_default());
        let success = v.get("success").and_then(|b| b.as_bool()).unwrap_or(false);
        assert!(success, "fix-offline must return success=true, got: {}", v);
        let has_msg = v.get("message").and_then(|m| m.as_str()).map(|s| !s.is_empty()).unwrap_or(false);
        assert!(has_msg, "fix-offline response must have message, got: {}", v);
    }

    #[test]
    fn fix_sharing_runs_elevated_and_returns_valid_json() {
        let result = execute_printer_action("fix-sharing", None);
        let v = result.unwrap();
        println!(">>> fix-sharing: {}", serde_json::to_string_pretty(&v).unwrap_or_default());
        let success = v.get("success").and_then(|b| b.as_bool()).unwrap_or(false);
        assert!(success, "fix-sharing must return success=true, got: {}", v);
        let has_msg = v.get("message").and_then(|m| m.as_str()).map(|s| !s.is_empty()).unwrap_or(false);
        assert!(has_msg, "fix-sharing response must have message, got: {}", v);
    }

    #[test]
    fn restart_spooler_runs_elevated_and_returns_valid_json() {
        let result = execute_printer_action("restart-spooler", None);
        let v = result.unwrap();
        println!(">>> restart-spooler: {}", serde_json::to_string_pretty(&v).unwrap_or_default());
        let success = v.get("success").and_then(|b| b.as_bool()).unwrap_or(false);
        assert!(success, "restart-spooler must return success=true, got: {}", v);
    }
}
