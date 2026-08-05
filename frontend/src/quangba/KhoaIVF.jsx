import React, { useState, useRef, useEffect } from "react";
import {
  Phone, Clock, MapPin, CalendarCheck, ChevronRight, Home as HomeIcon, Heart, Mail, User,
  ShieldCheck, Users, Microscope, Activity, FlaskConical, Dna, Snowflake, Baby, ClipboardList,
  CheckCircle2, ChevronDown, FileText, Send, Building2, Sparkles, PlayCircle, Info, BarChart3, Wallet,
} from "lucide-react";
import { T, Card, Btn, Pill, useNav } from "../shared";
import { sectionWrap, eyebrow, h2 } from "./ui";

// ============================================================================
//  TRANG CHI TIẾT KHOA HỖ TRỢ SINH SẢN – IVF (mở khi bấm thẻ khoa IVF).
//  Nội dung theo cấu trúc SEO 26 mục. Các mục cần số liệu thật (kết quả điều
//  trị, chi phí, câu chuyện người bệnh, video, chuyên viên phôi học) được để
//  ở trạng thái "đang cập nhật/liên hệ" — KHÔNG bịa số liệu/giá/lời chứng thực.
//  Form đặt lịch mở email soạn sẵn (mailto) — hành vi thật, không lưu database.
//  Responsive + accessibility cơ bản (label/htmlFor, aria, alt) + CTA mobile.
// ============================================================================

const HOTLINE = "1900 1717";
const EMAIL = "ivf@bvphusanhp.vn";
const TEN_TT = "Trung tâm Hỗ trợ sinh sản (IVF) — BV Phụ sản Hải Phòng";
const GIO = "7:00 – 17:00 (Thứ 2 – Chủ nhật)";
const DIA_CHI = "Tầng 4, Nhà B, Số 19 Trần Quang Khải, Hồng Bàng, Hải Phòng";
const TEL = (s) => `tel:${s.replace(/\s/g, "")}`;
const MAP_SRC = `https://www.google.com/maps?q=${encodeURIComponent("19 Trần Quang Khải, Hồng Bàng, Hải Phòng")}&output=embed`;
const MAP_LINK = `https://www.google.com/maps/search/${encodeURIComponent("19 Trần Quang Khải, Hồng Bàng, Hải Phòng")}`;
const NGAY_CAP_NHAT = new Date().toLocaleDateString("vi-VN");

const NOI_BAT = [
  { icon: Users, ten: "Đội ngũ bác sĩ chuyên khoa", mo_ta: "Bác sĩ hỗ trợ sinh sản giàu kinh nghiệm, trực tiếp điều trị." },
  { icon: FlaskConical, ten: "Chuyên viên phôi học", mo_ta: "Đội ngũ phôi học được đào tạo chuyên sâu, thao tác trong labo." },
  { icon: Microscope, ten: "Labo IVF hiện đại", mo_ta: "Hệ thống nuôi cấy, đông lạnh và đánh giá phôi tiêu chuẩn." },
  { icon: Sparkles, ten: "Phác đồ cá thể hóa", mo_ta: "Điều trị theo đặc điểm riêng của từng cặp vợ chồng." },
  { icon: Activity, ten: "Theo dõi xuyên suốt", mo_ta: "Đồng hành từ khám ban đầu đến khi có thai và theo dõi thai sớm." },
  { icon: ShieldCheck, ten: "Phối hợp đa chuyên khoa", mo_ta: "Kết hợp sản, phụ, nam khoa, nội tiết và di truyền." },
];

const DOI_TUONG = [
  "Mong con trên 12 tháng chưa có thai", "Kinh nguyệt không đều", "Dự trữ buồng trứng giảm",
  "Tắc vòi tử cung", "Lạc nội mạc tử cung", "Sảy thai liên tiếp", "Bất thường tinh dịch đồ",
  "Hiếm muộn thứ phát", "Thất bại chuyển phôi", "Cần bảo tồn khả năng sinh sản",
];

const DICH_VU = [
  "Khám vô sinh hiếm muộn", "Đánh giá khả năng sinh sản nữ", "Khám và điều trị vô sinh nam",
  "Bơm tinh trùng vào buồng tử cung – IUI", "Thụ tinh trong ống nghiệm – IVF",
  "Tiêm tinh trùng vào bào tương noãn – ICSI", "Chuyển phôi tươi", "Chuyển phôi đông lạnh",
  "Đông lạnh phôi", "Đông lạnh noãn", "Đông lạnh tinh trùng", "Bảo tồn khả năng sinh sản",
];

const QT_KHAM = [
  "Đăng ký và tiếp nhận", "Khai thác tiền sử hai vợ chồng", "Khám người vợ", "Khám người chồng",
  "Siêu âm và xét nghiệm", "Tổng hợp kết quả", "Tư vấn phương pháp điều trị", "Lập kế hoạch theo dõi",
];

const QT_IVF = [
  "Tư vấn và đánh giá", "Kích thích buồng trứng", "Theo dõi nang noãn", "Chọc hút noãn",
  "Lấy và xử lý tinh trùng", "Thụ tinh IVF hoặc ICSI", "Nuôi cấy và đánh giá phôi",
  "Chuyển phôi", "Thử thai", "Theo dõi thai sớm",
];

