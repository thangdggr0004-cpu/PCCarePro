import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Monitor,
  ShieldCheck,
  Cpu,
  Trash2,
  Settings,
  Wifi,
  Printer,
  AlignLeft,
  Archive,
  Lock,
  Laptop,
  FileText,
  KeyRound,
  Shield,
  Zap,
  Activity,
  X,
  ArrowRight,
  HardDrive,
  RefreshCw,
  BatteryCharging,
  Terminal,
  FolderSync,
  Sparkles,
  Layers,
  Wrench,
  CheckCircle2,
} from 'lucide-react';
import { playTaskDoneSound } from '../../utils/audio.js';

interface CommandItem {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords?: string[];
  action: () => void | Promise<void>;
  badge?: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (section: string) => void;
}

// Remove Vietnamese accents for universal search matching
function removeVietnameseTones(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim();
}

export default function CommandPalette({
  isOpen,
  onClose,
  onNavigate,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setActionNotice(msg);
    playTaskDoneSound();
    setTimeout(() => {
      setActionNotice(null);
      onClose();
    }, 1200);
  };

  const items: CommandItem[] = [
    // ── 1. Điều Hướng Tính Năng ──────────────────────────
    {
      id: 'nav-dashboard',
      name: 'Bảng Điều Khiển (Dashboard)',
      category: 'Điều hướng',
      description: 'Trung tâm điều khiển và giám sát chỉ số phần cứng',
      icon: Monitor,
      keywords: ['trang chu', 'home', 'cpu', 'ram', 'ssd', 'giam sat'],
      action: () => onNavigate('dashboard'),
    },
    {
      id: 'nav-activation',
      name: 'Quản Lý Bản Quyền (License Manager)',
      category: 'Điều hướng',
      description: 'Quét bản quyền Windows & Office, kiểm tra key OEM BIOS, dọn sạch KMS',
      icon: ShieldCheck,
      keywords: ['ban quyen', 'license', 'key', 'office', 'windows', 'active'],
      action: () => onNavigate('activation'),
      badge: 'Hot',
    },
    {
      id: 'nav-hardware',
      name: 'Cấu Hình Chi Tiết (Hardware Info)',
      category: 'Điều hướng',
      description: 'Xem chi tiết CPU, chân RAM slots, SSD/HDD, Card đồ họa GPU, BIOS',
      icon: Cpu,
      keywords: ['phan cung', 'hardware', 'spec', 'ram slot', 'mainboard', 'card'],
      action: () => onNavigate('hardware'),
    },
    {
      id: 'nav-cleaner',
      name: 'Dọn Dẹp Rác (Junk Cleaner)',
      category: 'Điều hướng',
      description: 'Xóa Temp, Prefetch, Windows Update logs, Dump crash, Cache trình duyệt',
      icon: Trash2,
      keywords: ['don rac', 'xoa rac', 'temp', 'clean', 'giai phong o dia'],
      action: () => onNavigate('cleaner'),
      badge: 'Nhanh',
    },
    {
      id: 'nav-settings',
      name: 'Thiết Lập Windows (Windows Settings)',
      category: 'Điều hướng',
      description: 'Bật Ultimate Performance, chặn Update, chỉnh Taskbar, tối ưu SSD',
      icon: Settings,
      keywords: ['tuy bien', 'toi uu', 'ultimate performance', 'dark mode', 'regedit'],
      action: () => onNavigate('windows-settings'),
    },
    {
      id: 'nav-network',
      name: 'Mạng & Đổi DNS (Network Config)',
      category: 'Điều hướng',
      description: 'Đổi DNS Google, Cloudflare, VNPT, FPT, Viettel, Test ping tốc độ',
      icon: Wifi,
      keywords: ['mang', 'dns', 'ping', 'wifi', 'ip', 'cloudflare', 'google'],
      action: () => onNavigate('network'),
    },
    {
      id: 'nav-printer',
      name: 'Tiện Ích Máy In (Printer Utils)',
      category: 'Điều hướng',
      description: 'Khắc phục kẹt lệnh in, chia sẻ máy in qua LAN, Spooler, in test',
      icon: Printer,
      keywords: ['may in', 'printer', 'spooler', 'ket in', 'in test'],
      action: () => onNavigate('printer'),
    },
    {
      id: 'nav-office',
      name: 'Tiện Ích Office (Office Standardizer)',
      category: 'Điều hướng',
      description: 'Chuẩn hóa căn lề, font chữ theo Nghị định 30, sửa lỗi Word/Excel crash',
      icon: AlignLeft,
      keywords: ['word', 'excel', 'nghi dinh 30', 'font', 'can le', 'sua office'],
      action: () => onNavigate('standardizer'),
    },
    {
      id: 'nav-backup',
      name: 'Sao Lưu & Phục Hồi (Backup Manager)',
      category: 'Điều hướng',
      description: 'Sao lưu mật khẩu WiFi và Driver phần cứng sang XML/Folder',
      icon: Archive,
      keywords: ['sao luu', 'backup', 'wifi password', 'driver', 'restore'],
      action: () => onNavigate('backup'),
    },
    {
      id: 'nav-bitlocker',
      name: 'Quản Lý BitLocker (BitLocker Manager)',
      category: 'Điều hướng',
      description: 'Giải mã và tắt BitLocker tự động trên tất cả các ổ đĩa, sao lưu key',
      icon: Lock,
      keywords: ['bitlocker', 'khoa o', 'giai ma', 'mat ma', 'recovery key'],
      action: () => onNavigate('bitlocker'),
    },
    {
      id: 'nav-laptop',
      name: 'Kiểm Tra Laptop (Laptop Tester)',
      category: 'Điều hướng',
      description: 'Kiểm tra màn hình điểm chết, bàn phím, Webcam, Microphone, Pin',
      icon: Laptop,
      keywords: ['test laptop', 'man hinh', 'ban phim', 'keyboard', 'webcam', 'pin'],
      action: () => onNavigate('laptop-tester'),
    },
    {
      id: 'nav-report',
      name: 'Báo Cáo Nghiệm Thu KTV (Job Report)',
      category: 'Điều hướng',
      description: 'Xuất biên bản nghiệm thu sửa chữa / bảo trì máy tính chuyên nghiệp',
      icon: FileText,
      keywords: ['bao cao', 'bien ban', 'ktv', 'nghiem thu', 'in hoa don'],
      action: () => onNavigate('ktv-report'),
    },

    // ── 2. Lệnh Nhanh & Tối Ưu Hệ Thống (Thực thi thật) ───
    {
      id: 'action-flush-dns',
      name: 'Làm sạch DNS Cache (Flush DNS)',
      category: 'Lệnh nhanh',
      description: 'Xóa sạch bộ nhớ đệm phân giải tên miền để sửa lỗi không vào được web',
      icon: Zap,
      keywords: ['flush dns', 'xoa dns', 'ipconfig', 'loi mang'],
      action: async () => {
        try {
          await (window as any).electronAPI?.applyDns?.({ primary: '1.1.1.1', secondary: '1.0.0.1' });
          showToast('✅ Đã làm sạch bộ nhớ đệm DNS thành công!');
        } catch (e: any) {
          alert('Lỗi: ' + e.message);
        }
      },
      badge: 'Thực thi ngay',
    },
    {
      id: 'action-restart-explorer',
      name: 'Khởi động lại Windows Explorer',
      category: 'Lệnh nhanh',
      description: 'Restart tiến trình explorer.exe để làm mới Taskbar và giao diện',
      icon: RefreshCw,
      keywords: ['restart explorer', 'khoi dong lai taskbar', 'reload desktop'],
      action: async () => {
        try {
          await (window as any).electronAPI?.restartExplorer?.();
          showToast('✅ Đã khởi động lại Windows Explorer!');
        } catch (e: any) {
          alert('Lỗi: ' + e.message);
        }
      },
      badge: 'Thực thi ngay',
    },
    {
      id: 'action-ssd-trim',
      name: 'Tối ưu hóa ổ đĩa SSD TRIM',
      category: 'Lệnh nhanh',
      description: 'Kích hoạt lệnh Defrag/ReTrim để tăng tốc độ ghi đọc của ổ SSD',
      icon: HardDrive,
      keywords: ['trim ssd', 'toi uu o dia', 'defrag ssd', 'tang toc o cung'],
      action: async () => {
        try {
          await (window as any).electronAPI?.runSsdTrim?.();
          showToast('✅ Đã kích hoạt tiến trình TRIM SSD trong nền!');
        } catch (e: any) {
          alert('Lỗi: ' + e.message);
        }
      },
      badge: 'Thực thi ngay',
    },
    {
      id: 'action-rebuild-icons',
      name: 'Sửa lỗi icon trắng (Rebuild Icon Cache)',
      category: 'Lệnh nhanh',
      description: 'Xóa và tạo lại cơ sở dữ liệu IconCache.db của Windows',
      icon: Layers,
      keywords: ['icon trang', 'loi bieu tuong', 'icon cache', 'rebuild icons'],
      action: async () => {
        try {
          await (window as any).electronAPI?.rebuildIconCache?.();
          showToast('✅ Đã tạo lại bộ nhớ đệm Icon thành công!');
        } catch (e: any) {
          alert('Lỗi: ' + e.message);
        }
      },
      badge: 'Thực thi ngay',
    },
    {
      id: 'action-restore-point',
      name: 'Tạo Điểm Khôi Phục Hệ Thống (System Restore Point)',
      category: 'Lệnh nhanh',
      description: 'Tạo bản snapshot an toàn để phục hồi Windows khi cần',
      icon: Shield,
      keywords: ['restore point', 'diem khoi phuc', 'snapshot', 'sao luu win'],
      action: async () => {
        try {
          const res = await (window as any).electronAPI?.createSystemRestorePoint?.('PC_Care_Master_Quick');
          if (res?.success) showToast('✅ ' + res.message);
          else alert('⚠️ ' + (res?.error || 'Không thể tạo điểm khôi phục'));
        } catch (e: any) {
          alert('Lỗi: ' + e.message);
        }
      },
      badge: 'Thực thi ngay',
    },
    {
      id: 'action-clear-spooler',
      name: 'Khắc phục kẹt lệnh in (Clear Print Queue)',
      category: 'Lệnh nhanh',
      description: 'Dừng Spooler, xóa sạch các tệp kẹt trong PRINTERS và khởi động lại',
      icon: Printer,
      keywords: ['ket in', 'xoa lenh in', 'huy in', 'spooler clean'],
      action: async () => {
        try {
          await (window as any).electronAPI?.executePrinterAction?.('clear_spooler');
          showToast('✅ Đã giải phóng toàn bộ hàng đợi máy in!');
        } catch (e: any) {
          alert('Lỗi: ' + e.message);
        }
      },
      badge: 'Thực thi ngay',
    },
    {
      id: 'action-dns-google',
      name: 'Cài đặt DNS Google (8.8.8.8 / 8.8.4.4)',
      category: 'Lệnh nhanh',
      description: 'Áp dụng máy chủ phân giải tên miền tốc độ cao và ổn định của Google',
      icon: Wifi,
      keywords: ['dns google', '8.8.8.8', 'doi dns', 'tang toc web'],
      action: async () => {
        try {
          await (window as any).electronAPI?.applyDns?.({ primary: '8.8.8.8', secondary: '8.8.4.4' });
          showToast('✅ Đã chuyển sang DNS Google (8.8.8.8) thành công!');
        } catch (e: any) {
          alert('Lỗi: ' + e.message);
        }
      },
      badge: 'Thực thi ngay',
    },
    {
      id: 'action-dns-cloudflare',
      name: 'Cài đặt DNS Cloudflare (1.1.1.1 / 1.0.0.1)',
      category: 'Lệnh nhanh',
      description: 'Áp dụng máy chủ DNS bảo mật riêng tư và độ trễ thấp nhất thế giới',
      icon: Wifi,
      keywords: ['dns cloudflare', '1.1.1.1', 'bao mat', 'tang toc'],
      action: async () => {
        try {
          await (window as any).electronAPI?.applyDns?.({ primary: '1.1.1.1', secondary: '1.0.0.1' });
          showToast('✅ Đã chuyển sang DNS Cloudflare (1.1.1.1) thành công!');
        } catch (e: any) {
          alert('Lỗi: ' + e.message);
        }
      },
      badge: 'Thực thi ngay',
    },
    {
      id: 'action-battery-report',
      name: 'Xuất & Mở Báo Cáo Pin Laptop (Battery Report)',
      category: 'Lệnh nhanh',
      description: 'Tạo tài liệu HTML chi tiết dung lượng pin thiết kế và chu kỳ sạc',
      icon: BatteryCharging,
      keywords: ['battery report', 'bao cao pin', 'do chai pin', 'laptop pin'],
      action: async () => {
        try {
          await (window as any).electronAPI?.openBatteryReportHtml?.();
          showToast('✅ Đã tạo và mở báo cáo Pin thành công!');
        } catch (e: any) {
          alert('Lỗi: ' + e.message);
        }
      },
      badge: 'Thực thi ngay',
    },
    {
      id: 'action-dxdiag',
      name: 'Chạy Chẩn Đoán DirectX (DxDiag)',
      category: 'Lệnh nhanh',
      description: 'Khởi chạy công cụ chẩn đoán phần cứng, âm thanh và đồ họa DirectX',
      icon: Activity,
      keywords: ['dxdiag', 'directx', 'kiem tra card', 'do hoa'],
      action: async () => {
        try {
          await (window as any).electronAPI?.runDxDiag?.();
          showToast('✅ Đang chạy DxDiag chẩn đoán đồ họa trong nền...');
        } catch (e: any) {
          alert('Lỗi: ' + e.message);
        }
      },
      badge: 'Thực thi ngay',
    },

    // ── 3. Mở Trực Tiếp Các Công Cụ Windows Gốc ────────────
    {
      id: 'tool-taskmgr',
      name: 'Mở Trình Quản Lý Tác Vụ (Task Manager)',
      category: 'Công cụ Windows',
      description: 'Mở cửa sổ Task Manager xem chi tiết các tiến trình và tài nguyên',
      icon: Terminal,
      keywords: ['task manager', 'taskmgr', 'tien trinh', 'process'],
      action: async () => {
        try {
          await (window as any).electronAPI?.openSystemTool?.('taskmgr');
          showToast('✅ Đã mở Task Manager!');
        } catch (e: any) {
          alert('Lỗi: ' + e.message);
        }
      },
      badge: 'Mở app',
    },
    {
      id: 'tool-devmgmt',
      name: 'Mở Quản Lý Thiết Bị (Device Manager)',
      category: 'Công cụ Windows',
      description: 'Mở Device Manager kiểm tra driver, cổng COM và phần cứng',
      icon: Wrench,
      keywords: ['device manager', 'devmgmt', 'driver', 'thiet bi', 'port'],
      action: async () => {
        try {
          await (window as any).electronAPI?.openSystemTool?.('devmgmt');
          showToast('✅ Đã mở Device Manager!');
        } catch (e: any) {
          alert('Lỗi: ' + e.message);
        }
      },
      badge: 'Mở app',
    },
    {
      id: 'tool-services',
      name: 'Mở Bảng Quản Lý Dịch Vụ (Services.msc)',
      category: 'Công cụ Windows',
      description: 'Mở Services quản lý bật/tắt các tiến trình dịch vụ chạy ngầm',
      icon: Settings,
      keywords: ['services', 'dich vu', 'services.msc', 'background service'],
      action: async () => {
        try {
          await (window as any).electronAPI?.openSystemTool?.('services');
          showToast('✅ Đã mở Services.msc!');
        } catch (e: any) {
          alert('Lỗi: ' + e.message);
        }
      },
      badge: 'Mở app',
    },
    {
      id: 'tool-regedit',
      name: 'Mở Trình Chỉnh Sửa Registry (Regedit)',
      category: 'Công cụ Windows',
      description: 'Mở Registry Editor để can thiệp các khóa cài đặt hệ thống',
      icon: Lock,
      keywords: ['regedit', 'registry', 'khoa registry'],
      action: async () => {
        try {
          await (window as any).electronAPI?.openSystemTool?.('regedit');
          showToast('✅ Đã mở Registry Editor!');
        } catch (e: any) {
          alert('Lỗi: ' + e.message);
        }
      },
      badge: 'Mở app',
    },
    {
      id: 'tool-control',
      name: 'Mở Bảng Điều Khiển Cổ Điển (Control Panel)',
      category: 'Công cụ Windows',
      description: 'Mở Control Panel quản lý hệ điều hành và thiết bị ngoại vi',
      icon: Settings,
      keywords: ['control panel', 'bang dieu khien', 'control'],
      action: async () => {
        try {
          await (window as any).electronAPI?.openSystemTool?.('control');
          showToast('✅ Đã mở Control Panel!');
        } catch (e: any) {
          alert('Lỗi: ' + e.message);
        }
      },
      badge: 'Mở app',
    },
    {
      id: 'tool-ncpa',
      name: 'Mở Cấu Hình Card Mạng (ncpa.cpl)',
      category: 'Công cụ Windows',
      description: 'Mở cửa sổ Network Connections quản lý adapter Ethernet và WiFi',
      icon: Wifi,
      keywords: ['ncpa', 'card mang', 'adapter', 'ethernet', 'lan'],
      action: async () => {
        try {
          await (window as any).electronAPI?.openSystemTool?.('ncpa');
          showToast('✅ Đã mở Network Connections!');
        } catch (e: any) {
          alert('Lỗi: ' + e.message);
        }
      },
      badge: 'Mở app',
    },
    {
      id: 'tool-appwiz',
      name: 'Mở Gỡ Cài Đặt Ứng Dụng (Programs and Features)',
      category: 'Công cụ Windows',
      description: 'Mở cửa sổ appwiz.cpl để gỡ cài đặt các phần mềm trong máy',
      icon: Trash2,
      keywords: ['appwiz', 'go phan mem', 'uninstall', 'programs and features'],
      action: async () => {
        try {
          await (window as any).electronAPI?.openSystemTool?.('appwiz');
          showToast('✅ Đã mở Programs and Features!');
        } catch (e: any) {
          alert('Lỗi: ' + e.message);
        }
      },
      badge: 'Mở app',
    },
    {
      id: 'tool-resmon',
      name: 'Mở Trình Giám Sát Tài Nguyên (Resource Monitor)',
      category: 'Công cụ Windows',
      description: 'Xem chi tiết mức độ chiếm dụng CPU, Disk I/O, Network của từng file',
      icon: Activity,
      keywords: ['resmon', 'resource monitor', 'giam sat tai nguyen', 'disk io'],
      action: async () => {
        try {
          await (window as any).electronAPI?.openSystemTool?.('resmon');
          showToast('✅ Đã mở Resource Monitor!');
        } catch (e: any) {
          alert('Lỗi: ' + e.message);
        }
      },
      badge: 'Mở app',
    },
  ];

  // Universal Filter: Supports Vietnamese unaccented search + keywords + categories
  const filteredItems = items.filter((item) => {
    const rawQ = query.toLowerCase().trim();
    if (!rawQ) return true;
    const cleanQ = removeVietnameseTones(rawQ);

    const nameNorm = removeVietnameseTones(item.name);
    const descNorm = removeVietnameseTones(item.description);
    const catNorm = removeVietnameseTones(item.category);
    const kwNorm = (item.keywords || []).map(removeVietnameseTones).join(' ');

    return (
      nameNorm.includes(cleanQ) ||
      descNorm.includes(cleanQ) ||
      catNorm.includes(cleanQ) ||
      kwNorm.includes(cleanQ)
    );
  });

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setActionNotice(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].action();
          if (filteredItems[selectedIndex].category === 'Điều hướng') {
            onClose();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-2xl bg-[#0f172a] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-800 bg-[#131d33]">
          <Search className="w-5 h-5 text-emerald-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Tìm tính năng, dọn rác, đổi DNS, mở Taskmgr, sửa Office... (ESC đóng)"
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Toast Feedback Banner */}
        {actionNotice && (
          <div className="bg-emerald-500/20 border-b border-emerald-500/30 px-4 py-2 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 animate-bounce" />
            <span>{actionNotice}</span>
          </div>
        )}

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              Không tìm thấy lệnh hoặc công cụ nào phù hợp với "{query}"
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    item.action();
                    if (item.category === 'Điều hướng') {
                      onClose();
                    }
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-left cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-emerald-500/15 border border-emerald-500/30 text-white'
                      : 'hover:bg-slate-800/60 text-slate-300 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/30'
                          : 'bg-slate-800 text-emerald-400 border border-slate-700'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold truncate">
                          {item.name}
                        </span>
                        {item.badge && (
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                            item.badge === 'Thực thi ngay'
                              ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                              : item.badge === 'Mở app'
                              ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                              : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          }`}>
                            {item.badge}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-500">
                          • {item.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  <ArrowRight
                    className={`w-4 h-4 shrink-0 transition-opacity ${
                      isSelected ? 'text-emerald-400 opacity-100' : 'opacity-0'
                    }`}
                  />
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2.5 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 font-mono">
          <div className="flex items-center gap-3">
            <span>↑↓ Di chuyển</span>
            <span>↵ Chọn &amp; Thực thi</span>
            <span>ESC Đóng</span>
          </div>
          <span className="text-emerald-400 font-semibold">PC Care Master Pro</span>
        </div>
      </div>
    </div>
  );
}

