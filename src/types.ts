export interface HardwareInfo {
  cpuName: string;
  cpuCores: number;
  cpuThreads: number;
  cpuBaseClock: string;
  cpuTurboClock: string;
  cpuTurboSupported: boolean;
  cpuL3Cache: string;
  cpuArch: string;
  ramTotalSize: number; // GB
  ramSpeed: number; // MHz
  ramSlotsDetails: Array<{
    slot: number;
    size: number;
    speed: number;
    type: string;
    formFactor?: string;
    isSoldered?: boolean;
    manufacturer?: string;
    partNumber?: string;
  }>;
  ramSlotsTotal: number;
  ramMaxUpgradable?: number; // GB - 0 if soldered (not upgradeable)
  isAllSoldered?: boolean;
  ramType: string;
  ramChannels: string;



  storageDrives: Array<{
    id: string;
    name: string;
    type: 'SSD NVMe' | 'SSD SATA' | 'HDD SATA';
    totalSize: number; // GB
    freeSize: number; // GB
    health: string;
    temperature: number;
    partitionCount: number;
  }>;
  gpuName: string;
  gpuVram: string;
  gpuType: string;
  motherboard: string;
  biosVersion: string;
}

export interface JunkCategory {
  id: string;
  name: string;
  description: string;
  sizeMB: number;
  checked: boolean;
  filesList: string[];
}

export interface DnsPreset {
  name: string;
  primary: string;
  secondary: string;
  provider: string;
  isVietnam: boolean;
  logoColor: string;
}

export interface NetworkDiagnosisResult {
  latency: number;
  packetLoss: number;
  dnsLookupTime: number;
  downloadSpeed: string;
  uploadSpeed: string;
  gatewayIp: string;
  dnsCurrent: string;
  publicIp: string;
  status: 'excellent' | 'good' | 'poor' | 'failed';
  issues: string[];
  suggestions: string[];
}

export interface DocumentStandardPreset {
  pageSize: string;
  marginTop: number; // mm
  marginBottom: number; // mm
  marginLeft: number; // mm
  marginRight: number; // mm
  fontName: string;
  fontSizeTitle: number; // pt
  fontSizeBody: number; // pt
  lineSpacing: number;
}
