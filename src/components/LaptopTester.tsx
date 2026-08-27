import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, Mic, Monitor, Fingerprint, Battery, HardDrive, Cpu, 
  X, Maximize, AlertTriangle, Keyboard as KeyboardIcon 
} from 'lucide-react';
import { createPortal } from 'react-dom';
import TouchScreenTester from './TouchScreenTester.js';

export default function LaptopTester() {
  const [activeTest, setActiveTest] = useState<string | null>(null);

  const handleDxDiag = async () => {
    try {
      await (window as any).electronAPI?.runDxDiag?.();
    } catch (e: any) {
      alert("Lỗi khởi chạy DxDiag: " + e.message);
    }
  };


  const cards = [
    { id: 'screen', name: 'Kiểm tra Màn hình', icon: <Monitor className="h-8 w-8 text-emerald-400" />, color: 'from-emerald-500 to-emerald-400' },
    { id: 'keyboard', name: 'Kiểm tra Bàn phím', icon: <KeyboardIcon className="h-8 w-8 text-cyan-400" />, color: 'from-cyan-500 to-cyan-400' },
    { id: 'webcam', name: 'Kiểm tra Webcam', icon: <Camera className="h-8 w-8 text-purple-400" />, color: 'from-purple-500 to-purple-400' },
    { id: 'mic', name: 'Kiểm tra Micro', icon: <Mic className="h-8 w-8 text-rose-400" />, color: 'from-rose-500 to-red-500' },
    { id: 'touch', name: 'Kiểm tra Cảm ứng', icon: <Fingerprint className="h-8 w-8 text-emerald-400" />, color: 'from-emerald-500 to-emerald-600' },
    { id: 'battery', name: 'Thông tin Pin', icon: <Battery className="h-8 w-8 text-amber-400" />, color: 'from-amber-400 to-orange-500' },
    { id: 'disk', name: 'Kiểm tra Ổ cứng', icon: <HardDrive className="h-8 w-8 text-blue-400" />, color: 'from-blue-600 to-blue-800' },
    { id: 'vga', name: 'Kiểm tra VGA', icon: <Cpu className="h-8 w-8 text-teal-400" />, color: 'from-teal-500 to-teal-600', action: handleDxDiag },
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="bg-gradient-to-r from-[#121c33] to-[#0f172a] p-6 rounded-2xl border border-slate-800 shadow-xl text-white">
        <h2 className="text-xl font-bold flex items-center gap-3">
          <Monitor className="h-6 w-6 text-emerald-400" />
          KIỂM TRA LAPTOP TOÀN DIỆN
        </h2>
        <p className="mt-1 text-slate-400 text-xs">
          Bộ công cụ 8 trong 1 giúp kỹ thuật viên test nhanh chóng các thành phần phần cứng máy tính một cách chuyên nghiệp.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(card => (
          <div 
            key={card.id}
            onClick={() => card.action ? card.action() : setActiveTest(card.id)}
            className="bg-[#131d33] border border-slate-800 p-6 rounded-2xl cursor-pointer hover:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-500/5 hover:-translate-y-1 transition-all duration-300 group flex flex-col items-center justify-center gap-4 text-slate-200"
          >
            <div className="p-4 bg-[#0e1626] rounded-2xl group-hover:scale-110 transition-transform shadow-inner border border-slate-800">
              {card.icon}
            </div>
            <span className="font-bold text-center text-xs tracking-wide text-white group-hover:text-emerald-400 transition-colors">{card.name}</span>
          </div>
        ))}
      </div>

      {activeTest && createPortal(
        <TestModal test={activeTest} onClose={() => setActiveTest(null)} />,
        document.body
      )}
    </div>
  );
}

