use base64::Engine as _;
use serde_json::Value;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncWriteExt, BufWriter};

const DEFAULT_ENDPOINT: &str = "https://github.com/thangdggr0004-cpu/PCCarePro/releases/latest/download/latest.json";

// Tauri stores the minisign public key as base64(comment-line text) in tauri.conf.json;
// the plugin decodes it with base64 then passes the text to PublicKey::decode.
fn base64_to_string(s: &str) -> Result<String, String> {
    let raw = base64::engine::general_purpose::STANDARD
        .decode(s.trim())
        .map_err(|e| format!("Không giải mã được khóa/chữ ký: {e}"))?;
    String::from_utf8(raw).map_err(|e| format!("Dữ liệu khóa/chữ ký không hợp lệ: {e}"))
}

fn updater_config(app: &AppHandle) -> (String, String) {
    let updater = app
        .config()
        .plugins
        .0
        .get("updater")
        .cloned()
        .unwrap_or_else(|| Value::Object(Default::default()));
    let endpoint = updater["endpoints"]
        .as_array()
        .and_then(|a| a.first())
        .and_then(|v| v.as_str())
        .unwrap_or(DEFAULT_ENDPOINT)
        .to_string();
    let pubkey = updater["pubkey"].as_str().unwrap_or("").to_string();
    (endpoint, pubkey)
}

fn windows_target(manifest: &Value) -> Option<Value> {
    manifest.get("platforms")?.get("windows-x86_64").cloned()
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

/// Fetch latest manifest, download the portable executable, verify its minisign signature
/// with the configured pubkey, and stage it next to the running executable as `<exe>.next`.
/// Emits `portable-update-progress` during download and `portable-update-done` when staged.
#[tauri::command]
pub async fn portable_update_download(app: AppHandle) -> Result<Value, String> {
    let (endpoint, pubkey) = updater_config(&app);
    if pubkey.is_empty() {
        return Err("Chưa cấu hình public key cập nhật.".to_string());
    }

    let client = reqwest::Client::builder()
        .user_agent("PCCareMasterPro")
        .build()
        .map_err(|e| e.to_string())?;
    let manifest_bytes = client
        .get(&endpoint)
        .send()
        .await
        .map_err(|e| format!("Không truy cập được endpoint cập nhật: {e}"))?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .bytes()
        .await
        .map_err(|e| e.to_string())?;
    let manifest: Value = serde_json::from_slice(&manifest_bytes)
        .map_err(|e| format!("Manifest cập nhật không hợp lệ: {e}"))?;

    let target = windows_target(&manifest)
        .ok_or_else(|| "Không tìm thấy target windows-x86_64 trong manifest.".to_string())?;
    let latest_version = manifest["version"].as_str().unwrap_or("");
    let current_version = app.package_info().version.to_string();
    if !version_newer(latest_version, &current_version) {
        return Ok(serde_json::json!({ "hasUpdate": false, "message": "Bạn đang sử dụng phiên bản mới nhất." }));
    }
    let url = target["url"].as_str().ok_or("Thiếu URL tải xuống trong manifest.")?;
    let signature = target["signature"].as_str().ok_or("Thiếu chữ ký trong manifest.")?;

    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let staged = std::path::PathBuf::from(format!("{}.next", exe.to_string_lossy()));
    let _ = std::fs::remove_file(&staged);

    let mut resp = client
        .get(url)
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
            let _ = app.emit("portable-update-progress", serde_json::json!({ "percent": percent }));
        }
    }
    writer.flush().await.map_err(|e| e.to_string())?;
    drop(writer);

    let data = std::fs::read(&staged).map_err(|e| format!("Không đọc được file tải về: {e}"))?;

    let pub_key_text = base64_to_string(&pubkey)?;
    let public_key =
        minisign_verify::PublicKey::decode(&pub_key_text).map_err(|e| format!("Khóa công khai không hợp lệ: {e}"))?;
    let signature_text = base64_to_string(signature)?;
    let signature =
        minisign_verify::Signature::decode(&signature_text).map_err(|e| format!("Chữ ký không hợp lệ: {e}"))?;
    public_key
        .verify(&data, &signature, true)
        .map_err(|e| format!("Xác minh chữ ký thất bại: {e}"))?;

    let _ = app.emit("portable-update-done", serde_json::json!({ "staged": staged.to_string_lossy() }));
    Ok(serde_json::json!({
        "success": true,
        "hasUpdate": true,
        "version": latest_version,
        "staged": staged.to_string_lossy()
    }))
}

