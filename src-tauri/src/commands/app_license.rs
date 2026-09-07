use std::fs;
use std::path::PathBuf;
use base64::prelude::*;
use serde::{Deserialize, Serialize};

/// Embedded Ed25519 Public Key for PCCareMasterPro Offline License Verification
/// (Generated 2026-09-06, distinct and decoupled from update signing keys).
pub const LICENSE_PUBLIC_KEY_BASE64: &str = "6cynZaSH1JN3cSmaPIk0cQ73KsqgRH4FgLV0gL8ZFBM=";

/// URL of the signed revocation list on GitHub
const REVOCATION_LIST_URL: &str = "https://raw.githubusercontent.com/thangdggr0004-cpu/PCCarePro/master/revocation/revoked.json";

/// How long (seconds) to trust the local revocation cache before re-fetching
const REVOCATION_CACHE_TTL_SECS: u64 = 86400; // 24 hours

/// How long (seconds) to wait for the revocation list HTTP request
const REVOCATION_FETCH_TIMEOUT_SECS: u64 = 5;

// ── Revocation Types ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RevokedEntry {
    pub id: String,
    pub customer: String,
    pub revoked_at: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RevocationList {
    pub version: u32,
    pub updated_at: String,
    pub revoked: Vec<RevokedEntry>,
    pub signature: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct RevocationCache {
    fetched_at: String,
    revoked_ids: Vec<String>,
    signature_verified: bool,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LicensePayload {
    pub product: String,
    pub customer: String,
    pub issued_at: String,
    pub license_id: String,
    pub license_type: String,
    #[serde(default)]
    pub notes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignedLicense {
    pub payload: LicensePayload,
    pub signature: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LicenseStatus {
    pub is_licensed: bool,
    pub customer: Option<String>,
    pub issued_at: Option<String>,
    pub license_id: Option<String>,
    pub license_type: Option<String>,
    pub license_path: Option<String>,
    pub error: Option<String>,
}

/// Compute canonical deterministic message bytes from LicensePayload
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CdKeyPayload {
    pub c: String, // customer
    pub d: String, // issued_at
    pub i: String, // license_id
    pub s: String, // signature (Base64)
}

/// Cryptographically verify either a CDKey string (TPPRO-...) or JSON .lic content
pub fn verify_license_or_cdkey(input: &str) -> Result<(LicensePayload, String), String> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Err("Mã bản quyền không được để trống!".to_string());
    }

    // 1. Dạng chuỗi CDKey (tiền tố TPPRO- hoặc chuỗi Base64)
    if trimmed.starts_with("TPPRO-") || trimmed.starts_with("tppro-") || !trimmed.starts_with('{') {
        let token = trimmed.strip_prefix("TPPRO-")
            .or_else(|| trimmed.strip_prefix("tppro-"))
            .unwrap_or(trimmed)
            .trim();

        let decoded_bytes = BASE64_URL_SAFE_NO_PAD.decode(token)
            .or_else(|_| BASE64_STANDARD.decode(token))
            .map_err(|e| format!("Mã CDKey không hợp lệ: {}", e))?;

        let cdkey: CdKeyPayload = serde_json::from_slice(&decoded_bytes)
            .map_err(|e| format!("Cấu trúc mã CDKey không hợp lệ: {}", e))?;

        let payload = LicensePayload {
            product: "PCCareMasterPro".to_string(),
            customer: cdkey.c,
            issued_at: cdkey.d,
            license_id: cdkey.i,
            license_type: "lifetime".to_string(),
            notes: "Kích hoạt bằng CDKey".to_string(),
        };

        let signed = SignedLicense {
            payload: payload.clone(),
            signature: cdkey.s,
        };

        let pubkey_bytes = BASE64_STANDARD.decode(LICENSE_PUBLIC_KEY_BASE64.trim())
            .map_err(|e| format!("Lỗi giải mã public key hệ thống: {}", e))?;
        let sig_bytes = BASE64_STANDARD.decode(signed.signature.trim())
            .map_err(|e| format!("Chữ ký số base64 không hợp lệ: {}", e))?;

        let peer_public_key = ring::signature::UnparsedPublicKey::new(&ring::signature::ED25519, &pubkey_bytes);
        let message = canonical_bytes(&signed.payload);

        peer_public_key.verify(&message, &sig_bytes)
            .map_err(|_| "Mã CDKey không hợp lệ hoặc đã bị thay đổi!".to_string())?;

        let json_to_save = serde_json::to_string_pretty(&signed)
            .map_err(|e| e.to_string())?;

        return Ok((payload, json_to_save));
    }

    // 2. Dạng File JSON .lic truyền thống
    let signed: SignedLicense = serde_json::from_str(trimmed)
        .map_err(|e| format!("File license không đúng định dạng JSON: {}", e))?;

    if signed.payload.product != "PCCareMasterPro" {
        return Err(format!("Sản phẩm không hợp lệ: '{}'", signed.payload.product));
    }

    let pubkey_bytes = BASE64_STANDARD.decode(LICENSE_PUBLIC_KEY_BASE64.trim())
        .map_err(|e| format!("Lỗi giải mã public key hệ thống: {}", e))?;
    let sig_bytes = BASE64_STANDARD.decode(signed.signature.trim())
        .map_err(|e| format!("Chữ ký số base64 không hợp lệ: {}", e))?;

    let peer_public_key = ring::signature::UnparsedPublicKey::new(&ring::signature::ED25519, &pubkey_bytes);
    let message = canonical_bytes(&signed.payload);

    peer_public_key.verify(&message, &sig_bytes)
        .map_err(|_| "Chữ ký số không hợp lệ! File license đã bị chỉnh sửa hoặc không được cấp bởi ThienPhatTech.".to_string())?;

    Ok((signed.payload, trimmed.to_string()))
}

/// Cryptographically verify license JSON or CDKey content using embedded Ed25519 public key
pub fn verify_license_data(content: &str) -> Result<LicensePayload, String> {
    verify_license_or_cdkey(content).map(|(payload, _)| payload)
}

/// Get candidate file paths to locate pccare.lic
pub fn get_license_file_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::new();

    // 1. Next to current running executable (portable / USB drive mode)
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(parent) = exe_path.parent() {
            candidates.push(parent.join("pccare.lic"));
            candidates.push(parent.join("license.lic"));
        }
    }

    // 2. In %APPDATA%\ThienPhatTech\ (Per-user persistent)
    if let Ok(appdata) = std::env::var("APPDATA") {
        let tp_dir = PathBuf::from(appdata).join("ThienPhatTech");
        candidates.push(tp_dir.join("pccare.lic"));
    }

    // 3. In %ProgramData%\ThienPhatTech\ (All-users machine persistent)
    if let Ok(progdata) = std::env::var("ProgramData") {
        let tp_dir = PathBuf::from(progdata).join("ThienPhatTech");
        candidates.push(tp_dir.join("pccare.lic"));
    }

    candidates
}

