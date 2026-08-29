/**
 * Tauri Bridge — 1:1 mapping of all electronAPI methods
 * 62 methods, matched exactly to what the frontend calls.
 */

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { check as updaterCheck } from '@tauri-apps/plugin-updater';

let appWindow: any = null;
try {
  appWindow = getCurrentWindow();
} catch (e) {
  console.warn('[TauriBridge] Window API init failed:', e);
}

// ── Helpers ───────────────────────────────────

async function safeInvoke<T = any>(cmd: string, args?: Record<string, any>): Promise<any> {
  try {
    const data = await invoke<T>(cmd, args);
    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      return { ok: true, success: true, data, ...(data as any) };
    }
    return { ok: true, success: true, data };
  } catch (e: any) {
    console.warn(`[TauriBridge] ${cmd}:`, e?.message || e);
    return { ok: false, success: false, error: String(e?.message || e) };
  }
}

async function safeInvokeRaw<T = any>(cmd: string, args?: Record<string, any>): Promise<T | null> {
  try {
    return await invoke<T>(cmd, args);
  } catch (e: any) {
    console.warn(`[TauriBridge] ${cmd}:`, e?.message || e);
    return null;
  }
}

// ── Bridge API ────────────────────────────────

export const tauriBridge = {
  // ── Hardware / System ──────────────────────
  getHardwareInfo: (forceRefresh?: boolean) =>
    safeInvokeRaw('get_hardware_info', { forceRefresh: forceRefresh ?? false }),

  getSystemInfo: () => safeInvokeRaw('get_system_info'),
  getBatteryHealth: () => safeInvokeRaw('get_battery_health'),
  openBatteryReportHtml: () => safeInvokeRaw('open_battery_report_html'),
  getDiskHealth: () => safeInvokeRaw('get_disk_health'),
  runDxDiag: () => safeInvokeRaw('run_dx_diag'),
  openSystemTool: (tool: string) => safeInvokeRaw('open_system_tool', { tool }),


  // ── Metrics ────────────────────────────────
  onMetricsPush: (callback: (data: any) => void) => {
    const unlisten = listen<any>('metrics-push', (event) => callback(event.payload));
    return () => { unlisten.then((fn) => fn()); };
  },
  getCachedMetrics: () => safeInvokeRaw('get_cached_metrics'),
  setMetricsInterval: (seconds: number) => safeInvokeRaw('set_metrics_interval', { seconds }),


  // ── BitLocker ──────────────────────────────
  getBitlockerStatus: () => safeInvokeRaw('get_bitlocker_status'),
  disableBitlocker: (mountPoint: string) => safeInvokeRaw('disable_bitlocker', { mountPoint }),
  backupBitlockerKey: (mountPoint: string) => safeInvokeRaw('backup_bitlocker_key', { mountPoint }),

  // ── Defender ───────────────────────────────
  getDefenderStatus: () => safeInvokeRaw('get_defender_status'),
  toggleDefenderStatus: (enabled: boolean) => safeInvokeRaw('toggle_defender_status', { enabled }),

  // ── WiFi / Backup ─────────────────────────
  listWifiProfiles: () => safeInvokeRaw('list_wifi_profiles'),
  exportWifi: () => safeInvokeRaw('export_wifi'),
  restoreWifi: () => safeInvokeRaw('restore_wifi'),
  exportDrivers: () => safeInvokeRaw('export_drivers'),
  restoreDrivers: () => safeInvokeRaw('restore_drivers'),

  // ── Activation / Office ────────────────────
  scanActivation: (options: { type: string }) => safeInvokeRaw('scan_activation', { options }),

  // One-shot startup bundle: { hardware, metrics, system } resolved with the
  // fewest PowerShell spawns (single-flight gates).
  getStartupBundle: () => safeInvokeRaw('get_startup_bundle'),
  deepCleanActivation: (type: string) => safeInvokeRaw('deep_clean_activation', { type }),
  restoreOemBiosKey: () => safeInvokeRaw('restore_oem_bios_key'),
  scanOfficeEngineV3: () => safeInvokeRaw('scan_office_engine_v3'),
  restoreOfficeEngineV3: () => safeInvokeRaw('restore_office_engine_v3'),
  runMasAction: (mode: string) => safeInvokeRaw('run_mas_action', { mode }),

  // ── Junk Cleaner ──────────────────────────
  scanJunk: () => safeInvokeRaw('scan_junk'),
  cleanJunk: (categories: string[]) => safeInvokeRaw('clean_junk', { categories }),
  onJunkScanProgress: (callback: (p: any) => void) => {
    const unlisten = listen<any>('junk-scan-progress', (e) => callback(e.payload));
    return () => { unlisten.then((fn) => fn()); };
  },
  onJunkCleanProgress: (callback: (p: any) => void) => {
    const unlisten = listen<any>('junk-clean-progress', (e) => callback(e.payload));
    return () => { unlisten.then((fn) => fn()); };
  },

  // ── Network ────────────────────────────────
  resetNetworkStack: () => safeInvokeRaw('reset_network_stack'),
  diagnoseNetwork: () => safeInvokeRaw('diagnose_network'),
  applyDns: (options: { primary: string; secondary: string }) => safeInvokeRaw('apply_dns', { options }),

  // ── Windows Settings ───────────────────────
  applyAdvancedOptimization: (options: any) => safeInvokeRaw('apply_advanced_optimization', { options }),
  restoreAdvancedOptimization: () => safeInvokeRaw('restore_advanced_optimization'),
  readWindowsSettings: (opts?: boolean | { forceRefresh?: boolean }) =>
    safeInvokeRaw('read_windows_settings', opts === true || opts === undefined ? (opts === true ? { opts: true } : {}) : { opts }),
  runWindowsFixer: () => safeInvokeRaw('run_windows_fixer'),
  resetWindowsUpdate: () => safeInvokeRaw('reset_windows_update'),
  rebuildIconCache: () => safeInvokeRaw('rebuild_icon_cache'),
  readTamperProtection: () => safeInvokeRaw('read_tamper_protection'),
  applyPowerPlan: (options: { mode: string }) => safeInvokeRaw('apply_power_plan', { options }),
  backupRegistryKeys: () => safeInvokeRaw('backup_registry_keys'),
  applyWindowsSettings: (state: any) => safeInvokeRaw('apply_windows_settings', { state }),
  applyTaskbarSettings: (state: any) => safeInvokeRaw('apply_taskbar_settings', { state }),
  applySystemOptimization: (state: any) => safeInvokeRaw('apply_system_optimization', { state }),
  restartExplorer: () => safeInvokeRaw('restart_explorer'),
  restartComputer: () => safeInvokeRaw('restart_computer'),
  runSsdTrim: () => safeInvokeRaw('run_ssd_trim'),

  // ── Printer ────────────────────────────────
  executePrinterAction: (action: string, args?: any) => safeInvokeRaw('execute_printer_action', { action, args }),
  setDefaultPrinter: (printerName: string) => safeInvokeRaw('set_default_printer', { printerName }),
  getPrintQueue: (printerName: string) => safeInvokeRaw('get_print_queue', { printerName }),
  printTestPage: (printerName: string) => safeInvokeRaw('print_test_page', { printerName }),
  openDeviceManagerPrinters: () => safeInvokeRaw('open_device_manager_printers'),
  removeReinstallPrinter: (printerName: string) => safeInvokeRaw('remove_reinstall_printer', { printerName }),

  // ── Office Standardizer ────────────────────
  applyOfficeStandard: (options: { script: string }) => safeInvokeRaw('apply_office_standard', { options }),

  // ── Window Controls ────────────────────────
  windowMinimize: async () => {
    try {
      const win = getCurrentWindow();
      await win.minimize();
    } catch (e) {
      console.warn('[TauriBridge] Minimize error:', e);
    }
  },
  windowMaximize: async () => {
    try {
      const win = getCurrentWindow();
      await win.toggleMaximize();
    } catch (e) {
      console.warn('[TauriBridge] Maximize error:', e);
    }
  },
  windowClose: async () => {
    try {
      const win = getCurrentWindow();
      await win.close();
    } catch (e) {
      console.warn('[TauriBridge] Close error:', e);
    }
  },


  // ── Dialogs ────────────────────────────────
  showInfoDialog: (options: { title: string; message: string }) =>
    safeInvoke('show_info_dialog', { options }),
  showConfirmDialog: (options: { title: string; message: string; type?: string }) =>
    safeInvoke('show_confirm_dialog', { options }),

  // ── System Restore ────────────────────────
  createSystemRestorePoint: (name: string) => safeInvokeRaw('create_system_restore_point', { name }),

  // ── Data Safety (BackupManager / RollbackManager / VerificationEngine) ──
  createBackup: () => safeInvokeRaw('create_backup'),
  rollbackBackup: (backupId: string) => safeInvokeRaw('rollback_backup', { backupId }),
  verifyCleanOperation: () => safeInvokeRaw('verify_clean_operation'),
  verifyBiosRestore: (scanResult?: any) => safeInvokeRaw('verify_bios_restore', { scanResult }),

  // ── Auto Updater (tauri-plugin-updater) ──────
  checkForUpdates: () => checkForUpdatesBridge(),
  downloadUpdate: () => downloadUpdateBridge(),
  installUpdate: () => installUpdateBridge(),
  onUpdaterEvent: (callback: (event: any) => void) => {
    updaterListeners.add(callback);
    return () => { updaterListeners.delete(callback); };
  },
};

