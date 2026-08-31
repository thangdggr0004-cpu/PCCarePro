# LICENSE MANAGER — AUDIT REPORT (Backend Rủi Ro Cao + UI/UX)

**Thời gian:** 2026-08-20  
**Phiên bản:** v2.0.2  
**Phạm vi:** Tab "Quản Lý Bản Quyền" — Backend elevation + Office + Windows UI/UX  
**Trạng thái:** CHỈ AUDIT — Chưa sửa gì

---

## PHÁT HIỆN THEO MỨC ĐỘ NGHIÊM TRỌNG

### 🔴 HIGH (6 phát hiện)

---

#### 🔴-1: `deep_clean_activation` chạy NON-ELEVATED — HKLM registry, services, hosts, event logs

**File:** `activation.rs:882-1036`  
**Hàm:** `deep_clean_activation("windows")` → `deep_clean_windows()`  
**Dòng gọi:** `activation.rs:1030` — `let stdout = run_ps(ps);`

**Vấn đề:** Toàn bộ thao tác nguy hiểm nhất trong toàn app (slmgr /upk, sc.exe delete, Set-Content hosts, Remove-Item HKLM, wevtutil cl) đều chạy qua `run_ps()` — KHÔNG elevation.

**Bằng chứng cụ thể:**
- `activation.rs:930` — `cscript //nologo $env:windir\system32\slmgr.vbs /upk` (xóa product key khỏi HKLM)
- `activation.rs:933` — `cscript //nologo $env:windir\system32\slmgr.vbs /rearm` (reset licensing)
- `activation.rs:955` — `Remove-Item -Path $p -Recurse -Force` (xóa thư mục system)
- `activation.rs:963` — `Unregister-ScheduledTask` (xóa scheduled task)
- `activation.rs:970-971` — `Stop-Service` + `sc.exe delete` (dừng/xóa service)
- `activation.rs:982` — `Set-Content -Path $hostsPath -Value $cleanLines` (ghi hosts trong System32)
- `activation.rs:994-997` — `Remove-Item -Path $rp -Recurse -Force` (xóa HKLM registry)
- `activation.rs:1002-1008` — `sc.exe config sppsvc` + `wevtutil cl` (sửa service config + xóa event log)

**Đối chiếu:** Printer functions (printer.rs:77-334) đã đúng dùng `run_ps_elevated`. License functions chưa fix.

**Tác động:** 
- Trên Windows có UAC (EnableLua=1): Scripts sẽ THẤT BẠI im lặng do thiếu quyền admin. `run_ps` trả stdout rỗng hoặc lỗi permission.
- Trên máy test (EnableLua=0): Có thể chạy được do không có UAC prompt, nhưng kết quả không ổn định tùy quyền tài khoản.
- **Tính nhất quán:** Đây là lần thứ 4 cùng loại bug. Printer tab đã fix, license chưa.

---

#### 🔴-2: `create_backup` chạy NON-ELEVATED — Registry export HKLM

**File:** `data_safety.rs:10-58`  
**Hàm:** `create_backup()`  
**Dòng gọi:** `data_safety.rs:52` — `let stdout = run_ps(ps);`

**Vấn đề:** `reg.exe export HKLM\SOFTWARE\...` (dòng 21) yêu cầu quyền admin để đọc toàn bộ HKLM SPP key. Chạy non-elevated sẽ trả lỗi hoặc dữ liệu rỗng.

**Bằng chứng:** `data_safety.rs:21` — `& reg.exe export 'HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\SoftwareProtectionPlatform' $regFile /y`

**Tác động:** Backup tạo ra không có dữ liệu registry → rollback không thể khôi phục SPP keys.

---

#### 🔴-3: `rollback_backup` chạy NON-ELEVATED — Registry import HKLM

**File:** `data_safety.rs:61-130`  
**Hàm:** `rollback_backup(backup_id)`  
**Dòng gọi:** `data_safety.rs:124` — `let stdout = run_ps(&ps);`

**Vấn đề:** `reg.exe import` (dòng 88) yêu cầu quyền admin để ghi vào HKLM. Chạy non-elevated sẽ thất bại.

