import React, { useState, useEffect } from "react";
import {
  ClipboardCheck, CheckCircle2, User, Phone, Mail, MapPin, CalendarDays, Stethoscope,
  UserPlus, UserCheck, ArrowRight, Home as HomeIcon,
} from "lucide-react";
import { T, Btn, Card, Pill, useNav, api } from "../shared";
import { sectionWrap, PageHeader } from "./ui";

// ============================================================================
//  ĐĂNG KÝ KHÁM (trang công khai) — bệnh nhân mới hoặc cũ điền thông tin để đến
//  khám tại một khoa. Gửi POST /public/dang-ky-kham (không cần đăng nhập); phiếu
//  vào hàng chờ của lễ tân ở trang Tiếp đón. KHÔNG thu thập dữ liệu y tế nhạy cảm.
// ============================================================================

const inp = {
  width: "100%", padding: "11px 13px", borderRadius: 12, border: `1.5px solid ${T.line}`,
  fontSize: 14.5, fontFamily: "inherit", outline: "none", background: T.surface, boxSizing: "border-box",
};
const inpOff = { ...inp, background: T.bg, color: T.sub, cursor: "not-allowed" };
const todayISO = () => new Date().toLocaleDateString("en-CA");

// Khung giờ nhận khám trong ngày (30 phút/khung, nghỉ trưa 11:30–13:30)
const GIO_KHAM = [
  "07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00",
  "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
];

const EMPTY = {
  ho_ten: "", ngay_sinh: "", gioi_tinh: "", sdt: "", email: "", dia_chi: "",
  khoa_id: "", ngay_mong_muon: "", gio_mong_muon: "", ly_do: "", ma_benh_nhan_cu: "",
};

// Danh sách khoa đến từ hai nguồn có cấu trúc khác nhau: context điều hướng đã
// được App chuẩn hóa (id = MÃ khoa, dbId = id thật, name = tên) còn api.departments()
// trả nguyên bản từ backend. Quy về một dạng { id, ten } — id phải là id số vì
// backend chỉ nhận khoa_id dạng số.
const chuanKhoa = (k) => ({
  id: k.dbId !== undefined && k.dbId !== null ? k.dbId : k.id,
  ten: k.ten_khoa || k.name || "",
});

function Field({ label, children, span }) {
  return (
    <label style={{ display: "block", gridColumn: span ? `span ${span}` : undefined }}>
      <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 700, display: "block", marginBottom: 6 }}>{label}</span>
      {children}
    </label>
  );
}

