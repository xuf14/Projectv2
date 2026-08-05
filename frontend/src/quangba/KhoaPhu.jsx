import React, { useState, useRef, useEffect } from "react";
import {
  Phone, Clock, CalendarCheck, Siren, ChevronRight, Home as HomeIcon, Heart, Stethoscope,
  ShieldCheck, Users, Microscope, Activity, ScanLine, Scissors, ClipboardList, CheckCircle2,
  ChevronDown, MapPin, Mail, User, FileText, Send, Building2, HeartPulse,
} from "lucide-react";
import { T, Card, Btn, Pill, useNav } from "../shared";
import { sectionWrap, eyebrow, h2 } from "./ui";

// ============================================================================
//  TRANG CHI TIẾT KHOA PHỤ — mở khi bấm thẻ "Khoa Phụ" ở trang Khoa phòng.
//  Nội dung theo cấu trúc SEO: thanh thông tin nhanh, breadcrumb, hero, điểm
//  nổi bật, giới thiệu, dịch vụ, tầm soát ung thư, bệnh lý, khi nào đi khám,
//  quy trình, chẩn đoán, điều trị, đội ngũ bác sĩ, cơ sở vật chất, ưu điểm,
//  bài viết liên quan, FAQ, form đặt lịch, liên hệ + bản đồ, CTA cố định mobile.
//  Form đặt lịch mở email soạn sẵn (mailto) — hành vi thật, không lưu database.
//  Responsive + accessibility cơ bản (label/htmlFor, aria, alt).
// ============================================================================

const HOTLINE = "1900 1717";
const CAP_CUU = "115";
const EMAIL = "datlich@bvphusanhp.vn";
const GIO_LAM_VIEC = "7:00 – 17:00 (Thứ 2 – Chủ nhật)";
const DIA_CHI = "Khoa Phụ – Tầng 3, Nhà A, Số 19 Trần Quang Khải, Hồng Bàng, Hải Phòng";
const TEL = (s) => `tel:${s.replace(/\s/g, "")}`;
const MAP_SRC = `https://www.google.com/maps?q=${encodeURIComponent("19 Trần Quang Khải, Hồng Bàng, Hải Phòng")}&output=embed`;
const MAP_LINK = `https://www.google.com/maps/search/${encodeURIComponent("19 Trần Quang Khải, Hồng Bàng, Hải Phòng")}`;

const NOI_BAT = [
  { icon: Users, ten: "Đội ngũ bác sĩ chuyên khoa", mo_ta: "Bác sĩ chuyên khoa I, II trực tiếp thăm khám và tư vấn." },
  { icon: ShieldCheck, ten: "Quy trình khám riêng tư", mo_ta: "Không gian kín đáo, bảo mật thông tin người bệnh." },
  { icon: Stethoscope, ten: "Chẩn đoán & điều trị toàn diện", mo_ta: "Phối hợp lâm sàng, xét nghiệm và chẩn đoán hình ảnh." },
  { icon: ScanLine, ten: "Tầm soát ung thư phụ khoa", mo_ta: "Phát hiện sớm ung thư cổ tử cung, nội mạc, buồng trứng." },
  { icon: Scissors, ten: "Phẫu thuật nội soi", mo_ta: "Ít xâm lấn, hồi phục nhanh, thẩm mỹ tốt." },
  { icon: HeartPulse, ten: "Theo dõi sau điều trị", mo_ta: "Đồng hành và tái khám định kỳ sau điều trị." },
];

const DICH_VU = [
  "Khám phụ khoa tổng quát", "Khám phụ khoa định kỳ", "Điều trị viêm nhiễm phụ khoa",
  "Điều trị rối loạn kinh nguyệt", "Điều trị xuất huyết tử cung bất thường", "Điều trị u xơ tử cung",
  "Điều trị u nang buồng trứng", "Điều trị lạc nội mạc tử cung", "Điều trị sa sinh dục và bệnh lý sàn chậu",
  "Phẫu thuật phụ khoa", "Tư vấn sức khỏe tiền mãn kinh và mãn kinh",
];

const TAM_SOAT = [
  "Tầm soát ung thư cổ tử cung", "Xét nghiệm tế bào cổ tử cung (Pap)", "Xét nghiệm HPV", "Soi cổ tử cung",
  "Tầm soát ung thư nội mạc tử cung", "Đánh giá nguy cơ ung thư buồng trứng", "Tư vấn kết quả và kế hoạch theo dõi",
];

