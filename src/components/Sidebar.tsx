import React, { useState } from 'react';
import {
  Cpu,
  ShieldAlert,
  Trash2,
  Wifi,
  AlignLeft,
  LayoutDashboard,
  Archive,
  Printer,
  Settings,
  Lock,
  Laptop,
  FileText,
  KeyRound,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Layers,
} from 'lucide-react';
import Tooltip from './ui/Tooltip.js';

interface SidebarProps {
  activeSection: string;
  setActiveSection: (section: string) => void;
  isUnlocked?: boolean;
}


interface MenuItem {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const overviewItems: MenuItem[] = [
  { id: 'dashboard', name: 'Trang chủ', description: 'Trung tâm điều khiển', icon: LayoutDashboard },
];

const activationItems: MenuItem[] = [
  { id: 'activation', name: 'Quản lý Bản quyền', description: 'Phát hiện & Dọn dẹp key', icon: ShieldAlert },
];

const systemItems: MenuItem[] = [
  { id: 'hardware', name: 'Cấu hình Chi tiết', description: 'CPU, RAM, Ổ cứng', icon: Cpu },
  { id: 'cleaner', name: 'Dọn dẹp Rác', description: 'Giải phóng bộ nhớ', icon: Trash2 },
  { id: 'windows-settings', name: 'Thiết lập Windows', description: 'Tối ưu & Tùy biến', icon: Settings },
  { id: 'ktv-report', name: 'Báo cáo KTV', description: 'Biên bản nghiệm thu', icon: FileText },
];

const baseUtilityItems: MenuItem[] = [
  { id: 'network', name: 'Mạng & DNS', description: 'Đổi DNS, Chẩn đoán', icon: Wifi },
  { id: 'printer', name: 'Tiện ích Máy In', description: 'Sửa lỗi, in Xóa hàng đợi', icon: Printer },
  { id: 'standardizer', name: 'Tiện ích Office', description: 'Chuẩn hóa & Sửa lỗi', icon: AlignLeft },
  { id: 'backup', name: 'Sao Lưu', description: 'WiFi & Driver backup', icon: Archive },
  { id: 'bitlocker', name: 'Tắt BitLocker', description: 'Giải mã ổ cứng tự động', icon: Lock },
  { id: 'laptop-tester', name: 'Kiểm Tra Laptop', description: 'Test Màn, Phím, Mic, Cam', icon: Laptop },
];

function Sidebar({
  activeSection,
  setActiveSection,
  isUnlocked,
}: SidebarProps) {

  const [collapsed, setCollapsed] = useState(false);

  const utilityItems = isUnlocked
    ? [
        ...baseUtilityItems,
        {
          id: 'advanced-activation',
          name: 'Tiện Ích Nâng Cao',
          description: 'MAS AIO Activator 🔓',
          icon: KeyRound,
        },
      ]
    : baseUtilityItems;

  const renderItem = (item: MenuItem) => {
    const isActive = activeSection === item.id;
    const Icon = item.icon;

    const buttonContent = (
      <button
        key={item.id}
        onClick={() => setActiveSection(item.id)}
        className={`w-full flex items-center ${
          collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2'
        } rounded-xl text-left transition-all duration-150 cursor-pointer relative group ${
          isActive
            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm shadow-emerald-500/10'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
        }`}
      >
        <span
          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
            isActive
              ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm shadow-emerald-500/40'
              : 'bg-slate-800/80 text-slate-400 group-hover:text-emerald-400 group-hover:bg-slate-800'
          }`}
        >
          <Icon className="h-4 w-4" />
        </span>

        {!collapsed && (
          <>
            <div className="flex-1 min-w-0">
              <span className={`text-xs font-semibold block truncate ${isActive ? 'text-white' : ''}`}>
                {item.name}
              </span>
              <span className={`text-[10px] block truncate ${isActive ? 'text-emerald-400/80' : 'text-slate-500'}`}>
                {item.description}
              </span>
            </div>

            {isActive && (
              <ChevronRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            )}
          </>
        )}
      </button>
    );

    if (collapsed) {
      return (
        <div key={item.id}>
          <Tooltip content={`${item.name} - ${item.description}`} position="right">
            {buttonContent}
          </Tooltip>
        </div>
      );
    }

    return buttonContent;
  };

  return (
    <aside
      className={`${
        collapsed ? 'w-16' : 'w-60 lg:w-64'
      } bg-[#0b101d] border-r border-slate-800/80 flex flex-col justify-between shrink-0 h-full transition-all duration-200 select-none z-20`}
      id="sidebar-container"
    >
      {/* Sidebar Collapse Toggle Header */}
      <div className={`px-3 py-2 border-b border-slate-800/60 flex items-center ${collapsed ? 'justify-center' : 'justify-end'}`}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800/80 transition cursor-pointer"
          title={collapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
        >
          {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>


      {/* Navigation Groups */}
      <nav className="flex-1 px-2.5 py-3 space-y-3.5 overflow-y-auto overflow-x-hidden">
        {/* TỔNG QUAN */}
        <div>
          {!collapsed && (
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1 px-2">
              Tổng Quan
            </div>
          )}
          <div className="space-y-1">
            {overviewItems.map(renderItem)}
          </div>
        </div>

        {/* KÍCH HOẠT */}
        <div>
          {!collapsed && (
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1 px-2">
              Kích Hoạt &amp; Bản Quyền
            </div>
          )}
          <div className="space-y-1">
            {activationItems.map(renderItem)}
          </div>
        </div>

        {/* HỆ THỐNG */}
        <div>
          {!collapsed && (
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1 px-2">
              Hệ Thống &amp; Tối Ưu
            </div>
          )}
          <div className="space-y-1">
            {systemItems.map(renderItem)}
          </div>
        </div>

        {/* TIỆN ÍCH */}
        <div>
          {!collapsed && (
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1 px-2">
              Tiện Ích Mạng &amp; Khác
            </div>
          )}
          <div className="space-y-1">
            {utilityItems.map(renderItem)}
          </div>
        </div>
      </nav>
    </aside>

  );
}

export default React.memo(Sidebar);