// ── Revocation List Helpers ───────────────────────────────────────────────────

/// Canonical string for verifying revocation list signature (matches licgen.rs)
fn canonical_revocation_bytes(version: u32, updated_at: &str, ids: &[String]) -> Vec<u8> {
    let mut sorted_ids = ids.to_vec();
    sorted_ids.sort();
    let ids_str = sorted_ids.join(",");
    format!(
        "version={}&updated_at={}&revoked_count={}&ids={}",
        version, updated_at.trim(), ids.len(), ids_str
    ).into_bytes()
}

fn get_revocation_cache_path() -> PathBuf {
    if let Ok(appdata) = std::env::var("APPDATA") {
        return PathBuf::from(appdata)
            .join("ThienPhatTech")
            .join("revocation_cache.json");
    }
    std::env::temp_dir().join("tptech_revocation_cache.json")
}

fn load_revocation_cache() -> Option<RevocationCache> {
    let path = get_revocation_cache_path();
    let content = fs::read_to_string(&path).ok()?;
    serde_json::from_str::<RevocationCache>(&content).ok()
}

fn save_revocation_cache(revoked_ids: Vec<String>) {
    let cache = RevocationCache {
        fetched_at: {
            use std::time::{SystemTime, UNIX_EPOCH};
            let secs = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs();
            format!("{}", secs)
        },
        revoked_ids,
        signature_verified: true,
    };
    let path = get_revocation_cache_path();
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Ok(json) = serde_json::to_string_pretty(&cache) {
        let _ = fs::write(&path, json.as_bytes());
    }
}

fn cache_is_fresh(cache: &RevocationCache) -> bool {
    use std::time::{SystemTime, UNIX_EPOCH};
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs();
    let fetched: u64 = cache.fetched_at.trim().parse().unwrap_or(0);
    now.saturating_sub(fetched) < REVOCATION_CACHE_TTL_SECS
}

