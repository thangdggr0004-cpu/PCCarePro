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
}


