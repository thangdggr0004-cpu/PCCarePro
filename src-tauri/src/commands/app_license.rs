use std::fs;
use std::path::PathBuf;
use base64::prelude::*;
use serde::{Deserialize, Serialize};

/// Embedded Ed25519 Public Key for PCCareMasterPro Offline License Verification
/// (Generated 2026-09-06, distinct and decoupled from update signing keys).
pub const LICENSE_PUBLIC_KEY_BASE64: &str = "6cynZaSH1JN3cSmaPIk0cQ73KsqgRH4FgLV0gL8ZFBM=";

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

/// Check current app license status offline without any network call
pub fn check_app_license() -> LicenseStatus {
    let candidates = get_license_file_candidates();
    let mut last_error = None;

    for path in &candidates {
        if path.exists() {
            if let Ok(content) = fs::read_to_string(path) {
                match verify_license_data(&content) {
                    Ok(payload) => {
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
}
