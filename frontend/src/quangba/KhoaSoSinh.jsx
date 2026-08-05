import React, { useState, useRef, useEffect } from "react";
import {
  Phone, Clock, MapPin, CalendarCheck, ChevronRight, Home as HomeIcon, Heart, Mail, User,
  ShieldCheck, Baby, Stethoscope, Activity, Thermometer, Wind, Sun, Syringe, ClipboardList,
  CheckCircle2, ChevronDown, FileText, Send, Building2, Info, BarChart3, Wallet, PlayCircle,
  Users, HeartPulse, AlertTriangle, Droplets, Sparkles,
} from "lucide-react";
import { T, Card, Btn, Pill, useNav } from "../shared";
import { sectionWrap, eyebrow, h2 } from "./ui";

// ============================================================================
//  TRANG CHI TIẾT KHOA SƠ SINH (mở khi bấm thẻ khoa Sơ sinh) — thiết kế
//  mobile-first, cấu trúc nội dung chuẩn SEO 33 mục + dữ liệu có cấu trúc
//  BreadcrumbList (JSON-LD). Các mục cần dữ liệu thật (kết quả/chỉ số, chi phí,
//  câu chuyện gia đình, video, hồ sơ điều dưỡng) để ở trạng thái "đang cập
//  nhật/liên hệ" — KHÔNG bịa số liệu, chi phí hay lời chứng thực.
//  Form đăng ký mở email soạn sẵn (mailto) — không lưu database.
//  Accessibility: label/htmlFor, aria, alt, role. CTA cố định trên mobile.
// ============================================================================

const HOTLINE = "1900 1717";
const CAP_CUU = "115";
const EMAIL = "sosinh@bvphusanhp.vn";
const TEN_KHOA = "Khoa Sơ sinh — BV Phụ sản Hải Phòng";
const GIO = "7:00 – 17:00 (Thứ 2 – Chủ nhật); tiếp nhận cấp cứu 24/7";
const DIA_CHI = "Tầng 2, Nhà C, Số 19 Trần Quang Khải, Hồng Bàng, Hải Phòng";
const TEL = (s) => `tel:${s.replace(/\s/g, "")}`;
const MAP_SRC = `https://www.google.com/maps?q=${encodeURIComponent("19 Trần Quang Khải, Hồng Bàng, Hải Phòng")}&output=embed`;
const MAP_LINK = `https://www.google.com/maps/search/${encodeURIComponent("19 Trần Quang Khải, Hồng Bàng, Hải Phòng")}`;
const NGAY_CAP_NHAT = new Date().toLocaleDateString("vi-VN");

const NOI_BAT = [
  { icon: Baby, ten: "Theo dõi trẻ ngay sau sinh", mo_ta: "Đánh giá và theo dõi sát tình trạng trẻ trong những giờ đầu." },
  { icon: Thermometer, ten: "Chăm sóc trẻ non tháng, nhẹ cân", mo_ta: "Kiểm soát thân nhiệt, dinh dưỡng và theo dõi tăng trưởng." },
  { icon: HeartPulse, ten: "Hồi sức sơ sinh theo chỉ định", mo_ta: "Hỗ trợ hô hấp và tuần hoàn khi trẻ cần can thiệp." },
  { icon: Droplets, ten: "Hỗ trợ nuôi con bằng sữa mẹ", mo_ta: "Hướng dẫn bú sớm, vắt và bảo quản sữa mẹ." },
  { icon: ShieldCheck, ten: "Phối hợp sản khoa – sơ sinh", mo_ta: "Tiếp nhận và xử trí trẻ ngay tại phòng sinh khi cần." },
  { icon: Activity, ten: "Theo dõi sau xuất viện", mo_ta: "Tái khám, theo dõi tăng trưởng và phát triển của trẻ." },
];

const DOI_TUONG = [
  "Trẻ sơ sinh khỏe mạnh cần theo dõi sau sinh", "Trẻ sinh non", "Trẻ nhẹ cân", "Trẻ suy hô hấp",
  "Trẻ có nguy cơ nhiễm khuẩn", "Trẻ vàng da", "Trẻ hạ đường huyết", "Trẻ bú kém hoặc bỏ bú",
  "Trẻ cần hồi sức sau sinh", "Trẻ sinh từ thai kỳ nguy cơ cao", "Trẻ có dị tật bẩm sinh",
  "Trẻ cần theo dõi sau xuất viện", "Trẻ được chuyển từ cơ sở y tế khác",
];

const DICH_VU = [
  { ten: "Chăm sóc trẻ sơ sinh sau sinh", items: ["Khám và đánh giá ban đầu", "Theo dõi hô hấp, thân nhiệt và tuần hoàn", "Theo dõi bú và bài tiết", "Chăm sóc rốn", "Hướng dẫn cha mẹ chăm sóc trẻ"] },
  { ten: "Hồi sức sơ sinh", items: ["Đánh giá trẻ ngay sau sinh", "Hỗ trợ hô hấp theo chỉ định", "Theo dõi sau hồi sức", "Phối hợp chuyển trẻ đến khu chăm sóc chuyên sâu"] },
  { ten: "Chăm sóc trẻ non tháng, nhẹ cân", items: ["Kiểm soát thân nhiệt", "Hỗ trợ hô hấp", "Hỗ trợ dinh dưỡng", "Theo dõi tăng trưởng", "Chăm sóc phát triển"] },
  { ten: "Điều trị vàng da sơ sinh", items: ["Đánh giá mức độ vàng da", "Xét nghiệm bilirubin theo chỉ định", "Chiếu đèn", "Theo dõi đáp ứng điều trị", "Hướng dẫn cha mẹ sau xuất viện"] },
  { ten: "Điều trị nhiễm khuẩn sơ sinh", items: ["Đánh giá nguy cơ", "Thực hiện xét nghiệm theo chỉ định", "Theo dõi dấu hiệu sinh tồn", "Điều trị và kiểm soát nhiễm khuẩn"] },
  { ten: "Sàng lọc sơ sinh", items: ["Sàng lọc bệnh lý bẩm sinh", "Sàng lọc thính lực", "Sàng lọc tim bẩm sinh bằng SpO₂ (nếu triển khai)", "Tư vấn kết quả", "Hướng dẫn khám chuyên khoa khi bất thường"] },
  { ten: "Khám và theo dõi sau xuất viện", items: ["Theo dõi tăng trưởng", "Theo dõi phát triển", "Đánh giá bú mẹ và dinh dưỡng", "Theo dõi vàng da", "Theo dõi trẻ sinh non và nhẹ cân", "Lập lịch tái khám"] },
];

const KY_THUAT = [
  "Hỗ trợ thở oxy", "Thở áp lực dương liên tục (CPAP)", "Thông khí cơ học", "Theo dõi SpO₂",
  "Theo dõi tim và nhịp thở", "Chiếu đèn điều trị vàng da", "Nuôi dưỡng qua đường tiêu hóa",
  "Nuôi dưỡng tĩnh mạch", "Đặt đường truyền ngoại vi/trung tâm", "Kiểm soát thân nhiệt",
  "Chăm sóc Kangaroo", "Hồi sức sơ sinh tại phòng sinh", "Vận chuyển sơ sinh an toàn", "Theo dõi trẻ nguy cơ cao",
];

const QT_TIEP_NHAN = ["Tiếp nhận thông tin thai kỳ và cuộc sinh", "Đánh giá trẻ ngay sau sinh", "Hồi sức nếu cần thiết", "Phân loại tình trạng trẻ", "Chăm sóc cùng mẹ hoặc chuyển Khoa Sơ sinh", "Lập kế hoạch theo dõi và điều trị", "Trao đổi thông tin với gia đình", "Đánh giá trước khi xuất viện"];
const QT_NHAP_VIEN = ["Đăng ký và xác nhận thông tin trẻ", "Bác sĩ đánh giá tình trạng", "Tiếp nhận hồ sơ sản khoa và sơ sinh", "Thực hiện xét nghiệm/chẩn đoán hình ảnh", "Xây dựng kế hoạch chăm sóc", "Điều trị và theo dõi", "Cập nhật tình trạng cho gia đình", "Đánh giá điều kiện xuất viện"];
const QT_HOI_SUC = ["Tiếp nhận trẻ", "Ổn định hô hấp và tuần hoàn", "Kiểm soát thân nhiệt", "Đánh giá nhiễm khuẩn và chuyển hóa", "Hỗ trợ dinh dưỡng", "Theo dõi liên tục", "Điều chỉnh kế hoạch điều trị", "Chuẩn bị chuyển khu nhẹ hơn hoặc xuất viện"];

