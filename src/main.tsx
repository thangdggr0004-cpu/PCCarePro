import {StrictMode, Component, ErrorInfo, ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import {tauriBridge} from './tauri/bridge.ts';
import App from './App.tsx';
import './index.css';

// Keep bridge alive — prevent tree-shaking
void tauriBridge;
console.log('[Tauri] main.tsx loaded, bridge initialized');

window.addEventListener('error', (e) => {
  console.error('[GLOBAL WINDOW ERROR]:', e.error || e.message);
  const rootEl = document.getElementById('root');
  if (rootEl) {
    rootEl.innerHTML = `<div style="color: #ef4444; padding: 20px; font-family: sans-serif; background: #0b0f19; z-index: 99999; position: relative; min-height: 100vh;"><h2>Lỗi khởi chạy giao diện</h2><pre style="color: #cbd5e1;">${e.error?.stack || e.message}</pre></div>`;
  }
});


interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[REACT ERROR BOUNDARY]:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', background: '#0f172a', color: '#f8fafc', fontFamily: 'sans-serif', zIndex: 99999, position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#ef4444', marginBottom: '12px' }}>Đã xảy ra lỗi giao diện React</h2>
          <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '16px', maxWidth: '600px' }}>
            Hệ thống phát hiện lỗi khi tải module giao diện (Vite HMR hoặc thay đổi tập tin). Vui lòng nhấn nút bên dưới để tải lại.
          </p>
          <button 
            onClick={() => window.location.reload()} 
            style={{ padding: '8px 20px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', marginBottom: '20px' }}
          >
            Tải lại trang
          </button>
          <pre style={{ background: '#1e293b', padding: '12px', borderRadius: '6px', fontSize: '11px', color: '#cbd5e1', textAlign: 'left', maxWidth: '800px', overflowX: 'auto' }}>
            {this.state.error?.stack || String(this.state.error)}
          </pre>
        </div>
      );
    }
    return (this as any).props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
