import React, { useState, useMemo } from 'react';
import { Trash2, CheckCircle, Settings, Database, History, RefreshCw, FileWarning } from 'lucide-react';
import { JunkCategory } from '../types.js';
import { useTaskManager } from '../context/TaskManagerContext.js';
import { updateSessionReport, getSessionReport } from '../utils/SessionAuditStore.js';
import { playTaskDoneSound } from '../utils/audio.js';


const initialJunkCategories: JunkCategory[] = [
  {
    id: 'system_temp',
    name: 'Tạm Hệ Thống (System Temp)',
    description: 'Các tệp tin ghi tạm do Windows sinh ra.',
    sizeMB: 0,
    checked: true,
    filesList: [],
  },
  {
    id: 'user_temp',
    name: 'Tạm Người Dùng (%TEMP%)',
    description: 'Rác lưu đệm từ các phần mềm (Office, Chrome...).',
    sizeMB: 0,
    checked: true,
    filesList: [],
  },
  {
    id: 'prefetch',
    name: 'Tệp đệm Khởi động (Prefetch)',
    description: 'Tệp hỗ trợ khởi động nhanh, lâu ngày tích tụ gây nặng.',
    sizeMB: 0,
    checked: true,
    filesList: [],
  },
  {
    id: 'win_update',
    name: 'Bộ nhớ tạm Windows Update',
    description: 'Các tệp tin cập nhật Windows tải về đã cài đặt xong.',
    sizeMB: 0,
    checked: true,
    filesList: [],
  },
  {
    id: 'system_logs',
    name: 'Nhật ký Hệ thống (*.log)',
    description: 'Nhật ký chẩn đoán lỗi của Windows phình to.',
    sizeMB: 0,
    checked: true,
    filesList: [],
  },
  {
    id: 'recycle_bin',
    name: 'Thùng rác (Recycle Bin)',
    description: 'Xóa vĩnh viễn tất cả tệp tin đã xóa tạm.',
    sizeMB: 0,
    checked: false,
    filesList: [],
  },
  {
    id: 'registry',
    name: 'Rác Registry & Lịch sử',
    description: 'Lịch sử hộp thoại Run, TypedURLs (Rất an toàn).',
    sizeMB: 0,
    checked: true,
    filesList: [],
  },
  {
    id: 'bsod_dumps',
    name: 'File Dump Màn Hình Xanh (Minidump)',
    description: 'Báo cáo sự cố rác MEMORY.DMP chiếm từ vài trăm MB đến vài GB.',
    sizeMB: 0,
    checked: true,
    filesList: [],
  },
  {
    id: 'chrome_cache',
    name: 'Cache Trình Duyệt Google Chrome',
    description: 'Bộ nhớ đệm hình ảnh/web rác tích tụ của Chrome.',
    sizeMB: 0,
    checked: true,
    filesList: [],
  },
  {
    id: 'edge_cache',
    name: 'Cache Trình Duyệt MS Edge',
    description: 'Bộ nhớ đệm web rác của Microsoft Edge.',
    sizeMB: 0,
    checked: true,
    filesList: [],
  },
  {
    id: 'coccoc_cache',
    name: 'Cache Trình Duyệt Cốc Cốc',
    description: 'Bộ nhớ đệm rác từ trình duyệt Cốc Cốc.',
    sizeMB: 0,
    checked: true,
    filesList: [],
  },
];

// Scan cache: avoid re-scanning when switching tabs (5 min TTL)
let __junkScanCache: { data: any; timestamp: number } | null = null;
const SCAN_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const idToName: Record<string, string> = {
  'user_temp': 'Temporary Files (User)',
  'system_temp': 'Windows Temp',
  'prefetch': 'Prefetch',
  'win_update': 'Windows Update Cache',
  'system_logs': 'Windows Log Files',
  'recycle_bin': 'Recycle Bin',
  'registry': 'Registry & History',
  'bsod_dumps': 'File Dump Màn Hình Xanh',
  'chrome_cache': 'Cache Trình Duyệt Google Chrome',
  'edge_cache': 'Cache Trình Duyệt MS Edge',
  'coccoc_cache': 'Cache Trình Duyệt Cốc Cốc',
};

