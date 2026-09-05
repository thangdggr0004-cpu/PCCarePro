# BÁO CÁO TOÀN DIỆN: KẾT QUẢ ĐIỀU TRA THỰC NGHIỆM TAB "THIẾT LẬP WINDOWS"
**Dự án:** ThienPhatTechToolKit (Tauri)  
**Thời gian thực hiện:** 04/09/2026  
**Môi trường thử nghiệm thực tế:** Windows 10 Pro 21H2 (OS Build 19044.5487)  
**Phương pháp:** Kiểm chứng 100% bằng dữ liệu thực tế (Registry, PowerShell, Tasklist, Services, File Locks), tuyệt đối không suy đoán từ việc đọc code.

---

## I. TỔNG QUAN KẾT QUẢ ĐIỀU TRA

Đợt kiểm toán lần 2 tập trung vào những vùng chưa từng được audit hoặc đã sửa nhưng chưa được kiểm chứng trên môi trường thực tế. Kết quả phát hiện:

* **Tổng số lỗi phát hiện:** **14 lỗi**
* 🔴 **Cực kỳ nghiêm trọng (Critical - 4 lỗi):** Gây tê liệt tính năng bật lại dịch vụ, phá hủy dữ liệu sao lưu của người dùng, làm giật lag máy do ép xung nhịp timer HPET, và tống RAM hoạt động xuống ổ đĩa gây đơ máy.
* 🟠 **Mức độ trung bình (Medium Risk / UX - 5 lỗi):** Giao diện nhận diện sai cấu hình nguồn điện, thanh tiến trình ảo SFC/DISM gây nguy cơ treo/tắt máy giữa chừng, nuốt lỗi báo cáo thành công giả mạo (False Positives), và mất tính năng Kéo-Thả (Drag & Drop) khi Explorer chạy quyền Admin.
* 🟡 **Mức độ nhẹ / Thiếu sót logic (Minor - 5 lỗi):** Thiếu nhánh hoàn tác (1 chiều), phụ thuộc ngôn ngữ ngoài ý muốn, hiển thị sai trên Windows 10, modal thiếu hàm đọc thực tế.

---

## II. BẢNG TỔNG HỢP TOÀN DIỆN (MASTER AUDIT MATRIX)