// ── Auto Updater bridge helpers ───────────────

const updaterListeners = new Set<(event: any) => void>();

function emitUpdater(event: any) {
  updaterListeners.forEach((cb) => {
    try { cb(event); } catch (e) { console.warn('[TauriBridge] updater listener error:', e); }
  });
}

async function checkForUpdatesBridge(): Promise<any> {
  try {
    const update = await updaterCheck();
    if (!update) {
      return { ok: true, success: true, hasUpdate: false, message: 'Bạn đang sử dụng phiên bản mới nhất.' };
    }
    emitUpdater({
      type: 'update-available',
      info: {
        currentVersion: update.currentVersion || '?',
        latestVersion: update.version,
        releaseNotes: update.body || 'Đã có bản cập nhật mới trên GitHub.',
      },
    });
    return { ok: true, success: true, hasUpdate: true, latestVersion: update.version };
  } catch (e: any) {
    console.warn('[TauriBridge] checkForUpdates:', e?.message || e);
    return { ok: false, success: false, error: String(e?.message || e) };
  }
}

/// Portable flow: Rust-side download + signature verify + stage as <exe>.next.
/// Progress/done are relayed from Tauri events to the same updater event stream.
listen('portable-update-progress', (e: any) => {
  emitUpdater({ type: 'download-progress', progress: e.payload });
}).catch(() => {});
listen('portable-update-done', () => {
  emitUpdater({ type: 'update-downloaded' });
}).catch(() => {});

async function downloadUpdateBridge(): Promise<any> {
  try {
    const res: any = await invoke('portable_update_download');
    if (res && res.hasUpdate === false) {
      return { ok: true, success: true, downloaded: false, message: res.message };
    }
    return { ok: true, success: true, downloaded: true };
  } catch (e: any) {
    emitUpdater({ type: 'error', error: String(e?.message || e) });
    return { ok: false, success: false, error: String(e?.message || e) };
  }
}

async function installUpdateBridge(): Promise<any> {
  try {
    await invoke('portable_update_apply');
    return { ok: true, success: true };
  } catch (e: any) {
    return { ok: false, success: false, error: String(e?.message || e) };
  }
}

// ── Polyfill window.electronAPI + window.electron ──

if (typeof window !== 'undefined') {
  (window as any).electronAPI = tauriBridge;
  (window as any).electron = {
    invoke: (channel: string, ...args: any[]) => invoke(channel, args[0]),
    on: (channel: string, listener: (...args: any[]) => void) => {
      const unlisten = listen(channel, (event) => listener(event.payload));
      return () => { unlisten.then((fn) => fn()); };
    },
    off: () => {},
  };
}

export default tauriBridge;
