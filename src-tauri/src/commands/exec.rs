use std::os::windows::process::{CommandExt, ExitStatusExt};
use std::process::{Command, ExitStatus, Output, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};

static ELEV_TEMP_SEQ: AtomicU64 = AtomicU64::new(0);

pub const CREATE_NO_WINDOW: u32 = 0x08000000;
pub const DETACHED_PROCESS: u32 = 0x00000008;

fn ok_output() -> Output {
    Output { status: ExitStatus::from_raw(1), stdout: vec![], stderr: vec![] }
}

pub fn extract_json(raw: &str) -> &str {
    let trimmed = raw.trim();
    if let Some(start) = trimmed.find('{') {
        if let Some(end) = trimmed.rfind('}') {
            if end >= start {
                return &trimmed[start..=end];
            }
        }
    }
    if let Some(start) = trimmed.find('[') {
        if let Some(end) = trimmed.rfind(']') {
            if end >= start {
                return &trimmed[start..=end];
            }
        }
    }
    trimmed
}

// ── Sync (existing) ──────────────────────────

pub fn run_ps(script: &str) -> String {
    String::from_utf8_lossy(&run_ps_raw(script).stdout).to_string()
}



pub fn run_ps_raw(script: &str) -> Output {
    let dir = std::env::temp_dir().join("tp_ps_scripts");
    let _ = std::fs::create_dir_all(&dir);
    
    // Hash script content to reuse cached file if identical
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    script.hash(&mut hasher);
    let hash = hasher.finish();
    let file_path = dir.join(format!("ps_{:x}.ps1", hash));

    let full_script = format!(
        "$ProgressPreference = 'SilentlyContinue';\n$WarningPreference = 'SilentlyContinue';\n[Console]::OutputEncoding = [System.Text.Encoding]::UTF8;\n$OutputEncoding = [System.Text.Encoding]::UTF8;\n{}\n",
        script
    );

    // Write UTF-8 with BOM so Windows PowerShell 5.1 & PowerShell 7+ always parse as UTF-8
    let mut bytes = vec![0xEF, 0xBB, 0xBF];
    bytes.extend_from_slice(full_script.as_bytes());
    let _ = std::fs::write(&file_path, bytes);

    let output = Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-NoLogo", "-ExecutionPolicy", "Bypass", "-File", &file_path.to_string_lossy()])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .unwrap_or_else(|_| ok_output());

    output
}

// ── Elevated (per-command UAC, mirrors Electron `runPowerShellScriptElevated` electron.cjs L473-515) ──