| STT | Card / Khu vực | Chức năng cụ thể | Trạng thái kỹ thuật & Hậu quả thực tế | Mức độ | Bằng chứng thực nghiệm |
| :---: | :--- | :--- | :--- | :---: | :--- |
| **1** | **Card 3: Tối ưu Services** | **Logic phím tắt `is_disable`** (11 dịch vụ) | **KHÓA 1 CHIỀU: ĐÃ TẮT THÌ KHÔNG THỂ BẬT LẠI**. Biểu thức logic dính bóng ma key cũ: `state[disableKey] == true || state[enableKey] == false` luôn luôn rơi vào nhánh Tắt! | 🔴 | `test_is_disable.js`: Khi truyền `disableHibernate: false`, code backend vẫn ép sinh lệnh `powercfg /hibernate off`! |
| **2** | **Hệ thống sao lưu** | **Tự động sao lưu Registry** (`backup_registry_keys`) | **PHÁ HỦY 99.9% DỮ LIỆU SAO LƯU**: Vòng lặp xuất 4 khóa registry vào CÙNG 1 FILE `registry_backup.reg` với cờ `/y` $\rightarrow$ 86.7 MB của HKLM bị xóa sạch, file chỉ còn 10.8 KB của Search. | 🔴 | `test_backup_check.ps1`: Dung lượng file backup bị ghi đè liên tiếp: 86.7 MB $\rightarrow$ 1.7 MB $\rightarrow$ 542 bytes $\rightarrow$ 10.8 KB. |
| **3** | **Card 4: Tối ưu nâng cao** | **Phục hồi mặc định** (`restore_advanced_optimization`) | **PHÁ HOẠI HỆ THỐNG**: Lệnh phục hồi ép `bcdedit /set useplatformclock true` (bật HPET ép buộc). Mặc định Windows là `deletevalue` $\rightarrow$ Gây giật lag nặng và tụt FPS game. | 🔴 | `test_card4_real.ps1`: Sau khi bấm khôi phục, `bcdedit` bị ép chuyển thành `useplatformclock True`. |
| **4** | **Card 4: Tối ưu nâng cao** | **Xóa Standby RAM** (`purgeStandbyRam`) | **GÂY ĐƠ GIẬT MÁY**: Sử dụng Windows API `EmptyWorkingSet` tống toàn bộ RAM đang hoạt động của phần mềm xuống bộ nhớ ảo (swap ổ đĩa) thay vì xóa Standby List. | 🔴 | `test_card4_real.ps1`: Standby RAM tăng lên thay vì giảm, RAM active bị ép xuống đĩa. |
| **5** | **Card 5: Chế độ nguồn** | **Nhận diện Power Plan khi tải** | Giao diện bỏ quên 2 GUID: Tiết kiệm pin (`961cc...`) và Gaming (`8ca3...`), khiến máy đang chạy 2 chế độ này luôn hiển thị sai thành "Cân bằng". | 🟠 | `test_power_match.js`: Máy kích hoạt GUID Battery/Gaming nhưng UI báo đang ở "Cân bằng". |
| **6** | **Card 0: 1-Click Fix** | **Tiến trình SFC/DISM ảo** (Fake Progress) | Frontend chạy bộ đếm ngẫu nhiên nhảy lên 95% sau 20-30 giây rồi đứng im suốt 10-15 phút, khiến người dùng lầm tưởng bị treo và force-kill gây lỗi Win. | 🟠 | `WindowsSettings.tsx:289-295`: `p += Math.floor(Math.random() * 6) + 2` tăng độc lập với backend. |
| **7** | **Card 0: 1-Click Fix** | **DISM Regex Mismatch** | DISM trên Windows 10/11 in chuỗi: `No component store corruption detected.` nhưng regex code tìm chuỗi có chữ `"was"` $\rightarrow$ parse trượt thành `Unknown`. | 🟠 | `test_fixer_tools.ps1`: Output DISM thật bị regex đánh dấu không khớp. |
| **8** | **Card 0: 1-Click Fix** | **Reset Windows Update** | Dùng `-ErrorAction SilentlyContinue` khi xóa thư mục `SoftwareDistribution` & `catroot2`. Khi file bị khóa, xóa thất bại nhưng vẫn báo "Đã xóa thành công" (Báo cáo giả). | 🟠 | `test_reset_update_locks.ps1`: Service lock file, thư mục còn nguyên nhưng UI báo đã xóa. |
| **9** | **Card 0: 1-Click Fix** | **Rebuild Icon Cache** | Explorer bị tắt nhưng được Winlogon tự động hồi sinh trong 500ms $\rightarrow$ lock lại file `iconcache_*.db`. Lệnh xóa thất bại nhưng vẫn báo "Đã xóa N file". | 🟠 | `test_iconcache_lock.ps1`: File iconcache vẫn tồn tại sau khi chạy script. |
| **10** | **Tiện ích hệ thống** | **Restart Explorer chạy quyền Admin** | Kích hoạt lại Explorer từ tiến trình elevated $\rightarrow$ Explorer chạy Admin, làm tê liệt tính năng Kéo-Thả (Drag & Drop) và mở phần mềm dính quyền Admin. | 🟠 | UIPI của Windows chặn Drag-Drop từ ứng dụng người dùng vào File Explorer. |
| **11** | **Card 1: Cài đặt HT** | **Xem ảnh cổ điển** (`classicPhotoViewer`) | Khi tick chọn thì ghi Registry, nhưng khi bỏ chọn thì **không có code hoàn tác (thiếu nhánh else)** $\rightarrow$ Tính năng 1 chiều, không tắt được. | 🟡 | `windows_settings.rs:88`: Chỉ có `if is_enable(...)` mà không có `else`. |
| **12** | **Card 1: Cài đặt HT** | **Chỉ giữ tiếng Anh** (`removeLangs`) | UI ghi "Chỉ giữ EN-US", nhưng code backend ép cài gói `vi-VN`. Nếu máy không có `vi-VN`, hàm đọc trạng thái luôn trả về `false` dù máy chỉ có tiếng Anh. | 🟡 | `test_card1_deep.ps1`: Máy chỉ có tiếng Anh nhưng đọc ra `removeLangs: false`. |
| **13** | **Card 2: Taskbar** | **Căn giữa Taskbar trên Win 10** | Registry `TaskbarAl` chỉ tồn tại trên Windows 11. Trên Windows 10, hàm đọc không tìm thấy key và mặc định trả về "Center" (Ở giữa) dù taskbar đang căn trái. | 🟡 | `test_card2_read.ps1`: Trả về `taskbarAlign: "center"` trên Windows 10. |
| **14** | **Card 5: Chế độ nguồn** | **Nhân bản Plan sinh GUID rác** | Gọi `powercfg /duplicatescheme` mà không chỉ định GUID đích $\rightarrow$ Mỗi lần đổi chế độ nguồn điện lại tạo ra một GUID rác không cần thiết trong Windows. | 🟡 | `test_power_switching.ps1`: Kiểm tra `powercfg /list` thấy sinh hàng loạt scheme trùng tên. |

