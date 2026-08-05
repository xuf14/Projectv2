import React, { useState, useEffect, useRef } from "react";
import { Stethoscope, Search, Save, RotateCcw, FileText, User, Activity, ChevronDown, CheckCircle2, XCircle, LogOut, ArrowRight, X, HeartPulse, ExternalLink, Database } from "lucide-react";
import { T, store, api, useNav, Btn, Card, Pill, PageTitle, input } from "./shared";
import { BENH_LY_SPK } from "./benhly";

// ============================================================================
//  THÔNG TIN KHÁM BỆNH — mẫu bệnh án (màn hình HIS) cho lễ tân nhập.
//  Toàn bộ trường được lưu vào bảng phieu_kham_benh qua API:
//    POST /reception/exam-sheets            (tạo phiếu)
//    GET  /reception/exam-sheets            (danh sách gần đây)
//    GET  /reception/exam-sheets/:id        (xem lại 1 phiếu)
//    GET  /reception/patient-lookup?ma=     (điền nhanh từ hồ sơ có sẵn)
//  Lễ tân có thể tra cứu bệnh nhân sẵn có để liên kết phiếu vào hồ sơ (ho_so_id).
// ============================================================================

const inp = { ...input, padding: "10px 12px", fontSize: 14, borderRadius: 10 };
const fmtNgay = (d) => { const x = new Date(d); return isNaN(x) ? "" : x.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); };

// Tính tuổi theo ngày sinh (năm)
function tinhTuoi(ngaySinh) {
  if (!ngaySinh) return "";
  const d = new Date(ngaySinh); if (isNaN(d)) return "";
  const now = new Date();
  let t = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) t--;
  return t >= 0 && t < 200 ? String(t) : "";
}
// Tính BMI = cân nặng(kg) / (chiều cao(m))^2
function tinhBMI(cao, nang) {
  const c = parseFloat(cao), n = parseFloat(nang);
  if (!c || !n) return "";
  const m = c / 100;
  const b = n / (m * m);
  return isFinite(b) ? b.toFixed(1) : "";
}

// Sinh mã hành chính ngẫu nhiên có quy luật cho mỗi phiếu mới:
//   Mã KCB   = KCB + YYMMDD + 4 số      (VD: KCB260727 4821)
//   Số bệnh án = YYYY / 6 số            (VD: 2026/034917)
const soNgauNhien = (n) => String(Math.floor(Math.random() * 10 ** n)).padStart(n, "0");
const genMaKcb = () => {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `KCB${yy}${mm}${dd}${soNgauNhien(4)}`;
};
const genSoBenhAn = () => `${new Date().getFullYear()}/${soNgauNhien(6)}`;