const BENH_LY = [
  { ten: "Nhóm hô hấp", items: ["Suy hô hấp sơ sinh", "Hội chứng suy hô hấp ở trẻ non tháng", "Chậm hấp thu dịch phổi", "Viêm phổi sơ sinh", "Cơn ngừng thở ở trẻ non tháng"] },
  { ten: "Nhóm nhiễm khuẩn", items: ["Nhiễm khuẩn sơ sinh sớm", "Nhiễm khuẩn sơ sinh muộn", "Nhiễm khuẩn rốn", "Viêm màng não sơ sinh", "Nhiễm khuẩn huyết"] },
  { ten: "Chuyển hóa và dinh dưỡng", items: ["Hạ đường huyết", "Hạ thân nhiệt", "Rối loạn điện giải", "Bú kém", "Chậm tăng cân", "Không dung nạp thức ăn"] },
  { ten: "Huyết học và gan mật", items: ["Vàng da sơ sinh", "Tăng bilirubin máu", "Thiếu máu sơ sinh", "Rối loạn đông máu"] },
  { ten: "Trẻ non tháng", items: ["Trẻ sinh non", "Trẻ cực non", "Trẻ nhẹ cân", "Chậm phát triển trong tử cung", "Biến chứng liên quan đến sinh non"] },
  { ten: "Nhóm khác", items: ["Ngạt sơ sinh", "Co giật sơ sinh", "Dị tật bẩm sinh", "Bệnh tim bẩm sinh", "Nguy cơ tổn thương thần kinh", "Chấn thương trong quá trình sinh"] },
];

const DAU_HIEU = ["Khó thở hoặc thở nhanh", "Tím môi hoặc tím da", "Bú kém hoặc bỏ bú", "Li bì, khó đánh thức", "Sốt hoặc thân nhiệt thấp", "Co giật", "Vàng da tăng nhanh", "Nôn nhiều hoặc nôn dịch xanh", "Bụng chướng", "Ít tiểu", "Rốn đỏ, sưng hoặc chảy dịch", "Biểu hiện bất thường khiến gia đình lo lắng"];

const SANG_LOC = [
  ["Mục đích", "Phát hiện sớm một số bệnh lý bẩm sinh để can thiệp kịp thời."],
  ["Thời điểm", "Thường lấy mẫu trong vòng 24–72 giờ sau sinh theo chỉ định."],
  ["Nhóm bệnh sàng lọc", "Một số rối loạn nội tiết – chuyển hóa, thính lực và tim bẩm sinh (nếu triển khai)."],
  ["Quy trình lấy mẫu", "Lấy máu gót chân và/hoặc đo thính lực, SpO₂ theo hướng dẫn."],
  ["Thời gian nhận kết quả", "Tùy loại xét nghiệm; bác sĩ sẽ hẹn thời điểm trả kết quả."],
  ["Khi kết quả bất thường", "Tư vấn và hướng dẫn khám chuyên khoa để chẩn đoán xác định."],
  ["Đơn vị thực hiện", "Xét nghiệm được thực hiện tại đơn vị được chỉ định của bệnh viện."],
];
const NON_THANG = ["Kiểm soát thân nhiệt", "Hỗ trợ hô hấp", "Nuôi dưỡng phù hợp", "Theo dõi cân nặng", "Chăm sóc da", "Phòng ngừa nhiễm khuẩn", "Chăm sóc Kangaroo", "Theo dõi phát triển thần kinh", "Hướng dẫn cha mẹ chăm sóc tại nhà", "Lịch tái khám trẻ non tháng"];
const KANGAROO = [
  ["Kangaroo là gì?", "Phương pháp cho trẻ tiếp xúc da kề da trên ngực cha/mẹ."],
  ["Đối tượng áp dụng", "Chủ yếu cho trẻ non tháng, nhẹ cân ổn định, theo chỉ định."],
  ["Lợi ích dự kiến", "Giữ ấm, ổn định nhịp thở – nhịp tim, hỗ trợ bú mẹ và gắn kết."],
  ["Thời gian thực hiện", "Thực hiện đều đặn mỗi ngày theo hướng dẫn của nhân viên y tế."],
  ["Hướng dẫn tư thế", "Đặt trẻ áp ngực, đầu nghiêng, được cố định an toàn."],
  ["Vai trò cha và mẹ", "Cả cha và mẹ đều có thể thực hiện dưới giám sát."],
  ["Giám sát y tế", "Nhân viên y tế theo dõi trẻ trong suốt quá trình."],
  ["Sau xuất viện", "Có thể tiếp tục tại nhà theo hướng dẫn."],
];
const SUA_ME = ["Lợi ích của sữa mẹ", "Hỗ trợ bú sớm", "Hướng dẫn tư thế cho bú", "Hướng dẫn vắt và bảo quản sữa", "Duy trì nguồn sữa khi trẻ nằm điều trị", "Nuôi dưỡng trẻ non tháng", "Xử lý một số khó khăn khi cho bú", "Tư vấn trước khi xuất viện"];
const DINH_DUONG = ["Đánh giá nhu cầu dinh dưỡng", "Sữa mẹ", "Sữa mẹ tăng cường theo chỉ định", "Sữa công thức khi có chỉ định", "Nuôi dưỡng qua sonde", "Nuôi dưỡng tĩnh mạch", "Theo dõi cân nặng", "Theo dõi chiều dài và vòng đầu", "Kế hoạch dinh dưỡng sau xuất viện"];

const DIEU_DUONG = [
  { ten: "Điều dưỡng sơ sinh", vt: "Chăm sóc, theo dõi và thực hiện y lệnh hằng ngày cho trẻ." },
  { ten: "Điều dưỡng hồi sức", vt: "Theo dõi sát và hỗ trợ trẻ tại khu chăm sóc chuyên sâu." },
  { ten: "Nhân viên tư vấn sữa mẹ", vt: "Hướng dẫn bú mẹ, vắt và bảo quản sữa." },
  { ten: "Nhân viên dinh dưỡng", vt: "Xây dựng và theo dõi chế độ dinh dưỡng cho trẻ." },
  { ten: "Kỹ thuật viên liên quan", vt: "Hỗ trợ xét nghiệm, chẩn đoán hình ảnh và thiết bị." },
];
const CO_SO = [
  ["Khu chăm sóc trẻ sơ sinh", "Theo dõi và chăm sóc trẻ sau sinh."],
  ["Khu hồi sức sơ sinh", "Chăm sóc trẻ cần hỗ trợ chuyên sâu."],
  ["Lồng ấp", "Giữ ấm và theo dõi trẻ non tháng, nhẹ cân."],
  ["Giường sưởi", "Duy trì thân nhiệt khi thực hiện chăm sóc, thủ thuật."],
  ["Máy thở", "Hỗ trợ hô hấp cho trẻ suy hô hấp theo chỉ định."],
  ["Hệ thống CPAP", "Hỗ trợ thở áp lực dương liên tục."],
  ["Monitor theo dõi", "Theo dõi nhịp tim, nhịp thở và các chỉ số sống."],
  ["Máy đo SpO₂", "Theo dõi độ bão hòa oxy máu."],
  ["Máy chiếu đèn vàng da", "Điều trị vàng da tăng bilirubin gián tiếp."],
  ["Máy truyền dịch", "Kiểm soát chính xác dịch và dinh dưỡng tĩnh mạch."],
  ["Hệ thống khí y tế", "Cung cấp oxy và khí nén cho thiết bị hỗ trợ."],
  ["Khu vắt và lưu trữ sữa mẹ", "Hỗ trợ mẹ vắt và bảo quản sữa cho trẻ."],
  ["Phương tiện vận chuyển sơ sinh", "Vận chuyển trẻ an toàn giữa các khu vực/cơ sở."],
];
const AN_TOAN = ["Quy trình vệ sinh tay", "Kiểm soát người ra vào", "Làm sạch và khử khuẩn", "Quản lý dụng cụ", "Nhận diện trẻ", "Kiểm soát thuốc và dinh dưỡng", "Phòng ngừa nhiễm khuẩn bệnh viện", "Quy trình bàn giao", "Quản lý sự cố", "Bảo mật thông tin người bệnh"];
const CHA_ME = ["Giờ thăm trẻ", "Quy định ra vào", "Hướng dẫn vệ sinh tay", "Đồ dùng được phép mang vào", "Cách nhận thông tin từ bác sĩ", "Cách gửi sữa mẹ", "Hướng dẫn tham gia chăm sóc trẻ", "Quy định chụp ảnh và quay phim", "Người liên hệ khi cần hỗ trợ", "Các giấy tờ cần chuẩn bị"];
const XUAT_VIEN = ["Trẻ ổn định về hô hấp", "Duy trì thân nhiệt phù hợp", "Khả năng bú/dinh dưỡng ổn định", "Tăng trưởng được đánh giá", "Gia đình được hướng dẫn chăm sóc", "Hoàn thành xét nghiệm/sàng lọc cần thiết", "Có lịch tái khám", "Có kế hoạch dùng thuốc nếu cần", "Gia đình được hướng dẫn dấu hiệu cảnh báo"];
const THEO_DOI = ["Khám lại sau xuất viện", "Theo dõi cân nặng", "Theo dõi bú và dinh dưỡng", "Theo dõi vàng da", "Theo dõi hô hấp", "Theo dõi phát triển vận động", "Theo dõi phát triển thần kinh", "Tiêm chủng", "Sàng lọc bổ sung", "Chuyển khám chuyên khoa khi cần"];

