import React, { useState, useMemo, createContext, useContext } from "react";
import {
  Heart, Stethoscope, Calendar, Clock, CheckCircle2, ChevronRight, ChevronLeft, Search,
  MapPin, Phone, User, Baby, Activity, Star, ArrowLeft, Bell, Menu, X, Home as HomeIcon,
  FileText, Users, LayoutDashboard, ClipboardList, Settings, LogOut, Plus, Edit3, Trash2,
  TrendingUp, UserCheck, Pill as PillIcon, NotebookPen, CalendarCheck, CircleUser, Mail, Lock, Shield,
  Sparkles, ArrowUpRight, MoreHorizontal, Filter, Newspaper, ChevronDown, BadgeCheck
} from "lucide-react";

// ============================================================================
//  FRONTEND — Website BV Phụ sản Hải Phòng
//  Phong cách: tươi sáng, thân thiện cho mẹ & bé
//  Render inline, nhiều màn hình, điều hướng bằng state.
//  Dữ liệu mẫu (mock) — backend sẽ làm sau.
// ============================================================================

// ---------- THEME TOKENS ----------
const T = {
  bg: "#FFF7F4",        // nền kem-hồng
  surface: "#FFFFFF",
  ink: "#2D3A4E",       // navy chữ chính
  sub: "#7A8699",       // chữ phụ
  line: "#F0E6E2",      // viền nhạt
  peach: "#F08A7C",     // hồng đào - màu chủ đạo ấm
  peachSoft: "#FDEDE9",
  lav: "#9B7EDE",       // tím lavender
  lavSoft: "#EFE9FB",
  mint: "#4FB89A",      // xanh mint
  mintSoft: "#E2F4EF",
  sky: "#5BA8D0",       // xanh trời
  skySoft: "#E4F1F8",
  gold: "#F4B942",
  goldSoft: "#FDF2DA",
};

// ---------- MOCK DATA ----------
const DEPARTMENTS = [
  { id: "san", name: "Khoa Sản", icon: Baby, tone: T.peach, soft: T.peachSoft, desc: "Theo dõi thai kỳ, sinh thường & sinh mổ, chăm sóc sau sinh.", services: 12 },
  { id: "phu", name: "Khoa Phụ", icon: Heart, tone: T.lav, soft: T.lavSoft, desc: "Khám và điều trị bệnh lý phụ khoa, tầm soát ung thư cổ tử cung.", services: 9 },
  { id: "ivf", name: "Hỗ trợ sinh sản (IVF)", icon: Activity, tone: T.mint, soft: T.mintSoft, desc: "Tư vấn hiếm muộn, thụ tinh ống nghiệm, bơm tinh trùng (IUI).", services: 7 },
  { id: "sosinh", name: "Sơ sinh", icon: Stethoscope, tone: T.sky, soft: T.skySoft, desc: "Chăm sóc & hồi sức sơ sinh, sàng lọc sau sinh, tiêm chủng.", services: 8 },
];

const DOCTORS = [
  { id: 1, dept: "san", name: "BS.CKII Nguyễn Thị Lan", title: "Trưởng khoa Sản", exp: 22, rating: 4.9, reviews: 312 },
  { id: 2, dept: "san", name: "BS.CKI Trần Văn Minh", title: "Bác sĩ Sản khoa", exp: 12, rating: 4.7, reviews: 145 },
  { id: 3, dept: "phu", name: "TS.BS Phạm Thu Hà", title: "Phụ khoa", exp: 18, rating: 4.8, reviews: 208 },
  { id: 4, dept: "ivf", name: "BS.CKII Lê Hữu Phúc", title: "Trung tâm IVF", exp: 15, rating: 4.9, reviews: 176 },
  { id: 5, dept: "sosinh", name: "BS.CKI Vũ Mai Anh", title: "Sơ sinh", exp: 10, rating: 4.6, reviews: 98 },
  { id: 6, dept: "phu", name: "BS.CKI Đỗ Khánh Linh", title: "Phụ khoa", exp: 9, rating: 4.7, reviews: 84 },
];

const NEWS = [
  { id: 1, tag: "Cẩm nang", title: "10 dấu hiệu chuyển dạ mẹ bầu cần biết", date: "24/06/2026", read: 5, tone: T.peach },
  { id: 2, tag: "Thông báo", title: "Lịch khám thai theo yêu cầu dịp hè 2026", date: "20/06/2026", read: 3, tone: T.sky },
  { id: 3, tag: "Dinh dưỡng", title: "Chế độ ăn cho mẹ trong tam cá nguyệt đầu", date: "18/06/2026", read: 7, tone: T.mint },
  { id: 4, tag: "Hiếm muộn", title: "Hành trình IVF: những điều nên chuẩn bị", date: "15/06/2026", read: 8, tone: T.lav },
];

const SLOTS = ["07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "13:30", "14:00", "14:30", "15:00", "15:30"];

const MY_APPTS = [
  { id: "BV3K9XA", dept: "Khoa Sản", doctor: "BS.CKII Nguyễn Thị Lan", date: "02/07/2026", time: "08:30", status: "confirmed", queue: 7 },
  { id: "BV7M2QP", dept: "Khoa Phụ", doctor: "TS.BS Phạm Thu Hà", date: "10/07/2026", time: "14:00", status: "pending", queue: null },
  { id: "BV1F8LD", dept: "Hỗ trợ sinh sản (IVF)", doctor: "BS.CKII Lê Hữu Phúc", date: "12/06/2026", time: "09:00", status: "done", queue: 3 },
];

const QUEUE = [
  { no: 1, name: "Nguyễn Thị Hoa", age: 28, time: "08:00", status: "done", reason: "Khám thai 12 tuần" },
  { no: 2, name: "Trần Mai Phương", age: 31, time: "08:30", status: "examining", reason: "Khám thai định kỳ" },
  { no: 3, name: "Lê Thị Thu", age: 26, time: "08:30", status: "waiting", reason: "Tư vấn tiền sản" },
  { no: 4, name: "Phạm Hồng Nhung", age: 34, time: "09:00", status: "waiting", reason: "Siêu âm 4D" },
  { no: 5, name: "Vũ Thị Lan", age: 29, time: "09:00", status: "waiting", reason: "Khám thai 20 tuần" },
];

const fmtDate = (d) => d.toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" });
const nextDays = (n) => Array.from({ length: n }, (_, i) => { const d = new Date(2026, 6, 1); d.setDate(d.getDate() + i); return d; });

// ---------- NAV CONTEXT ----------
const Nav = createContext(null);
const useNav = () => useContext(Nav);

// ---------- PRIMITIVE UI ----------
function Btn({ children, kind = "primary", size = "md", full, style, ...p }) {
  const base = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
    border: "none", cursor: "pointer", fontWeight: 700, borderRadius: 999,
    fontFamily: "inherit", transition: "transform .12s, box-shadow .12s, background .15s",
    width: full ? "100%" : undefined,
    padding: size === "sm" ? "8px 16px" : size === "lg" ? "15px 28px" : "12px 22px",
    fontSize: size === "sm" ? 13.5 : size === "lg" ? 16 : 14.5,
  };
  const kinds = {
    primary: { background: `linear-gradient(135deg, ${T.peach}, #ED7263)`, color: "#fff", boxShadow: "0 8px 20px rgba(240,138,124,.32)" },
    lav: { background: `linear-gradient(135deg, ${T.lav}, #8A6BD0)`, color: "#fff", boxShadow: "0 8px 20px rgba(155,126,222,.3)" },
    mint: { background: `linear-gradient(135deg, ${T.mint}, #3FA589)`, color: "#fff", boxShadow: "0 8px 20px rgba(79,184,154,.3)" },
    ghost: { background: T.surface, color: T.ink, border: `1.5px solid ${T.line}` },
    soft: { background: T.peachSoft, color: T.peach },
    dark: { background: T.ink, color: "#fff" },
  };
  return (
    <button {...p} style={{ ...base, ...kinds[kind], ...style }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}>
      {children}
    </button>
  );
}

function Card({ children, style, hover, onClick, ...p }) {
  return (
    <div {...p} onClick={onClick} className={hover ? "hoverCard" : ""}
      style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 22, ...style }}>
      {children}
    </div>
  );
}

function Pill({ children, tone = T.peach, soft }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 700, color: tone, background: soft || tone + "1A", padding: "5px 12px", borderRadius: 999 }}>{children}</span>;
}

function Avatar({ tone = T.peachSoft, color = T.peach, size = 52, icon: Icon = User }) {
  return <span style={{ width: size, height: size, borderRadius: "50%", background: tone, color, display: "grid", placeItems: "center", flexShrink: 0 }}><Icon size={size * 0.42} /></span>;
}

function Stars({ r }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 13, color: T.ink, fontWeight: 700 }}><Star size={13} fill={T.gold} color={T.gold} /> {r}</span>;
}

function SectionHead({ kicker, title, sub, action }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
      <div>
        {kicker && <span style={{ fontSize: 13, fontWeight: 800, color: T.peach, letterSpacing: 0.5, textTransform: "uppercase" }}>{kicker}</span>}
        <h2 style={{ fontSize: 28, margin: "6px 0 0", color: T.ink, fontWeight: 800, letterSpacing: -0.5 }}>{title}</h2>
        {sub && <p style={{ margin: "8px 0 0", color: T.sub, fontSize: 15, maxWidth: 520 }}>{sub}</p>}
      </div>
      {action}
    </div>
  );
}
// ============================================================================
//  PHẦN 2 — CỔNG THÔNG TIN (PUBLIC SITE)
// ============================================================================

const PUBLIC_TABS = [
  { id: "home", label: "Trang chủ" },
  { id: "departments", label: "Khoa phòng" },
  { id: "doctors", label: "Bác sĩ" },
  { id: "news", label: "Tin tức" },
];