// QUAN TRỌNG: các component này phải khai báo NGOÀI ThongTinBenhNhan. Nếu định
// nghĩa bên trong, mỗi lần gõ phím React coi chúng là kiểu component mới, hủy và
// dựng lại toàn bộ ô nhập → mất con trỏ, chỉ gõ được 1 ký tự mỗi lần.
const Field = ({ label, children, span }) => (
  <label style={{ display: "block", gridColumn: span ? `span ${span}` : undefined }}>
    <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 600, display: "block", marginBottom: 5 }}>{label}</span>
    {children}
  </label>
);
const ChkO = ({ label, checked, onChange, disabled, title }) => (
  <label title={title} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, color: disabled ? T.sub : T.ink, cursor: disabled ? "not-allowed" : "pointer", whiteSpace: "nowrap", opacity: disabled ? 0.6 : 1 }}>
    <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} style={{ accentColor: T.gold, width: 16, height: 16 }} /> {label}
  </label>
);
// Một dòng điều kiện ra viện (đạt / chưa đạt). Dòng CHƯA đạt kèm hành động
// (nhan + onClick) trở thành liên kết đưa thẳng tới nơi hoàn thành điều kiện đó.
const DKRow = ({ ok, nhan, onClick, children }) => {
  const coLink = !ok && !!onClick;
  const noiDung = (
    <>
      {ok ? <CheckCircle2 size={15} color="#2F8F73" /> : <XCircle size={15} color="#C0392B" />}
      <span style={{ color: T.ink, fontSize: 13, textAlign: "left" }}>{children}</span>
      {coLink && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: T.gold, fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap" }}>
          {nhan} <ArrowRight size={13} />
        </span>
      )}
    </>
  );
  if (!coLink) {
    return <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0" }}>{noiDung}</div>;
  }
  return (
    <button type="button" onClick={onClick} title={nhan}
      style={{
        display: "flex", alignItems: "center", gap: 8, padding: "4px 6px", margin: "0 -6px", width: "calc(100% + 12px)",
        background: "none", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = T.goldSoft)}
      onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>
      {noiDung}
    </button>
  );
};
const Section = ({ icon: Icon, title, cols = 3, children }) => (
  <Card style={{ padding: 20, marginBottom: 16 }}>
    <div style={{ fontWeight: 800, color: T.ink, fontSize: 15, marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${T.line}`, display: "flex", alignItems: "center", gap: 8 }}>
      {Icon && <Icon size={17} color={T.gold} />} {title}
    </div>
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 14 }} className="grid3">{children}</div>
  </Card>
);

// Bỏ dấu tiếng Việt để tìm kiếm không phụ thuộc dấu ("tien san giat" ra "Tiền sản giật")
const khongDau = (s) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

// Ô nhập kèm danh sách gợi ý: vừa gõ để tìm, vừa bấm mũi tên để xem toàn bộ.
// Vẫn cho nhập tự do vì cột trong CSDL là text (bác sĩ ngoài danh sách, bệnh ngoài danh mục).
const ComboBox = ({ value, onChange, onPick, options, placeholder, emptyText = "Không tìm thấy", chiDoc }) => {
  const [mo, setMo] = useState(false);
  const [tim, setTim] = useState(null);      // null = chưa gõ, đang hiển thị value
  const boxRef = useRef(null);

  useEffect(() => {
    if (!mo) return;
    const ngoai = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) { setMo(false); setTim(null); } };
    document.addEventListener("mousedown", ngoai);
    return () => document.removeEventListener("mousedown", ngoai);
  }, [mo]);

  const tu = khongDau(tim === null ? "" : tim).trim();
  const ds = tu ? options.filter((o) => khongDau(o.label).includes(tu) || khongDau(o.sub).includes(tu)) : options;

  const chon = (o) => { onChange(o.label); if (onPick) onPick(o); setMo(false); setTim(null); };

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      <input
        style={{ ...inp, paddingRight: 34 }} placeholder={placeholder} readOnly={chiDoc}
        value={tim === null ? value || "" : tim}
        onChange={(e) => { setTim(e.target.value); onChange(e.target.value); setMo(true); }}
        onFocus={() => { if (!chiDoc) setMo(true); }}
        onKeyDown={(e) => { if (e.key === "Escape") { setMo(false); setTim(null); } }} />
      <ChevronDown size={16} color={T.sub} style={{ position: "absolute", right: 11, top: 13, pointerEvents: "none" }} />
      {mo && !chiDoc && (
        <div style={{ position: "absolute", zIndex: 30, top: "calc(100% + 4px)", left: 0, right: 0, maxHeight: 260,
          overflowY: "auto", background: "#fff", border: `1.5px solid ${T.line}`, borderRadius: 11, boxShadow: "0 10px 28px rgba(0,0,0,.12)" }}>
          {ds.length === 0 && <div style={{ padding: "12px 14px", fontSize: 13, color: T.sub }}>{emptyText}</div>}
          {ds.map((o) => (
            <div key={o.key} onMouseDown={(e) => { e.preventDefault(); chon(o); }}
              style={{ padding: "9px 13px", cursor: "pointer", fontSize: 13.5, color: T.ink,
                background: o.label === value ? T.goldSoft : "transparent", borderBottom: `1px solid ${T.line}44` }}
              onMouseEnter={(e) => { if (o.label !== value) e.currentTarget.style.background = T.bg; }}
              onMouseLeave={(e) => { if (o.label !== value) e.currentTarget.style.background = "transparent"; }}>
              <div style={{ fontWeight: 600 }}>{o.label}</div>
              {o.sub && <div style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>{o.sub}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const OPT_BENH = BENH_LY_SPK.map((b) => ({ key: b.stt, label: b.ten, sub: b.nhom, mo_ta: b.mo_ta }));

const EMPTY = {
  ho_so_id: "", ma_kcb: "", so_benh_an: "", ngay_dk: "",
  noi_tru: false, dtnt: false, dkrv: false, ttrv: false, chuyen_vien: false, cap_cuu: false,
  ten_bn: "", gioi_tinh: "", ngay_sinh: "", tuoi: "", dan_toc: "", dia_chi: "", nghe_nghiep: "",
  doi_tuong: "", so_the: "", ky_hieu: "", han_the: "", ty_le_the: "", dia_chi_the: "", noi_dk_kcb: "", noi_cap: "",
  ngay_vao: "", buong: "", giuong: "",
  kham_lai: false, nho_kham: false, hoan_kham: false,
  ngay_kham: "", bs_kham: "", chuyen_khoa: "", cdtt: "", ghi_chu: "", trieu_chung: "", chan_doan_so_bo: "", ghi_chu_kb: "", ket_luan: "",
  huyet_ap: "", mach: "", nhiet_do: "", nhip_tho: "", chieu_cao: "", can_nang: "", bmi: "", spo2: "", vong_2: "",
  ten_benh: "", ma_icd: "", dien_giai: "",
};

// Phiếu mới: khởi tạo kèm mã KCB + số bệnh án sinh tự động.
const phieuMoi = () => ({ ...EMPTY, ma_kcb: genMaKcb(), so_benh_an: genSoBenhAn() });

// onDieuHuong(tab, thamSo): chuyển sang tab khác của cổng Lễ tân — dùng cho các
// liên kết "đi hoàn thành điều kiện" ở bảng điều kiện Đăng ký ra viện.
export default function ThongTinBenhNhan({ onDieuHuong }) {
  const { online } = useNav();
  const live = online && !!store.token;
  const [f, setF] = useState(phieuMoi);
  const [ma, setMa] = useState("");
  const [msg, setMsg] = useState(null);      // { type: "ok"|"err", text }
  const [saving, setSaving] = useState(false);
  const [looking, setLooking] = useState(false);
  const [ketQua, setKetQua] = useState([]);  // danh sách ứng viên khi tra cứu theo tên
  const [list, setList] = useState([]);
  const [doctors, setDoctors] = useState([]);   // gợi ý cho ô "BS khám"
  const [khoas, setKhoas] = useState([]);       // gợi ý cho ô "Chuyên khoa"
  const [elig, setElig] = useState(null);        // điều kiện ra viện của bệnh nhân đã liên kết
  const [eligLoading, setEligLoading] = useState(false);
  // id phiếu đang XEM LẠI từ database (null = đang nhập phiếu mới). Khi xem lại,
  // dữ liệu thuộc về hệ thống nên form ở chế độ chỉ đọc và không lưu đè/nhân bản.
  const [dangXem, setDangXem] = useState(null);
  const [nhayTtrv, setNhayTtrv] = useState(false);   // nháy sáng ô TTRV khi được nhắc
  const [huongDanBs, setHuongDanBs] = useState(null); // popup hướng dẫn phần việc của bác sĩ
  const ttrvRef = useRef(null);

  useEffect(() => {
    api.doctors().then((r) => setDoctors(Array.isArray(r) ? r : [])).catch(() => {});
    api.departments().then((r) => setKhoas(Array.isArray(r) ? r : [])).catch(() => {});
  }, []);

  // Kiểm tra điều kiện Đăng ký ra viện khi phiếu đã liên kết một hồ sơ bệnh nhân.
  useEffect(() => {
    if (!live || !f.ho_so_id) { setElig(null); return; }
    let alive = true;
    setEligLoading(true);
    api.dischargeEligibility(f.ho_so_id)
      .then((r) => { if (alive) setElig(r); })
      .catch(() => { if (alive) setElig(null); })
      .finally(() => { if (alive) setEligLoading(false); });
    return () => { alive = false; };
  }, [live, f.ho_so_id]);

  const optKhoa = khoas.map((k) => ({ key: k.id, label: k.ten_khoa, sub: "" }));
  // Chọn chuyên khoa trước thì danh sách bác sĩ thu hẹp theo khoa đó
  const optBS = doctors
    .filter((d) => !f.chuyen_khoa || !d.khoa || d.khoa.ten_khoa === f.chuyen_khoa)
    .map((d) => ({ key: d.id, label: d.ho_ten, sub: (d.khoa && d.khoa.ten_khoa) || "", khoa: d.khoa }));

  const set = (k, v) => setF((s) => {
    const next = { ...s, [k]: v };
    if (k === "ngay_sinh") next.tuoi = tinhTuoi(v);
    if (k === "chieu_cao" || k === "can_nang") next.bmi = tinhBMI(k === "chieu_cao" ? v : s.chieu_cao, k === "can_nang" ? v : s.can_nang);
    return next;
  });

  const loadList = () => { if (live) api.examSheets().then((r) => setList(Array.isArray(r) ? r : [])).catch(() => {}); };
  useEffect(loadList, [live]);

  // ĐKRV chỉ bật khi bệnh nhân đủ điều kiện ra viện (viện phí thu đủ + có y lệnh
  // ra viện an toàn về nhà) VÀ lễ tân đã tích TTRV. Tự bỏ tích nếu không còn đạt.
  const canDkrv = !!(elig && elig.du_dieu_kien && f.ttrv);
  useEffect(() => { if (f.dkrv && !canDkrv) set("dkrv", false); }, [canDkrv]); // eslint-disable-line react-hooks/exhaustive-deps
  const lyDoKhoaDkrv = (() => {
    if (!f.ho_so_id) return "Cần liên kết hồ sơ bệnh nhân (tra cứu ở trên) để xét điều kiện ra viện";
    const t = [...(elig && Array.isArray(elig.thieu) ? elig.thieu : [])];
    if (!f.ttrv) t.push("Cần tích TTRV (đã thanh toán ra viện)");
    return t.join("; ");
  })();

  // --- Liên kết từ các dòng điều kiện ĐKRV còn thiếu tới nơi hoàn thành ---
  // Viện phí: sang tab "Y lệnh viện phí", lọc sẵn theo tên bệnh nhân để thu nốt.
  const moThuVienPhi = () => {
    if (onDieuHuong) onDieuHuong("ylenh", { q: (f.ten_bn || "").trim() });
    else setMsg({ type: "err", text: "Vui lòng mở tab Y lệnh viện phí để thu nốt viện phí cho bệnh nhân." });
  };
  // TTRV: ô tích nằm ngay trên trang này — cuộn tới và nháy sáng cho dễ thấy.
  const toiOTtrv = () => {
    if (ttrvRef.current) ttrvRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    setNhayTtrv(true);
    setTimeout(() => setNhayTtrv(false), 2500);
  };

  const traCuu = async () => {
    const q = ma.trim(); setMsg(null); setKetQua([]);
    if (!q) return;
    setLooking(true);
    try {
      const r = await api.lookupPatientInfo(q);
      const ds = Array.isArray(r) ? r : r ? [r] : [];
      if (!ds.length) { setMsg({ type: "err", text: `Không tìm thấy bệnh nhân với "${q}"` }); return; }
      if (ds.length === 1) chonBenhNhan(ds[0]);
      else setKetQua(ds);
    } catch (e) { setMsg({ type: "err", text: e.message }); }
    finally { setLooking(false); }
  };
  // Chọn một bệnh nhân từ danh sách ứng viên → điền thông tin vào phiếu.
  const chonBenhNhan = (r) => {
    setF((s) => ({ ...s, ho_so_id: r.ho_so_id || "", ten_bn: r.ten_bn || s.ten_bn,
      gioi_tinh: r.gioi_tinh || s.gioi_tinh, ngay_sinh: r.ngay_sinh || s.ngay_sinh,
      tuoi: r.ngay_sinh ? tinhTuoi(r.ngay_sinh) : s.tuoi,
      dia_chi: r.dia_chi || s.dia_chi, so_the: r.so_the || s.so_the }));
    setKetQua([]);
    setMsg({ type: "ok", text: `Đã điền thông tin bệnh nhân ${r.ma_benh_nhan} (${r.ten_bn}) vào phiếu.` });
  };

  const luu = async () => {
    setMsg(null);
    if (!f.ten_bn.trim()) { setMsg({ type: "err", text: "Vui lòng nhập Tên bệnh nhân." }); return; }
    setSaving(true);
    try {
      const r = await api.createExamSheet(f);
      // Đã nằm trong database → xóa sạch bản nháp trên trình duyệt, danh sách bên
      // dưới nạp lại từ server để những gì hiển thị đúng là dữ liệu đã lưu.
      setMsg({ type: "ok", text: `Đã lưu phiếu khám ${r.ma_kcb || `#${r.id}`} cho ${r.ten_bn} vào cơ sở dữ liệu. Form đã được làm trống để nhập phiếu tiếp theo.` });
      setF(phieuMoi()); setMa(""); setKetQua([]); setDangXem(null); loadList();
    } catch (e) { setMsg({ type: "err", text: e.message }); }
    finally { setSaving(false); }
  };

  const xem = async (id) => {
    setMsg(null);
    try {
      const r = await api.examSheet(id);
      const next = { ...EMPTY };
      for (const k of Object.keys(EMPTY)) if (r[k] !== undefined && r[k] !== null) next[k] = r[k];
      next.ho_so_id = ""; // không gán lại liên kết khi chỉ xem
      setF(next); setKetQua([]); setDangXem({ id, ma_kcb: r.ma_kcb, ten_bn: r.ten_bn });
      setMsg(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) { setMsg({ type: "err", text: e.message }); }
  };

  // Thoát chế độ xem: về phiếu trắng, hoặc chép dữ liệu sang phiếu mới (mã KCB
  // và số bệnh án luôn sinh mới để không đè lên phiếu đã lưu).
  const nhapPhieuMoi = () => { setF(phieuMoi()); setMa(""); setKetQua([]); setDangXem(null); setMsg(null); };
  const chepSangPhieuMoi = () => {
    const moi = phieuMoi();
    setF((s) => ({ ...s, ma_kcb: moi.ma_kcb, so_benh_an: moi.so_benh_an }));
    setDangXem(null);
    setMsg({ type: "ok", text: `Đã chép dữ liệu sang phiếu mới (mã ${moi.ma_kcb}). Phiếu cũ trong hệ thống giữ nguyên.` });
  };

  const chiDoc = !!dangXem;
  const ti = (k) => ({ style: inp, value: f[k] || "", readOnly: chiDoc, onChange: (e) => set(k, e.target.value) });

  if (!live) {
    return (
      <div>
        <PageTitle title="Thông tin khám bệnh" sub="Nhập mẫu bệnh án của bệnh nhân." />
        <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>Cần đăng nhập tài khoản lễ tân để nhập phiếu.</Card>
      </div>
    );
  }

  return (
    <div>
      <PageTitle title="Thông tin khám bệnh" sub="Nhập mẫu bệnh án theo bệnh nhân — dữ liệu lưu trực tiếp vào hệ thống."
        action={<div style={{ display: "flex", gap: 10 }}>
          <Btn kind="ghost" onClick={nhapPhieuMoi}><RotateCcw size={15} /> {chiDoc ? "Nhập phiếu mới" : "Làm mới"}</Btn>
          {!chiDoc && <Btn kind="gold" disabled={saving} onClick={luu}><Save size={16} /> {saving ? "Đang lưu..." : "Lưu phiếu"}</Btn>}
        </div>} />

      {/* Đang xem phiếu đã nằm trong database: form chỉ đọc, không lưu lại để
          tránh tạo bản sao trùng của cùng một phiếu. */}
      {chiDoc && (
        <Card style={{ padding: 14, marginBottom: 16, border: "none", background: T.skySoft, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <Database size={17} color={T.sky} />
          <div style={{ flex: 1, minWidth: 220, fontSize: 14, color: T.ink }}>
            Đang xem phiếu <b>{dangXem.ma_kcb || `#${dangXem.id}`}</b>
            {dangXem.ten_bn ? ` · ${dangXem.ten_bn}` : ""} — dữ liệu lấy từ cơ sở dữ liệu, chỉ đọc.
          </div>
          <Btn kind="ghost" size="sm" onClick={chepSangPhieuMoi}>Chép sang phiếu mới</Btn>
          <Btn kind="ghost" size="sm" onClick={nhapPhieuMoi}>Nhập phiếu trắng</Btn>
        </Card>
      )}

      {msg && <Card style={{ padding: 14, marginBottom: 16, border: "none", fontSize: 14,
        background: msg.type === "ok" ? T.mintSoft : "#FDECEA", color: msg.type === "ok" ? "#2F8F73" : "#C0392B" }}>{msg.text}</Card>}

      {/* Tra cứu để điền nhanh từ hồ sơ có sẵn */}
      <Card style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 13.5, color: T.sub, fontWeight: 700 }}>Điền nhanh từ hồ sơ:</span>
          <div style={{ flex: 1, minWidth: 200, display: "flex", alignItems: "center", gap: 10, border: `1.5px solid ${T.line}`, borderRadius: 11, padding: "0 12px" }}>
            <Search size={17} color={T.sub} />
            <input value={ma} onChange={(e) => setMa(e.target.value)} onKeyDown={(e) => e.key === "Enter" && traCuu()} placeholder="Nhập tên, mã bệnh nhân (BN...) hoặc số điện thoại" style={{ flex: 1, border: "none", outline: "none", padding: "11px 0", fontSize: 14.5, fontFamily: "inherit", background: "transparent" }} />
          </div>
          <Btn kind="ghost" disabled={looking} onClick={traCuu}>{looking ? "Đang tìm..." : "Tra cứu"}</Btn>
          {f.ho_so_id && <Pill tone={T.mint} soft={T.mintSoft}>Đã liên kết hồ sơ #{f.ho_so_id}</Pill>}
        </div>
        {ketQua.length > 0 && (
          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            <div style={{ fontSize: 12.5, color: T.sub }}>Tìm thấy {ketQua.length} bệnh nhân — chọn để điền vào phiếu:</div>
            {ketQua.map((r) => (
              <button key={r.ho_so_id} type="button" onClick={() => chonBenhNhan(r)}
                style={{ textAlign: "left", display: "flex", alignItems: "center", gap: 12, border: `1.5px solid ${T.line}`,
                  borderRadius: 11, padding: "10px 14px", background: "#fff", cursor: "pointer", fontFamily: "inherit" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = T.bg)}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: T.ink, fontSize: 14.5 }}>{r.ten_bn}</div>
                  <div style={{ fontSize: 12.5, color: T.sub, marginTop: 2 }}>
                    {r.ma_benh_nhan}{r.ngay_sinh ? ` · ${new Date(r.ngay_sinh).toLocaleDateString("vi-VN")}` : ""}
                    {r.gioi_tinh ? ` · ${r.gioi_tinh}` : ""}{r.sdt ? ` · ${r.sdt}` : ""}
                  </div>
                </div>
                <Pill tone={T.gold} soft={T.goldSoft}>Giống {r.do_giong}%</Pill>
              </button>
            ))}
          </div>
        )}
      </Card>

      <Section icon={FileText} title="Hành chính">
        <Field label="Mã KCB (F5)"><input {...ti("ma_kcb")} /></Field>
        <Field label="Số bệnh án"><input {...ti("so_benh_an")} /></Field>
        <Field label="Ngày ĐK"><input type="date" {...ti("ngay_dk")} /></Field>
        <Field label="Đối tượng / hình thức" span={3}>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", paddingTop: 6 }}>
            {[["noi_tru", "Nội trú"], ["dtnt", "ĐTNT"], ["dkrv", "ĐKRV"],
              ["ttrv", "TTRV"], ["chuyen_vien", "Chuyển viện"], ["cap_cuu", "Cấp cứu"]].map(([k, label]) => (
              <span key={k} ref={k === "ttrv" ? ttrvRef : undefined}
                style={k === "ttrv" && nhayTtrv
                  ? { borderRadius: 8, padding: "3px 7px", margin: "-3px -7px", background: T.goldSoft, boxShadow: `0 0 0 2px ${T.gold}` }
                  : undefined}>
                <ChkO label={label} checked={!!f[k]} onChange={(v) => set(k, v)}
                  disabled={chiDoc || (k === "dkrv" && !canDkrv)}
                  title={k === "dkrv" && !canDkrv ? lyDoKhoaDkrv : undefined} />
              </span>
            ))}
          </div>
        </Field>
        {/* Điều kiện Đăng ký ra viện (ĐKRV) — dữ liệu từ thanh toán + cổng bác sĩ */}
        <div style={{ gridColumn: "span 3", background: canDkrv ? T.mintSoft : T.bg, borderRadius: 12, padding: "12px 14px", border: `1px solid ${T.line}` }}>
          <div style={{ fontWeight: 700, color: T.ink, fontSize: 13.5, marginBottom: 8, display: "flex", alignItems: "center", gap: 7 }}>
            <LogOut size={15} color={T.gold} /> Điều kiện Đăng ký ra viện (ĐKRV)
          </div>
          {!f.ho_so_id ? (
            <div style={{ fontSize: 13, color: T.sub }}>Cần <b>liên kết hồ sơ bệnh nhân</b> (dùng ô "Điền nhanh từ hồ sơ" ở trên) để xét điều kiện ra viện.</div>
          ) : eligLoading ? (
            <div style={{ fontSize: 13, color: T.sub }}>Đang kiểm tra điều kiện ra viện…</div>
          ) : elig ? (
            <div>
              <DKRow ok={elig.thanh_toan.xong} nhan="Thu nốt viện phí" onClick={moThuVienPhi}>
                Thanh toán đủ viện phí
                {elig.thanh_toan.xong
                  ? (elig.thanh_toan.so_phieu ? ` (${elig.thanh_toan.so_phieu} phiếu đã thu đủ)` : " (chưa có phiếu viện phí)")
                  : ` — còn ${elig.thanh_toan.so_chua_du} phiếu, thiếu ${(elig.thanh_toan.con_lai).toLocaleString("vi-VN")}đ`}
              </DKRow>
              <DKRow ok={!!f.ttrv} nhan="Tích ô TTRV" onClick={toiOTtrv}>
                Đã tích ô <b>TTRV</b> (thanh toán ra viện)
              </DKRow>
              <DKRow ok={elig.y_lenh_ra_vien.co} nhan="Xem cách hoàn thành"
                onClick={() => setHuongDanBs("y_lenh")}>
                Y lệnh ra viện của bác sĩ điều trị{elig.y_lenh_ra_vien.co && elig.y_lenh_ra_vien.bac_si ? ` — BS ${elig.y_lenh_ra_vien.bac_si}` : ""}
              </DKRow>
              <DKRow ok={elig.y_lenh_ra_vien.an_toan_ve_nha} nhan="Xem cách hoàn thành"
                onClick={() => setHuongDanBs("ket_luan")}>
                Bác sĩ kết luận an toàn về nhà{elig.y_lenh_ra_vien.nhan ? ` — ${elig.y_lenh_ra_vien.nhan}` : ""}
              </DKRow>
              <div style={{ marginTop: 8, fontSize: 12.5, fontWeight: 700, color: canDkrv ? "#2F8F73" : "#B5851B" }}>
                {canDkrv
                  ? `✓ Đủ điều kiện — bệnh nhân ${(f.ten_bn || "").trim() || "(chưa có tên)"} có thể ra viện.`
                  : "Chưa đủ điều kiện — ĐKRV đang bị khóa. Bấm vào dòng còn thiếu để tới nơi hoàn thành."}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: T.sub }}>Không lấy được điều kiện ra viện.</div>
          )}
        </div>
      </Section>

      <Section icon={User} title="Thông tin bệnh nhân">
        <Field label="Tên bệnh nhân *" span={2}><input {...ti("ten_bn")} placeholder="Họ và tên" /></Field>
        <Field label="Giới tính">
          <select {...ti("gioi_tinh")} disabled={chiDoc}><option value="">—</option><option value="Nữ">Nữ</option><option value="Nam">Nam</option><option value="Khác">Khác</option></select>
        </Field>
        <Field label="Ngày sinh"><input type="date" {...ti("ngay_sinh")} /></Field>
        <Field label="Tuổi"><input {...ti("tuoi")} readOnly style={{ ...inp, background: T.bg }} /></Field>
        <Field label="Dân tộc"><input {...ti("dan_toc")} /></Field>
        <Field label="Địa chỉ" span={2}><input {...ti("dia_chi")} /></Field>
        <Field label="Nghề nghiệp"><input {...ti("nghe_nghiep")} /></Field>
      </Section>

      <Section icon={FileText} title="Bảo hiểm y tế">
        <Field label="Đối tượng"><input {...ti("doi_tuong")} /></Field>
        <Field label="Số thẻ"><input {...ti("so_the")} /></Field>
        <Field label="Ký hiệu (K?)"><input {...ti("ky_hieu")} /></Field>
        <Field label="Hạn thẻ"><input type="date" {...ti("han_the")} /></Field>
        <Field label="Tỷ lệ % thẻ"><input {...ti("ty_le_the")} /></Field>
        <Field label="Nơi cấp"><input {...ti("noi_cap")} /></Field>
        <Field label="Địa chỉ thẻ" span={2}><input {...ti("dia_chi_the")} /></Field>
        <Field label="Nơi đăng ký KCB"><input {...ti("noi_dk_kcb")} /></Field>
      </Section>

      <Section icon={FileText} title="Vào viện">
        <Field label="Ngày vào"><input type="date" {...ti("ngay_vao")} /></Field>
        <Field label="Buồng"><input {...ti("buong")} /></Field>
        <Field label="Giường"><input {...ti("giuong")} /></Field>
      </Section>

      <Section icon={Stethoscope} title="Thông tin khám bệnh">
        <Field label="Hình thức khám" span={3}>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", paddingTop: 6 }}>
            {[["kham_lai", "Khám lại"], ["nho_kham", "Nhờ khám"], ["hoan_kham", "Hoãn khám"]].map(([k, label]) => (
              <ChkO key={k} label={label} checked={!!f[k]} onChange={(v) => set(k, v)} />
            ))}
          </div>
        </Field>
        <Field label="Ngày khám"><input type="date" {...ti("ngay_kham")} /></Field>
        <Field label="BS khám">
          <ComboBox chiDoc={chiDoc} value={f.bs_kham} options={optBS} placeholder="Chọn hoặc gõ tên bác sĩ"
            emptyText={f.chuyen_khoa ? `Không có bác sĩ thuộc ${f.chuyen_khoa}` : "Không tìm thấy bác sĩ"}
            onChange={(v) => set("bs_kham", v)}
            onPick={(o) => setF((s) => ({ ...s, bs_kham: o.label, chuyen_khoa: s.chuyen_khoa || o.sub }))} />
        </Field>
        <Field label="Chuyên khoa">
          <ComboBox chiDoc={chiDoc} value={f.chuyen_khoa} options={optKhoa} placeholder="Chọn hoặc gõ chuyên khoa"
            emptyText="Không tìm thấy chuyên khoa" onChange={(v) => set("chuyen_khoa", v)} />
        </Field>
        <Field label="CĐTT (chẩn đoán tuyến trước)" span={2}><input {...ti("cdtt")} /></Field>
        <Field label="Ghi chú"><input {...ti("ghi_chu")} /></Field>
        <Field label="Triệu chứng" span={3}><textarea {...ti("trieu_chung")} rows={2} style={{ ...inp, resize: "vertical" }} /></Field>
        <Field label="Chẩn đoán sơ bộ" span={3}><textarea {...ti("chan_doan_so_bo")} rows={2} style={{ ...inp, resize: "vertical" }} /></Field>
        <Field label="Ghi chú KB" span={2}><input {...ti("ghi_chu_kb")} /></Field>
        <Field label="Kết luận"><input {...ti("ket_luan")} /></Field>
      </Section>

      <Section icon={Activity} title="Chỉ số sinh tồn" cols={4}>
        <Field label="Huyết áp (mmHg)"><input {...ti("huyet_ap")} placeholder="120/80" /></Field>
        <Field label="Mạch (L/P)"><input {...ti("mach")} /></Field>
        <Field label="Nhiệt độ (°C)"><input {...ti("nhiet_do")} /></Field>
        <Field label="Nhịp thở (L/P)"><input {...ti("nhip_tho")} /></Field>
        <Field label="Chiều cao (cm)"><input {...ti("chieu_cao")} /></Field>
        <Field label="Cân nặng (Kg)"><input {...ti("can_nang")} /></Field>
        <Field label="BMI (Kg/m²)"><input {...ti("bmi")} readOnly style={{ ...inp, background: T.bg }} /></Field>
        <Field label="SPO2 (%)"><input {...ti("spo2")} /></Field>
        <Field label="Vòng 2 (cm)"><input {...ti("vong_2")} /></Field>
      </Section>

      <Section icon={FileText} title="Chẩn đoán">
        <Field label="Mã ICD"><input {...ti("ma_icd")} /></Field>
        <Field label="Tên bệnh" span={2}>
          <ComboBox chiDoc={chiDoc} value={f.ten_benh} options={OPT_BENH} placeholder={`Chọn hoặc gõ tên bệnh (${OPT_BENH.length} bệnh lý sản phụ khoa)`}
            emptyText="Không có bệnh phù hợp — có thể nhập tự do"
            onChange={(v) => set("ten_benh", v)}
            onPick={(o) => setF((s) => ({ ...s, ten_benh: o.label, dien_giai: o.mo_ta }))} />
        </Field>
        <Field label="Diễn giải" span={3}><textarea {...ti("dien_giai")} rows={2} style={{ ...inp, resize: "vertical" }} /></Field>
      </Section>

      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12, marginBottom: 30 }}>
        {chiDoc ? (
          <>
            <span style={{ fontSize: 13, color: T.sub }}>Phiếu này đã có trong hệ thống — không cần lưu lại.</span>
            <Btn kind="ghost" onClick={nhapPhieuMoi}><RotateCcw size={15} /> Nhập phiếu mới</Btn>
          </>
        ) : (
          <Btn kind="gold" disabled={saving} onClick={luu}><Save size={16} /> {saving ? "Đang lưu..." : "Lưu phiếu vào hệ thống"}</Btn>
        )}
      </div>

      {/* Phiếu đã nhập gần đây */}
      {list.length > 0 && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.line}`, fontWeight: 800, color: T.ink, fontSize: 15 }}>Phiếu đã nhập gần đây</div>
          <div style={{ display: "grid", gridTemplateColumns: "0.6fr 1.6fr 1fr 1.4fr 1.2fr 0.7fr", gap: 12, padding: "12px 20px", background: T.bg, fontSize: 12.5, fontWeight: 800, color: T.sub, textTransform: "uppercase", letterSpacing: .5 }} className="tableHead">
            <span>Mã KCB</span><span>Bệnh nhân</span><span>Chuyên khoa</span><span>Chẩn đoán sơ bộ</span><span>Thời gian</span><span></span>
          </div>
          {list.map((p, i) => (
            <div key={p.id} style={{ display: "grid", gridTemplateColumns: "0.6fr 1.6fr 1fr 1.4fr 1.2fr 0.7fr", gap: 12, padding: "12px 20px", borderBottom: i < list.length - 1 ? `1px solid ${T.line}55` : "none", alignItems: "center", fontSize: 13.5 }} className="tableRow">
              <span style={{ fontWeight: 700, color: T.ink }}>{p.ma_kcb || `#${p.id}`}</span>
              <span style={{ color: T.ink }}>{p.ten_bn}{p.ma_benh_nhan ? ` · ${p.ma_benh_nhan}` : ""}</span>
              <span style={{ color: T.sub }}>{p.chuyen_khoa || "—"}</span>
              <span style={{ color: T.sub }}>{p.chan_doan_so_bo || "—"}</span>
              <span style={{ color: T.sub }}>{fmtNgay(p.ngay_tao)}</span>
              <Btn kind="ghost" size="sm" onClick={() => xem(p.id)}>Xem</Btn>
            </div>
          ))}
        </Card>
      )}

      {huongDanBs && (
        <PopupViecCuaBacSi loai={huongDanBs} benhNhan={f} elig={elig} onClose={() => setHuongDanBs(null)} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
//  Hai điều kiện cuối (y lệnh ra viện + kết luận an toàn) do BÁC SĨ ĐIỀU TRỊ lập
//  ở cổng Bác sĩ — lễ tân không tự làm được. Popup này chỉ đường và đưa sẵn
//  thông tin bệnh nhân để lễ tân báo cho bác sĩ.
// ---------------------------------------------------------------------------
// Liên kết trông như nút chính (dùng thẻ <a> để mở tab mới không bị chặn popup)
const nutLienKet = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
  padding: "12px 22px", borderRadius: 999, fontWeight: 700, fontSize: 14.5,
  background: `linear-gradient(135deg, ${T.peach}, #ED7263)`, color: "#fff",
  boxShadow: "0 8px 20px rgba(240,138,124,.32)", textDecoration: "none", fontFamily: "inherit",
};

function PopupViecCuaBacSi({ loai, benhNhan, elig, onClose }) {
  const laKetLuan = loai === "ket_luan";
  const daCoPhieu = !!(elig && elig.y_lenh_ra_vien && elig.y_lenh_ra_vien.co);
  // Liên kết mở cổng Bác sĩ ở TAB TRÌNH DUYỆT MỚI, vào thẳng tab "Ra viện" với
  // đúng bệnh nhân đang cần xử lý. Bác sĩ vẫn phải đăng nhập bằng tài khoản của
  // mình ở tab đó; URL chỉ mang id hồ sơ (số), không kèm tên hay dữ liệu cá nhân.
  // Dùng thẻ <a target="_blank"> thay cho window.open để trình duyệt không chặn popup.
  const urlCongBacSi = (() => {
    if (!benhNhan.ho_so_id) return null;
    const u = new URL(window.location.href);
    u.search = `?cong=bac-si&tab=ravien&hs=${encodeURIComponent(benhNhan.ho_so_id)}`;
    u.hash = "";
    return u.toString();
  })();
  const buoc = [
    "Bác sĩ điều trị đăng nhập cổng Bác sĩ",
    'Mở tab "Ra viện" ở menu bên trái',
    daCoPhieu && laKetLuan
      ? 'Bấm "Lập y lệnh ra viện", chọn lại tình trạng "Hồi phục" hoặc "Qua giai đoạn nguy hiểm"'
      : 'Bấm "Lập y lệnh ra viện", tìm và chọn bệnh nhân',
    laKetLuan
      ? "Lưu phiếu — kết luận an toàn về nhà sẽ tự cập nhật sang màn hình này"
      : "Chọn tình trạng ra viện, ghi kết luận sức khỏe rồi lưu phiếu",
  ];
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "grid", placeItems: "center", zIndex: 70, padding: 16 }}>
      <Card onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520, width: "100%", padding: 0 }}>
        <div style={{ padding: "15px 18px", borderBottom: `1px solid ${T.line}`, display: "flex", alignItems: "center", gap: 11 }}>
          <span style={{ width: 36, height: 36, borderRadius: 11, background: T.skySoft, color: T.sky, display: "grid", placeItems: "center" }}><HeartPulse size={18} /></span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15.5, fontWeight: 800, color: T.ink }}>
              {laKetLuan ? "Kết luận an toàn về nhà" : "Y lệnh ra viện"}
            </div>
            <div style={{ fontSize: 12.5, color: T.sub, marginTop: 1 }}>Phần việc của bác sĩ điều trị — lễ tân không tự lập được</div>
          </div>
          <Btn kind="ghost" size="sm" onClick={onClose}><X size={16} /></Btn>
        </div>
        <div style={{ padding: 18 }}>
          <div style={{ background: T.bg, borderRadius: 12, padding: "11px 14px", marginBottom: 14 }}>
            <div style={{ fontSize: 12.5, color: T.sub, fontWeight: 700 }}>Bệnh nhân cần xử lý</div>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: T.ink, marginTop: 2 }}>
              {benhNhan.ten_bn || "—"}{benhNhan.ma_kcb ? ` · ${benhNhan.ma_kcb}` : ""}
            </div>
            {daCoPhieu && elig.y_lenh_ra_vien.nhan && (
              <div style={{ fontSize: 12.5, color: T.sub, marginTop: 3 }}>
                Phiếu hiện tại: {elig.y_lenh_ra_vien.nhan}
                {elig.y_lenh_ra_vien.bac_si ? ` — BS ${elig.y_lenh_ra_vien.bac_si}` : ""} (chưa đủ an toàn để về nhà)
              </div>
            )}
          </div>
          <div style={{ display: "grid", gap: 9 }}>
            {buoc.map((b, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ width: 22, height: 22, borderRadius: 7, background: T.goldSoft, color: T.gold, fontSize: 12, fontWeight: 800, display: "grid", placeItems: "center", flexShrink: 0 }}>{i + 1}</span>
                <span style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.45 }}>{b}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12.5, color: T.sub, marginTop: 14, lineHeight: 1.5 }}>
            Sau khi bác sĩ lưu phiếu, bấm lại vào bệnh nhân ở màn hình này để cập nhật điều kiện.
          </div>
        </div>
        <div style={{ padding: "14px 18px", borderTop: `1px solid ${T.line}`, display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: T.sub, marginRight: "auto", maxWidth: 250 }}>
            Tab mới sẽ yêu cầu bác sĩ đăng nhập bằng tài khoản riêng.
          </span>
          <Btn kind="ghost" onClick={onClose}>Đóng</Btn>
          {urlCongBacSi ? (
            <a href={urlCongBacSi} target="_blank" rel="noopener noreferrer" style={nutLienKet}>
              <ExternalLink size={16} /> Mở cổng Bác sĩ ở tab mới
            </a>
          ) : (
            <span style={{ fontSize: 12.5, color: T.sub }}>Cần liên kết hồ sơ bệnh nhân để mở cổng Bác sĩ.</span>
          )}
        </div>
      </Card>
    </div>
  );
}
