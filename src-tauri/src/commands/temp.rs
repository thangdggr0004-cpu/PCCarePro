use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fs;
use std::os::windows::fs::MetadataExt;
use std::path::Path;
use crate::commands::exec;

const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x0400;

const REASON_REPARSE: &str = "reparse_point";
const REASON_IN_USE: &str = "in_use";
const REASON_ACCESS: &str = "access_denied";
const REASON_OTHER: &str = "other";

/// Honest result of a delete pass: freed vs blocked (with per-reason byte sums).
#[derive(Debug, Clone, Default)]
pub struct CleanOutcome {
    pub freed: u64,
    pub deleted_files: u64,
    /// Bytes we tried to delete but could not (locked / no permission).
    pub blocked: u64,
    pub blocked_files: u64,
    /// Bytes deliberately NOT touched because they are reparse/mount-backed.
    pub reparse_skipped: u64,
    /// reason key -> blocked bytes.
    pub reasons: BTreeMap<String, u64>,
}

/// A reparse point (junction, symlink, or mounted-image/WIM file) must never be
/// counted as garbage or deleted. This is how a DISM/NTLite image mount that
/// shows up under %TEMP% (e.g. NLTmpMnt) stays untouched.
fn is_reparse_point(path: &Path) -> bool {
    match fs::symlink_metadata(path) {
        Ok(m) => {
            (m.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT) != 0 || m.file_type().is_symlink()
        }
        Err(_) => false,
    }
}

fn classify(err: &std::io::Error) -> &'static str {
    match err.raw_os_error() {
        Some(5) => REASON_ACCESS,
        Some(32) | Some(33) => REASON_IN_USE,
        _ => REASON_OTHER,
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TempScanResult {
    pub categories: Vec<TempCategory>,
    pub total_size: u64,
    pub total_display: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TempCategory {
    pub name: String,
    pub path: String,
    pub file_count: usize,
    pub size_bytes: u64,
    pub size_display: String,
}

fn format_size(bytes: u64) -> String {
    if bytes < 1024 {
        format!("{} B", bytes)
    } else if bytes < 1024 * 1024 {
        format!("{:.1} KB", bytes as f64 / 1024.0)
    } else if bytes < 1024 * 1024 * 1024 {
        format!("{:.1} MB", bytes as f64 / (1024.0 * 1024.0))
    } else {
        format!("{:.2} GB", bytes as f64 / (1024.0 * 1024.0 * 1024.0))
    }
}

fn get_folder_size_and_count(path: &str) -> (u64, usize) {
    let dir = Path::new(path);
    if is_reparse_point(dir) {
        // Junction / symlink / mounted-image root: never counted as junk.
        return (0, 0);
    }
    if !dir.exists() {
        return (0, 0);
    }
    if dir.is_file() {
        return match fs::metadata(dir) {
            Ok(m) => (m.len(), 1),
            Err(_) => (0, 0),
        };
    }
    let mut total_size = 0u64;
    let mut file_count = 0usize;
    scan_dir_rec(dir, &mut total_size, &mut file_count);
    (total_size, file_count)
}

fn scan_dir_rec(dir: &Path, total_size: &mut u64, file_count: &mut usize) {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if is_reparse_point(&path) {
                continue;
            }
            if let Ok(meta) = entry.metadata() {
                if meta.is_file() {
                    *total_size += meta.len();
                    *file_count += 1;
                } else if meta.is_dir() {
                    scan_dir_rec(&path, total_size, file_count);
                }
            }
        }
    }
}

fn scan_category(path: &str, name: &str) -> TempCategory {
    let (size_bytes, file_count) = get_folder_size_and_count(path);
    TempCategory {
        name: name.into(),
        path: path.into(),
        file_count,
        size_bytes,
        size_display: format_size(size_bytes),
    }
}

fn local_app_data() -> String {
    std::env::var("LOCALAPPDATA").unwrap_or_else(|_| "C:\\Users\\Default\\AppData\\Local".into())
}

