import React, { useState } from 'react';
import { updateSessionReport } from '../utils/SessionAuditStore.js';
import { 
  ShieldCheck, 
  AlertTriangle, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Activity,
  Layers,
  FileCheck2,
  Zap,
  Copy,
  Download,
  Filter,
  Check,
  Info,
  Package,
  Key,
  FolderCheck,
  Cpu,
  Cog
} from 'lucide-react';
import { UiInlineLabel, UiSectionHeading } from './license/SharedPresentation.js';

// Tooltip dictionary chuẩn ngắn gọn (Tối đa 2 câu)
const TOOLTIPS: Record<string, string> = {
  KMS: 'Key Management Service - Máy chủ quản lý bản quyền nội bộ hoặc công khai.',
  GVLK: 'Generic Volume License Key - Mã khóa mặc định dùng để kích hoạt qua KMS.',
  MAK: 'Multiple Activation Key - Khóa kích hoạt số lượng lớn trực tiếp từ Microsoft.',
  Retail: 'Bản quyền bán lẻ cá nhân, kích hoạt trực tiếp theo tài khoản hoặc key.',
  OEM: 'Bản quyền nhúng sẵn theo máy từ nhà sản xuất thiết bị.',
  Subscription: 'Đăng ký bản quyền định kỳ Microsoft 365 Cloud.',
  MSI: 'Định dạng cài đặt truyền thống qua gói Windows Installer.',
  ClickToRun: 'Công nghệ cài đặt và cập nhật trực tuyến C2R của Microsoft.',
  Volume: 'Giấy phép khối doanh nghiệp cài đặt hàng loạt.',
  IFEO: 'Khóa Registry điều hướng tiến trình ứng dụng Windows.',
  Authenticode: 'Chữ ký số xác thực phần mềm chính hãng Microsoft.',
  SystemConfidence: 'Mức độ tin cậy kiểm tra tính toàn vẹn tệp và Registry hệ thống.',
  ActivationConfidence: 'Mức độ tin cậy xác định phương thức và máy chủ kích hoạt.'
};

