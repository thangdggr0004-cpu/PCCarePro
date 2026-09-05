
import React, { useState, useMemo } from 'react';
import { ShieldCheck, ShieldAlert, ShieldX, FileText, Terminal, Loader, ServerCrash, RefreshCw, KeyRound, ChevronDown, ChevronRight, Search, AlertTriangle, Clock, Cpu, Eye, EyeOff, Info, CheckCircle2, XCircle, Zap, BarChart3, Bug, Wrench, Filter, ArrowUpDown, Layers, Copy } from 'lucide-react';
import OfficeLicenseAnalyzer from './OfficeLicenseAnalyzer.js';
import { updateSessionReport } from '../utils/SessionAuditStore.js';

const translateBackendString = (str) => {
  if (!str) return '—';
  return typeof str === 'string' ? str : JSON.stringify(str);
};


const translateFieldValue = (str) => {
  if (!str) return 'Kh\u00f4ng c\u00f3 d\u1eef li\u1ec7u';
  if (typeof str !== 'string') {
    if (typeof str === 'object') return JSON.stringify(str);
    return String(str);
  }
  let translated = str;

  if (translated.includes('The machine is permanently activated.')) {
    return 'Windows \u0111ang \u0111\u01b0\u1ee3c k\u00edch ho\u1ea1t h\u1ee3p l\u1ec7.';
  }

  translated = translated.replace(/HasOA3Key/gi, 'Kh\u00f3a OA3 trong BIOS');
  translated = translated.replace(/LicenseStatus/gi, 'Tr\u1ea1ng th\u00e1i k\u00edch ho\u1ea1t');
  translated = translated.replace(/ProductKeyChannel/gi, 'Lo\u1ea1i b\u1ea3n quy\u1ec1n');
  translated = translated.replace(/LicenseFamily/gi, 'Phi\u00ean b\u1ea3n Windows');
  translated = translated.replace(/GracePeriodRemaining/gi, 'Th\u1eddi gian gia h\u1ea1n c\u00f2n l\u1ea1i');
  translated = translated.replace(/KeyManagementServicePort/gi, 'M\u00e1y ch\u1ee7 KMS');
  translated = translated.replace(/Description/gi, 'Th\u00f4ng tin b\u1ea3n quy\u1ec1n');

  if (translated.includes('Kh\u00f3a OA3 trong BIOS')) {
    translated = translated.replace(/[:=]\\s*(false|0)/gi, ': Kh\u00f4ng t\u00ecm th\u1ea5y kh\u00f3a OA3 trong BIOS.');
    translated = translated.replace(/[:=]\\s*(true|1)/gi, ': C\u00f3 kh\u00f3a OA3 trong BIOS.');
  }

  translated = translated.replace(/LICENSED/gi, '\u0110\u00c3 K\u00cdCH HO\u1ea0T');
  translated = translated.replace(/UNLICENSED/gi, 'CH\u01afA K\u00cdCH HO\u1ea0T');
  translated = translated.replace(/Notification/gi, 'Th\u00f4ng b\u00e1o');

  return translated;
};

// Tooltip dictionary chuẩn ngắn gọn (Tối đa 2 câu) - đồng bộ với OfficeLicenseAnalyzer
const TOOLTIPS: Record<string, string> = {
  OA3: 'OEM Activation 3.0 - Khóa bản quyền gốc nhúng sẵn trong chip BIOS/UEFI từ nhà sản xuất thiết bị.',
  GenericKey: 'Khóa mặc định của Microsoft dùng làm cầu nối kích hoạt bản quyền số (HWID) hoặc KMS.',
  HWID: 'Hardware ID - Bản quyền kỹ thuật số (Digital License) liên kết vĩnh viễn với phần cứng máy tính.',
  KMS: 'Key Management Service - Máy chủ quản lý và cấp phép bản quyền nội bộ doanh nghiệp theo chu kỳ.',
  KMS38: 'Cơ chế gia hạn kích hoạt KMS tới năm 2038 thông qua vé WPA, thường ghi nhận trên các bản Windows IoT Enterprise hoặc công cụ kích hoạt tự động.',
  GVLK: 'Generic Volume License Key - Khóa mặc định dùng để định tuyến kích hoạt về máy chủ KMS.',
  NoGenTicket: 'Khóa Registry chặn Windows tự động tạo vé kích hoạt bản quyền kỹ thuật số.',
  Retail: 'Bản quyền bán lẻ cá nhân, kích hoạt trực tiếp theo tài khoản hoặc key độc lập.',
  OEM: 'Bản quyền nhúng sẵn theo máy từ nhà sản xuất thiết bị (không chuyển nhượng sang máy khác).',
  Volume: 'Giấy phép khối dành cho cơ quan, tổ chức hoặc doanh nghiệp triển khai hàng loạt.',
  IFEO: 'Image File Execution Options - Khóa Registry điều hướng tiến trình ứng dụng Windows.',
  SPP: 'Software Protection Platform - Dịch vụ của Windows chịu trách nhiệm xác thực và quản lý giấy phép.'
};

// Normalize IPC scan payloads from different backend response shapes
const normalizeScanActivationResult = (raw: any): any => {
  if (raw === null || raw === undefined) return null;

  const parseIfJsonString = (value: any) => {
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  };

  const hasActivationGroups = (value: any) => {
    if (!value || typeof value !== 'object') return false;
    return !!(
      value.Windows || value.windows ||
      value.Office || value.office ||
      value.System || value.system
    );
  };

  const normalizeGroupKeys = (value: any) => {
    if (!value || typeof value !== 'object') return value;
    const normalized = { ...value };
    if (!normalized.Windows && normalized.windows) normalized.Windows = normalized.windows;
    if (!normalized.Office && normalized.office) normalized.Office = normalized.office;
    if (!normalized.System && normalized.system) normalized.System = normalized.system;
    return normalized;
  };

  const throwIfBackendFailure = (value: any) => {
    if (!value || typeof value !== 'object') return;
    if (value.Success === false) {
      throw new Error(value.Error || 'Backend scan failed.');
    }
    if (value.success === false) {
      throw new Error(value.error || 'Backend scan failed.');
    }
  };

  const unwrapCandidates = (value: any) => {
    if (!value || typeof value !== 'object') return [];
    return [
      value.Data,
      value.data,
      value.output,
      value.Output,
      value.result,
      value.Result,
      value.payload,
      value.Payload,
    ];
  };

  let current = parseIfJsonString(raw);
  throwIfBackendFailure(current);

  if (hasActivationGroups(current)) {
    return normalizeGroupKeys(current);
  }

  const queue: any[] = [...unwrapCandidates(current)];
  const visited = new Set<any>();

  while (queue.length > 0) {
    const next = parseIfJsonString(queue.shift());
    if (next === null || next === undefined) continue;
    if (visited.has(next)) continue;
    visited.add(next);

    throwIfBackendFailure(next);

    if (hasActivationGroups(next)) {
      return normalizeGroupKeys(next);
    }

    if (typeof next === 'object') {
      queue.push(...unwrapCandidates(next));
    }
  }

  return null;
};

// Define types for scan results
type DiagnosticStepStatus = 'idle' | 'clean' | 'warning' | 'danger';
type DiagnosticStep = {
  id: number;
  name: string;
  description: string;
  status: DiagnosticStepStatus;
  details: string[];
};

type EvidenceSourceKind = 'WMI' | 'Command' | 'Files' | 'Services' | 'Tasks' | 'Registry' | 'Hosts' | 'Event log' | 'Rule';

const windowsEvidenceMetadata: Record<number, { source: string; sourceKind: EvidenceSourceKind; rule: string; recommendation: string }> = {
  1: { source: 'SoftwareLicensingService.OA3xOriginalProductKey', sourceKind: 'WMI', rule: 'Ki\u1ec3m tra kh\u00f3a OA3 nh\u00fang trong BIOS c\u00f3 t\u1ed3n t\u1ea1i hay kh\u00f4ng.', recommendation: 'So s\u00e1nh kh\u00f3a OEM v\u1edbi kh\u00f3a \u0111ang c\u00e0i \u0111\u1ec3 x\u00e1c minh t\u00ednh nh\u1ea5t qu\u00e1n.' },
  2: { source: 'slmgr /dlv', sourceKind: 'Command', rule: '\u0110\u1ed1i chi\u1ebfu tr\u1ea1ng th\u00e1i k\u00edch ho\u1ea1t v\u00e0 k\u00eanh b\u1ea3n quy\u1ec1n hi\u1ec7n t\u1ea1i.', recommendation: 'X\u00e1c minh k\u00eanh b\u1ea3n quy\u1ec1n (Retail/OEM/Volume) c\u00f3 ph\u00f9 h\u1ee3p hay kh\u00f4ng.' },
  3: { source: 'WMI + slmgr', sourceKind: 'WMI', rule: 'Thu th\u1eadp Product Key, partial key v\u00e0 Activation ID \u0111\u1ec3 \u0111\u1ed1i so\u00e1t.', recommendation: '\u0110\u1ed1i chi\u1ebfu c\u00e1c gi\u00e1 tr\u1ecb key gi\u1eefa BIOS, key c\u00e0i \u0111\u1eb7t v\u00e0 k\u1ebft qu\u1ea3 WMI.' },
  4: { source: 'Registry + Hosts', sourceKind: 'Registry', rule: 'Ki\u1ec3m tra d\u1ea5u hi\u1ec7u KMS qua Registry v\u00e0 file hosts.', recommendation: 'N\u1ebfu ph\u00e1t hi\u1ec7n KMS host b\u1ea5t th\u01b0\u1eddng, c\u1ea7n x\u00e1c minh ngu\u1ed3n c\u1ea5u h\u00ecnh.' },
  5: { source: 'Scheduled Tasks + Services', sourceKind: 'Tasks', rule: 'R\u00e0 so\u00e1t task/d\u1ecbch v\u1ee5 li\u00ean quan k\u00edch ho\u1ea1t.', recommendation: 'X\u00e1c minh t\u00e1c v\u1ee5 h\u1ec7 th\u1ed1ng kh\u1edfi t\u1ea1o c\u00f3 li\u00ean quan t\u1edbi k\u00edch ho\u1ea1t hay kh\u00f4ng.' },
  6: { source: 'System files', sourceKind: 'Files', rule: 'Ki\u1ec3m tra t\u1ec7p h\u1ec7 th\u1ed1ng li\u00ean quan b\u1ea3n quy\u1ec1n.', recommendation: 'So kh\u1edbp ch\u1eef k\u00fd t\u1ec7p v\u00e0 \u0111\u1ed1i chi\u1ebfu v\u1edbi h\u1ec7 th\u1ed1ng chu\u1ea9n.' },
  7: { source: 'WMI + Activation API', sourceKind: 'WMI', rule: 'Thu th\u1eadp b\u1eb1ng ch\u1ee9ng Digital License v\u00e0 Activation IDs.', recommendation: 'X\u00e1c nh\u1eadn d\u1ea5u hi\u1ec7u b\u1ea3n quy\u1ec1n s\u1ed1 c\u00f9ng tr\u1ea1ng th\u00e1i k\u00edch ho\u1ea1t.' },
  8: { source: 'Engine verification', sourceKind: 'Rule', rule: 'T\u1ed5ng h\u1ee3p b\u1eb1ng ch\u1ee9ng theo c\u00e1c nh\u00f3m r\u1ee7i ro \u0111\u1ec3 \u0111\u00e1nh gi\u00e1.', recommendation: '\u0110\u1ec1 xu\u1ea5t b\u01b0\u1edbc x\u1eed l\u00fd theo m\u1ee9c \u0111\u1ed9 tin c\u1eady c\u1ee7a b\u1eb1ng ch\u1ee9ng.' }
};