/// Scan Recycle Bin using COM Shell.Application + filesystem fallback.
/// Returns (size_bytes, file_count) matching what Explorer shows.
fn scan_recycle_bin() -> (u64, usize) {
    // Method 1: COM Shell.Application — this matches what Explorer shows (primary)
    let com_script = r#"
$size = 0; $count = 0
try {
    $shell = New-Object -ComObject Shell.Application
    $rb = $shell.NameSpace(0x0a)
    if ($rb) {
        foreach ($item in $rb.Items()) {
            $size += $item.Size
            $count++
        }
    }
} catch {}
"$size $count"
"#;
    let output = exec::run_ps(com_script);
    let output = output.trim();
    let (com_size, com_count) = match output.rsplit_once(' ') {
        Some((s, c)) => (
            s.trim().parse::<u64>().unwrap_or(0),
            c.trim().parse::<usize>().unwrap_or(0),
        ),
        None => (0, 0),
    };

    // Method 2: Filesystem fallback — scan $Recycle.Bin on all fixed drives.
    // Used ONLY when COM fails (returns empty) on some Windows versions.
    let fs_script = r#"
$size = 0; $count = 0
try {
    $drives = Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" -ErrorAction SilentlyContinue
    foreach ($d in $drives) {
        $rbPath = Join-Path $d.DeviceID '$Recycle.Bin'
        if (Test-Path $rbPath) {
            $files = Get-ChildItem -Path $rbPath -Recurse -Force -ErrorAction SilentlyContinue
            foreach ($f in $files) {
                if (-not $f.PSIsContainer -and $f.Name -notlike "desktop.ini") {
                    $size += $f.Length
                    $count++
                }
            }
        }
    }
} catch {}
"$size $count"
"#;
    let output = exec::run_ps(fs_script);
    let output = output.trim();
    let (fs_size, fs_count) = match output.rsplit_once(' ') {
        Some((s, c)) => (
            s.trim().parse::<u64>().unwrap_or(0),
            c.trim().parse::<usize>().unwrap_or(0),
        ),
        None => (0, 0),
    };

    // Prefer COM (matches Explorer). FS includes hidden $I metadata files,
    // so it slightly over-reports — only use it when COM returns empty.
    if com_count > 0 || com_size > 0 {
        (com_size, com_count)
    } else {
        (fs_size, fs_count)
    }
}

/// Scan Registry entries: RunMRU (Run dialog history) + TypedURLs (IE/Edge typed URLs).
/// Returns (entry_count, estimated_size_bytes) matching actual registry state.
fn scan_registry() -> (usize, u64) {
    let script = r#"
$count = 0
try {
    $runMru = Get-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\RunMRU' -ErrorAction SilentlyContinue
    if ($runMru) {
        $count += ($runMru.PSObject.Properties | Where-Object { $_.Name -match '^[a-z]$' }).Count
    }
} catch {}
try {
    $typedUrls = Get-ItemProperty -Path 'HKCU:\Software\Microsoft\Internet Explorer\TypedURLs' -ErrorAction SilentlyContinue
    if ($typedUrls) {
        $count += ($typedUrls.PSObject.Properties | Where-Object { $_.Name -match '^url\d+$' }).Count
    }
} catch {}
$count
"#;
    let output = exec::run_ps(script);
    let output = output.trim();
    let entry_count = output.parse::<usize>().unwrap_or(0);

    // Registry entries are tiny (a few hundred bytes each), estimate ~256 bytes per entry
    let estimated_size = (entry_count as u64) * 256;

    (entry_count, estimated_size)
}

/// Scan all 11 junk categories matching frontend UI
pub fn scan_junk() -> Result<TempScanResult, String> {
    scan_junk_impl(&|_i: u32, _t: u32, _n: &str| {})
}

/// Same as [`scan_junk`] but reports progress per completed category.
/// `emit(done, total, last_category_name)` is called as each category finishes.
pub fn scan_junk_with_progress(emit: &(dyn Fn(u32, u32, &str) + Send + Sync)) -> Result<TempScanResult, String> {
    scan_junk_impl(emit)
}

const SCAN_TOTAL: u32 = 11;

