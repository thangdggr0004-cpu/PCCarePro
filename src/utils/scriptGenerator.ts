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



// 6. Word Document Standardizer - Pure PowerShell COM
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

# Buoc 1: Dong tat ca tien trinh Word dang chay
Write-Host "[1/3] Dong tien trinh Word dang chay (neu co)..." -ForegroundColor Yellow
Stop-Process -Name "WINWORD" -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 600

$word = $null
$tpl = $null
try {
    Write-Host "[2/3] Khoi tao Word COM va nap template Normal.dotm..." -ForegroundColor Yellow
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0

    # Su dung NormalTemplate.OpenAsDocument() de lay document object an toan
    $tpl = $word.NormalTemplate.OpenAsDocument()

    Write-Host "[3/3] Dang ap dung dinh dang chuan Nghi dinh 30/2020..." -ForegroundColor Yellow

    # --- Kho giay va le trang ---
    $tpl.PageSetup.PaperSize   = 7    # wdPaperA4
    $tpl.PageSetup.Orientation = 0    # wdOrientPortrait
    $tpl.PageSetup.TopMargin    = ${topPt}
    $tpl.PageSetup.BottomMargin = ${bottomPt}
    $tpl.PageSetup.LeftMargin   = ${leftPt}
    $tpl.PageSetup.RightMargin  = ${rightPt}

    # --- Style Normal: Font + Gian dong ---
    $styleNormal = $tpl.Styles | Where-Object { $_.NameLocal -eq "Normal" -or $_.NameLocal -eq "Bình thường" -or $_.NameLocal -eq "Default" }
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

    # Luu template
    $tpl.Save()

    Write-Host ""
    Write-Host "====================================================================" -ForegroundColor Green
    Write-Host "[+] THANH CONG! Normal.dotm da duoc cap nhat chuan hoa." -ForegroundColor Green
    Write-Host "    - Font: ${preset.fontName} ${preset.fontSizeBody}pt" -ForegroundColor Green
    Write-Host "    - Le: Tren ${preset.marginTop}mm / Duoi ${preset.marginBottom}mm / Trai ${preset.marginLeft}mm / Phai ${preset.marginRight}mm" -ForegroundColor Green
    Write-Host "    - Gian dong: ${preset.lineSpacing} lines (Chuan Nghi dinh 30/2020)" -ForegroundColor Green
    Write-Host "====================================================================" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Error "[!] LOI khi chuan hoa Word: $_"
    exit 1
} finally {
    if ($tpl) {
        try { $tpl.Close([ref]$false) } catch {}
    }
    if ($word) {
        try { $word.Quit([ref]$false) } catch {}
        try { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null } catch {}
    }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
`;
}

// 7. Standardize Regional Settings (ShortDate to dd/MM/yyyy)
export function generateRegionalFixScript(): string {
  return `# PowerShell script to fix Excel Date Format (Regional Settings)
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "      CHUAN HOA DINH DANG NGAY THANG EXCEL (dd/MM/yyyy)             " -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[*] Thiet lap Registry International: sShortDate=dd/MM/yyyy, sDate=/, iDate=1..." -ForegroundColor Yellow
Set-ItemProperty -Path "HKCU:\\Control Panel\\International" -Name "sShortDate" -Value "dd/MM/yyyy"
Set-ItemProperty -Path "HKCU:\\Control Panel\\International" -Name "sDate" -Value "/"
Set-ItemProperty -Path "HKCU:\\Control Panel\\International" -Name "iDate" -Value "1"

# Broadcast thong bao he thong cap nhat ngay lap tuc
Write-Host "[*] Gui tin hieu Broadcast WM_SETTINGCHANGE den toan he thong..." -ForegroundColor Yellow
if (-not ("Win32.Win32SendMessage" -as [type])) {
    $signature = '[DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)] public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint Msg, UIntPtr wParam, string lParam, uint flags, uint timeout, out UIntPtr result);'
    Add-Type -MemberDefinition $signature -Name "Win32SendMessage" -Namespace "Win32" | Out-Null
}

$result = [UIntPtr]::Zero
[Win32.Win32SendMessage]::SendMessageTimeout([IntPtr]0xffff, 0x001A, [UIntPtr]::Zero, "Control Panel", 2, 5000, [ref]$result) | Out-Null
[Win32.Win32SendMessage]::SendMessageTimeout([IntPtr]0xffff, 0x001A, [UIntPtr]::Zero, "intl", 2, 5000, [ref]$result) | Out-Null

Write-Host ""
Write-Host "====================================================================" -ForegroundColor Green
Write-Host "[+] HOAN TAT! Dinh dang ngay thang da duoc dong bo chuan dd/MM/yyyy." -ForegroundColor Green
Write-Host "====================================================================" -ForegroundColor Green
`;
}

// 8. Clear Office Cache and Kill Zombie Processes
export function generateOfficeCacheCleanerScript(): string {
  return `# PowerShell script to clean Office cache and fix hangs
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "         DON DEP OFFICE CACHE VA GIAI PHONG TIEN TRINH KHOA         " -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/2] Buoc dung cac tien trinh Office va tien trinh khoa cache..." -ForegroundColor Yellow
$procList = @("WINWORD", "EXCEL", "POWERPNT", "OUTLOOK", "ONENOTE", "msosync", "groove", "OfficeClickToRun")
foreach ($p in $procList) {
    Stop-Process -Name $p -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Milliseconds 600

Write-Host "[2/2] Dang quet va don dep bo nho dem Office..." -ForegroundColor Yellow
$cacheDirs = @(
    "$env:LOCALAPPDATA\\Microsoft\\Office\\16.0\\OfficeFileCache",
    "$env:LOCALAPPDATA\\Microsoft\\Office\\15.0\\OfficeFileCache",
    "$env:LOCALAPPDATA\\Microsoft\\Office\\16.0\\WebServiceCache",
    "$env:LOCALAPPDATA\\Microsoft\\Office\\15.0\\WebServiceCache",
    "$env:LOCALAPPDATA\\Microsoft\\Office\\16.0\\Wef",
    "$env:LOCALAPPDATA\\Microsoft\\Office\\15.0\\Wef",
    "$env:LOCALAPPDATA\\Microsoft\\Office\\UnsavedFiles"
)

$clearedCount = 0
foreach ($dir in $cacheDirs) {
    if (Test-Path $dir) {
        $items = Get-ChildItem -Path $dir -Recurse -Force -ErrorAction SilentlyContinue
        $clearedCount += $items.Count
        Remove-Item -Path "$dir\\*" -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "  [-] Da don: $dir"
    }
}

Write-Host ""
Write-Host "====================================================================" -ForegroundColor Green
Write-Host "[+] THANH CONG! Da don sach $clearedCount muc bo nho dem Office." -ForegroundColor Green
Write-Host "====================================================================" -ForegroundColor Green
`;
}

// 9. Clear Office Recent History
export function generateOfficeHistoryCleanerScript(): string {
  return `# PowerShell script to clear Word/Excel recent files history
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "           XOA LICH SU FILE OFFICE DA MO GAN DAY (RECENT)           " -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/2] Dang xoa lich su Recent trong Registry cua tat ca ung dung Office..." -ForegroundColor Yellow
$apps = @("Word", "Excel", "PowerPoint", "Access", "Publisher")
$versions = @("16.0", "15.0", "14.0")
$subKeys = @("User MRU", "File MRU", "Place MRU")