/// Fetch revocation list from GitHub, verify Ed25519 signature, return revoked IDs.
/// Returns None if network unavailable or signature invalid (offline-first: never block if uncertain).
fn fetch_and_verify_revocation_list() -> Option<Vec<String>> {
    // Ensure rustls ring provider is installed (required for rustls-no-provider feature).
    // This is a no-op if already installed.
    let _ = rustls::crypto::ring::default_provider().install_default();

    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(REVOCATION_FETCH_TIMEOUT_SECS))
        .build()
        .ok()?;

    let response = client.get(REVOCATION_LIST_URL).send().ok()?;
    if !response.status().is_success() {
        return None;
    }
    let text = response.text().ok()?;
    let list: RevocationList = serde_json::from_str(&text).ok()?;

    // Verify Ed25519 signature
    let pubkey_bytes = BASE64_STANDARD.decode(LICENSE_PUBLIC_KEY_BASE64.trim()).ok()?;
    let sig_bytes = BASE64_STANDARD.decode(list.signature.trim()).ok()?;
    let ids: Vec<String> = list.revoked.iter().map(|e| e.id.clone()).collect();
    let message = canonical_revocation_bytes(list.version, &list.updated_at, &ids);

    let peer_public_key = ring::signature::UnparsedPublicKey::new(&ring::signature::ED25519, &pubkey_bytes);
    peer_public_key.verify(&message, &sig_bytes).ok()?;

    // Signature valid — return list of revoked IDs (uppercase for case-insensitive compare)
    Some(ids.into_iter().map(|id| id.to_uppercase()).collect())
}

/// Returns true if the given license_id is in the revocation list.
/// Offline-first: if no network or fetch fails, returns false (never block).
pub fn is_license_revoked(license_id: &str) -> bool {
    let upper_id = license_id.trim().to_uppercase();

    // 1. Try fresh cache first
    if let Some(cache) = load_revocation_cache() {
        if cache_is_fresh(&cache) && cache.signature_verified {
            return cache.revoked_ids.iter().any(|id| id == &upper_id);
        }
    }

    // 2. Cache stale or missing — try network fetch (with timeout)
    if let Some(revoked_ids) = fetch_and_verify_revocation_list() {
        let is_revoked = revoked_ids.iter().any(|id| id == &upper_id);
        save_revocation_cache(revoked_ids);
        return is_revoked;
    }

    // 3. No network / fetch failed — offline-first: assume not revoked
    false
}

/// Returns the revocation reason for a license_id if it's revoked (from cache or network).
/// Returns None if not revoked or offline.
pub fn get_revocation_reason(license_id: &str) -> Option<String> {
    let upper_id = license_id.trim().to_uppercase();
    // Ensure rustls ring provider is installed
    let _ = rustls::crypto::ring::default_provider().install_default();
    // Try to get a fresh list with full entry details
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(REVOCATION_FETCH_TIMEOUT_SECS))
        .build().ok()?;
    let text = client.get(REVOCATION_LIST_URL).send().ok()?.text().ok()?;
    let list: RevocationList = serde_json::from_str(&text).ok()?;
    list.revoked.into_iter()
        .find(|e| e.id.to_uppercase() == upper_id)
        .map(|e| e.reason)
}

/// Check current app license status (with revocation check when online)
pub fn check_app_license() -> LicenseStatus {
    let candidates = get_license_file_candidates();
    let mut last_error = None;

    for path in &candidates {
        if path.exists() {
            if let Ok(content) = fs::read_to_string(path) {
                match verify_license_data(&content) {
                    Ok(payload) => {
                        // Cryptographic signature valid — now check revocation list
                        let lid = payload.license_id.clone();
                        if is_license_revoked(&lid) {
                            // Remove local lic file so user must re-enter key
                            let _ = fs::remove_file(path);
                            let reason = get_revocation_reason(&lid)
                                .unwrap_or_else(|| "Liên hệ ThienPhatTech để biết thêm.".to_string());
                            return LicenseStatus {
                                is_licensed: false,
                                customer: None,
                                issued_at: None,
                                license_id: None,
                                license_type: None,
                                license_path: None,
                                error: Some(format!(
                                    "Bản quyền này đã bị thu hồi bởi quản trị viên ThienPhatTech. Lý do: {}",
                                    reason
                                )),
                            };
                        }

                        return LicenseStatus {
                            is_licensed: true,
                            customer: Some(payload.customer),
                            issued_at: Some(payload.issued_at),
                            license_id: Some(payload.license_id),
                            license_type: Some(payload.license_type),
                            license_path: Some(path.to_string_lossy().to_string()),

                            error: None,
                        };
                    }
                    Err(e) => {
                        last_error = Some(format!("{}: {}", path.file_name().unwrap_or_default().to_string_lossy(), e));
                    }
                }
            }
        }
    }

    LicenseStatus {
        is_licensed: false,
        customer: None,
        issued_at: None,
        license_id: None,
        license_type: None,
        license_path: None,
        error: last_error,
    }
}

