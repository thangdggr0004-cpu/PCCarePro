import React, { useState, useEffect } from 'react';
import { Settings, X, Bell, Cpu, RefreshCw, Shield, Save, Check } from 'lucide-react';
import { playTaskDoneSound } from '../../utils/audio.js';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [config, setConfig] = useState(() => {
    const saved = localStorage.getItem('thienphat_app_config');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      refreshInterval: 3,
      cpuTempAlert: true,
      cpuTempThreshold: 85,
      autoRamClean: false,
      enableSounds: true,
    };
  });

  // Apply saved metrics interval to Tauri backend on component mount
  useEffect(() => {
    if (typeof (window as any).electronAPI?.setMetricsInterval === 'function') {
      (window as any).electronAPI.setMetricsInterval(config.refreshInterval || 3);
    }
  }, []);

  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = () => {
    localStorage.setItem('thienphat_app_config', JSON.stringify(config));
    // Apply interval directly to Tauri Rust backend
    if (typeof (window as any).electronAPI?.setMetricsInterval === 'function') {
      (window as any).electronAPI.setMetricsInterval(config.refreshInterval || 3);
    }
    window.dispatchEvent(new CustomEvent('app-config-changed', { detail: config }));
    
    if (config.enableSounds) {
      playTaskDoneSound();
    }

    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 600);
  };


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-[#0f172a] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-[#131d33]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Cấu Hình Ứng Dụng</h3>
              <p className="text-[11px] text-slate-400">Tùy biến giám sát & hệ thống</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          {/* Refresh interval */}
          <div className="space-y-2">
            <label className="text-slate-300 font-semibold flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
              Tần suất làm mới dữ liệu phần cứng
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 5].map((sec) => (
                <button
                  key={sec}
                  onClick={() => setConfig({ ...config, refreshInterval: sec })}
                  className={`py-2 px-3 rounded-lg border font-mono font-bold text-center transition ${
                    config.refreshInterval === sec
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                      : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  {sec}s
                </button>
              ))}
            </div>
          </div>

          {/* CPU Alert Threshold */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-slate-300 font-semibold flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5 text-amber-400" />
                Cảnh báo nhiệt độ CPU cao
              </label>
              <input
                type="checkbox"
                checked={config.cpuTempAlert}
                onChange={(e) => setConfig({ ...config, cpuTempAlert: e.target.checked })}
                className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
              />
            </div>
            {config.cpuTempAlert && (
              <div className="flex items-center justify-between bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-400 text-[11px]">Ngưỡng cảnh báo:</span>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="70"
                    max="95"
                    step="5"
                    value={config.cpuTempThreshold}
                    onChange={(e) =>
                      setConfig({ ...config, cpuTempThreshold: Number(e.target.value) })
                    }
                    className="w-24 accent-amber-500"
                  />
                  <span className="font-mono font-bold text-amber-400">{config.cpuTempThreshold}°C</span>
                </div>
              </div>
            )}
          </div>

          {/* Sound & Notifications */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-slate-300 font-semibold flex items-center gap-2">
                <Bell className="w-3.5 h-3.5 text-cyan-400" />
                Thông báo âm thanh khi hoàn thành tác vụ
              </label>
              <input
                type="checkbox"
                checked={config.enableSounds ?? true}
                onChange={(e) => setConfig({ ...config, enableSounds: e.target.checked })}
                className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 text-xs font-semibold hover:bg-slate-800 transition"
          >
            Hủy
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-md shadow-emerald-600/30"
          >
            {savedSuccess ? (
              <>
                <Check className="w-3.5 h-3.5" /> Đã lưu
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" /> Lưu cài đặt
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
