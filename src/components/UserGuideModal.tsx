import React, { useState, useMemo, useEffect } from 'react';
import {
  BookOpen,
  Search,
  X,
  ArrowRight,
  Lightbulb,
  AlertTriangle,
  Sliders,
  FileText,
  Printer,
  Wifi,
  Trash2,
  Archive,
  Laptop,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { USER_GUIDES, GuideItem } from '../utils/userGuideData.js';

interface UserGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (section: string) => void;
}

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  windows: Sliders,
  office: FileText,
  printer: Printer,
  network: Wifi,
  cleaner: Trash2,
  backup: Archive,
  tester: Laptop,
  general: BookOpen,
};

export default function UserGuideModal({
  isOpen,
  onClose,
  onNavigate,
}: UserGuideModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeGuideId, setActiveGuideId] = useState<string>(USER_GUIDES[0]?.id || '');

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const filteredGuides = useMemo(() => {
    if (!searchQuery.trim()) return USER_GUIDES;

    const q = searchQuery.toLowerCase().trim();
    return USER_GUIDES.filter((guide) => {
      const inTitle = guide.title.toLowerCase().includes(q);
      const inSummary = guide.summary.toLowerCase().includes(q);
      const inWhen = guide.whenToUse.toLowerCase().includes(q);
      const inKeywords = guide.keywords.some((k) => k.toLowerCase().includes(q));
      const inCat = guide.categoryName.toLowerCase().includes(q);
      const inSteps = guide.steps.some(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q)
      );
      return inTitle || inSummary || inWhen || inKeywords || inCat || inSteps;
    });
  }, [searchQuery]);

  // Keep activeGuideId valid
  const currentGuide = useMemo(() => {
    const found = filteredGuides.find((g) => g.id === activeGuideId);
    return found || filteredGuides[0] || null;
  }, [filteredGuides, activeGuideId]);

  if (!isOpen) return null;

  const handleOpenTool = (section: string) => {
    if (onNavigate) {
      onNavigate(section);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 select-none animate-fade-in">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog (Phương án B: 2 cột trung tâm) */}
      <div className="relative w-full max-w-5xl h-[86vh] max-h-[720px] bg-[#0c1427] border border-slate-700/80 rounded-2xl shadow-2xl shadow-black/80 flex flex-col overflow-hidden z-10">
        {/* Top Header */}
        <div className="px-5 py-3.5 bg-[#0e172e] border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm md:text-base font-extrabold text-white tracking-wide">
                  CẨM NANG HƯỚNG DẪN SỬ DỤNG TOOL
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  KTV HANDBOOK
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Sổ tay hướng dẫn quy trình vận hành và mẹo xử lý sự cố PCCareMasterPro
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer border border-slate-700/70"
            title="Đóng cẩm nang (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: 2 Columns */}
        <div className="flex-1 flex overflow-hidden">
          {/* ── CỘT TRÁI: Danh sách chuyên mục & Tìm kiếm (~320px) ── */}
          <div className="w-80 md:w-88 border-r border-slate-800 bg-[#090f1d] flex flex-col shrink-0">
            {/* Search Input */}
            <div className="p-3 border-b border-slate-800/80">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm theo lỗi, tính năng, tab..."
                  className="w-full pl-9 pr-8 py-2 bg-[#121b30] border border-slate-700 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition shadow-inner"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between mt-2 px-1 text-[11px] text-slate-500">
                <span>{filteredGuides.length} bài hướng dẫn</span>
                {searchQuery && (
                  <span className="text-emerald-400 font-semibold truncate max-w-[130px]">
                    Lọc: "{searchQuery}"
                  </span>
                )}
              </div>
            </div>

            {/* List of Guides */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {filteredGuides.length === 0 ? (
                <div className="py-12 px-4 text-center space-y-2 text-slate-500">
                  <HelpCircle className="w-7 h-7 mx-auto text-slate-600" />
                  <p className="text-xs">Không tìm thấy bài viết phù hợp.</p>
                </div>
              ) : (
                filteredGuides.map((item) => {
                  const isActive = currentGuide?.id === item.id;
                  const Icon = CATEGORY_ICONS[item.category] || BookOpen;

                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveGuideId(item.id)}
                      className={`w-full text-left p-2.5 rounded-xl transition-all duration-150 flex items-start gap-2.5 cursor-pointer border ${
                        isActive
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-white shadow-sm'
                          : 'bg-[#0f172a]/60 hover:bg-[#131d33] border-slate-800/80 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                          isActive
                            ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm shadow-emerald-500/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <span
                          className={`text-[9px] font-bold uppercase tracking-wider block ${
                            isActive ? 'text-emerald-400' : 'text-slate-500'
                          }`}
                        >
                          {item.categoryName}
                        </span>
                        <p
                          className={`text-xs font-bold truncate mt-0.5 ${
                            isActive ? 'text-white' : 'text-slate-300'
                          }`}
                        >
                          {item.title}
                        </p>
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">
                          {item.summary}
                        </p>
                      </div>

                      {isActive && (
                        <ChevronRight className="w-4 h-4 text-emerald-400 shrink-0 self-center" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* ── CỘT PHẢI: Nội dung chi tiết bài viết (Viewer) ── */}
          <div className="flex-1 bg-[#0c1427] overflow-y-auto p-5 md:p-7 space-y-5">
            {currentGuide ? (
              <div className="space-y-5 animate-fade-in max-w-2xl">
                {/* Title & Action Header */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-800">
                  <div>
                    <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
                      {currentGuide.categoryName}
                    </span>
                    <h1 className="text-base md:text-lg font-extrabold text-white mt-2 leading-snug">
                      {currentGuide.title}
                    </h1>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      {currentGuide.summary}
                    </p>
                  </div>

                  <button
                    onClick={() => handleOpenTool(currentGuide.targetSection)}
                    className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 transition cursor-pointer shrink-0 self-start"
                  >
                    <span>Mở Công Cụ Này</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Khi nào nên sử dụng */}
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300 flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-bold text-emerald-400 block mb-0.5">
                      Khi nào nên sử dụng:
                    </span>
                    <p className="text-slate-300 leading-relaxed">
                      {currentGuide.whenToUse}
                    </p>
                  </div>
                </div>

                {/* Quy trình các bước thực hiện */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <span>Quy trình thao tác chuẩn:</span>
                    <span className="text-[10px] font-normal text-slate-500">
                      ({currentGuide.steps.length} bước)
                    </span>
                  </h3>

                  <div className="space-y-2.5">
                    {currentGuide.steps.map((step) => (
                      <div
                        key={step.step}
                        className="flex items-start gap-3 p-3 rounded-xl bg-[#111b33] border border-slate-800/90 text-xs"
                      >
                        <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-extrabold flex items-center justify-center shrink-0 text-xs mt-0.5 border border-emerald-500/30">
                          {step.step}
                        </span>
                        <div className="flex-1">
                          <p className="font-bold text-white text-xs">
                            {step.title}
                          </p>
                          <p className="text-slate-400 text-[11px] mt-1 leading-relaxed">
                            {step.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tips */}
                {currentGuide.tips && currentGuide.tips.length > 0 && (
                  <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 space-y-2">
                    <div className="flex items-center gap-2 text-blue-400 font-bold text-xs">
                      <Lightbulb className="w-4 h-4" />
                      <span>Kinh Nghiệm & Mẹo KTV:</span>
                    </div>
                    <ul className="list-disc list-inside text-xs text-blue-200/90 space-y-1 leading-relaxed">
                      {currentGuide.tips.map((tip, idx) => (
                        <li key={idx}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Warnings */}
                {currentGuide.warnings && currentGuide.warnings.length > 0 && (
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2">
                    <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Cảnh Báo An Toàn:</span>
                    </div>
                    <ul className="list-disc list-inside text-xs text-amber-200/90 space-y-1 leading-relaxed">
                      {currentGuide.warnings.map((warn, idx) => (
                        <li key={idx}>{warn}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-20 text-center text-slate-500 space-y-2">
                <p>Chọn một bài viết ở danh sách bên trái để đọc hướng dẫn.</p>
              </div>
            )}
          </div>
        </div>

        {/* Modal Bottom Bar */}
        <div className="px-5 py-3 bg-[#0a1020] border-t border-slate-800 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400 font-mono border border-slate-700">
              ESC
            </kbd>
            <span className="text-[11px]">Đóng cẩm nang</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
