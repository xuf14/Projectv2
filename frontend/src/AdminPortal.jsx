import React, { useState, useEffect } from "react";
import {
  LayoutDashboard, Stethoscope, Calendar, Newspaper, Users, TrendingUp,
  CalendarCheck, UserCheck, Activity, User, Plus, Edit3, Trash2, FileText, X, Clock, Wallet, Package,
  ChevronLeft, ChevronRight, Boxes, BedDouble,
} from "lucide-react";
import {
  T, store, api, useNav, Btn, Card, Pill, Avatar, Stars, SectionHead, StatCard,
  PageTitle, PortalShell, NEWS, useThongBao, ThongBaoPanel,
} from "./shared";
import AdminUsers from "./AdminUsers";
import AdminSlots from "./AdminSlots";
import { PaymentList } from "./Billing";
import { MediaAdmin } from "./truyenthong";
import TonKhoPage from "./TonKho";
import NhapVienPage from "./nhapvien";

// ============================================================================
//  CỔNG QUẢN TRỊ VIÊN — tách riêng khỏi App.jsx.
//  Các trang nạp dữ liệu từ database qua API với quyền admin:
//  - Báo cáo:            GET /admin/reports      (admin)
//  - Tin tức & Nội dung: GET /news               (công khai, nguồn bảng tin_tuc)
//  - Khoa & Bác sĩ:      danh mục từ /departments, /doctors qua Nav context
// ============================================================================

function AdminPortal() {
  const [tab, setTab] = useState("dash");
  const { online } = useNav();
  // Chuông thông báo: lễ tân tạo lịch tái khám... đều báo về cho quản trị viên
  const tb = useThongBao(online && !!store.token);
  const items = [
    { id: "dash", label: "Tổng quan", icon: LayoutDashboard },
    { id: "depts", label: "Khoa & Bác sĩ", icon: Stethoscope },
    { id: "schedule", label: "Khung giờ", icon: Calendar },
    { id: "content", label: "Tin tức & Nội dung", icon: Newspaper },
    { id: "media", label: "Truyền thông", icon: Newspaper },
    { id: "users", label: "Người dùng", icon: Users },
    { id: "payments", label: "Thanh toán", icon: Wallet },
    { id: "nhapvien", label: "Nhập viện", icon: BedDouble },
    { id: "kho", label: "Tồn kho", icon: Boxes },
    { id: "activity", label: "Nhật ký hoạt động", icon: Clock },
    { id: "reports", label: "Báo cáo", icon: TrendingUp },
  ];
  const name = (store.user && store.user.ho_ten) || "Quản trị viên";
  return (
    <PortalShell role="admin" tone={T.lav} soft={T.lavSoft} name={name} sub="Admin" items={items} tab={tab} setTab={setTab}
      bell={{ count: tb.chuaDoc, panel: <ThongBaoPanel list={tb.list} docTatCa={tb.docTatCa} /> }}>
      {tab === "dash" && <AdminDash />}
      {tab === "depts" && <AdminDepts />}
      {tab === "reports" && <AdminReports />}
      {tab === "activity" && <AdminActivity />}
      {tab === "content" && <AdminContent />}
      {tab === "media" && <MediaAdmin />}
      {tab === "users" && <AdminUsers />}
      {tab === "payments" && <PaymentList mode="admin" />}
      {tab === "nhapvien" && <NhapVienPage />}
      {tab === "kho" && <TonKhoPage />}
      {tab === "schedule" && <AdminSlots />}
    </PortalShell>
  );
}

