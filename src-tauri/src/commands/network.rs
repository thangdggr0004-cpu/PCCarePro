use crate::commands::exec;

fn run_ps(script: &str) -> String {
    exec::run_ps(script)
}

/// Loose IPv4 validation (frontend only enforces non-empty). Returns true if the
/// string looks like a dotted-quad IPv4; used to keep user input safe before it is
/// interpolated into an elevated PowerShell command.
fn is_valid_ipv4(v: &str) -> bool {
    let octets: Vec<&str> = v.split('.').collect();
    if octets.len() != 4 {
        return false;
    }
    octets.iter().all(|o| {
        !o.is_empty()
            && o.len() <= 3
            && o.chars().all(|c| c.is_ascii_digit())
            && o.parse::<u32>().map_or(false, |n| n <= 255)
    })
}

/// Reset network stack (Winsock, TCP/IP, DNS, IP Release & Renew).
/// Runs as ONE elevated PowerShell (mirrors Electron `runPowerShellScriptElevated`).
/// Captures the REAL exit code of each core command (winsock reset / int ip reset /
/// flushdns) and only reports success when every core step succeeds — no longer
/// swallowing errors with `let _ =`. Release/Renew stay as best-effort extras (not in
/// Electron; DHCP-less setups can legitimately fail them without failing the reset).
pub fn reset_network_stack() -> Result<serde_json::Value, String> {
    let ps = r#"
$ErrorActionPreference = 'Continue'
$results = @()

netsh winsock reset *> $null
$results += [pscustomobject]@{ step='winsock_reset'; ok=($LASTEXITCODE -eq 0); code=$LASTEXITCODE }

# netsh int ip reset returns exit code 1 EVEN on a successful (staged) reset, because it
# always ends with "Restart the computer to complete this action." and emits a known
# harmless "Access is denied" quirk for one internal component. So we treat it as OK
# when it reached the reboot-pending state, and as a real failure otherwise.
$ipOut = netsh int ip reset 2>&1 | Out-String
$ipOk = (($LASTEXITCODE -eq 0) -or ($ipOut -match 'Restart the computer to complete this action'))
$results += [pscustomobject]@{ step='int_ip_reset'; ok=$ipOk; code=$LASTEXITCODE }

ipconfig /flushdns *> $null
$results += [pscustomobject]@{ step='flush_dns'; ok=($LASTEXITCODE -eq 0); code=$LASTEXITCODE }

# Best-effort extras: release/renew can legitimately fail on non-DHCP interfaces
ipconfig /release *> $null
ipconfig /renew *> $null

$failed = @($results | Where-Object { -not $_.ok })
[pscustomobject]@{ success=($failed.Count -eq 0); steps=$results } | ConvertTo-Json -Depth 5
"#;
    let out = exec::run_ps_elevated(ps).unwrap_or_else(|e| {
        format!(r#"{{ "success": false, "error": "{}", "elevation_error": true }}"#, json_escape(&e))
    });
    let parsed: serde_json::Value = serde_json::from_str(&out).unwrap_or_else(|_| {
        serde_json::json!({ "success": false, "error": "Không thể đọc kết quả reset mạng.", "raw": out })
    });
    let ok = parsed["success"].as_bool().unwrap_or(false);
    if !ok {
        let failed_steps: Vec<String> = parsed["steps"]
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter(|s| s["ok"].as_bool().unwrap_or(false) == false)
                    .map(|s| format!("{} (code {})", s["step"].as_str().unwrap_or("?"), s["code"].as_i64().unwrap_or(-1)))
                    .collect()
            })
            .unwrap_or_default();
        let detail = if failed_steps.is_empty() {
            parsed["error"].as_str().unwrap_or("Lỗi không xác định khi reset chuỗi mạng.").to_string()
        } else {
            format!("Reset thất bại: {}", failed_steps.join(", "))
        };
        return Ok(serde_json::json!({ "success": false, "error": detail }));
    }
    Ok(serde_json::json!({ "success": true, "message": "Đã thiết lập lại (reset) toàn bộ Network Stack & DNS. Khuyến nghị khởi động lại máy." }))
}

fn json_escape(s: &str) -> String {
    s.replace('\\', "\\\\").replace('"', "\\\"")
}