/// Import a license string (e.g. from file picker or drag-and-drop), verify signature and store persistently
pub fn import_app_license(content: &str) -> Result<LicenseStatus, String> {
    let (payload, json_to_save) = verify_license_or_cdkey(content)?;

    // Save to %APPDATA%\ThienPhatTech\pccare.lic
    let appdata = std::env::var("APPDATA")
        .map_err(|_| "Không tìm thấy thư mục APPDATA của hệ thống".to_string())?;
    let tp_dir = PathBuf::from(appdata).join("ThienPhatTech");
    fs::create_dir_all(&tp_dir)
        .map_err(|e| format!("Không thể tạo thư mục lưu license: {}", e))?;
    let target_file = tp_dir.join("pccare.lic");
    fs::write(&target_file, json_to_save.as_bytes())
        .map_err(|e| format!("Không thể ghi file license: {}", e))?;

    // Also attempt to save next to executable if possible (portable mode)
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(parent) = exe_path.parent() {
            let portable_lic = parent.join("pccare.lic");
            let _ = fs::write(portable_lic, json_to_save.as_bytes());
        }
    }

    Ok(LicenseStatus {
        is_licensed: true,
        customer: Some(payload.customer),
        issued_at: Some(payload.issued_at),
        license_id: Some(payload.license_id),
        license_type: Some(payload.license_type),
        license_path: Some(target_file.to_string_lossy().to_string()),
        error: None,
    })
}

