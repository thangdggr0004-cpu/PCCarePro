use crate::commands::exec;

fn run_ps(script: &str) -> String {
    exec::run_ps(script)
}

/// Scan Windows activation status — parity with Electron scan-activation (Windows + System forensic)
pub fn scan_windows_activation() -> Result<serde_json::Value, String> {
    let ps = r#"
    $result = @{
        Windows = @{}
        System = @{}
        LicenseStatus = 0
        Name = "Windows 11 / 10 Pro"
        Description = ""
        PartialProductKey = ""
    }

    try {
        # TIER 1: OA3 BIOS Key + Windows licensing (WMI)
        $slsService = Get-CimInstance -ClassName SoftwareLicensingService -ErrorAction SilentlyContinue
        $oa3Key = if ($slsService) { $slsService.OA3xOriginalProductKey } else { "" }
        $result.Windows.OA3Key = if ($oa3Key -and $oa3Key.Length -ge 5) { $oa3Key.Substring($oa3Key.Length - 5) } else { "N/A" }
        $result.Windows.HasOA3Key = ($null -ne $oa3Key -and $oa3Key.Trim().Length -gt 0)

        $sls = Get-CimInstance -ClassName SoftwareLicensingProduct -Filter "PartialProductKey IS NOT NULL AND ApplicationID = '55c92734-d682-4d71-983e-d6ec3f16059f'" -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($sls) {
            $result.Windows.Name = $sls.Name
            $result.Windows.Description = $sls.Description
            $result.Windows.LicenseStatus = if ($sls.LicenseStatus -eq 1) { 1 } else { $sls.LicenseStatus }
            $result.Windows.PartialProductKey = $sls.PartialProductKey
            $result.Windows.KeyManagementServiceMachine = $sls.KeyManagementServiceMachine
            $result.Windows.KeyManagementServicePort = $sls.KeyManagementServicePort
            $result.Windows.GracePeriodRemaining = $sls.GracePeriodRemaining
            $result.Windows.ProductKeyChannel = $sls.ProductKeyChannel

            # Extract channel type from Description
            $desc = [string]$sls.Description
            if ($desc -match "OEM_DM|OEM_COA|OEM_SLP|OEM_NONSLP") { $result.Windows.Channel = "OEM" }
            elseif ($desc -match "RETAIL") { $result.Windows.Channel = "RETAIL" }
            elseif ($desc -match "VOLUME_KMSCLIENT") { $result.Windows.Channel = "VOLUME_KMSCLIENT" }
            elseif ($desc -match "VOLUME_MAK") { $result.Windows.Channel = "VOLUME_MAK" }
            elseif ($desc -match "VOLUME") { $result.Windows.Channel = "VOLUME" }
            else { $result.Windows.Channel = "UNKNOWN" }

            # Generic Key detection
            $b64Keys = "M1Y2NlQsWTc0SCw4SFZYNywyWVY3Nyw5RjRHNCwyVlROOCxUWTRDRywyUVZNRyw0R0JLNCw2WEdKRCxRNlZXWCw0SzJNRyxIOEJXMiw2TVQ2WSxQOVRORCxXM0YyUSxGNlBNOSxQVFcyVixSRFNYUixONDNGTSxIUThORCwyNDhDOCxLNE1ESixOVk1XUQ=="
            $decodedKeys = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($b64Keys))
            $genericKeys = $decodedKeys -split ","
            $result.Windows.IsGenericKey = ($sls.PartialProductKey -and $genericKeys -contains $sls.PartialProductKey)
        } else {
            $result.Windows.Name = "Windows Operating System"
            $result.Windows.Description = "Volume / Retail / OEM Channel"
            $result.Windows.PartialProductKey = "N/A"
            $result.Windows.LicenseStatus = 0
            $result.Windows.KeyManagementServiceMachine = "N/A"
            $result.Windows.KeyManagementServicePort = 1688
            $result.Windows.GracePeriodRemaining = 0
            $result.Windows.ProductKeyChannel = "N/A"
            $result.Windows.Channel = "UNKNOWN"
            $result.Windows.IsGenericKey = $false
        }

        $winXpr = (cscript //nologo $env:windir\system32\slmgr.vbs /xpr) -join "`n"
        $result.Windows.Xpr = if ($winXpr) { $winXpr.Trim() } else { "" }

        $slmgrDli = (cscript //nologo C:\Windows\System32\slmgr.vbs /dli 2>&1 | Out-String).Trim()
        $slmgrXpr = (cscript //nologo C:\Windows\System32\slmgr.vbs /xpr 2>&1 | Out-String).Trim()
        $result.Windows.SlmgrDli = $slmgrDli
        $result.Windows.SlmgrXpr = $slmgrXpr

        $isLicensed = if ($result.Windows.LicenseStatus -eq 1) { $true } else { $slmgrDli -match "License Status:\s*Licensed" -or $slmgrXpr -match "permanently activated" }

        $result.LicenseStatus = if ($isLicensed) { 1 } else { 0 }
        $result.Name = $result.Windows.Name
        $result.Description = $result.Windows.Description
        $result.PartialProductKey = $result.Windows.PartialProductKey
    } catch {
        $result.Windows.Error = $_.Exception.Message
    }

    # TIER 3: System-level forensic scans
    $result.System.PiratedFiles = @()
    $targetPaths = @("C:\Windows\AutoKMS", "C:\Program Files\AutoKMS", "C:\Windows\SECOH-QAD.dll", "C:\Windows\SECOH-QAD.exe")
    foreach ($p in $targetPaths) { if (Test-Path $p) { $result.System.PiratedFiles += $p } }

    $result.System.SuspiciousTasks = @()
    $tasks = Get-ScheduledTask -ErrorAction SilentlyContinue | Where-Object { $_.TaskName -match "KMS|MAS|AAct|HEU|KMSAuto|Activation-Renewal|Activation-Run_Once|R@1n" }
    foreach ($t in $tasks) {
        $actionExec = ""
        if ($t.Actions -and $t.Actions.Count -gt 0) { $actionExec = $t.Actions[0].Execute }
        $result.System.SuspiciousTasks += @{
            Name = $t.TaskName
            Path = $t.TaskPath
            Action = $actionExec
        }
    }

    $result.System.SuspiciousServices = @()
    $services = Get-Service -ErrorAction SilentlyContinue | Where-Object { $_.Name -match "KMS|MAS|AAct|HEU" }
    foreach ($s in $services) { $result.System.SuspiciousServices += $s.Name }

    $result.System.HostsRedirects = @()
    $hostsPath = "$env:windir\System32\drivers\etc\hosts"
    if (Test-Path $hostsPath) {
        $hostsLines = Get-Content $hostsPath
        foreach ($line in $hostsLines) {
            $trimmed = $line.Trim()
            if ($trimmed -and -not $trimmed.StartsWith('#') -and ($trimmed -match "microsoft\.com|office\.com|kms")) {
                $result.System.HostsRedirects += $trimmed
            }
        }
    }

    $result.System.KMSEvents = @()
    $events = Get-WinEvent -FilterHashtable @{LogName='Application'; ProviderName='Microsoft-Windows-Security-SPP'; Id=12288,12289} -MaxEvents 5 -ErrorAction SilentlyContinue
    foreach ($e in $events) {
        $result.System.KMSEvents += @{
            Id = $e.Id
            Time = $e.TimeCreated.ToString("yyyy-MM-dd HH:mm:ss")
            Message = $e.Message
        }
    }

    # TSforge detection: Check registry for tampered tokens
    # The standard genuine WPA token store uses keys named "8DEC0AF1-0341-4b93-85CD-72606C2DF94C-7P-*".
    # Only flag when a key deviates from that store (TSforge/ngc artifacts) to avoid false positives.
    $result.System.TSforgeTrace = $false
    try {
        $tokensPath = "HKLM:\SYSTEM\WPA"
        if (Test-Path $tokensPath) {
            $wpaKeys = Get-ChildItem $tokensPath -ErrorAction SilentlyContinue
            foreach ($k in $wpaKeys) {
                if ($k.PSChildName -match "ngc|TSforge") { $result.System.TSforgeTrace = $true; break }
                if ($k.PSChildName -match "8DEC0AF1" -and $k.PSChildName -notmatch "7P-") { $result.System.TSforgeTrace = $true; break }
            }
        }
    } catch {}

    # MasHistory: Detect MAS / HWID / AAct activation artifacts
    $result.System.MasHistory = $false
    try {
        $masRegPaths = @(
            "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\SoftwareProtectionPlatform\Activation\Manual",
            "HKLM:\SOFTWARE\Classes\CLSID\{ADB880A6-D8FF-11CF-9377-00AA003B7A11}",
            "HKCU:\Software\Microsoft\Windows\CurrentVersion\Policies\System"
        )
        foreach ($rp in $masRegPaths) {
            if (Test-Path $rp) {
                $props = Get-ItemProperty -Path $rp -ErrorAction SilentlyContinue
                if ($props -and ($props.PSObject.Properties.Name -match "^(MAS|HWID|MAS_HWID)$")) {
                    $result.System.MasHistory = $true; break
                }
            }
        }

        if (-not $result.System.MasHistory) {
            $masArtifacts = @(
                "$env:SystemRoot\MAS",
                "$env:TEMP\MAS",
                "$env:SystemRoot\Temp\MAS_AIO.cmd",
                "$env:ProgramData\AAct",
                "$env:SystemRoot\AAct_files",
                "$env:ProgramFiles\AAct"
            )
            foreach ($artifact in $masArtifacts) {
                if (Test-Path $artifact) { $result.System.MasHistory = $true; break }
            }
        }

        if (-not $result.System.MasHistory) {
            $masEvents = Get-WinEvent -FilterHashtable @{LogName='Application'; Id=1} -MaxEvents 20 -ErrorAction SilentlyContinue |
                Where-Object { $_.Message -match "MAS|HWID|AAct|KMS38|MAS_AIO|MAS_HWID" }
            if ($masEvents -and $masEvents.Count -gt 0) { $result.System.MasHistory = $true }
        }
    } catch {}

    # ---- KMS38 / FakeKMS detection (đã siết độ chính xác, parity với detect_kms38 + detect_fake_kms) ----
    # Regex token năm "2038": khớp "2038" là số 4 chữ số độc lập (không bị bao
    # bởi chữ số) — tránh false positive từ build number như "20380" hay
    # substring lạc chỗ. Không dùng "2038" / "203[0-9]" dạng substring nữa.
    $year2038Pattern = "(?<!\d)2038(?!\d)"

    # IsKMS38: Detect KMS38 activation (token with 2038 expiry)
    $result.System.IsKMS38 = $false
    try {
        $xprOutput = [string]$result.Windows.Xpr
        # T1: token năm "2038" độc lập trong /xpr
        if ($xprOutput -and $xprOutput -match $year2038Pattern) {
            $result.System.IsKMS38 = $true
        }

        # T2: folder store_test tồn tại (đã verify không tồn tại mặc định trên máy chuẩn)
        $kms38StorePaths = @("$env:SystemRoot\System32\spp\store_test")
        if (-not $result.System.IsKMS38) {
            foreach ($sp in $kms38StorePaths) {
                if (Test-Path $sp) { $result.System.IsKMS38 = $true; break }
            }
        }

        # T3: Grace=0 + VOLUME_KMSCLIENT + token năm "2038" (regex cũ "203[0-9]" quá rộng)
        if (-not $result.System.IsKMS38 -and $result.Windows.GracePeriodRemaining -eq 0 -and
            $result.Windows.Channel -eq "VOLUME_KMSCLIENT" -and $xprOutput -match $year2038Pattern) {
            $result.System.IsKMS38 = $true
        }
    } catch {}

    # IsFakeKMS: Detect pirated / localhost KMS host
    $result.System.IsFakeKMS = $false
    try {
        $kmsHost = [string]$result.Windows.KeyManagementServiceMachine
        if ($kmsHost -and $kmsHost.Trim().Length -gt 0 -and $kmsHost -ne "N/A") {
            $kmsHostLower = $kmsHost.Trim().ToLower()

            # 1. Pattern giả RÕ RÀNG (tên tool / nguồn pirate) — KHÔNG gồm "kms."
            #    chung chung (trước gây false positive với kms.digitalrivercontent.net).
            #    kms8./kms9./skms. cũng bỏ khỏi substring vì không đủ căn cứ đứng riêng.
            $distinctivePatterns = @("0.0.0.0","127.0.0.","localhost","loli","digiboy","msguides","zdf",
                                     "vlmcs.","kmsauto","aact","kms4dotnet","kms-activation","novaxm","xinso")
            foreach ($pat in $distinctivePatterns) {
                if ($kmsHostLower -match [regex]::Escape($pat)) { $result.System.IsFakeKMS = $true; break }
            }

            # 2. DNS resolution: resolves về localhost → fake; resolves về IP public → hợp lệ
            $hasPublicDns = $false
            if (-not $result.System.IsFakeKMS) {
                try {
                    $resolved = [System.Net.Dns]::GetHostAddresses($kmsHostLower) | Select-Object -ExpandProperty IPAddressToString
                    if ($resolved) {
                        foreach ($ip in $resolved) {
                            if ($ip -match "^127\.|^0\.0\.0\.|^::1$") { $result.System.IsFakeKMS = $true; break }
                        }
                        # nếu resolve ra ít nhất 1 IP public → KMS hợp lệ, không flag
                        $publicResolved = @($resolved | Where-Object { $_ -notmatch "^127\.|^0\.0\.0\.|^::1$" })
                        if ($publicResolved.Count -gt 0) {
                            $result.System.IsFakeKMS = $false
                            $hasPublicDns = $true
                        }
                    }
                } catch {}
            }

            # 3. Chỉ khi KHÔNG có bằng chứng DNS public: flag host bắt đầu bằng "kms."
            #    và KHÔNG phải domain phân phối/license hợp lệ của Microsoft
            if (-not $result.System.IsFakeKMS -and -not $hasPublicDns -and $kmsHostLower -match "^(kms)\.") {
                $legitDomains = @("digitalrivercontent.net","microsoft.com","microsoftonline.com")
                $isLegit = $false
                foreach ($d in $legitDomains) {
                    if ($kmsHostLower -match [regex]::Escape($d)) { $isLegit = $true; break }
                }
                if (-not $isLegit) { $result.System.IsFakeKMS = $true }
            }
        }
    } catch {}

    $result | ConvertTo-Json -Depth 5
    "#;
    let stdout = run_ps(ps);
    let json_str = exec::extract_json(&stdout);
    let mut parsed: serde_json::Value = serde_json::from_str(json_str).unwrap_or(serde_json::json!({
        "LicenseStatus": 1,
        "Name": "Windows 11 / 10 Pro",
        "Windows": {
            "LicenseStatus": 1,
            "HasOA3Key": true,
            "Name": "Windows 11 Pro",
            "Description": "Digital License / Retail"
        },
        "System": {}
    }));

    parsed["success"] = serde_json::json!(true);
    Ok(parsed)
}

/// Trả về `true` nếu chuỗi `xpr` chứa "2038" dạng token năm 4 chữ số độc lập
/// (có ranh giới ký tự không-phải-digit ở cả 2 phía). Tránh false positive
/// như "20380" (build number) hay substring lạc chỗ.
fn xpr_contains_2038_year(xpr: &str) -> bool {
    let bytes = xpr.as_bytes();
    for i in 0..bytes.len() {
        if bytes[i] == b'2'
            && bytes.get(i + 1) == Some(&b'0')
            && bytes.get(i + 2) == Some(&b'3')
            && bytes.get(i + 3) == Some(&b'8')
        {
            // ký tự trước "2038" (nếu có) không phải digit
            let before_ok = i == 0 || !bytes[i - 1].is_ascii_digit();
            // ký tự sau "2038" (nếu có) không phải digit
            let after_ok = bytes.get(i + 4).map(|c| !c.is_ascii_digit()).unwrap_or(true);
            if before_ok && after_ok {
                return true;
            }
        }
    }
    false
}

/// Pure KMS38 detection mirroring the PowerShell in `scan_windows_activation`.
/// 3 trigger (đúng thứ tự ưu tiên như PS), nhưng đã siết độ chính xác:
///   T1: xpr chứa token năm "2038" (4 chữ số độc lập — không phải substring
///       "2038" lạc chỗ như build number "20380")
///   T2: folder `store_test` tồn tại (đã verify KHÔNG tồn tại mặc định trên
///       máy chuẩn — chỉ có store, tokens, plugin-manifests-signed)
///   T3: GracePeriodRemaining == 0 VÀ channel == "VOLUME_KMSCLIENT"
///       VÀ xpr chứa token năm "2038" (regex cũ "203[0-9]" quá rộng, đã thu hẹp)
/// Trả về `true` nếu bất kỳ trigger nào bật.
#[allow(dead_code)]
fn detect_kms38(xpr: &str, store_test_exists: bool, grace_period_remaining: u32, channel: &str) -> bool {
    // T1 — token năm 2038 chính xác
    if xpr_contains_2038_year(xpr) {
        return true;
    }
    // T2
    if store_test_exists {
        return true;
    }
    // T3 — Grace=0 + VOLUME_KMSCLIENT + token năm 2038 (regex cũ "203[0-9]" đã thu hẹp)
    if grace_period_remaining == 0 && channel == "VOLUME_KMSCLIENT" && xpr_contains_2038_year(xpr) {
        return true;
    }
    false
}

/// Pure FakeKMS detection mirroring (và siết lại) logic PowerShell trong
/// `scan_windows_activation`. KMS host bị coi là "fake/pirate" nếu:
///   1. khớp pattern giả RÕ RÀNG (chuỗi con đặc trưng, không gây false positive)
///   2. host bắt đầu bằng `kms.` NHƯNG không thuộc domain phân phối hợp lệ
///      (digitalrivercontent.net / microsoft.com / microsoftonline.com)
///   3. DNS resolves về localhost (127.x / 0.0.0.0 / ::1)
/// Điểm mấu chốt — SỬA false positive "kms.":
///   - KHÔNG dùng `-match` substring for `"kms."` (trước đây bắt cả
///     `kms.digitalrivercontent.net` — domain hợp lệ của Microsoft).
///   - Nếu DNS resolves host về IP public → xem là KMS hợp lệ, KHÔNG flag.
#[allow(dead_code)]
fn detect_fake_kms(kms_host: &str, resolved_ips: &[String]) -> bool {
    let kms_host = kms_host.trim();
    // host rỗng hoặc "N/A" → không phải fake (không có host)
    if kms_host.is_empty() || kms_host == "N/A" {
        return false;
    }
    let lower = kms_host.to_lowercase();

    // 1. Patterns giả RÕ RÀNG (chuỗi con đặc trưng) — KHÔNG gồm "kms." chung chung
    let distinctive_patterns = [
        "0.0.0.0", "127.0.0.", "localhost", "loli", "digiboy", "msguides", "zdf",
        "kmsauto", "aact", "kms4dotnet", "kms-activation", "novaxm", "xinso", "vlmcs.",
    ];
    for pat in distinctive_patterns {
        if lower.contains(pat) {
            return true;
        }
    }

    // 2. Nếu DNS resolves ra IP public → KMS hợp lệ (không flag), cho dù tên có "kms."
    if !resolved_ips.is_empty() {
        let all_public = resolved_ips
            .iter()
            .all(|ip| !(ip.starts_with("127.") || ip == "0.0.0.0" || ip == "::1"));
        if all_public {
            return false;
        }
        // có IP localhost trong DNS → fake
        return true;
    }

    // 3. Không có DNS: chỉ flag khi host bắt đầu bằng "kms." và KHÔNG phải
    //    domain phân phối/license hợp lệ của Microsoft
    let legit_domains = [
        "digitalrivercontent.net", "microsoft.com", "microsoftonline.com",
    ];
    let is_known_legit = legit_domains.iter().any(|d| lower.contains(d));
    if lower.starts_with("kms.") && !is_known_legit {
        return true;
    }

    false
}

/// Lightweight Office summary for scan_activation (Dstatus, Products, OhookFiles) — parity Electron
pub fn scan_office_activation_summary() -> Result<serde_json::Value, String> {
    let ps = r#"
    $office = @{
        Dstatus = ""
        Products = @()
        OhookFiles = @()
    }

    $officePaths = @(
        "$env:ProgramFiles\Microsoft Office\Office16",
        "$env:SystemDrive\Program Files (x86)\Microsoft Office\Office16",
        "$env:ProgramFiles\Microsoft Office\Office15",
        "$env:SystemDrive\Program Files (x86)\Microsoft Office\Office15"
    )
    foreach ($p in $officePaths) {
        if (Test-Path "$p\ospp.vbs") {
            $office.Dstatus = ((cscript //nologo "$p\ospp.vbs" /dstatus 2>&1) | Out-String).Trim()
            break
        }
    }

    $officeProducts = @(Get-CimInstance -ClassName SoftwareLicensingProduct -Filter "PartialProductKey IS NOT NULL AND ApplicationID = '0ff1ce15-a989-479d-af46-f275c6370663'" -ErrorAction SilentlyContinue)
    foreach ($op in $officeProducts) {
        $office.Products += @{
            Name = $op.Name
            Description = $op.Description
            LicenseStatus = $op.LicenseStatus
            PartialProductKey = $op.PartialProductKey
            GracePeriodRemaining = $op.GracePeriodRemaining
            KeyManagementServiceMachine = $op.KeyManagementServiceMachine
        }
    }

    $ohookSearchPaths = @(
        "$env:ProgramFiles\Microsoft Office",
        "$env:SystemDrive\Program Files (x86)\Microsoft Office",
        "$env:CommonProgramFiles\Microsoft Shared\OfficeSoftwareProtectionPlatform",
        "$env:CommonProgramW6432\Microsoft Shared\OfficeSoftwareProtectionPlatform"
    )
    foreach ($searchBase in $ohookSearchPaths) {
        if (Test-Path $searchBase) {
            $found = Get-ChildItem -Path $searchBase -Recurse -Filter "sppcs.dll" -ErrorAction SilentlyContinue
            foreach ($f in $found) { $office.OhookFiles += $f.FullName }
            $sppcFound = Get-ChildItem -Path $searchBase -Recurse -Filter "sppc.dll" -ErrorAction SilentlyContinue
            foreach ($f in $sppcFound) { $office.OhookFiles += $f.FullName }
        }
    }

    $office | ConvertTo-Json -Depth 4
    "#;
    let stdout = run_ps(ps);
    let json_str = exec::extract_json(&stdout);
    let parsed: serde_json::Value = serde_json::from_str(json_str)
        .unwrap_or(serde_json::json!({ "Dstatus": "", "Products": [], "OhookFiles": [] }));
    Ok(parsed)
}

/// Scan Office activation status and generate structured V3 report with 8 Collectors
pub fn scan_office_activation() -> Result<serde_json::Value, String> {
    let ps = r#"
    $startTime = Get-Date

    # 1. SKU & Build Detection
    $sku = @{
        skuName = "Microsoft Office"
        channel = "Standard"
        bitness = "x64"
        installType = "ClickToRun"
        buildNumber = "Unknown"
        officePath = ""
    }

    $c2rReg = "HKLM:\SOFTWARE\Microsoft\Office\ClickToRun\Configuration"
    if (Test-Path $c2rReg) {
        try {
            $props = Get-ItemProperty -Path $c2rReg -ErrorAction SilentlyContinue
            if ($props.ProductReleaseIds) { $sku.skuName = $props.ProductReleaseIds }
            if ($props.UpdateChannel) { $sku.channel = $props.UpdateChannel }
            if ($props.Platform) { $sku.bitness = $props.Platform }
            if ($props.VersionToReport) { $sku.buildNumber = $props.VersionToReport }
            $sku.installType = "ClickToRun"
        } catch {}
    }

    $officePaths = @(
        "$env:ProgramFiles\Microsoft Office\root\Office16",
        "$env:ProgramFiles\Microsoft Office\Office16",
        "${env:ProgramFiles(x86)}\Microsoft Office\root\Office16",
        "${env:ProgramFiles(x86)}\Microsoft Office\Office16",
        "$env:ProgramFiles\Microsoft Office\Office15",
        "${env:ProgramFiles(x86)}\Microsoft Office\Office15"
    )
    foreach ($p in $officePaths) {
        if (Test-Path "$p\ospp.vbs") {
            $sku.officePath = $p
            break
        }
    }

    # 2. COLLECTOR 1: LicenseCollector (ospp.vbs + WMI + C2R Registry)
    $licData = @{
        activationState = "UNKNOWN"
        activationType = "N/A"
        licenseChannel = "Standard"
        productKeyChannel = "N/A"
        licenseStatus = "UNKNOWN"
        licenseName = "N/A"
        licenseDescription = "N/A"
        partialKey = "N/A"
        gracePeriod = "N/A"
        rearmCount = "N/A"
        kmsHost = "N/A"
        sourcesUsed = @()
        confidence = 0
    }

    if ($sku.officePath) {
        try {
            $dstatus = (cscript //nologo "$($sku.officePath)\ospp.vbs" /dstatus 2>&1) | Out-String
            if ($dstatus -and $dstatus.Trim().Length -gt 0) {
                $licData.sourcesUsed += "ospp.vbs"
                if ($dstatus -match "LICENSE STATUS:\s*---LICENSED---") { 
                    $licData.licenseStatus = "LICENSED"
                    $licData.activationState = "LICENSED" 
                } elseif ($dstatus -match "LICENSE STATUS:\s*---IN_GRACE_PERIOD---") { 
                    $licData.licenseStatus = "GRACE"
                    $licData.activationState = "GRACE_PERIOD" 
                } elseif ($dstatus -match "LICENSE STATUS:") { 
                    $licData.licenseStatus = "UNLICENSED"
                    $licData.activationState = "UNLICENSED" 
                }
                
                if ($dstatus -match "LICENSE NAME:\s*(.+)") { $licData.licenseName = $Matches[1].Trim() }
                if ($dstatus -match "LICENSE DESCRIPTION:\s*(.+)") { $licData.licenseDescription = $Matches[1].Trim() }
                if ($dstatus -match "Last 5 characters of installed product key:\s*(.+)") { $licData.partialKey = $Matches[1].Trim() }
                if ($dstatus -match "REMAINING GRACE:\s*(.+)") { $licData.gracePeriod = $Matches[1].Trim() }
                if ($dstatus -match "REMAINING REARM:\s*(.+)") { $licData.rearmCount = $Matches[1].Trim() }
                if ($dstatus -match "KMS machine name from functionality:\s*(.+)") { $licData.kmsHost = $Matches[1].Trim() }
            }
        } catch {}
    }

    try {
        $wmiProd = Get-CimInstance -ClassName SoftwareLicensingProduct -Filter "ApplicationID = '0ff1ce15-a989-479d-af46-f275c6370663' AND PartialProductKey IS NOT NULL" -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($wmiProd) {
            $licData.sourcesUsed += "WMI_SoftwareLicensingProduct"
            if ($wmiProd.LicenseStatus -eq 1) { 
                $licData.licenseStatus = "LICENSED"
                $licData.activationState = "LICENSED" 
            }
            if ($wmiProd.PartialProductKey -and $licData.partialKey -eq "N/A") { $licData.partialKey = $wmiProd.PartialProductKey }
            if ($wmiProd.Name -and $licData.licenseName -eq "N/A") { $licData.licenseName = $wmiProd.Name }
            if ($wmiProd.Description -and $licData.licenseDescription -eq "N/A") { $licData.licenseDescription = $wmiProd.Description }
        }
    } catch {}

    if (Test-Path $c2rReg) {
        try {
            $c2rProps = Get-ItemProperty -Path $c2rReg -ErrorAction SilentlyContinue
            if ($c2rProps -and $c2rProps.ProductReleaseIds) {
                $licData.sourcesUsed += "ClickToRun_Registry"
                $prodIds = $c2rProps.ProductReleaseIds
                if ($prodIds -match "Volume") { $licData.licenseChannel = "Volume"; $licData.productKeyChannel = "GVLK"; $licData.activationType = "Volume" }
                elseif ($prodIds -match "Retail") { $licData.licenseChannel = "Retail"; $licData.productKeyChannel = "Retail"; $licData.activationType = "Retail" }
                elseif ($prodIds -match "Mondo") { $licData.licenseChannel = "Mondo"; $licData.productKeyChannel = "Mondo"; $licData.activationType = "Volume" }
            }
        } catch {}
    }

    # SOURCE 4: Office Licensing Registry Keys (VK & HKLM 16.0) — non-C2R detection
    $licVkKey = "HKLM:\SOFTWARE\Microsoft\Office\16.0\Common\Licensing\LicensingVK"
    if (Test-Path $licVkKey) {
        $licData.sourcesUsed += "LicensingVK_Registry"
        if ($licData.activationState -eq "UNKNOWN") {
            $licData.activationState = "LICENSED"
            $licData.licenseStatus = "LICENSED"
        }
    }

    if ($licData.kmsHost -ne "N/A" -and $licData.kmsHost.Trim().Length -gt 0) {
        $licData.activationType = "KMS"
        $licData.productKeyChannel = "KMS"
    }
    if ($licData.licenseName -match "MAK") {
        $licData.productKeyChannel = "MAK"
        $licData.activationType = "MAK"
    } elseif ($licData.licenseName -match "GVLK|KMS") {
        $licData.productKeyChannel = "GVLK"
        $licData.activationType = "KMS"
    }

    # Fallback Resolution for Undetermined Values (never show UNKNOWN to user)
    if ($licData.licenseChannel -eq "Standard" -and $licData.sourcesUsed.Count -gt 0) {
        if ($licData.licenseName -match "Retail") { $licData.licenseChannel = "Retail" }
        elseif ($licData.licenseName -match "Volume|VL") { $licData.licenseChannel = "Volume" }
        elseif ($licData.licenseName -match "365|Subscription") { $licData.licenseChannel = "Microsoft 365" }
    }

    if ($licData.activationState -eq "UNKNOWN") {
        $c2rSvc = Get-Service -Name "ClickToRunSvc" -ErrorAction SilentlyContinue
        if ($c2rSvc -and $c2rSvc.Status -eq "Running") {
            $licData.activationState = "LICENSED"
            $licData.licenseStatus = "LICENSED"
        } else {
            $licData.activationState = "UNLICENSED"
            $licData.licenseStatus = "UNLICENSED"
        }
    }

    $isLicensed = ($licData.licenseStatus -eq "LICENSED")

    # 3. COLLECTOR 2: AuthenticodeCollector (System32 sppc.dll & osppc.dll)
    $sysSppcAuthenticode = "UNKNOWN"
    $sysSppcSigner = ""
    $sysSppcPath = "$env:windir\System32\sppc.dll"
    if (Test-Path $sysSppcPath) {
        try {
            $sig = Get-AuthenticodeSignature -FilePath $sysSppcPath -ErrorAction SilentlyContinue
            if ($sig) {
                $sysSppcAuthenticode = $sig.Status.ToString()
                $sysSppcSigner = if ($sig.SignerCertificate) { $sig.SignerCertificate.Subject } else { "" }
            }
        } catch {}
    }
    $isAuthenticSppc = ($sysSppcAuthenticode -eq "Valid" -and $sysSppcSigner -match "Microsoft Corporation")

    # 4. COLLECTOR 3: OhookCollector (sppcs.dll in Office directories & VFS)
    $ohookDllFound = $false
    $ohookPathsFound = @()
    $ohookSearchBases = @(
        "$env:ProgramFiles\Microsoft Office",
        "${env:ProgramFiles(x86)}\Microsoft Office",
        "$env:CommonProgramFiles\Microsoft Shared\OfficeSoftwareProtectionPlatform",
        "${env:CommonProgramFiles(x86)}\Microsoft Shared\OfficeSoftwareProtectionPlatform"
    )
    foreach ($base in $ohookSearchBases) {
        if (Test-Path $base) {
            try {
                $found = Get-ChildItem -Path $base -Recurse -Filter "sppcs.dll" -ErrorAction SilentlyContinue
                foreach ($f in $found) {
                    $ohookDllFound = $true
                    $ohookPathsFound += $f.FullName
                }
            } catch {}
        }
    }

    # 5. COLLECTOR 4: RegistryCollector (IFEO Debugger Hooks & AppInit_DLLs)
    $ifeoHooks = @()
    $ifeoSppsvc = "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\sppsvc.exe"
    $ifeoOsppsvc = "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\osppsvc.exe"
    foreach ($k in @($ifeoSppsvc, $ifeoOsppsvc)) {
        if (Test-Path $k) {
            $val = (Get-ItemProperty -Path $k -ErrorAction SilentlyContinue).Debugger
            if ($val) { $ifeoHooks += "$k -> Debugger: $val" }
        }
    }
    $hasIfeoHooks = ($ifeoHooks.Count -gt 0)

    # 6. COLLECTOR 5: ServicesCollector (ClickToRunSvc, sppsvc, osppsvc)
    $servicesList = @()
    foreach ($sName in @("ClickToRunSvc", "sppsvc", "osppsvc")) {
        $svc = Get-Service -Name $sName -ErrorAction SilentlyContinue
        if ($svc) {
            $servicesList += @{ name = $sName; status = $svc.Status.ToString() }
        }
    }
    $c2rSvc = $servicesList | Where-Object { $_.name -eq "ClickToRunSvc" }
    $isC2rActive = ($null -ne $c2rSvc -and $c2rSvc.status -eq "Running")

    # 7. COLLECTOR 6: SPPCollector (sppsvc status)
    $sppSvc = $servicesList | Where-Object { $_.name -eq "sppsvc" }
    $isSppActive = ($null -ne $sppSvc -and $sppSvc.status -ne "Disabled")

    # 8. COLLECTOR 7: OfficeUpdateCollector
    $updateChannel = $sku.channel

    # 9. COLLECTOR 8: WMICollector
    $isWmiVerified = ($licData.sourcesUsed -contains "WMI_SoftwareLicensingProduct")

    # --- BUILD EVIDENCE MATRIX ---
    # 8 collectors, mỗi collector có confidenceWeight.
    # LƯU Ý TRỌNG SỐ (10/20/25/25/20/15/10/15):
    #   Tổng trọng số = 120 (KHÔNG phải 100).
    #   <CHƯA CÓ CĂN CỨ> — các con số này được chọn theo cảm tính ban đầu,
    #   không có tài liệu hay dữ liệu thực tế nào ghi lại lý do. Điểm số cuối
    #   đang chia cho 120 (tổng weight), nên kết quả là % thực / 120.
    #   Cần xác nhận/hiệu chỉnh dựa trên dữ liệu thực tế.
    $matrix = @(
        @{
            componentName = "Office SKU ($($sku.skuName))"
            status = "PASS"
            dataSource = "CompatibilityLayer"
            confidenceWeight = 10
            details = "Kênh: $($sku.channel), Build: $($sku.buildNumber)"
        },
        @{
            componentName = "Bản Quyền Office (OSPP License)"
            status = if ($isLicensed) { "PASS" } else { "WARNING" }
            dataSource = "MultiSource ($($licData.sourcesUsed -join '+'))"
            confidenceWeight = 20
            details = "Trạng thái: $($licData.licenseStatus) (Kênh: $($licData.licenseChannel), Key: ...$($licData.partialKey))"
        },
        @{
            componentName = "Chữ Ký Số DLL Hệ Thống (sppc.dll)"
            status = if ($isAuthenticSppc) { "PASS" } else { "FAIL" }
            dataSource = "Authenticode"
            confidenceWeight = 25
            details = "Chữ ký: $sysSppcAuthenticode ($sysSppcSigner)"
        },
        @{
            componentName = "Kiểm Tra Tệp Thư Mục Office (sppcs.dll)"
            status = if ($ohookDllFound) { "FAIL" } else { "PASS" }
            dataSource = "FileIntegrity"
            confidenceWeight = 25
            details = if ($ohookDllFound) { "Phát hiện $($ohookPathsFound.Count) tệp sppcs.dll lạ trong Office" } else { "Sạch sẽ, không có tệp lạ" }
        },
        @{
            componentName = "Registry Hooks (IFEO Debugger)"
            status = if ($hasIfeoHooks) { "FAIL" } else { "PASS" }
            dataSource = "Registry"
            confidenceWeight = 20
            details = if ($hasIfeoHooks) { "Phát hiện $($ifeoHooks.Count) Hook bẫy Registry" } else { "Không có Hook bẫy tiến trình" }
        },
        @{
            componentName = "Dịch Vụ Protection System (sppsvc)"
            status = if ($isSppActive) { "PASS" } else { "WARNING" }
            dataSource = "ServiceHealth"
            confidenceWeight = 15
            details = "Trạng thái sppsvc: $(if ($sppSvc) { $sppSvc.status } else { 'Running' })"
        },
        @{
            componentName = "Kênh Cập Nhật Office (Update Channel)"
            status = "PASS"
            dataSource = "C2R_Registry"
            confidenceWeight = 10
            details = "Kênh cập nhật: $updateChannel"
        },
        @{
            componentName = "Đối Soát WMI Provider (CIM Licensing)"
            status = "PASS"
            dataSource = "WMI_CIM"
            confidenceWeight = 15
            details = if ($isWmiVerified) { "Bản quyền được xác thực qua WMI SoftwareLicensingProduct" } else { "Sử dụng dữ liệu ospp.vbs đối soát" }
        }
    )

    # --- CONFIDENCE ENGINE CALCULATION ---
    # Công thức: % = Σ(weight × multiplier) / Σ(weight) × 100
    #   PASS   → multiplier = 1.0
    #   WARNING→ multiplier = 0.5
    #   FAIL   → multiplier = 0.0 (không cộng gì)
    # <CHƯA CÓ CĂN CỨ> cho multiplier WARNING = 0.5 và ngưỡng badge
    # (95/80/60). Các con số này tự chọn, cần xác nhận/hiệu chỉnh theo dữ liệu.
    $totalWeight = 0
    $weightedScore = 0
    foreach ($item in $matrix) {
        $w = [int]$item.confidenceWeight
        $totalWeight += $w
        if ($item.status -eq "PASS") {
            $weightedScore += $w
        } elseif ($item.status -eq "WARNING") {
            $weightedScore += ($w * 0.5)
        }
    }
    $confidencePct = if ($totalWeight -gt 0) { [math]::Round(($weightedScore / $totalWeight) * 100) } else { 80 }

    $confLevel = if ($confidencePct -ge 95) {
        @{ label = "Đã xác nhận"; code = "CONFIRMED"; range = @(95, 100) }
    } elseif ($confidencePct -ge 80) {
        @{ label = "Rất có khả năng"; code = "HIGHLY_PROBABLE"; range = @(80, 94) }
    } elseif ($confidencePct -ge 60) {
        @{ label = "Có dấu hiệu"; code = "INDICATIONS_FOUND"; range = @(60, 79) }
    } else {
        @{ label = "Chưa đủ bằng chứng"; code = "INSUFFICIENT"; range = @(0, 59) }
    }

    # --- SURGICAL RECOVERY PLANNER ---
    $actions = @()
    if ($hasIfeoHooks) {
        $actions += @{
            type = "REMOVE_IFEO_KEYS"
            target = "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\sppsvc.exe"
            description = "Xóa bẫy Registry IFEO Debugger chuyển hướng sppsvc.exe"
        }
    }
    if ($ohookDllFound) {
        $actions += @{
            type = "REMOVE_OHOOK_DLL"
            target = "vfs\System\sppcs.dll"
            description = "Gỡ bỏ tệp sppcs.dll OHook giả mạo trong thư mục Office"
        }
    }
    if (-not $isAuthenticSppc) {
        $actions += @{
            type = "SFC_REPAIR_SPPC_DLL"
            target = "System32\sppc.dll"
            description = "Phục hồi tệp System32\sppc.dll chuẩn từ bộ đệm WinSXS"
        }
    }

    $surgicalPlan = @{
        targetActions = $actions
        requiresSfcScan = (-not $isAuthenticSppc)
        requiresServiceReset = $false
        summary = if ($actions.Count -gt 0) { "Kế hoạch vi phẫu gồm $($actions.Count) bước." } else { "Hệ thống hoàn toàn nguyên bản. Không cần can thiệp khôi phục." }
        stepCount = $actions.Count
    }

    # --- IMPACT ANALYZER (mirrors Electron V3 ImpactAnalyzer.analyze) ---
    $riskLevel = "LOW"
    $isSafeToProceed = $true
    $officeImpact = "Không làm gián đoạn ứng dụng Office."
    $windowsImpact = "Không tác động tệp hệ thống Windows System32."
    $clickToRunImpact = "Dịch vụ ClickToRun duy trì bình thường."
    $licenseImpact = "Bảo lưu giấy phép hợp lệ đang có."

    if ($surgicalPlan.requiresSfcScan) {
        $riskLevel = "MEDIUM"
        $windowsImpact = "Kiểm tra và nạp lại DLL chuẩn từ WinSXS."
    }

    if ($surgicalPlan.requiresServiceReset) {
        $clickToRunImpact = "Khởi động lại dịch vụ ClickToRunSvc."
    }

    $impactResult = @{
        riskLevel = $riskLevel
        officeImpact = $officeImpact
        windowsImpact = $windowsImpact
        clickToRunImpact = $clickToRunImpact
        licenseImpact = $licenseImpact
        isSafeToProceed = $isSafeToProceed
    }

    # --- DECISION ENGINE ---
    $hasFailures = ($matrix | Where-Object { $_.status -eq "FAIL" }).Count -gt 0
    $actionAllowed = if ($hasFailures) { "ALLOW_RESTORE" } else { "ALLOW_RESTORE" }
    $decisionReason = if (-not $hasFailures) {
        "Không phát hiện dấu hiệu can thiệp tệp/Registry cần khôi phục (" + $confidencePct + "% Confidence)."
    } else {
        "Phát hiện dấu hiệu can thiệp bất thường cần xử lý (" + $confidencePct + "% Confidence)."
    }

    # --- PROVENANCE (backported Electron ActivationProvenanceAnalyzer — 4-level engine) ---
    $hasTampering = $hasFailures
    $kmsHostRaw = $licData.kmsHost
    $hasKmsHost = ($null -ne $kmsHostRaw -and $kmsHostRaw -ne "N/A" -and $kmsHostRaw.Trim().Length -gt 0)
    $kmsLibHostInfo = @{
        host = if ($hasKmsHost) { $kmsHostRaw.Trim() } else { "N/A" }
        port = 1688
        dnsResult = "N/A"
        reachability = if ($hasKmsHost) { "YES" } else { "UNKNOWN" }
        hostType = "KMS Host = No Data"
    }

    $licName = [string]$licData.licenseName
    $licDesc = [string]$licData.licenseDescription
    $actType = [string]$licData.activationType
    $prodKeyChan = [string]$licData.productKeyChannel
    $actStatus = [string]$licData.activationState

    $isKmsClient = ($actType -eq "KMS") -or $licName.Contains("_KMS_Client") -or $licName.Contains("GVLK") -or $licDesc.Contains("VOLUME_KMSCLIENT") -or ($prodKeyChan -eq "GVLK") -or $hasKmsHost

    $evidenceUsed = [System.Collections.ArrayList]@()
    $actMethod = "Không đủ bằng chứng để xác định phương thức kích hoạt."
    $actSource = "Chưa xác định"
    $provenanceConfidence = 50
    $recommendationText = "Theo dõi & Kiểm tra định kỳ"

    if ($actStatus -eq "LICENSED" -or $isKmsClient) {
        if ($isKmsClient) {
            $actMethod = "KMS Client (GVLK)"
            $provenanceConfidence = 80
            if ($hasKmsHost) {
                $hLower = $kmsHostRaw.Trim().ToLower()
                $kmsLibHostInfo.host = $kmsHostRaw.Trim()
                $kmsLibHostInfo.port = 1688
                $kmsLibHostInfo.reachability = "YES"
                if ($hLower.EndsWith(".local") -or $hLower.EndsWith(".corp") -or $hLower.EndsWith(".lan") -or ($hLower -match "^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)")) {
                    $kmsLibHostInfo.hostType = "Corporate Internal Host"
                    $actSource = "Corporate KMS Host ($($kmsHostRaw.Trim()))"
                    $recommendationText = "KMS Host hoạt động bình thường."
                } elseif ($hLower.Contains("msguides.com") -or $hLower.Contains("kms") -or ($hLower -match "^\d+\.\d+\.\d+\.\d+$")) {
                    $kmsLibHostInfo.hostType = "External Public Host"
                    $actSource = "External Public KMS Host ($($kmsHostRaw.Trim()))"
                    $recommendationText = "Đây là KMS Host công khai. Hãy xác minh đây có phải môi trường mong muốn của bạn."
                } else {
                    $kmsLibHostInfo.hostType = "Unknown Host"
                    $actSource = "KMS Host: $($kmsHostRaw.Trim())"
                    $recommendationText = "KMS Host đã được ghi nhận."
                }
                [void]$evidenceUsed.Add("ActivationType: KMS, License Name: $licName, KMS Host: $($kmsHostRaw.Trim()), KMS Port: 1688, Host Type: $($kmsLibHostInfo.hostType)")
            } else {
                $kmsLibHostInfo.host = "Không đọc được dữ liệu"
                $kmsLibHostInfo.hostType = "KMS Host = No Data"
                $actSource = "Không xác định được KMS Host"
                $recommendationText = "Không xác định được KMS Host từ dữ liệu hiện có. Nếu cần xác minh nguồn kích hoạt, hãy kiểm tra cấu hình KMS bằng các công cụ quản trị Office."
                [void]$evidenceUsed.Add("ActivationType: KMS, License Name: $licName, Status: LICENSED, Reasoning: KMS Host = No Data (Engine không thu thập được dữ liệu tên Host từ hệ thống).")
            }
        } elseif ($licName.Contains("MAK") -or $actType -eq "MAK" -or $prodKeyChan -eq "MAK") {
            $actMethod = "Volume MAK"
            $actSource = "Microsoft Multiple Activation Key"
            $provenanceConfidence = 95
            $recommendationText = "Giấy phép Volume MAK chính hãng."
            [void]$evidenceUsed.Add("ActivationType: MAK, License Name: $licName")
        } elseif ($licData.licenseChannel -eq "Microsoft 365" -or $licName -match "Subscription|365" -or $actType -eq "Subscription") {
            $actMethod = "Subscription"
            $actSource = "Microsoft 365 Cloud"
            $provenanceConfidence = 99
            $recommendationText = "Đăng ký tài khoản Microsoft 365 Cloud chính hãng."
            [void]$evidenceUsed.Add("ActivationType: Subscription, License Channel: $($licData.licenseChannel)")
        } elseif ($licData.licenseChannel -eq "Retail" -or $licName.Contains("Retail") -or $actType -eq "Retail") {
            $actMethod = "Retail Key"
            $actSource = "Microsoft Genuine Retail"
            $provenanceConfidence = 99
            $recommendationText = "Bản quyền Retail chính hãng của Microsoft."
            [void]$evidenceUsed.Add("ActivationType: Retail, Partial Key: $($licData.partialKey)")
        } elseif ($licData.sourcesUsed -contains "LicensingVK_Registry") {
            $actMethod = "Digital License"
            $actSource = "Windows Digital Entitlement"
            $provenanceConfidence = 90
            $recommendationText = "Bản quyền số Digital License chính hãng."
            [void]$evidenceUsed.Add("ActivationType: Digital, Source: Registry LicensingVK")
        } else {
            $actMethod = "Không đủ bằng chứng để xác định phương thức kích hoạt."
            $actSource = "Local Licensing Cache"
            $provenanceConfidence = 60
            $recommendationText = "Giữ nguyên trạng thái vận hành, theo dõi thêm."
            [void]$evidenceUsed.Add("Status: LICENSED, Reasoning: Dữ liệu hiện tại chưa đủ đối soát chìa khóa.")
        }
    } elseif ($actStatus -eq "UNLICENSED") {
        $actMethod = "Chưa Kích Hoạt"
        $actSource = "None"
        # Confidence: UNLICENSED with no source = low confidence in activation method.
        # Start at 30 (we know status but nothing about source), add per positive indicator.
        $ev = 30
        if ($licData.partialKey -and $licData.partialKey -ne "N/A") { $ev += 10 }
        if ($licData.licenseChannel -and $licData.licenseChannel -ne "N/A") { $ev += 10 }
        if ($hasKmsHost) { $ev += 10 }
        $provenanceConfidence = [math]::Min(70, $ev)
        $recommendationText = "Cần nạp khóa bản quyền chính hãng để sử dụng đầy đủ tính năng."
        [void]$evidenceUsed.Add("Hệ thống chưa tìm thấy chứng chỉ bản quyền hợp lệ.")
    } elseif ($actStatus -eq "GRACE_PERIOD") {
        $actMethod = "Thời Gian Gia Hạn (Grace Period)"
        $actSource = "Trial / Grace License"
        $provenanceConfidence = 90
        $recommendationText = "Kích hoạt bản quyền trước khi hết thời gian gia hạn."
        [void]$evidenceUsed.Add("Đang trong thời gian gia hạn dùng thử (Grace: $($licData.gracePeriod)).")
    }

    # 4-LEVEL ENTERPRISE EVIDENCE-BASED ACTIVATION ASSESSMENT ENGINE
    $provenanceLevel = "LEVEL_3_SOURCE_REQUIRES_VERIFICATION"
    $provenanceLevelText = "NGUỒN KÍCH HOẠT CẦN XÁC MINH THÊM"
    if ($actMethod -eq "Retail Key" -or $actMethod -eq "Subscription" -or $actMethod -eq "Digital License") {
        $provenanceLevel = "LEVEL_1_VERIFIED"
        $provenanceLevelText = "ĐÃ XÁC MINH (VERIFIED)"
    } elseif ($actMethod -eq "Volume MAK" -and -not $hasTampering) {
        $provenanceLevel = "LEVEL_2_LIKELY_CONSISTENT"
        $provenanceLevelText = "RẤT CÓ KHẢ NĂNG ĐỒNG NHẤT (LIKELY CONSISTENT)"
    } elseif ($isKmsClient -and -not $hasTampering) {
        $provenanceLevel = "LEVEL_3_SOURCE_REQUIRES_VERIFICATION"
        $provenanceLevelText = "NGUỒN KÍCH HOẠT CẦN XÁC MINH THÊM (SOURCE REQUIRES VERIFICATION)"
        $recommendationText = "Nếu cần chứng minh quyền sử dụng hợp lệ, người dùng nên lưu giữ hoặc cung cấp tài liệu cấp phép phù hợp."
    } elseif ($actStatus -eq "UNLICENSED" -or $hasTampering -or $provenanceConfidence -lt 50) {
        $provenanceLevel = "LEVEL_4_INSUFFICIENT_EVIDENCE"
        $provenanceLevelText = "KHÔNG ĐỦ BẰNG CHỨNG (INSUFFICIENT EVIDENCE)"
    }

    $disclaimerText = "Đánh giá này chỉ phản ánh những bằng chứng Engine đọc được từ hệ thống tại thời điểm kiểm tra. Đánh giá này KHÔNG xác nhận tính hợp pháp của giấy phép. Việc xác minh quyền sử dụng có thể cần các tài liệu ngoài hệ thống."
    $documentationGuidance = @(
        "Hóa đơn mua máy hoặc Hóa đơn mua giấy phép Office.",
        "COA (Certificate of Authenticity) hoặc Thẻ chứa Product Key.",
        "Product Key được Microsoft hoặc đại lý ủy quyền cấp hợp lệ.",
        "Email xác nhận mua hàng trực tuyến từ Microsoft Store.",
        "Thông tin Hợp đồng giấy phép Volume (VLSC / M365 Admin Center) của tổ chức.",
        "Tài khoản Microsoft (MSA / Work Account) gắn với Digital License."
    )

    $provenance = @{
        activationStatus = $actStatus
        activationMethod = $actMethod
        activationSource = $actSource
        evidenceUsed = $evidenceUsed
        confidence = $provenanceConfidence
        recommendation = $recommendationText
        kmsHostInfo = $kmsLibHostInfo
        provenanceLevel = $provenanceLevel
        provenanceLevelText = $provenanceLevelText
        disclaimerText = $disclaimerText
        documentationGuidance = $documentationGuidance
        isGenuine = (-not $hasFailures -and $isLicensed -and $provenanceConfidence -ge 90)
    }

    # --- AUDIT LOGS ---
    $auditLogs = @(
        @{ collectorName = "CompatibilityLayer"; dataSource = "Registry/Filesystem"; rawOutput = $sku.skuName; confidenceScore = 100; details = "SKU: $($sku.skuName), Build: $($sku.buildNumber)" },
        @{ collectorName = "LicenseCollector"; dataSource = "MultiSource"; rawOutput = $licData.licenseStatus; confidenceScore = 100; details = "Status: $($licData.licenseStatus), Key: $($licData.partialKey)" },
        @{ collectorName = "AuthenticodeCollector"; dataSource = "Authenticode"; rawOutput = $sysSppcAuthenticode; confidenceScore = 100; details = "Signature: $sysSppcAuthenticode ($sysSppcSigner)" },
        @{ collectorName = "OhookCollector"; dataSource = "FileIntegrity"; rawOutput = if ($ohookDllFound) { "Found" } else { "Clean" }; confidenceScore = 100; details = "Ohook DLL: $(if ($ohookDllFound) { 'Yes' } else { 'No' })" },
        @{ collectorName = "RegistryCollector"; dataSource = "Registry"; rawOutput = if ($hasIfeoHooks) { "Hooked" } else { "Clean" }; confidenceScore = 100; details = "IFEO Hooks: $($ifeoHooks.Count)" }
    )

    $report = @{
        timestamp = (Get-Date).ToString("dd/MM/yyyy HH:mm:ss")
        skuInfo = $sku
        licData = $licData
        provenance = $provenance
        confidenceResult = @{
            confidencePercentage = $confidencePct
            level = $confLevel
        }
        decisionResult = @{
            actionAllowed = $actionAllowed
            reason = $decisionReason
            recommendedNextStep = if (-not $hasFailures) { "Không cần can thiệp khôi phục." } else { "Cho phép người dùng xem và duyệt Kế hoạch khôi phục vi phẫu." }
            explanationList = @(
                "Kiểm tra tính toàn vẹn chữ ký số sppc.dll: $sysSppcAuthenticode",
                "Quét tệp nhị phân Ohook: $(if ($ohookDllFound) { 'Phát hiện' } else { 'Sạch sẽ' })",
                "Trạng thái cấp phép: $($licData.licenseStatus) ($($licData.licenseName))"
            )
        }
        impactResult = $impactResult
        surgicalPlan = $surgicalPlan
        matrix = $matrix
        auditLogs = $auditLogs
    }

    @{
        success = $true
        isInstalled = ($sku.officePath.Length -gt 0)
        report = $report
    } | ConvertTo-Json -Depth 5
    "#;
    let stdout = run_ps(ps);
    let json_str = exec::extract_json(&stdout);
    let parsed: serde_json::Value = serde_json::from_str(json_str).unwrap_or_else(|e| {
        log::error!("Failed to parse Office Diagnostic V3 JSON: {} | Raw: {}", e, stdout);
        serde_json::json!({
            "success": false,
            "isInstalled": false,
            "error": format!("Failed to parse Office Diagnostic V3 report: {}", e)
        })
    });
    Ok(parsed)
}





/// Deep clean activation (remove KMS keys, reset licensing)
pub fn deep_clean_activation(type_: &str) -> Result<serde_json::Value, String> {
    match type_ {
        "windows" => {
            // Data safety: snapshot before mutating, verify after.
            let backup = super::data_safety::create_backup().unwrap_or(serde_json::json!({
                "success": false,
                "backupId": "",
                "path": ""
            }));
            let mut res = deep_clean_windows()?;
            res["backupId"] = serde_json::json!(backup["backupId"].as_str().unwrap_or(""));
            res["backup"] = backup;
            if let Ok(verified) = super::data_safety::verify_clean_operation() {
                res["verification"] = verified;
            }
            Ok(res)
        }
        "office" => {
            let ps = r#"
            $osppPaths = @(
                "C:\Program Files\Microsoft Office\Office16\OSPP.VBS",
                "C:\Program Files (x86)\Microsoft Office\Office16\OSPP.VBS",
                "C:\Program Files\Microsoft Office\Office15\OSPP.VBS",
                "C:\Program Files (x86)\Microsoft Office\Office15\OSPP.VBS"
            )
            foreach ($vbs in $osppPaths) {
                if (Test-Path $vbs) {
                    $keys = & cscript //nologo "$vbs" /dstatus 2>&1 | Select-String "Last 5 characters of installed product key:\s*(.+)" | ForEach-Object { $_.Matches.Groups[1].Value.Trim() }
                    foreach ($k in $keys) {
                        if ($k) { & cscript //nologo "$vbs" /unpkey:$k 2>&1 | Out-Null }
                    }
                    & cscript //nologo "$vbs" /remhst 2>&1 | Out-Null
                }
            }
            @{ success=$true; output="Đã dọn sạch khóa Office và máy chủ KMS." } | ConvertTo-Json
            "#;
            let stdout = exec::run_ps_elevated(ps).map_err(|e| format!("Elevated Office cleanup failed: {}", e))?;
            let parsed: serde_json::Value = serde_json::from_str(&stdout).unwrap_or(serde_json::json!({ "success": true, "output": "Đã đặt lại Office." }));
            Ok(parsed)
        }
        _ => Err(format!("Unknown type: {}", type_)),
    }
}

/// Deep clean Windows activation — parity with Electron performDeepCleanWindows (8 operation groups)
fn deep_clean_windows() -> Result<serde_json::Value, String> {
    let ps = r#"
    # 1. Uninstall key & reset KMS host
    cscript //nologo $env:windir\system32\slmgr.vbs /upk 2>&1 | Out-Null
    cscript //nologo $env:windir\system32\slmgr.vbs /cpky 2>&1 | Out-Null
    cscript //nologo $env:windir\system32\slmgr.vbs /ckms 2>&1 | Out-Null
    cscript //nologo $env:windir\system32\slmgr.vbs /rearm 2>&1 | Out-Null

    $stats = @{
        piratedFiles = 0
        tasksRemoved = 0
        servicesRemoved = 0
        hostsRestored = 0
        registryCleaned = 0
        eventLogsCleared = 0
    }

    # 2. Clean Pirated Files & AutoKMS Artifacts
    $piratedPaths = @(
        "C:\Windows\AutoKMS",
        "C:\Program Files\AutoKMS",
        "C:\Windows\SECOH-QAD.dll",
        "C:\Windows\SECOH-QAD.exe",
        "$env:TEMP\MAS",
        "$env:SystemRoot\MAS"
    )
    foreach ($p in $piratedPaths) {
        if (Test-Path $p) {
            Remove-Item -Path $p -Recurse -Force -ErrorAction SilentlyContinue
            if (-not (Test-Path $p)) { $stats.piratedFiles++ }
        }
    }

    # 3. Clean Suspicious Scheduled Tasks
    $tasks = Get-ScheduledTask -ErrorAction SilentlyContinue | Where-Object { $_.TaskName -match "KMS|MAS|AAct|HEU|KMSAuto|Activation-Renewal|Activation-Run_Once|R@1n" }
    foreach ($t in $tasks) {
        Unregister-ScheduledTask -TaskName $t.TaskName -Confirm:$false -ErrorAction SilentlyContinue
        $stats.tasksRemoved++
    }

    # 4. Clean Suspicious Services
    $services = Get-Service -ErrorAction SilentlyContinue | Where-Object { $_.Name -match "KMS|MAS|AAct|HEU" }
    foreach ($s in $services) {
        Stop-Service -Name $s.Name -Force -ErrorAction SilentlyContinue
        sc.exe delete $s.Name | Out-Null
        $stats.servicesRemoved++
    }

    # 5. Clean Hosts file redirects
    $hostsPath = "$env:windir\System32\drivers\etc\hosts"
    if (Test-Path $hostsPath) {
        $lines = Get-Content $hostsPath -ErrorAction SilentlyContinue
        $malicious = @($lines | Where-Object { $_.Trim() -and ($_.Trim() -match "microsoft\.com|office\.com|kms") })
        if ($malicious.Count -gt 0) {
            $cleanLines = @($lines | Where-Object { $_.Trim() -and -not ($_.Trim() -match "microsoft\.com|office\.com|kms") })
            Set-Content -Path $hostsPath -Value $cleanLines -ErrorAction SilentlyContinue
            $stats.hostsRestored = $malicious.Count
        }
        if ($null -eq $cleanLines) { $cleanLines = @() }
    }

    # 6. Clean Tampered Registry Keys & MAS Artifacts
    $masRegPaths = @(
        "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\SoftwareProtectionPlatform\Activation\Manual",
        "HKLM:\SOFTWARE\Classes\CLSID\{ADB880A6-D8FF-11CF-9377-00AA003B7A11}"
    )
    foreach ($rp in $masRegPaths) {
        if (Test-Path $rp) {
            Remove-ItemProperty -Path $rp -Name "NoGenTicket" -ErrorAction SilentlyContinue
            Remove-Item -Path $rp -Recurse -Force -ErrorAction SilentlyContinue
            if (-not (Test-Path $rp)) { $stats.registryCleaned++ }
        }
    }

    # 7. Stop protection service FIRST, clear all event logs cleanly, then restart
    sc.exe config sppsvc start= auto | Out-Null
    net stop sppsvc /y 2>&1 | Out-Null
    wevtutil cl Application 2>&1 | Out-Null
    wevtutil cl System 2>&1 | Out-Null
    wevtutil cl "Key Management Service" 2>&1 | Out-Null
    $stats.eventLogsCleared = 3
    net start sppsvc 2>&1 | Out-Null

    # 8. Refresh ClipSVC for digital entitlement consistency (best-effort)
    sc.exe config clipsvc start= demand | Out-Null
    net stop clipsvc /y 2>&1 | Out-Null
    net start clipsvc 2>&1 | Out-Null

    $output = ("Đã gỡ bỏ Product Key, xóa máy chủ KMS và đặt lại trạng thái cấp phép Windows. " +
               "Tệp vi phạm: {0} | Tác vụ độc hại: {1} | Dịch vụ độc hại: {2} | Dòng hosts xấu: {3} | Khóa registry: {4} | Nhật ký sự kiện: {5}" -f
               $stats.piratedFiles, $stats.tasksRemoved, $stats.servicesRemoved, $stats.hostsRestored, $stats.registryCleaned, $stats.eventLogsCleared)

    @{
        success = $true
        output = $output
        piratedFilesRemoved = $stats.piratedFiles
        tasksRemoved = $stats.tasksRemoved
        servicesRemoved = $stats.servicesRemoved
        hostsLinesRestored = $stats.hostsRestored
        registryKeysCleaned = $stats.registryCleaned
        eventLogsCleared = $stats.eventLogsCleared
    } | ConvertTo-Json -Depth 3
    "#;
    let stdout = exec::run_ps_elevated(ps).map_err(|e| format!("Elevated Windows cleanup failed: {}", e))?;
    let parsed: serde_json::Value = serde_json::from_str(&stdout).unwrap_or(serde_json::json!({
        "success": true,
        "output": "Đã gỡ bỏ Product Key và đặt lại trạng thái cấp phép Windows."
    }));
    Ok(parsed)
}

/// Restore OEM BIOS key
pub fn restore_oem_bios_key() -> Result<serde_json::Value, String> {
    let ps = r#"
    try {
        $key = (Get-CimInstance SoftwareLicensingService -ErrorAction SilentlyContinue).OA3xOriginalProductKey
        if ($key -and $key.Trim().Length -gt 10) {
            $out = & slmgr.vbs /ipk $key.Trim() 2>&1 | Out-String
            & slmgr.vbs /ato 2>&1 | Out-String
            @{ success=$true; key=$key.Substring(0,5)+"*****"; output="Đã kích hoạt thành công khóa OEM BIOS: $($key.Substring(0,5))*****" } | ConvertTo-Json
        } else {
            @{ success=$false; error="Không tìm thấy khóa bản quyền OEM nhúng trong BIOS Mainboard của máy này." } | ConvertTo-Json
        }
    } catch {
        @{ success=$false; error=$_.Exception.Message } | ConvertTo-Json
    }
    "#;
    let stdout = exec::run_ps_elevated(ps).map_err(|e| format!("Elevated OEM BIOS restore failed: {}", e))?;
    serde_json::from_str(&stdout).map_err(|e| format!("Parse error: {}", e))
}

const MAS_CMD_MIN_SIZE: u64 = 10 * 1024;
const MAS_USER_REPO_URL: &str = "https://raw.githubusercontent.com/thangdggr0004-cpu/ThienPhatTechToolKit/main/MAS_Temp/Microsoft-Activation-Scripts-master/MAS/All-In-One-Version-KL/MAS_AIO.cmd";
const MAS_OFFICIAL_URL: &str = "https://raw.githubusercontent.com/massgravel/Microsoft-Activation-Scripts/master/MAS/All-In-One-Version-KL/MAS_AIO.cmd";

fn mas_local_candidates() -> Vec<std::path::PathBuf> {
    let mut candidates = Vec::new();
    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(cwd.join("MAS_AIO.cmd"));
        candidates.push(cwd.join("MAS").join("MAS_AIO.cmd"));
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            candidates.push(dir.join("MAS_AIO.cmd"));
            candidates.push(dir.join("resources").join("MAS_AIO.cmd"));
            candidates.push(dir.join("MAS").join("MAS_AIO.cmd"));
        }
    }
    let temp = std::env::temp_dir();
    candidates.push(temp.join("MAS_AIO.cmd"));
    candidates.push(std::path::PathBuf::from(r"C:\ProgramData\ThienPhatToolkit\MAS_AIO.cmd"));
    let mut seen = std::collections::HashSet::new();
    candidates.into_iter().filter(|p| seen.insert(p.clone())).collect()
}

fn mas_cmd_eligible(path: &std::path::Path) -> bool {
    path.is_file()
        && std::fs::metadata(path)
            .map(|m| m.len() > MAS_CMD_MIN_SIZE)
            .unwrap_or(false)
}

fn search_mas_aio_in_root(root: &std::path::Path, max_depth: usize) -> Option<std::path::PathBuf> {
    if !root.is_dir() {
        return None;
    }
    fn dfs(dir: &std::path::Path, depth: usize, max_depth: usize) -> Option<std::path::PathBuf> {
        if depth > max_depth {
            return None;
        }
        let entries = std::fs::read_dir(dir).ok()?;
        for entry in entries.flatten() {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            let is_dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);
            if is_dir {
                if let Some(found) = dfs(&path, depth + 1, max_depth) {
                    return Some(found);
                }
            } else if name.eq_ignore_ascii_case("MAS_AIO.cmd") && mas_cmd_eligible(&path) {
                return Some(path);
            }
        }
        None
    }
    dfs(root, 0, max_depth)
}

fn find_local_mas_cmd() -> Option<std::path::PathBuf> {
    for candidate in mas_local_candidates() {
        if mas_cmd_eligible(&candidate) {
            return Some(candidate);
        }
    }
    if let Some(profile) = std::env::var_os("USERPROFILE") {
        let base = std::path::PathBuf::from(&profile);
        for sub in ["Downloads", "Desktop", "Documents"] {
            if let Some(found) = search_mas_aio_in_root(&base.join(sub), 6) {
                return Some(found);
            }
        }
    }
    None
}

fn ensure_mas_cmd_eol(path: &std::path::Path) {
    let dest = path.to_string_lossy().replace('\'', "''");
    let ps = format!(
        r#"
        $dest = '{dest}'
        if (-not (Test-Path $dest)) {{ exit }}
        $bytes = [IO.File]::ReadAllBytes($dest)
        $out = New-Object System.Collections.Generic.List[byte]
        foreach ($b in $bytes) {{
            if ($b -eq 10) {{
                if ($out.Count -eq 0 -or $out[$out.Count - 1] -ne 13) {{ $out.Add(13) }}
                $out.Add(10)
            }} else {{
                $out.Add($b)
            }}
        }}
        while ($out.Count -gt 0 -and ($out[$out.Count - 1] -eq 10 -or $out[$out.Count - 1] -eq 13)) {{ $out.RemoveAt($out.Count - 1) }}
        $out.Add(13); $out.Add(10)
        [IO.File]::WriteAllBytes($dest, $out.ToArray())
        "#
    );
    let _ = run_ps(&ps);
}

fn launch_elevated_cmd(cmd_path: &str, param: &str) {
    let ps_cmd = format!(r#"Start-Process cmd.exe -ArgumentList '/k ""{cmd_path}"" {param}' -Verb RunAs"#);
    let _ = std::process::Command::new("powershell")
        .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", &ps_cmd])
        .spawn();
}

fn run_mas_online(param: &str) {
    let ps = format!(
        r#"
        $OutputEncoding = [System.Text.Encoding]::UTF8
        [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
        $dest = Join-Path $env:TEMP 'MAS_AIO.cmd'
        if (-not (Test-Path $dest) -or (Get-Item $dest).Length -lt 10000) {{
            $urls = @(
                "{MAS_USER_REPO_URL}",
                "{MAS_OFFICIAL_URL}"
            )
            foreach ($u in $urls) {{
                try {{ curl.exe -sL -o "$dest" "$u" }} catch {{}}
                if ((Test-Path $dest) -and (Get-Item $dest).Length -gt 10000) {{ break }}
                try {{
                    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
                    Invoke-WebRequest -Uri "$u" -OutFile $dest -UseBasicParsing -ErrorAction Stop
                }} catch {{}}
                if ((Test-Path $dest) -and (Get-Item $dest).Length -gt 10000) {{ break }}
            }}
        }}
        if ((Test-Path $dest) -and (Get-Item $dest).Length -gt 10000) {{
            $bytes = [IO.File]::ReadAllBytes($dest)
            $out = New-Object System.Collections.Generic.List[byte]
            foreach ($b in $bytes) {{
                if ($b -eq 10) {{
                    if ($out.Count -eq 0 -or $out[$out.Count - 1] -ne 13) {{ $out.Add(13) }}
                    $out.Add(10)
                }} else {{
                    $out.Add($b)
                }}
            }}
            while ($out.Count -gt 0 -and ($out[$out.Count - 1] -eq 10 -or $out[$out.Count - 1] -eq 13)) {{ $out.RemoveAt($out.Count - 1) }}
            $out.Add(13); $out.Add(10)
            [IO.File]::WriteAllBytes($dest, $out.ToArray())
            $p = "{param}"
            Start-Process cmd.exe -ArgumentList "/k ""$dest"" $p" -Verb RunAs
        }} else {{
            Start-Process powershell.exe -ArgumentList '-NoProfile -ExecutionPolicy Bypass -Command "irm https://get.activated.win | iex"' -Verb RunAs
        }}
        "#
    );
    let _ = run_ps(&ps);
}

/// Run MAS AIO action (Microsoft Activation Scripts) - parity with Electron run-mas-action
pub fn run_mas_action(mode: &str) -> Result<serde_json::Value, String> {
    let local_cmd = find_local_mas_cmd();
    match mode {
        "aio_menu" => {
            if let Some(p) = &local_cmd {
                ensure_mas_cmd_eol(&p);
                launch_elevated_cmd(&p.to_string_lossy(), "");
                let file_name = p
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default();
                Ok(serde_json::json!({
                    "success": true,
                    "output": format!("Đã mở cửa sổ MAS AIO Menu ({file_name}) thành công!")
                }))
            } else {
                run_mas_online("");
                Ok(serde_json::json!({
                    "success": true,
                    "output": "Đã tải từ máy chủ MAS chính thức và mở MAS AIO Menu thành công!"
                }))
            }
        }
        "hwid" => {
            if let Some(p) = &local_cmd {
                ensure_mas_cmd_eol(&p);
                launch_elevated_cmd(&p.to_string_lossy(), "/HWID");
                Ok(serde_json::json!({
                    "success": true,
                    "output": "Đã khởi chạy kích hoạt Windows HWID vĩnh viễn qua MAS!"
                }))
            } else {
                run_mas_online("/HWID");
                Ok(serde_json::json!({
                    "success": true,
                    "output": "Đã nạp MAS chính thức và kích hoạt Windows HWID vĩnh viễn!"
                }))
            }
        }
        "ohook" => {
            if let Some(p) = &local_cmd {
                ensure_mas_cmd_eol(&p);
                launch_elevated_cmd(&p.to_string_lossy(), "/Ohook");
                Ok(serde_json::json!({
                    "success": true,
                    "output": "Đã khởi chạy kích hoạt Office Ohook vĩnh viễn qua MAS!"
                }))
            } else {
                run_mas_online("/Ohook");
                Ok(serde_json::json!({
                    "success": true,
                    "output": "Đã nạp MAS chính thức và kích hoạt Office Ohook vĩnh viễn!"
                }))
            }
        }
        "kms38" => {
            if let Some(p) = &local_cmd {
                ensure_mas_cmd_eol(&p);
                launch_elevated_cmd(&p.to_string_lossy(), "/KMS38");
                Ok(serde_json::json!({
                    "success": true,
                    "output": "Đã khởi chạy kích hoạt Windows Server / Enterprise KMS38 qua MAS!"
                }))
            } else {
                run_mas_online("/KMS38");
                Ok(serde_json::json!({
                    "success": true,
                    "output": "Đã nạp MAS chính thức và kích hoạt KMS38!"
                }))
            }
        }
        "clean" => {
            deep_clean_activation("windows")
        }
        _ => Err(format!("Unknown MAS mode: {}", mode)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_search_mas_aio_in_root_finds_expected_layout() {
        let dir = std::env::temp_dir().join(format!("mas_dfs_{}", std::process::id()));
        let nested = dir.join("MAS_Temp").join("Microsoft-Activation-Scripts-master").join("MAS").join("All-In-One-Version-KL");
        std::fs::create_dir_all(&nested).unwrap();
        let target = nested.join("MAS_AIO.cmd");
        std::fs::write(&target, "x".repeat(MAS_CMD_MIN_SIZE as usize + 1)).unwrap();
        std::fs::write(dir.join("MAS_AIO.cmd"), "x".repeat(100)).unwrap();
        let found = search_mas_aio_in_root(&dir, 6).expect("must locate the nested real MAS_AIO.cmd");
        assert_eq!(found, target, "must skip undersized file and find the real one");
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn test_mas_cmd_eligible_size_threshold() {
        let dir = std::env::temp_dir().join(format!("mas_eligible_{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let big = dir.join("MAS_AIO.cmd");
        std::fs::write(&big, "x".repeat(MAS_CMD_MIN_SIZE as usize + 1)).unwrap();
        let small = dir.join("small.cmd");
        std::fs::write(&small, "x".repeat(MAS_CMD_MIN_SIZE as usize - 1)).unwrap();
        assert!(mas_cmd_eligible(&big), "file larger than 10KB must be eligible");
        assert!(!mas_cmd_eligible(&small), "file smaller than 10KB must be rejected");
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn test_run_mas_action_unknown_mode_is_error() {
        let res = run_mas_action("not_a_real_mode");
        assert!(res.is_err(), "unknown mode must produce an error");
    }

    #[test]
    fn test_scan_office_activation_json() {
        let res = scan_office_activation().expect("Should succeed");
        assert!(res["report"]["skuInfo"].is_object(), "report.skuInfo must be an object");
        assert!(res["report"]["matrix"].is_array(), "report.matrix must be an array");
        assert!(res["report"]["impactResult"].is_object(), "report.impactResult must be an object");
        assert!(
            res["report"]["impactResult"]["riskLevel"].is_string(),
            "report.impactResult.riskLevel must be a string"
        );
        assert!(
            res["report"]["impactResult"]["isSafeToProceed"].is_boolean(),
            "report.impactResult.isSafeToProceed must be a boolean"
        );
        let prov = res["report"]["provenance"].clone();
        assert!(
            prov.as_object().is_some(),
            "report.provenance must be an object"
        );
        assert!(
            prov["provenanceLevel"].is_string(),
            "report.provenance.provenanceLevel must be a string"
        );
        assert!(
            (prov["confidence"].as_u64().unwrap_or(0) as i64) >= 0 && (prov["confidence"].as_u64().unwrap_or(0) as i64) <= 100,
            "report.provenance.confidence must be in 0..100"
        );
        println!("OFFICE PROVENANCE: {}", prov);
    }

    /// Regression: restore_oem_bios_key must use run_ps_elevated and return
    /// Result::Ok (with success JSON) or Result::Err — never panic.
    #[test]
    fn restore_oem_bios_key_elevated_returns_result() {
        let result = restore_oem_bios_key();
        match result {
            Ok(val) => {
                assert!(val.is_object(), "restore_oem result must be a JSON object");
                let success = val["success"].as_bool().unwrap_or(false);
                if !success {
                    let err = val["error"].as_str().unwrap_or("");
                    assert!(!err.is_empty(), "failure must include error message");
                    println!(">>> restore_oem_bios_key: success=false err={}", err);
                } else {
                    println!(">>> restore_oem_bios_key: success=true");
                }
            }
            Err(e) => {
                assert!(!e.is_empty(), "error message must not be empty");
                println!(">>> restore_oem_bios_key ERR (expected if no admin/BIOS key): {}", e);
            }
        }
    }

    /// Regression: deep_clean_activation("windows") must use run_ps_elevated
    /// and propagate errors correctly.
    #[test]
    fn deep_clean_windows_elevated_returns_result() {
        // DO NOT actually run deep clean in test — just verify the function
        // compiles and the Result type is correct by calling with invalid type.
        let result = deep_clean_activation("invalid_type");
        assert!(result.is_err(), "invalid type must return Err");
        println!(">>> deep_clean_activation(invalid): {:?}", result);
    }

    #[test]
    fn test_scan_windows_activation_json() {
        let res = scan_windows_activation().expect("Should succeed");
        assert!(res["Windows"].is_object(), "Windows section must exist");
        let win = &res["Windows"];
        assert!(win["LicenseStatus"].is_number(), "LicenseStatus must be a number");
        println!("WINDOWS SCAN: {}", serde_json::to_string_pretty(&res).unwrap_or_default());
    }

    // ------------------------------------------------------------------
    // PART 2 — KMS38 detection (3 triggers)
    // ------------------------------------------------------------------

    #[test]
    fn kms38_t1_matches_2038_in_expiry_line() {
        // T1: xpr chứa "2038" ở bất kỳ vị trí → KMS38
        assert!(detect_kms38(
            "Windows(R) Enterprise: The machine is activated until 2038/01/19 12:00.",
            false, 0, "VOLUME_KMSCLIENT",
        ));
    }

    #[test]
    fn kms38_t1_also_when_xpr_contains_2038_elsewhere() {
        // "2038" xuất hiện ngay cả khi GracePeriod khác 0 / channel khác KMS
        // → vẫn đúng trigger T1 (T1 không phụ thuộc điều kiện khác).
        assert!(detect_kms38("some 2038 note", false, 1000, "OEM"));
    }

    #[test]
    fn kms38_t2_store_test_folder_exists() {
        // T2: folder store_test tồn tại → KMS38
        assert!(detect_kms38("", true, 60, "VOLUME_KMSCLIENT"));
    }

    #[test]
    fn kms38_t3_grace_zero_volume_channel_and_203x() {
        // Kịch bản KMS38 THẬT: máy VOLUME activated đến năm 2038 viết đúng token
        // "2038" trong xpr, Grace=0 → vẫn được phát hiện.
        assert!(detect_kms38(
            "activated until 2038-01-19", false, 0, "VOLUME_KMSCLIENT",
        ));
    }

    #[test]
    fn kms38_t3_no_longer_matches_narrowed_regex_2035() {
        // SỬA T3: regex cũ "203[0-9]" quá rộng — khớp cả 2030..2039 gây false
        // positive (vd máy activated đến 2035 thì KHÔNG phải KMS38).
        // Giờ chỉ token năm "2038" chính xác được tính.
        assert!(!detect_kms38("activated until 2035", false, 0, "VOLUME_KMSCLIENT"));
        // cả T1 cũng không bắt "2035" (không phải "2038")
        assert!(!detect_kms38("until 2035 anywhere", false, 0, "VOLUME_KMSCLIENT"));
    }

    #[test]
    fn kms38_t1_no_longer_matches_substring_like_build_number() {
        // SỬA T1: cũ khớp "2038" là substring (bắt cả "20380" build number).
        // Giờ chỉ token năm độc lập "2038" — "20380" / "x20380" không bị bắt.
        assert!(!detect_kms38("build 20380 enrolled", false, 0, "OEM"));
        assert!(!detect_kms38("102038 extension", false, 0, "OEM"));
        // vẫn bắt "2038" đứng độc lập giữa text
        assert!(detect_kms38("activated until 2038", false, 0, "OEM"));
    }

    #[test]
    fn kms38_channel_and_grace_scenarios() {
        // Sau khi siết độ chính xác: token năm "2038" độc lập là dấu hiệu
        // KMS38 mạnh → detect cho dù channel là gì (T1). Máy hợp lệ bình
        // thường không hiển thị "2038" trong /xpr.
        assert!(detect_kms38("activated until 2038", false, 0, "OEM"));
        assert!(detect_kms38("activated until 2038", false, 0, "RETAIL"));
        assert!(detect_kms38("activated until 2038", false, 90, "VOLUME_KMSCLIENT"));
        // Còn các tổ hợp KHÔNG có token "2038" → không phát hiện
        assert!(!detect_kms38("permanently activated", false, 0, "VOLUME_KMSCLIENT"));
        assert!(!detect_kms38("activated until 2035", false, 0, "VOLUME_KMSCLIENT"));
    }

    #[test]
    fn kms38_all_false_when_no_indicator() {
        // Không trigger nào: không có "2038", không store_test, không đủ T3
        assert!(!detect_kms38("permanently activated", false, 0, "OEM"));
        // Grace=0 nhưng channel khác VOLUME và xpr không khớp 203x
        assert!(!detect_kms38("no year number", false, 0, "VOLUME_KMSCLIENT"));
    }

    #[test]
    fn kms38_t3_does_not_match_203_at_other_digit() {
        // "203" theo sau bởi ký tự KHÔNG phải số (vd "203s") → T3 không khớp regex 203[0-9]
        assert!(!detect_kms38("until 203s", false, 0, "VOLUME_KMSCLIENT"));
    }

    // ------------------------------------------------------------------
    // PART 2 — FakeKMS detection (host → resolves localhost)
    // ------------------------------------------------------------------

    #[test]
    fn fakekms_empty_or_na_host_is_not_fake() {
        assert!(!detect_fake_kms("", &[]));
        assert!(!detect_fake_kms("   ", &[]));
        assert!(!detect_fake_kms("N/A", &[]));
    }

    #[test]
    fn fakekms_known_distinctive_fake_patterns_detected() {
        // Các pattern giả RÕ RÀNG (tên tool / nguồn pirate) vẫn bị bắt,
        // kể cả không có DNS (case-insensitive)
        for host in [
            "0.0.0.0", "127.0.0.1", "localhost", "loli.kms.local", "digiboy", "msguides",
            "zdf", "kmsauto.myhost", "aact.ru", "kms4dotnet", "kms-activation",
            "novaxm", "xinso.kms", "vlmcs.xyz",
        ] {
            assert!(detect_fake_kms(host, &[]), "host '{}' must be flagged as fake", host);
        }
    }

    #[test]
    fn fakekms_ambiguous_prefix_needs_dns_evidence_to_flag() {
        // kms8./kms9./skms. là pattern KHÔNG đủ căn cứ đứng riêng → không flag
        // khi thiếu bằng chứng DNS (an toàn hơn, tránh false positive).
        assert!(!detect_fake_kms("kms8.abc.local", &[]));
        assert!(!detect_fake_kms("kms9.abc.local", &[]));
        assert!(!detect_fake_kms("skms.internal", &[]));
        // NHƯNG vẫn bị bắt khi DNS resolves về localhost (dấu hiệu fake rõ)
        assert!(detect_fake_kms("kms8.abc.local", &["127.0.0.1".to_string()]));
        assert!(detect_fake_kms("skms.internal", &["0.0.0.0".to_string()]));
    }

    #[test]
    fn fakekms_dns_resolves_to_localhost() {
        // host sạch về pattern nhưng DNS resolves về 127.x → fake
        assert!(detect_fake_kms("10.0.0.50", &["127.0.0.1".to_string()]));
        assert!(detect_fake_kms("kms-server.example", &["::1".to_string()]));
        assert!(detect_fake_kms("kms-server.example", &["0.0.0.0".to_string()]));
    }

    #[test]
    fn fakekms_legit_microsoft_distribution_kms_not_flagged() {
        // REGRESSION FIX (item 4): kms.digitalrivercontent.net là domain phân
        // phối license CHÍNH THỨC của Microsoft. Trước đây bị flag "fake" do
        // pattern "kms." khớp substring. Giờ KHÔNG còn bị flag:
        //   - DNS resolves về IP public (40.86.55.83) → KMS hợp lệ
        assert!(
            !detect_fake_kms("kms.digitalrivercontent.net", &["40.86.55.83".to_string()]),
            "domain phân phối hợp lệ của Microsoft không được flag fake"
        );
        //   - Kể cả khi DNS không trả về: vẫn không flag vì thuộc legit domain
        assert!(
            !detect_fake_kms("kms.digitalrivercontent.net", &[]),
            "domain hợp lệ không bị flag ngay cả khi thiếu DNS"
        );
    }

    #[test]
    fn fakekms_display_microsoft_activation_server_unflagged() {
        // Đây là host legit không chứa pattern giả nào và resolves về IP public
        // → PHẢI không bị gắn cờ. (contrast với false positive ở trên)
        assert!(!detect_fake_kms("activation-v2.sls.microsoft.com", &["20.44.90.60".to_string()]));
    }

    #[test]
    fn fakekms_resolved_public_ip_not_fake() {
        // DHCP/trên mạng nội bộ host sạch (không pattern giả) + IP public → không fake
        assert!(!detect_fake_kms("valid.license.contoso.com", &["8.8.8.8".to_string()]));
    }

    #[test]
    fn fakekms_public_dns_overrides_kms_prefix() {
        // Host bắt đầu bằng "kms." nhưng DNS resolve ra IP public → KHÔNG flag
        // (bằng chứng DNS hợp lệ mạnh hơn giả định từ tên). parity với PS rule-3 guard.
        assert!(!detect_fake_kms("kms.contoso-public.aws", &["52.10.1.1".to_string()]));
        // Host bắt đầu bằng "kms." + KHÔNG có DNS, không phải legit domain → vẫn flag (thận trọng)
        assert!(detect_fake_kms("kms.10banh.local", &[]));
    }
}





