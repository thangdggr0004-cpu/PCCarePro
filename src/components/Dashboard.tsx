import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Cpu,
  Trash2,
  Wifi,
  AlignLeft,
  ArrowRight,
  Coffee,
  User,
  Phone,
  Facebook,
  Laptop,
  Settings,
  Printer,
  Archive,
  Lock,
  Star,
  Gauge,
  Zap,
  Terminal,
  FileText,
  Activity,
  HardDrive,
  CheckCircle,
  Clock,
  RefreshCw,
  Sparkles,
  Layers,
  ArrowUpDown,
  Plus,
  KeyRound,
  CheckCircle2,
  X,
  SlidersHorizontal,
} from 'lucide-react';
import { playTaskDoneSound } from '../utils/audio.js';
import packageJson from '../../package.json' with { type: 'json' };
import { normalizeHardwareInfo } from './HardwareDetails.js';

interface DashboardProps {
  onNavigate: (section: string) => void;
}


interface ToolCardItem {
  id: string;
  badge: string;
  title: string;
  desc: string;
  linkText: string;
  icon: React.ComponentType<{ className?: string }>;
  colorKey: 'emerald' | 'purple' | 'amber' | 'cyan' | 'teal' | 'rose';
}

const mainToolCards: ToolCardItem[] = [
  {
    id: 'activation',
    badge: 'KIỂM TRA BẢN QUYỀN',
    title: 'Quét Windows & Office bản quyền',
    desc: 'Phát hiện trạng thái bản quyền và hỗ trợ dọn sạch key KMS/MAK.',
    linkText: 'CHI TIẾT QUÉT BẢN QUYỀN',
    icon: ShieldCheck,
    colorKey: 'emerald',
  },
  {
    id: 'hardware',
    badge: 'CHI TIẾT PHẦN CỨNG',
    title: 'Cấu hình phần cứng chi tiết',
    desc: 'Xem chi tiết bus RAM, khe cắm trống, ổ cứng SSD/HDD và CPU Turbo.',
    linkText: 'CHẨN ĐOÁN PHẦN CỨNG',
    icon: Cpu,
    colorKey: 'purple',
  },
  {
    id: 'cleaner',
    badge: 'DỌN DẸP NHANH',
    title: 'Dọn dẹp rác chuyên sâu',
    desc: 'Xóa tệp tạm thời Temp, Prefetch, Log lỗi giải phóng hàng GB dung lượng.',
    linkText: 'QUÉT DỌN RÁC',
    icon: Trash2,
    colorKey: 'amber',
  },
  {
    id: 'laptop-tester',
    badge: 'ALL IN ONE',
    title: 'Kiểm Tra Laptop Toàn Diện',
    desc: 'Test 8 trong 1: Màn hình, Bàn phím, Webcam, Mic, Cảm ứng, Pin, S.M.A.R.T, VGA.',
    linkText: 'CÔNG CỤ CHUẨN ĐOÁN',
    icon: Laptop,
    colorKey: 'cyan',
  },
  {
    id: 'windows-settings',
    badge: 'TỐI ƯU WINDOWS',
    title: 'Thiết lập Windows',
    desc: 'Tinh chỉnh hệ thống, bật/tắt Ultimate Performance, chặn Windows Update, tối ưu SSD.',
    linkText: 'CẤU HÌNH HỆ THỐNG',
    icon: Settings,
    colorKey: 'teal',
  },
  {
    id: 'network',
    badge: 'MẠNG & DNS',
    title: 'Kiểm tra Mạng & Đổi DNS',
    desc: 'Đổi nhanh DNS quốc tế/trong nước thông dụng khắc phục ping lag, đứt lọc.',
    linkText: 'CẤU HÌNH MẠNG',
    icon: Wifi,
    colorKey: 'rose',
  },
];

const colorStyles = {
  emerald: {
    iconBox: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    link: 'text-emerald-400 hover:text-emerald-300',
  },
  purple: {
    iconBox: 'bg-purple-500/15 border-purple-500/30 text-purple-400',
    badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    link: 'text-purple-400 hover:text-purple-300',
  },
  amber: {
    iconBox: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    link: 'text-amber-400 hover:text-amber-300',
  },
  cyan: {
    iconBox: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400',
    badge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    link: 'text-cyan-400 hover:text-cyan-300',
  },
  teal: {
    iconBox: 'bg-teal-500/15 border-teal-500/30 text-teal-400',
    badge: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
    link: 'text-teal-400 hover:text-teal-300',
  },
  rose: {
    iconBox: 'bg-rose-500/15 border-rose-500/30 text-rose-400',
    badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    link: 'text-rose-400 hover:text-rose-300',
  },
};

