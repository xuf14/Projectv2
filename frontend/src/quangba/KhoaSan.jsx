import React, { useState } from "react";
import {
  ArrowLeft, Phone, Baby, Activity, Stethoscope, Syringe, HeartPulse,
  CheckCircle2, ChevronDown, ChevronRight, Clock, ShieldCheck, Star, Award,
  ClipboardCheck, Send, User,
} from "lucide-react";
import { T, Card, Btn, Pill, useNav } from "../shared";
import { sectionWrap, eyebrow, h2 } from "./ui";

// ============================================================================
//  TRANG CHI TIẾT KHOA SẢN — mở khi bấm thẻ "Khoa Sản" ở trang Khoa phòng.
//  Gồm: giới thiệu, hotline 24/7, 4 nhóm dịch vụ, quy trình 4 bước, điểm nổi
//  bật, danh sách bác sĩ (từ Nav context), câu hỏi thường gặp và form đăng ký
//  tư vấn (mở email/điện thoại — không lưu database, hành vi thật).
//  Responsive (lưới auto-fit) + accessibility cơ bản (label/htmlFor, alt, aria).
// ============================================================================

const HOTLINE = "1900 1717";
const EMAIL_TU_VAN = "sankhoa@bvphusanhp.vn";
const TEL_HREF = `tel:${HOTLINE.replace(/\s/g, "")}`;

const DICH_VU = [
  { icon: Activity, tone: T.peach, soft: T.peachSoft, ten: "Theo dõi thai kỳ", mo_ta: "Khám thai định kỳ, siêu âm, sàng lọc dị tật và quản lý thai nghén nguy cơ cao." },
  { icon: Baby, tone: T.mint, soft: T.mintSoft, ten: "Sinh thường", mo_ta: "Đỡ đẻ an toàn, giảm đau trong chuyển dạ, da kề da và hỗ trợ nuôi con bằng sữa mẹ." },
  { icon: Syringe, tone: T.lav, soft: T.lavSoft, ten: "Sinh mổ", mo_ta: "Phẫu thuật lấy thai theo chỉ định, gây tê/gây mê an toàn, chăm sóc hậu phẫu chu đáo." },
  { icon: HeartPulse, tone: T.sky, soft: T.skySoft, ten: "Chăm sóc sau sinh", mo_ta: "Theo dõi sản phụ và trẻ sau sinh, hướng dẫn chăm sóc, tái khám và tư vấn dinh dưỡng." },
];

const QUY_TRINH = [
  { ten: "Tiếp đón & đăng ký", mo_ta: "Đăng ký khám tại quầy lễ tân hoặc qua hotline, lập hồ sơ sản khoa." },
  { ten: "Thăm khám & chỉ định", mo_ta: "Bác sĩ khám, đo sinh hiệu và chỉ định cận lâm sàng cần thiết." },
  { ten: "Thực hiện dịch vụ", mo_ta: "Theo dõi thai kỳ, đỡ sinh hoặc phẫu thuật theo phác đồ đã thống nhất." },
  { ten: "Chăm sóc & tái khám", mo_ta: "Chăm sóc sau sinh, hướng dẫn tại nhà và hẹn lịch tái khám." },
];

const NOI_BAT = [
  { icon: Award, ten: "Đội ngũ giàu kinh nghiệm", mo_ta: "Bác sĩ chuyên khoa I, II trực tiếp theo dõi và xử trí." },
  { icon: ShieldCheck, ten: "An toàn mẹ & bé", mo_ta: "Quy trình chuẩn hóa, kiểm soát nhiễm khuẩn nghiêm ngặt." },
  { icon: Clock, ten: "Trực cấp cứu 24/7", mo_ta: "Sẵn sàng tiếp nhận sản khoa mọi khung giờ." },
  { icon: Star, ten: "Chăm sóc tận tâm", mo_ta: "Đồng hành cùng gia đình suốt thai kỳ đến sau sinh." },
];

