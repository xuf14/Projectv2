import React, { useState, useMemo } from "react";
import { Heart, Stethoscope, Calendar, Clock, CheckCircle2, ChevronRight, Search, MapPin, Phone, User, Baby, Activity, Star, ArrowLeft } from "lucide-react";

// =============================================================
//  PROTOTYPE — Website BV Phụ sản Hải Phòng
//  Đồ án tốt nghiệp · Demo luồng: Cổng thông tin → Đặt lịch khám
//  Single-file React. Dữ liệu mẫu (mock). Không gọi backend thật.
// =============================================================

const DEPARTMENTS = [
  { id: "san", name: "Khoa Sản", icon: Baby, desc: "Theo dõi thai kỳ, sinh thường & sinh mổ, chăm sóc sau sinh.", color: "#E8927C" },
  { id: "phu", name: "Khoa Phụ", icon: Heart, desc: "Khám và điều trị các bệnh lý phụ khoa, tầm soát ung thư.", color: "#C97FA8" },
  { id: "ivf", name: "Hỗ trợ sinh sản (IVF)", icon: Activity, desc: "Tư vấn hiếm muộn, thụ tinh ống nghiệm, IUI.", color: "#6BA4B8" },
  { id: "sosinh", name: "Sơ sinh", icon: Stethoscope, desc: "Chăm sóc & hồi sức sơ sinh, sàng lọc sau sinh.", color: "#7BA890" },
];

const DOCTORS = [
  { id: 1, dept: "san", name: "BS.CKII Nguyễn Thị Lan", title: "Trưởng khoa Sản", exp: "22 năm", rating: 4.9 },
  { id: 2, dept: "san", name: "BS.CKI Trần Văn Minh", title: "Bác sĩ Sản khoa", exp: "12 năm", rating: 4.7 },
  { id: 3, dept: "phu", name: "TS.BS Phạm Thu Hà", title: "Phụ khoa", exp: "18 năm", rating: 4.8 },
  { id: 4, dept: "ivf", name: "BS.CKII Lê Hữu Phúc", title: "Trung tâm IVF", exp: "15 năm", rating: 4.9 },
  { id: 5, dept: "sosinh", name: "BS.CKI Vũ Mai Anh", title: "Sơ sinh", exp: "10 năm", rating: 4.6 },
];

const SLOTS = ["07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "13:30", "14:00", "14:30", "15:00"];

const fmtDate = (d) => d.toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" });
const nextDays = (n) => Array.from({ length: n }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d; });

export default function App() {
  const [view, setView] = useState("home"); // home | booking
  const [step, setStep] = useState(1);
  const [sel, setSel] = useState({ dept: null, doctor: null, date: null, slot: null });
  const [confirmed, setConfirmed] = useState(null);
  const [query, setQuery] = useState("");

  const reset = () => { setSel({ dept: null, doctor: null, date: null, slot: null }); setStep(1); setConfirmed(null); };
  const startBooking = (deptId = null) => { reset(); if (deptId) { setSel((s) => ({ ...s, dept: deptId })); setStep(2); } setView("booking"); };

  const doctorsOfDept = useMemo(() => DOCTORS.filter((d) => !sel.dept || d.dept === sel.dept), [sel.dept]);
  const code = useMemo(() => "BV" + Math.random().toString(36).slice(2, 7).toUpperCase(), [confirmed]);

  return (
    <div style={S.app}>
      <style>{CSS}</style>
      <Header onHome={() => { setView("home"); reset(); }} onBook={() => startBooking()} active={view} />

      {view === "home" && (
        <Home query={query} setQuery={setQuery} onBook={startBooking} />
      )}

      {view === "booking" && (
        <main style={S.main}>
          <div style={S.bookCard}>
            <Steps step={step} />
            {step === 1 && <StepDept onPick={(id) => { setSel({ ...sel, dept: id, doctor: null }); setStep(2); }} />}
            {step === 2 && (
              <StepDoctor
                dept={DEPARTMENTS.find((d) => d.id === sel.dept)}
                doctors={doctorsOfDept}
                onBack={() => setStep(1)}
                onPick={(doc) => { setSel({ ...sel, doctor: doc }); setStep(3); }}
              />
            )}
            {step === 3 && (
              <StepTime
                sel={sel}
                onBack={() => setStep(2)}
                onPick={(date, slot) => { setSel({ ...sel, date, slot }); setStep(4); }}
              />
            )}
            {step === 4 && !confirmed && (
              <StepConfirm sel={sel} onBack={() => setStep(3)} onConfirm={() => setConfirmed(true)} />
            )}
            {step === 4 && confirmed && <Success sel={sel} code={code} onDone={() => { setView("home"); reset(); }} />}
          </div>
        </main>
      )}
      <Footer />
    </div>
  );
}