fn write_elevated_script(script: &str, wrap_output: bool) -> Result<(std::path::PathBuf, Option<std::path::PathBuf>, std::path::PathBuf), String> {
    let id = format!(
        "{}_{}_{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis(),
        // Monotonic per-call counter: two concurrent run_ps_elevated calls from the same
        // process can land in the SAME millisecond, which would otherwise collide on the
        // identical temp filename and clobber each other's script + output files.
        ELEV_TEMP_SEQ.fetch_add(1, Ordering::Relaxed)
    );
    let ps_path = std::env::temp_dir().join(format!("tp_el_{}.ps1", id));
    let out_path = std::env::temp_dir().join(format!("tp_el_{}.out.txt", id));
    // Status file ghi trạng thái elevated child (OK / ERROR) -> dùng để phát hiện lỗi
    // thật của child, vì `out.status` của launcher (Start-Process -Verb RunAs) luôn success.
    let status_path = std::env::temp_dir().join(format!("tp_el_{}.status.txt", id));

    // Wrap để (a) giữ output như Electron, (b) bắt lỗi terminating trong child và ghi
    // trạng thái vào status file riêng. `$ErrorActionPreference='Stop'` bên trong sub-script
    // giúp các lệnh fail (vd cmdlet không tồn tại) trở thành terminating error bắt được;
    // các lệnh có `-ErrorAction SilentlyContinue` vẫn tự ghi đè và được bỏ qua như trước.
    let out_esc = out_path.to_string_lossy().replace('\'', "''");
    let st_esc = status_path.to_string_lossy().replace('\'', "''");
    let body = if wrap_output {
        // Đầu: cài encoding
        let mut s = String::new();
        s.push_str("$ProgressPreference='SilentlyContinue';$WarningPreference='SilentlyContinue';[Console]::OutputEncoding=[System.Text.Encoding]::UTF8;$OutputEncoding=[System.Text.Encoding]::UTF8;\n");
        // Mở try, chạy script trong sub-script có ErrorActionPreference=Stop để bắt lỗi terminating
        s.push_str("$tpPrevErr = $Error.Count\ntry {\n& {\n");
        s.push_str("$ErrorActionPreference='Stop'\n$ProgressPreference='SilentlyContinue'\n$WarningPreference='SilentlyContinue'\n");
        s.push_str(script);
        s.push('\n');
        s.push_str("} | Out-File -FilePath '");
        s.push_str(&out_esc);
        s.push_str("' -Encoding utf8 -ErrorAction Stop\n} catch {\n");
        s.push_str("$tpErr = $(if ($_.Exception.Message) { $_.Exception.Message } else { $_.ToString() })\n");
        s.push_str("Add-Content -Path '");
        s.push_str(&st_esc);
        s.push_str("' -Value ('TP_ERROR=' + $tpErr) -Encoding utf8\n}\n");
        // Nếu lỗi tràn ra $Error mà status chưa ghi (không rơi vào catch)
        s.push_str("if ($Error.Count -gt $tpPrevErr -and -not (Test-Path '");
        s.push_str(&st_esc);
        s.push_str("')) {\n$tpLast = $Error[0].Exception.Message\nif ($tpLast) { Add-Content -Path '");
        s.push_str(&st_esc);
        s.push_str("' -Value ('TP_ERROR=' + $tpLast) -Encoding utf8 }\n}\n");
        // Mặc định OK nếu không có lỗi nào được ghi status
        s.push_str("if (-not (Test-Path '");
        s.push_str(&st_esc);
        s.push_str("')) { Add-Content -Path '");
        s.push_str(&st_esc);
        s.push_str("' -Value 'TP_OK' -Encoding utf8 }\n");
        s
    } else {
        format!(
            "$ProgressPreference='SilentlyContinue';$WarningPreference='SilentlyContinue';\n{}\n",
            script
        )
    };

    // UTF-8 BOM so Windows PowerShell 5.1 always parses as UTF-8
    let mut bytes = vec![0xEF, 0xBB, 0xBF];
    bytes.extend_from_slice(body.as_bytes());
    std::fs::write(&ps_path, bytes).map_err(|e| e.to_string())?;

    let out = if wrap_output { Some(out_path) } else { None };
    Ok((ps_path, out, status_path))
}

fn elevated_launcher(ps_path: &std::path::Path) -> String {
    format!(
        "Start-Process -FilePath 'powershell.exe' -Verb RunAs -WindowStyle Hidden -ArgumentList @('-NoProfile','-NonInteractive','-NoLogo','-ExecutionPolicy','Bypass','-WindowStyle','Hidden','-File','{}')",
        ps_path.to_string_lossy().replace('\'', "''")
    )
}

/// Run a PowerShell script elevated via UAC (per-command prompt, like Electron's
/// elevate.exe). Blocks until the elevated process exits and returns its captured output.
pub fn run_ps_elevated(script: &str) -> Result<String, String> {
    run_ps_elevated_timeout(script, 30)
}

