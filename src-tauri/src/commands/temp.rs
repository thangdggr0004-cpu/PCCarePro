use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use crate::commands::exec;

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

    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            if let Ok(meta) = entry.metadata() {
                if meta.is_file() {
                    total_size += meta.len();
                    file_count += 1;
                } else if meta.is_dir() {
                    let (sub_size, sub_count) = get_folder_size_and_count(&entry.path().to_string_lossy());
                    total_size += sub_size;
                    file_count += sub_count;
                }
            }
        }
    }
    (total_size, file_count)
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

    // Calculate dump size
    let (dmp_size, dmp_count) = {
        let (s1, c1) = get_folder_size_and_count(&memory_dmp);
        let (s2, c2) = get_folder_size_and_count(&minidump);
        (s1 + s2, c1 + c2)
    };

    // Scan Recycle Bin — real data via COM + filesystem
    let (rb_size, rb_count) = scan_recycle_bin();

    // Scan Registry — real entry count via PowerShell
    let (reg_count, reg_size) = scan_registry();

    let categories = vec![
        scan_category(&temp_user, "Temporary Files (User)"),
        scan_category(&win_temp, "Windows Temp"),
        scan_category(&prefetch, "Prefetch"),
        scan_category(&wu_cache, "Windows Update Cache"),
        scan_category(&log_files, "Windows Log Files"),
        TempCategory {
            name: "Recycle Bin".into(),
            path: "C:\\$Recycle.Bin".into(),
            file_count: rb_count,
            size_bytes: rb_size,
            size_display: format_size(rb_size),
        },
        TempCategory {
            name: "Registry & History".into(),
            path: "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer".into(),
            file_count: reg_count,
            size_bytes: reg_size,
            size_display: format_size(reg_size),
        },
        TempCategory {
            name: "File Dump Màn Hình Xanh".into(),
            path: "C:\\Windows\\Minidump".into(),
            file_count: dmp_count,
            size_bytes: dmp_size,
            size_display: format_size(dmp_size),
        },
        scan_category(&chrome_cache, "Cache Trình Duyệt Google Chrome"),
        scan_category(&edge_cache, "Cache Trình Duyệt MS Edge"),
        scan_category(&coccoc_cache, "Cache Trình Duyệt Cốc Cốc"),
    ];

    let total_size = categories.iter().map(|c| c.size_bytes).sum();

    Ok(TempScanResult {
        categories,
        total_size,
        total_display: format_size(total_size),
    })
}

/// Clean selected categories
pub fn clean_junk(categories: &[String]) -> Result<serde_json::Value, String> {
    let local = local_app_data();
    let mut cleaned = Vec::new();
    let mut total_freed = 0u64;

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
                cleaned.push(serde_json::json!({
                    "category": category,
                    "freed": format_size(freed),
                    "files_cleaned": before_count,
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
                    "entries_removed": entries_removed,
                }));
                continue;
            }
            _ => continue,
        };

        for path in paths {
            let (before, _) = get_folder_size_and_count(&path);
            delete_dir_contents(&path);
            let (after, _) = get_folder_size_and_count(&path);
            let freed = before.saturating_sub(after);
            total_freed += freed;
            cleaned.push(serde_json::json!({
                "category": category,
                "freed": format_size(freed),
            }));
        }
    }

    Ok(serde_json::json!({
        "success": true,
        "total_freed": format_size(total_freed),
        "details": cleaned,
    }))
}

fn delete_dir_contents(path: &str) {
    let dir = Path::new(path);
    if !dir.exists() {
        return;
    }
    if dir.is_file() {
        let _ = fs::remove_file(dir);
        return;
    }
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_dir() {
                let _ = fs::remove_dir_all(&p);
            } else {
                let _ = fs::remove_file(&p);
            }
        }
    }
}