fn scan_junk_impl(emit: &(dyn Fn(u32, u32, &str) + Send + Sync)) -> Result<TempScanResult, String> {
    let local = local_app_data();
    let temp_user = std::env::temp_dir().to_string_lossy().to_string();
    let win_temp = "C:\\Windows\\Temp".to_string();
    let prefetch = "C:\\Windows\\Prefetch".to_string();
    let wu_cache = "C:\\Windows\\SoftwareDistribution\\Download".to_string();
    let log_files = "C:\\Windows\\Logs".to_string();
    let memory_dmp = "C:\\Windows\\MEMORY.DMP".to_string();
    let minidump = "C:\\Windows\\Minidump".to_string();
    let chrome_cache = format!("{}\\Google\\Chrome\\User Data\\Default\\Cache", local);
    let edge_cache = format!("{}\\Microsoft\\Edge\\User Data\\Default\\Cache", local);
    let coccoc_cache = format!("{}\\CocCoc\\Browser\\User Data\\Default\\Cache", local);

    let mut done = 0u32;
    let total: u32 = SCAN_TOTAL;

    fn emit_progress(
        done: &mut u32,
        total: u32,
        emit: &(dyn Fn(u32, u32, &str) + Send + Sync),
        name: &str,
        categories: &mut Vec<TempCategory>,
        cat: TempCategory,
    ) {
        *done += 1;
        emit(*done, total, name);
        categories.push(cat);
    }

    let mut categories = Vec::new();
    emit_progress(&mut done, total, emit, "Temporary Files (User)", &mut categories, scan_category(&temp_user, "Temporary Files (User)"));
    emit_progress(&mut done, total, emit, "Windows Temp", &mut categories, scan_category(&win_temp, "Windows Temp"));
    emit_progress(&mut done, total, emit, "Prefetch", &mut categories, scan_category(&prefetch, "Prefetch"));
    emit_progress(&mut done, total, emit, "Windows Update Cache", &mut categories, scan_category(&wu_cache, "Windows Update Cache"));
    emit_progress(&mut done, total, emit, "Windows Log Files", &mut categories, scan_category(&log_files, "Windows Log Files"));

    // Recycle Bin — real data via COM + filesystem
    let (rb_size, rb_count) = scan_recycle_bin();
    done += 1;
    emit(done, total, "Recycle Bin");
    categories.push(TempCategory {
        name: "Recycle Bin".into(),
        path: "C:\\$Recycle.Bin".into(),
        file_count: rb_count,
        size_bytes: rb_size,
        size_display: format_size(rb_size),
    });

    // Registry — real entry count via PowerShell
    let (reg_count, reg_size) = scan_registry();
    done += 1;
    emit(done, total, "Registry & History");
    categories.push(TempCategory {
        name: "Registry & History".into(),
        path: "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer".into(),
        file_count: reg_count,
        size_bytes: reg_size,
        size_display: format_size(reg_size),
    });

    // Dump size
    let (dmp_size, dmp_count) = {
        let (s1, c1) = get_folder_size_and_count(&memory_dmp);
        let (s2, c2) = get_folder_size_and_count(&minidump);
        (s1 + s2, c1 + c2)
    };
    done += 1;
    emit(done, total, "File Dump Màn Hình Xanh");
    categories.push(TempCategory {
        name: "File Dump Màn Hình Xanh".into(),
        path: "C:\\Windows\\Minidump".into(),
        file_count: dmp_count,
        size_bytes: dmp_size,
        size_display: format_size(dmp_size),
    });

    emit_progress(&mut done, total, emit, "Cache Trình Duyệt Google Chrome", &mut categories, scan_category(&chrome_cache, "Cache Trình Duyệt Google Chrome"));
    emit_progress(&mut done, total, emit, "Cache Trình Duyệt MS Edge", &mut categories, scan_category(&edge_cache, "Cache Trình Duyệt MS Edge"));
    emit_progress(&mut done, total, emit, "Cache Trình Duyệt Cốc Cốc", &mut categories, scan_category(&coccoc_cache, "Cache Trình Duyệt Cốc Cốc"));

    let total_size = categories.iter().map(|c| c.size_bytes).sum();

    Ok(TempScanResult {
        categories,
        total_size,
        total_display: format_size(total_size),
    })
}

/// Clean selected categories
pub fn clean_junk(categories: &[String]) -> Result<serde_json::Value, String> {
    clean_junk_impl(categories, &|_i: u32, _t: u32, _n: &str| {})
}

