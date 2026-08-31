# BÁO CÁO KỸ THUẬT — TAB QUẢN LÝ BẢN QUYỀN (LICENSE MANAGER)

> **Phiên bản**: 2.0.2  
> **Ngày tạo**: 31/08/2026  
> **Mục đích**: Báo cáo toàn diện cho bên thứ ba phân tích, đánh giá codebase

---

## MỤC LỤC

1. [Tổng quan kiến trúc](#1-tổng-quan-kiến-trúc)
2. [Danh sách file và vai trò](#2-danh-sách-file- và-vai-trò)
3. [Công nghệ sử dụng](#3-công-nghệ-sử-dụng)
4. [Frontend — Giao diện người dùng](#4-frontend)
5. [Backend — Rust Core](#5-backend)
6. [Cơ chế chạy PowerShell](#6-cơ-chế-chạy-powershell)
7. [Windows License — Chi tiết](#7-windows-license)
8. [MS Office License — Chi tiết](#8-ms-office-license)
9. [MAS Integration](#9-mas-integration)
10. [Data Safety / Backup](#10-data-safety)
11. [UI/UX Design System](#11-uiux)
12. [Bridge Layer (IPC)](#12-bridge-layer)
13. [Testing](#13-testing)
14. [Bảo mật & Rủi ro](#14-bảo-mật)
15. [Source Code — Đoạn quan trọng](#15-source-code)

---

## 1. TỔNG QUAN KIẾN TRÚC

```
┌──────────────────────────────────────────────────────────┐
│                    FRONTEND (React 19)                     │
│  LicenseManager.tsx  │  OfficeLicenseAnalyzer.tsx  │ ... │
│  AdvancedActivation.tsx  │  OfficeStandardizer.tsx       │
└──────────────┬───────────────────────────────────────────┘
               │  window.electronAPI.* (polyfill)
               ▼
┌──────────────────────────────────────────────────────────┐
│              BRIDGE LAYER (bridge.ts)                      │
│  safeInvokeRaw() → Tauri IPC → #[tauri::command]          │
└──────────────┬───────────────────────────────────────────┘
               │  invoke("scan_activation", { options })
               ▼
┌──────────────────────────────────────────────────────────┐
│           RUST BACKEND (Tauri 2.11.3)                     │
│  activation.rs  │  data_safety.rs  │  exec.rs             │
│  6 commands: scan_activation, deep_clean, restore_oem,    │
│  scan_office_v3, restore_office_v3, run_mas_action       │
└──────────────┬───────────────────────────────────────────┘
               │  exec::run_ps(script) → child process
               ▼
┌──────────────────────────────────────────────────────────┐
│         POWERSHELL 5.1 (Windows built-in)                 │
│  slmgr.vbs  │  ospp.vbs  │  WMI/CIM  │  Registry         │
│  Event Logs  │  Task Scheduler  │  Services  │  Hosts     │
└──────────────────────────────────────────────────────────┘
```

### Nguyên lý hoạt động

1. **Frontend** gọi `window.electronAPI.scanActivation({ type: "windows" })`
2. **bridge.ts** chuyển thành `invoke("scan_activation", { options })` — Tauri IPC
3. **lib.rs** dispatch đến hàm `scan_activation()` trong `activation.rs`
4. **activation.rs** xây dựng script PowerShell dạng raw string (`r#"..."#`)
5. **exec.rs** ghi script ra file temp, chạy `powershell.exe -File <temp>.ps1`
6. PowerShell chạy các lệnh `slmgr.vbs`, `ospp.vbs`, WMI queries, Registry reads
7. Output JSON được parse lại ở Rust, trả về frontend
8. Frontend render UI với badges, colors, risk levels

---

## 2. DANH SÁCH FILE VÀ VAI TRÒ

### Frontend (TypeScript/React)

| File | Dòng | Vai trò |
|------|------|---------|
| `src/components/LicenseManager.tsx` | 1536 | Tab chính — Windows license scan, 8-step diagnostic pipeline |
| `src/components/OfficeLicenseAnalyzer.tsx` | 645 | Office V3 Diagnostic Engine — 8 Collectors, Provenance Engine |
| `src/components/AdvancedActivation.tsx` | 253 | MAS Engine Activator (ẩn, PIN 1111) — HWID, Ohook, KMS38 |
| `src/components/OfficeStandardizer.tsx` | 289 | Office Standardizer + Retail-to-Volume conversion |
| `src/components/license/SharedPresentation.tsx` | 14 | Shared UI primitives (UiSectionHeading, UiInlineLabel) |

### Backend (Rust)

| File | Dòng | Vai trò |
|------|------|---------|
| `src-tauri/src/commands/activation.rs` | 1357 | **Core** — scan Windows, scan Office, deep clean, restore OEM, MAS actions |
| `src-tauri/src/commands/data_safety.rs` | 273 | Backup/rollback/verify — snapshot registry, hosts, slmgr state |
| `src-tauri/src/commands/exec.rs` | 410 | PowerShell execution engine — sync/async, elevated UAC, status file |
| `src-tauri/src/lib.rs` | 981 | Tauri command registration (`generate_handler![]`) |

### Bridge (TypeScript)

| File | Dòng | Vai trò |
|------|------|---------|
| `src/tauri/bridge.ts` | 268 | IPC bridge — 62 methods, polyfill `window.electronAPI` |

---

## 3. CÔNG NGHỆ SỬ DỤNG

### Frontend Stack
| Thành phần | Phiên bản | Lý do chọn |
|------------|-----------|-------------|
| React | ^19.0.1 | UI library chính |
| TypeScript | 5.8.2 | Type safety |
| Tailwind CSS | ^4.1.14 | Utility-first styling |
| Vite | ^6.2.3 | Build tool |
| lucide-react | ^0.546.0 | Icon library |

### Backend Stack
| Thành phần | Phiên bản | Lý do chọn |
|------------|-----------|-------------|
| Tauri | 2.11.3 | Desktop framework (Rust ↔ WebView) |
| serde/serde_json | 1.0 | JSON serialization |
| tokio | 1 | Async runtime |
| reqwest | 0.13 | HTTP client (MAS download) |
| log | 0.4 | Logging |

### Phương pháp thực thi
| Phương pháp | Sử dụng ở | Cơ chế |
|-------------|-----------|--------|
| **Embedded PowerShell** | activation.rs | Script viết trong Rust raw string `r#"..."#`, ghi ra temp file, chạy bằng `powershell.exe -File` |
| **cscript //nologo** | activation.rs | Chạy `slmgr.vbs` và `ospp.vbs` qua Windows Script Host |
| **WMI/CIM** | activation.rs | `Get-CimInstance SoftwareLicensingProduct/Service` |
| **Registry** | activation.rs, data_safety.rs | `Get-ItemProperty`, `reg.exe import/export` |
| **Elevated UAC** | exec.rs | `Start-Process -Verb RunAs` khi cần quyền admin |

---

## 4. FRONTEND — GIAO DIỆN NGƯỜI DÙNG

### 4.1 LicenseManager.tsx (Windows Tab)

**Component chính**: `LicenseManager`

**Props**: Nhận `scanResult` từ parent, render 8-step diagnostic pipeline.

**State management**:
```typescript
const [scanResult, setScanResult] = useState<any>(null);
const [activeStep, setActiveStep] = useState<number | null>(null);
const [isScanning, setIsScanning] = useState(false);
```

**8 Diagnostic Steps (Windows)**:

| Step | Tên | Nguồn dữ liệu | Rule |
|------|-----|----------------|------|
| 1 | Khóa BIOS OA3 | WMI `SoftwareLicensingService.OA3xOriginalProductKey` | Kiểm tra key nhúng phần cứng |
| 2 | Kênh cấp phép | `slmgr /dlv` | Đối chiếu trạng thái kích hoạt và kênh license |
| 3 | Lịch sử CMD & MAS | WMI + Registry + File System | Thu thập Product Key, partial key, Activation ID |
| 4 | KMS Host & Hook | Registry + DNS resolution | Kiểm tra KMS qua Registry và file hosts |
| 5 | Tập tin chưa xác thực | File System | Rà soát task/dịch vụ liên quan kích hoạt |
| 6 | Task & Services | Task Scheduler + Services | Kiểm tra tập tin hệ thống liên quan bản quyền |
| 7 | Registry & Hosts | Registry + Hosts file | Thu thập bằng chứng Digital License |
| 8 | Đánh giá quy tắc | Rule Engine | Tổng hợp nhóm bằng chứng |

**Risk Level Badge System**:
```typescript
const getRiskLevel = (status: string) => {
  switch (status) {
    case 'GENUINE':    return { label: 'Thấp',         color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
    case 'WARNING':    return { label: 'Trung bình',   color: 'text-amber-700 bg-amber-50 border-amber-200' };
    case 'TAMPERED':   return { label: 'Cao',           color: 'text-red-700 bg-red-50 border-red-200' };
    case 'CRITICAL':   return { label: 'Nghiêm trọng', color: 'text-rose-800 bg-rose-100 border-rose-300' };
  }
};
```

**Computed Verdict** (kết quả chẩn đoán):
| Status | Label | Màu |
|--------|-------|-----|
| TAMPERED | Có dấu hiệu bất thường | red |
| WARNING | Cần xem xét thêm | amber |
| UNLICENSED | Chưa kích hoạt | slate |
| GENUINE | Bản quyền chính hãng | emerald |

**Translate function**: `translateFieldValue()` chuyển các giá trị kỹ thuật (LicenseStatus, ProductKeyChannel...) sang tiếng Việt.

**Normalize function**: `normalizeScanActivationResult()` xử lý nhiều format response khác nhau từ backend (snake_case, PascalCase, nested Data/Output/Result).

### 4.2 OfficeLicenseAnalyzer.tsx (Office Tab)

**Component chính**: `OfficeLicenseAnalyzer`

**4 Tabs con**:
| Tab | Nội dung |
|-----|----------|
| matrix | Ma trận 8 Collectors + Confidence scores |
| plan | Kế hoạch khôi phục vi phẫu (Surgical Recovery Plan) |
| audit | Nhật ký kiểm tra chi tiết (Audit Logs) |
| postReport | Báo cáo sau khôi phục |

**8 Office Collectors**:

| # | Collector | Nguồn | Kiểm tra |
|---|-----------|-------|----------|
| 1 | LicenseCollector | ospp.vbs + WMI + C2R Registry + LicensingVK | Trạng thái license, activation method |
| 2 | AuthenticodeCollector | `sppc.dll` signature verification | Chữ ký số system32 |
| 3 | OhookCollector | `sppcs.dll` trong Office dirs | DLL giả mạo Ohook |
| 4 | RegistryCollector | IFEO Debugger hooks | sppsvc/osppsvc hooks |
| 5 | ServicesCollector | ClickToRunSvc, sppsvc, osppsvc | Service health |
| 6 | SPPCollector | Software Protection Platform | Service health |
| 7 | OfficeUpdateCollector | Update channel | Channel verification |
| 8 | WMICollector | WMI CIM | Cross-verification |

**Provenance Engine** (4-level assessment):
| Level | Label | Điều kiện |
|-------|-------|-----------|
| LEVEL_1 | ĐÃ XÁC MINH (VERIFIED) | Retail, Subscription, Digital License |
| LEVEL_2 | RẤT CÓ KHẢ NĂNG ĐỒNG NHẤT | Volume MAK, không tampering |
| LEVEL_3 | CẦN XÁC MINH THÊM | KMS Client, không tampering |
| LEVEL_4 | KHÔNG ĐỦ BẰNG CHỨNG | Unlicensed, tampering, confidence < 50 |

**Confidence Engine**: Tính điểm tin cậy dựa trên số lượng nguồn dữ liệu cross-verify thành công.

### 4.3 AdvancedActivation.tsx (Hidden Feature)

**Bảo mật**: Component bị ẩn, chỉ hiện khi nhập PIN `1111` trên bàn phím.

**4 Action Cards**:

| Action | Mode | Mô tả |
|--------|------|-------|
| Windows HWID Activation | `hwid` | Bản quyền kỹ thuật số vĩnh viễn, gắn Mainboard |
| Office Ohook Activation | `ohook` | Kích hoạt Office vĩnh viễn qua Ohook |
| Windows KMS38 | `kms38` | Server/Enterprise, hết hạn 2038 |
| MAS AIO Full Menu | `aio_menu` | CMD menu đầy đủ |
| Clean/Reset | `clean` | Xóa tất cả dấu vết kích hoạt |

**UI**: Grid 3 cards, mỗi card có badge "VĨNH VIỄN" (emerald) hoặc "ĐẾN 2038" (amber).

---

## 5. BACKEND — RUST CORE

### 5.1 activation.rs — 6 Tauri Commands

| Command | Hàm Rust | Mô tả |
|---------|----------|-------|
| `scan_activation` | `scan_windows_activation()` + `scan_office_activation_summary()` | Quét Windows + Office summary |
| `deep_clean_activation` | `deep_clean_activation(type)` | Deep clean Windows/Office |
| `restore_oem_bios_key` | `restore_oem_bios_key()` | Đọc & khôi phục key OEM BIOS |
| `scan_office_engine_v3` | `scan_office_activation()` | Office V3 Diagnostic (8 Collectors) |
| `restore_office_engine_v3` | (chưa có implementation đầy đủ) | Office restore |
| `run_mas_action` | `run_mas_action(mode)` | MAS AIO: hwid, ohook, kms38, aio_menu, clean |

### 5.2 scan_windows_activation() — Chi tiết

Script PowerShell embedded (~225 dòng) thực hiện:

**TIER 1: OA3 BIOS Key + Windows Licensing (WMI)**
```powershell
$slsService = Get-CimInstance -ClassName SoftwareLicensingService
$oa3Key = $slsService.OA3xOriginalProductKey
$sls = Get-CimInstance -ClassName SoftwareLicensingProduct `
  -Filter "PartialProductKey IS NOT NULL AND ApplicationID = '55c92734-d682-4d71-983e-d6ec3f16059f'"
```

**Channel Detection** (regex pattern matching):
```powershell
if ($desc -match "OEM_DM|OEM_COA|OEM_SLP|OEM_NONSLP") { "OEM" }
elseif ($desc -match "RETAIL") { "RETAIL" }
elseif ($desc -match "VOLUME_KMSCLIENT") { "VOLUME_KMSCLIENT" }
elseif ($desc -match "VOLUME_MAK") { "VOLUME_MAK" }
```

**Generic Key Detection** (base64-encoded list):
```powershell
$b64Keys = "M1Y2NlQsWTc0SCw4SFZYNy..."
$genericKeys = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($b64Keys)) -split ","
$result.Windows.IsGenericKey = ($sls.PartialProductKey -and $genericKeys -contains $sls.PartialProductKey)
```

**TIER 3: System-level Forensic Scans**:
- **Pirated Files**: AutoKMS, SECOH-QAD.dll/exe
- **Suspicious Tasks**: KMS|MAS|AAct|HEU|KMSAuto|Activation-Renewal patterns
- **Suspicious Services**: KMS|MAS|AAct|HEU
- **Hosts Redirects**: microsoft.com, office.com, kms entries
- **KMS Events**: Event IDs 12288/12289 from `Microsoft-Windows-Security-SPP`
- **TSforge Detection**: Registry `HKLM:\SYSTEM\WPA` keys (ngc|TSforge patterns)
- **MasHistory**: Registry + filesystem + event log artifacts

**KMS38 Detection** (3-level):
1. Check `slmgr /xpr` output for "2038"
2. Check `$env:SystemRoot\System32\spp\store_test` path
3. Check `GracePeriodRemaining == 0` + `VOLUME_KMSCLIENT` + `203[0-9]` pattern

**Fake KMS Detection** (2-level):
1. Pattern matching against known pirate domains: `loli, digiboy, msguides, zdf, kms8, kms9, skms, vlmcs, kmsauto, aact`
2. DNS resolution: check if KMS host resolves to `127.x.x.x`, `0.0.0.0`, `::1`

### 5.3 scan_office_activation() — V3 Engine (~550 dòng)

**Collector 1: LicenseCollector**
```powershell
# ospp.vbs
$dstatus = cscript //nologo "$officePath\ospp.vbs" /dstatus
# WMI
$wmiProd = Get-CimInstance SoftwareLicensingProduct -Filter "ApplicationID = '0ff1ce15-a989-479d-af46-f275c6370663'"
# C2R Registry
$c2rReg = "HKLM:\SOFTWARE\Microsoft\Office\ClickToRun\Configuration"
# LicensingVK Registry
$licVkKey = "HKLM:\SOFTWARE\Microsoft\Office\16.0\Common\Licensing\LicensingVK"
```

**Activation Method Detection** (priority order):
1. KMS Client (GVLK) → confidence 80%
2. Volume MAK → confidence 95%
3. Subscription (M365) → confidence 99%
4. Retail Key → confidence 99%
5. Digital License → confidence 90%
6. Fallback → confidence 60%

**Provenance Level Assessment** (4-level enterprise evidence):
```powershell
if ($actMethod -eq "Retail Key" -or $actMethod -eq "Subscription" -or $actMethod -eq "Digital License") {
    $provenanceLevel = "LEVEL_1_VERIFIED"
} elseif ($actMethod -eq "Volume MAK" -and -not $hasTampering) {
    $provenanceLevel = "LEVEL_2_LIKELY_CONSISTENT"
} elseif ($isKmsClient -and -not $hasTampering) {
    $provenanceLevel = "LEVEL_3_SOURCE_REQUIRES_VERIFICATION"
} elseif ($actStatus -eq "UNLICENSED" -or $hasTampering -or $provenanceConfidence -lt 50) {
    $provenanceLevel = "LEVEL_4_INSUFFICIENT_EVIDENCE"
}
```

---

## 6. CƠ CHẾ CHẠY POWERSHELL

### exec.rs — PowerShell Execution Engine

```rust
// Core function: chạy PowerShell script
pub fn run_ps(script: &str) -> String {
    // 1. Ghi script ra temp file (UTF-8 BOM)
    let temp_dir = std::env::temp_dir();
    let script_name = format!("tp_ps_{}.ps1", timestamp);
    let script_path = temp_dir.join(&script_name);
    std::fs::write(&script_path, script_bytes).unwrap();

    // 2. Chạy powershell.exe -NoProfile -ExecutionPolicy Bypass -File <path>
    let output = std::process::Command::new("powershell.exe")
        .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", &script_path_str])
        .output()
        .unwrap();

    // 3. Đọc stdout, trả về string
    String::from_utf8_lossy(&output.stdout).to_string()
}
```

**Elevated execution** (UAC):
```rust
pub fn run_ps_elevated(script: &str) -> Result<String, String> {
    // 1. Ghi script ra file temp
    // 2. Tạo status file: tp_el_{id}.status.txt
    // 3. wrap script trong try/catch + $ErrorActionPreference='Stop'
    // 4. Start-Process powershell -Verb RunAs
    // 5. Poll status file mỗi 500ms, timeout 30s
    // 6. Đọc kết quả từ stdout file
}
```

**JSON extraction**:
```rust
pub fn extract_json(stdout: &str) -> &str {
    // Tìm dấu { đầu tiên và } cuối cùng trong output
    // Loại bỏ BOM, ANSI escape codes, và text không phải JSON
}
```

---

## 7. WINDOWS LICENSE — CHI TIẾT

### Các lệnh Windows được sử dụng

| Lệnh | Mục đích | Output |
|-------|----------|--------|
| `slmgr.vbs /xpr` | Kiểm tra kích hoạt vĩnh viễn | "The machine is permanently activated" |
| `slmgr.vbs /dli` | Hiển thị thông tin license | License Status, Partial Key, Channel |
| `slmgr.vbs /dlv` | Chi tiết license đầy đủ | Tên, Description, KMS Host, Port |
| `slmgr.vbs /upk` | Gỡ Product Key | - |
| `slmgr.vbs /cpky` | Xóa key khỏi Registry | - |
| `slmgr.vbs /ckms` | Xóa KMS host | - |
| `slmgr.vbs /rearm` | Đặt lại licensing status | - |
| `slmgr.vbs /ipk <key>` | Cài Product Key | - |
| `slmgr.vbs /ato` | Kích hoạt online | - |

### WMI Classes

| Class | Filter | Dữ liệu |
|-------|--------|---------|
| `SoftwareLicensingService` | - | OA3xOriginalProductKey |
| `SoftwareLicensingProduct` | `ApplicationID = '55c92734...'` (Windows) | Name, LicenseStatus, PartialProductKey, KMS Host/Port, Channel |
| `SoftwareLicensingProduct` | `ApplicationID = '0ff1ce15...'` (Office) | Tương tự cho Office |

### Registry Keys

| Path | Dữ liệu |
|------|---------|
| `HKLM:\SYSTEM\WPA` | TSforge/ngc detection |
| `HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\SoftwareProtectionPlatform\Activation\Manual` | MAS artifacts |
| `HKLM:\SOFTWARE\Classes\CLSID\{ADB880A6-D8FF-11CF-9377-00AA003B7A11}` | MAS CLSID |

### Deep Clean Operations (8 nhóm)

| Nhóm | Thao tác |
|------|----------|
| 1 | `slmgr /upk` + `/cpky` + `/ckms` + `/rearm` |
| 2 | Xóa AutoKMS, SECOH-QAD, MAS artifacts |
| 3 | Xóa Scheduled Tasks (KMS\|MAS\|AAct\|HEU patterns) |
| 4 | Stop + delete Services (KMS\|MAS\|AAct\|HEU) |
| 5 | Restore hosts file (xóa dòng microsoft.com\|office.com\|kms) |
| 6 | Xóa Registry MAS artifacts |
| 7 | Clear Event Logs (Application, System, KMS) |
| 8 | Restart ClipSVC + SPP services |

---

## 8. MS OFFICE LICENSE — CHI TIẾT

### Office Path Detection

```powershell
$officePaths = @(
    "$env:ProgramFiles\Microsoft Office\Office16",
    "$env:SystemDrive\Program Files (x86)\Microsoft Office\Office16",
    "$env:ProgramFiles\Microsoft Office\Office15",
    "$env:SystemDrive\Program Files (x86)\Microsoft Office\Office15"
)
```

### ospp.vbs Commands

| Lệnh | Mục đích |
|-------|----------|
| `ospp.vbs /dstatus` | Trạng thái license |
| `ospp.vbs /unpkey:<key>` | Gỡ Product Key |
| `ospp.vbs /remhst` | Xóa KMS host |
| `ospp.vbs /act` | Kích hoạt |
| `ospp.vbs /sethst:` | Set KMS host |

### ClickToRun Registry

```
HKLM:\SOFTWARE\Microsoft\Office\ClickToRun\Configuration
  ProductReleaseIds → Volume/Retail/Mondo
  UpdateChannel → Current/Broad/Deferred
  Platform → x64/x86
  VersionToReport → 16.0.xxxx
```

### Office V3 Diagnostic Output Structure

```json
{
  "success": true,
  "isInstalled": true,
  "report": {
    "timestamp": "31/08/2026 12:00:00",
    "skuInfo": { "skuName": "Microsoft Office LTSC Professional Plus 2024", "channel": "Current", "bitness": "x64" },
    "licData": { "activationState": "LICENSED", "licenseChannel": "Volume", "confidence": 95 },
    "provenance": {
      "activationMethod": "KMS Client (GVLK)",
      "activationSource": "Corporate KMS Host (kms.company.local)",
      "confidence": 80,
      "provenanceLevel": "LEVEL_3_SOURCE_REQUIRES_VERIFICATION",
      "isGenuine": true,
      "recommendation": "Nếu cần chứng minh quyền sử dụng hợp lệ...",
      "documentationGuidance": ["Hóa đơn mua máy...", "COA...", "Hợp đồng VLSC..."]
    },
    "confidenceResult": { "confidencePercentage": 87, "level": "CAO" },
    "decisionResult": { "actionAllowed": true, "reason": "..." },
    "impactResult": { "riskLevel": "LOW", "isSafeToProceed": true },
    "surgicalPlan": [...],
    "matrix": [...],
    "auditLogs": [...]
  }
}
```

---

## 9. MAS INTEGRATION

### Microsoft Activation Scripts (MAS)

MAS là công cụ kích hoạt mã nguồn mở, được tích hợp vào app.

### File Search Strategy

```rust
fn mas_local_candidates() -> Vec<PathBuf> {
    // 1. CWD/MAS_AIO.cmd
    // 2. exe_dir/MAS_AIO.cmd
    // 3. exe_dir/resources/MAS_AIO.cmd
    // 4. TEMP/MAS_AIO.cmd
    // 5. C:\ProgramData\ThienPhatToolkit\MAS_AIO.cmd
    // 6. USERPROFILE/Downloads/MAS_AIO.cmd (DFS depth 6)
    // 7. USERPROFILE/Desktop/MAS_AIO.cmd (DFS depth 6)
    // 8. USERPROFILE/Documents/MAS_AIO.cmd (DFS depth 6)
}
```

### Validation
```rust
const MAS_CMD_MIN_SIZE: u64 = 10 * 1024; // 10KB minimum
fn mas_cmd_eligible(path: &Path) -> bool {
    path.is_file() && fs::metadata(path).map(|m| m.len() > MAS_CMD_MIN_SIZE).unwrap_or(false)
}
```

### Online Fallback
```rust
const MAS_USER_REPO_URL: &str = "https://raw.githubusercontent.com/thangdggr0004-cpu/ThienPhatTechToolKit/main/MAS_Temp/Microsoft-Activation-Scripts-master/MAS/All-In-One-Version-KL/MAS_AIO.cmd";
const MAS_OFFICIAL_URL: &str = "https://raw.githubusercontent.com/massgravel/Microsoft-Activation-Scripts/master/MAS/All-In-One-Version-KL/MAS_AIO.cmd";
```

### MAS Action Modes

| Mode | Parameter | Action |
|------|-----------|--------|
| `hwid` | `/HWID` | Windows HWID digital license (permanent) |
| `ohook` | `/Ohook` | Office permanent activation |
| `kms38` | `/KMS38` | Windows Server/Enterprise (until 2038) |
| `aio_menu` | (no param) | Open full MAS menu |
| `clean` | - | Calls `deep_clean_activation("windows")` |

### Elevation
```rust
fn launch_elevated_cmd(cmd_path: &str, param: &str) {
    let ps_cmd = format!(r#"Start-Process cmd.exe -ArgumentList '/k ""{cmd_path}"" {param}' -Verb RunAs"#);
    // Runs via powershell -Verb RunAs → UAC prompt
}
```

---

## 10. DATA SAFETY

### Backup System (data_safety.rs)

**create_backup()** — Snapshot trước khi deep clean:
```powershell
# 1. Registry export (Software Protection Platform)
reg.exe export 'HKLM\SOFTWARE\...\SoftwareProtectionPlatform' $regFile /y

# 2. Hosts file snapshot
Copy-Item $hostsSrc $hostsBak

# 3. Licensing state text
cscript //nologo slmgr.vbs /dli > slmgr_dli.txt
cscript //nologo slmgr.vbs /xpr > slmgr_xpr.txt

# Manifest
@{ id='tp_backup_yyyyMMdd_HHmmss'; kind='deep_clean'; items=[...] }
```

**rollback_backup()** — Restore:
```powershell
# Import registry, restore hosts, re-apply slmgr state
# Note: SPP registry có thể bị Windows chặn quyền ghi
```

**verify_clean_operation()** — Post-clean verification:
- Re-scan activation status
- Check KMS host, pirated files, tasks, services, hosts

**verify_bios_restore()** — Post-OEM-restore verification:
- Check OA3 key, license status, channel, KMS host

### Backup Location
```
%LOCALAPPDATA%\PCCareMasterPro\backups\tp_backup_yyyyMMdd_HHmmss\
  manifest.json
  software_protection.reg
  hosts.bak
  slmgr_dli.txt
  slmgr_xpr.txt
```

---

## 11. UI/UX DESIGN SYSTEM

### Design Tokens
| Token | Giá trị | Sử dụng |
|-------|---------|---------|
| Background | `#0e1626` | Dark background |
| Card | `#131d33` | Card background |
| Border | `border-slate-800` | Default border |
| Text primary | `text-white` | Headings |
| Text secondary | `text-slate-400` | Descriptions |
| Text muted | `text-slate-500` | Captions |

### Color System (Semantic)

**Risk Levels**:
| Level | Background | Text | Border | Icon |
|-------|------------|------|--------|------|
| GENUINE | `bg-emerald-50` | `text-emerald-700` | `border-emerald-200` | ShieldCheck (green) |
| WARNING | `bg-amber-50` | `text-amber-700` | `border-amber-200` | ShieldAlert (amber) |
| TAMPERED | `bg-red-50` | `text-red-700` | `border-red-200` | ShieldX (red) |
| CRITICAL | `bg-rose-100` | `text-rose-800` | `border-rose-300` | AlertTriangle (rose) |

**Diagnostic Steps**:
| Status | Icon | Color |
|--------|------|-------|
| idle | RefreshCw | `text-slate-400` |
| clean | ShieldCheck | `text-emerald-500` |
| warning | ShieldAlert | `text-amber-500` |
| danger | ShieldX | `text-red-500` |

**StatusBadge**:
| Status | Background | Text | Label |
|--------|------------|------|-------|
| idle | `bg-slate-100` | `text-slate-500` | Chưa phân tích |
| clean | `bg-emerald-100` | `text-emerald-700` | Sạch |
| warning | `bg-amber-100` | `text-amber-700` | Cảnh báo |
| danger | `bg-red-100` | `text-red-700` | Nguy hiểm |

### Layout
- **Full-width cards** với `rounded-2xl`, `border`, `shadow-xl`
- **2-column grid** cho step list + detail panel
- **Collapsible sections** (ChevronDown/ChevronRight icons)
- **Progress bars** cho download进度
- **Tooltip system** cho Office terminology (KMS, GVLK, MAK, etc.)

### Animations
- `animate-fade-in` — appear animation
- `animate-spin` — loading spinner
- `animate-bounce` — active download indicator
- `transition-all` — smooth state changes
- `active:scale-95` — button press feedback

---

## 12. BRIDGE LAYER (IPC)

### Architecture

```typescript
// bridge.ts
import { invoke } from '@tauri-apps/api/core';

async function safeInvokeRaw<T>(cmd: string, args?: Record<string, any>): Promise<T | null> {
    try {
        return await invoke<T>(cmd, args);
    } catch (e: any) {
        console.warn(`[TauriBridge] ${cmd}:`, e?.message || e);
        return null;
    }
}

// Mapping
export const tauriBridge = {
    scanActivation: (options: { type: string }) => safeInvokeRaw('scan_activation', { options }),
    deepCleanActivation: (type: string) => safeInvokeRaw('deep_clean_activation', { type }),
    restoreOemBiosKey: () => safeInvokeRaw('restore_oem_bios_key'),
    scanOfficeEngineV3: () => safeInvokeRaw('scan_office_engine_v3'),
    restoreOfficeEngineV3: () => safeInvokeRaw('restore_office_engine_v3'),
    runMasAction: (mode: string) => safeInvokeRaw('run_mas_action', { mode }),
    // ... 56 more methods
};

// Polyfill cho backward compatibility
(window as any).electronAPI = tauriBridge;
```

### Tauri Command Registration (lib.rs)

```rust
tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
        scan_activation,
        deep_clean_activation,
        restore_oem_bios_key,
        scan_office_engine_v3,
        restore_office_engine_v3,
        run_mas_action,
        // ... 40+ more commands
    ])
```

### Data Flow Example

```
User clicks "Quét Windows" button
  → LicenseManager.handleClickScan()
  → window.electronAPI.scanActivation({ type: "windows" })
  → bridge.ts: safeInvokeRaw('scan_activation', { options: { type: "windows" } })
  → Tauri IPC → lib.rs dispatches to activation.rs::scan_activation()
  → activation.rs builds PowerShell script
  → exec.rs writes to temp file, runs powershell.exe
  → PowerShell executes slmgr.vbs, WMI queries, Registry reads
  → Output JSON returned to Rust
  → Rust parses, validates, returns to frontend
  → LicenseManager renders 8-step diagnostic UI
```

---

## 13. TESTING

### Rust Tests (activation.rs)

```rust
#[test]
fn test_search_mas_aio_in_root_finds_expected_layout() {
    // Tạo cấu trúc thư mục giả
    // DFS depth 6 tìm MAS_AIO.cmd
    // Bỏ qua file nhỏ hơn 10KB
}

#[test]
fn test_mas_cmd_eligible_size_threshold() {
    // File > 10KB → eligible
    // File < 10KB → rejected
}

#[test]
fn test_run_mas_action_unknown_mode_is_error() {
    // mode "not_a_real_mode" →返回 Err
}

#[test]
fn test_scan_office_activation_json() {
    // Verify report structure: skuInfo, matrix, impactResult, provenance
    // Verify confidence 0..100
}
```

### Test Coverage
- 37 total tests: 34 pass, 2 fail (environmental — no Epson printer), 1 ignored
- License-related: 4 tests (MAS search, eligible, unknown mode, Office scan JSON)

---

## 14. BẢO MẬT & RỦI RO

### Bảo mật

| Rủi ro | Mức độ | Xử lý |
|--------|--------|--------|
| PowerShell injection | CAO | Scripts là hardcoded strings, không nhận input từ user |
| UAC bypass | CAO | Dùng `Start-Process -Verb RunAs`, đúng flow UAC |
| File temp race condition | THẤP | Script tên unique `tp_ps_{timestamp}.ps1` |
| MAS download MITM | TRUNG BÌNH | Validate file size > 10KB, dùng HTTPS |
| Registry write side-effect | CAO | Backup trước, verify sau, rollback nếu fail |

### Known Limitations

1. **Không thể verify tính hợp pháp** — App chỉ đọc bằng chứng từ hệ thống, không thay thế hóa đơn/bằng chứng mua hàng
2. **SPP Registry bị Windows chặn quyền** — Dù chạy SYSTEM, một số key vẫn bị khóa bởi `manager/slpp`
3. **MAS file search** — Có thể tìm nhầm file không phải MAS thật nếu cùng tên
4. **KMS false positive** — Một số KMS host hợp lệ (doanh nghiệp) có thể bị flag nhầm

### Legal Disclaimer

```powershell
$disclaimerText = "Đánh giá này chỉ phản ánh những bằng chứng Engine đọc được từ hệ thống 
tại thời điểm kiểm tra. Đánh giá này KHÔNG xác nhận tính hợp pháp của giấy phép."
```

---

## 15. SOURCE CODE — ĐOẠN QUAN TRỌNG

### 15.1 Windows Scan Entry Point (activation.rs:8-226)

```rust
pub fn scan_windows_activation() -> Result<serde_json::Value, String> {
    let ps = r#"
    $result = @{ Windows = @{}; System = @{}; LicenseStatus = 0; ... }
    
    # TIER 1: OA3 BIOS Key
    $slsService = Get-CimInstance -ClassName SoftwareLicensingService
    $oa3Key = $slsService.OA3xOriginalProductKey
    
    # Channel Detection
    $desc = [string]$sls.Description
    if ($desc -match "OEM_DM|OEM_COA|OEM_SLP|OEM_NONSLP") { $result.Windows.Channel = "OEM" }
    
    # TIER 3: Forensic scans
    # Pirated Files, Tasks, Services, Hosts, Events, TSforge, MasHistory, KMS38, FakeKMS
    
    $result | ConvertTo-Json -Depth 5
    "#;
    let stdout = run_ps(ps);
    let json_str = exec::extract_json(&stdout);
    let mut parsed: serde_json::Value = serde_json::from_str(json_str).unwrap_or(...);
    parsed["success"] = serde_json::json!(true);
    Ok(parsed)
}
```

### 15.2 MAS Action Router (activation.rs:1209-1285)

```rust
pub fn run_mas_action(mode: &str) -> Result<serde_json::Value, String> {
    let local_cmd = find_local_mas_cmd();
    match mode {
        "hwid" => {
            if let Some(p) = &local_cmd {
                ensure_mas_cmd_eol(&p);
                launch_elevated_cmd(&p.to_string_lossy(), "/HWID");
                Ok(serde_json::json!({ "success": true, "output": "Đã khởi chạy..." }))
            } else {
                run_mas_online("/HWID");
                Ok(serde_json::json!({ "success": true, "output": "Đã nạp MAS..." }))
            }
        }
        "ohook" => { ... }
        "kms38" => { ... }
        "aio_menu" => { ... }
        "clean" => deep_clean_activation("windows"),
        _ => Err(format!("Unknown MAS mode: {}", mode)),
    }
}
```

### 15.3 Backup & Verify (data_safety.rs:10-58)

```rust
pub fn create_backup() -> Result<serde_json::Value, String> {
    let ps = r#"
    $root = Join-Path $env:LOCALAPPDATA 'PCCareMasterPro\backups'
    $id = 'tp_backup_' + (Get-Date -Format 'yyyyMMdd_HHmmss')
    
    # 1. Registry export
    reg.exe export 'HKLM\SOFTWARE\...\SoftwareProtectionPlatform' $regFile /y
    
    # 2. Hosts snapshot
    Copy-Item $hostsSrc $hostsBak
    
    # 3. slmgr state
    cscript //nologo slmgr.vbs /dli > slmgr_dli.txt
    cscript //nologo slmgr.vbs /xpr > slmgr_xpr.txt
    
    @{ success=$true; backupId=$id; count=$items.Count } | ConvertTo-Json
    "#;
    let stdout = run_ps(ps);
    Ok(serde_json::from_str(json).unwrap_or(...))
}
```

### 15.4 Bridge Polyfill (bridge.ts:254-266)

```typescript
// Backward compatibility: tất cả method gán vào window.electronAPI
if (typeof window !== 'undefined') {
    (window as any).electronAPI = tauriBridge;
    (window as any).electron = {
        invoke: (channel: string, ...args: any[]) => invoke(channel, args[0]),
        on: (channel: string, listener: (...args: any[]) => void) => {
            const unlisten = listen(channel, (event) => listener(event.payload));
            return () => { unlisten.then((fn) => fn()); };
        },
        off: () => {},
    };
}
```

---

## KẾT LUẬN

Tab "Quản Lý Bản Quyền" là module phức tạp nhất trong ứng dụng, tích hợp:

1. **8-step Windows diagnostic pipeline** — Quét OA3, Channel, MAS history, KMS, Tasks, Registry, Hosts, Rule evaluation
2. **8-collector Office V3 Engine** — License, Authenticode, Ohook, Registry IFEO, Services, SPP, Update, WMI
3. **4-level Provenance Assessment** — Enterprise evidence framework
4. **MAS Integration** — HWID, Ohook, KMS38 activation qua Microsoft Activation Scripts
5. **Data Safety** — Backup/rollback/verify trước/sau mỗi thao tác nguy hiểm
6. **Hidden AdvancedActivation** — PIN-gated MAS activator

Toàn bộ business logic nằm trong Rust (`activation.rs`, 1357 dòng), frontend React render kết quả qua 1536 dòng TypeScript. PowerShell scripts được embedded trực tiếp trong Rust raw strings, không phải file .ps1 bên ngoài.