$clearedKeys = 0
foreach ($ver in $versions) {
    foreach ($app in $apps) {
        foreach ($sub in $subKeys) {
            $keyPath = "HKCU:\\Software\\Microsoft\\Office\\$ver\\$app\\$sub"
            if (Test-Path $keyPath) {
                Remove-Item -Path $keyPath -Recurse -Force -ErrorAction SilentlyContinue
                $clearedKeys++
            }
        }
    }
}

Write-Host "[2/2] Dang xoa file shortcut Recent trong thu muc AppData..." -ForegroundColor Yellow
$recentCount = 0
$recentDir = "$env:APPDATA\\Microsoft\\Office\\Recent"
if (Test-Path $recentDir) {
    $items = Get-ChildItem -Path $recentDir -Force -ErrorAction SilentlyContinue
    $recentCount = $items.Count
    Remove-Item -Path "$recentDir\\*" -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "====================================================================" -ForegroundColor Green
Write-Host "[+] THANH CONG! Da xoa sach $clearedKeys khoa Registry va $recentCount shortcut lich su." -ForegroundColor Green
Write-Host "====================================================================" -ForegroundColor Green
`;
}

// 10. Fix Word/Excel Crashes, corrupt Normal.dotm & bad Add-ins
export function generateFixWordCrashScript(): string {
  return `# PowerShell script to fix Word/Excel crashes
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "        SUA LOI TREO / CRASH WORD VA EXCEL CHUYEN SAU                " -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/4] Dong toan bo tien trinh Office dang bi xung dot..." -ForegroundColor Yellow
$procList = @("WINWORD", "EXCEL", "POWERPNT", "OUTLOOK", "ONENOTE", "msosync")
foreach ($p in $procList) {
    Stop-Process -Name $p -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Milliseconds 600

Write-Host "[2/4] Sao luu va dat lai file mau Normal.dotm..." -ForegroundColor Yellow
$templates = [System.IO.Path]::Combine([Environment]::GetFolderPath("ApplicationData"), "Microsoft\\Templates")
$normalDotm = [System.IO.Path]::Combine($templates, "Normal.dotm")
if (Test-Path $normalDotm) {
    Copy-Item -Path $normalDotm -Destination "$normalDotm.bak" -Force -ErrorAction SilentlyContinue
    Remove-Item -Path $normalDotm -Force -ErrorAction SilentlyContinue
    Write-Host "  [-] Da backup sang Normal.dotm.bak va xoa Normal.dotm bi loi."
}

Write-Host "[3/4] Xoa bo dem loi crash loop (Resiliency) va Add-ins gay treo..." -ForegroundColor Yellow
$regPaths = @(
    "HKCU:\\Software\\Microsoft\\Office\\Word\\Addins",
    "HKCU:\\Software\\Microsoft\\Office\\Excel\\Addins",
    "HKCU:\\Software\\Microsoft\\Office\\PowerPoint\\Addins",
    "HKCU:\\Software\\Microsoft\\Office\\16.0\\Word\\Resiliency",
    "HKCU:\\Software\\Microsoft\\Office\\16.0\\Excel\\Resiliency",
    "HKCU:\\Software\\Microsoft\\Office\\15.0\\Word\\Resiliency",
    "HKCU:\\Software\\Microsoft\\Office\\15.0\\Excel\\Resiliency"
)
foreach ($rp in $regPaths) {
    if (Test-Path $rp) {
        Remove-Item -Path $rp -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "  [-] Da don khoa: $rp"
    }
}

Write-Host "[4/4] Don dep thu muc khoi dong tu dong (STARTUP / XLSTART)..." -ForegroundColor Yellow
$startupPaths = @(
    "$env:APPDATA\\Microsoft\\Word\\STARTUP",
    "$env:APPDATA\\Microsoft\\Excel\\XLSTART"
)
foreach ($sp in $startupPaths) {
    if (Test-Path $sp) {
        Remove-Item -Path "$sp\\*" -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "  [-] Da don thu muc: $sp"
    }
}

Write-Host ""
Write-Host "====================================================================" -ForegroundColor Green
Write-Host "[+] THANH CONG! Da khac phuc toan bo nguyen nhan gay treo/crash Office." -ForegroundColor Green
Write-Host "====================================================================" -ForegroundColor Green
`;
}

// 11. Clear Office Credentials & Identity Cache
export function generateClearOfficeCredentialsScript(): string {
  return `# PowerShell script to clear Office Credentials
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "         XOA PHIEN DANG NHAP VA KET TAI KHOAN OFFICE                 " -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/3] Dong toan bo tien trinh Office va dong bo..." -ForegroundColor Yellow
$procList = @("WINWORD", "EXCEL", "POWERPNT", "OUTLOOK", "ONENOTE", "msosync")
foreach ($p in $procList) {
    Stop-Process -Name $p -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Milliseconds 600

Write-Host "[2/3] Xoa thong tin xac thuc Office trong Windows Credential Manager..." -ForegroundColor Yellow
$cmdkeyOut = cmdkey /list
$deletedCreds = 0
foreach ($line in $cmdkeyOut) {
    if ($line -match "Target:\s*(.*)") {
        $target = $matches[1].Trim()
        if ($target -match "MicrosoftOffice|MicrosoftAccount|MS\\.Outlook") {
            cmdkey /delete:$target > $null
            $deletedCreds++
            Write-Host "  [-] Da xoa credential: $target"
        }
    }
}

Write-Host "[3/3] Xoa khoa Identity Registry va Licensing cache..." -ForegroundColor Yellow
$identityKeys = @(
    "HKCU:\\Software\\Microsoft\\Office\\16.0\\Common\\Identity",
    "HKCU:\\Software\\Microsoft\\Office\\15.0\\Common\\Identity"
)
foreach ($ik in $identityKeys) {
    if (Test-Path $ik) {
        Remove-Item -Path $ik -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "  [-] Da xoa Identity: $ik"
    }
}

$licensingDirs = @(
    "$env:LOCALAPPDATA\\Microsoft\\Office\\16.0\\Licensing",
    "$env:LOCALAPPDATA\\Microsoft\\Office\\15.0\\Licensing"
)
foreach ($ld in $licensingDirs) {
    if (Test-Path $ld) {
        Remove-Item -Path "$ld\\*" -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "  [-] Da xoa Licensing cache: $ld"
    }
}

Write-Host ""
Write-Host "====================================================================" -ForegroundColor Green
Write-Host "[+] THANH CONG! Da xoa $deletedCreds credentials va lam sach phien Office." -ForegroundColor Green
Write-Host "    Vui long mo lai Word hoac Excel de dang nhap tai khoan moi." -ForegroundColor Green
Write-Host "====================================================================" -ForegroundColor Green
`;
}

// 12. Convert Retail to Volume Licensing (Pure PowerShell, Runs Elevated)
export function generateRetailToVolumeScript(): string {
  return `# PowerShell script to convert Office Retail to Volume Licensing
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "    CHUYEN DOI KENH CAP PHEP OFFICE (RETAIL -> VOLUME LICENSING)   " -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/3] Dang tim kiem thu muc chung chi Office (Licenses16)..." -ForegroundColor Yellow
$possibleLicenseDirs = @(
    "$env:ProgramFiles\\Microsoft Office\\root\\Licenses16",
    "\${env:ProgramFiles(x86)}\\Microsoft Office\\root\\Licenses16",
    "C:\\Program Files\\Microsoft Office\\root\\Licenses16",
    "C:\\Program Files (x86)\\Microsoft Office\\root\\Licenses16"
)
$licenseDir = $possibleLicenseDirs | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $licenseDir) {
    Write-Error "[!] Khong tim thay thu muc chung chi cua Office (Licenses16)."
    exit 1
}
Write-Host "  [-] Thu muc chung chi: $licenseDir"