/// Same as [`clean_junk`] but reports progress per cleaned path.
/// `emit(done, total, path_or_category)` fires as each target path finishes.
pub fn clean_junk_with_progress(
    categories: &[String],
    emit: &(dyn Fn(u32, u32, &str) + Send + Sync),
) -> Result<serde_json::Value, String> {
    clean_junk_impl(categories, emit)
}

fn clean_junk_impl(
    categories: &[String],
    emit: &(dyn Fn(u32, u32, &str) + Send + Sync),
) -> Result<serde_json::Value, String> {
    let local = local_app_data();
    let mut cleaned = Vec::new();
    let mut total_freed = 0u64;
    let mut total_blocked = 0u64;
    let mut total_blocked_files = 0u64;
    let mut total_reparse_skipped = 0u64;
    let mut total_reasons: BTreeMap<String, u64> = BTreeMap::new();

    let mut scheduled: Vec<(String, Vec<String>)> = Vec::new();

    for category in categories {
        let cat_str = category.as_str();
        let paths: Vec<String> = match cat_str {
            "Temporary Files (User)" | "user_temp" => vec![std::env::temp_dir().to_string_lossy().to_string()],
            "Windows Temp" | "system_temp" => vec!["C:\\Windows\\Temp".into()],
            "Prefetch" | "prefetch" => vec!["C:\\Windows\\Prefetch".into()],
            "Windows Update Cache" | "win_update" => vec!["C:\\Windows\\SoftwareDistribution\\Download".into()],
            "Windows Log Files" | "system_logs" => vec!["C:\\Windows\\Logs".into(), "C:\\Windows\\System32\\LogFiles".into()],
            "File Dump Màn Hình Xanh" | "bsod_dumps" => vec!["C:\\Windows\\Minidump".into(), "C:\\Windows\\MEMORY.DMP".into()],
            "Cache Trình Duyệt Google Chrome" | "chrome_cache" => vec![format!("{}\\Google\\Chrome\\User Data\\Default\\Cache", local)],
            "Cache Trình Duyệt MS Edge" | "edge_cache" => vec![format!("{}\\Microsoft\\Edge\\User Data\\Default\\Cache", local)],
            "Cache Trình Duyệt Cốc Cốc" | "coccoc_cache" => vec![format!("{}\\CocCoc\\Browser\\User Data\\Default\\Cache", local)],
            "Recycle Bin" | "recycle_bin" => {
                // Measure size before cleaning
                let (before_size, before_count) = scan_recycle_bin();

                // Clean: Clear-RecycleBin with manual fallback
                let clean_script = r#"
try {
    Clear-RecycleBin -Force -ErrorAction Stop
} catch {
    $drives = Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" -ErrorAction SilentlyContinue
    foreach ($d in $drives) {
        $rbPath = Join-Path $d.DeviceID '$Recycle.Bin'
        if (Test-Path $rbPath) {
            Get-ChildItem -Path $rbPath -Recurse -Force -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
        }
    }
}
"#;
                let _ = exec::run_ps(clean_script);

                // Measure size after cleaning
                let (after_size, _) = scan_recycle_bin();
                let freed = before_size.saturating_sub(after_size);
                total_freed += freed;
                total_blocked += before_size.saturating_sub(freed).min(before_size);
                cleaned.push(serde_json::json!({
                    "category": category,
                    "freed": format_size(freed),
                    "freed_bytes": freed,
                    "blocked_bytes": 0u64,
                    "blocked_files": 0u64,
                    "files_cleaned": before_count,
                    "blocked_reasons": serde_json::json!({}),
                }));
                continue;
            }
            "Registry & History" | "registry" => {
                // Measure entry count before cleaning
                let (before_count, _) = scan_registry();

                // Clean: remove RunMRU and TypedURLs (NOT TypedPaths)
                let clean_script = r#"
try {
    Remove-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\RunMRU' -Name * -ErrorAction SilentlyContinue
} catch {}
try {
    Remove-ItemProperty -Path 'HKCU:\Software\Microsoft\Internet Explorer\TypedURLs' -Name * -ErrorAction SilentlyContinue
} catch {}
"#;
                let _ = exec::run_ps(clean_script);

                // Measure entry count after cleaning
                let (after_count, _) = scan_registry();
                let entries_removed = before_count.saturating_sub(after_count);
                let freed_bytes = (entries_removed as u64) * 256;
                total_freed += freed_bytes;
                cleaned.push(serde_json::json!({
                    "category": category,
                    "freed": format_size(freed_bytes),
                    "freed_bytes": freed_bytes,
                    "blocked_bytes": 0u64,
                    "blocked_files": 0u64,
                    "blocks": 0u64,
                    "entries_removed": entries_removed,
                    "blocked_reasons": serde_json::json!({}),
                }));
                continue;
            }
            _ => continue,
        };
        scheduled.push((category.clone(), paths));
    }

    let total_scheduled: u32 = scheduled.iter().map(|(_, ps)| ps.len() as u32).sum();
    let mut done = 0u32;

    for (category, paths) in &scheduled {
        for path in paths {
            let outcome = delete_dir_contents(path);
            done += 1;
            emit(done, total_scheduled.max(1), &format!("{} ({})", category, path));
            total_freed += outcome.freed;
            total_blocked += outcome.blocked;
            total_blocked_files += outcome.blocked_files;
            total_reparse_skipped += outcome.reparse_skipped;
            for (k, v) in &outcome.reasons {
                *total_reasons.entry(k.clone()).or_insert(0) += v;
            }
            cleaned.push(serde_json::json!({
                "category": category,
                "freed": format_size(outcome.freed),
                "freed_bytes": outcome.freed,
                "blocked_bytes": outcome.blocked,
                "blocked_files": outcome.blocked_files,
                "reparse_skipped_bytes": outcome.reparse_skipped,
                "blocked_reasons": outcome.reasons,
            }));
        }
    }

    Ok(serde_json::json!({
        "success": true,
        "total_freed": format_size(total_freed),
        "total_freed_bytes": total_freed,
        "total_blocked": format_size(total_blocked),
        "total_blocked_bytes": total_blocked,
        "total_blocked_files": total_blocked_files,
        "blocked_reasons": total_reasons,
        "reparse_skipped_bytes": total_reparse_skipped,
        "details": cleaned,
    }))
}

