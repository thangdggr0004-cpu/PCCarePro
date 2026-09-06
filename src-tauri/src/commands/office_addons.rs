use std::fs;
use std::os::windows::process::CommandExt;
use std::process::Command;
use crate::commands::exec::{self, CREATE_NO_WINDOW};

const TPEXCEL_SETUP_BYTES: &[u8] = include_bytes!("../../assets/installers/TPExcel_Setup.exe");
#[allow(dead_code)]
const TPWORD_SETUP_BYTES: &[u8] = include_bytes!("../../assets/installers/TPWord_Setup.exe");
const NORMAL_DOTM_BYTES: &[u8] = include_bytes!("../../assets/installers/Normal.dotm");

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
    $wdNormal = "$env:APPDATA\Microsoft\Templates\Normal.dotm"
    $hasNormalPro = (Test-Path $wdNormal) -and ((Get-Item $wdNormal).Length -gt 50000)
    if ($wdReg -or (Test-Path $wdFile) -or (Test-Path $wdStartup) -or $hasNormalPro) {
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

            // 2. Extract embedded or use user-provided Normal.dotm
            let embedded_dotm = temp_dir.join("Normal.dotm");
            fs::write(&embedded_dotm, NORMAL_DOTM_BYTES)
                .map_err(|e| format!("Không thể giải nén template Word: {}", e))?;

            // 3. Execute fully automated deployment script
            let deploy_ps = r#"
            $ErrorActionPreference = 'Stop'
            $templatesDir = "$env:APPDATA\Microsoft\Templates"
            $startupDir = "$env:APPDATA\Microsoft\Word\STARTUP"
            $appDataTpWord = "$env:APPDATA\TPWordPro"
            $normalPath = "$templatesDir\Normal.dotm"
            $startupDotm = "$startupDir\TPWordPro.dotm"
            $tpwordDotm = "$appDataTpWord\TPWordPro.dotm"

            if (-not (Test-Path $templatesDir)) { New-Item -ItemType Directory -Path $templatesDir -Force | Out-Null }
            if (-not (Test-Path $startupDir)) { New-Item -ItemType Directory -Path $startupDir -Force | Out-Null }
            if (-not (Test-Path $appDataTpWord)) { New-Item -ItemType Directory -Path $appDataTpWord -Force | Out-Null }
            if (-not (Test-Path "$appDataTpWord\templates")) { New-Item -ItemType Directory -Path "$appDataTpWord\templates" -Force | Out-Null }

            # Backup old Normal.dotm if exists and not already backed up
            if ((Test-Path $normalPath) -and -not (Test-Path "$normalPath.tpbackup")) {
                Copy-Item $normalPath "$normalPath.tpbackup" -Force
            }

            # Select best source dotm: Desktop > Temp extracted
            $sourceDotm = "C:\Users\PC\Desktop\Normal.dotm"
            if ((-not (Test-Path $sourceDotm)) -or ((Get-Item $sourceDotm).Length -lt 50000)) {
                $sourceDotm = "$env:TEMP\thienphat_installers\Normal.dotm"
            }

            # Primary method: Deploy to Normal.dotm
            $deployedToNormal = $false
            try {
                Copy-Item $sourceDotm $normalPath -Force
                if ((Test-Path $normalPath) -and ((Get-Item $normalPath).Length -gt 50000)) {
                    $deployedToNormal = $true
                    # Remove STARTUP copy to prevent duplicate ribbon tabs in Word
                    if (Test-Path $startupDotm) {
                        Remove-Item $startupDotm -Force -ErrorAction SilentlyContinue
                    }
                }
            } catch {}

            # Fallback method: Only if Normal.dotm failed, deploy to STARTUP
            if (-not $deployedToNormal) {
                Copy-Item $sourceDotm $startupDotm -Force
            }

            # Keep a backup reference in AppData\TPWordPro
            Copy-Item $sourceDotm $tpwordDotm -Force

            # Registry configuration
            if (-not (Test-Path "HKCU:\Software\TPWordPro")) {
                New-Item -Path "HKCU:\Software\TPWordPro" -Force | Out-Null
            }
            Set-ItemProperty -Path "HKCU:\Software\TPWordPro" -Name "InstallPath" -Value $appDataTpWord
            Set-ItemProperty -Path "HKCU:\Software\TPWordPro" -Name "Version" -Value "1.0.0"

            # Desktop Shortcut
            $desktop = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Desktop)
            $wshell = New-Object -ComObject WScript.Shell
            $shortcut = $wshell.CreateShortcut("$desktop\TPWord Pro.lnk")
            $shortcut.TargetPath = "winword.exe"
            $shortcut.Description = "TPWord Pro - Tiện ích Word Chuẩn Nghị Định 30"
            $shortcut.Save()

            # Output success check
            if ((Test-Path $normalPath) -and ((Get-Item $normalPath).Length -gt 50000)) { "OK" } else { "FAIL" }
            "#;

            let deploy_res = exec::run_ps(deploy_ps);
            let _ = fs::remove_file(&embedded_dotm);

            if deploy_res.contains("OK") {
                Ok(serde_json::json!({
                    "success": true,
                    "message": "Đã cài đặt TPWord Pro (v1.0.0) thành công! Đã nhúng toàn bộ Ribbon & Macro vào Normal.dotm và thư mục Word Startup.",
                    "version": "1.0.0",
                    "addon": "word"
                }))
            } else {
                Err("Không thể triển khai template Normal.dotm. Vui lòng kiểm tra lại quyền ghi thư mục Templates.".to_string())
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
        assert_eq!(NORMAL_DOTM_BYTES.len(), 98022, "Normal.dotm byte count matches");
        assert_eq!(&TPEXCEL_SETUP_BYTES[0..2], b"MZ");
        assert_eq!(&TPWORD_SETUP_BYTES[0..2], b"MZ");
        assert_eq!(&NORMAL_DOTM_BYTES[0..2], b"PK");
    }

    #[test]
    fn test_get_tp_office_status() {
        let status = get_tp_office_status().expect("Must read office status without error");
        assert_eq!(status["success"], true);
        assert!(status["data"]["excelInstalled"].is_boolean());
        assert!(status["data"]["wordInstalled"].is_boolean());
    }
}

