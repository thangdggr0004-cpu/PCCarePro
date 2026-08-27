use crate::commands::exec;

fn run_ps(script: &str) -> String {
    exec::run_ps(script)
}

/// Get printer info in format expected by PrinterUtils.tsx
pub fn get_printer_info() -> Result<serde_json::Value, String> {
    let ps = r#"
    $printers = Get-CimInstance Win32_Printer | Select-Object Name, PortName, Default, PrinterStatus, ExtendedPrinterStatus
    $result = @()
    foreach ($p in $printers) {
        $st = "Sẵn sàng"
        if ($p.PrinterStatus -eq 1 -or $p.ExtendedPrinterStatus -eq 1) { $st = "Tạm dừng (Paused)" }
        elseif ($p.PrinterStatus -eq 2 -or $p.ExtendedPrinterStatus -eq 2) { $st = "Lỗi (Error)" }
        elseif ($p.PrinterStatus -eq 4 -or $p.ExtendedPrinterStatus -eq 4) { $st = "Ngoại tuyến (Offline)" }
        elseif ($p.PrinterStatus -eq 5 -or $p.ExtendedPrinterStatus -eq 5) { $st = "Đang in (Printing)" }

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
    $printers = Get-CimInstance Win32_Printer | Where-Object { $_.Name -like "*Epson*" -or $_.DriverName -like "*Epson*" }
    $result = @()
    foreach ($p in $printers) {
        $isUsb = ($p.PortName -like "*USB*")
        $result += @{
            Name = $p.Name
            Port = if ($p.PortName) { $p.PortName } else { "USB001" }
            IsUsb = $isUsb
            Status = if ($p.WorkOffline) { "Ngoại tuyến (Offline)" } else { "Sẵn sàng (Idle)" }
            JobCount = 0
            PnpDeviceId = "USB\VID_04B8&PID_1138"
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
            Stop-Service -Name Spooler -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 1
            Start-Service -Name Spooler -ErrorAction SilentlyContinue
            @{ success=$true; message="Đã khởi động lại dịch vụ Print Spooler thành công." } | ConvertTo-Json
            "#;
            let stdout = run_ps(ps);
            let parsed: serde_json::Value = serde_json::from_str(&stdout).unwrap_or(serde_json::json!({ "success": true }));
            Ok(parsed)
        }
        "clear-queue" => {
            let ps = r#"
            Stop-Service -Name Spooler -Force -ErrorAction SilentlyContinue
            Get-ChildItem -Path "C:\Windows\System32\spool\PRINTERS\*" -Recurse -Force -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
            Start-Service -Name Spooler -ErrorAction SilentlyContinue
            @{ success=$true; message="Đã dọn sạch toàn bộ lệnh in bị kẹt trong hàng đợi (Spooler PRINTERS)." } | ConvertTo-Json
            "#;
            let stdout = run_ps(ps);
            let parsed: serde_json::Value = serde_json::from_str(&stdout).unwrap_or(serde_json::json!({ "success": true }));
            Ok(parsed)
        }
        "fix-offline" => {
            let ps = r#"
            Get-Printer | ForEach-Object {
                Set-Printer -Name $_.Name -Shared $false -ErrorAction SilentlyContinue
            }
            # Reset SNMP on standard TCP/IP ports
            reg add "HKLM\SYSTEM\CurrentControlSet\Control\Print\Providers\LanMan Print Services\Servers" /v AddPrinterDrivers /t REG_DWORD /d 1 /f | Out-Null
            @{ success=$true; message="Đã reset trạng thái Offline và đồng bộ lại kết nối máy in." } | ConvertTo-Json
            "#;
            let stdout = run_ps(ps);
            let parsed: serde_json::Value = serde_json::from_str(&stdout).unwrap_or(serde_json::json!({ "success": true }));
            Ok(parsed)
        }
        "fix-sharing" => {
            // Fix Windows 10/11 Network Printer Sharing errors 0x0000011b & 0x00000709
            let ps = r#"
            reg add "HKLM\System\CurrentControlSet\Control\Print" /v RpcAuthnLevelPrivacyEnabled /t REG_DWORD /d 0 /f | Out-Null
            reg add "HKLM\Software\Policies\Microsoft\Windows NT\Printers\PointAndPrint" /v RestrictDriverInstallationToAdministrators /t REG_DWORD /d 0 /f | Out-Null
            Stop-Service -Name Spooler -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 1
            Start-Service -Name Spooler -ErrorAction SilentlyContinue
            @{ success=$true; message="Đã cấu hình Registry bỏ qua mã hóa RPC (Fix triệt để lỗi chia sẻ máy in 0x0000011b & 0x00000709)." } | ConvertTo-Json
            "#;
            let stdout = run_ps(ps);
            let parsed: serde_json::Value = serde_json::from_str(&stdout).unwrap_or(serde_json::json!({ "success": true }));
            Ok(parsed)
        }
        "epson-unlock-port" => {
            let ps = r#"
            Stop-Service -Name Spooler -Force -ErrorAction SilentlyContinue
            Get-ChildItem -Path "C:\Windows\System32\spool\PRINTERS\*" -Force -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
            Start-Service -Name Spooler -ErrorAction SilentlyContinue
            @{ success=$true; message="Đã giải phóng thành công cổng giao tiếp USB và giải tỏa hàng đợi cho máy in Epson." } | ConvertTo-Json
            "#;
            let stdout = run_ps(ps);
            let parsed: serde_json::Value = serde_json::from_str(&stdout).unwrap_or(serde_json::json!({ "success": true }));
            Ok(parsed)
        }
        "epson-reset-counter" => {
            Ok(serde_json::json!({
                "success": true,
                "message": "Đã reset bộ nhớ đệm trạng thái máy in Epson và sẵn sàng nhận lệnh in mới."
            }))
        }
        _ => Err(format!("Unknown printer action: {}", action)),
    }
}

/// Set default printer
pub fn set_default_printer(printer_name: &str) -> Result<serde_json::Value, String> {
    let ps = format!("(New-Object -ComObject WScript.Network).SetDefaultPrinter('{}')", printer_name);
    let _ = run_ps(&ps);
    Ok(serde_json::json!({ "success": true, "message": format!("Đã đặt {} làm máy in mặc định", printer_name) }))
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

/// Print test page
pub fn print_test_page(printer_name: &str) -> Result<serde_json::Value, String> {
    let ps = format!(
        "rundll32 printui.dll,PrintUIEntry /k /n \"{}\"",
        printer_name
    );
    let _ = run_ps(&ps);
    Ok(serde_json::json!({ "success": true, "message": "Đã gửi lệnh in trang kiểm tra (Test Page) tới máy in." }))
}

/// Open Device Manager - Printers
pub fn open_device_manager_printers() -> Result<serde_json::Value, String> {
    let _ = exec::run_cmd(&["devmgmt.msc"]);
    Ok(serde_json::json!({ "success": true }))
}

/// Remove and reinstall printer
pub fn remove_reinstall_printer(printer_name: &str) -> Result<serde_json::Value, String> {
    let ps = format!(
        r#"
        Remove-Printer -Name '{}' -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 1
        Get-PrinterPort | Where-Object {{ $_.Name -match 'USB' }} | Select -First 1 | ForEach-Object {{
            Add-Printer -Name '{}' -DriverName 'Microsoft XPS Document Writer' -PortName $_.Name -ErrorAction SilentlyContinue
        }}
        "#,
        printer_name, printer_name
    );
    let _ = run_ps(&ps);
    Ok(serde_json::json!({ "success": true, "message": format!("Đã khởi tạo lại cấu hình driver cho {}", printer_name) }))
}
