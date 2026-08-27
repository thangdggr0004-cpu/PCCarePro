import React, { useState } from 'react';
import { Spinner } from './Spinner.js';
import { Wifi, HardDrive, Download, Upload, RefreshCw, CheckCircle, AlertTriangle, Search, ShieldCheck } from 'lucide-react';

interface WifiProfile {
  name: string;
  password: string;
  auth: string;
}

interface Message {
  type: 'success' | 'error' | 'info';
  text: string;
}

export default function BackupManager() {
  const [wifiProfiles, setWifiProfiles] = useState<WifiProfile[]>([]);
  const [wifiScanned, setWifiScanned] = useState(false);
  const [wifiLoading, setWifiLoading] = useState(false);
  const [wifiExporting, setWifiExporting] = useState(false);
  const [wifiRestoring, setWifiRestoring] = useState(false);
  const [driverExporting, setDriverExporting] = useState(false);
  const [driverRestoring, setDriverRestoring] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  const showMessage = (type: Message['type'], text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 8000);
  };

  // WiFi: Scan saved profiles
  const handleScanWifi = async () => {
    setWifiLoading(true);
    setMessage(null);
    try {
      const result: any = await (window as any).electronAPI.listWifiProfiles();
      const profiles = Array.isArray(result) ? result : (result?.profiles ?? result?.data?.profiles ?? result?.data ?? []);
      if (Array.isArray(profiles) && profiles.length > 0) {
        setWifiProfiles(profiles);
        setWifiScanned(true);
        showMessage('info', `Tìm thấy ${profiles.length} mạng WiFi đã lưu.`);
      } else {
        showMessage('error', 'Không tìm thấy mạng WiFi nào.');
      }
    } catch (err: any) {
      showMessage('error', 'Lỗi quét WiFi: ' + (err?.message || err));
    } finally {
      setWifiLoading(false);
    }
  };

  // WiFi: Export to folder
  const handleExportWifi = async () => {
    setWifiExporting(true);
    setMessage(null);
    try {
      const result = await (window as any).electronAPI.exportWifi();
      if (result && result.success) {
        showMessage('success', `Đã sao lưu WiFi thành công (${result.count || ''} mạng) vào: ${result.path}`);
      } else {
        showMessage('error', result?.error || 'Không thể sao lưu WiFi');
      }
    } catch (err: any) {
      showMessage('error', 'Lỗi sao lưu WiFi: ' + (err?.message || err));
    } finally {
      setWifiExporting(false);
    }
  };

  // WiFi: Restore from folder
  const handleRestoreWifi = async () => {
    setWifiRestoring(true);
    setMessage(null);
    try {
      const result = await (window as any).electronAPI.restoreWifi();
      if (result && result.success) {
        showMessage('success', `Đã phục hồi ${result.count || ''} mạng WiFi thành công!`);
        handleScanWifi();
      } else {
        showMessage('error', result?.error || 'Không thể phục hồi WiFi');
      }
    } catch (err: any) {
      showMessage('error', 'Lỗi phục hồi WiFi: ' + (err?.message || err));
    } finally {
      setWifiRestoring(false);
    }
  };

  // Driver: Export
  const handleExportDrivers = async () => {
    setDriverExporting(true);
    setMessage(null);
    showMessage('info', 'Đang trích xuất toàn bộ Driver OEM, tiến trình chạy ngầm...');
    try {
      const result = await (window as any).electronAPI.exportDrivers();
      if (result && result.success) {
        showMessage('success', `Đang tiến hành sao lưu Driver vào: ${result.path}`);
      } else {
        showMessage('error', result?.error || 'Không thể sao lưu driver');
      }
    } catch (err: any) {
      showMessage('error', 'Lỗi sao lưu driver: ' + (err?.message || err));
    } finally {
      setDriverExporting(false);
    }
  };

  // Driver: Restore
  const handleRestoreDrivers = async () => {
    setDriverRestoring(true);
    setMessage(null);
    showMessage('info', 'Đang tự động nạp & cài đặt lại toàn bộ Driver (.inf) vào Windows...');
    try {
      const result = await (window as any).electronAPI.restoreDrivers();
      if (result && result.success) {
        showMessage('success', 'Đã cài đặt phục hồi Driver thành công! Khuyến nghị khởi động lại máy.');
      } else {
        showMessage('error', result?.error || 'Không thể phục hồi driver');
      }
    } catch (err: any) {
      showMessage('error', 'Lỗi phục hồi driver: ' + (err?.message || err));
    } finally {
      setDriverRestoring(false);
    }
  };



  return (
    <div className="space-y-6" id="backup-container">
      {/* Header */}
      <div className="relative p-6 bg-gradient-to-r from-[#121c33] to-[#0f172a] rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -mr-12 -mt-12 pointer-events-none"></div>
        <div className="relative z-10 space-y-2">
          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-3 py-1 rounded-full border border-emerald-500/30 uppercase tracking-widest inline-block">
            Sao lưu &amp; Phục hồi
          </span>
          <h2 className="text-xl font-extrabold text-white">Sao Lưu WiFi &amp; Driver</h2>
          <p className="text-xs text-slate-400 leading-relaxed max-w-xl">
            Sao lưu lại các mạng WiFi đã lưu (kèm mật khẩu) và driver bên thứ 3 để phục hồi nhanh chóng sau khi cài lại Windows.
          </p>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-3.5 rounded-xl border text-xs flex items-center gap-2.5 shadow-md animate-fade-in ${
          message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
          message.type === 'error' ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' :
          'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
        }`}>
          {message.type === 'success' ? <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" /> :
           message.type === 'error' ? <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" /> :
           <RefreshCw className="h-4 w-4 shrink-0 text-cyan-400 animate-spin" />}
          <span className="font-medium">{message.text}</span>
        </div>
      )}

      {/* WiFi Backup Section */}
      <div className="bg-[#131d33] rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
        <div className="p-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30 shadow-sm">
              <Wifi className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-white">Sao Lưu WiFi</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Xuất tất cả mạng WiFi đã lưu (kèm mật khẩu) thành file để phục hồi sau khi cài lại máy</p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleScanWifi}
              disabled={wifiLoading}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#18233c] hover:bg-[#202f50] text-slate-200 rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border border-slate-700/80 active:scale-95 shadow-sm"
            >
              {wifiLoading ? <Spinner /> : <Search className="h-3.5 w-3.5 text-cyan-400" />}
              {wifiLoading ? 'Đang quét...' : 'Quét WiFi đã lưu'}
            </button>
            <button
              onClick={handleExportWifi}
              disabled={wifiExporting}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20 active:scale-95"
            >
              {wifiExporting ? <Spinner /> : <Download className="h-3.5 w-3.5" />}
              {wifiExporting ? 'Đang sao lưu...' : 'Sao lưu WiFi'}
            </button>
            <button
              onClick={handleRestoreWifi}
              disabled={wifiRestoring}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#18233c] hover:bg-[#202f50] text-emerald-400 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border border-emerald-500/40 active:scale-95 shadow-sm"
            >
              {wifiRestoring ? <Spinner /> : <Upload className="h-3.5 w-3.5" />}
              {wifiRestoring ? 'Đang phục hồi...' : 'Phục hồi WiFi'}
            </button>
          </div>

          {/* WiFi Profiles Table */}
          {wifiScanned && (
            <div className="border border-slate-800 rounded-xl overflow-hidden bg-[#0e1626]">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#090e1a] border-b border-slate-800">
                    <th className="text-left px-3.5 py-2.5 font-bold text-slate-400 w-12">STT</th>
                    <th className="text-left px-3.5 py-2.5 font-bold text-slate-300">Tên WiFi</th>
                    <th className="text-left px-3.5 py-2.5 font-bold text-slate-300">Mật khẩu</th>
                    <th className="text-left px-3.5 py-2.5 font-bold text-slate-300 w-32">Bảo mật</th>
                  </tr>
                </thead>
                <tbody>
                  {wifiProfiles.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3.5 py-6 text-center text-slate-500">
                        Không tìm thấy mạng WiFi nào đã lưu.
                      </td>
                    </tr>
                  ) : (
                    wifiProfiles.map((p, idx) => (
                      <tr key={idx} className={`border-b border-slate-800/60 ${idx % 2 === 1 ? 'bg-[#101728]/50' : ''} hover:bg-emerald-500/5 transition-colors`}>
                        <td className="px-3.5 py-2 text-slate-500 font-mono">{idx + 1}</td>
                        <td className="px-3.5 py-2 font-semibold text-slate-200">{p.name}</td>
                        <td className="px-3.5 py-2 font-mono text-emerald-400">{p.password || <span className="text-slate-500 italic">Không có</span>}</td>
                        <td className="px-3.5 py-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            p.auth?.includes('WPA') ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                            p.auth?.includes('Open') ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                            'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}>
                            {p.auth || 'N/A'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Driver Backup Section */}
      <div className="bg-[#131d33] rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
        <div className="p-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-500/20 text-cyan-400 rounded-xl border border-cyan-500/30 shadow-sm">
              <HardDrive className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-white">Sao Lưu Driver</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Xuất tất cả driver bên thứ 3 để cài lại sau khi format máy. Hữu ích khi không có mạng.</p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Warning */}
          <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
            <div className="space-y-1">
              <span className="font-bold block text-amber-300">Lưu ý:</span>
              <span className="text-[11px] text-slate-300 leading-relaxed block">Quá trình sao lưu driver có thể mất vài phút và file backup có thể nặng vài trăm MB tùy số lượng driver đã cài. Windows 10/11 thường tự tải driver qua Windows Update — tính năng này hữu ích nhất khi máy không có mạng sau khi cài lại.</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleExportDrivers}
              disabled={driverExporting}
              className="flex items-center gap-2 px-4 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/20 active:scale-95"
            >
              {driverExporting ? <Spinner /> : <Download className="h-3.5 w-3.5" />}
              {driverExporting ? 'Đang sao lưu driver...' : 'Sao lưu Driver'}
            </button>
            <button
              onClick={handleRestoreDrivers}
              disabled={driverRestoring}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#18233c] hover:bg-[#202f50] text-cyan-400 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border border-cyan-500/40 active:scale-95 shadow-sm"
            >
              {driverRestoring ? <Spinner /> : <Upload className="h-3.5 w-3.5" />}
              {driverRestoring ? 'Đang phục hồi (Admin)...' : 'Phục hồi Driver (Admin)'}
            </button>
          </div>

          {/* Info about driver restore */}
          <div className="p-3 bg-[#0e1626] border border-slate-800 rounded-xl text-[11px] text-slate-400 flex items-start gap-2.5">
            <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-emerald-400" />
            <span>Phục hồi driver yêu cầu quyền <strong className="text-slate-200">Administrator</strong>. Sau khi phục hồi, khuyến nghị khởi động lại máy tính để driver hoạt động đầy đủ.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