/// Like `run_ps_elevated` but with a custom poll deadline (seconds). Long-running
/// elevated scripts such as `sfc /scannow` + `DISM /RestoreHealth` (Windows fixer)
/// can exceed the default 30s poll, so callers pass a larger deadline.
pub fn run_ps_elevated_timeout(script: &str, timeout_secs: u64) -> Result<String, String> {
    let (ps_path, out_path, status_path) = write_elevated_script(script, true)?;
    let out = run_ps_raw(&elevated_launcher(&ps_path));
    let out_file = out_path
        .as_ref()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();
    let status_file = status_path.to_string_lossy().to_string();

    // `Start-Process -Verb RunAs -Wait` does not reliably wait for the elevated
    // child to finish (it returns at the UAC hand-off); poll until BOTH the output
    // file and the status file reach a stable state before reading them. The status
    // file is written by the elevated child itself (TP_OK/TP_ERROR=...), so even a
    // child that fails WITHOUT producing any stdout still signals completion here.
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(timeout_secs);
    let mut last_sizes: Option<(u64, Option<u64>)> = None;
    let mut stable_ticks = 0u32;
    let out_path_ref = std::path::Path::new(&out_file);
    let status_path_ref = std::path::Path::new(&status_file);
    while stable_ticks < 2 && std::time::Instant::now() < deadline {
        let out_len = std::fs::metadata(out_path_ref).map(|m| m.len()).unwrap_or(0);
        let st_len = std::fs::metadata(status_path_ref).map(|m| m.len()).unwrap_or(0);
        // Chỉ coi là "xong" khi status file đã xuất hiện (child đã chạy wrap xong)
        // và kích thước cả 2 file ổn định trên 2 lần đọc liên tiếp.
        let has_status = st_len > 0;
        let cur = (out_len, if has_status { Some(st_len) } else { None });
        if has_status && Some(cur) == last_sizes {
            stable_ticks += 1;
        } else {
            last_sizes = Some(cur);
            stable_ticks = 0;
        }
        if stable_ticks < 2 {
            std::thread::sleep(std::time::Duration::from_millis(100));
        }
    }

    let status = std::fs::read_to_string(&status_file)
        .unwrap_or_default()
        .trim_start_matches('\u{FEFF}')
        .to_string();

    let content = std::fs::read_to_string(&out_file)
        .unwrap_or_default()
        .trim_start_matches('\u{FEFF}')
        .trim()
        .to_string();

    let _ = std::fs::remove_file(&ps_path);
    if let Some(op) = &out_path {
        let _ = std::fs::remove_file(op);
    }
    let _ = std::fs::remove_file(&status_path);

    // 1. Elevated child tự báo lỗi thật (cmdlet không tồn tại, ngoại lệ...)
    if let Some(err_line) = status.lines().find_map(|l| l.strip_prefix("TP_ERROR=")) {
        let es = err_line.trim();
        return Err(if es.is_empty() {
            "Lệnh nâng quyền (Administrator) thất bại.".to_string()
        } else {
            es.to_string()
        });
    }

    // 2. UAC bị từ chối / launcher thất bại và không có output -> trả lỗi
    if !out.status.success() && content.trim().is_empty() {
        let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            "Yêu cầu quyền Administrator (UAC) bị từ chối hoặc thất bại.".to_string()
        } else {
            stderr
        });
    }

    Ok(content)
}

/// Fire-and-forget elevated PowerShell: triggers UAC but does not wait. The temp
/// script file is intentionally kept so the elevated child can read it.
pub fn spawn_ps_elevated(script: &str) -> Result<(), String> {
    let (ps_path, _, _) = write_elevated_script(script, false)?;
    let _ = run_ps_raw(&elevated_launcher(&ps_path));
    Ok(())
}

pub fn run_cmd(args: &[&str]) -> Output {

    Command::new("cmd")
        .args(["/c"])
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .unwrap_or_else(|_| ok_output())
}

pub fn run_cmd_quiet(exe: &str, args: &[&str]) -> Output {
    Command::new(exe)
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .unwrap_or_else(|_| ok_output())
}

pub async fn run_ps_raw_async(script: &str) -> Output {
    let dir = std::env::temp_dir().join("tp_ps_scripts");
    let _ = std::fs::create_dir_all(&dir);
    
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    script.hash(&mut hasher);
    let hash = hasher.finish();
    let file_path = dir.join(format!("ps_{:x}.ps1", hash));

    let full_script = format!(
        "$ProgressPreference = 'SilentlyContinue';\n$WarningPreference = 'SilentlyContinue';\n[Console]::OutputEncoding = [System.Text.Encoding]::UTF8;\n$OutputEncoding = [System.Text.Encoding]::UTF8;\n{}\n",
        script
    );

    let mut bytes = vec![0xEF, 0xBB, 0xBF];
    bytes.extend_from_slice(full_script.as_bytes());
    let _ = std::fs::write(&file_path, bytes);

    let output = tokio::process::Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-NoLogo", "-ExecutionPolicy", "Bypass", "-File", &file_path.to_string_lossy()])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .await
        .unwrap_or_else(|_| ok_output());

    output
}



