use std::fs;
use std::path::PathBuf;
use ring::rand::SystemRandom;
use ring::signature::{self, KeyPair};
use base64::prelude::*;
use serde::{Deserialize, Serialize};

// ── Revocation List Types ─────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RevokedEntry {
    pub id: String,
    pub customer: String,
    pub revoked_at: String,
    pub reason: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RevocationList {
    pub version: u32,
    pub updated_at: String,
    pub revoked: Vec<RevokedEntry>,
    pub signature: String,
}

/// Canonical string for signing the revocation list:
/// "version=1&updated_at=...&revoked_count=N&ids=ID1,ID2,..." (IDs sorted ascending)
pub fn canonical_revocation_bytes(version: u32, updated_at: &str, ids: &[String]) -> Vec<u8> {
    let mut sorted_ids = ids.to_vec();
    sorted_ids.sort();
    let ids_str = sorted_ids.join(",");
    format!(
        "version={}&updated_at={}&revoked_count={}&ids={}",
        version, updated_at.trim(), ids.len(), ids_str
    ).into_bytes()
}

/// Sign a revocation list with the Ed25519 private key. Returns the updated list with new signature.
fn sign_revocation_list(list: &mut RevocationList, key_pair: &signature::Ed25519KeyPair) {
    let ids: Vec<String> = list.revoked.iter().map(|e| e.id.clone()).collect();
    let msg = canonical_revocation_bytes(list.version, &list.updated_at, &ids);
    let sig = key_pair.sign(&msg);
    list.signature = BASE64_STANDARD.encode(sig.as_ref());
}

/// Load the revoked.json from the repo root (next to revocation/revoked.json)
fn get_revocation_file_path() -> PathBuf {
    // Try next to exe, then src-tauri, then repo root
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let candidate = exe_dir.join("revocation").join("revoked.json");
            if candidate.exists() { return candidate; }
        }
    }
    let repo_root = get_repo_root();
    repo_root.join("revocation").join("revoked.json")
}

/// Load existing revocation list or create a new empty one
fn load_or_create_revocation_list() -> RevocationList {
    let path = get_revocation_file_path();
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(list) = serde_json::from_str::<RevocationList>(&content) {
                return list;
            }
        }
    }
    RevocationList {
        version: 1,
        updated_at: chrono_or_fallback_timestamp(),
        revoked: Vec::new(),
        signature: String::new(),
    }
}

// ── Key History & GitHub Secret Gist Sync ─────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyHistoryEntry {
    pub id: String,
    pub customer: String,
    pub cdkey: String,
    pub issued_at: String,
    pub platform: String,
    #[serde(default)]
    pub notes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LicGenConfig {
    #[serde(default)]
    pub github_token: String,
    #[serde(default)]
    pub gist_id: String,
}

fn get_config_path() -> PathBuf {
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let next_to_exe = exe_dir.join("licgen_config.json");
            if next_to_exe.exists() {
                return next_to_exe;
            }
        }
    }
    let repo_root = get_repo_root();
    let repo_config = repo_root.join("licgen_config.json");
    if repo_config.exists() {
        return repo_config;
    }
    if let Ok(appdata) = std::env::var("APPDATA") {
        let tp_dir = PathBuf::from(appdata).join("ThienPhatTech");
        let _ = fs::create_dir_all(&tp_dir);
        let appdata_config = tp_dir.join("licgen_config.json");
        if appdata_config.exists() {
            return appdata_config;
        }
    }
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            return exe_dir.join("licgen_config.json");
        }
    }
    repo_config
}

fn load_config() -> LicGenConfig {
    let path = get_config_path();
    let mut config = if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            serde_json::from_str::<LicGenConfig>(&content).unwrap_or_default()
        } else {
            LicGenConfig::default()
        }
    } else {
        LicGenConfig::default()
    };

    if let Ok(token) = std::env::var("GITHUB_GIST_TOKEN").or_else(|_| std::env::var("GITHUB_TOKEN")) {
        if !token.trim().is_empty() {
            config.github_token = token.trim().to_string();
        }
    }
    if let Ok(gid) = std::env::var("GITHUB_GIST_ID") {
        if !gid.trim().is_empty() {
            config.gist_id = gid.trim().to_string();
        }
    }

    let env_local = get_repo_root().join(".env.local");
    if env_local.exists() {
        if let Ok(content) = fs::read_to_string(&env_local) {
            for line in content.lines() {
                let trimmed = line.trim();
                if trimmed.starts_with('#') || trimmed.is_empty() {
                    continue;
                }
                if let Some((k, v)) = trimmed.split_once('=') {
                    let key = k.trim().to_uppercase();
                    let val = v.trim().trim_matches(&['"', '\''][..]);
                    if (key == "GITHUB_GIST_TOKEN" || key == "GITHUB_TOKEN") && config.github_token.is_empty() {
                        config.github_token = val.to_string();
                    }
                    if key == "GITHUB_GIST_ID" && config.gist_id.is_empty() {
                        config.gist_id = val.to_string();
                    }
                }
            }
        }
    }

    config
}

