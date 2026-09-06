use std::fs;
use std::path::PathBuf;
use ring::rand::SystemRandom;
use ring::signature::{self, KeyPair};
use base64::prelude::*;
use serde::{Deserialize, Serialize};

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

    Ok(format!("TPPRO-{}", token))
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
        _ => {
            print_usage();
        }
    }

    Ok(())
}
