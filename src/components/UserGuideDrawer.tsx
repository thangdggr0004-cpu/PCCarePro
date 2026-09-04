import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Search,
  X,
  ArrowRight,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Sliders,
  FileText,
  Printer,
  Wifi,
  Trash2,
  Archive,
  Laptop,
  HelpCircle,
} from 'lucide-react';
import { USER_GUIDES, GuideItem } from '../utils/userGuideData.js';

interface UserGuideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (section: string) => void;
}

const CATEGORIES = [
  { id: 'all', label: 'Tất cả', icon: BookOpen },
  { id: 'windows', label: 'Thiết lập Windows', icon: Sliders },
  { id: 'office', label: 'Tiện ích Office', icon: FileText },
  { id: 'printer', label: 'Tiện ích Máy In', icon: Printer },
  { id: 'network', label: 'Mạng & DNS', icon: Wifi },
  { id: 'cleaner', label: 'Dọn Dẹp Rác', icon: Trash2 },
  { id: 'backup', label: 'Sao Lưu & BitLocker', icon: Archive },
  { id: 'tester', label: 'Kiểm Tra & Báo Cáo', icon: Laptop },
];

export default function UserGuideDrawer({
  isOpen,
  onClose,
  onNavigate,
}: UserGuideDrawerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredGuides = useMemo(() => {
    return USER_GUIDES.filter((guide) => {
      const matchCat =
        selectedCategory === 'all' || guide.category === selectedCategory;
      if (!matchCat) return false;

      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase().trim();
      const inTitle = guide.title.toLowerCase().includes(q);
      const inSummary = guide.summary.toLowerCase().includes(q);
      const inWhen = guide.whenToUse.toLowerCase().includes(q);
      const inKeywords = guide.keywords.some((k) => k.toLowerCase().includes(q));
      const inSteps = guide.steps.some(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q)
      );

      return inTitle || inSummary || inWhen || inKeywords || inSteps;
    });
  }, [searchQuery, selectedCategory]);

  if (!isOpen) return null;

  const handleNavigate = (section: string) => {
    if (onNavigate) {
      onNavigate(section);
      onClose();
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end animate-fade-in select-none">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <aside className="relative w-full max-w-xl md:max-w-2xl bg-[#0b1324] border-l border-slate-800 shadow-2xl flex flex-col h-full z-10">
        {/* Header */}
        <div className="p-4 md:p-5 border-b border-slate-800/80 bg-[#0d172e] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm md:text-base font-extrabold text-white tracking-wide">
                  Cẩm Nang Hướng Dẫn Sử Dụng Tool
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  KTV Pro
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Quy trình chuẩn hóa, giải pháp sửa lỗi và mẹo xử lý thực chiến
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer border border-slate-700/60"
            title="Đóng cẩm nang"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-4 border-b border-slate-800 bg-[#0c1529] space-y-3 shrink-0">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm hướng dẫn (VD: kẹt in, word, font, bitlocker, dns, update...)"
              className="w-full pl-10 pr-9 py-2 bg-[#131f38] border border-slate-700 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition cursor-pointer text-xs ${
                    isActive
                      ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                      : 'bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Guides List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {filteredGuides.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-800/80 border border-slate-700 text-slate-500 flex items-center justify-center mx-auto">
                <HelpCircle className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-300">
                Không tìm thấy hướng dẫn phù hợp
              </p>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Hãy thử tìm với các từ khóa khác như "máy in", "office", "dọn rác", "mạng" hoặc xóa bộ lọc.
              </p>
            </div>
          ) : (
            filteredGuides.map((guide) => {
              const isExpanded = expandedId === guide.id || searchQuery.length > 0;

              return (
                <div
                  key={guide.id}
                  className="bg-[#111a30] hover:bg-[#131e38] border border-slate-800/90 rounded-2xl p-4 transition-all duration-150 shadow-sm"
                >
                  {/* Guide Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 cursor-pointer" onClick={() => toggleExpand(guide.id)}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                          {guide.categoryName}
                        </span>
                      </div>
                      <h3 className="text-xs md:text-sm font-bold text-white hover:text-emerald-400 transition-colors">
                        {guide.title}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        {guide.summary}
                      </p>
                    </div>

                    <button
                      onClick={() => handleNavigate(guide.targetSection)}
                      className="px-2.5 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-1 transition shrink-0 cursor-pointer"
                      title="Mở ngay công cụ này"
                    >
                      Mở Tool <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>

                  {/* When to use */}
                  <div className="mt-3 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs text-slate-300 flex items-start gap-2">
                    <span className="font-bold text-emerald-400 shrink-0">Khi nào dùng:</span>
                    <span className="text-slate-400">{guide.whenToUse}</span>
                  </div>

                  {/* Expand / Collapse Details */}
                  <button
                    onClick={() => toggleExpand(guide.id)}
                    className="mt-3 w-full py-1 text-xs text-slate-400 hover:text-slate-200 flex items-center justify-between border-t border-slate-800/60 pt-2 transition cursor-pointer"
                  >
                    <span className="text-[11px] font-semibold text-slate-500">
                      {isExpanded ? 'Thu gọn các bước' : `Xem chi tiết ${guide.steps.length} bước thực hiện`}
                    </span>
                    <ChevronRight
                      className={`w-3.5 h-3.5 transform transition-transform ${
                        isExpanded ? 'rotate-90 text-emerald-400' : ''
                      }`}
                    />
                  </button>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-3 animate-fade-in">
                      {/* Step by Step */}
                      <div className="space-y-2">
                        <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                          Quy Trình Thực Hiện:
                        </div>
                        {guide.steps.map((st) => (
                          <div
                            key={st.step}
                            className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-900/40 border border-slate-800/60 text-xs"
                          >
                            <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[11px] mt-0.5">
                              {st.step}
                            </span>
                            <div>
                              <p className="font-semibold text-white">{st.title}</p>
                              <p className="text-slate-400 text-[11px] mt-0.5 leading-relaxed">
                                {st.description}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Tips */}
                      {guide.tips && guide.tips.length > 0 && (
                        <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-blue-400 font-bold text-xs">
                            <Lightbulb className="w-3.5 h-3.5" />
                            <span>Mẹo KTV & Lưu Ý:</span>
                          </div>
                          <ul className="list-disc list-inside text-xs text-blue-200/80 space-y-1 leading-relaxed">
                            {guide.tips.map((tip, idx) => (
                              <li key={idx}>{tip}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Warnings */}
                      {guide.warnings && guide.warnings.length > 0 && (
                        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-amber-400 font-bold text-xs">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Cảnh Báo An Toàn:</span>
                          </div>
                          <ul className="list-disc list-inside text-xs text-amber-200/80 space-y-1 leading-relaxed">
                            {guide.warnings.map((warn, idx) => (
                              <li key={idx}>{warn}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Action Button */}
                      <div className="pt-1 flex justify-end">
                        <button
                          onClick={() => handleNavigate(guide.targetSection)}
                          className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-2 transition shadow-md shadow-emerald-500/20 cursor-pointer"
                        >
                          <span>Mở ngay công cụ "{guide.title}"</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 bg-[#0d172e] flex items-center justify-between text-[11px] text-slate-500 shrink-0">
          <span>PCCareMasterPro • Cẩm Nang KTV</span>
          <span>Hiển thị {filteredGuides.length} bài hướng dẫn</span>
        </div>
      </aside>
    </div>
  );
}