const BENH_LY = [
  "Viêm âm đạo", "Viêm cổ tử cung", "Viêm phần phụ", "U xơ tử cung", "Polyp cổ tử cung",
  "Polyp nội mạc tử cung", "U nang buồng trứng", "Lạc nội mạc tử cung", "Rong kinh, rong huyết",
  "Sa tử cung", "Tổn thương tiền ung thư cổ tử cung", "Ung thư phụ khoa",
];

const KHI_NAO = [
  "Đau bụng dưới hoặc đau vùng chậu", "Khí hư bất thường", "Ngứa hoặc rát vùng kín",
  "Rối loạn kinh nguyệt", "Chảy máu âm đạo bất thường", "Đau hoặc chảy máu sau quan hệ",
  "Đau khi quan hệ", "Tiểu buốt, tiểu khó", "Xuất hiện khối bất thường vùng bụng dưới",
  "Có nhu cầu khám và tầm soát định kỳ",
];

const QUY_TRINH = [
  { ten: "Đăng ký và tiếp nhận", mo_ta: "Đăng ký tại quầy lễ tân hoặc qua hotline, lập hồ sơ khám phụ khoa." },
  { ten: "Khai thác triệu chứng và tiền sử", mo_ta: "Bác sĩ hỏi bệnh sử, chu kỳ kinh, tiền sử phụ khoa và sản khoa." },
  { ten: "Khám lâm sàng", mo_ta: "Thăm khám phụ khoa trong phòng riêng tư, kín đáo." },
  { ten: "Siêu âm hoặc xét nghiệm", mo_ta: "Thực hiện cận lâm sàng cần thiết theo chỉ định." },
  { ten: "Nhận kết quả và chẩn đoán", mo_ta: "Bác sĩ đọc kết quả, đưa ra chẩn đoán xác định." },
  { ten: "Tư vấn phương pháp điều trị", mo_ta: "Thống nhất hướng điều trị phù hợp với người bệnh." },
  { ten: "Điều trị và hẹn tái khám", mo_ta: "Thực hiện điều trị, hướng dẫn và hẹn lịch theo dõi." },
];

const CHAN_DOAN = [
  "Khám phụ khoa", "Siêu âm phụ khoa", "Siêu âm đầu dò âm đạo", "Xét nghiệm dịch âm đạo",
  "Xét nghiệm HPV", "Xét nghiệm tế bào cổ tử cung", "Soi cổ tử cung", "Soi buồng tử cung",
  "Sinh thiết", "Giải phẫu bệnh",
];

const DIEU_TRI = [
  "Điều trị nội khoa", "Điều trị nội tiết", "Thủ thuật phụ khoa", "Đốt hoặc áp lạnh tổn thương cổ tử cung",
  "LEEP hoặc khoét chóp cổ tử cung", "Soi buồng tử cung can thiệp", "Phẫu thuật nội soi",
  "Phẫu thuật mở", "Điều trị và theo dõi sau phẫu thuật",
];

const CO_SO = [
  { icon: Stethoscope, ten: "Phòng khám phụ khoa" }, { icon: ScanLine, ten: "Phòng siêu âm" },
  { icon: Microscope, ten: "Hệ thống soi cổ tử cung" }, { icon: Activity, ten: "Hệ thống soi buồng tử cung" },
  { icon: ClipboardList, ten: "Phòng thủ thuật" }, { icon: Scissors, ten: "Phòng mổ nội soi" },
  { icon: HeartPulse, ten: "Khu chăm sóc sau phẫu thuật" },
];

const UU_DIEM = [
  "Khám riêng tư, bảo mật", "Quy trình rõ ràng", "Bác sĩ chuyên khoa trực tiếp tư vấn",
  "Phối hợp xét nghiệm và chẩn đoán hình ảnh", "Có khả năng điều trị nội khoa và phẫu thuật",
  "Theo dõi liên tục sau điều trị",
];

const BAI_VIET = [
  "Dấu hiệu viêm nhiễm phụ khoa", "Khi nào cần tầm soát ung thư cổ tử cung?",
  "U xơ tử cung có cần phẫu thuật không?", "U nang buồng trứng có nguy hiểm không?",
  "Chuẩn bị gì trước khi khám phụ khoa?", "Các dấu hiệu bất thường của kinh nguyệt",
];

