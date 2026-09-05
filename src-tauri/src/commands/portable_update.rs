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

    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let exe_dir = exe.parent().ok_or("Cannot determine exe directory")?;
    let staged = exe_dir.join(STAGED_NAME);
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

fn build_apply_script(exe: &std::path::Path) -> std::path::PathBuf {
    let exe_dir = exe.parent().unwrap_or(std::path::Path::new("."));
    let staged = exe_dir.join(STAGED_NAME);
    let exe_s = exe.to_string_lossy().replace('"', "");
    let staged_s = staged.to_string_lossy().replace('"', "");
    // Write a .bat file to %TEMP% so cmd.exe doesn't mangle paths with spaces
    // or parentheses when parsing the /C command line.  CR+LF for Windows compat.
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut h = DefaultHasher::new();
    exe_s.hash(&mut h);
    let bat = std::env::temp_dir().join(format!("pccare_update_{:x}.bat", h.finish()));
    let script = format!(
        "@echo off\r\n\
         :retry\r\n\
         move /Y \"{staged_s}\" \"{exe_s}\" 2>nul\r\n\
         if errorlevel 1 (\r\n\
           ping 127.0.0.1 -n 3 > nul\r\n\
           goto retry\r\n\
         )\r\n\
         powershell -NoProfile -Command \"Unblock-File -Path '{exe_s}' -ErrorAction SilentlyContinue\" 2>nul\r\n\
         start \"\" \"{exe_s}\""
    );
    let _ = std::fs::write(&bat, script);
    bat
}

#[tauri::command]
pub async fn portable_update_apply(_app: AppHandle) -> Result<Value, String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let exe_dir = exe.parent().ok_or("Cannot determine exe directory")?;
    let staged = exe_dir.join(STAGED_NAME);
    if !staged.exists() {
        return Err("Chưa có file cập nhật đã tải. Hãy tải cập nhật trước.".to_string());
    }
    let bat = build_apply_script(&exe);
    let mut cmd = std::process::Command::new("cmd.exe");
    cmd.args(["/C", &bat.to_string_lossy()]);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }
    cmd.spawn()
        .map_err(|e| format!("Không khởi động được bộ áp dụng cập nhật: {e}"))?;

    // Give cmd.exe a moment to start, then hard-kill this process so the exe
    // file is unlocked immediately.  std::process::exit (not app.exit) ensures
    // the OS releases the file lock right away — the .bat retry-loop will then
    // succeed on its first attempt.
    tokio::time::sleep(std::time::Duration::from_millis(200)).await;
    std::process::exit(0);
}

pub fn cleanup_stale_update() {
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let _ = std::fs::remove_file(dir.join(STAGED_NAME));
        }
    }
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
        let exe = std::path::Path::new(r"C:\Apps\pccare-master-pro.exe");
        let bat = build_apply_script(exe);
        let script = std::fs::read_to_string(&bat).unwrap();
        assert!(
            script.contains(r#"move /Y "C:\Apps\pccare-update.exe" "C:\Apps\pccare-master-pro.exe""#),
            "script should swap pccare-update.exe over the exe: {script}"
        );
        assert!(script.contains(r#"start "" "C:\Apps\pccare-master-pro.exe""#), "script should relaunch: {script}");
        assert!(script.contains(":retry"), "script should have retry loop: {script}");
        assert!(script.contains("goto retry"), "script should loop back on failure: {script}");
        let _ = std::fs::remove_file(&bat);
    }

    #[test]
    fn apply_script_strips_quotes_from_paths() {
        let exe = std::path::Path::new(r#"C:\Apps "folder"\exe"#);
        let bat = build_apply_script(exe);
        let script = std::fs::read_to_string(&bat).unwrap();
        assert!(!script.contains("folder\"exe"), "embedded quote must be stripped: {script}");
        let _ = std::fs::remove_file(&bat);
    }
}