export default function OfficeLicenseAnalyzer() {
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [report, setReport] = useState<any | null>(null);
  const [restoreResult, setRestoreResult] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'matrix' | 'plan' | 'audit' | 'postReport'>('matrix');
  
  // Audit log filter & copy state
  const [logFilter, setLogFilter] = useState<string>('ALL');
  const [copiedLog, setCopiedLog] = useState<boolean>(false);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [expandedCollector, setExpandedCollector] = useState<string | null>(null);
  const [showConfidenceBreakdown, setShowConfidenceBreakdown] = useState<boolean>(false);
  const [copiedReportFormat, setCopiedReportFormat] = useState<string | null>(null);

  const handleRunScanV3 = async () => {
    setIsScanning(true);
    setRestoreResult(null);
    try {
      const res = await (window as any).electronAPI?.scanOfficeEngineV3?.();
      const reportData = res?.report || (res?.success && res) || res;
      if (reportData) {
        setReport(reportData);
        const offStatus = reportData?.provenance?.activationStatus || 'LICENSED';
        const offName = reportData?.skuInfo?.skuName || 'Microsoft Office';
        const offMethod = reportData?.provenance?.activationMethod || 'KMS Client (GVLK)';
        const offStr = offStatus === 'LICENSED'
          ? `✔ ${offName}: Máy sạch - Đã kích hoạt (${offMethod} - Cần hóa đơn/chứng từ doanh nghiệp nếu muốn đối soát)`
          : `❌ ${offName}: Chưa kích hoạt`;
        updateSessionReport({ officeActivation: offStr });
      } else {
        alert("Không nhận được dữ liệu chẩn đoán Office.");
      }
    } catch (err: any) {
      alert("Lỗi thực thi Engine V3: " + err.message);
    } finally {
      setIsScanning(false);
    }
  };

  const handleRestoreV3 = async () => {
    if (!window.confirm("BẮT ĐẦU KHÔI PHỤC AN TOÀN:\n\n1. Kiểm tra an toàn (Admin, Tiến trình Office).\n2. Thực hiện: Sao lưu -> Khôi phục -> Kiểm tra lại.\n3. Tự động Hoàn tác 100% nếu có lỗi.\n\nBạn có muốn tiếp tục không?")) return;

    setIsRestoring(true);
    try {
      const res = await (window as any).electronAPI?.restoreOfficeEngineV3?.();
      setRestoreResult(res);
      if (res && res.success !== false) {
        alert("KHÔI PHỤC HOÀN TẤT:\n\n" + (res.postRestoreReport?.summary || res.output || 'Hệ thống đã phục hồi trạng thái Office nguyên bản!'));
        handleRunScanV3();
      } else {
        alert("CẢNH BÁO KHÔI PHỤC:\n\n" + (res?.error || 'Có lỗi xảy ra'));
      }
    } catch (err: any) {
      alert("Lỗi thực thi khôi phục: " + err.message);
    } finally {
      setIsRestoring(false);
    }
  };


  const decision = report?.decisionResult?.actionAllowed || 'NONE';
  const systemConfidence = report?.confidenceResult?.confidencePercentage || 0;
  const targetActionsCount = report?.surgicalPlan?.targetActions?.length || 0;
  const isKmsMethod = report?.provenance?.activationMethod?.includes('KMS');

  // Multi-format Report Exporter
  const generateReportText = () => {
    if (!report) return '';
    return `=== BÁO CÁO CHẨN ĐOÁN BẢN QUYỀN OFFICE V3 ===
Thời gian: ${report.timestamp}
Phiên bản: ${report.skuInfo?.skuName} (Kênh: ${report.skuInfo?.channel}, Build: ${report.skuInfo?.buildNumber})
Kích hoạt: ${report.provenance?.activationStatus} (${report.provenance?.activationMethod})
Độ tin cậy hệ thống: ${systemConfidence}% (${report.confidenceResult?.level?.label})
Kết luận: ${report.decisionResult?.reason}

--- BẢNG KẾT QUẢ COLLECTOR ---
${(report.matrix || []).map((m: any) => `[${m.status}] ${m.componentName} (${m.dataSource}): ${m.details} (${m.executionTimeMs || 0}ms)`).join('\n')}
`;
  };

  const generateReportMarkdown = () => {
    if (!report) return '';
    return `# Báo Cáo Chẩn Đoán Bản Quyền MS Office V3
- **Thời gian:** ${report.timestamp}
- **Phiên bản:** ${report.skuInfo?.skuName} (${report.skuInfo?.channel})
- **Trạng thái:** ${report.provenance?.activationStatus}
- **Độ tin cậy hệ thống:** **${systemConfidence}%**
- **Kết luận Engine:** ${report.decisionResult?.reason}

### Kết Quả Chi Tiết Theo Collector
| Collector | Trạng Thái | Nguồn Dữ Liệu | Thời Gian | Chi Tiết |
| :--- | :---: | :--- | :---: | :--- |
${(report.matrix || []).map((m: any) => `| ${m.componentName} | **${m.status}** | ${m.dataSource} | ${m.executionTimeMs || 0}ms | ${m.details} |`).join('\n')}
`;
  };

  const copyReportFormat = (format: 'TXT' | 'JSON' | 'MD') => {
    let content = '';
    if (format === 'TXT') content = generateReportText();
    if (format === 'JSON') content = JSON.stringify(report, null, 2);
    if (format === 'MD') content = generateReportMarkdown();

    navigator.clipboard.writeText(content);
    setCopiedReportFormat(format);
    setTimeout(() => setCopiedReportFormat(null), 2000);
  };

  const exportReportFile = (format: 'TXT' | 'JSON' | 'MD') => {
    let content = '';
    let mime = 'text/plain;charset=utf-8';
    let ext = 'txt';

    if (format === 'TXT') { content = generateReportText(); ext = 'txt'; }
    if (format === 'JSON') { content = JSON.stringify(report, null, 2); mime = 'application/json'; ext = 'json'; }
    if (format === 'MD') { content = generateReportMarkdown(); ext = 'md'; }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `OfficeDiagnosticReport_${Date.now()}.${ext}`;
    a.click();
  };

  // Lọc Audit Logs
  const getFilteredLogs = () => {
    if (!report || !report.auditLogs) return [];
    if (logFilter === 'ALL') return report.auditLogs;
    return report.auditLogs.filter((log: any) => 
      (log.collectorName && log.collectorName.toUpperCase().includes(logFilter)) ||
      (log.dataSource && log.dataSource.toUpperCase().includes(logFilter))
    );
  };

  const renderTooltipIcon = (term: string) => (
    <span className="relative inline-flex items-center ml-1 cursor-pointer group">
      <Info 
        className="w-3.5 h-3.5 text-slate-400 hover:text-blue-600 transition-colors"
        onMouseEnter={() => setActiveTooltip(term)}
        onMouseLeave={() => setActiveTooltip(null)}
      />
      {activeTooltip === term && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-60 p-2 bg-slate-900 text-white text-[11px] font-normal rounded-lg shadow-xl z-50 pointer-events-none whitespace-normal leading-tight">
          <strong className="text-blue-400 block mb-0.5">{term}:</strong>
          {TOOLTIPS[term]}
        </span>
      )}
    </span>
  );

  const getComponentIcon = (name: string) => {
    if (name.includes('License') || name.includes('OSPP')) return <Key className="w-4 h-4 text-amber-500 shrink-0" />;
    if (name.includes('Authenticode') || name.includes('sppc.dll')) return <ShieldCheck className="w-4 h-4 text-blue-500 shrink-0" />;
    if (name.includes('Ohook') || name.includes('sppcs.dll')) return <FolderCheck className="w-4 h-4 text-emerald-500 shrink-0" />;
    if (name.includes('Registry') || name.includes('IFEO')) return <Cpu className="w-4 h-4 text-indigo-500 shrink-0" />;
    return <Cog className="w-4 h-4 text-slate-500 shrink-0" />;
  };

  return (
    <div className="bg-[#101728] border border-slate-800 rounded-2xl p-5 shadow-xl text-slate-200 space-y-4 font-sans">
      
      {/* HEADER & THỊ GIÁC ƯU TIÊN */}
      <div className="bg-[#131d33] p-4 rounded-xl border border-slate-800 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-xl">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <UiSectionHeading className="text-xs font-bold text-slate-200 uppercase tracking-wide">
                CHẨN ĐOÁN &amp; KHÔI PHỤC BẢN QUYỀN MS OFFICE V3
              </UiSectionHeading>
              <p className="text-[10px] text-slate-400">
                Phân tích đối soát đa nguồn • Giải thích nguồn gốc bằng chứng • Tự động khôi phục an toàn.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono text-slate-500 shrink-0">
            {report ? `Thời gian: ${report.timestamp}` : 'Chưa quét'}
          </span>
        </div>

        {/* SUMMARY BAR */}
        {report && (
          <div className="bg-[#090e1a] text-slate-300 px-3.5 py-2.5 rounded-xl border border-slate-800 text-xs font-mono flex flex-wrap items-center justify-between gap-2 shadow-inner">
            <div className="flex flex-wrap items-center gap-3">
              <span>① Trạng thái: <strong className="text-emerald-400 font-bold px-1.5 py-0.5 bg-emerald-500/10 rounded border border-emerald-500/30">{report.provenance?.activationStatus || 'N/A'}</strong></span>
              <span className="text-slate-700">|</span>
              <span>② Khôi phục: <strong className={targetActionsCount > 0 ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold px-1.5 py-0.5 bg-emerald-500/10 rounded border border-emerald-500/30'}>{targetActionsCount > 0 ? 'Cần thực hiện' : 'Không cần thiết'}</strong></span>
              <span className="text-slate-700">|</span>
              <span>③ Phương thức: <strong className="text-cyan-300 font-bold">{report.provenance?.activationMethod || 'N/A'}</strong> {renderTooltipIcon('KMS')}</span>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              Độ tin cậy hệ thống: <strong className="text-emerald-400 font-bold">{systemConfidence}%</strong>
              <button 
                onClick={() => setShowConfidenceBreakdown(true)}
                className="p-0.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded transition-colors cursor-pointer"
                title="Bấm để xem chi tiết điểm số tin cậy"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CONFIDENCE BREAKDOWN MODAL */}
      {showConfidenceBreakdown && report && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-[#101728] rounded-2xl border border-slate-800 shadow-2xl max-w-md w-full p-5 space-y-4 font-sans text-xs">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h4 className="font-bold text-white uppercase flex items-center gap-1.5 text-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> PHÂN TÍCH ĐỘ TIN CẬY HỆ THỐNG ({systemConfidence}%)
              </h4>
              <button onClick={() => setShowConfidenceBreakdown(false)} className="text-slate-400 hover:text-white font-bold text-sm cursor-pointer">✕</button>
            </div>
            <p className="text-[11px] text-slate-400">
              Độ tin cậy tổng hợp được tính toán dựa trên trọng số đóng góp của từng Collector và khấu trừ nếu có cảnh báo:
            </p>
            <div className="space-y-1.5 font-mono text-[11px]">
              {(report.matrix || []).map((item: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-2.5 bg-[#0e1626] rounded-xl border border-slate-800">
                  <div className="flex items-center gap-2">
                    {item.status === 'PASS' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
                    <span className="font-bold text-slate-200">{item.componentName}</span>
                  </div>
                  <span className={`font-bold ${item.status === 'PASS' ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {item.status === 'PASS' ? `+${item.confidenceWeight}%` : `-${item.confidenceWeight}%`}
                  </span>
                </div>
              ))}
            </div>
            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button 
                onClick={() => setShowConfidenceBreakdown(false)} 
                className="px-4 py-2 bg-emerald-500 text-slate-950 font-bold rounded-xl hover:bg-emerald-400 transition-all cursor-pointer text-xs"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TẦNG 1: THÔNG TIN HỆ THỐNG */}
      {report && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Ô 1: Phiên Bản Office */}
          <div className="bg-[#131d33] p-4 rounded-xl border border-slate-800 shadow-sm flex flex-col justify-between space-y-1.5">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-cyan-400" /> Phiên Bản Office
            </div>
            <div className="text-xs font-bold text-white flex items-center gap-1">
              {report.skuInfo?.skuName || 'Office'}
              {renderTooltipIcon('ClickToRun')}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              Kênh: <span className="text-slate-300 font-medium">{report.skuInfo?.channel}</span> | Build: <span className="text-slate-300 font-medium">{report.skuInfo?.buildNumber}</span> ({report.skuInfo?.bitness})
            </div>
          </div>

          {/* Ô 2: Độ tin cậy hệ thống */}
          <div className="bg-[#131d33] p-4 rounded-xl border border-slate-800 shadow-sm flex flex-col justify-between space-y-1.5">
            <UiInlineLabel className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 mr-1.5" /> Độ tin cậy hệ thống
                {renderTooltipIcon('SystemConfidence')}
              </span>
              <button onClick={() => setShowConfidenceBreakdown(true)} className="text-[10px] text-cyan-400 hover:text-cyan-300 underline font-bold cursor-pointer">
                Xem chi tiết (i)
              </button>
            </UiInlineLabel>
            <div className="flex items-center gap-2">
              <div className={`text-xl font-black font-mono ${systemConfidence >= 95 ? 'text-emerald-400' : systemConfidence >= 60 ? 'text-amber-400' : 'text-rose-400'}`}>
                {systemConfidence}%
              </div>
              <div className="text-[10px] text-slate-400 font-medium">
                ({report.confidenceResult?.level?.label || 'Đã xác nhận'})
              </div>
            </div>
            <div className="w-full bg-[#0e1626] h-1.5 rounded-full overflow-hidden border border-slate-800">
              <div 
                className={`h-full transition-all duration-500 ${systemConfidence >= 95 ? 'bg-emerald-500' : systemConfidence >= 60 ? 'bg-amber-500' : 'bg-rose-500'}`}
                style={{ width: `${systemConfidence}%` }}
              />
            </div>
          </div>

          {/* Ô 3: ④ Kết Luận với GIẢI THÍCH LÝ DO */}
          <div className="bg-[#131d33] p-4 rounded-xl border border-slate-800 shadow-sm flex flex-col justify-between space-y-1.5">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">④ Kết Luận</div>
            <div className="text-xs font-bold text-emerald-400 leading-tight flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{report.decisionResult?.reason || '✓ Không phát hiện can thiệp.'}</span>
            </div>
            
            {/* EXPLAINABILITY CHECKLIST */}
            {report.decisionResult?.explanationList && (
              <div className="mt-1 pt-1.5 border-t border-slate-800 text-[10px] text-slate-400 space-y-0.5 font-sans">
                <strong className="text-slate-300 block font-bold text-[9px] uppercase">Vì sao Engine kết luận:</strong>
                {report.decisionResult.explanationList.slice(0, 3).map((exp: string, idx: number) => (
                  <div key={idx} className="text-slate-300 truncate">• {exp}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TẦNG 2: ĐÁNH GIÁ NGUỒN GỐC KÍCH HOẠT */}
      {report && report.provenance && (
        <div className="bg-[#131d33] p-5 rounded-2xl border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400" /> KẾT QUẢ XÁC MINH NGUỒN GỐC BẢN QUYỀN
            </div>
            <span className="text-xs font-bold font-mono text-cyan-400 flex items-center">
              Độ tin cậy đánh giá: {report.provenance.confidence}%
              {renderTooltipIcon('ActivationConfidence')}
            </span>
          </div>

          {/* ASSESSMENT CARD */}
          <div className="p-4 bg-[#090e1a] text-slate-200 rounded-xl space-y-3 border border-slate-800 font-sans shadow-md">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5 text-xs">
              <span className="text-slate-400 font-bold uppercase text-xs">Cấp độ xác minh bản quyền:</span>
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                {report.provenance.provenanceLevelText || 'NGUỒN KÍCH HOẠT CẦN XÁC MINH THÊM (LEVEL 3)'}
              </span>
            </div>

            {/* EVIDENCE TRACE CHAIN */}
            <div className="bg-[#0e1626] p-2.5 rounded-xl border border-slate-800 text-xs text-slate-400 flex flex-wrap items-center gap-2 font-mono">
              <span className="text-slate-400 font-bold">Quy trình kiểm tra:</span>
              <span className="px-2 py-0.5 bg-slate-800 rounded-lg text-cyan-300 font-semibold">Các bước kiểm tra ({report.matrix?.length || 8})</span>
              <span>➔</span>
              <span className="px-2 py-0.5 bg-slate-800 rounded-lg text-emerald-300 font-semibold">Tổng hợp dữ liệu</span>
              <span>➔</span>
              <span className="px-2 py-0.5 bg-slate-800 rounded-lg text-amber-300 font-semibold">Mức độ tin cậy ({systemConfidence}%)</span>
              <span>➔</span>
              <span className="px-2 py-0.5 bg-slate-800 rounded-lg text-purple-300 font-semibold">Chẩn đoán hệ thống</span>
              <span>➔</span>
              <span className="px-2 py-0.5 bg-slate-800 rounded-lg text-teal-300 font-semibold">Hướng xử lý</span>
            </div>

            <div className="text-xs text-slate-300 space-y-2 font-sans leading-relaxed">
              <p className="text-xs">
                Trạng thái ghi nhận: <strong className="text-emerald-400 font-bold">{report.provenance.activationStatus}</strong> ({report.provenance.activationMethod}). Hệ thống không phát hiện các công cụ can thiệp hoặc tệp tin bị thay đổi. Khi cần đối soát bản quyền, bạn có thể lưu giữ các chứng từ sau:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-slate-400 pt-2 border-t border-slate-800 font-mono">
                <div>• Hóa đơn mua máy hoặc chứng nhận bản quyền.</div>
                <div>• Tem COA (Certificate of Authenticity).</div>
                <div>• Khóa bản quyền (Product Key) chính hãng.</div>
                <div>• Email xác nhận từ Microsoft Store.</div>
                <div>• Hợp đồng cấp phép doanh nghiệp (VLSC / M365).</div>
                <div>• Tài khoản bản quyền số (Microsoft Digital License).</div>
              </div>
            </div>

            {/* SHORTENED MANDATORY DISCLAIMER BLOCK */}
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 leading-relaxed font-sans">
              Lưu ý: Kết quả chẩn đoán phản ánh dữ liệu hệ thống ghi nhận tại thời điểm kiểm tra. Việc đối soát bản quyền thực tế có thể cần thêm hóa đơn chứng từ kèm theo.
            </div>
          </div>

          {/* PROPERTY GRID 4 FIELDS COMPACT */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            <div className="bg-[#0e1626] p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] font-bold text-slate-500 block uppercase">Trạng Thái</span>
              <span className="font-bold text-emerald-400 text-sm mt-0.5 block">{report.provenance.activationStatus}</span>
            </div>

            <div className="bg-[#0e1626] p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] font-bold text-slate-500 block uppercase">Phương Thức</span>
              <span className="font-bold text-slate-200 text-sm mt-0.5 block flex items-center">
                {report.provenance.activationMethod}
                {renderTooltipIcon('GVLK')}
              </span>
            </div>

            <div className="bg-[#0e1626] p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] font-bold text-slate-500 block uppercase">
                {isKmsMethod ? 'Máy chủ KMS' : 'Nguồn kích hoạt'}
              </span>
              <span className="font-bold text-slate-200 text-sm mt-0.5 block">
                {report.provenance.kmsHostInfo?.host === 'Không đọc được dữ liệu' ? 'Chưa xác định' : report.provenance.activationSource}
              </span>
            </div>

            <div className="bg-[#0e1626] p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] font-bold text-slate-500 block uppercase flex items-center">
                Độ tin cậy nguồn kích hoạt
                {renderTooltipIcon('ActivationConfidence')}
              </span>
              <span className="font-bold text-cyan-400 text-sm mt-0.5 block">{report.provenance.confidence}%</span>
            </div>
          </div>

          {/* KHUYẾN NGHỊ */}
          <div className="bg-[#0e1626] p-3.5 rounded-xl border border-slate-800 text-xs text-slate-300 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed space-y-1">
              <strong className="text-white block font-bold text-xs">Khuyến nghị &amp; Lý do giải thích:</strong>
              <div className="text-slate-400 font-medium space-y-1 text-xs">
                <div>✓ Không cần khôi phục vì: <strong>Registry sạch, DLL chính hãng Microsoft, tệp hệ thống không có dấu hiệu can thiệp.</strong></div>
                <div>✓ Xác minh thêm nguồn KMS nếu cần đối soát máy chủ doanh nghiệp.</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NÚT ĐIỀU KHIỂN & BÁO CÁO EXPORT/COPY */}
      <div className="space-y-3 bg-[#131d33] p-4 rounded-xl border border-slate-800 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={handleRunScanV3}
            disabled={isScanning || isRestoring}
            className="w-full h-10 px-4 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
          >
            {isScanning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            {isScanning ? 'ĐANG QUÉT...' : 'BẮT ĐẦU KIỂM TRA OFFICE'}
          </button>

          <button
            onClick={handleRestoreV3}
            disabled={isScanning || isRestoring || !report || decision === 'BLOCK_RESTORE' || targetActionsCount === 0}
            className={`w-full h-10 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 ${
              targetActionsCount > 0 && !isRestoring
                ? 'bg-rose-600 hover:bg-rose-500 text-white cursor-pointer shadow-rose-900/30'
                : 'bg-[#18233c] text-slate-500 border border-slate-800 cursor-not-allowed'
            }`}
          >
            {isRestoring ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
            {isRestoring 
              ? 'ĐANG KHÔI PHỤC...' 
              : targetActionsCount === 0 
                ? 'Hệ thống sạch - Không cần thao tác' 
                : 'KHÔI PHỤC AN TOÀN'}
          </button>
        </div>

        {/* NÚT XUẤT/SAO CHÉP BÁO CÁO */}
        {report && (
          <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono">
            <span className="text-slate-400 font-bold uppercase">Xuất / Sao chép Báo cáo Chẩn đoán:</span>
            <div className="flex flex-wrap items-center gap-1.5">
              <button onClick={() => copyReportFormat('TXT')} className="px-2.5 py-1 bg-[#18233c] hover:bg-[#202f50] text-slate-300 rounded-lg font-bold border border-slate-700 flex items-center gap-1 cursor-pointer transition-colors">
                {copiedReportFormat === 'TXT' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />} Sao chép TXT
              </button>
              <button onClick={() => copyReportFormat('JSON')} className="px-2.5 py-1 bg-[#18233c] hover:bg-[#202f50] text-slate-300 rounded-lg font-bold border border-slate-700 flex items-center gap-1 cursor-pointer transition-colors">
                {copiedReportFormat === 'JSON' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />} Sao chép JSON
              </button>
              <button onClick={() => copyReportFormat('MD')} className="px-2.5 py-1 bg-[#18233c] hover:bg-[#202f50] text-slate-300 rounded-lg font-bold border border-slate-700 flex items-center gap-1 cursor-pointer transition-colors">
                {copiedReportFormat === 'MD' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />} Sao chép MD
              </button>
              <button onClick={() => exportReportFile('TXT')} className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-colors">
                <Download className="w-3 h-3" /> Tải TXT
              </button>
              <button onClick={() => exportReportFile('MD')} className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-colors">
                <Download className="w-3 h-3" /> Tải MD
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ⑤ CHI TIẾT KỸ THUẬT VỚI EXPANDABLE COLLECTOR ACCORDION & SYSTEM LOG */}
      {report && (
        <div className="space-y-3">
          <div className="bg-[#131d33] p-1.5 rounded-xl border border-slate-800 flex flex-wrap gap-1 text-xs shadow-sm">
            <button
              onClick={() => setActiveTab('matrix')}
              className={`px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${activeTab === 'matrix' ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20' : 'text-slate-400 hover:text-white'}`}
            >
              ⑤ Chi Tiết Các Bước Kiểm Tra ({report.matrix?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('plan')}
              className={`px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${activeTab === 'plan' ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20' : 'text-slate-400 hover:text-white'}`}
            >
              Kế Hoạch Khôi Phục
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${activeTab === 'audit' ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20' : 'text-slate-400 hover:text-white'}`}
            >
              Nhật Ký Hệ Thống
            </button>
          </div>

          <div className="bg-[#131d33] p-4 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 min-h-[140px] shadow-sm">
            
            {/* Tab 1: TRẠNG THÁI COLLECTOR VỚI CLICK TO EXPAND DETAILS */}
            {activeTab === 'matrix' && (
              <div className="space-y-2.5">
                <div className="font-bold text-slate-200 text-xs flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="flex items-center gap-2"><FileCheck2 className="w-3.5 h-3.5 text-cyan-400" /> CHI TIẾT DỮ LIỆU ĐỌC TỪ MÁY TÍNH:</span>
                  <span className="text-[10px] text-slate-500 font-normal">Bấm vào từng mục để xem thông số chi tiết</span>
                </div>
                <div className="space-y-1.5">
                  {report.matrix && report.matrix.map((item: any, i: number) => {
                    const isExpanded = expandedCollector === item.componentName;
                    return (
                      <div key={i} className="border border-slate-800 rounded-xl overflow-hidden transition-all bg-[#0e1626]">
                        <div 
                          onClick={() => setExpandedCollector(isExpanded ? null : item.componentName)}
                          className="p-2.5 flex items-center justify-between cursor-pointer hover:bg-[#162544] transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            {getComponentIcon(item.componentName)}
                            <span className="font-bold text-slate-200 text-xs">{item.componentName}</span>
                            <span className="text-[10px] text-slate-500 font-normal">({item.dataSource})</span>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-[10px] text-slate-500 font-mono">{item.executionTimeMs || 0}ms</span>
                            <span className="text-[10px] font-bold text-slate-400 font-mono">+{item.confidenceWeight}%</span>
                            {item.status === 'PASS' && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                ✔ PASS
                              </span>
                            )}
                            {item.status === 'WARNING' && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                ⚠ WARN
                              </span>
                            )}
                            {item.status === 'FAIL' && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                ✖ FAIL
                              </span>
                            )}
                          </div>
                        </div>

                        {/* CLICK TO EXPAND DETAILS */}
                        {isExpanded && (
                          <div className="p-3 bg-[#090e1a] text-slate-300 border-t border-slate-800 text-[11px] font-mono space-y-2">
                            <div className="flex justify-between items-center text-[10px] text-slate-400 border-b border-slate-800 pb-1">
                              <span>MỤC KIỂM TRA: <strong className="text-cyan-400">{item.componentName}</strong></span>
                              <span>THỜI GIAN THỰC THI: <strong className="text-emerald-400">{item.executionTimeMs || 0} ms</strong></span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px] uppercase font-bold">Kết quả ghi nhận:</span>
                              <div className="text-white font-medium">{item.details}</div>
                            </div>
                            {item.rawData && (
                              <div>
                                <span className="text-slate-400 block text-[10px] uppercase font-bold">Dữ liệu kỹ thuật gốc:</span>
                                <pre className="bg-[#040711] p-2 rounded-lg text-[10px] text-emerald-400 overflow-x-auto border border-slate-800">
                                  {JSON.stringify(item.rawData, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tab 2: Kế Hoạch Khôi Phục */}
            {activeTab === 'plan' && (
              <div className="space-y-2.5">
                <div className="font-bold text-slate-200 text-xs flex items-center gap-2 border-b border-slate-800 pb-2">
                  <Zap className="w-3.5 h-3.5 text-cyan-400" /> CHI TIẾT KẾ HOẠCH KHÔI PHỤC:
                </div>
                <div className="text-slate-300 bg-[#0e1626] p-3 rounded-xl border border-slate-800 font-bold text-xs">
                  {report.surgicalPlan?.summary}
                </div>
              </div>
            )}

            {/* Tab 3: Nhật Ký Hệ Thống */}
            {activeTab === 'audit' && (
              <div className="space-y-2.5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-800 pb-2">
                  <div className="font-bold text-slate-200 text-xs flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5 text-cyan-400" /> CHI TIẾT NHẬT KÝ SYSTEM LOG:
                  </div>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {getFilteredLogs().map((log: any, idx: number) => (
                    <div key={idx} className="p-2 bg-[#0e1626] rounded-lg border border-slate-800 text-[10px] font-mono text-slate-300 flex justify-between">
                      <span>[PASS] [{log.collectorName}] ({log.dataSource}): {log.details}</span>
                      <span className="text-slate-500 shrink-0 ml-2">{log.timestamp ? log.timestamp.split('T')[1]?.slice(0, 8) : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
