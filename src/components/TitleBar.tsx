import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Minus, Square, X, Cpu, MemoryStick, Shield, Thermometer, ArrowUpDown } from 'lucide-react';

export default function TitleBar() {
  const [loaded, setLoaded] = useState(false);
  const [creatingRestorePoint, setCreatingRestorePoint] = useState(false);

  // Refs for direct DOM updates (bypass React re-render)
  const cpuTextRef = useRef<HTMLSpanElement>(null);
  const cpuBarInnerRef = useRef<HTMLDivElement>(null);
  const ramTextRef = useRef<HTMLSpanElement>(null);
  const ramBarInnerRef = useRef<HTMLDivElement>(null);
  const tempTextRef = useRef<HTMLSpanElement>(null);
  const netUpRef = useRef<HTMLSpanElement>(null);
  const netDownRef = useRef<HTMLSpanElement>(null);
  const ramTotalRef = useRef<number>(0);
  const metricsRef = useRef<{ cpu: number; ram: number }>({ cpu: 0, ram: 0 });
  const thresholdRef = useRef<number>(80);
  const cpuTempAlertRef = useRef<boolean>(true);

  const updateMetricsDOM = useCallback((cpu: number, ram: number, temp: number, netUp: number, netDown: number) => {
    metricsRef.current = { cpu, ram };
    const total = ramTotalRef.current;

    if (cpuTextRef.current) cpuTextRef.current.textContent = `${cpu}%`;
    if (cpuBarInnerRef.current) cpuBarInnerRef.current.style.width = `${cpu}%`;

    const ramUsedGB = total > 0 ? ((ram / 100) * total).toFixed(1) : '0';
    if (ramTextRef.current) ramTextRef.current.textContent = `${ramUsedGB}/${total}GB`;
    if (ramBarInnerRef.current) ramBarInnerRef.current.style.width = `${ram}%`;

    if (tempTextRef.current) {
      const isHot = cpuTempAlertRef.current && temp >= thresholdRef.current;
      tempTextRef.current.textContent = `${temp}°C`;
      tempTextRef.current.className = `font-bold font-mono ${isHot ? 'text-rose-400 animate-pulse' : 'text-amber-400'}`;
    }
    if (netUpRef.current) netUpRef.current.textContent = `↑${netUp}Kb`;
    if (netDownRef.current) netDownRef.current.textContent = `↓${(netDown / 1024).toFixed(1)}Mb`;
  }, []);

  const handleCreateRestorePoint = async () => {
    setCreatingRestorePoint(true);
    try {
      const res = await (window as any).electronAPI.createSystemRestorePoint("ThienPhatTech_1ClickRestorePoint");
      if (res && res.success) {
        alert("✅ " + res.message);
      } else {
        alert("⚠️ Không thể tạo điểm khôi phục: " + (res?.error || "Lỗi không xác định"));
      }
    } catch (e: any) {
      alert("Lỗi: " + e.message);
    } finally {
      setCreatingRestorePoint(false);
    }
  };

  useEffect(() => {
    let offPush: (() => void) | null = null;
    const timer = setTimeout(() => {
      (window as any).electronAPI?.getHardwareInfo?.().then((info: any) => {
        const total = info?.ramTotalSize || (info?.data?.ramTotalSize);
        if (total) {
          ramTotalRef.current = total;
          setLoaded(true);
          const cached = metricsRef.current;
          updateMetricsDOM(cached.cpu, cached.ram, 0, 0, 0);
        }
      }).catch(() => {});

      if (typeof (window as any).electronAPI?.onMetricsPush === 'function') {
        offPush = (window as any).electronAPI.onMetricsPush((raw: any) => {
          if (document.hidden) return;
          const d = raw?.data ?? raw ?? {};
          const cpu = typeof d.cpu === 'number' ? d.cpu : (typeof d.cpu === 'string' ? parseFloat(d.cpu) || 0 : 0);
          const ram = typeof d.ram === 'object' ? (d.ram?.percent ?? 0) : (typeof d.ram === 'number' ? d.ram : (typeof d.ram === 'string' ? parseFloat(d.ram) || 0 : 0));
          const temp = typeof d.temp === 'object' ? (d.temp?.cpu ?? 0) : (typeof d.temp === 'number' ? d.temp : (typeof d.temp === 'string' ? parseFloat(d.temp) || 0 : 0));
          const netUp = typeof d.speed === 'object' ? (d.speed?.upload ?? 0) : (typeof d.netUp === 'number' ? d.netUp : 0);
          const netDown = typeof d.speed === 'object' ? (d.speed?.download ?? 0) : (typeof d.netDown === 'number' ? d.netDown : 0);
          updateMetricsDOM(cpu, ram, temp, netUp, netDown);
        });
      }

      (window as any).electronAPI?.getCachedMetrics?.().then((raw: any) => {
        if (raw) {
          const d = raw?.data ?? raw ?? {};
          const cpu = typeof d.cpu === 'number' ? d.cpu : (typeof d.cpu === 'string' ? parseFloat(d.cpu) || 0 : 0);
          const ram = typeof d.ram === 'object' ? (d.ram?.percent ?? 0) : (typeof d.ram === 'number' ? d.ram : (typeof d.ram === 'string' ? parseFloat(d.ram) || 0 : 0));
          const temp = typeof d.temp === 'object' ? (d.temp?.cpu ?? 0) : (typeof d.temp === 'number' ? d.temp : (typeof d.temp === 'string' ? parseFloat(d.temp) || 0 : 0));
          const netUp = typeof d.speed === 'object' ? (d.speed?.upload ?? 0) : (typeof d.netUp === 'number' ? d.netUp : 0);
          const netDown = typeof d.speed === 'object' ? (d.speed?.download ?? 0) : (typeof d.netDown === 'number' ? d.netDown : 0);
          updateMetricsDOM(cpu, ram, temp, netUp, netDown);
        }
      }).catch(() => {});
    }, 150);


    return () => {
      clearTimeout(timer);
      offPush?.();
    };
  }, [updateMetricsDOM]);


  const handleMinimize = () => (window as any).electronAPI?.windowMinimize?.();
  const handleMaximize = () => (window as any).electronAPI?.windowMaximize?.();
  const handleClose = () => (window as any).electronAPI?.windowClose?.();


  return (
    <div
      data-tauri-drag-region
      className="w-full h-8 bg-[#090d16] flex items-center justify-between shrink-0 select-none z-50 border-b border-slate-800/60"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Left: App Title */}
      <div className="flex items-center gap-2 pl-3.5">
        <div className="w-3.5 h-3.5 bg-emerald-500 rounded flex items-center justify-center shadow-sm shadow-emerald-500/30">
          <div className="w-1.5 h-1.5 border border-slate-950 rounded-xs bg-emerald-200" />
        </div>
        <span className="text-[11px] font-semibold text-slate-300 tracking-normal">
          PCcareMasterPro - Thiên Phát Tech Toolkit
        </span>
      </div>

      {/* Center: Live Quick Pulse */}
      {loaded && (
        <div
          className="hidden md:flex items-center gap-3.5 text-[10px] font-mono"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          {/* CPU */}
          <div className="flex items-center gap-1.5 text-slate-400">
            <Cpu className="w-3 h-3 text-emerald-400" />
            <span>CPU</span>
            <span ref={cpuTextRef} className="font-bold text-emerald-400 font-mono">0%</span>
            <div className="w-10 h-1 bg-slate-800 rounded-full overflow-hidden">
              <div ref={cpuBarInnerRef} className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: '0%' }} />
            </div>
          </div>

          <div className="w-px h-2.5 bg-slate-800" />

          {/* RAM */}
          <div className="flex items-center gap-1.5 text-slate-400">
            <MemoryStick className="w-3 h-3 text-cyan-400" />
            <span>RAM</span>
            <span ref={ramTextRef} className="font-bold text-cyan-400 font-mono">0/0GB</span>
            <div className="w-10 h-1 bg-slate-800 rounded-full overflow-hidden">
              <div ref={ramBarInnerRef} className="h-full bg-cyan-500 rounded-full transition-all duration-700" style={{ width: '0%' }} />
            </div>
          </div>

          <div className="w-px h-2.5 bg-slate-800" />

          {/* TEMP */}
          <div className="flex items-center gap-1.5 text-slate-400">
            <Thermometer className="w-3 h-3 text-amber-400" />
            <span ref={tempTextRef} className="font-bold text-amber-400 font-mono">0°C</span>
          </div>

          <div className="w-px h-2.5 bg-slate-800" />

          {/* NET */}
          <div className="flex items-center gap-1 text-slate-400">
            <ArrowUpDown className="w-3 h-3 text-teal-400" />
            <span ref={netUpRef} className="font-bold text-teal-400 font-mono">↑0Kb</span>
            <span ref={netDownRef} className="font-bold text-teal-400 font-mono">↓0Mb</span>
          </div>

          <div className="w-px h-2.5 bg-slate-800" />

          {/* Restore Point Shortcut */}
          <button
            onClick={handleCreateRestorePoint}
            disabled={creatingRestorePoint}
            title="Tạo Điểm Khôi Phục Hệ Thống Windows (System Restore Point) 1-Click"
            className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded transition cursor-pointer disabled:opacity-50"
          >
            <Shield className="w-2.5 h-2.5" />
            <span>{creatingRestorePoint ? 'Đang tạo...' : 'Restore Point'}</span>
          </button>
        </div>
      )}

      {/* Right: Window Controls */}
      <div className="flex h-full items-center" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button
          onClick={handleMinimize}
          title="Thu nhỏ"
          className="h-full px-3.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors flex items-center justify-center cursor-default"
        >
          <Minus className="h-3 w-3" strokeWidth={2} />
        </button>
        <button
          onClick={handleMaximize}
          title="Phóng to / Khôi phục"
          className="h-full px-3.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors flex items-center justify-center cursor-default"
        >
          <Square className="h-2.5 w-2.5" strokeWidth={2} />
        </button>
        <button
          onClick={handleClose}
          title="Đóng"
          className="h-full px-3.5 hover:bg-rose-600 text-slate-400 hover:text-white transition-colors flex items-center justify-center cursor-default"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

