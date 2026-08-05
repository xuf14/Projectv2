import React, { useState, useMemo, useEffect } from "react";
import {
  Heart, Stethoscope, Calendar, Clock, CheckCircle2, ChevronRight, ChevronLeft, MapPin, Phone, User, Baby, Activity, Star, ArrowLeft, Menu, X, Home as HomeIcon, FileText, Users, LayoutDashboard, ClipboardList, Settings, Plus, Edit3, Trash2, UserCheck, Paperclip, Pill as PillIcon, CalendarCheck, CircleUser, Mail, Lock, Shield, Sparkles, ArrowUpRight, Newspaper, ChevronDown, BadgeCheck
} from "lucide-react";
import { T, store, api, Nav, useNav, Btn, Card, Pill, Avatar, Stars, SectionHead, StatCard, PageTitle, FormField, input, pickRow, PortalShell, NEWS } from "./shared";
import DoctorPortal from "./DoctorPortal";
import ReceptionPortal from "./ReceptionPortal";
import AdminPortal from "./AdminPortal";
import ChatBot from "./chatbot";
import TrangQuangBa from "./TrangQuangBa";

// ============================================================================
//  FRONTEND — Website BV Phụ sản Hải Phòng
//  Phong cách: tươi sáng, thân thiện cho mẹ & bé
//  Render inline, nhiều màn hình, điều hướng bằng state.
//  Dữ liệu mẫu (mock) — backend sẽ làm sau.
// ============================================================================

// Icon + tông màu gán theo mã khoa (backend chỉ trả text, UI cần icon/màu)
const DEPT_STYLE = {
  san: { icon: Baby, tone: "#F08A7C", soft: "#FDEDE9" },
  phu: { icon: Heart, tone: "#9B7EDE", soft: "#EFE9FB" },
  ivf: { icon: Activity, tone: "#4FB89A", soft: "#E2F4EF" },
  sosinh: { icon: Stethoscope, tone: "#5BA8D0", soft: "#E4F1F8" },
};
const DEFAULT_STYLE = { icon: Stethoscope, tone: "#5BA8D0", soft: "#E4F1F8" };

// Chuẩn hóa dữ liệu API → cấu trúc mà UI đang dùng (name, desc, tone, icon...)
function mapDept(d) {
  const s = DEPT_STYLE[d.ma] || DEFAULT_STYLE;
  return { id: d.ma || d.id, dbId: d.id, name: d.ten_khoa, desc: d.mo_ta, viTri: d.vi_tri,
    icon: s.icon, tone: s.tone, soft: s.soft, services: (d.dich_vu && d.dich_vu.length) || 0,
    docCount: (d.bac_si && d.bac_si.length) || 0 };
}
function mapDoctor(b) {
  const maKhoa = b.khoa && b.khoa.ma;
  return { id: b.id, dept: maKhoa, deptId: b.khoa && b.khoa.id, hocHam: b.hoc_ham,
    name: b.ho_ten, title: b.chuyen_mon || b.hoc_ham,
    exp: b.so_nam_kn, rating: b.danh_gia, reviews: 0 };
}
function mapAppt(a) {
  const st = { cho_xac_nhan: "pending", da_xac_nhan: "confirmed", da_checkin: "confirmed", da_kham: "done", da_huy: "cancelled" };
  const ngay = a.khung_gio && a.khung_gio.ngay ? new Date(a.khung_gio.ngay) : null;
  return { id: a.ma_lich_hen, dbId: a.id, dept: a.khoa && a.khoa.ten_khoa,
    doctor: a.khung_gio && a.khung_gio.bac_si ? a.khung_gio.bac_si.ho_ten : "—",
    date: ngay && !isNaN(ngay) ? ngay.toLocaleDateString("vi-VN") : "",
    time: a.khung_gio && a.khung_gio.gio_bat_dau,
    status: st[a.trang_thai] || "pending", queue: a.so_thu_tu };
}
// ---------- MOCK DATA (dùng làm dữ liệu dự phòng khi chưa bật backend) ----------
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

