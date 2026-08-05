// ============================================================================
//  DANH MỤC THUỐC SẢN PHỤ KHOA — 20 hoạt chất thường dùng, do bệnh viện cung cấp.
//  Nguồn để seed bảng `thuoc`; mã thuốc (TH01…) là khóa ổn định dùng cho tủ thuốc
//  (tồn kho) và cho dòng thuốc trên phiếu viện phí.
//  Đơn giá để 0: bảng giá thu do bệnh viện phê duyệt, người lập phiếu nhập tay.
// ============================================================================

export type ThuocNguon = {
  ma_thuoc: string;
  hoat_chat: string;
  nhom: string;
  kiem_soat: string;
  dvt: string;
  ung_dung: string;
};

export const DANH_MUC_THUOC: ThuocNguon[] = [
  { ma_thuoc: 'TH01', hoat_chat: 'Oxytocin', nhom: 'Thuốc co hồi tử cung', kiem_soat: 'Nguy cơ cao', dvt: 'Ống', ung_dung: 'Gây hoặc tăng cường chuyển dạ; dự phòng và xử trí chảy máu sau sinh do đờ tử cung theo phác đồ.' },
  { ma_thuoc: 'TH02', hoat_chat: 'Misoprostol', nhom: 'Prostaglandin E1', kiem_soat: 'Nguy cơ cao', dvt: 'Viên', ung_dung: 'Làm chín cổ tử cung, khởi phát chuyển dạ và hỗ trợ kiểm soát chảy máu sau sinh trong chỉ định phù hợp.' },
  { ma_thuoc: 'TH03', hoat_chat: 'Carbetocin', nhom: 'Thuốc co hồi tử cung tác dụng kéo dài', kiem_soat: 'Hạn chế', dvt: 'Ống', ung_dung: 'Dự phòng đờ tử cung và chảy máu sau sinh, đặc biệt sau mổ lấy thai theo quy trình bệnh viện.' },
  { ma_thuoc: 'TH04', hoat_chat: 'Tranexamic acid', nhom: 'Chống tiêu sợi huyết', kiem_soat: 'Cấp cứu', dvt: 'Ống', ung_dung: 'Hỗ trợ điều trị chảy máu sau sinh và một số trường hợp xuất huyết phụ khoa.' },
  { ma_thuoc: 'TH05', hoat_chat: 'Magnesium sulfate', nhom: 'Chống co giật / điện giải', kiem_soat: 'Nguy cơ cao', dvt: 'Ống', ung_dung: 'Phòng và điều trị co giật trong tiền sản giật, sản giật; một số chỉ định bảo vệ thần kinh thai nhi.' },
  { ma_thuoc: 'TH06', hoat_chat: 'Nifedipine', nhom: 'Chẹn kênh canxi', kiem_soat: 'Theo dõi HA', dvt: 'Viên', ung_dung: 'Kiểm soát tăng huyết áp trong thai kỳ; có thể được dùng giảm co trong chỉ định chuyên khoa.' },
  { ma_thuoc: 'TH07', hoat_chat: 'Labetalol', nhom: 'Chẹn alpha/beta', kiem_soat: 'Theo dõi HA', dvt: 'Viên', ung_dung: 'Điều trị tăng huyết áp cấp hoặc mạn trong thai kỳ theo phác đồ.' },
  { ma_thuoc: 'TH08', hoat_chat: 'Hydralazine', nhom: 'Thuốc giãn mạch', kiem_soat: 'Cấp cứu', dvt: 'Ống', ung_dung: 'Điều trị tăng huyết áp nặng trong thai kỳ tại cơ sở có khả năng theo dõi.' },
  { ma_thuoc: 'TH09', hoat_chat: 'Methyldopa', nhom: 'Hạ huyết áp trung ương', kiem_soat: 'Kê đơn', dvt: 'Viên', ung_dung: 'Quản lý tăng huyết áp mạn trong thai kỳ ở trường hợp phù hợp.' },
  { ma_thuoc: 'TH10', hoat_chat: 'Dexamethasone', nhom: 'Corticosteroid', kiem_soat: 'Hạn chế', dvt: 'Ống', ung_dung: 'Thúc đẩy trưởng thành phổi thai khi có nguy cơ sinh non và đáp ứng tiêu chuẩn chuyên môn.' },
  { ma_thuoc: 'TH11', hoat_chat: 'Betamethasone', nhom: 'Corticosteroid', kiem_soat: 'Hạn chế', dvt: 'Ống', ung_dung: 'Thúc đẩy trưởng thành phổi thai khi dự kiến sinh non theo hướng dẫn chuyên môn.' },
  { ma_thuoc: 'TH12', hoat_chat: 'Ferrous sulfate', nhom: 'Bổ sung sắt', kiem_soat: 'Thông thường', dvt: 'Viên', ung_dung: 'Phòng và điều trị thiếu sắt, thiếu máu trong thai kỳ và sau sinh.' },
  { ma_thuoc: 'TH13', hoat_chat: 'Folic acid', nhom: 'Vitamin nhóm B', kiem_soat: 'Thông thường', dvt: 'Viên', ung_dung: 'Bổ sung trước và trong thai kỳ; hỗ trợ dự phòng dị tật ống thần kinh.' },
  { ma_thuoc: 'TH14', hoat_chat: 'Calcium carbonate', nhom: 'Bổ sung khoáng chất', kiem_soat: 'Thông thường', dvt: 'Viên', ung_dung: 'Bổ sung canxi trong thai kỳ; có thể hỗ trợ dự phòng tiền sản giật ở nhóm phù hợp.' },
  { ma_thuoc: 'TH15', hoat_chat: 'Progesterone', nhom: 'Nội tiết tố', kiem_soat: 'Hạn chế', dvt: 'Viên', ung_dung: 'Hỗ trợ hoàng thể và sử dụng trong một số chỉ định thai kỳ hoặc phụ khoa theo đánh giá chuyên khoa.' },
  { ma_thuoc: 'TH16', hoat_chat: 'Cefazolin', nhom: 'Cephalosporin', kiem_soat: 'KS kiểm soát', dvt: 'Lọ', ung_dung: 'Dự phòng nhiễm khuẩn phẫu thuật, bao gồm một số trường hợp mổ lấy thai và phẫu thuật phụ khoa.' },
  { ma_thuoc: 'TH17', hoat_chat: 'Ampicillin', nhom: 'Penicillin', kiem_soat: 'KS kiểm soát', dvt: 'Lọ', ung_dung: 'Điều trị hoặc dự phòng một số nhiễm khuẩn sản khoa theo hướng dẫn và kháng sinh đồ.' },
  { ma_thuoc: 'TH18', hoat_chat: 'Metronidazole', nhom: 'Kháng khuẩn / kháng đơn bào', kiem_soat: 'KS kiểm soát', dvt: 'Viên', ung_dung: 'Điều trị viêm âm đạo do vi khuẩn, Trichomonas và một số nhiễm khuẩn kỵ khí vùng chậu.' },
  { ma_thuoc: 'TH19', hoat_chat: 'Clotrimazole', nhom: 'Kháng nấm azole', kiem_soat: 'Kê đơn', dvt: 'Viên đặt', ung_dung: 'Điều trị nhiễm nấm Candida âm hộ - âm đạo.' },
  { ma_thuoc: 'TH20', hoat_chat: 'Methotrexate', nhom: 'Kháng chuyển hóa', kiem_soat: 'Độc tế bào', dvt: 'Lọ', ung_dung: 'Điều trị nội khoa thai ngoài tử cung chọn lọc hoặc bệnh nguyên bào nuôi dưới giám sát chuyên khoa.' },
];