Write-Host "[2/3] Dang dinh vi tap tin quan tri ban quyen ospp.vbs..." -ForegroundColor Yellow
$possibleOspp = @(
    "$env:ProgramFiles\\Microsoft Office\\Office16\\ospp.vbs",
    "\${env:ProgramFiles(x86)}\\Microsoft Office\\Office16\\ospp.vbs",
    "C:\\Program Files\\Microsoft Office\\Office16\\ospp.vbs",
    "C:\\Program Files (x86)\\Microsoft Office\\Office16\\ospp.vbs"
)
$ospp = $possibleOspp | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $ospp) {
    Write-Error "[!] Khong tim thay tap tin ospp.vbs tren may tinh."
    exit 1
}
Write-Host "  [-] File OSPP: $ospp"

Write-Host "[3/3] Dang nap chung chi Volume (VL) vao he thong ban quyen..." -ForegroundColor Yellow
$licFiles = Get-ChildItem -Path $licenseDir -Filter "proplusvl_*.xrm-ms" -ErrorAction SilentlyContinue
if ($licFiles.Count -eq 0) {
    $licFiles = Get-ChildItem -Path $licenseDir -Filter "*vl_*.xrm-ms" -ErrorAction SilentlyContinue
}

if ($licFiles.Count -eq 0) {
    Write-Error "[!] Khong tim thay file chung chi .xrm-ms nao trong $licenseDir"
    exit 1
}