function AdminDash() {
  const { departments, doctors } = useNav();
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
          {departments.map((d) => {
            const pct = [78, 55, 40, 62][departments.indexOf(d)] || 50;
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
          {doctors.slice(0, 4).map((doc, i) => (
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

// Ô nhập dùng chung cho các biểu mẫu khoa phòng / nhân sự
const oNhap = { width: "100%", padding: "10px 12px", border: `1.5px solid ${T.line}`, borderRadius: 10, fontSize: 14, fontFamily: "inherit", outline: "none", background: "#fff", color: T.ink };
const O = ({ label, value, onChange, placeholder, type = "text", span }) => (
  <label style={{ display: "block", gridColumn: span ? `span ${span}` : undefined }}>
    <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 600, display: "block", marginBottom: 5 }}>{label}</span>
    <input type={type} style={oNhap} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
  </label>
);

// Biểu mẫu thêm/sửa khoa. khoa=null → thêm mới.
function FormKhoa({ khoa, onXong, onHuy }) {
  const rong = { ten_khoa: "", ma: "", vi_tri: "", mo_ta: "" };
  const [f, setF] = useState(khoa
    ? { ten_khoa: khoa.name || "", ma: typeof khoa.id === "string" ? khoa.id : "", vi_tri: khoa.viTri || "", mo_ta: khoa.desc || "" }
    : rong);
  const [luu, setLuu] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));

  const gui = async () => {
    setLuu(true); setErr(null);
    try {
      if (khoa) await api.updateDepartment(khoa.dbId, f);
      else await api.createDepartment(f);
      await onXong();
    } catch (e) { setErr(e.message); }
    finally { setLuu(false); }
  };

  return (
    <Card style={{ padding: 20, marginBottom: 14, border: `1.5px solid ${T.lav}` }}>
      <div style={{ fontWeight: 800, color: T.ink, fontSize: 15, marginBottom: 14 }}>{khoa ? `Sửa thông tin ${khoa.name}` : "Thêm khoa phòng mới"}</div>
      {err && <div style={{ padding: 12, marginBottom: 12, background: "#FDECEA", color: "#C0392B", borderRadius: 10, fontSize: 13.5 }}>{err}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 14 }} className="grid3">
        <O label="Tên khoa *" value={f.ten_khoa} onChange={set("ten_khoa")} placeholder="VD: Khoa Sản" />
        <O label="Mã khoa" value={f.ma} onChange={set("ma")} placeholder="san, phu, ivf..." />
        <O label="Vị trí" value={f.vi_tri} onChange={set("vi_tri")} placeholder="Tầng 3, nhà A" />
        <O label="Mô tả" value={f.mo_ta} onChange={set("mo_ta")} span={3} placeholder="Giới thiệu ngắn về khoa" />
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <Btn kind="lav" disabled={luu} onClick={gui}>{luu ? "Đang lưu..." : khoa ? "Lưu thay đổi" : "Tạo khoa"}</Btn>
        <Btn kind="ghost" onClick={onHuy}>Hủy</Btn>
      </div>
    </Card>
  );
}

// Biểu mẫu thêm/sửa bác sĩ thuộc một khoa
function FormBacSi({ khoaId, bacSi, onXong, onHuy }) {
  const [f, setF] = useState(bacSi
    ? { ho_ten: bacSi.name || "", hoc_ham: bacSi.hocHam || "", chuyen_mon: bacSi.title || "", so_nam_kn: String(bacSi.exp ?? "") }
    : { ho_ten: "", hoc_ham: "", chuyen_mon: "", so_nam_kn: "" });
  const [luu, setLuu] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));

  const gui = async () => {
    setLuu(true); setErr(null);
    try {
      const body = { ...f, so_nam_kn: f.so_nam_kn === "" ? 0 : f.so_nam_kn, khoa_id: khoaId };
      if (bacSi) await api.updateDoctor(bacSi.id, body);
      else await api.createDoctor(body);
      await onXong();
    } catch (e) { setErr(e.message); }
    finally { setLuu(false); }
  };

  return (
    <Card style={{ padding: 18, marginTop: 12, border: `1.5px solid ${T.sky}` }}>
      <div style={{ fontWeight: 800, color: T.ink, fontSize: 14.5, marginBottom: 12 }}>{bacSi ? `Sửa hồ sơ ${bacSi.name}` : "Thêm nhân sự cho khoa"}</div>
      {err && <div style={{ padding: 12, marginBottom: 12, background: "#FDECEA", color: "#C0392B", borderRadius: 10, fontSize: 13.5 }}>{err}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }} className="grid3">
        <O label="Họ tên *" value={f.ho_ten} onChange={set("ho_ten")} placeholder="VD: BS.CKI Nguyễn Văn A" />
        <O label="Học hàm / học vị" value={f.hoc_ham} onChange={set("hoc_ham")} placeholder="BS.CKI, TS.BS..." />
        <O label="Chuyên môn" value={f.chuyen_mon} onChange={set("chuyen_mon")} placeholder="Sản khoa, Phụ khoa..." />
        <O label="Số năm kinh nghiệm" value={f.so_nam_kn} onChange={set("so_nam_kn")} type="number" placeholder="0" />
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <Btn kind="mint" size="sm" disabled={luu} onClick={gui}>{luu ? "Đang lưu..." : bacSi ? "Lưu thay đổi" : "Thêm bác sĩ"}</Btn>
        <Btn kind="ghost" size="sm" onClick={onHuy}>Hủy</Btn>
      </div>
    </Card>
  );
}