const CHI_SO = ["Số trẻ được chăm sóc", "Số trẻ sinh non được điều trị", "Tỷ lệ trẻ được bú mẹ", "Tỷ lệ thực hiện sàng lọc", "Tỷ lệ nhiễm khuẩn bệnh viện", "Thời gian điều trị trung bình", "Tỷ lệ chuyển viện"];
const CHI_PHI = ["Chi phí khám sơ sinh", "Chi phí giường bệnh", "Chi phí chăm sóc chuyên sâu", "Chi phí xét nghiệm", "Chi phí sàng lọc", "Chi phí thuốc và vật tư", "Quyền lợi bảo hiểm y tế", "Dịch vụ theo yêu cầu", "Phương thức thanh toán", "Đầu mối tư vấn viện phí"];

const KIEN_THUC = [
  { ten: "Chăm sóc cơ bản", items: ["Cách chăm sóc trẻ sơ sinh tại nhà", "Hướng dẫn chăm sóc rốn", "Cách theo dõi thân nhiệt", "Cách nhận biết trẻ bú đủ", "Cách tắm và vệ sinh trẻ"] },
  { ten: "Bệnh lý thường gặp", items: ["Vàng da sơ sinh", "Nhiễm khuẩn sơ sinh", "Suy hô hấp sơ sinh", "Hạ đường huyết", "Trẻ sơ sinh bú kém", "Các dấu hiệu nguy hiểm ở trẻ"] },
  { ten: "Trẻ non tháng", items: ["Chăm sóc trẻ sinh non", "Chăm sóc Kangaroo", "Dinh dưỡng trẻ non tháng", "Theo dõi phát triển sau xuất viện", "Lịch tái khám trẻ sinh non"] },
  { ten: "Sàng lọc và dự phòng", items: ["Sàng lọc sơ sinh là gì?", "Sàng lọc thính lực", "Sàng lọc tim bẩm sinh", "Tiêm chủng cho trẻ sơ sinh", "Lịch khám định kỳ"] },
];
const VIDEO = ["Giới thiệu Khoa Sơ sinh", "Quy trình chăm sóc trẻ sau sinh", "Hướng dẫn chăm sóc rốn", "Hướng dẫn cho trẻ bú", "Hướng dẫn vắt và bảo quản sữa", "Chăm sóc Kangaroo", "Dấu hiệu trẻ cần đi khám", "Chuẩn bị trước khi trẻ xuất viện"];

const DICH_VU_FORM = ["Khám trẻ sơ sinh", "Theo dõi trẻ sinh non", "Tư vấn vàng da", "Tư vấn bú mẹ và dinh dưỡng", "Đăng ký sàng lọc sơ sinh", "Tái khám sau xuất viện", "Khác"];

const FAQ = [
  { hoi: "Trẻ sơ sinh khi nào cần nhập viện?", dap: "Khi trẻ có dấu hiệu bất thường như khó thở, tím tái, bú kém/bỏ bú, li bì, sốt hoặc hạ thân nhiệt, co giật, vàng da tăng nhanh… cần được khám và có thể nhập viện theo chỉ định." },
  { hoi: "Trẻ vàng da khi nào cần khám?", dap: "Khi vàng da xuất hiện sớm trong 24 giờ đầu, lan nhanh xuống bụng – chân, kèm bú kém hoặc li bì, cần cho trẻ đi khám ngay." },
  { hoi: "Trẻ bú ít có nguy hiểm không?", dap: "Bú kém có thể là dấu hiệu của nhiều vấn đề. Nếu trẻ bú ít kèm biểu hiện bất thường, nên đưa trẻ đi khám sớm." },
  { hoi: "Trẻ sinh non được chăm sóc như thế nào?", dap: "Trẻ được kiểm soát thân nhiệt, hỗ trợ hô hấp và dinh dưỡng, theo dõi tăng trưởng, chăm sóc Kangaroo và theo dõi phát triển tùy tình trạng." },
  { hoi: "Cha mẹ có được vào thăm trẻ không?", dap: "Có, theo quy định giờ thăm và quy trình kiểm soát nhiễm khuẩn của khoa. Vui lòng liên hệ để biết chi tiết." },
  { hoi: "Có thể gửi sữa mẹ cho trẻ đang điều trị không?", dap: "Có. Khoa hướng dẫn cách vắt, bảo quản và gửi sữa mẹ an toàn cho trẻ đang điều trị." },
  { hoi: "Trẻ nằm lồng ấp trong bao lâu?", dap: "Thời gian tùy tình trạng và mức độ trưởng thành của trẻ; bác sĩ sẽ đánh giá và trao đổi với gia đình." },
  { hoi: "Sàng lọc sơ sinh gồm những gì?", dap: "Thường gồm sàng lọc một số rối loạn chuyển hóa – nội tiết, thính lực và tim bẩm sinh (nếu triển khai). Sàng lọc không thể phát hiện mọi bệnh lý bẩm sinh." },
  { hoi: "Khi nào trẻ được xuất viện?", dap: "Khi trẻ ổn định hô hấp, thân nhiệt, bú/dinh dưỡng tốt, hoàn thành sàng lọc cần thiết và gia đình được hướng dẫn chăm sóc — quyết định thuộc bác sĩ điều trị." },
  { hoi: "Sau xuất viện cần tái khám khi nào?", dap: "Theo lịch hẹn của bác sĩ, thường để theo dõi cân nặng, vàng da, bú và phát triển; trẻ sinh non được hẹn tái khám sát hơn." },
  { hoi: "Cần chuẩn bị gì khi đưa trẻ đến khám?", dap: "Mang theo giấy tờ tùy thân, hồ sơ/kết quả cũ nếu có, thông tin về cuộc sinh và tình trạng bú của trẻ." },
  { hoi: "Trẻ có dấu hiệu nào cần cấp cứu?", dap: `Khó thở, tím tái, co giật, li bì khó đánh thức, bỏ bú… cần đưa trẻ đến cơ sở y tế ngay hoặc gọi ${CAP_CUU}.` },
];

