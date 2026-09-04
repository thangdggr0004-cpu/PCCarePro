import React, { useState, useEffect } from 'react';
import { Shield, Zap, Battery, Play, Download, CheckCircle, Info, Activity, Settings, RefreshCw, AlertTriangle, Monitor, HardDrive, Cpu, Terminal, Wrench, X, Clock, Globe } from 'lucide-react';
import ProgressBarComponent from './ProgressBarComponent.js';
import { useTaskManager } from '../context/TaskManagerContext.js';
import { updateSessionReport } from '../utils/SessionAuditStore.js';

type PowerModeType = 'battery' | 'balanced' | 'gaming' | 'performance' | 'ultimate';

interface PowerModeOption {
  id: PowerModeType;
  name: string;
  subName: string;
  description: string;
  cpuLimit: string;
  fanSpeed: string;
  drainIndex: number;
  responsiveness: number;
  colorClass: string;
  bgGlowClass: string;
}

const powerOptions: PowerModeOption[] = [
  {
    id: 'battery',
    name: 'Tiết kiệm pin (Power Saver)',
    subName: 'Tối ưu thời gian sử dụng',
    description: 'Giới hạn hiệu năng CPU ở mức 60%-80%, tắt các hiệu ứng đồ họa Windows và dịch vụ ngầm để tăng thời lượng pin tối đa.',
    cpuLimit: 'Giới hạn tối đa 70%',
    fanSpeed: 'Thấp / Yên tĩnh (Quiet)',
    drainIndex: 2,
    responsiveness: 4,
    colorClass: 'text-emerald-600 border-emerald-500/30 hover:border-emerald-500/50',
    bgGlowClass: 'bg-emerald-50/50',
  },
  {
    id: 'balanced',
    name: 'Cân bằng (Balanced - Default)',
    subName: 'Tự động điều chỉnh hiệu năng',
    description: 'Chế độ cân bằng mặc định của Windows. Tự động tăng xung nhịp khi chạy tác vụ nặng và hạ xung khi máy nghỉ để tiết kiệm điện.',
    cpuLimit: 'Tự động điều chỉnh 5%-100%',
    fanSpeed: 'Tự động (Smart fan)',
    drainIndex: 5,
    responsiveness: 7,
    colorClass: 'text-emerald-600 border-emerald-500/30 hover:border-emerald-500/50',
    bgGlowClass: 'bg-emerald-50/50',
  },
  {
    id: 'gaming',
    name: 'Chế độ Gaming (Gaming Mode)',
    subName: 'Tập trung tối đa FPS',
    description: 'Ưu tiên chu kỳ xử lý đồ họa của GPU, dọn dẹp RAM nền và kích hoạt cài đặt Game Mode để duy trì tốc độ khung hình ổn định nhất.',
    cpuLimit: 'Cố định tối thiểu 90% clock',
    fanSpeed: 'Cao (High Performance)',
    drainIndex: 8,
    responsiveness: 9,
    colorClass: 'text-amber-600 border-amber-500/30 hover:border-amber-500/50',
    bgGlowClass: 'bg-amber-50/50',
  },
  {
    id: 'performance',
    name: 'Hiệu năng cao (High Performance)',
    subName: 'Phản hồi phần cứng tức thì',
    description: 'Thiết lập CPU hoạt động hết công suất, tắt chế độ ngủ đông ổ đĩa SATA/NVMe và duy trì điện áp cao giúp ứng dụng khởi chạy lập tức.',
    cpuLimit: 'Mở khóa 100% công suất',
    fanSpeed: 'Tối đa (Max Speed)',
    drainIndex: 9,
    responsiveness: 9.5,
    colorClass: 'text-emerald-600 border-emerald-500/30 hover:border-emerald-500/50',
    bgGlowClass: 'bg-emerald-50/50',
  },
  {
    id: 'ultimate',
    name: 'Ultimate Performance (Đỉnh cao)',
    subName: 'Bật gói hiệu năng ẩn Microsoft',
    description: 'Kích hoạt cấu hình ẩn cao cấp nhất của Windows 10/11, triệt tiêu hoàn toàn độ trễ dòng điện vi mạch, mang lại tốc độ tuyệt đối cho Workstation.',
    cpuLimit: 'Mở khóa cực hạn 100% Core Clock',
    fanSpeed: 'Tối đa liên tục (Turbo)',
    drainIndex: 10,
    responsiveness: 10,
    colorClass: 'text-slate-600 border-slate-500/30 hover:border-slate-500/50',
    bgGlowClass: 'bg-slate-50/50',
  },
];

