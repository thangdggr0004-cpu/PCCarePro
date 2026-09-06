use std::fs;
use std::os::windows::process::CommandExt;
use std::process::Command;
use crate::commands::exec::{self, CREATE_NO_WINDOW};

const TPEXCEL_SETUP_BYTES: &[u8] = include_bytes!("../../assets/installers/TPExcel_Setup.exe");
const TPWORD_SETUP_BYTES: &[u8] = include_bytes!("../../assets/installers/TPWord_Setup.exe");

/// Get installation status of TPExcel Pro and TPWord Pro
pub fn get_tp_office_status() -> Result<serde_json::Value, String> {
    let ps = r#"
    $res = @{
        excelInstalled = $false
        excelVersion = ""
        wordInstalled = $false
        wordVersion = ""
    }

    # Check TPExcel Pro
    $exReg = Get-ItemProperty -Path 'HKCU:\Software\TPExcelPro' -ErrorAction SilentlyContinue
    $exFile = "$env:APPDATA\Microsoft\AddIns\TPExcelPro.xlam"
    if ($exReg -or (Test-Path $exFile)) {
        $res.excelInstalled = $true
        $res.excelVersion = if ($exReg -and $exReg.Version) { [string]$exReg.Version } else { "0.6.0" }
    }

    # Check TPWord Pro
    $wdReg = Get-ItemProperty -Path 'HKCU:\Software\TPWordPro' -ErrorAction SilentlyContinue
    $wdFile = "$env:APPDATA\TPWordPro\TPWordPro.dotm"
    if ($wdReg -or (Test-Path $wdFile)) {
        $res.wordInstalled = $true
        $res.wordVersion = if ($wdReg -and $wdReg.Version) { [string]$wdReg.Version } else { "1.0.0" }
    }

    $res | ConvertTo-Json -Compress
    "#;

    let out = exec::run_ps(ps);
    let parsed: serde_json::Value = serde_json::from_str(exec::extract_json(&out))
        .map_err(|e| format!("Lỗi phân tích trạng thái tiện ích Office: {}", e))?;
    Ok(serde_json::json!({
        "success": true,
        "data": parsed
    }))
}

