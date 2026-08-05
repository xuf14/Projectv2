import React, { useState, useEffect } from "react";
import {
  LayoutDashboard, ClipboardList, UserCheck, Users, FileText, CheckCircle2, Clock,
  ChevronRight, User, NotebookPen, ArrowLeft, Search, Activity, ListChecks, CalendarClock, FlaskConical, HeartPulse,
  Plus, Trash2, X, BedDouble,
} from "lucide-react";
import {
  T, store, api, useNav, Btn, Card, Pill, Avatar, SectionHead, StatCard, PageTitle,
  FormField, input, pickRow, PortalShell, useThongBao, ThongBaoPanel,
} from "./shared";
import { PatientList, tinhTuoi, mapHoSo } from "./PatientsPage";
import PhieuDieuTri from "./phieu_dieu_tri";
import QuyTrinhKham from "./quytrinhkham";
import IvfProcess from "./ivf_quy_trinh";
import RaVienBacSi from "./ravien";
import { NoiTruPage } from "./nhapvien";
import { TaiKhamBacSi, FormTaoTaiKham } from "./taikham";
import { ChonThuoc } from "./y_lenh";

// ============================================================================
//  CỔNG BÁC SĨ — tách riêng khỏi App.jsx.
//  Mỗi trang tự nạp dữ liệu từ database qua API với điều kiện & phân quyền riêng:
//  - Hàng chờ khám:    GET /queue            (bac_si, admin)
//  - Hồ sơ bệnh nhân:  PatientsPage.jsx      (danh sách + calendar lịch khám)
//  - Lịch sử khám:     GET /patients?q= + GET /records/:hoSoId
//  Trang Tiếp đón thuộc cổng Lễ tân (ReceptionPortal.jsx); ExamHistory được
//  export để cổng đó dùng chung.
// ============================================================================

// Lịch hẹn đã check-in → dòng trong hàng chờ khám của bác sĩ
function mapQueueItem(a) {
  return { dbId: a.id, no: a.so_thu_tu || 0, name: (a.ho_so && a.ho_so.ho_ten) || "—",
    hoSoId: (a.ho_so && a.ho_so.id) || null,
    age: tinhTuoi(a.ho_so && a.ho_so.ngay_sinh), time: (a.khung_gio && a.khung_gio.gio_bat_dau) || "",
    reason: (a.khoa && a.khoa.ten_khoa) || "", status: "waiting" };
}

// ---------- MOCK DATA (dự phòng khi backend chưa chạy) ----------
const QUEUE = [
  { no: 1, name: "Nguyễn Thị Hoa", age: 28, time: "08:00", status: "done", reason: "Khám thai 12 tuần" },
  { no: 2, name: "Trần Mai Phương", age: 31, time: "08:30", status: "examining", reason: "Khám thai định kỳ" },
  { no: 3, name: "Lê Thị Thu", age: 26, time: "08:30", status: "waiting", reason: "Tư vấn tiền sản" },
  { no: 4, name: "Phạm Hồng Nhung", age: 34, time: "09:00", status: "waiting", reason: "Siêu âm 4D" },
  { no: 5, name: "Vũ Thị Lan", age: 29, time: "09:00", status: "waiting", reason: "Khám thai 20 tuần" },
];