/// Recursively delete contents of a directory, skipping anything backed by a
/// reparse point (junction / symlink / mounted image). Returns an honest
/// [`CleanOutcome`]: how much was freed, how much was blocked and why.
pub fn delete_dir_contents(path: &str) -> CleanOutcome {
    let mut out = CleanOutcome::default();
    let root = Path::new(path);
    if !root.exists() {
        return out;
    }
    if is_reparse_point(root) {
        let extra = measured_size(root);
        out.reparse_skipped += extra;
        out.reasons.insert(REASON_REPARSE.to_string(), extra);
        return out;
    }
    if root.is_file() {
        try_delete_entry(root, &mut out);
        return out;
    }
    if root.is_dir() {
        delete_tree(root, &mut out);
    }
    out
}

fn measured_size(p: &Path) -> u64 {
    get_folder_size_and_count(&p.to_string_lossy()).0
}

fn try_delete_entry(p: &Path, out: &mut CleanOutcome) {
    if is_reparse_point(p) {
        let extra = measured_size(p);
        out.reparse_skipped += extra;
        *out.reasons.entry(REASON_REPARSE.to_string()).or_insert(0) += extra;
        return;
    }
    let len = fs::metadata(p).map(|m| m.len()).unwrap_or(0);
    match fs::remove_file(p) {
        Ok(_) => {
            out.freed += len;
            out.deleted_files += 1;
        }
        Err(e) => {
            out.blocked += len;
            out.blocked_files += 1;
            *out.reasons.entry(classify(&e).to_string()).or_insert(0) += len;
        }
    }
}

