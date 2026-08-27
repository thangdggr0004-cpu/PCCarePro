declare namespace Electron {
  interface IpcRenderer {
    invoke(channel: string, ...args: any[]): Promise<any>;
    on(channel: string, listener: (event: any, ...args: any[]) => void): void;
    removeAllListeners(channel: string): void;
  }
}

/**
 * Type-safe interface for Electron IPC communication
 */
interface ElectronAPI {
  /** Get BitLocker encryption status for all volumes */
  getBitlockerStatus: () => Promise<{ success: boolean; data: string }>;
  /** Disable BitLocker encryption for a specific volume */
  disableBitlocker: (mountPoint: string) => Promise<{ success: boolean; error?: string }>;
  /** Run SSD TRIM on all detected SSDs */
  runSsdTrim: () => Promise<{ success: boolean; message?: string }>;
  /** Check if Windows Defender real-time protection is enabled */
  getDefenderStatus: () => Promise<{ enabled: boolean }>;
  toggleDefenderStatus: (enabled: boolean) => Promise<{ success: boolean; error?: string }>;
  listWifiProfiles: () => Promise<Array<{ name: string; password: string; auth: string }>>;
  exportWifi: () => Promise<{ success: boolean; path?: string; error?: string }>;
  restoreWifi: () => Promise<{ success: boolean; count?: number; error?: string }>;
  exportDrivers: () => Promise<{ success: boolean; path?: string; error?: string }>;
  restoreDrivers: () => Promise<{ success: boolean; error?: string }>;
  setAutoStart: (enabled: boolean) => void;
  setCloseToTray: (enabled: boolean) => void;
  cleanRamNow: () => Promise<{ success: boolean; message?: string }>;
  checkForUpdates: () => Promise<{ hasUpdate: boolean; version?: string }>;
  showInfoDialog: (options: { title: string; message: string }) => Promise<void>;
  runPowerShell: (command: string) => Promise<void>;
}

interface Window {
  electronAPI: ElectronAPI;
}