// ---------- DOCTOR PORTAL ----------
// tabBanDau / thamSo: mở sẵn một tab kèm bệnh nhân cần xử lý khi được mở từ liên
// kết ở cổng khác (vd lễ tân bấm "Mở cổng Bác sĩ ở tab mới" để lập y lệnh ra viện).
function DoctorPortal({ tabBanDau, thamSo }) {
  const [tab, setTab] = useState(tabBanDau || "dash");
  const { online } = useNav();
  const live = online && !!store.token;
  // Icon chuông: bệnh nhân được lễ tân hẹn tái khám với bác sĩ đang đăng nhập
  // Chuông = thông báo hệ thống (lễ tân tạo lịch tái khám, ...)
  const tb = useThongBao(live);
  const [revisits, setRevisits] = useState([]);
  const loadRevisits = () => {
    if (!live) return;
    api.doctorRevisits().then((r) => setRevisits(Array.isArray(r) ? r : [])).catch(() => {});
    tb.load();
  };
  useEffect(loadRevisits, [live]);
  // Chỉ bác sĩ khoa Hỗ trợ sinh sản (IVF) mới thấy tab quy trình IVF
  const [laIVF, setLaIVF] = useState(false);
  useEffect(() => {
    if (!live) return;
    api.ivfList().then((r) => setLaIVF(!!(r && r.la_ivf))).catch(() => setLaIVF(false));
  }, [live]);
  const items = [
    { id: "dash", label: "Tổng quan", icon: LayoutDashboard },
    { id: "queue", label: "Hàng chờ khám", icon: ClipboardList },
    { id: "flow", label: "Khám lâm sàng và cận lâm sàng", icon: ListChecks },
    ...(laIVF ? [{ id: "ivf", label: "Hỗ trợ sinh sản (IVF)", icon: FlaskConical }] : []),
    { id: "treatment", label: "Phiếu điều trị", icon: Activity },
    { id: "noitru", label: "Người bệnh nội trú", icon: BedDouble },
    { id: "ravien", label: "Ra viện", icon: HeartPulse },
    { id: "taikham", label: "Bệnh nhân tái khám", icon: CalendarClock },
    { id: "patients", label: "Hồ sơ bệnh nhân", icon: Users },
    { id: "history", label: "Lịch sử khám", icon: FileText },
  ];
  const name = (store.user && store.user.ho_ten) || "BS. Nguyễn Thị Lan";
  return (
    <PortalShell role="doctor" tone={T.sky} soft={T.skySoft} name={name} sub="Bác sĩ" items={items} tab={tab} setTab={setTab}
      bell={{
        count: tb.chuaDoc + revisits.length,
        panel: (
          <div>
            <ThongBaoPanel list={tb.list} docTatCa={tb.docTatCa} />
            <div style={{ borderTop: `2px solid ${T.line}` }}>
              <RevisitPanel list={revisits} onOpen={() => setTab("taikham")} />
            </div>
          </div>
        ),
      }}>
      {tab === "dash" && <DoctorDash setTab={setTab} />}
      {tab === "queue" && <DoctorQueue hoSoBanDau={tabBanDau === "queue" ? thamSo && thamSo.hs : null} />}
      {tab === "flow" && <QuyTrinhKham />}
      {tab === "ivf" && <IvfProcess />}
      {tab === "treatment" && <PhieuDieuTri />}
      {tab === "noitru" && <NoiTruPage />}
      {tab === "ravien" && <RaVienBacSi hoSoBanDau={thamSo && thamSo.hs} />}
      {tab === "taikham" && <TaiKhamBacSi onChanged={loadRevisits} />}
      {tab === "patients" && <PatientList />}
      {tab === "history" && <ExamHistory />}
    </PortalShell>
  );
}

