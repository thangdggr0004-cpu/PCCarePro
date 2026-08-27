import React, { useState } from 'react';
import { KeyRound, ShieldCheck, RefreshCw, Terminal, CheckCircle2, AlertTriangle, Play, Trash2, Cpu } from 'lucide-react';

export default function AdvancedActivation() {
  const [logs, setLogs] = useState<string[]>([]);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [lastStatus, setLastStatus] = useState<string | null>(null);

  const handleAction = async (mode: string, title: string) => {
    if (activeAction !== null) return;

    const confirm = window.confirm(`Bạn có chắc chắn muốn thực hiện: "${title}"?`);
    if (!confirm) return;

    setActiveAction(mode);
    setLastStatus(null);
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Bắt đầu thực thi: ${title}...`]);

    try {
      const res = await (window as any).electronAPI?.runMasAction?.(mode);
      if (res && res.success) {
        setLogs(prev => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] ${res.output || 'Đã hoàn tất lệnh thành công!'}`
        ]);
        setLastStatus('THÀNH CÔNG');
      } else {
        setLogs(prev => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] LỖI: ${res?.error || 'Không thể thực thi lệnh.'}`
        ]);
        setLastStatus('LỖI');
      }
    } catch (err: any) {
      setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] LỖI: ${err.message}`]);
      setLastStatus('LỖI');
    } finally {
      setActiveAction(null);
    }
  };


  return (
    <div className="space-y-6 animate-fade-in pb-10" id="advanced-activation-container">
      {/* Header Banner */}
      <div className="relative p-6 bg-gradient-to-r from-amber-500/15 via-[#182035] to-[#121c33] rounded-2xl border border-amber-500/30 overflow-hidden shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                🔒 TÍNH NĂNG ẨN - MỞ KHÓA BẰNG PIN 1111
              </span>
            </div>
            <h2 className="text-xl font-bold text-white mt-1">
              Tiện Ích Nâng Cao &amp; Kích Hoạt Hệ Thống (MAS Engine)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Tích hợp công cụ MAS chính chủ được Việt hóa, hỗ trợ bản quyền HWID vĩnh viễn cho Windows &amp; Ohook cho Office.
            </p>
          </div>
        </div>
      </div>

      {/* Grid Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Card 1: Windows HWID */}
        <div className="bg-[#131d33] p-5 rounded-2xl border border-slate-800 hover:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-500/5 transition-all space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">VĨNH VIỄN</span>
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <h3 className="text-sm font-bold text-white">🪟 Windows HWID Activation</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Kích hoạt bản quyền kỹ thuật số vĩnh viễn gắn liền với Mainboard máy tính (Windows 10/11). Cài lại Win tự động nhận lại bản quyền.
            </p>
          </div>
          <button
            onClick={() => handleAction('hwid', 'Kích hoạt Windows HWID Vĩnh viễn')}
            disabled={activeAction !== null}
            className="w-full py-2.5 px-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/20 active:scale-95"
          >
            {activeAction === 'hwid' ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Đang tải &amp; xử lý...
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                Kích Hoạt Windows HWID
              </>
            )}
          </button>
        </div>

        {/* Card 2: Office Ohook */}
        <div className="bg-[#131d33] p-5 rounded-2xl border border-slate-800 hover:border-blue-500/50 hover:shadow-xl hover:shadow-blue-500/5 transition-all space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-400 border border-blue-500/30">OHOOK VĨNH VIỄN</span>
              <ShieldCheck className="w-5 h-5 text-blue-400" />
            </div>
            <h3 className="text-sm font-bold text-white">🏢 Office Ohook Activation</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Kích hoạt bản quyền Office vĩnh viễn (Office 2016/2019/2021/2024 &amp; Microsoft 365). Không lo hết hạn hay bị nhả key.
            </p>
          </div>
          <button
            onClick={() => handleAction('ohook', 'Kích hoạt Office Ohook Vĩnh viễn')}
            disabled={activeAction !== null}
            className="w-full py-2.5 px-3 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-slate-950 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-blue-500/20 active:scale-95"
          >
            {activeAction === 'ohook' ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Đang tải &amp; xử lý...
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                Kích Hoạt Office Ohook
              </>
            )}
          </button>
        </div>

        {/* Card 3: Windows Server / KMS38 */}
        <div className="bg-[#131d33] p-5 rounded-2xl border border-slate-800 hover:border-purple-500/50 hover:shadow-xl hover:shadow-purple-500/5 transition-all space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-400 border border-purple-500/30">ĐẾN NĂM 2038</span>
              <Cpu className="w-5 h-5 text-purple-400" />
            </div>
            <h3 className="text-sm font-bold text-white">⚡ Windows KMS38 (Server/Enterprise)</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Kích hoạt bản quyền cho các bản Windows Server, Enterprise LTSC/LTSB kéo dài tới năm 2038 không cần máy chủ ngầm.
            </p>
          </div>
          <button
            onClick={() => handleAction('kms38', 'Kích hoạt Windows KMS38')}
            disabled={activeAction !== null}
            className="w-full py-2.5 px-3 bg-purple-500 hover:bg-purple-400 disabled:opacity-50 text-slate-950 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-purple-500/20 active:scale-95"
          >
            {activeAction === 'kms38' ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Đang tải &amp; xử lý...
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                Kích Hoạt KMS38
              </>
            )}
          </button>
        </div>

        {/* Card 4: Full MAS AIO Menu */}
        <div className="bg-[#131d33] p-5 rounded-2xl border border-slate-800 hover:border-amber-500/50 hover:shadow-xl hover:shadow-amber-500/5 transition-all space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30">MENU ĐẦY ĐỦ</span>
              <Terminal className="w-5 h-5 text-amber-400" />
            </div>
            <h3 className="text-sm font-bold text-white">💻 Menu MAS AIO Gốc (CMD)</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Khởi chạy giao diện Menu MAS AIO gốc trong cửa sổ Command Prompt để tùy chọn đầy đủ các tính năng nâng cao khác.
            </p>
          </div>
          <button
            onClick={() => handleAction('aio_menu', 'Mở Menu MAS AIO')}
            disabled={activeAction !== null}
            className="w-full py-2.5 px-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-amber-500/20 active:scale-95"
          >
            {activeAction === 'aio_menu' ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Đang tải &amp; xử lý...
              </>
            ) : (
              <>
                <Terminal className="w-3.5 h-3.5 fill-current" />
                Mở Giao Diện MAS Đầy Đủ
              </>
            )}
          </button>
        </div>

        {/* Card 5: Clear Activation */}
        <div className="bg-[#131d33] p-5 rounded-2xl border border-slate-800 hover:border-rose-500/50 hover:shadow-xl hover:shadow-rose-500/5 transition-all space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-400 border border-rose-500/30">DỌN DẸP</span>
              <Trash2 className="w-5 h-5 text-rose-400" />
            </div>
            <h3 className="text-sm font-bold text-white">🧹 Gỡ Bỏ Bản Quyền &amp; Reset Gốc</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Gỡ sạch key KMS lậu, trả lại trạng thái gốc của Microsoft Windows &amp; Office để chuẩn bị kích hoạt mới.
            </p>
          </div>
          <button
            onClick={() => handleAction('clean', 'Gỡ Bỏ Key & Reset Gốc')}
            disabled={activeAction !== null}
            className="w-full py-2.5 px-3 bg-rose-500 hover:bg-rose-400 disabled:opacity-50 text-slate-950 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-rose-500/20 active:scale-95"
          >
            {activeAction === 'clean' ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Đang tải &amp; xử lý...
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                Gỡ Bỏ Key &amp; Reset
              </>
            )}
          </button>
        </div>
      </div>

      {/* Real-time Output Log Terminal */}
      <div className="bg-[#080d1a] rounded-2xl border border-slate-800 p-5 space-y-3 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-slate-300 font-mono">Nhật Ký Thực Thi (Terminal Output)</span>
          </div>
          {lastStatus && (
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${lastStatus.includes('THÀNH CÔNG') ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}>
              Trạng thái: {lastStatus}
            </span>
          )}
        </div>

        <div className="h-48 overflow-y-auto font-mono text-[11px] space-y-1.5 text-slate-300 select-text p-3 bg-[#050811] rounded-xl border border-slate-900">
          {logs.length === 0 ? (
            <span className="text-slate-600 italic">Chọn một tính năng kích hoạt ở trên để bắt đầu thực thi...</span>
          ) : (
            logs.map((log, idx) => (
              <div key={idx} className={log.includes('LỖI') ? 'text-rose-400 font-bold' : log.includes('THÀNH CÔNG') ? 'text-emerald-400 font-bold' : 'text-slate-300'}>
                {log}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