const NN_NU = [
  "Rối loạn phóng noãn", "Hội chứng buồng trứng đa nang", "Dự trữ buồng trứng giảm",
  "Suy buồng trứng sớm", "Tắc vòi tử cung", "Lạc nội mạc tử cung", "U xơ tử cung",
  "Polyp nội mạc tử cung", "Dị dạng tử cung", "Tuổi sinh sản cao",
];
const NN_NAM = [
  "Số lượng tinh trùng thấp", "Tinh trùng di động kém", "Hình thái tinh trùng bất thường",
  "Không có tinh trùng", "Giãn tĩnh mạch thừng tinh", "Rối loạn xuất tinh",
  "Bất thường nội tiết", "Bất thường di truyền",
];

const LABO = [
  "Phòng labo phôi học", "Hệ thống nuôi cấy phôi", "Embryoscope / time-lapse", "Kính hiển vi ICSI",
  "Hệ thống đông lạnh phôi", "Hệ thống lưu trữ mẫu", "Kiểm soát nhiệt độ và khí",
  "Quy trình nhận diện mẫu", "Hệ thống đánh giá chất lượng phôi",
];
const KY_THUAT = [
  "Nuôi cấy phôi nang", "Hỗ trợ phôi thoát màng", "Sinh thiết phôi", "Xét nghiệm di truyền phôi (PGT)",
  "Thu nhận tinh trùng bằng thủ thuật (PESA/TESA)", "Trữ lạnh noãn, tinh trùng và phôi",
  "Theo dõi phôi bằng time-lapse", "Hỗ trợ đánh giá phôi bằng phần mềm/AI",
];

const KET_QUA_MUC = [
  "Tỷ lệ thụ tinh", "Tỷ lệ tạo phôi", "Tỷ lệ phôi nang", "Tỷ lệ thai sinh hóa",
  "Tỷ lệ thai lâm sàng", "Tỷ lệ sinh sống",
];
const CHI_PHI_MUC = [
  "Chi phí khám ban đầu", "Chi phí xét nghiệm", "Chi phí IUI", "Chi phí IVF", "Chi phí thuốc",
  "Chi phí chọc hút noãn", "Chi phí nuôi cấy phôi", "Chi phí chuyển phôi", "Chi phí lưu trữ phôi",
];

const HD_TRUOC = [
  "Mang theo hồ sơ cũ", "Kết quả xét nghiệm", "Kết quả siêu âm", "Kết quả tinh dịch đồ",
  "Thông tin chu kỳ kinh", "Danh sách thuốc đang dùng", "Giấy tờ tùy thân",
  "Khuyến khích hai vợ chồng cùng đi khám",
];
const HD_TRONG = [
  "Theo dõi lịch dùng thuốc", "Lịch siêu âm", "Lịch xét nghiệm", "Chuẩn bị chọc hút noãn",
  "Chuẩn bị chuyển phôi", "Hướng dẫn sau chuyển phôi", "Dấu hiệu cần liên hệ bác sĩ ngay",
];

const KIEN_THUC = [
  "Vô sinh hiếm muộn là gì?", "Nguyên nhân vô sinh nam và nữ", "Quy trình IVF", "Quy trình IUI",
  "IVF và ICSI khác nhau thế nào?", "Phôi ngày 3 và phôi ngày 5", "Chuyển phôi tươi và đông lạnh",
  "Chuẩn bị trước khi chuyển phôi", "Theo dõi sau chuyển phôi", "Bảo tồn khả năng sinh sản",
];
const VIDEO = [
  "Giới thiệu trung tâm IVF", "Quy trình khám hiếm muộn", "Quy trình IVF", "Hệ thống labo phôi học",
  "Chia sẻ của bác sĩ", "Câu chuyện người bệnh", "Hướng dẫn trước và sau chuyển phôi",
];

const FAQ = [
  { hoi: "Khi nào nên khám hiếm muộn?", dap: "Cặp vợ chồng dưới 35 tuổi quan hệ đều đặn, không dùng biện pháp tránh thai trên 12 tháng chưa có thai (hoặc trên 6 tháng nếu vợ trên 35 tuổi) nên đi khám hiếm muộn." },
  { hoi: "Khám hiếm muộn gồm những gì?", dap: "Khai thác tiền sử hai vợ chồng, khám và xét nghiệm nội tiết, siêu âm, đánh giá dự trữ buồng trứng ở vợ và tinh dịch đồ ở chồng." },
  { hoi: "IUI và IVF khác nhau thế nào?", dap: "IUI là bơm tinh trùng đã lọc rửa vào buồng tử cung. IVF là thụ tinh noãn và tinh trùng trong labo rồi chuyển phôi vào tử cung — chỉ định tùy nguyên nhân và mức độ hiếm muộn." },
  { hoi: "Một chu kỳ IVF mất bao lâu?", dap: "Trung bình khoảng 4–6 tuần từ khi kích thích buồng trứng đến chuyển phôi và thử thai, có thể thay đổi theo phác đồ và đáp ứng của mỗi người." },
  { hoi: "Chọc hút noãn có đau không?", dap: "Chọc hút noãn được thực hiện dưới tiền mê/giảm đau nên hầu như không đau; sau thủ thuật có thể tức nhẹ vùng bụng dưới." },
  { hoi: "Chuyển phôi có đau không?", dap: "Chuyển phôi là thủ thuật nhẹ nhàng, thường không cần gây mê và không gây đau đáng kể." },
  { hoi: "Sau chuyển phôi bao lâu thử thai?", dap: "Thường thử thai (định lượng beta hCG) sau chuyển phôi khoảng 10–14 ngày theo hẹn của bác sĩ." },
  { hoi: "Phôi có thể lưu trữ bao lâu?", dap: "Phôi đông lạnh có thể lưu trữ nhiều năm; thời gian cụ thể theo quy định và thỏa thuận lưu trữ với trung tâm." },
  { hoi: "Chi phí IVF gồm những gì?", dap: "Gồm khám, xét nghiệm, thuốc kích trứng, chọc hút noãn, nuôi cấy phôi, chuyển phôi và lưu trữ. Vui lòng liên hệ để được tư vấn chi phí cụ thể theo phác đồ." },
  { hoi: "Tỷ lệ thành công phụ thuộc yếu tố nào?", dap: "Phụ thuộc tuổi người vợ, nguyên nhân hiếm muộn, dự trữ buồng trứng, chất lượng noãn – tinh trùng – phôi và bệnh lý kèm theo." },
];

