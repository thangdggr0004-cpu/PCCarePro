import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AppLicenseModal, { AppLicenseData } from '../components/ui/AppLicenseModal.js';

interface AppLicenseContextType {
  license: AppLicenseData;
  isLoading: boolean;
  refreshLicense: () => Promise<void>;
  isLicensed: boolean;
  customerName: string;
  openActivationModal: () => void;
  closeActivationModal: () => void;
}

const AppLicenseContext = createContext<AppLicenseContextType | undefined>(undefined);

export const AppLicenseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [license, setLicense] = useState<AppLicenseData>({
    is_licensed: false,
    customer: null,
    issued_at: null,
    license_id: null,
    license_type: null,
    license_path: null,
    error: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const refreshLicense = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await (window as any).electronAPI?.getAppLicenseStatus?.();
      if (res) {
        setLicense(res);
      }
    } catch (e) {
      console.error('Failed to fetch app license status:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshLicense();
  }, [refreshLicense]);

  const openActivationModal = () => setIsModalOpen(true);
  const closeActivationModal = () => setIsModalOpen(false);

  return (
    <AppLicenseContext.Provider
      value={{
        license,
        isLoading,
        refreshLicense,
        isLicensed: !!license.is_licensed,
        customerName: license.customer || '',
        openActivationModal,
        closeActivationModal,
      }}
    >
      {children}
      <AppLicenseModal
        isOpen={isModalOpen}
        onClose={closeActivationModal}
        license={license}
        onLicenseUpdated={refreshLicense}
      />
    </AppLicenseContext.Provider>
  );
};

export const useAppLicense = () => {
  const context = useContext(AppLicenseContext);
  if (!context) {
    throw new Error('useAppLicense must be used within an AppLicenseProvider');
  }
  return context;
};