/// Spawn a detached helper that waits for the app to exit, then atomically replaces the
/// running executable with the staged `<exe>.next`, relaunches the app and terminates the
/// current process.
///
/// Crash/im-recovery safety: the swap is a single `move /Y` (MoveFileEx REPLACE_EXISTING on
/// the same volume — atomic at the file-system level). There is never a moment where the exe
/// is missing: an interruption BEFORE the move leaves the old exe untouched (still runnable)
/// plus a stale `.next`, which `cleanup_stale_update` removes on next launch; an interruption
/// DURING/after the move leaves either the old or the new exe — never a broken state.
#[tauri::command]
pub async fn portable_update_apply(app: AppHandle) -> Result<Value, String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let next = std::path::PathBuf::from(format!("{}.next", exe.to_string_lossy()));
    if !next.exists() {
        return Err("Chưa có file cập nhật đã tải. Hãy tải cập nhật trước.".to_string());
    }
    let exe_s = exe.to_string_lossy().replace('"', "");
    let next_s = next.to_string_lossy().replace('"', "");
    let script = format!(
        "ping 127.0.0.1 -n 16 > nul & move /Y \"{next_s}\" \"{exe_s}\" & start \"\" \"{exe_s}\""
    );
    let mut cmd = std::process::Command::new("cmd.exe");
    cmd.args(["/C", &script]);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    cmd.spawn().map_err(|e| format!("Không khởi động được bộ áp dụng cập nhật: {e}"))?;

    let _ = app.emit("portable-update-exiting", serde_json::json!({}));
    tokio::time::sleep(std::time::Duration::from_millis(400)).await;
    app.exit(0);
    Ok(serde_json::json!({ "success": true }))
}

/// Remove a stale staged update (`<exe>.next`) left over from an interrupted download/apply.
/// Called at app startup so an interrupted update can never trap the app: the previous
/// executable remains in place and the leftover staging file is simply discarded.
pub fn cleanup_stale_update() {
    if let Ok(exe) = std::env::current_exe() {
        let staged = std::path::PathBuf::from(format!("{}.next", exe.to_string_lossy()));
        let old = std::path::PathBuf::from(format!("{}.old", exe.to_string_lossy()));
        let _ = std::fs::remove_file(&staged);
        let _ = std::fs::remove_file(&old);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Manual sig-check against a real artifact.
    /// Requires: PCCARE_SIG_TEST_EXE, PCCARE_SIG_TEST_SIG (base64 string as in latest.json),
    /// PCCARE_SIG_TEST_PUBKEY (base64 config value from tauri.conf.json).
    #[test]
    fn verify_artifact_signature() {
        let exe = match std::env::var("PCCARE_SIG_TEST_EXE") {
            Ok(v) => v,
            Err(_) => return, // skip when not invoked manually
        };
        let sig = std::env::var("PCCARE_SIG_TEST_SIG").unwrap();
        let pubkey = std::env::var("PCCARE_SIG_TEST_PUBKEY").unwrap();
        let data = std::fs::read(&exe).expect("read artifact");
        let pub_key_text = base64_to_string(&pubkey).expect("pubkey base64");
        let public_key = minisign_verify::PublicKey::decode(&pub_key_text).expect("pubkey decode");
        let signature_text = base64_to_string(&sig).expect("sig base64");
        let signature = minisign_verify::Signature::decode(&signature_text).expect("sig decode");
        public_key
            .verify(&data, &signature, true)
            .expect("signature must verify");
    }
}