function formatBlockedReasons(reasons: any): string {
  if (!reasons) return '';
  const label: Record<string, string> = {
    in_use: 'đang được sử dụng',
    access_denied: 'thiếu quyền truy cập',
    reparse_point: 'reparse/mount hệ thống (tự bảo vệ)',
    other: 'lỗi khác',
  };
  const parts: string[] = [];
  for (const key of ['in_use', 'access_denied', 'reparse_point', 'other']) {
    const bytes = reasons[key];
    if (bytes) parts.push(`${label[key]}: ${(bytes / 1048576).toFixed(1)} MB`);
  }
  return parts.join('; ');
}

export default function JunkCleaner() {
  const [categories, setCategories] = useState<JunkCategory[]>(initialJunkCategories);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [cleaned, setCleaned] = useState(false);
  const [totalReclaimed, setTotalReclaimed] = useState(0);

  // Real progress — fed by 'junk-scan-progress' / 'junk-clean-progress' events
  const [scanProgress, setScanProgress] = useState<{ done: number; total: number; name: string } | null>(null);
  const [cleanProgressInfo, setCleanProgressInfo] = useState<{ done: number; total: number; name: string } | null>(null);
  const [cleanProgress, setCleanProgress] = useState(0);
  // Honest clean outcome: freed + whatever could NOT be deleted (and why)
  const [cleanedResult, setCleanedResult] = useState<{ freedMB: number; blockedBytes: number; reasons: string } | null>(null);

  React.useEffect(() => {
    handleScan();
  }, []);

  React.useEffect(() => {
    const api = (window as any).electronAPI;
    let unScan: any = null;
    let unClean: any = null;
    try {
      if (api?.onJunkScanProgress) {
        unScan = api.onJunkScanProgress((p: any) => setScanProgress({ done: p.done, total: p.total, name: p.name }));
      }
      if (api?.onJunkCleanProgress) {
        unClean = api.onJunkCleanProgress((p: any) => {
          setCleanProgressInfo({ done: p.done, total: p.total, name: p.name });
          setCleanProgress(p.total > 0 ? Math.min(95, Math.round((p.done / p.total) * 100)) : 0);
        });
      }
    } catch (e) {
      console.warn('Junk progress listeners failed:', e);
    }
    return () => {
      try { unScan?.(); } catch (e) {}
      try { unClean?.(); } catch (e) {}
    };
  }, []);

  const handleToggle = (id: string) => {
    setCategories(prev =>
      prev.map(cat => (cat.id === id ? { ...cat, checked: !cat.checked } : cat))
    );
  };

  const handleSelectAll = (check: boolean) => {
    setCategories(prev => prev.map(cat => ({ ...cat, checked: check })));
  };

  const handleScan = async () => {
    // Use cached results if still valid (< 5 min)
    if (__junkScanCache && (Date.now() - __junkScanCache.timestamp < SCAN_CACHE_TTL)) {
      const data = __junkScanCache.data;
      setCategories(prev =>
        prev.map(cat => {
          const scanData = data[cat.id];
          if (scanData) {
            return { ...cat, sizeMB: scanData.sizeMB, filesList: scanData.filesList || [] };
          }
          return cat;
        })
      );
      setScanned(true);
      return;
    }

    setScanning(true);
    setScanned(false);
    setCleaned(false);
    setScanProgress(null);
    setCleanProgress(0);
    setCleanProgressInfo(null);
    setCleanedResult(null);

    try {
      const rawData = await (window as any).electronAPI.scanJunk();
      const data = rawData?.categories ? rawData : (rawData?.data ?? rawData);
      const categoriesList = Array.isArray(data?.categories) ? data.categories : (Array.isArray(data) ? data : []);
      __junkScanCache = { data: categoriesList, timestamp: Date.now() };

      const nameToId: Record<string, string> = {
        'Temporary Files (User)': 'user_temp',
        'Windows Temp': 'system_temp',
        'Prefetch': 'prefetch',
        'Windows Update Cache': 'win_update',
        'Windows Log Files': 'system_logs',
        'Recycle Bin': 'recycle_bin',
        'Registry & History': 'registry',
        'File Dump Màn Hình Xanh': 'bsod_dumps',
        'Cache Trình Duyệt Google Chrome': 'chrome_cache',
        'Cache Trình Duyệt MS Edge': 'edge_cache',
        'Cache Trình Duyệt Cốc Cốc': 'coccoc_cache',
      };

      setCategories(prev =>
        prev.map(cat => {
          const match = categoriesList.find((c: any) => nameToId[c.name] === cat.id || c.name === cat.name || c.name === cat.id);
          if (match) {
            return {
              ...cat,
              sizeMB: Math.round(((match.size_bytes || 0) / (1024 * 1024)) * 10) / 10,
              filesList: match.filesList || []
            };
          }
          return cat;
        })
      );
    } catch (err: any) {
      console.warn("Lỗi quét rác:", err);
    } finally {
      setScanning(false);
      setScanned(true);
    }
  };

  const { startTask, updateTask, completeTask, failTask } = useTaskManager();

  const handleClean = async () => {
    setCleaning(true);
    setCleanProgress(0);
    setCleanProgressInfo(null);
    setCleanedResult(null);
    startTask('junk-cleaner', 'Dọn Dẹp Rác Hệ Thống', 'Dọn Rác', 'Đang quét và giải phóng bộ nhớ tạm...', 'cleaner', 'from-emerald-500 to-emerald-600');

    const finalize = (freedMB: number, blockedBytes: number, reasons: string, result: any) => {
      setCleanProgress(100);
      setTotalReclaimed(freedMB);
      setCleanedResult({ freedMB, blockedBytes, reasons });
      __junkScanCache = null; // Invalidate cache after clean
      const blockedNote = blockedBytes > 0 ? ` — còn ${(blockedBytes / 1048576).toFixed(1)} MB không xóa được` : '';
      completeTask('junk-cleaner', `Đã dọn dẹp thành công ${freedMB.toFixed(1)} MB rác hệ thống${blockedNote}!`);
      playTaskDoneSound();
      const current = getSessionReport();

      const prevMB = current.junkCleanedMB || 0;
      const catNames = categories.filter(c => c.checked).map(c => c.name);
      updateSessionReport({
        junkCleanedMB: prevMB + freedMB,
        junkCleanedCategories: Array.from(new Set([...(current.junkCleanedCategories || []), ...catNames]))
      });
      setTimeout(() => {
        setCleaning(false);
        setCleaned(true);
        // Keep honest remaining sizes: only fully-cleaned categories drop to 0.
        setCategories(prev => prev.map(cat => {
          if (!cat.checked) return cat;
          const detail = result && Array.isArray(result.details)
            ? result.details.find((d: any) => (idToName[cat.id] === d.category) || (cat.name === d.category) || (cat.id === d.category))
            : null;
          const freedThis = detail && typeof detail.freed_bytes === 'number' ? detail.freed_bytes / (1024 * 1024) : 0;
          const remaining = Math.max(0, cat.sizeMB - freedThis);
          return { ...cat, sizeMB: Math.round(remaining * 10) / 10, checked: remaining > 0.05 };
        }));
      }, 800);
    };

    try {
      const activeCategories = categories.filter(cat => cat.checked).map(cat => idToName[cat.id] || cat.id);
      const result = await (window as any).electronAPI.cleanJunk(activeCategories);
      const freedBytes = typeof result?.total_freed_bytes === 'number'
        ? result.total_freed_bytes
        : (parseFloat(result?.total_freed || '0') || 0) * 1048576;
      const blockedBytes = typeof result?.total_blocked_bytes === 'number' ? result.total_blocked_bytes : 0;
      const reasons = formatBlockedReasons(result?.blocked_reasons);
      finalize(freedBytes / 1048576, blockedBytes, reasons, result);
    } catch (err: any) {
      setCleaning(false);
      failTask('junk-cleaner', "Lỗi dọn rác: " + err.message);
      alert("Lỗi dọn rác: " + err.message);
    }
  };


  const totalSelectedSize = useMemo(() => categories.filter(cat => cat.checked).reduce((acc, cat) => acc + cat.sizeMB, 0), [categories]);
  const totalDurableSize = useMemo(() => categories.reduce((acc, cat) => acc + cat.sizeMB, 0), [categories]);

  const getCategoryIcon = (id: string) => {
    if (id.includes('temp')) return <Database className="w-5 h-5" />;
    if (id === 'recycle_bin') return <Trash2 className="w-5 h-5" />;
    if (id === 'registry') return <Settings className="w-5 h-5" />;
    if (id === 'prefetch' || id === 'system_logs') return <History className="w-5 h-5" />;
    return <FileWarning className="w-5 h-5" />;
  };

  const formatSizeReadable = (mb: number) => {
    if (!mb || mb <= 0) return '0 MB';
    if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
    return `${Math.round(mb)} MB`;
  };

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      {/* HEADER & OVERVIEW STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="col-span-2 bg-gradient-to-r from-[#121c33] to-[#0f172a] p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
                <Trash2 className="h-6 w-6 text-rose-400" />
                Dọn Dẹp Rác Hệ Thống
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Phân tích và giải phóng không gian lưu trữ bị chiếm dụng vô ích (Temp, Prefetch, Log, Cache).
              </p>
            </div>
            <button 
              onClick={handleScan}
              disabled={scanning || cleaning}
              className={`p-3 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 rounded-xl text-slate-200 transition-all cursor-pointer disabled:opacity-50 ${scanning ? 'animate-pulse' : ''}`}
            >
              <RefreshCw className={`h-5 w-5 ${scanning ? 'animate-spin text-amber-400' : ''}`} />
            </button>
          </div>

          {/* EMBEDDED PROGRESS BAR IN TOP HEADER */}
          {(scanning || cleaning) && (
            <div className="pt-2 border-t border-slate-800 space-y-1.5 animate-fade-in">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
                <span className="flex items-center gap-2 truncate min-w-0">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400 shrink-0" />
                  {scanning
                    ? (scanProgress
                        ? `Đang phân tích: ${scanProgress.name} (${scanProgress.done}/${scanProgress.total})…`
                        : 'Đang phân tích bộ nhớ đệm…')
                    : (cleanProgressInfo
                        ? `Đang dọn dẹp: ${cleanProgressInfo.name} (${cleanProgressInfo.done}/${cleanProgressInfo.total})…`
                        : 'Đang dọn dẹp rác hệ thống…')}
                </span>
                <span className="font-mono text-amber-400 font-bold shrink-0">
                  {scanning
                    ? (scanProgress ? `${Math.round((scanProgress.done / scanProgress.total) * 100)}%` : '…')
                    : `${cleanProgress}%`}
                </span>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800 p-0.5">
                <div
                  className={`h-full rounded-full transition-all duration-300 bg-gradient-to-r from-rose-500 to-emerald-400 ${scanning && !scanProgress ? 'animate-pulse' : ''}`}
                  style={{ width: `${scanning ? (scanProgress ? Math.round((scanProgress.done / scanProgress.total) * 100) : 8) : cleanProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
        
        <div className="bg-[#101728] p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-col justify-center items-center">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Rác Phát Hiện</span>
          <span className="text-3xl font-black text-rose-400 font-mono">{(totalDurableSize / 1024).toFixed(2)} <span className="text-sm text-slate-400 font-bold">GB</span></span>
        </div>
      </div>

      {/* CATEGORY GRID */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Danh mục cần dọn</h3>
          <div className="flex gap-4 text-xs font-semibold">
            <button onClick={() => handleSelectAll(true)} className="text-emerald-400 hover:text-emerald-300 transition cursor-pointer">Chọn tất cả</button>
            <button onClick={() => handleSelectAll(false)} className="text-slate-400 hover:text-slate-200 transition cursor-pointer">Bỏ chọn hết</button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {categories.map((cat) => {
            const isHeavy = cat.sizeMB > 500;
            const filesCount = (cat.filesList && Array.isArray(cat.filesList)) ? cat.filesList.length : 0;
            return (
              <div 
                key={cat.id}
                onClick={() => { if (!scanning && !cleaning) handleToggle(cat.id) }}
                className={`group relative p-4 rounded-2xl border transition-all duration-200 cursor-pointer overflow-hidden ${
                  cat.checked 
                    ? 'bg-[#14223d] border-emerald-500/40 shadow-lg shadow-emerald-500/5' 
                    : 'bg-[#11192e] border-slate-800/80 hover:border-slate-700 hover:bg-[#151f38]'
                }`}>

                {/* compact checkbox top-right */}
                <div className={`absolute top-3.5 right-3.5 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                  cat.checked ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600 group-hover:border-emerald-400'
                }`}>
                  {cat.checked && <CheckCircle className="w-3 h-3 text-slate-950 font-bold" />}
                </div>

                <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${
                  cat.checked ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'
                }`}>
                  {getCategoryIcon(cat.id)}
                </div>

                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <h4 className="text-xs font-bold text-slate-200 line-clamp-1">{cat.name}</h4>
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">{cat.description}</p>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">
                      {cat.id === 'registry' ? 'Mục rác' : 'Dung lượng'}
                    </span>
                    <span className={`font-mono font-bold ${cat.sizeMB > 0 ? (isHeavy ? 'text-rose-400' : 'text-emerald-400') : 'text-emerald-400/60'}`}>
                      {cat.id === 'registry' 
                        ? (cat.filesList.length > 0 ? `${cat.filesList.length} mục` : 'Sạch')
                        : (cat.sizeMB > 0 ? formatSizeReadable(cat.sizeMB) : 'Sạch')
                      }
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-500 font-mono">
                    {filesCount > 0 ? `${filesCount} tệp` : '—'}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ACTION BAR */}
      <div className="bg-[#101728] p-5 rounded-2xl border border-slate-800 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <span className="text-[11px] text-slate-400 block mb-0.5">Dung lượng sẽ giải phóng</span>
          <span className="text-2xl font-black text-emerald-400 font-mono">{(totalSelectedSize / 1024).toFixed(2)} <span className="text-sm font-bold text-slate-400">GB</span></span>
        </div>
        
        <div className="w-full md:w-[320px]">
          {cleaned ? (
            <div className="w-full space-y-2">
              <div className={`flex items-center justify-center gap-2 p-3 rounded-xl border shadow-xs ${cleanedResult?.blockedBytes ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'}`}>
                <CheckCircle className="w-5 h-5" />
                <span className="text-xs font-bold">
                  Đã dọn {(totalReclaimed / 1024).toFixed(2)} GB
                  {cleanedResult?.blockedBytes ? ` — còn ${(cleanedResult.blockedBytes / (1024 * 1024 * 1024)).toFixed(2)} GB không thể xóa` : '!'}
                </span>
              </div>
              {cleanedResult?.blockedBytes ? (
                <div className="p-2.5 rounded-lg bg-red-500/5 border border-red-500/20 text-[11px] text-red-300/90 leading-relaxed">
                  <b>Không thể xóa:</b> {cleanedResult.reasons || 'một số tệp đang được sử dụng hoặc bị khóa quyền. Hãy đóng các ứng dụng đang chạy và thử lại.'}
                </div>
              ) : null}
            </div>
          ) : (
            <button
              onClick={handleClean}
              disabled={scanning || cleaning || totalSelectedSize === 0}
              className="w-full p-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl font-extrabold text-xs transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              {cleaning ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> ĐANG DỌN DẸP...
                </>
              ) : scanning ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> ĐANG PHÂN TÍCH...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" /> DỌN DẸP NGAY
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

