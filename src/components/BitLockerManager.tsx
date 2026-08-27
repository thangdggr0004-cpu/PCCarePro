import React, { useState, useEffect } from 'react';
import { Lock, Unlock, ShieldAlert, RefreshCw, Shield, AlertTriangle } from 'lucide-react';

interface BitLockerVolume {
  MountPoint: string;
  VolumeStatus: string;
  ProtectionStatus: string;
  EncryptionPercentage: number;
  FileSystemLabel?: string;
}

export default function BitLockerManager() {
  const [volumes, setVolumes] = useState<BitLockerVolume[]>([]);
  const [loading, setLoading] = useState(false);
  const [noModule, setNoModule] = useState(false);
  const [processingDrives, setProcessingDrives] = useState<Record<string, boolean>>({});
  
  const loadStatus = async () => {
    setLoading(true);
    try {
      const res = await (window as any).electronAPI.getBitlockerStatus();
      if (res && res.success) {
        if (res.data === 'NO_MODULE') {
          setNoModule(true);
        } else {
          setNoModule(false);
          const parsed = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
          const arr = Array.isArray(parsed) ? parsed : (Array.isArray(res.volumes) ? res.volumes : [parsed]);
          setVolumes(arr.filter((v: any) => v && v.MountPoint));
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleDisable = async (mountPoint: string) => {
    const confirm = window.confirm(`Bạn có chắc chắn muốn TẮT mã hóa BitLocker cho ổ đĩa ${mountPoint} không?\n\nQuá trình giải mã sẽ diễn ra ngầm và tốn khá nhiều thời gian tùy theo dung lượng ổ đĩa.`);
    if (!confirm) return;

    setProcessingDrives(prev => ({ ...prev, [mountPoint]: true }));
    try {
      const res = await (window as any).electronAPI.disableBitlocker(mountPoint);
      if (res && res.success) {
        alert(`Đã gửi lệnh giải mã cho ổ đĩa ${mountPoint}. Vui lòng chờ phần trăm giải mã chạy ngầm.`);
        loadStatus();
      } else {
        alert("Có lỗi xảy ra: " + (res?.error || "Không thể thực thi"));
      }
    } catch (e: unknown) {
      alert(`Lỗi BitLocker: ${(e instanceof Error ? e.message : 'Không thể xử lý yêu cầu - Vui lòng kiểm tra lại mã hóa ổ đĩa')}`);
    } finally {
      setProcessingDrives(prev => ({ ...prev, [mountPoint]: false }));
    }
  };

  const handleDisableAll = async () => {
    const encryptedVols = volumes.filter(v => v.ProtectionStatus === 'On' || v.VolumeStatus === 'FullyEncrypted');
    if (encryptedVols.length === 0) {
      alert("Không có ổ đĩa nào đang bị khóa!");
      return;
    }
    
    const confirm = window.confirm(`Bạn có chắc chắn muốn TẮT BitLocker cho TOÀN BỘ ổ đĩa đang bị khóa không?`);
    if (!confirm) return;

    for (const vol of encryptedVols) {
      setProcessingDrives(prev => ({ ...prev, [vol.MountPoint]: true }));
      try {
        await (window as any).electronAPI.disableBitlocker(vol.MountPoint);
      } catch (e) {
        console.error("Lỗi khi tắt", vol.MountPoint, e);
      } finally {
        setProcessingDrives(prev => ({ ...prev, [vol.MountPoint]: false }));
      }
    }
    alert("Đã gửi lệnh tắt toàn bộ. Hệ thống đang tiến hành giải mã.");
    loadStatus();
  };

  const handleBackupKey = async (mountPoint: string) => {
    try {
      const res = await (window as any).electronAPI.backupBitlockerKey(mountPoint);
      if (res && res.success && res.key && res.key !== 'NO_KEY') {
        alert(`🔑 KHÓA KHÔI PHỤC (RECOVERY KEY) Ổ ${mountPoint}:\n\n${res.key}\n\nHãy lưu lại mã 48 chữ số này ở nơi an toàn!`);
      } else {
        alert(`⚠️ Không tìm thấy Khóa Khôi Phục Recovery Key cho ổ ${mountPoint} (có thể ổ đĩa chưa từng được mã hóa).`);
      }
    } catch (e: any) {
      alert("Lỗi: " + e.message);
    }
  };


  const renderStatus = (vol: BitLockerVolume) => {
    if (vol.VolumeStatus === 'FullyDecrypted') {
      return (
        <span className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 text-slate-400 rounded-lg text-xs font-bold w-fit border border-slate-700">
          <Unlock className="w-3.5 h-3.5" />
          Đã tắt (Off)
        </span>
      );
    }
    if (vol.VolumeStatus === 'FullyEncrypted') {
      return (
        <span className="flex items-center gap-1.5 px-3 py-1 bg-rose-500/20 text-rose-400 rounded-lg text-xs font-bold w-fit border border-rose-500/30">
          <Lock className="w-3.5 h-3.5" />
          Đang bị khóa
        </span>
      );
    }
    if (vol.VolumeStatus === 'DecryptionInProgress') {
      return (
        <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 text-amber-400 rounded-lg text-xs font-bold animate-pulse w-fit border border-amber-500/30">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          Đang giải mã... ({vol.EncryptionPercentage}%)
        </span>
      );
    }
    if (vol.VolumeStatus === 'EncryptionInProgress') {
      return (
        <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg text-xs font-bold animate-pulse w-fit border border-emerald-500/30">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          Đang mã hóa... ({vol.EncryptionPercentage}%)
        </span>
      );
    }
    return <span className="text-slate-400 text-xs">{vol.VolumeStatus}</span>;
  };

  return (
    <div className="space-y-6 pb-10 animate-fade-in">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-[#121c33] to-[#0f172a] p-6 rounded-2xl border border-slate-800 shadow-xl flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6 text-rose-400" />
            Quản Lý BitLocker
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Xem trạng thái, sao lưu Recovery Key và giải mã ổ đĩa cứng bị khóa
          </p>
        </div>
        <button 
          onClick={loadStatus}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-[#18233c] hover:bg-[#202f50] text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-700/80 active:scale-95 shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Làm mới
        </button>
      </div>

      {noModule && (
        <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl flex gap-3 text-amber-300">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-400" />
          <div>
            <h3 className="font-bold text-xs">Cảnh báo Phiên bản Windows</h3>
            <p className="text-xs mt-1 text-slate-300">
              Hệ thống phát hiện có thể bạn đang dùng bản Windows Home hoặc tính năng mã hóa không tương thích. Lệnh BitLocker đầy đủ sẽ không khả dụng, phần mềm đang chuyển sang dùng phương thức quét cơ bản.
            </p>
          </div>
        </div>
      )}

      <div className="bg-[#131d33] rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
        <div className="bg-[#0e1626] border-b border-slate-800 p-4 flex justify-between items-center">
          <h3 className="font-bold text-white text-xs flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-400" />
            Danh Sách Ổ Đĩa
          </h3>
          <button
            onClick={handleDisableAll}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-slate-950 border border-rose-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95"
          >
            <Shield className="w-3.5 h-3.5" />
            Tắt toàn bộ BitLocker
          </button>
        </div>
        <div className="p-0 overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px] text-xs">
            <thead>
              <tr className="bg-[#090e1a] border-b border-slate-800 uppercase tracking-wider text-slate-400 text-[10px]">
                <th className="p-4 font-bold w-28">Ổ đĩa</th>
                <th className="p-4 font-bold w-52">Trạng thái</th>
                <th className="p-4 font-bold">Tỷ lệ mã hóa</th>
                <th className="p-4 font-bold text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {volumes.map((vol, idx) => (
                <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                  <td className="p-4">
                    <div className="font-bold text-white text-base font-mono">{vol.MountPoint} {vol.FileSystemLabel ? `(${vol.FileSystemLabel})` : ''}</div>
                    <div className="text-[10px] text-slate-500">Fixed Drive</div>
                  </td>
                  <td className="p-4">
                    {renderStatus(vol)}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono font-bold text-slate-300 w-10">{vol.EncryptionPercentage}%</span>
                      <div className="w-full max-w-[150px] bg-[#090e1a] rounded-full h-2 overflow-hidden border border-slate-800">
                        <div 
                          className={`h-full transition-all duration-500 ${vol.VolumeStatus === 'FullyDecrypted' ? 'bg-emerald-500' : (vol.VolumeStatus === 'DecryptionInProgress' ? 'bg-amber-500' : 'bg-rose-500')}`} 
                          style={{ width: `${vol.EncryptionPercentage}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {vol.ProtectionStatus === 'On' && (
                        <button
                          onClick={() => handleBackupKey(vol.MountPoint)}
                          title="Xem và lưu mã Recovery Key 48 số"
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-500/20 border border-amber-500/30 text-amber-400 hover:bg-amber-500 hover:text-slate-950 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95"
                        >
                          🔑 Key
                        </button>
                      )}
                      <button
                        onClick={() => handleDisable(vol.MountPoint)}
                        disabled={vol.ProtectionStatus === 'Off' || vol.VolumeStatus === 'FullyDecrypted' || processingDrives[vol.MountPoint]}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#18233c] border border-slate-700 text-slate-300 hover:bg-rose-500/20 hover:text-rose-400 hover:border-rose-500/40 rounded-xl text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95"
                      >
                        <Shield className="w-3.5 h-3.5" />
                        {processingDrives[vol.MountPoint] ? 'Đang gửi...' : 'Tắt BitLocker'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {volumes.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-500">
                    Không tìm thấy ổ đĩa nào có thể kiểm tra BitLocker.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

