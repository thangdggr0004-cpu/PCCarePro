# VM Test — Windows 11: Smart App Control + Defender vs Portable Self-Updater
# Chạy TRÊN MÁY ẢO Windows 11 (không chạy trên máy thật).
# Yêu cầu: cảnh báo này là giai đoạn bắt buộc trước release chính thức.
#
# Mục đích (3 mục tiêu từ điều kiện release):
#   (a) SAC có chặn cứng portable exe không?
#   (b) SmartScreen hiện cảnh báo loại nào (color/severity; có nút "Run anyway" không)?
#   (c) Cơ chế tự tải + ghi đè exe (exe.next -> exe) có bị Defender/SAC gắn cờ
#       khi THỰC THI thật không (không phải scan tĩnh)?
#
# Cách dùng:
#   .\scripts\vm-windows11-sac-test.ps1 -PortableExe "C:\path\pccare-master-pro.exe" -LogPath "$env:TEMP\sac-report.json"

param(
  [Parameter(Mandatory = $true)][string]$PortableExe,
  [string]$UpdateEndpoint = "https://github.com/thangdggr0004-cpu/PCCarePro/releases/latest/download/latest.json",
  [string]$LogPath = "$env:TEMP\sac-report.json"
)

$ErrorActionPreference = "Stop"
$report = [ordered]@{
  date = (Get-Date).ToString("o")
  os = (Get-CimInstance Win32_OperatingSystem | Select-Object -ExpandProperty Caption)
  osVersion = (Get-CimInstance Win32_OperatingSystem | Select-Object -ExpandProperty Version)
}

# ── 1. Trạng thái SAC ────────────────────────────────────────────────
# VerifiedAndReputablePolicyState: 0 = Off, 1 = On, 2 = Evaluation
$sacPath = "HKLM:\SYSTEM\CurrentControlSet\Control\CI\Policy"
$sac = if (Test-Path $sacPath) { (Get-ItemProperty $sacPath -Name VerifiedAndReputablePolicyState -ErrorAction SilentlyContinue).VerifiedAndReputablePolicyState } else { $null }
$def = Get-MpComputerStatus -ErrorAction SilentlyContinue
$report.sac = switch ($sac) { 1 { "ON (block)" } 2 { "EVALUATION" } default { "OFF / N/A ($sac)" } }
$report.defender = [ordered]@{
  realtime = $def.RealTimeProtectionEnabled
  asr = $def.AsrEnabled
  engine = $def.AMEngineVersion
  tamper = $def.IsTamperProtected
}
$report | ConvertTo-Json -Depth 6 | Set-Content $LogPath -Encoding utf8
Write-Host "SAC = $($report.sac)"
Write-Host "Defender realtime = $($report.defender.realtime)"

# ── 2. (a)/(b) Chạy portable exe GỐC ─────────────────────────────────
Write-Host ""
Write-Host "==(A) PHONG TO =="
Write-Host "Mở launch bản cai exe gốc ngay sau đây:" $PortableExe
Write-Host "  - Nếu SAC CHẶN CỨNG (không mở được, không có 'Run anyway') => ghi (a)=BLOCKED"
Write-Host "  - Nếu SmartScreen hiện cảnh báo big lần đầu: ghi màu/mức độ (xanh? vàng? đỏ?)"
Write-Host "    và có nút 'Run anyway' hay 'More info' để chạy tiếp."
Start-Process $PortableExe
Start-Sleep -Seconds 8
$q = Read-Host "Exe đã mở? (yes/blocked). Neu blocked ghi (a)=BLOCKED. Press Enter sau khi quan sát SmartScreen..."
$report.phase1 = [ordered]@{
  originalExe = $PortableExe
  launched = ($q -notmatch 'block')
  sacBlockScreens = $q
}
$report | ConvertTo-Json -Depth 6 | Set-Content $LogPath -Encoding utf8

# ── 3. (c) Tự tải + ghi đè exe (cơ chế portable updater) ─────────────
Write-Host ""
Write-Host "==(C) THỰC THI TỰ CẬP NHẬT =="
Write-Host "Mô phỏng đúng cơ chế: tải bản mới về dang '<exe>.next' roi atomic move ghi đè."
$exe = (Get-Item $PortableExe).FullName
$next = "$exe.next"
try {
  Write-Host "Tai latest.json: $UpdateEndpoint"
  $m = Invoke-RestMethod $UpdateEndpoint -TimeoutSec 20
  $pit = $m.platforms.'windows-x86_64'
  Write-Host "Bản mới: $($m.version) -> $($pit.url)"
  Invoke-WebRequest $pit.url -OutFile $next -UseBasicParsing | Out-Null
  Write-Host "Đã tai xuong: $next"

  # Giả lập đúng lệnh portable_update_apply (atomic single move)
  & cmd.exe /c "move /Y `"$next`" `"$exe`"" | Out-Null
  Write-Host "Atomic move đã chạy. Kiểm tra Defender/SAC cảnh báo? (thời gian thực)"
  Start-Sleep -Seconds 5
  $hits = Get-MpThreatDetection -ErrorAction SilentlyContinue | Where-Object { $_.Resources -like "*pccare-master-pro*" }
  $report.phase2 = [ordered]@{
    selfUpdateExecuted = $true
    defenderFlags = @($hits | ForEach-Object { "$($_.ThreatID): $($_.Resources)" })
    anyDetection = ($null -ne $hits -and @($hits).Count -gt 0)
  }
} catch {
  $report.phase2 = [ordered]@{ selfUpdateExecuted = $false; error = $_.Exception.Message }
  Write-Host "Lỗi bước (c): $($_.Exception.Message)"
}

# ── (tolai) Neu (a)=BLOCKED, thử lại khi tắt SAC ─────────────────────
$report.sacRequired = ($report.phase1.sacBlockScreens -match 'block')
$report | ConvertTo-Json -Depth 6 | Set-Content $LogPath -Encoding utf8
Write-Host ""
Write-Host "Report: $LogPath"
Write-Host "KẾT LUẬN cần ghi vào README sau test:"
Write-Host "  - SAC chặn cứng?  $($report.phase1.sacBlockScreens)"
Write-Host "  - Defender gắn cờ self-update?  $($report.phase2.anyDetection)"
Write-Host "  - Cần hướng dẫn tắt SAC trong release?  $($report.sacRequired)"