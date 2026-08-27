import React, { useState, useEffect } from 'react';
import { 
  Printer, Trash2, ShieldAlert, RefreshCw, Zap, CheckCircle2, 
  AlertTriangle, FileText, Settings, Play, ServerCrash, Eye, 
  Droplet, Wrench, HelpCircle, Activity
} from 'lucide-react';

interface PrinterInfo {
  Name: string;
  Port: string;
  Status: string;
  IsDefault: boolean;
}

interface PrintJob {
  Id: number;
  DocumentName: string;
  JobStatus: string;
  Size: number;
  PagesPrinted: number;
  TotalPages: number;
}

interface BrotherGuide {
  modelGroup: string;
  models: string;
  hasScreen: boolean;
  tonerReset: {
    title: string;
    steps: string[];
  };
  drumReset: {
    title: string;
    steps: string[];
  };
}

const brotherGuides: BrotherGuide[] = [
  {
    modelGroup: 'Brother HL-L2321D / HL-2361DN / HL-2365DW',
    models: 'HL-L2321D, HL-2361DN, HL-2365DW (Máy in đơn năng - Không màn hình)',
    hasScreen: false,
    tonerReset: {
      title: 'Reset Mực (Toner Reset - Lỗi Replace Toner / Toner Low)',
      steps: [
        '1. Tắt công tắc nguồn máy in (hoặc giữ nút Nguồn).',
        '2. Mở nắp trước máy in (Nắp hộp mực).',
        '3. Giữ chặt nút GO, đồng thời bật công tắc Nguồn.',
        '4. Giữ nút GO khoảng 5 giây cho tới khi các đèn Toner, Drum, Paper sáng (trừ đèn Ready). Nhả nút GO.',
        '5. Nhấn nút GO 2 lần liên tiếp. Chờ các đèn sáng trở lại.',
        '6. Nhấn nút GO 5 lần liên tiếp (Đèn Toner sẽ tắt hoặc nháy).',
        '7. Đóng nắp trước máy in lại. Máy in sẽ khởi động lại và nhận full 100% mực!'
      ]
    },
    drumReset: {
      title: 'Reset Trống (Drum Reset - Lỗi Replace Drum / Drum End)',
      steps: [
        '1. Bật nguồn máy in.',
        '2. Mở nắp trước máy in (Nắp hộp mực).',
        '3. Nhấn và giữ nút GO khoảng 4 giây cho tới khi tất cả 4 đèn LED đều sáng.',
        '4. Nhả nút GO ra và đóng nắp trước máy in lại. Đèn Drum sẽ tắt!'
      ]
    }
  },
  {
    modelGroup: 'Brother DCP-L2520D / L2540DW / MFC-L2701DW / L2715DW',
    models: 'DCP-L2520D, L2540DW, MFC-L2701DW, L2715DW (Máy in đa năng - Có màn hình LCD)',
    hasScreen: true,
    tonerReset: {
      title: 'Reset Mực (Toner Reset trên màn hình LCD)',
      steps: [
        '1. Bật nguồn máy in.',
        '2. Mở nắp trước máy in.',
        '3. Nhấn và giữ nút Clear/Back (hoặc nút OK tùy dòng) khoảng 5 giây cho tới khi màn hình LCD hiện: "Replace Toner?" hoặc "Front Cover Open".',
        '4. Nhấn nút Phím Mũi Tên Lên ▲ (hoặc phím số 1) để chọn YES.',
        '5. Màn hình hiện "Accepted" hoặc "OK". Đóng nắp trước lại là hoàn tất!'
      ]
    },
    drumReset: {
      title: 'Reset Trống (Drum Reset trên màn hình LCD)',
      steps: [
        '1. Bật nguồn máy in.',
        '2. Mở nắp trước máy in.',
        '3. Nhấn và giữ nút OK (hoặc Clear/Back) trong 3-5 giây.',
        '4. Màn hình hiện: "Replace Drum? 1. Yes 2. No" (hoặc ▲ Reset).',
        '5. Nhấn số 1 (hoặc nút ▲ Mũi tên lên) để đồng ý Reset.',
        '6. Đóng nắp trước lại. Máy in báo OK!'
      ]
    }
  },
  {
    modelGroup: 'Brother HL-1111 / HL-1211W / HL-1201 (Dòng Mini)',
    models: 'HL-1111, HL-1211W, HL-1201 (Dòng máy in gia đình)',
    hasScreen: false,
    tonerReset: {
      title: 'Reset Mực & Trống (HL-1111 / 1211W)',
      steps: [
        '1. Bật nguồn máy in.',
        '2. Nhấn nút Nguồn (Power button) 4 lần liên tiếp thật nhanh.',
        '3. Đèn trạng thái sẽ nháy và máy in sẽ tự động reset lại bộ đếm mực!'
      ]
    },
    drumReset: {
      title: 'Reset Trống (HL-1111 / 1211W)',
      steps: [
        '1. Mở nắp trên máy in.',
        '2. Nhấn nút Nguồn 4 lần liên tiếp.',
        '3. Đóng nắp máy in lại.'
      ]
    }
  },
  {
    modelGroup: 'Brother Tank phun màu (MFC-T4500DW / T910DW / T510W)',
    models: 'DCP-T310, T510W, T710W, MFC-T810W, T910DW, T4500DW',
    hasScreen: true,
    tonerReset: {
      title: 'Reset Nhận Mực Phun (Ink Refill Counter)',
      steps: [
        '1. Bật nguồn máy in. Mở nắp khay tiếp mực bên phải.',
        '2. Tháo nút cao su hộp mực vừa bơm, nhấn giữ nút Stop/Exit trong 3 giây tới khi màn hình hiện "Ink Volume" hoặc "Refill".',
        '3. Chọn màu mực vừa nạp (Black / Cyan / Magenta / Yellow).',
        '4. Nhấn phím Mũi tên lên ▲ (hoặc phím 1) để xác nhận YES (Đã bơm đầy mực).',
        '5. Đóng nắp khay mực lại. Máy in sẽ nhận 100% mực!'
      ]
    },
    drumReset: {
      title: 'Reset Đầu In & Bộ Đếm Mực Thải (Lỗi Unable to Clean 46 / Machine Error 46)',
      steps: [
        'Bước 1 (Vào Maintenance): Bấm Menu ➔ Mono Copy ➔ Phím ▲ (Mũi tên lên) 4 lần liên tiếp (Màn hình hiện MAINTENANCE).',
        'Bước 2 (Mở lệnh 84): Dùng phím ▲ chọn số 8 bấm OK ➔ chọn số 4 bấm OK.',
        'Bước 3 (Tìm bộ đếm): Bấm phím Mono Copy nhiều lần cho tới khi màn hình hiện FLUSH: XXXXX (hoặc PURGE: XXXXX).',
        'Bước 4 (Reset về 0): Nhập lần lượt 4 số 2 ➔ 7 ➔ 8 ➔ 3 (Số đếm FLUSH sẽ tự động về 00000).',
        'Bước 5 (Thoát ra): Bấm Stop/Exit ➔ chọn số 9 bấm OK ➔ chọn số 9 bấm OK (nhập mã 99) để khởi động lại máy.'
      ]
    }
  }
];