function TestModal({ test, onClose }: { test: string, onClose: () => void }) {
  // Prevent body scrolling and request fullscreen
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    
    // Request fullscreen for screen and touch tests
    if (test === 'screen' || test === 'touch') {
      try {
        document.documentElement.requestFullscreen().catch(err => {
          console.warn(`Error attempting to enable fullscreen: ${err.message}`);
        });
      } catch (e) {}
    }

    return () => {
      document.body.style.overflow = '';
      if (document.fullscreenElement) {
        try {
          document.exitFullscreen().catch(() => {});
        } catch (e) {}
      }
    };
  }, [test]);

  // Handle ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] bg-[#0b0f19] flex flex-col items-center justify-center select-none animate-fade-in">
      <button 
        onClick={onClose}
        className="absolute top-6 right-6 p-3 bg-[#131d33] border border-slate-800 text-slate-300 hover:text-white rounded-full transition-all z-[110] shadow-xl hover:bg-[#18233c] cursor-pointer"
        title="Nhấn ESC để thoát"
      >
        <X className="h-5 w-5" />
      </button>
      
      <div className="w-full h-full relative">
        {test === 'screen' && <ScreenTest />}
        {test === 'keyboard' && <KeyboardTest onClose={onClose} />}
        {test === 'webcam' && <WebcamTest />}
        {test === 'mic' && <MicTest />}
        {test === 'touch' && <TouchScreenTester onBack={onClose} />}
        {test === 'battery' && <BatteryTest />}
        {test === 'disk' && <DiskTest />}
      </div>
    </div>
  );
}

// ========================
// 1. SCREEN TEST
// ========================
function ScreenTest() {
  const colors = ['bg-white', 'bg-black', 'bg-red-600', 'bg-green-600', 'bg-emerald-600', 'bg-yellow-400'];
  const [idx, setIdx] = useState(0);

  return (
    <div 
      className={`w-full h-full cursor-pointer ${colors[idx]} transition-colors duration-150 flex flex-col items-center justify-center group`}
      onClick={() => setIdx((idx + 1) % colors.length)}
    >
      <div className={`p-4 rounded-xl bg-black/60 text-white backdrop-blur-md text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity border border-white/10`}>
        Click chuột để đổi màu. Nhấn ESC để thoát.
      </div>
    </div>
  );
}

