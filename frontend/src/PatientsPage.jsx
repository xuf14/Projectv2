import React, { useState, useEffect, useMemo } from "react";
import {
  User, Filter, MoreHorizontal, ChevronLeft, ChevronRight, ArrowLeft, Clock, FileText,
  X, Stethoscope, Activity, CalendarDays, Phone, MapPin, FlaskConical, Printer, FolderOpen,
  Plus, Edit3, Trash2, CheckCircle2,
} from "lucide-react";
import { T, store, api, useNav, Btn, Card, Pill, Avatar, SectionHead, PageTitle, FormField, input } from "./shared";

// ============================================================================
//  TRANG HỒ SƠ BỆNH NHÂN — file riêng, dùng chung cho cổng Bác sĩ và Lễ tân.
//  - Danh sách hồ sơ:          GET /patients                    (bac_si, le_tan, admin)
//  - Chọn một bệnh nhân → lịch khám của họ hiển thị trên CALENDAR theo từng
//    ngày, lấy từ database:    GET /patients/:id/appointments
// ============================================================================

export function tinhTuoi(ngaySinh) {
  if (!ngaySinh) return null;
  const d = new Date(ngaySinh);
  if (isNaN(d)) return null;
  const now = new Date();
  let t = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) t -= 1;
  return t;
}

export function mapHoSo(h) {
  return { dbId: h.id, code: h.ma_benh_nhan, name: h.ho_ten, age: tinhTuoi(h.ngay_sinh),
    phone: h.sdt || "—", visits: h.so_luot_dat || 0,
    gioi_tinh: h.gioi_tinh || "", ngay_sinh: h.ngay_sinh || "", dia_chi: h.dia_chi || "", so_bhyt: h.so_bhyt || "" };
}

// Mock dự phòng khi backend chưa chạy
const PATIENTS = [
  { code: "BN-08842", name: "Trần Mai Phương", age: 31, phone: "0912 345 678", visits: 8 },
  { code: "BN-08651", name: "Nguyễn Thị Hoa", age: 28, phone: "0987 654 321", visits: 3 },
  { code: "BN-08433", name: "Phạm Hồng Nhung", age: 34, phone: "0934 222 111", visits: 12 },
  { code: "BN-08120", name: "Lê Thị Thu", age: 26, phone: "0901 888 777", visits: 1 },
];

const TT_LICH = {
  cho_xac_nhan: { l: "Chờ xác nhận", tone: T.gold, soft: T.goldSoft },
  da_xac_nhan: { l: "Đã xác nhận", tone: T.sky, soft: T.skySoft },
  da_checkin: { l: "Đã check-in", tone: T.mint, soft: T.mintSoft },
  da_kham: { l: "Đã khám", tone: T.sub, soft: "#F0F0F2" },
  da_huy: { l: "Đã hủy", tone: "#C0392B", soft: "#FDECEA" },
};

const TEN_CLS = { xet_nghiem: "Xét nghiệm", sieu_am: "Siêu âm", thu_thuat: "Thủ thuật" };
const fmtDMY = (d) => { const x = new Date(d); return isNaN(x) ? "" : x.toLocaleDateString("vi-VN"); };
const fmtDT = (d) => { const x = new Date(d); return isNaN(x) ? "" : x.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); };

const fmtVND = (n) => (Number(n) || 0).toLocaleString("vi-VN") + "đ";
const escHtml = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const TEN_LOAI_YL = { thuoc: "Thuốc", vat_tu: "Vật tư", dich_vu: "Dịch vụ" };
const TT_HD = { cho_thanh_toan: "Chờ thanh toán", da_thanh_toan: "Đã thanh toán", da_huy: "Đã hủy" };
const TT_YL = { chua_nop: "Chưa nộp", mot_phan: "Nộp một phần", da_du: "Đã nộp đủ" };

