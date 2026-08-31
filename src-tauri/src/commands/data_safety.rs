use crate::commands::exec;
use std::collections::HashSet;

/// BackupManager — snapshot licensing state before mutating deep-clean operations
pub fn create_backup() -> Result<serde_json::Value, String> {
    let ps = r#"
    $ErrorActionPreference = 'SilentlyContinue'
    $root = Join-Path $env:LOCALAPPDATA 'PCCareMasterPro\backups'
    $id = 'tp_backup_' + (Get-Date -Format 'yyyyMMdd_HHmmss')
    $dir = Join-Path $root $id
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
    $items = @()

    # 1. Registry export (Software Protection Platform)
    $regFile = Join-Path $dir 'software_protection.reg'
    & reg.exe export 'HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\SoftwareProtectionPlatform' $regFile /y 2>&1 | Out-Null
    if (Test-Path $regFile) {
        $items += @{ type='reg'; path=$regFile; key='HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\SoftwareProtectionPlatform' }
    }

    # 2. Hosts file snapshot
    $hostsSrc = Join-Path $env:windir 'System32\drivers\etc\hosts'
    $hostsBak = Join-Path $dir 'hosts.bak'
    if (Test-Path $hostsSrc) {
        Copy-Item $hostsSrc $hostsBak -Force
        if (Test-Path $hostsBak) { $items += @{ type='hosts'; path=$hostsBak } }
    }

    # 3. Licensing state text (slmgr /dli + /xpr)
    $dliFile = Join-Path $dir 'slmgr_dli.txt'
    $dli = (cscript //nologo $env:windir\system32\slmgr.vbs /dli 2>&1 | Out-String).Trim()
    if ($dli) { Set-Content -Path $dliFile -Value $dli -Encoding UTF8; $items += @{ type='text'; path=$dliFile } }
    $xprFile = Join-Path $dir 'slmgr_xpr.txt'
    $xpr = (cscript //nologo $env:windir\system32\slmgr.vbs /xpr 2>&1 | Out-String).Trim()
    if ($xpr) { Set-Content -Path $xprFile -Value $xpr -Encoding UTF8; $items += @{ type='text'; path=$xprFile } }

    $manifest = @{
        id = $id
        kind = 'deep_clean'
        created = (Get-Date).ToString('o')
        items = $items
    } | ConvertTo-Json -Depth 4
    Set-Content -Path (Join-Path $dir 'manifest.json') -Value $manifest -Encoding UTF8

    @{ success=$true; backupId=$id; path=$dir; count=$items.Count } | ConvertTo-Json -Compress
    "#;
    let stdout = exec::run_ps_elevated(ps).map_err(|e| format!("Elevated backup failed: {}", e))?;
    let json = exec::extract_json(&stdout);
    Ok(serde_json::from_str(json).unwrap_or(serde_json::json!({
        "success": false,
        "error": "Không thể tạo bản sao lưu trước khi thao tác."
    })))
}

/// RollbackManager — restore a previously created backup
pub fn rollback_backup(backup_id: &str) -> Result<serde_json::Value, String> {
    // backup_id is app-generated (tp_backup_yyyyMMdd_HHmmss) — sanitize to be safe
    let safe_id: String = backup_id.chars().filter(|c| c.is_ascii_alphanumeric() || *c == '_' || *c == '-').collect();
    if safe_id.is_empty() {
        return Err("Backup ID không hợp lệ.".to_string());
    }
    let ps = format!(
        r#"
    $ErrorActionPreference = 'SilentlyContinue'
    $backupId = '{id}'
    $root = Join-Path $env:LOCALAPPDATA 'PCCareMasterPro\backups'
    $dir = Join-Path $root $backupId
    if (-not (Test-Path $dir)) {{
        @{{ success=$false; error='Không tìm thấy bản sao lưu: ' + $backupId }} | ConvertTo-Json -Compress
        exit 0
    }}
    $manifestFile = Join-Path $dir 'manifest.json'
    $manifest = if (Test-Path $manifestFile) {{ Get-Content $manifestFile -Raw | ConvertFrom-Json }} else {{ $null }}
    $restored = @()
    $failed = @()
    $detail = @()

    if ($manifest -and $manifest.items) {{
        foreach ($item in $manifest.items) {{
            $reason = 'Đã phục hồi'
            $status = 'restored'
            if ($item.type -eq 'reg' -and $item.path -and (Test-Path $item.path)) {{
                $err = (& reg.exe import $item.path 2>&1 | Out-String).Trim()
                if ($LASTEXITCODE -eq 0 -or $LASTEXITCODE -eq $null -or $LASTEXITCODE -eq '') {{
                    $restored += $item.path
                }} else {{
                    $status = 'failed'
                    $reason = 'reg.exe import lỗi (code ' + $LASTEXITCODE + '): ' + $err
                    if ($err -match 'registry') {{
                        $reason = 'Không thể ghi khóa SPP do thiếu quyền UAC elevation. Cần chạy với quyền Administrator.'
                    }}
                    $failed += $item.path
                }}
            }}
            elseif ($item.type -eq 'hosts' -and $item.path -and (Test-Path $item.path)) {{
                $hostsDst = Join-Path $env:windir 'System32\drivers\etc\hosts'
                try {{ Copy-Item $item.path $hostsDst -Force -ErrorAction Stop; $restored += $item.path }} catch {{
                    $status = 'failed'
                    $reason = 'Không sao chép được hosts.bak: ' + $_.Exception.Message
                    $failed += $item.path
                }}
            }}
            $detail += @{{ item = $item.path; type = $item.type; status = $status; reason = $reason }}
        }}
    }}

    $failedLines = @($failed | ForEach-Object {{ ' - ' + $_ }})
    @{{
        success = ($failed.Count -eq 0)
        backupId = $backupId
        restored = $restored
        failed = $failed
        detail = $detail
        output = 'Rollback: Đã phục hồi ' + $restored.Count + ' mục (' + ($restored -join ', ') + '). Thất bại ' + $failed.Count + ' mục (' + ($failed -join ', ') + ').'
    }} | ConvertTo-Json -Depth 4
    "#,
        id = safe_id
    );
    let stdout = exec::run_ps_elevated(&ps).map_err(|e| format!("Elevated rollback failed: {}", e))?;
    let json = exec::extract_json(&stdout);
    Ok(serde_json::from_str(json).unwrap_or(serde_json::json!({
        "success": false,
        "error": "Không thể phục hồi bản sao lưu."
    })))
}

/// VerificationEngine — post-operation verification re-using a fresh activation scan
/// Mirrors the Electron VerificationEngine.verifyDeepClean confidence model.
pub fn verify_clean_operation() -> Result<serde_json::Value, String> {
    let scan = super::activation::scan_windows_activation().unwrap_or_default();
    let windows = scan.get("Windows").cloned().unwrap_or(serde_json::json!({}));
    let system = scan.get("System").cloned().unwrap_or(serde_json::json!({}));

    let mut issues: Vec<String> = Vec::new();
    let mut sources: HashSet<&'static str> = HashSet::new();

    // 1. License Evidence
    let kms_host = windows["KeyManagementServiceMachine"].as_str().unwrap_or("").to_string();
    if !kms_host.is_empty() && kms_host != "N/A" {
        issues.push(format!("[KMS Host] Máy chủ KMS chưa được xóa hoàn toàn: {}", kms_host));
        sources.insert("license");
    }

    // 2. Pirated files
    let files = system["PiratedFiles"].as_array().cloned().unwrap_or_default();
    if !files.is_empty() {
        let paths: Vec<String> = files.iter().filter_map(|f| f.as_str().map(String::from)).collect();
        issues.push(format!("[File System] Vẫn còn tệp tin bẻ khóa: {}", paths.join(", ")));
        sources.insert("filesystem");
    }

    // 3. Suspicious tasks
    let tasks = system["SuspiciousTasks"].as_array().cloned().unwrap_or_default();
    if !tasks.is_empty() {
        let names: Vec<String> = tasks.iter().filter_map(|t| t["Name"].as_str().map(String::from)).collect();
        issues.push(format!("[Task Scheduler] Vẫn còn tác vụ ẩn lậu: {}", names.join(", ")));
        sources.insert("task");
    }

    // 4. Suspicious services
    let services = system["SuspiciousServices"].as_array().cloned().unwrap_or_default();
    if !services.is_empty() {
        let names: Vec<String> = services.iter().filter_map(|s| s.as_str().map(String::from)).collect();
        issues.push(format!("[Services] Vẫn còn dịch vụ ngầm lậu: {}", names.join(", ")));
        sources.insert("service");
    }

    // 5. Hosts redirects
    let hosts = system["HostsRedirects"].as_array().cloned().unwrap_or_default();
    if !hosts.is_empty() {
        let entries: Vec<String> = hosts.iter().filter_map(|h| h.as_str().map(String::from)).collect();
        issues.push(format!("[Hosts File] Vẫn còn dòng chuyển hướng file hosts: {}", entries.join(", ")));
        sources.insert("hosts");
    }

    // Confidence model: same as Electron
    let confidence = if issues.is_empty() {
        100
    } else {
        match sources.len() {
            3.. => 95,
            2 => 90,
            1 => 70,
            _ => 0,
        }
    };
    let passed = issues.is_empty() && confidence >= 90;

    Ok(serde_json::json!({
        "passed": passed,
        "confidence": confidence,
        "issues": issues,
        "evidenceUsed": serde_json::json!({
            "kmsHost": kms_host,
            "piratedFiles": files.len(),
            "suspiciousTasks": tasks.len(),
            "suspiciousServices": services.len(),
            "hostsRedirects": hosts.len()
        }),
        "evidenceAfter": serde_json::json!({
            "kmsHost": kms_host,
            "piratedFiles": files.len(),
            "suspiciousTasks": tasks.len(),
            "suspiciousServices": services.len(),
            "hostsRedirects": hosts.len()
        })
    }))
}

/// verifyBiosRestore — mirrors Electron VerificationEngine.verifyBiosRestore
pub fn verify_bios_restore(scan_result: Option<serde_json::Value>) -> Result<serde_json::Value, String> {
    let value = match scan_result {
        Some(v) => v,
        None => super::activation::scan_windows_activation().unwrap_or_default(),
    };
    let windows = value.get("Windows").cloned().unwrap_or_default();
    let status = windows["LicenseStatus"].as_i64().unwrap_or(0);
    let has_oa3 = windows["HasOA3Key"].as_bool().unwrap_or(false);
    let channel = windows["ProductKeyChannel"].as_str().unwrap_or("").to_uppercase();
    let kms_host = windows["KeyManagementServiceMachine"].as_str().unwrap_or("").to_string();

    let mut issues: Vec<String> = Vec::new();
    if !has_oa3 {
        issues.push("[OA3 Key] Không tìm thấy khóa OA3 trong BIOS phần cứng.".to_string());
    }
    if status != 1 {
        issues.push("[License Status] Khôi phục Key BIOS nhưng trạng thái bản quyền chưa đạt Licensed (Status = 1).".to_string());
    }
    if channel.contains("VOLUME_KMSCLIENT") {
        issues.push("[License Channel] Kênh cấp phép không đúng (vẫn là Volume KMS).".to_string());
    }
    if !kms_host.is_empty() && kms_host != "N/A" {
        issues.push(format!("[KMS Host] Vẫn còn liên kết tới máy chủ KMS: {}", kms_host));
    }

    Ok(serde_json::json!({
        "passed": issues.is_empty(),
        "confidence": if issues.is_empty() { 100 } else { 90 },
        "issues": issues,
        "evidenceUsed": [],
        "evidenceAfter": []
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn verify_clean_operation_shape() {
        let res = verify_clean_operation().expect("should run");
        assert!(res["passed"].is_boolean());
        assert!(res["confidence"].is_number());
        assert!(res["issues"].is_array());
        let c = res["confidence"].as_i64().unwrap();
        assert!(c >= 0 && c <= 100);
        if let Some(true) = res["passed"].as_bool() {
            assert_eq!(c, 100, "clean machine must have 100 confidence");
        }
    }

    #[test]
    fn verify_bios_restore_shape() {
        let res = verify_bios_restore(None).expect("should run");
        assert!(res["passed"].is_boolean());
        assert!(res["issues"].is_array());
    }

    /// Regression: create_backup must use run_ps_elevated and propagate errors.
    /// On a system with UAC, this should succeed (returns Ok with backup JSON)
    /// or fail gracefully (returns Err from run_ps_elevated) — never panic.
    #[test]
    fn create_backup_elevated_returns_result() {
        let result = create_backup();
        match result {
            Ok(val) => {
                assert!(val.is_object(), "backup result must be a JSON object");
                assert!(val.get("success").is_some(), "backup must have 'success' field");
                println!(">>> create_backup OK: {:?}", val);
            }
            Err(e) => {
                assert!(!e.is_empty(), "error message must not be empty");
                assert!(e.contains("Elevated"), "error should mention elevation: {}", e);
                println!(">>> create_backup ERR (expected if no admin): {}", e);
            }
        }
    }

    /// Regression: rollback_backup with invalid ID must return Err, not panic.
    #[test]
    fn rollback_backup_invalid_id_is_error() {
        let result = rollback_backup("'; Remove-Item C:\\ -Recurse -Force; #");
        match result {
            Ok(val) => {
                // Should return success=false with error, not actually delete anything
                let success = val["success"].as_bool().unwrap_or(true);
                assert!(!success, "invalid backup_id should return success=false");
                println!(">>> rollback_backup invalid ID: {:?}", val);
            }
            Err(e) => {
                println!(">>> rollback_backup invalid ID ERR: {}", e);
            }
        }
    }

    /// Raw run_ps_elevated failure: proves the elevation mechanism returns real
    /// errors, not silent Ok(""). This is the SAME mechanism used by all 5 fixed
    /// functions after the Part A fix.
    #[test]
    fn run_ps_elevated_failing_script_returns_err() {
        let bad_ps = "Throw 'SIMULATED_ELEVATED_FAILURE'";
        let result = crate::commands::exec::run_ps_elevated(bad_ps);
        match result {
            Ok(raw) => {
                panic!("run_ps_elevated with Throw should return Err, got Ok: {}", raw);
            }
            Err(e) => {
                assert!(e.contains("SIMULATED_ELEVATED_FAILURE"),
                    "error should contain the Throw message, got: {}", e);
                println!(">>> run_ps_elevated Throw test: Err(\"{}\")", e);
            }
        }
    }
}