use serde::Deserialize;
use serde_json::Value;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncWriteExt, BufWriter};

const GITHUB_LATEST: &str =
    "https://api.github.com/repos/thangdggr0004-cpu/PCCarePro/releases/latest";
const ASSET_NAME: &str = "pccare-master-pro.exe";
const STAGED_NAME: &str = "pccare-update.exe";

/// Return the update-check endpoint URL. Respects the `PORTABLE_UPDATE_ENDPOINT`
/// env-var override (used by the E2E test script to redirect update checks to a
/// local server instead of the real GitHub Releases API).
fn get_update_endpoint() -> String {
    std::env::var("PORTABLE_UPDATE_ENDPOINT").unwrap_or_else(|_| GITHUB_LATEST.to_string())
}

#[derive(Deserialize)]
struct GhAsset {
    name: String,
    browser_download_url: String,
}

#[derive(Deserialize)]
struct GhRelease {
    tag_name: String,
    body: Option<String>,
    assets: Vec<GhAsset>,
}

fn version_newer(latest: &str, current: &str) -> bool {
    let parse = |v: &str| -> Option<(u64, u64, u64)> {
        let v = v.trim().trim_start_matches('v');
        let mut it = v.split('.');
        Some((
            it.next()?.parse().ok()?,
            it.next().unwrap_or("0").parse().unwrap_or(0),
            it.next().unwrap_or("0").parse().unwrap_or(0),
        ))
    };
    match (parse(latest), parse(current)) {
        (Some(l), Some(c)) => l > c,
        _ => false,
    }
}

fn http_client() -> Result<reqwest::Client, String> {
    let _ = rustls::crypto::ring::default_provider().install_default();
    reqwest::Client::builder()
        .user_agent("PCCareMasterPro")
        .build()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn portable_update_check(app: AppHandle) -> Result<Value, String> {
    let client = http_client()?;
    let endpoint = get_update_endpoint();
    let release: GhRelease = client
        .get(&endpoint)
        .send()
        .await
        .map_err(|e| format!("Không truy cập được GitHub: {e}"))?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| format!("Phản hồi GitHub không hợp lệ: {e}"))?;

    let latest_version = release.tag_name.trim_start_matches('v').to_string();
    let current_version = app.package_info().version.to_string();

    if !version_newer(&latest_version, &current_version) {
        return Ok(serde_json::json!({
            "hasUpdate": false,
            "message": "Bạn đang sử dụng phiên bản mới nhất."
        }));
    }

    let notes = release.body.unwrap_or_default();
    Ok(serde_json::json!({
        "hasUpdate": true,
        "version": latest_version,
        "notes": notes,
    }))
}

#[tauri::command]
pub async fn portable_update_download(app: AppHandle) -> Result<Value, String> {
    let client = http_client()?;
    let endpoint = get_update_endpoint();
    let release: GhRelease = client
        .get(&endpoint)
        .send()
        .await
        .map_err(|e| format!("Không truy cập được GitHub: {e}"))?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| format!("Phản hồi GitHub không hợp lệ: {e}"))?;

    let latest_version = release.tag_name.trim_start_matches('v').to_string();
    let current_version = app.package_info().version.to_string();

    if !version_newer(&latest_version, &current_version) {
        return Ok(serde_json::json!({
            "hasUpdate": false,
            "message": "Bạn đang sử dụng phiên bản mới nhất."
        }));
    }

    let asset = release
        .assets
        .iter()
        .find(|a| a.name == ASSET_NAME)
        .ok_or_else(|| "Không tìm thấy file cập nhật trong release.".to_string())?;

    // Store staged update in %TEMP% so no temporary files pollute the user's working directory
    let staged = std::env::temp_dir().join(STAGED_NAME);
    let _ = std::fs::remove_file(&staged);

    let mut resp = client
        .get(&asset.browser_download_url)
        .send()
        .await
        .map_err(|e| format!("Không tải được file cập nhật: {e}"))?
        .error_for_status()
        .map_err(|e| e.to_string())?;
    let total = resp.content_length().unwrap_or(0);

    let file = tokio::fs::File::create(&staged)
        .await
        .map_err(|e| format!("Không tạo được file tạm: {e}"))?;
    let mut writer = BufWriter::new(file);
    let mut got: u64 = 0;
    while let Some(chunk) = resp.chunk().await.map_err(|e| e.to_string())? {
        writer.write_all(&chunk).await.map_err(|e| e.to_string())?;
        got += chunk.len() as u64;
        if total > 0 {
            let percent = ((got as f64 / total as f64) * 100.0) as u8;
            let _ = app.emit(
                "portable-update-progress",
                serde_json::json!({ "percent": percent }),
            );
        }
    }
    writer.flush().await.map_err(|e| e.to_string())?;
    drop(writer);

    #[cfg(target_os = "windows")]
    {
        let zone_path = format!("{}:Zone.Identifier", staged.to_string_lossy());
        let _ = std::fs::remove_file(zone_path);
    }

    let _ = app.emit(
        "portable-update-done",
        serde_json::json!({ "staged": staged.to_string_lossy() }),
    );
    Ok(serde_json::json!({
        "success": true,
        "hasUpdate": true,
        "version": latest_version,
        "staged": staged.to_string_lossy()
    }))
}