const FAQ = [
  { hoi: "Khám phụ khoa gồm những gì?", dap: "Thường gồm hỏi bệnh sử, khám lâm sàng vùng bụng và cơ quan sinh dục, có thể kèm siêu âm và xét nghiệm dịch/tế bào cổ tử cung khi cần." },
  { hoi: "Khám phụ khoa có đau không?", dap: "Thăm khám thường chỉ gây khó chịu nhẹ. Bác sĩ sẽ thao tác nhẹ nhàng và giải thích trước từng bước để bạn an tâm." },
  { hoi: "Có cần nhịn ăn trước khi khám không?", dap: "Khám phụ khoa thông thường không cần nhịn ăn. Nếu có chỉ định xét nghiệm máu đặc biệt, bác sĩ sẽ dặn riêng." },
  { hoi: "Đang có kinh có khám được không?", dap: "Nên tránh khám và làm xét nghiệm tế bào cổ tử cung khi đang hành kinh. Thời điểm tốt nhất là sau sạch kinh 3–5 ngày." },
  { hoi: "Bao lâu nên khám phụ khoa một lần?", dap: "Phụ nữ đã có quan hệ tình dục nên khám và tầm soát định kỳ 6–12 tháng/lần, hoặc theo tư vấn của bác sĩ." },
  { hoi: "Bao lâu có kết quả tầm soát?", dap: "Kết quả tế bào cổ tử cung và HPV thường có sau vài ngày đến khoảng 1 tuần, tùy loại xét nghiệm." },
  { hoi: "Cần chuẩn bị gì trước khi khám?", dap: "Vệ sinh vùng kín sạch sẽ, tránh thụt rửa sâu và quan hệ 1–2 ngày trước khi khám; mang theo kết quả cũ nếu có." },
  { hoi: "Có cần đặt lịch trước không?", dap: `Bạn nên đặt lịch trước để được sắp xếp bác sĩ và giảm thời gian chờ. Gọi hotline ${HOTLINE} hoặc dùng form đặt lịch bên dưới.` },
];

// ---------- Khối phụ trợ ----------
function SectionHead({ eyebrowText, tone, soft, title }) {
  return (
    <>
      <span style={eyebrow(tone, soft)}>{eyebrowText}</span>
      <h2 style={h2}>{title}</h2>
    </>
  );
}

// Lưới danh sách gọn (chuỗi) — dùng cho dịch vụ, bệnh lý, chẩn đoán…
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

function FaqItem({ item, id }) {
  const [mo, setMo] = useState(false);
  const panelId = `kp-faq-panel-${id}`, btnId = `kp-faq-btn-${id}`;
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
  const [moHoSo, setMoHoSo] = useState(false);
  return (
    <Card style={{ padding: 22 }}>
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <span style={{ width: 60, height: 60, borderRadius: "50%", background: T.lavSoft, color: T.lav, display: "grid", placeItems: "center", flexShrink: 0 }} aria-hidden="true"><User size={28} /></span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.ink }}>{b.name}</div>
          {b.title && <div style={{ fontSize: 13, color: T.sub, marginTop: 3 }}>{b.title}</div>}
          {b.exp > 0 && <div style={{ marginTop: 7 }}><Pill tone={T.mint} soft={T.mintSoft}>{b.exp} năm kinh nghiệm</Pill></div>}
        </div>
      </div>
      {moHoSo && (
        <div style={{ marginTop: 14, fontSize: 13.5, color: T.sub, lineHeight: 1.6, background: T.bg, borderRadius: 11, padding: "12px 14px" }}>
          {b.hocHam ? `${b.hocHam} · ` : ""}Chuyên môn phụ khoa{b.title ? ` — ${b.title}` : ""}
          {b.exp > 0 ? `, ${b.exp} năm kinh nghiệm.` : "."}
          <div style={{ marginTop: 6 }}>Giờ khám: {GIO_LAM_VIEC}.</div>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
        <Btn kind="ghost" size="sm" onClick={() => setMoHoSo((v) => !v)}><FileText size={14} /> {moHoSo ? "Ẩn hồ sơ" : "Xem hồ sơ"}</Btn>
        <Btn kind="lav" size="sm" onClick={() => onBook(b.name)}><CalendarCheck size={14} /> Đặt lịch với bác sĩ</Btn>
      </div>
    </Card>
  );
}

