$ErrorActionPreference = "Stop"

try {
    $spp = Get-CimInstance -ClassName SoftwareLicensingProduct | Where-Object { $_.ApplicationID -eq '55c92734-d682-4d71-983e-d6ec3f16059f' -and $_.PartialProductKey -ne $null } | Select-Object -First 1

    if ($spp) {
        $status = $spp.LicenseStatus
        $desc = $spp.Description
        $channel = $spp.ProductKeyChannel
        $kmsPort = $spp.KeyManagementServicePort
        $kmsHost = $spp.KeyManagementServiceMachine
        $grace = $spp.GracePeriodRemaining
    } else {
        $status = 0
        $desc = "Not Found"
        $channel = "Unknown"
        $kmsPort = 0
        $kmsHost = ""
        $grace = 0
    }
    
    $oa3 = $null
    try {
        $oa3 = (Get-CimInstance -ClassName SoftwareLicensingService).OA3xOriginalProductKey
    } catch { }

    $hasOA3 = [string]::IsNullOrWhiteSpace($oa3) -eq $false

    # Forensic Evidence Scanning
    $piratedFiles = @()
    $targetPaths = @("C:\Windows\AutoKMS", "C:\Program Files\AutoKMS", "C:\Windows\SECOH-QAD.dll", "C:\Windows\SECOH-QAD.exe")
    foreach ($p in $targetPaths) { if (Test-Path $p) { $piratedFiles += $p } }

    $suspiciousTasks = @()
    $tasks = Get-ScheduledTask -ErrorAction SilentlyContinue | Where-Object { $_.TaskName -match "KMS|MAS|AAct|HEU|KMSAuto|Activation-Renewal|Activation-Run_Once|R@1n" }
    foreach ($t in $tasks) { $suspiciousTasks += $t.TaskName }

    $suspiciousServices = @()
    $services = Get-Service -ErrorAction SilentlyContinue | Where-Object { $_.Name -match "KMS|MAS|AAct|HEU" }
    foreach ($s in $services) { $suspiciousServices += $s.Name }

    $hostsRedirects = @()
    $hostsPath = "$env:windir\System32\drivers\etc\hosts"
    if (Test-Path $hostsPath) {
        $hostsLines = Get-Content $hostsPath -ErrorAction SilentlyContinue
        foreach ($line in $hostsLines) {
            $trimmed = $line.Trim()
            if ($trimmed -and -not $trimmed.StartsWith("#") -and ($trimmed -match "microsoft\.com|office\.com|kms")) {
                $hostsRedirects += $trimmed
            }
        }
    }

    $result = @{
        Success = $true
        Data = @{
            status = $status
            description = $desc
            hasOA3Key = $hasOA3
            productKeyChannel = $channel
            kmsPort = $kmsPort
            kmsHost = $kmsHost
            gracePeriodRemaining = $grace
            piratedFiles = $piratedFiles
            suspiciousTasks = $suspiciousTasks
            suspiciousServices = $suspiciousServices
            hostsRedirects = $hostsRedirects
        }
    }
    
    # Output standard JSON
    Write-Output ($result | ConvertTo-Json -Depth 5 -Compress)
} catch {
    $errorObj = @{
        Success = $false
        Error = $_.Exception.Message
    }
    Write-Output ($errorObj | ConvertTo-Json -Compress)
    exit 1
}