const noBackendData = 'No Data - backend field required.';

function displayValue(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  return typeof value === 'string' ? value : JSON.stringify(value);
}

const initialWindowsSteps: DiagnosticStep[] = [
  { id: 1, name: 'Khóa BIOS OA3', description: 'Kiểm tra key nhúng phần cứng.', status: 'idle', details: [] },
  { id: 2, name: 'Kênh cấp phép', description: 'Phân tích kênh License.', status: 'idle', details: [] },
  { id: 3, name: 'Lịch sử CMD & MAS', description: 'Quét dấu vết MAS/HWID.', status: 'idle', details: [] },
  { id: 4, name: 'KMS Host & Hook', description: 'Máy chủ kích hoạt.', status: 'idle', details: [] },
  { id: 5, name: 'Tập tin chưa xác thực', description: 'Kiểm tra tập tin có dấu hiệu bất thường.', status: 'idle', details: [] },
  { id: 6, name: 'Task & Services', description: 'Tác vụ ngầm.', status: 'idle', details: [] },
  { id: 7, name: 'Registry & Hosts', description: 'Can thiệp hệ thống.', status: 'idle', details: [] },
  { id: 8, name: 'Đánh giá quy tắc', description: 'Tổng hợp nhóm bằng chứng.', status: 'idle', details: [] },
];

const initialOfficeSteps: DiagnosticStep[] = [
    { id: 1, name: 'Trạng thái License', description: 'Trạng thái cấp phép.', status: 'idle', details: [] },
    { id: 2, name: 'Kênh cấp phép', description: 'Kênh cấp phép.', status: 'idle', details: [] },
    { id: 3, name: 'Tập tin Ohook', description: 'Kiểm tra DLL giả mạo hệ thống.', status: 'idle', details: [] },
    { id: 4, name: 'Tập tin chưa xác thực', description: 'Kiểm tra tập tin có dấu hiệu bất thường.', status: 'idle', details: [] },
    { id: 5, name: 'Task & Services', description: 'Tác vụ ngầm.', status: 'idle', details: [] },
    { id: 6, name: 'File hosts', description: 'Chặn máy chủ Microsoft.', status: 'idle', details: [] },
    { id: 7, name: 'Event Logs', description: 'Dấu vết lịch sử.', status: 'idle', details: [] },
    { id: 8, name: 'Đánh giá quy tắc', description: 'Tổng hợp nhóm bằng chứng.', status: 'idle', details: [] },
];


export interface DiagnosticStepItemProps {
  step: DiagnosticStep;
  isActive: boolean;
  onClick: () => void;
  key?: React.Key;
}

