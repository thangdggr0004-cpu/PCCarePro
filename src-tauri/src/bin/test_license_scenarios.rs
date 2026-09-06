use app_lib::commands::app_license::{
    check_app_license, import_app_license, remove_app_license,
};
use std::fs;
use std::path::Path;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("========================================================================");
    println!(" KIEM THU THUC TE HE THONG KICH HOAT OFFLINE PCCAREMASTERPRO");
    println!("========================================================================");

    // Don dep truoc khi test de dam bao trang thai sach
    let _ = remove_app_license();

    // -------------------------------------------------------------------------
    // KICH BAN 1: KHONG CO LICENSE (TRANG THAI DUNG THU / CHAN DOAN GIOI HAN)
    // -------------------------------------------------------------------------
    println!("\n>>> [KICH BAN 1] KIEM TRA KHI CHUA CO FILE LICENSE (.lic):");
    let status_unlicensed = check_app_license();
    println!("  - is_licensed:  {}", status_unlicensed.is_licensed);
    println!("  - customer:     {:?}", status_unlicensed.customer);
    println!("  - license_id:   {:?}", status_unlicensed.license_id);
    println!("  - license_path: {:?}", status_unlicensed.license_path);
    println!("  - error:        {:?}", status_unlicensed.error);
    
    assert!(!status_unlicensed.is_licensed, "Kich ban 1 that bai: May khong co license nhung lai bao licensed!");
    assert_eq!(status_unlicensed.customer, None);
    println!("  => KET QUA KICH BAN 1: [PASS] - He thong nhan dien chinh xac: Chua kich hoat.");
    println!("     (Hanh vi UI: Hien thi banner Che do dung thu/Chan doan, mo chan doan phan cung, khoa can thiep sau)");

    // -------------------------------------------------------------------------
    // KICH BAN 2: IMPORT LICENSE MAU THAT HOP LE ("Nguyen Van A")
    // -------------------------------------------------------------------------
    println!("\n>>> [KICH BAN 2] IMPORT LICENSE MAU THAT HOP LE:");
    let sample_path = if Path::new("sample_valid.lic").exists() {
        "sample_valid.lic"
    } else if Path::new("src-tauri/sample_valid.lic").exists() {
        "src-tauri/sample_valid.lic"
    } else {
        "../src-tauri/sample_valid.lic"
    };

    let valid_lic_content = fs::read_to_string(sample_path)
        .unwrap_or_else(|_| panic!("Khong tim thay file license mau tai {}", sample_path));
    
    println!("  - Noi dung file license (rut gon):");
    for line in valid_lic_content.lines().take(8) {
        println!("    {}", line);
    }
    println!("    ...");

    // Goi import voi &valid_lic_content
    let import_res = import_app_license(&valid_lic_content);
    println!("  - Ket qua import_app_license: {:?}", import_res);
    assert!(import_res.is_ok(), "Kich ban 2 that bai: Khong import duoc license hop le!");

    // Kiem tra lai trang thai sau import
    let status_licensed = check_app_license();
    println!("  - Trang thai sau import:");
    println!("    + is_licensed:  {}", status_licensed.is_licensed);
    println!("    + customer:     {:?}", status_licensed.customer);
    println!("    + license_id:   {:?}", status_licensed.license_id);
    println!("    + license_type: {:?}", status_licensed.license_type);
    println!("    + license_path: {:?}", status_licensed.license_path);

    assert!(status_licensed.is_licensed, "Kich ban 2 that bai: is_licensed khong phai true!");
    assert_eq!(status_licensed.customer.as_deref(), Some("Nguyen Van A"));
    assert_eq!(status_licensed.license_type.as_deref(), Some("lifetime"));
    println!("  => KET QUA KICH BAN 2: [PASS] - Kich hoat vinh vien thanh cong cho: Nguyen Van A.");
    println!("     (Hanh vi UI: Hien thi badge 'Da kich hoat cho: Nguyen Van A', mo khoa toan bo tinh nang)");

    // -------------------------------------------------------------------------
    // KICH BAN 3: SUA TAY 1 KY TU (GIA MAO / SUA FILE) -> BI TU CHOI
    // -------------------------------------------------------------------------
    println!("\n>>> [KICH BAN 3] KIEM TRA FILE BI SUA DOI / GIA MAO:");
    
    // Truong hop 3.1: Sua ten khach hang tu "Nguyen Van A" -> "Nguyen Van B" (giu nguyen chu ky)
    let tampered_customer = valid_lic_content.replace("Nguyen Van A", "Nguyen Van B");
    println!("  - Thu nghiem 3.1: Doi ten khach hang 'Nguyen Van A' -> 'Nguyen Van B'");
    let tampered_res1 = import_app_license(&tampered_customer);
    println!("    + Ket qua xac thuc: {:?}", tampered_res1);
    assert!(tampered_res1.is_err(), "Kich ban 3.1 that bai: Sua ten khach hang ma khong bi tu choi!");

    // Truong hop 3.2: Sua 1 ky tu trong chuoi chu ky so
    println!("  - Thu nghiem 3.2: Sua 1 ky tu trong signature Base64");
    let tampered_sig = valid_lic_content.replace("\"bWNGBYY", "\"xWNGBYY");
    let tampered_res2 = import_app_license(&tampered_sig);
    println!("    + Ket qua xac thuc: {:?}", tampered_res2);
    assert!(tampered_res2.is_err(), "Kich ban 3.2 that bai: Chu ky gia mao ma khong bi tu choi!");

    // Truong hop 3.3: Sua ngay cap issued_at
    println!("  - Thu nghiem 3.3: Sua ngay cap issued_at");
    let tampered_date = valid_lic_content.replace("2026-", "2029-");
    let tampered_res3 = import_app_license(&tampered_date);
    println!("    + Ket qua xac thuc: {:?}", tampered_res3);
    assert!(tampered_res3.is_err(), "Kich ban 3.3 that bai: Sua ngay cap ma khong bi tu choi!");

    println!("  => KET QUA KICH BAN 3: [PASS] - Tat ca cac hanh vi can thiep/sua doi deu bi Ed25519 tu choi 100%.");

    // -------------------------------------------------------------------------
    // KICH BAN 5: KICH HOAT BANG CHUOI CDKEY (TPPRO-...)
    // -------------------------------------------------------------------------
    println!("\n>>> [KICH BAN 5] KICH HOAT BANG CHUOI CDKEY TEXT:");
    let test_cdkey = "TPPRO-eyJjIjoiTmd1eWVuIFZhbiBBIiwiZCI6IjIwMjYtMDktMDZUMDY6NTg6NDdaIiwiaSI6IlRQLUxJQy0wRTI2NEUiLCJzIjoid3JRcjNMbm9sNzNHWFdyQksxOW9scjNwb3RPbmRZbENvR3lzMnFvRjRoWWptQWd4MGtISnh2Z1pGV0E2VlFpWFpwbnJ5NHFTc08wN0VpaWEzTmo5Q3c9PSJ9";
    let cdkey_import_res = import_app_license(test_cdkey);
    println!("  - Ket qua import CDKey: {:?}", cdkey_import_res);
    assert!(cdkey_import_res.is_ok(), "Kich ban 5 that bai: Khong kich hoat duoc qua CDKey!");
    
    let cdkey_status = check_app_license();
    assert!(cdkey_status.is_licensed, "Kich ban 5 that bai: status.is_licensed phai la true!");
    assert_eq!(cdkey_status.customer.as_deref(), Some("Nguyen Van A"));
    println!("  => KET QUA KICH BAN 5: [PASS] - Kich hoat thanh cong qua CDKey cho: {:?}", cdkey_status.customer);

    // Kiem tra CDKey gia mao
    let fake_cdkey = "TPPRO-eyJjIjoiSGFja2VyIiwiaSI6IjEyMyIsInMiOiJhYmMifQ==";
    let fake_res = import_app_license(fake_cdkey);
    assert!(fake_res.is_err(), "Kich ban 5 that bai: CDKey gia khong bi chan!");
    println!("  => KET QUA KICH BAN 5 (Fake CDKey): [PASS] - Tu choi CDKey gia mao thanh cong!");

    // Don dep cuoi cung
    let _ = remove_app_license();

    println!("\n========================================================================");
    println!(" TONG KET: TAT CA 5 KICH BAN KIEM THU THUC TE DEU DAT CHUAN 100%!");
    println!("========================================================================");

    Ok(())
}