// ========================
// 2. KEYBOARD TEST
// ========================
function KeyboardTest({ onClose }: { onClose?: () => void }) {
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
  const [currentKey, setCurrentKey] = useState<string>('');
  const [layout, setLayout] = useState<'laptop' | 'full' | 'mac'>('full');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      const keyStr = e.code;
      setCurrentKey(e.key === ' ' ? 'Space' : e.key);
      setPressedKeys(prev => {
        const newSet = new Set(prev);
        newSet.add(keyStr);
        return newSet;
      });
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const renderKey = (code: string, label?: string, flex?: string, height?: string) => {
    const isPressed = pressedKeys.has(code);
    return (
      <div 
        key={code}
        className={`border rounded-lg flex items-center justify-center font-bold text-[10px] uppercase transition-all duration-75 select-none
          ${height ? height : 'h-10'}
          ${flex ? flex : 'w-10'}
          ${isPressed 
            ? 'bg-emerald-500 border-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/30 scale-[0.97]' 
            : 'bg-[#18233c] border-slate-700/80 text-slate-200 hover:bg-[#202f50]'
          }
        `}
      >
        {label || code.replace('Key', '').replace('Digit', '').replace('Numpad', '')}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0b0f19] p-4 flex flex-col items-center justify-center overflow-auto select-none">
      {/* Top Header & Layout Switcher Card */}
      <div className="w-full max-w-[1050px] mb-3 flex flex-wrap justify-between items-center gap-2 bg-[#131d33] p-3 rounded-2xl border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
            <span>⌨️</span> Kiểm Tra Bàn Phím
          </h3>
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            Đã nhận: {pressedKeys.size} phím
          </span>
        </div>

        {/* Layout Tabs */}
        <div className="flex bg-[#0e1626] p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setLayout('laptop')}
            className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${layout === 'laptop' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'}`}
          >
            💻 Laptop (75%)
          </button>
          <button
            onClick={() => setLayout('full')}
            className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${layout === 'full' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'}`}
          >
            ⌨️ Đầy Đủ (Full 100%)
          </button>
          <button
            onClick={() => setLayout('mac')}
            className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${layout === 'mac' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'}`}
          >
            🍎 Macbook Layout
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setPressedKeys(new Set()); setCurrentKey(''); }}
            className="px-3 py-1 bg-[#18233c] hover:bg-[#202f50] text-slate-200 rounded-lg text-[11px] font-bold transition cursor-pointer border border-slate-700 active:scale-95"
          >
            🔄 Reset
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500 hover:text-slate-950 text-rose-400 border border-rose-500/30 rounded-lg text-[11px] font-bold transition cursor-pointer active:scale-95"
            >
              ❌ Thoát (ESC)
            </button>
          )}
        </div>
      </div>

      {/* Current Key Indicator */}
      <div className="mb-3 text-center">
        <div className="text-lg font-black text-white h-7 font-mono flex items-center justify-center gap-2">
          {currentKey ? (
            <>
              <span className="text-xs text-slate-400 font-sans">Phím vừa gõ:</span>
              <span className="bg-[#131d33] px-3 py-0.5 rounded-lg border border-slate-700 shadow-sm text-emerald-400 font-mono text-sm">{currentKey}</span>
            </>
          ) : (
            <span className="text-xs text-slate-500 font-sans">Gõ bất kỳ phím nào để bắt đầu test...</span>
          )}
        </div>
      </div>

      {/* Keyboard Matrix Main Box */}
      <div className="p-4 bg-[#101728] rounded-2xl border border-slate-800 shadow-2xl flex gap-3 max-w-[1050px]">
        {/* Main QWERTY Block */}
        <div className="flex flex-col gap-1">
          {/* Function Row */}
          <div className="flex gap-1 mb-1">
            {renderKey('Escape', 'Esc', 'w-10')}
            <div className="w-2" />
            {renderKey('F1')} {renderKey('F2')} {renderKey('F3')} {renderKey('F4')}
            <div className="w-2" />
            {renderKey('F5')} {renderKey('F6')} {renderKey('F7')} {renderKey('F8')}
            <div className="w-2" />
            {renderKey('F9')} {renderKey('F10')} {renderKey('F11')} {renderKey('F12')}
          </div>

          {/* Number Row */}
          <div className="flex gap-1">
            {renderKey('Backquote', '` ~')}
            {renderKey('Digit1')} {renderKey('Digit2')} {renderKey('Digit3')} {renderKey('Digit4')}
            {renderKey('Digit5')} {renderKey('Digit6')} {renderKey('Digit7')} {renderKey('Digit8')}
            {renderKey('Digit9')} {renderKey('Digit0')}
            {renderKey('Minus', '- _')} {renderKey('Equal', '= +')}
            {renderKey('Backspace', 'Backspace', 'w-[76px]')}
          </div>

          {/* QWERTY Row */}
          <div className="flex gap-1">
            {renderKey('Tab', 'Tab', 'w-14')}
            {renderKey('KeyQ')} {renderKey('KeyW')} {renderKey('KeyE')} {renderKey('KeyR')}
            {renderKey('KeyT')} {renderKey('KeyY')} {renderKey('KeyU')} {renderKey('KeyI')}
            {renderKey('KeyO')} {renderKey('KeyP')}
            {renderKey('BracketLeft', '[ {')} {renderKey('BracketRight', '] }')}
            {renderKey('Backslash', '\\ |', 'w-[52px]')}
          </div>

          {/* ASDF Row */}
          <div className="flex gap-1">
            {renderKey('CapsLock', 'Caps', 'w-[64px]')}
            {renderKey('KeyA')} {renderKey('KeyS')} {renderKey('KeyD')} {renderKey('KeyF')}
            {renderKey('KeyG')} {renderKey('KeyH')} {renderKey('KeyJ')} {renderKey('KeyK')}
            {renderKey('KeyL')} {renderKey('Semicolon', '; :')} {renderKey('Quote', '\' "')}
            {renderKey('Enter', 'Enter', 'w-[84px]')}
          </div>

          {/* ZXCV Row */}
          <div className="flex gap-1">
            {renderKey('ShiftLeft', 'Shift', 'w-[84px]')}
            {renderKey('KeyZ')} {renderKey('KeyX')} {renderKey('KeyC')} {renderKey('KeyV')}
            {renderKey('KeyB')} {renderKey('KeyN')} {renderKey('KeyM')}
            {renderKey('Comma', ', <')} {renderKey('Period', '. >')} {renderKey('Slash', '/ ?')}
            {renderKey('ShiftRight', 'Shift', 'w-[104px]')}
          </div>

          {/* Bottom Control Row */}
          <div className="flex gap-1">
            {layout === 'mac' ? (
              <>
                {renderKey('ControlLeft', 'Control', 'w-12')}
                {renderKey('AltLeft', 'Option', 'w-12')}
                {renderKey('MetaLeft', '⌘ Cmd', 'w-14')}
                {renderKey('Space', 'Space', 'w-[250px]')}
                {renderKey('MetaRight', '⌘ Cmd', 'w-14')}
                {renderKey('AltRight', 'Option', 'w-12')}
              </>
            ) : (
              <>
                {renderKey('ControlLeft', 'Ctrl', 'w-12')}
                {renderKey('MetaLeft', 'Win', 'w-10')}
                {renderKey('AltLeft', 'Alt', 'w-10')}
                {renderKey('Space', 'Space', 'w-[250px]')}
                {renderKey('AltRight', 'Alt', 'w-10')}
                {renderKey('MetaRight', 'Win', 'w-10')}
                {renderKey('ContextMenu', 'App', 'w-10')}
                {renderKey('ControlRight', 'Ctrl', 'w-12')}
              </>
            )}

            {/* Arrows for Laptop Layout */}
            {layout === 'laptop' && (
              <div className="flex gap-1 ml-2">
                {renderKey('ArrowLeft', '←', 'w-9')}
                <div className="flex flex-col gap-0.5">
                  {renderKey('ArrowUp', '↑', 'w-9', 'h-[19px]')}
                  {renderKey('ArrowDown', '↓', 'w-9', 'h-[19px]')}
                </div>
                {renderKey('ArrowRight', '→', 'w-9')}
              </div>
            )}
          </div>
        </div>

        {/* Navigation Cluster (For Full Layout) */}
        {layout === 'full' && (
          <div className="flex flex-col gap-1 pl-3 border-l border-slate-800 justify-between">
            <div className="flex flex-col gap-1">
              <div className="flex gap-1">
                {renderKey('PrintScreen', 'PrtSc', 'w-10')}
                {renderKey('ScrollLock', 'ScrLk', 'w-10')}
                {renderKey('Pause', 'Pause', 'w-10')}
              </div>
              <div className="flex gap-1">
                {renderKey('Insert', 'Ins', 'w-10')}
                {renderKey('Home', 'Home', 'w-10')}
                {renderKey('PageUp', 'PgUp', 'w-10')}
              </div>
              <div className="flex gap-1">
                {renderKey('Delete', 'Del', 'w-10')}
                {renderKey('End', 'End', 'w-10')}
                {renderKey('PageDown', 'PgDn', 'w-10')}
              </div>
            </div>

            {/* Navigation Arrows */}
            <div className="flex flex-col items-center gap-1 mt-auto">
              {renderKey('ArrowUp', '↑', 'w-10')}
              <div className="flex gap-1">
                {renderKey('ArrowLeft', '←', 'w-10')}
                {renderKey('ArrowDown', '↓', 'w-10')}
                {renderKey('ArrowRight', '→', 'w-10')}
              </div>
            </div>
          </div>
        )}

        {/* Numpad Tenkey Cluster (For Full Layout) */}
        {layout === 'full' && (
          <div className="flex flex-col gap-1 pl-3 border-l border-slate-800">
            {/* Top Row: Num, /, *, - */}
            <div className="flex gap-1 mb-0.5">
              {renderKey('NumLock', 'Num', 'w-10')}
              {renderKey('NumpadDivide', '/', 'w-10')}
              {renderKey('NumpadMultiply', '*', 'w-10')}
              {renderKey('NumpadSubtract', '-', 'w-10')}
            </div>

            {/* Middle Section: 3x4 Numpad Grid + Plus / Enter Column */}
            <div className="flex gap-1">
              {/* Left 3-Column Number Block */}
              <div className="flex flex-col gap-1">
                <div className="flex gap-1">
                  {renderKey('Numpad7', '7', 'w-10')}
                  {renderKey('Numpad8', '8', 'w-10')}
                  {renderKey('Numpad9', '9', 'w-10')}
                </div>
                <div className="flex gap-1">
                  {renderKey('Numpad4', '4', 'w-10')}
                  {renderKey('Numpad5', '5', 'w-10')}
                  {renderKey('Numpad6', '6', 'w-10')}
                </div>
                <div className="flex gap-1">
                  {renderKey('Numpad1', '1', 'w-10')}
                  {renderKey('Numpad2', '2', 'w-10')}
                  {renderKey('Numpad3', '3', 'w-10')}
                </div>
                <div className="flex gap-1">
                  {renderKey('Numpad0', '0', 'w-[84px]')}
                  {renderKey('NumpadDecimal', '.', 'w-10')}
                </div>
              </div>

              {/* Right Column: Tall Plus (+) and Tall Enter (↵) */}
              <div className="flex flex-col gap-1 justify-between">
                {renderKey('NumpadAdd', '+', 'w-10', 'h-[84px]')}
                {renderKey('NumpadEnter', '↵', 'w-10', 'h-[84px]')}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ========================
// 3. WEBCAM TEST
// ========================
function WebcamTest() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(stream => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(err => {
        setError(err.message);
      });

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#0b0f19] p-8">
      <h3 className="text-xl font-bold text-white mb-6">Kiểm Tra Webcam</h3>
      <div className="relative w-full max-w-4xl aspect-video bg-[#131d33] rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center text-rose-400 font-bold p-8 text-center bg-[#0b0f19]/90 text-sm">
            <AlertTriangle className="h-8 w-8 mr-3 text-rose-500" /> Lỗi Webcam: {error}
          </div>
        ) : (
          <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover mirror-horizontally scale-x-[-1]" />
        )}
      </div>
    </div>
  );
}