fn save_config(config: &LicGenConfig) -> Result<(), Box<dyn std::error::Error>> {
    let path = get_config_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let json = serde_json::to_string_pretty(config)?;
    fs::write(&path, json.as_bytes())?;
    Ok(())
}

fn get_local_history_path() -> PathBuf {
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let next_to_exe = exe_dir.join("history_keys.json");
            if next_to_exe.exists() {
                return next_to_exe;
            }
        }
    }
    let repo_root = get_repo_root();
    let repo_hist = repo_root.join("history_keys.json");
    if repo_hist.exists() {
        return repo_hist;
    }
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            return exe_dir.join("history_keys.json");
        }
    }
    repo_hist
}

fn load_local_history() -> Vec<KeyHistoryEntry> {
    let path = get_local_history_path();
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(entries) = serde_json::from_str::<Vec<KeyHistoryEntry>>(&content) {
                return entries;
            }
        }
    }
    Vec::new()
}

fn save_local_history(entries: &[KeyHistoryEntry]) {
    let path = get_local_history_path();
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Ok(json) = serde_json::to_string_pretty(entries) {
        let _ = fs::write(&path, json.as_bytes());
    }
}

fn ensure_crypto_provider() {
    let _ = rustls::crypto::ring::default_provider().install_default();
}

fn fetch_gist_history(token: &str, gist_id: &str) -> Result<Vec<KeyHistoryEntry>, String> {
    ensure_crypto_provider();
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(6))
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!("https://api.github.com/gists/{}", gist_id.trim());
    let resp = client.get(&url)
        .header("Authorization", format!("Bearer {}", token.trim()))
        .header("User-Agent", "PCCare-LicGen")
        .header("Accept", "application/vnd.github+json")
        .send()
        .map_err(|e| format!("Lỗi kết nối GitHub API: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().unwrap_or_default();
        return Err(format!("GitHub API trả về mã lỗi {}: {}", status, body));
    }

    let val: serde_json::Value = resp.json().map_err(|e| e.to_string())?;
    if let Some(file_obj) = val.get("files").and_then(|f| f.get("history_keys.json")) {
        if let Some(content) = file_obj.get("content").and_then(|c| c.as_str()) {
            let entries: Vec<KeyHistoryEntry> = serde_json::from_str(content)
                .unwrap_or_default();
            return Ok(entries);
        }
    }

    Ok(Vec::new())
}

fn save_gist_history(token: &str, gist_id: &str, entries: &[KeyHistoryEntry]) -> Result<(), String> {
    ensure_crypto_provider();
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(8))
        .build()
        .map_err(|e| e.to_string())?;

    let content = serde_json::to_string_pretty(entries).map_err(|e| e.to_string())?;
    let body = serde_json::json!({
        "description": "PCCareMasterPro Key History (Private)",
        "files": {
            "history_keys.json": {
                "content": content
            }
        }
    });

    let url = format!("https://api.github.com/gists/{}", gist_id.trim());
    let resp = client.patch(&url)
        .header("Authorization", format!("Bearer {}", token.trim()))
        .header("User-Agent", "PCCare-LicGen")
        .header("Accept", "application/vnd.github+json")
        .json(&body)
        .send()
        .map_err(|e| format!("Lỗi gửi cập nhật Gist: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().unwrap_or_default();
        return Err(format!("GitHub API cập nhật Gist thất bại (mã {}): {}", status, body));
    }

    Ok(())
}

fn create_secret_gist(token: &str) -> Result<String, String> {
    ensure_crypto_provider();
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(8))
        .build()
        .map_err(|e| e.to_string())?;

    let body = serde_json::json!({
        "description": "PCCareMasterPro Key History (Private)",
        "public": false,
        "files": {
            "history_keys.json": {
                "content": "[]"
            }
        }
    });

    let resp = client.post("https://api.github.com/gists")
        .header("Authorization", format!("Bearer {}", token.trim()))
        .header("User-Agent", "PCCare-LicGen")
        .header("Accept", "application/vnd.github+json")
        .json(&body)
        .send()
        .map_err(|e| format!("Lỗi gửi yêu cầu tạo Gist: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().unwrap_or_default();
        return Err(format!("Không thể tạo Secret Gist (mã {}): {}", status, text));
    }

    let val: serde_json::Value = resp.json().map_err(|e| e.to_string())?;
    let id = val.get("id").and_then(|i| i.as_str()).ok_or("Không nhận được Gist ID từ GitHub")?;
    Ok(id.to_string())
}