**Bằng chứng:** `data_safety.rs:88` — `$err = (& reg.exe import $item.path 2>&1 | Out-String).Trim()`

**Bắt lỗi:** Code có bắt lỗi (dòng 89-98) và hiển thị "Không thể ghi khóa SPP bị Windows chặn quyền (manager/slpp, kể cả tài khoản SYSTEM)" — nhưng thông báo này gây nhầm lẫn vì VẤN ĐỀ KHÔNG PHẢI LÀ "SYSTEM" MÀ LÀ "THIẾU UAC ELEVATION".

---

#### 🔴-4: `restore_oem_bios_key` chạy NON-ELEVATED — slmgr /ipk + /ato

**File:** `activation.rs:1039-1053`  
**Hàm:** `restore_oem_bios_key()`  
**Dòng gọi:** `activation.rs:1153` — `let _ = run_ps(&ps);`

**Vấn đề:** `slmgr.vbs /ipk` và `/ato` (dòng 1044-1045) yêu cầu quyền admin. Chạy non-elevated sẽ thất bại.

**Bằng chứng:** `activation.rs:1044` — `$out = & slmgr.vbs /ipk $key.Trim() 2>&1 | Out-String`  
`activation.rs:1045` — `& slmgr.vbs /ato 2>&1 | Out-String`

**Bắt lỗi:** Code có try/catch nhưng `run_ps` trả stdout chứa lỗi thay vì Rust `Err()`, nên `restore_oem_bios_key` luôn trả `Ok()` ngay cả khi slmgr thất bại.

---

#### 🔴-5: `restore_office_engine_v3` — Office cleanup chạy NON-ELEVATED, giả vờ thành công

**File:** `lib.rs:452-455` → `activation.rs:918`  
**Hàm:** `restore_office_engine_v3()` → `deep_clean_activation("office")`

**Vấn đề:** Office deep clean (activation.rs:900-917) chạy qua `run_ps()`. Các lệnh `cscript //nologo "$vbs" /unpkey:$k` và `/remhst` (dòng 909-913) có thể cần quyền admin depending on Office installation location.

**Hậu quả:** Script luôn trả `{ success: true, output: "Đã dọn sạch..." }` (dòng 916) ngay cả khi các lệnh cscript thất bại — vì PowerShell script có `$ErrorActionPreference = 'SilentlyContinue'` và `Out-Null` ở mọi đầu ra.

**Đối chiếu với OfficeLicenseAnalyzer.tsx:84-101:** UI gọi `restoreOfficeEngineV3()`, hiển thị kết quả bằng `alert("KHÔI PHỤC HOÀN TẤT")` (dòng 92) nếu `res.success !== false`. Vì backend luôn trả `success: true`, UI sẽ LUÔN hiển thị "HOÀN TẤT" ngay cả khi không có gì thay đổi.

---

#### 🔴-6: Office "Khuyến nghị" HARDCODED — mâu thuẫn với kết luận động từ backend

**File:** `OfficeLicenseAnalyzer.tsx:444-453`  
**Vấn đề:** Box "Khuyến nghị & Lý do giải thích" chứa text hardcode:

```
"✓ Không cần khôi phục vì: Registry sạch, DLL chính hãng Microsoft, 
tệp hệ thống không có dấu hiệu can thiệp."
```

Trong khi box "KẾT LUẬN" (dòng 335-339) hiển thị `report.decisionResult?.reason` — text ĐỘNG từ backend.

**Ví dụ mâu thuẫn thực tế:**
- Backend trả: `"Phát hiện dấu hiệu can thiệp bất thường (75% Confidence)"`
- KẾT LUẬN hiển thị: "Phát hiện dấu hiệu can thiệp bất thường (75% Confidence)" ✅
- Khuyến nghị hiển thị: "Không cần khôi phục vì: Registry sạch, DLL chính hãng..." ❌

**Nguyên nhân gốc:** Hai biến/Renderer khác nhau:
- `report.decisionResult?.reason` — động, từ backend scan
- Hardcoded JSX ở dòng 449 — tĩnh, không phụ thuộc backend data

