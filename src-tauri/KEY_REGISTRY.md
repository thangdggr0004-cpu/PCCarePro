# Signing Key Registry

Danh sách tất cả signing key đã tạo, map với pubkey tương ứng.
**PHẢI cập nhật file này mỗi khi tạo key mới.**

## Active Key (hiện tại đang dùng)

| Field | Value |
|---|---|
| **Pubkey ID** | `57E6A93C82E0A64` |
| **Key file** | `updater-v203-new.key` |
| **Created** | 2026-08-31 |
| **Used in** | v2.0.3+ |
| **tauri.conf.json** | ✅匹配 |

## Archive (key cũ, không dùng nữa)

| Pubkey ID | Key file | Used in | Lý do ngưng |
|---|---|---|---|
| `BD7394CE9C1C681` | *(mất)* | v2.0.2 | Key file bị mất, không tìm lại được |
| `CA9A8D77F559ED0B` | `mykey_nopw.key` | v2.0.2 ( rebuild) | Sai key → latest.json verify fail |

## Rules

1. **Trước khi tạo key mới**: đọc file này, xác nhận chưa có key nào match
2. **Sau khi tạo key mới**: CẬP NHẬT file này NGAY (pubkey ID + key filename + version)
3. **Trước khi release**: kiểm tra pubkey trong `tauri.conf.json` khớp với pubkey ID ở mục Active
4. **KHÔNG BAO GIỜ** xóa key file cũ — luôn giữ trong thư mục `src-tauri/`
5. **Backup**: upload key file lên private repo hoặc cloud storage an toàn