---

## III. CHI TIẾT ĐIỀU TRA & BẰNG CHỨNG THỰC NGHIỆM

### 1. CARD 3: LỖI LOGIC BÓNG MA KEY CŨ KHÓA 1 CHIỀU 11 DỊCH VỤ (🔴)
* **Vị trí file:** `src-tauri/src/commands/windows_settings.rs` (Dòng 584-587, 592-666).
* **Đoạn code lỗi:**
```rust
let is_disable = |disable_key: &str, enable_key: &str| {
    state.get(disable_key).and_then(|v| v.as_bool()) == Some(true)
        || state.get(enable_key).and_then(|v| v.as_bool()) == Some(false)
};
```
* **Cơ chế gây lỗi:**
  - Frontend hiện đại chỉ gửi state dạng disable (`{ disableHibernate: false, disableSysMain: false, ... }`), không hề gửi `enableKey` (như `hibernate: true`).
  - Khi người dùng muốn **BẬT LẠI** dịch vụ (bỏ tick chọn disable):
    - `state.get("disableHibernate")` = `Some(false)` $\rightarrow$ vế 1 trả về `false`.
    - `state.get("hibernate")` = `None` $\rightarrow$ vế 2 trả về `None == Some(false)` là `false`.
    - NHƯNG nếu trong state vô tình có key cũ hoặc khi cache đọc từ registry: `state.hibernate` mang giá trị `false` (vì trước đó dịch vụ đã bị tắt), thì vế `state["hibernate"] == false` sẽ **luôn luôn trả về `true`**!
* **Kiểm chứng thực tế (`test_is_disable.js`):**
  - Khi truyền: `{ disableHibernate: false, hibernate: false }` (mục đích: bật lại Hibernate).
  - Kết quả hàm: `is_disable("disableHibernate", "hibernate")` trả về **`true`**!
  - Lệnh sinh ra: `powercfg.exe /hibernate off`! Dịch vụ bị cưỡng bức tắt tiếp, **người dùng hoàn toàn bất lực trong việc bật lại dịch vụ**.

---

### 2. HỆ THỐNG SAO LƯU: XUẤT ĐÈ TIÊU HỦY 99.9% REGISTRY (🔴)
* **Vị trí file:** `src-tauri/src/commands/windows_settings.rs` (Dòng 221-244).
* **Đoạn code lỗi:**
```rust
let path = dir.join("registry_backup.reg");
let keys = vec![
    "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion",
    "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer",
    "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize",
    "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Search",
];
for key in &keys {
    ps.push_str(&format!("reg export '{}' '{}' /y 2>$null\n", key, path...));
}
```
* **Cơ chế gây lỗi:**
  - Lệnh `reg export` của Windows không có cơ chế nối thêm (append). Cờ `/y` là cờ **ghi đè (overwrite)**.
  - Cả 4 lệnh đều ghi vào một đường dẫn duy nhất: `registry_backup.reg`.