function PublicHeader() {
  const { go, page, portal } = useNav();
  const [open, setOpen] = useState(false);
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 40, background: "rgba(255,247,244,.85)", backdropFilter: "blur(12px)", borderBottom: `1px solid ${T.line}` }}>
      <div style={{ maxWidth: 1140, margin: "0 auto", padding: "14px 22px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button onClick={() => go("home")} style={{ display: "flex", alignItems: "center", gap: 11, background: "none", border: "none", cursor: "pointer" }}>
          <span style={{ width: 40, height: 40, borderRadius: 14, background: `linear-gradient(135deg, ${T.peach}, ${T.lav})`, display: "grid", placeItems: "center", boxShadow: "0 6px 16px rgba(240,138,124,.3)" }}>
            <Heart size={20} fill="#fff" color="#fff" />
          </span>
          <span style={{ textAlign: "left", lineHeight: 1.15 }}>
            <b style={{ color: T.ink, fontSize: 15.5 }}>Phụ sản Hải Phòng</b><br />
            <small style={{ color: T.peach, fontSize: 11, fontWeight: 700, letterSpacing: 1.5 }}>CHĂM SÓC MẸ & BÉ</small>
          </span>
        </button>

        <nav style={{ display: "flex", alignItems: "center", gap: 4 }} className="desktopNav">
          {PUBLIC_TABS.map((t) => (
            <button key={t.id} onClick={() => go(t.id)}
              style={{ background: page === t.id ? T.surface : "none", color: page === t.id ? T.peach : T.sub, border: "none", borderRadius: 999, padding: "9px 16px", fontSize: 14.5, fontWeight: 700, cursor: "pointer", boxShadow: page === t.id ? "0 4px 12px rgba(0,0,0,.05)" : "none" }}>
              {t.label}
            </button>
          ))}
          <div style={{ width: 1, height: 22, background: T.line, margin: "0 8px" }} />
          <Btn kind="ghost" size="sm" onClick={() => portal("patient")}><CircleUser size={16} /> Đăng nhập</Btn>
          <Btn size="sm" onClick={() => go("booking")}><Calendar size={16} /> Đặt lịch</Btn>
        </nav>

        <button className="mobileBtn" onClick={() => setOpen(!open)} style={{ display: "none", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 9, cursor: "pointer" }}>
          {open ? <X size={20} color={T.ink} /> : <Menu size={20} color={T.ink} />}
        </button>
      </div>
      {open && (
        <div className="mobileMenu" style={{ padding: "8px 22px 18px", display: "none", flexDirection: "column", gap: 6 }}>
          {PUBLIC_TABS.map((t) => <button key={t.id} onClick={() => { go(t.id); setOpen(false); }} style={{ textAlign: "left", background: "none", border: "none", padding: "11px 12px", fontSize: 15, fontWeight: 700, color: page === t.id ? T.peach : T.ink, borderRadius: 12 }}>{t.label}</button>)}
          <Btn full onClick={() => { go("booking"); setOpen(false); }}><Calendar size={16} /> Đặt lịch khám</Btn>
          <Btn kind="ghost" full onClick={() => { portal("patient"); setOpen(false); }}><CircleUser size={16} /> Đăng nhập</Btn>
        </div>
      )}
    </header>
  );
}