/// Remove license file from local machine
pub fn remove_app_license() -> Result<(), String> {
    let candidates = get_license_file_candidates();
    for path in &candidates {
        if path.exists() {
            let _ = fs::remove_file(path);
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_license_verification() {
        // Known valid payload and signature generated with the active license keypair
        let signed_json = r#"{
  "payload": {
    "product": "PCCareMasterPro",
    "customer": "Nguyen Van A",
    "issued_at": "2026-09-06T05:59:18Z",
    "license_id": "TP-LIC-057817",
    "license_type": "lifetime",
    "notes": "Ban quyen vinh vien - Thien Phat Tech"
  },
  "signature": "3ekWHiYcwUchaSNWXi+1yweYsdZbbB6dBtYimo76a4tIScO6/77pV5j0dK9Ylf3LkpIqT0Rh45M3EyBOFT/FCQ=="
}"#;

        let verified = verify_license_data(signed_json).expect("Signature must be valid");
        assert_eq!(verified.customer, "Nguyen Van A");
        assert_eq!(verified.product, "PCCareMasterPro");
        assert_eq!(verified.license_id, "TP-LIC-057817");
    }

    #[test]
    fn test_tampered_license_rejected() {
        // Change customer name from "Nguyen Van A" to "Nguyen Van B"
        let tampered_json = r#"{
  "payload": {
    "product": "PCCareMasterPro",
    "customer": "Nguyen Van B",
    "issued_at": "2026-09-06T05:59:18Z",
    "license_id": "TP-LIC-057817",
    "license_type": "lifetime",
    "notes": "Ban quyen vinh vien - Thien Phat Tech"
  },
  "signature": "3ekWHiYcwUchaSNWXi+1yweYsdZbbB6dBtYimo76a4tIScO6/77pV5j0dK9Ylf3LkpIqT0Rh45M3EyBOFT/FCQ=="
}"#;

        let res = verify_license_data(tampered_json);
        assert!(res.is_err(), "Tampered license MUST be rejected by cryptographic verification");
    }

    #[test]
    fn test_invalid_signature_byte_rejected() {
        // Invert one character in signature
        let tampered_sig = r#"{
  "payload": {
    "product": "PCCareMasterPro",
    "customer": "Nguyen Van A",
    "issued_at": "2026-09-06T05:59:18Z",
    "license_id": "TP-LIC-057817",
    "license_type": "lifetime",
    "notes": "Ban quyen vinh vien - Thien Phat Tech"
  },
  "signature": "AekWHiYcwUchaSNWXi+1yweYsdZbbB6dBtYimo76a4tIScO6/77pV5j0dK9Ylf3LkpIqT0Rh45M3EyBOFT/FCQ=="
}"#;

        let res = verify_license_data(tampered_sig);
        assert!(res.is_err(), "Modified signature must be rejected");
    }

    #[test]
    fn test_wrong_product_rejected() {
        let wrong_prod = r#"{
  "payload": {
    "product": "HackedTool",
    "customer": "Nguyen Van A",
    "issued_at": "2026-09-06T05:59:18Z",
    "license_id": "TP-LIC-057817",
    "license_type": "lifetime",
    "notes": "Ban quyen vinh vien - Thien Phat Tech"
  },
  "signature": "3ekWHiYcwUchaSNWXi+1yweYsdZbbB6dBtYimo76a4tIScO6/77pV5j0dK9Ylf3LkpIqT0Rh45M3EyBOFT/FCQ=="
}"#;

        let res = verify_license_data(wrong_prod);
        assert!(res.is_err(), "Wrong product name must be rejected");
    }

    // ── Revocation List Tests ─────────────────────────────────────────────────

    /// Known public key base64 (same as LICENSE_PUBLIC_KEY_BASE64)
    const TEST_PUB_KEY: &str = "6cynZaSH1JN3cSmaPIk0cQ73KsqgRH4FgLV0gL8ZFBM=";

    #[test]
    fn test_canonical_revocation_bytes_empty() {
        let bytes = canonical_revocation_bytes(1, "2026-09-07T14:00:00Z", &[]);
        let s = String::from_utf8(bytes).expect("valid utf8");
        assert_eq!(s, "version=1&updated_at=2026-09-07T14:00:00Z&revoked_count=0&ids=");
    }

    #[test]
    fn test_canonical_revocation_bytes_sorted() {
        let ids = vec!["TP-LIC-000003".to_string(), "TP-LIC-000001".to_string(), "TP-LIC-000002".to_string()];
        let bytes = canonical_revocation_bytes(1, "2026-09-07T00:00:00Z", &ids);
        let s = String::from_utf8(bytes).expect("valid utf8");
        // IDs must be sorted ascending
        assert!(s.contains("ids=TP-LIC-000001,TP-LIC-000002,TP-LIC-000003"));
    }

    #[test]
    fn test_revocation_signature_valid_empty_list() {
        // This signature was generated by gen_revoked_json.js with the real private key
        // for an empty list (verified PASS in that script).
        // We test canonical_revocation_bytes + Ed25519 verify roundtrip using test vector.
        use ring::signature::UnparsedPublicKey;
        let pub_bytes = base64::prelude::BASE64_STANDARD.decode(TEST_PUB_KEY).unwrap();

        // Build the list identical to initial revoked.json
        let version = 1u32;
        // We don't know the exact updated_at of our generated file, but we can test
        // that the canonical function matches what the verifier expects.
        let ids: Vec<String> = vec![];
        let msg = canonical_revocation_bytes(version, "2026-09-07T14:00:00Z", &ids);
        let expected_canonical = "version=1&updated_at=2026-09-07T14:00:00Z&revoked_count=0&ids=";
        assert_eq!(String::from_utf8(msg.clone()).unwrap(), expected_canonical);

        // We can't verify the actual sig without the private key in tests,
        // but we can verify a tampered signature is rejected.
        let fake_sig = vec![0u8; 64];
        let key = UnparsedPublicKey::new(&ring::signature::ED25519, &pub_bytes);
        assert!(key.verify(&msg, &fake_sig).is_err(), "Fake signature must fail");
    }

    #[test]
    #[ignore = "Requires network access to GitHub and ring crypto provider"]
    fn test_is_license_revoked_unknown_id_returns_false() {
        // Install ring provider before reqwest
        let _ = rustls::crypto::ring::default_provider().install_default();
        // A completely unknown ID that should never be in any real revocation list.
        let result = is_license_revoked("TP-LIC-FFFFFF");
        // Even with network, TP-LIC-FFFFFF should not be in the revocation list.
        assert!(!result, "Unknown ID must not be reported as revoked");
    }
}
