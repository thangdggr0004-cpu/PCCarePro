import React, { useEffect, useRef, useState, useCallback } from 'react';
import { LogOut, RotateCcw } from 'lucide-react';

const CELL_SIZE = 40;

export default function TouchScreenTester({ onBack }: { onBack: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const touchedCellsRef = useRef<Set<string>>(new Set());
  const [cols, setCols] = useState(0);
  const [rows, setRows] = useState(0);

  useEffect(() => {
    // Prevent scrolling or zooming while testing
    const preventDefault = (e: Event) => e.preventDefault();
    document.addEventListener('touchmove', preventDefault, { passive: false });
    document.addEventListener('contextmenu', preventDefault);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onBack();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('touchmove', preventDefault);
      document.removeEventListener('contextmenu', preventDefault);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onBack]);


  const drawGrid = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number, touched: Set<string>) => {
    const c = Math.ceil(width / CELL_SIZE);
    const r = Math.ceil(height / CELL_SIZE);
    
    // Background - untouched color (Deep Slate)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    // Draw touched cells (Emerald)
    ctx.fillStyle = '#10b981';
    touched.forEach(key => {
      const [cx, cy] = key.split(',').map(Number);
      ctx.fillRect(cx * CELL_SIZE, cy * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    });

    // Draw grid lines
    ctx.strokeStyle = '#334155';
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1;
    
    ctx.beginPath();
    for (let x = 0; x <= width; x += CELL_SIZE) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = 0; y <= height; y += CELL_SIZE) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1.0;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Resize canvas to match the container
    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
        setCols(Math.ceil(canvas.width / CELL_SIZE));
        setRows(Math.ceil(canvas.height / CELL_SIZE));
        
        const ctx = canvas.getContext('2d');
        if (ctx) drawGrid(ctx, canvas.width, canvas.height, touchedCellsRef.current);
      }
    };

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    return () => window.removeEventListener('resize', resizeCanvas);
  }, [drawGrid]);

  const clearCanvas = () => {
    touchedCellsRef.current.clear();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) drawGrid(ctx, canvas.width, canvas.height, touchedCellsRef.current);
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    
    // Handle both touch and mouse events
    let clientX, clientY;
    
    if ('touches' in e) {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      // For mouse, we only care if button is pressed
      if (e.buttons !== 1) return;
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    const col = Math.floor(x / CELL_SIZE);
    const row = Math.floor(y / CELL_SIZE);
    
    // Boundary check
    if (col < 0 || col >= cols || row < 0 || row >= rows) return;
    
    const key = `${col},${row}`;
    
    // If not touched yet, add and render just this cell
    if (!touchedCellsRef.current.has(key)) {
      touchedCellsRef.current.add(key);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#10b981';
        ctx.fillRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        
        ctx.strokeStyle = '#334155';
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1;
        ctx.strokeRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        ctx.globalAlpha = 1.0;
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center">
      {/* Top Instruction Banner */}
      <div className="absolute top-4 w-full px-6 flex justify-center items-center z-10 pointer-events-none">
        <div className="bg-slate-800/80 text-white text-xs sm:text-sm font-bold px-6 py-2 rounded-full backdrop-blur-sm shadow-lg border border-slate-700">
          Vuốt ngón tay khắp màn hình để tô màu. Nhấn ESC hoặc nút (X) để thoát.
        </div>
      </div>

      {/* Floating Action Controls */}
      <div className="absolute bottom-6 right-6 flex items-center gap-3 z-20">
        <button
          onClick={clearCanvas}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800/90 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 shadow-xl text-xs font-bold transition cursor-pointer active:scale-95"
        >
          <RotateCcw className="w-4 h-4 text-emerald-400" /> Làm lại
        </button>
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 bg-rose-600/90 hover:bg-rose-500 text-white rounded-xl border border-rose-500 shadow-xl text-xs font-bold transition cursor-pointer active:scale-95"
        >
          <LogOut className="w-4 h-4" /> Thoát
        </button>
      </div>

      <div className="w-full h-full cursor-crosshair">
        <canvas
          ref={canvasRef}
          className="w-full h-full touch-none block"
          onMouseMove={handlePointerMove}
          onMouseDown={handlePointerMove}
          onTouchMove={handlePointerMove}
          onTouchStart={handlePointerMove}
        />
      </div>
    </div>
  );
}

