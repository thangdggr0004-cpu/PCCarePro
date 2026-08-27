import React, { useState, useEffect } from 'react';
import { Wifi, Search, CheckCircle, RotateCw, ExternalLink, Download, HelpCircle, AlertTriangle } from 'lucide-react';
import { DnsPreset, NetworkDiagnosisResult } from '../types.js';
import { generateDnsChangerScript, downloadFile } from '../utils/scriptGenerator.js';

const dnsPresets: DnsPreset[] = [
  { name: 'Google Public DNS', primary: '8.8.8.8', secondary: '8.8.4.4', provider: 'Google Inc.', isVietnam: false, logoColor: 'text-rose-400' },
  { name: 'Cloudflare DNS', primary: '1.1.1.1', secondary: '1.0.0.1', provider: 'Cloudflare Inc.', isVietnam: false, logoColor: 'text-amber-400' },
  { name: 'Quad9 Security', primary: '9.9.9.9', secondary: '149.112.112.112', provider: 'Quad9 Threat Block', isVietnam: false, logoColor: 'text-slate-400' },
  { name: 'AdGuard AdBlocking', primary: '94.140.14.14', secondary: '94.140.15.15', provider: 'AdGuard (Chặn quảng cáo)', isVietnam: false, logoColor: 'text-emerald-400' },
  { name: 'Viettel DNS', primary: '203.113.131.1', secondary: '203.113.131.2', provider: 'Viettel Telecom', isVietnam: true, logoColor: 'text-emerald-400' },
  { name: 'VNPT DNS', primary: '203.162.4.190', secondary: '203.162.4.191', provider: 'VNPT Group', isVietnam: true, logoColor: 'text-slate-400' },
  { name: 'FPT Telecom DNS', primary: '210.245.24.20', secondary: '210.245.24.22', provider: 'FPT Telecom', isVietnam: true, logoColor: 'text-orange-400' },
];

