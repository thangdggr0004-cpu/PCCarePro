import React from 'react';

// CoreProvider is a no-op wrapper kept for API compatibility.
// The Electron-era ActionRegistry/IpcService/EventBus infrastructure has been
// removed as dead code after the Electron→Tauri migration.
export const CoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

export const useCore = () => {
  throw new Error('useCore: No active CoreContext. CoreProvider is a no-op after Tauri migration.');
};
