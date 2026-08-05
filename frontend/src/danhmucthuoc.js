// ============================================================================
//  DANH MỤC THUỐC SẢN PHỤ KHOA — 20 hoạt chất thường dùng, do bệnh viện cung cấp.
//  Dùng cho ô chọn thuốc ở "Chi tiết viện phí" (trang Y lệnh).
//  Danh mục KHÔNG kèm đơn giá, đơn vị tính, liều dùng — các trường đó do lễ tân
//  nhập theo bảng giá và y lệnh thực tế, không được điền tự động.
//  Cột "kiem_soat" là mức kiểm soát kê đơn để người nhập lưu ý khi chọn.
// ============================================================================

export const MUC_KIEM_SOAT = {
  "Nguy cơ cao": "#C0392B",
  "Cấp cứu": "#C0392B",
  "Độc tế bào": "#C0392B",
  "Hạn chế": "#B7791F",
  "KS kiểm soát": "#B7791F",
  "Theo dõi HA": "#B7791F",
  "Kê đơn": "#5BA8D0",
  "Thông thường": "#4FB89A",
};

export const DANH_MUC_THUOC = [
  { stt: 1, hoat_chat: "Oxytocin", nhom: "Thuốc co hồi tử cung", kiem_soat: "Nguy cơ cao", ung_dung: "Gây hoặc tăng cường chuyển dạ; dự phòng và xử trí chảy máu sau sinh do đờ tử cung theo phác đồ." },
  { stt: 2, hoat_chat: "Misoprostol", nhom: "Prostaglandin E1", kiem_soat: "Nguy cơ cao", ung_dung: "Làm chín cổ tử cung, khởi phát chuyển dạ và hỗ trợ kiểm soát chảy máu sau sinh trong chỉ định phù hợp." },
  { stt: 3, hoat_chat: "Carbetocin", nhom: "Thuốc co hồi tử cung tác dụng kéo dài", kiem_soat: "Hạn chế", ung_dung: "Dự phòng đờ tử cung và chảy máu sau sinh, đặc biệt sau mổ lấy thai theo quy trình bệnh viện." },
  { stt: 4, hoat_chat: "Tranexamic acid", nhom: "Chống tiêu sợi huyết", kiem_soat: "Cấp cứu", ung_dung: "Hỗ trợ điều trị chảy máu sau sinh và một số trường hợp xuất huyết phụ khoa." },
  { stt: 5, hoat_chat: "Magnesium sulfate", nhom: "Chống co giật / điện giải", kiem_soat: "Nguy cơ cao", ung_dung: "Phòng và điều trị co giật trong tiền sản giật, sản giật; một số chỉ định bảo vệ thần kinh thai nhi." },
  { stt: 6, hoat_chat: "Nifedipine", nhom: "Chẹn kênh canxi", kiem_soat: "Theo dõi HA", ung_dung: "Kiểm soát tăng huyết áp trong thai kỳ; có thể được dùng giảm co trong chỉ định chuyên khoa." },
  { stt: 7, hoat_chat: "Labetalol", nhom: "Chẹn alpha/beta", kiem_soat: "Theo dõi HA", ung_dung: "Điều trị tăng huyết áp cấp hoặc mạn trong thai kỳ theo phác đồ." },
  { stt: 8, hoat_chat: "Hydralazine", nhom: "Thuốc giãn mạch", kiem_soat: "Cấp cứu", ung_dung: "Điều trị tăng huyết áp nặng trong thai kỳ tại cơ sở có khả năng theo dõi." },
  { stt: 9, hoat_chat: "Methyldopa", nhom: "Hạ huyết áp trung ương", kiem_soat: "Kê đơn", ung_dung: "Quản lý tăng huyết áp mạn trong thai kỳ ở trường hợp phù hợp." },
  { stt: 10, hoat_chat: "Dexamethasone", nhom: "Corticosteroid", kiem_soat: "Hạn chế", ung_dung: "Thúc đẩy trưởng thành phổi thai khi có nguy cơ sinh non và đáp ứng tiêu chuẩn chuyên môn." },
  { stt: 11, hoat_chat: "Betamethasone", nhom: "Corticosteroid", kiem_soat: "Hạn chế", ung_dung: "Thúc đẩy trưởng thành phổi thai khi dự kiến sinh non theo hướng dẫn chuyên môn." },
  { stt: 12, hoat_chat: "Ferrous sulfate", nhom: "Bổ sung sắt", kiem_soat: "Thông thường", ung_dung: "Phòng và điều trị thiếu sắt, thiếu máu trong thai kỳ và sau sinh." },
  { stt: 13, hoat_chat: "Folic acid", nhom: "Vitamin nhóm B", kiem_soat: "Thông thường", ung_dung: "Bổ sung trước và trong thai kỳ; hỗ trợ dự phòng dị tật ống thần kinh." },
  { stt: 14, hoat_chat: "Calcium carbonate", nhom: "Bổ sung khoáng chất", kiem_soat: "Thông thường", ung_dung: "Bổ sung canxi trong thai kỳ; có thể hỗ trợ dự phòng tiền sản giật ở nhóm phù hợp." },
  { stt: 15, hoat_chat: "Progesterone", nhom: "Nội tiết tố", kiem_soat: "Hạn chế", ung_dung: "Hỗ trợ hoàng thể và sử dụng trong một số chỉ định thai kỳ hoặc phụ khoa theo đánh giá chuyên khoa." },
  { stt: 16, hoat_chat: "Cefazolin", nhom: "Cephalosporin", kiem_soat: "KS kiểm soát", ung_dung: "Dự phòng nhiễm khuẩn phẫu thuật, bao gồm một số trường hợp mổ lấy thai và phẫu thuật phụ khoa." },
  { stt: 17, hoat_chat: "Ampicillin", nhom: "Penicillin", kiem_soat: "KS kiểm soát", ung_dung: "Điều trị hoặc dự phòng một số nhiễm khuẩn sản khoa theo hướng dẫn và kháng sinh đồ." },
  { stt: 18, hoat_chat: "Metronidazole", nhom: "Kháng khuẩn / kháng đơn bào", kiem_soat: "KS kiểm soát", ung_dung: "Điều trị viêm âm đạo do vi khuẩn, Trichomonas và một số nhiễm khuẩn kỵ khí vùng chậu." },
  { stt: 19, hoat_chat: "Clotrimazole", nhom: "Kháng nấm azole", kiem_soat: "Kê đơn", ung_dung: "Điều trị nhiễm nấm Candida âm hộ - âm đạo." },
  { stt: 20, hoat_chat: "Methotrexate", nhom: "Kháng chuyển hóa", kiem_soat: "Độc tế bào", ung_dung: "Điều trị nội khoa thai ngoài tử cung chọn lọc hoặc bệnh nguyên bào nuôi dưới giám sát chuyên khoa." },
];
