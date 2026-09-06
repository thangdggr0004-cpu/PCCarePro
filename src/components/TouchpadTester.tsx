import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Touchpad, CheckCircle2, RotateCcw, ArrowUpDown, ArrowLeftRight, 
  ZoomIn, Activity, MousePointer, Info, Sparkles 
} from 'lucide-react';

interface Point {
  x: number;
  y: number;
  time: number;
}

export default function TouchpadTester({ onBack }: { onBack?: () => void }) {
  // Test states
  const [leftClickTested, setLeftClickTested] = useState(false);
  const [rightClickTested, setRightClickTested] = useState(false);
  const [middleClickTested, setMiddleClickTested] = useState(false);
  const [trackingTested, setTrackingTested] = useState(false);
  const [scrollVTested, setScrollVTested] = useState(false);
  const [scrollHTested, setScrollHTested] = useState(false);
  const [zoomTested, setZoomTested] = useState(false);

  // Active button pressed states (live feedback)
  const [activeButtons, setActiveButtons] = useState({ left: false, right: false, middle: false });

  // Real-time diagnostics
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [pollingRate, setPollingRate] = useState<number>(0);
  const [speed, setSpeed] = useState<number>(0);
  const [scrollDirection, setScrollDirection] = useState<string>('');
  const [scrollValue, setScrollValue] = useState<{ v: number; h: number }>({ v: 0, h: 0 });
  const [escPrompt, setEscPrompt] = useState(false);

  // Refs for tracking calculations & canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const touchAreaRef = useRef<HTMLDivElement | null>(null);
  const pointsRef = useRef<Point[]>([]);
  const lastEventTimeRef = useRef<number>(0);
  const eventCountRef = useRef<number>(0);
  const lastCalcTimeRef = useRef<number>(performance.now());
  const escTimerRef = useRef<any>(null);

  // Handle ESC double press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (escTimerRef.current) {
          clearTimeout(escTimerRef.current);
          escTimerRef.current = null;
          setEscPrompt(false);
          if (onBack) onBack();
        } else {
          setEscPrompt(true);
          escTimerRef.current = setTimeout(() => {
            escTimerRef.current = null;
            setEscPrompt(false);
          }, 1500);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (escTimerRef.current) clearTimeout(escTimerRef.current);
    };
  }, [onBack]);

  // Calculate Polling Rate & Speed periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const now = performance.now();
      const elapsed = (now - lastCalcTimeRef.current) / 1000;
      if (elapsed > 0) {
        const rate = Math.round(eventCountRef.current / elapsed);
        setPollingRate(rate);
        eventCountRef.current = 0;
        lastCalcTimeRef.current = now;
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Resize canvas when container size changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const updateSize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      redrawCanvas();
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw subtle grid dots
    ctx.fillStyle = '#1e293b';
    const gap = 24;
    for (let x = gap; x < canvas.width; x += gap) {
      for (let y = gap; y < canvas.height; y += gap) {
        ctx.beginPath();
        ctx.arc(x, y, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw trailing line
    const pts = pointsRef.current;
    if (pts.length < 2) return;

    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let i = 1; i < pts.length; i++) {
      const p1 = pts[i - 1];
      const p2 = pts[i];
      const alpha = Math.max(0.1, i / pts.length);
      ctx.strokeStyle = `rgba(16, 185, 129, ${alpha})`;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    // Draw latest point circle
    const last = pts[pts.length - 1];
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(last.x, last.y, 6, 0, Math.PI * 2);
    ctx.fill();
  }, []);

  // Pointer Movement in Touchpad Area
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);

    const now = performance.now();
    eventCountRef.current += 1;

    // Calculate speed
    if (lastEventTimeRef.current > 0 && pointsRef.current.length > 0) {
      const lastPt = pointsRef.current[pointsRef.current.length - 1];
      const dt = (now - lastEventTimeRef.current) / 1000;
      if (dt > 0) {
        const dist = Math.hypot(x - lastPt.x, y - lastPt.y);
        setSpeed(Math.round(dist / dt));
      }
    }
    lastEventTimeRef.current = now;

    setCursorPos({ x, y });
    setTrackingTested(true);

    // Keep last 150 points for smooth trailing path
    pointsRef.current.push({ x, y, time: now });
    if (pointsRef.current.length > 150) {
      pointsRef.current.shift();
    }
    redrawCanvas();
  };

  // Pointer Down (Click / Tap)
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button === 0) {
      setLeftClickTested(true);
      setActiveButtons(prev => ({ ...prev, left: true }));
    } else if (e.button === 1) {
      setMiddleClickTested(true);
      setActiveButtons(prev => ({ ...prev, middle: true }));
    } else if (e.button === 2) {
      setRightClickTested(true);
      setActiveButtons(prev => ({ ...prev, right: true }));
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (e.button === 0) setActiveButtons(prev => ({ ...prev, left: false }));
    else if (e.button === 1) setActiveButtons(prev => ({ ...prev, middle: false }));
    else if (e.button === 2) setActiveButtons(prev => ({ ...prev, right: false }));
  };

  // Wheel Event (2-Finger Scroll & Pinch Zoom)
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();

    // Check Pinch-to-Zoom (Ctrl key pressed during wheel event)
    if (e.ctrlKey) {
      setZoomTested(true);
      setScrollDirection(e.deltaY < 0 ? 'Zoom In (Phóng to)' : 'Zoom Out (Thu nhỏ)');
      return;
    }

    // Vertical Scroll
    if (Math.abs(e.deltaY) > 2) {
      setScrollVTested(true);
      setScrollValue(prev => ({
        ...prev,
        v: Math.max(-100, Math.min(100, prev.v + (e.deltaY > 0 ? 10 : -10)))
      }));
      setScrollDirection(e.deltaY > 0 ? 'Cuộn Xuống ⬇️' : 'Cuộn Lên ⬆️');
    }

    // Horizontal Scroll
    if (Math.abs(e.deltaX) > 2) {
      setScrollHTested(true);
      setScrollValue(prev => ({
        ...prev,
        h: Math.max(-100, Math.min(100, prev.h + (e.deltaX > 0 ? 10 : -10)))
      }));
      setScrollDirection(e.deltaX > 0 ? 'Cuộn Phải ➡️' : 'Cuộn Trái ⬅️');
    }
  };

  // Reset all tests
  const handleReset = () => {
    setLeftClickTested(false);
    setRightClickTested(false);
    setMiddleClickTested(false);
    setTrackingTested(false);
    setScrollVTested(false);
    setScrollHTested(false);
    setZoomTested(false);
    setActiveButtons({ left: false, right: false, middle: false });
    setCursorPos(null);
    setSpeed(0);
    setPollingRate(0);
    setScrollDirection('');
    setScrollValue({ v: 0, h: 0 });
    pointsRef.current = [];
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  // Check overall completion
  const testedCount = [
    leftClickTested,
    rightClickTested,
    trackingTested,
    scrollVTested
  ].filter(Boolean).length;

  const isAllTested = testedCount === 4;

  return (
    <div className="w-full h-full bg-[#0b0f19] flex flex-col p-6 overflow-y-auto select-none">
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/20 border border-amber-500/30 rounded-xl text-amber-400 shadow-sm">
            <Touchpad className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              KIỂM TRA TOUCHPAD LAPTOP
              {isAllTested && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Hoạt động tốt 100%
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400">
              Kiểm tra độ nhạy cảm ứng, phím chuột trái / phải, cử chỉ cuộn 2 ngón và điểm chết bàn di.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#131d33] hover:bg-[#1a2744] text-slate-300 hover:text-white border border-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer active:scale-95"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Xóa kết quả
          </button>
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-500/20 hover:bg-rose-500 hover:text-slate-950 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold transition cursor-pointer active:scale-95"
            >
              <span>❌ Thoát</span>
            </button>
          )}
        </div>
      </div>

      {/* ESC Exit Prompt */}
      {escPrompt && (
        <div className="mt-3 px-4 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-semibold animate-pulse shadow-md text-center">
          ⚠️ Đã nhận phím ESC. Nhấn ESC thêm 1 lần nữa để thoát, hoặc bấm nút &quot;Thoát&quot; ở trên.
        </div>
      )}

      {/* Main Content: 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mt-4 flex-1">
        
        {/* Left Column: Virtual Touchpad Surface (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-3">
          <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <MousePointer className="w-4 h-4 text-emerald-400" /> Bề mặt Bàn di chuột ảo (Di ngón tay &amp; Click vào đây)
            </span>
            {cursorPos && (
              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                X: {cursorPos.x}px | Y: {cursorPos.y}px
              </span>
            )}
          </div>

          {/* Touchpad Physical Simulation Box */}
          <div 
            ref={touchAreaRef}
            onPointerMove={handlePointerMove}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onWheel={handleWheel}
            onContextMenu={(e) => { e.preventDefault(); setRightClickTested(true); }}
            className="relative flex-1 min-h-[360px] bg-gradient-to-b from-[#101726] to-[#0c121e] border-2 border-slate-700 hover:border-emerald-500/60 rounded-3xl p-3 flex flex-col shadow-2xl overflow-hidden transition-colors cursor-crosshair"
            style={{ touchAction: 'none' }}
          >
            {/* Canvas for trailing trace */}
            <canvas 
              ref={canvasRef} 
              className="absolute inset-0 w-full h-full pointer-events-none rounded-3xl" 
            />

            {/* Hint overlay when not interacted yet */}
            {!trackingTested && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-slate-500 text-center gap-2">
                <Touchpad className="w-12 h-12 text-slate-600 animate-pulse" />
                <p className="text-sm font-medium text-slate-400">
                  Di ngón tay lên Touchpad để kiểm tra độ nhạy &amp; vẽ đường theo dõi
                </p>
                <p className="text-[11px] text-slate-500">
                  Thử chạm 1 ngón, chạm 2 ngón (chuột phải), và cuộn 2 ngón tay lên/xuống
                </p>
              </div>
            )}

            <div className="flex-1"></div>

            {/* Bottom Virtual Buttons (Left / Right Click) */}
            <div className="relative z-10 grid grid-cols-2 gap-2 mt-auto pt-3 border-t border-slate-800">
              {/* Left Click Area */}
              <div
                className={`py-3 px-4 rounded-xl border text-center font-bold text-xs transition-all ${
                  activeButtons.left
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 scale-[0.98] shadow-lg shadow-emerald-500/30'
                    : leftClickTested
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                    : 'bg-[#141e33] text-slate-400 border-slate-700 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-center gap-1.5">
                  {leftClickTested && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  <span>CHUỘT TRÁI (LEFT CLICK)</span>
                </div>
                <div className="text-[10px] font-normal text-slate-400 mt-0.5">
                  {leftClickTested ? '✓ Đã nhận tín hiệu' : 'Click hoặc nhấn nửa trái'}
                </div>
              </div>

              {/* Right Click Area */}
              <div
                className={`py-3 px-4 rounded-xl border text-center font-bold text-xs transition-all ${
                  activeButtons.right
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400 scale-[0.98] shadow-lg shadow-cyan-500/30'
                    : rightClickTested
                    ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40'
                    : 'bg-[#141e33] text-slate-400 border-slate-700 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-center gap-1.5">
                  {rightClickTested && <CheckCircle2 className="w-4 h-4 text-cyan-400" />}
                  <span>CHUỘT PHẢI (RIGHT CLICK)</span>
                </div>
                <div className="text-[10px] font-normal text-slate-400 mt-0.5">
                  {rightClickTested ? '✓ Đã nhận tín hiệu' : 'Chạm 2 ngón hoặc click nửa phải'}
                </div>
              </div>
            </div>
          </div>

          {/* Quick HUD Metrics under Touchpad */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="bg-[#131d33] border border-slate-800 rounded-xl p-2.5 text-center">
              <div className="text-[10px] text-slate-400 font-medium">Tốc độ di trỏ</div>
              <div className="text-base font-bold font-mono text-emerald-400 mt-0.5">
                {speed} <span className="text-[10px] text-slate-400 font-sans">px/s</span>
              </div>
            </div>

            <div className="bg-[#131d33] border border-slate-800 rounded-xl p-2.5 text-center">
              <div className="text-[10px] text-slate-400 font-medium flex items-center justify-center gap-1">
                <Activity className="w-3 h-3 text-cyan-400" /> Tần số phản hồi (Polling)
              </div>
              <div className="text-base font-bold font-mono text-cyan-400 mt-0.5">
                {pollingRate} <span className="text-[10px] text-slate-400 font-sans">Hz</span>
              </div>
            </div>

            <div className="bg-[#131d33] border border-slate-800 rounded-xl p-2.5 text-center">
              <div className="text-[10px] text-slate-400 font-medium">Tín hiệu cuộn gần nhất</div>
              <div className="text-xs font-bold text-amber-400 mt-1 truncate">
                {scrollDirection || 'Chưa cuộn 2 ngón'}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Gestures, Scroll Test & Checklists (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          
          {/* Scroll & Gesture Test Zone */}
          <div 
            onWheel={handleWheel}
            className="bg-[#131d33] border border-slate-800 hover:border-amber-500/50 rounded-2xl p-4 transition shadow-md"
          >
            <h4 className="text-xs font-bold text-white flex items-center gap-2 mb-2">
              <ArrowUpDown className="w-4 h-4 text-amber-400" /> Vùng test Cuộn 2 ngón &amp; Zoom
            </h4>
            <p className="text-[11px] text-slate-400 mb-3">
              Đặt 2 ngón tay lên touchpad và vuốt lên/xuống hoặc trái/phải trên khung này:
            </p>

            {/* Vertical Scroll Gauge */}
            <div className="space-y-2 mb-3">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400 flex items-center gap-1">
                  <ArrowUpDown className="w-3 h-3 text-emerald-400" /> Cuộn dọc (Lên / Xuống)
                </span>
                <span className={`font-bold ${scrollVTested ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {scrollVTested ? '✓ Đạt' : 'Chưa test'}
                </span>
              </div>
              <div className="h-2 bg-[#0a0f1d] rounded-full overflow-hidden border border-slate-700">
                <div 
                  className="h-full bg-emerald-500 transition-all duration-150" 
                  style={{ width: `${Math.abs(scrollValue.v)}%`, marginLeft: scrollValue.v < 0 ? 0 : 'auto' }}
                />
              </div>
            </div>

            {/* Horizontal Scroll Gauge */}
            <div className="space-y-2 mb-3">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400 flex items-center gap-1">
                  <ArrowLeftRight className="w-3 h-3 text-cyan-400" /> Cuộn ngang (Trái / Phải)
                </span>
                <span className={`font-bold ${scrollHTested ? 'text-cyan-400' : 'text-slate-500'}`}>
                  {scrollHTested ? '✓ Đạt' : 'Chưa test'}
                </span>
              </div>
              <div className="h-2 bg-[#0a0f1d] rounded-full overflow-hidden border border-slate-700">
                <div 
                  className="h-full bg-cyan-500 transition-all duration-150" 
                  style={{ width: `${Math.abs(scrollValue.h)}%`, marginLeft: scrollValue.h < 0 ? 0 : 'auto' }}
                />
              </div>
            </div>

            {/* Pinch Zoom Status */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-[#0e1626] border border-slate-800 text-[11px]">
              <span className="text-slate-300 flex items-center gap-1.5">
                <ZoomIn className="w-3.5 h-3.5 text-purple-400" /> Pinch Zoom (Chụm 2 ngón)
              </span>
              <span className={`font-semibold ${zoomTested ? 'text-purple-400' : 'text-slate-500'}`}>
                {zoomTested ? '✓ Đạt' : 'Chưa test'}
              </span>
            </div>
          </div>

          {/* Diagnostic Checklist */}
          <div className="bg-[#131d33] border border-slate-800 rounded-2xl p-4 flex-1">
            <h4 className="text-xs font-bold text-white flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-emerald-400" /> Danh mục kiểm tra Touchpad
            </h4>

            <div className="space-y-2.5">
              {[
                { label: 'Chuột trái (Left Click / 1-finger tap)', tested: leftClickTested, required: true },
                { label: 'Chuột phải (Right Click / 2-finger tap)', tested: rightClickTested, required: true },
                { label: 'Chuột giữa (Middle Click / 3-finger tap)', tested: middleClickTested, required: false },
                { label: 'Cảm ứng & Di chuyển không đứt nét', tested: trackingTested, required: true },
                { label: 'Cử chỉ Cuộn 2 ngón (Scroll Up/Down)', tested: scrollVTested, required: true },
                { label: 'Cử chỉ Cuộn ngang (Scroll Left/Right)', tested: scrollHTested, required: false },
                { label: 'Cử chỉ Thu phóng (Pinch to Zoom)', tested: zoomTested, required: false }
              ].map((item, idx) => (
                <div 
                  key={idx}
                  className={`flex items-center justify-between p-2 rounded-xl text-xs transition border ${
                    item.tested 
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                      : 'bg-[#0e1626] border-slate-800 text-slate-400'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className={`w-3.5 h-3.5 ${item.tested ? 'text-emerald-400' : 'text-slate-600'}`} />
                    <span>{item.label}</span>
                  </span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    item.tested ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-500'
                  }`}>
                    {item.tested ? 'ĐÃ TEST' : item.required ? 'CẦN TEST' : 'TÙY CHỌN'}
                  </span>
                </div>
              ))}
            </div>

            {/* Quick Summary Tip */}
            <div className="mt-4 p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/50 text-[11px] text-slate-400">
              💡 <span className="font-semibold text-slate-300">Mẹo kỹ thuật:</span> Nếu vệt vẽ trên bàn di bị đứt quãng hoặc trỏ chuột giật nhảy, touchpad có thể bị ẩm, bám bụi bẩn, lỏng cáp flex hoặc hỏng bề mặt cảm ứng.
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
