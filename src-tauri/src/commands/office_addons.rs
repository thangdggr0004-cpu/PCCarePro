use std::fs;
use std::os::windows::process::CommandExt;
use std::process::Command;
use crate::commands::exec::{self, CREATE_NO_WINDOW};

const TPEXCEL_SETUP_BYTES: &[u8] = include_bytes!("../../assets/installers/TPExcel_Setup.exe");
const TPWORD_DOTM_BYTES: &[u8] = include_bytes!("../../assets/installers/TPWordPro.dotm");
const TPWORD_TEMPLATES_ZIP_BYTES: &[u8] = include_bytes!("../../assets/installers/tpword_templates.zip");

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
    $wdStartup = "$env:APPDATA\Microsoft\Word\STARTUP\TPWordPro.dotm"
    if ($wdReg -or (Test-Path $wdFile) -or (Test-Path $wdStartup)) {
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

            // 2. Extract embedded TPWordPro.dotm and tpword_templates.zip
            let embedded_dotm = temp_dir.join("TPWordPro.dotm");
            fs::write(&embedded_dotm, TPWORD_DOTM_BYTES)
                .map_err(|e| format!("Không thể trích xuất add-in TPWord: {}", e))?;

            let embedded_zip = temp_dir.join("tpword_templates.zip");
            fs::write(&embedded_zip, TPWORD_TEMPLATES_ZIP_BYTES)
                .map_err(|e| format!("Không thể trích xuất mẫu văn bản: {}", e))?;

            // 3. Execute 2-step automated deployment script
            let deploy_ps = r#"
            $ErrorActionPreference = 'Stop'
            $startupDir = "$env:APPDATA\Microsoft\Word\STARTUP"
            $appDataTpWord = "$env:APPDATA\TPWordPro"
            $appDataTemplates = "$appDataTpWord\templates"
            $startupDotm = "$startupDir\TPWordPro.dotm"
            $tpwordDotm = "$appDataTpWord\TPWordPro.dotm"

            # 1. Create target directories
            if (-not (Test-Path $startupDir)) { New-Item -ItemType Directory -Path $startupDir -Force | Out-Null }
            if (-not (Test-Path $appDataTpWord)) { New-Item -ItemType Directory -Path $appDataTpWord -Force | Out-Null }
            if (-not (Test-Path $appDataTemplates)) { New-Item -ItemType Directory -Path $appDataTemplates -Force | Out-Null }

            # 2. Revert/Clean up Normal.dotm if it previously had TPWord injected (to prevent duplicate ribbon tabs)
            $normalPath = "$env:APPDATA\Microsoft\Templates\Normal.dotm"
            $normalBackup = "$normalPath.tpbackup"
            if (Test-Path $normalBackup) {
                try {
                    Copy-Item $normalBackup $normalPath -Force
                } catch {}
            }

            # 3. Source dotm: extracted TPWordPro.dotm
            $sourceDotm = "$env:TEMP\thienphat_installers\TPWordPro.dotm"
            if (-not (Test-Path $sourceDotm)) {
                $sourceDotm = "C:\Users\PC\Desktop\TPExcel\tpword\src\word\TPWordPro.dotm"
            }

            # Deploy to Word STARTUP folder (Word auto-loads any add-in here on any computer!)
            Copy-Item -LiteralPath $sourceDotm -Destination $startupDotm -Force
            # Also keep a copy in AppData\TPWordPro
            Copy-Item -LiteralPath $sourceDotm -Destination $tpwordDotm -Force

            # 4. Extract 10 document templates to AppData\TPWordPro\templates
            $sourceZip = "$env:TEMP\thienphat_installers\tpword_templates.zip"
            if (Test-Path $sourceZip) {
                try {
                    Expand-Archive -LiteralPath $sourceZip -DestinationPath $appDataTemplates -Force
                } catch {}
            }
            # Fallback: copy from local repo if available
            $localTemplates = "C:\Users\PC\Desktop\TPExcel\tpword\templates"
            if (Test-Path $localTemplates) {
                Get-ChildItem -Path "$localTemplates\*.doc" | Copy-Item -Destination $appDataTemplates -Force
            }

            # Also copy templates to STARTUP\templates so TPWord can find them regardless of search method
            $startupTemplates = "$startupDir\templates"
            if (-not (Test-Path $startupTemplates)) { New-Item -ItemType Directory -Path $startupTemplates -Force | Out-Null }
            Get-ChildItem -Path "$appDataTemplates\*.doc" -ErrorAction SilentlyContinue | Copy-Item -Destination $startupTemplates -Force

            # 5. Registry configuration
            if (-not (Test-Path "HKCU:\Software\TPWordPro")) {
                New-Item -Path "HKCU:\Software\TPWordPro" -Force | Out-Null
            }
            Set-ItemProperty -Path "HKCU:\Software\TPWordPro" -Name "InstallPath" -Value $appDataTpWord
            Set-ItemProperty -Path "HKCU:\Software\TPWordPro" -Name "Version" -Value "1.0.0"

            # 6. Desktop Shortcut
            $desktop = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Desktop)
            $wshell = New-Object -ComObject WScript.Shell
            $shortcut = $wshell.CreateShortcut("$desktop\TPWord Pro.lnk")
            $shortcut.TargetPath = "winword.exe"
            $shortcut.Description = "TPWord Pro - Tiện ích Word Chuẩn Nghị Định 30"
            $shortcut.Save()

            # Output success check: check both STARTUP\TPWordPro.dotm and at least 1 template
            $hasDotm = (Test-Path $startupDotm) -and ((Get-Item $startupDotm).Length -gt 50000)
            $hasTemplates = (Get-ChildItem "$appDataTemplates\*.doc" -ErrorAction SilentlyContinue).Count -gt 0
            if ($hasDotm -and $hasTemplates) { "OK" } else { "FAIL" }
            "#;

            let deploy_res = exec::run_ps(deploy_ps);
            let _ = fs::remove_file(&embedded_dotm);
            let _ = fs::remove_file(&embedded_zip);

            if deploy_res.contains("OK") {
                Ok(serde_json::json!({
                    "success": true,
                    "message": "Đã cài đặt TPWord Pro (v1.0.0) thành công! Đã kích hoạt add-in vào Word Startup và cài đặt đầy đủ 10 mẫu văn bản Nghị Định 30.",
                    "version": "1.0.0",
                    "addon": "word"
                }))
            } else {
                Err("Không thể triển khai TPWord Pro vào thư mục Word STARTUP. Vui lòng kiểm tra lại quyền truy cập.".to_string())
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
        assert_eq!(TPWORD_DOTM_BYTES.len(), 100068, "TPWordPro.dotm byte count matches");
        assert_eq!(TPWORD_TEMPLATES_ZIP_BYTES.len(), 1221599, "tpword_templates.zip byte count matches");
        assert_eq!(&TPEXCEL_SETUP_BYTES[0..2], b"MZ");
        assert_eq!(&TPWORD_DOTM_BYTES[0..2], b"PK");
        assert_eq!(&TPWORD_TEMPLATES_ZIP_BYTES[0..2], b"PK");
    }

    #[test]
    fn test_get_tp_office_status() {
        let status = get_tp_office_status().expect("Must read office status without error");
        assert_eq!(status["success"], true);
        assert!(status["data"]["excelInstalled"].is_boolean());
        assert!(status["data"]["wordInstalled"].is_boolean());
    }

    #[test]
    fn test_install_tpword_pro() {
        let res = install_tp_office_addon("word").expect("Must install TPWord successfully");
        assert_eq!(res["success"], true);
    }
}

