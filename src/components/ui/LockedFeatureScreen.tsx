import React, { useState } from 'react';
import { Lock, Key, Clipboard, CheckCircle2, AlertTriangle, ShieldCheck, ArrowLeft, PhoneCall } from 'lucide-react';
import { useAppLicense } from '../../context/AppLicenseContext.js';

interface LockedFeatureScreenProps {
  featureName?: string;
  onNavigateHome?: () => void;
}

export default function LockedFeatureScreen({ featureName, onNavigateHome }: LockedFeatureScreenProps) {
  const { refreshLicense } = useAppLicense();
  const [cdKey, setCdKey] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; success: boolean } | null>(null);
  const [showFileImport, setShowFileImport] = useState(false);

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setCdKey(text.trim());
        setStatusMsg(null);
      }
    } catch (e) {
      // Clipboard permissions or not focused
    }
  };

  const handleActivate = async (keyToUse?: string) => {
    const targetKey = (keyToUse || cdKey).trim();
    if (!targetKey) {
      setStatusMsg({ text: 'Vui lòng nhập hoặc dán mã CDKey kích hoạt!', success: false });
      return;
    }

    setIsProcessing(true);
    setStatusMsg(null);

    try {
      const res = await (window as any).electronAPI?.importAppLicense?.(targetKey);
      if (res && res.is_licensed) {
        setStatusMsg({
          text: `Kích hoạt thành công vĩnh viễn cho: ${res.customer || 'Quý khách'}! Đang mở khóa...`,
          success: true,
        });
        await refreshLicense();
      } else {
        setStatusMsg({
          text: res?.error || 'Mã CDKey không hợp lệ hoặc chữ ký số không chính xác.',
          success: false,
        });
      }
    } catch (err: any) {
      setStatusMsg({
        text: err?.message || 'Lỗi khi kích hoạt bản quyền.',
        success: false,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        handleActivate(content);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="w-full min-h-[520px] flex items-center justify-center p-4 select-none animate-fade-in">
      <div className="max-w-xl w-full bg-[#101728] border border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Lock Icon */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
          <Lock className="w-8 h-8" />
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-widest text-amber-400/90 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
            Chức Năng Yêu Cầu Bản Quyền
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-2">
            Mở Khóa {featureName || 'Tính Năng Này'}
          </h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            Bạn đang ở chế độ chẩn đoán dùng thử. Để sử dụng đầy đủ các công cụ can thiệp hệ thống và tối ưu chuyên sâu, vui lòng nhập mã CDKey kích hoạt vĩnh viễn.
          </p>
        </div>

        {/* Feedback Alert */}
        {statusMsg && (
          <div className={`p-3.5 rounded-2xl border text-xs flex items-center justify-center gap-2 animate-fade-in ${
            statusMsg.success
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
          }`}>
            {statusMsg.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            <span className="font-semibold">{statusMsg.text}</span>
          </div>
        )}

        {/* CDKey Activation Box */}
        <div className="bg-[#0b101e] border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3.5 text-left">
          <label className="block text-xs font-bold text-slate-300 flex items-center gap-2">
            <Key className="w-3.5 h-3.5 text-amber-400" />
            Nhập Mã CDKey Kích Hoạt (TPPRO-...)
          </label>

          <div className="relative flex items-center">
            <input
              type="text"
              placeholder="Dán mã CDKey tại đây (Ví dụ: TPPRO-eyJjIjoi...)"
              value={cdKey}
              onChange={(e) => setCdKey(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleActivate();
              }}
              disabled={isProcessing}
              className="w-full bg-[#131d33] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono placeholder:text-slate-500 focus:outline-none focus:border-amber-400 pr-24"
            />
            <button
              onClick={handlePasteClipboard}
              disabled={isProcessing}
              type="button"
              className="absolute right-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer"
              title="Dán từ Clipboard"
            >
              <Clipboard className="w-3 h-3 text-amber-400" />
              Dán mã
            </button>
          </div>

          <button
            onClick={() => handleActivate()}
            disabled={isProcessing || !cdKey.trim()}
            className="w-full py-3 bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950 font-black rounded-xl text-xs transition-all shadow-lg active:scale-98 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <span>Đang kiểm tra chữ ký số...</span>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>KÍCH HOẠT VĨNH VIỄN NGAY</span>
              </>
            )}
          </button>
        </div>

        {/* Support & Actions Footer */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 border-t border-slate-800/80">
          {onNavigateHome ? (
            <button
              onClick={onNavigateHome}
              className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Về Trang Chủ Chẩn Đoán</span>
            </button>
          ) : <div />}

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFileImport(!showFileImport)}
              className="text-[11px] text-slate-500 hover:text-slate-300 underline cursor-pointer"
            >
              {showFileImport ? 'Ẩn chọn file .lic' : 'Nhập file .lic cũ'}
            </button>

            <span className="text-slate-700">|</span>

            <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
              <PhoneCall className="w-3 h-3 text-emerald-400" />
              Zalo: <strong className="text-emerald-400">098.3388.949</strong>
            </span>
          </div>
        </div>

        {showFileImport && (
          <div className="p-3 bg-[#0c1220] border border-slate-800 rounded-xl text-left space-y-2 animate-fade-in">
            <span className="text-[11px] text-slate-400 block font-semibold">Chọn file license (.lic) từ máy:</span>
            <input
              type="file"
              accept=".lic,application/json"
              onChange={handleFileSelect}
              className="text-xs text-slate-400 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-300 hover:file:bg-slate-700 file:cursor-pointer"
            />
          </div>
        )}
      </div>
    </div>
  );
}