fn delete_tree(p: &Path, out: &mut CleanOutcome) {
    if is_reparse_point(p) {
        let extra = measured_size(p);
        out.reparse_skipped += extra;
        *out.reasons.entry(REASON_REPARSE.to_string()).or_insert(0) += extra;
        return;
    }
    // Always delete entry-by-entry. NOTE: std::fs::remove_dir_all on Windows
    // FOLLOWS junctions inside the tree and would delete the linked volume's
    // data — that's exactly what we must never do for stray DISM/NTLite mounts.
    if let Ok(entries) = fs::read_dir(p) {
        for entry in entries.flatten() {
            let child = entry.path();
            if is_reparse_point(&child) {
                let extra = measured_size(&child);
                out.reparse_skipped += extra;
                *out.reasons.entry(REASON_REPARSE.to_string()).or_insert(0) += extra;
                continue;
            }
            match fs::metadata(&child) {
                Ok(m) if m.is_dir() => delete_tree(&child, out),
                Ok(_) => try_delete_entry(&child, out),
                Err(e) => {
                    let l = fs::symlink_metadata(&child).map(|x| x.len()).unwrap_or(0);
                    out.blocked += l;
                    out.blocked_files += 1;
                    *out.reasons.entry(classify(&e).to_string()).or_insert(0) += l;
                }
            }
        }
    }
    let _ = fs::remove_dir(p);
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::Command;

    fn make_junction(link: &str, target: &str) -> bool {
        Command::new("cmd")
            .args(["/C", "mklink", "/J", link, target])
            .status()
            .map(|s| s.success())
            .unwrap_or(false)
    }

    /// Reparse points (junctions) must never be counted as junk nor be deleted
    /// (deleting through a mount could destroy the linked volume's data).
    #[test]
    fn skips_reparse_junctions_in_scan_and_delete() {
        let pid = std::process::id();
        let tmp = std::env::temp_dir().join(format!("junk_test_{}", pid));
        let external = std::env::temp_dir().join(format!("junk_test_ext_{}", pid));
        let link = tmp.join("jlink");
        let _ = fs::create_dir_all(&external);
        let _ = fs::write(external.join("external.bin"), vec![0u8; 4096]);
        let _ = fs::create_dir_all(&tmp);
        let _ = fs::write(tmp.join("real.bin"), vec![0u8; 4096]);

        if !make_junction(&link.to_string_lossy(), &external.to_string_lossy()) {
            // Not privileged to create junctions: fall back to a plain skip.
            let _ = fs::remove_dir_all(&tmp);
            let _ = fs::remove_dir_all(&external);
            return;
        }

        // Scan: external content must NOT be counted through the link.
        let (size, count) = get_folder_size_and_count(&tmp.to_string_lossy());
        assert_eq!(size, 4096, "junction target must not inflate the scan");
        assert_eq!(count, 1);

        // Delete: real junk inside the tree is removed, the junction itself
        // survives, and the extern target stays untouched.
        let out = delete_dir_contents(&tmp.to_string_lossy());
        assert_eq!(out.freed, 4096);
        assert_eq!(out.blocked, 0);
        assert!(!tmp.join("real.bin").exists(), "real junk file must go");
        assert!(link.exists(), "junction itself must survive");
        assert!(
            external.join("external.bin").exists(),
            "extern target must never be reached through the junction"
        );

        let _ = fs::remove_dir(&link);
        let _ = fs::remove_dir_all(&tmp);
        let _ = fs::remove_dir_all(&external);
    }

    /// Live sanity check: after unmounting the stray DISM/NTLite mount, %TEMP%
    /// must not report a phantom multi-GB mount again.
    #[test]
    fn e2e_scan_report_has_no_ghost_user_temp() {
        let scan = scan_junk().unwrap();
        let user_temp = scan
            .categories
            .iter()
            .find(|c| c.name == "Temporary Files (User)")
            .expect("user_temp category is always scanned");
        println!(
            "E2E user_temp: {} files, {} bytes ({})",
            user_temp.file_count, user_temp.size_bytes, user_temp.size_display
        );
        assert!(
            user_temp.size_bytes < 2u64 * 1024 * 1024 * 1024,
            "user_temp still reports ghost data: {}",
            user_temp.size_display
        );
    }

    /// Live clean of ONLY %TEMP% with the fixed reparse-aware logic. Deletes
    /// real temp files (same behaviour as the shipped tool) and must report
    /// honest freed/blocked numbers. Run with `-- --ignored`.
    #[test]
    #[ignore]
    fn e2e_clean_user_temp_reports_freed_and_blocked() {
        let res = clean_junk(&["user_temp".to_string()]).unwrap();
        println!("E2E clean result: {}", serde_json::to_string_pretty(&res).unwrap());
        assert_eq!(res["success"], true);
        assert!(res["total_freed_bytes"].is_number());
        assert!(res["total_blocked_bytes"].is_number());
        assert!(res["blocked_reasons"].is_object());
        assert!(res["details"].is_array());
    }
}
