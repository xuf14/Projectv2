import React, { useState, useEffect } from "react";
import {
  LayoutDashboard, UserCheck, Users, FileText, CheckCircle2, Clock, CalendarCheck,
  ChevronRight, User, Search, X, ClipboardList, Banknote, Stethoscope, Receipt, ListChecks,
  CalendarClock, ExternalLink, Boxes, BedDouble,
} from "lucide-react";
import {
  T, store, api, useNav, Btn, Card, Pill, SectionHead, StatCard, PageTitle, PortalShell,
} from "./shared";
import { ExamHistory } from "./DoctorPortal";
import { PatientList } from "./PatientsPage";
import { AllAppointments, PaymentList } from "./Billing";
import DailyPayments from "./DailyPayments";
import ThongTinBenhNhan from "./thongtinbenhnhan";
import TiepNhanBenhNhan from "./tiepnhan";
import DangKyOnline from "./dangky_online";
import TaiKham from "./taikham";
import YLenh from "./y_lenh";
import TonKhoPage from "./TonKho";
import NhapVienPage from "./nhapvien";
import QuyTrinhKham from "./quytrinhkham";

// ============================================================================
//  CỔNG LỄ TÂN — tách riêng khỏi cổng bác sĩ.
//  Mỗi trang tự nạp dữ liệu từ database qua API với điều kiện & phân quyền riêng:
//  - Tổng quan / Tiếp đón:  GET /reception/today, /reception/lookup/:ma,
//                           POST /reception/checkin/:id   (le_tan, admin)
//  - Hồ sơ bệnh nhân:       GET /patients                 (bac_si, le_tan, admin)
//  - Lịch sử khám:          GET /patients?q= + GET /records/:hoSoId
//  PatientList và ExamHistory dùng chung với DoctorPortal.jsx.
// ============================================================================

// Lịch hẹn trong ngày → dòng trong màn hình tiếp đón
function mapReceptionItem(a) {
  const st = { da_checkin: "checked", da_huy: "cancelled", da_kham: "done" };
  const bs = (a.khung_gio && a.khung_gio.bac_si) || null;
  return { dbId: a.id, code: a.ma_lich_hen, name: (a.ho_so && a.ho_so.ho_ten) || "—",
    time: (a.khung_gio && a.khung_gio.gio_bat_dau) || "", dept: (a.khoa && a.khoa.ten_khoa) || "",
    status: st[a.trang_thai] || "pending", queue: a.so_thu_tu,
    hoSoId: (a.ho_so && a.ho_so.id) || null,
    bacSi: (bs && bs.ho_ten) || "" };  // ho_ten đã kèm học hàm (VD "BS.CKII Lê Hữu Phúc")
}

// Liên kết mở cổng Bác sĩ ở TAB TRÌNH DUYỆT MỚI, vào thẳng "Hàng chờ khám" với đúng
// bệnh nhân đang tiếp đón. Bác sĩ VẪN phải đăng nhập ở tab đó — liên kết không bỏ
// qua xác thực. URL chỉ mang id hồ sơ (số), không kèm tên hay dữ liệu cá nhân.
function urlCongBacSi(hoSoId) {
  if (!hoSoId) return null;
  const u = new URL(window.location.href);
  u.search = `?cong=bac-si&tab=queue&hs=${encodeURIComponent(hoSoId)}`;
  u.hash = "";
  return u.toString();
}

// Thẻ liên kết nổi bật trong dòng lịch hẹn (dùng <a> để tab mới không bị chặn popup)
const lienKetBacSi = {
  display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8,
  padding: "6px 12px", borderRadius: 999, border: `1.5px solid ${T.sky}`,
  background: T.skySoft, color: T.sky, fontSize: 12.5, fontWeight: 800,
  textDecoration: "none", fontFamily: "inherit", cursor: "pointer",
};

