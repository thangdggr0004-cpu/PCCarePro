import React, { useState } from 'react';
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
  RefreshCw
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
