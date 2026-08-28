# PCCareMasterPro — Tauri (ThienPhatTechToolKit)

Công cụ chuẩn đoán & quản trị bản quyền Windows/Office, DMCA-safe, chạy offline.
Bản này là frontend Tauri + backend Rust (Bộ `deep_clean` / `rollback` / OEM BIOS
restore / Office V3 provenance engine 4 cấp).

## Cài đặt

### Bản Portable (không cần cài)
- Tải `pccare-master-pro.exe` từ GitHub Release.
- Chạy trực tiếp; không ghi registry khi cài, không cần quyền admin khi *xem*,
  nhưng các thao tác bản quyền (deep_clean, slmgr, ospp) **yêu cầu chạy với quyền
  Administrator**.
- Tự cập nhật: phần mềm tự tải bản mới về (`<exe>.next`), xác minh chữ ký minisign
  rồi thay thế chính nó bằng thao tác ghi đè nguyên tử — **an toàn khi mất điện giữa
  chừng**: nếu bị gián đoạn trước bước ghi đè thì bản cũ vẫn chạy, sau bước ghi đè thì
  bản mới đã nằm đúng vị trí; không bao giờ để exe "biến mất".

### Bản NSIS Setup
- Chạy `PCCareMasterPro_<ver>_x64-setup.exe`, cung cấp bởi tauri-plugin-updater (bản
  này dành cho bản cài đặt; bản Portable dùng cơ chế tự cập nhật riêng ở trên).

## ⚠️ Smart App Control (bắt buộc đọc trên Windows 11)

Tool **không được ký Authenticode** (chỉ ký chữ ký minisign dành riêng cho cơ chế tự
cập nhật, không tạo niềm tin hệ điều hành). Hệ quả trên Windows 11 có bật **Smart App
Control**:

| Cài đặt Win11 | Hành vi với tool | Có "Run anyway"? |
|---|---|---|
| SAC = **Enforcement** | WebView/noneStore app không ký → **chặn cứng, không chạy được** | ❌ KHÔNG có |
| SAC = **Evaluation** | Chạy được trong thời gian đánh giá, có cảnh báo | 👍 tạm để chạy thử |
| SAC = **Tắt** | Chạy bình thường, giống Win10 | — |

Điều này được xác nhận bởi **kết quả test thật trên máy Win10 IoT LTSC** (môi trường của
đội dev): app chạy bình thường khi không có SAC. Trên VM Win11 có SAC **Enforcement**,
bản portable bị chặn vĩnh viễn mà **không** có nút "Run anyway" (đây là điểm khác
SmartScreen: SmartScreen có nút, SAC thì không). Phần chờ xác nhận chính thức bằng VM
Win11 thật sau khi có kết quả JSON từ `scripts/vm-windows11-sac-test.ps1`.

### Các bước để chạy khi SAC đang chặn

**Chọn 1 trong 2:**

1. **Tắt SAC** (thao tác vĩnh viễn với Windows hiện tại):
   - Bảng điều khiển: `Settings → Privacy & Security → Windows Security → App & browser
     control → Smart App Control → Off`.
   - Hoặc bằng registry (cần admin):
     ```powershell
     Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\CI\Policy" `
       -Name VerifiedAndReputablePolicyState -Value 0 -Type DWord
     Restart-Computer
     ```
     *Lưu ý:* SAC một khi đã tự nâng lên *Enforcement* thì giao diện Setting sẽ không còn
     nút tắt; chỉ còn cách dùng registry trên, hoặc cài lại Windows.
2. **Quyết định theo chính sách tổ chức**: nếu không muốn tắt SAC, lựa chọn an toàn là
   **không chạy tool trên máy có SAC Enforcement**; dùng dụng cụ chẩn đoán thủ công của
   Microsoft (`slmgr`, `ospp.vbs`) vốn nằm trong hệ thống.

> Lý do tool không ký Authenticode: chi phí + quy trình cấp chứng chỉ. Không khuyến nghị
> "thêm ngoại lệ Defender" vì nó yếu đi bảo mật máy. Nếu tổ chức nghiêm ngặt về SAC, hãy
> dựa vào bản cài NSIS (vẫn không ký) và cân nhắc ký số trong tương lai.

## An toàn dữ liệu & thao tác phá hủy

- `deep_clean`/`restore` là **phá hủy**: xóa Product Key và cấu hình KMS vĩnh viễn.
- Rollback tự động **chỉ phục hồi `hosts.bak`**, phần registry giấy phép SPP bị Windows
  chặn kể cả hệ thống → sau deep_clean phải có sẵn Original Product Key để kích hoạt lại
  (`slmgr /ipk <key>`).
- **Luôn** tạo System Restore Point / snapshot VM / disk image trước khi đụng vào
  deep_clean. Xem hướng dẫn đầy đủ: `docs/RUNBOOK-DESTRUCTIVE-TESTS.md`.

## Kiểm thử & release

- Ngưỡng chất lượng: `cargo test --lib`, scan Defender offline, chữ ký minisign khớp.
- Còn 1 điều kiện bắt buộc trước **release chính thức**: chạy
  `scripts/vm-windows11-sac-test.ps1` trên **VM Windows 11 sạch** (SAC Enforcement mặc
  định) và cập nhật kết quả (a/b/c) vào phần "Smart App Control" ở trên trước khi công bố.