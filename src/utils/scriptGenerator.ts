import { DocumentStandardPreset } from '../types.js';

// Helper to trigger file download in browser
export function downloadFile(content: string, filename: string, mimeType: string = 'text/plain') {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// 3. Hardware Diagnostics Script (PowerShell)
export function generateHardwareInfoScript(): string {
  return `# PowerShell script to diagnostic detailed hardware configuration
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "         CHẨN ĐOÁN CẤU HÌNH PHẦN CỨNG CHI TIẾT - WINDOWS             " -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. CPU Info
Write-Host "[*] Đang đọc thông tin CPU..." -ForegroundColor Yellow
$cpu = Get-CimInstance Win32_Processor
$cpuName = $cpu.Name.Trim()
$cpuCores = $cpu.NumberOfCores
$cpuThreads = $cpu.NumberOfLogicalProcessors
$cpuMaxClock = $cpu.MaxClockSpeed
$cpuL3 = [math]::Round($cpu.L3CacheSize / 1024, 2)

Write-Host "  - Bộ vi xử lý (CPU): $cpuName"
Write-Host "  - Số nhân vật lý: $cpuCores Cores | Số luồng xử lý: $cpuThreads Threads"
Write-Host "  - Xung nhịp tối đa: ([math]::Round($cpuMaxClock / 1000, 2)) GHz"
Write-Host "  - L3 Cache: $cpuL3 MB"
Write-Host ""

# 2. RAM Info
Write-Host "[*] Đang đọc thông tin RAM và Khe cắm..." -ForegroundColor Yellow
$physicalMem = Get-CimInstance Win32_PhysicalMemory
$totalRamBytes = (Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory
$totalRamGB = [math]::Round($totalRamBytes / 1GB, 2)
$ramSlots = Get-CimInstance Win32_PhysicalMemoryArray

Write-Host "  - Tổng dung lượng RAM cài đặt: $totalRamGB GB"
Write-Host "  - Số khe cắm khả dụng trên Mainboard: $($ramSlots.MemoryDevices)"
Write-Host "  - Số khe cắm đã sử dụng: $($physicalMem.Count)"

$index = 1
foreach ($mem in $physicalMem) {
    $memGB = [math]::Round($mem.Capacity / 1GB, 2)
    $memSpeed = $mem.Speed
    $memType = switch ($mem.SMBIOSMemoryType) {
        20 { "DDR" }
        21 { "DDR2" }
        24 { "DDR3" }
        26 { "DDR4" }
        29 { "LPDDR3" }
        30 { "LPDDR4" }
        34 { "DDR5" }
        35 { "LPDDR5" }
        default {
            if ($mem.PartNumber -match "LPDDR5X") { "LPDDR5X" }
            elseif ($mem.PartNumber -match "LPDDR5") { "LPDDR5" }
            elseif ($mem.PartNumber -match "LPDDR4X") { "LPDDR4X" }
            elseif ($mem.PartNumber -match "LPDDR4") { "LPDDR4" }
            elseif ($mem.PartNumber -match "LPDDR3") { "LPDDR3" }
            elseif ($mem.PartNumber -match "DDR5") { "DDR5" }
            elseif ($mem.PartNumber -match "DDR4") { "DDR4" }
            elseif ($mem.PartNumber -match "DDR3") { "DDR3" }
            else { "Unknown" }
        }
    }
    Write-Host "    + Khe cắm #$index: $memGB GB $memType @ $memSpeed MHz (Nhà SX: $($mem.Manufacturer.Trim()))"
    $index++
}
Write-Host ""

# 3. Disk Info
Write-Host "[*] Đang kiểm tra Ổ cứng và Dung lượng..." -ForegroundColor Yellow
$disks = Get-CimInstance Win32_DiskDrive
foreach ($disk in $disks) {
    $diskSizeGB = [math]::Round($disk.Size / 1GB, 2)
    $diskMediaType = $disk.MediaType
    if ($disk.Model -like "*SSD*" -or $disk.Model -like "*NVMe*") {
        $diskTypeStr = "SSD (NVMe/SATA)"
    } else {
        $diskTypeStr = "HDD"
    }
    Write-Host "  - Ổ đĩa: $($disk.Model) ($diskTypeStr)"
    Write-Host "    + Dung lượng thiết kế: $diskSizeGB GB"
    Write-Host "    + Cổng kết nối (Interface): $($disk.InterfaceType)"
    
    # Partitions on this disk
    $partitions = Get-CimInstance -Query "ASSOCIATORS OF {Win32_DiskDrive.DeviceID='$($disk.DeviceID)'} WHERE AssocClass = Win32_DiskDriveToDiskPartition"
    foreach ($part in $partitions) {
        $logicalDisks = Get-CimInstance -Query "ASSOCIATORS OF {Win32_DiskPartition.DeviceID='$($part.DeviceID)'} WHERE AssocClass = Win32_LogicalDiskToPartition"
        foreach ($ld in $logicalDisks) {
            $freeGB = [math]::Round($ld.FreeSpace / 1GB, 2)
            $sizeGB = [math]::Round($ld.Size / 1GB, 2)
            $percentFree = [math]::Round(($freeGB / $sizeGB) * 100, 1)
            Write-Host "      > Phân vùng ổ [$($ld.DeviceID)] ($($ld.VolumeName)): Đã dùng $([math]::Round($sizeGB - $freeGB, 2))/$sizeGB GB ($percentFree% trống)"
        }
    }
}
Write-Host ""

# 4. GPU Info
Write-Host "[*] Đang đọc thông tin Card màn hình (GPU)..." -ForegroundColor Yellow
$gpus = Get-CimInstance Win32_VideoController
foreach ($gpu in $gpus) {
    $gpuVRAM = [math]::Round($gpu.AdapterRAM / 1MB, 2)
    if ($gpuVRAM -le 0) { $gpuVRAM = "N/A" } else { $gpuVRAM = "$([math]::Round($gpu.AdapterRAM / 1GB, 2)) GB" }
    Write-Host "  - Card: $($gpu.Name)"
    Write-Host "    + Dung lượng VRAM: $gpuVRAM"
    Write-Host "    + Độ phân giải hiện tại: $($gpu.CurrentHorizontalResolution) x $($gpu.CurrentVerticalResolution) @ $($gpu.CurrentRefreshRate)Hz"
}
Write-Host ""

# 5. Motherboard & Bios
Write-Host "[*] Đang đọc thông tin Mainboard..." -ForegroundColor Yellow
$board = Get-CimInstance Win32_BaseBoard
$bios = Get-CimInstance Win32_BIOS
Write-Host "  - Bo mạch chủ: $($board.Manufacturer) $($board.Product)"
Write-Host "  - Phiên bản BIOS: $($bios.SMBIOSBIOSVersion) (Ngày SX: $($bios.ReleaseDate.ToString('dd/MM/yyyy')))"
Write-Host ""

Write-Host "====================================================================" -ForegroundColor Green
Write-Host "[+] BÁO CÁO CẤU HÌNH ĐÃ HOÀN TẤT!" -ForegroundColor Green
Write-Host "====================================================================" -ForegroundColor Green
Write-Host "Nhấn phím bất kỳ để đóng công cụ này..."
$null = [Console]::ReadKey()`;
}

// 5. Change DNS Script (PowerShell)
export function generateDnsChangerScript(primary: string, secondary: string, dnsName: string): string {
  return `# PowerShell script to change DNS server for active adapters
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Check for Admin permissions
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Error "Lỗi: Bạn cần khởi chạy PowerShell bằng quyền Administrator để đổi DNS!"
    exit
}

Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "         CẬP NHẬT DNS MÁY TÍNH SANG Presets: $dnsName                " -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "[-] DNS Mới cấu hình:" -ForegroundColor Yellow
Write-Host "    - DNS Chính (Primary): $primary"
Write-Host "    - DNS Phụ (Secondary): $secondary"
Write-Host ""

$dnsServers = @("$primary", "$secondary")

# Find all active network adapters that have IPv4 enabled
$activeAdapters = Get-CimInstance Win32_NetworkAdapterConfiguration | Where-Object { $_.IPEnabled -eq $true }

if ($activeAdapters.Count -eq 0) {
    Write-Host "[!] Cảnh báo: Không tìm thấy card mạng hoạt động!" -ForegroundColor Red
} else {
    foreach ($adapter in $activeAdapters) {
        Write-Host "[*] Đang cấu hình card mạng: $($adapter.Description)..." -ForegroundColor Yellow
        $result = $adapter.SetDNSServerSearchOrder($dnsServers)
        if ($result.ReturnValue -eq 0) {
            Write-Host "    [+] Đã cập nhật DNS thành công." -ForegroundColor Green
        } else {
            Write-Host "    [!] Thất bại với mã lỗi: $($result.ReturnValue)" -ForegroundColor Red
        }
    }
}

# Flush DNS Cache to apply instantly
Write-Host ""
Write-Host "[*] Đang xóa bộ nhớ đệm DNS (Flush DNS Cache)..." -ForegroundColor Yellow
ipconfig /flushdns | Out-Null
Write-Host "    [+] Hoàn tất làm mới DNS đệm." -ForegroundColor Green

Write-Host ""
Write-Host "====================================================================" -ForegroundColor Green
Write-Host "[+] HOÀN TẤT THIẾT LẬP DNS CHO MÁY TÍNH CỦA BẠN!" -ForegroundColor Green
Write-Host "====================================================================" -ForegroundColor Green
`;
}

// 6. Word Document Standardizer - Pure PowerShell COM (runs via runPowerShellScriptElevated)
export function generateOfficeStandardizerScript(preset: DocumentStandardPreset): string {
  // Convert mm to points (Word COM uses points, not twips for margin setting via MillimetersToPoints)
  // 1 point = 1/72 inch; 1 mm = 72/25.4 points
  const mmToPt = (mm: number) => parseFloat((mm * 72 / 25.4).toFixed(4));
  const topPt    = mmToPt(preset.marginTop);
  const bottomPt = mmToPt(preset.marginBottom);
  const leftPt   = mmToPt(preset.marginLeft);
  const rightPt  = mmToPt(preset.marginRight);
  // wdLineSpaceMultiple (rule=5): LineSpacing in points = lineSpacing * 12pt (single-line baseline)
  const lineSpacingPt = parseFloat((preset.lineSpacing * 12).toFixed(4));

  return `
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "  CHUAN HOA WORD VIET NAM - NGHI DINH 30/2020" -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "[*] Font: ${preset.fontName} ${preset.fontSizeBody}pt | Le T:${preset.marginTop}/D:${preset.marginBottom}/Tr:${preset.marginLeft}/P:${preset.marginRight}mm | Gian dong:${preset.lineSpacing}" -ForegroundColor Yellow
Write-Host ""

# Dung Word COM Object - buoc 1: tat WINWORD truoc
Write-Host "[1/3] Tat tien trinh Word dang chay (neu co)..." -ForegroundColor Yellow
Stop-Process -Name "WINWORD" -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 800

try {
    Write-Host "[2/3] Ket noi Word COM va mo Normal.dotm..." -ForegroundColor Yellow
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = [Microsoft.Office.Interop.Word.WdAlertLevel]::wdAlertsNone

    # Mo truc tiep file Normal.dotm (khong phai Documents.Add)
    $normalPath = $word.NormalTemplate.FullName
    Write-Host "    Normal.dotm path: $normalPath"
    $tpl = $word.Documents.Open($normalPath, $false, $false)

    Write-Host "[3/3] Dang thiet lap chuan hoa..." -ForegroundColor Yellow

    # --- Kho giay va le trang ---
    $tpl.PageSetup.PaperSize   = 7    # wdPaperA4
    $tpl.PageSetup.Orientation = 0    # wdOrientPortrait
    $tpl.PageSetup.TopMargin    = ${topPt}
    $tpl.PageSetup.BottomMargin = ${bottomPt}
    $tpl.PageSetup.LeftMargin   = ${leftPt}
    $tpl.PageSetup.RightMargin  = ${rightPt}

    # --- Style Normal: Font + Gian dong ---
    $styleNormal = $tpl.Styles | Where-Object { $_.NameLocal -eq "Normal" -or $_.NameLocal -eq "Binh thuong" }
    if (-not $styleNormal) { $styleNormal = $tpl.Styles.Item("Normal") }

    $styleNormal.Font.Name   = "${preset.fontName}"
    $styleNormal.Font.Size   = ${preset.fontSizeBody}
    $styleNormal.Font.Bold   = $false
    $styleNormal.Font.Italic = $false

    $styleNormal.ParagraphFormat.LineSpacingRule = 5    # wdLineSpaceMultiple
    $styleNormal.ParagraphFormat.LineSpacing     = ${lineSpacingPt}
    $styleNormal.ParagraphFormat.SpaceAfter      = 0
    $styleNormal.ParagraphFormat.SpaceBefore     = 0
    $styleNormal.ParagraphFormat.Alignment       = 3    # wdAlignParagraphJustify

    # Luu va dong Normal.dotm
    $tpl.Save()
    $tpl.Close($false)
    $word.Quit()

    Write-Host ""
    Write-Host "====================================================================" -ForegroundColor Green
    Write-Host "[+] THANH CONG! Normal.dotm da duoc cap nhat." -ForegroundColor Green
    Write-Host "    Tu gio mo Word moi se tu dong ap dung:" -ForegroundColor Green
    Write-Host "    - Font: ${preset.fontName} ${preset.fontSizeBody}pt" -ForegroundColor Green
    Write-Host "    - Le: Tren ${preset.marginTop}mm / Duoi ${preset.marginBottom}mm / Trai ${preset.marginLeft}mm / Phai ${preset.marginRight}mm" -ForegroundColor Green
    Write-Host "    - Gian dong: ${preset.lineSpacing} lines (chuan Nghi dinh 30/2020)" -ForegroundColor Green
    Write-Host "====================================================================" -ForegroundColor Green
} catch {
    Write-Host "" -ForegroundColor Red
    Write-Host "[!] LOI khi chuan hoa Normal.dotm:" -ForegroundColor Red
    Write-Host "    $_" -ForegroundColor Red
    Write-Host "" -ForegroundColor Red
    Write-Host "    Nguyen nhan co the:" -ForegroundColor Yellow
    Write-Host "    - Microsoft Word chua duoc cai dat tren may nay" -ForegroundColor Yellow
    Write-Host "    - File Normal.dotm dang bi khoa boi phan mem khac" -ForegroundColor Yellow
    Write-Host "    - Thu dong tat ca cua so Office roi chay lai." -ForegroundColor Yellow
    try { if ($word) { $word.Quit() } } catch {}
}
`;
}

// 7. Standardize Regional Settings (ShortDate to dd/MM/yyyy)
export function generateRegionalFixScript(): string {
  return `# PowerShell script to fix Excel Date Format (Regional Settings)
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "Đang chuẩn hóa định dạng ngày tháng hệ thống thành dd/MM/yyyy..."
Set-ItemProperty -Path "HKCU:\\Control Panel\\International" -Name "sShortDate" -Value "dd/MM/yyyy"
Set-ItemProperty -Path "HKCU:\\Control Panel\\International" -Name "sDate" -Value "/"
Set-ItemProperty -Path "HKCU:\\Control Panel\\International" -Name "iDate" -Value "1"

# Notify Windows of setting change
$signature = '[DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)] public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint Msg, UIntPtr wParam, string lParam, uint flags, uint timeout, out UIntPtr result);'
$type = Add-Type -MemberDefinition $signature -Name "Win32SendMessage" -Namespace "Win32" -PassThru
$result = [UIntPtr]::Zero
$type::SendMessageTimeout([IntPtr]0xffff, 0x001A, [UIntPtr]::Zero, "Control Panel", 2, 5000, [ref]$result)

Write-Host "Hoàn tất chuẩn hóa dd/MM/yyyy! Hệ thống đã cập nhật tức thì."
`;
}

// 8. Clear Office Cache and Kill Zombie Processes
export function generateOfficeCacheCleanerScript(): string {
  return `# PowerShell script to clean Office cache and fix hangs
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "Đang buộc dừng các tiến trình Office bị treo..."
Stop-Process -Name "WINWORD", "EXCEL", "POWERPNT" -Force -ErrorAction SilentlyContinue

Write-Host "Đang dọn dẹp bộ nhớ đệm (Cache) của Office..."
$cachePath = "$env:LOCALAPPDATA\\Microsoft\\Office\\16.0\\OfficeFileCache"
if (Test-Path $cachePath) {
    Remove-Item -Path "$cachePath\\*" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "Đã dọn sạch Office Cache thành công!"
} else {
    Write-Host "Không tìm thấy bộ nhớ đệm Office cần dọn."
}
`;
}

// 9. Clear Office Recent History
export function generateOfficeHistoryCleanerScript(): string {
  return `# PowerShell script to clear Word/Excel recent files history
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "Đang xóa lịch sử file đã mở gần đây của Word..."
$wordKey = "HKCU:\\Software\\Microsoft\\Office\\16.0\\Word\\User MRU"
if (Test-Path $wordKey) { Remove-Item -Path $wordKey -Recurse -Force -ErrorAction SilentlyContinue }

Write-Host "Đang xóa lịch sử file đã mở gần đây của Excel..."
$excelKey = "HKCU:\\Software\\Microsoft\\Office\\16.0\\Excel\\User MRU"
if (Test-Path $excelKey) { Remove-Item -Path $excelKey -Recurse -Force -ErrorAction SilentlyContinue }

Write-Host "Đã xóa sạch lịch sử truy cập Office gần đây!"
`;
}

export function generateFixWordCrashScript(): string {
  return `# PowerShell script to fix Word/Excel crashes
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "[*] Đang đóng toàn bộ tiến trình Word/Excel..."
Stop-Process -Name "WINWORD", "EXCEL", "POWERPNT" -Force -ErrorAction SilentlyContinue

Write-Host "[*] Xóa cache Normal.dotm (Khôi phục khởi động Word)..."
$appData = [Environment]::GetFolderPath("ApplicationData")
$wordTemplates = "$appData\\Microsoft\\Templates"
if (Test-Path "$wordTemplates\\Normal.dotm") {
    Remove-Item "$wordTemplates\\Normal.dotm" -Force
}

Write-Host "[*] Dọn dẹp Add-ins rác gây treo máy..."
$registryPaths = @(
    "HKCU:\\Software\\Microsoft\\Office\\Word\\Addins",
    "HKCU:\\Software\\Microsoft\\Office\\Excel\\Addins"
)
foreach ($path in $registryPaths) {
    if (Test-Path $path) {
        Remove-Item -Path $path -Recurse -Force -ErrorAction SilentlyContinue
    }
}
Write-Host "[+] Đã xử lý xong lỗi treo văng ứng dụng!"
`;
}

export function generateClearOfficeCredentialsScript(): string {
  return `# PowerShell script to clear Office Credentials
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "[*] Đang xóa bộ nhớ đệm xác thực Windows Credentials..."
cmdkey /list | Select-String "MicrosoftOffice" | ForEach-Object { 
    $target = ($_ -split "Target: ")[1]
    if ($target) { cmdkey /delete:$target > $null }
}

Write-Host "[*] Xóa khóa Identity của Office trong Registry..."
$identityKey = "HKCU:\\Software\\Microsoft\\Office\\16.0\\Common\\Identity"
if (Test-Path $identityKey) {
    Remove-Item -Path $identityKey -Recurse -Force -ErrorAction SilentlyContinue
}

$licensingFolder = "$env:LOCALAPPDATA\\Microsoft\\Office\\16.0\\Licensing"
if (Test-Path $licensingFolder) {
    Remove-Item -Path "$licensingFolder\\*" -Force -Recurse -ErrorAction SilentlyContinue
}

Write-Host "[+] Đã xóa sạch phiên đăng nhập bị kẹt. Vui lòng mở lại Office để đăng nhập mới!"
`;
}

export function generateRetailToVolumeScript(): string {
  return `@echo off
chcp 65001 >nul
echo [*] Đang tìm và nạp chứng chỉ Volume (VL) cho Office...

set "officePath="
for %%p in (
    "%ProgramFiles%\\Microsoft Office\\root\\Licenses16"
    "%ProgramFiles(x86)%\\Microsoft Office\\root\\Licenses16"
) do (
    if exist "%%~p\\proplusvl_kms*.xrm-ms" (
        set "officePath=%%~p"
    )
)

if "%officePath%"=="" (
    echo [ERROR] Không tìm thấy thư mục chứng chỉ của Office 16.
    exit /b
)

set "ospp="
for %%p in (
    "%ProgramFiles%\\Microsoft Office\\Office16\\ospp.vbs"
    "%ProgramFiles(x86)%\\Microsoft Office\\Office16\\ospp.vbs"
) do (
    if exist "%%~p" set "ospp=%%~p"
)

if "%ospp%"=="" (
    echo [ERROR] Không tìm thấy file ospp.vbs.
    exit /b
)

echo [*] Nạp chứng chỉ từ: %officePath%
cscript //nologo "%ospp%" /inslic:"%officePath%\\proplusvl_kms_client-ppd.xrm-ms" >nul
cscript //nologo "%ospp%" /inslic:"%officePath%\\proplusvl_kms_client-ul-oob.xrm-ms" >nul
cscript //nologo "%ospp%" /inslic:"%officePath%\\proplusvl_kms_client-ul.xrm-ms" >nul
cscript //nologo "%ospp%" /inslic:"%officePath%\\proplusvl_mak-pl.xrm-ms" >nul
cscript //nologo "%ospp%" /inslic:"%officePath%\\proplusvl_mak-ppd.xrm-ms" >nul
cscript //nologo "%ospp%" /inslic:"%officePath%\\proplusvl_mak-ul-oob.xrm-ms" >nul
cscript //nologo "%ospp%" /inslic:"%officePath%\\proplusvl_mak-ul.xrm-ms" >nul

echo [+] Đã ép chuyển thành công kênh Retail sang Volume Licensing!
`;
}

export function generateBlockOfficeUpdateScript(): string {
  return `# PowerShell script to block Office Updates
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "[*] Đang đóng băng tính năng cập nhật của Office..."
$updateKey = "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Office\\16.0\\Common\\OfficeUpdate"

if (-not (Test-Path $updateKey)) {
    New-Item -Path $updateKey -Force | Out-Null
}

Set-ItemProperty -Path $updateKey -Name "EnableAutomaticUpdates" -Value 0 -Type DWord -Force
Set-ItemProperty -Path $updateKey -Name "HideEnableDisableUpdates" -Value 1 -Type DWord -Force

Write-Host "[+] Đã đóng băng hoàn toàn cập nhật. Phiên bản hiện tại sẽ giữ nguyên!"
`;
}


// Office Quick Repair Script (PowerShell / CMD)
export function generateOfficeQuickRepairScript(): string {
  return `# PowerShell script to run Microsoft Office Click-to-Run Quick Repair
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$c2rPath = "$env:CommonProgramFiles\\microsoft shared\\ClickToRun\\OfficeClickToRun.exe"
$c2rPathx86 = "$env:CommonProgramFiles(x86)\\microsoft shared\\ClickToRun\\OfficeClickToRun.exe"

Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "      KÍCH HOẠT QUỐC GIA MICROSOFT OFFICE QUICK REPAIR              " -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host ""

if (Test-Path $c2rPath) {
    Write-Host "[*] Đang khởi chạy tiến trình Quick Repair của Microsoft Office (x64)..." -ForegroundColor Yellow
    Start-Process -FilePath $c2rPath -ArgumentList "scenario=Repair platform=x64 culture=en-us RepairType=QuickRepair DisplayLevel=True"
    Write-Host "[+] Đã kích hoạt cửa sổ Quick Repair chính hãng Microsoft thành công!" -ForegroundColor Green
} elseif (Test-Path $c2rPathx86) {
    Write-Host "[*] Đang khởi chạy tiến trình Quick Repair của Microsoft Office (x86)..." -ForegroundColor Yellow
    Start-Process -FilePath $c2rPathx86 -ArgumentList "scenario=Repair platform=x86 culture=en-us RepairType=QuickRepair DisplayLevel=True"
    Write-Host "[+] Đã kích hoạt cửa sổ Quick Repair chính hãng Microsoft thành công!" -ForegroundColor Green
} else {
    Write-Host "[!] Không tìm thấy trình OfficeClickToRun.exe trực tiếp. Đang mở Control Panel AppWiz..." -ForegroundColor Yellow
    & control appwiz.cpl
}
`;
}