// ========================
// 4. MIC TEST
// ========================
function MicTest() {
  const [vol, setVol] = useState(0);
  const [error, setError] = useState('');
  const reqRef = useRef<number>();
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        streamRef.current = stream;
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioCtxRef.current = audioCtx;
        const analyser = audioCtx.createAnalyser();
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);
        analyser.fftSize = 256;
        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const render = () => {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          setVol(avg);
          reqRef.current = requestAnimationFrame(render);
        };
        render();
      })
      .catch(err => setError(err.message));

    return () => {
      if (reqRef.current) cancelAnimationFrame(reqRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      audioCtxRef.current?.close();
    };
  }, []);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#0b0f19] p-8">
      <h3 className="text-xl font-bold text-white mb-10">Kiểm Tra Micro</h3>
      {error ? (
        <div className="text-rose-400 font-bold flex items-center text-sm"><AlertTriangle className="mr-2 text-rose-500" /> {error}</div>
      ) : (
        <div className="flex flex-col items-center gap-10">
          <div className="relative flex items-center justify-center w-64 h-64">
            <div 
              className="absolute bg-emerald-500/10 rounded-full transition-all duration-75"
              style={{ width: `${100 + vol * 2}%`, height: `${100 + vol * 2}%` }}
            />
            <div 
              className="absolute bg-emerald-500/20 rounded-full transition-all duration-75"
              style={{ width: `${100 + vol}%`, height: `${100 + vol}%` }}
            />
            <div className="relative z-10 p-8 bg-emerald-500 text-slate-950 rounded-full shadow-lg shadow-emerald-500/30">
              <Mic className="h-16 w-16" />
            </div>
          </div>
          <p className="text-slate-400 text-xs">Hãy nói gì đó, vòng sóng âm sẽ thay đổi độ lớn theo âm lượng giọng của bạn.</p>
        </div>
      )}
    </div>
  );
}

