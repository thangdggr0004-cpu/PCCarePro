import React, { useState, useEffect } from 'react';
import { 
  AlignLeft, 
  FileEdit, 
  Clock, 
  Trash2, 
  AlertTriangle, 
  UserX, 
  ShieldCheck, 
  Lock,
  CheckCircle2,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  Sparkles,
  Download
} from 'lucide-react';

import { 
  generateOfficeStandardizerScript, 
  generateRegionalFixScript,
  generateOfficeCacheCleanerScript,
  generateOfficeHistoryCleanerScript,
  generateFixWordCrashScript,
  generateClearOfficeCredentialsScript,
  generateOfficeQuickRepairScript,
  generateRetailToVolumeScript,
  generateBlockOfficeUpdateScript
} from '../utils/scriptGenerator.js';
import { useTaskManager } from '../context/TaskManagerContext.js';

const UtilityCard = ({
  id, title, description, icon: Icon, onClick, colorClass, btnText,
  isRunning, isSuccess, loadingText
}: {
  id: string, title: string, description: string, icon: any, onClick: () => void, colorClass: string, btnText: string,
  isRunning: boolean, isSuccess: boolean, loadingText: string
}) => {
  return (
    <div className="group bg-[#131d33] rounded-2xl border border-slate-800 p-5 shadow-xl hover:shadow-emerald-500/10 hover:-translate-y-1 hover:border-emerald-500/50 transition-all duration-300 flex flex-col justify-between">
      <div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${colorClass} transition-transform duration-300 group-hover:scale-110`}>
          <Icon className="w-5 h-5" />
        </div>
        <h3 className="font-bold text-white text-[15px] group-hover:text-emerald-400 transition-colors">{title}</h3>
        <p className="text-slate-400 text-xs mt-1.5 leading-relaxed min-h-[40px]">
          {description}
        </p>
      </div>

      <div className="mt-5 min-h-[40px] flex items-end">
        {isRunning ? (
          <div className="w-full animate-fade-in">
            <div className="flex flex-col items-center justify-center space-y-2 py-2 w-full">
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-emerald-400 border-t-transparent"></div>
                <span className="text-[11px] text-slate-300 font-bold">{loadingText}</span>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={onClick}
            className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 ${
              isSuccess
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : 'bg-[#18233c] hover:bg-emerald-500 hover:text-slate-950 text-slate-200 border border-slate-700/80 group-hover:border-emerald-500/50'
            }`}
          >
            {isSuccess ? (
              <><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Hoàn tất!</>
            ) : (
              <>{btnText}</>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default function OfficeStandardizer() {
  const [activeTask, setActiveTask] = useState<string | null>(null);
  const [successTask, setSuccessTask] = useState<string | null>(null);
  
  // Loading State
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingText, setLoadingText] = useState<string>('');

  // TP Office Addons State
  interface TpAddonStatus {
    excelInstalled: boolean;
    excelVersion: string;
    wordInstalled: boolean;
    wordVersion: string;
  }
  const [tpStatus, setTpStatus] = useState<TpAddonStatus>({
    excelInstalled: false,
    excelVersion: '',
    wordInstalled: false,
    wordVersion: ''
  });
  const [installingAddon, setInstallingAddon] = useState<'excel' | 'word' | null>(null);
  const [installResult, setInstallResult] = useState<{ addon: string; message: string; success: boolean } | null>(null);

  const loadTpStatus = async () => {
    try {
      const res = await (window as any).electronAPI?.getTpOfficeStatus?.();
      if (res?.success && res.data) {
        setTpStatus(res.data);
      }
    } catch (e) {
      console.error('Failed to read TP office status:', e);
    }
  };

  useEffect(() => {
    loadTpStatus();
  }, []);

  const handleInstallAddon = async (type: 'excel' | 'word') => {
    setInstallingAddon(type);
    setInstallResult(null);
    const title = type === 'excel' ? 'Cài Đặt TPExcel Pro' : 'Cài Đặt TPWord Pro';
    const taskId = `tp-office-install-${type}`;
    startTask(taskId, title, 'Tiện Ích Office', 'Đang giải nén & tự động cài đặt...', 'office-standardizer');
    try {
      const res = await (window as any).electronAPI?.installTpOfficeAddon?.(type);
      if (res?.success) {
        setInstallResult({ addon: type, message: res.message, success: true });
        completeTask(taskId, res.message);
        await loadTpStatus();
      } else {
        const err = res?.error || 'Cài đặt không thành công';
        setInstallResult({ addon: type, message: err, success: false });
        failTask(taskId, err);
        alert(err);
      }
    } catch (e: any) {
      const err = e?.message || String(e);
      setInstallResult({ addon: type, message: err, success: false });
      failTask(taskId, err);
      alert('Lỗi: ' + err);
    } finally {
      setInstallingAddon(null);
    }
  };

  const { startTask, updateTask, completeTask, failTask } = useTaskManager();

  const executeUtility = async (
    scriptGenFunc: (args?: any) => string, 
    taskId: string, 
    taskTitle = 'Tiện Ích Office', 
    args?: any,
    elevated = false
  ) => {
    setActiveTask(taskId);
    setSuccessTask(null);
    setIsLoading(true);
    setLoadingText(elevated ? 'Đang yêu cầu quyền Administrator...' : 'Đang thực thi...');
    
    startTask(taskId, taskTitle, 'Tiện Ích Office', 'Đang thực thi...', 'office-standardizer');

    const scriptArgs = args || {
      pageSize: 'A4',
      marginTop: 20,
      marginBottom: 20,
      marginLeft: 30,
      marginRight: 15,
      fontName: 'Times New Roman',
      fontSizeTitle: 14,
      fontSizeBody: 14,
      lineSpacing: 1.25,
    };

    const script = scriptGenFunc(scriptArgs);
    
    const finishTask = (success: boolean, errMsg?: string) => {
      setIsLoading(false);
      if (success) {
        setSuccessTask(taskId);
        completeTask(taskId, `Đã hoàn tất ${taskTitle}!`);
        setTimeout(() => {
          setActiveTask(null);
          setSuccessTask(null);
        }, 2000);
      } else {
        setActiveTask(null);
        failTask(taskId, errMsg || 'Lỗi thực thi');
        window.alert("Lỗi thực thi: " + errMsg);
      }
    };

    try {
      setLoadingText(elevated ? 'Đang áp dụng quyền Quản trị...' : 'Đang áp dụng cài đặt Office...');
      const res = await (window as any).electronAPI.applyOfficeStandard({ script, elevated });
      if (res && (res.success === false || res.ok === false)) {
        finishTask(false, res.error || 'Thao tác không thành công');
        return;
      }
      finishTask(true);
    } catch (err: any) {
      finishTask(false, err?.message || String(err));
    }
  };


  return (
    <div className="space-y-8 animate-fade-in pb-8">
      
      {/* HEADER */}
      <div className="bg-gradient-to-r from-[#121c33] to-[#0f172a] p-6 rounded-2xl border border-slate-800 shadow-xl flex items-start gap-4">
        <div className="bg-emerald-500/20 border border-emerald-500/30 p-3 rounded-2xl shrink-0 text-emerald-400">
          <FileEdit className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Tiện Ích Office Nâng Cao</h2>
          <p className="text-xs text-slate-400 mt-1">
            Bộ công cụ 1-Click giúp kỹ thuật viên chuẩn hóa Word/Excel, sửa các lỗi treo/văng cứng đầu và quản trị giấy phép an toàn, tối ưu nhất.
          </p>
        </div>
      </div>

      {/* SECTION 0: BỘ TIỆN ÍCH ĐỘC QUYỀN THIENPHATTECH (TỰ ĐỘNG CÀI ĐẶT 1-CLICK) */}
      <div className="bg-[#101728] rounded-2xl border border-emerald-500/30 p-5 shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-br from-amber-500/20 to-emerald-500/20 rounded-xl border border-amber-500/30 text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                Bộ Tiện Ích Độc Quyền ThienPhatTech (1-Click Tự Động Cài Đặt)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Tích hợp thanh Ribbon Excel &amp; Word chuyên dụng cho văn phòng Việt Nam, tự động cài đặt Add-in và nhúng Normal.dotm chuẩn.
              </p>
            </div>
          </div>
          <button
            onClick={loadTpStatus}
            className="text-xs text-slate-400 hover:text-emerald-400 flex items-center gap-1.5 self-start sm:self-auto cursor-pointer transition-colors"
            title="Làm mới trạng thái"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Kiểm tra trạng thái
          </button>
        </div>

        {installResult && (
          <div className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 animate-fade-in ${
            installResult.success
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}>
            <div className="flex items-center gap-2.5">
              {installResult.success ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              )}
              <span className="leading-relaxed">{installResult.message}</span>
            </div>
            <button 
              onClick={() => setInstallResult(null)}
              className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-slate-800 transition-colors"
            >
              ✕
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* CARD 1: TPEXCEL PRO */}
          <div className="group bg-[#131d33] rounded-2xl border border-slate-800 p-5 shadow-xl hover:border-emerald-500/50 transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    v0.6.0
                  </span>
                  {tpStatus.excelInstalled ? (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2 py-0.5 rounded-md">
                      <CheckCircle2 className="w-3 h-3" /> Đã cài đặt
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400 bg-slate-800/80 border border-slate-700/80 px-2 py-0.5 rounded-md">
                      Chưa cài đặt
                    </span>
                  )}
                </div>
              </div>

              <h4 className="font-bold text-white text-base group-hover:text-emerald-400 transition-colors">
                TPExcel Pro - Tiện Ích Excel Cho Người Việt
              </h4>
              <p className="text-slate-400 text-xs mt-2 leading-relaxed">
                Đọc số thành chữ VNĐ chuẩn kế toán, chuyển đổi bảng mã font TCVN3/VNI sang Unicode, tách/gộp họ tên, xóa dòng trống siêu tốc, chuẩn hóa bảng biểu báo cáo.
              </p>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between gap-3">
              <span className="text-[11px] text-slate-500">
                Tự động tạo Tab Ribbon trong Excel
              </span>
              <button
                onClick={() => handleInstallAddon('excel')}
                disabled={installingAddon !== null}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer active:scale-95 disabled:opacity-50 ${
                  tpStatus.excelInstalled
                    ? 'bg-[#18233c] hover:bg-emerald-500 hover:text-slate-950 text-emerald-300 border border-emerald-500/30'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20'
                }`}
              >
                {installingAddon === 'excel' ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Đang cài đặt...
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    {tpStatus.excelInstalled ? 'Cài Lại / Cập Nhật' : 'Cài Đặt Tự Động 1-Click'}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* CARD 2: TPWORD PRO */}
          <div className="group bg-[#131d33] rounded-2xl border border-slate-800 p-5 shadow-xl hover:border-blue-500/50 transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                    v1.0.0
                  </span>
                  {tpStatus.wordInstalled ? (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-blue-400 bg-blue-950/60 border border-blue-800/80 px-2 py-0.5 rounded-md">
                      <CheckCircle2 className="w-3 h-3" /> Đã cài đặt
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400 bg-slate-800/80 border border-slate-700/80 px-2 py-0.5 rounded-md">
                      Chưa cài đặt
                    </span>
                  )}
                </div>
              </div>

              <h4 className="font-bold text-white text-base group-hover:text-blue-400 transition-colors">
                TPWord Pro - Tiện Ích Word Chuẩn Nghị Định 30
              </h4>
              <p className="text-slate-400 text-xs mt-2 leading-relaxed">
                Tự động định dạng văn bản hành chính theo Nghị định 30 (căn lề, cỡ chữ, giãn dòng, quốc hiệu, tiêu ngữ), thư viện mẫu văn bản công văn và bảng biểu có sẵn.
              </p>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between gap-3">
              <span className="text-[11px] text-slate-500">
                Nhúng trực tiếp vào Normal.dotm
              </span>
              <button
                onClick={() => handleInstallAddon('word')}
                disabled={installingAddon !== null}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer active:scale-95 disabled:opacity-50 ${
                  tpStatus.wordInstalled
                    ? 'bg-[#18233c] hover:bg-blue-500 hover:text-slate-950 text-blue-300 border border-blue-500/30'
                    : 'bg-blue-500 hover:bg-blue-400 text-slate-950 shadow-lg shadow-blue-500/20'
                }`}
              >
                {installingAddon === 'word' ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Đang cài đặt...
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    {tpStatus.wordInstalled ? 'Cài Lại / Cập Nhật' : 'Cài Đặt Tự Động 1-Click'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 1: CHUẨN HÓA & TỐI ƯU */}
      <div>
        <h3 className="text-xs font-bold text-slate-300 mb-4 uppercase tracking-wider flex items-center gap-2">
          <AlignLeft className="w-4 h-4 text-emerald-400" /> Chuẩn Hóa &amp; Tối Ưu
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <UtilityCard
            id="std-word"
            title="Chuẩn Hóa Word Việt Nam"
            description="Tự động cấu hình Font Times New Roman 14, căn lề chuẩn Nghị định (20-20-30-15mm), giãn dòng 1.25."
            icon={FileEdit}
            colorClass="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
            btnText="Áp dụng 1-Click"
            onClick={() => executeUtility(generateOfficeStandardizerScript, 'std-word', 'Chuẩn Hóa Word Việt Nam')}
            isRunning={isLoading && activeTask === 'std-word'}
            isSuccess={successTask === 'std-word'}
            loadingText={loadingText}
          />
          <UtilityCard
            id="fix-date"
            title="Sửa Lỗi Ngày Tháng (Excel)"
            description="Sửa lỗi đảo ngược ngày/tháng trong Excel, ép định dạng vùng hệ thống về chuẩn dd/MM/yyyy."
            icon={Clock}
            colorClass="bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
            btnText="Sửa lỗi ngay"
            onClick={() => executeUtility(generateRegionalFixScript, 'fix-date', 'Sửa Lỗi Ngày Tháng (Excel)')}
            isRunning={isLoading && activeTask === 'fix-date'}
            isSuccess={successTask === 'fix-date'}
            loadingText={loadingText}
          />
          <UtilityCard
            id="clean-cache"
            title="Dọn Dẹp Office Cache"
            description="Xóa rác, temp cache giúp giảm dung lượng ổ C và tăng tốc khởi động Word/Excel."
            icon={Trash2}
            colorClass="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
            btnText="Dọn dẹp"
            onClick={() => executeUtility(generateOfficeCacheCleanerScript, 'clean-cache', 'Dọn Dẹp Office Cache')}
            isRunning={isLoading && activeTask === 'clean-cache'}
            isSuccess={successTask === 'clean-cache'}
            loadingText={loadingText}
          />
          <UtilityCard
            id="clean-history"
            title="Xóa Lịch Sử File Gần Đây"
            description="Xóa sạch danh sách Recent Files trong Office để bảo mật thông tin tài liệu nhạy cảm."
            icon={Trash2}
            colorClass="bg-purple-500/20 text-purple-400 border border-purple-500/30"
            btnText="Xóa lịch sử"
            onClick={() => executeUtility(generateOfficeHistoryCleanerScript, 'clean-history', 'Xóa Lịch Sử File Office')}
            isRunning={isLoading && activeTask === 'clean-history'}
            isSuccess={successTask === 'clean-history'}
            loadingText={loadingText}
          />
        </div>
      </div>

      {/* SECTION 2: SỬA LỖI CHUYÊN SÂU */}
      <div>
        <h3 className="text-xs font-bold text-slate-300 mb-4 uppercase tracking-wider flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400" /> Sửa Lỗi Chuyên Sâu
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <UtilityCard
            id="fix-crash"
            title="Sửa Lỗi Treo/Crash Word &amp; Excel"
            description="Đóng băng toàn bộ Office, gỡ bỏ Add-in rác và xóa bộ đệm cấu hình Normal.dotm bị lỗi."
            icon={AlertTriangle}
            colorClass="bg-rose-500/20 text-rose-400 border border-rose-500/30"
            btnText="Xử lý Treo/Crash"
            onClick={() => executeUtility(generateFixWordCrashScript, 'fix-crash', 'Sửa Lỗi Treo Office')}
            isRunning={isLoading && activeTask === 'fix-crash'}
            isSuccess={successTask === 'fix-crash'}
            loadingText={loadingText}
          />
          <UtilityCard
            id="quick-repair"
            title="Office Quick Repair (Microsoft Native)"
            description="Mở trực tiếp trình sửa chữa Click-to-Run của Microsoft để khôi phục toàn bộ file hệ thống Office bị hỏng."
            icon={RefreshCw}
            colorClass="bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
            btnText="Chạy Quick Repair 1-Click"
            onClick={() => executeUtility(generateOfficeQuickRepairScript, 'quick-repair', 'Office Quick Repair', undefined, true)}
            isRunning={isLoading && activeTask === 'quick-repair'}
            isSuccess={successTask === 'quick-repair'}
            loadingText={loadingText}
          />
          <UtilityCard
            id="clear-creds"
            title="Sửa Lỗi Kẹt Tài Khoản (Account Error)"
            description="Xóa sạch thông tin đăng nhập trong Credential Manager và các khóa Identity của Office."
            icon={UserX}
            colorClass="bg-amber-500/20 text-amber-400 border border-amber-500/30"
            btnText="Xóa Phiên Đăng Nhập Cũ"
            onClick={() => executeUtility(generateClearOfficeCredentialsScript, 'clear-creds', 'Xóa Kẹt Tài Khoản Office')}
            isRunning={isLoading && activeTask === 'clear-creds'}
            isSuccess={successTask === 'clear-creds'}
            loadingText={loadingText}
          />
        </div>
      </div>

      {/* SECTION 3: QUẢN TRỊ BẢN QUYỀN */}
      <div>
        <h3 className="text-xs font-bold text-slate-300 mb-4 uppercase tracking-wider flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" /> Quản Trị Giấy Phép &amp; Bản Quyền
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
          <UtilityCard
            id="retail-to-volume"
            title="Chuyển Đổi Kênh Cấp Phép (Retail -> Volume)"
            description="Quét và nạp chứng chỉ Volume (VL) vào Office Retail. Thao tác này là bắt buộc nếu bạn muốn sử dụng máy chủ KMS nội bộ doanh nghiệp để kích hoạt số lượng lớn."
            icon={ShieldCheck}
            colorClass="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
            btnText="Cài Đặt Chứng Chỉ Volume"
            onClick={() => executeUtility(generateRetailToVolumeScript, 'retail-to-volume', 'Chuyển Đổi Kênh Volume', undefined, true)}
            isRunning={isLoading && activeTask === 'retail-to-volume'}
            isSuccess={successTask === 'retail-to-volume'}
            loadingText={loadingText}
          />
          <UtilityCard
            id="block-updates"
            title="Đóng Băng Cập Nhật Office"
            description="Vô hiệu hóa luồng cập nhật của Microsoft qua Group Policy và Registry. Giúp bảo vệ tính ổn định của phiên bản hiện tại, tránh việc tự động tải bản vá làm mất chứng chỉ cấp phép."
            icon={Lock}
            colorClass="bg-purple-500/20 text-purple-400 border border-purple-500/30"
            btnText="Chặn Luồng Cập Nhật (Khuyên Dùng)"
            onClick={() => executeUtility(generateBlockOfficeUpdateScript, 'block-updates', 'Đóng Băng Cập Nhật Office', undefined, true)}
            isRunning={isLoading && activeTask === 'block-updates'}
            isSuccess={successTask === 'block-updates'}
            loadingText={loadingText}
          />
        </div>
      </div>
      
    </div>
  );
}