// ---------- helpers ----------
function SectionHead({ eyebrowText, tone, soft, title }) {
  return (<><span style={eyebrow(tone, soft)}>{eyebrowText}</span><h2 style={h2}>{title}</h2></>);
}
function ChipGrid({ items, tone }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12, marginTop: 22 }}>
      {items.map((t) => (
        <div key={t} style={{ display: "flex", alignItems: "flex-start", gap: 10, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 13, padding: "13px 15px" }}>
          <CheckCircle2 size={17} color={tone} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
          <span style={{ fontSize: 14, color: T.ink, fontWeight: 600, lineHeight: 1.45 }}>{t}</span>
        </div>
      ))}
    </div>
  );
}
function StepGrid({ steps, from, to }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 16, marginTop: 22 }}>
      {steps.map((t, i) => (
        <Card key={t} style={{ padding: 20 }}>
          <span style={{ width: 36, height: 36, borderRadius: 11, background: `linear-gradient(135deg, ${from}, ${to})`, color: "#fff", display: "grid", placeItems: "center", fontWeight: 800, marginBottom: 11 }}>{i + 1}</span>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: T.ink, lineHeight: 1.4 }}>{t}</div>
        </Card>
      ))}
    </div>
  );
}
function FaqItem({ item, id }) {
  const [mo, setMo] = useState(false);
  const panelId = `ivf-faq-panel-${id}`, btnId = `ivf-faq-btn-${id}`;
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
        <span style={{ width: 60, height: 60, borderRadius: "50%", background: T.mintSoft, color: T.mint, display: "grid", placeItems: "center", flexShrink: 0 }} aria-hidden="true"><User size={28} /></span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.ink }}>{b.name}</div>
          {b.title && <div style={{ fontSize: 13, color: T.sub, marginTop: 3 }}>{b.title}</div>}
          {b.exp > 0 && <div style={{ marginTop: 7 }}><Pill tone={T.mint} soft={T.mintSoft}>{b.exp} năm kinh nghiệm</Pill></div>}
        </div>
      </div>
      {mo && (
        <div style={{ marginTop: 14, fontSize: 13.5, color: T.sub, lineHeight: 1.6, background: T.bg, borderRadius: 11, padding: "12px 14px" }}>
          {b.hocHam ? `${b.hocHam} · ` : ""}Chuyên môn hỗ trợ sinh sản{b.title ? ` — ${b.title}` : ""}{b.exp > 0 ? `, ${b.exp} năm kinh nghiệm.` : "."}
          <div style={{ marginTop: 6 }}>Giờ khám: {GIO}.</div>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
        <Btn kind="ghost" size="sm" onClick={() => setMo((v) => !v)}><FileText size={14} /> {mo ? "Ẩn hồ sơ" : "Xem hồ sơ"}</Btn>
        <Btn kind="mint" size="sm" onClick={() => onBook(b.name)}><CalendarCheck size={14} /> Đặt lịch</Btn>
      </div>
    </Card>
  );
}