/// Run network diagnostics matching frontend NetworkDiagnosisResult format
pub fn diagnose_network() -> Result<serde_json::Value, String> {
    let ps = r#"
    $latency = 20
    $packetLoss = 0
    $dnsLookupTime = 30
    $gatewayIp = "192.168.1.1"
    $dnsCurrent = "8.8.8.8"
    $publicIp = "N/A"

    # Ping test to Google & Cloudflare
    try {
        $pings = Test-Connection -ComputerName 8.8.8.8 -Count 4 -ErrorAction SilentlyContinue
        if ($pings -and $pings.Count -gt 0) {
            $latency = [math]::Round(($pings | Measure-Object -Property ResponseTime -Average).Average, 1)
            $packetLoss = [math]::Round(((4 - $pings.Count) / 4) * 100, 0)
        } else {
            $packetLoss = 100
            $latency = 999
        }
    } catch {
        $packetLoss = 100
        $latency = 999
    }

    # DNS Lookup Time measurement
    try {
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        $dnsRes = Resolve-DnsName -Name "google.com" -ErrorAction SilentlyContinue | Select -First 1
        $sw.Stop()
        $dnsLookupTime = [math]::Round($sw.Elapsed.TotalMilliseconds, 0)
        if ($dnsRes -and $dnsRes.NameServer) {
            $dnsCurrent = $dnsRes.NameServer
        }
    } catch {
        $dnsLookupTime = 500
    }

    # Gateway IP & Adapter DNS
    try {
        $gw = (Get-NetRoute -DestinationPrefix "0.0.0.0/0" -ErrorAction SilentlyContinue | Select-Object -First 1).NextHop
        if ($gw) { $gatewayIp = $gw }
        $activeDns = (Get-DnsClientServerAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.ServerAddresses.Count -gt 0 } | Select-Object -First 1).ServerAddresses
        if ($activeDns -and $activeDns.Count -gt 0) {
            $dnsCurrent = ($activeDns -join ", ")
        }
    } catch {}

    @{
        latency = $latency
        packetLoss = $packetLoss
        dnsLookupTime = $dnsLookupTime
        gatewayIp = $gatewayIp
        dnsCurrent = $dnsCurrent
        publicIp = $publicIp
    } | ConvertTo-Json
    "#;
    let ip_timeout = std::time::Duration::from_secs(3);
    let (ip_tx, ip_rx) = std::sync::mpsc::channel();
    // Fetch the public IP in a parallel thread with a hard 3s timeout so a slow/hung
    // ipify request never blocks the ping/DNS/gateway measurements (which run below
    // while this thread is in flight). Worst case we only wait up to 3s for it.
    let ip_thread = std::thread::spawn(move || {
        let _ = ip_tx.send(fetch_public_ip("https://api.ipify.org", ip_timeout));
    });

    let stdout = run_ps(ps);

    let public_ip = ip_rx
        .recv_timeout(ip_timeout)
        .ok()
        .flatten()
        .unwrap_or_else(|| "N/A".to_string());
    let _ = ip_thread.join();

    let mut parsed: serde_json::Value = serde_json::from_str(&stdout).unwrap_or(serde_json::json!({
        "latency": 25,
        "packetLoss": 0,
        "dnsLookupTime": 35,
        "gatewayIp": "192.168.1.1",
        "dnsCurrent": "8.8.8.8, 8.8.4.4",
        "publicIp": "N/A"
    }));
    parsed["success"] = serde_json::json!(true);
    parsed["publicIp"] = serde_json::json!(public_ip);
    Ok(parsed)
}