// ========================
// 6. BATTERY TEST
// ========================
function BatteryTest() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [openingReport, setOpeningReport] = useState(false);

  useEffect(() => {
    (window as any).electronAPI?.getBatteryHealth?.()
      .then((res: any) => {
        setData(res);
        setLoading(false);
      })
      .catch(() => {
        setData({ noBattery: true });
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="text-slate-400 text-center p-20 text-xs">Đang tải thông tin pin...</div>;

  const design = parseInt(data?.designCapacity ?? data?.DesignCapacity) || 0;
  const full = parseInt(data?.fullChargeCapacity ?? data?.FullChargeCapacity) || 0;
  const cycleCount = parseInt(data?.cycleCount ?? data?.CycleCount) || 0;
  const noBattery = data?.noBattery === true || (design === 0 && full === 0);
  const isPartialData = design > 0 && full === 0;

  const hasValidData = design > 0 && full > 0 && full <= design;
  const health = hasValidData ? ((full / design) * 100).toFixed(1) : (data?.healthPercent ? data.healthPercent : '100');
  const wearNum = hasValidData ? Math.max(0, 100 - (full / design) * 100) : 0;
  const wear = wearNum !== null ? wearNum.toFixed(1) : '0';

  const handleOpenHtmlReport = async () => {
    setOpeningReport(true);
    try {
      const res = await (window as any).electronAPI?.openBatteryReportHtml?.();
      if (res && res.success === false) alert("⚠️ Lỗi xuất báo cáo: " + res.error);
    } catch (e: any) {
      alert("Lỗi: " + e.message);
    } finally {
      setOpeningReport(false);
    }
  };


  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#0b0f19] p-8">
      <div className="bg-[#131d33] border border-slate-800 p-8 rounded-3xl w-full max-w-2xl shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-5">
          <h3 className="text-xl font-bold text-white flex items-center gap-3">
            <Battery className="text-emerald-400 h-7 w-7" /> Thông Tin Sức Khỏe Pin
          </h3>
          <button
            onClick={handleOpenHtmlReport}
            disabled={openingReport}
            className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
          >
            <span>{openingReport ? 'Đang xuất báo cáo...' : '📄 Báo Cáo HTML Chi Tiết'}</span>
          </button>
        </div>

        {noBattery ? (
          <div className="text-amber-400 font-bold flex items-center gap-2 p-4 bg-amber-500/10 rounded-xl border border-amber-500/30 text-xs">
            <AlertTriangle className="h-5 w-5 shrink-0" /> Máy tính không có pin (PC để bàn) hoặc không thể nhận diện pin.
          </div>
        ) : design === 0 ? (
          <div className="text-rose-400 font-bold flex items-center gap-2 p-4 bg-rose-500/10 rounded-xl border border-rose-500/30 text-xs">
            <AlertTriangle className="h-5 w-5 shrink-0" /> Không thể đọc thông tin pin. Vui lòng thử nút "📄 Báo Cáo HTML Chi Tiết" để xem chi tiết.
          </div>
        ) : isPartialData ? (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-[#0e1626] p-4 rounded-xl border border-slate-800">
                <div className="text-slate-400 text-xs mb-1">Dung lượng thiết kế</div>
                <div className="text-base font-bold text-white font-mono">{design} mWh</div>
              </div>
              <div className="bg-[#0e1626] p-4 rounded-xl border border-slate-800">
                <div className="text-slate-400 text-xs mb-1">Sạc đầy hiện tại</div>
                <div className="text-base font-bold text-slate-500">Không có dữ liệu</div>
              </div>
              <div className="bg-[#0e1626] p-4 rounded-xl border border-slate-800">
                <div className="text-slate-400 text-xs mb-1">Số chu kỳ sạc</div>
                <div className="text-base font-bold text-emerald-400 font-mono">{cycleCount > 0 ? `${cycleCount} lần` : 'Chưa ghi nhận'}</div>
              </div>
            </div>
            <div className="bg-amber-500/10 p-4 rounded-xl border border-amber-500/30 text-amber-300 text-xs leading-relaxed">
              ⚠️ Máy này chỉ trả về dung lượng thiết kế nhưng thiếu thông tin sạc đầy. Không thể tính sức khỏe pin chính xác.
              Vui lòng xem <strong>Báo Cáo HTML Chi Tiết</strong> để có dữ liệu đầy đủ.
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-[#0e1626] p-4 rounded-xl border border-slate-800">
                <div className="text-slate-400 text-xs mb-1">Dung lượng thiết kế</div>
                <div className="text-base font-bold text-white font-mono">{design} mWh</div>
              </div>
              <div className="bg-[#0e1626] p-4 rounded-xl border border-slate-800">
                <div className="text-slate-400 text-xs mb-1">Sạc đầy hiện tại</div>
                <div className="text-base font-bold text-white font-mono">{full} mWh</div>
              </div>
              <div className="bg-[#0e1626] p-4 rounded-xl border border-slate-800">
                <div className="text-slate-400 text-xs mb-1">Số chu kỳ sạc</div>
                <div className="text-base font-bold text-emerald-400 font-mono">{cycleCount > 0 ? `${cycleCount} lần` : 'Chưa ghi nhận'}</div>
              </div>
            </div>
            
            <div className="bg-[#0e1626] p-6 rounded-2xl flex items-center justify-between border border-slate-800">
              <div>
                <div className="text-slate-400 text-xs mb-1">Độ chai pin (Wear Level)</div>
                <div className={`text-3xl font-black font-mono ${wearNum! > 30 ? 'text-rose-400' : wearNum! > 15 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {wear}%
                </div>
              </div>
              <div className="text-right">
                <div className="text-slate-400 text-xs mb-1">Đánh giá sức khỏe (Health)</div>
                <div className="text-3xl font-black font-mono text-emerald-400">{health}%</div>
              </div>
            </div>
          </div>
        )}

        <div className="p-3 bg-[#0e1626] border border-slate-800 rounded-xl text-[11px] text-slate-400 italic">
          💡 Bấm nút <strong>"📄 Báo Cáo HTML Chi Tiết"</strong> để mở file báo cáo đầy đủ lịch sử sạc xả PIN từ Microsoft Windows.
        </div>
      </div>
    </div>
  );
}

// ========================
// 7. DISK TEST
// ========================
function DiskTest() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (window as any).electronAPI?.getDiskHealth?.()
      .then((res: any) => {
        const disks = Array.isArray(res) ? res : (res?.data ?? []);
        setData(Array.isArray(disks) ? disks : []);
        setLoading(false);
      })
      .catch(() => {
        setData([]);
        setLoading(false);
      });
  }, []);


  if (loading) return <div className="text-slate-400 text-center p-20 text-xs">Đang tải thông tin ổ cứng...</div>;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#0b0f19] p-8">
      <div className="bg-[#131d33] border border-slate-800 p-8 rounded-3xl w-full max-w-4xl shadow-2xl space-y-6">
        <h3 className="text-xl font-bold text-white flex items-center gap-3 border-b border-slate-800 pb-5">
          <HardDrive className="text-emerald-400 h-7 w-7" /> Thông Tin Sức Khỏe Ổ Cứng S.M.A.R.T
        </h3>
        
        {data.length === 0 ? (
          <div className="text-rose-400 font-bold p-4 bg-rose-500/10 rounded-xl border border-rose-500/30 text-xs">Không lấy được thông tin ổ cứng.</div>
        ) : (
          <div className="space-y-3">
            {data.map((d, i) => (
              <div key={i} className="flex items-center gap-5 bg-[#0e1626] p-4 rounded-2xl border border-slate-800">
                <div className="p-3.5 bg-[#131d33] rounded-xl shrink-0 border border-slate-800">
                  <HardDrive className="h-6 w-6 text-emerald-400" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="font-bold text-sm text-white">{d.FriendlyName || d.DeviceId || 'Unknown Disk'}</div>
                  <div className="flex gap-4 text-xs font-medium">
                    <span className="text-slate-400">Loại: <span className="text-slate-200">{d.MediaType || 'Unknown'}</span></span>
                    <span className="text-slate-400">Dung lượng: <span className="text-emerald-400 font-mono">{d.Size ? (d.Size / 1073741824).toFixed(1) + ' GB' : 'N/A'}</span></span>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-base font-bold uppercase ${d.HealthStatus === 'Healthy' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {d.HealthStatus === 'Healthy' ? 'TỐT (OK)' : d.HealthStatus}
                  </div>
                  <div className="text-slate-500 text-[10px] mt-0.5">Trạng thái S.M.A.R.T</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

