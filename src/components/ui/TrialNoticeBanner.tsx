import React from 'react';
import { useAppLicense } from '../../context/AppLicenseContext.js';
import { Key, Sparkles } from 'lucide-react';

export default function TrialNoticeBanner() {
  const { isLicensed, openActivationModal } = useAppLicense();

  if (isLicensed) return null;

  return (
    <div className="mb-4 bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-transparent border border-amber-500/30 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg animate-fade-in select-none">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 shrink-0">
          <Key className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Chế độ chẩn đoán dùng thử
            </span>
            <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded-full font-bold">
              Chưa kích hoạt
            </span>
          </div>
          <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
            Các tính năng chẩn đoán &amp; kiểm tra phần cứng được mở tự do. Vui lòng kích hoạt bản quyền để mở khóa toàn bộ công cụ can thiệp hệ thống và tiện ích độc quyền.
          </p>
        </div>
      </div>
      <button
        onClick={openActivationModal}
        className="px-4 py-2 bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950 font-extrabold rounded-xl text-xs transition-all shadow-md active:scale-95 cursor-pointer shrink-0 self-start sm:self-auto flex items-center gap-1.5"
      >
        <Key className="w-3.5 h-3.5" />
        Kích Hoạt CDKey
      </button>
    </div>
  );
}