fn record_key_entry(entry: KeyHistoryEntry) {
    let mut local = load_local_history();
    if !local.iter().any(|e| e.id.eq_ignore_ascii_case(&entry.id)) {
        local.push(entry.clone());
        save_local_history(&local);
    }

    let config = load_config();
    if !config.github_token.is_empty() && !config.gist_id.is_empty() {
        match fetch_gist_history(&config.github_token, &config.gist_id) {
            Ok(mut remote) => {
                if !remote.iter().any(|e| e.id.eq_ignore_ascii_case(&entry.id)) {
                    remote.push(entry);
                    if let Err(e) = save_gist_history(&config.github_token, &config.gist_id, &remote) {
                        eprintln!(" [!] Cảnh báo Cloud Sync: {}", e);
                    } else {
                        println!(" [CLOUD] Đã tự động đồng bộ lịch sử lên GitHub Secret Gist thành công!");
                    }
                }
            }
            Err(e) => {
                eprintln!(" [!] Cảnh báo Cloud Sync: {}", e);
            }
        }
    } else {
        println!(" [LƯU Ý] Chưa cấu hình Cloud Sync. Dùng lệnh 'licgen setup-cloud --token <TOKEN>' để đồng bộ đám mây.");
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LicensePayload {
    pub product: String,
    pub customer: String,
    pub issued_at: String,
    pub license_id: String,
    pub license_type: String,
    #[serde(default)]
    pub notes: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SignedLicense {
    pub payload: LicensePayload,
    pub signature: String,
}

pub fn canonical_bytes(payload: &LicensePayload) -> Vec<u8> {
    format!(
        "product={}&customer={}&issued_at={}&license_id={}&license_type={}",
        payload.product.trim(),
        payload.customer.trim(),
        payload.issued_at.trim(),
        payload.license_id.trim(),
        payload.license_type.trim()
    ).into_bytes()
}

fn get_repo_root() -> PathBuf {
    let dir = std::env::current_dir().unwrap_or_default();
    if dir.ends_with("src-tauri") {
        if let Some(parent) = dir.parent() {
            return parent.to_path_buf();
        }
    }
    dir
}

fn get_key_path() -> PathBuf {
    if let Ok(p) = std::env::var("LICENSE_SIGNING_KEY_PATH") {
        if !p.trim().is_empty() {
            let pb = PathBuf::from(p.trim());
            if pb.exists() {
                return pb;
            }
        }
    }
    // Check next to current exe
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let next_to_exe = exe_dir.join("license-signing.key");
            if next_to_exe.exists() {
                return next_to_exe;
            }
        }
    }
    // Check current working directory
    let cwd_key = std::env::current_dir().unwrap_or_default().join("license-signing.key");
    if cwd_key.exists() {
        return cwd_key;
    }
    // Check .env.local
    let env_local = get_repo_root().join(".env.local");
    if env_local.exists() {
        if let Ok(content) = fs::read_to_string(&env_local) {
            for line in content.lines() {
                let trimmed = line.trim();
                if trimmed.starts_with('#') || trimmed.is_empty() {
                    continue;
                }
                if let Some((k, v)) = trimmed.split_once('=') {
                    if k.trim().eq_ignore_ascii_case("LICENSE_SIGNING_KEY_PATH") {
                        let path_str = v.trim();
                        if !path_str.is_empty() {
                            let p = PathBuf::from(path_str);
                            if p.is_absolute() && p.exists() {
                                return p;
                            } else {
                                let resolved = get_repo_root().join("src-tauri").join(p);
                                if resolved.exists() {
                                    return resolved;
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    // Location in src-tauri
    let in_src_tauri = get_repo_root().join("src-tauri").join("license-signing.key");
    if in_src_tauri.exists() {
        return in_src_tauri;
    }
    // Fallback: next to current exe
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            return exe_dir.join("license-signing.key");
        }
    }
    in_src_tauri
}

fn generate_keypair() -> Result<(), Box<dyn std::error::Error>> {
    let key_path = get_key_path();
    let pub_path = key_path.with_extension("pub");

    if key_path.exists() {
        eprintln!("[WARN] File private key da ton tai: {}", key_path.display());
        eprintln!("[WARN] Neu muon tao lai key moi, hay xoa hoac doi ten file cu.");
        return Ok(());
    }

    let rng = SystemRandom::new();
    let pkcs8_bytes = signature::Ed25519KeyPair::generate_pkcs8(&rng)
        .map_err(|e| format!("Lỗi tạo khóa Ed25519: {:?}", e))?;
    let key_pair = signature::Ed25519KeyPair::from_pkcs8(pkcs8_bytes.as_ref())
        .map_err(|e| format!("Lỗi phân tích khóa PKCS#8: {:?}", e))?;

    // Save private key (PKCS#8 DER)
    if let Some(parent) = key_path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(&key_path, pkcs8_bytes.as_ref())?;

    // Save public key as Base64
    let pub_base64 = BASE64_STANDARD.encode(key_pair.public_key().as_ref());
    fs::write(&pub_path, pub_base64.as_bytes())?;

    println!("[OK] Da tao cap khoa ky Ed25519 cho license:");
    println!("     Private key: {}", key_path.display());
    println!("     Public key:  {}", pub_path.display());
    println!("     Public key (Base64): {}", pub_base64);

    // Update .env.local if needed
    let env_local = get_repo_root().join(".env.local");
    if env_local.exists() {
        let content = fs::read_to_string(&env_local).unwrap_or_default();
        if !content.contains("LICENSE_SIGNING_KEY_PATH") {
            let append = format!("\n# ---- Offline License Signing Key (Ed25519) ----\nLICENSE_SIGNING_KEY_PATH={}\n", key_path.file_name().unwrap().to_string_lossy());
            let _ = fs::write(&env_local, format!("{}{}", content, append));
            println!("     Da cap nhat LICENSE_SIGNING_KEY_PATH vao .env.local");
        }
    }

    Ok(())
}

fn issue_license(customer: &str, out_path: Option<&str>, license_type: &str, notes: &str) -> Result<(), Box<dyn std::error::Error>> {
    let key_path = get_key_path();
    if !key_path.exists() {
        return Err(format!("Khong tim thay private key tai: {}\nChay lệnh `licgen generate-key` de tao khoa truoc.", key_path.display()).into());
    }

    let pkcs8_bytes = fs::read(&key_path)?;
    let key_pair = signature::Ed25519KeyPair::from_pkcs8(&pkcs8_bytes)
        .map_err(|e| format!("Lỗi phân tích khóa PKCS#8: {:?}", e))?;

    // Generate unique license ID
    let now = chrono_or_fallback_timestamp();
    let random_suffix: u32 = {
        use std::time::{SystemTime, UNIX_EPOCH};
        let d = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
        (d.as_millis() % 1000000) as u32
    };
    let license_id = format!("TP-LIC-{:06X}", random_suffix);

    let payload = LicensePayload {
        product: "PCCareMasterPro".to_string(),
        customer: customer.trim().to_string(),
        issued_at: now,
        license_id,
        license_type: license_type.to_string(),
        notes: notes.to_string(),
    };

    let msg = canonical_bytes(&payload);
    let sig = key_pair.sign(&msg);
    let sig_base64 = BASE64_STANDARD.encode(sig.as_ref());

    let signed = SignedLicense {
        payload,
        signature: sig_base64,
    };

    let json = serde_json::to_string_pretty(&signed)?;

    let target_out = match out_path {
        Some(p) => PathBuf::from(p),
        None => {
            let safe_name: String = customer.chars().filter(|c| c.is_alphanumeric() || *c == '_' || *c == '-').collect();
            let fname = if safe_name.is_empty() { "pccare.lic".to_string() } else { format!("{}_pccare.lic", safe_name) };
            get_repo_root().join(fname)
        }
    };

    if let Some(parent) = target_out.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(&target_out, json)?;

    println!("[OK] Da xuat file license da ky thanh cong!");
    println!("     Khach hang:  {}", customer);
    println!("     File xuat:   {}", target_out.display());
    println!("     Ma ban quyen: {}", signed.payload.license_id);
    println!("     Ngay cap:    {}", signed.payload.issued_at);

    let lic_entry = KeyHistoryEntry {
        id: signed.payload.license_id.clone(),
        customer: signed.payload.customer.clone(),
        cdkey: "File .lic".to_string(),
        issued_at: signed.payload.issued_at.clone(),
        platform: "PC".to_string(),
        notes: notes.to_string(),
    };
    record_key_entry(lic_entry);

    Ok(())
}

fn chrono_or_fallback_timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs();
    // Format YYYY-MM-DDTHH:MM:SSZ
    let days = now / 86400;
    let rem_secs = now % 86400;
    let hours = rem_secs / 3600;
    let mins = (rem_secs % 3600) / 60;
    let secs = rem_secs % 60;

    // Approximate UTC calendar date
    let mut year = 1970;
    let mut day_count = days;
    loop {
        let leap = if (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0) { 1 } else { 0 };
        let days_in_year = 365 + leap;
        if day_count < days_in_year {
            let month_days = [31, 28 + leap, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
            let mut month = 1;
            for &md in &month_days {
                if day_count < md {
                    let day = day_count + 1;
                    return format!("{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z", year, month, day, hours, mins, secs);
                }
                day_count -= md;
                month += 1;
            }
            break;
        }
        day_count -= days_in_year;
        year += 1;
    }
    format!("2026-09-06T12:00:00Z")
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CdKeyPayload {
    pub c: String, // customer
    pub d: String, // issued_at
    pub i: String, // license_id
    pub s: String, // signature (Base64)
}

fn copy_to_clipboard(text: &str) {
    if let Ok(mut child) = std::process::Command::new("clip")
        .stdin(std::process::Stdio::piped())
        .spawn()
    {
        if let Some(mut stdin) = child.stdin.take() {
            use std::io::Write;
            let _ = stdin.write_all(text.as_bytes());
        }
        let _ = child.wait();
    }
}

fn pause() {
    println!("\nBấm phím Enter để tiếp tục / thoát...");
    let mut buf = String::new();
    let _ = std::io::stdin().read_line(&mut buf);
}

fn generate_cdkey(customer: &str) -> Result<String, Box<dyn std::error::Error>> {
    let key_path = get_key_path();
    if !key_path.exists() {
        return Err(format!("Không tìm thấy private key tại: {}\nHãy chạy lệnh tạo khóa trước.", key_path.display()).into());
    }

    let pkcs8_bytes = fs::read(&key_path)?;
    let key_pair = signature::Ed25519KeyPair::from_pkcs8(&pkcs8_bytes)
        .map_err(|e| format!("Lỗi phân tích khóa PKCS#8: {:?}", e))?;

    let now = chrono_or_fallback_timestamp();
    let random_suffix: u32 = {
        use std::time::{SystemTime, UNIX_EPOCH};
        let d = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
        (d.as_millis() % 1000000) as u32
    };
    let license_id = format!("TP-LIC-{:06X}", random_suffix);

    let payload = LicensePayload {
        product: "PCCareMasterPro".to_string(),
        customer: customer.trim().to_string(),
        issued_at: now,
        license_id,
        license_type: "lifetime".to_string(),
        notes: "Kích hoạt bằng CDKey".to_string(),
    };

    let msg = canonical_bytes(&payload);
    let sig = key_pair.sign(&msg);
    let sig_base64 = BASE64_STANDARD.encode(sig.as_ref());

    let cdkey_data = CdKeyPayload {
        c: payload.customer,
        d: payload.issued_at,
        i: payload.license_id,
        s: sig_base64,
    };

    let json_bytes = serde_json::to_vec(&cdkey_data)?;
    let token = BASE64_URL_SAFE_NO_PAD.encode(&json_bytes);
    let full_cdkey = format!("TPPRO-{}", token);

    let history_entry = KeyHistoryEntry {
        id: cdkey_data.i.clone(),
        customer: cdkey_data.c.clone(),
        cdkey: full_cdkey.clone(),
        issued_at: cdkey_data.d.clone(),
        platform: "PC".to_string(),
        notes: "Kích hoạt bằng CDKey".to_string(),
    };
    record_key_entry(history_entry);

    Ok(full_cdkey)
}

fn run_interactive_mode() -> Result<(), Box<dyn std::error::Error>> {
    use std::io::Write;
    loop {
        println!("========================================================================");
        println!("     PCCARE MASTER PRO - CÔNG CỤ TẠO MÃ CDKEY BẢN QUYỀN (OFFLINE)      ");
        println!("========================================================================");
        println!();
        print!(" Nhập Tên Khách Hàng (hoặc Tên Công Ty): ");
        std::io::stdout().flush()?;
        let mut customer = String::new();
        std::io::stdin().read_line(&mut customer)?;
        let customer = customer.trim();
        if customer.is_empty() {
            println!(" [!] Tên khách hàng không được để trống!");
            pause();
            return Ok(());
        }

        let cdkey = match generate_cdkey(customer) {
            Ok(k) => k,
            Err(e) => {
                eprintln!("\n[LỖI] Không thể tạo CDKey: {}", e);
                pause();
                return Ok(());
            }
        };

        println!();
        println!("------------------------------------------------------------------------");
        println!(" MÃ CDKEY KÍCH HOẠT CHO KHÁCH HÀNG: [{}]", customer);
        println!();
        println!(" {}", cdkey);
        println!();
        println!("------------------------------------------------------------------------");

        copy_to_clipboard(&cdkey);
        println!(" => [THÀNH CÔNG] ĐÃ TỰ ĐỘNG COPY MÃ CDKEY VÀO CLIPBOARD CỦA BẠN!");
        println!("    Bạn chỉ cần mở Zalo / Tin nhắn và bấm Ctrl + V để gửi cho khách.");
        println!();

        print!(" Bạn có muốn tạo tiếp mã CDKey cho khách khác? (y/n) [n]: ");
        std::io::stdout().flush()?;
        let mut answer = String::new();
        std::io::stdin().read_line(&mut answer)?;
        if !answer.trim().eq_ignore_ascii_case("y") {
            break;
        }
        println!("\n");
    }
    pause();
    Ok(())
}

fn revoke_license(license_id: &str, customer: &str, reason: &str, auto_push: bool) -> Result<(), Box<dyn std::error::Error>> {
    let key_path = get_key_path();
    if !key_path.exists() {
        return Err(format!("Không tìm thấy private key tại: {}\nHãy chạy lệnh tạo khóa trước.", key_path.display()).into());
    }
    let pkcs8_bytes = fs::read(&key_path)?;
    let key_pair = signature::Ed25519KeyPair::from_pkcs8(&pkcs8_bytes)
        .map_err(|e| format!("Lỗi phân tích khóa PKCS#8: {:?}", e))?;

    let mut list = load_or_create_revocation_list();

    // Check if already revoked
    if list.revoked.iter().any(|e| e.id.eq_ignore_ascii_case(license_id)) {
        println!("[!] Mã {} đã có trong danh sách thu hồi trước đó.", license_id);
        return Ok(());
    }

    let now = chrono_or_fallback_timestamp();
    list.revoked.push(RevokedEntry {
        id: license_id.trim().to_uppercase(),
        customer: customer.trim().to_string(),
        revoked_at: now.clone(),
        reason: if reason.trim().is_empty() { "Không có lý do cụ thể.".to_string() } else { reason.trim().to_string() },
    });
    list.updated_at = now;

    // Re-sign the whole list
    sign_revocation_list(&mut list, &key_pair);

    // Write to file
    let revocation_path = get_revocation_file_path();
    if let Some(parent) = revocation_path.parent() {
        fs::create_dir_all(parent)?;
    }
    let json = serde_json::to_string_pretty(&list)?;
    fs::write(&revocation_path, json.as_bytes())?;

    println!("[OK] Đã thu hồi mã bản quyền thành công!");
    println!("     Mã bị thu hồi:  {}", license_id);
    println!("     Khách hàng:      {}", customer);
    println!("     Lý do:           {}", reason);
    println!("     Tổng thu hồi:    {} mã", list.revoked.len());
    println!("     File:            {}", revocation_path.display());

    if auto_push {
        println!();
        println!("[GIT] Đang đẩy danh sách thu hồi lên GitHub...");
        let repo_root = get_repo_root();
        let _ = std::process::Command::new("git")
            .args(["add", "revocation/revoked.json"])
            .current_dir(&repo_root)
            .output();
        let commit_msg = format!("revoke: thu hồi {} ({})", license_id, customer);
        let _ = std::process::Command::new("git")
            .args(["commit", "-m", &commit_msg])
            .current_dir(&repo_root)
            .output();
        let push_out = std::process::Command::new("git")
            .args(["push", "origin", "master"])
            .current_dir(&repo_root)
            .output();
        match push_out {
            Ok(p) if p.status.success() => {
                println!("[GIT] Push lên GitHub thành công!");
            }
            Ok(p) => {
                eprintln!("[GIT] Push thất bại: {}", String::from_utf8_lossy(&p.stderr));
            }
            Err(e) => {
                eprintln!("[GIT] Không thể chạy git: {}. Hãy tự push thủ công.", e);
            }
        }
    } else {
        println!();
        println!("[NEXT] Để áp dụng thu hồi lên GitHub, hãy chạy:");
        println!("       git add revocation/revoked.json");
        println!("       git commit -m \"revoke: {}\"", license_id);
        println!("       git push origin master");
    }

    Ok(())
}

fn cmd_setup_cloud(token: &str, gist_id_opt: Option<&str>) -> Result<(), Box<dyn std::error::Error>> {
    let token = token.trim();
    if token.is_empty() {
        return Err("GitHub Token không được để trống! Cú pháp: licgen setup-cloud --token ghp_...".into());
    }

    println!(" Đang kiểm tra kết nối tới GitHub API...");
    ensure_crypto_provider();
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(8))
        .build()?;

    let user_resp = client.get("https://api.github.com/user")
        .header("Authorization", format!("Bearer {}", token))
        .header("User-Agent", "PCCare-LicGen")
        .header("Accept", "application/vnd.github+json")
        .send()?;

    if !user_resp.status().is_success() {
        return Err(format!("Token không hợp lệ hoặc đã hết hạn (Mã lỗi {}). Vui lòng kiểm tra lại Token.", user_resp.status()).into());
    }
    let user_data: serde_json::Value = user_resp.json()?;
    let username = user_data.get("login").and_then(|u| u.as_str()).unwrap_or("User");
    println!("[OK] Đăng nhập GitHub thành công với tài khoản: {}", username);

    let gist_id = match gist_id_opt {
        Some(id) if !id.trim().is_empty() => {
            let id = id.trim().to_string();
            println!(" Đang kiểm tra Gist ID '{}'...", id);
            let _ = fetch_gist_history(token, &id)?;
            println!("[OK] Đã kết nối với Gist thành công!");
            id
        }
        _ => {
            println!(" Đang tự động tạo Secret Gist mới trên tài khoản '{}'...", username);
            let id = create_secret_gist(token)?;
            println!("[OK] Đã tạo Secret Gist mới thành công!");
            id
        }
    };

    let mut config = load_config();
    config.github_token = token.to_string();
    config.gist_id = gist_id.clone();
    save_config(&config)?;

    println!("\n========================================================================");
    println!(" [THÀNH CÔNG] ĐÃ CẤU HÌNH CLOUD SYNC CHO LICGEN!");
    println!(" Tài khoản:  {}", username);
    println!(" Gist ID:    {}", gist_id);
    println!(" Gist URL:   https://gist.github.com/{}/{}", username, gist_id);
    println!(" Cấu hình:   {}", get_config_path().display());
    println!(" (Gợi ý: Sao chép Gist ID trên để dán vào cài đặt trên App Android!)");
    println!("========================================================================");

    Ok(())
}

fn cmd_list_keys() -> Result<(), Box<dyn std::error::Error>> {
    use std::io::Write;
    let config = load_config();

    let (entries, source) = if !config.github_token.is_empty() && !config.gist_id.is_empty() {
        print!(" Đang tải danh sách từ GitHub Secret Gist... ");
        let _ = std::io::stdout().flush();
        match fetch_gist_history(&config.github_token, &config.gist_id) {
            Ok(rem) => {
                println!("[OK]");
                (rem, "GitHub Cloud Secret Gist")
            }
            Err(e) => {
                println!("[!] Lỗi tải Cloud ({}), chuyển sang đọc file cục bộ.", e);
                (load_local_history(), "Cục bộ (history_keys.json)")
            }
        }
    } else {
        (load_local_history(), "Cục bộ (history_keys.json)")
    };

    println!("\n===============================================================================================");
    println!("                  DANH SÁCH BẢN QUYỀN ĐÃ CẤP (Nguồn: {})", source);
    println!("===============================================================================================");
    if entries.is_empty() {
        println!(" (Chưa có mã bản quyền nào được ghi nhận).");
        return Ok(());
    }

    println!("{:<4} | {:<15} | {:<25} | {:<22} | {:<10}", "STT", "Mã License ID", "Khách hàng", "Thời gian cấp", "Nền tảng");
    println!("{:-<4}-+-{:-<15}-+-{:-<25}-+-{:-<22}-+-{:-<10}", "", "", "", "", "");
    for (i, e) in entries.iter().enumerate() {
        println!("{:<4} | {:<15} | {:<25} | {:<22} | {:<10}", i + 1, e.id, e.customer, e.issued_at, e.platform);
    }
    println!("{:-<4}-+-{:-<15}-+-{:-<25}-+-{:-<22}-+-{:-<10}", "", "", "", "", "");
    println!(" Tổng cộng: {} key đã tạo.\n", entries.len());

    Ok(())
}

fn print_usage() {
    println!("=== PCCareMasterPro License Generator (Internal Tool) ===");
    println!("Cách dùng:");
    println!("  Nhấp đúp chuột (Double-click): Mở giao diện tương tác tạo CDKey tự động.");
    println!();
    println!("  licgen cdkey --customer \"<Tên Khách Hàng>\"");
    println!("      Tạo và in mã CDKey trực tiếp ra màn hình và copy vào Clipboard.");
    println!();
    println!("  licgen issue --customer \"<Tên Khách Hàng>\" [--out <path.lic>]");
    println!("      Xuất file license .lic truyền thống.");
    println!();
    println!("  licgen list");
    println!("      Xem danh sách các mã CDKey đã cấp (từ GitHub Gist hoặc file cục bộ).");
    println!();
    println!("  licgen setup-cloud --token \"<ghp_...>\" [--gist \"<gist_id>\"]");
    println!("      Kết nối GitHub Secret Gist để tự động đồng bộ lịch sử tạo key.");
    println!();
    println!("  licgen revoke --id <TP-LIC-XXXXXX> --customer \"<Tên>\" [--reason \"Lý do\"] [--push]");
    println!("      Thu hồi một mã bản quyền, ký số danh sách, và tùy chọn push lên GitHub.");
    println!();
    println!("  licgen generate-key");
    println!("      Tạo cặp khóa ký mới (Ed25519) lưu vào license-signing.key");
    println!();
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 2 {
        if let Err(e) = run_interactive_mode() {
            eprintln!("\n[LỖI] Đã xảy ra sự cố: {}", e);
            pause();
        }
        return Ok(());
    }

    match args[1].as_str() {
        "generate-key" => {
            generate_keypair()?;
        }
        "cdkey" => {
            let mut customer = String::new();
            let mut i = 2;
            while i < args.len() {
                match args[i].as_str() {
                    "--customer" | "-c" => {
                        let mut words = Vec::new();
                        i += 1;
                        while i < args.len() && !args[i].starts_with('-') {
                            words.push(args[i].clone());
                            i += 1;
                        }
                        customer = words.join(" ").trim_matches(&['"', '\''][..]).to_string();
                        continue;
                    }
                    _ => {}
                }
                i += 1;
            }

            if customer.trim().is_empty() {
                eprintln!("[ERROR] Thiếu tên khách hàng. Cú pháp: licgen cdkey --customer \"Nguyen Van A\"");
                std::process::exit(1);
            }

            let cdkey = generate_cdkey(&customer)?;
            copy_to_clipboard(&cdkey);
            println!("{}", cdkey);
        }
        "issue" => {
            let mut customer = String::new();
            let mut out_path = None;
            let mut license_type = "lifetime".to_string();
            let mut notes = "Mua đứt vĩnh viễn".to_string();

            let mut i = 2;
            while i < args.len() {
                match args[i].as_str() {
                    "--customer" | "-c" => {
                        let mut words = Vec::new();
                        i += 1;
                        while i < args.len() && !args[i].starts_with('-') {
                            words.push(args[i].clone());
                            i += 1;
                        }
                        customer = words.join(" ").trim_matches(&['"', '\''][..]).to_string();
                        continue;
                    }
                    "--out" | "-o" => {
                        if i + 1 < args.len() {
                            let p = args[i + 1].trim_matches(&['"', '\''][..]).to_string();
                            out_path = Some(p);
                            i += 2;
                            continue;
                        }
                    }
                    "--type" | "-t" => {
                        if i + 1 < args.len() {
                            license_type = args[i + 1].trim_matches(&['"', '\''][..]).to_string();
                            i += 2;
                            continue;
                        }
                    }
                    "--notes" | "-n" => {
                        let mut words = Vec::new();
                        i += 1;
                        while i < args.len() && !args[i].starts_with('-') {
                            words.push(args[i].clone());
                            i += 1;
                        }
                        notes = words.join(" ").trim_matches(&['"', '\''][..]).to_string();
                        continue;
                    }
                    _ => {}
                }
                i += 1;
            }

            if customer.trim().is_empty() {
                eprintln!("[ERROR] Thiếu tên khách hàng. Cú pháp: licgen issue --customer \"Nguyen Van A\"");
                std::process::exit(1);
            }

            issue_license(&customer, out_path.as_deref(), &license_type, &notes)?;
        }
        "revoke" => {
            let mut license_id = String::new();
            let mut customer = String::new();
            let mut reason = String::new();
            let mut auto_push = false;
            let mut i = 2;
            while i < args.len() {
                match args[i].as_str() {
                    "--id" | "-i" => {
                        if i + 1 < args.len() {
                            license_id = args[i + 1].trim_matches(&['"', '\''][..]).to_string();
                            i += 2;
                            continue;
                        }
                    }
                    "--customer" | "-c" => {
                        let mut words = Vec::new();
                        i += 1;
                        while i < args.len() && !args[i].starts_with('-') {
                            words.push(args[i].clone());
                            i += 1;
                        }
                        customer = words.join(" ").trim_matches(&['"', '\''][..]).to_string();
                        continue;
                    }
                    "--reason" | "-r" => {
                        let mut words = Vec::new();
                        i += 1;
                        while i < args.len() && !args[i].starts_with('-') {
                            words.push(args[i].clone());
                            i += 1;
                        }
                        reason = words.join(" ").trim_matches(&['"', '\''][..]).to_string();
                        continue;
                    }
                    "--push" => {
                        auto_push = true;
                    }
                    _ => {}
                }
                i += 1;
            }

            if license_id.trim().is_empty() {
                eprintln!("[ERROR] Thiếu mã license ID. Cú pháp: licgen revoke --id TP-LIC-XXXXXX --customer \"Tên\"");
                std::process::exit(1);
            }
            if customer.trim().is_empty() {
                eprintln!("[ERROR] Thiếu tên khách hàng. Cú pháp: licgen revoke --id TP-LIC-XXXXXX --customer \"Tên\"");
                std::process::exit(1);
            }

            revoke_license(&license_id, &customer, &reason, auto_push)?;
        }
        "list" => {
            cmd_list_keys()?;
        }
        "setup-cloud" => {
            let mut token = String::new();
            let mut gist_id = None;
            let mut i = 2;
            while i < args.len() {
                match args[i].as_str() {
                    "--token" | "-t" => {
                        if i + 1 < args.len() {
                            token = args[i + 1].trim_matches(&['"', '\''][..]).to_string();
                            i += 2;
                            continue;
                        }
                    }
                    "--gist" | "-g" => {
                        if i + 1 < args.len() {
                            let g = args[i + 1].trim_matches(&['"', '\''][..]).to_string();
                            gist_id = Some(g);
                            i += 2;
                            continue;
                        }
                    }
                    _ => {}
                }
                i += 1;
            }

            if token.trim().is_empty() {
                eprintln!("[ERROR] Thiếu GitHub Token. Cú pháp: licgen setup-cloud --token <ghp_...> [--gist <id>]");
                std::process::exit(1);
            }

            cmd_setup_cloud(&token, gist_id.as_deref())?;
        }
        _ => {
            print_usage();
        }
    }

    Ok(())
}