// ---------- helpers ----------
function SectionHead({ eyebrowText, tone, soft, title, sub }) {
  return (<><span style={eyebrow(tone, soft)}>{eyebrowText}</span><h2 style={{ ...h2, marginBottom: sub ? 10 : 12 }}>{title}</h2>{sub && <p style={{ fontSize: 15, color: T.sub, lineHeight: 1.6, maxWidth: 720, margin: 0 }}>{sub}</p>}</>);
}
function ChipGrid({ items, tone }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 12, marginTop: 22 }}>
      {items.map((t) => (
        <div key={t} style={{ display: "flex", alignItems: "flex-start", gap: 10, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 13, padding: "12px 14px" }}>
          <CheckCircle2 size={16} color={tone} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
          <span style={{ fontSize: 13.5, color: T.ink, fontWeight: 600, lineHeight: 1.45 }}>{t}</span>
        </div>
      ))}
    </div>
  );
}
// Nhóm nội dung: mỗi nhóm là 1 card có tiêu đề + danh sách bullet
function GroupCards({ groups, tone, onItem }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18, marginTop: 22 }}>
      {groups.map((g) => (
        <Card key={g.ten} style={{ padding: 22 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.ink, marginBottom: 12, paddingBottom: 10, borderBottom: `1px solid ${T.line}` }}>{g.ten}</div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
            {g.items.map((it) => (
              <li key={it} style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 13.5, color: T.sub, lineHeight: 1.5 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: tone, marginTop: 7, flexShrink: 0 }} aria-hidden="true" />
                {onItem ? <button onClick={() => onItem(it)} style={{ background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, color: T.sub }}>{it}</button> : <span>{it}</span>}
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
function StepGrid({ steps, from, to }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginTop: 22 }}>
      {steps.map((t, i) => (
        <Card key={t} style={{ padding: 18 }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, background: `linear-gradient(135deg, ${from}, ${to})`, color: "#fff", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 15, marginBottom: 10 }}>{i + 1}</span>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.ink, lineHeight: 1.4 }}>{t}</div>
        </Card>
      ))}
    </div>
  );
}
function DefList({ rows, tone }) {
  return (
    <div style={{ display: "grid", gap: 12, marginTop: 22, maxWidth: 900 }}>
      {rows.map(([t, d]) => (
        <div key={t} style={{ display: "flex", gap: 12, alignItems: "flex-start", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: "14px 18px" }}>
          <CheckCircle2 size={18} color={tone} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
          <div><b style={{ color: T.ink, fontSize: 14.5 }}>{t}:</b> <span style={{ color: T.sub, fontSize: 14.5, lineHeight: 1.6 }}>{d}</span></div>
        </div>
      ))}
    </div>
  );
}
function FaqItem({ item, id }) {
  const [mo, setMo] = useState(false);
  const panelId = `ss-faq-panel-${id}`, btnId = `ss-faq-btn-${id}`;
  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <button id={btnId} aria-expanded={mo} aria-controls={panelId} onClick={() => setMo((v) => !v)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "16px 18px", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
        <span style={{ fontWeight: 800, color: T.ink, fontSize: 15, flex: 1 }}>{item.hoi}</span>
        <ChevronDown size={18} color={T.sub} style={{ transform: mo ? "rotate(180deg)" : "none", transition: "transform .18s", flexShrink: 0 }} aria-hidden="true" />
      </button>
      {mo && <div id={panelId} role="region" aria-labelledby={btnId} style={{ padding: "0 18px 16px", fontSize: 14, color: T.sub, lineHeight: 1.65 }}>{item.dap}</div>}
    </Card>
  );
}
function DoctorCard({ b, onBook }) {
  const [mo, setMo] = useState(false);
  return (
    <Card style={{ padding: 22 }}>
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <span style={{ width: 60, height: 60, borderRadius: "50%", background: T.skySoft, color: T.sky, display: "grid", placeItems: "center", flexShrink: 0 }} aria-hidden="true"><User size={28} /></span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.ink }}>{b.name}</div>
          {b.title && <div style={{ fontSize: 13, color: T.sub, marginTop: 3 }}>{b.title}</div>}
          {b.exp > 0 && <div style={{ marginTop: 7 }}><Pill tone={T.sky} soft={T.skySoft}>{b.exp} năm kinh nghiệm</Pill></div>}
        </div>
      </div>
      {mo && <div style={{ marginTop: 14, fontSize: 13.5, color: T.sub, lineHeight: 1.6, background: T.bg, borderRadius: 11, padding: "12px 14px" }}>
        {b.hocHam ? `${b.hocHam} · ` : ""}Chuyên môn sơ sinh{b.title ? ` — ${b.title}` : ""}{b.exp > 0 ? `, ${b.exp} năm kinh nghiệm.` : "."}
        <div style={{ marginTop: 6 }}>Giờ khám: {GIO}.</div>
      </div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
        <Btn kind="ghost" size="sm" onClick={() => setMo((v) => !v)}><FileText size={14} /> {mo ? "Ẩn hồ sơ" : "Xem hồ sơ"}</Btn>
        <Btn kind="sky" size="sm" onClick={() => onBook(b.name)}><CalendarCheck size={14} /> Đặt lịch</Btn>
      </div>
    </Card>
  );
}