// In HỒ SƠ BỆNH NHÂN — in giấy hoặc chọn "Lưu thành PDF" trong hộp thoại in.
// Dựng tài liệu trong IFRAME ẩn rồi gọi print(): không bị trình duyệt chặn popup
// như cách mở cửa sổ mới. Dữ liệu lấy nguyên từ API tổng hợp, không tính lại.
function inHoSoBenhNhan(d) {
  const hs = d.ho_so || {};
  const th = d.tong_hop || {};
  const o = (v) => (v === null || v === undefined || v === "" ? "—" : v);
  const bang = (tieuDe, cot, dong) => dong.length
    ? `<h2>${escHtml(tieuDe)}</h2><table><thead><tr>${cot.map((c) => `<th>${escHtml(c)}</th>`).join("")}</tr></thead>
       <tbody>${dong.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`
    : `<h2>${escHtml(tieuDe)}</h2><p class="rong">Chưa có dữ liệu.</p>`;

  const phieuKham = (d.phieu_kham || []).map((p) => `
    <div class="khoi">
      <div class="khoi-h"><b>Phiếu khám #${p.id}</b>${p.ma_kcb ? ` · Mã KCB ${escHtml(p.ma_kcb)}` : ""}
        ${p.ngay_kham ? ` · Ngày khám ${escHtml(fmtDMY(p.ngay_kham))}` : ""}</div>
      <div class="kv"><span>BS khám</span><b>${escHtml(o(p.bs_kham))}</b></div>
      <div class="kv"><span>Chuyên khoa</span><b>${escHtml(o(p.chuyen_khoa))}</b></div>
      <div class="kv"><span>Chẩn đoán sơ bộ</span><b>${escHtml(o(p.chan_doan_so_bo))}</b></div>
      <div class="kv"><span>Triệu chứng</span><b>${escHtml(o(p.trieu_chung))}</b></div>
      <div class="kv"><span>Ghi chú KB</span><b>${escHtml(o(p.ghi_chu_kb))}</b></div>
      <div class="kv"><span>Kết luận</span><b>${escHtml(o(p.ket_luan))}</b></div>
    </div>`).join("");

  const yLenh = (d.y_lenh || []).map((y) => `
    <div class="khoi">
      <div class="khoi-h"><b>Y lệnh ${escHtml(y.ma_phieu)}</b> · ${escHtml(TT_YL[y.trang_thai] || y.trang_thai)}
        · Tổng ${fmtVND(y.tong_tien)} · Đã nộp ${fmtVND(y.da_nop)} · Còn lại ${fmtVND(y.con_lai)}</div>
      ${(y.chi_tiet || []).length
        ? `<table><thead><tr><th>Nội dung</th><th>Loại</th><th class="c">SL</th><th class="r">Đơn giá</th><th class="r">Thành tiền</th></tr></thead>
           <tbody>${y.chi_tiet.map((c) => `<tr><td>${escHtml(c.ten)}${c.dvt ? ` (${escHtml(c.dvt)})` : ""}</td>
           <td>${escHtml(TEN_LOAI_YL[c.loai] || c.loai)}</td><td class="c">${c.so_luong}</td>
           <td class="r">${fmtVND(c.don_gia)}</td><td class="r">${fmtVND(c.thanh_tien)}</td></tr>`).join("")}</tbody></table>`
        : `<p class="rong">Phiếu chưa có dòng chi tiết.</p>`}
    </div>`).join("");

  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8">
  <title>Hồ sơ bệnh nhân ${escHtml(hs.ma_benh_nhan || "")}</title>
  <style>
    * { box-sizing: border-box; font-family: 'Segoe UI', Arial, sans-serif; }
    body { color: #2D3A4E; padding: 30px; max-width: 900px; margin: 0 auto; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #F4B942; padding-bottom: 14px; }
    .bv { font-size: 19px; font-weight: 800; color: #E0A427; }
    .sub { font-size: 11.5px; color: #7A8699; letter-spacing: 1px; }
    h1 { font-size: 22px; margin: 18px 0 2px; }
    h2 { font-size: 15px; margin: 22px 0 6px; padding-bottom: 5px; border-bottom: 1.5px solid #E7EBF0; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 5px 20px; font-size: 13.5px; margin: 12px 0 4px; }
    .meta span { color: #7A8699; }
    .the { display: flex; gap: 10px; flex-wrap: wrap; margin: 10px 0 4px; }
    .the div { border: 1px solid #E7EBF0; border-radius: 10px; padding: 8px 14px; font-size: 12.5px; color: #7A8699; }
    .the b { display: block; font-size: 16px; color: #2D3A4E; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12.5px; }
    th, td { padding: 7px 9px; border-bottom: 1px solid #E7EBF0; text-align: left; vertical-align: top; }
    th { background: #FDF2DA; font-size: 11px; text-transform: uppercase; letter-spacing: .4px; }
    td.r, th.r { text-align: right; } td.c, th.c { text-align: center; }
    .khoi { border: 1px solid #E7EBF0; border-radius: 10px; padding: 11px 14px; margin-top: 9px; }
    .khoi-h { font-size: 13.5px; margin-bottom: 6px; }
    .kv { display: flex; gap: 10px; font-size: 12.5px; padding: 2px 0; }
    .kv span { color: #7A8699; min-width: 130px; }
    .rong { color: #7A8699; font-size: 12.5px; margin: 6px 0; }
    @media print { body { padding: 0; } }
  </style></head><body>
    <div class="head">
      <div><div class="bv">BV PHỤ SẢN HẢI PHÒNG</div><div class="sub">HỒ SƠ BỆNH NHÂN</div></div>
      <div class="sub">In lúc ${escHtml(new Date().toLocaleString("vi-VN"))}</div>
    </div>
    <h1>${escHtml(hs.ho_ten || "—")}</h1>
    <div class="meta">
      <div><span>Mã bệnh nhân:</span> <b>${escHtml(o(hs.ma_benh_nhan))}</b></div>
      <div><span>Ngày sinh:</span> <b>${escHtml(hs.ngay_sinh ? fmtDMY(hs.ngay_sinh) : "—")}</b></div>
      <div><span>Giới tính:</span> <b>${escHtml(o(hs.gioi_tinh))}</b></div>
      <div><span>Điện thoại:</span> <b>${escHtml(o(hs.sdt))}</b></div>
      <div><span>Địa chỉ:</span> <b>${escHtml(o(hs.dia_chi))}</b></div>
      <div><span>Số thẻ BHYT:</span> <b>${escHtml(o(hs.so_bhyt))}</b></div>
      <div><span>Hẹn tái khám:</span> <b>${escHtml(hs.ngay_tai_kham ? fmtDMY(hs.ngay_tai_kham) : "—")}</b></div>
      <div><span>BS tái khám:</span> <b>${escHtml(hs.bac_si_tai_kham ? hs.bac_si_tai_kham.ho_ten : "—")}</b></div>
    </div>
    <div class="the">
      <div>Lịch hẹn<b>${o(th.so_lich_hen)}</b></div>
      <div>Đã khám<b>${o(th.so_lan_da_kham)}</b></div>
      <div>Phiếu khám<b>${o(th.so_phieu_kham)}</b></div>
      <div>Tổng viện phí<b>${fmtVND(th.tong_vien_phi)}</b></div>
      <div>Đã nộp<b>${fmtVND(th.da_nop_vien_phi)}</b></div>
      <div>Còn nợ<b>${fmtVND(th.con_no_vien_phi)}</b></div>
    </div>

    <h2>Thông tin khám bệnh</h2>
    ${phieuKham || '<p class="rong">Chưa có phiếu khám bệnh nào.</p>'}

    ${bang("Lịch hẹn khám", ["Mã lịch", "Ngày", "Giờ", "Khoa", "Bác sĩ", "Trạng thái"],
      (d.lich_hen || []).map((l) => [
        escHtml(l.ma_lich_hen), escHtml(l.ngay ? fmtDMY(l.ngay) : "—"), escHtml(o(l.gio)),
        escHtml(o(l.khoa)), escHtml(o(l.bac_si)),
        escHtml((TT_LICH[l.trang_thai] || {}).l || l.trang_thai),
      ]))}

    <h2>Y lệnh viện phí</h2>
    ${yLenh || '<p class="rong">Chưa có phiếu y lệnh nào.</p>'}

    ${bang("Thanh toán dịch vụ", ["Mã hóa đơn", "Lập lúc", "Dịch vụ", "Tổng tiền", "Trạng thái", "Thu lúc"],
      (d.thanh_toan || []).map((t) => [
        escHtml(t.ma_thanh_toan),
        escHtml(fmtDT(t.ngay_tao)),
        escHtml((t.chi_tiet || []).map((c) => `${c.ten_dich_vu} ×${c.so_luong}`).join(", ") || "—"),
        fmtVND(t.tong_tien),
        escHtml(TT_HD[t.trang_thai] || t.trang_thai),
        escHtml(t.ngay_thanh_toan ? fmtDT(t.ngay_thanh_toan) : "—"),
      ]))}

  </body></html>`;

  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed; right:0; bottom:0; width:0; height:0; border:0; visibility:hidden";
  document.body.appendChild(frame);
  const doc = frame.contentWindow && frame.contentWindow.document;
  if (!doc) { frame.remove(); return false; }
  doc.open(); doc.write(html); doc.close();

  const donDep = () => { if (frame.parentNode) frame.remove(); };
  const inRa = () => {
    try {
      frame.contentWindow.focus();
      // Xóa iframe sau khi đóng hộp thoại in; trình duyệt không hỗ trợ afterprint
      // thì dọn theo hẹn giờ để không giữ lại node thừa trong DOM.
      frame.contentWindow.onafterprint = donDep;
      frame.contentWindow.print();
      setTimeout(donDep, 60000);
    } catch { donDep(); }
  };
  if (doc.readyState === "complete") inRa();
  else frame.onload = inRa;
  return true;
}

// Chỉ lễ tân / quản trị viên được thêm, sửa, xóa hồ sơ cá nhân của bệnh nhân
// (backend cũng chặn vai trò khác ở /reception/patients).
const duocSuaHoSo = () => {
  const v = (store.user && store.user.vai_tro) || "";
  return v === "le_tan" || v === "admin";
};

// Cửa sổ THÊM / CHỈNH SỬA HỒ SƠ CÁ NHÂN của bệnh nhân.
// POST /reception/patients khi thêm, PATCH /reception/patients/:id khi sửa.
function PopupSuaHoSo({ init, onClose, onSaved }) {
  const [f, setF] = useState({
    ho_ten: (init && init.ho_ten) || "", ngay_sinh: (init && init.ngay_sinh) || "",
    gioi_tinh: (init && init.gioi_tinh) || "", sdt: (init && init.sdt) || "",
    dia_chi: (init && init.dia_chi) || "", so_bhyt: (init && init.so_bhyt) || "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const upd = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const dangSua = !!(init && init.id);

  const save = async () => {
    if (!f.ho_ten.trim()) { setErr("Vui lòng nhập họ và tên."); return; }
    if (f.sdt && !/^0\d{9,10}$/.test(f.sdt.replace(/[\s.]/g, ""))) { setErr("Số điện thoại không hợp lệ."); return; }
    setBusy(true); setErr(null);
    try {
      if (dangSua) await api.updatePatientRecord(init.id, f);
      else await api.createPatientRecord(f);
      onSaved();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "grid", placeItems: "center", zIndex: 90, padding: 16 }}>
      <Card onClick={(e) => e.stopPropagation()} style={{ width: 620, maxWidth: "100%", maxHeight: "90vh", padding: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "15px 18px", borderBottom: `1px solid ${T.line}`, display: "flex", alignItems: "center", gap: 11 }}>
          <span style={{ width: 36, height: 36, borderRadius: 11, background: T.peachSoft, color: T.peach, display: "grid", placeItems: "center" }}><User size={18} /></span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15.5, fontWeight: 800, color: T.ink }}>
              {dangSua ? `Chỉnh sửa hồ sơ: ${init.ho_ten}` : "Thêm hồ sơ bệnh nhân"}
            </div>
            <div style={{ fontSize: 12.5, color: T.sub, marginTop: 1 }}>
              {dangSua ? `Mã BN: ${init.ma_benh_nhan}` : "Tạo hồ sơ cho bệnh nhân mới đến khám."}
            </div>
          </div>
          <Btn kind="ghost" size="sm" onClick={onClose}><X size={16} /></Btn>
        </div>
        <div style={{ padding: 18, overflowY: "auto" }}>
          <div style={{ display: "grid", gap: 14 }}>
            <FormField label="Họ và tên *"><input value={f.ho_ten} onChange={upd("ho_ten")} placeholder="Nhập họ và tên" style={input} /></FormField>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }} className="grid2">
              <FormField label="Ngày sinh"><input type="date" value={f.ngay_sinh} onChange={upd("ngay_sinh")} style={input} /></FormField>
              <FormField label="Giới tính">
                <select value={f.gioi_tinh} onChange={upd("gioi_tinh")} style={{ ...input, background: T.surface }}>
                  <option value="">— Chọn —</option><option>Nữ</option><option>Nam</option><option>Khác</option>
                </select>
              </FormField>
            </div>
            <FormField label="Số điện thoại"><input value={f.sdt} onChange={upd("sdt")} placeholder="VD: 0912345678" style={input} /></FormField>
            <FormField label="Địa chỉ"><input value={f.dia_chi} onChange={upd("dia_chi")} placeholder="Quận/huyện, tỉnh/thành phố" style={input} /></FormField>
            <FormField label="Số thẻ BHYT"><input value={f.so_bhyt} onChange={upd("so_bhyt")} placeholder="Không bắt buộc" style={input} /></FormField>
          </div>
          {err && <div style={{ background: "#FDECEA", color: "#C0392B", fontSize: 13.5, padding: "10px 14px", borderRadius: 12, marginTop: 14 }}>{err}</div>}
          <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
            <Btn kind="ghost" onClick={onClose}>Hủy bỏ</Btn>
            <Btn kind="mint" disabled={busy} onClick={save}>
              <CheckCircle2 size={16} /> {busy ? "Đang lưu..." : dangSua ? "Cập nhật" : "Tạo hồ sơ"}
            </Btn>
          </div>
        </div>
      </Card>
    </div>
  );
}

// Cửa sổ HỒ SƠ BỆNH NHÂN: gom hồ sơ cá nhân, thông tin khám bệnh, lịch hẹn,
// y lệnh viện phí và thanh toán (GET /patients/:id/summary), có nút in / lưu PDF.
// Lễ tân / quản trị viên chỉnh sửa hoặc xóa hồ sơ cá nhân ngay tại đây.
function PopupHoSoBenhNhan({ p, onClose, onSua, onXoaXong }) {
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [canhBao, setCanhBao] = useState(null);
  const [xoaBusy, setXoaBusy] = useState(false);
  const suaDuoc = duocSuaHoSo();

  useEffect(() => {
    let alive = true;
    setLoading(true); setErr(null);
    api.patientSummary(p.dbId)
      .then((r) => { if (alive) setD(r); })
      .catch((e) => { if (alive) setErr(e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [p.dbId]);

  const xoaHoSo = async () => {
    if (!d) return;
    const hs = d.ho_so;
    if (!window.confirm(`Xóa vĩnh viễn hồ sơ ${hs.ma_benh_nhan} (${hs.ho_ten}) khỏi hệ thống?`)) return;
    setXoaBusy(true); setErr(null);
    try { await api.deletePatientRecord(p.dbId); onXoaXong(); }
    catch (e) { setErr(e.message); setXoaBusy(false); }
  };

  const inHoSo = () => {
    if (!d) return;
    setCanhBao(inHoSoBenhNhan(d) ? null : "Không mở được hộp thoại in của trình duyệt. Thử lại hoặc dùng Ctrl+P.");
  };

  const hs = (d && d.ho_so) || {};
  const th = (d && d.tong_hop) || {};
  const muc = { fontWeight: 800, color: T.ink, fontSize: 14.5, margin: "18px 0 8px" };
  const nho = { fontSize: 12.5, color: T.sub };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "grid", placeItems: "center", zIndex: 80, padding: 16 }}>
      <Card onClick={(e) => e.stopPropagation()} style={{ width: 920, maxWidth: "100%", maxHeight: "90vh", padding: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "15px 18px", borderBottom: `1px solid ${T.line}`, display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar size={40} tone={T.peachSoft} color={T.peach} icon={User} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: T.ink }}>{p.name}</div>
            <div style={{ ...nho, marginTop: 1 }}>
              {p.code}{hs.sdt ? ` · ${hs.sdt}` : ""}{p.age != null ? ` · ${p.age} tuổi` : ""}
            </div>
          </div>
          <Btn kind="gold" size="sm" disabled={!d} onClick={inHoSo}><Printer size={15} /> In / Lưu PDF</Btn>
          <Btn kind="ghost" size="sm" onClick={onClose}><X size={16} /></Btn>
        </div>

        <div style={{ padding: 18, overflowY: "auto" }}>
          {loading && <div style={{ color: T.sub, fontSize: 14 }}>Đang tải hồ sơ...</div>}
          {err && <Card style={{ padding: 14, background: "#FDECEA", border: "none", color: "#C0392B", fontSize: 13.5 }}>{err}</Card>}
          {canhBao && <Card style={{ padding: 14, marginBottom: 12, background: T.goldSoft, border: "none", color: "#B5851B", fontSize: 13.5 }}>{canhBao}</Card>}

          {d && (
            <>
              {/* Hành chính + số liệu tổng hợp */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
                {[["Lịch hẹn", th.so_lich_hen], ["Đã khám", th.so_lan_da_kham], ["Phiếu khám", th.so_phieu_kham],
                  ["Tổng viện phí", fmtVND(th.tong_vien_phi)], ["Đã nộp", fmtVND(th.da_nop_vien_phi)], ["Còn nợ", fmtVND(th.con_no_vien_phi)]].map(([l, v]) => (
                  <div key={l} style={{ border: `1.5px solid ${T.line}`, borderRadius: 12, padding: "9px 13px" }}>
                    <div style={nho}>{l}</div>
                    <div style={{ fontWeight: 800, color: T.ink, fontSize: 16, marginTop: 2 }}>{v}</div>
                  </div>
                ))}
              </div>
              {/* Hồ sơ cá nhân — trước đây là một mục riêng ở menu, nay gộp vào đây */}
              <div style={{ ...muc, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span><User size={15} style={{ verticalAlign: -2 }} /> Hồ sơ cá nhân</span>
                {suaDuoc && (
                  <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                    <Btn kind="ghost" size="sm" onClick={() => onSua(hs)}><Edit3 size={14} /> Chỉnh sửa</Btn>
                    <Btn kind="ghost" size="sm" disabled={xoaBusy} style={{ color: "#C0392B", borderColor: "#FDECEA" }} onClick={xoaHoSo}>
                      <Trash2 size={14} /> {xoaBusy ? "Đang xóa..." : "Xóa hồ sơ"}
                    </Btn>
                  </span>
                )}
              </div>
              <div style={{ background: T.bg, borderRadius: 12, padding: "11px 14px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "5px 16px", fontSize: 13 }}>
                <div><span style={nho}>Mã bệnh nhân: </span>{hs.ma_benh_nhan || "—"}</div>
                <div><span style={nho}>Ngày sinh: </span>{hs.ngay_sinh ? fmtDMY(hs.ngay_sinh) : "—"}</div>
                <div><span style={nho}>Giới tính: </span>{hs.gioi_tinh || "—"}</div>
                <div><span style={nho}>Số điện thoại: </span>{hs.sdt || "—"}</div>
                <div><span style={nho}>Địa chỉ: </span>{hs.dia_chi || "—"}</div>
                <div><span style={nho}>Số thẻ BHYT: </span>{hs.so_bhyt || "—"}</div>
                <div><span style={nho}>Hẹn tái khám: </span>{hs.ngay_tai_kham ? fmtDMY(hs.ngay_tai_kham) : "—"}</div>
                <div><span style={nho}>BS tái khám: </span>{hs.bac_si_tai_kham ? hs.bac_si_tai_kham.ho_ten : "—"}</div>
              </div>

              {/* Thông tin khám bệnh */}
              <div style={muc}><Stethoscope size={15} style={{ verticalAlign: -2 }} /> Thông tin khám bệnh ({d.phieu_kham.length})</div>
              {d.phieu_kham.length === 0 ? <div style={nho}>Chưa có phiếu khám bệnh nào.</div> : (
                <div style={{ display: "grid", gap: 9 }}>
                  {d.phieu_kham.map((k) => (
                    <div key={k.id} style={{ border: `1.5px solid ${T.line}`, borderRadius: 12, padding: "11px 14px" }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>
                        Phiếu #{k.id}{k.ma_kcb ? ` · ${k.ma_kcb}` : ""}{k.ngay_kham ? ` · Khám ${fmtDMY(k.ngay_kham)}` : ""}
                        {k.bs_kham ? ` · ${k.bs_kham}` : ""}
                      </div>
                      <div style={{ ...nho, marginTop: 4, lineHeight: 1.6 }}>
                        {k.chuyen_khoa ? <div>Chuyên khoa: <b style={{ color: T.ink }}>{k.chuyen_khoa}</b></div> : null}
                        {k.chan_doan_so_bo ? <div>Chẩn đoán sơ bộ: <b style={{ color: T.ink }}>{k.chan_doan_so_bo}</b></div> : null}
                        {k.trieu_chung ? <div>Triệu chứng: {k.trieu_chung}</div> : null}
                        {k.ghi_chu_kb ? <div>Ghi chú KB: {k.ghi_chu_kb}</div> : null}
                        {k.ket_luan ? <div>Kết luận: {k.ket_luan}</div> : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Lịch hẹn */}
              <div style={muc}><CalendarDays size={15} style={{ verticalAlign: -2 }} /> Lịch hẹn khám ({d.lich_hen.length})</div>
              {d.lich_hen.length === 0 ? <div style={nho}>Chưa có lịch hẹn nào.</div> : (
                <div style={{ display: "grid", gap: 7 }}>
                  {d.lich_hen.map((l) => {
                    const s = TT_LICH[l.trang_thai] || TT_LICH.cho_xac_nhan;
                    return (
                      <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", border: `1px solid ${T.line}`, borderRadius: 11, padding: "9px 13px", fontSize: 13.5 }}>
                        <b style={{ color: T.ink }}>{l.ma_lich_hen}</b>
                        <span style={nho}>{l.ngay ? fmtDMY(l.ngay) : "—"} {l.gio || ""}</span>
                        <span style={nho}>{l.khoa || "—"}{l.bac_si ? ` · ${l.bac_si}` : ""}</span>
                        <span style={{ marginLeft: "auto" }}><Pill tone={s.tone} soft={s.soft}>{s.l}</Pill></span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Y lệnh viện phí */}
              <div style={muc}><FileText size={15} style={{ verticalAlign: -2 }} /> Y lệnh viện phí ({d.y_lenh.length})</div>
              {d.y_lenh.length === 0 ? <div style={nho}>Chưa có phiếu y lệnh nào.</div> : (
                <div style={{ display: "grid", gap: 9 }}>
                  {d.y_lenh.map((y) => (
                    <div key={y.id} style={{ border: `1.5px solid ${T.line}`, borderRadius: 12, padding: "11px 14px" }}>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", fontSize: 13.5 }}>
                        <b style={{ color: T.ink }}>{y.ma_phieu}</b>
                        <span style={nho}>{fmtDT(y.ngay_tao)}</span>
                        <span style={{ marginLeft: "auto", fontWeight: 700, color: T.ink }}>
                          {fmtVND(y.tong_tien)} · đã nộp {fmtVND(y.da_nop)}
                          {y.con_lai > 0 ? <span style={{ color: "#C0392B" }}> · còn {fmtVND(y.con_lai)}</span> : null}
                        </span>
                      </div>
                      {y.chi_tiet.length > 0 && (
                        <div style={{ ...nho, marginTop: 6, lineHeight: 1.6 }}>
                          {y.chi_tiet.map((c, i) => (
                            <div key={i}>
                              {TEN_LOAI_YL[c.loai] || c.loai}: <b style={{ color: T.ink }}>{c.ten}</b>
                              {c.dvt ? ` (${c.dvt})` : ""} × {c.so_luong} · {fmtVND(c.don_gia)} = {fmtVND(c.thanh_tien)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Thanh toán dịch vụ */}
              <div style={muc}><Activity size={15} style={{ verticalAlign: -2 }} /> Thanh toán dịch vụ ({d.thanh_toan.length})</div>
              {d.thanh_toan.length === 0 ? <div style={nho}>Chưa có hóa đơn dịch vụ nào.</div> : (
                <div style={{ display: "grid", gap: 7 }}>
                  {d.thanh_toan.map((t) => (
                    <div key={t.id} style={{ border: `1px solid ${T.line}`, borderRadius: 11, padding: "9px 13px", fontSize: 13.5 }}>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                        <b style={{ color: T.ink }}>{t.ma_thanh_toan}</b>
                        <span style={nho}>{fmtDT(t.ngay_tao)}</span>
                        <span style={{ marginLeft: "auto", fontWeight: 700, color: T.ink }}>{fmtVND(t.tong_tien)}</span>
                        <Pill tone={t.trang_thai === "da_thanh_toan" ? T.mint : T.gold}
                          soft={t.trang_thai === "da_thanh_toan" ? T.mintSoft : T.goldSoft}>
                          {TT_HD[t.trang_thai] || t.trang_thai}
                        </Pill>
                      </div>
                      {t.chi_tiet.length > 0 && (
                        <div style={{ ...nho, marginTop: 4 }}>
                          {t.chi_tiet.map((c) => `${c.ten_dich_vu} ×${c.so_luong} = ${fmtVND(c.thanh_tien)}`).join(" · ")}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

// Danh sách hồ sơ; bấm một bệnh nhân để mở calendar lịch khám của họ
export function PatientList() {
  const { online } = useNav();
  const live = online && !!store.token;
  const [list, setList] = useState(live ? null : PATIENTS);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [selected, setSelected] = useState(null);
  const [hoSoMo, setHoSoMo] = useState(null);   // bệnh nhân đang mở cửa sổ hồ sơ tổng hợp
  const [formHoSo, setFormHoSo] = useState(null); // {} = thêm mới, { ...hs } = sửa
  const suaDuoc = duocSuaHoSo();

  const load = () => {
    if (!live) return;
    setLoading(true); setErr(null);
    api.patients()
      .then((r) => setList(Array.isArray(r) ? r.map(mapHoSo) : []))
      .catch((e) => { setErr(e.message); setList([]); })
      .finally(() => setLoading(false));
  };
  useEffect(load, [online]);

  if (selected) return <PatientCalendar p={selected} live={live} onBack={() => setSelected(null)} />;

  const data = list || [];
  return (
    <div>
      <PageTitle title="Hồ sơ bệnh nhân"
        sub={live ? "Bấm vào một bệnh nhân để xem lịch khám; bấm \"Hồ sơ\" để mở cửa sổ tổng hợp (hồ sơ cá nhân, khám bệnh, viện phí, thanh toán) và in / lưu PDF." : "Dữ liệu demo — đăng nhập với backend để xem hồ sơ thật."}
        action={
          <div style={{ display: "flex", gap: 10 }}>
            {live && suaDuoc && <Btn kind="gold" onClick={() => setFormHoSo({})}><Plus size={16} /> Thêm hồ sơ</Btn>}
            <Btn kind="ghost"><Filter size={15} /> Lọc</Btn>
          </div>
        } />
      {loading && <div style={{ color: T.sub, fontSize: 14, marginBottom: 12 }}>Đang tải hồ sơ...</div>}
      {err && <Card style={{ padding: 18, marginBottom: 14, background: "#FDECEA", border: "none", color: "#C0392B", fontSize: 14 }}>{err} — trang này cần tài khoản bác sĩ hoặc lễ tân.</Card>}
      {!loading && !err && data.length === 0 && <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>Chưa có hồ sơ bệnh nhân nào.</Card>}
      <Card style={{ padding: 0, overflow: "hidden", display: data.length ? undefined : "none" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.4fr 1fr auto", gap: 12, padding: "16px 22px", borderBottom: `1px solid ${T.line}`, background: T.bg, fontSize: 12.5, fontWeight: 800, color: T.sub, textTransform: "uppercase", letterSpacing: 0.5 }} className="tableHead">
          <span>Bệnh nhân</span><span>Tuổi</span><span>Điện thoại</span><span>Lượt đặt</span><span></span>
        </div>
        {data.map((p, i) => (
          <div key={p.code} onClick={() => setSelected(p)} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.4fr 1fr auto", gap: 12, padding: "16px 22px", borderBottom: i < data.length - 1 ? `1px solid ${T.line}55` : "none", alignItems: "center", fontSize: 14.5, cursor: "pointer" }} className="tableRow">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}><Avatar size={38} tone={T.peachSoft} color={T.peach} icon={User} /><div><div style={{ fontWeight: 700, color: T.ink }}>{p.name}</div><div style={{ fontSize: 12.5, color: T.sub }}>{p.code}</div></div></div>
            <span style={{ color: T.sub }}>{p.age != null ? p.age : "—"}</span>
            <span style={{ color: T.sub }}>{p.phone}</span>
            <span style={{ color: T.ink, fontWeight: 700 }}>{p.visits} lần</span>
            <button onClick={(e) => { e.stopPropagation(); if (live) setHoSoMo(p); }} disabled={!live}
              title={live ? "Mở hồ sơ tổng hợp (in / lưu PDF)" : "Cần kết nối backend"}
              style={{ display: "flex", alignItems: "center", gap: 6, background: T.bg, border: `1px solid ${T.line}`, borderRadius: 10, padding: "7px 12px", cursor: live ? "pointer" : "default", fontFamily: "inherit", fontSize: 13, fontWeight: 700, color: live ? T.ink : T.sub }}>
              <FolderOpen size={16} color={T.sub} /> Hồ sơ
            </button>
          </div>
        ))}
      </Card>
      {hoSoMo && (
        <PopupHoSoBenhNhan p={hoSoMo} onClose={() => setHoSoMo(null)}
          onSua={(hs) => setFormHoSo(hs)}
          onXoaXong={() => { setHoSoMo(null); load(); }} />
      )}
      {formHoSo && (
        <PopupSuaHoSo init={formHoSo.id ? formHoSo : null} onClose={() => setFormHoSo(null)}
          onSaved={() => { setFormHoSo(null); setHoSoMo(null); load(); }} />
      )}
    </div>
  );
}

const pad2 = (n) => String(n).padStart(2, "0");
const ymdLocal = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const THANG = ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"];

// Calendar lịch khám của một bệnh nhân: mỗi ngày có lịch hẹn hiện badge số lượng,
// bấm vào ngày để xem chi tiết các lịch hẹn hôm đó (giờ, khoa, bác sĩ, trạng thái)
function PatientCalendar({ p, live, onBack }) {
  const today = new Date();
  const [appts, setAppts] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [ym, setYm] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [sel, setSel] = useState(ymdLocal(today));
  const [chiTiet, setChiTiet] = useState(null);   // lịch khám đang mở popup chi tiết
  const [moHoSo, setMoHoSo] = useState(false);    // cửa sổ hồ sơ tổng hợp

  useEffect(() => {
    if (!live) return;
    setLoading(true); setErr(null);
    api.patientAppts(p.dbId)
      .then((r) => setAppts(Array.isArray(r) ? r : []))
      .catch((e) => { setErr(e.message); setAppts([]); })
      .finally(() => setLoading(false));
  }, [p.dbId]);

  // Gom lịch hẹn theo ngày (khung_gio.ngay dạng YYYY-MM-DD)
  const byDay = useMemo(() => {
    const m = {};
    (appts || []).forEach((a) => {
      const d = a.khung_gio && a.khung_gio.ngay;
      if (!d) return;
      (m[d] = m[d] || []).push(a);
    });
    Object.values(m).forEach((l) => l.sort((a, b) => (a.khung_gio.gio_bat_dau || "").localeCompare(b.khung_gio.gio_bat_dau || "")));
    return m;
  }, [appts]);

  const startIdx = (new Date(ym.y, ym.m, 1).getDay() + 6) % 7; // tuần bắt đầu Thứ 2
  const soNgay = new Date(ym.y, ym.m + 1, 0).getDate();
  const keyOf = (d) => `${ym.y}-${pad2(ym.m + 1)}-${pad2(d)}`;
  const todayKey = ymdLocal(today);
  const doiThang = (dir) => setYm(({ y, m }) => { const d = new Date(y, m + dir, 1); return { y: d.getFullYear(), m: d.getMonth() }; });

  const selAppts = byDay[sel] || [];
  const fmtSel = (() => { const [y, m, d] = sel.split("-"); return `${d}/${m}/${y}`; })();

  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", color: T.sub, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", gap: 5, marginBottom: 14 }}><ArrowLeft size={15} /> Về danh sách hồ sơ</button>
      <Card style={{ padding: 22, marginBottom: 18, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <Avatar size={54} tone={T.peachSoft} color={T.peach} icon={User} />
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontWeight: 800, color: T.ink, fontSize: 17 }}>{p.name}</div>
          <div style={{ color: T.sub, fontSize: 13.5, marginTop: 3 }}>{p.code} · {p.phone}{p.age != null ? ` · ${p.age} tuổi` : ""} · {p.visits} lượt đặt</div>
        </div>
        {live && appts && <Pill tone={T.sky} soft={T.skySoft}>{appts.length} lịch khám trong hệ thống</Pill>}
        {live && <Btn kind="gold" size="sm" onClick={() => setMoHoSo(true)}><FolderOpen size={15} /> Hồ sơ tổng hợp</Btn>}
      </Card>
      {moHoSo && <PopupHoSoBenhNhan p={p} onClose={() => setMoHoSo(false)} />}

      {!live && <Card style={{ padding: 30, textAlign: "center", color: T.sub }}>Cần kết nối backend để xem lịch khám thật của bệnh nhân.</Card>}
      {err && <Card style={{ padding: 18, marginBottom: 14, background: "#FDECEA", border: "none", color: "#C0392B", fontSize: 14 }}>{err}</Card>}
      {loading && <div style={{ color: T.sub, fontSize: 14, marginBottom: 12 }}>Đang tải lịch khám...</div>}

      {live && !err && (
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 20, alignItems: "start" }} className="examGrid">
          <Card style={{ padding: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <button onClick={() => doiThang(-1)} style={{ background: T.bg, border: `1px solid ${T.line}`, borderRadius: 10, padding: 7, cursor: "pointer", display: "grid", placeItems: "center" }}><ChevronLeft size={17} color={T.sub} /></button>
              <div style={{ fontWeight: 800, color: T.ink, fontSize: 16 }}>{THANG[ym.m]} / {ym.y}</div>
              <button onClick={() => doiThang(1)} style={{ background: T.bg, border: `1px solid ${T.line}`, borderRadius: 10, padding: 7, cursor: "pointer", display: "grid", placeItems: "center" }}><ChevronRight size={17} color={T.sub} /></button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
              {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((t) => (
                <div key={t} style={{ textAlign: "center", fontSize: 12, fontWeight: 800, color: T.sub, padding: "4px 0" }}>{t}</div>
              ))}
              {Array.from({ length: startIdx }).map((_, i) => <div key={"e" + i} />)}
              {Array.from({ length: soNgay }, (_, i) => i + 1).map((d) => {
                const k = keyOf(d);
                const n = (byDay[k] || []).length;
                const isSel = k === sel;
                const isToday = k === todayKey;
                return (
                  <button key={k} onClick={() => setSel(k)} style={{
                    position: "relative", aspectRatio: "1", border: isSel ? `2px solid ${T.peach}` : `1.5px solid ${isToday ? T.sky : T.line + "88"}`,
                    borderRadius: 12, background: n ? T.peachSoft : T.surface, cursor: "pointer",
                    fontWeight: isToday || isSel ? 800 : 600, fontSize: 13.5, color: T.ink, fontFamily: "inherit",
                  }}>
                    {d}
                    {n > 0 && <span style={{ position: "absolute", top: 3, right: 3, minWidth: 16, height: 16, borderRadius: 99, background: T.peach, color: "#fff", fontSize: 10, fontWeight: 800, display: "grid", placeItems: "center", padding: "0 3px" }}>{n}</span>}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 14, fontSize: 12, color: T.sub, flexWrap: "wrap" }}>
              <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: T.peachSoft, border: `1px solid ${T.peach}`, verticalAlign: -1, marginRight: 5 }} />Ngày có lịch khám</span>
              <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, border: `1.5px solid ${T.sky}`, verticalAlign: -1, marginRight: 5 }} />Hôm nay</span>
            </div>
          </Card>

          <div>
            <SectionHead title={`Lịch khám ngày ${fmtSel}`} />
            {selAppts.length === 0 && <Card style={{ padding: 28, textAlign: "center", color: T.sub, fontSize: 14 }}>Không có lịch khám nào trong ngày này.</Card>}
            <div style={{ display: "grid", gap: 10 }}>
              {selAppts.map((a) => {
                const s = TT_LICH[a.trang_thai] || TT_LICH.cho_xac_nhan;
                return (
                  <Card key={a.id} hover onClick={() => setChiTiet(a)} style={{ padding: 16, cursor: "pointer" }}>
                    <div style={{ display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" }}>
                      <Pill tone={s.tone} soft={s.soft}>{s.l}</Pill>
                      <span style={{ fontWeight: 800, color: T.ink, fontSize: 15 }}><Clock size={13} style={{ verticalAlign: -2 }} /> {a.khung_gio.gio_bat_dau}</span>
                      {a.so_thu_tu && <span style={{ fontSize: 12.5, color: T.sub }}>STT #{a.so_thu_tu}</span>}
                      <span style={{ marginLeft: "auto", fontSize: 12, color: T.peach, fontWeight: 700 }}>Xem chi tiết →</span>
                    </div>
                    <div style={{ color: T.sub, fontSize: 13.5, marginTop: 7 }}>
                      Mã <b style={{ color: T.ink }}>{a.ma_lich_hen}</b>
                      {a.khoa ? <> · {a.khoa.ten_khoa}</> : null}
                      {a.khung_gio.bac_si ? <> · {a.khung_gio.bac_si.ho_ten}</> : null}
                    </div>
                    <div onClick={(e) => e.stopPropagation()}><DocList lichId={a.id} /></div>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {chiTiet && <ChiTietLichModal p={p} a={chiTiet} onClose={() => setChiTiet(null)} />}
    </div>
  );
}

// Bệnh án bệnh nhân đã tải lên cho lịch hẹn — bác sĩ/lễ tân xem online (PDF)
// hoặc tải về dạng PDF/Word (GET /appointments/:id/documents + /documents/:id/download)
const linkBtn = { background: "none", border: "none", color: "#5BA8D0", fontWeight: 800, fontSize: 12.5, cursor: "pointer", padding: 0, fontFamily: "inherit" };

function DocList({ lichId }) {
  const [list, setList] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    api.documents(lichId)
      .then((r) => setList(Array.isArray(r) ? r : []))
      .catch((e) => { setErr(e.message); setList([]); });
  }, [lichId]);

  if (!list || (list.length === 0 && !err)) return null;

  const open = async (d, xemOnline) => {
    setErr(null);
    try {
      const blob = await api.downloadDocument(d.id);
      const url = URL.createObjectURL(blob);
      if (xemOnline) window.open(url, "_blank");
      else { const a = document.createElement("a"); a.href = url; a.download = d.ten_tep; a.click(); }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) { setErr(e.message); }
  };

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${T.line}` }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: T.sub, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Bệnh án đính kèm</div>
      {err && <div style={{ color: "#C0392B", fontSize: 12.5 }}>{err}</div>}
      {list.map((d) => (
        <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "4px 0", flexWrap: "wrap" }}>
          <FileText size={14} color={T.peach} />
          <span style={{ flex: 1, minWidth: 120, color: T.ink, fontWeight: 700 }}>{d.ten_tep}</span>
          <span style={{ color: T.sub, fontSize: 12 }}>{d.loai_tep === "application/pdf" ? "PDF" : "Word"}</span>
          {d.loai_tep === "application/pdf" && <button onClick={() => open(d, true)} style={linkBtn}>Xem online</button>}
          <button onClick={() => open(d, false)} style={linkBtn}>Tải về</button>
        </div>
      ))}
    </div>
  );
}

// Popup chi tiết khi bấm vào một lịch khám: thông tin cá nhân + lịch sử khám +
// diễn biến bệnh của bệnh nhân (dữ liệu lấy từ backend theo hồ sơ).
function ChiTietLichModal({ p, a, onClose }) {
  const [tab, setTab] = useState("cn");
  const [ls, setLs] = useState(null);   // lịch sử khám (revisitInfo.lan_kham)
  const [db, setDb] = useState(null);   // diễn biến điều trị
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      api.revisitInfo(p.dbId).catch(() => null),
      api.progressByPatient(p.dbId).catch(() => []),
    ]).then(([info, prog]) => {
      if (!alive) return;
      setLs(info && Array.isArray(info.lan_kham) ? info.lan_kham : []);
      setDb(Array.isArray(prog) ? prog : []);
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [p.dbId]);

  const s = TT_LICH[a.trang_thai] || TT_LICH.cho_xac_nhan;
  const tuoi = p.age != null ? p.age : tinhTuoi(p.ngay_sinh);
  const lanCo = (ls || []).filter((lk) => lk.ket_luan || lk.so_kham || (lk.can_lam_sang && lk.can_lam_sang.length) || (lk.tai_lieu && lk.tai_lieu.length));

  const TabBtn = ({ id, icon: Icon, children }) => (
    <button onClick={() => setTab(id)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 14px", border: "none", borderBottom: `2px solid ${tab === id ? T.peach : "transparent"}`, background: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, fontWeight: 700, color: tab === id ? T.peach : T.sub, whiteSpace: "nowrap" }}>
      <Icon size={15} /> {children}
    </button>
  );
  const Row = ({ icon: Icon, label, value }) => (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <Icon size={15} style={{ color: T.peach, marginTop: 2, flexShrink: 0 }} />
      <div><div style={{ fontSize: 12, color: T.sub, fontWeight: 600 }}>{label}</div><div style={{ fontSize: 14, color: T.ink, fontWeight: 600 }}>{value || "—"}</div></div>
    </div>
  );

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "grid", placeItems: "center", zIndex: 70, padding: 16 }}>
      <Card onClick={(e) => e.stopPropagation()} style={{ padding: 0, maxWidth: 640, width: "100%", maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: `1px solid ${T.line}` }}>
          <Avatar size={44} tone={T.peachSoft} color={T.peach} icon={User} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, color: T.ink, fontSize: 16 }}>{p.name}</div>
            <div style={{ fontSize: 12.5, color: T.sub }}>{p.code}{tuoi != null ? ` · ${tuoi} tuổi` : ""} · Lịch {a.ma_lich_hen}</div>
          </div>
          <button onClick={onClose} title="Đóng" style={{ background: "none", border: "none", cursor: "pointer", color: T.sub, padding: 2 }}><X size={20} /></button>
        </div>

        <div style={{ display: "flex", gap: 4, padding: "0 10px", borderBottom: `1px solid ${T.line}`, flexShrink: 0, overflowX: "auto" }}>
          <TabBtn id="cn" icon={User}>Thông tin cá nhân</TabBtn>
          <TabBtn id="lichsu" icon={Stethoscope}>Lịch sử khám</TabBtn>
          <TabBtn id="dienbien" icon={Activity}>Diễn biến bệnh</TabBtn>
        </div>

        <div style={{ padding: 20, overflowY: "auto" }}>
          {tab === "cn" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
              <Row icon={CalendarDays} label="Ngày sinh" value={p.ngay_sinh ? fmtDMY(p.ngay_sinh) : (tuoi != null ? `${tuoi} tuổi` : "")} />
              <Row icon={User} label="Giới tính" value={p.gioi_tinh} />
              <Row icon={Phone} label="Điện thoại" value={p.phone} />
              <Row icon={FileText} label="Số thẻ BHYT" value={p.so_bhyt} />
              <Row icon={MapPin} label="Địa chỉ" value={p.dia_chi} />
              <Row icon={Stethoscope} label="Tổng lượt đặt" value={`${p.visits} lượt`} />
              <div style={{ gridColumn: "span 2", borderTop: `1px solid ${T.line}`, paddingTop: 12, marginTop: 2 }}>
                <div style={{ fontSize: 12, color: T.sub, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 }}>Lịch khám đang xem</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <Pill tone={s.tone} soft={s.soft}>{s.l}</Pill>
                  <span style={{ fontSize: 13.5, color: T.ink }}><Clock size={13} style={{ verticalAlign: -2 }} /> {a.khung_gio.gio_bat_dau}{a.so_thu_tu ? ` · STT #${a.so_thu_tu}` : ""}</span>
                </div>
                <div style={{ fontSize: 13.5, color: T.sub, marginTop: 6 }}>{a.ma_lich_hen}{a.khoa ? ` · ${a.khoa.ten_khoa}` : ""}{a.khung_gio.bac_si ? ` · ${a.khung_gio.bac_si.ho_ten}` : ""}</div>
              </div>
            </div>
          )}

          {tab === "lichsu" && (
            loading ? <div style={{ color: T.sub, fontSize: 14 }}>Đang tải…</div>
              : lanCo.length === 0 ? <div style={{ color: T.sub, fontSize: 14, textAlign: "center", padding: "20px 0" }}>Chưa có dữ liệu khám nào.</div>
                : <div style={{ display: "grid", gap: 12 }}>
                  {lanCo.map((lk) => (
                    <div key={lk.lich_hen_id} style={{ border: `1px solid ${T.line}`, borderRadius: 12, padding: 14 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                        <Pill tone={T.sky} soft={T.skySoft}>{lk.ma_lich_hen}</Pill>
                        <span style={{ fontWeight: 700, color: T.ink, fontSize: 13.5 }}>{lk.ngay ? fmtDMY(lk.ngay) : "—"}{lk.gio ? ` · ${lk.gio}` : ""}</span>
                        <span style={{ fontSize: 12.5, color: T.sub }}>{[lk.bac_si, lk.khoa].filter(Boolean).join(" — ")}</span>
                      </div>
                      {lk.ket_luan ? (
                        <div style={{ fontSize: 13.5, color: T.ink, display: "grid", gap: 3 }}>
                          <div><b>Chẩn đoán:</b> {lk.ket_luan.chan_doan_chinh}{lk.ket_luan.ma_icd ? ` (${lk.ket_luan.ma_icd})` : ""}</div>
                          {lk.ket_luan.don_thuoc && <div style={{ whiteSpace: "pre-wrap" }}><b>Đơn thuốc:</b> {lk.ket_luan.don_thuoc}</div>}
                          {lk.ket_luan.loi_dan && <div style={{ whiteSpace: "pre-wrap" }}><b>Lời dặn:</b> {lk.ket_luan.loi_dan}</div>}
                        </div>
                      ) : lk.so_kham && lk.so_kham.chan_doan ? (
                        <div style={{ fontSize: 13.5, color: T.ink }}><b>Chẩn đoán:</b> {lk.so_kham.chan_doan}</div>
                      ) : null}
                      {lk.can_lam_sang && lk.can_lam_sang.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: T.mint, marginBottom: 4 }}><FlaskConical size={13} style={{ verticalAlign: -2 }} /> Cận lâm sàng</div>
                          {lk.can_lam_sang.map((c) => (
                            <div key={c.id} style={{ fontSize: 13, color: T.ink }}>• {c.ten_chi_dinh} <span style={{ color: T.sub }}>({TEN_CLS[c.loai] || c.loai})</span>{c.trang_thai === "da_co_ket_qua" ? ` — ${c.ket_qua || ""}` : " — chờ KQ"}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
          )}

          {tab === "dienbien" && (
            loading ? <div style={{ color: T.sub, fontSize: 14 }}>Đang tải…</div>
              : (db || []).length === 0 ? <div style={{ color: T.sub, fontSize: 14, textAlign: "center", padding: "20px 0" }}>Chưa có diễn biến điều trị nào.</div>
                : <div style={{ display: "grid", gap: 10 }}>
                  {(db || []).map((d) => (
                    <div key={d.id} style={{ borderLeft: `3px solid ${T.lav}`, background: T.bg, borderRadius: "0 10px 10px 0", padding: "10px 14px" }}>
                      <div style={{ fontSize: 12.5, color: T.sub, marginBottom: 3 }}>{d.thoi_diem || fmtDT(d.ngay_tao)}{d.bac_si ? ` · ${d.bac_si.ho_ten}` : ""}{d.phieu_kham && d.phieu_kham.ma_kcb ? ` · ${d.phieu_kham.ma_kcb}` : ""}</div>
                      <div style={{ fontSize: 13.5, color: T.ink, whiteSpace: "pre-wrap" }}>{d.dien_bien}</div>
                      {d.chi_dinh && <div style={{ fontSize: 13, color: T.sub, marginTop: 4, whiteSpace: "pre-wrap" }}><b>Chỉ định:</b> {d.chi_dinh}</div>}
                    </div>
                  ))}
                </div>
          )}
        </div>
      </Card>
    </div>
  );
}

export default PatientList;