function AuthScreen({ role }) {
  const { go, portal, online, doctors, departments } = useNav();
  const [f, setF] = useState({ tk: "", mat_khau: "" });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const upd = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const cfg = {
    doctor: { tone: T.sky, soft: T.skySoft, title: "Bác sĩ", icon: Stethoscope },
    reception: { tone: T.gold, soft: T.goldSoft, title: "Lễ tân", icon: UserCheck },
    admin: { tone: T.lav, soft: T.lavSoft, title: "Quản trị viên", icon: Shield },
  }[role];
  const Icon = cfg.icon;

  const demoAcc = { doctor: "bacsi@demo.vn", reception: "letan@demo.vn", admin: "admin@demo.vn" }[role];

  // Vai trò backend nào được phép vào cổng nào
  const allowedRoles = { doctor: ["bac_si"], reception: ["le_tan"], admin: ["admin"] }[role];
  const roleLabel = { le_tan: "Lễ tân", bac_si: "Bác sĩ", admin: "Quản trị viên" };

  const submit = async () => {
    setErr(null); setBusy(true);
    try {
      if (!online) { portal(role, true); return; } // offline: vào thẳng chế độ demo
      const r = await api.login(f.tk, f.mat_khau);
      const vt = String((r.user && r.user.vai_tro) || "").trim().toLowerCase();
      if (vt && !allowedRoles.includes(vt)) {
        setErr(`Tài khoản này là "${roleLabel[vt] || vt}", không dùng để đăng nhập cổng ${cfg.title}. Vui lòng quay lại và chọn đúng cổng.`);
        return;
      }
      store.set(r.access_token, r.user);
      portal(role, true);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 22, background: `radial-gradient(circle at 30% 20%, ${cfg.soft}, ${T.bg} 60%)` }}>
      <Card style={{ padding: "38px 36px", width: "100%", maxWidth: 420, boxShadow: "0 30px 80px rgba(45,58,78,.12)" }}>
        <button onClick={() => go("home")} style={{ background: "none", border: "none", color: T.sub, fontSize: 13.5, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, marginBottom: 22 }}><ArrowLeft size={15} /> Chọn cổng khác</button>
        <span style={{ width: 58, height: 58, borderRadius: 18, background: cfg.soft, color: cfg.tone, display: "grid", placeItems: "center", marginBottom: 16 }}><Icon size={28} /></span>
        <h2 style={{ fontSize: 25, color: T.ink, margin: "0 0 4px", fontWeight: 800 }}>Chào mừng trở lại</h2>
        <p style={{ color: T.sub, fontSize: 14.5, margin: "0 0 20px" }}>Đăng nhập với vai trò <b style={{ color: cfg.tone }}>{cfg.title}</b></p>

        {online && (
          <div style={{ background: cfg.soft, borderRadius: 12, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: T.ink }}>
            Tài khoản demo: <b>{demoAcc}</b> · mật khẩu <b>123456</b>
            <button onClick={() => setF({ tk: demoAcc, mat_khau: "123456" })} style={{ marginLeft: 8, background: "none", border: "none", color: cfg.tone, fontWeight: 800, cursor: "pointer", fontSize: 13 }}>Điền nhanh</button>
          </div>
        )}
        {online && role === "doctor" && doctors.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: T.sub, display: "block", marginBottom: 6 }}>Đăng nhập theo bác sĩ / khoa phòng</label>
            <div style={{ display: "flex", alignItems: "center", gap: 10, border: `1.5px solid ${T.line}`, borderRadius: 13, padding: "0 14px", background: T.surface }}>
              <Stethoscope size={18} color={T.sub} />
              <select
                value={doctors.some((b) => `bacsi${b.id}@demo.vn` === f.tk) ? f.tk : ""}
                onChange={(e) => { const em = e.target.value; setF({ tk: em, mat_khau: em ? "123456" : "" }); }}
                style={{ flex: 1, border: "none", outline: "none", padding: "13px 0", fontSize: 15, fontFamily: "inherit", background: "transparent", color: f.tk ? T.ink : "#B5BCC8" }}>
                <option value="">— Chọn bác sĩ —</option>
                {departments.map((k) => {
                  const ds = doctors.filter((b) => b.dept === k.id);
                  if (!ds.length) return null;
                  return (
                    <optgroup key={k.id} label={k.name}>
                      {ds.map((b) => <option key={b.id} value={`bacsi${b.id}@demo.vn`}>{b.name}</option>)}
                    </optgroup>
                  );
                })}
              </select>
            </div>
            <div style={{ fontSize: 12.5, color: T.sub, marginTop: 6 }}>Mật khẩu chung của mọi bác sĩ: <b>123456</b></div>
          </div>
        )}
        {!online && <div style={{ background: T.goldSoft, borderRadius: 12, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#8A5A00" }}>Chưa kết nối backend — sẽ vào chế độ xem thử (demo).</div>}

        <div style={{ display: "grid", gap: 13 }}>
          <InputWithIcon icon={Mail} placeholder="Email" value={f.tk} onChange={upd("tk")} />
          <InputWithIcon icon={Lock} placeholder="Mật khẩu" type="password" value={f.mat_khau} onChange={upd("mat_khau")} />
        </div>

        {err && <div style={{ background: "#FDECEA", color: "#C0392B", fontSize: 13.5, padding: "10px 14px", borderRadius: 12, marginTop: 12 }}>{err}</div>}

        <Btn full size="lg" onClick={submit} disabled={busy} style={{ marginTop: 18, background: `linear-gradient(135deg, ${cfg.tone}, ${cfg.tone}CC)`, boxShadow: `0 8px 20px ${cfg.tone}40`, ...(busy ? { opacity: .6 } : {}) }}>
          {busy ? "Đang xử lý..." : "Đăng nhập"} <ChevronRight size={17} />
        </Btn>
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


// ============================================================================
//  APP ROOT — hệ thống nội bộ: chọn cổng nhân viên → đăng nhập → cổng làm việc
// ============================================================================
function StaffLanding({ portal, onBack }) {
  const roles = [
    { id: "reception", label: "Lễ tân", desc: "Tiếp đón, quy trình khám, viện phí, hồ sơ bệnh nhân", icon: UserCheck, tone: T.gold, soft: T.goldSoft },
    { id: "doctor", label: "Bác sĩ", desc: "Hàng chờ khám, ghi kết quả, hồ sơ bệnh nhân", icon: Stethoscope, tone: T.sky, soft: T.skySoft },
    { id: "admin", label: "Quản trị viên", desc: "Khoa phòng, nhân sự, báo cáo, người dùng", icon: Shield, tone: T.lav, soft: T.lavSoft },
  ];
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 22, background: `radial-gradient(circle at 30% 20%, ${T.lavSoft}, ${T.bg} 60%)` }}>
      <div style={{ width: "100%", maxWidth: 900 }}>
        {onBack && (
          <button onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", color: T.sub, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginBottom: 18 }}>
            <ArrowLeft size={16} /> Về trang giới thiệu
          </button>
        )}
        <div style={{ textAlign: "center", marginBottom: 34 }}>
          <span style={{ width: 60, height: 60, borderRadius: 18, background: `linear-gradient(135deg, ${T.peach}, ${T.lav})`, display: "inline-grid", placeItems: "center", marginBottom: 14 }}><Heart size={28} fill="#fff" color="#fff" /></span>
          <h1 style={{ fontSize: 30, fontWeight: 800, color: T.ink, margin: "0 0 6px" }}>BV Phụ sản Hải Phòng</h1>
          <p style={{ color: T.sub, fontSize: 15.5, margin: 0 }}>Hệ thống quản lý nội bộ — chọn cổng làm việc để đăng nhập</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }} className="grid3">
          {roles.map((r) => (
            <Card key={r.id} hover onClick={() => portal(r.id)} style={{ padding: 26, cursor: "pointer", textAlign: "center" }}>
              <span style={{ width: 60, height: 60, borderRadius: 18, background: r.soft, color: r.tone, display: "inline-grid", placeItems: "center", marginBottom: 14 }}><r.icon size={28} /></span>
              <div style={{ fontSize: 18, fontWeight: 800, color: T.ink, marginBottom: 6 }}>{r.label}</div>
              <div style={{ fontSize: 13.5, color: T.sub, lineHeight: 1.5 }}>{r.desc}</div>
              <div style={{ marginTop: 16 }}><Btn kind="ghost" size="sm">Đăng nhập <ChevronRight size={15} /></Btn></div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// Liên kết sâu: mở thẳng một cổng nhân viên ở tab trình duyệt mới, ví dụ
//   ?cong=bac-si&tab=ravien&hs=12
// Người mở VẪN phải đăng nhập bằng tài khoản của cổng đó (không bỏ qua xác thực).
// Chỉ truyền id hồ sơ (số), không đưa tên hay dữ liệu cá nhân lên URL.
const CONG_HOP_LE = { "bac-si": "doctor", "le-tan": "reception", "quan-tri": "admin" };
function docLienKetSau() {
  try {
    const p = new URLSearchParams(window.location.search);
    const cong = CONG_HOP_LE[p.get("cong") || ""];
    if (!cong) return null;
    const hs = Number(p.get("hs"));
    return {
      cong,
      tab: (p.get("tab") || "").replace(/[^a-z_]/gi, "") || null,
      thamSo: Number.isInteger(hs) && hs > 0 ? { hs } : null,
    };
  } catch { return null; }
}

export default function App() {
  const [lienKet] = useState(docLienKetSau);
  const [enterStaff, setEnterStaff] = useState(!!lienKet); // false = trang quảng bá công khai
  const [portalRole, setPortalRole] = useState(lienKet ? lienKet.cong : null); // null = màn chọn cổng nhân viên
  const [authed, setAuthed] = useState(false);
  const [departments, setDepartments] = useState(DEPARTMENTS);
  const [doctors, setDoctors] = useState(DOCTORS);
  const [online, setOnline] = useState(false);

  // Nạp danh mục khoa/bác sĩ từ backend (fallback về mock khi backend chưa chạy)
  const napDanhMuc = async () => {
    const [deps, docs] = await Promise.all([api.departments(), api.doctors()]);
    if (Array.isArray(deps)) setDepartments(deps.map(mapDept));
    if (Array.isArray(docs)) setDoctors(docs.map(mapDoctor));
  };
  useEffect(() => {
    (async () => { try { await napDanhMuc(); setOnline(true); } catch { setOnline(false); } })();
  }, []);

  // Quay về màn chọn cổng (nút Đăng xuất / Quay lại trong PortalShell & AuthScreen gọi go("home"))
  const go = () => { setPortalRole(null); setAuthed(false); window.scrollTo(0, 0); };
  const portal = (role, isAuthed = false) => { setAuthed(isAuthed); setPortalRole(role); window.scrollTo(0, 0); };

  const ctx = { go, portal, page: null, params: {}, departments, doctors, online, napDanhMuc };

  let body;
  if (!enterStaff && !portalRole) body = <TrangQuangBa onEnter={() => { setEnterStaff(true); window.scrollTo(0, 0); }} />;
  else if (!portalRole) body = <StaffLanding portal={portal} onBack={() => { setEnterStaff(false); window.scrollTo(0, 0); }} />;
  else if (!authed) body = <AuthScreen role={portalRole} />;
  else if (portalRole === "doctor") body = <DoctorPortal tabBanDau={lienKet && lienKet.tab} thamSo={lienKet && lienKet.thamSo} />;
  else if (portalRole === "reception") body = <ReceptionPortal />;
  else if (portalRole === "admin") body = <AdminPortal />;
  else body = <StaffLanding portal={portal} onBack={() => { setEnterStaff(false); window.scrollTo(0, 0); }} />;

  return (
    <Nav.Provider value={ctx}>
      <style>{CSS}</style>
      <div style={{ background: T.bg, minHeight: "100vh", fontFamily: "'Nunito', 'Segoe UI', system-ui, sans-serif", color: T.ink }}>
        {body}
        {/* Trợ lý ảo — chỉ hiện trong các cổng đã đăng nhập */}
        {portalRole && authed && <ChatBot />}
      </div>
    </Nav.Provider>
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
  .qb-mobile-nav { display: none; }
  .kp-mobile-cta { display: none; }
  @media (max-width: 760px) {
    .qb-links { display: none !important; }
    .kp-mobile-cta { display: flex !important; position: fixed; left: 0; right: 0; bottom: 0; z-index: 40;
      background: ${T.surface}; border-top: 1px solid ${T.line}; box-shadow: 0 -6px 20px rgba(45,58,78,.10);
      padding: 6px 8px calc(6px + env(safe-area-inset-bottom)); }
    .kp-page { padding-bottom: 74px; }
    .qb-header-inner { height: auto !important; flex-wrap: wrap; padding-top: 12px !important; padding-bottom: 12px !important; row-gap: 10px; }
    .qb-mobile-nav { display: flex !important; }
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