$installedCount = 0
foreach ($f in $licFiles) {
    Write-Host "  [*] Dang nap chung chi: $($f.Name)..."
    $res = cscript //nologo "$ospp" /inslic:"$($f.FullName)" 2>&1 | Out-String
    if ($res -match "successfully" -or $res -match "thành công" -or $LASTEXITCODE -eq 0) {
        $installedCount++
    }
}

Write-Host ""
Write-Host "====================================================================" -ForegroundColor Green
Write-Host "[+] THANH CONG! Da nap $installedCount/$($licFiles.Count) chung chi Volume cho Office." -ForegroundColor Green
Write-Host "    Gio day may da san sang kich hoat qua may chu KMS noi bo hoac MAK." -ForegroundColor Green
Write-Host "====================================================================" -ForegroundColor Green
`;
}

// 13. Block Office Updates (GPO + ClickToRun + Scheduled Tasks, Runs Elevated)
export function generateBlockOfficeUpdateScript(): string {
  return `# PowerShell script to block Office Updates
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "                 DONG BANG CAP NHAT MICROSOFT OFFICE                 " -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/3] Thiet lap Group Policy chan cap nhat tu dong..." -ForegroundColor Yellow
$updateKey = "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Office\\16.0\\Common\\OfficeUpdate"
if (-not (Test-Path $updateKey)) {
    New-Item -Path $updateKey -Force | Out-Null
}
Set-ItemProperty -Path $updateKey -Name "EnableAutomaticUpdates" -Value 0 -Type DWord -Force
Set-ItemProperty -Path $updateKey -Name "HideEnableDisableUpdates" -Value 1 -Type DWord -Force
Write-Host "  [-] Da thiet lap GPO: EnableAutomaticUpdates=0, HideEnableDisableUpdates=1"

