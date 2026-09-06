import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert, Award, FileCheck, Upload, Trash2, X, CheckCircle2, AlertTriangle, Key, ExternalLink, Clipboard, PhoneCall } from 'lucide-react';

export interface AppLicenseData {
  is_licensed: boolean;
  customer?: string | null;
  issued_at?: string | null;
  license_id?: string | null;
  license_type?: string | null;
  license_path?: string | null;
  error?: string | null;
}

interface AppLicenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  license: AppLicenseData;
  onLicenseUpdated: () => Promise<void>;
}

export default function AppLicenseModal({
  isOpen,
  onClose,
  license,
  onLicenseUpdated,
}: AppLicenseModalProps) {
  const [licenseText, setLicenseText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; success: boolean } | null>(null);
  const [showFileImport, setShowFileImport] = useState(false);

  if (!isOpen) return null;

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setLicenseText(text.trim());
        setStatusMsg(null);
      }
    } catch (e) {
      // Ignore
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setLicenseText(content.trim());
        handleActivateWithContent(content.trim());
      }
    };
    reader.readAsText(file);
  };

  const handleActivateWithContent = async (contentToActivate?: string) => {
    const text = (contentToActivate || licenseText).trim();
    if (!text) {
      setStatusMsg({ text: 'Vui lòng nhập hoặc dán mã CDKey kích hoạt (TPPRO-...)!', success: false });
      return;
    }

    setIsProcessing(true);
    setStatusMsg(null);

    try {
      const res = await (window as any).electronAPI?.importAppLicense?.(text);
      if (res && res.is_licensed) {
        setStatusMsg({
          text: `Kích hoạt thành công vĩnh viễn cho: ${res.customer || 'Quý khách'}!`,
          success: true,
        });
        await onLicenseUpdated();
        setTimeout(() => {
          onClose();
        }, 1800);
      } else {
        setStatusMsg({
          text: res?.error || 'Mã CDKey không hợp lệ hoặc chữ ký số không chính xác.',
          success: false,
        });
      }
    } catch (err: any) {
      setStatusMsg({
        text: err?.message || 'Lỗi khi xác thực chữ ký bản quyền.',
        success: false,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveLicense = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn gỡ bỏ bản quyền khỏi máy tính này không?')) {
      return;
    }

    setIsProcessing(true);
    try {
      await (window as any).electronAPI?.removeAppLicense?.();
      setStatusMsg({ text: 'Đã gỡ bỏ bản quyền trên máy thành công.', success: true });
      await onLicenseUpdated();
    } catch (e: any) {
      setStatusMsg({ text: 'Lỗi gỡ bỏ: ' + e.message, success: false });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#101728] rounded-2xl border border-slate-800 p-6 max-w-lg w-full shadow-2xl space-y-5 text-slate-200 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-800/80 pb-4">
          <div className={`p-3 rounded-2xl border ${
            license.is_licensed
              ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
              : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
          }`}>
            {license.is_licensed ? <Award className="w-6 h-6" /> : <Key className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="font-bold text-white text-base">
              {license.is_licensed ? 'Bản Quyền PCCareMasterPro' : 'Kích Hoạt Bản Quyền Ứng Dụng'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Hệ thống cấp phép bản quyền offline vĩnh viễn (Chữ ký số Ed25519)
            </p>
          </div>
        </div>

        {/* Status Box */}
        {license.is_licensed ? (
          <div className="p-4 bg-gradient-to-br from-emerald-950/40 to-slate-900 border border-emerald-500/40 rounded-xl space-y-2.5">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Đã kích hoạt cho: <strong className="text-white underline decoration-emerald-400">{license.customer}</strong></span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 pt-1">
              <div><span className="text-slate-500">Mã bản quyền:</span> <span className="font-mono text-emerald-300 font-bold">{license.license_id || '—'}</span></div>
              <div><span className="text-slate-500">Hình thức:</span> <span className="font-bold text-emerald-300">Vĩnh viễn (Lifetime)</span></div>
              <div><span className="text-slate-500">Ngày cấp:</span> <span>{license.issued_at || '—'}</span></div>
              <div><span className="text-slate-500">Trạng thái:</span> <span className="text-emerald-400 font-bold">Offline Valid</span></div>
            </div>
            {license.license_path && (
              <div className="text-[10px] text-slate-500 truncate pt-1 border-t border-slate-800">
                Lưu tại: {license.license_path}
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2 text-xs text-amber-300">
            <div className="flex items-center gap-2 font-bold text-amber-400">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Chế độ chẩn đoán dùng thử (Chưa kích hoạt)</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Bạn đang sử dụng các tính năng kiểm tra phần cứng cơ bản. Để mở khóa toàn bộ các công cụ chuyên sâu (Tối ưu Windows, Cài tiện ích Office TPExcel/TPWord, Sửa lỗi hệ thống, Dọn rác chuyên sâu), vui lòng nhập mã CDKey bản quyền do ThienPhatTech cấp.
            </p>
            {license.error && (
              <div className="p-2 bg-rose-950/50 border border-rose-800/80 rounded text-rose-300 text-[11px] flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{license.error}</span>
              </div>
            )}
          </div>
        )}

        {/* Message Alert */}
        {statusMsg && (
          <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 animate-fade-in ${
            statusMsg.success
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-500/20 border-rose-500/40 text-rose-300'
          }`}>
            {statusMsg.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Action Form */}
        {!license.is_licensed ? (
          <div className="space-y-4 pt-1">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-200 flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-400" />
                <span>Mã CDKey Kích Hoạt Bản Quyền:</span>
              </label>

              <div className="relative flex items-center">
                <input
                  type="text"
                  placeholder="Dán mã CDKey tại đây (Ví dụ: TPPRO-eyJjIjoi...)"
                  value={licenseText}
                  onChange={(e) => setLicenseText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleActivateWithContent();
                  }}
                  disabled={isProcessing}
                  className="w-full bg-[#0a0f1d] border border-slate-700 hover:border-slate-600 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 font-mono focus:outline-none placeholder:text-slate-600 pr-24 transition"
                />
                <button
                  type="button"
                  onClick={handlePasteClipboard}
                  disabled={isProcessing}
                  className="absolute right-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer"
                  title="Dán từ Clipboard"
                >
                  <Clipboard className="w-3 h-3 text-amber-400" />
                  Dán mã
                </button>
              </div>
            </div>

            <button
              onClick={() => handleActivateWithContent()}
              disabled={isProcessing || !licenseText.trim()}
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

            {/* Support & Secondary file option */}
            <div className="pt-2 flex items-center justify-between border-t border-slate-800 text-[11px] text-slate-500">
              <button
                type="button"
                onClick={() => setShowFileImport(!showFileImport)}
                className="hover:text-slate-300 underline cursor-pointer"
              >
                {showFileImport ? 'Ẩn chọn file .lic' : 'Nhập file .lic cũ'}
              </button>

              <span className="flex items-center gap-1 text-slate-400 font-mono">
                <PhoneCall className="w-3 h-3 text-emerald-400" />
                Zalo: <strong className="text-emerald-400">098.3388.949</strong>
              </span>
            </div>

            {showFileImport && (
              <div className="p-3 bg-[#0a0f1d] border border-slate-800 rounded-xl space-y-2 animate-fade-in">
                <span className="text-[11px] text-slate-400 block font-semibold">Chọn file .lic từ máy tính:</span>
                <input
                  type="file"
                  accept=".lic,application/json"
                  onChange={handleFileSelect}
                  disabled={isProcessing}
                  className="text-xs text-slate-400 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-300 hover:file:bg-slate-700 file:cursor-pointer"
                />
              </div>
            )}
          </div>
        ) : (
          <div className="pt-2 flex justify-between items-center border-t border-slate-800">
            <button
              onClick={handleRemoveLicense}
              disabled={isProcessing}
              className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Gỡ bản quyền trên máy này
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-[#18233c] hover:bg-[#202f50] text-slate-200 text-xs font-bold rounded-xl cursor-pointer"
            >
              Đóng
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