export default function WindowsSettings() {
  const [activeMode, setActiveMode] = useState<PowerModeOption>(powerOptions[1]);
  const [applyingPower, setApplyingPower] = useState(false);
  const [appliedPowerSuccess, setAppliedPowerSuccess] = useState(false);
  
  const [loadingState, setLoadingState] = useState(false);
  const [fixingAction, setFixingAction] = useState<string | null>(null);
  const [isApplyingSettings, setIsApplyingSettings] = useState(false);
  const [applyingSection, setApplyingSection] = useState<'system' | 'taskbar' | 'optimization' | null>(null);
  const [successNotice, setSuccessNotice] = useState<{ title: string; message: string; sectionName: string } | null>(null);
  const [tamperEnabled, setTamperEnabled] = useState<boolean | null>(null);
  const [tamperManaged, setTamperManaged] = useState<boolean>(false);

  // Advanced Optimization Modal State
  const [showAdvancedModal, setShowAdvancedModal] = useState(false);
  const [applyingAdvanced, setApplyingAdvanced] = useState(false);
  const [advancedResult, setAdvancedResult] = useState<string | null>(null);

  type AdvancedOpts = {
    createRestorePoint: boolean;
    disableHpet: boolean;
    disableNetworkThrottling: boolean;
    purgeStandbyRam: boolean;
    disableBackgroundApps: boolean;
    disableDeliveryOptimization: boolean;
    enableGameMode: boolean;
    disableStartupDelay: boolean;
    enableSsdTrim: boolean;
  };

  const [advancedOpts, setAdvancedOpts] = useState<AdvancedOpts>({
    createRestorePoint: true,
    disableHpet: false,
    disableNetworkThrottling: false,
    purgeStandbyRam: false,
    disableBackgroundApps: true,
    disableDeliveryOptimization: true,
    enableGameMode: true,
    disableStartupDelay: true,
    enableSsdTrim: true,
  });

  const handleApplyAdvanced = async () => {
    setApplyingAdvanced(true);
    setAdvancedResult(null);
    try {
      const res = await (window as any).electronAPI.applyAdvancedOptimization(advancedOpts);
      if (res && res.success) {
        setAdvancedResult("Đã áp dụng toàn bộ các cấu hình tối ưu nâng cao thành công!");
        const appliedList: string[] = [];
        if (advancedOpts.createRestorePoint) appliedList.push("Tạo điểm khôi phục hệ thống");
        if (advancedOpts.disableHpet) appliedList.push("Tắt HPET & Dynamic Tick");
        if (advancedOpts.disableNetworkThrottling) appliedList.push("Tắt Network Throttling");
        if (advancedOpts.purgeStandbyRam) appliedList.push("Dọn dẹp Standby RAM");
        if (advancedOpts.disableBackgroundApps) appliedList.push("Chặn Background Apps");
        if (advancedOpts.disableDeliveryOptimization) appliedList.push("Tắt Delivery Optimization");
        if (advancedOpts.enableGameMode) appliedList.push("Kích hoạt Game Mode");
        if (advancedOpts.disableStartupDelay) appliedList.push("Bỏ thời gian chờ khởi động ứng dụng");
        appendWindowsHistory(appliedList.map(x => `✅ [Tối ưu nâng cao] ${x}`));
      } else {
        setAdvancedResult("Lỗi khi áp dụng: " + (res?.error || "Không xác định"));
      }
    } catch (e: any) {
      setAdvancedResult("Lỗi: " + e.message);
    } finally {
      setApplyingAdvanced(false);
    }
  };


  const handleRestoreAdvanced = async () => {
    if (!confirm("Bạn có chắc chắn muốn khôi phục toàn bộ các cấu hình tối ưu nâng cao về mặc định của Windows?")) return;
    setApplyingAdvanced(true);
    setAdvancedResult(null);
    try {
      const res = await (window as any).electronAPI.restoreAdvancedOptimization();
      if (res && res.success) {
        setAdvancedResult("Đã khôi phục toàn bộ cài đặt nâng cao về mặc định của Windows thành công!");
        appendWindowsHistory(['🔄 [Tối ưu nâng cao] Khôi phục về mặc định (Undo)']);
      } else {
        setAdvancedResult("Lỗi khi khôi phục: " + (res?.error || "Không xác định"));
      }
    } catch (e: any) {
      setAdvancedResult("Lỗi: " + e.message);
    } finally {
      setApplyingAdvanced(false);
    }
  };

  
  // Settings State
  const [state, setState] = useState({
    // System Settings
    thisPc: false,
    classicMenu: false,
    photoViewer: false,
    hideTaskbarIcons: false,
    disableAutoBrightness: false,
    removeLangs: false,
    
    // Taskbar Settings
    hideSearch: false,
    hideTaskView: false,
    hideWidgets: false,
    hideChat: false,
    hideCopilot: false,
    hideNews: false,
    taskbarLeft: false, // false = Center, true = Left
    
    // Optimization (True = Disable service for optimization)
    disableHibernate: false,
    disableFastStartup: false,
    disablePrefetch: false,
    disableSysMain: false,
    disableRemoteDesktop: false,
    disableErrorReporting: false,
    disableSearchIndexing: false,
    disablePrintSpooler: false, // Default FALSE: Máy in KHÔNG bị chọn tắt mặc định!
    disableDefender: false,
    disableTelemetry: false,
    disableXboxServices: false,
    disableOneDrive: false
  });

  // Time Sync State (Cách 2: Dedicated Card)
  interface TimeInfo {
    currentTime: string;
    timeZoneId: string;
    timeZoneName: string;
    isVietnam: boolean;
    serviceStatus: string;
    ntpServer: string;
  }
  const [timeInfo, setTimeInfo] = useState<TimeInfo | null>(null);
  const [loadingTime, setLoadingTime] = useState(false);
  const [syncingTime, setSyncingTime] = useState(false);
  const [selectedNtp, setSelectedNtp] = useState<string>('google');
  const [timeSyncResult, setTimeSyncResult] = useState<string | null>(null);

  const loadTimeInfo = async () => {
    setLoadingTime(true);
    try {
      const res = await (window as any).electronAPI?.getTimeInfo?.();
      if (res && res.success) {
        setTimeInfo(res);
      }
    } catch (e) {
      console.error('Failed to load time info:', e);
    } finally {
      setLoadingTime(false);
    }
  };

  const handleSyncVietnamTime = async () => {
    setSyncingTime(true);
    setTimeSyncResult(null);
    try {
      const res = await (window as any).electronAPI?.syncVietnamTime?.(selectedNtp);
      if (res && res.success) {
        setTimeInfo(prev => ({
          currentTime: res.currentTime || prev?.currentTime || '',
          timeZoneId: res.timeZoneId || 'SE Asia Standard Time',
          timeZoneName: res.timeZoneName || '(UTC+07:00) Bangkok, Hanoi, Jakarta',
          isVietnam: true,
          serviceStatus: res.serviceStatus || 'Running',
          ntpServer: selectedNtp === 'cloudflare' ? 'time.cloudflare.com' : selectedNtp === 'vn_pool' ? 'vn.pool.ntp.org' : 'time.google.com',
        }));
        setTimeSyncResult("Đã chuẩn hóa múi giờ Việt Nam (UTC+07) và đồng bộ thời gian thành công!");
        appendWindowsHistory(['⏰ [Chuẩn Hóa Giờ VN] Đã đặt múi giờ SE Asia Standard Time (UTC+07) + Resync NTP']);
        setSuccessNotice({
          title: "Chuẩn Hóa Giờ Thành Công",
          message: "Múi giờ đã đặt về UTC+07 (Bangkok, Hanoi, Jakarta) và đồng bộ máy chủ NTP.",
          sectionName: "Giờ Hệ Thống"
        });
      } else {
        setTimeSyncResult("Lỗi: " + (res?.error || "Không thể đồng bộ"));
      }
    } catch (e: any) {
      setTimeSyncResult("Lỗi: " + e.message);
    } finally {
      setSyncingTime(false);
    }
  };

  useEffect(() => {
    loadSettings();
    loadTamperStatus();
    loadTimeInfo();
  }, []);

  const loadTamperStatus = async () => {
    try {
      const res = await (window as any).electronAPI.readTamperProtection();
      if (res && res.success && res.data) {
        setTamperEnabled(!!res.data.enabled);
        setTamperManaged(!!res.data.managed);
      }
    } catch (e) {
      console.error('Tamper Protection read failed:', e);
    }
  };

  const [changeHistory, setChangeHistory] = useState<string[]>(() => {
    try {
      const rep = JSON.parse(localStorage.getItem('tp_session_audit_report') || '{}');
      return Array.isArray(rep.windowsOptimizations) ? rep.windowsOptimizations : [];
    } catch (e) { return []; }
  });

  const appendWindowsHistory = (entries: string[]) => {
    setChangeHistory(prev => {
      const merged = [...entries, ...prev].slice(0, 50);
      updateSessionReport({ windowsOptimizations: merged });
      return merged;
    });
  };


  const loadSettings = async (forceRefresh?: boolean) => {
    setLoadingState(true);
    try {
      const res = await (window as any).electronAPI.readWindowsSettings(forceRefresh ? true : undefined);
      if (res.success && res.data) {
        setState(prev => ({ ...prev, ...res.data }));
        
        // Match active power plan across all 5 profiles
        if (res.data.activePowerPlan) {
          const guid = res.data.activePowerPlan.toLowerCase();
          if (guid === '381b4222-f694-41f0-9685-ff5bb260df2e') {
            setActiveMode(powerOptions.find(p => p.id === 'balanced') || powerOptions[1]);
          } else if (guid === '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c') {
            setActiveMode(powerOptions.find(p => p.id === 'performance') || powerOptions[3]);
          } else if (guid === 'e9a42b02-d5df-448d-aa00-03f14749eb61') {
            setActiveMode(powerOptions.find(p => p.id === 'ultimate') || powerOptions[4]);
          } else if (guid === 'a1841308-3541-4fab-bc81-f71556f20b4a' || guid === '961cc777-21a3-4279-8477-9a91373d0850') {
            setActiveMode(powerOptions.find(p => p.id === 'battery') || powerOptions[0]);
          } else if (guid === '2e2e98c4-30a1-4e5e-8dd5-8f5bf71f42f2' || guid.includes('8ca33a75')) {
            setActiveMode(powerOptions.find(p => p.id === 'gaming') || powerOptions[2]);
          }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingState(false);
    }
  };

  const handleChange = (key: keyof typeof state, value: boolean) => {
    if ((key === 'disableDefender' && value === true) || (key === 'defender' && value === false)) {
      let msg = "CẢNH BÁO: Tắt Windows Defender (DisableAntiSpyware) làm máy tính dễ bị rủi ro bảo mật.\n\nBạn có chắc chắn muốn tắt?";
      if (tamperEnabled) {
        msg = "⚠️ TAMPER PROTECTION ĐANG BẬT ⚠️\n\nWindows Defender Tamper Protection hiện đang kích hoạt. Tắt chống xâm nhập của Defender ngăn các thay đổi registry như thế này có hiệu lực.\n\nĐể tắt Defender thực sự, bạn CẦN vào: Cài đặt Windows → Quyền riêng tư & bảo mật → Bảo mật Windows → Bảo vệ chống virus & mối đe dọa → Quản lý bảo vệ → tắt Tamper Protection thủ công trước.\n\n" + (tamperManaged ? "Lưu ý: Tamper Protection đang được quản lý bởi tổ chức/GPO - có thể không tắt thủ công được.\n\n" : "") + "Bạn có chắc chắn vẫn muốn bật cài đặt này (không có hiệu lực khi Tamper Protection bật)?";
      }
      const confirm = window.confirm(msg);
      if (!confirm) return;
    }
    setState(prev => ({
      ...prev,
      [key]: value,
      ...(key === 'disableDefender' ? { defender: !value } : key === 'defender' ? { disableDefender: !value } : {})
    }));
  };

  const { startTask, updateTask, completeTask, failTask, getTask } = useTaskManager();

  const handleFixWindows = async (action: string) => {

    let taskTitle = 'SFC & DISM Sửa Lỗi Màn Xanh';
    if (action === 'update') taskTitle = 'Reset Windows Update';
    if (action === 'icon') taskTitle = 'Fix Lỗi Icon Cache';
    
    const taskId = `win-fix-${action}`;
    startTask(taskId, taskTitle, 'Thiết Lập Windows', 'Đang khởi tạo tiến trình...', 'windows-settings');
    setFixingAction(action);

    let p = 5;
    let secondsElapsed = 0;
    const interval = setInterval(() => {
      secondsElapsed += 1;
      if (action === 'sfc') {
        const minutes = Math.floor(secondsElapsed / 60);
        const seconds = secondsElapsed % 60;
        const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
        const realisticP = Math.min(90, Math.floor(5 + (secondsElapsed / 600) * 85));
        updateTask(
          taskId,
          realisticP,
          `Đang quét & sửa chữa hệ thống (${timeStr})... Vui lòng không tắt máy`,
          `[*] SFC & DISM đang chạy: ${timeStr} (Quá trình có thể kéo dài 5-15 phút)...`
        );
      } else {
        p += Math.floor(Math.random() * 6) + 2;
        if (p > 95) p = 95;
        updateTask(taskId, p, `Đang xử lý ${taskTitle} (${p}%)...`, `[*] Tiến trình ${taskTitle}: ${p}%`);
      }
    }, 1000);

    try {
      let result: any = null;
      if (action === 'sfc') {
        result = await (window as any).electronAPI.runWindowsFixer();
      } else if (action === 'update') {
        result = await (window as any).electronAPI.resetWindowsUpdate();
      } else if (action === 'icon') {
        result = await (window as any).electronAPI.rebuildIconCache();
      }
      clearInterval(interval);
      if (result && result.success) {
        const details = result.details ? result.details.join('\n') : '';
        completeTask(taskId, `Đã hoàn tất ${taskTitle} thành công!${details ? '\n' + details : ''}`);
        // Log real parsed status (SFC: 3 fixed states / DISM) to session history
        if (action === 'sfc') {
          const sfcStatus = result.sfcStatus || 'Unknown';
          const dismStatus = result.dismStatus || 'Unknown';
          appendWindowsHistory([
            `🔧 [SFC] ${sfcStatus === 'Clean' ? 'Không phát hiện vi phạm (sạch)'
              : sfcStatus === 'Repaired' ? 'Phát hiện & sửa thành công file hỏng'
              : sfcStatus === 'Failed' ? 'Phát hiện file hỏng nhưng KHÔNG sửa được hết'
              : sfcStatus === 'CannotRun' ? 'Không thể chạy được (thiếu quyền/tồn kho)'
              : 'Trạng thái không xác định'}`,
            `🔧 [DISM] ${dismStatus === 'Clean' ? 'Kho thành phần sạch'
              : dismStatus === 'Repaired' ? 'Đã sửa lỗi kho thành phần'
              : 'Trạng thái không xác định'}`,
          ]);
        } else if (action === 'update') {
          appendWindowsHistory(['🔧 [Reset Windows Update] Đã reset 4 dịch vụ + SoftwareDistribution + catroot2']);
        } else if (action === 'icon') {
          appendWindowsHistory(['🔧 [Icon Cache] Đã rebuild icon cache + thumbnail']);
        }
      } else {
        failTask(taskId, result?.error || `Có lỗi xảy ra khi thực hiện ${taskTitle}`);
      }
    } catch (e: any) {
      clearInterval(interval);
      failTask(taskId, e.message);
    } finally {
      setFixingAction(null);
    }
  };

  const handleApplyPowerMode = async (mode: PowerModeOption) => {
    setApplyingPower(true);
    setAppliedPowerSuccess(false);
    setActiveMode(mode);

    try {
      await (window as any).electronAPI.applyPowerPlan({ mode: mode.id });
      setAppliedPowerSuccess(true);
    } catch (err: any) {
      window.alert("Lỗi áp dụng chế độ nguồn điện: " + err.message);
    } finally {
      setApplyingPower(false);
    }
  };


  const applySettings = async (type: 'system' | 'taskbar' | 'optimization') => {
    setApplyingSection(type);
    setIsApplyingSettings(true);

    try {
      // Phase 1 Safety: Auto backup Registry before tweak
      try { await (window as any).electronAPI.backupRegistryKeys(); } catch (e) {}

      let res;
      let sectionName = '';
      if (type === 'system') {
        sectionName = 'Cài đặt hệ thống';
        res = await (window as any).electronAPI.applyWindowsSettings(state);
      } else if (type === 'taskbar') {
        sectionName = 'Taskbar & System Tray';
        res = await (window as any).electronAPI.applyTaskbarSettings(state);
      } else if (type === 'optimization') {
        // Defender safety guard: if user intends to disable Defender but Tamper Protection is on,
        // warn and refuse to apply (the change would be ineffective AND misleading).
        if (state.disableDefender && tamperEnabled) {
          const proceed = window.confirm(
            "⚠️ Tamper Protection đang bật — Tắt Defender sẽ KHÔNG có hiệu lực.\n\n" +
            (tamperManaged
              ? "Tamper Protection đang được quản lý bởi tổ chức (GPO/Intune).\n\n"
              : "Hãy tắt Tamper Protection thủ công trong Bảo mật Windows trước, rồi bỏ chọn 'Tắt Defender' và áp dụng lại. Công cụ này không tự tắt hộ bạn.\n\n") +
            "Bạn có chắc chắn vẫn tiếp tục áp dụng (không có hiệu lực cho phần Defender)?\n[Nhấn OK để tiếp tục, hoặc Cancel để hủy]"
          );
          if (!proceed) { setApplyingSection(null); setIsApplyingSettings(false); return; }
        }
        sectionName = 'Tối ưu hóa Services';
        res = await (window as any).electronAPI.applySystemOptimization(state);
      }
      
      if (res && res.success) {
        const logItems: string[] = [];
        if (type === 'system') {
          logItems.push('Cài đặt hệ thống (Registry)');
        } else if (type === 'taskbar') {
          logItems.push('Taskbar & System Tray');
        } else {
          const optLabels: Array<[keyof typeof state, string]> = [
            ['disableHibernate', 'Tắt Hibernate'],
            ['disableFastStartup', 'Tắt Fast Startup'],
            ['disablePrefetch', 'Tắt Prefetch'],
            ['disableSysMain', 'Tắt SysMain'],
            ['disableRemoteDesktop', 'Tắt Remote Desktop'],
            ['disableErrorReporting', 'Tắt Error Reporting'],
            ['disableSearchIndexing', 'Tắt Tìm kiếm ngầm'],
            ['disablePrintSpooler', 'Tắt Print Spooler'],
            ['disableDefender', 'Tắt Defender'],
            ['disableTelemetry', 'Tắt Telemetry'],
            ['disableXboxServices', 'Tắt dịch vụ Xbox'],
            ['disableOneDrive', 'Tắt OneDrive'],
          ];
          optLabels.forEach(([k, lbl]) => { if (state[k]) logItems.push(lbl); });
        }
        appendWindowsHistory(logItems.map(x => `✅ [${sectionName}] ${x}`));
        setSuccessNotice({
          title: `Đã áp dụng thành công: ${sectionName}`,
          message: `Các cấu hình Registry và Services đã được cập nhật vào hệ thống.`,
          sectionName
        });
      } else {
        alert("Lỗi khi áp dụng: " + (res?.error || "Không xác định"));
      }
    } catch (e: any) {
      alert("Lỗi Exception: " + e.message);
    } finally {
      setIsApplyingSettings(false);
      setApplyingSection(null);
    }
  };

  const toggleCheckbox = (label: string, id: keyof typeof state) => (
    <label className="flex items-center gap-2.5 cursor-pointer group py-1">
      <div className="relative flex items-center justify-center">
        <input 
          type="checkbox" 
          checked={state[id]}
          onChange={(e) => handleChange(id, e.target.checked)}
          className="appearance-none w-4 h-4 border border-slate-700 rounded-md bg-[#0e1626] checked:bg-emerald-500 checked:border-emerald-500 transition-colors focus:ring-1 focus:ring-emerald-400 focus:outline-none cursor-pointer"
        />
        <svg className={`absolute w-3 h-3 text-slate-950 pointer-events-none transition-opacity font-bold ${state[id] ? 'opacity-100' : 'opacity-0'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
      <span className="text-xs text-slate-300 select-none group-hover:text-emerald-400 transition-colors">{label}</span>
    </label>
  );

  return (
    <div className="space-y-5 pb-10" id="windows-settings-container">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-[#121c33] to-[#0f172a] p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <Settings className="w-6 h-6 text-emerald-400" />
            Thiết Lập &amp; Tối Ưu Windows
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Giao diện tùy chỉnh, hiệu năng phần cứng và quản lý nguồn điện cho Windows 10 / Windows 11.
          </p>
        </div>
        <button 
          onClick={() => loadSettings(true)}
          disabled={loadingState}
          className="flex items-center gap-2 px-4 py-2 bg-[#18233c] hover:bg-[#202f50] text-slate-200 hover:text-white border border-slate-700 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingState ? 'animate-spin text-emerald-400' : ''}`} />
          Tải lại trạng thái
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5">
        {/* CARD 0: WINDOWS FIXER */}
        <div className="bg-[#101728] rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
          <div className="bg-[#131d33] border-b border-slate-800 p-4">
            <h3 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-2">
              <Wrench className="w-4 h-4" />
              Sửa Lỗi Windows Chuyên Sâu (1-Click)
            </h3>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button 
                onClick={() => handleFixWindows('sfc')}
                disabled={fixingAction !== null}
                className="flex flex-col items-center justify-center gap-2 p-4 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 border border-rose-500/30 rounded-xl transition-all shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {fixingAction === 'sfc' ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Shield className="w-6 h-6" />}
                <span className="font-bold text-xs">{fixingAction === 'sfc' ? "Đang xử lý (10-15p)..." : "Phục Hồi Hệ Thống"}</span>
                <span className="text-[11px] text-rose-400/80 text-center">Chạy SFC &amp; DISM sửa lỗi màn xanh, file hỏng</span>
              </button>
              
              <button 
                onClick={() => handleFixWindows('update')}
                disabled={fixingAction !== null}
                className="flex flex-col items-center justify-center gap-2 p-4 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-xl transition-all shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {fixingAction === 'update' ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Download className="w-6 h-6" />}
                <span className="font-bold text-xs">{fixingAction === 'update' ? "Đang xử lý..." : "Sửa Kẹt Update"}</span>
                <span className="text-[11px] text-emerald-400/80 text-center">Reset Windows Update, xóa SoftwareDistribution</span>
              </button>
              
              <button 
                onClick={() => handleFixWindows('icon')}
                disabled={fixingAction !== null}
                className="flex flex-col items-center justify-center gap-2 p-4 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl transition-all shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {fixingAction === 'icon' ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Monitor className="w-6 h-6" />}
                <span className="font-bold text-xs">{fixingAction === 'icon' ? "Đang xử lý..." : "Fix Lỗi Icon"}</span>
                <span className="text-[11px] text-amber-400/80 text-center">Rebuild Icon/Thumbnail Cache bị trắng đen</span>
              </button>
            </div>
          </div>
        </div>

        {/* CARD: ĐỒNG BỘ & CHUẨN HÓA GIỜ VIỆT NAM (1-CLICK) - CÁCH 2 */}
        <div className="bg-[#101728] rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
          <div className="bg-[#131d33] border-b border-slate-800 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              Chuẩn Hóa &amp; Đồng Bộ Giờ Việt Nam (1-Click)
            </h3>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 self-start sm:self-auto">
              UTC+07:00 Bangkok, Hanoi, Jakarta
            </span>
          </div>

          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Box 1: Giờ hiện tại */}
              <div className="p-3.5 bg-[#141e36] border border-slate-800 rounded-xl space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Thời Gian Hệ Thống
                </span>
                <div className="text-sm md:text-base font-extrabold font-mono text-emerald-400 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{timeInfo?.currentTime || (loadingTime ? 'Đang đọc...' : 'Chưa tải')}</span>
                </div>
                <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                  <span>Dịch vụ W32Time:</span>
                  <b className={`font-mono font-bold ${timeInfo?.serviceStatus === 'Running' ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {timeInfo?.serviceStatus || 'Unknown'}
                  </b>
                </div>
              </div>

              {/* Box 2: Múi giờ */}
              <div className="p-3.5 bg-[#141e36] border border-slate-800 rounded-xl space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Múi Giờ Hiện Tại
                </span>
                <div className="text-xs font-bold text-white truncate" title={timeInfo?.timeZoneName}>
                  {timeInfo?.timeZoneName || timeInfo?.timeZoneId || 'Đang kiểm tra...'}
                </div>
                <div>
                  {timeInfo?.isVietnam ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                      <CheckCircle className="w-3 h-3" /> Chuẩn múi giờ Việt Nam
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400">
                      <AlertTriangle className="w-3 h-3" /> Đang bị lệch múi giờ
                    </span>
                  )}
                </div>
              </div>

              {/* Box 3: Chọn máy chủ NTP */}
              <div className="p-3.5 bg-[#141e36] border border-slate-800 rounded-xl space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Máy Chủ NTP Đồng Bộ
                </span>
                <select
                  value={selectedNtp}
                  onChange={(e) => setSelectedNtp(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-[#0e1628] border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value="google">Google NTP (time.google.com) - Ổn định</option>
                  <option value="cloudflare">Cloudflare NTP (time.cloudflare.com) - Tốc độ</option>
                  <option value="vn_pool">Vietnam NTP Pool (vn.pool.ntp.org) - Nội địa</option>
                </select>
                <span className="text-[10px] text-slate-500 block truncate" title={timeInfo?.ntpServer}>
                  Đang dùng: {timeInfo?.ntpServer || 'time.windows.com'}
                </span>
              </div>
            </div>

            {/* Action Bar & Feedback */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
              <p className="text-xs text-slate-400 leading-relaxed max-w-xl">
                1-Click tự động đặt múi giờ <b>SE Asia Standard Time (UTC+07)</b>, bật service W32Time tự động, chống lệch giờ Dual-boot và cưỡng chế đồng bộ ngay lập tức.
              </p>

              <button
                onClick={handleSyncVietnamTime}
                disabled={syncingTime}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition cursor-pointer disabled:opacity-50 shrink-0 active:scale-95"
              >
                <RefreshCw className={`w-4 h-4 text-slate-950 ${syncingTime ? 'animate-spin' : ''}`} />
                <span>{syncingTime ? 'Đang Đồng Bộ Giờ...' : 'Chuẩn Hóa Giờ VN Ngay (1-Click)'}</span>
              </button>
            </div>

            {timeSyncResult && (
              <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 animate-fade-in ${
                timeSyncResult.startsWith('Lỗi')
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              }`}>
                {timeSyncResult.startsWith('Lỗi') ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle className="w-4 h-4 shrink-0" />}
                <span>{timeSyncResult}</span>
              </div>
            )}
          </div>
        </div>

        {/* CARD 1: CÀI ĐẶT HỆ THỐNG */}
        <div className="bg-[#101728] rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
          <div className="bg-[#131d33] border-b border-slate-800 p-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Monitor className="w-4 h-4 text-emerald-400" />
              Cài đặt hệ thống
            </h3>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {toggleCheckbox("Explorer mở This PC thay vì Quick Access", "thisPc")}
              {toggleCheckbox("Sử dụng Context Menu cổ điển (Win11 to Win10)", "classicMenu")}
              {toggleCheckbox("Kích hoạt Windows Photo Viewer", "photoViewer")}
              {toggleCheckbox("Ẩn icon trên Taskbar (Giữ lại mạng, loa, pin)", "hideTaskbarIcons")}
              {toggleCheckbox("Tắt tự động điều chỉnh độ sáng", "disableAutoBrightness")}
              {toggleCheckbox("Xóa bàn phím ngôn ngữ khác (giữ US)", "removeLangs")}
            </div>
            <div className="mt-6 flex flex-col items-end gap-3">
              {applyingSection === 'system' && (
                <div className="w-full space-y-1">
                  <div className="flex justify-between text-xs text-emerald-400 font-semibold animate-pulse">
                    <span>Đang cập nhật Registry cài đặt hệ thống...</span>
                    <span>Vui lòng chờ</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full animate-pulse w-full" />
                  </div>
                </div>
              )}
              <button 
                onClick={() => applySettings('system')}
                disabled={isApplyingSettings}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 cursor-pointer active:scale-95"
              >
                {applyingSection === 'system' ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Đang áp dụng hệ thống...</span>
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4" />
                    <span>Áp dụng Cài đặt hệ thống</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* CARD 2: TASKBAR */}
        <div className="bg-[#101728] rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
          <div className="bg-[#131d33] border-b border-slate-800 p-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Settings className="w-4 h-4 text-emerald-400" />
              Taskbar - System Tray (Win10/11)
            </h3>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              {toggleCheckbox("Ẩn Search", "hideSearch")}
              {toggleCheckbox("Ẩn Task View", "hideTaskView")}
              {toggleCheckbox("Ẩn Widgets", "hideWidgets")}
              {toggleCheckbox("Ẩn Chat/Teams", "hideChat")}
              {toggleCheckbox("Ẩn Copilot", "hideCopilot")}
              {toggleCheckbox("Ẩn News/Weather", "hideNews")}
            </div>
            {applyingSection === 'taskbar' && (
              <div className="mb-4 space-y-1">
                <div className="flex justify-between text-xs text-emerald-400 font-semibold animate-pulse">
                  <span>Đang áp dụng Taskbar &amp; Restart Explorer...</span>
                  <span>Đang xử lý</span>
                </div>
                <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full animate-pulse w-full" />
                </div>
              </div>
            )}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-[#131d33] rounded-xl border border-slate-800">
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-slate-300">Vị trí Taskbar:</span>
                <select 
                  className="bg-[#0e1626] border border-slate-700 text-slate-200 text-xs rounded-lg focus:border-emerald-500 p-2 outline-none min-w-[120px]"
                  value={state.taskbarLeft ? 'left' : 'center'}
                  onChange={(e) => handleChange('taskbarLeft', e.target.value === 'left')}
                >
                  <option value="left">Căn trái</option>
                  <option value="center">Ở giữa (Center)</option>
                </select>
              </div>
              <button 
                onClick={() => applySettings('taskbar')}
                disabled={isApplyingSettings}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 cursor-pointer active:scale-95"
              >
                {applyingSection === 'taskbar' ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Đang áp dụng Taskbar...</span>
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4" />
                    <span>Áp dụng Taskbar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* CARD 3: TỐI ƯU HỆ THỐNG */}
        <div className="bg-[#101728] rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
          <div className="bg-[#131d33] border-b border-slate-800 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              Tối ưu hệ thống (Tắt dịch vụ ngầm)
            </h3>
            <span className="text-[10px] font-semibold text-slate-400 bg-slate-800/80 px-2.5 py-0.5 rounded-full border border-slate-700">
              💡 Tích chọn = Chọn TẮT dịch vụ khi bấm áp dụng
            </span>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3">
              {toggleCheckbox("Tắt Ngủ đông (Hibernate)", "disableHibernate")}
              {toggleCheckbox("Tắt Remote Desktop", "disableRemoteDesktop")}
              {toggleCheckbox("Tắt Defender (DisableAntiSpyware)", "disableDefender")}
              
              {toggleCheckbox("Tắt Fast Startup (Khởi động nhanh)", "disableFastStartup")}
              {toggleCheckbox("Tắt Error Reporting (Báo lỗi)", "disableErrorReporting")}
              {toggleCheckbox("Tắt Telemetry (Thu thập dữ liệu)", "disableTelemetry")}
              
              <div className="flex flex-col">
                {toggleCheckbox("Tắt Prefetch (Tải trước app)", "disablePrefetch")}
                {state.disablePrefetch && (
                  <span className="text-[10px] text-rose-400 font-bold ml-6 mt-0.5 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> ⚠️ Làm chậm khởi động app
                  </span>
                )}
              </div>
              <div className="flex flex-col">
                {toggleCheckbox("Tắt Windows Search Indexing", "disableSearchIndexing")}
                {state.disableSearchIndexing && (
                  <span className="text-[10px] text-rose-400 font-bold ml-6 mt-0.5 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> ⚠️ Mất Start Menu Search
                  </span>
                )}
              </div>
              {toggleCheckbox("Tắt Xbox Services", "disableXboxServices")}
              
              <div className="flex flex-col">
                {toggleCheckbox("Tắt Superfetch/SysMain", "disableSysMain")}
                {state.disableSysMain && (
                  <span className="text-[10px] text-rose-400 font-bold ml-6 mt-0.5 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> ⚠️ Làm chậm khởi động app
                  </span>
                )}
              </div>
              <div className="flex flex-col">
                {toggleCheckbox("Tắt Dịch vụ Máy in (Print Spooler)", "disablePrintSpooler")}
                {state.disablePrintSpooler ? (
                  <span className="text-[10px] text-amber-400 font-bold ml-6 mt-0.5 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Đang chọn TẮT (Ngừng in)
                  </span>
                ) : (
                  <span className="text-[10px] text-emerald-400 font-medium ml-6 mt-0.5">✓ Bỏ chọn = Giữ BẬT máy in</span>
                )}
              </div>
              {toggleCheckbox("Tắt OneDrive tự khởi động", "disableOneDrive")}
            </div>
            
            <p className="text-[11px] text-slate-400 mt-4 italic">💡 Tích chọn các mục để TẮT dịch vụ ngầm tương ứng nhằm giải phóng RAM &amp; CPU khi bấm "Áp dụng tối ưu".</p>

            {state.disableDefender && tamperEnabled && (
              <div className="mt-3 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-start gap-2.5 animate-fade-in">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <strong className="font-bold text-rose-200 block">⚠️ Tamper Protection ĐANG BẬT — Tắt Defender sẽ KHÔNG có hiệu lực:</strong>
                  <p className="text-slate-300">
                    {tamperManaged
                      ? "Tamper Protection đang được quản lý bởi tổ chức (GPO/Intune). Cần xem chính sách quản trị trước khi tắt Defender."
                      : "Vào: Cài đặt → Quyền riêng tư & bảo mật → Bảo mật Windows → Bảo vệ chống virus & mối đe dọa → Quản lý bảo vệ → tắt Tamper Protection thủ công trước. Công cụ này KHÔNG tự tắt hộ bạn."}
                  </p>
                </div>
              </div>
            )}

            {state.disableDefender && !tamperEnabled && tamperEnabled !== null && (
              <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-start gap-2.5 animate-fade-in">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <strong className="font-bold text-amber-200 block">⚠️ Cảnh báo tắt Windows Defender:</strong>
                  <p className="text-slate-300">Tamper Protection đang tắt. Registry DisableAntiSpyware có thể có hiệu lực, nhưng việc tắt Defender làm giảm bảo vệ máy tính. Cân nhắc kỹ trước khi áp dụng.</p>
                </div>
              </div>
            )}

            {applyingSection === 'optimization' && (
              <div className="mt-4 space-y-1">
                <div className="flex justify-between text-xs text-emerald-400 font-semibold animate-pulse">
                  <span>Đang cấu hình Windows Services &amp; Registry...</span>
                  <span>Đang thực thi</span>
                </div>
                <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full animate-pulse w-full" />
                </div>
              </div>
            )}

            <div className="mt-6 flex flex-col sm:flex-row justify-end gap-3 border-t border-slate-800 pt-5">
              <button 
                onClick={() => applySettings('optimization')}
                disabled={isApplyingSettings}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 cursor-pointer active:scale-95"
              >
                {applyingSection === 'optimization' ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Đang áp dụng tối ưu...</span>
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4" />
                    <span>Áp dụng tối ưu</span>
                  </>
                )}
              </button>
              
              <button 
                onClick={() => setShowAdvancedModal(true)}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <Zap className="w-4 h-4" />
                Tối ưu nâng cao
              </button>
            </div>
          </div>
        </div>

        {/* CARD 4: POWER CONTROL */}
        <div className="bg-[#101728] rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
          <div className="bg-[#131d33] border-b border-slate-800 p-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              Kiểm soát &amp; Tối ưu nguồn điện (Power Plan)
            </h3>
          </div>

          <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Col: Mode List selectors */}
            <div className="lg:col-span-7 space-y-3">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-2">Lựa chọn cấu hình nguồn điện</span>
              {powerOptions.map((mode) => {
                const isSelected = activeMode.id === mode.id;
                return (
                  <button
                    key={mode.id}
                    onClick={() => handleApplyPowerMode(mode)}
                    disabled={applyingPower}
                    className={`w-full p-4 rounded-xl text-left border transition-all cursor-pointer flex items-start justify-between gap-4 ${
                      isSelected
                        ? 'bg-[#162544] border-emerald-500/50 shadow-md shadow-emerald-500/5'
                        : 'bg-[#131d33] border-slate-800 hover:border-slate-700 hover:bg-[#16223b]'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {mode.id === 'battery' && <Battery className="h-4 w-4 text-emerald-400" />}
                        {mode.id === 'balanced' && <Zap className="h-4 w-4 text-emerald-400" />}
                        {mode.id === 'gaming' && <Zap className="h-4 w-4 text-amber-400 animate-pulse" />}
                        {mode.id === 'performance' && <Zap className="h-4 w-4 text-emerald-400" />}
                        {mode.id === 'ultimate' && <Zap className="h-4 w-4 text-cyan-400 animate-bounce" />}
                        <span className="text-xs font-bold text-slate-100">{mode.name}</span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-medium block">{mode.subName}</span>
                      <p className="text-[11px] text-slate-400 leading-relaxed max-w-lg mt-1">{mode.description}</p>
                    </div>

                    <span className={`text-[11px] font-semibold shrink-0 flex flex-col items-end gap-1 ${isSelected ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {isSelected ? 'Đang kích hoạt' : 'Bấm để chọn'}
                      {applyingPower && isSelected && <RefreshCw className="w-3 h-3 animate-spin" />}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Right Col: Performance Gauge Indicators */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-[#131d33] p-5 rounded-xl border border-slate-800 space-y-5">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider pb-2 border-b border-slate-800 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-amber-400" />
                  Chỉ số kỹ thuật dự kiến
                </h3>

                <div className="space-y-4 text-xs">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-slate-400">
                      <span>Khả năng đáp ứng của CPU</span>
                      <span className="text-emerald-400 font-semibold font-mono">{activeMode.cpuLimit}</span>
                    </div>
                    <div className="w-full bg-[#0e1626] h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-700"
                        style={{ width: `${activeMode.responsiveness * 10}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-slate-400">
                      <span>Tốc độ quạt tản nhiệt</span>
                      <span className="text-cyan-400 font-semibold font-mono">{activeMode.fanSpeed}</span>
                    </div>
                    <div className="w-full bg-[#0e1626] h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-cyan-500 to-blue-400 h-full transition-all duration-700"
                        style={{ width: `${(activeMode.drainIndex + activeMode.responsiveness) * 5}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-slate-400">
                      <span>Mức độ tiêu hao pin</span>
                      <span className="text-amber-400 font-semibold font-mono">{activeMode.drainIndex}/10</span>
                    </div>
                    <div className="w-full bg-[#0e1626] h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-500 h-full transition-all duration-700"
                        style={{ width: `${activeMode.drainIndex * 10}%` }}
                      />
                    </div>
                  </div>
                </div>

                {appliedPowerSuccess && (
                  <div className="p-3.5 bg-emerald-500/10 rounded-xl border border-emerald-500/30 flex items-start gap-2.5 text-xs text-emerald-300">
                    <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
                    <div>
                      <strong className="block font-bold">KÍCH HOẠT THÀNH CÔNG</strong>
                      Chế độ <span className="font-bold">{activeMode.name}</span> đã được áp dụng.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ADVANCED OPTIMIZATION MODAL */}
      {showAdvancedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#101728] rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-800 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
                  <Zap className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Tối Ưu Hệ Thống Nâng Cao (Extreme Performance)</h3>
                  <p className="text-xs text-slate-400">Minh bạch 100% từng tùy chọn can thiệp sâu dành cho Kỹ thuật viên &amp; Game thủ</p>
                </div>
              </div>
              <button 
                onClick={() => setShowAdvancedModal(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3 overflow-y-auto flex-1 pr-1">
              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-800 hover:border-amber-500/40 bg-[#131d33] transition-all cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={advancedOpts.createRestorePoint} 
                  onChange={e => setAdvancedOpts(prev => ({ ...prev, createRestorePoint: e.target.checked }))}
                  className="mt-1 w-4 h-4 text-amber-500 rounded border-slate-700 bg-[#0e1626]"
                />
                <div>
                  <span className="font-bold text-slate-200 text-xs block">Tự động tạo điểm khôi phục (System Restore Point)</span>
                  <span className="text-[11px] text-slate-400">Khuyên dùng. Giúp dễ dàng hoàn tác (Undo) 100% nếu muốn quay lại ban đầu.</span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-800 hover:border-amber-500/40 bg-[#131d33] transition-all cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={advancedOpts.disableHpet} 
                  onChange={e => setAdvancedOpts(prev => ({ ...prev, disableHpet: e.target.checked }))}
                  className="mt-1 w-4 h-4 text-amber-500 rounded border-slate-700 bg-[#0e1626]"
                />
                <div>
                  <span className="font-bold text-slate-200 text-xs block">Tắt HPET &amp; Dynamic Tick (Giảm độ trễ CPU cho Game)</span>
                  <span className="text-[11px] text-slate-400">Giảm khựng/khung hình rác (FPS drop/stuttering) khi chơi các tựa game bắn súng/đối kháng.</span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-800 hover:border-amber-500/40 bg-[#131d33] transition-all cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={advancedOpts.disableNetworkThrottling} 
                  onChange={e => setAdvancedOpts(prev => ({ ...prev, disableNetworkThrottling: e.target.checked }))}
                  className="mt-1 w-4 h-4 text-amber-500 rounded border-slate-700 bg-[#0e1626]"
                />
                <div>
                  <span className="font-bold text-slate-200 text-xs block">Tắt Network Throttling (Giới hạn mạng Multimedia)</span>
                  <span className="text-[11px] text-slate-400">Loại bỏ chế độ giới hạn UDP packet cho multimedia streaming. Hữu ích cho game online.</span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-800 hover:border-amber-500/40 bg-[#131d33] transition-all cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={advancedOpts.purgeStandbyRam} 
                  onChange={e => setAdvancedOpts(prev => ({ ...prev, purgeStandbyRam: e.target.checked }))}
                  className="mt-1 w-4 h-4 text-amber-500 rounded border-slate-700 bg-[#0e1626]"
                />
                <div>
                  <span className="font-bold text-slate-200 text-xs block">Dọn dẹp Standby RAM Cache (Nhả bộ nhớ RAM thừa)</span>
                  <span className="text-[11px] text-slate-400">Buộc các app đã đóng nhả RAM ra page file để tối ưu RAM trống.</span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-800 hover:border-amber-500/40 bg-[#131d33] transition-all cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={advancedOpts.disableBackgroundApps} 
                  onChange={e => setAdvancedOpts(prev => ({ ...prev, disableBackgroundApps: e.target.checked }))}
                  className="mt-1 w-4 h-4 text-amber-500 rounded border-slate-700 bg-[#0e1626]"
                />
                <div>
                  <span className="font-bold text-slate-200 text-xs block">Chặn Ứng Dụng UWP Chạy Ngầm (Disable Background Apps)</span>
                  <span className="text-[11px] text-slate-400">Ngăn các ứng dụng Store rác tự chạy ngầm ngốn tài nguyên.</span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-800 hover:border-amber-500/40 bg-[#131d33] transition-all cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={advancedOpts.disableDeliveryOptimization} 
                  onChange={e => setAdvancedOpts(prev => ({ ...prev, disableDeliveryOptimization: e.target.checked }))}
                  className="mt-1 w-4 h-4 text-amber-500 rounded border-slate-700 bg-[#0e1626]"
                />
                <div>
                  <span className="font-bold text-slate-200 text-xs block">Tắt Delivery Optimization (Chặn upload Win Update ngầm)</span>
                  <span className="text-[11px] text-slate-400">Chặn Windows chia sẻ băng thông mạng của máy bạn sang máy khác trên Internet.</span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-800 hover:border-amber-500/40 bg-[#131d33] transition-all cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={advancedOpts.enableGameMode} 
                  onChange={e => setAdvancedOpts(prev => ({ ...prev, enableGameMode: e.target.checked }))}
                  className="mt-1 w-4 h-4 text-amber-500 rounded border-slate-700 bg-[#0e1626]"
                />
                <div>
                  <span className="font-bold text-slate-200 text-xs block">Kích hoạt Windows Game Mode (Ưu tiên phần cứng)</span>
                  <span className="text-[11px] text-slate-400">Tự động ưu tiên xung nhịp CPU và tài nguyên GPU cho cửa sổ game/app đang mở.</span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-800 hover:border-amber-500/40 bg-[#131d33] transition-all cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={advancedOpts.enableSsdTrim} 
                  onChange={e => setAdvancedOpts(prev => ({ ...prev, enableSsdTrim: e.target.checked }))}
                  className="mt-1 w-4 h-4 text-amber-500 rounded border-slate-700 bg-[#0e1626]"
                />
                <div>
                  <span className="font-bold text-slate-200 text-xs block">Kích hoạt TRIM cho SSD (Bảo vệ tuổi thọ ổ cứng)</span>
                  <span className="text-[11px] text-slate-400">Đảm bảo Windows TRIM luôn hoạt động đúng cho SSD, duy trì tốc độ ghi.</span>
                </div>
              </label>

              {advancedResult && (
                <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${advancedResult.includes('thành công') ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'}`}>
                  {advancedResult.includes('thành công') ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  {advancedResult}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-800 flex flex-wrap justify-between items-center gap-3">
              <div className="flex gap-4 items-center">
                <button 
                  onClick={() => setAdvancedOpts({
                    createRestorePoint: true,
                    disableHpet: true,
                    disableNetworkThrottling: true,
                    purgeStandbyRam: true,
                    disableBackgroundApps: true,
                    disableDeliveryOptimization: true,
                    enableGameMode: true,
                    disableStartupDelay: true,
                    enableSsdTrim: true
                  })}
                  className="text-xs text-slate-400 hover:text-amber-400 font-bold cursor-pointer"
                >
                  ☑️ Tích chọn tất cả (Khuyên dùng)
                </button>
                <button 
                  onClick={handleRestoreAdvanced}
                  disabled={applyingAdvanced}
                  className="text-xs text-rose-400 hover:text-rose-300 font-bold cursor-pointer underline"
                >
                  🔄 Trả về mặc định (Undo)
                </button>
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={() => setShowAdvancedModal(false)}
                  className="px-4 py-2 bg-[#18233c] hover:bg-[#202f50] text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Đóng
                </button>
                <button 
                  onClick={handleApplyAdvanced}
                  disabled={applyingAdvanced}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-all shadow flex items-center gap-2 disabled:opacity-50 cursor-pointer active:scale-95"
                >
                  {applyingAdvanced ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Đang tối ưu...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      Áp dụng Tối Ưu Nâng Cao
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUCCESS NOTICE & REBOOT GUIDANCE MODAL */}
      {successNotice && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#101728] rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-800 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/20 rounded-xl border border-emerald-500/30 shrink-0">
                <CheckCircle className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">{successNotice.title}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{successNotice.message}</p>
              </div>
            </div>

            {/* Reboot Advice Warning Box */}
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2 text-xs text-amber-300">
              <div className="flex items-center gap-1.5 font-bold text-amber-400">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Hướng dẫn hoàn tất cài đặt:</span>
              </div>
              <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-300 leading-relaxed">
                <li>Một số thiết lập (như Menu chuột phải cổ điển, Fast Startup, Tắt Services ngầm...) cần **Khởi động lại máy (Restart PC)** để Windows áp dụng 100%.</li>
                <li>Các thiết lập giao diện Taskbar đã được làm mới Explorer tự động.</li>
              </ul>
            </div>

            {/* Actions */}
            <div className="pt-2 flex flex-col sm:flex-row items-center gap-2 justify-end">
              <button
                onClick={async () => {
                  await (window as any).electronAPI.restartExplorer();
                }}
                className="w-full sm:w-auto px-3.5 py-2 text-xs font-semibold bg-[#18233c] hover:bg-[#202f50] text-slate-200 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Restart Explorer
              </button>

              <button
                onClick={async () => {
                  if (window.confirm("Bạn có chắc chắn muốn khởi động lại máy tính ngay bây giờ để hoàn tất cài đặt?")) {
                    await (window as any).electronAPI.restartComputer();
                  }
                }}
                className="w-full sm:w-auto px-3.5 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
              >
                <Zap className="w-3.5 h-3.5" />
                Khởi động lại máy
              </button>

              <button
                onClick={() => setSuccessNotice(null)}
                className="w-full sm:w-auto px-4 py-2 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl transition-colors cursor-pointer shadow-sm active:scale-95"
              >
                Đã hiểu (Đóng)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LỊCH SỬ THAY ĐỔI TRONG PHIÊN (Session Audit) */}
      <div className="bg-[#101728] rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
        <div className="bg-[#131d33] border-b border-slate-800 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            Lịch Sử Thay Đổi Trong Phiên
          </h3>
          {changeHistory.length > 0 && (
            <button
              onClick={() => {
                setChangeHistory([]);
                updateSessionReport({ windowsOptimizations: [] });
              }}
              className="text-[11px] text-slate-400 hover:text-rose-400 font-bold cursor-pointer"
            >
              🗑️ Xóa lịch sử
            </button>
          )}
        </div>
        <div className="p-5">
          {changeHistory.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4">
              Chưa có thay đổi nào trong phiên này. Các thao tác Áp dụng / Tối ưu / Sửa lỗi sẽ được ghi lại ở đây.
            </p>
          ) : (
            <ul className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {changeHistory.map((entry, i) => (
                <li
                  key={`${i}-${entry}`}
                  className="text-[11px] text-slate-300 bg-[#0e1626] border border-slate-800/80 rounded-lg px-3 py-2 flex items-start gap-2"
                >
                  <span className="text-cyan-400 shrink-0 mt-0.5">▸</span>
                  <span className="break-words">{entry}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