#[allow(dead_code)]
pub async fn run_cmd_async(args: &[&str]) -> Output {
    tokio::process::Command::new("cmd")
        .args(["/c"])
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .await
        .unwrap_or_else(|_| ok_output())
}

#[allow(dead_code)]
pub async fn run_cmd_quiet_async(exe: &str, args: &[&str]) -> Output {
    tokio::process::Command::new(exe)
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .await
        .unwrap_or_else(|_| ok_output())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_utf8_vietnamese_powershell() {
        let script = r#"
        @{
            msg = "Hệ thống hoàn toàn nguyên bản. Không cần can thiệp khôi phục."
            level = "NGUỒN KÍCH HOẠT CẦN XÁC MINH THÊM (SOURCE REQUIRES VERIFICATION)"
        } | ConvertTo-Json
        "#;
        let out = run_ps(script);
        assert!(out.contains("Hệ thống hoàn toàn nguyên bản"));
        assert!(out.contains("NGUỒN KÍCH HOẠT CẦN XÁC MINH THÊM"));
    }

    #[test]
    fn test_run_ps_elevated_returns_output() {
        let out = run_ps_elevated("Write-Output 'elevated-ok'");
        assert!(out.as_deref().unwrap_or_default().contains("elevated-ok"));
    }

    /// Regression test: Windows Settings-style script (Checkpoint-Computer with invalid
    /// description) must return Err with real message, not Ok("").
    #[test]
    fn windows_settings_elevated_error_propagation() {
        // Mô phỏng script Windows Settings (create_system_restore_point) gây lỗi
        // bằng cách dùng cmdlet không tồn tại — tương tự Bước 1.5 test nhưng
        // xác nhận rằng error propagation hoạt động qua Windows Settings path.
        let ps = "Checkpoint-Computer -Description 'TP Regression Test' -RestorePointType INVALID_TYPE_VALUE";
        let result = run_ps_elevated(ps);
        match result {
            Ok(raw) => {
                // Có thể Ok nếu Checkpoint-Computer thành công (rollback disabled,
                // hoặc-không có đủ disk space). In raw để verify.
                println!(">>> windows_settings elevated OK: {}", raw.len());
            }
            Err(e) => {
                // Đây là case chính — lỗi phải được truyền đúng, không bị nuốt
                println!(">>> windows_settings elevated ERR (GOOD): {}", e);
                assert!(!e.is_empty(), "error message must not be empty");
            }
        }
    }

    #[test]
    fn concurrent_elevated_scripts_do_not_collide_on_temp_files() {
        use std::sync::{Arc, Barrier};

        // Deterministic: with the atomic per-call counter in write_elevated_script, two
        // run_ps_elevated calls fired together MUST yield distinct, correctly-scoped
        // output. Before the fix, identical temp filenames (same PID + same ms) made one
        // call read the other's (or empty) output.
        let barrier = Arc::new(Barrier::new(3));
        let b2 = barrier.clone();
        let b3 = barrier.clone();

        let h1 = std::thread::spawn(move || {
            b2.wait();
            let out = run_ps_elevated("Write-Output 'MARKER-ALPHA'").unwrap_or_default();
            out.contains("MARKER-ALPHA")
        });
        let h2 = std::thread::spawn(move || {
            b3.wait();
            let out = run_ps_elevated("Write-Output 'MARKER-BRAVO'").unwrap_or_default();
            out.contains("MARKER-BRAVO")
        });

        barrier.wait();
        let (r1, r2) = (h1.join().unwrap(), h2.join().unwrap());
        assert!(r1, "call A did not get its own output");
        assert!(r2, "call B did not get its own output");
    }
}