// ============================================================================
export default function KhoaSoSinh({ onBack, onNav }) {
  const { doctors } = useNav();
  const bacSiKhoa = (Array.isArray(doctors) ? doctors : []).filter((d) => d.dept === "sosinh");
  const bsKiemDuyet = bacSiKhoa[0];
  const formRef = useRef(null);

  const [form, setForm] = useState({ cha_me: "", sdt: "", ten_tre: "", ngay_sinh: "", tuoi_thai: "", can_nang: "", dich_vu: "", ngay_kham: "", tinh_trang: "", dong_y: false });
  const [loi, setLoi] = useState(null);
  const [daGui, setDaGui] = useState(false);
  const set = (k) => (e) => setForm((s) => ({ ...s, [k]: e.target.value }));

  // Tiêu đề trang + dữ liệu có cấu trúc BreadcrumbList (JSON-LD)
  useEffect(() => {
    document.title = "Khoa Sơ sinh – Chăm sóc và điều trị trẻ sơ sinh | BV Phụ sản Hải Phòng";
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.setAttribute("data-ss", "1");
    el.textContent = JSON.stringify({
      "@context": "https://schema.org", "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Trang chủ" },
        { "@type": "ListItem", position: 2, name: "Chuyên khoa" },
        { "@type": "ListItem", position: 3, name: "Khoa Sơ sinh" },
      ],
    });
    document.head.appendChild(el);
    return () => { el.remove(); };
  }, []);

  const toiForm = () => formRef.current && formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });

  const gui = (e) => {
    e.preventDefault();
    setLoi(null);
    const cm = form.cha_me.trim(), sdt = form.sdt.trim();
    if (!cm) { setLoi("Vui lòng nhập họ tên cha/mẹ hoặc người giám hộ."); return; }
    if (!/^[0-9 +.()-]{8,15}$/.test(sdt)) { setLoi("Số điện thoại chưa hợp lệ (8–15 chữ số)."); return; }
    if (!form.dong_y) { setLoi("Vui lòng xác nhận đồng ý chính sách bảo mật."); return; }
    const body =
      `Cha/mẹ/người giám hộ: ${cm}\n` + `Số điện thoại: ${sdt}\n` + `Họ tên trẻ: ${form.ten_tre || "(chưa cung cấp)"}\n` +
      `Ngày sinh của trẻ: ${form.ngay_sinh || "(chưa cung cấp)"}\n` + `Tuổi thai khi sinh: ${form.tuoi_thai || "(chưa cung cấp)"}\n` +
      `Cân nặng khi sinh: ${form.can_nang || "(chưa cung cấp)"}\n` + `Dịch vụ cần tư vấn: ${form.dich_vu || "(chưa chọn)"}\n` +
      `Ngày khám mong muốn: ${form.ngay_kham || "(chưa chọn)"}\n` + `Tình trạng hiện tại: ${form.tinh_trang.trim() || "(không có)"}\n`;
    window.location.href = `mailto:${EMAIL}?subject=${encodeURIComponent("Đăng ký khám/tư vấn Khoa Sơ sinh")}&body=${encodeURIComponent(body)}`;
    setDaGui(true);
  };

  const alt = (i) => (i % 2 === 1 ? { background: `linear-gradient(180deg, ${T.surface}, ${T.bg})` } : {});

  return (
    <div className="kp-page">
      {/* 1. Thanh thông tin nhanh */}
      <div style={{ background: T.ink, color: "#fff" }}>
        <div style={{ ...sectionWrap, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", padding: "10px 24px", fontSize: 13 }}>
          <a href={TEL(HOTLINE)} style={qbarLink}><Phone size={14} aria-hidden="true" /> Hotline {HOTLINE}</a>
          <a href={TEL(CAP_CUU)} style={qbarLink}><AlertTriangle size={14} aria-hidden="true" /> Cấp cứu {CAP_CUU}</a>
          <span style={{ ...qbarLink, color: "rgba(255,255,255,.85)" }}><Clock size={14} aria-hidden="true" /> {GIO}</span>
          <span style={{ ...qbarLink, color: "rgba(255,255,255,.85)" }}><MapPin size={14} aria-hidden="true" /> {DIA_CHI}</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
            <a href={TEL(HOTLINE)} style={{ ...qbarBtn(T.mint), textDecoration: "none" }}><Phone size={13} aria-hidden="true" /> Gọi tư vấn</a>
            <button onClick={toiForm} style={qbarBtn(T.peach)}><CalendarCheck size={13} aria-hidden="true" /> Đặt lịch khám</button>
            <button onClick={() => document.getElementById("ss-nhap-vien")?.scrollIntoView({ behavior: "smooth" })} style={qbarBtn(T.sky)}><Info size={13} aria-hidden="true" /> Hướng dẫn nhập viện</button>
          </div>
        </div>
      </div>

      {/* 2. Breadcrumb */}
      <nav aria-label="Breadcrumb" style={{ ...sectionWrap, padding: "16px 24px 0" }}>
        <ol style={{ listStyle: "none", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, margin: 0, padding: 0, fontSize: 13.5, color: T.sub }}>
          <li><button onClick={() => onNav("home")} style={crumb}><HomeIcon size={14} aria-hidden="true" /> Trang chủ</button></li>
          <li aria-hidden="true"><ChevronRight size={14} /></li>
          <li><button onClick={() => onBack()} style={crumb}>Chuyên khoa</button></li>
          <li aria-hidden="true"><ChevronRight size={14} /></li>
          <li aria-current="page" style={{ color: T.ink, fontWeight: 700 }}>Khoa Sơ sinh</li>
        </ol>
      </nav>

      {/* 3. Hero */}
      <section style={{ ...sectionWrap, padding: "24px 24px 44px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))", gap: 36, alignItems: "center" }}>
          <div>
            <span style={eyebrow(T.sky, T.skySoft)}>Chuyên khoa</span>
            <h1 style={{ fontSize: 38, fontWeight: 800, color: T.ink, lineHeight: 1.18, margin: "0 0 16px" }}>Khoa Sơ sinh – Chăm sóc và điều trị trẻ sơ sinh</h1>
            <p style={{ fontSize: 16, color: T.sub, lineHeight: 1.7, margin: "0 0 20px", maxWidth: 560 }}>
              Theo dõi, chăm sóc và điều trị trẻ sơ sinh khỏe mạnh, trẻ non tháng, nhẹ cân và trẻ mắc các bệnh lý cần
              hỗ trợ chuyên sâu sau sinh.
            </p>
            <div style={{ marginBottom: 18 }}><Pill tone={T.mint} soft={T.mintSoft}><Clock size={13} /> Tiếp nhận cấp cứu sơ sinh 24/7</Pill></div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Btn kind="primary" onClick={toiForm}><CalendarCheck size={16} /> Đặt lịch khám sơ sinh</Btn>
              <a href={TEL(HOTLINE)} style={{ textDecoration: "none" }}><Btn kind="soft" type="button"><Phone size={16} /> Gọi tư vấn</Btn></a>
              <Btn kind="sky" onClick={() => document.getElementById("ss-dich-vu")?.scrollIntoView({ behavior: "smooth" })}><Info size={16} /> Tìm hiểu dịch vụ</Btn>
            </div>
          </div>
          <div role="img" aria-label="Hình minh họa khu chăm sóc trẻ sơ sinh và điều dưỡng chăm sóc trẻ"
            style={{ background: `linear-gradient(150deg, ${T.sky}, ${T.mint})`, borderRadius: 26, minHeight: 290, display: "grid", placeItems: "center", boxShadow: "0 28px 56px rgba(91,168,208,.26)", overflow: "hidden", position: "relative" }}>
            <Baby size={104} color="rgba(255,255,255,.92)" aria-hidden="true" />
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 70% 25%, rgba(255,255,255,.22), transparent 55%)" }} />
          </div>
        </div>
      </section>

      {/* 4. Điểm nổi bật */}
      <section style={alt(1)}><div style={{ ...sectionWrap, padding: "44px 24px" }}>
        <SectionHead eyebrowText="Điểm nổi bật" tone={T.sky} soft={T.skySoft} title="Điểm nổi bật của Khoa Sơ sinh" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 18, marginTop: 22 }}>
          {NOI_BAT.map((n) => (
            <div key={n.ten} style={{ display: "flex", gap: 14, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: "18px 20px" }}>
              <span style={{ width: 44, height: 44, borderRadius: 13, background: T.skySoft, color: T.sky, display: "grid", placeItems: "center", flexShrink: 0 }}><n.icon size={21} aria-hidden="true" /></span>
              <div><div style={{ fontSize: 15.5, fontWeight: 800, color: T.ink, marginBottom: 4 }}>{n.ten}</div><div style={{ fontSize: 13.5, color: T.sub, lineHeight: 1.55 }}>{n.mo_ta}</div></div>
            </div>
          ))}
        </div>
      </div></section>

      {/* 5. Giới thiệu */}
      <section style={{ ...sectionWrap, padding: "44px 24px" }}>
        <SectionHead eyebrowText="Giới thiệu" tone={T.lav} soft={T.lavSoft} title="Giới thiệu Khoa Sơ sinh" />
        <DefList tone={T.mint} rows={[
          ["Chức năng và nhiệm vụ", "Theo dõi, chăm sóc và điều trị trẻ sơ sinh, phối hợp xử trí trẻ ngay sau sinh."],
          ["Đối tượng tiếp nhận", "Trẻ sơ sinh khỏe mạnh cần theo dõi, trẻ non/nhẹ cân và trẻ có bệnh lý cần hỗ trợ chuyên sâu."],
          ["Phạm vi chăm sóc & điều trị", "Từ chăm sóc thường quy đến hỗ trợ hô hấp, điều trị vàng da, nhiễm khuẩn và theo dõi trẻ nguy cơ cao."],
          ["Phối hợp với Khoa Sản", "Tiếp nhận và xử trí trẻ ngay tại phòng sinh theo quy trình phối hợp."],
          ["Phối hợp chuyên khoa", "Kết hợp gây mê – hồi sức, xét nghiệm và chẩn đoán hình ảnh khi cần."],
          ["Định hướng chăm sóc", "Lấy trẻ và gia đình làm trung tâm, hỗ trợ cha mẹ tham gia chăm sóc."],
        ]} />
        <div style={{ marginTop: 16, fontSize: 13, color: T.sub, display: "flex", gap: 18, flexWrap: "wrap" }}>
          <span><b style={{ color: T.ink }}>Nội dung được kiểm duyệt bởi:</b> {bsKiemDuyet ? bsKiemDuyet.name : "Đang cập nhật"}</span>
          <span><b style={{ color: T.ink }}>Ngày cập nhật gần nhất:</b> {NGAY_CAP_NHAT}</span>
        </div>
      </section>

      {/* 6. Đối tượng tiếp nhận */}
      <section style={alt(1)}><div style={{ ...sectionWrap, padding: "44px 24px" }}>
        <SectionHead eyebrowText="Đối tượng" tone={T.peach} soft={T.peachSoft} title="Đối tượng được tiếp nhận" />
        <ChipGrid items={DOI_TUONG} tone={T.peach} />
      </div></section>

      {/* 7. Dịch vụ chính */}
      <section id="ss-dich-vu" style={{ ...sectionWrap, padding: "44px 24px" }}>
        <SectionHead eyebrowText="Dịch vụ" tone={T.sky} soft={T.skySoft} title="Các dịch vụ chính" />
        <GroupCards groups={DICH_VU} tone={T.sky} />
      </section>

      {/* 8. Kỹ thuật chuyên sâu */}
      <section style={alt(1)}><div style={{ ...sectionWrap, padding: "44px 24px" }}>
        <SectionHead eyebrowText="Kỹ thuật" tone={T.mint} soft={T.mintSoft} title="Các kỹ thuật và chăm sóc chuyên sâu" sub="Chỉ hiển thị các kỹ thuật đang được triển khai tại khoa." />
        <ChipGrid items={KY_THUAT} tone={T.mint} />
      </div></section>

      {/* 9. Quy trình tiếp nhận sau sinh */}
      <section style={{ ...sectionWrap, padding: "44px 24px" }}>
        <SectionHead eyebrowText="Quy trình" tone={T.lav} soft={T.lavSoft} title="Quy trình tiếp nhận trẻ sau sinh" />
        <StepGrid steps={QT_TIEP_NHAN} from={T.lav} to={T.sky} />
      </section>

      {/* 10. Quy trình nhập viện */}
      <section id="ss-nhap-vien" style={alt(1)}><div style={{ ...sectionWrap, padding: "44px 24px" }}>
        <SectionHead eyebrowText="Nhập viện" tone={T.sky} soft={T.skySoft} title="Quy trình nhập viện Khoa Sơ sinh" />
        <StepGrid steps={QT_NHAP_VIEN} from={T.sky} to={T.mint} />
      </div></section>

      {/* 11. Quy trình khu hồi sức */}
      <section style={{ ...sectionWrap, padding: "44px 24px" }}>
        <SectionHead eyebrowText="Hồi sức" tone={T.peach} soft={T.peachSoft} title="Quy trình chăm sóc tại khu hồi sức sơ sinh" />
        <StepGrid steps={QT_HOI_SUC} from={T.peach} to={T.lav} />
      </section>

      {/* 12. Bệnh lý thường gặp */}
      <section style={alt(1)}><div style={{ ...sectionWrap, padding: "44px 24px" }}>
        <SectionHead eyebrowText="Bệnh lý" tone={T.lav} soft={T.lavSoft} title="Các bệnh lý thường gặp" />
        <GroupCards groups={BENH_LY} tone={T.lav} />
      </div></section>

      {/* 13. Dấu hiệu cần khám ngay */}
      <section style={{ ...sectionWrap, padding: "44px 24px" }}>
        <SectionHead eyebrowText="Cảnh báo" tone="#E24A4A" soft="#FDECEA" title="Dấu hiệu trẻ cần được khám ngay" />
        <ChipGrid items={DAU_HIEU} tone="#E24A4A" />
        <div style={{ marginTop: 18 }}><a href={TEL(HOTLINE)} style={{ textDecoration: "none" }}><Btn kind="primary"><Phone size={15} /> Liên hệ Khoa Sơ sinh</Btn></a></div>
      </section>

      {/* 14. Sàng lọc sơ sinh */}
      <section style={alt(1)}><div style={{ ...sectionWrap, padding: "44px 24px" }}>
        <SectionHead eyebrowText="Sàng lọc" tone={T.mint} soft={T.mintSoft} title="Sàng lọc sơ sinh" sub="Sàng lọc giúp phát hiện sớm một số bệnh lý — không thể phát hiện mọi bệnh lý bẩm sinh." />
        <DefList tone={T.mint} rows={SANG_LOC} />
        <div style={{ marginTop: 18 }}><Btn kind="mint" onClick={toiForm}><CalendarCheck size={15} /> Đăng ký sàng lọc</Btn></div>
      </div></section>

      {/* 15. Chăm sóc trẻ non tháng */}
      <section style={{ ...sectionWrap, padding: "44px 24px" }}>
        <SectionHead eyebrowText="Trẻ non tháng" tone={T.peach} soft={T.peachSoft} title="Chăm sóc trẻ non tháng" />
        <ChipGrid items={NON_THANG} tone={T.peach} />
      </section>

      {/* 16. Kangaroo */}
      <section style={alt(1)}><div style={{ ...sectionWrap, padding: "44px 24px" }}>
        <SectionHead eyebrowText="Kangaroo" tone={T.lav} soft={T.lavSoft} title="Chăm sóc Kangaroo" />
        <DefList tone={T.lav} rows={KANGAROO} />
      </div></section>

      {/* 17 & 18. Sữa mẹ + Dinh dưỡng */}
      <section style={{ ...sectionWrap, padding: "44px 24px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 32 }}>
        <div><SectionHead eyebrowText="Sữa mẹ" tone={T.mint} soft={T.mintSoft} title="Nuôi con bằng sữa mẹ" /><ChipGrid items={SUA_ME} tone={T.mint} /></div>
        <div><SectionHead eyebrowText="Dinh dưỡng" tone={T.gold} soft={T.goldSoft} title="Dinh dưỡng trẻ sơ sinh" /><ChipGrid items={DINH_DUONG} tone={T.gold} /></div>
      </section>

      {/* 19. Đội ngũ bác sĩ */}
      <section style={alt(1)}><div style={{ ...sectionWrap, padding: "44px 24px" }}>
        <SectionHead eyebrowText="Đội ngũ" tone={T.sky} soft={T.skySoft} title="Đội ngũ bác sĩ" />
        {bacSiKhoa.length === 0
          ? <Card style={{ padding: 34, textAlign: "center", color: T.sub, marginTop: 22 }}>Đang cập nhật danh sách bác sĩ.</Card>
          : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, marginTop: 22 }}>{bacSiKhoa.map((b) => <DoctorCard key={b.id} b={b} onBook={toiForm} />)}</div>}
      </div></section>

      {/* 20. Điều dưỡng & nhân viên chăm sóc */}
      <section style={{ ...sectionWrap, padding: "44px 24px" }}>
        <SectionHead eyebrowText="Chăm sóc" tone={T.mint} soft={T.mintSoft} title="Đội ngũ điều dưỡng và nhân viên chăm sóc" sub="Giới thiệu vai trò và năng lực chung của đội ngũ." />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginTop: 22 }}>
          {DIEU_DUONG.map((d) => (
            <Card key={d.ten} style={{ padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ width: 38, height: 38, borderRadius: 11, background: T.mintSoft, color: T.mint, display: "grid", placeItems: "center" }} aria-hidden="true"><Users size={18} /></span>
                <div style={{ fontSize: 15, fontWeight: 800, color: T.ink }}>{d.ten}</div>
              </div>
              <div style={{ fontSize: 13.5, color: T.sub, lineHeight: 1.55 }}>{d.vt}</div>
            </Card>
          ))}
        </div>
      </section>

      {/* 21. Cơ sở vật chất */}
      <section style={alt(1)}><div style={{ ...sectionWrap, padding: "44px 24px" }}>
        <SectionHead eyebrowText="Cơ sở vật chất" tone={T.sky} soft={T.skySoft} title="Cơ sở vật chất và trang thiết bị" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginTop: 22 }}>
          {CO_SO.map(([ten, mc]) => (
            <div key={ten} style={{ display: "flex", gap: 12, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: "16px 18px" }}>
              <span style={{ width: 40, height: 40, borderRadius: 11, background: T.skySoft, color: T.sky, display: "grid", placeItems: "center", flexShrink: 0 }} aria-hidden="true"><Stethoscope size={19} /></span>
              <div><div style={{ fontSize: 14.5, fontWeight: 800, color: T.ink, marginBottom: 3 }}>{ten}</div><div style={{ fontSize: 13, color: T.sub, lineHeight: 1.5 }}>{mc}</div></div>
            </div>
          ))}
        </div>
      </div></section>

      {/* 22. An toàn & kiểm soát nhiễm khuẩn */}
      <section style={{ ...sectionWrap, padding: "44px 24px" }}>
        <SectionHead eyebrowText="An toàn" tone={T.mint} soft={T.mintSoft} title="An toàn người bệnh và kiểm soát nhiễm khuẩn" />
        <ChipGrid items={AN_TOAN} tone={T.mint} />
      </section>

      {/* 23. Thông tin cho cha mẹ */}
      <section style={alt(1)}><div style={{ ...sectionWrap, padding: "44px 24px" }}>
        <SectionHead eyebrowText="Cho cha mẹ" tone={T.lav} soft={T.lavSoft} title="Thông tin dành cho cha mẹ khi trẻ nằm viện" />
        <ChipGrid items={CHA_ME} tone={T.lav} />
      </div></section>

      {/* 24 & 25. Xuất viện + theo dõi */}
      <section style={{ ...sectionWrap, padding: "44px 24px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 32 }}>
        <div>
          <SectionHead eyebrowText="Xuất viện" tone={T.peach} soft={T.peachSoft} title="Điều kiện xuất viện" sub="Hướng dẫn chung — quyết định xuất viện thuộc bác sĩ điều trị." />
          <ChipGrid items={XUAT_VIEN} tone={T.peach} />
        </div>
        <div>
          <SectionHead eyebrowText="Theo dõi" tone={T.sky} soft={T.skySoft} title="Theo dõi sau xuất viện" />
          <ChipGrid items={THEO_DOI} tone={T.sky} />
          <div style={{ marginTop: 16 }}><Btn kind="sky" onClick={toiForm}><CalendarCheck size={15} /> Đặt lịch tái khám sơ sinh</Btn></div>
        </div>
      </section>

      {/* 26. Kết quả & chỉ số — KHÔNG bịa số liệu */}
      <section style={alt(1)}><div style={{ ...sectionWrap, padding: "44px 24px" }}>
        <SectionHead eyebrowText="Chỉ số" tone={T.gold} soft={T.goldSoft} title="Kết quả và chỉ số chuyên môn" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginTop: 22 }}>
          {CHI_SO.map((t) => (
            <Card key={t} style={{ padding: 18, textAlign: "center" }}>
              <BarChart3 size={20} color={T.gold} aria-hidden="true" style={{ marginBottom: 6 }} />
              <div style={{ fontSize: 22, fontWeight: 800, color: T.ink }}>—</div>
              <div style={{ fontSize: 12.5, color: T.sub, marginTop: 4 }}>{t}</div>
            </Card>
          ))}
        </div>
        <div style={{ marginTop: 16, fontSize: 13, color: T.sub, lineHeight: 1.6, background: T.surface, border: `1px dashed ${T.line}`, borderRadius: 12, padding: "12px 16px" }}>
          <Info size={14} style={{ verticalAlign: -2 }} aria-hidden="true" /> Chỉ công bố khi có dữ liệu đã kiểm chứng, kèm khoảng thời gian thống kê, số trẻ được phân tích, định nghĩa chỉ số, nguồn dữ liệu và ngày cập nhật.
        </div>
      </div></section>

      {/* 27. Câu chuyện gia đình — KHÔNG bịa lời chứng thực */}
      <section style={{ ...sectionWrap, padding: "44px 24px" }}>
        <SectionHead eyebrowText="Câu chuyện" tone={T.peach} soft={T.peachSoft} title="Câu chuyện gia đình và em bé" />
        <Card style={{ padding: 30, marginTop: 22, textAlign: "center", color: T.sub }}>
          <Heart size={30} color={T.peach} aria-hidden="true" style={{ marginBottom: 10 }} />
          <div style={{ fontSize: 14.5, lineHeight: 1.7, maxWidth: 620, margin: "0 auto" }}>Hành trình điều trị và chia sẻ của các gia đình sẽ được đăng tải tại đây sau khi có sự đồng ý của cha mẹ hoặc người đại diện hợp pháp.</div>
        </Card>
      </section>

      {/* 28. Chi phí & bảo hiểm — KHÔNG bịa giá */}
      <section style={alt(1)}><div style={{ ...sectionWrap, padding: "44px 24px" }}>
        <SectionHead eyebrowText="Chi phí" tone={T.peach} soft={T.peachSoft} title="Chi phí và bảo hiểm" sub="Chi phí thực tế phụ thuộc tình trạng của trẻ và chỉ định chuyên môn." />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 12, marginTop: 22 }}>
          {CHI_PHI.map((t) => (
            <div key={t} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 13, padding: "13px 15px" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 9, fontSize: 13.5, color: T.ink, fontWeight: 600 }}><Wallet size={16} color={T.peach} aria-hidden="true" /> {t}</span>
              <span style={{ fontSize: 12, color: T.sub, whiteSpace: "nowrap" }}>Liên hệ</span>
            </div>
          ))}
        </div>
      </div></section>

      {/* 29. FAQ */}
      <section style={{ ...sectionWrap, maxWidth: 900, padding: "44px 24px" }}>
        <SectionHead eyebrowText="Hỏi & đáp" tone={T.gold} soft={T.goldSoft} title="Câu hỏi thường gặp" />
        <div style={{ display: "grid", gap: 12, marginTop: 22 }}>{FAQ.map((f, i) => <FaqItem key={i} item={f} id={i} />)}</div>
      </section>

      {/* 30. Bài viết kiến thức */}
      <section style={alt(1)}><div style={{ ...sectionWrap, padding: "44px 24px" }}>
        <SectionHead eyebrowText="Kiến thức" tone={T.sky} soft={T.skySoft} title="Bài viết kiến thức sơ sinh" />
        <GroupCards groups={KIEN_THUC} tone={T.sky} onItem={() => onNav("tin-tuc")} />
      </div></section>

      {/* 31. Video hướng dẫn — KHÔNG nhúng video giả */}
      <section style={{ ...sectionWrap, padding: "44px 24px" }}>
        <SectionHead eyebrowText="Video" tone={T.peach} soft={T.peachSoft} title="Video hướng dẫn" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 16, marginTop: 22 }}>
          {VIDEO.map((t) => (
            <div key={t} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, overflow: "hidden" }}>
              <div style={{ height: 118, background: `${T.peach}12`, display: "grid", placeItems: "center", position: "relative" }}>
                <PlayCircle size={36} color={T.peach} style={{ opacity: .7 }} aria-hidden="true" />
                <span style={{ position: "absolute", top: 8, right: 8, fontSize: 11, fontWeight: 800, color: T.sub, background: T.bg, borderRadius: 999, padding: "3px 9px" }}>Sắp có</span>
              </div>
              <div style={{ padding: "12px 14px", fontSize: 13.5, fontWeight: 700, color: T.ink, lineHeight: 1.4 }}>{t}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 32. Form đăng ký khám/tư vấn */}
      <section ref={formRef} style={{ background: `linear-gradient(180deg, ${T.surface}, ${T.bg})` }}>
        <div style={{ ...sectionWrap, maxWidth: 780, padding: "44px 24px" }}>
          <SectionHead eyebrowText="Đăng ký" tone={T.sky} soft={T.skySoft} title="Đăng ký khám hoặc tư vấn sơ sinh" />
          <p style={{ fontSize: 14.5, color: T.sub, lineHeight: 1.6, margin: "0 0 20px" }}>
            Điền thông tin rồi bấm <b>Gửi đăng ký</b> — hệ thống mở email soạn sẵn gửi tới Khoa Sơ sinh. Hoặc gọi hotline{" "}
            <a href={TEL(HOTLINE)} style={{ color: T.sky, fontWeight: 700, textDecoration: "none" }}>{HOTLINE}</a>. Vui lòng không nhập dữ liệu sức khỏe quá nhạy cảm trên form.
          </p>
          {daGui && <div role="status" style={msgOk}>Đã mở ứng dụng email với thông tin đăng ký. Nếu không thấy, vui lòng gọi hotline {HOTLINE}.</div>}
          {loi && <div role="alert" style={msgErr}>{loi}</div>}
          <Card style={{ padding: 26 }}>
            <form onSubmit={gui} noValidate>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 16 }}>
                <div><label htmlFor="ss-chame" style={lbl}>Họ tên cha/mẹ/người giám hộ <span style={req}>*</span></label><input id="ss-chame" type="text" autoComplete="name" required value={form.cha_me} onChange={set("cha_me")} placeholder="Nguyễn Thị B" style={inp} /></div>
                <div><label htmlFor="ss-sdt" style={lbl}>Số điện thoại <span style={req}>*</span></label><input id="ss-sdt" type="tel" inputMode="tel" autoComplete="tel" required value={form.sdt} onChange={set("sdt")} placeholder="0912 345 678" style={inp} /></div>
                <div><label htmlFor="ss-tentre" style={lbl}>Họ tên trẻ</label><input id="ss-tentre" type="text" value={form.ten_tre} onChange={set("ten_tre")} placeholder="Bé …" style={inp} /></div>
                <div><label htmlFor="ss-ngaysinh" style={lbl}>Ngày sinh của trẻ</label><input id="ss-ngaysinh" type="date" value={form.ngay_sinh} onChange={set("ngay_sinh")} style={inp} /></div>
                <div><label htmlFor="ss-tuoithai" style={lbl}>Tuổi thai khi sinh (tuần)</label><input id="ss-tuoithai" type="text" value={form.tuoi_thai} onChange={set("tuoi_thai")} placeholder="VD: 38 tuần" style={inp} /></div>
                <div><label htmlFor="ss-cannang" style={lbl}>Cân nặng khi sinh</label><input id="ss-cannang" type="text" value={form.can_nang} onChange={set("can_nang")} placeholder="VD: 3.2 kg" style={inp} /></div>
                <div><label htmlFor="ss-dichvu" style={lbl}>Dịch vụ cần tư vấn</label>
                  <select id="ss-dichvu" value={form.dich_vu} onChange={set("dich_vu")} style={inp}>
                    <option value="">— Chọn dịch vụ —</option>{DICH_VU_FORM.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select></div>
                <div><label htmlFor="ss-ngaykham" style={lbl}>Ngày khám mong muốn</label><input id="ss-ngaykham" type="date" value={form.ngay_kham} onChange={set("ngay_kham")} style={inp} /></div>
              </div>
              <div style={{ marginBottom: 16 }}><label htmlFor="ss-tinhtrang" style={lbl}>Mô tả ngắn tình trạng hiện tại</label><textarea id="ss-tinhtrang" rows={3} value={form.tinh_trang} onChange={set("tinh_trang")} placeholder="Mô tả ngắn gọn (không bắt buộc)…" style={{ ...inp, resize: "vertical" }} /></div>
              <label htmlFor="ss-dongy" style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 20, cursor: "pointer", fontSize: 13.5, color: T.sub, lineHeight: 1.5 }}>
                <input id="ss-dongy" type="checkbox" checked={form.dong_y} onChange={(e) => setForm((s) => ({ ...s, dong_y: e.target.checked }))} style={{ width: 17, height: 17, accentColor: T.sky, marginTop: 1, flexShrink: 0 }} />
                <span>Tôi đồng ý cho bệnh viện lưu trữ và sử dụng thông tin trên nhằm mục đích liên hệ tư vấn, đặt lịch (chính sách bảo mật).</span>
              </label>
              <Btn kind="primary" type="submit"><Send size={16} /> Gửi đăng ký</Btn>
            </form>
          </Card>
        </div>
      </section>

      {/* 33. Thông tin liên hệ + bản đồ */}
      <section style={{ ...sectionWrap, padding: "44px 24px" }}>
        <SectionHead eyebrowText="Liên hệ" tone={T.sky} soft={T.skySoft} title="Thông tin liên hệ" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 22, marginTop: 22 }}>
          <div style={{ display: "grid", gap: 12 }}>
            {[[Building2, TEN_KHOA], [MapPin, DIA_CHI], [Clock, `Giờ làm việc: ${GIO}`], [Phone, `Hotline: ${HOTLINE}`], [AlertTriangle, `Cấp cứu: ${CAP_CUU}`], [Mail, `Email: ${EMAIL}`]].map(([Icon, t]) => (
              <div key={t} style={{ display: "flex", alignItems: "flex-start", gap: 11, fontSize: 14.5, color: T.sub }}>
                <Icon size={18} color={T.sky} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" /> <span>{t}</span>
              </div>
            ))}
            <div style={{ fontSize: 13.5, color: T.sub, lineHeight: 1.6, marginTop: 4 }}><b style={{ color: T.ink }}>Hướng dẫn di chuyển:</b> Vào sảnh khu khám bệnh, lên tầng 2 khu C; Khoa Sơ sinh nằm liền kề Khoa Sản.</div>
            <div style={{ fontSize: 13.5, color: T.sub, lineHeight: 1.6 }}><b style={{ color: T.ink }}>Gửi xe:</b> Bãi xe tại tầng hầm/khuôn viên bệnh viện theo hướng dẫn của bảo vệ.</div>
            <div style={{ fontSize: 13.5, color: T.sub, lineHeight: 1.6 }}><b style={{ color: T.ink }}>Nhập viện / đặt lịch:</b> qua hotline {HOTLINE} hoặc form đăng ký phía trên.</div>
            <div><a href={MAP_LINK} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}><Btn kind="soft"><MapPin size={15} /> Chỉ đường trên Google Maps</Btn></a></div>
          </div>
          <div style={{ borderRadius: 16, overflow: "hidden", border: `1px solid ${T.line}`, minHeight: 260 }}>
            <iframe title="Bản đồ Khoa Sơ sinh – BV Phụ sản Hải Phòng" src={MAP_SRC} loading="lazy" referrerPolicy="no-referrer-when-downgrade" style={{ width: "100%", height: "100%", minHeight: 260, border: 0 }} />
          </div>
        </div>
      </section>

      {/* CTA cố định mobile */}
      <div className="kp-mobile-cta" aria-label="Hành động nhanh">
        <a href={TEL(HOTLINE)} style={ctaItem(T.mint)}><Phone size={17} aria-hidden="true" /> Gọi tư vấn</a>
        <button onClick={toiForm} style={{ ...ctaItem(T.peach), border: "none", cursor: "pointer", fontFamily: "inherit" }}><CalendarCheck size={17} aria-hidden="true" /> Đặt lịch khám</button>
        <a href={`mailto:${EMAIL}?subject=${encodeURIComponent("Tư vấn Khoa Sơ sinh")}`} style={ctaItem(T.sky)}><Mail size={17} aria-hidden="true" /> Nhắn tư vấn</a>
      </div>
    </div>
  );
}