function Header({ onHome, onBook, active }) {
  return (
    <header style={S.header}>
      <div style={S.headerInner}>
        <button onClick={onHome} style={S.logo}>
          <span style={S.logoMark}><Heart size={18} fill="#fff" color="#fff" /></span>
          <span><b>Bệnh viện Phụ sản</b><br /><small style={{ letterSpacing: 1.5, color: "#9fb4c4" }}>HẢI PHÒNG</small></span>
        </button>
        <nav style={S.nav}>
          {["Khoa phòng", "Bác sĩ", "Tin tức", "Liên hệ"].map((t) => <a key={t} style={S.navLink}>{t}</a>)}
          <button onClick={onBook} style={{ ...S.btnPrimary, padding: "10px 18px" }}>
            <Calendar size={16} /> Đặt lịch khám
          </button>
        </nav>
      </div>
    </header>
  );
}

function Home({ query, setQuery, onBook }) {
  return (
    <main>
      <section style={S.hero}>
        <div style={S.heroGlow} />
        <div style={S.heroInner}>
          <span style={S.eyebrow}>Chăm sóc mẹ & bé tận tâm</span>
          <h1 style={S.h1}>Đặt lịch khám trực tuyến,<br /><span style={{ color: "#E8927C" }}>không còn xếp hàng chờ đợi</span></h1>
          <p style={S.lead}>Chọn khoa phòng, bác sĩ và khung giờ phù hợp chỉ trong vài bước. Hồ sơ của bạn được lưu trữ an toàn và bảo mật.</p>
          <div style={S.searchBar}>
            <Search size={18} color="#7a8aa0" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm khoa, bác sĩ hoặc dịch vụ…" style={S.searchInput} />
            <button onClick={() => onBook()} style={S.btnPrimary}>Bắt đầu <ChevronRight size={16} /></button>
          </div>
          <div style={S.stats}>
            <Stat n="40+" l="Năm thành lập" />
            <Stat n="120+" l="Bác sĩ chuyên khoa" />
            <Stat n="15K+" l="Ca sinh mỗi năm" />
          </div>
        </div>
      </section>

      <section style={S.section}>
        <SectionHead kicker="Khoa phòng" title="Chọn nơi bạn cần khám" />
        <div style={S.deptGrid}>
          {DEPARTMENTS.map((d) => {
            const Icon = d.icon;
            return (
              <button key={d.id} onClick={() => onBook(d.id)} className="deptCard" style={S.deptCard}>
                <span style={{ ...S.deptIcon, background: d.color + "22", color: d.color }}><Icon size={24} /></span>
                <h3 style={S.deptName}>{d.name}</h3>
                <p style={S.deptDesc}>{d.desc}</p>
                <span style={S.deptLink}>Đặt lịch <ChevronRight size={14} /></span>
              </button>
            );
          })}
        </div>
      </section>

      <section style={{ ...S.section, background: "#F6F8FB" }}>
        <SectionHead kicker="Đội ngũ" title="Bác sĩ tiêu biểu" />
        <div style={S.docGrid}>
          {DOCTORS.slice(0, 4).map((doc) => (
            <div key={doc.id} style={S.docCard}>
              <div style={S.docAvatar}><User size={28} color="#6BA4B8" /></div>
              <h4 style={S.docName}>{doc.name}</h4>
              <p style={S.docTitle}>{doc.title}</p>
              <div style={S.docMeta}>
                <span><Star size={13} fill="#F2B544" color="#F2B544" /> {doc.rating}</span>
                <span style={{ color: "#9aa7b8" }}>· {doc.exp} KN</span>
              </div>
              <button onClick={() => onBook(doc.dept)} style={S.btnGhost}>Đặt lịch</button>
            </div>
          ))}
        </div>
      </section>

      <section style={{ ...S.section, paddingBottom: 64 }}>
        <SectionHead kicker="Quy trình" title="Đặt lịch trong 4 bước" />
        <div style={S.processGrid}>
          {[
            { i: "01", t: "Chọn khoa", d: "Chọn chuyên khoa bạn cần khám" },
            { i: "02", t: "Chọn bác sĩ", d: "Xem hồ sơ và chọn bác sĩ phù hợp" },
            { i: "03", t: "Chọn giờ", d: "Chọn ngày và khung giờ còn trống" },
            { i: "04", t: "Xác nhận", d: "Nhận mã lịch hẹn và số thứ tự" },
          ].map((p) => (
            <div key={p.i} style={S.procCard}>
              <span style={S.procNum}>{p.i}</span>
              <h4 style={{ margin: "8px 0 4px", fontSize: 16 }}>{p.t}</h4>
              <p style={{ margin: 0, color: "#6b7a8d", fontSize: 14 }}>{p.d}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

const Stat = ({ n, l }) => (
  <div><div style={{ fontSize: 26, fontWeight: 800, color: "#1F4E79" }}>{n}</div><div style={{ fontSize: 13, color: "#6b7a8d" }}>{l}</div></div>
);

const SectionHead = ({ kicker, title }) => (
  <div style={{ marginBottom: 28 }}>
    <span style={S.kicker}>{kicker}</span>
    <h2 style={S.h2}>{title}</h2>
  </div>
);

// ---------- BOOKING STEPS ----------
function Steps({ step }) {
  const labels = ["Khoa", "Bác sĩ", "Thời gian", "Xác nhận"];
  return (
    <div style={S.steps}>
      {labels.map((l, i) => {
        const n = i + 1, done = n < step, cur = n === step;
        return (
          <React.Fragment key={l}>
            <div style={S.stepItem}>
              <span style={{ ...S.stepDot, background: done ? "#2E9E6B" : cur ? "#1F4E79" : "#dfe6ee", color: done || cur ? "#fff" : "#9aa7b8" }}>
                {done ? <CheckCircle2 size={16} /> : n}
              </span>
              <span style={{ fontSize: 13, color: cur ? "#1F4E79" : "#9aa7b8", fontWeight: cur ? 700 : 500 }}>{l}</span>
            </div>
            {i < labels.length - 1 && <div style={{ ...S.stepLine, background: done ? "#2E9E6B" : "#dfe6ee" }} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function StepDept({ onPick }) {
  return (
    <div>
      <h3 style={S.stepTitle}>Bạn muốn khám khoa nào?</h3>
      <div style={S.pickGrid}>
        {DEPARTMENTS.map((d) => {
          const Icon = d.icon;
          return (
            <button key={d.id} onClick={() => onPick(d.id)} className="pickCard" style={S.pickCard}>
              <span style={{ ...S.deptIcon, background: d.color + "22", color: d.color }}><Icon size={22} /></span>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontWeight: 700, color: "#23344a" }}>{d.name}</div>
                <div style={{ fontSize: 13, color: "#6b7a8d" }}>{d.desc}</div>
              </div>
              <ChevronRight size={18} color="#9aa7b8" style={{ marginLeft: "auto" }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepDoctor({ dept, doctors, onBack, onPick }) {
  return (
    <div>
      <BackBtn onBack={onBack} />
      <h3 style={S.stepTitle}>Chọn bác sĩ — {dept?.name}</h3>
      <div style={S.pickGrid}>
        <button onClick={() => onPick({ id: 0, name: "Bác sĩ bất kỳ", title: dept?.name })} className="pickCard" style={S.pickCard}>
          <span style={{ ...S.docAvatar, width: 44, height: 44 }}><Stethoscope size={20} color="#6BA4B8" /></span>
          <div style={{ textAlign: "left" }}><div style={{ fontWeight: 700 }}>Bác sĩ bất kỳ</div><div style={{ fontSize: 13, color: "#6b7a8d" }}>Hệ thống tự sắp xếp bác sĩ phù hợp</div></div>
          <ChevronRight size={18} color="#9aa7b8" style={{ marginLeft: "auto" }} />
        </button>
        {doctors.map((doc) => (
          <button key={doc.id} onClick={() => onPick(doc)} className="pickCard" style={S.pickCard}>
            <span style={{ ...S.docAvatar, width: 44, height: 44 }}><User size={20} color="#6BA4B8" /></span>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontWeight: 700 }}>{doc.name}</div>
              <div style={{ fontSize: 13, color: "#6b7a8d" }}>{doc.title} · {doc.exp} KN · <Star size={11} fill="#F2B544" color="#F2B544" /> {doc.rating}</div>
            </div>
            <ChevronRight size={18} color="#9aa7b8" style={{ marginLeft: "auto" }} />
          </button>
        ))}
      </div>
    </div>
  );
}

function StepTime({ sel, onBack, onPick }) {
  const [date, setDate] = useState(nextDays(7)[1]);
  const [slot, setSlot] = useState(null);
  const taken = useMemo(() => new Set(SLOTS.filter(() => Math.random() > 0.65)), [date]);
  return (
    <div>
      <BackBtn onBack={onBack} />
      <h3 style={S.stepTitle}>Chọn ngày & giờ khám</h3>
      <div style={S.dateRow}>
        {nextDays(7).map((d, i) => {
          const on = d.toDateString() === date.toDateString();
          return (
            <button key={i} onClick={() => { setDate(d); setSlot(null); }} style={{ ...S.dateChip, ...(on ? S.dateChipOn : {}) }}>
              {fmtDate(d)}
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: 13, color: "#6b7a8d", margin: "18px 0 10px" }}><Clock size={14} style={{ verticalAlign: -2 }} /> Khung giờ còn trống</div>
      <div style={S.slotGrid}>
        {SLOTS.map((t) => {
          const full = taken.has(t);
          const on = slot === t;
          return (
            <button key={t} disabled={full} onClick={() => setSlot(t)} style={{ ...S.slot, ...(full ? S.slotFull : {}), ...(on ? S.slotOn : {}) }}>
              {t}{full && <div style={{ fontSize: 10 }}>Hết</div>}
            </button>
          );
        })}
      </div>
      <button disabled={!slot} onClick={() => onPick(date, slot)} style={{ ...S.btnPrimary, ...S.btnBlock, ...(slot ? {} : S.btnDisabled) }}>
        Tiếp tục <ChevronRight size={16} />
      </button>
    </div>
  );
}

function StepConfirm({ sel, onBack, onConfirm }) {
  const dept = DEPARTMENTS.find((d) => d.id === sel.dept);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const ok = name.trim() && phone.trim().length >= 9;
  return (
    <div>
      <BackBtn onBack={onBack} />
      <h3 style={S.stepTitle}>Xác nhận thông tin</h3>
      <div style={S.summary}>
        <Row k="Khoa phòng" v={dept?.name} />
        <Row k="Bác sĩ" v={sel.doctor?.name} />
        <Row k="Ngày khám" v={fmtDate(sel.date)} />
        <Row k="Giờ khám" v={sel.slot} />
      </div>
      <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
        <Field label="Họ và tên bệnh nhân"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nguyễn Văn A" style={S.input} /></Field>
        <Field label="Số điện thoại"><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09xx xxx xxx" style={S.input} /></Field>
      </div>
      <button disabled={!ok} onClick={onConfirm} style={{ ...S.btnPrimary, ...S.btnBlock, marginTop: 18, ...(ok ? {} : S.btnDisabled) }}>
        Xác nhận đặt lịch
      </button>
    </div>
  );
}

function Success({ sel, code, onDone }) {
  const dept = DEPARTMENTS.find((d) => d.id === sel.dept);
  return (
    <div style={{ textAlign: "center", padding: "12px 0" }}>
      <div style={S.successIcon}><CheckCircle2 size={44} color="#2E9E6B" /></div>
      <h3 style={{ margin: "12px 0 4px", color: "#1F4E79" }}>Đặt lịch thành công!</h3>
      <p style={{ color: "#6b7a8d", marginTop: 0 }}>Thông tin lịch hẹn đã được gửi tới điện thoại của bạn.</p>
      <div style={S.ticket}>
        <div style={{ borderBottom: "1px dashed #d8e0ea", paddingBottom: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: "#9aa7b8" }}>Mã lịch hẹn</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#1F4E79", letterSpacing: 2 }}>{code}</div>
        </div>
        <Row k="Khoa" v={dept?.name} />
        <Row k="Bác sĩ" v={sel.doctor?.name} />
        <Row k="Thời gian" v={`${sel.slot} · ${fmtDate(sel.date)}`} />
        <Row k="Số thứ tự dự kiến" v={"#" + (Math.floor(Math.random() * 30) + 1)} />
      </div>
      <button onClick={onDone} style={{ ...S.btnPrimary, ...S.btnBlock, marginTop: 18 }}>Về trang chủ</button>
    </div>
  );
}

const BackBtn = ({ onBack }) => (
  <button onClick={onBack} style={S.backBtn}><ArrowLeft size={15} /> Quay lại</button>
);
const Row = ({ k, v }) => (
  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 14 }}>
    <span style={{ color: "#8595a8" }}>{k}</span><span style={{ fontWeight: 600, color: "#23344a" }}>{v}</span>
  </div>
);
const Field = ({ label, children }) => (
  <label style={{ display: "block" }}><span style={{ fontSize: 13, color: "#6b7a8d", display: "block", marginBottom: 6 }}>{label}</span>{children}</label>
);

function Footer() {
  return (
    <footer style={S.footer}>
      <div style={S.footerInner}>
        <div>
          <div style={{ ...S.logo, color: "#fff", marginBottom: 10 }}>
            <span style={S.logoMark}><Heart size={16} fill="#fff" color="#fff" /></span>
            <b>Bệnh viện Phụ sản Hải Phòng</b>
          </div>
          <p style={{ color: "#9fb4c4", fontSize: 14, maxWidth: 320, margin: 0 }}>Prototype đồ án tốt nghiệp — minh họa luồng đăng ký khám trực tuyến.</p>
        </div>
        <div style={{ color: "#9fb4c4", fontSize: 14, display: "grid", gap: 8 }}>
          <span><MapPin size={14} style={{ verticalAlign: -2 }} /> 19 Trần Quang Khải, Hồng Bàng, Hải Phòng</span>
          <span><Phone size={14} style={{ verticalAlign: -2 }} /> Tổng đài: 0225 xxx xxx</span>
        </div>
      </div>
      <div style={{ textAlign: "center", color: "#6b8094", fontSize: 12, paddingTop: 18 }}>© 2026 · Bản demo phục vụ học tập</div>
    </footer>
  );
}

// ---------- STYLES ----------
const S = {
  app: { fontFamily: "'Segoe UI', system-ui, sans-serif", color: "#23344a", background: "#fff", minHeight: "100vh" },
  header: { position: "sticky", top: 0, zIndex: 30, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(8px)", borderBottom: "1px solid #eef2f6" },
  headerInner: { maxWidth: 1100, margin: "0 auto", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" },
  logo: { display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", fontSize: 15, color: "#1F4E79", textAlign: "left" },
  logoMark: { width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg,#E8927C,#C97FA8)", display: "grid", placeItems: "center", flexShrink: 0 },
  nav: { display: "flex", alignItems: "center", gap: 22 },
  navLink: { fontSize: 14, color: "#5a6b80", cursor: "pointer", textDecoration: "none" },
  main: { maxWidth: 720, margin: "0 auto", padding: "32px 20px 60px" },
  hero: { position: "relative", overflow: "hidden", background: "linear-gradient(180deg,#F6F9FC,#fff)" },
  heroGlow: { position: "absolute", top: -120, right: -80, width: 380, height: 380, borderRadius: "50%", background: "radial-gradient(circle,#E8927C33,transparent 70%)" },
  heroInner: { maxWidth: 1100, margin: "0 auto", padding: "70px 20px 56px", position: "relative" },
  eyebrow: { display: "inline-block", fontSize: 13, fontWeight: 700, color: "#C97FA8", background: "#C97FA814", padding: "6px 14px", borderRadius: 20, letterSpacing: 0.3 },
  h1: { fontSize: 44, lineHeight: 1.12, margin: "18px 0 14px", color: "#1F2E40", fontWeight: 800, maxWidth: 640 },
  lead: { fontSize: 17, color: "#5a6b80", maxWidth: 520, lineHeight: 1.6, margin: "0 0 26px" },
  searchBar: { display: "flex", alignItems: "center", gap: 10, background: "#fff", border: "1px solid #e3eaf2", borderRadius: 14, padding: "8px 8px 8px 16px", maxWidth: 540, boxShadow: "0 8px 28px rgba(31,78,121,0.08)" },
  searchInput: { flex: 1, border: "none", outline: "none", fontSize: 15, background: "transparent" },
  stats: { display: "flex", gap: 44, marginTop: 38 },
  section: { maxWidth: 1100, margin: "0 auto", padding: "56px 20px" },
  kicker: { fontSize: 13, fontWeight: 700, color: "#6BA4B8", textTransform: "uppercase", letterSpacing: 1.2 },
  h2: { fontSize: 30, margin: "8px 0 0", color: "#1F2E40", fontWeight: 800 },
  deptGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 18 },
  deptCard: { textAlign: "left", background: "#fff", border: "1px solid #eef2f6", borderRadius: 18, padding: 22, cursor: "pointer", transition: "all .2s", display: "flex", flexDirection: "column", gap: 8 },
  deptIcon: { width: 48, height: 48, borderRadius: 13, display: "grid", placeItems: "center", marginBottom: 6 },
  deptName: { margin: 0, fontSize: 17, color: "#23344a" },
  deptDesc: { margin: 0, fontSize: 14, color: "#6b7a8d", lineHeight: 1.5, flex: 1 },
  deptLink: { fontSize: 14, fontWeight: 700, color: "#1F4E79", display: "flex", alignItems: "center", gap: 4, marginTop: 4 },
  docGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 18 },
  docCard: { background: "#fff", border: "1px solid #eef2f6", borderRadius: 18, padding: 20, textAlign: "center" },
  docAvatar: { width: 60, height: 60, borderRadius: "50%", background: "#EAF3F6", display: "grid", placeItems: "center", margin: "0 auto 10px" },
  docName: { margin: "0 0 2px", fontSize: 15 },
  docTitle: { margin: 0, fontSize: 13, color: "#6b7a8d" },
  docMeta: { display: "flex", justifyContent: "center", gap: 6, alignItems: "center", fontSize: 13, margin: "8px 0 12px", color: "#23344a" },
  processGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 16 },
  procCard: { background: "#fff", border: "1px solid #eef2f6", borderRadius: 16, padding: 22 },
  procNum: { fontSize: 28, fontWeight: 800, color: "#E8927C", fontVariantNumeric: "tabular-nums" },
  bookCard: { background: "#fff", border: "1px solid #eef2f6", borderRadius: 22, padding: "28px 30px", boxShadow: "0 14px 50px rgba(31,78,121,0.08)" },
  steps: { display: "flex", alignItems: "center", marginBottom: 28 },
  stepItem: { display: "flex", alignItems: "center", gap: 8 },
  stepDot: { width: 28, height: 28, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 13, fontWeight: 700 },
  stepLine: { flex: 1, height: 2, margin: "0 10px" },
  stepTitle: { fontSize: 20, margin: "4px 0 18px", color: "#1F2E40" },
  pickGrid: { display: "grid", gap: 12 },
  pickCard: { display: "flex", alignItems: "center", gap: 14, background: "#fff", border: "1px solid #e9eef4", borderRadius: 14, padding: 16, cursor: "pointer", transition: "all .15s", width: "100%" },
  dateRow: { display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 },
  dateChip: { flex: "0 0 auto", padding: "10px 14px", borderRadius: 11, border: "1px solid #e3eaf2", background: "#fff", cursor: "pointer", fontSize: 14, color: "#5a6b80", whiteSpace: "nowrap" },
  dateChipOn: { background: "#1F4E79", color: "#fff", borderColor: "#1F4E79", fontWeight: 700 },
  slotGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(82px,1fr))", gap: 10 },
  slot: { padding: "12px 0", borderRadius: 11, border: "1px solid #e3eaf2", background: "#fff", cursor: "pointer", fontSize: 15, fontWeight: 600, color: "#23344a" },
  slotOn: { background: "#1F4E79", color: "#fff", borderColor: "#1F4E79" },
  slotFull: { background: "#f4f6f9", color: "#b8c2cf", cursor: "not-allowed", borderColor: "#eef1f5" },
  summary: { background: "#F6F9FC", borderRadius: 14, padding: "14px 18px" },
  input: { width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 11, border: "1px solid #e3eaf2", fontSize: 15, outline: "none" },
  successIcon: { width: 78, height: 78, borderRadius: "50%", background: "#E7F6EE", display: "grid", placeItems: "center", margin: "0 auto" },
  ticket: { background: "#F8FAFC", border: "1px solid #e9eef4", borderRadius: 16, padding: 20, textAlign: "left", maxWidth: 340, margin: "18px auto 0" },
  btnPrimary: { display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "center", background: "linear-gradient(135deg,#1F4E79,#2E6DA4)", color: "#fff", border: "none", borderRadius: 12, padding: "11px 18px", fontSize: 15, fontWeight: 700, cursor: "pointer" },
  btnGhost: { background: "#fff", border: "1px solid #1F4E79", color: "#1F4E79", borderRadius: 10, padding: "8px 18px", fontWeight: 700, fontSize: 14, cursor: "pointer" },
  btnBlock: { width: "100%" },
  btnDisabled: { opacity: 0.45, cursor: "not-allowed", filter: "grayscale(0.3)" },
  backBtn: { display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "none", color: "#8595a8", cursor: "pointer", fontSize: 14, marginBottom: 8, padding: 0 },
  footer: { background: "#16293b", marginTop: 20, padding: "44px 20px 24px" },
  footerInner: { maxWidth: 1100, margin: "0 auto", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 28, borderBottom: "1px solid #2a4055", paddingBottom: 24 },
};

const CSS = `
  * { box-sizing: border-box; }
  body { margin: 0; }
  .deptCard:hover, .pickCard:hover { border-color: #1F4E79; transform: translateY(-2px); box-shadow: 0 10px 30px rgba(31,78,121,0.10); }
  .navLink:hover { color: #1F4E79; }
  input::placeholder { color: #aab6c4; }
  @media (max-width: 720px) {
    nav a { display: none; }
    h1 { font-size: 32px !important; }
  }
`;