export default function DangKyKham({ onNav }) {
  const nav = useNav() || {};
  const [khoaList, setKhoaList] = useState(
    Array.isArray(nav.departments) ? nav.departments.map(chuanKhoa) : [],
  );
  const [benhNhanCu, setBenhNhanCu] = useState(false);
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [ok, setOk] = useState(null); // { ma_dang_ky, message }

  useEffect(() => {
    if (khoaList.length === 0) {
      api.departments()
        .then((r) => setKhoaList(Array.isArray(r) ? r.map(chuanKhoa) : []))
        .catch(() => {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const guiDangKy = async () => {
    setErr(null);
    if (!f.ho_ten.trim()) { setErr("Vui lòng nhập họ và tên."); return; }
    if (!f.sdt.trim()) { setErr("Vui lòng nhập số điện thoại để lễ tân liên hệ."); return; }
    if (!f.khoa_id) { setErr("Vui lòng chọn khoa muốn khám."); return; }
    setBusy(true);
    try {
      const r = await api.dangKyKham({
        ho_ten: f.ho_ten, ngay_sinh: f.ngay_sinh || undefined, gioi_tinh: f.gioi_tinh || undefined,
        sdt: f.sdt, email: f.email || undefined, dia_chi: f.dia_chi || undefined,
        khoa_id: f.khoa_id,
        ngay_mong_muon: f.ngay_mong_muon || undefined,
        gio_mong_muon: f.ngay_mong_muon ? (f.gio_mong_muon || undefined) : undefined,
        ly_do: f.ly_do || undefined,
        benh_nhan_cu: benhNhanCu,
        ma_benh_nhan_cu: benhNhanCu ? (f.ma_benh_nhan_cu || undefined) : undefined,
      });
      setOk(r);
      window.scrollTo(0, 0);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const dangKyTiep = () => { setOk(null); setErr(null); setF(EMPTY); setBenhNhanCu(false); };

  return (
    <section style={{ padding: "56px 0 72px" }}>
      <div style={sectionWrap}>
        <PageHeader
          eyebrowText="Đăng ký khám"
          title="Đăng ký khám bệnh"
          sub="Bệnh nhân mới và bệnh nhân cũ điền thông tin bên dưới để đến khám tại các khoa. Phiếu đăng ký sẽ được gửi tới lễ tân — bộ phận tiếp đón sẽ liên hệ xác nhận lịch khám." />

        {ok ? (
          <Card style={{ maxWidth: 640, margin: "0 auto", padding: 32, textAlign: "center" }}>
            <span style={{ width: 60, height: 60, borderRadius: 18, background: T.mintSoft, color: T.mint, display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
              <CheckCircle2 size={30} />
            </span>
            <div style={{ fontSize: 20, fontWeight: 800, color: T.ink, marginBottom: 8 }}>Đã gửi đăng ký khám</div>
            <p style={{ fontSize: 14.5, color: T.sub, lineHeight: 1.6, margin: "0 0 16px" }}>{ok.message}</p>
            <div style={{ display: "inline-flex", flexDirection: "column", gap: 6, background: T.peachSoft, borderRadius: 14, padding: "14px 22px", marginBottom: 22 }}>
              <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 700 }}>MÃ ĐĂNG KÝ CỦA BẠN</span>
              <span style={{ fontSize: 24, fontWeight: 800, color: T.peach, letterSpacing: 1 }}>{ok.ma_dang_ky}</span>
              <span style={{ fontSize: 12.5, color: T.sub }}>Vui lòng đọc mã này cho lễ tân khi đến khám.</span>
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <Btn kind="primary" onClick={dangKyTiep}><UserPlus size={16} /> Đăng ký thêm người khác</Btn>
              <Btn kind="soft" onClick={() => onNav && onNav("home")}><HomeIcon size={16} /> Về trang chủ</Btn>
            </div>
          </Card>
        ) : (
          <Card style={{ maxWidth: 760, margin: "0 auto", padding: 28 }}>
            {/* Bệnh nhân mới / cũ */}
            <div style={{ display: "flex", gap: 10, marginBottom: 22, flexWrap: "wrap" }}>
              <button type="button" onClick={() => setBenhNhanCu(false)}
                style={chipStyle(!benhNhanCu)}>
                <UserPlus size={16} /> Tôi là bệnh nhân mới
              </button>
              <button type="button" onClick={() => setBenhNhanCu(true)}
                style={chipStyle(benhNhanCu)}>
                <UserCheck size={16} /> Tôi đã từng khám ở đây
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }} className="grid2">
              {benhNhanCu && (
                <Field label="Mã bệnh nhân cũ (nếu bạn còn nhớ)" span={2}>
                  <input style={inp} value={f.ma_benh_nhan_cu} onChange={(e) => set("ma_benh_nhan_cu", e.target.value)}
                    placeholder="VD: BN12345678 — không bắt buộc" />
                </Field>
              )}

              <Field label="Họ và tên *" span={2}>
                <input style={inp} value={f.ho_ten} onChange={(e) => set("ho_ten", e.target.value)} placeholder="VD: Nguyễn Thị Hồng" />
              </Field>

              <Field label="Ngày sinh">
                <input type="date" max={todayISO()} style={inp} value={f.ngay_sinh} onChange={(e) => set("ngay_sinh", e.target.value)} />
              </Field>
              <Field label="Giới tính">
                <select style={inp} value={f.gioi_tinh} onChange={(e) => set("gioi_tinh", e.target.value)}>
                  <option value="">— Chọn —</option>
                  <option>Nữ</option><option>Nam</option><option>Khác</option>
                </select>
              </Field>

              <Field label="Số điện thoại *">
                <input style={inp} value={f.sdt} onChange={(e) => set("sdt", e.target.value)} placeholder="VD: 0912 345 678" inputMode="tel" />
              </Field>
              <Field label="Email">
                <input style={inp} value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="VD: ten@email.com" inputMode="email" />
              </Field>

              <Field label="Địa chỉ" span={2}>
                <input style={inp} value={f.dia_chi} onChange={(e) => set("dia_chi", e.target.value)} placeholder="Số nhà, đường, phường/xã, quận/huyện" />
              </Field>

              <Field label="Khoa muốn khám *" span={2}>
                <select style={inp} value={f.khoa_id}
                  onChange={(e) => {
                    // Bỏ chọn khoa thì xóa luôn ngày/giờ đã chọn — lịch khám gắn với khoa
                    setF((s) => ({ ...s, khoa_id: e.target.value, ...(e.target.value ? {} : { ngay_mong_muon: "", gio_mong_muon: "" }) }));
                  }}>
                  <option value="">— Chọn khoa —</option>
                  {khoaList.map((k) => <option key={k.id} value={k.id}>{k.ten}</option>)}
                </select>
                <span style={{ fontSize: 12.5, color: T.sub, display: "block", marginTop: 6 }}>
                  {khoaList.length === 0
                    ? "Chưa tải được danh sách khoa — vui lòng tải lại trang hoặc gọi tổng đài để được hướng dẫn."
                    : "Chọn khoa trước để chọn ngày và giờ mong muốn đến khám."}
                </span>
              </Field>

              <Field label="Ngày mong muốn đến khám">
                <input type="date" min={todayISO()} style={f.khoa_id ? inp : inpOff} value={f.ngay_mong_muon}
                  disabled={!f.khoa_id}
                  onChange={(e) => { set("ngay_mong_muon", e.target.value); if (!e.target.value) set("gio_mong_muon", ""); }} />
                {!f.khoa_id && (
                  <span style={{ fontSize: 12.5, color: T.sub, display: "block", marginTop: 6 }}>
                    Chọn khoa muốn khám trước.
                  </span>
                )}
              </Field>
              <Field label="Giờ mong muốn đến khám">
                <select style={f.khoa_id && f.ngay_mong_muon ? inp : inpOff} value={f.gio_mong_muon}
                  disabled={!f.khoa_id || !f.ngay_mong_muon}
                  onChange={(e) => set("gio_mong_muon", e.target.value)}>
                  <option value="">— Chọn khung giờ —</option>
                  {GIO_KHAM.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
                <span style={{ fontSize: 12.5, color: T.sub, display: "block", marginTop: 6 }}>
                  {!f.khoa_id
                    ? "Chọn khoa muốn khám trước."
                    : f.ngay_mong_muon
                      ? "Giờ khám cuối cùng do lễ tân xác nhận lại theo lịch của bác sĩ."
                      : "Chọn ngày trước để chọn khung giờ."}
                </span>
              </Field>

              <Field label="Lý do khám / triệu chứng" span={2}>
                <textarea rows={3} style={{ ...inp, resize: "vertical" }} value={f.ly_do} onChange={(e) => set("ly_do", e.target.value)}
                  placeholder="Mô tả ngắn gọn triệu chứng hoặc nhu cầu khám (VD: khám thai định kỳ, tư vấn hiếm muộn…)" />
              </Field>
            </div>

            <p style={{ fontSize: 12.5, color: T.sub, lineHeight: 1.55, margin: "16px 0 0" }}>
              Thông tin của bạn chỉ dùng để bộ phận tiếp đón liên hệ và chuẩn bị lịch khám. Vui lòng không nhập
              thông tin bệnh án chi tiết ở đây.
            </p>

            {err && (
              <div style={{ background: "#FDECEA", color: "#C0392B", fontSize: 13.5, padding: "11px 14px", borderRadius: 12, marginTop: 16 }}>{err}</div>
            )}

            <div style={{ marginTop: 20, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Btn kind="primary" onClick={guiDangKy} disabled={busy}>
                <ClipboardCheck size={17} /> {busy ? "Đang gửi…" : "Gửi đăng ký khám"} {!busy && <ArrowRight size={16} />}
              </Btn>
              <Btn kind="ghost" onClick={() => { setF(EMPTY); setErr(null); }}>Nhập lại</Btn>
            </div>
          </Card>
        )}

        {/* Trấn an: các bước tiếp theo */}
        {!ok && (
          <div style={{ maxWidth: 760, margin: "22px auto 0", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14 }}>
            {[
              { icon: ClipboardCheck, t: "1. Gửi đăng ký", d: "Điền thông tin và gửi phiếu đăng ký khám." },
              { icon: Phone, t: "2. Lễ tân liên hệ", d: "Bộ phận tiếp đón gọi xác nhận và sắp lịch." },
              { icon: Stethoscope, t: "3. Đến khám", d: "Đọc mã đăng ký tại quầy tiếp đón để vào khám." },
            ].map((s) => (
              <div key={s.t} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: "16px 18px" }}>
                <span style={{ width: 36, height: 36, borderRadius: 11, background: T.lavSoft, color: T.lav, display: "grid", placeItems: "center", marginBottom: 10 }}><s.icon size={18} /></span>
                <div style={{ fontSize: 14.5, fontWeight: 800, color: T.ink, marginBottom: 4 }}>{s.t}</div>
                <div style={{ fontSize: 13, color: T.sub, lineHeight: 1.5 }}>{s.d}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function chipStyle(active) {
  return {
    display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 999,
    border: `1.5px solid ${active ? T.peach : T.line}`, background: active ? T.peach : T.surface,
    color: active ? "#fff" : T.sub, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
  };
}
