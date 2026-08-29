use std::os::windows::process::{CommandExt, ExitStatusExt};
use std::process::{Command, ExitStatus, Output, Stdio};

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

fn write_elevated_script(script: &str, wrap_output: bool) -> Result<(std::path::PathBuf, Option<std::path::PathBuf>), String> {
    let id = format!(
        "{}_{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis()
    );
    let ps_path = std::env::temp_dir().join(format!("tp_el_{}.ps1", id));
    let out_path = std::env::temp_dir().join(format!("tp_el_{}.out.txt", id));

    // Wrap exactly like Electron's runPowerShellScriptElevated (electron.cjs L480-483):
    // `& { script } | Out-File -FilePath out -Encoding utf8`. PS 5.1 file redirection
    // (`*>`) writes UTF-16 by default, so we force `Out-File -Encoding utf8`.
    let body = if wrap_output {
        format!(
            "& {{\n$ProgressPreference='SilentlyContinue';$WarningPreference='SilentlyContinue';\n[Console]::OutputEncoding=[System.Text.Encoding]::UTF8;$OutputEncoding=[System.Text.Encoding]::UTF8;\n{}\n}} | Out-File -FilePath '{}' -Encoding utf8\n",
            script,
            out_path.to_string_lossy().replace('\'', "''")
        )
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
    Ok((ps_path, out))
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
    let (ps_path, out_path) = write_elevated_script(script, true)?;
    let out = run_ps_raw(&elevated_launcher(&ps_path));
    let out_file = out_path
        .as_ref()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();

    // `Start-Process -Verb RunAs -Wait` does not reliably wait for the elevated
    // child to finish (it returns at the UAC hand-off); poll until the output
    // file exists with a stable, non-empty size before reading it.
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(timeout_secs);
    let mut stable_len: Option<u64> = None;
    let mut stable_ticks = 0u32;
    let poll_file = std::path::Path::new(&out_file);
    while stable_ticks < 2 && std::time::Instant::now() < deadline {
        let len = std::fs::metadata(poll_file).map(|m| m.len()).unwrap_or(0);
        if len > 0 && Some(len) == stable_len {
            stable_ticks += 1;
        } else {
            stable_len = if len > 0 { Some(len) } else { None };
            stable_ticks = 0;
        }
        if stable_ticks < 2 {
            std::thread::sleep(std::time::Duration::from_millis(100));
        }
    }

    let content = std::fs::read_to_string(&out_file)
        .unwrap_or_default()
        .trim_start_matches('\u{FEFF}')
        .trim()
        .to_string();
    let _ = std::fs::remove_file(&ps_path);
    if let Some(op) = &out_path {
        let _ = std::fs::remove_file(op);
    }
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
    let (ps_path, _) = write_elevated_script(script, false)?;
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
}