// ---------- styles ----------
const qbarLink = { display: "inline-flex", alignItems: "center", gap: 6, color: "#fff", textDecoration: "none", fontWeight: 700 };
const qbarBtn = (bg) => ({ display: "inline-flex", alignItems: "center", gap: 6, background: bg, color: "#fff", border: "none", borderRadius: 999, padding: "6px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" });
const crumb = { background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, color: T.sub, display: "inline-flex", alignItems: "center", gap: 5, padding: 0 };
const lbl = { display: "block", fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 6 };
const req = { color: "#C0392B" };
const inp = { width: "100%", boxSizing: "border-box", padding: "11px 13px", borderRadius: 12, border: `1.5px solid ${T.line}`, fontSize: 14.5, fontFamily: "inherit", outline: "none", background: T.surface, color: T.ink };
const msgOk = { background: T.mintSoft, color: "#2F8F73", fontSize: 14, padding: "12px 16px", borderRadius: 12, marginBottom: 16 };
const msgErr = { background: "#FDECEA", color: "#C0392B", fontSize: 14, padding: "12px 16px", borderRadius: 12, marginBottom: 16 };
const ctaItem = (color) => ({ flex: 1, display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "9px 4px", fontSize: 12, fontWeight: 800, color, textDecoration: "none", background: "none" });