// ============================================================================
export default function KhoaPhu({ onBack, onNav }) {
  const { doctors } = useNav();
  const bacSiKhoa = (Array.isArray(doctors) ? doctors : []).filter((d) => d.dept === "phu");
  const formRef = useRef(null);

  const [form, setForm] = useState({ ho_ten: "", sdt: "", nam_sinh: "", dich_vu: "", bac_si: "", ngay_kham: "", noi_dung: "", dong_y: false });
  const [loi, setLoi] = useState(null);
  const [daGui, setDaGui] = useState(false);
  const set = (k) => (e) => setForm((s) => ({ ...s, [k]: e.target.value }));

  useEffect(() => { document.title = "Khoa Phụ – Khám và điều trị bệnh lý phụ khoa | BV Phụ sản Hải Phòng"; }, []);

  const toiForm = (bacSi) => {
    if (bacSi) setForm((s) => ({ ...s, bac_si: bacSi }));
    formRef.current && formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const guiDatLich = (e) => {
    e.preventDefault();
    setLoi(null);
    const ten = form.ho_ten.trim(), sdt = form.sdt.trim();
    if (!ten) { setLoi("Vui lòng nhập họ và tên."); return; }
    if (!/^[0-9 +.()-]{8,15}$/.test(sdt)) { setLoi("Số điện thoại chưa hợp lệ (8–15 chữ số)."); return; }
    if (!form.dong_y) { setLoi("Vui lòng xác nhận đồng ý chính sách bảo mật."); return; }
    const body =
      `Họ và tên: ${ten}\n` +
      `Số điện thoại: ${sdt}\n` +
      `Năm sinh: ${form.nam_sinh || "(chưa cung cấp)"}\n` +
      `Dịch vụ cần khám: ${form.dich_vu || "(chưa chọn)"}\n` +
      `Bác sĩ mong muốn: ${form.bac_si || "(không yêu cầu)"}\n` +
      `Ngày khám mong muốn: ${form.ngay_kham || "(chưa chọn)"}\n` +
      `Nội dung cần tư vấn: ${form.noi_dung.trim() || "(không có)"}\n`;
    window.location.href = `mailto:${EMAIL}?subject=${encodeURIComponent("Đặt lịch khám Khoa Phụ")}&body=${encodeURIComponent(body)}`;
    setDaGui(true);
  };

  return (
    <div className="kp-page">
      {/* ---------- 1. Thanh thông tin nhanh ---------- */}
      <div style={{ background: T.ink, color: "#fff" }}>
        <div style={{ ...sectionWrap, display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap", padding: "10px 24px", fontSize: 13.5 }}>
          <a href={TEL(HOTLINE)} style={{ display: "inline-flex", alignItems: "center", gap: 7, color: "#fff", textDecoration: "none", fontWeight: 700 }}><Phone size={15} aria-hidden="true" /> Hotline {HOTLINE}</a>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, color: "rgba(255,255,255,.85)" }}><Clock size={15} aria-hidden="true" /> {GIO_LAM_VIEC}</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => toiForm()} style={qbarBtn(T.peach)}><CalendarCheck size={14} aria-hidden="true" /> Đặt lịch khám</button>
            <a href={TEL(CAP_CUU)} style={{ ...qbarBtn("#E24A4A"), textDecoration: "none" }}><Siren size={14} aria-hidden="true" /> Cấp cứu {CAP_CUU}</a>
          </div>
        </div>
      </div>

      {/* ---------- 2. Breadcrumb ---------- */}
      <nav aria-label="Breadcrumb" style={{ ...sectionWrap, padding: "16px 24px 0" }}>
        <ol style={{ listStyle: "none", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, margin: 0, padding: 0, fontSize: 13.5, color: T.sub }}>
          <li><button onClick={() => onNav("home")} style={crumb}><HomeIcon size={14} aria-hidden="true" /> Trang chủ</button></li>
          <li aria-hidden="true"><ChevronRight size={14} /></li>
          <li><button onClick={() => onBack()} style={crumb}>Chuyên khoa</button></li>
          <li aria-hidden="true"><ChevronRight size={14} /></li>
          <li aria-current="page" style={{ color: T.ink, fontWeight: 700 }}>Khoa Phụ</li>
        </ol>
      </nav>

      {/* ---------- 3. Hero ---------- */}
      <section style={{ ...sectionWrap, padding: "24px 24px 48px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))", gap: 36, alignItems: "center" }}>
          <div>
            <span style={eyebrow(T.lav, T.lavSoft)}>Chuyên khoa</span>
            <h1 style={{ fontSize: 40, fontWeight: 800, color: T.ink, lineHeight: 1.15, margin: "0 0 16px" }}>Khoa Phụ — Khám và điều trị bệnh lý phụ khoa</h1>
            <p style={{ fontSize: 16, color: T.sub, lineHeight: 1.7, margin: "0 0 24px", maxWidth: 560 }}>
              Khoa Phụ khám, chẩn đoán và điều trị toàn diện các bệnh lý phụ khoa cho phụ nữ mọi lứa tuổi — từ viêm
              nhiễm, rối loạn kinh nguyệt, u xơ – u nang đến tầm soát ung thư và phẫu thuật nội soi, trong quy trình
              riêng tư, bảo mật.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Btn kind="primary" onClick={() => toiForm()}><CalendarCheck size={16} /> Đặt lịch khám</Btn>
              <a href={TEL(HOTLINE)} style={{ textDecoration: "none" }}><Btn kind="soft" type="button"><Phone size={16} /> Gọi tư vấn</Btn></a>
            </div>
          </div>
          {/* Hình minh họa (không dùng ảnh ngoài) */}
          <div role="img" aria-label="Hình minh họa phòng khám Khoa Phụ"
            style={{ background: `linear-gradient(150deg, ${T.lav}, ${T.sky})`, borderRadius: 26, minHeight: 300, display: "grid", placeItems: "center", boxShadow: "0 28px 56px rgba(155,126,222,.26)", overflow: "hidden", position: "relative" }}>
            <Heart size={110} fill="rgba(255,255,255,.9)" color="rgba(255,255,255,.9)" aria-hidden="true" />
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 70% 25%, rgba(255,255,255,.22), transparent 55%)" }} />
          </div>
        </div>
      </section>

      {/* ---------- 4. Điểm nổi bật ---------- */}
      <section style={{ ...sectionWrap, padding: "44px 24px" }}>
        <SectionHead eyebrowText="Điểm nổi bật" tone={T.peach} soft={T.peachSoft} title="Điểm nổi bật của Khoa Phụ" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 18, marginTop: 22 }}>
          {NOI_BAT.map((n) => (
            <div key={n.ten} style={{ display: "flex", gap: 14, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: "18px 20px" }}>
              <span style={{ width: 44, height: 44, borderRadius: 13, background: T.lavSoft, color: T.lav, display: "grid", placeItems: "center", flexShrink: 0 }}><n.icon size={21} aria-hidden="true" /></span>
              <div>
                <div style={{ fontSize: 15.5, fontWeight: 800, color: T.ink, marginBottom: 4 }}>{n.ten}</div>
                <div style={{ fontSize: 13.5, color: T.sub, lineHeight: 1.55 }}>{n.mo_ta}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- 5. Giới thiệu chung ---------- */}
      <section style={{ background: `linear-gradient(180deg, ${T.surface}, ${T.bg})` }}>
        <div style={{ ...sectionWrap, padding: "44px 24px" }}>
          <SectionHead eyebrowText="Giới thiệu" tone={T.lav} soft={T.lavSoft} title="Giới thiệu chung" />
          <div style={{ display: "grid", gap: 14, marginTop: 22, maxWidth: 900 }}>
            {[
              ["Chức năng, nhiệm vụ", "Khám, chẩn đoán và điều trị các bệnh lý phụ khoa; tầm soát và phát hiện sớm ung thư phụ khoa."],
              ["Đối tượng tiếp nhận", "Phụ nữ mọi lứa tuổi có nhu cầu khám, điều trị bệnh phụ khoa hoặc khám sức khỏe định kỳ."],
              ["Phạm vi khám & điều trị", "Từ điều trị nội khoa, thủ thuật đến phẫu thuật nội soi và phẫu thuật mở."],
              ["Phối hợp chẩn đoán", "Kết hợp lâm sàng, siêu âm, nội soi, xét nghiệm tế bào – HPV và giải phẫu bệnh."],
              ["Cam kết chăm sóc", "Riêng tư, bảo mật, tận tâm và theo dõi liên tục sau điều trị."],
            ].map(([t, d]) => (
              <div key={t} style={{ display: "flex", gap: 12, alignItems: "flex-start", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: "14px 18px" }}>
                <CheckCircle2 size={18} color={T.mint} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
                <div><b style={{ color: T.ink, fontSize: 14.5 }}>{t}:</b> <span style={{ color: T.sub, fontSize: 14.5, lineHeight: 1.6 }}>{d}</span></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- 6. Dịch vụ chính ---------- */}
      <section style={{ ...sectionWrap, padding: "44px 24px" }}>
        <SectionHead eyebrowText="Dịch vụ" tone={T.peach} soft={T.peachSoft} title="Các dịch vụ chính" />
        <ChipGrid items={DICH_VU} tone={T.peach} />
      </section>

      {/* ---------- 7. Tầm soát ung thư ---------- */}
      <section style={{ background: `linear-gradient(180deg, ${T.surface}, ${T.bg})` }}>
        <div style={{ ...sectionWrap, padding: "44px 24px" }}>
          <SectionHead eyebrowText="Tầm soát" tone={T.mint} soft={T.mintSoft} title="Tầm soát ung thư phụ khoa" />
          <ChipGrid items={TAM_SOAT} tone={T.mint} />
        </div>
      </section>

      {/* ---------- 8. Bệnh lý thường gặp ---------- */}
      <section style={{ ...sectionWrap, padding: "44px 24px" }}>
        <SectionHead eyebrowText="Bệnh lý" tone={T.lav} soft={T.lavSoft} title="Các bệnh lý thường gặp" />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 22 }}>
          {BENH_LY.map((t) => (
            <span key={t} style={{ background: T.lavSoft, color: T.lav, fontWeight: 700, fontSize: 13.5, padding: "9px 15px", borderRadius: 999 }}>{t}</span>
          ))}
        </div>
      </section>

      {/* ---------- 9. Khi nào nên đi khám ---------- */}
      <section style={{ background: `linear-gradient(180deg, ${T.surface}, ${T.bg})` }}>
        <div style={{ ...sectionWrap, padding: "44px 24px" }}>
          <SectionHead eyebrowText="Dấu hiệu" tone={T.gold} soft={T.goldSoft} title="Khi nào nên đi khám phụ khoa?" />
          <ChipGrid items={KHI_NAO} tone={T.gold} />
        </div>
      </section>

      {/* ---------- 10. Quy trình khám ---------- */}
      <section style={{ ...sectionWrap, padding: "44px 24px" }}>
        <SectionHead eyebrowText="Quy trình" tone={T.sky} soft={T.skySoft} title="Quy trình khám tại Khoa Phụ" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 18, marginTop: 22 }}>
          {QUY_TRINH.map((b, i) => (
            <Card key={b.ten} style={{ padding: 22 }}>
              <span style={{ width: 38, height: 38, borderRadius: 11, background: `linear-gradient(135deg, ${T.lav}, ${T.sky})`, color: "#fff", display: "grid", placeItems: "center", fontWeight: 800, marginBottom: 12 }}>{i + 1}</span>
              <div style={{ fontSize: 15.5, fontWeight: 800, color: T.ink, marginBottom: 6 }}>{b.ten}</div>
              <div style={{ fontSize: 13.5, color: T.sub, lineHeight: 1.55 }}>{b.mo_ta}</div>
            </Card>
          ))}
        </div>
      </section>

      {/* ---------- 11 & 12. Chẩn đoán + Điều trị ---------- */}
      <section style={{ background: `linear-gradient(180deg, ${T.surface}, ${T.bg})` }}>
        <div style={{ ...sectionWrap, padding: "44px 24px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 32 }}>
          <div>
            <SectionHead eyebrowText="Chẩn đoán" tone={T.sky} soft={T.skySoft} title="Phương pháp chẩn đoán" />
            <ChipGrid items={CHAN_DOAN} tone={T.sky} />
          </div>
          <div>
            <SectionHead eyebrowText="Điều trị" tone={T.peach} soft={T.peachSoft} title="Phương pháp điều trị" />
            <ChipGrid items={DIEU_TRI} tone={T.peach} />
          </div>
        </div>
      </section>

      {/* ---------- 13. Đội ngũ bác sĩ ---------- */}
      <section style={{ ...sectionWrap, padding: "44px 24px" }}>
        <SectionHead eyebrowText="Đội ngũ" tone={T.lav} soft={T.lavSoft} title="Đội ngũ bác sĩ Khoa Phụ" />
        {bacSiKhoa.length === 0 ? (
          <Card style={{ padding: 34, textAlign: "center", color: T.sub, marginTop: 22 }}>Đang cập nhật danh sách bác sĩ.</Card>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, marginTop: 22 }}>
            {bacSiKhoa.map((b) => <DoctorCard key={b.id} b={b} onBook={toiForm} />)}
          </div>
        )}
      </section>

      {/* ---------- 14. Cơ sở vật chất ---------- */}
      <section style={{ background: `linear-gradient(180deg, ${T.surface}, ${T.bg})` }}>
        <div style={{ ...sectionWrap, padding: "44px 24px" }}>
          <SectionHead eyebrowText="Cơ sở vật chất" tone={T.mint} soft={T.mintSoft} title="Cơ sở vật chất và trang thiết bị" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginTop: 22 }}>
            {CO_SO.map((c) => (
              <div key={c.ten} style={{ display: "flex", alignItems: "center", gap: 12, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: "16px 18px" }}>
                <span style={{ width: 42, height: 42, borderRadius: 12, background: T.mintSoft, color: T.mint, display: "grid", placeItems: "center", flexShrink: 0 }}><c.icon size={20} aria-hidden="true" /></span>
                <span style={{ fontSize: 14.5, fontWeight: 700, color: T.ink }}>{c.ten}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- 15. Ưu điểm ---------- */}
      <section style={{ ...sectionWrap, padding: "44px 24px" }}>
        <SectionHead eyebrowText="Ưu điểm" tone={T.gold} soft={T.goldSoft} title="Ưu điểm khi khám tại Khoa Phụ" />
        <ChipGrid items={UU_DIEM} tone={T.gold} />
      </section>

      {/* ---------- 16. Bài viết liên quan ---------- */}
      <section style={{ background: `linear-gradient(180deg, ${T.surface}, ${T.bg})` }}>
        <div style={{ ...sectionWrap, padding: "44px 24px" }}>
          <SectionHead eyebrowText="Chuyên môn" tone={T.sky} soft={T.skySoft} title="Bài viết chuyên môn liên quan" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16, marginTop: 22 }}>
            {BAI_VIET.map((t) => (
              <button key={t} onClick={() => onNav("tin-tuc")} style={{ textAlign: "left", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: "18px 20px", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ width: 40, height: 40, borderRadius: 11, background: T.skySoft, color: T.sky, display: "grid", placeItems: "center", flexShrink: 0 }} aria-hidden="true"><FileText size={19} /></span>
                <span style={{ fontSize: 14.5, fontWeight: 700, color: T.ink, lineHeight: 1.4, flex: 1 }}>{t}</span>
                <ChevronRight size={16} color={T.sub} aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- 17. FAQ ---------- */}
      <section style={{ ...sectionWrap, maxWidth: 900, padding: "44px 24px" }}>
        <SectionHead eyebrowText="Hỏi & đáp" tone={T.gold} soft={T.goldSoft} title="Câu hỏi thường gặp" />
        <div style={{ display: "grid", gap: 12, marginTop: 22 }}>
          {FAQ.map((f, i) => <FaqItem key={i} item={f} id={i} />)}
        </div>
      </section>

      {/* ---------- 18. Form đặt lịch khám ---------- */}
      <section ref={formRef} style={{ background: `linear-gradient(180deg, ${T.surface}, ${T.bg})` }}>
        <div style={{ ...sectionWrap, maxWidth: 760, padding: "44px 24px" }}>
          <SectionHead eyebrowText="Đặt lịch khám" tone={T.peach} soft={T.peachSoft} title="Đăng ký đặt lịch khám Khoa Phụ" />
          <p style={{ fontSize: 14.5, color: T.sub, lineHeight: 1.6, margin: "0 0 20px" }}>
            Điền thông tin rồi bấm <b>Gửi đăng ký</b> — hệ thống mở email soạn sẵn gửi tới Khoa Phụ. Hoặc gọi hotline{" "}
            <a href={TEL(HOTLINE)} style={{ color: T.peach, fontWeight: 700, textDecoration: "none" }}>{HOTLINE}</a>.
          </p>

          {daGui && <div role="status" style={msgOk}>Đã mở ứng dụng email với thông tin đặt lịch. Nếu không thấy, vui lòng gọi hotline {HOTLINE}.</div>}
          {loi && <div role="alert" style={msgErr}>{loi}</div>}

          <Card style={{ padding: 26 }}>
            <form onSubmit={guiDatLich} noValidate>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 16 }}>
                <div>
                  <label htmlFor="kp-hoten" style={lbl}>Họ và tên <span style={req}>*</span></label>
                  <input id="kp-hoten" type="text" autoComplete="name" required value={form.ho_ten} onChange={set("ho_ten")} placeholder="Nguyễn Thị An" style={inp} />
                </div>
                <div>
                  <label htmlFor="kp-sdt" style={lbl}>Số điện thoại <span style={req}>*</span></label>
                  <input id="kp-sdt" type="tel" inputMode="tel" autoComplete="tel" required value={form.sdt} onChange={set("sdt")} placeholder="0912 345 678" style={inp} />
                </div>
                <div>
                  <label htmlFor="kp-namsinh" style={lbl}>Năm sinh</label>
                  <input id="kp-namsinh" type="number" inputMode="numeric" min="1900" max="2025" value={form.nam_sinh} onChange={set("nam_sinh")} placeholder="1995" style={inp} />
                </div>
                <div>
                  <label htmlFor="kp-dichvu" style={lbl}>Dịch vụ cần khám</label>
                  <select id="kp-dichvu" value={form.dich_vu} onChange={set("dich_vu")} style={inp}>
                    <option value="">— Chọn dịch vụ —</option>
                    {DICH_VU.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="kp-bacsi" style={lbl}>Bác sĩ mong muốn</label>
                  <select id="kp-bacsi" value={form.bac_si} onChange={set("bac_si")} style={inp}>
                    <option value="">— Không yêu cầu —</option>
                    {bacSiKhoa.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="kp-ngay" style={lbl}>Ngày khám mong muốn</label>
                  <input id="kp-ngay" type="date" value={form.ngay_kham} onChange={set("ngay_kham")} style={inp} />
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label htmlFor="kp-noidung" style={lbl}>Nội dung cần tư vấn</label>
                <textarea id="kp-noidung" rows={4} value={form.noi_dung} onChange={set("noi_dung")} placeholder="Mô tả triệu chứng hoặc nhu cầu khám…" style={{ ...inp, resize: "vertical" }} />
              </div>
              <label htmlFor="kp-dongy" style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 20, cursor: "pointer", fontSize: 13.5, color: T.sub, lineHeight: 1.5 }}>
                <input id="kp-dongy" type="checkbox" checked={form.dong_y} onChange={(e) => setForm((s) => ({ ...s, dong_y: e.target.checked }))} style={{ width: 17, height: 17, accentColor: T.peach, marginTop: 1, flexShrink: 0 }} />
                <span>Tôi đồng ý cho bệnh viện lưu trữ và sử dụng thông tin trên nhằm mục đích liên hệ đặt lịch khám (chính sách bảo mật).</span>
              </label>
              <Btn kind="primary" type="submit"><Send size={16} /> Gửi đăng ký</Btn>
            </form>
          </Card>
        </div>
      </section>

      {/* ---------- 19. Thông tin liên hệ + bản đồ ---------- */}
      <section style={{ ...sectionWrap, padding: "44px 24px" }}>
        <SectionHead eyebrowText="Liên hệ" tone={T.peach} soft={T.peachSoft} title="Thông tin liên hệ" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 22, marginTop: 22 }}>
          <div style={{ display: "grid", gap: 12 }}>
            {[
              [MapPin, DIA_CHI],
              [Building2, "Tầng 3, Nhà A — Khu khám bệnh"],
              [Clock, `Giờ khám: ${GIO_LAM_VIEC}`],
              [Phone, `Hotline: ${HOTLINE}`],
              [Mail, `Email: ${EMAIL}`],
            ].map(([Icon, t]) => (
              <div key={t} style={{ display: "flex", alignItems: "flex-start", gap: 11, fontSize: 14.5, color: T.sub }}>
                <Icon size={18} color={T.peach} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" /> <span>{t}</span>
              </div>
            ))}
            <div style={{ fontSize: 13.5, color: T.sub, lineHeight: 1.6, marginTop: 4 }}>
              <b style={{ color: T.ink }}>Hướng dẫn di chuyển:</b> Vào sảnh chính khu khám bệnh, lên tầng 3 theo thang máy khu A, Khoa Phụ nằm bên phải hành lang.
            </div>
            <div><a href={MAP_LINK} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}><Btn kind="soft"><MapPin size={15} /> Chỉ đường trên Google Maps</Btn></a></div>
          </div>
          <div style={{ borderRadius: 16, overflow: "hidden", border: `1px solid ${T.line}`, minHeight: 260 }}>
            <iframe title="Bản đồ Khoa Phụ – BV Phụ sản Hải Phòng" src={MAP_SRC} loading="lazy" referrerPolicy="no-referrer-when-downgrade"
              style={{ width: "100%", height: "100%", minHeight: 260, border: 0 }} />
          </div>
        </div>
      </section>

      {/* ---------- 20. CTA cố định trên mobile ---------- */}
      <div className="kp-mobile-cta" aria-label="Hành động nhanh">
        <a href={TEL(HOTLINE)} style={ctaItem(T.mint)}><Phone size={17} aria-hidden="true" /> Gọi ngay</a>
        <button onClick={() => toiForm()} style={{ ...ctaItem(T.peach), border: "none", cursor: "pointer", fontFamily: "inherit" }}><CalendarCheck size={17} aria-hidden="true" /> Đặt lịch</button>
        <a href={`mailto:${EMAIL}?subject=${encodeURIComponent("Tư vấn Khoa Phụ")}`} style={ctaItem(T.lav)}><Mail size={17} aria-hidden="true" /> Nhắn tư vấn</a>
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