fn build_apply_powershell(pid: u32, exe: &std::path::Path, staged: &std::path::Path) -> String {
    let exe_s = exe.to_string_lossy().to_string();
    let staged_s = staged.to_string_lossy().to_string();
    let exe_dir = exe.parent().map(|p| p.to_string_lossy().to_string()).unwrap_or_default();
    format!(
        r#"$pidToWait = {pid}
$target = "{exe_s}"
$source = "{staged_s}"
$targetDir = "{exe_dir}"

try {{
    $proc = Get-Process -Id $pidToWait -ErrorAction SilentlyContinue
    if ($proc) {{ $proc.WaitForExit(10000) }}
}} catch {{}}

$ok = $false
for ($i = 0; $i -lt 40; $i++) {{
    try {{
        [System.IO.File]::Copy($source, $target, $true)
        $ok = $true
        break
    }} catch {{
        Start-Sleep -Milliseconds 250
    }}
}}

try {{ [System.IO.File]::Delete($source) }} catch {{}}
if ($targetDir -ne "") {{
    $legacy = [System.IO.Path]::Combine($targetDir, "pccare-update.exe")
    if ([System.IO.File]::Exists($legacy)) {{
        try {{ [System.IO.File]::Delete($legacy) }} catch {{}}
    }}
}}

if ($ok) {{
    Unblock-File -LiteralPath $target -ErrorAction SilentlyContinue
    Start-Process -FilePath $target
}}
"#
    )
}

#[tauri::command]
pub async fn portable_update_apply(_app: AppHandle) -> Result<Value, String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let mut staged = std::env::temp_dir().join(STAGED_NAME);
    if !staged.exists() {
        // Fallback: check exe_dir for legacy downloads
        if let Some(dir) = exe.parent() {
            let legacy = dir.join(STAGED_NAME);
            if legacy.exists() {
                staged = legacy;
            }
        }
    }
    if !staged.exists() {
        return Err("Chưa có file cập nhật đã tải. Hãy tải cập nhật trước.".to_string());
    }

    let ps_script = build_apply_powershell(std::process::id(), &exe, &staged);
    let utf16: Vec<u16> = ps_script.encode_utf16().collect();
    let mut bytes = Vec::with_capacity(utf16.len() * 2);
    for u in utf16 {
        bytes.extend_from_slice(&u.to_le_bytes());
    }
    use base64::Engine;
    let encoded = base64::engine::general_purpose::STANDARD.encode(&bytes);

    let mut cmd = std::process::Command::new("powershell.exe");
    cmd.args([
        "-NoProfile",
        "-NonInteractive",
        "-WindowStyle",
        "Hidden",
        "-EncodedCommand",
        &encoded,
    ]);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    cmd.spawn()
        .map_err(|e| format!("Không khởi động được bộ áp dụng cập nhật: {e}"))?;

    // Give powershell a moment to launch, then exit to release file lock immediately
    tokio::time::sleep(std::time::Duration::from_millis(200)).await;
    std::process::exit(0);
}

pub fn cleanup_stale_update() {
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let _ = std::fs::remove_file(dir.join(STAGED_NAME));
        }
    }
    let _ = std::fs::remove_file(std::env::temp_dir().join(STAGED_NAME));
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_newer_works() {
        assert!(version_newer("2.1.0", "2.0.3"));
        assert!(version_newer("3.0.0", "2.9.9"));
        assert!(!version_newer("2.0.3", "2.0.3"));
        assert!(!version_newer("1.9.9", "2.0.3"));
        assert!(!version_newer("", "2.0.3"));
    }

    #[test]
    fn apply_script_swaps_staged_then_relaunches() {
        let exe = std::path::Path::new(r"C:\Apps\Bộ Tool\pccare-master-pro.exe");
        let staged = std::path::Path::new(r"C:\Temp\pccare-update.exe");
        let script = build_apply_powershell(1234, exe, staged);
        assert!(script.contains(r#"$target = "C:\Apps\Bộ Tool\pccare-master-pro.exe""#));
        assert!(script.contains(r#"$source = "C:\Temp\pccare-update.exe""#));
        assert!(script.contains("System.IO.File]::Copy"));
        assert!(script.contains("Start-Process -FilePath $target"));
    }
}
