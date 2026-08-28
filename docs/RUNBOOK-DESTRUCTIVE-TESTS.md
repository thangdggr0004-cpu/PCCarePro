# Runbook — Test Phá Hủy (Destructive Tests)

## Mục đích
Hướng dẫn bắt buộc trước khi chạy **bất kỳ** thao tác phá hủy nào trên máy thật
(`deep_clean_activation` / "Đặt lại trạng thái Windows" / `restore_oem_bios_key`).

## Vì sao phải sao lưu phòng hộ trước
`deep_clean_activation` thực thi `slmgr /upk`, `slmgr /cpky`, `slmgr /rearm`:

- **Xóa vĩnh viễn** Product Key và cấu hình KMS hiện tại trên máy.
- Rollback tự động của tool (RollbackManager / `rollback_backup`) **chỉ phục hồi được
  `hosts.bak`**. Phần registry giấy phép (SPP: `HKLM\SOFTWARE\Microsoft\Windows
  NT\CurrentVersion\SoftwareProtectionPlatform` và key 0xC004D302 path) **bị Windows
  chặn quyền ghi kể cả tài khoản SYSTEM** — test thực tế cho thấy `reg import` luôn trả
  lỗi "Error accessing the registry", kể cả khi chạy qua scheduled task ở mức SYSTEM.
- `restore_oem_bios_key` chỉ ĐỌC (`wmic path SoftwareLicensingService get
  OA3xOriginalProductKey`) nhưng phụ thuộc firmware/ACPI — cần giữ nguyên bản firmware.

=> Sau deep_clean, máy có thể về trạng thái **Chưa kích hoạt** và chỉ kích hoạt lại được
thủ công với Original Product Key mà người dùng phải có sẵn.

## Quy tắc bắt buộc (chọn 1 trong 2)

### Lựa chọn A — Chạy trong Máy Ảo (khuyến nghị)
- Dùng Hyper-V / VirtualBox / VMware chạy bản Windows giống máy đích (như Win10 IoT
  Enterprise LTSC hoặc Win11).
- Snapshot VM TRƯỚC khi chạy thao tác phá hủy → rollback toàn bộ bằng revert snapshot.
- Không thao tác liên quan giấy phép thật của máy chính.

### Lựa chọn B — Chạy trên máy thật (chỉ khi bắt buộc)
1. Tạo **System Restore Point**: `Enable-ComputerRestore -Drive "C:\"` rồi
   `Checkpoint-Computer -Description "truoc-deep-clean" -RestorePointType MODIFY_SETTINGS`.
2. Hoặc chụp **full disk image** (bản sao hệ thống) ra ổ ngoài.
3. Ghi lại Original Product Key (`OA3xOriginalProductKey` từ BIOS, hoặc COA / account
   Microsoft) vào nơi an toàn — **không** lưu trong thư mục dự án / repo.
4. Chạy thao tác, sau khi xong mở rộng kiểm tra:
   - `slmgr /dli` → trạng thái License.
   - `slmgr /ipk <key>` → nạp lại khóa nếu cần.
5. Nếu xảy ra sự cố không phục hồi được bằng Restore Point → dùng disk image.

## Checklist trước khi chạy
- [ ] Đã tạo Restore Point / snapshot VM / disk image (một trong ba).
- [ ] Đã ghi lại Original Product Key (BIOS/COA/account MS).
- [ ] Đã sao lưu công việc đang mở.
- [ ] Đã xác nhận người dùng hiểu hậu quả: Windows có thể về trạng thái Chưa kích hoạt
      và rollback tự động KHÔNG đầy đủ (chỉ hosts.bak).

## Ghi chú từ kiểm tra thực tế (2026-08-28)
- deep_clean chạy thành công: backup `tp_backup_20260828_063143` (4 mục) + xóa cấu hình.
- Hệ thống về `Unlicensed` (0xC004D302); rollback khôi phục được hosts.bak, **không** khôi
  phục được SPP registry; `/rilc` không đủ; khôi phục thủ công cần `/ipk` + `/ato` sau reboot.