function DiagnosticStepItem({ step, isActive, onClick }: DiagnosticStepItemProps) {
  const statusConfig = {
    idle: { icon: <RefreshCw className="h-4 w-4 text-slate-400" />, color: 'border-slate-200', textColor: 'text-slate-400' },
    clean: { icon: <ShieldCheck className="h-4 w-4 text-emerald-500" />, color: 'border-slate-200', textColor: 'text-emerald-600' },
    warning: { icon: <ShieldAlert className="h-4 w-4 text-amber-500" />, color: 'border-amber-400', textColor: 'text-amber-600' },
    danger: { icon: <ShieldX className="h-4 w-4 text-red-500" />, color: 'border-red-400', textColor: 'text-red-600' },
  };

  const { icon, color, textColor } = statusConfig[step.status];
  const statusText = { idle: 'Chưa phân tích', clean: 'Ổn định', warning: 'Cảnh báo', danger: 'Có dấu hiệu bất thường' };

  return (
    <div
      onClick={onClick}
      className={`p-3 border-l-4 rounded-r-lg cursor-pointer transition-all duration-200 ${
        isActive ? 'bg-blue-50 border-blue-500 shadow-md' : `bg-white hover:bg-slate-50 ${color}`
      }`}
    >
      <div className="flex items-center gap-3">
        {icon}
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-bold ${isActive ? 'text-blue-700' : 'text-slate-800'}`}>{`Bước ${step.id}: ${step.name}`}</p>
          <p className={`text-[11px] truncate ${isActive ? 'text-blue-600/80' : 'text-slate-500'}`}>{step.description}</p>
        </div>
        <span className={`text-[10px] font-bold uppercase ${isActive ? 'text-blue-600' : textColor}`}>
          {statusText[step.status]}
        </span>
      </div>

    </div>
  );
}

// ============================================================================
// SECTION COLLAPSE WRAPPER
// ============================================================================
function CollapsibleSection({ title, icon, defaultOpen = false, badge, children }: {
  title: string; icon: React.ReactNode; defaultOpen?: boolean; badge?: React.ReactNode; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left">
        {icon}
        <span className="text-sm font-bold text-slate-800 flex-1">{title}</span>
        {badge}
        {open ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
      </button>
      {open && <div className="px-4 pb-4 border-t border-slate-100">{children}</div>}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function LicenseManager() {
  const [activeTab, setActiveTab] = useState<'windows' | 'office'>('windows');
  const [viewMode, setViewMode] = useState<'visual' | 'terminal'>('visual');
  
  const [windowsSteps, setWindowsSteps] = useState<DiagnosticStep[]>(initialWindowsSteps);
  const [officeSteps, setOfficeSteps] = useState<DiagnosticStep[]>(initialOfficeSteps);
  
  const [activeStep, setActiveStep] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [windowsScanResult, setWindowsScanResult] = useState<any>(null);
  const [officeScanResult, setOfficeScanResult] = useState<any>(null);

  // State for usability enhancements
  const [scanStartTime, setScanStartTime] = useState<number | null>(null);
  const [scanEndTime, setScanEndTime] = useState<number | null>(null);
  const [showDevMode, setShowDevMode] = useState(false);
  const [evidenceSearch, setEvidenceSearch] = useState('');
  const [evidenceFilter, setEvidenceFilter] = useState<'all' | 'clean' | 'warning' | 'danger'>('all');
  const [evidenceSortBy, setEvidenceSortBy] = useState<'id' | 'status' | 'weight'>('id');
  const [expandedEvidence, setExpandedEvidence] = useState<number[]>([]);
  const [showStepDeveloperView, setShowStepDeveloperView] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  const renderTooltipIcon = (term: string, tooltipKey?: string) => {
    const key = tooltipKey || term;
    const text = TOOLTIPS[key];
    if (!text) return null;
    return (
      <span className="relative inline-flex items-center ml-1 cursor-pointer group">
        <Info 
          className="w-3.5 h-3.5 text-slate-400 hover:text-emerald-400 transition-colors"
          onMouseEnter={() => setActiveTooltip(key)}
          onMouseLeave={() => setActiveTooltip(null)}
        />
        {activeTooltip === key && (
          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-60 p-2 bg-slate-900 text-white text-[11px] font-normal rounded-lg shadow-xl z-50 pointer-events-none whitespace-normal leading-tight border border-slate-700">
            <strong className="text-emerald-400 block mb-0.5">{term}:</strong>
            {text}
          </span>
        )}
      </span>
    );
  };

  // Scoped usability states (Console, Timeline Expansion, Reset Modal)
  const [consoleLogs, setConsoleLogs] = useState<string[]>([
    `[${new Date().toLocaleTimeString()}] Khởi tạo công cụ chẩn đoán bản quyền.`
  ]);
  const [isConsoleOpen, setIsConsoleOpen] = useState<boolean>(true);
  const [expandedTimelineStep, setExpandedTimelineStep] = useState<number | null>(null);
  const [resetModalData, setResetModalData] = useState<{
    isOpen: boolean;
    title: string;
    steps: { label: string; status: 'success' | 'warning' | 'failed'; detail?: string }[];
    overallStatus: string;
    duration: string;
    warningsCount: number;
    errorsCount: number;
  } | null>(null);

  const addConsoleLog = React.useCallback((msg: string) => {
    const timeStr = new Date().toLocaleTimeString();
    setConsoleLogs(prev => [...prev.slice(-199), `[${timeStr}] ${msg}`]);
  }, []);

  const copyConsoleLogs = () => {
    const text = consoleLogs.join('\n');
    navigator.clipboard.writeText(text);
    showInfo({ title: 'Đã sao chép', message: 'Đã sao chép toàn bộ nhật ký console vào Clipboard.' });
  };

  const exportConsoleLogsTxt = () => {
    const text = consoleLogs.join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LicenseManager_Console_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const askConfirm = async (options: { title?: string; message?: string; type?: 'question' | 'warning' | 'info' }) => {
    const api = (window as any)?.electronAPI;
    if (api?.showConfirmDialog) {
      try {
        const confirmed = await api.showConfirmDialog(options);
        return !!confirmed;
      } catch {
        // fallback below
      }
    }
    return window.confirm(options.message || options.title || 'Are you sure?');
  };

  const showInfo = async (options: { title?: string; message?: string }) => {
    const api = (window as any)?.electronAPI;
    if (api?.showInfoDialog) {
      try {
        await api.showInfoDialog(options);
        return;
      } catch {
        // fallback below
      }
    }
    window.alert(`${options.title ? options.title + '\n\n' : ''}${options.message || ''}`);
  };

  const handleStartScan = async () => {
    setIsLoading(true);
    setError(null);
    const startTime = Date.now();
    setScanStartTime(startTime);
    setScanEndTime(null);
    if (activeTab === 'windows') setWindowsSteps(initialWindowsSteps); 
    if (activeTab === 'office') setOfficeSteps(initialOfficeSteps);

    addConsoleLog(`Bắt đầu quá trình chẩn đoán ${activeTab.toUpperCase()}...`);

    try {
      const type = activeTab;
      const api = (window as any)?.electronAPI;
      if (!api?.scanActivation) {
        throw new Error('scanActivation IPC is not available.');
      }

      addConsoleLog(`Gửi yêu cầu IPC scanActivation (${type})...`);
      const rawResult = await api.scanActivation({ type });
      const result = normalizeScanActivationResult(rawResult);

      if (!result) {
        throw new Error('Không nhận được dữ liệu quét hợp lệ từ backend.');
      }
      
      if (type === 'windows') {
          // Forensics analysis (legacy engine removed) — use raw scan data directly
          result.Forensics = result.Forensics || {
            decision: (result.LicenseStatus === 1 || result.Windows?.LicenseStatus === 1) ? 'GENUINE' : 'WARNING',
            confidence: { final: 80 },
            issues: []
          };
          
          setWindowsScanResult(result);
          processWindowsScanResults(result);
          
          const isGen = result.Forensics?.decision === 'GENUINE' || result.LicenseStatus === 1 || result.LicenseStatus === 'LICENSED' || result.Windows?.LicenseStatus === 1;
          const winName = result.Name || result.Windows?.Name || result.Description || result.LicenseFamily || 'Windows';
          const hasOA3 = result.Windows?.HasOA3Key === true || Boolean(result.Windows?.OA3Key && result.Windows.OA3Key !== 'N/A' && result.Windows.OA3Key !== 'Không có dữ liệu');

          let winStr = '';
          if (isGen && hasOA3) {
            winStr = `✔ ${winName}: Đã kích hoạt OEM BIOS (Chính hãng nhà sản xuất)`;
          } else if (isGen) {
            winStr = `✔ ${winName}: Máy sạch - Đã kích hoạt (Cần cung cấp chứng từ mua hàng/Key OEM nếu muốn đối soát)`;
          } else {
            winStr = `❌ ${winName}: Chưa kích hoạt`;
          }
          updateSessionReport({ windowsActivation: winStr });

          addConsoleLog(`Hoàn tất phân tích Windows. Kết quả verdict: ${result.LicenseStatus === 1 ? 'Kích hoạt hợp lệ' : 'Cần xem xét'}.`);
      } else {
          setOfficeScanResult(result);
          processOfficeScanResults(result);
          addConsoleLog(`Hoàn tất phân tích Office.`);
      }
    } catch (err: any) {
      const errMsg = 'Lỗi khi thực thi lệnh quét: ' + err.message;
      setError(errMsg);
      addConsoleLog(`[LỖI] ${errMsg}`);
    } finally {
      setIsLoading(false);
      const endTime = Date.now();
      setScanEndTime(endTime);
      addConsoleLog(`Thời gian thực thi quét: ${((endTime - startTime) / 1000).toFixed(2)}s.`);
    }
  };

  const [isRestoringOem, setIsRestoringOem] = useState<boolean>(false);

  const handleRestoreOemBiosKey = async () => {
    const confirm = await askConfirm({
      title: 'Khôi phục Khóa OEM từ BIOS',
      message: 'Công cụ sẽ đọc khóa OEM nhúng trên Mainboard (BIOS) và cập nhật trạng thái cấp phép với Microsoft. Bạn có muốn tiếp tục không?',
      type: 'question'
    });

    if (!confirm) return;

    setIsRestoringOem(true);
    setError(null);
    const startT = Date.now();
    addConsoleLog('Bắt đầu khôi phục khóa OEM từ BIOS...');
    try {
      const api = (window as any)?.electronAPI;
      if (!api?.restoreOemBiosKey) {
        throw new Error('Chức năng restoreOemBiosKey không sẵn sàng.');
      }
      const response = await api.restoreOemBiosKey();
      const durationSec = ((Date.now() - startT) / 1000).toFixed(2) + 's';
      
      const success = response?.success !== false;
      addConsoleLog(`Khôi phục Key OEM BIOS hoàn tất. Kết quả: ${success ? 'HỢP LỆ' : 'THẤT BẠI'}.`);

      const modalSteps = [
        { label: 'Truy xuất khóa OEM từ BIOS', status: success ? ('success' as const) : ('warning' as const), detail: success ? 'Thành công' : 'Không tìm thấy hoặc lỗi' },
        { label: 'Cập nhật trạng thái bản quyền', status: success ? ('success' as const) : ('warning' as const), detail: response?.output || (success ? 'Xác minh thành công' : 'Ghi nhận cảnh báo') }
      ];

      setResetModalData({
        isOpen: true,
        title: 'Kết Quả Khôi Phục Khóa OEM BIOS',
        steps: modalSteps,
        overallStatus: success ? 'Thành công' : 'Ghi nhận cảnh báo',
        duration: durationSec,
        warningsCount: success ? 0 : 1,
        errorsCount: success ? 0 : 1
      });

      handleStartScan();
    } catch (err: any) {
      const msg = 'Lỗi khi khôi phục Key BIOS: ' + err.message;
      setError(msg);
      addConsoleLog(`[LỖI] ${msg}`);
    } finally {
      setIsRestoringOem(false);
    }
  };

  const handleResetActivation = async () => {
      const type = activeTab;
      const confirm = await askConfirm({
          title: `⚠️ Cảnh báo — Xóa Trạng thái Cấp phép ${type === 'windows' ? 'Windows' : 'Office'}`,
          message: type === 'windows'
            ? `Thao tác này sẽ XÓA VĨNH VIỄN Product Key Windows và cấu hình KMS hiện tại (slmgr /upk, /cpky, /rearm).\n\nKHÔNG THỂ HOÀN TÁC ĐẦY ĐỦ:\n- Windows sẽ chuyển sang trạng thái CHƯA KÍCH HOẠT.\n- Phần mềm tự động khôi phục CHỈ phục hồi được file hosts.bak; khóa registry bản quyền (SPP) bị Windows chặn quyền ghi kể cả tài khoản SYSTEM, nên KHÔNG tự khôi phục được.\n- Bạn PHẢI có sẵn Original Product Key (paste trên máy / COA / tài khoản Microsoft) để kích hoạt lại thủ công bằng "slmgr /ipk <key>".\n\nChỉ thực hiện khi thực sự cần. Bạn có chắc chắn muốn tiếp tục?`
            : `Thao tác này sẽ GỠ BỎ các giấy phép Office dư thừa và làm mới dịch vụ cấp phép (ospp.vbs /unpkey).\n\nBạn nên có sẵn tài khoản Microsoft / Product Key Office để kích hoạt lại nếu cần.\n\nBạn có chắc chắn muốn tiếp tục?`,
          type: 'warning',
      });

      if (!confirm) return;

      setIsResetting(true);
      setError(null);
      const startT = Date.now();
      addConsoleLog(`Bắt đầu đặt lại trạng thái cấp phép ${type.toUpperCase()}...`);

      try {
          const api = (window as any)?.electronAPI;

          if (type === 'windows') {
              if (!api?.deepCleanActivation) {
                throw new Error('Chức năng deepCleanActivation không sẵn sàng.');
              }
              addConsoleLog('Thực thi dọn sạch bản quyền Windows (slmgr /upk, /cpky, /rearm)...');
              const res = await api.deepCleanActivation('windows');
              const durSec = ((Date.now() - startT) / 1000).toFixed(2) + 's';
              addConsoleLog(`Đặt lại trạng thái Windows hoàn tất. Thời gian: ${durSec}.`);
              
              const modalSteps = [
                { label: 'Gỡ bỏ Product Key và giấy phép hiện tại', status: 'success' as const, detail: 'Thành công' },
                { label: 'Xóa máy chủ KMS và cấu hình cấp phép', status: 'success' as const, detail: res?.output || 'Hoàn tất' }
              ];

              setResetModalData({
                isOpen: true,
                title: 'Kết Quả Đặt Lại Trạng Thái Bản Quyền Windows',
                steps: modalSteps,
                overallStatus: 'Thành công',
                duration: durSec,
                warningsCount: 0,
                errorsCount: 0
              });

              handleStartScan();
          } else {
              if (!api?.deepCleanActivation) {
                throw new Error('deepCleanActivation IPC không sẵn có.');
              }
              await api.deepCleanActivation('office');
              const durSec = ((Date.now() - startT) / 1000).toFixed(2) + 's';
              addConsoleLog(`Đặt lại Office hoàn tất. Thời gian: ${durSec}.`);
              
              setResetModalData({
                isOpen: true,
                title: 'Kết Quả Đặt Lại Trạng Thái Office',
                steps: [
                  { label: 'Gỡ bỏ giấy phép Office dư thừa (ospp.vbs /unpkey)', status: 'success', detail: 'Thành công' },
                  { label: 'Làm mới dịch vụ cấp phép Office', status: 'success', detail: 'Thành công' }
                ],
                overallStatus: 'Thành công',
                duration: durSec,
                warningsCount: 0,
                errorsCount: 0
              });

              handleStartScan();
          }
      } catch (err: any) {
        const msg = 'Lỗi khi đặt lại trạng thái: ' + err.message;
        setError(msg);
        addConsoleLog(`[LỖI] ${msg}`);
      } finally {
        setIsResetting(false);
      }
  };


  const processWindowsScanResults = (result: any) => {
    if (!result || !result.Windows) return;

    const newSteps = JSON.parse(JSON.stringify(initialWindowsSteps));
    const evidences: string[] = [];

    // === TIER 1: Khóa BIOS OA3 Verification ===
    const hasOA3 = result.Windows.HasOA3Key === true ||
      (typeof result.Windows.OA3Key === 'string' && result.Windows.OA3Key.trim().length > 0 && result.Windows.OA3Key !== 'Không có dữ liệu' && result.Windows.OA3Key !== 'N/A') ||
      (typeof result.Windows.OA3xOriginalProductKey === 'string' && result.Windows.OA3xOriginalProductKey.trim().length > 0 && result.Windows.OA3xOriginalProductKey !== 'Không có dữ liệu' && result.Windows.OA3xOriginalProductKey !== 'N/A');
    const isLicensed = result.Windows.LicenseStatus === 1;
    const channel = result.Windows.Channel || 'UNKNOWN';

    if (hasOA3) {
        newSteps[0].status = 'clean';
        newSteps[0].details.push(`✅ Có OA3 Key (***${result.Windows.OA3Key})`);
    } else {
        if (channel.includes('OEM_DM')) {
            newSteps[0].status = 'warning';
            newSteps[0].details.push('⚠️ Kênh OEM_DM nhưng không tìm thấy OA3 Key trong BIOS');
        } else {
            newSteps[0].status = 'clean';
            newSteps[0].details.push('ℹ Không có OA3 Key trong BIOS (Bình thường đối với Retail/Custom PC)');
        }
    }

    // === TIER 2: License Channel Analysis ===
    newSteps[1].details.push(`${channel} - ${result.Windows.Description || 'Không có dữ liệu'}`);
    if (channel.includes('OEM') && isLicensed) {
        newSteps[1].status = 'clean';
    } else if (channel.includes('RETAIL') && isLicensed) {
        newSteps[1].status = 'clean';
    } else if (channel.includes('VOLUME_KMS')) {
        newSteps[1].status = 'warning';
    } else {
        newSteps[1].status = 'clean';
    }

    // === TIER 3: Forensic Evidence ===
    const kmsHost = result.Windows.KeyManagementServiceMachine?.toLowerCase();
    const isKms38 = result.System?.IsKMS38 === true;
    const isFakeKms = result.System?.IsFakeKMS === true;
    
    if (isKms38) {
        newSteps[3].status = 'danger';
        newSteps[3].details.push('⚠️ Phát hiện KMS38 Hook (Năm 2038)');
    } else if (isFakeKms || (kmsHost && kmsHost.match(/loli|digiboy|msguides|zdf|0\.0\.0\.0|kms|crack/))) {
        newSteps[3].status = 'danger';
        newSteps[3].details.push(`⚠️ Máy chủ KMS chưa xác thực: ${kmsHost}`);
    } else if (kmsHost) {
        newSteps[3].status = 'warning';
        newSteps[3].details.push(`⚠️ KMS Host: ${kmsHost}`);
    } else {
        newSteps[3].status = 'clean';
        newSteps[3].details.push('✅ Không phát hiện KMS Server');
    }

    const piratedFiles = result.System?.PiratedFiles || [];
    if (piratedFiles.length > 0) {
        newSteps[4].status = 'danger';
        piratedFiles.forEach((f: string) => newSteps[4].details.push(`⚠️ Tập tin chưa xác thực: ${f}`));
    } else {
        newSteps[4].status = 'clean';
        newSteps[4].details.push('✅ Sạch');
    }

    const suspiciousTasks = result.System?.SuspiciousTasks || [];
    const suspiciousServices = result.System?.SuspiciousServices || [];
    if (suspiciousTasks.length > 0 || suspiciousServices.length > 0) {
        newSteps[5].status = 'danger';
        suspiciousTasks.forEach((t: any) => newSteps[5].details.push(`⚠️ Task: ${t.Name}`));
        suspiciousServices.forEach((s: string) => newSteps[5].details.push(`⚠️ Service: ${s}`));
    } else {
        newSteps[5].status = 'clean';
        newSteps[5].details.push('✅ Sạch');
    }

    const hasNoGenTicket = result.System?.NoGenTicket === true;
    const hostsRedirects = result.System?.HostsRedirects || [];
    const kmsEvents = result.System?.KMSEvents || [];
    
    if (hasNoGenTicket) { newSteps[6].details.push('⚠️ Có khóa chặn NoGenTicket'); }
    if (hostsRedirects.length > 0) { hostsRedirects.forEach((h: string) => newSteps[6].details.push(`⚠️ Hosts: ${h}`)); }
    
    if (hasNoGenTicket || hostsRedirects.length > 0) {
        newSteps[6].status = 'danger';
    } else if (kmsEvents.length > 0) {
        newSteps[6].status = 'warning';
        kmsEvents.forEach((e: any) => newSteps[6].details.push(`⚠️ [${e.Time}] ${e.Message}`));
    } else {
        newSteps[6].status = 'clean';
        newSteps[6].details.push('✅ Sạch');
    }

    const hasMasHistory = result.System?.MasHistory === true;
    if (hasMasHistory) {
        newSteps[2].status = 'danger';
        newSteps[2].details.push('⚠️ Ghi nhận dấu vết kích hoạt MAS/HWID trong nhật ký');
    } else if (result.Windows.IsGenericKey && !isLicensed) {
        newSteps[2].status = 'warning';
        newSteps[2].details.push(`⚠️ Dùng Generic Key (Chưa kích hoạt): ***${result.Windows.PartialProductKey}`);
    } else if (result.Windows.IsGenericKey) {
        newSteps[2].status = 'clean';
        newSteps[2].details.push(`ℹ️ Dùng Key mặc định hệ thống: ***${result.Windows.PartialProductKey}`);
    } else {
        newSteps[2].status = 'clean';
        newSteps[2].details.push('✅ Sạch (Không có dấu vết)');
    }

    // === FINAL DECISION ===
    let finalWinStatus = 'Pending';
    const hasTamperingEvidence = newSteps.some((s:any) => s.status === 'danger');
    const hasWarning = newSteps.some((s:any) => s.status === 'warning');

    if (hasTamperingEvidence) {
      finalWinStatus = 'KMS';
    } else if (hasWarning) {
        if (isLicensed) finalWinStatus = 'Cảnh báo';
        else finalWinStatus = 'None';
    } else if (isLicensed) {
      finalWinStatus = 'Genuine';
    } else {
      finalWinStatus = 'None';
    }

    newSteps[7].status = (finalWinStatus === 'Genuine' || finalWinStatus === 'None') ? 'clean' : (finalWinStatus === 'Cảnh báo' ? 'warning' : 'danger');
    newSteps[7].details.push(`Kết luận: ${finalWinStatus === 'Genuine' ? 'Bản quyền hợp lệ' : finalWinStatus === 'KMS' ? 'Có dấu hiệu bất thường' : finalWinStatus === 'Cảnh báo' ? 'Cần xem xét thêm' : 'Chưa kích hoạt'}`);

    setWindowsSteps(newSteps);
  };
  
  const processOfficeScanResults = (result: any) => {
    if (!result || !result.Office) return;

    const newSteps = JSON.parse(JSON.stringify(initialOfficeSteps));

    const officeProducts = result.Office?.Products || [];
    const isLicensed = officeProducts.some((op: any) => op.LicenseStatus === 1);
    const isNotification = officeProducts.some((op: any) => op.LicenseStatus === 5);
    
    if (isLicensed) {
        newSteps[0].status = 'clean';
        newSteps[0].details.push('✅ Đã kích hoạt (Licensed)');
    } else if (isNotification) {
        newSteps[0].status = 'warning';
        newSteps[0].details.push('⚠️ Office có giấy phép nhưng Grace Period đã hết - Đang ở chế độ thông báo');
    } else {
        newSteps[0].status = 'warning';
        newSteps[0].details.push('⚠️ Chưa được kích hoạt');
    }

    const hasKmsProduct = officeProducts.some((op: any) => (op.Description||'').toLowerCase().includes('kms'));
    if (hasKmsProduct) {
        newSteps[1].status = 'warning';
        newSteps[1].details.push('⚠️ Đang sử dụng kênh KMS Client');
    } else {
        newSteps[1].status = 'clean';
        newSteps[1].details.push(officeProducts.length > 0 ? officeProducts.map((p:any) => p.Description).join(', ') : 'Không tìm thấy sản phẩm Office nào.');
    }

    const ohookFiles = result.Office?.OhookFiles || [];
    if (ohookFiles.length > 0) {
        newSteps[2].status = 'danger';
        newSteps[2].details.push(`⚠️ Phát hiện DLL có thể là Ohook: ${ohookFiles.join(', ')}`);
    } else {
        newSteps[2].status = 'clean';
        newSteps[2].details.push('✅ Sạch (Không phát hiện Ohook)');
    }
    
    const piratedFiles = result.System?.PiratedFiles || [];
    if (piratedFiles.length > 0) {
        newSteps[3].status = 'danger';
        newSteps[3].details.push(`⚠️ Tồn tại tập tin có dấu hiệu can thiệp: ${piratedFiles.join(', ')}`);
    } else {
        newSteps[3].status = 'clean';
        newSteps[3].details.push('✅ Sạch');
    }

    const suspiciousTasks = result.System?.SuspiciousTasks || [];
    const suspiciousServices = result.System?.SuspiciousServices || [];
    if (suspiciousTasks.length > 0 || suspiciousServices.length > 0) {
        newSteps[4].status = 'danger';
        newSteps[4].details.push(`⚠️ Tác vụ/dịch vụ tự động chưa xác thực`);
    } else {
        newSteps[4].status = 'clean';
        newSteps[4].details.push('✅ Sạch');
    }

    const hostsRedirects = result.System?.HostsRedirects || [];
    if (hostsRedirects.length > 0) {
        newSteps[5].status = 'danger';
        newSteps[5].details.push(`⚠️ Chặn máy chủ xác thực qua file hosts`);
    } else {
        newSteps[5].status = 'clean';
        newSteps[5].details.push('✅ Sạch');
    }
    
    const kmsEvents = result.System?.KMSEvents || [];
    if (kmsEvents.length > 0) {
        newSteps[6].status = 'warning';
        newSteps[6].details.push(`⚠️ Có Event Logs liên quan đến KMS`);
    } else {
        newSteps[6].status = 'clean';
        newSteps[6].details.push('✅ Sạch');
    }

    // === FINAL DECISION ===
    let finalStatus = 'Pending';
    const hasTamperingEvidence = newSteps.some((s:any) => s.status === 'danger');
    const hasWarning = newSteps.some((s:any) => s.status === 'warning');

    if (hasTamperingEvidence) {
      finalStatus = 'KMS';
    } else if (isNotification) {
      finalStatus = 'Cảnh báo';
    } else if (hasWarning) {
      if (isLicensed) finalStatus = 'Cảnh báo';
      else finalStatus = 'None';
    } else if (isLicensed) {
      finalStatus = 'Genuine';
    } else {
      finalStatus = 'None';
    }
    
    newSteps[7].status = (finalStatus === 'Genuine' || finalStatus === 'None') ? 'clean' : (finalStatus === 'Cảnh báo' ? 'warning' : 'danger');
    newSteps[7].details.push(`Kết luận: ${finalStatus === 'Genuine' ? 'Bản quyền hợp lệ' : finalStatus === 'KMS' ? 'Có dấu hiệu bất thường' : finalStatus === 'Cảnh báo' ? 'Cần xem xét thêm (Office có giấy phép nhưng Grace Period đã hết)' : 'Chưa kích hoạt'}`);
    
    setOfficeSteps(newSteps);
  }

  const diagnosticSteps = activeTab === 'windows' ? windowsSteps : officeSteps;
  const cleanCount = diagnosticSteps.filter(s => s.status === 'clean').length;
  const warningCount = diagnosticSteps.filter(s => s.status === 'warning').length;
  const dangerCount = diagnosticSteps.filter(s => s.status === 'danger').length;
  const selectedStepDetails = diagnosticSteps.find(step => step.id === activeStep);

  const currentScanResult = activeTab === 'windows' ? windowsScanResult : officeScanResult;

  // ============================================================================
  // DERIVED DATA FROM SCAN RESULT (for forensic workspace)
  // ============================================================================
  const winData = windowsScanResult?.Windows;
  const sysData = windowsScanResult?.System;

  // The scan backend currently returns raw collector data, not an engine decision.
  // Keep the UI assessment explicit so technicians never mistake it for an engine verdict.
  const computedVerdict = useMemo(() => {
    if (!windowsScanResult) return { status: '-', label: 'Chưa quét', color: 'slate' };
    const hasDanger = windowsSteps.some(s => s.status === 'danger');
    const hasWarn = windowsSteps.some(s => s.status === 'warning');
    const licensed = winData?.LicenseStatus === 1;
    if (hasDanger) return { status: 'TAMPERED', label: 'Có dấu hiệu bất thường', color: 'red' };
    if (hasWarn && licensed) return { status: 'WARNING', label: 'Cần xem xét thêm', color: 'amber' };
    if (hasWarn && !licensed) return { status: 'UNLICENSED', label: 'Chưa kích hoạt', color: 'slate' };
    if (licensed) return { status: 'GENUINE', label: 'Bản quyền chính hãng', color: 'emerald' };
    return { status: 'UNKNOWN', label: 'Không xác định', color: 'slate' };
  }, [windowsScanResult, windowsSteps, winData]);

  // --------------------------------------------------------------------------
  // ĐỘ TIN CẬY HỆ THỐNG (WINDOWS) — windowsConfidence
  // --------------------------------------------------------------------------
  // Công thức: điểm % = Σ(trọng số step) / (số step đã phân loại)
  //   - clean   = 100 điểm
  //   - warning = 60 điểm
  //   - danger  = 0 điểm
  //   - idle    = bị loại khỏi công thức (chưa phân tích, không tính)
  //
  // LƯU Ý: Step 8 ("Đánh giá quy tắc") BỊ LOẠI khỏi công thức.
  // Lý do: Step 8 chỉ là bước tổng hợp lại 7 bước bằng chứng trước đó (không
  // phải bằng chứng độc lập). Trước đây nó bị đếm 2 lần — 1 lần qua chính
  // bước gây warning/danger, 1 lần qua Step 8 "ăn theo" — làm sai lệch điểm.
  //
  // Về trọng số 100/60/0: <CHƯA CÓ CĂN CỨ> — đây là các hằng số tự chọn,
  // không có tài liệu hoặc dữ liệu thực tế nào ghi lại lý do chọn. Cần xác
  // nhận/hiệu chỉnh dựa trên dữ liệu thực tế nếu muốn dùng làm thước đo tin cậy.
  //
  // KNOWN LIMITATION (E1): vì các ngưỡng badge (≥90 / ≥60 / <60) đứng yên,
  // việc loại Step 8 có thể làm máy có >=2 danger "nhảy" từ "Có vấn đề" sang
  // "Cần xem xét" (vd: 4c+1w+2d → 58% → 66%). Đây là hành vi đã biết, cố ý
  // giữ nguyên ngưỡng, dành làm dữ liệu tham khảo cho tái cấu trúc confidence
  // (Phương án B). KHÔNG vá riêng lẻ ở đây.
  // --------------------------------------------------------------------------
  const windowsConfidence = useMemo(() => {
    if (!windowsScanResult) return 0;
    // Chỉ tính các bước bằng chứng thật (step 1-7); loại step 8 (tổng hợp) và idle.
    const classified = windowsSteps.filter(s => s.id !== 8 && (s.status === 'clean' || s.status === 'warning' || s.status === 'danger'));
    const total = classified.length || 1;
    const clean = classified.filter(s => s.status === 'clean').length;
    const warn = classified.filter(s => s.status === 'warning').length;
    const danger = classified.filter(s => s.status === 'danger').length;
    // Weighted: clean=100, warning=60, danger=0
    const score = (clean * 100 + warn * 60 + danger * 0) / total;
    return Math.round(score);
  }, [windowsScanResult, windowsSteps]);

  const forensicData = windowsScanResult?.Forensics;



  const selectedStepForensics = useMemo(() => {
    const step = windowsSteps.find(item => item.id === activeStep);
    if (!step) return null;

    const backendStep = forensicData?.steps?.[String(activeStep)] ?? null;
    const wmi: string[] = [];
    const registry: string[] = [];
    const powerShell: string[] = [];
    const files: string[] = [];
    const services: string[] = [];
    const tasks: string[] = [];
    const hosts: string[] = [];
    const eventLog: string[] = [];

    if (activeStep === 1) {
      const oa3 = displayValue(winData?.OA3Key);
      const hasOa3 = displayValue(winData?.HasOA3Key);
      if (oa3) wmi.push(`OA3Key suffix: ${oa3}`);
      if (hasOa3) wmi.push(`HasOA3Key: ${hasOa3}`);
    }
    if (activeStep === 2) {
      ['LicenseFamily', 'Description', 'LicenseStatus', 'PartialProductKey', 'ProductKeyChannel', 'Channel'].forEach(field => {
        const value = displayValue(winData?.[field]);
        if (value) wmi.push(`${field}: ${value}`);
      });
    }
    if (activeStep === 3) {
      const masHistory = displayValue(sysData?.MasHistory);
      const genericKey = displayValue(winData?.IsGenericKey);
      if (masHistory) registry.push(`MasHistory: ${masHistory}`);
      if (genericKey) wmi.push(`IsGenericKey: ${genericKey}`);
    }
    if (activeStep === 4) {
      ['KeyManagementServiceMachine', 'KeyManagementServicePort', 'GracePeriodRemaining'].forEach(field => {
        const value = displayValue(winData?.[field]);
        if (value) wmi.push(`${field}: ${value}`);
      });
      const xpr = displayValue(winData?.Xpr);
      if (xpr) powerShell.push(xpr);
    }
    if (activeStep === 5) {
      (Array.isArray(sysData?.PiratedFiles) ? sysData.PiratedFiles : []).forEach((item: unknown) => files.push(String(item)));
    }
    if (activeStep === 6) {
      (Array.isArray(sysData?.SuspiciousTasks) ? sysData.SuspiciousTasks : []).forEach((item: any) => tasks.push(`${item.Name ?? 'Unnamed task'}${item.Path ? ` - ${item.Path}` : ''}${item.Action ? ` - ${item.Action}` : ''}`));
      (Array.isArray(sysData?.SuspiciousServices) ? sysData.SuspiciousServices : []).forEach((item: unknown) => services.push(String(item)));
    }
    if (activeStep === 7) {
      (Array.isArray(sysData?.HostsRedirects) ? sysData.HostsRedirects : []).forEach((item: unknown) => hosts.push(String(item)));
      (Array.isArray(sysData?.KMSEvents) ? sysData.KMSEvents : []).forEach((item: any) => eventLog.push(`[${item.Time ?? 'No timestamp'}] ${item.Message ?? JSON.stringify(item)}`));
      const noGenTicket = displayValue(sysData?.NoGenTicket);
      if (noGenTicket) registry.push(`NoGenTicket: ${noGenTicket}`);
    }
    if (activeStep === 8) {
      windowsSteps.slice(0, 7).forEach(item => wmi.push(`${item.name}: ${item.status}`));
    }

    const evidenceSources = [
      { label: 'Registry', values: registry },
      { label: 'WMI', values: wmi },
      { label: 'PowerShell', values: powerShell },
      { label: 'Files', values: files },
      { label: 'Services', values: services },
      { label: 'Tasks', values: tasks },
      { label: 'Hosts', values: hosts },
      { label: 'Event Log', values: eventLog },
    ];

    const rawResult = { step: step.id, windows: winData, system: sysData };

    let stepMetadata = { ...windowsEvidenceMetadata[step.id] };
    let stepObj = { ...step };

    if (step.id === 1) {
      const hasOA3Key = Boolean(
        winData?.HasOA3Key === true ||
        (typeof winData?.OA3Key === 'string' && winData.OA3Key.trim().length > 0 && winData.OA3Key !== 'Không có dữ liệu' && winData.OA3Key !== 'N/A') ||
        (typeof winData?.OA3xOriginalProductKey === 'string' && winData.OA3xOriginalProductKey.trim().length > 0 && winData.OA3xOriginalProductKey !== 'Không có dữ liệu' && winData.OA3xOriginalProductKey !== 'N/A')
      );

      if (!windowsScanResult) {
        stepObj.description = 'Chưa đủ dữ liệu để xác định sự tồn tại của khóa OEM.';
        stepMetadata.recommendation = 'Thực hiện lại quá trình phân tích hoặc kiểm tra BIOS.';
      } else if (hasOA3Key) {
        stepObj.description = 'Đã phát hiện khóa OEM trong BIOS. Có thể sử dụng khóa này để khôi phục trạng thái cấp phép khi cần.';
        stepMetadata.recommendation = 'So sánh khóa OEM với khóa đang cài để xác minh tính nhất quán.';
      } else {
        stepObj.description = 'Không phát hiện khóa OEM trong BIOS. Đây là trạng thái bình thường đối với Windows Retail hoặc máy tự lắp ráp.';
        stepMetadata.recommendation = 'Không cần kiểm tra khóa OEM. Tiếp tục xác minh bản quyền dựa trên kênh cấp phép hiện tại (Retail / Volume / Subscription nếu có).';
      }
    }

    return {
      step: stepObj,
      backendStep,
      metadata: stepMetadata,
      evidenceSources,
      rawResult,
      currentResult: step.details.length ? step.details : [],
    };
  }, [activeStep, windowsSteps, winData, sysData, forensicData, windowsScanResult]);

  const scanDurationMs = (scanStartTime && scanEndTime) ? (scanEndTime - scanStartTime) : null;

  // Build the evidence index from actual scan output. Mức ảnh hưởng, reliability and
  // collector timing are intentionally left unavailable until the backend sends them.
  const evidenceList = useMemo(() => {
    if (!windowsScanResult) return [];
    const hasOA3Key = Boolean(
      winData?.HasOA3Key === true ||
      (typeof winData?.OA3Key === 'string' && winData.OA3Key.trim().length > 0 && winData.OA3Key !== 'Không có dữ liệu' && winData.OA3Key !== 'N/A') ||
      (typeof winData?.OA3xOriginalProductKey === 'string' && winData.OA3xOriginalProductKey.trim().length > 0 && winData.OA3xOriginalProductKey !== 'Không có dữ liệu' && winData.OA3xOriginalProductKey !== 'N/A')
    );
    return windowsSteps.map((step, i) => {
      let rec = windowsEvidenceMetadata[step.id].recommendation;
      if (step.id === 1) {
        rec = hasOA3Key
          ? 'So sánh khóa OEM với khóa đang cài để xác minh tính nhất quán.'
          : 'Không cần kiểm tra khóa OEM. Tiếp tục xác minh bản quyền dựa trên kênh cấp phép hiện tại (Retail / Volume / Subscription nếu có).';
      }
      return {
        id: `EV-${String(i + 1).padStart(3, '0')}`,
        idx: i,
        collector: step.name,
        source: windowsEvidenceMetadata[step.id].source,
        sourceKind: windowsEvidenceMetadata[step.id].sourceKind,
        rule: windowsEvidenceMetadata[step.id].rule,
        recommendation: rec,
        status: step.status,
        weight: typeof forensicData?.steps?.[String(step.id)]?.weight === 'number' ? forensicData.steps[String(step.id)].weight : null,
        reliability: typeof forensicData?.steps?.[String(step.id)]?.reliability === 'number' ? forensicData.steps[String(step.id)].reliability : null,
        durationMs: typeof forensicData?.steps?.[String(step.id)]?.durationMs === 'number' ? forensicData.steps[String(step.id)].durationMs : null,
        timestamp: forensicData?.steps?.[String(step.id)]?.timestamp || forensicData?.steps?.[String(step.id)]?.time || null,
        details: step.details,
      };
    });
  }, [windowsScanResult, windowsSteps, forensicData, winData]);

  // Filter + search + sort evidence
  const filteredEvidence = useMemo(() => {
    let list = [...evidenceList];
    if (evidenceFilter !== 'all') list = list.filter(e => e.status === evidenceFilter);
    if (evidenceSearch.trim()) {
      const q = evidenceSearch.toLowerCase();
      list = list.filter(e => e.collector.toLowerCase().includes(q) || e.details.some(d => d.toLowerCase().includes(q)));
    }
    if (evidenceSortBy === 'status') list.sort((a, b) => { const order = { danger: 0, warning: 1, clean: 2, idle: 3 }; return (order[a.status] ?? 9) - (order[b.status] ?? 9); });
    if (evidenceSortBy === 'weight') list.sort((a, b) => (b.weight ?? -1) - (a.weight ?? -1));
    return list;
  }, [evidenceList, evidenceFilter, evidenceSearch, evidenceSortBy]);

  // Hướng xử lý
  const recommendation = useMemo(() => {
    if (!windowsScanResult) return null;
    if (computedVerdict.status === 'TAMPERED') return { action: 'Cân nhắc đặt lại trạng thái cấp phép', risk: 'CAO', reason: 'Ghi nhận dấu hiệu bất thường theo quy tắc kiểm tra.', next: 'Nếu phát hiện dấu hiệu bất thường, hãy cân nhắc đặt lại trạng thái cấp phép và khôi phục bằng khóa OEM hợp lệ (nếu hệ thống hỗ trợ).' };
    if (computedVerdict.status === 'WARNING') return { action: 'Xác minh nguồn gốc khóa', risk: 'TRUNG BÌNH', reason: 'Quá trình quét trả về bằng chứng yếu, chưa thể tự chứng minh có sự can thiệp.', next: 'Kiểm tra hóa đơn mua key hoặc khôi phục key BIOS. Nếu không có bằng chứng mua hợp lệ, cần đặt lại.' };
    if (computedVerdict.status === 'GENUINE') return { action: 'Không cần hành động', risk: 'THẤP', reason: 'Quá trình quét không phát hiện cảnh báo hoặc dấu hiệu bất thường.', next: 'Hệ thống ổn định. Lưu báo cáo nếu cần chứng minh tính hợp lệ.' };
    if (computedVerdict.status === 'UNLICENSED') return { action: 'Cập nhật Product Key hợp lệ', risk: 'TRUNG BÌNH', reason: 'Hệ thống ghi nhận sản phẩm chưa được kích hoạt.', next: 'Cân nhắc khôi phục khóa OEM từ BIOS hoặc áp dụng Product Key hợp lệ.' };
    return null;
  }, [windowsScanResult, computedVerdict]);

  // ============================================================================
  // STATUS BADGE HELPER
  // ============================================================================
  const StatusBadge = ({ status }: { status: DiagnosticStepStatus }) => {
    const cfg = {
      idle: { bg: 'bg-slate-100', text: 'text-slate-500', label: 'Chưa phân tích' },
      clean: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Sạch' },
      warning: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Cảnh báo' },
      danger: { bg: 'bg-red-100', text: 'text-red-700', label: 'Nguy hiểm' },
    };
    const c = cfg[status];
    return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${c.bg} ${c.text}`}>{c.label}</span>;
  };

  // ============================================================================
  // RENDER
  // ============================================================================
  return (
    <div className="space-y-5 w-full">
      <div className="bg-gradient-to-r from-[#121c33] to-[#0f172a] p-6 rounded-2xl border border-slate-800 shadow-xl">
        <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
          <ShieldCheck className="w-6 h-6 text-emerald-400" />
          {'Kiểm Tra & Xử Lý Lỗi Bản Quyền Windows / Office'}
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          {'Quy trình chẩn đoán hệ thống: tập hợp chứng cứ cấp phép, đối chiếu khóa, xác thực KMS, tệp tin, tác vụ và nhật ký sự kiện.'}
        </p>

        <div className="flex gap-2 mt-5 border-t border-slate-800 pt-4">
          <button
            onClick={() => { setActiveTab('windows'); }}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'windows' 
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20' 
                : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {'Bản quyền Windows'}
          </button>
          <button
            onClick={() => { setActiveTab('office'); }}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'office' 
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20' 
                : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {'Bản quyền MS Office'}
          </button>
        </div>
      </div>

      <div className="w-full space-y-5">
        <div className={activeTab === 'office' ? 'w-full' : 'hidden'}>
          <OfficeLicenseAnalyzer />
        </div>

        {activeTab === 'windows' && (
          <div className="bg-[#101728] border border-slate-800 rounded-2xl p-5 shadow-xl text-slate-200 space-y-4 font-sans">
            <div className="bg-[#131d33] p-4 rounded-xl border border-slate-800 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wide">
                      {'CHẨN ĐOÁN & KHÔI PHỤC BẢN QUYỀN WINDOWS'}
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      {'Phân tích dữ liệu hệ thống • Đối chiếu chứng cứ • Đề xuất phương án xử lý lỗi cấp phép.'}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-slate-500 shrink-0">
                  {windowsScanResult ? `Thời gian: ${new Date().toLocaleString('vi-VN')}` : 'Chưa phân tích'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button onClick={handleStartScan} disabled={isLoading || isResetting || isRestoringOem} className="w-full h-10 px-4 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all active:scale-95 cursor-pointer disabled:opacity-50">{isLoading ? <Loader className="animate-spin h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}{isLoading ? 'Đang phân tích...' : 'Phân Tích Cấp Phép Windows (8 Bước)'}</button>
                <button onClick={handleRestoreOemBiosKey} disabled={isLoading || isResetting || isRestoringOem} className="w-full h-10 px-4 rounded-xl text-xs font-bold bg-[#18233c] hover:bg-[#202f50] text-emerald-400 border border-emerald-500/40 flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-50">{isRestoringOem ? <Loader className="animate-spin h-4 w-4" /> : <KeyRound className="h-4 w-4" />}{isRestoringOem ? 'Đang đọc...' : 'Đọc / Khôi Phục Khóa OEM từ BIOS'}</button>
                <button onClick={handleResetActivation} disabled={isLoading || isResetting || isRestoringOem} className="w-full h-10 px-4 rounded-xl text-xs font-bold bg-[#18233c] hover:bg-[#202f50] text-slate-300 border border-slate-700 flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-50">{isResetting ? <Loader className="animate-spin h-4 w-4" /> : <ShieldX className="h-4 w-4" />}{isResetting ? 'Đang đặt lại...' : 'Đặt Lại Trạng Thái Cấp Phép'}</button>
              </div>
            </div>

            {isLoading && <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 text-xs font-semibold text-blue-300">Đang thực hiện phân tích 8 bước...</div>}
            {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-4 rounded-xl text-xs"><h3 className="font-bold flex items-center gap-2"><ServerCrash className="h-5 w-5" />Lỗi Phân Tích / Đặt Lại</h3><p className="mt-1">{error}</p></div>}

            {!windowsScanResult && !isLoading && !error && <div className="bg-[#131d33] p-8 rounded-xl border border-slate-800 text-center"><ShieldCheck className="h-10 w-10 text-slate-600 mx-auto mb-2" /><p className="text-xs font-semibold text-slate-400">Chưa có dữ liệu quét. Hãy nhấn "Phân Tích Cấp Phép Windows (8 Bước)" để bắt đầu.</p></div>}

            {windowsScanResult && (
              <>
                {/* EXECUTIVE SUMMARY */}
                {(() => {
                  const isLicensedWin = winData?.LicenseStatus === 1 || winData?.LicenseStatus === 'LICENSED';
                  const hasOA3Win = Boolean(
                    winData?.HasOA3Key === true ||
                    (typeof winData?.OA3Key === 'string' && winData.OA3Key.trim().length > 0 && winData.OA3Key !== 'Không có dữ liệu' && winData.OA3Key !== 'N/A') ||
                    (typeof winData?.OA3xOriginalProductKey === 'string' && winData.OA3xOriginalProductKey.trim().length > 0 && winData.OA3xOriginalProductKey !== 'Không có dữ liệu' && winData.OA3xOriginalProductKey !== 'N/A')
                  );
                  const partialKeyStr = winData?.PartialProductKey ? `***-${winData.PartialProductKey}` : 'Generic Key';
                  const isMasOrHwid = !hasOA3Win && isLicensedWin;

                  // Phân tích bước cảnh báo/nguy hiểm để gọi đích danh (tương tự Office UI)
                  const warningSteps = windowsSteps.filter(s => s.id !== 8 && s.status === 'warning');
                  const dangerSteps = windowsSteps.filter(s => s.id !== 8 && s.status === 'danger');
                  const hasWarningStep = warningSteps.length > 0;
                  const hasDangerStep = dangerSteps.length > 0;

                  const getConfidenceLabel = () => {
                    if (hasDangerStep) {
                      const names = dangerSteps.map(s => s.name).join(', ');
                      return `(Có vấn đề • ${names}: Nguy cơ)`;
                    }
                    if (hasWarningStep) {
                      const names = warningSteps.map(s => s.name).join(', ');
                      return `(Ổn định • ${names}: Cần xác minh)`;
                    }
                    if (windowsConfidence >= 90) return '(Máy sạch)';
                    if (windowsConfidence >= 60) return '(Cần xem xét)';
                    return '(Có vấn đề)';
                  };

                  const confidenceColorClass = hasDangerStep
                    ? 'text-rose-400'
                    : hasWarningStep
                    ? 'text-amber-400'
                    : windowsConfidence >= 90
                    ? 'text-emerald-400'
                    : windowsConfidence >= 60
                    ? 'text-amber-400'
                    : 'text-rose-400';

                  // Phân tích điều kiện hiển thị ghi chú giải thích (Ưu tiên 3)
                  // Tình huống 1: Khóa BIOS (OA3) khác Khóa đang cài đặt (Installed Key)
                  const rawBiosKey = String(winData?.OA3Key || winData?.OA3xOriginalProductKey || '').trim();
                  const rawInstalledKey = String(winData?.InstalledKey || winData?.PartialProductKey || '').trim();
                  const biosSuffix = rawBiosKey.length >= 5 ? rawBiosKey.slice(-5).toUpperCase() : rawBiosKey.toUpperCase();
                  const installedSuffix = rawInstalledKey.length >= 5 ? rawInstalledKey.slice(-5).toUpperCase() : rawInstalledKey.toUpperCase();
                  const isKeyMismatch = Boolean(
                    hasOA3Win &&
                    biosSuffix &&
                    installedSuffix &&
                    biosSuffix !== 'N/A' &&
                    installedSuffix !== 'N/A' &&
                    biosSuffix !== 'KHÔNG CÓ DỮ LIỆU' &&
                    installedSuffix !== 'KHÔNG CÓ DỮ LIỆU' &&
                    biosSuffix !== installedSuffix
                  );
                  const biosKeyDisplay = rawBiosKey.startsWith('***') ? rawBiosKey : `***${biosSuffix}`;
                  const installedKeyDisplay = rawInstalledKey.startsWith('***') ? rawInstalledKey : `***${installedSuffix}`;

                  // Tình huống 2: KMS38 (Windows Settings báo "digital license" do vé WPA trong khi slmgr/tool báo VOLUME_KMSCLIENT hết hạn năm 2038)
                  const isKms38Detected = Boolean(
                    sysData?.IsKMS38 === true ||
                    winData?.Channel?.includes('KMS38') ||
                    winData?.ProductKeyChannel?.includes('KMS38') ||
                    windowsSteps.some(s => s.details.some(d => d.includes('KMS38') || d.includes('2038')))
                  );

                  return (
                    <div className="space-y-4">
                      {/* Top Indicator Status Bar */}
                      <div className="bg-[#090e1a] text-white rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs border border-slate-800 shadow-md">
                        <div className="flex items-center gap-4 flex-wrap">
                          <div className="flex items-center gap-1.5 font-bold">
                            <span className="text-slate-400 font-normal">Trạng thái:</span>
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              {isLicensedWin ? 'LICENSED (ĐÃ KÍCH HOẠT)' : 'UNLICENSED'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 font-bold">
                            <span className="text-slate-400 font-normal">Khôi phục:</span>
                            <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-400 border border-blue-500/30 inline-flex items-center">
                              {hasOA3Win ? 'Có thể khôi phục bằng OEM BIOS' : 'Không cần thiết'}
                              {hasOA3Win && renderTooltipIcon('OA3')}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 font-bold">
                            <span className="text-slate-400 font-normal">Phương thức:</span>
                            <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-400 border border-purple-500/30 inline-flex items-center">
                              {hasOA3Win ? 'OEM BIOS Key' : isMasOrHwid ? `Giấy phép số HWID (${partialKeyStr})` : (winData?.ProductKeyChannel || 'Volume KMS')}
                              {hasOA3Win ? renderTooltipIcon('OA3') : isMasOrHwid ? renderTooltipIcon('HWID') : renderTooltipIcon('KMS')}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400">Độ tin cậy hệ thống:</span>
                          <span className={`font-black text-sm ${confidenceColorClass}`}>
                            {windowsConfidence}%
                          </span>
                          <span className={`text-[11px] font-medium ${hasDangerStep ? 'text-rose-400' : hasWarningStep ? 'text-amber-300' : 'text-slate-400'}`}>
                            {getConfidenceLabel()}
                          </span>
                        </div>
                      </div>

                      {/* Main Verification Container */}
                      <div className="bg-[#131d33] rounded-2xl border border-slate-800 shadow-xl space-y-4 p-5">
                        <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-800">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-emerald-400" />
                            <h4 className="font-bold text-white text-xs uppercase tracking-wider">
                              KẾT QUẢ XÁC MINH NGUỒN GỐC BẢN QUYỀN WINDOWS
                            </h4>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-[11px] font-bold border uppercase tracking-wider inline-flex items-center ${
                            hasOA3Win 
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                              : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                          }`}>
                            {hasOA3Win ? 'CHÍNH HÃNG FACTORY OEM (BIOS KEY)' : 'NGUỒN KÍCH HOẠT CẦN XÁC MINH THÊM (HWID / GENERIC KEY)'}
                            {hasOA3Win ? renderTooltipIcon('OA3') : renderTooltipIcon('HWID')}
                          </span>
                        </div>

                        {/* 5-step Flow Visualizer */}
                        <div className="bg-[#0e1626] p-3 rounded-xl border border-slate-800 flex items-center justify-between text-[11px] font-medium text-slate-400 overflow-x-auto gap-2">
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-bold text-[10px]">1</span>
                            <span>Quy trình kiểm tra (8 bước)</span>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-bold text-[10px]">2</span>
                            <span className="inline-flex items-center">
                              Kiểm tra Key BIOS ({hasOA3Win ? 'Có Key' : 'Không có'})
                              {renderTooltipIcon('OA3')}
                            </span>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-bold text-[10px]">3</span>
                            <span className="inline-flex items-center">
                              Phân tích Generic Key ({partialKeyStr})
                              {renderTooltipIcon('GenericKey')}
                            </span>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={`w-5 h-5 rounded-full text-slate-950 flex items-center justify-center font-bold text-[10px] ${hasDangerStep ? 'bg-rose-500' : hasWarningStep ? 'bg-amber-500' : 'bg-cyan-500'}`}>4</span>
                            <span className={confidenceColorClass}>Mức độ tin cậy ({windowsConfidence}% {getConfidenceLabel()})</span>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                          <div className="flex items-center gap-1.5 shrink-0 font-bold text-slate-200">
                            <span className="w-5 h-5 rounded-full bg-slate-700 text-white flex items-center justify-center text-[10px]">5</span>
                            <span>Hướng xử lý KTV</span>
                          </div>
                        </div>

                        {/* Detail Note & Proof Checklist Box */}
                        <div className="bg-[#090e1a] text-slate-200 p-4 rounded-xl border border-slate-800 space-y-3">
                          <div className="text-xs font-bold text-slate-300">
                            CẤP ĐỘ XÁC MINH BẢN QUYỀN &amp; CHỨNG TỪ KÈM THEO:
                          </div>
                          <p className="text-xs text-slate-400 leading-relaxed">
                            Trạng thái ghi nhận <strong className="text-emerald-400">LICENSED ({hasOA3Win ? 'OEM BIOS' : 'Giấy phép số HWID'})</strong>. {hasWarningStep ? `Hệ thống ghi nhận trạng thái ổn định nhưng có bước cần xác minh: ${warningSteps.map(s => s.name).join(', ')}.` : hasDangerStep ? `Hệ thống ghi nhận dấu hiệu bất thường cần kỹ thuật viên xử lý: ${dangerSteps.map(s => s.name).join(', ')}.` : 'Hệ thống KHÔNG phát hiện các công cụ bẻ khóa hoặc tệp tin bị thay đổi ngầm (Máy sạch 100%).'} Khi cần đối soát bản quyền với cơ quan kiểm tra, bạn có thể lưu giữ các chứng từ sau:
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-slate-300 font-mono">
                            <div className="p-2 bg-[#131d33] rounded-lg border border-slate-800">
                              • Hóa đơn mua máy hoặc chứng nhận bản quyền.
                            </div>
                            <div className="p-2 bg-[#131d33] rounded-lg border border-slate-800">
                              • Tem COA (Certificate of Authenticity).
                            </div>
                            <div className="p-2 bg-[#131d33] rounded-lg border border-slate-800">
                              • Khóa bản quyền (Product Key / Key BIOS) chính hãng.
                            </div>
                            <div className="p-2 bg-[#131d33] rounded-lg border border-slate-800">
                              • Email xác nhận từ Microsoft Store.
                            </div>
                            <div className="p-2 bg-[#131d33] rounded-lg border border-slate-800">
                              • Hợp đồng cấp phép doanh nghiệp (VLSC / M365).
                            </div>
                            <div className="p-2 bg-[#131d33] rounded-lg border border-slate-800">
                              • Tài khoản bản quyền số (Microsoft Digital License).
                            </div>
                          </div>
                          
                          {/* Warning Note Card */}
                          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs leading-relaxed space-y-1">
                            <div className="font-bold flex items-center gap-1.5 text-amber-400">
                              <AlertTriangle className="w-4 h-4 shrink-0" />
                              <span>Phân tích đặc trưng Generic Key / HWID:</span>
                            </div>
                            <p className="text-[11px] text-slate-300">
                              {!hasOA3Win && isLicensedWin
                                ? `Tuy nhiên, máy đang sử dụng Key chung (Generic Key: ${partialKeyStr}) không đi kèm Key trong BIOS. Đây có thể là hành vi kích hoạt HWID/MAS hoặc giấy phép số HỢP LỆ liên kết phần cứng / tài khoản Microsoft Store.`
                                : 'Máy có Key bản quyền nhúng trực tiếp trong BIOS (OA3). Đây là bản quyền OEM nhà sản xuất chính hãng đi kèm máy.'}
                            </p>
                          </div>

                          {/* GIẢI THÍCH TÌNH HUỐNG 1: KHÓA BIOS KHÁC KHÓA ĐANG CÀI (OEM vs Installed Key) */}
                          {isKeyMismatch && (
                            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl text-xs text-blue-300 leading-relaxed space-y-1 font-sans">
                              <div className="font-bold flex items-center gap-1.5 text-blue-400">
                                <Info className="w-4 h-4 shrink-0" />
                                <span>Ghi chú đối chiếu: Khóa BIOS khác Khóa đang cài đặt</span>
                                {renderTooltipIcon('OA3')}
                              </div>
                              <p className="text-[11px] text-slate-300">
                                Máy có khóa xuất xưởng trong BIOS ({biosKeyDisplay}) nhưng hiện đang chạy với khóa cài đặt khác ({installedKeyDisplay}). Đây là <strong>tình huống bình thường</strong> khi kỹ thuật viên hoặc người dùng cài lại hệ điều hành khác phiên bản xuất xưởng (ví dụ: nâng cấp từ Windows Home lên Pro bằng key riêng), hoàn toàn không phải lỗi đọc sai dữ liệu.
                              </p>
                            </div>
                          )}

                          {/* GIẢI THÍCH TÌNH HUỐNG 2: KMS38 (Cảnh báo kích hoạt trái phép & lý do Settings vẫn hiện digital license) */}
                          {isKms38Detected && (
                            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 leading-relaxed space-y-1.5 font-sans">
                              <div className="font-bold flex items-center gap-1.5 text-rose-400">
                                <ShieldAlert className="w-4 h-4 shrink-0" />
                                <span>Cảnh báo: Phát hiện dấu hiệu kích hoạt trái phép qua cơ chế KMS38</span>
                                {renderTooltipIcon('KMS38')}
                              </div>
                              <p className="text-[11px] text-slate-300">
                                Hệ thống phát hiện máy đang sử dụng phương thức bẻ khóa <strong className="text-rose-400">KMS38</strong> (kênh <strong>VOLUME_KMSCLIENT</strong> với thời hạn cưỡng ép kéo dài tới năm 2038).
                              </p>
                              <p className="text-[11px] text-slate-300">
                                <strong>Tại sao Windows Settings vẫn báo xanh &quot;digital license&quot;?</strong> Bản chất kỹ thuật của KMS38 là can thiệp tạo vé kích hoạt WPA giả lập trong dịch vụ bảo vệ bản quyền SPP, đánh lừa Windows nhận diện hệ thống đã có giấy phép số. Giao diện Windows Settings chỉ đọc cờ trạng thái vé tổng quan nên vẫn hiển thị hợp lệ, nhưng thực chất đây là kích hoạt không chính ngạch và có nguy cơ lỗi hệ thống hoặc mất bản quyền khi Windows cập nhật.
                              </p>
                            </div>
                          )}
                        </div>

                        {/* 4 Bottom Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                          <div className="p-3 bg-[#0e1626] rounded-xl border border-slate-800">
                            <span className="text-[10px] font-bold text-slate-500 uppercase block">Trạng thái</span>
                            <span className="font-bold text-slate-100 text-sm">{computedVerdict.label}</span>
                          </div>
                          <div className="p-3 bg-[#0e1626] rounded-xl border border-slate-800">
                            <span className="text-[10px] font-bold text-slate-500 uppercase block">Phương thức</span>
                            <span className="font-bold text-slate-200 inline-flex items-center">
                              {hasOA3Win ? 'OEM BIOS' : 'Giấy phép số (HWID)'}
                              {hasOA3Win ? renderTooltipIcon('OEM') : renderTooltipIcon('HWID')}
                            </span>
                          </div>
                          <div className="p-3 bg-[#0e1626] rounded-xl border border-slate-800">
                            <span className="text-[10px] font-bold text-slate-500 uppercase block">Key BIOS OA3</span>
                            <span className="font-bold text-emerald-400 inline-flex items-center">
                              {hasOA3Win ? `Có (${winData?.OA3Key || 'OA3 Key'})` : 'Chưa tìm thấy'}
                              {renderTooltipIcon('OA3')}
                            </span>
                          </div>
                          <div className="p-3 bg-[#0e1626] rounded-xl border border-slate-800">
                            <span className="text-[10px] font-bold text-slate-500 uppercase block">Độ tin cậy nguồn</span>
                            <span className="font-bold text-cyan-400">{hasOA3Win ? '100% (Chính hãng)' : '80% (Cần chứng từ)'}</span>
                          </div>
                        </div>

                        {/* Recommendation Footer */}
                        <div className="bg-[#0e1626] p-3.5 rounded-xl border border-slate-800 text-xs space-y-1.5">
                          <div className="font-bold text-slate-200 flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            <span>Khuyến nghị &amp; Lý do giải thích:</span>
                          </div>
                          <div className="text-slate-400 space-y-1 pl-5 text-[11px]">
                            <p>✓ Không cần khôi phục Registry sạch, DLL chính hãng Microsoft, tệp hệ thống không có dấu hiệu can thiệp.</p>
                            <p>✓ Xác minh thêm nguồn KMS/HWID nếu cần đối soát máy chủ doanh nghiệp hoặc cung cấp chứng từ mua hàng.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div className="bg-[#131d33] p-4 rounded-xl border border-slate-800 shadow-sm">
                  <div className="text-xs font-bold text-slate-200 uppercase tracking-wide mb-2">Tổng quan chứng cứ</div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-xs">
                    <div className="p-2 bg-[#0e1626] border border-slate-800 rounded-lg text-slate-300"><b>Khóa sản phẩm:</b> <span className="text-slate-400 font-mono">{displayValue(winData?.ProductKey) || 'Không có dữ liệu'}</span></div>
                    <div className="p-2 bg-[#0e1626] border border-slate-800 rounded-lg text-slate-300"><b>Khóa một phần:</b> <span className="text-slate-400 font-mono">{displayValue(winData?.PartialProductKey) || 'Không có dữ liệu'}</span></div>
                    <div className="p-2 bg-[#0e1626] border border-slate-800 rounded-lg text-slate-300 flex items-center justify-between">
                      <div><b>Khóa BIOS:</b> <span className="text-emerald-400 font-mono">{displayValue(winData?.OA3Key) || 'Không có dữ liệu'}</span></div>
                      {renderTooltipIcon('OA3')}
                    </div>
                    <div className="p-2 bg-[#0e1626] border border-slate-800 rounded-lg text-slate-300"><b>Khóa đã cài đặt:</b> <span className="text-slate-400 font-mono">{displayValue(winData?.InstalledKey) || 'Không có dữ liệu'}</span></div>
                    <div className="p-2 bg-[#0e1626] border border-slate-800 rounded-lg text-slate-300 flex items-center justify-between">
                      <div><b>Kênh cấp phép:</b> <span className="text-slate-400">{displayValue(winData?.ProductKeyChannel || winData?.Channel) || 'Không có dữ liệu'}</span></div>
                      {renderTooltipIcon('Volume')}
                    </div>
                    <div className="p-2 bg-[#0e1626] border border-slate-800 rounded-lg text-slate-300"><b>ID kích hoạt:</b> <span className="text-slate-400 font-mono text-[10px]">{displayValue(winData?.ActivationId) || 'Không có dữ liệu'}</span></div>
                    <div className="p-2 bg-[#0e1626] border border-slate-800 rounded-lg text-slate-300 flex items-center justify-between">
                      <div><b>KMS Host:</b> <span className="text-slate-400 font-mono">{displayValue(winData?.KeyManagementServiceMachine) || 'Không có dữ liệu'}</span></div>
                      {renderTooltipIcon('KMS')}
                    </div>
                    <div className="p-2 bg-[#0e1626] border border-slate-800 rounded-lg text-slate-300"><b>KMS Port:</b> <span className="text-slate-400 font-mono">{displayValue(winData?.KeyManagementServicePort) || 'Không có dữ liệu'}</span></div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  <div className="lg:col-span-4">
                    <div className="space-y-2.5">
                      <div className="font-bold text-slate-300 text-xs flex items-center justify-between border-b border-slate-800 pb-2">
                        <span className="flex items-center gap-2">Danh sách bộ thu thập</span>
                        <span className="text-[10px] text-slate-500 font-normal">{filteredEvidence.length} mục</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
                          <input value={evidenceSearch} onChange={(e) => setEvidenceSearch(e.target.value)} placeholder="Tìm bộ thu thập..." className="w-full pl-7 pr-2 py-1.5 text-xs bg-[#0e1626] border border-slate-700 rounded-lg text-slate-200 focus:border-emerald-500 outline-none" />
                        </div>
                        <div className="relative">
                          <Filter className="w-3.5 h-3.5 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
                          <select value={evidenceFilter} onChange={(e) => setEvidenceFilter(e.target.value as any)} className="pl-7 pr-2 py-1.5 text-xs bg-[#0e1626] border border-slate-700 rounded-lg text-slate-200 focus:border-emerald-500 outline-none">
                            <option value="all">Tất cả</option>
                            <option value="clean">Ổn định</option>
                            <option value="warning">Cần xem xét</option>
                            <option value="danger">Rủi ro cao</option>
                          </select>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        {filteredEvidence.map((item) => (
                          <div key={item.id} className="border border-slate-800 rounded-xl overflow-hidden transition-all bg-[#0e1626]">
                            <button
                              onClick={() => setActiveStep(item.id)}
                              className={`w-full p-2.5 flex items-center justify-between text-left cursor-pointer transition-colors ${activeStep === item.id ? 'bg-[#162544] border-l-2 border-l-emerald-400' : 'hover:bg-[#131d33]'}`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-bold text-slate-200 text-xs truncate">Bước {item.id}: {item.collector}</span>
                              </div>
                              <div className="shrink-0">
                                <StatusBadge status={item.status} />
                              </div>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="lg:col-span-8">
                    <div className="bg-[#131d33] p-4 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 min-h-[140px] shadow-sm">
                      <div className="space-y-2.5">
                        <div className="font-bold text-slate-200 text-xs flex items-center justify-between border-b border-slate-800 pb-2">
                          <span className="flex items-center gap-2">Chi tiết bộ thu thập</span>
                          {selectedStepForensics && <span className="text-[10px] text-slate-400 font-normal">Bước {selectedStepForensics.step.id}</span>}
                        </div>

                        {selectedStepForensics ? (
                          <div className="space-y-2">
                            <div className="bg-[#0e1626] p-3 rounded-xl border border-slate-800 space-y-1">
                              <span className="text-[10px] font-bold text-slate-400 block uppercase">Lý do (Why):</span>
                              <div className="text-xs text-slate-200 leading-relaxed font-medium">
                                {selectedStepForensics.step.status === 'clean' || selectedStepForensics.step.status === 'idle'
                                  ? 'Không phát hiện bất kỳ dấu vết can thiệp bất thường nào.'
                                  : 'Phát hiện cấu hình hoặc dữ liệu cần kỹ thuật viên xác minh.'}
                              </div>
                            </div>

                            <div className="bg-[#0e1626] p-3 rounded-xl border border-slate-800 space-y-1">
                              <span className="text-[10px] font-bold text-slate-400 block uppercase">Bằng chứng (Evidence):</span>
                              <div className="text-xs text-emerald-400 font-mono bg-[#090e1a] p-2 rounded-lg border border-slate-800">
                                {selectedStepForensics.currentResult[0] ?? 'Chưa có dữ liệu'}
                              </div>
                            </div>

                            <div className="bg-[#0e1626] p-3 rounded-xl border border-slate-800 space-y-1">
                              <span className="text-[10px] font-bold text-slate-400 block uppercase">Mức độ rủi ro (Risk Level):</span>
                              <span className={`inline-block px-2.5 py-0.5 rounded-md text-[11px] font-bold ${
                                selectedStepForensics.step.status === 'danger' ? 'bg-rose-500/20 text-rose-400' :
                                selectedStepForensics.step.status === 'warning' ? 'bg-amber-500/20 text-amber-400' :
                                'bg-emerald-500/20 text-emerald-400'
                              }`}>
                                {selectedStepForensics.step.status === 'danger' ? 'Rủi ro cao' :
                                 selectedStepForensics.step.status === 'warning' ? 'Cần xem xét' : 'An toàn / Ổn định'}
                              </span>
                            </div>

                            <div className="bg-[#0e1626] p-3 rounded-xl border border-slate-800 space-y-1">
                              <span className="text-[10px] font-bold text-slate-400 block uppercase">Hành động khuyến nghị (Action):</span>
                              <div className="text-xs text-slate-200 leading-relaxed font-semibold">
                                {translateBackendString(selectedStepForensics.metadata.recommendation)}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-500 py-6 text-center">Vui lòng chọn bộ thu thập để xem chi tiết.</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Enhanced Execution Timeline */}
                <div className="bg-[#131d33] p-4 rounded-xl border border-slate-800 shadow-sm space-y-2.5">
                  <div className="font-bold text-slate-200 text-xs flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-emerald-400" /> Dòng thời gian thực thi (Timeline)
                    </span>
                    <span className="text-[10px] text-slate-500 font-normal">{evidenceList.length} bước</span>
                  </div>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {evidenceList.map((e, index) => {
                      const isClean = e.status === 'clean' || e.status === 'idle';
                      const isExpanded = expandedTimelineStep === e.idx;
                      return (
                        <div key={`tl-${e.id}`} className="border border-slate-800 rounded-xl overflow-hidden bg-[#0e1626] text-xs">
                          <div
                            onClick={() => setExpandedTimelineStep(isExpanded ? null : e.idx)}
                            className="flex items-center justify-between p-2.5 cursor-pointer hover:bg-[#162544] transition-colors"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="font-mono text-[11px] text-slate-500 shrink-0 font-medium">
                                {e.timestamp || `#${index + 1}`}
                              </span>
                              <span className={isClean ? "text-emerald-400 font-bold shrink-0" : "text-amber-400 font-bold shrink-0"}>
                                {isClean ? "✓" : "⚠"}
                              </span>
                              <span className="font-medium text-slate-200 truncate">{e.collector}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {typeof e.durationMs === 'number' && (
                                <span className="font-mono text-[10px] text-slate-500">
                                  ({e.durationMs} ms)
                                </span>
                              )}
                              <span className="text-[10px] text-slate-500 font-bold">
                                {isExpanded ? '▲' : '▼'}
                              </span>
                            </div>
                          </div>
                          {isExpanded && (
                            <div className="p-3 bg-[#090e1a] border-t border-slate-800 space-y-1.5 text-[11px] text-slate-300 font-mono">
                              <div><b className="text-slate-400">Nguồn:</b> {e.source}</div>
                              <div><b className="text-slate-400">Quy tắc:</b> {e.rule}</div>
                              <div><b className="text-slate-400">Khuyến nghị:</b> {e.recommendation}</div>
                              {e.details.length > 0 && (
                                <div><b className="text-slate-400">Chi tiết:</b> {e.details.join(' | ')}</div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Collapsible Live Execution Console Panel */}
                <div className="bg-[#131d33] p-4 rounded-xl border border-slate-800 shadow-sm space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="font-bold text-slate-200 text-xs">Nhật ký thực thi trực tiếp (Live Console)</span>
                      <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">
                        {consoleLogs.length} dòng
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={copyConsoleLogs}
                        className="px-2.5 py-1 bg-[#18233c] hover:bg-[#202f50] text-slate-300 text-[10px] font-bold rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Copy className="w-3 h-3" /> Sao chép
                      </button>
                      <button
                        onClick={exportConsoleLogsTxt}
                        className="px-2.5 py-1 bg-[#18233c] hover:bg-[#202f50] text-slate-300 text-[10px] font-bold rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <FileText className="w-3 h-3" /> Xuất TXT
                      </button>
                      <button
                        onClick={() => setIsConsoleOpen(!isConsoleOpen)}
                        className="text-[10px] text-slate-400 hover:text-white font-bold px-1 cursor-pointer"
                      >
                        {isConsoleOpen ? '▲ Thu gọn' : '▼ Mở rộng'}
                      </button>
                    </div>
                  </div>

                  {isConsoleOpen && (
                    <div className="bg-[#090e1a] text-slate-200 font-mono text-[11px] p-3 rounded-xl border border-slate-800 max-h-48 overflow-y-auto space-y-1">
                      {consoleLogs.map((log, idx) => (
                        <div key={`log-${idx}`} className="leading-relaxed whitespace-pre-wrap">
                          {log}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Reset License Result Modal */}
      {resetModalData?.isOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#101728] rounded-2xl border border-slate-800 shadow-2xl max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-sm">{resetModalData.title}</h3>
              <button
                onClick={() => setResetModalData(null)}
                className="text-slate-400 hover:text-white text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Chi tiết các bước thực hiện:</div>
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {resetModalData.steps.map((st, idx) => (
                  <div key={`res-st-${idx}`} className="flex items-start justify-between p-2 bg-[#131d33] border border-slate-800 rounded-xl text-xs">
                    <div className="flex items-center gap-2">
                      <span className={st.status === 'success' ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                        {st.status === 'success' ? '✓' : '⚠'}
                      </span>
                      <span className="font-medium text-slate-200">{st.label}</span>
                    </div>
                    {st.detail && <span className="text-[10px] text-slate-400 font-mono">{st.detail}</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Final Summary Row */}
            <div className="bg-[#0e1626] p-3 rounded-xl border border-slate-800 grid grid-cols-4 gap-2 text-center text-xs">
              <div>
                <div className="text-[10px] text-slate-500 uppercase font-bold">Trạng thái</div>
                <div className="font-bold text-emerald-400 mt-0.5">{resetModalData.overallStatus}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase font-bold">Thời gian</div>
                <div className="font-bold text-slate-200 mt-0.5">{resetModalData.duration}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase font-bold">Cảnh báo</div>
                <div className="font-bold text-amber-400 mt-0.5">{resetModalData.warningsCount}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase font-bold">Lỗi</div>
                <div className="font-bold text-rose-400 mt-0.5">{resetModalData.errorsCount}</div>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                onClick={() => setResetModalData(null)}
                className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition-all cursor-pointer active:scale-95"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