// ---------- MOCK DATA (dự phòng khi backend chưa chạy) ----------
const RECEPTION_TODAY = [
  { code: "BV3K9XA", name: "Trần Mai Phương", time: "08:30", dept: "Khoa Sản", status: "checked", queue: 7 },
  { code: "BV8H4LM", name: "Lê Thị Thu", time: "08:30", dept: "Khoa Sản", status: "pending" },
  { code: "BV2D7NK", name: "Phạm Hồng Nhung", time: "09:00", dept: "Khoa Sản", status: "pending" },
];

function ReceptionPortal() {
  const [tab, setTab] = useState("dash");
  // Tham số kèm theo khi một màn hình chuyển sang tab khác (vd: từ điều kiện ĐKRV
  // sang "Y lệnh viện phí" đã lọc sẵn theo bệnh nhân cần thu nốt viện phí).
  const [thamSo, setThamSo] = useState(null);
  const dieuHuong = (tabMoi, ts = null) => { setThamSo(ts); setTab(tabMoi); window.scrollTo(0, 0); };
  const items = [
    { id: "dash", label: "Tổng quan", icon: LayoutDashboard },
    { id: "reception", label: "Tiếp đón", icon: UserCheck },
    { id: "flow", label: "Quy trình khám", icon: ListChecks },
    { id: "examsheet", label: "Thông tin khám bệnh", icon: Stethoscope },
    { id: "ylenh", label: "Y lệnh viện phí", icon: Receipt },
    { id: "nhapvien", label: "Nhập viện", icon: BedDouble },
    { id: "kho", label: "Tồn kho", icon: Boxes },
    { id: "appointments", label: "Tất cả lịch hẹn", icon: ClipboardList },
    { id: "taikham", label: "Tái khám", icon: CalendarClock },
    { id: "daily", label: "Sổ thu trong ngày", icon: Banknote },
    { id: "patients", label: "Hồ sơ bệnh nhân", icon: Users },
    { id: "history", label: "Lịch sử khám", icon: FileText },
  ];
  const name = (store.user && store.user.ho_ten) || "Lễ tân";
  return (
    <PortalShell role="reception" tone={T.gold} soft={T.goldSoft} name={name} sub="Lễ tân" items={items} tab={tab}
      setTab={(t) => dieuHuong(t)}>
      {tab === "dash" && <ReceptionDash setTab={setTab} />}
      {tab === "reception" && <ReceptionArea />}
      {tab === "flow" && <QuyTrinhKham />}
      {tab === "examsheet" && <ThongTinBenhNhan onDieuHuong={dieuHuong} />}
      {tab === "ylenh" && <YLenh tuKhoaBanDau={thamSo && thamSo.q} />}
      {tab === "nhapvien" && <NhapVienPage />}
      {tab === "kho" && <TonKhoPage />}
      {tab === "appointments" && <AllAppointments />}
      {tab === "taikham" && <TaiKham />}
      {tab === "daily" && <SoThuArea />}
      {tab === "patients" && <PatientList />}
      {tab === "history" && <ExamHistory />}
    </PortalShell>
  );
}

// Trang Tiếp đón gồm 2 phần: check-in lịch hẹn hôm nay và tra cứu / tiếp nhận bệnh nhân
function ReceptionArea() {
  const [sub, setSub] = useState("checkin");
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        <Btn kind={sub === "checkin" ? "primary" : "ghost"} size="sm" onClick={() => setSub("checkin")}>Check-in hôm nay</Btn>
        <Btn kind={sub === "tiepnhan" ? "primary" : "ghost"} size="sm" onClick={() => setSub("tiepnhan")}>Tra cứu & tiếp nhận bệnh nhân</Btn>
        <Btn kind={sub === "dangky" ? "primary" : "ghost"} size="sm" onClick={() => setSub("dangky")}>Đăng ký khám online</Btn>
      </div>
      {sub === "checkin" ? <Reception /> : sub === "dangky" ? <DangKyOnline /> : <TiepNhanBenhNhan />}
    </div>
  );
}