function Home() {
  const { go } = useNav();
  return (
    <div>
      {/* HERO */}
      <section style={{ position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -100, right: -60, width: 360, height: 360, borderRadius: "50%", background: `radial-gradient(circle, ${T.peach}26, transparent 70%)` }} />
        <div style={{ position: "absolute", bottom: -120, left: -80, width: 320, height: 320, borderRadius: "50%", background: `radial-gradient(circle, ${T.lav}22, transparent 70%)` }} />
        <div style={{ maxWidth: 1140, margin: "0 auto", padding: "64px 22px 56px", position: "relative", display: "grid", gridTemplateColumns: "1.05fr .95fr", gap: 40, alignItems: "center" }} className="heroGrid">
          <div>
            <Pill tone={T.lav} soft={T.lavSoft}><Sparkles size={13} /> Hơn 40 năm đồng hành cùng các mẹ</Pill>
            <h1 style={{ fontSize: 46, lineHeight: 1.1, margin: "20px 0 16px", color: T.ink, fontWeight: 800, letterSpacing: -1 }}>
              Hành trình làm mẹ,<br /><span style={{ background: `linear-gradient(120deg, ${T.peach}, ${T.lav})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>bắt đầu từ sự an tâm</span>
            </h1>
            <p style={{ fontSize: 17, color: T.sub, lineHeight: 1.65, margin: "0 0 28px", maxWidth: 480 }}>
              Đặt lịch khám trực tuyến với bác sĩ chuyên khoa chỉ trong vài bước. Không xếp hàng, không chờ đợi — dành trọn thời gian cho mẹ và bé yêu.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Btn size="lg" onClick={() => go("booking")}><Calendar size={18} /> Đặt lịch ngay</Btn>
              <Btn kind="ghost" size="lg" onClick={() => go("departments")}>Khám phá khoa phòng <ChevronRight size={18} /></Btn>
            </div>
            <div style={{ display: "flex", gap: 32, marginTop: 36 }}>
              {[["40+", "Năm kinh nghiệm"], ["120+", "Bác sĩ chuyên khoa"], ["15K+", "Ca sinh mỗi năm"]].map(([n, l]) => (
                <div key={l}><div style={{ fontSize: 26, fontWeight: 800, color: T.peach }}>{n}</div><div style={{ fontSize: 13, color: T.sub }}>{l}</div></div>
              ))}
            </div>
          </div>
          {/* Hero card collage */}
          <div style={{ position: "relative", height: 380 }} className="heroArt">
            <Card style={{ position: "absolute", top: 0, right: 10, width: 230, padding: 20, boxShadow: "0 24px 60px rgba(45,58,78,.12)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Avatar tone={T.peachSoft} color={T.peach} icon={Baby} />
                <div><div style={{ fontWeight: 800, color: T.ink }}>Khám thai định kỳ</div><div style={{ fontSize: 12.5, color: T.sub }}>Theo dõi từng tuần thai</div></div>
              </div>
              <div style={{ marginTop: 14, height: 8, borderRadius: 99, background: T.peachSoft, overflow: "hidden" }}><div style={{ width: "72%", height: "100%", background: T.peach }} /></div>
              <div style={{ fontSize: 12, color: T.sub, marginTop: 7 }}>Tuần 28 / 40 · Bé phát triển tốt</div>
            </Card>
            <Card style={{ position: "absolute", top: 130, left: 0, width: 210, padding: 18, boxShadow: "0 24px 60px rgba(45,58,78,.12)" }}>
              <Pill tone={T.mint} soft={T.mintSoft}><CheckCircle2 size={13} /> Đã xác nhận</Pill>
              <div style={{ fontWeight: 800, color: T.ink, marginTop: 12, fontSize: 15 }}>Lịch hẹn của bạn</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, color: T.sub, fontSize: 13 }}><Clock size={14} /> 08:30 · Thứ 4, 02/07</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5, color: T.sub, fontSize: 13 }}><User size={14} /> BS. Nguyễn Thị Lan</div>
            </Card>
            <Card style={{ position: "absolute", bottom: 0, right: 30, width: 180, padding: 16, boxShadow: "0 24px 60px rgba(45,58,78,.12)", display: "flex", alignItems: "center", gap: 11 }}>
              <span style={{ width: 44, height: 44, borderRadius: 13, background: T.goldSoft, display: "grid", placeItems: "center" }}><Star size={20} fill={T.gold} color={T.gold} /></span>
              <div><div style={{ fontSize: 22, fontWeight: 800, color: T.ink }}>4.9/5</div><div style={{ fontSize: 11.5, color: T.sub }}>10.000+ đánh giá</div></div>
            </Card>
          </div>
        </div>
      </section>

      {/* QUICK SERVICES */}
      <section style={{ maxWidth: 1140, margin: "0 auto", padding: "28px 22px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }} className="grid4">
          {[
            { icon: Calendar, t: "Đặt lịch online", d: "Chọn giờ phù hợp", tone: T.peach, soft: T.peachSoft, go: "booking" },
            { icon: Stethoscope, t: "Khoa phòng", d: "4 chuyên khoa chính", tone: T.lav, soft: T.lavSoft, go: "departments" },
            { icon: Users, t: "Đội ngũ bác sĩ", d: "120+ chuyên gia", tone: T.mint, soft: T.mintSoft, go: "doctors" },
            { icon: Newspaper, t: "Cẩm nang mẹ bầu", d: "Kiến thức hữu ích", tone: T.sky, soft: T.skySoft, go: "news" },
          ].map((s) => (
            <Card key={s.t} hover onClick={() => go(s.go)} style={{ padding: 22, cursor: "pointer" }}>
              <span style={{ width: 50, height: 50, borderRadius: 15, background: s.soft, color: s.tone, display: "grid", placeItems: "center" }}><s.icon size={24} /></span>
              <div style={{ fontWeight: 800, color: T.ink, marginTop: 14, fontSize: 16 }}>{s.t}</div>
              <div style={{ color: T.sub, fontSize: 13.5, marginTop: 3 }}>{s.d}</div>
            </Card>
          ))}
        </div>
      </section>

      {/* DEPARTMENTS PREVIEW */}
      <section style={{ maxWidth: 1140, margin: "0 auto", padding: "44px 22px" }}>
        <SectionHead kicker="Khoa phòng" title="Chọn nơi bạn cần khám" sub="Mỗi khoa phòng được dẫn dắt bởi đội ngũ bác sĩ giàu kinh nghiệm."
          action={<Btn kind="ghost" size="sm" onClick={() => go("departments")}>Xem tất cả <ArrowUpRight size={15} /></Btn>} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }} className="grid4">
          {DEPARTMENTS.map((d) => <DeptCard key={d.id} d={d} onClick={() => go("booking", { dept: d.id })} />)}
        </div>
      </section>

      {/* DOCTORS PREVIEW */}
      <section style={{ background: T.surface, borderTop: `1px solid ${T.line}`, borderBottom: `1px solid ${T.line}` }}>
        <div style={{ maxWidth: 1140, margin: "0 auto", padding: "52px 22px" }}>
          <SectionHead kicker="Đội ngũ" title="Bác sĩ tiêu biểu"
            action={<Btn kind="ghost" size="sm" onClick={() => go("doctors")}>Xem tất cả <ArrowUpRight size={15} /></Btn>} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }} className="grid4">
            {DOCTORS.slice(0, 4).map((doc) => <DoctorCard key={doc.id} doc={doc} onBook={() => go("booking", { dept: doc.dept, doctor: doc })} />)}
          </div>
        </div>
      </section>

      {/* PROCESS */}
      <section style={{ maxWidth: 1140, margin: "0 auto", padding: "56px 22px" }}>
        <SectionHead kicker="Quy trình" title="Đặt lịch chỉ trong 4 bước" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }} className="grid4">
          {[
            { i: "01", t: "Chọn khoa", d: "Chọn chuyên khoa cần khám", tone: T.peach, soft: T.peachSoft },
            { i: "02", t: "Chọn bác sĩ", d: "Xem hồ sơ & chọn bác sĩ", tone: T.lav, soft: T.lavSoft },
            { i: "03", t: "Chọn giờ", d: "Chọn ngày & khung giờ trống", tone: T.mint, soft: T.mintSoft },
            { i: "04", t: "Xác nhận", d: "Nhận mã & số thứ tự", tone: T.sky, soft: T.skySoft },
          ].map((p) => (
            <Card key={p.i} style={{ padding: 24 }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: p.tone, background: p.soft, borderRadius: 12, padding: "6px 12px" }}>{p.i}</span>
              <div style={{ fontWeight: 800, color: T.ink, marginTop: 16, fontSize: 17 }}>{p.t}</div>
              <div style={{ color: T.sub, fontSize: 14, marginTop: 5 }}>{p.d}</div>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ maxWidth: 1140, margin: "0 auto 56px", padding: "0 22px" }}>
        <div style={{ borderRadius: 30, padding: "48px 44px", background: `linear-gradient(120deg, ${T.peach}, ${T.lav})`, position: "relative", overflow: "hidden", textAlign: "center" }}>
          <div style={{ position: "absolute", top: -40, right: -20, width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,.12)" }} />
          <h2 style={{ color: "#fff", fontSize: 32, fontWeight: 800, margin: "0 0 12px", position: "relative" }}>Sẵn sàng cho buổi khám đầu tiên?</h2>
          <p style={{ color: "rgba(255,255,255,.9)", fontSize: 16.5, margin: "0 0 26px", position: "relative" }}>Đặt lịch ngay hôm nay và để chúng tôi chăm sóc bạn.</p>
          <Btn kind="dark" size="lg" onClick={() => go("booking")} style={{ background: "#fff", color: T.peach }}><Calendar size={18} /> Đặt lịch khám miễn phí</Btn>
        </div>
      </section>
    </div>
  );
}

function DeptCard({ d, onClick }) {
  const Icon = d.icon;
  return (
    <Card hover onClick={onClick} style={{ padding: 24, cursor: "pointer", display: "flex", flexDirection: "column", gap: 10 }}>
      <span style={{ width: 54, height: 54, borderRadius: 16, background: d.soft, color: d.tone, display: "grid", placeItems: "center" }}><Icon size={26} /></span>
      <div style={{ fontWeight: 800, color: T.ink, fontSize: 17, marginTop: 4 }}>{d.name}</div>
      <p style={{ color: T.sub, fontSize: 14, lineHeight: 1.55, margin: 0, flex: 1 }}>{d.desc}</p>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
        <span style={{ fontSize: 12.5, color: T.sub }}>{d.services} dịch vụ</span>
        <span style={{ fontSize: 14, fontWeight: 800, color: d.tone, display: "flex", alignItems: "center", gap: 3 }}>Đặt lịch <ChevronRight size={15} /></span>
      </div>
    </Card>
  );
}

function DoctorCard({ doc, onBook }) {
  const dept = DEPARTMENTS.find((x) => x.id === doc.dept);
  return (
    <Card style={{ padding: 22, textAlign: "center" }}>
      <div style={{ position: "relative", width: 76, height: 76, margin: "0 auto 14px" }}>
        <Avatar size={76} tone={dept.soft} color={dept.tone} icon={User} />
        <span style={{ position: "absolute", bottom: 0, right: 0, background: T.mint, borderRadius: "50%", padding: 4, border: "3px solid #fff" }}><BadgeCheck size={13} color="#fff" /></span>
      </div>
      <div style={{ fontWeight: 800, color: T.ink, fontSize: 15.5 }}>{doc.name}</div>
      <div style={{ color: dept.tone, fontSize: 13, fontWeight: 700, marginTop: 3 }}>{doc.title}</div>
      <div style={{ display: "flex", justifyContent: "center", gap: 10, alignItems: "center", margin: "10px 0 14px", fontSize: 13, color: T.sub }}>
        <Stars r={doc.rating} /><span>· {doc.exp} năm KN</span>
      </div>
      <Btn kind="soft" size="sm" full onClick={onBook}>Đặt lịch khám</Btn>
    </Card>
  );
}

function DepartmentsPage() {
  const { go } = useNav();
  return (
    <div style={{ maxWidth: 1140, margin: "0 auto", padding: "44px 22px 64px" }}>
      <Pill tone={T.lav} soft={T.lavSoft}>Khoa phòng</Pill>
      <h1 style={{ fontSize: 38, fontWeight: 800, color: T.ink, margin: "16px 0 8px", letterSpacing: -0.8 }}>Các chuyên khoa của chúng tôi</h1>
      <p style={{ color: T.sub, fontSize: 16, maxWidth: 560, margin: "0 0 36px" }}>Bệnh viện Phụ sản Hải Phòng cung cấp dịch vụ chăm sóc toàn diện cho mẹ và bé qua các chuyên khoa sau.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20 }} className="grid2">
        {DEPARTMENTS.map((d) => {
          const Icon = d.icon;
          const docs = DOCTORS.filter((x) => x.dept === d.id);
          return (
            <Card key={d.id} style={{ padding: 28, display: "flex", gap: 20 }}>
              <span style={{ width: 64, height: 64, borderRadius: 18, background: d.soft, color: d.tone, display: "grid", placeItems: "center", flexShrink: 0 }}><Icon size={30} /></span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, color: T.ink, fontSize: 19 }}>{d.name}</div>
                <p style={{ color: T.sub, fontSize: 14.5, lineHeight: 1.6, margin: "8px 0 14px" }}>{d.desc}</p>
                <div style={{ display: "flex", gap: 16, marginBottom: 16, fontSize: 13, color: T.sub }}>
                  <span><b style={{ color: T.ink }}>{d.services}</b> dịch vụ</span>
                  <span><b style={{ color: T.ink }}>{docs.length}</b> bác sĩ</span>
                </div>
                <Btn size="sm" onClick={() => go("booking", { dept: d.id })}>Đặt lịch khoa này <ChevronRight size={15} /></Btn>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function DoctorsPage() {
  const { go } = useNav();
  const [filter, setFilter] = useState("all");
  const list = useMemo(() => filter === "all" ? DOCTORS : DOCTORS.filter((d) => d.dept === filter), [filter]);
  return (
    <div style={{ maxWidth: 1140, margin: "0 auto", padding: "44px 22px 64px" }}>
      <Pill tone={T.mint} soft={T.mintSoft}>Đội ngũ</Pill>
      <h1 style={{ fontSize: 38, fontWeight: 800, color: T.ink, margin: "16px 0 8px", letterSpacing: -0.8 }}>Bác sĩ chuyên khoa</h1>
      <p style={{ color: T.sub, fontSize: 16, maxWidth: 560, margin: "0 0 28px" }}>Đội ngũ bác sĩ tận tâm, giàu kinh nghiệm luôn sẵn sàng đồng hành cùng bạn.</p>
      <div style={{ display: "flex", gap: 9, marginBottom: 28, flexWrap: "wrap" }}>
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>Tất cả</FilterChip>
        {DEPARTMENTS.map((d) => <FilterChip key={d.id} active={filter === d.id} tone={d.tone} onClick={() => setFilter(d.id)}>{d.name}</FilterChip>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }} className="grid3">
        {list.map((doc) => <DoctorCard key={doc.id} doc={doc} onBook={() => go("booking", { dept: doc.dept, doctor: doc })} />)}
      </div>
    </div>
  );
}

function FilterChip({ children, active, tone = T.peach, onClick }) {
  return (
    <button onClick={onClick} style={{ padding: "9px 18px", borderRadius: 999, border: `1.5px solid ${active ? tone : T.line}`, background: active ? tone : T.surface, color: active ? "#fff" : T.sub, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>{children}</button>
  );
}

function NewsPage() {
  return (
    <div style={{ maxWidth: 1140, margin: "0 auto", padding: "44px 22px 64px" }}>
      <Pill tone={T.sky} soft={T.skySoft}>Cẩm nang</Pill>
      <h1 style={{ fontSize: 38, fontWeight: 800, color: T.ink, margin: "16px 0 8px", letterSpacing: -0.8 }}>Tin tức & kiến thức mẹ bầu</h1>
      <p style={{ color: T.sub, fontSize: 16, maxWidth: 560, margin: "0 0 36px" }}>Cập nhật thông tin từ bệnh viện và những kiến thức hữu ích cho hành trình làm mẹ.</p>
      {/* Featured */}
      <Card style={{ padding: 0, overflow: "hidden", marginBottom: 28, display: "grid", gridTemplateColumns: "1.1fr 1fr" }} className="featGrid">
        <div style={{ background: `linear-gradient(135deg, ${T.peachSoft}, ${T.lavSoft})`, minHeight: 240, display: "grid", placeItems: "center" }}>
          <Baby size={80} color={T.peach} strokeWidth={1.3} />
        </div>
        <div style={{ padding: 32, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <Pill tone={T.peach} soft={T.peachSoft}>Nổi bật</Pill>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: T.ink, margin: "14px 0 10px", lineHeight: 1.25 }}>10 dấu hiệu chuyển dạ mẹ bầu cần biết</h2>
          <p style={{ color: T.sub, fontSize: 15, lineHeight: 1.6, margin: "0 0 18px" }}>Nhận biết sớm các dấu hiệu chuyển dạ giúp mẹ chuẩn bị tâm lý và đến viện kịp thời, đảm bảo an toàn cho cả mẹ và bé.</p>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 13, color: T.sub }}><span>24/06/2026</span><span>· 5 phút đọc</span></div>
        </div>
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }} className="grid3">
        {NEWS.map((n) => (
          <Card key={n.id} hover style={{ overflow: "hidden", cursor: "pointer" }}>
            <div style={{ height: 130, background: n.tone + "1A", display: "grid", placeItems: "center" }}><Newspaper size={40} color={n.tone} strokeWidth={1.4} /></div>
            <div style={{ padding: 20 }}>
              <Pill tone={n.tone} soft={n.tone + "1A"}>{n.tag}</Pill>
              <div style={{ fontWeight: 800, color: T.ink, fontSize: 16, margin: "12px 0 10px", lineHeight: 1.35 }}>{n.title}</div>
              <div style={{ display: "flex", gap: 12, fontSize: 12.5, color: T.sub }}><span>{n.date}</span><span>· {n.read} phút đọc</span></div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function PublicFooter() {
  const { go } = useNav();
  return (
    <footer style={{ background: T.ink, marginTop: 40 }}>
      <div style={{ maxWidth: 1140, margin: "0 auto", padding: "48px 22px 28px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", gap: 32 }} className="footGrid">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 14 }}>
              <span style={{ width: 38, height: 38, borderRadius: 13, background: `linear-gradient(135deg, ${T.peach}, ${T.lav})`, display: "grid", placeItems: "center" }}><Heart size={18} fill="#fff" color="#fff" /></span>
              <b style={{ color: "#fff", fontSize: 16 }}>Phụ sản Hải Phòng</b>
            </div>
            <p style={{ color: "#9AA7BC", fontSize: 14, lineHeight: 1.6, margin: 0, maxWidth: 280 }}>Đồng hành cùng các mẹ trên hành trình mang thai và làm mẹ trọn vẹn.</p>
          </div>
          {[
            ["Khám phá", [["Trang chủ", "home"], ["Khoa phòng", "departments"], ["Bác sĩ", "doctors"], ["Tin tức", "news"]]],
            ["Dịch vụ", [["Đặt lịch khám", "booking"], ["Khám thai", "booking"], ["Hỗ trợ IVF", "booking"], ["Sơ sinh", "booking"]]],
          ].map(([h, items]) => (
            <div key={h}>
              <div style={{ color: "#fff", fontWeight: 700, marginBottom: 14, fontSize: 15 }}>{h}</div>
              {items.map(([l, p]) => <button key={l} onClick={() => go(p)} style={{ display: "block", background: "none", border: "none", color: "#9AA7BC", fontSize: 14, padding: "6px 0", cursor: "pointer", textAlign: "left" }}>{l}</button>)}
            </div>
          ))}
          <div>
            <div style={{ color: "#fff", fontWeight: 700, marginBottom: 14, fontSize: 15 }}>Liên hệ</div>
            <div style={{ color: "#9AA7BC", fontSize: 14, display: "grid", gap: 10 }}>
              <span style={{ display: "flex", gap: 8 }}><MapPin size={16} /> 19 Trần Quang Khải, Hải Phòng</span>
              <span style={{ display: "flex", gap: 8 }}><Phone size={16} /> 0225 xxx xxx</span>
              <span style={{ display: "flex", gap: 8 }}><Mail size={16} /> lienhe@phusanhp.vn</span>
            </div>
          </div>
        </div>
        <div style={{ borderTop: "1px solid #3A4658", marginTop: 32, paddingTop: 20, textAlign: "center", color: "#6B7689", fontSize: 12.5 }}>© 2026 Bệnh viện Phụ sản Hải Phòng · Prototype phục vụ đồ án tốt nghiệp</div>
      </div>
    </footer>
  );
}
// ============================================================================
//  PHẦN 3 — ĐẶT LỊCH + KHU VỰC BỆNH NHÂN
// ============================================================================

function BookingFlow() {
  const { go, params } = useNav();
  const [step, setStep] = useState(params.dept ? (params.doctor ? 3 : 2) : 1);
  const [sel, setSel] = useState({ dept: params.dept || null, doctor: params.doctor || null, date: null, slot: null });
  const [confirmed, setConfirmed] = useState(false);
  const code = useMemo(() => "BV" + Math.random().toString(36).slice(2, 7).toUpperCase(), [confirmed]);

  const dept = DEPARTMENTS.find((d) => d.id === sel.dept);
  const docs = useMemo(() => DOCTORS.filter((d) => !sel.dept || d.dept === sel.dept), [sel.dept]);

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "36px 22px 64px" }}>
      <button onClick={() => go("home")} style={{ background: "none", border: "none", color: T.sub, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", gap: 5, marginBottom: 18 }}><ArrowLeft size={15} /> Về trang chủ</button>
      <Card style={{ padding: "30px 32px" }}>
        <BookingSteps step={confirmed ? 5 : step} />
        {step === 1 && <PickDept onPick={(id) => { setSel({ ...sel, dept: id, doctor: null }); setStep(2); }} />}
        {step === 2 && <PickDoctor dept={dept} docs={docs} onBack={() => setStep(1)} onPick={(doc) => { setSel({ ...sel, doctor: doc }); setStep(3); }} />}
        {step === 3 && <PickTime onBack={() => setStep(2)} onPick={(date, slot) => { setSel({ ...sel, date, slot }); setStep(4); }} />}
        {step === 4 && !confirmed && <Confirm sel={sel} dept={dept} onBack={() => setStep(3)} onConfirm={() => setConfirmed(true)} />}
        {confirmed && <BookingSuccess sel={sel} dept={dept} code={code} onDone={() => go("home")} />}
      </Card>
    </div>
  );
}

function BookingSteps({ step }) {
  const labels = ["Khoa", "Bác sĩ", "Thời gian", "Xác nhận"];
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: 28 }}>
      {labels.map((l, i) => {
        const n = i + 1, done = n < step, cur = n === step;
        return (
          <React.Fragment key={l}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 30, height: 30, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 13, fontWeight: 800, background: done ? T.mint : cur ? T.peach : T.line, color: done || cur ? "#fff" : T.sub }}>
                {done ? <CheckCircle2 size={16} /> : n}
              </span>
              <span style={{ fontSize: 13.5, color: cur ? T.ink : T.sub, fontWeight: cur ? 800 : 600 }} className="stepLabel">{l}</span>
            </div>
            {i < labels.length - 1 && <div style={{ flex: 1, height: 2, margin: "0 10px", background: done ? T.mint : T.line }} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

const BackLink = ({ onBack }) => <button onClick={onBack} style={{ background: "none", border: "none", color: T.sub, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", gap: 5, marginBottom: 10 }}><ArrowLeft size={15} /> Quay lại</button>;

function PickDept({ onPick }) {
  return (
    <div>
      <h3 style={{ fontSize: 21, color: T.ink, margin: "0 0 18px", fontWeight: 800 }}>Bạn muốn khám khoa nào?</h3>
      <div style={{ display: "grid", gap: 12 }}>
        {DEPARTMENTS.map((d) => {
          const Icon = d.icon;
          return (
            <button key={d.id} onClick={() => onPick(d.id)} className="pickRow" style={pickRow}>
              <span style={{ width: 48, height: 48, borderRadius: 14, background: d.soft, color: d.tone, display: "grid", placeItems: "center", flexShrink: 0 }}><Icon size={23} /></span>
              <div style={{ textAlign: "left", flex: 1 }}>
                <div style={{ fontWeight: 800, color: T.ink, fontSize: 15.5 }}>{d.name}</div>
                <div style={{ fontSize: 13.5, color: T.sub, marginTop: 2 }}>{d.desc}</div>
              </div>
              <ChevronRight size={20} color={T.sub} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PickDoctor({ dept, docs, onBack, onPick }) {
  return (
    <div>
      <BackLink onBack={onBack} />
      <h3 style={{ fontSize: 21, color: T.ink, margin: "0 0 18px", fontWeight: 800 }}>Chọn bác sĩ {dept ? `· ${dept.name}` : ""}</h3>
      <div style={{ display: "grid", gap: 12 }}>
        <button onClick={() => onPick({ id: 0, name: "Bác sĩ bất kỳ", title: dept?.name })} className="pickRow" style={pickRow}>
          <span style={{ width: 48, height: 48, borderRadius: 14, background: T.mintSoft, color: T.mint, display: "grid", placeItems: "center" }}><Sparkles size={22} /></span>
          <div style={{ textAlign: "left", flex: 1 }}><div style={{ fontWeight: 800, color: T.ink, fontSize: 15.5 }}>Bác sĩ bất kỳ</div><div style={{ fontSize: 13.5, color: T.sub }}>Hệ thống tự sắp xếp bác sĩ phù hợp & sớm nhất</div></div>
          <ChevronRight size={20} color={T.sub} />
        </button>
        {docs.map((doc) => {
          const dd = DEPARTMENTS.find((x) => x.id === doc.dept);
          return (
            <button key={doc.id} onClick={() => onPick(doc)} className="pickRow" style={pickRow}>
              <Avatar size={48} tone={dd.soft} color={dd.tone} icon={User} />
              <div style={{ textAlign: "left", flex: 1 }}>
                <div style={{ fontWeight: 800, color: T.ink, fontSize: 15.5 }}>{doc.name}</div>
                <div style={{ fontSize: 13, color: T.sub, marginTop: 2, display: "flex", gap: 8, alignItems: "center" }}>{doc.title} <Stars r={doc.rating} /> <span>· {doc.exp}n KN</span></div>
              </div>
              <ChevronRight size={20} color={T.sub} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PickTime({ onBack, onPick }) {
  const days = nextDays(7);
  const [date, setDate] = useState(days[1]);
  const [slot, setSlot] = useState(null);
  const taken = useMemo(() => new Set(SLOTS.filter((_, i) => (date.getDate() + i) % 3 === 0)), [date]);
  return (
    <div>
      <BackLink onBack={onBack} />
      <h3 style={{ fontSize: 21, color: T.ink, margin: "0 0 16px", fontWeight: 800 }}>Chọn ngày & giờ khám</h3>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6 }}>
        {days.map((d, i) => {
          const on = d.toDateString() === date.toDateString();
          return <button key={i} onClick={() => { setDate(d); setSlot(null); }} style={{ flex: "0 0 auto", padding: "10px 16px", borderRadius: 14, border: `1.5px solid ${on ? T.peach : T.line}`, background: on ? T.peach : T.surface, color: on ? "#fff" : T.sub, fontWeight: 700, fontSize: 13.5, cursor: "pointer", whiteSpace: "nowrap" }}>{fmtDate(d)}</button>;
        })}
      </div>
      <div style={{ fontSize: 13.5, color: T.sub, margin: "20px 0 12px", display: "flex", alignItems: "center", gap: 6 }}><Clock size={15} /> Khung giờ còn trống</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(86px, 1fr))", gap: 10 }}>
        {SLOTS.map((t) => {
          const full = taken.has(t), on = slot === t;
          return <button key={t} disabled={full} onClick={() => setSlot(t)} style={{ padding: "13px 0", borderRadius: 14, border: `1.5px solid ${on ? T.peach : full ? "#F2F2F2" : T.line}`, background: on ? T.peach : full ? "#F7F7F7" : T.surface, color: on ? "#fff" : full ? "#C5CAD3" : T.ink, fontWeight: 700, fontSize: 14.5, cursor: full ? "not-allowed" : "pointer" }}>{t}{full && <div style={{ fontSize: 10, fontWeight: 600 }}>Hết</div>}</button>;
        })}
      </div>
      <Btn full size="lg" disabled={!slot} onClick={() => onPick(date, slot)} style={{ marginTop: 24, ...(slot ? {} : { opacity: .45, cursor: "not-allowed" }) }}>Tiếp tục <ChevronRight size={17} /></Btn>
    </div>
  );
}

function Confirm({ sel, dept, onBack, onConfirm }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [bhyt, setBhyt] = useState("");
  const ok = name.trim() && phone.trim().length >= 9;
  return (
    <div>
      <BackLink onBack={onBack} />
      <h3 style={{ fontSize: 21, color: T.ink, margin: "0 0 18px", fontWeight: 800 }}>Xác nhận thông tin</h3>
      <div style={{ background: T.bg, borderRadius: 16, padding: "16px 20px", marginBottom: 20 }}>
        <SummaryRow k="Khoa phòng" v={dept?.name} />
        <SummaryRow k="Bác sĩ" v={sel.doctor?.name} />
        <SummaryRow k="Ngày khám" v={fmtDate(sel.date)} />
        <SummaryRow k="Giờ khám" v={sel.slot} last />
      </div>
      <div style={{ display: "grid", gap: 14 }}>
        <FormField label="Họ và tên bệnh nhân *"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nguyễn Văn A" style={input} /></FormField>
        <FormField label="Số điện thoại *"><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09xx xxx xxx" style={input} /></FormField>
        <FormField label="Số thẻ BHYT (tùy chọn)"><input value={bhyt} onChange={(e) => setBhyt(e.target.value)} placeholder="GD4 79 xxxxxxxxx" style={input} /></FormField>
      </div>
      <Btn full size="lg" disabled={!ok} onClick={onConfirm} style={{ marginTop: 22, ...(ok ? {} : { opacity: .45, cursor: "not-allowed" }) }}>Xác nhận đặt lịch</Btn>
    </div>
  );
}

function BookingSuccess({ sel, dept, code, onDone }) {
  const { portal } = useNav();
  return (
    <div style={{ textAlign: "center", padding: "10px 0" }}>
      <div style={{ width: 84, height: 84, borderRadius: "50%", background: T.mintSoft, display: "grid", placeItems: "center", margin: "0 auto 16px" }}><CheckCircle2 size={46} color={T.mint} /></div>
      <h3 style={{ fontSize: 24, color: T.ink, margin: "0 0 6px", fontWeight: 800 }}>Đặt lịch thành công! 🎉</h3>
      <p style={{ color: T.sub, fontSize: 15, margin: "0 0 4px" }}>Thông tin lịch hẹn đã được gửi tới điện thoại của bạn.</p>
      <div style={{ background: T.bg, border: `1px dashed ${T.peach}`, borderRadius: 18, padding: 22, maxWidth: 360, margin: "22px auto 0", textAlign: "left" }}>
        <div style={{ borderBottom: `1px dashed ${T.line}`, paddingBottom: 14, marginBottom: 14, textAlign: "center" }}>
          <div style={{ fontSize: 12, color: T.sub, fontWeight: 700 }}>MÃ LỊCH HẸN</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: T.peach, letterSpacing: 3 }}>{code}</div>
        </div>
        <SummaryRow k="Khoa" v={dept?.name} />
        <SummaryRow k="Bác sĩ" v={sel.doctor?.name} />
        <SummaryRow k="Thời gian" v={`${sel.slot} · ${fmtDate(sel.date)}`} />
        <SummaryRow k="Số thứ tự dự kiến" v={"#" + (Math.floor(Math.random() * 25) + 1)} last />
      </div>
      <div style={{ display: "flex", gap: 12, maxWidth: 360, margin: "22px auto 0" }}>
        <Btn kind="ghost" full onClick={onDone}>Về trang chủ</Btn>
        <Btn full onClick={() => portal("patient")}>Xem lịch hẹn</Btn>
      </div>
    </div>
  );
}

const SummaryRow = ({ k, v, last }) => <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: last ? "none" : `1px solid ${T.line}55`, fontSize: 14 }}><span style={{ color: T.sub }}>{k}</span><span style={{ fontWeight: 700, color: T.ink }}>{v}</span></div>;
const FormField = ({ label, children }) => <label style={{ display: "block" }}><span style={{ fontSize: 13.5, color: T.sub, fontWeight: 600, display: "block", marginBottom: 7 }}>{label}</span>{children}</label>;
const input = { width: "100%", boxSizing: "border-box", padding: "13px 16px", borderRadius: 13, border: `1.5px solid ${T.line}`, fontSize: 15, outline: "none", fontFamily: "inherit", color: T.ink, background: T.surface };
const pickRow = { display: "flex", alignItems: "center", gap: 14, background: T.surface, border: `1.5px solid ${T.line}`, borderRadius: 16, padding: 14, cursor: "pointer", width: "100%", transition: "all .15s" };

// ---------- AUTH ----------
function AuthScreen({ role }) {
  const { go, portal } = useNav();
  const [mode, setMode] = useState("login");
  const cfg = {
    patient: { tone: T.peach, soft: T.peachSoft, title: "Bệnh nhân", icon: CircleUser },
    doctor: { tone: T.sky, soft: T.skySoft, title: "Bác sĩ / Tiếp đón", icon: Stethoscope },
    admin: { tone: T.lav, soft: T.lavSoft, title: "Quản trị viên", icon: Shield },
  }[role];
  const Icon = cfg.icon;
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 22, background: `radial-gradient(circle at 30% 20%, ${cfg.soft}, ${T.bg} 60%)` }}>
      <Card style={{ padding: "38px 36px", width: "100%", maxWidth: 420, boxShadow: "0 30px 80px rgba(45,58,78,.12)" }}>
        <button onClick={() => go("home")} style={{ background: "none", border: "none", color: T.sub, fontSize: 13.5, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, marginBottom: 22 }}><ArrowLeft size={15} /> Trang chủ</button>
        <span style={{ width: 58, height: 58, borderRadius: 18, background: cfg.soft, color: cfg.tone, display: "grid", placeItems: "center", marginBottom: 16 }}><Icon size={28} /></span>
        <h2 style={{ fontSize: 25, color: T.ink, margin: "0 0 4px", fontWeight: 800 }}>{mode === "login" ? "Chào mừng trở lại" : "Tạo tài khoản"}</h2>
        <p style={{ color: T.sub, fontSize: 14.5, margin: "0 0 24px" }}>Đăng nhập với vai trò <b style={{ color: cfg.tone }}>{cfg.title}</b></p>
        <div style={{ display: "grid", gap: 13 }}>
          {mode === "register" && <InputWithIcon icon={User} placeholder="Họ và tên" />}
          <InputWithIcon icon={role === "patient" ? Phone : Mail} placeholder={role === "patient" ? "Số điện thoại" : "Email"} />
          <InputWithIcon icon={Lock} placeholder="Mật khẩu" type="password" />
          {mode === "register" && <InputWithIcon icon={Shield} placeholder="Mã OTP (gửi qua SMS)" />}
        </div>
        {mode === "login" && <div style={{ textAlign: "right", margin: "10px 0 0" }}><button style={{ background: "none", border: "none", color: cfg.tone, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Quên mật khẩu?</button></div>}
        <Btn full size="lg" onClick={() => portal(role, true)} style={{ marginTop: 18, background: `linear-gradient(135deg, ${cfg.tone}, ${cfg.tone}CC)`, boxShadow: `0 8px 20px ${cfg.tone}40` }}>
          {mode === "login" ? "Đăng nhập" : "Đăng ký"} <ChevronRight size={17} />
        </Btn>
        <div style={{ textAlign: "center", marginTop: 18, fontSize: 14, color: T.sub }}>
          {mode === "login" ? "Chưa có tài khoản? " : "Đã có tài khoản? "}
          <button onClick={() => setMode(mode === "login" ? "register" : "login")} style={{ background: "none", border: "none", color: cfg.tone, fontWeight: 800, cursor: "pointer", fontSize: 14 }}>{mode === "login" ? "Đăng ký ngay" : "Đăng nhập"}</button>
        </div>
      </Card>
    </div>
  );
}

function InputWithIcon({ icon: Icon, ...p }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, border: `1.5px solid ${T.line}`, borderRadius: 13, padding: "0 14px", background: T.surface }}>
      <Icon size={18} color={T.sub} />
      <input {...p} style={{ flex: 1, border: "none", outline: "none", padding: "13px 0", fontSize: 15, fontFamily: "inherit", background: "transparent", color: T.ink }} />
    </div>
  );
}

// ---------- PATIENT PORTAL ----------
function PatientPortal() {
  const [tab, setTab] = useState("dash");
  const items = [
    { id: "dash", label: "Tổng quan", icon: LayoutDashboard },
    { id: "appts", label: "Lịch hẹn của tôi", icon: CalendarCheck },
    { id: "records", label: "Lịch sử khám", icon: FileText },
    { id: "profile", label: "Hồ sơ cá nhân", icon: CircleUser },
  ];
  return (
    <PortalShell role="patient" tone={T.peach} soft={T.peachSoft} name="Trần Mai Phương" sub="Bệnh nhân" items={items} tab={tab} setTab={setTab}>
      {tab === "dash" && <PatientDash setTab={setTab} />}
      {tab === "appts" && <PatientAppts />}
      {tab === "records" && <PatientRecords />}
      {tab === "profile" && <PatientProfile />}
    </PortalShell>
  );
}

function PatientDash({ setTab }) {
  const { go } = useNav();
  const upcoming = MY_APPTS.filter((a) => a.status !== "done");
  return (
    <div>
      <PageTitle title="Xin chào, Mai Phương 👋" sub="Chúc bạn và bé luôn khỏe mạnh." />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }} className="grid3">
        <StatCard icon={CalendarCheck} tone={T.peach} soft={T.peachSoft} n={upcoming.length} l="Lịch hẹn sắp tới" />
        <StatCard icon={FileText} tone={T.mint} soft={T.mintSoft} n="8" l="Lần khám đã hoàn thành" />
        <StatCard icon={Baby} tone={T.lav} soft={T.lavSoft} n="Tuần 28" l="Tuần thai hiện tại" />
      </div>
      <Card style={{ padding: 26, marginBottom: 20, background: `linear-gradient(120deg, ${T.peachSoft}, ${T.lavSoft})`, border: "none" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div>
            <Pill tone={T.peach} soft="#fff"><Clock size={13} /> Lịch hẹn gần nhất</Pill>
            <div style={{ fontSize: 20, fontWeight: 800, color: T.ink, margin: "12px 0 6px" }}>Khám thai · BS. Nguyễn Thị Lan</div>
            <div style={{ color: T.ink, opacity: .7, fontSize: 14.5 }}>08:30 · Thứ 4, 02/07/2026 · Số thứ tự #7</div>
          </div>
          <Btn onClick={() => setTab("appts")}>Xem chi tiết <ChevronRight size={16} /></Btn>
        </div>
      </Card>
      <SectionHead title="Thao tác nhanh" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }} className="grid3">
        {[
          { icon: Plus, t: "Đặt lịch mới", tone: T.peach, soft: T.peachSoft, fn: () => go("booking") },
          { icon: FileText, t: "Lịch sử khám", tone: T.mint, soft: T.mintSoft, fn: () => setTab("records") },
          { icon: CircleUser, t: "Cập nhật hồ sơ", tone: T.lav, soft: T.lavSoft, fn: () => setTab("profile") },
        ].map((a) => (
          <Card key={a.t} hover onClick={a.fn} style={{ padding: 22, cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ width: 46, height: 46, borderRadius: 14, background: a.soft, color: a.tone, display: "grid", placeItems: "center" }}><a.icon size={22} /></span>
            <span style={{ fontWeight: 800, color: T.ink, fontSize: 15.5 }}>{a.t}</span>
          </Card>
        ))}
      </div>
    </div>
  );
}

function PatientAppts() {
  const { go } = useNav();
  return (
    <div>
      <PageTitle title="Lịch hẹn của tôi" sub="Quản lý các lịch hẹn khám của bạn." action={<Btn onClick={() => go("booking")}><Plus size={16} /> Đặt lịch mới</Btn>} />
      <div style={{ display: "grid", gap: 14 }}>
        {MY_APPTS.map((a) => <ApptRow key={a.id} a={a} />)}
      </div>
    </div>
  );
}

const STATUS = {
  confirmed: { l: "Đã xác nhận", tone: T.mint, soft: T.mintSoft },
  pending: { l: "Chờ xác nhận", tone: T.gold, soft: T.goldSoft },
  done: { l: "Đã khám", tone: T.sub, soft: "#F0F0F2" },
};

function ApptRow({ a }) {
  const s = STATUS[a.status];
  return (
    <Card style={{ padding: 22, display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
      <span style={{ width: 56, height: 56, borderRadius: 16, background: T.peachSoft, color: T.peach, display: "grid", placeItems: "center", flexShrink: 0 }}><Calendar size={26} /></span>
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontWeight: 800, color: T.ink, fontSize: 16 }}>{a.dept}</span>
          <Pill tone={s.tone} soft={s.soft}>{s.l}</Pill>
        </div>
        <div style={{ color: T.sub, fontSize: 14, marginTop: 6, display: "flex", gap: 14, flexWrap: "wrap" }}>
          <span><User size={13} style={{ verticalAlign: -2 }} /> {a.doctor}</span>
          <span><Clock size={13} style={{ verticalAlign: -2 }} /> {a.time} · {a.date}</span>
          {a.queue && <span><ClipboardList size={13} style={{ verticalAlign: -2 }} /> STT #{a.queue}</span>}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <span style={{ fontSize: 12.5, color: T.sub, alignSelf: "center" }}>Mã: <b style={{ color: T.ink }}>{a.id}</b></span>
        {a.status !== "done" && <Btn kind="ghost" size="sm">Đổi lịch</Btn>}
        {a.status !== "done" && <Btn kind="ghost" size="sm" style={{ color: T.peach, borderColor: T.peachSoft }}>Hủy</Btn>}
      </div>
    </Card>
  );
}

function PatientRecords() {
  const recs = [
    { date: "12/06/2026", dept: "IVF", doctor: "BS. Lê Hữu Phúc", diag: "Theo dõi sau chuyển phôi, tiến triển tốt", rx: true },
    { date: "20/05/2026", dept: "Khoa Sản", doctor: "BS. Nguyễn Thị Lan", diag: "Khám thai 24 tuần, thai phát triển bình thường", rx: false },
    { date: "02/04/2026", dept: "Khoa Phụ", doctor: "BS. Phạm Thu Hà", diag: "Tầm soát định kỳ, kết quả bình thường", rx: true },
  ];
  return (
    <div>
      <PageTitle title="Lịch sử khám" sub="Toàn bộ kết quả khám và đơn thuốc của bạn." />
      <div style={{ display: "grid", gap: 14 }}>
        {recs.map((r, i) => (
          <Card key={i} style={{ padding: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}><Pill tone={T.sky} soft={T.skySoft}>{r.dept}</Pill><span style={{ fontSize: 13, color: T.sub }}>{r.date}</span></div>
                <div style={{ fontWeight: 800, color: T.ink, fontSize: 16, margin: "10px 0 4px" }}>{r.diag}</div>
                <div style={{ color: T.sub, fontSize: 13.5 }}><User size={13} style={{ verticalAlign: -2 }} /> {r.doctor}</div>
              </div>
              {r.rx && <Btn kind="ghost" size="sm"><Pill_icon /> Xem đơn thuốc</Btn>}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
const Pill_icon = () => <PillIcon size={15} />;

function PatientProfile() {
  const fields = [
    ["Họ và tên", "Trần Mai Phương"], ["Ngày sinh", "15/03/1995"], ["Giới tính", "Nữ"],
    ["Số điện thoại", "0912 345 678"], ["Email", "phuong.tran@email.com"], ["Địa chỉ", "Lê Chân, Hải Phòng"],
    ["Số thẻ BHYT", "GD4 79 1234567890"], ["Mã bệnh nhân", "BN-2024-08842"],
  ];
  return (
    <div>
      <PageTitle title="Hồ sơ cá nhân" sub="Quản lý thông tin của bạn và người thân." action={<Btn kind="ghost"><Edit3 size={15} /> Chỉnh sửa</Btn>} />
      <Card style={{ padding: 28, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 24, paddingBottom: 24, borderBottom: `1px solid ${T.line}` }}>
          <Avatar size={72} tone={T.peachSoft} color={T.peach} icon={User} />
          <div><div style={{ fontSize: 20, fontWeight: 800, color: T.ink }}>Trần Mai Phương</div><div style={{ color: T.sub, fontSize: 14 }}>Mã BN: BN-2024-08842</div></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "18px 28px" }} className="grid2">
          {fields.map(([k, v]) => <div key={k}><div style={{ fontSize: 12.5, color: T.sub, fontWeight: 600 }}>{k}</div><div style={{ fontSize: 15.5, color: T.ink, fontWeight: 700, marginTop: 3 }}>{v}</div></div>)}
        </div>
      </Card>
      <Card style={{ padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div><div style={{ fontWeight: 800, color: T.ink, fontSize: 16 }}>Hồ sơ người thân</div><div style={{ color: T.sub, fontSize: 13.5, marginTop: 3 }}>Quản lý lịch khám cho con và người thân.</div></div>
          <Btn kind="soft" size="sm"><Plus size={15} /> Thêm hồ sơ</Btn>
        </div>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, tone, soft, n, l }) {
  return (
    <Card style={{ padding: 22 }}>
      <span style={{ width: 46, height: 46, borderRadius: 14, background: soft, color: tone, display: "grid", placeItems: "center" }}><Icon size={22} /></span>
      <div style={{ fontSize: 28, fontWeight: 800, color: T.ink, marginTop: 14 }}>{n}</div>
      <div style={{ color: T.sub, fontSize: 13.5, marginTop: 2 }}>{l}</div>
    </Card>
  );
}

function PageTitle({ title, sub, action }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 14, marginBottom: 26 }}>
      <div><h1 style={{ fontSize: 26, fontWeight: 800, color: T.ink, margin: 0, letterSpacing: -0.5 }}>{title}</h1>{sub && <p style={{ color: T.sub, fontSize: 14.5, margin: "6px 0 0" }}>{sub}</p>}</div>
      {action}
    </div>
  );
}
// ============================================================================
//  PHẦN 4 — PORTAL SHELL, BÁC SĨ/TIẾP ĐÓN, ADMIN, APP ROOT
// ============================================================================

function PortalShell({ role, tone, soft, name, sub, items, tab, setTab, children }) {
  const { go } = useNav();
  const [open, setOpen] = useState(false);
  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex" }}>
      {/* Sidebar */}
      <aside className={"sidebar" + (open ? " sidebarOpen" : "")} style={{ width: 256, background: T.surface, borderRight: `1px solid ${T.line}`, padding: "22px 16px", display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh" }}>
        <button onClick={() => go("home")} style={{ display: "flex", alignItems: "center", gap: 11, background: "none", border: "none", cursor: "pointer", marginBottom: 28, padding: "0 6px" }}>
          <span style={{ width: 38, height: 38, borderRadius: 13, background: `linear-gradient(135deg, ${T.peach}, ${T.lav})`, display: "grid", placeItems: "center" }}><Heart size={18} fill="#fff" color="#fff" /></span>
          <span style={{ textAlign: "left", lineHeight: 1.15 }}><b style={{ color: T.ink, fontSize: 14.5 }}>Phụ sản HP</b><br /><small style={{ color: tone, fontSize: 10.5, fontWeight: 700, letterSpacing: 1 }}>{sub.toUpperCase()}</small></span>
        </button>
        <nav style={{ display: "grid", gap: 4, flex: 1 }}>
          {items.map((it) => {
            const on = tab === it.id;
            return (
              <button key={it.id} onClick={() => { setTab(it.id); setOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 14, border: "none", cursor: "pointer", fontSize: 14.5, fontWeight: 700, textAlign: "left", background: on ? soft : "transparent", color: on ? tone : T.sub, transition: "all .15s" }}>
                <it.icon size={19} /> {it.label}
              </button>
            );
          })}
        </nav>
        <div style={{ borderTop: `1px solid ${T.line}`, paddingTop: 14, marginTop: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "0 6px 12px" }}>
            <Avatar size={40} tone={soft} color={tone} icon={role === "admin" ? Shield : role === "doctor" ? Stethoscope : User} />
            <div style={{ overflow: "hidden" }}><div style={{ fontWeight: 800, color: T.ink, fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div><div style={{ fontSize: 12, color: T.sub }}>{sub}</div></div>
          </div>
          <button onClick={() => go("home")} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 12, border: "none", background: "transparent", color: T.sub, fontSize: 14, fontWeight: 700, cursor: "pointer", width: "100%" }}><LogOut size={18} /> Đăng xuất</button>
        </div>
      </aside>
      {open && <div onClick={() => setOpen(false)} className="overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.3)", zIndex: 45, display: "none" }} />}

      {/* Main */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <header style={{ height: 66, borderBottom: `1px solid ${T.line}`, background: "rgba(255,255,255,.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 26px", position: "sticky", top: 0, zIndex: 30 }}>
          <button className="hamb" onClick={() => setOpen(true)} style={{ display: "none", background: "none", border: "none", cursor: "pointer" }}><Menu size={22} color={T.ink} /></button>
          <div style={{ position: "relative", flex: 1, maxWidth: 380 }} className="searchWrap">
            <Search size={17} color={T.sub} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
            <input placeholder="Tìm kiếm..." style={{ width: "100%", boxSizing: "border-box", padding: "10px 14px 10px 40px", borderRadius: 12, border: `1px solid ${T.line}`, background: T.bg, fontSize: 14, outline: "none", fontFamily: "inherit" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button style={{ position: "relative", background: T.bg, border: `1px solid ${T.line}`, borderRadius: 12, padding: 9, cursor: "pointer" }}><Bell size={18} color={T.ink} /><span style={{ position: "absolute", top: 6, right: 7, width: 8, height: 8, borderRadius: "50%", background: T.peach, border: "2px solid #fff" }} /></button>
            <Avatar size={38} tone={soft} color={tone} icon={role === "admin" ? Shield : role === "doctor" ? Stethoscope : User} />
          </div>
        </header>
        <main style={{ padding: "30px 26px 50px", flex: 1, maxWidth: 1080, width: "100%" }}>{children}</main>
      </div>
    </div>
  );
}

// ---------- DOCTOR / RECEPTION PORTAL ----------
function DoctorPortal() {
  const [tab, setTab] = useState("dash");
  const items = [
    { id: "dash", label: "Tổng quan", icon: LayoutDashboard },
    { id: "queue", label: "Hàng chờ khám", icon: ClipboardList },
    { id: "reception", label: "Tiếp đón", icon: UserCheck },
    { id: "patients", label: "Hồ sơ bệnh nhân", icon: Users },
  ];
  return (
    <PortalShell role="doctor" tone={T.sky} soft={T.skySoft} name="BS. Nguyễn Thị Lan" sub="Bác sĩ" items={items} tab={tab} setTab={setTab}>
      {tab === "dash" && <DoctorDash setTab={setTab} />}
      {tab === "queue" && <DoctorQueue />}
      {tab === "reception" && <Reception />}
      {tab === "patients" && <PatientList />}
    </PortalShell>
  );
}

function DoctorDash({ setTab }) {
  return (
    <div>
      <PageTitle title="Chào BS. Lan 👩‍⚕️" sub="Hôm nay, Thứ 4 ngày 02/07/2026" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 26 }} className="grid4">
        <StatCard icon={ClipboardList} tone={T.sky} soft={T.skySoft} n="12" l="Bệnh nhân hôm nay" />
        <StatCard icon={CheckCircle2} tone={T.mint} soft={T.mintSoft} n="5" l="Đã khám xong" />
        <StatCard icon={Clock} tone={T.gold} soft={T.goldSoft} n="6" l="Đang chờ" />
        <StatCard icon={UserCheck} tone={T.peach} soft={T.peachSoft} n="1" l="Đang khám" />
      </div>
      <Card style={{ padding: 26, marginBottom: 22, background: `linear-gradient(120deg, ${T.skySoft}, ${T.mintSoft})`, border: "none", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <div>
          <Pill tone={T.sky} soft="#fff"><UserCheck size={13} /> Đang khám</Pill>
          <div style={{ fontSize: 20, fontWeight: 800, color: T.ink, margin: "12px 0 4px" }}>STT #2 · Trần Mai Phương</div>
          <div style={{ color: T.ink, opacity: .7, fontSize: 14 }}>31 tuổi · Khám thai định kỳ · 08:30</div>
        </div>
        <Btn kind="mint" onClick={() => setTab("queue")}>Tiếp tục khám <ChevronRight size={16} /></Btn>
      </Card>
      <SectionHead title="Bệnh nhân tiếp theo" action={<Btn kind="ghost" size="sm" onClick={() => setTab("queue")}>Xem hàng chờ</Btn>} />
      <div style={{ display: "grid", gap: 12 }}>
        {QUEUE.filter((q) => q.status === "waiting").slice(0, 3).map((q) => <QueueRow key={q.no} q={q} compact />)}
      </div>
    </div>
  );
}

const QSTATUS = {
  done: { l: "Đã khám", tone: T.mint, soft: T.mintSoft },
  examining: { l: "Đang khám", tone: T.peach, soft: T.peachSoft },
  waiting: { l: "Đang chờ", tone: T.gold, soft: T.goldSoft },
};

function QueueRow({ q, compact, onExam }) {
  const s = QSTATUS[q.status];
  return (
    <Card style={{ padding: 18, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
      <span style={{ width: 48, height: 48, borderRadius: 14, background: s.soft, color: s.tone, display: "grid", placeItems: "center", fontWeight: 800, fontSize: 17, flexShrink: 0 }}>#{q.no}</span>
      <div style={{ flex: 1, minWidth: 150 }}>
        <div style={{ display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" }}><span style={{ fontWeight: 800, color: T.ink, fontSize: 15.5 }}>{q.name}</span><Pill tone={s.tone} soft={s.soft}>{s.l}</Pill></div>
        <div style={{ color: T.sub, fontSize: 13.5, marginTop: 5 }}>{q.age} tuổi · {q.reason} · {q.time}</div>
      </div>
      {!compact && q.status === "waiting" && <Btn kind="mint" size="sm" onClick={onExam}><NotebookPen size={15} /> Bắt đầu khám</Btn>}
      {!compact && q.status === "examining" && <Btn size="sm" onClick={onExam}><NotebookPen size={15} /> Ghi kết quả</Btn>}
    </Card>
  );
}

function DoctorQueue() {
  const [exam, setExam] = useState(null);
  if (exam) return <ExamForm q={exam} onBack={() => setExam(null)} />;
  return (
    <div>
      <PageTitle title="Hàng chờ khám" sub="Phòng khám 203 · Khoa Sản · 02/07/2026" />
      <div style={{ display: "grid", gap: 12 }}>
        {QUEUE.map((q) => <QueueRow key={q.no} q={q} onExam={() => setExam(q)} />)}
      </div>
    </div>
  );
}

function ExamForm({ q, onBack }) {
  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", color: T.sub, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", gap: 5, marginBottom: 16 }}><ArrowLeft size={15} /> Về hàng chờ</button>
      <PageTitle title={`Khám: ${q.name}`} sub={`STT #${q.no} · ${q.age} tuổi · ${q.reason}`} />
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20 }} className="examGrid">
        <Card style={{ padding: 26 }}>
          <div style={{ fontWeight: 800, color: T.ink, fontSize: 17, marginBottom: 18 }}>Ghi nhận kết quả khám</div>
          <div style={{ display: "grid", gap: 16 }}>
            <FormField label="Chẩn đoán"><textarea placeholder="Nhập chẩn đoán..." style={{ ...input, minHeight: 80, resize: "vertical" }} /></FormField>
            <FormField label="Chỉ định cận lâm sàng"><textarea placeholder="Siêu âm, xét nghiệm..." style={{ ...input, minHeight: 60, resize: "vertical" }} /></FormField>
            <FormField label="Đơn thuốc"><textarea placeholder="Tên thuốc · liều dùng · số lượng..." style={{ ...input, minHeight: 80, resize: "vertical" }} /></FormField>
            <FormField label="Ghi chú & hẹn tái khám"><input placeholder="VD: Tái khám sau 4 tuần" style={input} /></FormField>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 22 }}>
            <Btn kind="ghost" onClick={onBack}>Lưu nháp</Btn>
            <Btn kind="mint" onClick={onBack}><CheckCircle2 size={16} /> Hoàn thành & lưu</Btn>
          </div>
        </Card>
        <Card style={{ padding: 24, height: "fit-content" }}>
          <div style={{ fontWeight: 800, color: T.ink, fontSize: 15.5, marginBottom: 16 }}>Lịch sử khám gần đây</div>
          {[["20/05", "Khám thai 24 tuần"], ["08/04", "Khám thai 18 tuần"], ["12/02", "Khám thai 10 tuần"]].map(([d, t]) => (
            <div key={d} style={{ display: "flex", gap: 12, padding: "12px 0", borderBottom: `1px solid ${T.line}55` }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.sky, marginTop: 6, flexShrink: 0 }} />
              <div><div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>{t}</div><div style={{ fontSize: 12.5, color: T.sub }}>{d}/2026</div></div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

function Reception() {
  return (
    <div>
      <PageTitle title="Tiếp đón bệnh nhân" sub="Xác nhận lịch hẹn và check-in bệnh nhân đến khám." />
      <Card style={{ padding: 26, marginBottom: 22 }}>
        <div style={{ fontWeight: 800, color: T.ink, fontSize: 16, marginBottom: 16 }}>Tra cứu lịch hẹn</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200, display: "flex", alignItems: "center", gap: 10, border: `1.5px solid ${T.line}`, borderRadius: 13, padding: "0 14px" }}>
            <Search size={18} color={T.sub} /><input placeholder="Nhập mã lịch hẹn hoặc SĐT..." style={{ flex: 1, border: "none", outline: "none", padding: "13px 0", fontSize: 15, fontFamily: "inherit", background: "transparent" }} />
          </div>
          <Btn>Tra cứu</Btn>
        </div>
      </Card>
      <SectionHead title="Lịch hẹn hôm nay" />
      <div style={{ display: "grid", gap: 12 }}>
        {[
          { code: "BV3K9XA", name: "Trần Mai Phương", time: "08:30", dept: "Khoa Sản", status: "checked" },
          { code: "BV8H4LM", name: "Lê Thị Thu", time: "08:30", dept: "Khoa Sản", status: "pending" },
          { code: "BV2D7NK", name: "Phạm Hồng Nhung", time: "09:00", dept: "Khoa Sản", status: "pending" },
        ].map((r) => (
          <Card key={r.code} style={{ padding: 18, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <span style={{ width: 48, height: 48, borderRadius: 14, background: T.peachSoft, color: T.peach, display: "grid", placeItems: "center", flexShrink: 0 }}><User size={22} /></span>
            <div style={{ flex: 1, minWidth: 150 }}>
              <div style={{ fontWeight: 800, color: T.ink, fontSize: 15.5 }}>{r.name}</div>
              <div style={{ color: T.sub, fontSize: 13.5, marginTop: 4 }}>{r.code} · {r.dept} · {r.time}</div>
            </div>
            {r.status === "checked"
              ? <Pill tone={T.mint} soft={T.mintSoft}><CheckCircle2 size={13} /> Đã check-in · STT #7</Pill>
              : <Btn kind="mint" size="sm"><UserCheck size={15} /> Check-in</Btn>}
          </Card>
        ))}
      </div>
    </div>
  );
}

function PatientList() {
  const list = [
    { code: "BN-08842", name: "Trần Mai Phương", age: 31, phone: "0912 345 678", visits: 8 },
    { code: "BN-08651", name: "Nguyễn Thị Hoa", age: 28, phone: "0987 654 321", visits: 3 },
    { code: "BN-08433", name: "Phạm Hồng Nhung", age: 34, phone: "0934 222 111", visits: 12 },
    { code: "BN-08120", name: "Lê Thị Thu", age: 26, phone: "0901 888 777", visits: 1 },
  ];
  return (
    <div>
      <PageTitle title="Hồ sơ bệnh nhân" sub="Tra cứu và quản lý thông tin bệnh nhân." action={<Btn kind="ghost"><Filter size={15} /> Lọc</Btn>} />
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.4fr 1fr auto", gap: 12, padding: "16px 22px", borderBottom: `1px solid ${T.line}`, background: T.bg, fontSize: 12.5, fontWeight: 800, color: T.sub, textTransform: "uppercase", letterSpacing: 0.5 }} className="tableHead">
          <span>Bệnh nhân</span><span>Tuổi</span><span>Điện thoại</span><span>Lượt khám</span><span></span>
        </div>
        {list.map((p, i) => (
          <div key={p.code} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.4fr 1fr auto", gap: 12, padding: "16px 22px", borderBottom: i < list.length - 1 ? `1px solid ${T.line}55` : "none", alignItems: "center", fontSize: 14.5 }} className="tableRow">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}><Avatar size={38} tone={T.peachSoft} color={T.peach} icon={User} /><div><div style={{ fontWeight: 700, color: T.ink }}>{p.name}</div><div style={{ fontSize: 12.5, color: T.sub }}>{p.code}</div></div></div>
            <span style={{ color: T.sub }}>{p.age}</span>
            <span style={{ color: T.sub }}>{p.phone}</span>
            <span style={{ color: T.ink, fontWeight: 700 }}>{p.visits} lần</span>
            <button style={{ background: T.bg, border: `1px solid ${T.line}`, borderRadius: 10, padding: 8, cursor: "pointer" }}><MoreHorizontal size={18} color={T.sub} /></button>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ---------- ADMIN PORTAL ----------
function AdminPortal() {
  const [tab, setTab] = useState("dash");
  const items = [
    { id: "dash", label: "Tổng quan", icon: LayoutDashboard },
    { id: "depts", label: "Khoa & Bác sĩ", icon: Stethoscope },
    { id: "schedule", label: "Khung giờ", icon: Calendar },
    { id: "content", label: "Tin tức & Nội dung", icon: Newspaper },
    { id: "users", label: "Người dùng", icon: Users },
    { id: "reports", label: "Báo cáo", icon: TrendingUp },
  ];
  return (
    <PortalShell role="admin" tone={T.lav} soft={T.lavSoft} name="Quản trị viên" sub="Admin" items={items} tab={tab} setTab={setTab}>
      {tab === "dash" && <AdminDash />}
      {tab === "depts" && <AdminDepts />}
      {tab === "reports" && <AdminReports />}
      {tab === "content" && <AdminContent />}
      {(tab === "schedule" || tab === "users") && <AdminPlaceholder tab={tab} />}
    </PortalShell>
  );
}

function AdminDash() {
  return (
    <div>
      <PageTitle title="Bảng điều khiển" sub="Tổng quan hoạt động hệ thống · Tháng 6/2026" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 26 }} className="grid4">
        <StatCardTrend icon={CalendarCheck} tone={T.peach} soft={T.peachSoft} n="1.284" l="Lượt đặt lịch" up="+12%" />
        <StatCardTrend icon={UserCheck} tone={T.mint} soft={T.mintSoft} n="1.156" l="Đã đến khám" up="+8%" />
        <StatCardTrend icon={Users} tone={T.sky} soft={T.skySoft} n="3.420" l="Bệnh nhân" up="+5%" />
        <StatCardTrend icon={Activity} tone={T.lav} soft={T.lavSoft} n="90%" l="Tỷ lệ đến khám" up="+2%" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 20 }} className="examGrid">
        <Card style={{ padding: 26 }}>
          <SectionHead title="Lượt đặt theo khoa" />
          {DEPARTMENTS.map((d) => {
            const pct = [78, 55, 40, 62][DEPARTMENTS.indexOf(d)];
            return (
              <div key={d.id} style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 7 }}><span style={{ color: T.ink, fontWeight: 700 }}>{d.name}</span><span style={{ color: T.sub }}>{pct}%</span></div>
                <div style={{ height: 9, borderRadius: 99, background: d.soft }}><div style={{ width: pct + "%", height: "100%", borderRadius: 99, background: d.tone }} /></div>
              </div>
            );
          })}
        </Card>
        <Card style={{ padding: 26 }}>
          <SectionHead title="Bác sĩ nổi bật" />
          {DOCTORS.slice(0, 4).map((doc, i) => (
            <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < 3 ? `1px solid ${T.line}55` : "none" }}>
              <span style={{ fontWeight: 800, color: T.lav, width: 22 }}>{i + 1}</span>
              <Avatar size={36} tone={T.lavSoft} color={T.lav} icon={User} />
              <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>{doc.name}</div><div style={{ fontSize: 12.5, color: T.sub }}>{doc.reviews} lượt khám</div></div>
              <Stars r={doc.rating} />
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

function StatCardTrend({ icon: Icon, tone, soft, n, l, up }) {
  return (
    <Card style={{ padding: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span style={{ width: 44, height: 44, borderRadius: 13, background: soft, color: tone, display: "grid", placeItems: "center" }}><Icon size={21} /></span>
        <Pill tone={T.mint} soft={T.mintSoft}><TrendingUp size={12} /> {up}</Pill>
      </div>
      <div style={{ fontSize: 27, fontWeight: 800, color: T.ink, marginTop: 14 }}>{n}</div>
      <div style={{ color: T.sub, fontSize: 13.5, marginTop: 2 }}>{l}</div>
    </Card>
  );
}

function AdminDepts() {
  return (
    <div>
      <PageTitle title="Khoa phòng & Bác sĩ" sub="Quản lý danh mục khoa phòng và đội ngũ bác sĩ." action={<Btn kind="lav"><Plus size={16} /> Thêm khoa</Btn>} />
      <div style={{ display: "grid", gap: 14 }}>
        {DEPARTMENTS.map((d) => {
          const Icon = d.icon;
          const docs = DOCTORS.filter((x) => x.dept === d.id);
          return (
            <Card key={d.id} style={{ padding: 20, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <span style={{ width: 50, height: 50, borderRadius: 15, background: d.soft, color: d.tone, display: "grid", placeItems: "center", flexShrink: 0 }}><Icon size={24} /></span>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontWeight: 800, color: T.ink, fontSize: 16 }}>{d.name}</div>
                <div style={{ color: T.sub, fontSize: 13.5, marginTop: 3 }}>{docs.length} bác sĩ · {d.services} dịch vụ</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={iconBtn}><Edit3 size={17} color={T.sub} /></button>
                <button style={iconBtn}><Trash2 size={17} color={T.peach} /></button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function AdminContent() {
  return (
    <div>
      <PageTitle title="Tin tức & Nội dung" sub="Quản lý bài viết, banner và trang giới thiệu." action={<Btn kind="lav"><Plus size={16} /> Viết bài mới</Btn>} />
      <div style={{ display: "grid", gap: 12 }}>
        {NEWS.map((n) => (
          <Card key={n.id} style={{ padding: 18, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <span style={{ width: 48, height: 48, borderRadius: 13, background: n.tone + "1A", color: n.tone, display: "grid", placeItems: "center", flexShrink: 0 }}><Newspaper size={22} /></span>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontWeight: 800, color: T.ink, fontSize: 15 }}>{n.title}</div>
              <div style={{ color: T.sub, fontSize: 13, marginTop: 4 }}>{n.tag} · {n.date}</div>
            </div>
            <Pill tone={T.mint} soft={T.mintSoft}>Đã đăng</Pill>
            <div style={{ display: "flex", gap: 8 }}><button style={iconBtn}><Edit3 size={16} color={T.sub} /></button><button style={iconBtn}><Trash2 size={16} color={T.peach} /></button></div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function AdminReports() {
  const months = [["T1", 60], ["T2", 72], ["T3", 68], ["T4", 85], ["T5", 78], ["T6", 92]];
  return (
    <div>
      <PageTitle title="Báo cáo & Thống kê" sub="Phân tích hoạt động khám chữa bệnh." action={<Btn kind="ghost"><FileText size={15} /> Xuất báo cáo</Btn>} />
      <Card style={{ padding: 28, marginBottom: 20 }}>
        <SectionHead title="Lượt đặt lịch theo tháng" sub="6 tháng đầu năm 2026" />
        <div style={{ display: "flex", alignItems: "flex-end", gap: 18, height: 200, padding: "0 8px" }}>
          {months.map(([m, v]) => (
            <div key={m} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <div style={{ width: "100%", maxWidth: 56, height: v * 1.8, borderRadius: "12px 12px 6px 6px", background: `linear-gradient(180deg, ${T.lav}, ${T.peach})`, transition: "height .3s" }} />
              <span style={{ fontSize: 13, color: T.sub, fontWeight: 700 }}>{m}</span>
            </div>
          ))}
        </div>
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }} className="grid3">
        <StatCard icon={CalendarCheck} tone={T.peach} soft={T.peachSoft} n="7.842" l="Tổng lượt đặt (6 tháng)" />
        <StatCard icon={Activity} tone={T.mint} soft={T.mintSoft} n="88%" l="Công suất bác sĩ TB" />
        <StatCard icon={TrendingUp} tone={T.lav} soft={T.lavSoft} n="2.1 tỷ" l="Doanh thu dịch vụ" />
      </div>
    </div>
  );
}

function AdminPlaceholder({ tab }) {
  const map = { schedule: ["Khung giờ", "Quản lý lịch làm việc và khung giờ khám của bác sĩ.", Calendar], users: ["Người dùng & Phân quyền", "Quản lý tài khoản và vai trò người dùng trong hệ thống.", Users] };
  const [title, sub, Icon] = map[tab];
  return (
    <div>
      <PageTitle title={title} sub={sub} action={<Btn kind="lav"><Plus size={16} /> Thêm mới</Btn>} />
      <Card style={{ padding: 60, textAlign: "center" }}>
        <span style={{ width: 70, height: 70, borderRadius: 20, background: T.lavSoft, color: T.lav, display: "grid", placeItems: "center", margin: "0 auto 18px" }}><Icon size={32} /></span>
        <div style={{ fontWeight: 800, color: T.ink, fontSize: 18 }}>{title}</div>
        <div style={{ color: T.sub, fontSize: 14.5, marginTop: 6, maxWidth: 360, margin: "6px auto 0" }}>Màn hình quản lý {title.toLowerCase()} — bố cục bảng dữ liệu với thao tác thêm/sửa/xóa.</div>
      </Card>
    </div>
  );
}

const iconBtn = { background: T.bg, border: `1px solid ${T.line}`, borderRadius: 10, padding: 9, cursor: "pointer", display: "grid", placeItems: "center" };

// ============================================================================
//  APP ROOT
// ============================================================================
export default function App() {
  const [page, setPage] = useState("home");     // public pages + booking
  const [params, setParams] = useState({});
  const [portalRole, setPortalRole] = useState(null); // patient | doctor | admin
  const [authed, setAuthed] = useState(false);

  const go = (p, ps = {}) => { setPortalRole(null); setPage(p); setParams(ps); window.scrollTo(0, 0); };
  const portal = (role, isAuthed = false) => {
    if (isAuthed) { setAuthed(true); setPortalRole(role); }
    else { setAuthed(false); setPortalRole(role); }
    window.scrollTo(0, 0);
  };

  const ctx = { go, portal, page, params };

  let body;
  if (portalRole && !authed) body = <AuthScreen role={portalRole} />;
  else if (portalRole === "patient") body = <PatientPortal />;
  else if (portalRole === "doctor") body = <DoctorPortal />;
  else if (portalRole === "admin") body = <AdminPortal />;
  else if (page === "booking") body = <PublicWrap><BookingFlow /></PublicWrap>;
  else if (page === "departments") body = <PublicWrap><DepartmentsPage /></PublicWrap>;
  else if (page === "doctors") body = <PublicWrap><DoctorsPage /></PublicWrap>;
  else if (page === "news") body = <PublicWrap><NewsPage /></PublicWrap>;
  else body = <PublicWrap><Home /></PublicWrap>;

  return (
    <Nav.Provider value={ctx}>
      <style>{CSS}</style>
      <div style={{ background: T.bg, minHeight: "100vh", fontFamily: "'Nunito', 'Segoe UI', system-ui, sans-serif", color: T.ink }}>
        {body}
        {/* Role switcher (demo helper) */}
        {!portalRole && <RoleSwitcher portal={portal} />}
      </div>
    </Nav.Provider>
  );
}

function PublicWrap({ children }) {
  return <><PublicHeader />{children}<PublicFooter /></>;
}

function RoleSwitcher({ portal }) {
  const [open, setOpen] = useState(false);
  const roles = [
    { id: "patient", label: "Bệnh nhân", icon: CircleUser, tone: T.peach },
    { id: "doctor", label: "Bác sĩ / Tiếp đón", icon: Stethoscope, tone: T.sky },
    { id: "admin", label: "Quản trị viên", icon: Shield, tone: T.lav },
  ];
  return (
    <div style={{ position: "fixed", right: 20, bottom: 20, zIndex: 60 }}>
      {open && (
        <Card style={{ padding: 10, marginBottom: 12, boxShadow: "0 20px 50px rgba(45,58,78,.18)", width: 220 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: T.sub, padding: "6px 10px", textTransform: "uppercase", letterSpacing: 0.5 }}>Xem giao diện theo vai trò</div>
          {roles.map((r) => (
            <button key={r.id} onClick={() => { portal(r.id); setOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", padding: "11px 12px", border: "none", background: "none", borderRadius: 12, cursor: "pointer", fontSize: 14.5, fontWeight: 700, color: T.ink, textAlign: "left" }} className="rsItem">
              <span style={{ width: 34, height: 34, borderRadius: 10, background: r.tone + "1A", color: r.tone, display: "grid", placeItems: "center" }}><r.icon size={17} /></span>
              {r.label}
            </button>
          ))}
        </Card>
      )}
      <button onClick={() => setOpen(!open)} style={{ width: 56, height: 56, borderRadius: "50%", border: "none", cursor: "pointer", background: `linear-gradient(135deg, ${T.peach}, ${T.lav})`, color: "#fff", boxShadow: "0 12px 30px rgba(240,138,124,.4)", display: "grid", placeItems: "center", float: "right" }}>
        {open ? <X size={24} /> : <LayoutDashboard size={24} />}
      </button>
    </div>
  );
}

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap');
  * { box-sizing: border-box; }
  body { margin: 0; }
  .hoverCard { transition: transform .15s, box-shadow .15s, border-color .15s; }
  .hoverCard:hover { transform: translateY(-3px); box-shadow: 0 16px 40px rgba(45,58,78,.10); border-color: ${T.peach}66; }
  .pickRow:hover { border-color: ${T.peach}; transform: translateY(-1px); box-shadow: 0 8px 22px rgba(240,138,124,.12); }
  .rsItem:hover { background: ${T.bg}; }
  .tableRow:hover { background: ${T.bg}; }
  input::placeholder, textarea::placeholder { color: #B5BCC8; }
  @media (max-width: 920px) {
    .heroGrid, .examGrid, .featGrid { grid-template-columns: 1fr !important; }
    .heroArt { display: none !important; }
    .grid4 { grid-template-columns: repeat(2, 1fr) !important; }
    .grid3 { grid-template-columns: repeat(2, 1fr) !important; }
    .footGrid { grid-template-columns: 1fr 1fr !important; }
  }
  @media (max-width: 760px) {
    .desktopNav { display: none !important; }
    .mobileBtn { display: block !important; }
    .mobileMenu { display: flex !important; }
    .grid2 { grid-template-columns: 1fr !important; }
    .sidebar { position: fixed !important; left: 0; top: 0; z-index: 50; transform: translateX(-100%); transition: transform .25s; }
    .sidebarOpen { transform: translateX(0) !important; }
    .overlay { display: block !important; }
    .hamb { display: block !important; }
    .tableHead, .tableRow { grid-template-columns: 2fr 1fr auto !important; }
    .tableHead span:nth-child(3), .tableRow > span:nth-child(3), .tableHead span:nth-child(4), .tableRow > span:nth-child(4) { display: none !important; }
  }
  @media (max-width: 560px) {
    .grid4, .grid3 { grid-template-columns: 1fr !important; }
    .footGrid { grid-template-columns: 1fr !important; }
    .stepLabel { display: none !important; }
  }
`;
