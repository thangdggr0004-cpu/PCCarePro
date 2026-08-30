import React, { useState, useEffect, useCallback } from 'react';
import { Download, X, RefreshCw } from 'lucide-react';

export default function AutoUpdater() {
  const [updateInfo, setUpdateInfo] = useState<{ version: string; notes: string } | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloaded, setDownloaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkForUpdate = useCallback(async () => {
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      if (update) {
        setUpdateInfo({
          version: update.version || '?',
          notes: update.body || '',
        });
      }
    } catch {
      // silently ignore — updater not configured or no update
    }
  }, []);

  const downloadAndInstall = useCallback(async () => {
    try {
      setDownloading(true);
      setProgress(0);
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      if (update) {
        await update.downloadAndInstall((downloadProgress) => {
          if ('dataLength' in downloadProgress && 'chunkLength' in downloadProgress) {
            const pct = Math.round((downloadProgress.dataLength / (downloadProgress.chunkLength || 1)) * 100);
            setProgress(Math.min(pct, 100));
          }
        });
        setDownloading(false);
        setDownloaded(true);
        setProgress(100);
      }
    } catch (e: any) {
      setDownloading(false);
      setError(e?.message || 'Lỗi khi tải bản cập nhật');
    }
  }, []);

  const relaunchApp = useCallback(async () => {
    try {
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } catch {
      window.location.reload();
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(checkForUpdate, 5000);
    return () => clearTimeout(timer);
  }, [checkForUpdate]);

  if (dismissed || error) {
    if (error) {
      setTimeout(() => setError(null), 10000);
    }
    return error ? (
      <div className="fixed bottom-6 right-6 z-[999] animate-fade-in">
        <div className="bg-[#131d33] rounded-2xl shadow-2xl border border-red-800 p-4 max-w-xs relative flex gap-3">
          <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
          <div className="flex-1">
            <p className="text-xs text-red-400">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    ) : null;
  }

  if (!updateInfo) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[999] animate-fade-in">
      <div className="bg-[#131d33] rounded-2xl shadow-2xl border border-slate-800 p-5 max-w-sm relative flex gap-3.5 overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
        <div className="mt-0.5">
          <div className="bg-emerald-500/20 p-2.5 rounded-xl border border-emerald-500/30">
            <Download className={`w-5 h-5 text-emerald-400 ${downloading ? 'animate-bounce' : ''}`} />
          </div>
        </div>
        <div className="flex-1">
          <h4 className="font-bold text-white text-xs flex items-center justify-between">
            Bản Cập Nhật Mới Có Sẵn!
            <button onClick={() => setDismissed(true)} className="text-slate-400 hover:text-white cursor-pointer transition-colors">
              <X className="w-4 h-4" />
            </button>
          </h4>
          <p className="text-xs text-slate-400 mt-1 mb-2">
            Phiên bản <strong className="text-emerald-400 font-mono">v{updateInfo.version}</strong> đã sẵn sàng!
          </p>

          {updateInfo.notes && (
            <div className="bg-[#0e1626] rounded-xl border border-slate-800 p-2.5 text-[11px] text-slate-300 mb-3 max-h-24 overflow-y-auto whitespace-pre-wrap">
              <span className="font-semibold text-emerald-400 block mb-1">Nội dung cập nhật:</span>
              {updateInfo.notes}
            </div>
          )}

          {downloading && (
            <div className="mb-3">
              <div className="flex justify-between text-[10px] text-slate-400 mb-1 font-mono">
                <span>Đang tải ngầm...</span>
                <span className="text-emerald-400 font-bold">{progress}%</span>
              </div>
              <div className="w-full bg-[#0e1626] rounded-full h-1.5 overflow-hidden border border-slate-800">
                <div className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            {!downloading && !downloaded && (
              <button
                onClick={downloadAndInstall}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold py-1.5 px-3 rounded-xl transition-all cursor-pointer shadow-lg shadow-emerald-500/20 active:scale-95"
              >
                Tải &amp; Cập Nhật
              </button>
            )}

            {downloaded && (
              <div className="flex flex-col gap-2 w-full">
                <p className="text-xs text-emerald-400 font-medium">
                  ✓ Cập nhật thành công!
                </p>
                <button
                  onClick={relaunchApp}
                  className="flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold py-2 px-3 rounded-xl transition-all cursor-pointer shadow-lg shadow-emerald-500/20 active:scale-95"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Tắt App &amp; Mở Bản Mới
                </button>
              </div>
            )}

            {!downloading && !downloaded && (
              <button
                onClick={() => setDismissed(true)}
                className="bg-[#18233c] hover:bg-[#202f50] text-slate-300 border border-slate-700 text-xs font-bold py-1.5 px-3 rounded-xl transition-all cursor-pointer active:scale-95"
              >
                Để sau
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