// Sổ thu trong ngày gồm 2 phần: sổ thu theo ngày và toàn bộ hóa đơn để thu tiền
function SoThuArea() {
  const [sub, setSub] = useState("sothu");
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <Btn kind={sub === "sothu" ? "primary" : "ghost"} size="sm" onClick={() => setSub("sothu")}>Sổ thu theo ngày</Btn>
        <Btn kind={sub === "hoadon" ? "primary" : "ghost"} size="sm" onClick={() => setSub("hoadon")}>Thanh toán / hóa đơn</Btn>
      </div>
      {sub === "sothu" ? <DailyPayments /> : <PaymentList mode="reception" />}
    </div>
  );
}

// Tổng quan: đếm nhanh lịch hẹn hôm nay theo trạng thái (GET /reception/today)
function ReceptionDash({ setTab }) {
  const { online } = useNav();
  const live = online && !!store.token;
  const [list, setList] = useState(live ? null : RECEPTION_TODAY);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!live) return;
    api.receptionToday()
      .then((r) => setList(Array.isArray(r) ? r.map(mapReceptionItem) : []))
      .catch((e) => { setErr(e.message); setList([]); });
  }, [online]);

  const data = list || [];
  const pending = data.filter((r) => r.status === "pending");
  const checked = data.filter((r) => r.status === "checked");
  return (
    <div>
      <PageTitle title={`Chào ${(store.user && store.user.ho_ten) || "bạn"} 👋`} sub={live ? "Tình hình tiếp đón hôm nay — số liệu lấy trực tiếp từ hệ thống." : "Dữ liệu demo — đăng nhập với backend để xem số liệu thật."} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 26 }} className="grid3">
        <StatCard icon={CalendarCheck} tone={T.gold} soft={T.goldSoft} n={data.length} l="Lịch hẹn hôm nay" />
        <StatCard icon={Clock} tone={T.peach} soft={T.peachSoft} n={pending.length} l="Chờ check-in" />
        <StatCard icon={CheckCircle2} tone={T.mint} soft={T.mintSoft} n={checked.length} l="Đã check-in" />
      </div>
      {err && <Card style={{ padding: 18, marginBottom: 14, background: "#FDECEA", border: "none", color: "#C0392B", fontSize: 14 }}>{err} — trang này cần tài khoản lễ tân.</Card>}
      <SectionHead title="Bệnh nhân chờ check-in" action={<Btn kind="ghost" size="sm" onClick={() => setTab("reception")}>Mở trang Tiếp đón</Btn>} />
      {pending.length === 0 && <Card style={{ padding: 36, textAlign: "center", color: T.sub }}>Không còn bệnh nhân nào chờ check-in.</Card>}
      <div style={{ display: "grid", gap: 12 }}>
        {pending.slice(0, 5).map((r) => (
          <Card key={r.dbId || r.code} style={{ padding: 18, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <span style={{ width: 48, height: 48, borderRadius: 14, background: T.goldSoft, color: T.gold, display: "grid", placeItems: "center", flexShrink: 0 }}><User size={22} /></span>
            <div style={{ flex: 1, minWidth: 150 }}>
              <div style={{ fontWeight: 800, color: T.ink, fontSize: 15.5 }}>{r.name}</div>
              <div style={{ color: T.sub, fontSize: 13.5, marginTop: 4 }}>{r.code} · {r.dept} · {r.time}</div>
            </div>
            <Btn kind="mint" size="sm" onClick={() => setTab("reception")}>Check-in <ChevronRight size={15} /></Btn>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Ngày địa phương dạng YYYY-MM-DD, cộng thêm `them` ngày
const ngayISO = (them = 0) => {
  const d = new Date(); d.setDate(d.getDate() + them);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const nhanNgay = (iso, them) => {
  if (them === 0) return "Hôm nay";
  if (them === 1) return "Ngày mai";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" });
};

// Trang TIẾP ĐÓN: lịch hẹn theo ngày (GET /reception/today?ngay=, quyền le_tan/admin).
// Danh sách chỉ hiện sau khi lễ tân chọn ngày tra cứu — mỗi ngày một danh sách riêng.
function Reception() {
  const { online } = useNav();
  const live = online && !!store.token;
  const [list, setList] = useState(null);
  const [ngay, setNgay] = useState(ngayISO());
  const [daTra, setDaTra] = useState(false);  // chưa tra cứu thì chưa hiện danh sách
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [ma, setMa] = useState("");
  const [found, setFound] = useState(null);   // danh sách lịch hẹn tra cứu theo mã lịch hẹn / mã BN
  const [searchErr, setSearchErr] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = (ngayChon) => {
    const n = ngayChon || ngay;
    setNgay(n); setDaTra(true); setErr(null);
    if (!live) { setList(RECEPTION_TODAY); return; } // demo khi chưa có backend
    setLoading(true);
    api.receptionToday(n)
      .then((r) => setList(Array.isArray(r) ? r.map(mapReceptionItem) : []))
      .catch((e) => { setErr(e.message); setList([]); })
      .finally(() => setLoading(false));
  };

  const search = async () => {
    const q = ma.trim().toUpperCase();
    setFound(null); setSearchErr(null);
    if (!q) return;
    if (!live) { setSearchErr("Chưa kết nối backend — tra cứu chỉ hoạt động với dữ liệu thật."); return; }
    try {
      const r = await api.lookupAppt(q);
      const arr = (Array.isArray(r) ? r : r ? [r] : []).map(mapReceptionItem);
      if (arr.length) setFound(arr);
      else setSearchErr(`Không tìm thấy lịch hẹn hoặc bệnh nhân với mã "${q}".`);
    } catch (e) { setSearchErr(e.message); }
  };

  const checkin = async (item) => {
    setBusyId(item.dbId);
    try {
      await api.checkin(item.dbId);
      setFound(null); setMa("");
      load();
    } catch (e) { setErr(e.message); }
    finally { setBusyId(null); }
  };

  const ReceptionRow = ({ r }) => (
    <Card style={{ padding: 18, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
      <span style={{ width: 48, height: 48, borderRadius: 14, background: T.peachSoft, color: T.peach, display: "grid", placeItems: "center", flexShrink: 0 }}><User size={22} /></span>
      <div style={{ flex: 1, minWidth: 150 }}>
        <div style={{ fontWeight: 800, color: T.ink, fontSize: 15.5 }}>{r.name}</div>
        <div style={{ color: T.sub, fontSize: 13.5, marginTop: 4 }}>{r.code} · {r.dept} · {r.time}</div>
        {r.hoSoId ? (
          <a href={urlCongBacSi(r.hoSoId)} target="_blank" rel="noopener noreferrer" style={lienKetBacSi}
            title="Mở cổng Bác sĩ ở tab mới — bác sĩ điều trị cần đăng nhập bằng tài khoản của mình">
            <Stethoscope size={14} />
            {r.bacSi || "Bác sĩ điều trị"} · Mở cổng bác sĩ
            <ExternalLink size={13} />
          </a>
        ) : r.bacSi ? (
          <div style={{ color: T.sub, fontSize: 12.5, marginTop: 6 }}>{r.bacSi}</div>
        ) : null}
      </div>
      {r.status === "checked" && <Pill tone={T.mint} soft={T.mintSoft}><CheckCircle2 size={13} /> Đã check-in{r.queue ? ` · STT #${r.queue}` : ""}</Pill>}
      {r.status === "cancelled" && <Pill tone="#C0392B" soft="#FDECEA"><X size={13} /> Đã hủy</Pill>}
      {r.status === "done" && <Pill tone={T.sub} soft="#F0F0F2"><CheckCircle2 size={13} /> Đã khám</Pill>}
      {r.status === "pending" && <Btn kind="mint" size="sm" disabled={busyId === r.dbId} onClick={() => checkin(r)}><UserCheck size={15} /> {busyId === r.dbId ? "Đang xử lý..." : "Check-in"}</Btn>}
    </Card>
  );

  const data = list || [];
  return (
    <div>
      <PageTitle title="Tiếp đón bệnh nhân" sub={live ? "Xác nhận lịch hẹn và check-in bệnh nhân đến khám." : "Dữ liệu demo — đăng nhập với backend để thao tác thật."} />
      <Card style={{ padding: 26, marginBottom: 22 }}>
        <div style={{ fontWeight: 800, color: T.ink, fontSize: 16, marginBottom: 16 }}>Tra cứu lịch hẹn / bệnh nhân</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200, display: "flex", alignItems: "center", gap: 10, border: `1.5px solid ${T.line}`, borderRadius: 13, padding: "0 14px" }}>
            <Search size={18} color={T.sub} /><input value={ma} onChange={(e) => setMa(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} placeholder="Nhập mã lịch hẹn hoặc mã bệnh nhân (VD: BV3K9XA, BN12345678)..." style={{ flex: 1, border: "none", outline: "none", padding: "13px 0", fontSize: 15, fontFamily: "inherit", background: "transparent" }} />
          </div>
          <Btn onClick={search}>Tra cứu</Btn>
        </div>
        {searchErr && <div style={{ background: "#FDECEA", color: "#C0392B", fontSize: 13.5, padding: "10px 14px", borderRadius: 12, marginTop: 14 }}>{searchErr}</div>}
        {found && found.length > 0 && (
          <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
            {found.length > 1 && <div style={{ fontSize: 13, color: T.sub }}>Tìm thấy {found.length} lịch hẹn của bệnh nhân:</div>}
            {found.map((r) => <ReceptionRow key={r.dbId} r={r} />)}
          </div>
        )}
      </Card>
      {/* Lịch hẹn theo ngày: bấm một ngày để tra cứu; danh sách chỉ hiện sau khi tra */}
      <Card style={{ padding: 20, marginBottom: 22 }}>
        <div style={{ fontWeight: 800, color: T.ink, fontSize: 16, marginBottom: 14 }}>Lịch hẹn theo ngày</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {[0, 1, 2, 3, 4, 5, 6].map((them) => {
            const iso = ngayISO(them);
            const on = daTra && ngay === iso;
            return (
              <button key={iso} onClick={() => load(iso)}
                style={{ padding: "9px 14px", borderRadius: 12, border: `1.5px solid ${on ? T.gold : T.line}`, background: on ? T.goldSoft : T.surface, color: on ? T.gold : T.ink, fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                {nhanNgay(iso, them)}
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: T.sub, fontWeight: 600 }}>Hoặc chọn ngày khác:</span>
          <input type="date" value={ngay} onChange={(e) => setNgay(e.target.value)}
            style={{ padding: "9px 12px", borderRadius: 12, border: `1.5px solid ${T.line}`, fontSize: 14, fontFamily: "inherit", outline: "none" }} />
          <Btn size="sm" onClick={() => load()}>Xem lịch hẹn</Btn>
        </div>
      </Card>

      {!daTra ? (
        <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>
          Chọn một ngày ở trên để xem danh sách lịch hẹn của ngày đó.
        </Card>
      ) : (
        <>
          <SectionHead title={`Lịch hẹn ngày ${new Date(ngay + "T00:00:00").toLocaleDateString("vi-VN")}`} />
          {loading && <div style={{ color: T.sub, fontSize: 14, marginBottom: 12 }}>Đang tải danh sách...</div>}
          {err && <Card style={{ padding: 18, marginBottom: 14, background: "#FDECEA", border: "none", color: "#C0392B", fontSize: 14 }}>{err} — trang này cần tài khoản lễ tân.</Card>}
          {!loading && !err && data.length === 0 && <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>Ngày này chưa có lịch hẹn nào.</Card>}
          <div style={{ display: "grid", gap: 12 }}>
            {data.map((r) => <ReceptionRow key={r.dbId || r.code} r={r} />)}
          </div>
        </>
      )}
    </div>
  );
}

export default ReceptionPortal;