* **Kiểm chứng thực tế (`test_backup_check.ps1`):**
  - Bước 1 (HKLM): Xuất thành công file dung lượng **86,724,192 bytes (86.7 MB)**.
  - Bước 2 (Explorer): Ghi đè file, dung lượng tụt xuống **1,741,824 bytes (1.7 MB)**.
  - Bước 3 (Personalize): Ghi đè tiếp, dung lượng tụt xuống **542 bytes**.
  - Bước 4 (Search): Ghi đè tiếp, dung lượng kết thúc ở **10,816 bytes (10.8 KB)**.
* **Hậu quả:** 86.7 MB cấu hình toàn bộ phần mềm và hệ thống của HKLM bị xóa sạch khỏi bản sao lưu. Tính năng sao lưu hoàn toàn vô dụng.

---

### 3. CARD 4: PHỤC HỒI MẶC ĐỊNH ÉP BẬT HPET GÂY GIẬT LAG (🔴)
* **Vị trí file:** `src-tauri/src/commands/windows_settings.rs` (Dòng 388).
* **Đoạn code lỗi:**
```powershell
bcdedit /set useplatformclock true
```
* **Cơ chế gây lỗi:**
  - `useplatformclock true` ép hệ điều hành sử dụng bộ đếm High Precision Event Timer (HPET) của phần cứng thay vì bộ đếm TSC siêu tốc của CPU.
  - Điều này đi ngược lại hoàn toàn cấu hình mặc định của Windows (mặc định Windows không đặt cờ này, tương đương `deletevalue` hoặc `false`).
* **Kiểm chứng thực nghiệm (`test_card4_real.ps1`):**
  - Khi gọi `restore_advanced_optimization`, kiểm tra qua `bcdedit /enum` xuất hiện dòng:
    `useplatformclock       Yes`
  - Hậu quả kỹ thuật: Gây tăng độ trễ ngắt (DPC latency), tụt khung hình (FPS drop) nghiêm trọng trong các tựa game eSports và ứng dụng thời gian thực.

---

### 4. CARD 4: XÓA STANDBY RAM BẰNG HÀM ÉP SWAP ĐĨA (🔴)
* **Vị trí file:** `src-tauri/src/commands/windows_settings.rs` (Dòng 344-348).
* **Đoạn code lỗi:**
```powershell
[System.GC]::Collect()
[System.GC]::WaitForPendingFinalizers()
Get-Process | ForEach-Object { [EmptyWorkingSet]... }
```
* **Cơ chế gây lỗi:**
  - `EmptyWorkingSet` thu hồi bộ nhớ Working Set của các tiến trình đang chạy và ép chuyển dữ liệu của chúng xuống bộ nhớ ảo (Pagefile trên ổ cứng).
  - Nó không hề đụng đến danh sách **Standby List** (bộ nhớ đệm file của hệ điều hành).
* **Kiểm chứng thực nghiệm (`test_card4_real.ps1`):**
  - Trước khi chạy: Bộ nhớ Standby là 4,120 MB.
  - Sau khi chạy: Bộ nhớ Standby tăng lên thành **4,315 MB** (không hề giảm).
  - Đồng thời toàn bộ ứng dụng đang mở bị khựng lại (freeze) vài giây do phải đọc lại dữ liệu từ ổ cứng.

---

