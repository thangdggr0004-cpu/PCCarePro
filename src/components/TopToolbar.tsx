import React, { useState, useEffect } from 'react';
import {
  Search,
  Bell,
  Settings,
  CheckCircle2,
  Shield,
  ShieldAlert,
  AlertTriangle,
  Info,
  X,
  HardDrive,
  Cpu,
  Trash2,
  ArrowRight,
  Sparkles,
  CheckCheck,
} from 'lucide-react';
import Tooltip from './ui/Tooltip.js';

export interface NotificationItem {
  id: string;
  title: string;
  desc: string;
  time: string;
  type: 'success' | 'warning' | 'info' | 'danger';
  section?: string;
  actionName?: string;
}

interface TopToolbarProps {
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  onNavigate?: (section: string) => void;
}

export default function TopToolbar({
  onOpenSearch,
  onOpenSettings,
  onNavigate,
}: TopToolbarProps) {

  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Real Dynamic System Status Check
  useEffect(() => {
    let isMounted = true;

    const checkSystemStatus = async () => {
      const list: NotificationItem[] = [];

      // 1. Real Windows Defender Check
      try {
        const defRes = await (window as any).electronAPI?.getDefenderStatus?.();
        if (defRes && typeof defRes.enabled === 'boolean') {
          if (defRes.enabled) {
            list.push({
              id: 'defender-ok',
              title: 'Windows Defender',
              desc: 'Hệ thống bảo vệ thời gian thực đang BẬT và an toàn.',
              time: 'Thời gian thực',
              type: 'success',
              section: 'dashboard',
            });
          } else {
            list.push({
              id: 'defender-warn',
              title: 'Cảnh Báo: Defender Đã Tắt',
              desc: 'Windows Defender đang bị TẮT. Nhấp để chuyển đến Bảng điều khiển bật lại.',
              time: 'Khẩn cấp',
              type: 'warning',
              section: 'dashboard',
              actionName: 'Bật bảo vệ',
            });
          }
        }
      } catch {}

      // 2. Real Cached Metrics / Hardware Check
      try {
        const m = await (window as any).electronAPI?.getCachedMetrics?.();
        const d = m?.data ?? m ?? {};
        const freeGB = d.disk?.freeGB;
        if (typeof freeGB === 'number' && freeGB < 20) {
          list.push({
            id: 'disk-low',
            title: 'Ổ Đĩa C: Dung Lượng Thấp',
            desc: `Ổ C: chỉ còn ${freeGB} GB trống. Hãy dọn rác để tránh đầy bộ nhớ.`,
            time: 'Hệ thống',
            type: 'danger',
            section: 'cleaner',
            actionName: 'Dọn dẹp rác',
          });
        }
      } catch {}

      // 3. License Status
      list.push({
        id: 'license-status',
        title: 'Bản Quyền Windows & Office',
        desc: 'Hệ thống đã sẵn sàng kiểm tra và kích hoạt bản quyền số vĩnh viễn.',
        time: 'Hôm nay',
        type: 'info',
        section: 'activation',
        actionName: 'Kiểm tra key',
      });

      if (isMounted) {
        setNotifications(list);
      }
    };

    checkSystemStatus();

    // Listen to real-time metrics push for thermal / memory alerts
    let unlisten: (() => void) | null = null;
    if (typeof (window as any).electronAPI?.onMetricsPush === 'function') {
      unlisten = (window as any).electronAPI.onMetricsPush((raw: any) => {
        const d = raw?.data ?? raw ?? {};
        const temp = typeof d.temp === 'object' ? (d.temp?.cpu ?? 0) : (typeof d.temp === 'number' ? d.temp : 0);
        const ramPct = typeof d.ram === 'object' ? (d.ram?.percent ?? 0) : (typeof d.ram === 'number' ? d.ram : 0);

        if (temp >= 85) {
          setNotifications((prev) => {
            if (prev.some((n) => n.id === 'cpu-hot')) return prev;
            return [
              {
                id: 'cpu-hot',
                title: 'Cảnh Báo Nhiệt Độ CPU',
                desc: `CPU đạt ${temp}°C, vượt ngưỡng an toàn. Khuyến nghị giảm tải hoặc kiểm tra tản nhiệt.`,
                time: 'Vừa xong',
                type: 'danger',
                section: 'hardware',
              },
              ...prev,
            ];
          });
        }

        if (ramPct >= 90) {
          setNotifications((prev) => {
            if (prev.some((n) => n.id === 'ram-high')) return prev;
            return [
              {
                id: 'ram-high',
                title: 'Bộ Nhớ RAM Đầy (>90%)',
                desc: `RAM đang sử dụng ${ramPct}%, hãy dọn rác hoặc đóng bớt ứng dụng.`,
                time: 'Vừa xong',
                type: 'warning',
                section: 'cleaner',
              },
              ...prev,
            ];
          });
        }
      });
    }

    return () => {
      isMounted = false;
      if (unlisten) unlisten();
    };
  }, []);

  const alertCount = notifications.filter(
    (n) => n.type === 'warning' || n.type === 'danger'
  ).length;

  const handleDismissNotification = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleClearAll = () => {
    setNotifications([]);
  };

  const handleItemClick = (item: NotificationItem) => {
    if (item.section && onNavigate) {
      onNavigate(item.section);
      setShowNotifications(false);
    }
  };

  return (
    <header className="w-full h-14 bg-[#0d1424] border-b border-slate-800/80 px-4 md:px-6 flex items-center justify-between shrink-0 relative z-30 select-none">
      {/* ── Left: Brand Header (PC CARE MASTER PRO SUITE) ── */}
      <div className="flex items-center gap-2.5 w-52 md:w-56 lg:w-60 shrink-0">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/20">
          <div className="w-4 h-4 border-2 border-white rounded-[3px] rotate-45 flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-white rounded-full" />
          </div>
        </div>
        <div className="min-w-0">
          <h1 className="text-xs font-extrabold text-white tracking-wider leading-none truncate">
            PC CARE MASTER
          </h1>
          <span className="text-[9px] text-emerald-400 font-bold tracking-widest uppercase block mt-0.5">
            PRO SUITE
          </span>
        </div>
      </div>

      {/* ── Center: Search Input (Centered) ── */}
      <div className="flex-1 max-w-md mx-auto px-4">
        <button
          onClick={onOpenSearch}
          className="w-full flex items-center justify-between gap-3 px-3.5 py-1.5 bg-[#131d33] hover:bg-[#162442] border border-slate-700/60 hover:border-emerald-500/40 rounded-xl text-left text-xs text-slate-400 transition cursor-pointer group shadow-inner"
        >
          <div className="flex items-center gap-2.5">
            <Search className="w-4 h-4 text-slate-400 group-hover:text-emerald-400 transition-colors" />
            <span className="truncate text-slate-400 group-hover:text-slate-200">
              Tìm kiếm tính năng, công cụ...
            </span>
          </div>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-mono font-bold text-slate-400 bg-slate-800 border border-slate-700 rounded-md">
            Ctrl K
          </kbd>
        </button>
      </div>

      {/* ── Right Controls ── */}
      <div className="flex items-center gap-2 md:gap-3 w-52 md:w-56 lg:w-60 justify-end shrink-0">
        {/* Real Dynamic Notifications */}

        <div className="relative">
          <Tooltip content="Thông báo hệ thống" position="bottom">
            <button
              onClick={() => {
                setShowNotifications(!showNotifications);
              }}
              className="w-8 h-8 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-emerald-400 flex items-center justify-center transition cursor-pointer border border-slate-700/50 relative"
            >
              <Bell className="w-4 h-4" />
              {alertCount > 0 ? (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-[9px] font-bold text-white rounded-full flex items-center justify-center shadow animate-pulse">
                  {alertCount}
                </span>
              ) : notifications.length > 0 ? (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full" />
              ) : null}
            </button>
          </Tooltip>

          {/* Notification Popover */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-88 bg-[#0f172a] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden z-50 animate-fade-in flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 bg-[#131d33] border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-200">Thông Báo Hệ Thống</span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                    {notifications.length}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {notifications.length > 0 && (
                    <button
                      onClick={handleClearAll}
                      className="text-[10px] text-slate-400 hover:text-slate-200 font-semibold flex items-center gap-1 transition"
                      title="Xóa tất cả thông báo"
                    >
                      <CheckCheck className="w-3 h-3" /> Đã đọc
                    </button>
                  )}
                  <button
                    onClick={() => setShowNotifications(false)}
                    className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="p-2 space-y-1.5 max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="py-8 px-4 text-center space-y-2">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-bold text-slate-200">Hệ Thống An Toàn</p>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Không có thông báo hoặc cảnh báo nào cần xử lý.
                    </p>
                  </div>
                ) : (
                  notifications.map((n) => {
                    const isDanger = n.type === 'danger';
                    const isWarn = n.type === 'warning';
                    const isSuccess = n.type === 'success';

                    return (
                      <div
                        key={n.id}
                        onClick={() => handleItemClick(n)}
                        className={`p-3 rounded-xl border text-xs transition cursor-pointer group flex items-start justify-between gap-2.5 ${
                          isDanger
                            ? 'bg-rose-500/10 hover:bg-rose-500/15 border-rose-500/30 text-rose-200'
                            : isWarn
                            ? 'bg-amber-500/10 hover:bg-amber-500/15 border-amber-500/30 text-amber-200'
                            : isSuccess
                            ? 'bg-emerald-500/10 hover:bg-emerald-500/15 border-emerald-500/20 text-emerald-200'
                            : 'bg-slate-800/50 hover:bg-slate-800 border-slate-700/50 text-slate-300'
                        }`}
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div
                            className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                              isDanger
                                ? 'bg-rose-500/20 text-rose-400'
                                : isWarn
                                ? 'bg-amber-500/20 text-amber-400'
                                : isSuccess
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-slate-700 text-cyan-400'
                            }`}
                          >
                            {isDanger || isWarn ? (
                              <ShieldAlert className="w-3.5 h-3.5" />
                            ) : isSuccess ? (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            ) : (
                              <Info className="w-3.5 h-3.5" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-bold text-xs text-white truncate">
                                {n.title}
                              </span>
                              <span className="text-[9px] text-slate-500 font-mono">
                                • {n.time}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 leading-relaxed">
                              {n.desc}
                            </p>
                            {n.actionName && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 mt-1.5 group-hover:underline">
                                {n.actionName} <ArrowRight className="w-2.5 h-2.5" />
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={(e) => handleDismissNotification(n.id, e)}
                          className="p-1 text-slate-500 hover:text-slate-300 rounded hover:bg-slate-700/50 transition shrink-0"
                          title="Đóng thông báo này"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Settings */}
        <Tooltip content="Cài đặt ứng dụng" position="bottom">
          <button
            onClick={onOpenSettings}
            className="w-8 h-8 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-emerald-400 flex items-center justify-center transition cursor-pointer border border-slate-700/50"
          >
            <Settings className="w-4 h-4" />
          </button>
        </Tooltip>
      </div>
    </header>
  );
}


