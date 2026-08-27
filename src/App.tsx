import React, { useState, useEffect, lazy, Suspense } from 'react';
import packageJson from '../package.json' with { type: 'json' };
import TitleBar from './components/TitleBar.js';
import TopToolbar from './components/TopToolbar.js';
import Sidebar from './components/Sidebar.js';
import CommandPalette from './components/ui/CommandPalette.js';
import SettingsModal from './components/ui/SettingsModal.js';

// Helper for safe lazy loading with retry on Vite HMR chunk load failures
function safeLazy<T extends React.ComponentType<any>>(importFn: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      return await importFn();
    } catch (error) {
      console.warn('[Vite HMR] Dynamic import failed, retrying module load...', error);
      try {
        return await new Promise<{ default: T }>((resolve, reject) => {
          setTimeout(() => {
            importFn().then(resolve).catch(reject);
          }, 300);
        });
      } catch (retryErr) {
        window.location.reload();
        return new Promise<{ default: T }>(() => {});
      }
    }
  });
}

// Lazy‑loaded components
const Dashboard = safeLazy(() => import('./components/Dashboard.js'));
const LicenseManager = safeLazy(() => import('./components/LicenseManager.js'));
const HardwareDetails = safeLazy(() => import('./components/HardwareDetails.js'));
const JunkCleaner = safeLazy(() => import('./components/JunkCleaner.js'));
const NetworkConfig = safeLazy(() => import('./components/NetworkConfig.js'));
const BitLockerManager = safeLazy(() => import('./components/BitLockerManager.js'));
const OfficeStandardizer = safeLazy(() => import('./components/OfficeStandardizer.js'));
const WindowsSettings = safeLazy(() => import('./components/WindowsSettings.js'));
const BackupManager = safeLazy(() => import('./components/BackupManager.js'));
const PrinterUtils = safeLazy(() => import('./components/PrinterUtils.js'));
const LaptopTester = safeLazy(() => import('./components/LaptopTester.js'));
const TouchScreenTester = safeLazy(() => import('./components/TouchScreenTester.js'));
const AdvancedActivation = safeLazy(() => import('./components/AdvancedActivation.js'));
const JobReportViewer = safeLazy(() => import('./components/JobReportViewer.js'));

import { RefreshCw, Activity, ShieldCheck } from 'lucide-react';
import AutoUpdater from './components/AutoUpdater.js';
import { TaskManagerProvider } from './context/TaskManagerContext.js';
import GlobalTaskBar from './components/GlobalTaskBar.js';
import { CoreProvider } from './context/CoreContext.js';

// Skeleton fallback shown while lazy component loads
function PageSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="skeleton h-10 w-2/3 rounded-xl" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="skeleton h-28 rounded-2xl" />
        <div className="skeleton h-28 rounded-2xl" />
        <div className="skeleton h-28 rounded-2xl" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="skeleton h-48 rounded-2xl" />
        <div className="skeleton h-48 rounded-2xl" />
      </div>
      <div className="skeleton h-32 rounded-2xl" />
    </div>
  );
}

