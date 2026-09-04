export interface GuideStep {
  step: number;
  title: string;
  description: string;
}

export interface GuideItem {
  id: string;
  title: string;
  category: 'windows' | 'office' | 'printer' | 'network' | 'cleaner' | 'backup' | 'tester' | 'general';
  categoryName: string;
  targetSection: string;
  summary: string;
  whenToUse: string;
  steps: GuideStep[];
  tips?: string[];
  warnings?: string[];
  keywords: string[];
}

export const USER_GUIDES: GuideItem[] = [
  // ── 1. THIẾT LẬP WINDOWS ─────────────────────────────
  {
    id: 'win-optimize',
    title: 'Tối ưu hóa hệ thống Windows 1-Click',
    category: 'windows',
    categoryName: 'Thiết Lập Windows',
    targetSection: 'windows-settings',
    summary: 'Tự động tinh chỉnh hệ điều hành để chạy nhẹ hơn, tắt bớt ứng dụng chạy ngầm và tối đa hiệu năng CPU/RAM.',
    whenToUse: 'Dùng ngay sau khi cài mới Windows hoặc khi máy tính có hiện tượng giật lag, mở ứng dụng chậm.',
    steps: [
      {
        step: 1,
        title: 'Mở tab Thiết lập Windows',
        description: 'Tại menu bên trái, chọn "Thiết lập Windows". Chọn cấu hình phù hợp (Cấu hình Cơ bản hoặc Toàn diện).'
      },
      {
        step: 2,
        title: 'Bật chế độ Ultimate Performance',
        description: 'Kích hoạt gói nguồn điện Hiệu năng tối đa để CPU luôn duy trì xung nhịp cao nhất khi làm việc nặng.'
      },
      {
        step: 3,
        title: 'Tắt các dịch vụ thu thập dữ liệu (Telemetry)',
        description: 'Bấm bật "Tắt Telemetry & Thu thập dữ liệu ngầm" để giảm tải tài nguyên mạng và tăng cường bảo mật riêng tư.'
      },
      {
        step: 4,
        title: 'Áp dụng và khởi động lại',
        description: 'Khởi động lại máy tính để các thiết lập Registry và Service có hiệu lực toàn diện.'
      }
    ],
    tips: [
      'Nên bật "Hiển thị phần mở rộng file (.exe, .docx)" để người dùng dễ nhận biết file và phòng tránh virus giả mạo định dạng.',
      'Nếu là máy tính xách tay (Laptop) dùng pin, nên cân nhắc giữ lại tính năng Sleep/Hibernate.'
    ],
    warnings: [
      'Không nên tắt Windows Defender nếu máy không cài bất kỳ phần mềm diệt virus bên thứ 3 nào.'
    ],
    keywords: ['tối ưu', 'optimize', 'windows', 'mượt', 'lag', 'registry', 'telemetry', 'hiệu năng', 'pin']
  },
  {
    id: 'win-fix-update',
    title: 'Sửa lỗi Windows Update bị treo hoặc báo lỗi',
    category: 'windows',
    categoryName: 'Thiết Lập Windows',
    targetSection: 'windows-settings',
    summary: 'Đặt lại toàn bộ dịch vụ cập nhật của Windows, xóa bộ nhớ cache tải về bị hỏng (SoftwareDistribution).',
    whenToUse: 'Khi Windows Update đứng ở 0% quá lâu, báo mã lỗi 0x80070002, 0x80240034 hoặc không thể kiểm tra cập nhật mới.',
    steps: [
      {
        step: 1,
        title: 'Chuyển đến tab Thiết lập Windows',
        description: 'Tìm đến mục "Sửa lỗi & Bảo trì hệ điều hành".'
      },
      {
        step: 2,
        title: 'Bấm "Reset Windows Update"',
        description: 'Tool sẽ tự động dừng dịch vụ wuauserv, cryptSvc, bits, msiserver và dọn sạch thư mục SoftwareDistribution và Catroot2.'
      },
      {
        step: 3,
        title: 'Khởi động lại dịch vụ',
        description: 'Tool sẽ kích hoạt lại các dịch vụ ngầm với cấu hình sạch sẽ.'
      },
      {
        step: 4,
        title: 'Kiểm tra lại',
        description: 'Vào Settings của Windows > Windows Update > Check for updates để cập nhật lại bình thường.'
      }
    ],
    tips: [
      'Đảm bảo máy tính có kết nối mạng ổn định và ổ C còn trống tối thiểu 10GB trước khi cập nhật Windows.'
    ],
    keywords: ['update', 'cập nhật', 'windows update', '0x8007', 'treo update', 'lỗi cập nhật']
  },
  {
    id: 'win-sync-vietnam-time',
    title: 'Chuẩn hóa giờ Việt Nam (UTC+07) & Sửa lỗi lệch giờ, lỗi SSL',
    category: 'windows',
    categoryName: 'Thiết Lập Windows',
    targetSection: 'windows-settings',
    summary: 'Đặt múi giờ SE Asia Standard Time (UTC+07:00 Bangkok, Hanoi, Jakarta), kích hoạt tự động dịch vụ W32Time và cưỡng chế đồng bộ qua máy chủ NTP Google/Cloudflare/Vietnam.',
    whenToUse: 'Khi máy tính bị sai giờ, lệch múi giờ sau khi cài lại Windows, hết pin CMOS, hoặc chạy Dual-boot dẫn đến không vào được web (báo Your clock is ahead/behind, SSL Date Invalid).',
    steps: [
      {
        step: 1,
        title: 'Vào tab Thiết lập Windows',
        description: 'Tìm đến khối "Chuẩn Hóa & Đồng Bộ Giờ Việt Nam (1-Click)".'
      },
      {
        step: 2,
        title: 'Chọn máy chủ NTP',
        description: 'Mặc định dùng Google NTP (time.google.com) hoặc Cloudflare NTP để có tốc độ phản hồi nhanh nhất.'
      },
      {
        step: 3,
        title: 'Bấm "Chuẩn Hóa Giờ VN Ngay (1-Click)"',
        description: 'Hệ thống sẽ cấu hình múi giờ SE Asia, kích hoạt w32time, cập nhật NTP và cưỡng chế đồng bộ ngay lập tức.'
      },
      {
        step: 4,
        title: 'Xác nhận kết quả',
        description: 'Kiểm tra đồng hồ góc dưới màn hình Taskbar và badge hiển thị "Chuẩn múi giờ Việt Nam".'
      }
    ],
    tips: [
      'Đồng bộ giờ chuẩn là điều kiện tiên quyết để kích hoạt bản quyền số Windows/Office và mở các trang web ngân hàng, Zalo, Facebook.',
      'Tính năng này tự động kích hoạt RealTimeIsUniversal để chống lệch 7 tiếng khi chạy song song Windows và cứu hộ WinPE/macOS/Linux.'
    ],
    keywords: ['giờ', 'múi giờ', 'lệch giờ', 'time', 'timezone', 'utc+7', 'vietnam time', 'w32time', 'ntp', 'ssl']
  },

  // ── 2. TIỆN ÍCH OFFICE ───────────────────────────────
  {
    id: 'office-standardize',
    title: 'Chuẩn hóa văn bản Word theo Nghị định 30/2020/NĐ-CP',
    category: 'office',
    categoryName: 'Tiện Ích Office',
    targetSection: 'standardizer',
    summary: 'Căn lề chuẩn thể thức văn bản hành chính Việt Nam, thiết lập Font Times New Roman 14, khổ giấy A4 mặc định.',
    whenToUse: 'Thực hiện định dạng cho cơ quan nhà nước, doanh nghiệp hoặc chuẩn bị mẫu in văn bản chuẩn quốc gia.',
    steps: [
      {
        step: 1,
        title: 'Truy cập tab Tiện ích Office',
        description: 'Mở tab "Tiện ích Office" tại thanh công cụ bên trái.'
      },
      {
        step: 2,
        title: 'Kiểm tra thông số chuẩn hóa',
        description: 'Lề trên: 20mm, Lề dưới: 20mm, Lề trái: 30mm, Lề phải: 15mm. Khổ giấy: A4. Font: Times New Roman, Size 14.'
      },
      {
        step: 3,
        title: 'Bấm "Chuẩn hóa Word"',
        description: 'Tool sẽ ghi đè thiết lập mẫu chuẩn vào file Normal.dotm của Microsoft Word.'
      },
      {
        step: 4,
        title: 'Mở Word kiểm tra',
        description: 'Mở Microsoft Word lên và tạo văn bản trắng mới, bạn sẽ thấy toàn bộ lề và phông chữ đã chuẩn 100%.'
      }
    ],
    tips: [
      'Cần đóng tất cả cửa sổ Microsoft Word trước khi bấm nút Chuẩn hóa để tránh xung đột file Normal.dotm đang mở.'
    ],
    keywords: ['office', 'word', 'chuẩn hóa', 'nghị định 30', 'căn lề', 'times new roman', 'font', 'a4']
  },
  {
    id: 'office-fix-license',
    title: 'Chuyển đổi Office Retail sang Volume & Sửa lỗi tài khoản',
    category: 'office',
    categoryName: 'Tiện Ích Office',
    targetSection: 'standardizer',
    summary: 'Chuyển phiên bản bán lẻ (Retail) sang bản quyền doanh nghiệp (Volume) để kích hoạt KMS/Mondo, đồng thời xóa thông báo Account Notice.',
    whenToUse: 'Khi cài Office bản Retail nhưng cần kích hoạt qua server bản quyền số, hoặc Office báo "Account Notice: We ran into a problem with your Microsoft 365 subscription".',
    steps: [
      {
        step: 1,
        title: 'Xóa thông tin tài khoản cũ (Clear Credential)',
        description: 'Bấm nút "Xóa thông tin tài khoản Office cũ" để làm sạch token đăng nhập bị lỗi trong Windows Credential Manager.'
      },
      {
        step: 2,
        title: 'Chuyển đổi Retail sang Volume',
        description: 'Bấm "Convert Retail to Volume", tool sẽ tự động nạp chứng chỉ Volume License thích hợp cho phiên bản Office đang cài.'
      },
      {
        step: 3,
        title: 'Sửa nhanh (Quick Repair) nếu cần',
        description: 'Nếu Office vẫn gặp lỗi hiển thị hoặc mất biểu tượng, sử dụng chức năng "Sửa nhanh Office" để sửa file nhị phân.'
      }
    ],
    tips: [
      'Sau khi xóa thông tin tài khoản, mở Word lên đăng nhập lại hoặc kích hoạt sẽ không còn bị văng thông báo đỏ.'
    ],
    keywords: ['office', 'retail', 'volume', 'account notice', 'kích hoạt', 'bản quyền office', 'kms']
  },

  // ── 3. TIỆN ÍCH MÁY IN ──────────────────────────────
  {
    id: 'printer-clear-spooler',
    title: 'Xóa kẹt lệnh in & Khởi động lại Print Spooler',
    category: 'printer',
    categoryName: 'Tiện Ích Máy In',
    targetSection: 'printer',
    summary: 'Dừng dịch vụ Print Spooler, xóa sạch các file đệm lệnh in bị hỏng trong PRINTERS, và khởi động lại dịch vụ ngay lập tức.',
    whenToUse: 'Khi máy in không in được, hàng đợi hiện trạng thái "Error - Printing", không thể xóa lệnh in (Cancel print job bị đơ).',
    steps: [
      {
        step: 1,
        title: 'Mở tab Tiện ích Máy In',
        description: 'Chọn "Tiện ích Máy In" tại danh mục bên trái.'
      },
      {
        step: 2,
        title: 'Bấm "Xóa kẹt lệnh in & Restart Spooler"',
        description: 'Tool sẽ cưỡng chế dừng tiến trình spoolsv.exe, dọn sạch thư mục C:\\Windows\\System32\\spool\\PRINTERS, và kích hoạt lại Spooler.'
      },
      {
        step: 3,
        title: 'In thử trang kiểm tra',
        description: 'Sau khi thông báo thành công xuất hiện, thực hiện in lại văn bản cần in.'
      }
    ],
    tips: [
      'Không cần rút cáp USB hay khởi động lại toàn bộ máy tính, chỉ cần 1 click là lệnh in thông suốt trở lại.'
    ],
    keywords: ['máy in', 'printer', 'spooler', 'kẹt in', 'hàng đợi', 'xóa lệnh in', 'không in được']
  },
  {
    id: 'printer-fix-lan',
    title: 'Khắc phục lỗi chia sẻ máy in mạng LAN (0x0000011b, 0x00000709)',
    category: 'printer',
    categoryName: 'Tiện Ích Máy In',
    targetSection: 'printer',
    summary: 'Tự động cấu hình Registry RpcAuthnLevelPrivacyEnabled, RestrictDriverInstallationToAdministrators và sửa chính sách mạng nội bộ.',
    whenToUse: 'Khi kết nối máy in chia sẻ qua mạng LAN hoặc máy chủ in bị báo lỗi 0x0000011b, 0x00000709, 0x0000007c sau khi Windows cập nhật bản vá bảo mật.',
    steps: [
      {
        step: 1,
        title: 'Thực hiện trên CẢ MÁY CHỦ và MÁY TRẠM',
        description: 'Chạy tool trên cả máy tính cắm trực tiếp máy in (Máy chủ in) và các máy tính cần kết nối qua mạng (Máy trạm).'
      },
      {
        step: 2,
        title: 'Bấm "Khắc phục lỗi chia sẻ mạng LAN"',
        description: 'Hệ thống sẽ thiết lập các khóa Registry tương thích RPC, tắt mã hóa RPC bắt buộc nội bộ và bật chia sẻ mạng riêng (Private).'
      },
      {
        step: 3,
        title: 'Khởi động lại Print Spooler',
        description: 'Tool sẽ tự khởi động lại dịch vụ in để Registry mới có hiệu lực tức thì.'
      },
      {
        step: 4,
        title: 'Kết nối lại máy in',
        description: 'Trên máy trạm, gõ \\\\IP_May_Chu (ví dụ: \\\\192.168.1.100), click đúp vào máy in để kết nối.'
      }
    ],
    tips: [
      'Đảm bảo cả hai máy tính đều đặt Profile mạng là "Private Network" và tắt "Password protected sharing" nếu dùng chung nhóm.'
    ],
    keywords: ['máy in', 'lan', 'chia sẻ máy in', '0x0000011b', '0x00000709', 'share printer', 'mạng nội bộ']
  },

  // ── 4. MẠNG & DNS ──────────────────────────────────
  {
    id: 'network-dns',
    title: 'Đổi DNS nhanh & Sửa lỗi mạng (Chấm than vàng, Không vào được mạng)',
    category: 'network',
    categoryName: 'Mạng & DNS',
    targetSection: 'network',
    summary: 'Chuyển đổi nhanh giữa DNS Google (8.8.8.8), Cloudflare (1.1.1.1) và xóa sạch bộ nhớ đệm DNS (Flush DNS), Reset TCP/IP.',
    whenToUse: 'Khi máy tính vào mạng bị chậm, một số trang web bị chặn hoặc máy tính báo "No Internet Access" dù đã có Wi-Fi.',
    steps: [
      {
        step: 1,
        title: 'Chọn card mạng đang sử dụng',
        description: 'Tại tab "Mạng & DNS", chọn đúng card Wi-Fi hoặc Ethernet đang kết nối.'
      },
      {
        step: 2,
        title: 'Chọn máy chủ DNS mong muốn',
        description: 'Chọn "Google DNS (8.8.8.8 / 8.8.4.4)" để vào mạng ổn định hoặc "Cloudflare DNS (1.1.1.1 / 1.0.0.1)" để tối ưu tốc độ mở web.'
      },
      {
        step: 3,
        title: 'Xóa cache DNS (Flush DNS)',
        description: 'Bấm nút "Flush DNS" để giải phóng các địa chỉ IP cũ bị lỗi thời trên máy.'
      },
      {
        step: 4,
        title: 'Reset TCP/IP Winsock (nếu lỗi nặng)',
        description: 'Nếu vẫn mất mạng hoàn toàn, bấm "Reset Network Stack" rồi khởi động lại máy để làm mới hoàn toàn card mạng.'
      }
    ],
    tips: [
      'DNS Cloudflare thường cho độ trễ (ping) thấp hơn khi chơi game và lướt web quốc tế.'
    ],
    keywords: ['dns', 'mạng', 'wifi', 'chấm than vàng', 'mất mạng', 'flush dns', 'cloudflare', 'google dns']
  },

  // ── 5. DỌN DẸP RÁC ─────────────────────────────────
  {
    id: 'cleaner-junk',
    title: 'Dọn dẹp rác hệ thống & Giải phóng dung lượng ổ C',
    category: 'cleaner',
    categoryName: 'Dọn Dẹp Rác',
    targetSection: 'cleaner',
    summary: 'Quét và dọn sạch các file tạm hệ thống (%TEMP%), Prefetch, Windows Error Reports, File rác Windows Update và Thùng rác.',
    whenToUse: 'Khi ổ đĩa C báo đỏ (dưới 10GB - 20GB), hoặc sau các đợt cập nhật Windows lớn khiến dung lượng ổ đĩa bị phình to.',
    steps: [
      {
        step: 1,
        title: 'Mở tab Dọn dẹp Rác',
        description: 'Bấm chọn "Dọn dẹp Rác" trên thanh điều hướng.'
      },
      {
        step: 2,
        title: 'Bấm "Quét hệ thống"',
        description: 'Tool sẽ tính toán dung lượng rác thực tế có thể giải phóng trên từng vùng lưu trữ.'
      },
      {
        step: 3,
        title: 'Tích chọn vùng cần làm sạch',
        description: 'Chọn các mục an toàn như Thư mục tạm (%TEMP%), Cache trình duyệt, Báo cáo lỗi, File log cũ.'
      },
      {
        step: 4,
        title: 'Thực hiện dọn dẹp',
        description: 'Bấm nút "Bắt đầu Dọn Dẹp" và chờ hoàn tất trong vài giây.'
      }
    ],
    tips: [
      'Thuật toán dọn rác của tool chỉ xóa các file tạm và cache không khóa, tuyệt đối không ảnh hưởng đến dữ liệu cá nhân hay phần mềm của bạn.'
    ],
    keywords: ['dọn rác', 'ổ c đầy', 'giải phóng dung lượng', 'xóa file tạm', 'temp', 'cleaner', 'tăng dung lượng']
  },

  // ── 6. SAO LƯU & TIỆN ÍCH KHÁC ─────────────────────
  {
    id: 'backup-wifi-driver',
    title: 'Sao lưu mật khẩu Wi-Fi & Bộ cài Driver trước khi cài Win',
    category: 'backup',
    categoryName: 'Sao Lưu & Tiện Ích',
    targetSection: 'backup',
    summary: 'Xuất toàn bộ cấu hình mật khẩu Wi-Fi đã từng kết nối thành file văn bản, và xuất toàn bộ Driver phần cứng ra thư mục an toàn.',
    whenToUse: 'Cực kỳ quan trọng trước khi cài lại Windows hoặc nâng cấp máy tính, giúp không bị mất mật khẩu Wi-Fi khách hàng và tránh thiếu Driver mạng.',
    steps: [
      {
        step: 1,
        title: 'Vào tab Sao Lưu',
        description: 'Chọn tab "Sao Lưu" ở thanh bên.'
      },
      {
        step: 2,
        title: 'Sao lưu Mật khẩu Wi-Fi',
        description: 'Bấm "Xuất danh sách Wi-Fi", tool sẽ đọc tất cả profile Wi-Fi và hiển thị mật khẩu rõ ràng, có thể lưu ra file txt/csv.'
      },
      {
        step: 3,
        title: 'Sao lưu Driver',
        description: 'Chọn thư mục lưu trữ (tốt nhất là ổ D, E hoặc USB), bấm "Backup Drivers" để sao lưu toàn bộ Driver bên thứ 3.'
      }
    ],
    tips: [
      'Luôn lưu file Driver và Wi-Fi sang ổ cứng di động hoặc phân vùng khác ngoài ổ C để tránh bị format mất khi cài Win.'
    ],
    keywords: ['sao lưu', 'backup', 'wifi', 'mật khẩu wifi', 'driver', 'cài win', 'lưu driver']
  },
  {
    id: 'bitlocker-safe-turnoff',
    title: 'Kiểm tra & Tắt mã hóa BitLocker an toàn',
    category: 'backup',
    categoryName: 'Sao Lưu & Tiện Ích',
    targetSection: 'bitlocker',
    summary: 'Kiểm tra trạng thái bảo vệ BitLocker trên các phân vùng ổ đĩa và tiến hành giải mã an toàn.',
    whenToUse: 'Bắt buộc kiểm tra trước khi Ghost máy, nạp file ảnh Windows, chia lại phân vùng hoặc can thiệp BIOS/UEFI để tránh khóa vĩnh viễn dữ liệu.',
    steps: [
      {
        step: 1,
        title: 'Mở tab Tắt BitLocker',
        description: 'Xem danh sách các ổ đĩa và trạng thái bảo vệ (Protection Status).'
      },
      {
        step: 2,
        title: 'Kiểm tra ổ đĩa nào đang Bật mã hóa',
        description: 'Nếu ổ đĩa hiển thị trạng thái "On" hoặc "Locked", dữ liệu đang được bảo vệ bởi BitLocker.'
      },
      {
        step: 3,
        title: 'Bấm "Giải mã ổ đĩa"',
        description: 'Tool sẽ gọi lệnh mở khóa và giải mã phân vùng. Quá trình giải mã có thể mất từ vài phút đến nửa tiếng tùy dung lượng ổ.'
      }
    ],
    warnings: [
      'Trong lúc BitLocker đang giải mã (Decryption in progress), tuyệt đối KHÔNG tắt nguồn đột ngột để tránh lỗi cấu trúc phân vùng.'
    ],
    keywords: ['bitlocker', 'khóa ổ cứng', 'mã hóa', 'tắt bitlocker', 'giải mã', 'ghost win']
  },

  // ── 7. KIỂM TRA LAPTOP & BIÊN BẢN KTV ───────────────
  {
    id: 'tester-laptop-report',
    title: 'Kiểm tra toàn diện Laptop & Xuất biên bản bàn giao KTV',
    category: 'tester',
    categoryName: 'Kiểm Tra & Báo Cáo',
    targetSection: 'laptop-tester',
    summary: 'Kiểm tra màn hình (tìm điểm chết pixel), test ma trận phím, camera, micro, loa và tự động tạo Biên bản nghiệm thu bàn giao chuyên nghiệp.',
    whenToUse: 'Dành cho Kỹ thuật viên khi nhận máy sửa chữa hoặc trước khi bàn giao máy tính hoàn thiện cho khách hàng.',
    steps: [
      {
        step: 1,
        title: 'Test màn hình & Bàn phím',
        description: 'Mở "Kiểm Tra Laptop", chuyển sang màn hình toàn màn hình màu đơn sắc để soi điểm chết (Dead pixel). Gõ từng phím trên bàn phím ảo để kiểm tra phím liệt, kẹt phím.'
      },
      {
        step: 2,
        title: 'Test Webcam & Micro',
        description: 'Cho phép truy cập Camera/Mic để kiểm tra chất lượng thu âm và độ nét ống kính.'
      },
      {
        step: 3,
        title: 'Chuyển sang "Báo cáo KTV"',
        description: 'Điền thông tin khách hàng, số điện thoại, tình trạng sửa chữa và các hạng mục đã thực hiện.'
      },
      {
        step: 4,
        title: 'In / Xuất biên bản PDF',
        description: 'Bấm xuất biên bản để in ra giấy hoặc gửi file số có đầy đủ chữ ký bàn giao cho khách hàng.'
      }
    ],
    tips: [
      'Biên bản nghiệm thu chuyên nghiệp giúp tăng độ uy tín, tránh tranh chấp phát sinh sau khi bàn giao máy cho khách hàng.'
    ],
    keywords: ['test laptop', 'bàn phím', 'màn hình', 'điểm chết', 'webcam', 'micro', 'biên bản', 'báo cáo ktv', 'nghiệm thu']
  }
];