**Đối chiếu:** Tab Windows xử lý đúng — `computedVerdict` (dòng 797-807) quyết định text hiển thị, `recommendation` useMemo (dòng 993-1000) tạo recommendation động dựa trên `computedVerdict.status`.

---

### 🟠 MEDIUM (4 phát hiện)

---

#### 🟠-7: Office restore button logic — hoạt động đúng nhưng bị confict bởi hardcode

**File:** `OfficeLicenseAnalyzer.tsx:469-484`

**Disable condition (dòng 471):** `decision === 'BLOCK_RESTORE' || targetActionsCount === 0`

**Logic hiện tại:**
- `targetActionsCount = report.surgicalPlan?.targetActions?.length || 0` (dòng 107)
- Nếu clean: `targetActionsCount = 0` → button disable ✅, text "Hệ thống sạch - Không cần thao tác" ✅
- Nếu dirty: `targetActionsCount > 0` → button enable, text "KHÔI PHỤC AN TOÀN" ✅

**Vấn đề:** Button logic ĐÚNG nhưng bị mâu thuẫn bởi Khuyến nghị hardcode (phát hiện #-6). Khi backend report dirty nhưng Khuyến nghị nói "Không cần khôi phục", button vẫn enable → người dùng thấy 2 thông điệp trái ngược.

---

#### 🟠-8: Windows "Độ tin cậy hệ thống" HARDCODED 100%

**File:** `LicenseManager.tsx:1132, 1173`

**Dòng 1132:** `<span className="font-black text-emerald-400 text-sm">100% (Máy sạch)</span>`  
**Dòng 1173:** `<span>Mức độ tin cậy (100% Máy sạch)</span>`

**Vấn đề:** Luôn hiển thị "100% (Máy sạch)" bất kể kết quả scan thật. Sau khi quét và phát hiện KMS38, pirated files, suspicious tasks → vẫn hiển thị 100%.

**Đối chiếu:** Tab Office (OfficeLicenseAnalyzer.tsx:238) dùng `systemConfidence` (từ `report.confidenceResult?.confidencePercentage`) — ĐỘNG, đúng.

**Tác động:** Technician thấy "100% Máy sạch" nhưng step 3-6 showing danger → gây confusing và mất niềm tin vào tool.

---

#### 🟠-9: Office "Độ tin cậy nguồn kích hoạt: 100%" khi "Nguồn kích hoạt: None"

**File:** `OfficeLicenseAnalyzer.tsx:434-440`  
**Biến:** `report.provenance.confidence` (backend Office engine)

**Vấn đề:** Confidence = 100% nhưng activation source trống → số liệu vô nghĩa. Confidence = 100% phải có nghĩa "hoàn toàn tin cậy rằng nguồn là X" — nhưng X = None.

**Nguyên nhân:** Backend `scan_office_activation()` tính confidence bằng hàm weight-based, không trừ điểm khi thiếu activation source (chỉ trừ khi CÓ evidence xấu).

---

#### 🟠-10: `launch_elevated_cmd` — cmd_path escaping cơ bản

**File:** `activation.rs:1156-1161`  
**Hàm:** `launch_elevated_cmd(cmd_path, param)`

```rust
fn launch_elevated_cmd(cmd_path: &str, param: &str) {
    let ps_cmd = format!(r#"Start-Process cmd.exe -ArgumentList '/k ""{cmd_path}"" {param}' -Verb RunAs"#);
    let _ = std::process::Command::new("powershell")
        .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", &ps_cmd])
        .spawn();
}
```

**Vấn đề:** Double quotes quanh `cmd_path` bảo vệ được paths chứa spaces, nhưng KHÔNG escape được nội dung chứa double quotes hoặc ký tự đặc biệt.

**Thực tế:** `cmd_path` đến từ `find_local_mas_cmd()` — hệ thống tìm file MAS_AIO.cmd trong temp. `param` hardcode từ match block (`""`, `"/HWID"`, `"/Ohook"`, `"/KMS38"`). **Không có user input nào** → rủi ro thực tế thấp.

**Đối chiếu:** Printer functions (printer.rs) dùng `exec::run_ps_elevated()` với single-quote escaping cho PowerShell string → an toàn hơn.

---

### 🟡 LOW (4 phát hiện)

---

#### 🟡-11: Test coverage = 0 cho destructive operations

**File:** `activation.rs:1288-1352`, `data_safety.rs:250-273`

**Hiện trạng:**
- `activation.rs` tests (4 tests): MAS file search, eligible size, unknown mode error, Office scan JSON shape — **KHÔNG test deep_clean, backup, rollback, restore_oem**
- `data_safety.rs` tests (2 tests): verify_clean_operation shape, verify_bios_restore shape — **test verification logic, KHÔNG test create_backup, rollback_backup**
- **0 test cho `deep_clean_activation`** — hàm nguy hiểm nhất trong app
- **0 test cho `create_backup`** — hàm bảo vệ duy nhất trước data loss
- **0 test cho `rollback_backup`** — hàm khôi phục duy nhất
- **0 test cho `restore_oem_bios_key`** — hàm restore OEM

**Tác động:** Không thể phát hiện regression nếu code thay đổi. Không thể verify rằng elevation là cần thiết (cần mock/test elevated path).

---

#### 🟡-12: `getRiskLevel` — dead code

**File:** `LicenseManager.tsx:12-25`

**Vấn đề:** `getRiskLevel` được define nhưng CHƯA BAO GIỜ được gọi trong component. Risk badge hiển thị thông qua `computedVerdict` (dòng 797-807).

**Ghi chú:** Default case trả "Chưa xác định" — nhưng không có fallback nào cho `computedVerdict` khi status không khớp switch-case. `computedVerdict` (dòng 806) trả `{ status: 'UNKNOWN', label: 'Không xác định' }` cho unknown case.

---

#### 🟡-13: `translateFieldValue` — non-string fallback

**File:** `LicenseManager.tsx:27-54`

**Vấn đề:** Dòng 29: `if (typeof str !== 'string') return str;` — non-string values return as-is. Nếu backend trả giá trị object/array bất ngờ, sẽ hiển thị `[object Object]` thay vì "Không có dữ liệu".

**Thực tế:** Dùng chính `translateFieldValue` cho display fields trong forensic workspace. Backend trả string hoặc number为主 → ít gặp non-string.

---

#### 🟡-14: Office audit log filter logic——cần đồng bộ với `logFilter`

**File:** `OfficeLicenseAnalyzer.tsx:170-177`

**Vấn đề:** `getFilteredLogs()` filter theo `log.collectorName` hoặc `log.dataSource` includes `logFilter`. Filter value "ALL" trả toàn bộ. Nhưng nếu `log.collectorName` và `log.dataSource` đều null/undefined → sẽ trảundefined.includes(logFilter) → throw error.

**Thực tế:** Backend luôn trả collectorName/dataSource là string → ít xảy ra.

---

## TÓM TẮT THEO PHẦN

### PHẦN A — Backend Rủi Ro Cao

| # | Phát hiện | Hàm | File:Dòng | Nghiêm trọng |
|---|-----------|-----|-----------|--------------|
| 1 | deep_clean_windows NON-ELEVATED | `deep_clean_activation` → `deep_clean_windows` | activation.rs:1030 | 🔴 |
| 2 | create_backup NON-ELEVATED | `create_backup` | data_safety.rs:52 | 🔴 |
| 3 | rollback_backup NON-ELEVATED | `rollback_backup` | data_safety.rs:124 | 🔴 |
| 4 | restore_oem_bios_key NON-ELEVATED | `restore_oem_bios_key` | activation.rs:1153 | 🔴 |
| 5 | restore_office_engine_v3 NON-ELEVATED | `restore_office_engine_v3` → `deep_clean_activation("office")` | lib.rs:453 → activation.rs:918 | 🔴 |
| 6 | launch_elevated_cmd basic escaping | `launch_elevated_cmd` | activation.rs:1157 | 🟠 |
| 7 | No test coverage for destructive ops | `deep_clean_activation`, `create_backup`, `rollback_backup`, `restore_oem_bios_key` | activation.rs, data_safety.rs | 🟡 |

### PHẦN B — UI/UX Tab Office

| # | Phát hiện | File:Dòng | Nghiêm trọng |
|---|-----------|-----------|--------------|
| 8 | Khuyến nghị HARDCODED mâu thuẫn với conclusion | OfficeLicenseAnalyzer.tsx:444-453 | 🔴 |
| 9 | Restore button logic đúng nhưng bị conflict bởi hardcode | OfficeLicenseAnalyzer.tsx:469-484 | 🟠 |
| 10 | "Độ tin cậy nguồn kích hoạt: 100%" khi source=None | OfficeLicenseAnalyzer.tsx:439 | 🟠 |

### PHẦN C — UI/UX Tab Windows

| # | Phát hiện | File:Dòng | Nghiêm trọng |
|---|-----------|-----------|--------------|
| 11 | "Độ tin cậy hệ thống" HARDCODED 100% | LicenseManager.tsx:1132, 1173 | 🟠 |
| 12 | getRiskLevel dead code | LicenseManager.tsx:12-25 | 🟡 |
| 13 | translateFieldValue non-string fallback | LicenseManager.tsx:29 | 🟡 |
| 14 | Office audit log null safety | OfficeLicenseAnalyzer.tsx:170-177 | 🟡 |

---

## PHÂN TÍCH NGUYÊN NHÂN GỐC

### Elevation Bug Pattern (lần thứ 4)
```
Printer tab đã fix: run_ps_elevated ✅
License tab chưa fix: run_ps ❌
```

**Tại sao lặp lại:** Codebase có 2 hàm PowerShell runner:
- `exec::run_ps()` — non-elevated, dùng cho read-only operations
- `exec::run_ps_elevated()` — UAC elevation, dùng cho write operations

License functions copy từ Electron codebase (electron.cjs) nơi `runPowerShellScript()` (non-elevated) được dùng cho mọi thứ vì Electron tự quản lý elevation qua elevate.exe. Tauri port đã có `run_ps_elevated()` nhưng license functions chưa migrate.

### UI Contradiction Pattern
```
Tab Office: conclusion = DYNAMIC, recommendation = HARDCODED ❌
Tab Windows: verdict = DYNAMIC, recommendation = DYNAMIC ✅
```

**Tại sao:** OfficeLicenseAnalyzer.tsx là component riêng, viết sau LicenseManager.tsx. Office component dùng hardcoded JSX cho recommendation thay vì computed values từ scan result.

### Confidence Hardcode Pattern
```
Tab Office systemConfidence: dynamic ✅
Tab Office activation confidence: dynamic ✅  
Tab Windows "Độ tin cậy hệ thống": HARDCODED 100% ❌
Tab Windows activation confidence: HARDCODED "100% (Máy sạch)" ❌
```

---

## KHUYẾN NGHỊ SỬA (chờ lệnh)

| Ưu tiên | Phát hiện | Cần sửa | File |
|---------|-----------|---------|------|
| 1 | #-1 đến #-5 | Thay `run_ps` → `run_ps_elevated` cho 5 functions | activation.rs, data_safety.rs |
| 2 | #-6 | Tạo computed recommendation từ `decisionResult`/`matrix` thay vì hardcoded | OfficeLicenseAnalyzer.tsx |
| 3 | #-8 | Tính confidence từ `windowsSteps` và `riskScore` thay vì hardcoded | LicenseManager.tsx |
| 4 | #-7 | Khuyến nghị fix xong → button conflict tự hết | OfficeLicenseAnalyzer.tsx |
| 5 | #-10 | Escape cmd_path bằng single-quote hoặc dùng `run_ps_elevated` | activation.rs |
| 6 | #-9 | Trừ confidence khi activation source = None | Backend Office engine |
| 7 | #-11 | Thêm test cases cho destructive operations | activation.rs, data_safety.rs |

---

*Report generated — chưa sửa bất kỳ dòng code nào.*