// Bảng thả xuống từ icon chuông: bệnh nhân được hẹn tái khám với bác sĩ đang đăng nhập
function RevisitPanel({ list, onOpen }) {
  const fmtNgay = (d) => { const x = new Date(d); return isNaN(x) ? "" : x.toLocaleDateString("vi-VN"); };
  return (
    <div>
      <div style={{ padding: "13px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <span style={{ fontWeight: 800, color: T.ink, fontSize: 14 }}>Bệnh nhân hẹn tái khám ({list.length})</span>
        {list.length > 0 && <Btn kind="ghost" size="sm" onClick={onOpen}>Mở danh sách</Btn>}
      </div>
      {list.length === 0 ? (
        <div style={{ padding: "8px 16px 20px", textAlign: "center", color: T.sub, fontSize: 13.5 }}>
          Chưa có bệnh nhân nào được hẹn tái khám với bạn.
        </div>
      ) : list.map((r) => (
        <div key={r.ho_so_id} style={{ padding: "11px 16px", borderTop: `1px solid ${T.line}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: 700, color: T.ink, fontSize: 13.5 }}>{r.ho_ten}</span>
            <Pill tone={T.gold} soft={T.goldSoft}>{fmtNgay(r.ngay_tai_kham)}</Pill>
          </div>
          <div style={{ fontSize: 12.5, color: T.sub, marginTop: 3 }}>
            {r.ma_benh_nhan}{r.sdt ? ` · ${r.sdt}` : ""}
          </div>
          {r.ghi_chu_tai_kham && (
            <div style={{ fontSize: 12.5, color: T.ink, marginTop: 3, whiteSpace: "pre-wrap" }}>📎 {r.ghi_chu_tai_kham}</div>
          )}
        </div>
      ))}
    </div>
  );
}

// Tổng quan bác sĩ: số liệu hôm nay + hàng chờ, đếm trực tiếp từ database
// (GET /doctor/summary + GET /queue); chưa có backend thì hiển thị demo.
function DoctorDash({ setTab }) {
  const { online } = useNav();
  const live = online && !!store.token;
  const [sum, setSum] = useState(null);
  const [queue, setQueue] = useState(live ? null : QUEUE);
  const [sapToi, setSapToi] = useState([]);   // lịch khám sắp tới (gồm đăng ký online)
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!live) return;
    api.doctorSummary().then(setSum).catch((e) => setErr(e.message));
    api.queue().then((r) => setQueue(Array.isArray(r) ? r.map(mapQueueItem) : [])).catch(() => setQueue([]));
    api.doctorUpcoming().then((r) => setSapToi(Array.isArray(r) ? r : [])).catch(() => setSapToi([]));
  }, [online]);

  const name = (store.user && store.user.ho_ten) || "BS. Nguyễn Thị Lan";
  const today = new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
  const q = queue || [];
  const next = live ? q[0] : QUEUE.find((x) => x.status === "examining");
  const stats = live
    ? [["Bệnh nhân hôm nay", sum ? sum.hom_nay : "...", ClipboardList, T.sky, T.skySoft],
       ["Đã khám xong", sum ? sum.da_kham : "...", CheckCircle2, T.mint, T.mintSoft],
       ["Đang chờ khám", sum ? sum.cho_kham : "...", Clock, T.gold, T.goldSoft]]
    : [["Bệnh nhân hôm nay", 12, ClipboardList, T.sky, T.skySoft],
       ["Đã khám xong", 5, CheckCircle2, T.mint, T.mintSoft],
       ["Đang chờ", 6, Clock, T.gold, T.goldSoft],
       ["Đang khám", 1, UserCheck, T.peach, T.peachSoft]];
  return (
    <div>
      <PageTitle title={`Chào ${name} 👩‍⚕️`} sub={`Hôm nay, ${today}` + (live ? " — số liệu lấy trực tiếp từ hệ thống." : " (dữ liệu demo)")} />
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${stats.length}, 1fr)`, gap: 16, marginBottom: 26 }} className={stats.length === 3 ? "grid3" : "grid4"}>
        {stats.map(([l, n, Icon, tone, soft]) => <StatCard key={l} icon={Icon} tone={tone} soft={soft} n={n} l={l} />)}
      </div>
      {err && <Card style={{ padding: 18, marginBottom: 14, background: "#FDECEA", border: "none", color: "#C0392B", fontSize: 14 }}>{err} — trang này cần tài khoản bác sĩ.</Card>}
      <Card style={{ padding: 26, marginBottom: 22, background: `linear-gradient(120deg, ${T.skySoft}, ${T.mintSoft})`, border: "none", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        {next ? (
          <div>
            <Pill tone={T.sky} soft="#fff"><UserCheck size={13} /> {live ? "Tiếp theo trong hàng chờ" : "Đang khám"}</Pill>
            <div style={{ fontSize: 20, fontWeight: 800, color: T.ink, margin: "12px 0 4px" }}>STT #{next.no} · {next.name}</div>
            <div style={{ color: T.ink, opacity: .7, fontSize: 14 }}>{qInfo(next)}</div>
          </div>
        ) : (
          <div>
            <Pill tone={T.sky} soft="#fff"><UserCheck size={13} /> Hàng chờ</Pill>
            <div style={{ fontSize: 20, fontWeight: 800, color: T.ink, margin: "12px 0 4px" }}>Chưa có bệnh nhân chờ khám</div>
            <div style={{ color: T.ink, opacity: .7, fontSize: 14 }}>Bệnh nhân sẽ xuất hiện tại đây sau khi lễ tân check-in.</div>
          </div>
        )}
        <Btn kind="mint" onClick={() => setTab("queue")}>{next ? "Bắt đầu khám" : "Mở hàng chờ"} <ChevronRight size={16} /></Btn>
      </Card>
      <SectionHead title="Bệnh nhân tiếp theo" action={<Btn kind="ghost" size="sm" onClick={() => setTab("queue")}>Xem hàng chờ</Btn>} />
      {live && q.length === 0 && <Card style={{ padding: 36, textAlign: "center", color: T.sub }}>Hàng chờ hôm nay đang trống.</Card>}
      <div style={{ display: "grid", gap: 12 }}>
        {(live ? q.slice(0, 3) : QUEUE.filter((x) => x.status === "waiting").slice(0, 3)).map((x) => <QueueRow key={x.dbId || x.no} q={x} compact />)}
      </div>
      {live && <LichSapToi list={sapToi} />}
    </div>
  );
}

const TT_LICH = {
  cho_xac_nhan: { l: "Chờ xác nhận", tone: T.gold, soft: T.goldSoft },
  da_xac_nhan: { l: "Đã xác nhận", tone: T.sky, soft: T.skySoft },
  da_checkin: { l: "Đã check-in", tone: T.mint, soft: T.mintSoft },
};

// Lịch khám sắp tới của chính bác sĩ — gồm lịch lễ tân xác nhận từ phiếu đăng ký
// khám online của bệnh nhân (GET /doctor/upcoming).
function LichSapToi({ list }) {
  const fmt = (d) => { const x = new Date(d); return isNaN(x) ? "—" : x.toLocaleDateString("vi-VN"); };
  const homNay = new Date().toLocaleDateString("en-CA");
  return (
    <div style={{ marginTop: 26 }}>
      <SectionHead title="Lịch khám sắp tới" />
      {list.length === 0 ? (
        <Card style={{ padding: 32, textAlign: "center", color: T.sub }}>
          Chưa có lịch khám nào được đặt cho bạn từ hôm nay trở đi.
        </Card>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {list.slice(0, 8).map((a) => {
            const st = TT_LICH[a.trang_thai] || TT_LICH.da_xac_nhan;
            return (
              <Card key={a.id} style={{ padding: 15, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <span style={{ minWidth: 96, borderRadius: 12, background: st.soft, color: st.tone, padding: "8px 10px", textAlign: "center", flexShrink: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700 }}>{a.ngay === homNay ? "Hôm nay" : fmt(a.ngay)}</div>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>{a.gio || "—"}</div>
                </span>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 800, color: T.ink, fontSize: 15 }}>{a.benh_nhan || "—"}</span>
                    <Pill tone={st.tone} soft={st.soft}>{st.l}</Pill>
                  </div>
                  <div style={{ color: T.sub, fontSize: 13.5, marginTop: 4 }}>
                    {[a.ma_benh_nhan, a.khoa, a.sdt, `Mã lịch ${a.ma_lich_hen}`].filter(Boolean).join(" · ")}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

const QSTATUS = {
  done: { l: "Đã khám", tone: T.mint, soft: T.mintSoft },
  examining: { l: "Đang khám", tone: T.peach, soft: T.peachSoft },
  waiting: { l: "Đang chờ", tone: T.gold, soft: T.goldSoft },
};

const qInfo = (q) => [q.age != null ? `${q.age} tuổi` : null, q.reason, q.time].filter(Boolean).join(" · ");

function QueueRow({ q, compact, onExam, noiBat }) {
  const s = QSTATUS[q.status];
  return (
    <Card style={{ padding: 18, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
      ...(noiBat ? { border: `2px solid ${T.gold}`, background: T.goldSoft } : null) }}>
      <span style={{ width: 48, height: 48, borderRadius: 14, background: s.soft, color: s.tone, display: "grid", placeItems: "center", fontWeight: 800, fontSize: 17, flexShrink: 0 }}>#{q.no}</span>
      <div style={{ flex: 1, minWidth: 150 }}>
        <div style={{ display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" }}><span style={{ fontWeight: 800, color: T.ink, fontSize: 15.5 }}>{q.name}</span><Pill tone={s.tone} soft={s.soft}>{s.l}</Pill></div>
        <div style={{ color: T.sub, fontSize: 13.5, marginTop: 5 }}>{qInfo(q)}</div>
      </div>
      {!compact && q.status === "waiting" && <Btn kind="mint" size="sm" onClick={onExam}><NotebookPen size={15} /> Bắt đầu khám</Btn>}
      {!compact && q.status === "examining" && <Btn size="sm" onClick={onExam}><NotebookPen size={15} /> Ghi kết quả</Btn>}
    </Card>
  );
}

// Trang riêng của BÁC SĨ: nạp lịch hẹn đã check-in (GET /queue, quyền bac_si/admin)
// hoSoBanDau: id hồ sơ đi kèm liên kết từ cổng Lễ tân — làm nổi bật đúng bệnh nhân
// trong hàng chờ (vẫn chỉ hiện những bệnh nhân thuộc phạm vi của bác sĩ đang đăng nhập).
function DoctorQueue({ hoSoBanDau }) {
  const { online } = useNav();
  const live = online && !!store.token;
  const [exam, setExam] = useState(null);
  const [list, setList] = useState(live ? null : QUEUE);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [tb, setTb] = useState(null);   // tóm tắt sau khi lưu kết quả khám

  const load = () => {
    if (!live) return;
    setLoading(true); setErr(null);
    api.queue()
      .then((r) => setList(Array.isArray(r) ? r.map(mapQueueItem) : []))
      .catch((e) => { setErr(e.message); setList([]); })
      .finally(() => setLoading(false));
  };
  useEffect(load, [online]);

  if (exam) return (
    <ExamForm q={exam} live={live}
      onBack={(saved, thongBao) => { setExam(null); setTb(thongBao || null); if (saved) load(); }} />
  );
  const data = list || [];
  // Bệnh nhân từ liên kết chưa nằm trong hàng chờ (chưa check-in, hoặc thuộc bác sĩ khác)
  const ngoaiHangCho = !!hoSoBanDau && !loading && !err && list !== null
    && !data.some((q) => q.hoSoId === hoSoBanDau);
  return (
    <div>
      <PageTitle title="Hàng chờ khám" sub={live ? "Bệnh nhân đã check-in, chờ khám hôm nay." : "Dữ liệu demo — đăng nhập với backend để xem hàng chờ thật."} />
      {tb && (
        <Card style={{ padding: 16, marginBottom: 14, background: T.mintSoft, border: "none", color: "#2F8F73", fontSize: 13.5, lineHeight: 1.5, display: "flex", gap: 10, alignItems: "flex-start" }}>
          <CheckCircle2 size={17} style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ flex: 1 }}>{tb}</span>
          <button onClick={() => setTb(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#2F8F73", padding: 0 }}><X size={16} /></button>
        </Card>
      )}
      {loading && <div style={{ color: T.sub, fontSize: 14, marginBottom: 12 }}>Đang tải hàng chờ...</div>}
      {err && <Card style={{ padding: 18, marginBottom: 14, background: "#FDECEA", border: "none", color: "#C0392B", fontSize: 14 }}>{err} — trang này cần tài khoản bác sĩ.</Card>}
      {ngoaiHangCho && (
        <Card style={{ padding: 16, marginBottom: 14, background: T.goldSoft, border: `1.5px solid ${T.gold}`, color: T.ink, fontSize: 13.5, lineHeight: 1.5 }}>
          Bệnh nhân được lễ tân mở từ liên kết chưa có trong hàng chờ của bạn — bệnh nhân
          cần được check-in và lịch hẹn phải thuộc bác sĩ đang đăng nhập.
        </Card>
      )}
      {!loading && !err && data.length === 0 && <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>Chưa có bệnh nhân nào trong hàng chờ.</Card>}
      <div style={{ display: "grid", gap: 12 }}>
        {data.map((q) => (
          <QueueRow key={q.dbId || q.no} q={q} onExam={() => setExam(q)}
            noiBat={!!hoSoBanDau && q.hoSoId === hoSoBanDau} />
        ))}
      </div>
    </div>
  );
}

// Ngày hẹn tái khám tính từ khoảng thời gian bác sĩ chọn. Chỉ để HIỂN THỊ —
// backend tính lại ngày thật khi lưu nên đồng hồ máy trạm sai cũng không lệch dữ liệu.
function ngayTuKhoang(so, donVi) {
  const n = Number(so);
  if (!Number.isInteger(n) || n <= 0) return null;
  const soNgay = donVi === "tuan" ? n * 7 : n;
  if (soNgay > 365) return null;
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + soNgay);
  return d;
}

function ExamForm({ q, live, onBack }) {
  const [f, setF] = useState({ chan_doan: "", chi_dinh: "", ghi_chu: "" });
  // Đơn thuốc theo dòng: chọn từ DANH MỤC THUỐC dùng chung với chi tiết viện phí,
  // hoặc thêm dòng trống để gõ tay. Không có đơn giá — lễ tân nhập theo bảng giá.
  const [thuoc, setThuoc] = useState([]);
  const [henSo, setHenSo] = useState("");         // để trống = không hẹn tái khám
  const [henDonVi, setHenDonVi] = useState("ngay");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const upd = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const dongTrong = () => ({ ma_thuoc: "", ten: "", so_luong: 1, dvt: "", lieu_dung: "", cach_dung: "" });
  // Giữ mã danh mục thuốc để lễ tân trừ đúng mặt hàng ở tủ thuốc khi lập viện phí
  const themThuoc = (t) => setThuoc((ds) => [...ds, {
    ...dongTrong(), ma_thuoc: t.ma_thuoc, ten: t.hoat_chat, dvt: t.dvt || "",
  }]);
  const suaThuoc = (i, k, v) => setThuoc((ds) => ds.map((d, idx) => (idx === i ? { ...d, [k]: v } : d)));
  const xoaThuoc = (i) => setThuoc((ds) => ds.filter((_, idx) => idx !== i));

  const ngayHen = ngayTuKhoang(henSo, henDonVi);
  const henLoi = henSo.trim() !== "" && !ngayHen;

  // Lưu kết quả khám vào database (POST /visits/:id/result); demo thì chỉ quay lại
  const save = async () => {
    if (!live || !q.dbId) { onBack(false); return; }
    if (!f.chan_doan.trim()) { setErr("Vui lòng nhập chẩn đoán trước khi lưu."); return; }
    if (thuoc.some((t) => !t.ten.trim())) { setErr("Mỗi dòng thuốc phải có tên — xóa dòng trống trước khi lưu."); return; }
    if (thuoc.some((t) => !(Number(t.so_luong) > 0))) { setErr("Số lượng thuốc phải lớn hơn 0."); return; }
    if (henLoi) { setErr("Khoảng hẹn tái khám phải là số nguyên dương và không quá 365 ngày."); return; }
    setBusy(true); setErr(null);
    try {
      const r = await api.saveResult(q.dbId, {
        ...f,
        thuoc: thuoc.map((t) => ({
          ten: t.ten.trim(), so_luong: Number(t.so_luong), dvt: t.dvt,
          lieu_dung: t.lieu_dung, cach_dung: t.cach_dung,
        })),
        tai_kham: ngayHen ? { so: Number(henSo), don_vi: henDonVi } : undefined,
      });
      const tk = r && r.tai_kham;
      onBack(true, `Đã lưu kết quả khám cho ${q.name}` +
        (thuoc.length ? ` · kê ${thuoc.length} thuốc (lễ tân nạp được vào chi tiết viện phí)` : "") +
        (tk ? ` · hẹn tái khám ${new Date(tk.ngay + "T00:00:00").toLocaleDateString("vi-VN")} lúc ${tk.gio} — đã vào lịch check-in của lễ tân (mã ${tk.ma_lich_hen})` : ""));
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const oNho = { ...input, padding: "8px 10px", fontSize: 13.5 };
  return (
    <div>
      <button onClick={() => onBack(false)} style={{ background: "none", border: "none", color: T.sub, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", gap: 5, marginBottom: 16 }}><ArrowLeft size={15} /> Về hàng chờ</button>
      <PageTitle title={`Khám: ${q.name}`} sub={`STT #${q.no}` + (qInfo(q) ? ` · ${qInfo(q)}` : "")} />
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20 }} className="examGrid">
        <Card style={{ padding: 26 }}>
          <div style={{ fontWeight: 800, color: T.ink, fontSize: 17, marginBottom: 18 }}>Ghi nhận kết quả khám</div>
          <div style={{ display: "grid", gap: 16 }}>
            <FormField label="Chẩn đoán"><textarea value={f.chan_doan} onChange={upd("chan_doan")} placeholder="Nhập chẩn đoán..." style={{ ...input, minHeight: 80, resize: "vertical" }} /></FormField>
            <FormField label="Chỉ định cận lâm sàng"><textarea value={f.chi_dinh} onChange={upd("chi_dinh")} placeholder="Siêu âm, xét nghiệm..." style={{ ...input, minHeight: 60, resize: "vertical" }} /></FormField>

            {/* Đơn thuốc — cùng danh mục với "Chi tiết viện phí" của lễ tân */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: T.sub }}>Đơn thuốc</span>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <ChonThuoc onChon={themThuoc} />
                  <Btn kind="soft" size="sm" onClick={() => setThuoc((ds) => [...ds, dongTrong()])}><Plus size={14} /> Thuốc trống</Btn>
                </div>
              </div>
              {thuoc.length === 0 ? (
                <div style={{ padding: 18, textAlign: "center", color: T.sub, fontSize: 13.5, border: `1.5px dashed ${T.line}`, borderRadius: 12 }}>
                  Chưa kê thuốc. Chọn từ danh mục để lễ tân nạp thẳng vào chi tiết viện phí.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {thuoc.map((t, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "1.6fr 62px 74px 1fr 1fr 32px", gap: 6, alignItems: "center" }}>
                      <input value={t.ten} onChange={(e) => suaThuoc(i, "ten", e.target.value)} placeholder="Tên thuốc" style={oNho} />
                      <input type="number" min="0" step="any" value={t.so_luong} onChange={(e) => suaThuoc(i, "so_luong", e.target.value)} placeholder="SL" style={oNho} />
                      <input value={t.dvt} onChange={(e) => suaThuoc(i, "dvt", e.target.value)} placeholder="ĐVT" style={oNho} />
                      <input value={t.lieu_dung} onChange={(e) => suaThuoc(i, "lieu_dung", e.target.value)} placeholder="Liều dùng" style={oNho} />
                      <input value={t.cach_dung} onChange={(e) => suaThuoc(i, "cach_dung", e.target.value)} placeholder="Cách dùng" style={oNho} />
                      <button onClick={() => xoaThuoc(i)} title="Xóa dòng"
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#C0392B", padding: 4 }}><Trash2 size={15} /></button>
                    </div>
                  ))}
                  <div style={{ fontSize: 12.5, color: T.sub }}>
                    Đơn giá không nhập ở đây — lễ tân nạp đơn này vào "Chi tiết viện phí" rồi áp bảng giá bệnh viện.
                  </div>
                </div>
              )}
            </div>

            <FormField label="Ghi chú & lời dặn"><input value={f.ghi_chu} onChange={upd("ghi_chu")} placeholder="VD: Uống thuốc sau ăn, kiêng vận động mạnh" style={input} /></FormField>

            {/* Hẹn tái khám: nhập khoảng thời gian, ngày hẹn tự tính */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.sub, marginBottom: 8 }}>Hẹn tái khám sau</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input type="number" min="1" max="365" value={henSo} onChange={(e) => setHenSo(e.target.value)}
                  placeholder="VD: 10" style={{ ...oNho, width: 100 }} />
                <select value={henDonVi} onChange={(e) => setHenDonVi(e.target.value)} style={{ ...oNho, width: 110 }}>
                  <option value="ngay">ngày</option>
                  <option value="tuan">tuần</option>
                </select>
                {[7, 10, 14, 30].map((n) => (
                  <Btn key={n} kind="soft" size="sm" onClick={() => { setHenSo(String(n)); setHenDonVi("ngay"); }}>{n} ngày</Btn>
                ))}
                {henSo && <Btn kind="ghost" size="sm" onClick={() => setHenSo("")}>Không hẹn</Btn>}
              </div>
              {ngayHen && (
                <div style={{ marginTop: 9, padding: "9px 13px", background: T.mintSoft, borderRadius: 11, fontSize: 13, color: T.ink, lineHeight: 1.5 }}>
                  <CalendarClock size={14} style={{ verticalAlign: -2 }} /> Ngày hẹn: <b>{ngayHen.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}</b> lúc 08:00 —
                  lịch hẹn sẽ tự vào danh sách check-in của lễ tân ngày đó.
                </div>
              )}
              {henLoi && <div style={{ marginTop: 9, fontSize: 13, color: "#C0392B" }}>Nhập số nguyên dương, tối đa 365 ngày.</div>}
            </div>
          </div>
          {err && <div style={{ background: "#FDECEA", color: "#C0392B", fontSize: 13.5, padding: "10px 14px", borderRadius: 12, marginTop: 14 }}>{err}</div>}
          <div style={{ display: "flex", gap: 12, marginTop: 22 }}>
            <Btn kind="ghost" onClick={() => onBack(false)}>Hủy bỏ</Btn>
            <Btn kind="mint" disabled={busy} onClick={save}><CheckCircle2 size={16} /> {busy ? "Đang lưu..." : "Hoàn thành & lưu"}</Btn>
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

// Trang LỊCH SỬ KHÁM: tra cứu bệnh nhân theo tên/mã BN/SĐT (GET /patients?q=)
// rồi xem toàn bộ lịch sử khám đã lưu trong database (GET /records/:hoSoId)
function ExamHistory() {
  const { online } = useNav();
  const live = online && !!store.token;
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);   // danh sách hồ sơ khớp truy vấn
  const [selected, setSelected] = useState(null); // hồ sơ đang xem lịch sử
  const [records, setRecords] = useState(null);   // lượt khám của hồ sơ đã chọn
  const [loading, setLoading] = useState(false);
  const [loadingRec, setLoadingRec] = useState(false);
  const [err, setErr] = useState(null);
  const [moTaiKham, setMoTaiKham] = useState(false);
  const [tuNgay, setTuNgay] = useState("");   // lọc lịch sử khám theo khoảng ngày
  const [denNgay, setDenNgay] = useState("");
  // Chỉ lễ tân/admin được tạo lịch tái khám (backend cũng chặn vai trò khác)
  const vaiTro = (store.user && store.user.vai_tro) || "";
  const laLeTan = vaiTro === "le_tan" || vaiTro === "admin";

  const search = async () => {
    if (!live) { setErr("Chưa kết nối backend — tra cứu lịch sử khám cần dữ liệu thật."); return; }
    setLoading(true); setErr(null); setSelected(null); setRecords(null);
    try {
      const r = await api.patients(q.trim());
      setResults(Array.isArray(r) ? r.map(mapHoSo) : []);
    } catch (e) { setErr(e.message); setResults([]); }
    finally { setLoading(false); }
  };

  const view = async (p) => {
    setSelected(p); setRecords(null); setErr(null); setMoTaiKham(false); setTuNgay(""); setDenNgay(""); setLoadingRec(true);
    try {
      const r = await api.records(p.dbId);
      setRecords(Array.isArray(r) ? r : []);
    } catch (e) { setErr(e.message); setRecords([]); }
    finally { setLoadingRec(false); }
  };

  const fmtTime = (t) => { const d = new Date(t); return isNaN(d) ? "" : d.toLocaleDateString("vi-VN") + " " + d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }); };
  // Ngày (theo giờ địa phương) của một lượt khám, dạng YYYY-MM-DD để so khớp bộ lọc
  const ngayCua = (t) => { const d = new Date(t); return isNaN(d) ? "" : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const recordsLoc = (records || []).filter((r) => {
    const day = ngayCua(r.thoi_gian);
    return (!tuNgay || (day && day >= tuNgay)) && (!denNgay || (day && day <= denNgay));
  });
  const dateInp = { padding: "8px 10px", borderRadius: 10, border: `1.5px solid ${T.line}`, fontFamily: "inherit", fontSize: 13.5, outline: "none" };

  return (
    <div>
      <PageTitle title="Lịch sử khám" sub="Tra cứu bệnh nhân để xem lịch sử khám đã lưu trong hệ thống." />
      <Card style={{ padding: 26, marginBottom: 22 }}>
        <div style={{ fontWeight: 800, color: T.ink, fontSize: 16, marginBottom: 16 }}>Tra cứu bệnh nhân</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200, display: "flex", alignItems: "center", gap: 10, border: `1.5px solid ${T.line}`, borderRadius: 13, padding: "0 14px" }}>
            <Search size={18} color={T.sub} /><input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} placeholder="Nhập tên, mã bệnh nhân hoặc SĐT..." style={{ flex: 1, border: "none", outline: "none", padding: "13px 0", fontSize: 15, fontFamily: "inherit", background: "transparent" }} />
          </div>
          <Btn kind="mint" onClick={search} disabled={loading}>{loading ? "Đang tìm..." : "Tra cứu"}</Btn>
        </div>
        {err && <div style={{ background: "#FDECEA", color: "#C0392B", fontSize: 13.5, padding: "10px 14px", borderRadius: 12, marginTop: 14 }}>{err}</div>}
      </Card>

      {results && !selected && (
        <div>
          <SectionHead title={`Kết quả (${results.length})`} />
          {results.length === 0 && <Card style={{ padding: 36, textAlign: "center", color: T.sub }}>Không tìm thấy bệnh nhân nào khớp truy vấn.</Card>}
          <div style={{ display: "grid", gap: 12 }}>
            {results.map((p) => (
              <button key={p.dbId} onClick={() => view(p)} className="pickRow" style={pickRow}>
                <Avatar size={46} tone={T.skySoft} color={T.sky} icon={User} />
                <div style={{ textAlign: "left", flex: 1 }}>
                  <div style={{ fontWeight: 800, color: T.ink, fontSize: 15.5 }}>{p.name}</div>
                  <div style={{ fontSize: 13.5, color: T.sub, marginTop: 2 }}>{p.code} · {p.phone}{p.age != null ? ` · ${p.age} tuổi` : ""} · {p.visits} lượt đặt</div>
                </div>
                <ChevronRight size={20} color={T.sub} />
              </button>
            ))}
          </div>
        </div>
      )}

      {selected && (
        <div>
          <button onClick={() => { setSelected(null); setRecords(null); }} style={{ background: "none", border: "none", color: T.sub, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", gap: 5, marginBottom: 14 }}><ArrowLeft size={15} /> Về kết quả tra cứu</button>
          <Card style={{ padding: 22, marginBottom: 18, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <Avatar size={54} tone={T.skySoft} color={T.sky} icon={User} />
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontWeight: 800, color: T.ink, fontSize: 17 }}>{selected.name}</div>
              <div style={{ color: T.sub, fontSize: 13.5, marginTop: 3 }}>{selected.code} · {selected.phone}{selected.age != null ? ` · ${selected.age} tuổi` : ""}</div>
            </div>
            {/* Lễ tân/admin tạo lịch tái khám ngay từ tên bệnh nhân đang xem */}
            {laLeTan && !moTaiKham && (
              <Btn size="sm" onClick={() => setMoTaiKham(true)}>
                <CalendarClock size={15} /> Tạo lịch tái khám
              </Btn>
            )}
          </Card>

          {moTaiKham && (
            <div style={{ marginBottom: 18 }}>
              <FormTaoTaiKham hoSoId={selected.dbId} tenBenhNhan={selected.name} maBenhNhan={selected.code}
                onHuy={() => setMoTaiKham(false)} />
            </div>
          )}
          {loadingRec && <div style={{ color: T.sub, fontSize: 14, marginBottom: 12 }}>Đang tải lịch sử khám...</div>}
          {records && records.length > 0 && (
            <Card style={{ padding: "14px 18px", marginBottom: 14, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>Lọc theo ngày khám:</span>
              <label style={{ fontSize: 13, color: T.sub, display: "flex", alignItems: "center", gap: 6 }}>Từ
                <input type="date" value={tuNgay} max={denNgay || undefined} onChange={(e) => setTuNgay(e.target.value)} style={dateInp} /></label>
              <label style={{ fontSize: 13, color: T.sub, display: "flex", alignItems: "center", gap: 6 }}>Đến
                <input type="date" value={denNgay} min={tuNgay || undefined} onChange={(e) => setDenNgay(e.target.value)} style={dateInp} /></label>
              {(tuNgay || denNgay) && <Btn kind="ghost" size="sm" onClick={() => { setTuNgay(""); setDenNgay(""); }}>Xóa lọc</Btn>}
              <span style={{ fontSize: 13, color: T.sub, marginLeft: "auto" }}>{recordsLoc.length}/{records.length} lượt khám</span>
            </Card>
          )}
          {records && records.length === 0 && !loadingRec && <Card style={{ padding: 36, textAlign: "center", color: T.sub }}>Bệnh nhân này chưa có lượt khám nào trong hệ thống.</Card>}
          {records && records.length > 0 && recordsLoc.length === 0 && <Card style={{ padding: 36, textAlign: "center", color: T.sub }}>Không có lượt khám nào trong khoảng ngày đã chọn.</Card>}
          <div style={{ display: "grid", gap: 14 }}>
            {recordsLoc.map((r) => (
              <Card key={r.id} style={{ padding: 22 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <Pill tone={T.sky} soft={T.skySoft}>{fmtTime(r.thoi_gian)}</Pill>
                  {r.lich_hen && <span style={{ fontSize: 12.5, color: T.sub }}>Mã lịch: <b style={{ color: T.ink }}>{r.lich_hen.ma_lich_hen}</b></span>}
                  {r.bac_si && <span style={{ fontSize: 12.5, color: T.sub }}><User size={12} style={{ verticalAlign: -2 }} /> {r.bac_si.ho_ten}</span>}
                </div>
                <div style={{ fontWeight: 800, color: T.ink, fontSize: 16, margin: "12px 0 4px" }}>{r.chan_doan || "(Chưa ghi chẩn đoán)"}</div>
                {r.chi_dinh && <div style={{ color: T.sub, fontSize: 14, marginTop: 4 }}><b style={{ color: T.ink }}>Chỉ định:</b> {r.chi_dinh}</div>}
                {r.don_thuoc && r.don_thuoc.danh_sach_thuoc && <div style={{ color: T.sub, fontSize: 14, marginTop: 4 }}><b style={{ color: T.ink }}>Đơn thuốc:</b> {r.don_thuoc.danh_sach_thuoc}{r.don_thuoc.lieu_dung ? ` — ${r.don_thuoc.lieu_dung}` : ""}</div>}
                {r.ghi_chu && <div style={{ color: T.sub, fontSize: 14, marginTop: 4 }}><b style={{ color: T.ink }}>Ghi chú:</b> {r.ghi_chu}</div>}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default DoctorPortal;
// Trang dùng chung với cổng Lễ tân (ReceptionPortal.jsx); PatientList nằm ở PatientsPage.jsx
export { ExamHistory };