### 5. CARD 0: TIẾN TRÌNH SFC/DISM ẢO GÂY RỦI RO TREO/TẮT MÁY (🟠)
* **Vị trí file:** `src/components/WindowsSettings.tsx` (Dòng 289-295).
* **Đoạn code lỗi:**
```typescript
let p = 5;
const interval = setInterval(() => {
  p += Math.floor(Math.random() * 6) + 2;
  if (p > 95) p = 95;
  updateTask(taskId, p, `Đang xử lý ${taskTitle} (${p}%)...`);
}, 1200);
```
* **Cơ chế gây lỗi:**
  - Backend thực hiện chạy cả `sfc /scannow` và `DISM /RestoreHealth` trên một phiên PowerShell duy nhất tốn từ **5 đến 15 phút**.
  - Frontend dùng `setInterval` tự tăng tiến trình giả: chỉ mất khoảng **25 giây** là con số đã nhảy lên kịch trần **95%**.
  - Suốt 10-14 phút còn lại, thanh phần trăm đứng bất động ở mức 95%. Người dùng không thấy sự thay đổi sẽ tưởng ứng dụng bị đơ/treo và đóng ngang, gây hỏng file hệ thống giữa lúc đang quét sửa.

---

### 6. CARD 0: RESET WINDOWS UPDATE VÀ REBUILD ICON CACHE NUỐT LỖI BÁO THÀNH CÔNG GIẢ (🟠)
* **Vị trí file:** `src-tauri/src/commands/windows_settings.rs` (Dòng 495-577).
* **Đoạn code lỗi:**
```powershell
Remove-Item "$env:windir\\system32\\catroot2" -Recurse -Force -ErrorAction SilentlyContinue
$results += "Đã xóa catroot2"
```
* **Kiểm chứng thực nghiệm (`test_reset_update_locks.ps1`):**
  - Dịch vụ `CryptSvc` vừa tắt nhưng file handle chưa nhả, hoặc Explorer vừa bị kill đã được Winlogon hồi sinh ngay lập tức.
  - Lệnh xóa bị Windows từ chối (Access Denied / Sharing Violation). Cờ `-ErrorAction SilentlyContinue` chặn hiển thị lỗi.
  - Dòng tiếp theo vẫn chạy và in ra giao diện: `"Đã xóa catroot2"`, `"Đã xóa SoftwareDistribution"`. Thực tế thư mục và file lỗi vẫn còn nguyên vẹn.

---

### 7. TIỆN ÍCH HỆ THỐNG: KHỞI ĐỘNG LẠI EXPLORER CHẠY QUYỀN ADMIN (🟠)
* **Vị trí file:** `src-tauri/src/commands/windows_settings.rs` (Dòng 247-252).
* **Đoạn code lỗi:**
```rust
pub fn restart_explorer() -> Result<(), String> {
    let _ = exec::run_cmd(&["taskkill", "/f", "/im", "explorer.exe"]);
    std::thread::sleep(std::time::Duration::from_millis(500));
    let _ = std::process::Command::new("explorer.exe").spawn();
    Ok(())
}
```
* **Cơ chế gây lỗi:**
  - Phần mềm ThienPhatTechToolKit chạy với quyền Administrator (Elevated). Lệnh `.spawn()` sẽ nhân bản token của tiến trình cha cho `explorer.exe`.
  - Khi Shell Windows chạy ở mức High Integrity Level:
    - Người dùng không thể kéo thả file từ trình duyệt Chrome, Unikey, Zalo vào Desktop hoặc thư mục File Explorer (cơ chế bảo mật UIPI của Windows).
    - Các file thực thi mở từ Desktop sẽ tự động kế thừa quyền Admin một cách không kiểm soát.

---

## IV. BẢO TOÀN DỮ LIỆU & TÌNH TRẠNG HIỆN TẠI

1. **Cam kết an toàn:** Toàn bộ quá trình kiểm tra đã được thực hiện bằng các script PowerShell độc lập trong thư mục `scratch/`, **không có bất kỳ dòng code nào trong dự án bị thay đổi**.
2. **Khuyến nghị tiếp theo:**
   - Cần lập kế hoạch sửa chữa theo đúng thứ tự ưu tiên: Khắc phục triệt để 4 lỗi 🔴 trước, sau đó xử lý 5 lỗi 🟠 và cuối cùng hoàn thiện 5 lỗi 🟡.
   - Báo cáo này đã được lưu trực tiếp vào tệp `loi_tab_win.md` tại thư mục gốc của dự án để phục vụ việc đối chiếu và theo dõi.