Write-Host "[2/3] Dong bo cau hinh ClickToRun Configuration..." -ForegroundColor Yellow
$c2rConfig = "HKLM:\\SOFTWARE\\Microsoft\\Office\\ClickToRun\\Configuration"
if (Test-Path $c2rConfig) {
    Set-ItemProperty -Path $c2rConfig -Name "UpdatesEnabled" -Value "False" -Force
    Write-Host "  [-] Da cau hinh ClickToRun Configuration: UpdatesEnabled=False"
}

Write-Host "[3/3] Vo hieu hoa tien trinh Scheduled Tasks cap nhat Office..." -ForegroundColor Yellow
$tasks = @(
    "\\Microsoft\\Office\\Office Automatic Updates 2.0",
    "\\Microsoft\\Office\\Office ClickToRun Service Monitor"
)
foreach ($t in $tasks) {
    try {
        $taskName = ($t -replace "^.*\\\\", "")
        $taskObj = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
        if ($taskObj) {
            Disable-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue | Out-Null
            Write-Host "  [-] Da vo hieu hoa Task: $taskName"
        }
    } catch {}
}

Write-Host ""
Write-Host "====================================================================" -ForegroundColor Green
Write-Host "[+] THANH CONG! Da dong bang hoan toan cap nhat Office." -ForegroundColor Green
Write-Host "    Phien ban hien tai se duoc giu nguyen tuyet doi, tranh mat ban quyen." -ForegroundColor Green
Write-Host "====================================================================" -ForegroundColor Green
`;
}

// 14. Office Quick Repair Script (Detects Real Platform & Culture, Runs Elevated)
export function generateOfficeQuickRepairScript(): string {
  return `# PowerShell script to run Microsoft Office Click-to-Run Quick Repair
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "      KICH HOAT TRINH MICROSOFT OFFICE QUICK REPAIR CHINH HANG      " -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/2] Dang phat hien cau hinh kien truc va ngon ngu Office cai dat..." -ForegroundColor Yellow
$c2rReg = Get-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\Office\\ClickToRun\\Configuration" -ErrorAction SilentlyContinue

$platform = "x64"
if ($c2rReg -and $c2rReg.Platform) {
    $platform = $c2rReg.Platform
} elseif ([IntPtr]::Size -eq 4) {
    $platform = "x86"
}

$culture = "en-us"
if ($c2rReg -and $c2rReg.ClientCulture) {
    $culture = $c2rReg.ClientCulture
}

Write-Host "  [-] Nen tang phat hien: $platform"
Write-Host "  [-] Ngon ngu phat hien: $culture"

Write-Host "[2/2] Dang tim kiem tien trinh OfficeClickToRun.exe..." -ForegroundColor Yellow
$possiblePaths = @(
    "$env:CommonProgramFiles\\microsoft shared\\ClickToRun\\OfficeClickToRun.exe",
    "\${env:CommonProgramFiles(x86)}\\microsoft shared\\ClickToRun\\OfficeClickToRun.exe",
    "C:\\Program Files\\Common Files\\microsoft shared\\ClickToRun\\OfficeClickToRun.exe",
    "C:\\Program Files (x86)\\Common Files\\microsoft shared\\ClickToRun\\OfficeClickToRun.exe"
)

$c2rExe = $possiblePaths | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($c2rExe) {
    Write-Host "  [-] Khoi chay: $c2rExe scenario=Repair platform=$platform culture=$culture RepairType=QuickRepair" -ForegroundColor Yellow
    Start-Process -FilePath $c2rExe -ArgumentList "scenario=Repair platform=$platform culture=$culture RepairType=QuickRepair DisplayLevel=True"
    Write-Host ""
    Write-Host "====================================================================" -ForegroundColor Green
    Write-Host "[+] THANH CONG! Cua so Quick Repair cua Microsoft da duoc mo." -ForegroundColor Green
    Write-Host "====================================================================" -ForegroundColor Green
} else {
    Write-Host "[!] Khong tim thay OfficeClickToRun.exe. Dang mo Control Panel Programs..." -ForegroundColor Yellow
    & control appwiz.cpl
}
`;
}