const FAQ = [
  { hoi: "Khi nào nên đến khám thai lần đầu?", dap: "Nên khám thai lần đầu ngay khi trễ kinh 1–2 tuần hoặc thử thai dương tính, để xác định tuổi thai và tư vấn lịch khám định kỳ." },
  { hoi: "Khoa có nhận đỡ sinh vào ban đêm và ngày lễ không?", dap: `Có. Khoa Sản trực cấp cứu sản khoa 24/7, kể cả ban đêm, cuối tuần và ngày lễ. Gọi hotline ${HOTLINE} để được hướng dẫn.` },
  { hoi: "Cần chuẩn bị giấy tờ gì khi nhập viện sinh?", dap: "Mang theo CCCD/CMND, thẻ BHYT (nếu có), sổ khám thai và các kết quả xét nghiệm gần nhất." },
  { hoi: "Sản phụ được lưu viện bao lâu sau sinh?", dap: "Thông thường 1–2 ngày với sinh thường và 3–4 ngày với sinh mổ, tùy tình trạng hồi phục của mẹ và bé." },
];

// Một câu hỏi FAQ (accordion) — nút có aria-expanded để hỗ trợ trình đọc màn hình
function FaqItem({ item, id }) {
  const [mo, setMo] = useState(false);
  const panelId = `faq-panel-${id}`;
  const btnId = `faq-btn-${id}`;
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

export default function KhoaSan({ onBack }) {
  const { doctors } = useNav();
  const bacSiKhoa = (Array.isArray(doctors) ? doctors : []).filter((d) => d.dept === "san");

  const [form, setForm] = useState({ ho_ten: "", sdt: "", noi_dung: "" });
  const [loi, setLoi] = useState(null);
  const [daGui, setDaGui] = useState(false);
  const set = (k) => (e) => setForm((s) => ({ ...s, [k]: e.target.value }));

  const guiTuVan = (e) => {
    e.preventDefault();
    setLoi(null);
    const ten = form.ho_ten.trim();
    const sdt = form.sdt.trim();
    if (!ten) { setLoi("Vui lòng nhập họ và tên."); return; }
    if (!/^[0-9 +.()-]{8,15}$/.test(sdt)) { setLoi("Số điện thoại chưa hợp lệ (8–15 chữ số)."); return; }
    // Hành vi thật: mở ứng dụng email với nội dung đã điền (không lưu database)
    const body =
      `Họ và tên: ${ten}\n` +
      `Số điện thoại: ${sdt}\n` +
      `Nội dung cần tư vấn: ${form.noi_dung.trim() || "(không có)"}\n`;
    const href = `mailto:${EMAIL_TU_VAN}?subject=${encodeURIComponent("Đăng ký tư vấn Khoa Sản")}&body=${encodeURIComponent(body)}`;
    window.location.href = href;
    setDaGui(true);
  };

  return (
    <div>
      {/* ---------- Hero + hotline ---------- */}
      <section style={{ position: "relative", overflow: "hidden", background: `linear-gradient(180deg, ${T.peachSoft}, ${T.bg})` }}>
        <div style={{ ...sectionWrap, padding: "28px 24px 52px" }}>
          <Btn kind="ghost" onClick={() => onBack()} style={{ marginBottom: 18 }}><ArrowLeft size={16} /> Quay lại khoa phòng</Btn>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 32, alignItems: "center" }}>
            <div>
              <span style={eyebrow(T.peach, "#fff")}>Chuyên khoa</span>
              <h1 style={{ fontSize: 42, fontWeight: 800, color: T.ink, lineHeight: 1.15, margin: "0 0 16px" }}>Khoa Sản</h1>
              <p style={{ fontSize: 16, color: T.sub, lineHeight: 1.7, margin: 0, maxWidth: 560 }}>
                Khoa Sản đồng hành cùng mẹ và bé trong suốt hành trình mang thai, sinh nở và sau sinh — từ theo dõi
                thai kỳ, đỡ sinh thường, phẫu thuật lấy thai đến chăm sóc hậu sản, với đội ngũ bác sĩ tận tâm và
                quy trình an toàn, chuẩn hóa.
              </p>
            </div>
            {/* Thẻ hotline 24/7 */}
            <Card style={{ padding: 26, display: "flex", alignItems: "center", gap: 18 }}>
              <span style={{ width: 60, height: 60, borderRadius: 18, background: T.peachSoft, color: T.peach, display: "grid", placeItems: "center", flexShrink: 0 }}>
                <Phone size={28} aria-hidden="true" />
              </span>
              <div style={{ lineHeight: 1.25 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: .6 }}>Hotline tiếp nhận sản khoa</div>
                <a href={TEL_HREF} style={{ fontSize: 30, fontWeight: 800, color: T.ink, textDecoration: "none", display: "inline-block", margin: "2px 0" }}>{HOTLINE}</a>
                <div style={{ fontSize: 13.5, color: T.mint, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}><Clock size={14} aria-hidden="true" /> Trực cấp cứu 24/7</div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* ---------- Bốn nhóm dịch vụ ---------- */}
      <section style={{ padding: "52px 0" }}>
        <div style={sectionWrap}>
          <span style={eyebrow(T.peach, T.peachSoft)}>Dịch vụ</span>
          <h2 style={h2}>Bốn nhóm dịch vụ chính</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 20, marginTop: 24 }}>
            {DICH_VU.map((s) => (
              <Card key={s.ten} style={{ padding: 24 }}>
                <span style={{ width: 52, height: 52, borderRadius: 15, background: s.soft, color: s.tone, display: "grid", placeItems: "center", marginBottom: 14 }}><s.icon size={24} aria-hidden="true" /></span>
                <div style={{ fontSize: 17, fontWeight: 800, color: T.ink, marginBottom: 8 }}>{s.ten}</div>
                <div style={{ fontSize: 14, color: T.sub, lineHeight: 1.6 }}>{s.mo_ta}</div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Quy trình người bệnh (4 bước) ---------- */}
      <section style={{ padding: "52px 0", background: `linear-gradient(180deg, ${T.surface}, ${T.bg})` }}>
        <div style={sectionWrap}>
          <span style={eyebrow(T.lav, T.lavSoft)}>Quy trình</span>
          <h2 style={h2}>Quy trình người bệnh gồm 4 bước</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 20, marginTop: 24 }}>
            {QUY_TRINH.map((b, i) => (
              <Card key={b.ten} style={{ padding: 24, position: "relative" }}>
                <span style={{ width: 40, height: 40, borderRadius: 12, background: `linear-gradient(135deg, ${T.peach}, ${T.lav})`, color: "#fff", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 17, marginBottom: 14 }}>{i + 1}</span>
                <div style={{ fontSize: 16, fontWeight: 800, color: T.ink, marginBottom: 6 }}>{b.ten}</div>
                <div style={{ fontSize: 13.5, color: T.sub, lineHeight: 1.6 }}>{b.mo_ta}</div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Điểm nổi bật ---------- */}
      <section style={{ padding: "52px 0" }}>
        <div style={sectionWrap}>
          <span style={eyebrow(T.mint, T.mintSoft)}>Điểm nổi bật</span>
          <h2 style={h2}>Vì sao chọn Khoa Sản</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 18, marginTop: 24 }}>
            {NOI_BAT.map((n) => (
              <div key={n.ten} style={{ display: "flex", gap: 14, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: "18px 20px" }}>
                <span style={{ width: 44, height: 44, borderRadius: 13, background: T.peachSoft, color: T.peach, display: "grid", placeItems: "center", flexShrink: 0 }}><n.icon size={21} aria-hidden="true" /></span>
                <div>
                  <div style={{ fontSize: 15.5, fontWeight: 800, color: T.ink, marginBottom: 4 }}>{n.ten}</div>
                  <div style={{ fontSize: 13.5, color: T.sub, lineHeight: 1.55 }}>{n.mo_ta}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Danh sách bác sĩ ---------- */}
      <section style={{ padding: "52px 0", background: `linear-gradient(180deg, ${T.surface}, ${T.bg})` }}>
        <div style={sectionWrap}>
          <span style={eyebrow(T.sky, T.skySoft)}>Đội ngũ</span>
          <h2 style={h2}>Bác sĩ Khoa Sản</h2>
          {bacSiKhoa.length === 0 ? (
            <Card style={{ padding: 34, textAlign: "center", color: T.sub, marginTop: 20 }}>Đang cập nhật danh sách bác sĩ.</Card>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 20, marginTop: 24 }}>
              {bacSiKhoa.map((b) => (
                <Card key={b.id} style={{ padding: 22, display: "flex", gap: 14, alignItems: "center" }}>
                  <span style={{ width: 56, height: 56, borderRadius: "50%", background: T.peachSoft, color: T.peach, display: "grid", placeItems: "center", flexShrink: 0 }}><User size={26} aria-hidden="true" /></span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 15.5, fontWeight: 800, color: T.ink }}>{b.name}</div>
                    {b.title && <div style={{ fontSize: 13, color: T.sub, marginTop: 3 }}>{b.title}</div>}
                    {b.exp > 0 && <div style={{ marginTop: 7 }}><Pill tone={T.mint} soft={T.mintSoft}>{b.exp} năm kinh nghiệm</Pill></div>}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ---------- Câu hỏi thường gặp ---------- */}
      <section style={{ padding: "52px 0" }}>
        <div style={{ ...sectionWrap, maxWidth: 860 }}>
          <span style={eyebrow(T.gold, T.goldSoft)}>Hỏi & đáp</span>
          <h2 style={h2}>Câu hỏi thường gặp</h2>
          <div style={{ display: "grid", gap: 12, marginTop: 24 }}>
            {FAQ.map((f, i) => <FaqItem key={i} item={f} id={i} />)}
          </div>
        </div>
      </section>

      {/* ---------- Form đăng ký tư vấn ---------- */}
      <section style={{ padding: "20px 0 70px" }}>
        <div style={{ ...sectionWrap, maxWidth: 720 }}>
          <Card style={{ padding: 30 }}>
            <span style={eyebrow(T.peach, T.peachSoft)}>Đăng ký tư vấn</span>
            <h2 style={{ ...h2, fontSize: 28 }}>Để lại thông tin, chúng tôi sẽ liên hệ lại</h2>
            <p style={{ fontSize: 14.5, color: T.sub, lineHeight: 1.6, margin: "0 0 22px" }}>
              Điền thông tin bên dưới rồi bấm <b>Gửi đăng ký</b> — hệ thống sẽ mở email soạn sẵn để gửi tới Khoa Sản.
              Hoặc gọi ngay hotline <a href={TEL_HREF} style={{ color: T.peach, fontWeight: 700, textDecoration: "none" }}>{HOTLINE}</a> (24/7).
            </p>

            {daGui && (
              <div role="status" style={{ background: T.mintSoft, color: "#2F8F73", fontSize: 14, padding: "12px 16px", borderRadius: 12, marginBottom: 16 }}>
                Đã mở ứng dụng email với nội dung đăng ký. Nếu không thấy, vui lòng gọi hotline {HOTLINE}.
              </div>
            )}
            {loi && (
              <div role="alert" style={{ background: "#FDECEA", color: "#C0392B", fontSize: 14, padding: "12px 16px", borderRadius: 12, marginBottom: 16 }}>{loi}</div>
            )}

            <form onSubmit={guiTuVan} noValidate>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 16 }}>
                <div>
                  <label htmlFor="ts-hoten" style={lbl}>Họ và tên <span style={{ color: "#C0392B" }}>*</span></label>
                  <input id="ts-hoten" name="hoten" type="text" autoComplete="name" required value={form.ho_ten} onChange={set("ho_ten")} placeholder="Nguyễn Thị An" style={inp} />
                </div>
                <div>
                  <label htmlFor="ts-sdt" style={lbl}>Số điện thoại <span style={{ color: "#C0392B" }}>*</span></label>
                  <input id="ts-sdt" name="sdt" type="tel" inputMode="tel" autoComplete="tel" required value={form.sdt} onChange={set("sdt")} placeholder="0912 345 678" style={inp} />
                </div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label htmlFor="ts-noidung" style={lbl}>Nội dung cần tư vấn</label>
                <textarea id="ts-noidung" name="noidung" rows={4} value={form.noi_dung} onChange={set("noi_dung")} placeholder="VD: Tư vấn lịch khám thai, dịch vụ sinh…" style={{ ...inp, resize: "vertical" }} />
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Btn kind="primary" type="submit"><Send size={16} /> Gửi đăng ký</Btn>
                <a href={TEL_HREF} style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
                  <Btn kind="soft" type="button"><Phone size={16} /> Gọi hotline {HOTLINE}</Btn>
                </a>
              </div>
            </form>
          </Card>
        </div>
      </section>
    </div>
  );
}

const lbl = { display: "block", fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 6 };
const inp = {
  width: "100%", boxSizing: "border-box", padding: "11px 13px", borderRadius: 12,
  border: `1.5px solid ${T.line}`, fontSize: 14.5, fontFamily: "inherit", outline: "none",
  background: T.surface, color: T.ink,
};