// Khoa phòng & Bác sĩ: bấm vào khoa để xem/thêm nhân sự, sửa hoặc xóa khoa.
function AdminDepts() {
  const { departments, doctors, online, napDanhMuc } = useNav();
  const live = online && !!store.token;
  const [mo, setMo] = useState(null);          // dbId khoa đang mở
  const [themKhoa, setThemKhoa] = useState(false);
  const [suaKhoa, setSuaKhoa] = useState(null);
  const [themBS, setThemBS] = useState(null);  // dbId khoa đang thêm nhân sự
  const [suaBS, setSuaBS] = useState(null);
  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(null);

  const dong = () => { setThemKhoa(false); setSuaKhoa(null); setThemBS(null); setSuaBS(null); };
  const sauKhiLuu = async (text) => { await napDanhMuc(); dong(); setErr(null); setMsg(text); };

  const xoa = async (d) => {
    if (!window.confirm(`Xóa khoa "${d.name}"? Chỉ xóa được khoa chưa có bác sĩ và dịch vụ.`)) return;
    setBusy(d.dbId); setErr(null); setMsg(null);
    try { const r = await api.deleteDepartment(d.dbId); await napDanhMuc(); setMsg(r.message); }
    catch (e) { setErr(e.message); }
    finally { setBusy(null); }
  };

  return (
    <div>
      <PageTitle title="Khoa phòng & Bác sĩ" sub="Bấm vào một khoa để xem và thêm nhân sự; dùng biểu tượng bút để sửa thông tin khoa."
        action={<Btn kind="lav" disabled={!live} onClick={() => { dong(); setThemKhoa(true); }}><Plus size={16} /> Thêm khoa</Btn>} />

      {!live && <Card style={{ padding: 16, marginBottom: 14, background: T.goldSoft, border: "none", color: T.ink, fontSize: 14 }}>Đang xem dữ liệu demo — đăng nhập tài khoản quản trị viên với backend đang chạy để chỉnh sửa.</Card>}
      {err && <Card style={{ padding: 16, marginBottom: 14, background: "#FDECEA", border: "none", color: "#C0392B", fontSize: 14 }}>{err}</Card>}
      {msg && <Card style={{ padding: 16, marginBottom: 14, background: T.mintSoft, border: "none", color: "#2F8F73", fontSize: 14 }}>{msg}</Card>}

      {themKhoa && <FormKhoa onXong={() => sauKhiLuu("Đã thêm khoa phòng mới.")} onHuy={dong} />}

      <div style={{ display: "grid", gap: 14 }}>
        {departments.map((d) => {
          const Icon = d.icon;
          const docs = doctors.filter((x) => (d.dbId ? x.deptId === d.dbId : x.dept === d.id));
          const dangMo = mo === d.dbId;
          return (
            <Card key={d.dbId || d.id} style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: 20, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", cursor: live ? "pointer" : "default" }}
                onClick={() => live && setMo(dangMo ? null : d.dbId)}>
                <span style={{ width: 50, height: 50, borderRadius: 15, background: d.soft, color: d.tone, display: "grid", placeItems: "center", flexShrink: 0 }}><Icon size={24} /></span>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontWeight: 800, color: T.ink, fontSize: 16 }}>{d.name}</div>
                  <div style={{ color: T.sub, fontSize: 13.5, marginTop: 3 }}>{docs.length} bác sĩ · {d.services} dịch vụ{d.viTri ? ` · ${d.viTri}` : ""}</div>
                </div>
                <div style={{ display: "flex", gap: 8 }} onClick={(e) => e.stopPropagation()}>
                  <button style={iconBtn} title="Sửa thông tin khoa" disabled={!live}
                    onClick={() => { dong(); setSuaKhoa(d.dbId); setMo(d.dbId); }}><Edit3 size={17} color={T.sub} /></button>
                  <button style={iconBtn} title="Xóa khoa" disabled={!live || busy === d.dbId}
                    onClick={() => xoa(d)}><Trash2 size={17} color={T.peach} /></button>
                </div>
              </div>

              {dangMo && (
                <div style={{ padding: "0 20px 20px", borderTop: `1px solid ${T.line}55` }}>
                  {suaKhoa === d.dbId
                    ? <div style={{ marginTop: 14 }}><FormKhoa khoa={d} onXong={() => sauKhiLuu("Đã cập nhật thông tin khoa.")} onHuy={dong} /></div>
                    : d.desc && <div style={{ color: T.sub, fontSize: 13.5, marginTop: 14 }}>{d.desc}</div>}

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, marginBottom: 10 }}>
                    <span style={{ fontWeight: 800, color: T.ink, fontSize: 14.5 }}>Nhân sự ({docs.length})</span>
                    <Btn kind="ghost" size="sm" onClick={() => { dong(); setThemBS(d.dbId); }}><Plus size={14} /> Thêm nhân sự</Btn>
                  </div>

                  {docs.length === 0 && <div style={{ color: T.sub, fontSize: 13.5, padding: "10px 0" }}>Khoa chưa có bác sĩ nào.</div>}
                  <div style={{ display: "grid", gap: 10 }}>
                    {docs.map((b) => (
                      <div key={b.id}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: T.bg, borderRadius: 12 }}>
                          <Avatar size={36} tone={T.skySoft} color={T.sky} icon={Stethoscope} />
                          <div style={{ flex: 1, minWidth: 140 }}>
                            <div style={{ fontWeight: 700, color: T.ink, fontSize: 14 }}>{b.name}</div>
                            <div style={{ color: T.sub, fontSize: 12.5, marginTop: 2 }}>{b.title || "—"}{b.exp ? ` · ${b.exp} năm KN` : ""}</div>
                          </div>
                          <button style={iconBtn} title="Sửa hồ sơ bác sĩ" disabled={!live}
                            onClick={() => { dong(); setSuaBS(b.id); }}><Edit3 size={15} color={T.sub} /></button>
                        </div>
                        {suaBS === b.id && <FormBacSi khoaId={d.dbId} bacSi={b} onXong={() => sauKhiLuu(`Đã cập nhật hồ sơ ${b.name}.`)} onHuy={dong} />}
                      </div>
                    ))}
                  </div>

                  {themBS === d.dbId && <FormBacSi khoaId={d.dbId} onXong={() => sauKhiLuu("Đã thêm bác sĩ vào khoa.")} onHuy={dong} />}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// Tin tức: nạp từ bảng tin_tuc trong database (GET /news); offline dùng mock
function AdminContent() {
  const { online } = useNav();
  const tones = [T.peach, T.sky, T.mint, T.lav];
  const [list, setList] = useState(online ? null : NEWS);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!online) { setList(NEWS); return; }
    api.news()
      .then((r) => setList(Array.isArray(r) ? r.map((n, i) => ({
        id: n.id, title: n.tieu_de, tag: n.tag || "Tin tức",
        date: new Date(n.ngay_dang).toLocaleDateString("vi-VN"), tone: tones[i % tones.length],
      })) : []))
      .catch((e) => { setErr(e.message); setList([]); });
  }, [online]);

  const data = list || [];
  return (
    <div>
      <PageTitle title="Tin tức & Nội dung" sub={online ? "Bài viết đang lưu trong hệ thống (bảng tin_tuc)." : "Dữ liệu demo — bật backend để xem bài viết thật."} action={<Btn kind="lav"><Plus size={16} /> Viết bài mới</Btn>} />
      {err && <Card style={{ padding: 18, marginBottom: 14, background: "#FDECEA", border: "none", color: "#C0392B", fontSize: 14 }}>{err}</Card>}
      {!err && data.length === 0 && <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>Chưa có bài viết nào trong hệ thống.</Card>}
      <div style={{ display: "grid", gap: 12 }}>
        {data.map((n) => (
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

// --- Báo cáo & thống kê: nhiều loại báo cáo, số liệu lấy từ database theo kỳ ---
const LOAI_MAC_DINH = [
  { id: "dieu_hanh", ten: "Điều hành & khám chữa bệnh", mo_ta: "Lượt đặt lịch, tỷ lệ đến khám, công suất khung giờ." },
  { id: "tai_chinh", ten: "Tài chính & doanh thu", mo_ta: "Doanh thu dịch vụ, công nợ hóa đơn và viện phí." },
  { id: "benh_nhan", ten: "Bệnh nhân & hồ sơ", mo_ta: "Quy mô hồ sơ, bệnh nhân đến khám, lịch tái khám." },
  { id: "nhan_su", ten: "Nhân sự & công suất", mo_ta: "Đội ngũ bác sĩ và khối lượng khám." },
  { id: "vat_tu", ten: "Vật tư tiêu hao", mo_ta: "Nhập, xuất và tồn kho vật tư tiêu hao." },
];
const ICON_LOAI = { dieu_hanh: Activity, tai_chinh: Wallet, benh_nhan: Users, nhan_su: Stethoscope, vat_tu: Package };
const MAU_THE = [
  { tone: T.peach, soft: T.peachSoft }, { tone: T.mint, soft: T.mintSoft },
  { tone: T.lav, soft: T.lavSoft }, { tone: T.gold, soft: T.goldSoft },
  { tone: T.sky, soft: T.skySoft }, { tone: "#C0392B", soft: "#FDECEA" },
];
const ngayYMD = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dinhDangSo = (v, kieu) => {
  if (kieu === "tien") return (Number(v) || 0).toLocaleString("vi-VN") + "đ";
  if (kieu === "phan_tram") return v + "%";
  return typeof v === "number" ? v.toLocaleString("vi-VN") : v;
};

// Bảng số liệu dùng chung cho mọi loại báo cáo
const BangBaoCao = ({ bang, tien }) => (
  <Card style={{ padding: 0, overflow: "hidden", marginBottom: 16 }}>
    <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.line}`, fontWeight: 800, color: T.ink, fontSize: 15 }}>{bang.tieu_de}</div>
    {bang.dong.length === 0
      ? <div style={{ padding: 30, textAlign: "center", color: T.sub, fontSize: 14 }}>Không có số liệu trong kỳ này.</div>
      : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: T.bg }}>
                {bang.cot.map((c, i) => (
                  <th key={c} style={{ padding: "11px 20px", textAlign: i === 0 ? "left" : "right", fontSize: 12.5, fontWeight: 800, color: T.sub, textTransform: "uppercase", letterSpacing: .5, whiteSpace: "nowrap" }}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bang.dong.map((d, i) => (
                <tr key={i} style={{ borderTop: `1px solid ${T.line}55` }}>
                  {d.map((v, j) => (
                    <td key={j} style={{ padding: "11px 20px", textAlign: j === 0 ? "left" : "right", color: j === 0 ? T.ink : T.sub, fontWeight: j === 0 ? 600 : 500, whiteSpace: "nowrap" }}>
                      {tien && j === d.length - 1 ? dinhDangSo(v, "tien") : dinhDangSo(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
  </Card>
);

// Biểu đồ cột cho bảng chuỗi thời gian (cột 0 = mốc, cột 1 = giá trị)
const BieuDoCot = ({ bang, tien }) => {
  // Bảng tiền: cột giá trị là cột cuối (doanh thu); còn lại lấy cột thứ 2
  const iGiaTri = tien ? bang.cot.length - 1 : 1;
  const giaTri = (d) => Number(d[iGiaTri]) || 0;
  const max = Math.max(...bang.dong.map(giaTri), 1);
  return (
    <Card style={{ padding: 28, marginBottom: 16 }}>
      <SectionHead title={bang.tieu_de} sub={`${bang.cot[iGiaTri]} theo ${bang.cot[0].toLowerCase()} — ${bang.dong.length} mốc`} />
      <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 200, padding: "0 8px", overflowX: "auto" }}>
        {bang.dong.map((d, i) => (
          <div key={i} style={{ flex: 1, minWidth: 44, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: T.ink, fontWeight: 700 }}>{dinhDangSo(giaTri(d), tien ? "tien" : undefined)}</span>
            <div title={`${d[0]}: ${giaTri(d)}`} style={{ width: "100%", maxWidth: 56, height: Math.max(4, giaTri(d) / max * 150), borderRadius: "12px 12px 6px 6px", background: `linear-gradient(180deg, ${T.lav}, ${T.peach})` }} />
            <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 700, whiteSpace: "nowrap" }}>{d[0]}</span>
          </div>
        ))}
      </div>
    </Card>
  );
};

function AdminReports() {
  const { online } = useNav();
  const live = online && !!store.token;
  const homNay = ngayYMD(new Date());
  const dauThang = ngayYMD(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  const [loai, setLoai] = useState("dieu_hanh");
  const [dsLoai, setDsLoai] = useState(LOAI_MAC_DINH);
  const [tu, setTu] = useState(dauThang);
  const [den, setDen] = useState(homNay);
  const [rep, setRep] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => { if (live) api.reportTypes().then((r) => Array.isArray(r) && r.length && setDsLoai(r)).catch(() => {}); }, [live]);

  useEffect(() => {
    if (!live) return;
    setLoading(true); setErr(null);
    api.report(loai, tu, den)
      .then(setRep)
      .catch((e) => { setErr(e.message); setRep(null); })
      .finally(() => setLoading(false));
  }, [live, loai, tu, den]);

  // Chọn nhanh kỳ báo cáo
  const chonKy = (id) => {
    const d = new Date();
    if (id === "hom_nay") { setTu(homNay); setDen(homNay); }
    if (id === "7ngay") { const x = new Date(); x.setDate(x.getDate() - 6); setTu(ngayYMD(x)); setDen(homNay); }
    if (id === "thang") { setTu(dauThang); setDen(homNay); }
    if (id === "nam") { setTu(`${d.getFullYear()}-01-01`); setDen(homNay); }
  };

  const xuatBaoCao = async () => {
    setExporting(true); setErr(null);
    try {
      const blob = await api.exportReportByType(loai, tu, den);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `bao-cao-${loai}-${tu}-${den}.csv`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (e) { setErr(e.message); }
    finally { setExporting(false); }
  };

  const laChuoiThoiGian = (b) => /theo tháng|theo ngày/i.test(b.tieu_de);
  const laTien = (b) => /doanh thu|tiền|viện phí/i.test(b.cot[b.cot.length - 1] || "");

  return (
    <div>
      <PageTitle title="Báo cáo & Thống kê" sub="Chọn loại báo cáo và kỳ báo cáo — toàn bộ số liệu lấy trực tiếp từ cơ sở dữ liệu."
        action={<Btn kind="ghost" onClick={xuatBaoCao} disabled={!live || exporting || (rep && rep.chua_co_du_lieu)}><FileText size={15} /> {exporting ? "Đang xuất..." : "Xuất báo cáo"}</Btn>} />

      {/* Chọn loại báo cáo */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, marginBottom: 16 }}>
        {dsLoai.map((l) => {
          const Icon = ICON_LOAI[l.id] || FileText;
          const chon = l.id === loai;
          return (
            <Card key={l.id} onClick={() => setLoai(l.id)}
              style={{ padding: 16, cursor: "pointer", border: `1.5px solid ${chon ? T.lav : T.line}`, background: chon ? T.lavSoft : T.surface }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 36, height: 36, borderRadius: 11, background: chon ? "#fff" : T.bg, color: T.lav, display: "grid", placeItems: "center", flexShrink: 0 }}><Icon size={18} /></span>
                <div style={{ fontWeight: 800, color: T.ink, fontSize: 14 }}>{l.ten}</div>
              </div>
              <div style={{ color: T.sub, fontSize: 12.5, marginTop: 8, lineHeight: 1.45 }}>{l.mo_ta}</div>
            </Card>
          );
        })}
      </div>

      {/* Kỳ báo cáo */}
      <Card style={{ padding: 16, marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 13.5, color: T.sub, fontWeight: 700 }}>Kỳ báo cáo:</span>
        <input type="date" value={tu} max={den} onChange={(e) => setTu(e.target.value)} style={oNhap} />
        <span style={{ color: T.sub }}>→</span>
        <input type="date" value={den} min={tu} onChange={(e) => setDen(e.target.value)} style={oNhap} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[["hom_nay", "Hôm nay"], ["7ngay", "7 ngày"], ["thang", "Tháng này"], ["nam", "Năm nay"]].map(([id, l]) => (
            <Btn key={id} kind="ghost" size="sm" onClick={() => chonKy(id)}>{l}</Btn>
          ))}
        </div>
      </Card>

      {!live && <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>Cần đăng nhập tài khoản quản trị viên với backend đang chạy để xem báo cáo.</Card>}
      {err && <Card style={{ padding: 16, marginBottom: 14, background: "#FDECEA", border: "none", color: "#C0392B", fontSize: 14 }}>{err}</Card>}
      {live && loading && <div style={{ color: T.sub, fontSize: 14, marginBottom: 12 }}>Đang tổng hợp số liệu...</div>}

      {rep && rep.chua_co_du_lieu && (
        <Card style={{ padding: 34, textAlign: "center" }}>
          <Package size={34} color={T.sub} />
          <div style={{ fontWeight: 800, color: T.ink, fontSize: 16, marginTop: 12 }}>Chưa có dữ liệu cho báo cáo "{rep.ten}"</div>
          <div style={{ color: T.sub, fontSize: 14, marginTop: 8, maxWidth: 620, marginLeft: "auto", marginRight: "auto", lineHeight: 1.5 }}>{rep.chu_thich}</div>
        </Card>
      )}

      {rep && !rep.chua_co_du_lieu && (
        <div>
          {rep.the.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 20 }}>
              {rep.the.map((t, i) => {
                const m = MAU_THE[i % MAU_THE.length];
                const Icon = ICON_LOAI[rep.loai] || Activity;
                return <StatCard key={t.nhan} icon={Icon} tone={m.tone} soft={m.soft} n={dinhDangSo(t.gia_tri, t.dinh_dang)} l={t.nhan} />;
              })}
            </div>
          )}
          {rep.bang.map((b) => (
            <div key={b.tieu_de}>
              {laChuoiThoiGian(b) && b.dong.length > 0 && <BieuDoCot bang={b} tien={laTien(b)} />}
              <BangBaoCao bang={b} tien={laTien(b)} />
            </div>
          ))}
          {rep.chu_thich && <div style={{ color: T.sub, fontSize: 13, fontStyle: "italic", marginBottom: 24 }}>{rep.chu_thich}</div>}
        </div>
      )}
    </div>
  );
}

// Danh sách số trang hiển thị: rút gọn bằng "…" khi có nhiều trang
function danhSachTrang(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, current, current - 1, current + 1]);
  const nums = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out = [];
  let prev = 0;
  for (const n of nums) {
    if (n - prev > 1) out.push(`…${n}`); // khóa duy nhất cho dấu lược
    out.push(n);
    prev = n;
  }
  return out;
}

// Bộ chọn trang cho danh sách phân trang phía client
function Pager({ page, totalPages, total, perPage, onChange }) {
  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);
  const nutTrang = {
    minWidth: 36, height: 36, padding: "0 10px", borderRadius: 10, border: `1px solid ${T.line}`,
    background: T.surface, color: T.ink, fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
  };
  const nav = (p) => () => onChange(Math.min(Math.max(1, p), totalPages));
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap", marginBottom: 16 }}>
      <div style={{ fontSize: 13, color: T.sub }}>
        Hiển thị <b style={{ color: T.ink }}>{from}–{to}</b> trong <b style={{ color: T.ink }}>{total}</b> hoạt động · Trang {page}/{totalPages}
      </div>
      <nav aria-label="Phân trang nhật ký" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <button onClick={nav(page - 1)} disabled={page <= 1} aria-label="Trang trước"
          style={{ ...nutTrang, opacity: page <= 1 ? 0.45 : 1, cursor: page <= 1 ? "default" : "pointer" }}>
          <ChevronLeft size={16} />
        </button>
        {danhSachTrang(page, totalPages).map((n) =>
          typeof n === "string"
            ? <span key={n} style={{ color: T.sub, padding: "0 4px", fontSize: 13.5 }}>…</span>
            : <button key={n} onClick={nav(n)} aria-current={n === page ? "page" : undefined}
                style={{ ...nutTrang, ...(n === page ? { background: T.peach, borderColor: T.peach, color: "#fff" } : {}) }}>{n}</button>
        )}
        <button onClick={nav(page + 1)} disabled={page >= totalPages} aria-label="Trang sau"
          style={{ ...nutTrang, opacity: page >= totalPages ? 0.45 : 1, cursor: page >= totalPages ? "default" : "pointer" }}>
          <ChevronRight size={16} />
        </button>
      </nav>
    </div>
  );
}

// Nhật ký hoạt động: timestamp từng thao tác tạo/sửa/xóa hồ sơ bệnh nhân
// do backend ghi lại (bảng nhat_ky_hoat_dong, GET /admin/activity)
function AdminActivity() {
  const { online } = useNav();
  const live = online && !!store.token;
  const [list, setList] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [page, setPage] = useState(1);
  const PER_PAGE = 20;

  useEffect(() => {
    if (!live) return;
    setLoading(true); setErr(null);
    api.activityLogs()
      .then((r) => setList(Array.isArray(r) ? r : []))
      .catch((e) => { setErr(e.message); setList([]); })
      .finally(() => setLoading(false));
  }, [online]);

  // Về trang 1 mỗi khi dữ liệu được nạp lại
  useEffect(() => { setPage(1); }, [list]);

  const ACT = {
    tao_ho_so: { l: "Tạo hồ sơ", tone: T.mint, soft: T.mintSoft },
    cap_nhat_ho_so: { l: "Cập nhật hồ sơ", tone: T.gold, soft: T.goldSoft },
    xoa_ho_so: { l: "Xóa hồ sơ", tone: "#C0392B", soft: "#FDECEA" },
  };
  const fmt = (t) => {
    const d = new Date(t);
    return isNaN(d) ? "" : d.toLocaleDateString("vi-VN") + " · " + d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  const data = list || [];
  const totalPages = Math.max(1, Math.ceil(data.length / PER_PAGE));
  const trang = Math.min(page, totalPages);
  const pageData = data.slice((trang - 1) * PER_PAGE, trang * PER_PAGE);

  return (
    <div>
      <PageTitle title="Nhật ký hoạt động" sub={live ? "Thời điểm và nội dung từng thao tác trên hồ sơ bệnh nhân." : "Cần kết nối backend để xem nhật ký thật."} />
      {data.length > PER_PAGE && (
        <Pager page={trang} totalPages={totalPages} total={data.length} perPage={PER_PAGE} onChange={setPage} />
      )}
      {loading && <div style={{ color: T.sub, fontSize: 14, marginBottom: 12 }}>Đang tải nhật ký...</div>}
      {err && <Card style={{ padding: 18, marginBottom: 14, background: "#FDECEA", border: "none", color: "#C0392B", fontSize: 14 }}>{err}</Card>}
      {live && !loading && !err && data.length === 0 && <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>Chưa có hoạt động nào được ghi lại.</Card>}
      <div style={{ display: "grid", gap: 12 }}>
        {pageData.map((l) => {
          const a = ACT[l.hanh_dong] || { l: l.hanh_dong, tone: T.sub, soft: "#F0F0F2" };
          return (
            <Card key={l.id} style={{ padding: 18, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <span style={{ width: 44, height: 44, borderRadius: 13, background: a.soft, color: a.tone, display: "grid", placeItems: "center", flexShrink: 0 }}><Clock size={20} /></span>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" }}>
                  <Pill tone={a.tone} soft={a.soft}>{a.l}</Pill>
                  <span style={{ fontSize: 13, color: T.sub, fontWeight: 700 }}>{fmt(l.thoi_gian)}</span>
                </div>
                <div style={{ fontSize: 14.5, color: T.ink, fontWeight: 700, marginTop: 6 }}>{l.noi_dung}</div>
                {l.nguoi_dung && <div style={{ fontSize: 12.5, color: T.sub, marginTop: 3 }}><User size={12} style={{ verticalAlign: -2 }} /> {l.nguoi_dung.ho_ten} ({l.nguoi_dung.email})</div>}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

const iconBtn = { background: T.bg, border: `1px solid ${T.line}`, borderRadius: 10, padding: 9, cursor: "pointer", display: "grid", placeItems: "center" };

export default AdminPortal;
