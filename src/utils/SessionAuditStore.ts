// Global Session Audit Store for Technician Job Reporting

export interface SessionReportData {
  windowsActivation?: string;
  officeActivation?: string;
  windowsOptimizations?: string[];
  networkDns?: string;
  networkResetDone?: boolean;
  junkCleanedMB?: number;
  junkCleanedCategories?: string[];
  laptopTests?: {
    keyboard?: string;
    screen?: string;
    touch?: string;
    webcam?: string;
    mic?: string;
  };
  diskHealth?: string;
  diskTemp?: number | string;
  batteryHealth?: string;
  batteryWear?: string;
  cycleCount?: number;
  lastScannedTime?: string;
}

const STORAGE_KEY = 'tp_session_audit_report';

export function getSessionReport(): SessionReportData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {}
  return {};
}

export function updateSessionReport(update: Partial<SessionReportData>) {
  try {
    const current = getSessionReport();
    const updated = {
      ...current,
      ...update,
      lastScannedTime: new Date().toLocaleString('vi-VN'),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('tp-session-report-updated', { detail: updated }));
  } catch (e) {}
}

export function resetSessionReport() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('tp-session-report-updated', { detail: {} }));
  } catch (e) {}
}