export default function Dashboard({ onNavigate }: DashboardProps) {
  const [defenderEnabled, setDefenderEnabled] = useState<boolean | null>(null);
  const [defenderLoading, setDefenderLoading] = useState<boolean>(true);
  const [togglingDefender, setTogglingDefender] = useState<boolean>(false);
  const [favorites, setFavorites] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('thienphat_card_favorites');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // System Metrics State
  const [hardwareInfo, setHardwareInfo] = useState<any>(null);
  const [systemInfo, setSystemInfo] = useState<any>(null);
  const [metrics, setMetrics] = useState({
    cpu: 0,
    ram: 0,
    temp: 0,
    disk: 0,
    netUp: 0,
    netDown: 0,
  });
  const [uptimeStr, setUptimeStr] = useState('00:00:00');

  // Defender Check — immediate, fast (~10ms via registry)
  useEffect(() => {
    setDefenderLoading(true);
    (window as any).electronAPI?.getDefenderStatus?.()
      .then((res: any) => {
        setDefenderEnabled(res && typeof res.enabled === 'boolean' ? res.enabled : true);
      })
      .catch(() => setDefenderEnabled(true))
      .finally(() => setDefenderLoading(false));

    const parseMetrics = (raw: any) => {
      const d = raw?.data ?? raw ?? {};
      return {
        cpu: typeof d.cpu === 'number' ? d.cpu : (typeof d.cpu === 'string' ? parseFloat(d.cpu) || 0 : 0),
        ram: typeof d.ram === 'object' ? (d.ram?.percent ?? 0) : (typeof d.ram === 'number' ? d.ram : (typeof d.ram === 'string' ? parseFloat(d.ram) || 0 : 0)),
        temp: typeof d.temp === 'object' ? (d.temp?.cpu ?? 0) : (typeof d.temp === 'number' ? d.temp : (typeof d.temp === 'string' ? parseFloat(d.temp) || 0 : 0)),
        disk: typeof d.disk === 'object' ? (d.disk?.percent ?? 0) : (typeof d.disk === 'number' ? d.disk : (typeof d.disk === 'string' ? parseFloat(d.disk) || 0 : 0)),
        netUp: typeof d.speed === 'object' ? (d.speed?.upload ?? 0) : (typeof d.netUp === 'number' ? d.netUp : 0),
        netDown: typeof d.speed === 'object' ? (d.speed?.download ?? 0) : (typeof d.netDown === 'number' ? d.netDown : 0),
      };

    };

    // Metrics listener — register immediately
    let offPush: (() => void) | null = null;
    if (typeof (window as any).electronAPI?.onMetricsPush === 'function') {
      offPush = (window as any).electronAPI.onMetricsPush((m: any) => {
        setMetrics(parseMetrics(m));
      });
    }

// Startup bundle: hardware + metrics + system in ONE backend call
  // (single PowerShell spawn, shared across every component via gates).
  (window as any).electronAPI?.getStartupBundle?.()
    .then((b: any) => {
      if (!b) return;
      if (b.hardware) setHardwareInfo(normalizeHardwareInfo(b.hardware));
      if (b.metrics) setMetrics(parseMetrics(b.metrics));
      if (b.system) {
        setSystemInfo(b.system);
        if (b.system.uptime) setUptimeStr(b.system.uptime);
      }
    })
    .catch(() => {});

    // Live uptime counter
    let baseSeconds = 0;
    const uptimeInterval = setInterval(() => {
      baseSeconds++;
      const hours = String(Math.floor(baseSeconds / 3600)).padStart(2, '0');
      const mins = String(Math.floor((baseSeconds % 3600) / 60)).padStart(2, '0');
      const secs = String(baseSeconds % 60).padStart(2, '0');
      setUptimeStr(`${hours}:${mins}:${secs}`);
    }, 1000);

    return () => {
      offPush?.();
      clearInterval(uptimeInterval);
    };
  }, []);



  const handleToggleDefender = async () => {
    const targetState = !defenderEnabled;

    if (defenderEnabled === true) {
      const confirm = window.confirm('Bạn có chắc chắn muốn TẮT Windows Defender?');
      if (!confirm) return;
    }

    setTogglingDefender(true);
    try {
      const res = await (window as any).electronAPI?.toggleDefenderStatus?.(targetState);
      if (res && res.success) {
        const check = await (window as any).electronAPI?.getDefenderStatus?.();
        setDefenderEnabled(check && typeof check.enabled === 'boolean' ? check.enabled : targetState);
      } else {
        alert(`Không thể ${targetState ? 'bật' : 'tắt'} Windows Defender: ${res?.error || 'Lỗi'}`);
      }
    } catch (err: unknown) {
      alert(`Lỗi khi điều khiển Windows Defender: ${err instanceof Error ? err.message : 'Lỗi'}`);
    } finally {
      setTogglingDefender(false);
    }
  };

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = { ...favorites, [id]: !favorites[id] };
    setFavorites(updated);
    localStorage.setItem('thienphat_card_favorites', JSON.stringify(updated));
  };

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [runningToolId, setRunningToolId] = useState<string | null>(null);
  const [showToolModal, setShowToolModal] = useState<boolean>(false);

  const allAvailableQuickTools = [
    {
      id: 'junk-clean',
      label: 'Dọn rác nhanh',
      icon: Trash2,
      desc: 'Xóa Temp, Prefetch, Thùng rác tức thì',
      action: async () => {
        await (window as any).electronAPI?.cleanJunk?.(['user_temp', 'system_temp', 'prefetch', 'recycle_bin']);
        return 'Đã dọn sạch các tệp rác hệ thống!';
      },
    },
    {
      id: 'flush-dns',
      label: 'Flush DNS',
      icon: Zap,
      desc: 'Làm sạch bộ nhớ đệm DNS card mạng',
      action: async () => {
        await (window as any).electronAPI?.applyDns?.({ primary: '1.1.1.1', secondary: '1.0.0.1' });
        return 'Đã làm sạch DNS Cache thành công!';
      },
    },
    {
      id: 'ssd-trim',
      label: 'Tối ưu SSD TRIM',
      icon: HardDrive,
      desc: 'Kích hoạt ReTrim tối ưu tốc độ SSD',
      action: async () => {
        await (window as any).electronAPI?.runSsdTrim?.();
        return 'Đang chạy tối ưu hóa SSD trong nền!';
      },
    },
    {
      id: 'clear-spooler',
      label: 'Xóa kẹt in',
      icon: Printer,
      desc: 'Dọn sạch hàng đợi in Spooler',
      action: async () => {
        await (window as any).electronAPI?.executePrinterAction?.('clear_spooler');
        return 'Đã giải phóng toàn bộ hàng đợi in!';
      },
    },
    {
      id: 'rebuild-icons',
      label: 'Sửa icon trắng',
      icon: Layers,
      desc: 'Tái tạo bộ nhớ đệm IconCache.db',
      action: async () => {
        await (window as any).electronAPI?.rebuildIconCache?.();
        return 'Đã tái tạo Icon Cache thành công!';
      },
    },
    {
      id: 'restart-explorer',
      label: 'Restart Explorer',
      icon: RefreshCw,
      desc: 'Khởi động lại Taskbar & Desktop',
      action: async () => {
        await (window as any).electronAPI?.restartExplorer?.();
        return 'Đã khởi động lại Windows Explorer!';
      },
    },
    {
      id: 'battery-report',
      label: 'Báo cáo pin',
      icon: Laptop,
      desc: 'Xuất file HTML chi tiết chu kỳ pin',
      action: async () => {
        await (window as any).electronAPI?.openBatteryReportHtml?.();
        return 'Đã mở báo cáo Pin Laptop!';
      },
    },
    {
      id: 'taskmgr',
      label: 'Task Manager',
      icon: Activity,
      desc: 'Mở cửa sổ Task Manager',
      action: async () => {
        await (window as any).electronAPI?.openSystemTool?.('taskmgr');
        return 'Đã mở Task Manager!';
      },
    },
    {
      id: 'devmgmt',
      label: 'Device Manager',
      icon: Settings,
      desc: 'Mở Quản lý Thiết bị Device Manager',
      action: async () => {
        await (window as any).electronAPI?.openSystemTool?.('devmgmt');
        return 'Đã mở Device Manager!';
      },
    },
    {
      id: 'services',
      label: 'Services.msc',
      icon: Settings,
      desc: 'Mở bảng dịch vụ hệ thống Services',
      action: async () => {
        await (window as any).electronAPI?.openSystemTool?.('services');
        return 'Đã mở Services.msc!';
      },
    },
  ];

  const [activeToolIds, setActiveToolIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('tp_quick_favorite_tools');
      if (saved) return JSON.parse(saved);
    } catch {}
    return ['junk-clean', 'flush-dns', 'ssd-trim', 'clear-spooler', 'rebuild-icons', 'taskmgr', 'restart-explorer'];
  });

  const toggleToolVisibility = (id: string) => {
    let next: string[];
    if (activeToolIds.includes(id)) {
      if (activeToolIds.length <= 1) return;
      next = activeToolIds.filter((t) => t !== id);
    } else {
      next = [...activeToolIds, id];
    }
    setActiveToolIds(next);
    localStorage.setItem('tp_quick_favorite_tools', JSON.stringify(next));
  };

  const handleExecuteQuickTool = async (tool: typeof allAvailableQuickTools[0]) => {
    if (runningToolId) return;
    setRunningToolId(tool.id);
    try {
      const res = await tool.action();
      playTaskDoneSound();
      setToastMessage(`✅ ${res}`);
      setTimeout(() => setToastMessage(null), 3000);
    } catch (e: any) {
      setToastMessage(`⚠️ Lỗi: ${e?.message || 'Không thể thực thi'}`);
      setTimeout(() => setToastMessage(null), 3000);
    } finally {
      setRunningToolId(null);
    }
  };


  return (
    <div className="flex flex-col xl:flex-row gap-4" id="dashboard-container">
      {/* ── Left Column: Hero, Tool Cards, Quick Favorites (70% width on 2K/1080p) ── */}
      <div className="flex-1 space-y-4 min-w-0">
        {/* ── Hero Banner (Compact & Responsive) ── */}
        <div className="relative p-4 sm:p-5 bg-gradient-to-br from-[#121c33] via-[#0f172a] to-[#0a101f] rounded-2xl border border-slate-800/90 shadow-lg overflow-hidden">
          {/* Subtle Ambient Glow */}
          <div className="absolute top-0 right-1/4 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-10 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Left Texts & Actions */}
            <div className="flex-1 min-w-0 space-y-2">
              <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/15 px-2.5 py-0.5 rounded-full border border-emerald-500/30 uppercase tracking-widest inline-block">
                TRÌNH QUẢN LÝ &amp; CHẨN ĐOÁN CAO CẤP
              </span>

              <h2 className="text-lg sm:text-xl md:text-2xl font-extrabold text-white leading-snug tracking-tight">
                Bảng điều khiển quản lý <span className="text-emerald-400">Windows &amp; Office</span>
              </h2>

              <p className="text-xs text-slate-400 leading-relaxed max-w-lg">
                Truy cập nhanh các công cụ chẩn đoán, dọn dẹp, kiểm tra bản quyền, tối ưu hệ thống và sửa lỗi máy tính.
              </p>

              <div className="pt-1 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => onNavigate('cleaner')}
                  className="py-1.5 px-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs transition cursor-pointer flex items-center gap-1.5 shadow-md shadow-emerald-500/20 active:scale-95"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Dọn dẹp rác
                </button>

                <button
                  onClick={() => onNavigate('activation')}
                  className="py-1.5 px-3 bg-[#18233c] hover:bg-[#1f2d4d] border border-slate-700/80 text-slate-200 font-semibold rounded-lg text-xs transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
                  Kiểm tra bản quyền
                </button>

                <button
                  onClick={handleToggleDefender}
                  disabled={togglingDefender || defenderLoading}
                  className="py-1.5 px-3 rounded-lg text-xs font-semibold transition cursor-pointer shadow-sm flex items-center gap-1.5 bg-[#131d33] hover:bg-[#182542] border border-emerald-500/30 text-emerald-300 disabled:opacity-50"
                  title="Bật/Tắt trạng thái Windows Defender"
                >
                  {togglingDefender || defenderLoading ? (
                    <>
                      <span className="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                      <span>{defenderLoading ? 'Kiểm tra...' : 'Đang xử lý...'}</span>
                    </>
                  ) : (
                    <>
                      <span
                        className={`w-2 h-2 rounded-full ${
                          defenderEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                        }`}
                      />
                      <span>Defender: {defenderEnabled ? 'Bật' : 'Tắt'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Right Visual 3D Tech Graphic — Ultra-sharp Vector SVG */}
            <div className="relative w-36 h-28 sm:w-44 sm:h-32 md:w-56 md:h-40 lg:w-60 lg:h-44 shrink-0 flex items-center justify-center pointer-events-none select-none">
              <svg
                viewBox="0 0 380 300"
                className="w-full h-full drop-shadow-[0_15px_25px_rgba(0,0,0,0.5)]"

                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  {/* Gradients */}
                  <linearGradient id="platformTop" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#14213d" stopOpacity="0.9" />
                    <stop offset="60%" stopColor="#0b1322" stopOpacity="0.95" />
                    <stop offset="100%" stopColor="#070c16" stopOpacity="0.9" />
                  </linearGradient>

                  <linearGradient id="platformEdge" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="50%" stopColor="#065f46" />
                    <stop offset="100%" stopColor="#022c22" />
                  </linearGradient>

                  <linearGradient id="bezelOuter" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#64748b" />
                    <stop offset="40%" stopColor="#334155" />
                    <stop offset="100%" stopColor="#0f172a" />
                  </linearGradient>

                  <linearGradient id="bezelSide" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#475569" />
                    <stop offset="100%" stopColor="#1e293b" />
                  </linearGradient>

                  <linearGradient id="screenBack" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#071224" />
                    <stop offset="100%" stopColor="#030914" />
                  </linearGradient>

                  <radialGradient id="screenCenterGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#0284c7" stopOpacity="0.45" />
                    <stop offset="70%" stopColor="#0369a1" stopOpacity="0.1" />
                    <stop offset="100%" stopColor="#08101e" stopOpacity="0" />
                  </radialGradient>

                  <linearGradient id="winPane" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#38bdf8" />
                    <stop offset="100%" stopColor="#0284c7" />
                  </linearGradient>

                  <linearGradient id="shield3DGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#34d399" />
                    <stop offset="50%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#047857" />
                  </linearGradient>

                  <linearGradient id="shieldFrontGlass" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#6ee7b7" stopOpacity="0.85" />
                    <stop offset="60%" stopColor="#10b981" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="#047857" stopOpacity="0.75" />
                  </linearGradient>

                  <linearGradient id="glassCardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#1e293b" stopOpacity="0.7" />
                    <stop offset="100%" stopColor="#0f172a" stopOpacity="0.85" />
                  </linearGradient>

                  <linearGradient id="barNeon" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#34d399" />
                    <stop offset="100%" stopColor="#059669" />
                  </linearGradient>

                  <filter id="vectorNeonGlow" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="5" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {/* ── 1. Background Cyber Circuit Lines & Glow Nodes ── */}
                <g opacity="0.8">
                  {/* Glowing background circuit traces */}
                  <path d="M 220 70 L 290 105 L 350 75" stroke="#059669" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.6" />
                  <path d="M 280 100 L 320 120 L 370 95" stroke="#0ea5e9" strokeWidth="1.2" opacity="0.5" />
                  <path d="M 50 180 L 110 210 L 150 190" stroke="#10b981" strokeWidth="1.2" opacity="0.5" />

                  {/* Luminous Node Points */}
                  <circle cx="290" cy="105" r="4" fill="#34d399" filter="url(#vectorNeonGlow)" />
                  <circle cx="290" cy="105" r="2" fill="#ffffff" />
                  <circle cx="320" cy="120" r="3.5" fill="#38bdf8" filter="url(#vectorNeonGlow)" />
                  <circle cx="320" cy="120" r="1.5" fill="#ffffff" />
                  <circle cx="50" cy="180" r="3" fill="#34d399" />
                </g>

                {/* ── 2. Isometric Platform (Base Stage) ── */}
                <g>
                  {/* Platform Depth (Bottom Bevel) */}
                  <polygon
                    points="70,185 225,255 225,268 70,198"
                    fill="#047857"
                    opacity="0.9"
                  />
                  <polygon
                    points="225,255 355,195 355,208 225,268"
                    fill="#022c22"
                    opacity="0.9"
                  />

                  {/* Platform Top Surface */}
                  <polygon
                    points="70,185 225,255 355,195 200,125"
                    fill="url(#platformTop)"
                    stroke="url(#platformEdge)"
                    strokeWidth="2"
                  />

                  {/* Platform Neon Highlight Line */}
                  <path
                    d="M 70 185 L 225 255 L 355 195"
                    stroke="#34d399"
                    strokeWidth="1.5"
                    filter="url(#vectorNeonGlow)"
                    opacity="0.75"
                  />
                </g>

                {/* ── 3. Monitor Stand & Base ── */}
                <g>
                  {/* Stand Platform Foot */}
                  <polygon
                    points="165,195 210,215 235,203 190,183"
                    fill="#1e293b"
                    stroke="#475569"
                    strokeWidth="1.5"
                  />
                  <polygon
                    points="165,195 210,215 210,219 165,199"
                    fill="#0f172a"
                  />
                  {/* Stand Neck Column */}
                  <path
                    d="M 192 145 L 208 145 L 204 195 L 188 195 Z"
                    fill="url(#bezelSide)"
                    stroke="#334155"
                    strokeWidth="1"
                  />
                </g>

                {/* ── 4. 3D Isometric Monitor ── */}
                <g>
                  {/* Monitor Back/Side 3D Depth */}
                  <polygon
                    points="125,50 285,92 285,190 125,148"
                    fill="#0b1322"
                  />
                  <polygon
                    points="285,92 296,87 296,185 285,190"
                    fill="url(#bezelSide)"
                    stroke="#475569"
                    strokeWidth="1"
                  />
                  <polygon
                    points="125,50 136,45 296,87 285,92"
                    fill="#475569"
                    stroke="#64748b"
                    strokeWidth="1"
                  />

                  {/* Monitor Outer Silver Bezel */}
                  <polygon
                    points="125,50 285,92 285,190 125,148"
                    fill="url(#bezelOuter)"
                    stroke="#94a3b8"
                    strokeWidth="1.5"
                  />

                  {/* Screen Glass Display Area */}
                  <polygon
                    points="134,60 276,97 276,180 134,143"
                    fill="url(#screenBack)"
                  />
                  <polygon
                    points="134,60 276,97 276,180 134,143"
                    fill="url(#screenCenterGlow)"
                  />

                  {/* ── Windows 11 4-Panes Logo (Isometric Slant) ── */}
                  <g transform="translate(180, 88)">
                    {/* Top Left Pane */}
                    <polygon points="5,5 24,10 24,29 5,24" fill="url(#winPane)" filter="url(#vectorNeonGlow)" />
                    <polygon points="5,5 24,10 24,29 5,24" fill="url(#winPane)" />
                    {/* Top Right Pane */}
                    <polygon points="29,11 50,17 50,36 29,30" fill="url(#winPane)" filter="url(#vectorNeonGlow)" />
                    <polygon points="29,11 50,17 50,36 29,30" fill="url(#winPane)" />
                    {/* Bottom Left Pane */}
                    <polygon points="5,30 24,35 24,54 5,49" fill="url(#winPane)" filter="url(#vectorNeonGlow)" />
                    <polygon points="5,30 24,35 24,54 5,49" fill="url(#winPane)" />
                    {/* Bottom Right Pane */}
                    <polygon points="29,36 50,42 50,61 29,55" fill="url(#winPane)" filter="url(#vectorNeonGlow)" />
                    <polygon points="29,36 50,42 50,61 29,55" fill="url(#winPane)" />
                  </g>
                </g>

                {/* ── 5. Translucent 3D Hologram Security Shield (Front-Left) ── */}
                <g transform="translate(68, 125)">
                  {/* Shield Bottom Drop Shadow */}
                  <ellipse cx="40" cy="85" rx="30" ry="10" fill="#047857" opacity="0.3" filter="url(#vectorNeonGlow)" />

                  {/* 3D Shield Back/Extrusion Thickness */}
                  <path
                    d="M 38 6 L 68 20 L 68 55 C 68 80 38 102 38 102 C 38 102 8 80 8 55 L 8 20 Z"
                    fill="#047857"
                  />

                  {/* 3D Shield Front Beveled Body */}
                  <path
                    d="M 44 0 L 74 14 L 74 49 C 74 74 44 96 44 96 C 44 96 14 74 14 49 L 14 14 Z"
                    fill="url(#shield3DGrad)"
                    stroke="#a7f3d0"
                    strokeWidth="1.5"
                  />

                  {/* Specular Front Glassmorphism Plate */}
                  <path
                    d="M 44 7 L 68 18 L 68 47 C 68 68 44 86 44 86 C 44 86 20 68 20 47 L 20 18 Z"
                    fill="url(#shieldFrontGlass)"
                    stroke="#d1fae5"
                    strokeWidth="1"
                  />

                  {/* Bold Luminous 3D Checkmark */}
                  <path
                    d="M 32 46 L 41 55 L 59 34"
                    stroke="#ffffff"
                    strokeWidth="4.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                    filter="url(#vectorNeonGlow)"
                  />
                  <path
                    d="M 32 46 L 41 55 L 59 34"
                    stroke="#ffffff"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </g>

                {/* ── 6. Translucent 3D Analytics Bar Chart Glass Card (Front-Right) ── */}
                <g transform="translate(235, 155)">
                  {/* Glass Card Surface */}
                  <polygon
                    points="0,25 75,0 75,70 0,95"
                    fill="url(#glassCardGrad)"
                    stroke="#34d399"
                    strokeWidth="1.5"
                    strokeOpacity="0.7"
                  />

                  {/* Card Subtle Grid Guide Lines */}
                  <line x1="10" y1="75" x2="68" y2="55" stroke="#10b981" strokeWidth="0.75" strokeDasharray="3 3" opacity="0.4" />
                  <line x1="10" y1="50" x2="68" y2="30" stroke="#10b981" strokeWidth="0.75" strokeDasharray="3 3" opacity="0.3" />

                  {/* 4 Glowing Neon Bar Columns (Growing in Height) */}
                  {/* Column 1 (Shortest) */}
                  <g transform="translate(10, 60)">
                    <polygon points="0,0 8,-3 8,18 0,21" fill="url(#barNeon)" filter="url(#vectorNeonGlow)" />
                    <polygon points="0,0 8,-3 8,18 0,21" fill="url(#barNeon)" />
                    <polygon points="0,0 8,-3 12,-1 4,2" fill="#6ee7b7" />
                  </g>

                  {/* Column 2 */}
                  <g transform="translate(23, 48)">
                    <polygon points="0,0 8,-3 8,26 0,29" fill="url(#barNeon)" filter="url(#vectorNeonGlow)" />
                    <polygon points="0,0 8,-3 8,26 0,29" fill="url(#barNeon)" />
                    <polygon points="0,0 8,-3 12,-1 4,2" fill="#6ee7b7" />
                  </g>

                  {/* Column 3 */}
                  <g transform="translate(37, 36)">
                    <polygon points="0,0 8,-3 8,34 0,37" fill="url(#barNeon)" filter="url(#vectorNeonGlow)" />
                    <polygon points="0,0 8,-3 8,34 0,37" fill="url(#barNeon)" />
                    <polygon points="0,0 8,-3 12,-1 4,2" fill="#6ee7b7" />
                  </g>

                  {/* Column 4 (Tallest) */}
                  <g transform="translate(51, 20)">
                    <polygon points="0,0 8,-3 8,46 0,49" fill="url(#barNeon)" filter="url(#vectorNeonGlow)" />
                    <polygon points="0,0 8,-3 8,46 0,49" fill="url(#barNeon)" />
                    <polygon points="0,0 8,-3 12,-1 4,2" fill="#6ee7b7" />
                  </g>

                  {/* 4 Bottom Data Dots */}
                  <circle cx="14" cy="83" r="1.5" fill="#34d399" opacity="0.8" />
                  <circle cx="27" cy="78" r="1.5" fill="#34d399" opacity="0.8" />
                  <circle cx="41" cy="74" r="1.5" fill="#34d399" opacity="0.8" />
                  <circle cx="55" cy="69" r="1.5" fill="#34d399" opacity="0.8" />
                </g>
              </svg>
            </div>
          </div>
        </div>







        {/* ── 6 Main Tool Cards (2x3 Grid) ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {mainToolCards.map((card) => {
            const style = colorStyles[card.colorKey];
            const Icon = card.icon;
            const isFav = !!favorites[card.id];

            return (
              <div
                key={card.id}
                onClick={() => onNavigate(card.id)}
                className="bg-[#131d33] hover:bg-[#16223b] p-4 rounded-xl border border-slate-800/80 hover:border-slate-700 transition-all duration-200 cursor-pointer flex flex-col justify-between group shadow-sm hover:shadow-lg hover:-translate-y-0.5"
              >

                <div>
                  {/* Top Icon & Badge */}
                  <div className="flex items-center justify-between mb-3.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${style.iconBox} shadow-sm group-hover:scale-105 transition-transform`}>
                      <Icon className="w-5 h-5" />
                    </div>

                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${style.badge}`}>
                      {card.badge}
                    </span>
                  </div>

                  {/* Card Title & Desc */}
                  <div className="space-y-1.5 mb-4">
                    <h3 className="text-sm font-bold text-slate-100 group-hover:text-white transition-colors">
                      {card.title}
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                      {card.desc}
                    </p>
                  </div>
                </div>

                {/* Bottom Action Link & Star Favorite */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-[11px] font-bold">
                  <span className={`flex items-center gap-1.5 tracking-wider uppercase ${style.link} transition-colors`}>
                    {card.linkText} <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                  </span>

                  <button
                    onClick={(e) => toggleFavorite(card.id, e)}
                    className="p-1 text-slate-600 hover:text-amber-400 transition"
                    title={isFav ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
                  >
                    <Star
                      className={`w-3.5 h-3.5 ${
                        isFav ? 'text-amber-400 fill-amber-400' : 'text-slate-600'
                      }`}
                    />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Favorite Quick Tools Bar ── */}
        <div className="p-4 bg-[#11192e] rounded-2xl border border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-200 tracking-wide">
                Lệnh &amp; Công Cụ Nhanh (1-Click)
              </span>
            </div>

            <button
              onClick={() => setShowToolModal(true)}
              className="text-[11px] text-slate-400 hover:text-emerald-400 flex items-center gap-1.5 transition cursor-pointer"
              title="Tùy chỉnh các nút công cụ hiển thị"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Tùy chỉnh ({activeToolIds.length})</span>
            </button>
          </div>

          {/* Real Action Feedback Toast */}
          {toastMessage && (
            <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 animate-bounce" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* Quick Buttons List */}
          <div className="flex flex-wrap gap-2">
            {allAvailableQuickTools
              .filter((tool) => activeToolIds.includes(tool.id))
              .map((tool) => {
                const ToolIcon = tool.icon;
                const isRunning = runningToolId === tool.id;

                return (
                  <button
                    key={tool.id}
                    onClick={() => handleExecuteQuickTool(tool)}
                    disabled={isRunning}
                    title={tool.desc}
                    className="px-3.5 py-1.5 rounded-xl bg-[#16223b] hover:bg-[#1d2c4c] border border-slate-700/60 hover:border-emerald-500/40 text-xs font-medium text-slate-200 hover:text-white flex items-center gap-2 transition cursor-pointer active:scale-95 shadow-sm disabled:opacity-60"
                  >
                    {isRunning ? (
                      <span className="w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <ToolIcon className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    <span>{tool.label}</span>
                  </button>
                );
              })}

            <button
              onClick={() => setShowToolModal(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-800/40 hover:bg-slate-800 border border-dashed border-slate-700 text-xs font-medium text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm công cụ</span>
            </button>
          </div>
        </div>

        {/* Modal Tùy Chỉnh Công Cụ Nhanh */}
        {showToolModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-lg bg-[#0f172a] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-5 py-4 bg-[#131d33] border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-bold text-white">Tùy Chỉnh Công Cụ Nhanh (1-Click)</span>
                </div>
                <button
                  onClick={() => setShowToolModal(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
                <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                  Chọn các lệnh &amp; công cụ bạn muốn ghim lên thanh thao tác nhanh của Trang chủ:
                </p>

                {allAvailableQuickTools.map((tool) => {
                  const isChecked = activeToolIds.includes(tool.id);
                  const Icon = tool.icon;

                  return (
                    <div
                      key={tool.id}
                      onClick={() => toggleToolVisibility(tool.id)}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition ${
                        isChecked
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-white'
                          : 'bg-slate-800/40 hover:bg-slate-800/80 border-slate-700/50 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isChecked ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-slate-100 block">
                            {tool.label}
                          </span>
                          <span className="text-[11px] text-slate-400 truncate block">
                            {tool.desc}
                          </span>
                        </div>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                          isChecked
                            ? 'bg-emerald-500 border-emerald-500 text-slate-950'
                            : 'border-slate-600 bg-slate-800'
                        }`}
                      >
                        {isChecked && <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
                <button
                  onClick={() => setShowToolModal(false)}
                  className="py-1.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition cursor-pointer shadow"
                >
                  Xong &amp; Lưu
                </button>
              </div>
            </div>
          </div>
        )}


        {/* ── Author & Support Footer Bar ── */}
        <div className="bg-[#11192e] p-4 rounded-2xl border border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
              <Coffee className="w-4 h-4" />
            </div>
            <div>
              <span className="text-slate-200 font-semibold block">Ủng hộ phát triển phần mềm</span>
              <span className="text-[11px] text-slate-400">Techcombank: <span className="font-mono font-bold text-emerald-400">386677889999</span> (ThắngĐG)</span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-slate-300">
              <Phone className="w-3.5 h-3.5 text-emerald-400" /> 0787 567 870
            </span>
            <button
              onClick={() => (window as any).electronAPI?.openUrl?.('https://www.facebook.com/HKDThienPhat')}
              className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 transition cursor-pointer"
            >
              <Facebook className="w-3.5 h-3.5" /> ThắngĐG
            </button>
          </div>
        </div>
      </div>

      {/* ── Right Column: System Status Panel (TRẠNG THÁI HỆ THỐNG) ── */}
      <div className="w-full xl:w-80 space-y-4 shrink-0">
        {/* System Status Container */}
        <div className="bg-[#101728] p-5 rounded-2xl border border-slate-800/80 space-y-5 shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              TRẠNG THÁI HỆ THỐNG
            </h3>
          </div>

          {/* Metric 1: CPU */}
          <div className="bg-[#131d33] p-3 rounded-xl border border-slate-800/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <Cpu className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-200">CPU</span>
                </div>
                <p className="text-[10px] text-slate-400 truncate max-w-[130px]">
                  {hardwareInfo?.cpuName || 'Đang tải...'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-sm font-extrabold font-mono text-emerald-400">
                {metrics.cpu}%
              </span>
              {/* Mini sparkline */}
              <svg className="w-12 h-3 mt-1" viewBox="0 0 50 12">
                <path d="M 0 10 Q 10 2, 20 8 T 40 4 T 50 7" fill="none" stroke="#10b981" strokeWidth="1.5" />
              </svg>
            </div>
          </div>

          {/* Metric 2: RAM */}
          <div className="bg-[#131d33] p-3 rounded-xl border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                  <Layers className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-200">RAM</span>
                  <span className="text-[10px] text-slate-400 block font-mono">
                    {hardwareInfo?.ramTotalSize ? `${hardwareInfo.ramTotalSize}GB ${hardwareInfo.ramType || ''}` : 'Đang tải...'}
                  </span>
                </div>
              </div>
              <span className="text-xs font-extrabold font-mono text-purple-400">
                {metrics.ram}%
              </span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-purple-500 to-indigo-400 h-full rounded-full transition-all duration-700"
                style={{ width: `${metrics.ram}%` }}
              />
            </div>
          </div>

          {/* Metric 3: Disk C: */}
          <div className="bg-[#131d33] p-3 rounded-xl border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                  <HardDrive className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-200">Ổ C:</span>
                  <span className="text-[10px] text-slate-400 block font-mono">
                    {hardwareInfo?.storageDrives?.[0]
                      ? `${hardwareInfo.storageDrives[0].type || 'SSD'} ${hardwareInfo.storageDrives[0].totalSize}GB`
                      : 'SSD System Drive'}

                  </span>
                </div>
              </div>
              <span className="text-xs font-extrabold font-mono text-amber-400">
                {metrics.disk}%
              </span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-amber-500 to-orange-400 h-full rounded-full transition-all duration-700"
                style={{ width: `${metrics.disk}%` }}
              />
            </div>
          </div>

          {/* Metric 4: CPU Temp */}
          <div className="bg-[#131d33] p-3 rounded-xl border border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                <Activity className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-slate-200">Nhiệt độ CPU</span>
            </div>
            <div className="text-right">
              <span className="text-xs font-extrabold font-mono text-blue-400">
                {metrics.temp}°C
              </span>
              <svg className="w-12 h-3 mt-1" viewBox="0 0 50 12">
                <path d="M 0 6 Q 15 10, 25 3 T 50 6" fill="none" stroke="#60a5fa" strokeWidth="1.5" />
              </svg>
            </div>
          </div>

          {/* Metric 5: Network Speed */}
          <div className="bg-[#131d33] p-3 rounded-xl border border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center shrink-0">
                <ArrowUpDown className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-200">Tốc độ mạng</span>
                <span className="text-[10px] text-teal-400 block font-mono">
                  ↑ {metrics.netUp} Mbps • ↓ {metrics.netDown} Mbps
                </span>
              </div>
            </div>
            <svg className="w-12 h-4" viewBox="0 0 50 16">
              <path d="M 0 14 L 10 10 L 20 12 L 30 4 L 40 6 L 50 2" fill="none" stroke="#14b8a6" strokeWidth="1.5" />
            </svg>
          </div>

          {/* ── System Info Table (THÔNG TIN HỆ THỐNG) ── */}
          <div className="pt-2 border-t border-slate-800 space-y-2.5 text-xs">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              THÔNG TIN HỆ THỐNG
            </div>
            <div className="space-y-2 text-[11px] font-mono">
              <div className="flex items-start justify-between gap-3 py-0.5 text-slate-400 border-b border-slate-800/40 pb-1.5">
                <span className="shrink-0 text-slate-400">Windows</span>
                <span className="text-slate-200 font-semibold text-right leading-tight break-words max-w-[180px]">
                  {systemInfo?.caption || 'Đang tải...'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 py-0.5 text-slate-400 border-b border-slate-800/40 pb-1">
                <span className="shrink-0 text-slate-400">Build</span>
                <span className="text-slate-200 font-semibold text-right">{systemInfo?.buildNumber || '—'}</span>
              </div>
              <div className="flex items-center justify-between gap-3 py-0.5 text-slate-400 border-b border-slate-800/40 pb-1">
                <span className="shrink-0 text-slate-400">Architecture</span>
                <span className="text-slate-200 font-semibold text-right">{systemInfo?.architecture || '—'}</span>
              </div>
              <div className="flex items-center justify-between gap-3 py-0.5 text-slate-400">
                <span className="shrink-0 text-slate-400">Thời gian hoạt động</span>
                <span className="text-emerald-400 font-bold text-right">{uptimeStr}</span>
              </div>
            </div>
          </div>


          {/* ── App Version Card (PHIÊN BẢN) ── */}
          <div className="pt-3 border-t border-slate-800 space-y-2">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              PHIÊN BẢN
            </div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-200 block">
                  PC Care Master Pro
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  v{packageJson.version}
                </span>
              </div>
              <button
                onClick={async () => {
                  try {
                    const res: any = await (window as any).electronAPI?.checkForUpdates?.();
                    if (!res?.hasUpdate) {
                      const { message } = await import('@tauri-apps/plugin-dialog');
                      await message(`Bạn đang ở phiên bản mới nhất (v${packageJson.version}). Không có bản cập nhật nào mới hơn trên GitHub.`, {
                        title: 'Thông Tin Cập Nhật',
                      });
                    } else {
                      const { message } = await import('@tauri-apps/plugin-dialog');
                      await message(`Có bản mới: v${res.version}\nHãy bấm "Tải & Cập Nhật" ở góc phải dưới để cập nhật.`, {
                        title: 'Có Bản Cập Nhật',
                      });
                    }
                  } catch (e: any) {
                    console.error('[UPDATE] error:', e);
                    const { message } = await import('@tauri-apps/plugin-dialog');
                    await message(`Lỗi kiểm tra cập nhật: ${e?.message || e}`, { title: 'Lỗi' });
                  }
                }}
                className="px-3 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-400 font-bold rounded-lg text-xs transition cursor-pointer"
              >
                Cập nhật
              </button>
            </div>
            <p className="text-[10px] text-slate-500">
              Bạn đang dùng phiên bản mới nhất
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