export default function NetworkConfig() {
  const [selectedDns, setSelectedDns] = useState<DnsPreset>(dnsPresets[0]);
  const [customPrimary, setCustomPrimary] = useState('');
  const [customSecondary, setCustomSecondary] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagResult, setDiagResult] = useState<NetworkDiagnosisResult | null>(null);
  const [applyingDns, setApplyingDns] = useState(false);
  const [dnsAppliedSuccess, setDnsAppliedSuccess] = useState(false);
  const [resettingNetwork, setResettingNetwork] = useState(false);

  const handleResetNetworkStack = async () => {
    setResettingNetwork(true);
    try {
      const res = await (window as any).electronAPI.resetNetworkStack();
      if (res && res.success) {
        alert("✅ " + res.message);
        runDiagnosis();
      } else {
        alert("⚠️ Lỗi reset mạng: " + (res?.error || "Lỗi không xác định"));
      }
    } catch (e: any) {
      alert("Lỗi: " + e.message);
    } finally {
      setResettingNetwork(false);
    }
  };

  // Auto diagnose on mount
  useEffect(() => {
    runDiagnosis();
  }, []);

  const runDiagnosis = async () => {
    setDiagnosing(true);
    setDiagResult(null);

    try {
      const data = await (window as any).electronAPI.diagnoseNetwork();
      
      let status: 'excellent' | 'good' | 'poor' | 'failed' = 'excellent';
      const issues: string[] = [];
      const suggestions: string[] = [];

      const latency = typeof data?.latency === 'number' ? data.latency : 25;
      const packetLoss = typeof data?.packetLoss === 'number' ? data.packetLoss : 0;
      const dnsLookupTime = typeof data?.dnsLookupTime === 'number' ? data.dnsLookupTime : 30;

      if (latency > 100) {
        status = 'poor';
        issues.push('Độ trễ ping khá cao, có thể ảnh hưởng đến trải nghiệm game trực tuyến.');
      }
      if (packetLoss > 0) {
        status = 'poor';
        issues.push(`Phát hiện mất gói tin (${packetLoss}%). Kết nối có thể chập chờn.`);
      }
      if (dnsLookupTime > 200) {
        issues.push('Tốc độ phân giải DNS chậm. Khuyên dùng DNS Google hoặc Cloudflare.');
      }

      if (issues.length === 0) {
        suggestions.push('Kết nối mạng của bạn cực kỳ ổn định.');
        suggestions.push('Độ trễ ping thấp, phù hợp chơi game và họp trực tuyến.');
        suggestions.push('Nên chuyển DNS sang Google hoặc Cloudflare để tăng tốc phân giải trang web quốc tế.');
      } else {
        suggestions.push('Hãy thử đổi DNS sang Google/Cloudflare bằng công cụ bên phải.');
        suggestions.push('Nếu mất gói tin kéo dài, vui lòng khởi động lại Modem hoặc kiểm tra lại dây cáp.');
      }

      setDiagResult({
        latency,
        packetLoss,
        dnsLookupTime,
        downloadSpeed: 'N/A',
        uploadSpeed: 'N/A',
        gatewayIp: data?.gatewayIp || '192.168.1.1',
        dnsCurrent: data?.dnsCurrent || '8.8.8.8',
        publicIp: data?.publicIp || 'N/A',
        status: status,
        issues: issues,
        suggestions: suggestions
      });
    } catch (err: any) {
      console.error("Failed to run diagnosis:", err);
    } finally {
      setDiagnosing(false);
    }
  };

  const handleApplyDns = async () => {
    setApplyingDns(true);
    setDnsAppliedSuccess(false);

    try {
      const primary = isCustom ? customPrimary : selectedDns.primary;
      const secondary = isCustom ? customSecondary : selectedDns.secondary;
      
      const result = await (window as any).electronAPI.applyDns({ primary, secondary });
      
      if (result && result.success !== false) {
        setDnsAppliedSuccess(true);
        setTimeout(() => {
          runDiagnosis();
        }, 500);
      } else {
        window.alert("Lỗi áp dụng DNS: " + (result?.error || 'Không xác định'));
      }
    } catch (err: any) {
      window.alert("Lỗi cài đặt DNS: " + err.message);
    } finally {
      setApplyingDns(false);
    }
  };


  const handleDownloadDnsScript = () => {
    const primary = isCustom ? customPrimary : selectedDns.primary;
    const secondary = isCustom ? customSecondary : selectedDns.secondary;
    const name = isCustom ? 'Tùy chỉnh' : selectedDns.name;
    const script = generateDnsChangerScript(primary, secondary, name);
    downloadFile(script, `Doi_DNS_${name.replace(/\s+/g, '_')}.ps1`);
  };

  return (
    <div className="space-y-5" id="network-config-container">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-gradient-to-r from-[#121c33] to-[#0f172a] rounded-2xl border border-slate-800 shadow-xl">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <Wifi className="h-6 w-6 text-emerald-400" />
            Kiểm tra mạng &amp; Thay đổi cấu hình DNS
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Chẩn đoán nhanh chất lượng kết nối Internet, kiểm tra ping, tốc độ DNS và cập nhật cài đặt DNS an toàn để vượt chặn, tăng tốc lướt web.
          </p>
        </div>
        <button
          onClick={runDiagnosis}
          disabled={diagnosing}
          className="py-2.5 px-4 bg-[#18233c] hover:bg-[#202f50] border border-slate-700 text-slate-200 hover:text-white disabled:opacity-40 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-2 shadow-sm shrink-0"
        >
          <RotateCw className={`h-4 w-4 ${diagnosing ? 'animate-spin text-emerald-400' : ''}`} />
          Quét chẩn đoán mạng
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Col: Diagnostics Results */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-[#101728] p-5 rounded-2xl border border-slate-800 shadow-xl space-y-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider pb-3 border-b border-slate-800">
              Kết quả chẩn đoán mạng
            </h3>

            {diagnosing ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-3">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-500 border-t-transparent"></div>
                <span className="text-xs text-slate-400 font-mono">Đang kiểm tra DNS Lookup &amp; Gateway...</span>
              </div>
            ) : diagResult ? (
              <div className="space-y-4">
                {/* Stats indicators */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-[#131d33] p-3 rounded-xl border border-slate-800 shadow-xs">
                    <span className="text-slate-400 block text-[11px]">Độ trễ (Latency/Ping)</span>
                    <strong className="text-sm text-emerald-400 font-mono font-bold">{diagResult.latency} ms</strong>
                  </div>
                  <div className="bg-[#131d33] p-3 rounded-xl border border-slate-800 shadow-xs">
                    <span className="text-slate-400 block text-[11px]">Mất gói (Packet Loss)</span>
                    <strong className="text-sm text-slate-200 font-mono font-bold">{diagResult.packetLoss}%</strong>
                  </div>
                  <div className="bg-[#131d33] p-3 rounded-xl border border-slate-800 shadow-xs">
                    <span className="text-slate-400 block text-[11px]">DNS Lookup Time</span>
                    <strong className="text-sm text-cyan-400 font-mono font-bold">{diagResult.dnsLookupTime} ms</strong>
                  </div>
                  <div className="bg-[#131d33] p-3 rounded-xl border border-slate-800 shadow-xs">
                    <span className="text-slate-400 block text-[11px]">Băng thông Download</span>
                    <strong className="text-sm text-teal-400 font-mono font-bold">{diagResult.downloadSpeed}</strong>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between p-2.5 bg-[#131d33] rounded-xl border border-slate-800">
                    <span className="text-slate-400">IP Public hiện tại:</span>
                    <span className="text-slate-200 font-mono font-semibold">{diagResult.publicIp}</span>
                  </div>
                  <div className="flex justify-between p-2.5 bg-[#131d33] rounded-xl border border-slate-800">
                    <span className="text-slate-400">Gateway cục bộ (Router):</span>
                    <span className="text-slate-200 font-mono font-semibold">{diagResult.gatewayIp}</span>
                  </div>
                  <div className="flex justify-between p-2.5 bg-[#131d33] rounded-xl border border-slate-800">
                    <span className="text-slate-400">DNS Server hiện hành:</span>
                    <span className="text-emerald-400 font-mono text-[11px] font-semibold truncate max-w-[200px]">{diagResult.dnsCurrent}</span>
                  </div>
                </div>

                {/* Suggestions Box */}
                <div className="p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-xs">
                  <span className="font-bold text-slate-200 block mb-1.5 flex items-center gap-1.5">
                    <CheckCircle className="h-4 w-4 text-emerald-400" />
                    Nhận xét &amp; Khuyến nghị
                  </span>
                  <ul className="list-disc pl-4 space-y-1 text-slate-300 text-[11px] leading-relaxed">
                    {diagResult.suggestions.map((sug, i) => (
                      <li key={i}>{sug}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic text-center py-6">Chưa có dữ liệu chẩn đoán.</p>
            )}
          </div>
        </div>

        {/* Right Col: DNS Changer Presets & Manual Settings */}
        <div className="lg:col-span-7 space-y-5">
          <div className="bg-[#101728] p-5 rounded-2xl border border-slate-800 shadow-xl space-y-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider pb-3 border-b border-slate-800">
              Cấu hình DNS dự phòng tốc độ cao
            </h3>

            {/* Presets Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {dnsPresets.map((preset) => (
                <button
                  key={preset.primary}
                  onClick={() => {
                    setSelectedDns(preset);
                    setIsCustom(false);
                    setDnsAppliedSuccess(false);
                  }}
                  className={`p-3.5 rounded-xl text-left border flex flex-col justify-between transition-all cursor-pointer shadow-xs ${
                    !isCustom && selectedDns.primary === preset.primary
                      ? 'bg-[#162544] border-emerald-500/50 shadow-md shadow-emerald-500/5'
                      : 'bg-[#131d33] border-slate-800 hover:border-slate-700 hover:bg-[#16223b]'
                  }`}
                >
                  <div className="flex justify-between items-center w-full">
                    <span className="text-xs font-bold text-slate-100">{preset.name}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${preset.isVietnam ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                      {preset.isVietnam ? 'Việt Nam' : 'Quốc Tế'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium mt-1">Dịch vụ: {preset.provider}</span>
                  <span className="text-xs font-mono text-emerald-400 font-bold mt-2 block">
                    {preset.primary} &bull; {preset.secondary}
                  </span>
                </button>
              ))}

              {/* Custom Input selector */}
              <button
                onClick={() => {
                  setIsCustom(true);
                  setDnsAppliedSuccess(false);
                }}
                className={`p-3.5 rounded-xl text-left border flex flex-col justify-between transition-all cursor-pointer shadow-xs ${
                  isCustom
                    ? 'bg-[#162544] border-emerald-500/50 shadow-md'
                    : 'bg-[#131d33] border-slate-800 hover:border-slate-700 hover:bg-[#16223b]'
                }`}
              >
                <div className="flex justify-between items-center w-full mb-1">
                  <span className="text-xs font-bold text-slate-100">Tự nhập DNS thủ công</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">Tùy biến</span>
                </div>
                <span className="text-[10px] text-slate-400">Nhập địa chỉ DNS IPv4 bạn tin dùng.</span>
                <span className="text-xs font-mono text-slate-500 font-semibold mt-2">Ví dụ: 1.1.1.1 / 8.8.8.8</span>
              </button>
            </div>

            {/* Custom fields inputs */}
            {isCustom && (
              <div className="grid grid-cols-2 gap-4 p-4 bg-[#131d33] rounded-xl border border-slate-800 shadow-inner">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase">DNS Chính (Primary)</label>
                  <input
                    type="text"
                    placeholder="8.8.8.8"
                    value={customPrimary}
                    onChange={(e) => setCustomPrimary(e.target.value)}
                    className="w-full bg-[#0e1626] border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-400 rounded-lg py-1.5 px-3 font-mono text-xs text-slate-200"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase">DNS Phụ (Secondary)</label>
                  <input
                    type="text"
                    placeholder="8.8.4.4"
                    value={customSecondary}
                    onChange={(e) => setCustomSecondary(e.target.value)}
                    className="w-full bg-[#0e1626] border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-400 rounded-lg py-1.5 px-3 font-mono text-xs text-slate-200"
                  />
                </div>
              </div>
            )}

            {/* Action triggering */}
            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleApplyDns}
                disabled={applyingDns || (isCustom && (!customPrimary || !customSecondary))}
                className="flex-1 py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95"
              >
                {applyingDns ? 'Đang kích hoạt...' : 'Áp dụng cấu hình DNS'}
              </button>

              <button
                onClick={handleResetNetworkStack}
                disabled={resettingNetwork}
                title="Flush DNS, Reset Winsock & TCP/IP stack 1-Click"
                className="py-2.5 px-4 bg-[#18233c] hover:bg-[#223152] border border-amber-500/40 text-amber-300 disabled:opacity-40 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2 shadow-sm"
              >
                <RotateCw className={`w-3.5 h-3.5 ${resettingNetwork ? 'animate-spin' : ''}`} />
                <span>{resettingNetwork ? 'Đang Reset...' : '⚡ Reset Chuỗi Mạng 1-Click'}</span>
              </button>
            </div>

            {/* Success Alert */}
            {dnsAppliedSuccess && (
              <div className="p-3.5 bg-emerald-500/10 rounded-xl border border-emerald-500/30 shadow-xs flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <strong className="text-emerald-300 block font-bold">ÁP DỤNG THÀNH CÔNG</strong>
                  <span className="text-slate-300 text-[11px] mt-0.5 block leading-relaxed">
                    Đã cấu hình DNS mới cho hệ thống của bạn. Vui lòng kiểm tra lại kết nối mạng.
                  </span>
                </div>
              </div>
            )}

            {/* Helpful instructions */}
            <div className="p-3 bg-[#131d33] rounded-xl border border-slate-800 flex gap-2.5 text-[11px] text-slate-400 leading-relaxed">
              <HelpCircle className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-200 block mb-0.5">Vấn đề mạng &amp; Hướng khắc phục:</span>
                • <strong className="text-emerald-400">Không vào được Facebook, Reddit:</strong> Đổi sang Google DNS hoặc Cloudflare DNS sẽ giải quyết 99% vấn đề chặn lọc.<br />
                • <strong className="text-emerald-400">Ping game cao, giật lag:</strong> Khởi động lại Router, sử dụng dây mạng LAN thay vì Wifi, cấu hình DNS trong nước (Viettel/VNPT) sẽ giúp tối ưu tốc độ phân giải cụm máy chủ khu vực Đông Nam Á.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