// Wrap page content with enter animation
function PageWrapper({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}

const AppFooter = React.memo(function AppFooter() {
  return (
    <div className="bg-[#090d18] px-4 md:px-6 py-2 border-t border-slate-800/80 text-[11px] font-mono text-slate-400 flex justify-between items-center shrink-0 select-none">
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Hệ thống sẵn sàng
        </span>
        <span className="hidden sm:inline text-slate-600">|</span>
        <span className="hidden sm:inline text-slate-500">Tối ưu cho Windows 11 &amp; Windows 10</span>
      </div>

      <div className="flex items-center gap-3 relative">
        <button
          onClick={async () => {
            const icon = document.getElementById('update-spinner');
            if (icon) icon.classList.add('animate-spin');
            try {
              const res = await (window as any).electronAPI?.checkForUpdates?.();
              if (res && res.hasUpdate === false) {
                await (window as any).electronAPI.showInfoDialog({
                  title: 'Thông Tin Cập Nhật',
                  message: `Bạn đang ở phiên bản mới nhất (v${packageJson.version}). Không có bản cập nhật nào mới hơn trên GitHub.`,
                });
              }
            } catch (e) {
              console.error('Update check manual error:', e);
            } finally {
              if (icon) icon.classList.remove('animate-spin');
            }
          }}
          className="text-emerald-400 font-semibold hover:text-emerald-300 transition-colors flex items-center gap-1.5 cursor-pointer bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-0.5 rounded-lg"
          title="Nhấp để kiểm tra bản cập nhật mới nhất"
        >
          <RefreshCw id="update-spinner" className="w-3 h-3" />
          v{packageJson.version} - Stable
        </button>
      </div>
    </div>
  );
});

export default function App() {
  type SectionId =
    | 'dashboard'
    | 'activation'
    | 'hardware'
    | 'cleaner'
    | 'network'
    | 'bitlocker'
    | 'standardizer'
    | 'windows-settings'
    | 'backup'
    | 'printer'
    | 'laptop-tester'
    | 'touch-tester'
    | 'advanced-activation'
    | 'ktv-report';

  const [activeSection, setActiveSection] = useState<SectionId>('dashboard');
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);


  // Sync active section to a global variable for IPC components
  useEffect(() => {
    (window as any).__activeSection = activeSection;
  }, [activeSection]);

  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);

  // Global Ctrl + K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Secret shortcut "1111" listener to unlock Advanced Activation tab
  useEffect(() => {
    let buffer = '';
    let timer: any = null;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === '1') {
        buffer += '1';
        clearTimeout(timer);
        timer = setTimeout(() => {
          buffer = '';
        }, 2000);

        if (buffer === '1111') {
          buffer = '';
          setIsUnlocked(true);
          setActiveSection('advanced-activation');
          alert('🔓 Chúc mừng! Bạn đã mở khóa thành công Tiện Ích Nâng Cao (MAS Engine)!');
        }
      } else {
        buffer = '';
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
    };
  }, []);

  const [appConfig, setAppConfig] = useState<any>(() => {
    const saved = localStorage.getItem('thienphat_app_config');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return { refreshInterval: 3, cpuTempAlert: true, cpuTempThreshold: 85, autoRamClean: false };
  });

  useEffect(() => {
    const handleConfigChange = (e: any) => {
      if (e.detail) setAppConfig(e.detail);
    };
    window.addEventListener('app-config-changed', handleConfigChange);
    return () => window.removeEventListener('app-config-changed', handleConfigChange);
  }, []);

  // CPU High Temperature Active Alert Monitor
  useEffect(() => {
    let lastAlertTime = 0;
    let unlisten: (() => void) | null = null;

    if (typeof (window as any).electronAPI?.onMetricsPush === 'function') {
      unlisten = (window as any).electronAPI.onMetricsPush((raw: any) => {
        const d = raw?.data ?? raw ?? {};
        const temp = typeof d.temp === 'object' ? (d.temp?.cpu ?? 0) : (typeof d.temp === 'number' ? d.temp : 0);
        const threshold = appConfig?.cpuTempThreshold || 85;

        if (appConfig?.cpuTempAlert && temp >= threshold && Date.now() - lastAlertTime > 45000) {
          lastAlertTime = Date.now();
          console.warn(`[TempAlert] High CPU temperature: ${temp}°C (Threshold: ${threshold}°C)`);
          if (typeof (window as any).electronAPI?.showInfoDialog === 'function') {
            (window as any).electronAPI.showInfoDialog({
              title: '⚠️ CẢNH BÁO NHIỆT ĐỘ CPU CAO',
              message: `Nhiệt độ CPU hiện tại đang là ${temp}°C, đã vượt ngưỡng an toàn (${threshold}°C) được cài đặt. Khuyến nghị kiểm tra keo tản nhiệt hoặc quạt làm mát!`,
            });
          }
        }
      });
    }

    return () => {
      if (unlisten) unlisten();
    };
  }, [appConfig]);


  const [visitedSections, setVisitedSections] = useState<Set<SectionId>>(() => new Set(['dashboard']));

  useEffect(() => {
    setVisitedSections((prev) => {
      if (prev.has(activeSection)) return prev;
      const next = new Set(prev);
      next.add(activeSection);
      return next;
    });
  }, [activeSection]);

  const renderSection = (id: SectionId, node: React.ReactNode) => {
    if (!visitedSections.has(id)) return null;
    const isActive = activeSection === id;
    return (
      <div
        key={id}
        className={isActive ? 'block w-full min-h-full' : 'hidden'}
        style={{ display: isActive ? 'block' : 'none' }}
        aria-hidden={!isActive}
      >
        <Suspense fallback={<PageSkeleton />}>
          <PageWrapper>{node}</PageWrapper>
        </Suspense>
      </div>
    );
  };

  return (
    <CoreProvider>
      <TaskManagerProvider>
        <div className="h-screen w-screen bg-[#0b0f19] text-slate-200 font-sans flex flex-col overflow-hidden select-none">
          {/* Custom Windows Drag TitleBar */}
          <TitleBar />

          {/* Top Search & Actions Toolbar */}
          <TopToolbar
            onOpenSearch={() => setIsSearchOpen(true)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onNavigate={(sec) => setActiveSection(sec as any)}
          />

          {/* Main Body: Left Sidebar + Center Workspace */}
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            {/* Left Navigation Sidebar */}
            <Sidebar
              activeSection={activeSection}
              setActiveSection={setActiveSection}
              isUnlocked={isUnlocked}
            />


            {/* Main Content Workspace */}
            <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#0b0f19] relative">
              {renderSection('dashboard', <Dashboard onNavigate={setActiveSection} />)}
              {renderSection('activation', <LicenseManager />)}
              {renderSection('hardware', <HardwareDetails />)}
              {renderSection('cleaner', <JunkCleaner />)}
              {renderSection('network', <NetworkConfig />)}
              {renderSection('bitlocker', <BitLockerManager />)}
              {renderSection('standardizer', <OfficeStandardizer />)}
              {renderSection('windows-settings', <WindowsSettings />)}
              {renderSection('backup', <BackupManager />)}
              {renderSection('printer', <PrinterUtils />)}
              {renderSection('laptop-tester', <LaptopTester />)}
              {renderSection('touch-tester', <TouchScreenTester />)}
              {renderSection('advanced-activation', <AdvancedActivation />)}
              {renderSection('ktv-report', <JobReportViewer />)}
            </main>
          </div>

          {/* App Status Footer */}
          <AppFooter />
        </div>

        {/* Global Modals & Tasks */}
        <CommandPalette
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          onNavigate={(sec) => setActiveSection(sec as SectionId)}
        />
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />
        <AutoUpdater />
        <GlobalTaskBar onNavigateTab={(tab) => setActiveSection(tab as SectionId)} />
      </TaskManagerProvider>
    </CoreProvider>
  );
}