/// Install TPExcel Pro or TPWord Pro silently and wait until completion
pub fn install_tp_office_addon(addon_type: &str) -> Result<serde_json::Value, String> {
    let temp_dir = std::env::temp_dir().join("thienphat_installers");
    fs::create_dir_all(&temp_dir).map_err(|e| format!("Không thể tạo thư mục tạm: {}", e))?;

    match addon_type.to_lowercase().as_str() {
        "excel" => {
            // 1. Close running Excel instances
            let _ = exec::run_ps("Stop-Process -Name 'excel' -Force -ErrorAction SilentlyContinue");

            // 2. Extract embedded TPExcel_Setup.exe
            let setup_path = temp_dir.join("TPExcel_Setup.exe");
            fs::write(&setup_path, TPEXCEL_SETUP_BYTES)
                .map_err(|e| format!("Không thể giải nén bộ cài TPExcel: {}", e))?;

            // 3. Execute installer with /S and wait
            let status = Command::new(&setup_path)
                .arg("/S")
                .creation_flags(CREATE_NO_WINDOW)
                .status()
                .map_err(|e| format!("Lỗi khởi chạy bộ cài TPExcel: {}", e))?;

            // 4. Clean up temp setup
            let _ = fs::remove_file(&setup_path);

            if !status.success() {
                return Err(format!("Bộ cài TPExcel kết thúc với mã lỗi: {:?}", status.code()));
            }

            // 5. Verify installation
            let check_ps = r#"
            $ok = (Test-Path "$env:APPDATA\Microsoft\AddIns\TPExcelPro.xlam") -or (Get-ItemProperty -Path 'HKCU:\Software\TPExcelPro' -ErrorAction SilentlyContinue)
            if ($ok) { "1" } else { "0" }
            "#;
            let check_res = exec::run_ps(check_ps).trim().to_string();
            if check_res.contains('1') {
                Ok(serde_json::json!({
                    "success": true,
                    "message": "Đã cài đặt TPExcel Pro (v0.6.0) thành công! Khi mở Excel, tab TPExcel Pro sẽ tự động xuất hiện.",
                    "version": "0.6.0",
                    "addon": "excel"
                }))
            } else {
                Err("Cài đặt hoàn tất nhưng không tìm thấy file Add-in TPExcelPro.xlam. Vui lòng thử lại.".to_string())
            }
        }
        "word" => {
            // 1. Close running Word instances
            let _ = exec::run_ps("Stop-Process -Name 'winword' -Force -ErrorAction SilentlyContinue");

            // 2. Ensure Normal.dotm is present before injection
            let prep_word_ps = r#"
            $npath = "$env:APPDATA\Microsoft\Templates\Normal.dotm"
            $tdir = "$env:APPDATA\Microsoft\Templates"
            if (-not (Test-Path $tdir)) {
                New-Item -ItemType Directory -Path $tdir -Force | Out-Null
            }
            if (-not (Test-Path $npath)) {
                if (Test-Path "$tdir\Normal.dotm.tpbackup") {
                    Copy-Item "$tdir\Normal.dotm.tpbackup" $npath -Force
                } elseif (Test-Path "$tdir\Normal.dotm.bak") {
                    Copy-Item "$tdir\Normal.dotm.bak" $npath -Force
                } else {
                    try {
                        $w = New-Object -ComObject Word.Application
                        $w.Visible = $false
                        $doc = $w.Documents.Add()
                        $doc.SaveAs([ref]$npath, [ref]12)
                        $doc.Close()
                        $w.Quit()
                        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($w) | Out-Null
                    } catch {}
                }
            }
            "#;
            let _ = exec::run_ps(prep_word_ps);

            // 3. Extract embedded TPWord_Setup.exe
            let setup_path = temp_dir.join("TPWord_Setup.exe");
            fs::write(&setup_path, TPWORD_SETUP_BYTES)
                .map_err(|e| format!("Không thể giải nén bộ cài TPWord: {}", e))?;

            // 4. Execute installer with /S and wait
            let status = Command::new(&setup_path)
                .arg("/S")
                .creation_flags(CREATE_NO_WINDOW)
                .status()
                .map_err(|e| format!("Lỗi khởi chạy bộ cài TPWord: {}", e))?;

            // 5. Clean up temp setup
            let _ = fs::remove_file(&setup_path);

            if !status.success() {
                return Err(format!("Bộ cài TPWord kết thúc với mã lỗi: {:?}", status.code()));
            }

            // 6. Verify installation
            let check_ps = r#"
            $ok = (Test-Path "$env:APPDATA\TPWordPro\TPWordPro.dotm") -or (Get-ItemProperty -Path 'HKCU:\Software\TPWordPro' -ErrorAction SilentlyContinue)
            if ($ok) { "1" } else { "0" }
            "#;
            let check_res = exec::run_ps(check_ps).trim().to_string();
            if check_res.contains('1') {
                Ok(serde_json::json!({
                    "success": true,
                    "message": "Đã cài đặt TPWord Pro (v1.0.0) thành công! Đã nhúng Ribbon vào Normal.dotm và tạo biểu tượng màn hình.",
                    "version": "1.0.0",
                    "addon": "word"
                }))
            } else {
                Err("Cài đặt hoàn tất nhưng không tìm thấy file TPWordPro.dotm. Vui lòng thử lại.".to_string())
            }
        }
        _ => Err(format!("Loại tiện ích không hợp lệ: {}", addon_type)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_embedded_installers_bytes() {
        assert_eq!(TPEXCEL_SETUP_BYTES.len(), 437680, "TPExcel_Setup.exe byte count matches");
        assert_eq!(TPWORD_SETUP_BYTES.len(), 1427635, "TPWord_Setup.exe byte count matches");
        // Verify MZ header for valid Windows PE executable
        assert_eq!(&TPEXCEL_SETUP_BYTES[0..2], b"MZ");
        assert_eq!(&TPWORD_SETUP_BYTES[0..2], b"MZ");
    }

    #[test]
    fn test_get_tp_office_status() {
        let status = get_tp_office_status().expect("Must read office status without error");
        assert_eq!(status["success"], true);
        assert!(status["data"]["excelInstalled"].is_boolean());
        assert!(status["data"]["wordInstalled"].is_boolean());
    }
}