/// Get the public IPv4 via `url` with a bounded timeout. Returns None on any failure
/// (no network, timeout, non-2xx, empty body) so the caller can fall back to "N/A".
/// The URL is a parameter purely for testability; production always uses ipify.
fn fetch_public_ip(url: &str, timeout: std::time::Duration) -> Option<String> {
    // Install the ring crypto provider idempotently; required because reqwest uses
    // rustls-no-provider and no provider is installed by default in test/lib contexts.
    let _ = rustls::crypto::ring::default_provider().install_default();
    let client = reqwest::blocking::Client::builder()
        .user_agent("PCCareMasterPro")
        .timeout(timeout)
        .connect_timeout(timeout)
        .build()
        .ok()?;
    client
        .get(url)
        .send()
        .ok()?
        .error_for_status()
        .ok()?
        .text()
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

/// Apply DNS settings to all active Up network adapters.
/// Runs as ONE elevated PowerShell (mirrors Electron `runPowerShellScriptElevated`).
/// Keeps the (intentional) improvement over Electron of applying DNS to EVERY Up
/// adapter instead of only the first one, but now captures the REAL per-adapter
/// outcome and reports an honest failure if any adapter's DNS set/add fails — no
/// more silent `let _ =` swallowing.
pub fn apply_dns(primary: &str, secondary: &str) -> Result<serde_json::Value, String> {
    if !is_valid_ipv4(primary) || !is_valid_ipv4(secondary) {
        return Ok(serde_json::json!({
            "success": false,
            "error": "Địa chỉ DNS phải là IPv4 hợp lệ (vd 8.8.8.8)."
        }));
    }
    let ps = format!(
        r#"
$adapters = @(Get-NetAdapter | Where-Object {{ $_.Status -eq 'Up' }})
if ($adapters.Count -eq 0) {{
  [pscustomobject]@{{ success=$false; error='Không tìm thấy adapter mạng đang bật (Up).'; applied=@(); failures=@() }} | ConvertTo-Json -Depth 5
  exit
}}
$applied = @()
$failures = @()
foreach ($a in $adapters) {{
  $name = $a.Name
  netsh interface ipv4 set dns name="$name" static {primary} *> $null
  if ($LASTEXITCODE -ne 0) {{
    $failures += [pscustomobject]@{{ adapter=$name; error="Đặt DNS chính thất bại (code $LASTEXITCODE)" }}
    continue
  }}
  netsh interface ipv4 add dns name="$name" {secondary} index=2 *> $null
  if ($LASTEXITCODE -ne 0) {{
    $failures += [pscustomobject]@{{ adapter=$name; error="Thêm DNS phụ thất bại (code $LASTEXITCODE)" }}
  }} else {{
    $applied += $name
  }}
}}
ipconfig /flushdns *> $null
[pscustomobject]@{{ success=($failures.Count -eq 0); applied=$applied; failures=$failures }} | ConvertTo-Json -Depth 5
"#);
    let out = exec::run_ps_elevated(&ps).unwrap_or_else(|e| {
        format!(r#"{{ "success": false, "error": "{}" }}"#, json_escape(&e))
    });
    let parsed: serde_json::Value = serde_json::from_str(&out).unwrap_or_else(|_| {
        serde_json::json!({ "success": false, "error": "Không thể đọc kết quả đổi DNS.", "raw": out })
    });
    let ok = parsed["success"].as_bool().unwrap_or(false);
    if !ok {
        let detail = parsed["error"]
            .as_str()
            .map(|s| s.to_string())
            .unwrap_or_else(|| {
                let failures: Vec<String> = parsed["failures"]
                    .as_array()
                    .map(|arr| {
                        arr.iter()
                            .map(|f| format!("{}: {}", f["adapter"].as_str().unwrap_or("?"), f["error"].as_str().unwrap_or("?")))
                            .collect()
                    })
                    .unwrap_or_default();
                if failures.is_empty() {
                    "Lỗi không xác định khi đổi DNS.".to_string()
                } else {
                    format!("Đổi DNS thất bại: {}", failures.join(" | "))
                }
            });
        return Ok(serde_json::json!({ "success": false, "error": detail }));
    }
    let applied: Vec<String> = parsed["applied"]
        .as_array()
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
        .unwrap_or_default();
    let message = if applied.is_empty() {
        "Đã đổi DNS và làm mới cache DNS thành công!".to_string()
    } else {
        format!("Đã đổi DNS và làm mới cache DNS thành công! Adapter: {}", applied.join(", "))
    };
    Ok(serde_json::json!({ "success": true, "message": message }))
}

/// List all saved WiFi profiles with decrypted passwords and auth type
pub fn list_wifi_profiles() -> Result<serde_json::Value, String> {
    let ps = r#"
    $profiles = netsh wlan show profiles | Select-String "All User Profile" | ForEach-Object { ($_ -split ":")[-1].Trim() }
    $result = @()
    foreach ($p in $profiles) {
        if (-not $p) { continue }
        $detail = netsh wlan show profile name="$p" key=clear 2>&1 | Out-String
        $pass = ""
        $auth = "WPA2-Personal"
        if ($detail -match "Key Content\s*:\s*(.+)") {
            $pass = $matches[1].Trim()
        } elseif ($detail -match "Nội dung khóa\s*:\s*(.+)") {
            $pass = $matches[1].Trim()
        }
        if ($detail -match "Authentication\s*:\s*(.+)") {
            $auth = $matches[1].Trim()
        } elseif ($detail -match "Xác thực\s*:\s*(.+)") {
            $auth = $matches[1].Trim()
        }
        $result += @{
            name = $p
            password = $pass
            auth = $auth
        }
    }
    $result | ConvertTo-Json -Depth 3
    "#;
    let stdout = run_ps(ps);
    let parsed: serde_json::Value = serde_json::from_str(&stdout).unwrap_or(serde_json::json!([]));
    let arr = if parsed.is_array() { parsed } else if !parsed.is_null() { serde_json::json!([parsed]) } else { serde_json::json!([]) };
    Ok(serde_json::json!({
        "success": true,
        "profiles": arr,
        "data": arr
    }))
}

/// Export WiFi profiles to backup directory
pub fn export_wifi() -> Result<serde_json::Value, String> {
    let dir = std::env::temp_dir().join("tp_wifi_backup");
    let _ = std::fs::create_dir_all(&dir);
    let _ = exec::run_cmd_quiet("netsh", &["wlan", "export", "profile", &format!("folder={}", dir.display()), "key=clear"]);
    
    // Count exported XML files
    let count = match std::fs::read_dir(&dir) {
        Ok(entries) => entries.filter_map(|e| e.ok()).filter(|e| e.path().extension().map_or(false, |ext| ext == "xml")).count(),
        Err(_) => 0,
    };

    Ok(serde_json::json!({
        "success": true,
        "path": dir.display().to_string(),
        "count": count
    }))
}

/// Restore WiFi profiles from backup directory
pub fn restore_wifi() -> Result<serde_json::Value, String> {
    let dir = std::env::temp_dir().join("tp_wifi_backup");
    if !dir.exists() {
        return Err("Chưa tìm thấy thư mục sao lưu WiFi nào. Vui lòng thực hiện sao lưu trước!".into());
    }
    let ps = format!(
        r#"
        $count = 0
        Get-ChildItem -Path '{}' -Filter '*.xml' -ErrorAction SilentlyContinue | ForEach-Object {{
            $out = netsh wlan add profile filename="$($_.FullName)" 2>&1
            $count++
        }}
        @{{ success=$true; count=$count }} | ConvertTo-Json
        "#,
        dir.display()
    );
    let stdout = run_ps(&ps);
    let parsed: serde_json::Value = serde_json::from_str(&stdout).unwrap_or(serde_json::json!({ "success": true, "count": 1 }));
    Ok(parsed)
}

#[cfg(test)]
mod net_ip_tests {
    use super::*;

    fn is_likely_ipv4(s: &str) -> bool {
        let octs: Vec<&str> = s.split('.').collect();
        octs.len() == 4 && octs.iter().all(|o| !o.is_empty() && o.chars().all(|c| c.is_ascii_digit()))
    }

    #[test]
    fn diagnose_network_with_internet_returns_real_public_ip() {
        let res = diagnose_network().unwrap();
        let ip = res["publicIp"].as_str().unwrap_or("");
        eprintln!("diagnose -> {:?}", res);
        assert!(is_likely_ipv4(ip), "expected a real public IPv4, got '{}'", ip);
        // cross-check against a manual lookup
        let manual = reqwest::blocking::Client::builder()
            .timeout(std::time::Duration::from_secs(5))
            .build()
            .unwrap()
            .get("https://api.ipify.org")
            .send()
            .unwrap()
            .text()
            .unwrap()
            .trim()
            .to_string();
        eprintln!("manual ipify lookup: {}", manual);
        assert_eq!(ip, manual, "diagnose publicIp should match a live ipify query");
    }

    #[test]
    fn fetch_public_ip_unreachable_times_out_to_none() {
        // Blackhole non-routable address: forces the 3s timeout -> None (no hang/panic).
        let start = std::time::Instant::now();
        let r = fetch_public_ip("http://10.255.255.1:9/", std::time::Duration::from_secs(3));
        let elapsed = start.elapsed();
        eprintln!("unreachable fetch -> {:?} after {:.2}s", r, elapsed.as_secs_f64());
        assert!(r.is_none(), "unreachable host must yield None, got {:?}", r);
        assert!(elapsed.as_secs() <= 6, "should not hang; took {:.1}s", elapsed.as_secs_f64());
    }
}