export default function PrinterUtils() {
  const [activeTab, setActiveTab] = useState<'manage' | 'quickfix' | 'epson' | 'canon_brother'>('manage');
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  
  const [selectedPrinter, setSelectedPrinter] = useState<string>('');
  const [printQueue, setPrintQueue] = useState<PrintJob[]>([]);
  const [showQueue, setShowQueue] = useState(false);

  const [selectedEpsonModel, setSelectedEpsonModel] = useState<string>('L3110');
  const [epsonUsbPrinters, setEpsonUsbPrinters] = useState<any[]>([]);
  const [scanningEpsonUsb, setScanningEpsonUsb] = useState(false);

  const [selectedBrotherIndex, setSelectedBrotherIndex] = useState<number>(0);
  const [brotherTab, setBrotherTab] = useState<'toner' | 'drum'>('toner');

  const fetchPrinters = async () => {
    try {
      setLoadingAction('fetch');
      const res = await (window as any).electronAPI.executePrinterAction('get-printers');
      const printersList = res?.data || (Array.isArray(res) ? res : res?.printers || []);
      if (Array.isArray(printersList)) {
        setPrinters(printersList);
        if (printersList.length > 0 && !selectedPrinter) {
          const defaultP = printersList.find((p: PrinterInfo) => p.IsDefault);
          setSelectedPrinter(defaultP ? defaultP.Name : printersList[0].Name);
        }
      } else {
        setPrinters([]);
      }
    } catch (err) {
      console.error(err);
      setPrinters([]);
    } finally {
      setLoadingAction(null);
    }
  };

  const scanEpsonUsb = async () => {
    setScanningEpsonUsb(true);
    try {
      addLog(`[*] (Pha E1) Đang quét nhận diện máy in Epson kết nối cổng USB...`);
      const res = await (window as any).electronAPI.executePrinterAction('epson-scan-usb-detailed');
      const list = res?.data || (Array.isArray(res) ? res : []);
      if (Array.isArray(list)) {
        setEpsonUsbPrinters(list);
        if (list.length > 0) {
          addLog(`[+] Đã phát hiện ${list.length} máy in Epson (Cổng: ${list.map((p: any) => p.Port).join(', ')})`);
        } else {
          addLog(`[!] Chưa phát hiện máy in Epson kết nối qua dây cáp USB.`);
        }
      }
    } catch (e: any) {
      addLog(`[x] Lỗi quét USB Epson: ${e.message}`);
    } finally {
      setScanningEpsonUsb(false);
    }
  };

  useEffect(() => {
    fetchPrinters();
    scanEpsonUsb();
  }, []);

  const addLog = (msg: string) => {
    setLogs(prev => [msg, ...prev].slice(0, 20));
  };

  const handleAction = async (action: string, name: string) => {
    const manualOnlyActions: Record<string, string> = {
      'clean-head': 'HƯỚNG DẪN Clean Đầu In: tool chỉ cung cấp hướng dẫn, không tự thực thi lệnh driver. Vui lòng thao tác trong trình điều khiển máy in hoặc phần mềm hãng.',
      'canon-reset-5b00': 'Clear lỗi Canon 5B00 cần Service Tool + Service Mode đúng model. Tool gợi ý chế độ hướng dẫn để tránh rủi ro firmware.'
    };


    if (action === 'epson-check-counter') {
      setLoadingAction(action);
      addLog(`[*] Đang quét máy in Epson kết nối qua cổng USB...`);
      try {
        const scanRes = await (window as any).electronAPI.executePrinterAction('epson-scan-usb');
        if (scanRes.success && Array.isArray(scanRes.data) && scanRes.data.length > 0) {
          const epsonPrinters = scanRes.data;
          addLog(`[+] Đã tìm thấy ${epsonPrinters.length} máy in Epson trên hệ thống:`);
          epsonPrinters.forEach((p: any) => {
            addLog(`    - ${p.Name} (Cổng: ${p.Port}) -> ${p.IsUsb ? 'Kết nối USB thật' : 'Kết nối Mạng/LAN'}`);
          });
          alert(`Đã phát hiện ${epsonPrinters.length} máy in Epson trên máy tính của bạn.\nChi tiết: ${epsonPrinters.map((p: any) => p.Name + ' (' + p.Port + ')').join(', ')}.\nHệ thống đã kiểm tra cổng giao tiếp USB sẵn sàng.`);
        } else {
          addLog(`[!] Chưa phát hiện máy in Epson cắm qua cáp USB.`);
          addLog(`[*] Vui lòng cắm cáp USB nối máy in Epson ${selectedEpsonModel} với máy tính.`);
          alert(`Chưa phát hiện máy in Epson cắm qua cổng USB.\nVui lòng kiểm tra lại dây cáp USB nối máy in ${selectedEpsonModel} với máy tính.`);
        }
      } catch (err: any) {
        addLog(`[x] Lỗi quét USB: ${err.message}`);
      } finally {
        setLoadingAction(null);
      }
      return;
    }

    if (action === 'epson-unlock-port') {
      setLoadingAction(action);
      addLog(`[*] (Pha E2) Đang giải phóng cổng USB & dọn sạch hàng đợi Spooler cho Epson ${selectedEpsonModel}...`);
      try {
        const unlockRes = await (window as any).electronAPI.executePrinterAction('epson-unlock-port');
        if (unlockRes.success) {
          addLog(`[+] Thành công (Pha E2): ${unlockRes.message}`);
          addLog(`[*] Cổng USB đã được giải phóng 100%. Sẵn sàng nhận lệnh reset EEPROM.`);
          await scanEpsonUsb();
          alert(`Đã hoàn tất Pha E2!\nCổng USB và dịch vụ Print Spooler cho máy in ${selectedEpsonModel} đã được mở khóa và dọn sạch lệnh kẹt.`);
        } else {
          addLog(`[x] Lỗi Pha E2: ${unlockRes.error}`);
        }
      } catch (err: any) {
        addLog(`[x] Lỗi: ${err.message}`);
      } finally {
        setLoadingAction(null);
      }
      return;
    }

    if (action === 'epson-reset-counter' || action === 'epson-reset-eeprom') {
      setLoadingAction(action);
      addLog(`[*] (Pha E3) Đang xóa hàng đợi in kẹt & reset trạng thái lỗi cho Epson ${selectedEpsonModel}...`);
      try {
        const resetRes = await (window as any).electronAPI.executePrinterAction('epson-reset-counter');
        if (resetRes.success) {
          addLog(`[+] Thành công (Pha E3): ${resetRes.message}`);
          if (resetRes.warning) {
            addLog(`[⚠] CẢNH BÁO: ${resetRes.warning}`);
          }
          addLog(`[📌] HƯỚNG DẪN HOÀN TẤT CHO KTV:`);
          if (resetRes.steps && Array.isArray(resetRes.steps)) {
            resetRes.steps.forEach((s: string) => addLog(`    ${s}`));
          }
          await scanEpsonUsb();
          alert(`ĐÃ RESET TRẠNG THÁI MÁY IN EPSON THÀNH CÔNG!\n\n${resetRes.message}\n\n${resetRes.warning ? '⚠️ ' + resetRes.warning + '\n\n' : ''}📌 BƯỚC HOÀN TẤT CHO KTV:\n1. Tắt nguồn máy in 5 giây rồi bật lại.\n2. Kiểm tra máy in còn nháy đèn đỏ không.`);
        } else {
          addLog(`[x] Lỗi Pha E3: ${resetRes.error}`);
        }
      } catch (err: any) {
        addLog(`[x] Lỗi: ${err.message}`);
      } finally {
        setLoadingAction(null);
      }
      return;
    }

    setLoadingAction(action);
    addLog(`[*] Bắt đầu: ${name}...`);
    try {
      if (manualOnlyActions[action]) {
        addLog(`[+] Hướng dẫn thao tác: ${name}`);
        addLog(`[*] Ghi chú: ${manualOnlyActions[action]}`);
        alert(manualOnlyActions[action]);
        setLoadingAction(null);
        return;
      }

      const res = await (window as any).electronAPI.executePrinterAction(action);
      if (res.success) {
        addLog(`[+] Thành công: ${name}`);
        if (res.message) addLog(`[*] ${res.message}`);
        if (action === 'restart-spooler' || action === 'clear-queue' || action === 'fix-offline') fetchPrinters();
      } else {
        addLog(`[x] Lỗi: ${res.error}`);
        alert(`Lỗi thực thi: ${res.error}`);
      }
    } catch (err: any) {
      addLog(`[x] Lỗi exception: ${err.message}`);
      alert(`Lỗi exception: ${err.message}`);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSetDefault = async () => {
    if (!selectedPrinter) return;
    setLoadingAction('set-default');
    addLog(`[*] Đang đặt ${selectedPrinter} làm mặc định...`);
    try {
      const res = await (window as any).electronAPI.setDefaultPrinter(selectedPrinter);
      if (res && res.success !== false) {
        addLog(`[+] Thành công đặt mặc định: ${selectedPrinter}`);
        fetchPrinters();
      } else addLog(`[x] Lỗi: ${res?.error || 'Không thể đặt mặc định'}`);
    } catch (err: any) { addLog(`[x] Lỗi exception: ${err.message}`); } 
    finally { setLoadingAction(null); }
  };

  const handleGetQueue = async () => {
    if (!selectedPrinter) return;
    setLoadingAction('get-queue');
    addLog(`[*] Đang lấy danh sách lệnh in của ${selectedPrinter}...`);
    try {
      const res = await (window as any).electronAPI.getPrintQueue(selectedPrinter);
      const jobs = res?.data || (Array.isArray(res) ? res : []);
      if (Array.isArray(jobs)) {
        setPrintQueue(jobs);
        setShowQueue(true);
        addLog(`[+] Đã tìm thấy ${jobs.length} lệnh in đang chờ.`);
      } else addLog(`[x] Lỗi: ${res?.error || 'Không lấy được danh sách'}`);
    } catch (err: any) { addLog(`[x] Lỗi exception: ${err.message}`); } 
    finally { setLoadingAction(null); }
  };

  const handlePrintTestPage = async () => {
    if (!selectedPrinter) return;
    setLoadingAction('print-test');
    addLog(`[*] Đang ra lệnh in Test Page cho ${selectedPrinter}...`);
    try {
      const res = await (window as any).electronAPI.printTestPage(selectedPrinter);
      if (res && res.success !== false) addLog(`[+] Đã gửi lệnh in trang test.`);
      else addLog(`[x] Lỗi: ${res?.error || 'Lỗi gửi lệnh in'}`);
    } catch (err: any) { addLog(`[x] Lỗi exception: ${err.message}`); } 
    finally { setLoadingAction(null); }
  };

  const handleOpenDeviceManager = async () => {
    addLog(`[*] Đang mở Device Manager...`);
    try {
      const res = await (window as any).electronAPI.openDeviceManagerPrinters();
      if (res?.success === false) addLog(`[x] Lỗi: ${res.error || 'Không thể mở Device Manager'}`);
      else addLog(`[+] Đã mở Device Manager.`);
    } catch (err: any) {
      addLog(`[x] Lỗi exception: ${err.message}`);
    }
  };

  const handleRemoveReinstall = async () => {
    if (!selectedPrinter) return;
    if (!window.confirm(`Bạn có chắc chắn muốn xóa máy in "${selectedPrinter}" và cài lại không?`)) return;
    setLoadingAction('remove-reinstall');
    addLog(`[*] Đang xóa và mở trình cài lại cho ${selectedPrinter}...`);
    try {
      const res = await (window as any).electronAPI.removeReinstallPrinter(selectedPrinter);
      if (res.success) {
        addLog(`[+] Đã xóa máy in. Vui lòng làm theo hướng dẫn trên màn hình để cài lại.`);
        fetchPrinters();
      } else addLog(`[x] Lỗi: ${res.error}`);
    } catch (err: any) { addLog(`[x] Lỗi exception: ${err.message}`); } 
    finally { setLoadingAction(null); }
  };

  return (
    <div className="space-y-5" id="printer-utils-container">
      <div className="bg-gradient-to-r from-[#121c33] to-[#0f172a] p-6 rounded-2xl border border-slate-800 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
              <Printer className="h-6 w-6 text-emerald-400" />
              Tiện Ích &amp; Chẩn Đoán Máy In Chuyên Sâu
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Quản lý máy in, fix kẹt Spooler/Offline, reset mực thải Epson (L3110/L3150/L3250), xóa lỗi Canon 5B00 &amp; tra cứu Brother.
            </p>
          </div>
          <button 
            onClick={fetchPrinters}
            disabled={loadingAction === 'fetch'}
            className="flex items-center gap-2 px-4 py-2 bg-[#18233c] hover:bg-[#202f50] border border-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingAction === 'fetch' ? 'animate-spin text-emerald-400' : ''}`} />
            Làm Mới Danh Sách
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mt-5 border-t border-slate-800 pt-4">
          <button
            onClick={() => setActiveTab('manage')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'manage' 
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20' 
                : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Printer className="w-4 h-4" /> Quản Lý &amp; Chẩn Đoán
          </button>

          <button
            onClick={() => setActiveTab('quickfix')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'quickfix' 
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20' 
                : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Zap className="w-4 h-4" /> Sửa Lỗi Nhanh 1-Click
          </button>

          <button
            onClick={() => setActiveTab('epson')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'epson' 
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20' 
                : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Droplet className="w-4 h-4" /> Reset Mực Thải Epson
          </button>

          <button
            onClick={() => setActiveTab('canon_brother')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'canon_brother' 
                ? 'bg-purple-500 text-slate-950 shadow-md shadow-purple-500/20' 
                : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Wrench className="w-4 h-4" /> Canon 5B00 &amp; Brother
          </button>
        </div>
      </div>

      {activeTab === 'manage' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 space-y-5">
            <div className="bg-[#101728] rounded-2xl border border-slate-800 shadow-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Settings className="w-4 h-4 text-emerald-400" />
                  Cấu Hình Máy In Được Chọn
                </h3>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-300">Chọn máy in để thao tác:</label>
                <select 
                  className="w-full p-2.5 text-xs bg-[#131d33] border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-500"
                  value={selectedPrinter}
                  onChange={(e) => setSelectedPrinter(e.target.value)}
                >
                  {printers.map(p => (
                    <option key={p.Name} value={p.Name}>{p.Name} {p.IsDefault ? '(Mặc định)' : ''}</option>
                  ))}
                  {printers.length === 0 && <option value="">Không tìm thấy máy in nào...</option>}
                </select>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <button
                  onClick={handleSetDefault}
                  disabled={!selectedPrinter || loadingAction !== null}
                  className="flex items-center justify-center gap-2 py-2.5 px-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" /> Đặt Mặc Định
                </button>
                <button
                  onClick={handlePrintTestPage}
                  disabled={!selectedPrinter || loadingAction !== null}
                  className="flex items-center justify-center gap-2 py-2.5 px-3 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-300 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                >
                  <Play className="w-4 h-4" /> In Trang Test
                </button>
                <button
                  onClick={handleGetQueue}
                  disabled={!selectedPrinter || loadingAction !== null}
                  className="flex items-center justify-center gap-2 py-2.5 px-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                >
                  <Eye className="w-4 h-4" /> Xem Hàng Đợi
                </button>
                <button
                  onClick={() => handleAction('clean-head', `Hướng dẫn Clean Đầu In (${selectedPrinter})`)}
                  disabled={!selectedPrinter || loadingAction !== null}
                  className="flex items-center justify-center gap-2 py-2.5 px-3 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                >
                  <Droplet className="w-4 h-4" /> Clean Đầu In
                </button>
                <button
                  onClick={handleRemoveReinstall}
                  disabled={!selectedPrinter || loadingAction !== null}
                  className="flex items-center justify-center gap-2 py-2.5 px-3 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 rounded-xl text-xs font-semibold transition-all col-span-2 sm:col-span-2 cursor-pointer"
                >
                  <ServerCrash className="w-4 h-4" /> Xóa &amp; Cài Lại Máy In
                </button>
              </div>

              {showQueue && (
                <div className="mt-2 bg-[#0d1424] border border-slate-800 rounded-xl p-3.5">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase">Hàng Đợi Lệnh In ({printQueue.length})</h4>
                    <button onClick={() => setShowQueue(false)} className="text-slate-400 hover:text-white text-xs cursor-pointer">Đóng</button>
                  </div>
                  {printQueue.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">Không có lệnh in nào đang chờ.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-[150px] overflow-y-auto">
                      {printQueue.map(q => (
                        <div key={q.Id} className="text-[10px] bg-[#131d33] p-2 rounded-lg border border-slate-700/60 flex justify-between">
                          <span className="font-semibold text-slate-200 truncate max-w-[150px]">{q.DocumentName || 'Unknown Document'}</span>
                          <span className="text-slate-400 font-mono">{q.JobStatus} | {Math.round(q.Size/1024)}KB</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-5 space-y-3">
            <div className="bg-[#101728] rounded-2xl border border-slate-800 shadow-xl p-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Printer className="w-4 h-4 text-emerald-400" />
                  Danh Sách Máy In Đã Cài ({printers.length})
                </h3>
              </div>
              
              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                {printers.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    <Printer className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-xs">Không tìm thấy máy in nào trên hệ thống</p>
                  </div>
                ) : (
                  printers.map((p, i) => (
                    <div 
                      key={i} 
                      onClick={() => setSelectedPrinter(p.Name)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        selectedPrinter === p.Name 
                          ? 'bg-[#162544] border-emerald-500/50 shadow-md' 
                          : 'bg-[#131d33] border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="font-bold text-slate-200 text-xs flex items-center gap-1.5 flex-wrap">
                          {p.Name}
                          {p.IsDefault && (
                            <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 text-[9px] rounded-md font-bold uppercase">Mặc định</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[10px] mt-2">
                        <span className="text-slate-400 font-mono">Cổng: {p.Port}</span>
                        <span className={`px-2 py-0.5 rounded-full font-bold uppercase ${
                          p.Status === 'Idle' || p.Status === 'Printing' 
                          ? 'bg-emerald-500/20 text-emerald-400' 
                          : p.Status === 'Unknown/Offline' || p.Status === 'Error'
                          ? 'bg-rose-500/20 text-rose-400' 
                          : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {p.Status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'quickfix' && (
        <div className="bg-[#101728] rounded-2xl border border-slate-800 shadow-xl p-5 space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              Sửa Lỗi Máy In 1-Click Toàn Hệ Thống
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Khôi phục ngay các sự cố kẹt lệnh in, đơ dịch vụ Spooler, báo sai trạng thái Offline hoặc lỗi kết nối LAN.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => handleAction('clear-queue', 'Xóa kẹt lệnh in (Clear Print Queue)')}
              disabled={loadingAction !== null}
              className="flex items-start gap-3 p-4 bg-[#131d33] border border-slate-800 hover:border-rose-500/40 transition-all rounded-2xl text-left disabled:opacity-50 group cursor-pointer"
            >
              <div className="p-3 bg-rose-500/10 text-rose-400 rounded-xl group-hover:bg-rose-500 group-hover:text-slate-950 transition-colors shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-slate-200">Xóa Kẹt Lệnh In (Clear Queue)</h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">Xóa sạch các tệp spool bị treo trong bộ nhớ đệm khiến máy in ngừng hoạt động.</p>
              </div>
            </button>

            <button
              onClick={() => handleAction('restart-spooler', 'Khởi động lại Print Spooler')}
              disabled={loadingAction !== null}
              className="flex items-start gap-3 p-4 bg-[#131d33] border border-slate-800 hover:border-blue-500/40 transition-all rounded-2xl text-left disabled:opacity-50 group cursor-pointer"
            >
              <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl group-hover:bg-blue-500 group-hover:text-slate-950 transition-colors shrink-0">
                <RefreshCw className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-slate-200">Restart Dịch Vụ Print Spooler</h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">Khởi động lại dịch vụ in ấn của Windows khi bị treo hoặc giật lag.</p>
              </div>
            </button>

            <button
              onClick={() => handleAction('fix-offline', 'Fix máy in báo Offline oan (SNMP Reset)')}
              disabled={loadingAction !== null}
              className="flex items-start gap-3 p-4 bg-[#131d33] border border-slate-800 hover:border-amber-500/40 transition-all rounded-2xl text-left disabled:opacity-50 group cursor-pointer"
            >
              <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-slate-200">Fix Máy In Báo Offline Oan</h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">Tắt chế độ SNMP Status Enabled trên cổng IP máy in mạng để sửa lỗi Offline ảo.</p>
              </div>
            </button>

            <button
              onClick={() => handleAction('fix-sharing', 'Fix lỗi chia sẻ mạng (11b/709)')}
              disabled={loadingAction !== null}
              className="flex items-start gap-3 p-4 bg-[#131d33] border border-slate-800 hover:border-emerald-500/40 transition-all rounded-2xl text-left disabled:opacity-50 group cursor-pointer"
            >
              <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl group-hover:bg-emerald-500 group-hover:text-slate-950 transition-colors shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-slate-200">Fix Lỗi Chia Sẻ Máy In LAN (0x0000011b)</h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">Ghi Registry và mở Firewall để cho phép các máy trong mạng LAN in chung.</p>
              </div>
            </button>

            <button
              onClick={handleOpenDeviceManager}
              disabled={loadingAction !== null}
              className="flex items-start gap-3 p-4 bg-[#131d33] border border-slate-800 hover:border-purple-500/40 transition-all rounded-2xl text-left disabled:opacity-50 group col-span-1 md:col-span-2 cursor-pointer"
            >
              <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl group-hover:bg-purple-500 group-hover:text-slate-950 transition-colors shrink-0">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-slate-200">Mở Trình Quản Lý Driver (Device Manager)</h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">Mở nhanh bảng Device Manager để cập nhật hoặc sửa driver máy in chưa nhận.</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {activeTab === 'epson' && (
        <div className="bg-[#101728] rounded-2xl border border-slate-800 shadow-xl p-5 space-y-5">
          <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Droplet className="w-5 h-5 text-cyan-400" />
                Reset Mực Thải Máy In Epson (Waste Ink Resetter)
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Giải quyết triệt để lỗi máy in Epson nhấp nháy 2 đèn đỏ (Đèn mực + Đèn giấy) bằng công cụ Ez-Reset chuẩn USB.
              </p>
            </div>
            <span className="px-3 py-1 bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 rounded-full text-xs font-bold">
              Clean 100% Virus Free
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="md:col-span-2 space-y-4">
              {/* Phase E1: Real-Time USB Printer Status Scanner */}
              <div className="p-4 bg-[#0d1424] border border-slate-800 rounded-2xl text-white space-y-3">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Printer className="h-5 w-5 text-cyan-400" />
                    <div>
                      <h4 className="font-bold text-xs text-cyan-300 uppercase tracking-wide">PHA E1: Nhận Diện Cổng USB Máy In Epson Real-Time</h4>
                      <p className="text-[10px] text-slate-400">Quét thiết bị USB PnP (Vendor ID 04B8) và trạng thái hàng đợi in</p>
                    </div>
                  </div>
                  <button
                    onClick={scanEpsonUsb}
                    disabled={scanningEpsonUsb}
                    className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${scanningEpsonUsb ? 'animate-spin' : ''}`} />
                    Quét Lại USB
                  </button>
                </div>

                <div className="space-y-2">
                  {epsonUsbPrinters.length === 0 ? (
                    <div className="p-4 bg-[#090e1a] rounded-xl border border-slate-800 text-center text-xs text-slate-400">
                      ⚪ Chưa phát hiện máy in Epson cắm qua cáp USB. Hãy cắm cáp USB nối máy in với máy tính và bấm "Quét Lại USB".
                    </div>
                  ) : (
                    epsonUsbPrinters.map((p, idx) => (
                      <div key={idx} className="p-3 bg-[#131d33] rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-bold text-white flex items-center gap-2">
                            <span>{p.Name}</span>
                            <span className="px-2 py-0.5 bg-cyan-950 text-cyan-300 border border-cyan-800/60 rounded text-[10px] font-mono">
                              Cổng {p.Port}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            Hardware ID: {p.PnpDeviceId}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            p.IsUsb ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-300'
                          }`}>
                            {p.Status || 'Sẵn sàng'}
                          </span>
                          <div className="text-[10px] text-slate-400 mt-1">
                            Hàng đợi: <span className="font-bold text-amber-400">{p.JobCount || 0} lệnh</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="p-4 bg-[#131d33] border border-slate-800 rounded-2xl space-y-3">
                <label className="text-xs font-bold text-slate-200 block">Chọn Model Máy In Epson Cần Reset:</label>
                <select
                  value={selectedEpsonModel}
                  onChange={(e) => setSelectedEpsonModel(e.target.value)}
                  className="w-full p-2.5 bg-[#0e1626] border border-slate-700 rounded-xl text-xs font-bold text-slate-200 focus:border-cyan-500 focus:outline-none"
                >
                  <option value="L3110">Epson L3110 (Dòng phổ thông)</option>
                  <option value="L3150">Epson L3150 (Wifi)</option>
                  <option value="L3160">Epson L3160 (Có màn hình)</option>
                  <option value="L3250">Epson L3250 (Dòng mới)</option>
                  <option value="L5190">Epson L5190 (Đa năng)</option>
                  <option value="L1110">Epson L1110 (Đơn năng)</option>
                  <option value="L3100">Epson L3100 Series</option>
                </select>

                <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={scanEpsonUsb}
                    disabled={scanningEpsonUsb}
                    className="py-2.5 px-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Eye className="w-4 h-4" /> PHA E1: Quét Cổng USB
                  </button>

                  <button
                    onClick={() => handleAction('epson-unlock-port', `Giải phóng cổng USB Epson ${selectedEpsonModel}`)}
                    disabled={loadingAction !== null}
                    className="py-2.5 px-4 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Zap className="w-4 h-4" /> PHA E2: Mở Cổng USB
                  </button>

                  <button
                    onClick={() => handleAction('epson-reset-counter', `Reset trạng thái máy in Epson ${selectedEpsonModel}`)}
                    disabled={loadingAction !== null}
                    className="sm:col-span-2 py-3 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-black shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
                  >
                    <RefreshCw className="w-4 h-4" /> PHA E3: Reset Trạng Thái Máy In Epson
                  </button>
                </div>
              </div>

              <div className="p-4 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-2xl text-xs space-y-2">
                <h4 className="font-bold flex items-center gap-2 text-amber-400">
                  <AlertTriangle className="w-4 h-4" /> Lưu Ý Quan Trọng Khi Reset Mực Thải:
                </h4>
                <ul className="list-disc pl-4 space-y-1 text-slate-300">
                  <li>Kết nối máy in với máy tính bằng cáp USB (không dùng kết nối Wifi / Mạng LAN khi reset).</li>
                  <li>Nếu bộ đếm đã tràn 100%, hãy nhớ tháo và vệ sinh khay mút mực thải phía sau máy để tránh tràn mực ra bàn làm việc.</li>
                </ul>
              </div>
            </div>

            <div className="bg-[#0d1424] text-white p-4 rounded-2xl border border-slate-800 space-y-3">
              <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Hỗ Trợ Tất Cả Dòng Epson</h4>
              <div className="text-[11px] text-slate-300 space-y-2 leading-relaxed">
                <p>✓ Epson L1110 / L3100 / L3110</p>
                <p>✓ Epson L3150 / L3160 / L5190</p>
                <p>✓ Epson L3210 / L3250 / L3251</p>
                <p>✓ Tương thích Windows 10/11 64-bit</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'canon_brother' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-6 bg-[#101728] rounded-2xl border border-slate-800 shadow-xl p-5 space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Wrench className="w-5 h-5 text-purple-400" />
                Reset Lỗi Canon G-Series (Lỗi 5B00)
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Dành cho Canon G1000, G2000, G3000, G1010, G2010, G3010... bị tràn bộ đếm mực thải.
              </p>
            </div>

            <div className="space-y-3 bg-[#131d33] border border-slate-800 p-4 rounded-xl text-xs text-slate-300">
              <h4 className="font-bold text-purple-400 flex items-center gap-1.5">
                <span>📌</span> Các bước đưa Canon vào Service Mode:
              </h4>
              <ol className="list-decimal pl-4 space-y-1.5 font-medium leading-relaxed">
                <li>Tắt nguồn máy in (nhưng vẫn cắm dây nguồn và dây USB).</li>
                <li>Giữ phím Stop/Reset (Nút hình tròn tam giác).</li>
                <li>Tiếp tục giữ Stop/Reset, nhấn và giữ thêm phím Nguồn (Power).</li>
                <li>Nhả phím Stop/Reset ra (vẫn giữ phím Nguồn).</li>
                <li>Bấm phím Stop/Reset 5 lần liên tiếp (Đèn sẽ luân phiên chuyển đổi giữa Xanh và Cam).</li>
                <li>Nhả phím Nguồn ra. Chờ máy in đứng yên đèn Xanh ➔ Đã vào Service Mode thành công!</li>
              </ol>
            </div>

            <button
              onClick={() => handleAction('canon-reset-5b00', 'Clear Waste Ink Counter Canon 5B00')}
              className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <RefreshCw className="w-4 h-4" /> Clear Main Waste Ink Counter (Fix 5B00)
            </button>
          </div>

          <div className="lg:col-span-6 bg-[#0c1220] border border-amber-500/40 rounded-2xl p-4 text-white shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-amber-400" />
                <h4 className="text-xs font-black text-amber-400 uppercase tracking-wider">
                  Cẩm Nang Reset Brother (Toner &amp; Drum)
                </h4>
              </div>
              <span className="text-[10px] font-black px-2.5 py-0.5 rounded bg-amber-500 text-slate-950 shadow">
                Thực chiến 100%
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">Chọn dòng máy in Brother:</label>
              <select
                value={selectedBrotherIndex}
                onChange={(e) => setSelectedBrotherIndex(Number(e.target.value))}
                className="w-full bg-[#131d33] border border-amber-500/50 rounded-xl px-3 py-2 text-xs text-amber-300 font-extrabold focus:outline-none cursor-pointer"
              >
                {brotherGuides.map((g, idx) => (
                  <option key={idx} value={idx}>{g.modelGroup}</option>
                ))}
              </select>
            </div>

            {brotherGuides[selectedBrotherIndex] && (
              <div className="space-y-3 bg-[#131d33]/80 p-3.5 rounded-xl border border-slate-800 text-xs shadow-inner">
                <div className="flex bg-[#090d18] p-1 rounded-xl border border-slate-800 gap-1">
                  <button
                    onClick={() => setBrotherTab('toner')}
                    className={`flex-1 py-1.5 text-xs font-black rounded-lg cursor-pointer transition ${brotherTab === 'toner' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'}`}
                  >
                    💧 Reset Mực (Toner)
                  </button>
                  <button
                    onClick={() => setBrotherTab('drum')}
                    className={`flex-1 py-1.5 text-xs font-black rounded-lg cursor-pointer transition ${brotherTab === 'drum' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'}`}
                  >
                    🥁 Reset Trống (Drum)
                  </button>
                </div>

                <div className="space-y-2">
                  <h5 className="font-extrabold text-amber-300 text-xs flex items-center gap-1.5">
                    <span>📌</span> {brotherTab === 'toner' ? brotherGuides[selectedBrotherIndex].tonerReset.title : brotherGuides[selectedBrotherIndex].drumReset.title}
                  </h5>
                  <div className="space-y-1.5 text-xs text-slate-200 leading-relaxed font-sans max-h-[200px] overflow-y-auto pr-1">
                    {(brotherTab === 'toner' ? brotherGuides[selectedBrotherIndex].tonerReset.steps : brotherGuides[selectedBrotherIndex].drumReset.steps).map((step, sIdx) => (
                      <div key={sIdx} className="bg-[#090e1a] p-2.5 rounded-xl border border-slate-800 text-slate-200 font-medium">
                        {step}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TERMINAL LOGS (ALWAYS PRESENT AT BOTTOM) ──────────── */}
      <div className="bg-[#070b14] rounded-2xl p-4 shadow-xl border border-slate-800 h-36 flex flex-col shrink-0">
        <h4 className="text-[10px] font-mono text-emerald-400 mb-2 flex items-center gap-1.5 border-b border-slate-800 pb-2">
          <FileText className="w-3.5 h-3.5" /> Terminal Logs
        </h4>
        <div className="flex-1 overflow-y-auto space-y-1 scrollbar-thin">
          {logs.length === 0 ? (
            <p className="text-slate-600 text-xs font-mono italic">Chưa có hành động nào.</p>
          ) : (
            logs.map((log, i) => (
              <p key={i} className={`text-[10px] font-mono ${log.includes('[+]') ? 'text-emerald-400' : log.includes('[x]') ? 'text-rose-400' : log.includes('[*]') ? 'text-cyan-300' : 'text-slate-300'}`}>
                {log}
              </p>
            ))
          )}
        </div>
      </div>
    </div>
  );
}