// ============================================================================
export default function KhoaIVF({ onBack, onNav }) {
  const { doctors } = useNav();
  const bacSiKhoa = (Array.isArray(doctors) ? doctors : []).filter((d) => d.dept === "ivf");
  const bsKiemDuyet = bacSiKhoa[0];
  const formRef = useRef(null);

  const [form, setForm] = useState({ ho_ten: "", sdt: "", nam_sinh: "", mong_con: "", dich_vu: "", bac_si: "", ngay_kham: "", noi_dung: "", dong_y: false });
  const [loi, setLoi] = useState(null);
  const [daGui, setDaGui] = useState(false);
  const set = (k) => (e) => setForm((s) => ({ ...s, [k]: e.target.value }));

  useEffect(() => { document.title = "Khoa Hỗ trợ sinh sản – IVF | BV Phụ sản Hải Phòng"; }, []);

  const toiForm = (bacSi) => {
    if (bacSi) setForm((s) => ({ ...s, bac_si: bacSi }));
    formRef.current && formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const gui = (e) => {
    e.preventDefault();
    setLoi(null);
    const ten = form.ho_ten.trim(), sdt = form.sdt.trim();
    if (!ten) { setLoi("Vui lòng nhập họ và tên."); return; }
    if (!/^[0-9 +.()-]{8,15}$/.test(sdt)) { setLoi("Số điện thoại chưa hợp lệ (8–15 chữ số)."); return; }
    if (!form.dong_y) { setLoi("Vui lòng xác nhận đồng ý chính sách bảo mật."); return; }
    const body =
      `Họ và tên: ${ten}\n` + `Số điện thoại: ${sdt}\n` + `Năm sinh: ${form.nam_sinh || "(chưa cung cấp)"}\n` +
      `Thời gian mong con: ${form.mong_con || "(chưa cung cấp)"}\n` + `Dịch vụ cần tư vấn: ${form.dich_vu || "(chưa chọn)"}\n` +
      `Bác sĩ mong muốn: ${form.bac_si || "(không yêu cầu)"}\n` + `Ngày khám mong muốn: ${form.ngay_kham || "(chưa chọn)"}\n` +
      `Nội dung cần hỗ trợ: ${form.noi_dung.trim() || "(không có)"}\n`;
    window.location.href = `mailto:${EMAIL}?subject=${encodeURIComponent("Đặt lịch tư vấn IVF")}&body=${encodeURIComponent(body)}`;
    setDaGui(true);
  };

  const alt = (i) => (i % 2 === 1 ? { background: `linear-gradient(180deg, ${T.surface}, ${T.bg})` } : {});

  return (
    <div className="kp-page">
      {/* 1. Thanh thông tin nhanh */}
      <div style={{ background: T.ink, color: "#fff" }}>
        <div style={{ ...sectionWrap, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", padding: "10px 24px", fontSize: 13.5 }}>
          <a href={TEL(HOTLINE)} style={{ display: "inline-flex", alignItems: "center", gap: 7, color: "#fff", textDecoration: "none", fontWeight: 700 }}><Phone size={15} aria-hidden="true" /> Hotline IVF {HOTLINE}</a>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, color: "rgba(255,255,255,.85)" }}><Clock size={15} aria-hidden="true" /> {GIO}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, color: "rgba(255,255,255,.85)" }}><MapPin size={15} aria-hidden="true" /> {DIA_CHI}</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button onClick={() => toiForm()} style={qbarBtn(T.mint)}><CalendarCheck size={14} aria-hidden="true" /> Đặt lịch</button>
            <a href={TEL(HOTLINE)} style={{ ...qbarBtn(T.peach), textDecoration: "none" }}><Phone size={14} aria-hidden="true" /> Gọi tư vấn</a>
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
          <li aria-current="page" style={{ color: T.ink, fontWeight: 700 }}>Khoa Hỗ trợ sinh sản – IVF</li>
        </ol>
      </nav>

      {/* 3. Hero */}
      <section style={{ ...sectionWrap, padding: "24px 24px 48px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))", gap: 36, alignItems: "center" }}>
          <div>
            <span style={eyebrow(T.mint, T.mintSoft)}>Chuyên khoa</span>
            <h1 style={{ fontSize: 40, fontWeight: 800, color: T.ink, lineHeight: 1.15, margin: "0 0 16px" }}>Khoa Hỗ trợ sinh sản – IVF</h1>
            <p style={{ fontSize: 16, color: T.sub, lineHeight: 1.7, margin: "0 0 24px", maxWidth: 560 }}>
              Khám và điều trị hiếm muộn cho cả vợ và chồng với các kỹ thuật IUI, IVF, ICSI cùng hệ thống labo phôi học
              hiện đại. Phác đồ cá thể hóa, theo dõi xuyên suốt và phối hợp đa chuyên khoa để tối ưu cơ hội có con.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Btn kind="primary" onClick={() => toiForm()}><CalendarCheck size={16} /> Đặt lịch khám hiếm muộn</Btn>
              <Btn kind="mint" onClick={() => document.getElementById("ivf-quy-trinh")?.scrollIntoView({ behavior: "smooth" })}><Info size={16} /> Tìm hiểu quy trình IVF</Btn>
              <a href={TEL(HOTLINE)} style={{ textDecoration: "none" }}><Btn kind="soft" type="button"><Phone size={16} /> Gọi tư vấn</Btn></a>
            </div>
          </div>
          <div role="img" aria-label="Hình minh họa labo IVF và bác sĩ tư vấn hiếm muộn"
            style={{ background: `linear-gradient(150deg, ${T.mint}, ${T.sky})`, borderRadius: 26, minHeight: 300, display: "grid", placeItems: "center", boxShadow: "0 28px 56px rgba(79,184,154,.26)", overflow: "hidden", position: "relative" }}>
            <FlaskConical size={104} color="rgba(255,255,255,.92)" aria-hidden="true" />
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 70% 25%, rgba(255,255,255,.22), transparent 55%)" }} />
          </div>
        </div>
      </section>

      {/* 4. Điểm nổi bật */}
      <section style={{ ...sectionWrap, padding: "44px 24px" }}>
        <SectionHead eyebrowText="Điểm nổi bật" tone={T.mint} soft={T.mintSoft} title="Điểm nổi bật của Trung tâm IVF" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 18, marginTop: 22 }}>
          {NOI_BAT.map((n) => (
            <div key={n.ten} style={{ display: "flex", gap: 14, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: "18px 20px" }}>
              <span style={{ width: 44, height: 44, borderRadius: 13, background: T.mintSoft, color: T.mint, display: "grid", placeItems: "center", flexShrink: 0 }}><n.icon size={21} aria-hidden="true" /></span>
              <div><div style={{ fontSize: 15.5, fontWeight: 800, color: T.ink, marginBottom: 4 }}>{n.ten}</div><div style={{ fontSize: 13.5, color: T.sub, lineHeight: 1.55 }}>{n.mo_ta}</div></div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. Giới thiệu khoa */}
      <section style={alt(1)}><div style={{ ...sectionWrap, padding: "44px 24px" }}>
        <SectionHead eyebrowText="Giới thiệu" tone={T.lav} soft={T.lavSoft} title="Giới thiệu khoa" />
        <div style={{ display: "grid", gap: 14, marginTop: 22, maxWidth: 900 }}>
          {[
            ["Chức năng và nhiệm vụ", "Khám, chẩn đoán và điều trị vô sinh hiếm muộn bằng các kỹ thuật hỗ trợ sinh sản."],
            ["Đối tượng tiếp nhận", "Các cặp vợ chồng hiếm muộn nguyên phát/thứ phát và người có nhu cầu bảo tồn khả năng sinh sản."],
            ["Kỹ thuật đang triển khai", "IUI, IVF, ICSI, nuôi cấy phôi nang, trữ lạnh noãn/tinh trùng/phôi, xét nghiệm di truyền phôi."],
            ["Phối hợp bác sĩ và labo", "Bác sĩ lâm sàng và chuyên viên phôi học phối hợp chặt chẽ theo quy trình chuẩn."],
            ["Định hướng chăm sóc", "Cá thể hóa phác đồ, đồng hành và hỗ trợ tâm lý cho người bệnh suốt hành trình điều trị."],
          ].map(([t, d]) => (
            <div key={t} style={{ display: "flex", gap: 12, alignItems: "flex-start", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: "14px 18px" }}>
              <CheckCircle2 size={18} color={T.mint} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
              <div><b style={{ color: T.ink, fontSize: 14.5 }}>{t}:</b> <span style={{ color: T.sub, fontSize: 14.5, lineHeight: 1.6 }}>{d}</span></div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16, fontSize: 13, color: T.sub, display: "flex", gap: 18, flexWrap: "wrap" }}>
          <span><b style={{ color: T.ink }}>Bác sĩ kiểm duyệt nội dung:</b> {bsKiemDuyet ? bsKiemDuyet.name : "Đang cập nhật"}</span>
          <span><b style={{ color: T.ink }}>Ngày cập nhật:</b> {NGAY_CAP_NHAT}</span>
        </div>
      </div></section>

      {/* 6. Đối tượng nên đến khám */}
      <section style={{ ...sectionWrap, padding: "44px 24px" }}>
        <SectionHead eyebrowText="Đối tượng" tone={T.peach} soft={T.peachSoft} title="Đối tượng nên đến khám" />
        <ChipGrid items={DOI_TUONG} tone={T.peach} />
      </section>

      {/* 7. Dịch vụ chính */}
      <section style={alt(1)}><div style={{ ...sectionWrap, padding: "44px 24px" }}>
        <SectionHead eyebrowText="Dịch vụ" tone={T.mint} soft={T.mintSoft} title="Các dịch vụ chính" />
        <ChipGrid items={DICH_VU} tone={T.mint} />
      </div></section>

      {/* 8. Quy trình khám hiếm muộn */}
      <section style={{ ...sectionWrap, padding: "44px 24px" }}>
        <SectionHead eyebrowText="Quy trình khám" tone={T.sky} soft={T.skySoft} title="Quy trình khám hiếm muộn" />
        <StepGrid steps={QT_KHAM} from={T.sky} to={T.mint} />
      </section>

      {/* 9. Quy trình IVF */}
      <section id="ivf-quy-trinh" style={alt(1)}><div style={{ ...sectionWrap, padding: "44px 24px" }}>
        <SectionHead eyebrowText="Quy trình IVF" tone={T.lav} soft={T.lavSoft} title="Quy trình thụ tinh trong ống nghiệm (IVF)" />
        <StepGrid steps={QT_IVF} from={T.lav} to={T.peach} />
      </div></section>

      {/* 10 & 11. Nguyên nhân hiếm muộn */}
      <section style={{ ...sectionWrap, padding: "44px 24px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 32 }}>
        <div><SectionHead eyebrowText="Nguyên nhân — Nữ" tone={T.peach} soft={T.peachSoft} title="Nguyên nhân hiếm muộn ở nữ" /><ChipGrid items={NN_NU} tone={T.peach} /></div>
        <div><SectionHead eyebrowText="Nguyên nhân — Nam" tone={T.sky} soft={T.skySoft} title="Nguyên nhân hiếm muộn ở nam" /><ChipGrid items={NN_NAM} tone={T.sky} /></div>
      </section>

      {/* 12. Hệ thống labo IVF */}
      <section style={alt(1)}><div style={{ ...sectionWrap, padding: "44px 24px" }}>
        <SectionHead eyebrowText="Labo IVF" tone={T.mint} soft={T.mintSoft} title="Hệ thống labo IVF" />
        <ChipGrid items={LABO} tone={T.mint} />
      </div></section>

      {/* 13. Kỹ thuật chuyên sâu */}
      <section style={{ ...sectionWrap, padding: "44px 24px" }}>
        <SectionHead eyebrowText="Kỹ thuật" tone={T.lav} soft={T.lavSoft} title="Các kỹ thuật chuyên sâu" />
        <ChipGrid items={KY_THUAT} tone={T.lav} />
      </section>

      {/* 14. Đội ngũ bác sĩ */}
      <section style={alt(1)}><div style={{ ...sectionWrap, padding: "44px 24px" }}>
        <SectionHead eyebrowText="Đội ngũ" tone={T.mint} soft={T.mintSoft} title="Đội ngũ bác sĩ" />
        {bacSiKhoa.length === 0
          ? <Card style={{ padding: 34, textAlign: "center", color: T.sub, marginTop: 22 }}>Đang cập nhật danh sách bác sĩ.</Card>
          : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, marginTop: 22 }}>
              {bacSiKhoa.map((b) => <DoctorCard key={b.id} b={b} onBook={toiForm} />)}
            </div>}
      </div></section>

      {/* 15. Chuyên viên phôi học — chưa có dữ liệu thật, để trạng thái cập nhật */}
      <section style={{ ...sectionWrap, padding: "44px 24px" }}>
        <SectionHead eyebrowText="Phôi học" tone={T.sky} soft={T.skySoft} title="Đội ngũ chuyên viên phôi học" />
        <Card style={{ padding: 26, marginTop: 22, display: "flex", gap: 14, alignItems: "flex-start" }}>
          <span style={{ width: 46, height: 46, borderRadius: 13, background: T.skySoft, color: T.sky, display: "grid", placeItems: "center", flexShrink: 0 }} aria-hidden="true"><FlaskConical size={22} /></span>
          <div style={{ fontSize: 14.5, color: T.sub, lineHeight: 1.7 }}>
            Đội ngũ chuyên viên phôi học phụ trách thao tác ICSI, nuôi cấy và đánh giá phôi, đông lạnh và lưu trữ mẫu trong
            labo. Thông tin chi tiết (trình độ đào tạo, chứng chỉ chuyên môn, vai trò, lĩnh vực phụ trách, kinh nghiệm) đang được cập nhật.
          </div>
        </Card>
      </section>

      {/* 16. Kết quả điều trị — KHÔNG bịa số liệu */}
      <section style={alt(1)}><div style={{ ...sectionWrap, padding: "44px 24px" }}>
        <SectionHead eyebrowText="Kết quả" tone={T.gold} soft={T.goldSoft} title="Kết quả điều trị" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 16, marginTop: 22 }}>
          {KET_QUA_MUC.map((t) => (
            <Card key={t} style={{ padding: 20, textAlign: "center" }}>
              <BarChart3 size={22} color={T.gold} aria-hidden="true" style={{ marginBottom: 8 }} />
              <div style={{ fontSize: 24, fontWeight: 800, color: T.ink }}>—</div>
              <div style={{ fontSize: 13, color: T.sub, marginTop: 4 }}>{t}</div>
            </Card>
          ))}
        </div>
        <div style={{ marginTop: 16, fontSize: 13, color: T.sub, lineHeight: 1.6, background: T.surface, border: `1px dashed ${T.line}`, borderRadius: 12, padding: "12px 16px" }}>
          <Info size={14} style={{ verticalAlign: -2 }} aria-hidden="true" /> Số liệu kết quả điều trị (phân tích theo nhóm tuổi, thời gian thống kê, số chu kỳ và cách tính) sẽ được công bố theo thống kê chính thức của trung tâm. Vui lòng liên hệ để được tư vấn cụ thể.
        </div>
      </div></section>

      {/* 17. Chi phí điều trị — KHÔNG bịa giá */}
      <section style={{ ...sectionWrap, padding: "44px 24px" }}>
        <SectionHead eyebrowText="Chi phí" tone={T.peach} soft={T.peachSoft} title="Chi phí điều trị" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 12, marginTop: 22 }}>
          {CHI_PHI_MUC.map((t) => (
            <div key={t} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 13, padding: "13px 15px" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 9, fontSize: 14, color: T.ink, fontWeight: 600 }}><Wallet size={16} color={T.peach} aria-hidden="true" /> {t}</span>
              <span style={{ fontSize: 12.5, color: T.sub, whiteSpace: "nowrap" }}>Liên hệ báo giá</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16, fontSize: 13, color: T.sub, lineHeight: 1.6, background: T.surface, border: `1px dashed ${T.line}`, borderRadius: 12, padding: "12px 16px" }}>
          <Info size={14} style={{ verticalAlign: -2 }} aria-hidden="true" /> Chi phí tham khảo, thay đổi theo phác đồ và tình trạng từng người bệnh. Các khoản đã/chưa bao gồm sẽ được tư vấn chi tiết khi khám — gọi hotline <a href={TEL(HOTLINE)} style={{ color: T.peach, fontWeight: 700, textDecoration: "none" }}>{HOTLINE}</a>.
        </div>
      </section>

      {/* 18. Câu chuyện người bệnh — KHÔNG bịa lời chứng thực */}
      <section style={alt(1)}><div style={{ ...sectionWrap, padding: "44px 24px" }}>
        <SectionHead eyebrowText="Câu chuyện" tone={T.lav} soft={T.lavSoft} title="Câu chuyện người bệnh" />
        <Card style={{ padding: 30, marginTop: 22, textAlign: "center", color: T.sub }}>
          <Heart size={30} color={T.lav} aria-hidden="true" style={{ marginBottom: 10 }} />
          <div style={{ fontSize: 14.5, lineHeight: 1.7, maxWidth: 620, margin: "0 auto" }}>
            Những câu chuyện và hành trình điều trị của các gia đình sẽ được chia sẻ tại đây khi có sự đồng ý của người bệnh — kèm phương pháp được chỉ định, kết quả và video (nếu có).
          </div>
        </Card>
      </div></section>

      {/* 19 & 20. Hướng dẫn */}
      <section style={{ ...sectionWrap, padding: "44px 24px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 32 }}>
        <div><SectionHead eyebrowText="Chuẩn bị" tone={T.sky} soft={T.skySoft} title="Hướng dẫn trước khi khám" /><ChipGrid items={HD_TRUOC} tone={T.sky} /></div>
        <div><SectionHead eyebrowText="Trong điều trị" tone={T.mint} soft={T.mintSoft} title="Hướng dẫn trong quá trình điều trị" /><ChipGrid items={HD_TRONG} tone={T.mint} /></div>
      </section>

      {/* 21. FAQ */}
      <section style={alt(1)}><div style={{ ...sectionWrap, maxWidth: 900, padding: "44px 24px" }}>
        <SectionHead eyebrowText="Hỏi & đáp" tone={T.gold} soft={T.goldSoft} title="Câu hỏi thường gặp" />
        <div style={{ display: "grid", gap: 12, marginTop: 22 }}>{FAQ.map((f, i) => <FaqItem key={i} item={f} id={i} />)}</div>
      </div></section>

      {/* 22. Bài viết kiến thức */}
      <section style={{ ...sectionWrap, padding: "44px 24px" }}>
        <SectionHead eyebrowText="Kiến thức IVF" tone={T.sky} soft={T.skySoft} title="Bài viết kiến thức IVF" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14, marginTop: 22 }}>
          {KIEN_THUC.map((t) => (
            <button key={t} onClick={() => onNav("tin-tuc")} style={{ textAlign: "left", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: "16px 18px", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ width: 38, height: 38, borderRadius: 11, background: T.skySoft, color: T.sky, display: "grid", placeItems: "center", flexShrink: 0 }} aria-hidden="true"><FileText size={18} /></span>
              <span style={{ fontSize: 14, fontWeight: 700, color: T.ink, lineHeight: 1.4, flex: 1 }}>{t}</span>
              <ChevronRight size={16} color={T.sub} aria-hidden="true" />
            </button>
          ))}
        </div>
      </section>

      {/* 23. Video chuyên môn — KHÔNG nhúng video giả */}
      <section style={alt(1)}><div style={{ ...sectionWrap, padding: "44px 24px" }}>
        <SectionHead eyebrowText="Video" tone={T.peach} soft={T.peachSoft} title="Video chuyên môn" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16, marginTop: 22 }}>
          {VIDEO.map((t) => (
            <div key={t} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, overflow: "hidden" }}>
              <div style={{ height: 120, background: `${T.peach}12`, display: "grid", placeItems: "center", position: "relative" }}>
                <PlayCircle size={38} color={T.peach} style={{ opacity: .7 }} aria-hidden="true" />
                <span style={{ position: "absolute", top: 8, right: 8, fontSize: 11, fontWeight: 800, color: T.sub, background: T.bg, borderRadius: 999, padding: "3px 9px" }}>Sắp có</span>
              </div>
              <div style={{ padding: "12px 14px", fontSize: 13.5, fontWeight: 700, color: T.ink, lineHeight: 1.4 }}>{t}</div>
            </div>
          ))}
        </div>
      </div></section>

      {/* 24. Form đặt lịch tư vấn IVF */}
      <section ref={formRef} style={{ background: `linear-gradient(180deg, ${T.surface}, ${T.bg})` }}>
        <div style={{ ...sectionWrap, maxWidth: 760, padding: "44px 24px" }}>
          <SectionHead eyebrowText="Đặt lịch" tone={T.mint} soft={T.mintSoft} title="Đặt lịch tư vấn IVF" />
          <p style={{ fontSize: 14.5, color: T.sub, lineHeight: 1.6, margin: "0 0 20px" }}>
            Điền thông tin rồi bấm <b>Gửi đăng ký</b> — hệ thống mở email soạn sẵn gửi tới Trung tâm IVF. Hoặc gọi hotline{" "}
            <a href={TEL(HOTLINE)} style={{ color: T.mint, fontWeight: 700, textDecoration: "none" }}>{HOTLINE}</a>.
          </p>
          {daGui && <div role="status" style={msgOk}>Đã mở ứng dụng email với thông tin đặt lịch. Nếu không thấy, vui lòng gọi hotline {HOTLINE}.</div>}
          {loi && <div role="alert" style={msgErr}>{loi}</div>}
          <Card style={{ padding: 26 }}>
            <form onSubmit={gui} noValidate>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 16 }}>
                <div><label htmlFor="ivf-hoten" style={lbl}>Họ và tên <span style={req}>*</span></label><input id="ivf-hoten" type="text" autoComplete="name" required value={form.ho_ten} onChange={set("ho_ten")} placeholder="Nguyễn Văn A" style={inp} /></div>
                <div><label htmlFor="ivf-sdt" style={lbl}>Số điện thoại <span style={req}>*</span></label><input id="ivf-sdt" type="tel" inputMode="tel" autoComplete="tel" required value={form.sdt} onChange={set("sdt")} placeholder="0912 345 678" style={inp} /></div>
                <div><label htmlFor="ivf-namsinh" style={lbl}>Năm sinh</label><input id="ivf-namsinh" type="number" inputMode="numeric" min="1900" max="2025" value={form.nam_sinh} onChange={set("nam_sinh")} placeholder="1990" style={inp} /></div>
                <div><label htmlFor="ivf-mongcon" style={lbl}>Thời gian mong con</label><input id="ivf-mongcon" type="text" value={form.mong_con} onChange={set("mong_con")} placeholder="VD: 2 năm" style={inp} /></div>
                <div><label htmlFor="ivf-dichvu" style={lbl}>Dịch vụ cần tư vấn</label>
                  <select id="ivf-dichvu" value={form.dich_vu} onChange={set("dich_vu")} style={inp}>
                    <option value="">— Chọn dịch vụ —</option>{DICH_VU.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select></div>
                <div><label htmlFor="ivf-bacsi" style={lbl}>Bác sĩ mong muốn</label>
                  <select id="ivf-bacsi" value={form.bac_si} onChange={set("bac_si")} style={inp}>
                    <option value="">— Không yêu cầu —</option>{bacSiKhoa.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
                  </select></div>
                <div><label htmlFor="ivf-ngay" style={lbl}>Ngày khám mong muốn</label><input id="ivf-ngay" type="date" value={form.ngay_kham} onChange={set("ngay_kham")} style={inp} /></div>
              </div>
              <div style={{ marginBottom: 16 }}><label htmlFor="ivf-noidung" style={lbl}>Nội dung cần hỗ trợ</label><textarea id="ivf-noidung" rows={4} value={form.noi_dung} onChange={set("noi_dung")} placeholder="Mô tả tình trạng hoặc câu hỏi của bạn…" style={{ ...inp, resize: "vertical" }} /></div>
              <label htmlFor="ivf-dongy" style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 20, cursor: "pointer", fontSize: 13.5, color: T.sub, lineHeight: 1.5 }}>
                <input id="ivf-dongy" type="checkbox" checked={form.dong_y} onChange={(e) => setForm((s) => ({ ...s, dong_y: e.target.checked }))} style={{ width: 17, height: 17, accentColor: T.mint, marginTop: 1, flexShrink: 0 }} />
                <span>Tôi đồng ý cho bệnh viện lưu trữ và sử dụng thông tin trên nhằm mục đích liên hệ tư vấn, đặt lịch (chính sách bảo mật).</span>
              </label>
              <Btn kind="primary" type="submit"><Send size={16} /> Gửi đăng ký</Btn>
            </form>
          </Card>
        </div>
      </section>

      {/* 25. Thông tin liên hệ + bản đồ */}
      <section style={{ ...sectionWrap, padding: "44px 24px" }}>
        <SectionHead eyebrowText="Liên hệ" tone={T.mint} soft={T.mintSoft} title="Thông tin liên hệ" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 22, marginTop: 22 }}>
          <div style={{ display: "grid", gap: 12 }}>
            {[[Building2, TEN_TT], [MapPin, DIA_CHI], [Clock, `Giờ làm việc: ${GIO}`], [Phone, `Hotline: ${HOTLINE}`], [Mail, `Email: ${EMAIL}`]].map(([Icon, t]) => (
              <div key={t} style={{ display: "flex", alignItems: "flex-start", gap: 11, fontSize: 14.5, color: T.sub }}>
                <Icon size={18} color={T.mint} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" /> <span>{t}</span>
              </div>
            ))}
            <div style={{ fontSize: 13.5, color: T.sub, lineHeight: 1.6, marginTop: 4 }}>
              <b style={{ color: T.ink }}>Hướng dẫn di chuyển:</b> Vào sảnh khu khám bệnh, lên tầng 4 khu B theo thang máy, Trung tâm IVF nằm cuối hành lang.
            </div>
            <div style={{ fontSize: 13.5, color: T.sub, lineHeight: 1.6 }}>
              <b style={{ color: T.ink }}>Đặt lịch:</b> qua hotline {HOTLINE} hoặc form đặt lịch phía trên.
            </div>
            <div><a href={MAP_LINK} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}><Btn kind="soft"><MapPin size={15} /> Chỉ đường trên Google Maps</Btn></a></div>
          </div>
          <div style={{ borderRadius: 16, overflow: "hidden", border: `1px solid ${T.line}`, minHeight: 260 }}>
            <iframe title="Bản đồ Trung tâm IVF – BV Phụ sản Hải Phòng" src={MAP_SRC} loading="lazy" referrerPolicy="no-referrer-when-downgrade" style={{ width: "100%", height: "100%", minHeight: 260, border: 0 }} />
          </div>
        </div>
      </section>

      {/* 26. CTA cố định mobile */}
      <div className="kp-mobile-cta" aria-label="Hành động nhanh">
        <a href={TEL(HOTLINE)} style={ctaItem(T.mint)}><Phone size={17} aria-hidden="true" /> Gọi tư vấn</a>
        <button onClick={() => toiForm()} style={{ ...ctaItem(T.peach), border: "none", cursor: "pointer", fontFamily: "inherit" }}><CalendarCheck size={17} aria-hidden="true" /> Đặt lịch IVF</button>
        <a href={`mailto:${EMAIL}?subject=${encodeURIComponent("Hỗ trợ tư vấn IVF")}`} style={ctaItem(T.lav)}><Mail size={17} aria-hidden="true" /> Nhắn hỗ trợ</a>
      </div>
    </div>
  );
}

// ---------- styles ----------
const qbarBtn = (bg) => ({ display: "inline-flex", alignItems: "center", gap: 6, background: bg, color: "#fff", border: "none", borderRadius: 999, padding: "6px 13px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" });
const crumb = { background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, color: T.sub, display: "inline-flex", alignItems: "center", gap: 5, padding: 0 };
const lbl = { display: "block", fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 6 };
const req = { color: "#C0392B" };
const inp = { width: "100%", boxSizing: "border-box", padding: "11px 13px", borderRadius: 12, border: `1.5px solid ${T.line}`, fontSize: 14.5, fontFamily: "inherit", outline: "none", background: T.surface, color: T.ink };
const msgOk = { background: T.mintSoft, color: "#2F8F73", fontSize: 14, padding: "12px 16px", borderRadius: 12, marginBottom: 16 };
const msgErr = { background: "#FDECEA", color: "#C0392B", fontSize: 14, padding: "12px 16px", borderRadius: 12, marginBottom: 16 };
const ctaItem = (color) => ({ flex: 1, display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "9px 4px", fontSize: 12, fontWeight: 800, color, textDecoration: "none", background: "none" });
