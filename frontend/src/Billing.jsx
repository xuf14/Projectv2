import React, { useState, useEffect } from "react";
import {
  CheckCircle2, Clock, X, User, Search, Receipt, Plus, Minus, Wallet, CreditCard, Printer, Stethoscope,
  CalendarDays, ListFilter,
} from "lucide-react";
import { T, store, api, useNav, Btn, Card, Pill, PageTitle, SectionHead, input } from "./shared";
import { PopupLichDoanhThu, NutNgay } from "./lichdoanhthu";

// ============================================================================
//  LỊCH HẸN & THANH TOÁN — dùng chung cho cổng Lễ tân và Quản trị viên.
//  - Lễ tân: xem TẤT CẢ lịch hẹn (GET /reception/appointments), xác nhận lịch
//    (POST /reception/confirm/:id), lập hóa đơn dịch vụ sau khi bệnh nhân đã
//    khám (POST /reception/appointments/:id/payment) và thu tiền.
//  - Admin: xem & quản lý toàn bộ hóa đơn (GET /admin/payments, hủy hóa đơn).
// ============================================================================

const fmtVND = (n) => (Number(n) || 0).toLocaleString("vi-VN") + "đ";
const fmtDate = (t) => { const d = new Date(t); return isNaN(d) ? "" : d.toLocaleDateString("vi-VN"); };
// Ngày + giờ thu tiền (mốc thời gian thật lưu ở cột ngay_thanh_toan)
const fmtDateTime = (t) => { const d = new Date(t); return isNaN(d) ? "" : d.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); };
// Bác sĩ khám: backend trả bác sĩ thực khám, nếu chưa khám thì bác sĩ của khung giờ
const tenBacSi = (t) => {
  const bs = t.lich_hen && t.lich_hen.bac_si;
  if (!bs) return "Chưa xác định bác sĩ khám";
  // ho_ten đã kèm học hàm (vd "BS.CKII Nguyễn Thị Lan") nên không ghép thêm hoc_ham
  return bs.da_kham ? `BS khám: ${bs.ho_ten}` : `BS phụ trách: ${bs.ho_ten}`;
};
const escHtml = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Xuất/in hóa đơn tổng tiền dịch vụ của một phiếu — mở cửa sổ in (lưu PDF/in giấy)
function xuatHoaDon(t) {
  const rows = (t.chi_tiet || []).map((c, i) => `
    <tr>
      <td class="c">${i + 1}</td>
      <td>${escHtml(c.ten_dich_vu)}</td>
      <td class="r">${fmtVND(c.don_gia)}</td>
      <td class="c">${c.so_luong}</td>
      <td class="r">${fmtVND(c.thanh_tien)}</td>
    </tr>`).join("");
  const bn = t.lich_hen ? t.lich_hen.benh_nhan || "" : "";
  const maBN = t.lich_hen ? t.lich_hen.ma_benh_nhan || "" : "";
  const maLich = t.lich_hen ? t.lich_hen.ma_lich_hen || "" : "";
  const khoa = t.lich_hen ? t.lich_hen.khoa || "" : "";
  const bs = t.lich_hen ? t.lich_hen.bac_si : null;
  const bacSi = bs ? bs.ho_ten : "Chưa xác định";
  const ngayKham = t.lich_hen && t.lich_hen.ngay_kham
    ? `${fmtDate(t.lich_hen.ngay_kham)}${t.lich_hen.gio_kham ? ` · ${t.lich_hen.gio_kham}` : ""}` : "—";
  const daTra = t.trang_thai === "da_thanh_toan";
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Hóa đơn ${escHtml(t.ma_thanh_toan)}</title>
  <style>
    * { box-sizing: border-box; font-family: 'Segoe UI', Arial, sans-serif; }
    body { color: #2D3A4E; padding: 32px; max-width: 760px; margin: 0 auto; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #F08A7C; padding-bottom: 16px; }
    .bv { font-size: 20px; font-weight: 800; color: #F08A7C; }
    .sub { font-size: 12px; color: #7A8699; letter-spacing: 1px; }
    h1 { font-size: 24px; margin: 22px 0 4px; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; font-size: 14px; margin: 18px 0; }
    .meta b { color: #2D3A4E; } .meta span { color: #7A8699; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px; }
    th, td { padding: 10px 12px; border-bottom: 1px solid #E7EBF0; text-align: left; }
    th { background: #FDEDE9; font-size: 12px; text-transform: uppercase; letter-spacing: .5px; }
    td.r, th.r { text-align: right; } td.c, th.c { text-align: center; }
    .total { display: flex; justify-content: flex-end; margin-top: 16px; }
    .total .box { min-width: 260px; }
    .total .line { display: flex; justify-content: space-between; padding: 6px 0; font-size: 15px; }
    .total .grand { border-top: 2px solid #2D3A4E; margin-top: 6px; padding-top: 10px; font-size: 20px; font-weight: 800; }
    .stamp { display: inline-block; margin-top: 10px; padding: 4px 14px; border-radius: 999px; font-weight: 700; font-size: 13px;
      background: ${daTra ? "#E2F4EF" : "#FDF2DA"}; color: ${daTra ? "#3FA589" : "#B5851B"}; }
    .foot { margin-top: 40px; display: flex; justify-content: space-between; font-size: 13px; color: #7A8699; }
    .btns { margin-top: 28px; text-align: center; }
    button { background: #F08A7C; color: #fff; border: none; padding: 11px 26px; border-radius: 999px; font-size: 15px; font-weight: 700; cursor: pointer; }
    @media print { .btns { display: none; } body { padding: 8px; } }
  </style></head><body>
    <div class="head">
      <div><div class="bv">Bệnh viện Phụ sản Hải Phòng</div><div class="sub">CHĂM SÓC MẸ & BÉ</div></div>
      <div style="text-align:right;font-size:13px;color:#7A8699">Số: <b style="color:#2D3A4E">${escHtml(t.ma_thanh_toan)}</b><br>Ngày: ${fmtDate(t.ngay_tao)}</div>
    </div>
    <h1>HÓA ĐƠN DỊCH VỤ</h1>
    <span class="stamp">${daTra ? "ĐÃ THANH TOÁN" : "CHỜ THANH TOÁN"}</span>
    <div class="meta">
      <div><span>Bệnh nhân:</span> <b>${escHtml(bn)}</b></div>
      <div><span>Mã bệnh nhân:</span> <b>${escHtml(maBN)}</b></div>
      <div><span>Mã lịch hẹn:</span> <b>${escHtml(maLich)}</b></div>
      <div><span>Khoa:</span> <b>${escHtml(khoa)}</b></div>
      <div><span>Bác sĩ khám:</span> <b>${escHtml(bacSi)}</b></div>
      <div><span>Ngày khám:</span> <b>${escHtml(ngayKham)}</b></div>
      <div><span>Thời điểm thanh toán:</span> <b>${escHtml(t.ngay_thanh_toan ? fmtDateTime(t.ngay_thanh_toan) : "Chưa thanh toán")}</b></div>
    </div>
    <table>
      <thead><tr><th class="c">STT</th><th>Dịch vụ</th><th class="r">Đơn giá</th><th class="c">SL</th><th class="r">Thành tiền</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="total"><div class="box">
      <div class="line grand"><span>TỔNG CỘNG</span><span>${fmtVND(t.tong_tien)}</span></div>
    </div></div>
    ${t.ghi_chu ? `<div style="margin-top:14px;font-size:13px;color:#7A8699">Ghi chú: ${escHtml(t.ghi_chu)}</div>` : ""}
    <div class="foot">
      <div>Người lập: ${escHtml(t.nguoi_tao ? t.nguoi_tao.ho_ten : "")}</div>
      <div>Cảm ơn quý khách!</div>
    </div>
    <div class="btns"><button onclick="window.print()">In / Lưu PDF</button></div>
  </body></html>`;
  const w = window.open("", "_blank", "width=780,height=880");
  if (!w) { alert("Trình duyệt đã chặn cửa sổ in hóa đơn. Vui lòng cho phép popup rồi thử lại."); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
}

// Trạng thái lịch hẹn
const TT_LICH = {
  cho_xac_nhan: { l: "Chờ xác nhận", tone: T.gold, soft: T.goldSoft },
  da_xac_nhan: { l: "Đã xác nhận", tone: T.sky, soft: T.skySoft },
  da_checkin: { l: "Đã check-in", tone: T.mint, soft: T.mintSoft },
  da_kham: { l: "Đã khám", tone: T.lav, soft: T.lavSoft },
  da_huy: { l: "Đã hủy", tone: "#C0392B", soft: "#FDECEA" },
};
// Trạng thái thanh toán
const TT_TT = {
  cho_thanh_toan: { l: "Chờ thanh toán", tone: T.gold, soft: T.goldSoft },
  da_thanh_toan: { l: "Đã thanh toán", tone: T.mint, soft: T.mintSoft },
  da_huy: { l: "Đã hủy", tone: "#C0392B", soft: "#FDECEA" },
};

// Các trạng thái mở ở cửa sổ riêng (popup) từ trang "Tất cả lịch hẹn"
const TRANG_THAI_POPUP = ["cho_xac_nhan", "da_xac_nhan", "da_checkin", "da_kham", "da_huy"];
const GIOI_HAN_LICH = 200;   // backend trả tối đa 200 lịch hẹn mỗi lần

// Ngày YYYY-MM-DD theo giờ máy (không dùng toISOString vì lệch múi giờ)
const ngayISO = (d) => d.toLocaleDateString("en-CA");
const ngayLech = (soNgay) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + soNgay); return ngayISO(d); };
const fmtNgayVN = (s) => (s ? s.split("-").reverse().join("/") : "");
// Mô tả khoảng ngày đang lọc, dùng trong thông báo rỗng
const moTaKhoang = (tu, den) => {
  if (tu && den) return tu === den ? `ngày ${fmtNgayVN(tu)}` : `từ ${fmtNgayVN(tu)} đến ${fmtNgayVN(den)}`;
  if (tu) return `từ ${fmtNgayVN(tu)}`;
  if (den) return `đến ${fmtNgayVN(den)}`;
  return "";
};

// Bộ lọc theo ngày khám — dùng chung cho trang chính và các cửa sổ trạng thái.
// Nút nhanh áp dụng ngay; sửa tay hai ô ngày thì bấm "Tìm" như ô từ khóa.
function BoLocNgay({ tu, den, setTu, setDen, onApDung }) {
  const nhanh = [
    { l: "Hôm nay", tu: ngayLech(0), den: ngayLech(0) },
    { l: "7 ngày tới", tu: ngayLech(0), den: ngayLech(7) },
    { l: "30 ngày qua", tu: ngayLech(-30), den: ngayLech(0) },
    { l: "Tất cả ngày", tu: "", den: "" },
  ];
  const oNgay = { ...input, width: "auto", padding: "8px 11px", fontSize: 14, borderRadius: 11 };
  const dangLoc = (n) => (tu || "") === n.tu && (den || "") === n.den;
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
      <span style={{ display: "flex", alignItems: "center", gap: 7, color: T.sub, fontSize: 13, fontWeight: 700 }}>
        <CalendarDays size={16} /> Ngày khám
      </span>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: T.sub }}>
        Từ
        <input type="date" value={tu} max={den || undefined} onChange={(e) => setTu(e.target.value)} style={oNgay} />
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: T.sub }}>
        Đến
        <input type="date" value={den} min={tu || undefined} onChange={(e) => setDen(e.target.value)} style={oNgay} />
      </label>
      {nhanh.map((n) => (
        <button key={n.l} type="button" onClick={() => { setTu(n.tu); setDen(n.den); onApDung(n.tu, n.den); }}
          style={{
            padding: "7px 13px", borderRadius: 999, cursor: "pointer", fontFamily: "inherit",
            fontSize: 13, fontWeight: 700,
            border: `1.5px solid ${dangLoc(n) ? T.gold : T.line}`,
            background: dangLoc(n) ? T.goldSoft : T.surface,
            color: dangLoc(n) ? T.gold : T.sub,
          }}>
          {n.l}
        </button>
      ))}
    </div>
  );
}

// Một dòng lịch hẹn — dùng chung cho danh sách chính và các cửa sổ trạng thái
function DongLichHen({ a, busyId, onConfirm, onPay }) {
  const s = TT_LICH[a.trang_thai] || TT_LICH.cho_xac_nhan;
  const bs = a.khung_gio && a.khung_gio.bac_si ? a.khung_gio.bac_si.ho_ten : "";
  const ngay = a.khung_gio ? a.khung_gio.ngay : "";
  const gio = a.khung_gio ? a.khung_gio.gio_bat_dau : "";
  return (
    <Card style={{ padding: 18, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
      <span style={{ width: 48, height: 48, borderRadius: 14, background: s.soft, color: s.tone, display: "grid", placeItems: "center", flexShrink: 0 }}><User size={22} /></span>
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontWeight: 800, color: T.ink, fontSize: 15.5 }}>{a.ho_so ? a.ho_so.ho_ten : "—"}</span>
          <Pill tone={s.tone} soft={s.soft}>{s.l}</Pill>
        </div>
        <div style={{ color: T.sub, fontSize: 13.5, marginTop: 4 }}>
          {a.ma_lich_hen}{a.khoa ? ` · ${a.khoa.ten_khoa}` : ""}{bs ? ` · ${bs}` : ""}
          {ngay ? ` · ${fmtDate(ngay)} ${gio}` : ""}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {a.trang_thai === "cho_xac_nhan" && (
          <Btn kind="mint" size="sm" disabled={busyId === a.id} onClick={() => onConfirm(a)}>
            <CheckCircle2 size={15} /> {busyId === a.id ? "..." : "Xác nhận"}
          </Btn>
        )}
        {a.trang_thai === "da_kham" && (
          <Btn kind="gold" size="sm" onClick={() => onPay(a)}><Receipt size={15} /> Lập thanh toán</Btn>
        )}
      </div>
    </Card>
  );
}

// Cửa sổ riêng cho một trạng thái lịch hẹn: tự nạp danh sách của đúng trạng thái
// đó (GET /reception/appointments?trang_thai=), có ô tìm kiếm và thao tác riêng.
// onDoi: báo cho trang nền nạp lại sau khi xác nhận lịch trong cửa sổ.
function PopupLichHen({ trangThai, tuBanDau, denBanDau, onClose, onDoi, onPay }) {
  const s = TT_LICH[trangThai];
  const [q, setQ] = useState("");
  // Mở cửa sổ thì giữ nguyên khoảng ngày đang lọc ở trang nền
  const [tu, setTu] = useState(tuBanDau || "");
  const [den, setDen] = useState(denBanDau || "");
  const [list, setList] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [busyId, setBusyId] = useState(null);

  // Nút lọc nhanh truyền thẳng khoảng ngày vì setState chưa kịp áp dụng
  const load = (loc) => {
    const r = loc || {};
    const tuKhoa = (r.q !== undefined ? r.q : q).trim();
    setLoading(true); setErr(null);
    api.allAppointments(trangThai, tuKhoa, { tu: r.tu !== undefined ? r.tu : tu, den: r.den !== undefined ? r.den : den })
      .then((x) => setList(Array.isArray(x) ? x : []))
      .catch((e) => { setErr(e.message); setList([]); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load({ q: "" }); }, [trangThai]);

  const xacNhan = async (a) => {
    setBusyId(a.id); setErr(null);
    try { await api.confirmAppt(a.id); load(); onDoi(); }
    catch (e) { setErr(e.message); }
    finally { setBusyId(null); }
  };

  const data = list || [];
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "grid", placeItems: "center", zIndex: 70, padding: 16 }}>
      <Card onClick={(e) => e.stopPropagation()} style={{ width: 860, maxWidth: "100%", maxHeight: "88vh", padding: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "15px 18px", borderBottom: `1px solid ${T.line}`, display: "flex", alignItems: "center", gap: 11 }}>
          <span style={{ width: 36, height: 36, borderRadius: 11, background: s.soft, color: s.tone, display: "grid", placeItems: "center" }}><ListFilter size={18} /></span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15.5, fontWeight: 800, color: T.ink }}>Lịch hẹn: {s.l}</div>
            <div style={{ fontSize: 12.5, color: T.sub, marginTop: 1 }}>
              {loading ? "Đang tải..." : `${data.length} lịch hẹn${data.length >= GIOI_HAN_LICH ? ` (mới nhất, tối đa ${GIOI_HAN_LICH})` : ""}`}
            </div>
          </div>
          <Btn kind="ghost" size="sm" onClick={onClose}><X size={16} /></Btn>
        </div>

        <div style={{ padding: "12px 18px", borderBottom: `1px solid ${T.line}`, display: "grid", gap: 10 }}>
          <BoLocNgay tu={tu} den={den} setTu={setTu} setDen={setDen} onApDung={(a, b) => load({ tu: a, den: b })} />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200, display: "flex", alignItems: "center", gap: 10, border: `1.5px solid ${T.line}`, borderRadius: 13, padding: "0 14px" }}>
              <Search size={17} color={T.sub} />
              <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()}
                placeholder="Tìm theo tên, mã BN hoặc mã lịch hẹn..."
                style={{ flex: 1, border: "none", outline: "none", padding: "10px 0", fontSize: 14.5, fontFamily: "inherit", background: "transparent" }} />
            </div>
            <Btn size="sm" onClick={() => load()}>Tìm</Btn>
          </div>
        </div>

        <div style={{ padding: 18, overflowY: "auto", display: "grid", gap: 12 }}>
          {err && <Card style={{ padding: 14, background: "#FDECEA", border: "none", color: "#C0392B", fontSize: 13.5 }}>{err}</Card>}
          {loading && <div style={{ color: T.sub, fontSize: 14 }}>Đang tải lịch hẹn...</div>}
          {!loading && !err && data.length === 0 && (
            <div style={{ padding: 34, textAlign: "center", color: T.sub, fontSize: 14 }}>
              Không có lịch hẹn nào ở trạng thái "{s.l}"{q.trim() ? ` khớp từ khóa "${q.trim()}"` : ""}
              {moTaKhoang(tu, den) ? ` ${moTaKhoang(tu, den)}` : ""}.
            </div>
          )}
          {data.map((a) => (
            <DongLichHen key={a.id} a={a} busyId={busyId} onConfirm={xacNhan} onPay={onPay} />
          ))}
        </div>
      </Card>
    </div>
  );
}

// Bảng trạng thái của khoảng ngày vừa chọn — mở ngay sau khi xác nhận lọc.
// Không tự gọi API: dùng lại danh sách trang nền đã nạp để số đếm luôn khớp.
// Bấm một trạng thái để mở cửa sổ danh sách lịch hẹn của trạng thái đó.
function PopupBangNgay({ tu, den, q, data, loading, onClose, onChon }) {
  const khoang = moTaKhoang(tu, den);
  const dem = (tt) => data.filter((a) => a.trang_thai === tt).length;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "grid", placeItems: "center", zIndex: 70, padding: 16 }}>
      <Card onClick={(e) => e.stopPropagation()} style={{ width: 620, maxWidth: "100%", maxHeight: "88vh", padding: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "15px 18px", borderBottom: `1px solid ${T.line}`, display: "flex", alignItems: "center", gap: 11 }}>
          <span style={{ width: 36, height: 36, borderRadius: 11, background: T.goldSoft, color: T.gold, display: "grid", placeItems: "center" }}><CalendarDays size={18} /></span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15.5, fontWeight: 800, color: T.ink }}>
              Lịch hẹn {khoang || "tất cả các ngày"}
            </div>
            <div style={{ fontSize: 12.5, color: T.sub, marginTop: 1 }}>
              {loading ? "Đang tải..." : `${data.length} lịch hẹn${q.trim() ? ` khớp "${q.trim()}"` : ""} — chọn một trạng thái để xem danh sách`}
            </div>
          </div>
          <Btn kind="ghost" size="sm" onClick={onClose}><X size={16} /></Btn>
        </div>

        <div style={{ padding: 18, overflowY: "auto" }}>
          {loading ? (
            <div style={{ color: T.sub, fontSize: 14 }}>Đang tải lịch hẹn...</div>
          ) : data.length === 0 ? (
            <div style={{ padding: 30, textAlign: "center", color: T.sub, fontSize: 14 }}>
              Không có lịch hẹn nào {khoang || "trong hệ thống"}{q.trim() ? ` khớp "${q.trim()}"` : ""}.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ borderBottom: `1px solid ${T.line}` }}>
                <th style={thBang}>Trạng thái</th>
                <th style={{ ...thBang, textAlign: "right", width: 110 }}>Số lịch hẹn</th>
                <th style={{ ...thBang, width: 130 }}></th>
              </tr></thead>
              <tbody>
                {TRANG_THAI_POPUP.map((tt) => {
                  const s = TT_LICH[tt];
                  const n = dem(tt);
                  return (
                    <tr key={tt} style={{ borderBottom: `1px solid ${T.line}55` }}>
                      <td style={{ padding: "10px 8px" }}><Pill tone={s.tone} soft={s.soft}>{s.l}</Pill></td>
                      <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 800, fontSize: 16, color: n ? s.tone : T.sub }}>{n}</td>
                      <td style={{ padding: "10px 8px" }}>
                        {n > 0
                          ? <Btn kind="soft" size="sm" onClick={() => onChon(tt)}><ListFilter size={14} /> Xem danh sách</Btn>
                          : <span style={{ fontSize: 12.5, color: T.sub }}>Không có</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ padding: "13px 18px", borderTop: `1px solid ${T.line}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, color: T.sub }}>Đóng cửa sổ để xem toàn bộ {data.length} lịch hẹn ở trang nền.</span>
          <Btn size="sm" onClick={onClose}>Xem tất cả</Btn>
        </div>
      </Card>
    </div>
  );
}
const thBang = { padding: "9px 8px", fontSize: 11.5, fontWeight: 800, color: T.sub, textTransform: "uppercase", letterSpacing: .4, textAlign: "left" };

// ---- Lễ tân: tất cả lịch hẹn + xác nhận + lập hóa đơn ----
export function AllAppointments() {
  const { online } = useNav();
  const live = online && !!store.token;
  const [q, setQ] = useState("");
  const [tu, setTu] = useState("");             // lọc theo ngày khám: từ ngày
  const [den, setDen] = useState("");           // lọc theo ngày khám: đến ngày
  const [list, setList] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [payFor, setPayFor] = useState(null);   // lịch hẹn đang lập hóa đơn
  const [popup, setPopup] = useState(null);     // trạng thái đang mở ở cửa sổ riêng
  const [bangNgay, setBangNgay] = useState(false); // bảng trạng thái của khoảng ngày vừa chọn
  const [daLoc, setDaLoc] = useState(false);    // chỉ hiện danh sách sau khi người dùng lọc

  // Nút lọc nhanh truyền thẳng khoảng ngày vì setState chưa kịp áp dụng
  const load = (loc) => {
    if (!live) return;
    const r = loc || {};
    setLoading(true); setErr(null); setDaLoc(true);
    api.allAppointments("", q.trim(), { tu: r.tu !== undefined ? r.tu : tu, den: r.den !== undefined ? r.den : den })
      .then((x) => setList(Array.isArray(x) ? x : []))
      .catch((e) => { setErr(e.message); setList([]); })
      .finally(() => setLoading(false));
  };
  // Xác nhận bộ lọc: nạp danh sách rồi mở ngay bảng trạng thái của khoảng ngày đó
  const xemLichHen = (loc) => { load(loc); setBangNgay(true); };
  // Đăng xuất / mất kết nối thì bỏ kết quả cũ, bắt lọc lại từ đầu
  useEffect(() => { if (!live) { setList(null); setDaLoc(false); setBangNgay(false); } }, [live]);

  const confirm = async (a) => {
    setBusyId(a.id); setErr(null);
    try { await api.confirmAppt(a.id); load(); }
    catch (e) { setErr(e.message); }
    finally { setBusyId(null); }
  };

  if (!live) {
    return (
      <div>
        <PageTitle title="Tất cả lịch hẹn" sub="Xem và xác nhận lịch hẹn của bệnh nhân." />
        <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>Cần kết nối backend để xem lịch hẹn thật.</Card>
      </div>
    );
  }
  if (payFor) return <PaymentForm appt={payFor} onBack={() => setPayFor(null)} onDone={() => { setPayFor(null); load(); }} />;

  const data = list || [];
  // Đếm theo trạng thái trên danh sách đã nạp; cửa sổ từng trạng thái tự truy vấn lại
  const dem = (tt) => data.filter((a) => a.trang_thai === tt).length;
  const moPopup = (a) => { setPopup(null); setPayFor(a); };

  return (
    <div>
      <PageTitle title="Tất cả lịch hẹn" sub="Xác nhận lịch hẹn và lập thanh toán dịch vụ sau khi bệnh nhân đã khám." />

      {/* Chọn khoảng ngày rồi xác nhận — danh sách chỉ hiện sau khi lọc */}
      <Card style={{ padding: 18, marginBottom: 16 }}>
        <div style={{ fontSize: 12.5, color: T.sub, fontWeight: 700, marginBottom: 10 }}>
          Chọn khoảng ngày khám cần xem
        </div>
        <div style={{ marginBottom: 12 }}>
          <BoLocNgay tu={tu} den={den} setTu={setTu} setDen={setDen} onApDung={(a, b) => xemLichHen({ tu: a, den: b })} />
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200, display: "flex", alignItems: "center", gap: 10, border: `1.5px solid ${T.line}`, borderRadius: 13, padding: "0 14px" }}>
            <Search size={18} color={T.sub} />
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && xemLichHen()} placeholder="Tìm theo tên, mã BN hoặc mã lịch hẹn..." style={{ flex: 1, border: "none", outline: "none", padding: "12px 0", fontSize: 15, fontFamily: "inherit", background: "transparent" }} />
          </div>
          <Btn onClick={() => xemLichHen()}><CalendarDays size={16} /> Xem lịch hẹn</Btn>
        </div>
      </Card>

      {err && <Card style={{ padding: 16, marginBottom: 14, background: "#FDECEA", border: "none", color: "#C0392B", fontSize: 14 }}>{err}</Card>}
      {loading && <div style={{ color: T.sub, fontSize: 14, marginBottom: 12 }}>Đang tải lịch hẹn...</div>}

      {/* Chưa lọc thì không tải và không liệt kê gì */}
      {!daLoc && !loading && (
        <Card style={{ padding: 40, textAlign: "center", color: T.sub, fontSize: 14, lineHeight: 1.6 }}>
          Chọn khoảng ngày (hoặc bấm <b style={{ color: T.ink }}>Hôm nay</b> / <b style={{ color: T.ink }}>7 ngày tới</b>) rồi bấm
          <b style={{ color: T.ink }}> Xem lịch hẹn</b>.<br />
          Bảng trạng thái của khoảng ngày sẽ hiện lên để bạn mở đúng nhóm lịch hẹn cần xử lý.
        </Card>
      )}

      {daLoc && !loading && !err && (
        <>
          {/* Số đếm theo trạng thái của đúng khoảng ngày đã lọc */}
          <Card style={{ padding: 18, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
              <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 700 }}>
                Mở theo trạng thái{moTaKhoang(tu, den) ? ` — ${moTaKhoang(tu, den)}` : " — tất cả các ngày"}
              </span>
              <Btn kind="ghost" size="sm" style={{ marginLeft: "auto" }} onClick={() => setBangNgay(true)}>
                <ListFilter size={14} /> Bảng trạng thái
              </Btn>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {TRANG_THAI_POPUP.map((tt) => {
                const s = TT_LICH[tt];
                return (
                  <button key={tt} onClick={() => setPopup(tt)} title={`Mở cửa sổ lịch hẹn ${s.l}`}
                    style={{
                      display: "flex", alignItems: "center", gap: 9, padding: "9px 15px", borderRadius: 999,
                      border: `1.5px solid ${s.tone}`, background: s.soft, color: s.tone,
                      fontSize: 13.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
                    }}>
                    {s.l}
                    <span style={{ background: s.tone, color: "#fff", borderRadius: 999, padding: "1px 9px", fontSize: 12 }}>
                      {dem(tt)}
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>

          {data.length === 0 ? (
            <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>
              Không có lịch hẹn nào{q.trim() ? ` khớp "${q.trim()}"` : ""}{moTaKhoang(tu, den) ? ` ${moTaKhoang(tu, den)}` : ""}.
            </Card>
          ) : (
            <>
              <SectionHead title={`Tất cả lịch hẹn (${data.length}${data.length >= GIOI_HAN_LICH ? " mới nhất" : ""})${moTaKhoang(tu, den) ? ` · ${moTaKhoang(tu, den)}` : ""}`} />
              <div style={{ display: "grid", gap: 12 }}>
                {data.map((a) => (
                  <DongLichHen key={a.id} a={a} busyId={busyId} onConfirm={confirm} onPay={setPayFor} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {popup && (
        <PopupLichHen trangThai={popup} tuBanDau={tu} denBanDau={den}
          onClose={() => setPopup(null)} onDoi={load} onPay={moPopup} />
      )}

      {bangNgay && (
        <PopupBangNgay tu={tu} den={den} q={q} data={data} loading={loading}
          onClose={() => setBangNgay(false)}
          onChon={(tt) => { setBangNgay(false); setPopup(tt); }} />
      )}
    </div>
  );
}

// Form chọn dịch vụ và lập hóa đơn cho một lịch hẹn đã khám.
// Export để bước 6 của Quy trình khám (quytrinhkham.jsx) dùng lại.
export function PaymentForm({ appt, onBack, onDone }) {
  const [services, setServices] = useState(null);
  const [qty, setQty] = useState({}); // dich_vu_id -> số lượng (0 = không chọn)
  const [ghiChu, setGhiChu] = useState("");
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.services()
      .then((r) => setServices(Array.isArray(r) ? r : []))
      .catch((e) => { setErr(e.message); setServices([]); });
  }, []);

  const setSL = (id, v) => setQty((q) => ({ ...q, [id]: Math.max(0, v) }));
  const ds = services || [];
  const chon = ds.filter((d) => (qty[d.id] || 0) > 0);
  const tong = chon.reduce((s, d) => s + d.gia * qty[d.id], 0);

  const save = async () => {
    if (chon.length === 0) { setErr("Vui lòng chọn ít nhất một dịch vụ."); return; }
    setBusy(true); setErr(null);
    try {
      await api.createPayment(appt.id, {
        items: chon.map((d) => ({ dich_vu_id: d.id, so_luong: qty[d.id] })),
        ghi_chu: ghiChu,
      });
      onDone();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", color: T.sub, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", gap: 5, marginBottom: 16 }}><X size={15} /> Hủy lập hóa đơn</button>
      <PageTitle title="Lập thanh toán dịch vụ" sub={`Bệnh nhân ${appt.ho_so ? appt.ho_so.ho_ten : ""} · Lịch hẹn ${appt.ma_lich_hen}`} />
      {err && <Card style={{ padding: 14, marginBottom: 14, background: "#FDECEA", border: "none", color: "#C0392B", fontSize: 14 }}>{err}</Card>}
      <Card style={{ padding: 22 }}>
        <div style={{ fontWeight: 800, color: T.ink, fontSize: 15.5, marginBottom: 14 }}>Chọn dịch vụ cần thanh toán</div>
        {!services && <div style={{ color: T.sub, fontSize: 14 }}>Đang tải danh mục dịch vụ...</div>}
        <div style={{ display: "grid", gap: 10 }}>
          {ds.map((d) => {
            const sl = qty[d.id] || 0;
            const on = sl > 0;
            return (
              <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: `1.5px solid ${on ? T.gold : T.line}`, borderRadius: 13, background: on ? T.goldSoft : T.surface, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontWeight: 700, color: T.ink, fontSize: 14.5 }}>{d.ten_dich_vu}</div>
                  <div style={{ color: T.sub, fontSize: 13 }}>{fmtVND(d.gia)}{d.khoa ? ` · ${d.khoa.ten_khoa}` : ""}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button onClick={() => setSL(d.id, sl - 1)} style={qtyBtn}><Minus size={14} color={T.sub} /></button>
                  <span style={{ minWidth: 26, textAlign: "center", fontWeight: 800, color: T.ink }}>{sl}</span>
                  <button onClick={() => setSL(d.id, sl + 1)} style={qtyBtn}><Plus size={14} color={T.sub} /></button>
                </div>
              </div>
            );
          })}
        </div>
        {services && ds.length === 0 && <div style={{ color: T.sub, fontSize: 14 }}>Chưa có dịch vụ nào trong hệ thống.</div>}

        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12.5, color: T.sub, fontWeight: 600, marginBottom: 6 }}>Ghi chú (không bắt buộc)</div>
          <input value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} placeholder="VD: thanh toán tiền mặt tại quầy" style={input} />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20, paddingTop: 16, borderTop: `1px solid ${T.line}`, flexWrap: "wrap", gap: 12 }}>
          <div style={{ fontSize: 15, color: T.sub }}>Tổng cộng: <b style={{ color: T.ink, fontSize: 20 }}>{fmtVND(tong)}</b></div>
          <Btn kind="gold" disabled={busy} onClick={save}><Receipt size={16} /> {busy ? "Đang lập..." : "Lập hóa đơn & yêu cầu thanh toán"}</Btn>
        </div>
      </Card>
    </div>
  );
}

const qtyBtn = { width: 30, height: 30, borderRadius: 9, border: `1px solid ${T.line}`, background: "#fff", cursor: "pointer", display: "grid", placeItems: "center" };

// ---- Danh sách hóa đơn: mode "reception" (thu tiền) hoặc "admin" (hủy) ----
export function PaymentList({ mode }) {
  const { online } = useNav();
  const live = online && !!store.token;
  const laAdmin = mode === "admin";
  const [list, setList] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [busyId, setBusyId] = useState(null);
  // Quản trị viên: chọn NGÀY trên lịch (ô tô màu = ngày có doanh thu) rồi mới
  // hiện danh sách bệnh nhân đã thanh toán của ngày đó.
  const [cheDo, setCheDo] = useState(laAdmin ? "ngay" : "tat_ca");
  const [ngay, setNgay] = useState(null);
  const [moLich, setMoLich] = useState(laAdmin);
  const [ngayData, setNgayData] = useState(null);

  const load = () => {
    if (!live) return;
    setErr(null);
    if (cheDo === "ngay") {
      if (!ngay) { setList(null); setNgayData(null); return; }
      setLoading(true);
      api.dailyPayments(ngay)
        .then((r) => { setNgayData(r); setList((r && r.danh_sach) || []); })
        .catch((e) => { setErr(e.message); setList([]); setNgayData(null); })
        .finally(() => setLoading(false));
      return;
    }
    setLoading(true);
    const fn = laAdmin ? api.adminPayments : api.receptionPayments;
    fn()
      .then((r) => setList(Array.isArray(r) ? r : []))
      .catch((e) => { setErr(e.message); setList([]); })
      .finally(() => setLoading(false));
  };
  useEffect(load, [live, cheDo, ngay]);

  const thu = async (t) => {
    if (!window.confirm(`Xác nhận bệnh nhân đã thanh toán hóa đơn ${t.ma_thanh_toan} (${fmtVND(t.tong_tien)})?`)) return;
    setBusyId(t.id); setErr(null);
    try { await api.payPayment(t.id); load(); }
    catch (e) { setErr(e.message); }
    finally { setBusyId(null); }
  };
  const huy = async (t) => {
    if (!window.confirm(`Hủy hóa đơn ${t.ma_thanh_toan}?`)) return;
    setBusyId(t.id); setErr(null);
    try { await api.cancelPayment(t.id); load(); }
    catch (e) { setErr(e.message); }
    finally { setBusyId(null); }
  };

  if (!live) {
    return (
      <div>
        <PageTitle title="Thanh toán" sub="Quản lý hóa đơn dịch vụ." />
        <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>Cần kết nối backend để xem hóa đơn thật.</Card>
      </div>
    );
  }

  const data = list || [];
  const theoNgay = cheDo === "ngay";
  const tongThu = theoNgay && ngayData
    ? ngayData.tong_tien
    : data.filter((t) => t.trang_thai === "da_thanh_toan").reduce((s, t) => s + t.tong_tien, 0);
  const cho = data.filter((t) => t.trang_thai === "cho_thanh_toan").length;
  const soBenhNhan = new Set(data.map((t) => (t.lich_hen && t.lich_hen.benh_nhan) || t.id)).size;
  return (
    <div>
      <PageTitle title="Thanh toán"
        sub={laAdmin
          ? "Chọn ngày có doanh thu trên lịch để xem các bệnh nhân đã thanh toán trong ngày đó."
          : "Thu tiền các hóa đơn dịch vụ đã lập."} />

      {laAdmin && (
        <Card style={{ padding: 16, marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <Btn kind={theoNgay ? "primary" : "ghost"} size="sm" onClick={() => setCheDo("ngay")}>
            <CalendarDays size={15} /> Theo ngày có doanh thu
          </Btn>
          <Btn kind={theoNgay ? "ghost" : "primary"} size="sm" onClick={() => setCheDo("tat_ca")}>
            <ListFilter size={15} /> Tất cả hóa đơn
          </Btn>
          {theoNgay && (
            <>
              <div style={{ width: 1, height: 30, background: T.line }} />
              <NutNgay ngay={ngay} onClick={() => setMoLich(true)} nhan="Ngày đã chọn" />
              <Btn kind="ghost" size="sm" onClick={() => setMoLich(true)}>Đổi ngày</Btn>
            </>
          )}
        </Card>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 18 }} className="grid3">
        <Card style={{ padding: 18 }}>
          <div style={{ color: T.sub, fontSize: 13 }}>{theoNgay ? "Hóa đơn đã thu" : "Tổng hóa đơn"}</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: T.ink, marginTop: 4 }}>{data.length}</div>
        </Card>
        <Card style={{ padding: 18 }}>
          <div style={{ color: T.sub, fontSize: 13 }}>{theoNgay ? "Bệnh nhân" : "Chờ thanh toán"}</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: theoNgay ? T.lav : T.gold, marginTop: 4 }}>{theoNgay ? soBenhNhan : cho}</div>
        </Card>
        <Card style={{ padding: 18 }}>
          <div style={{ color: T.sub, fontSize: 13 }}>{theoNgay ? "Tổng thu trong ngày" : "Đã thu"}</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: T.mint, marginTop: 4 }}>{fmtVND(tongThu)}</div>
        </Card>
      </div>

      {err && <Card style={{ padding: 16, marginBottom: 14, background: "#FDECEA", border: "none", color: "#C0392B", fontSize: 14 }}>{err}</Card>}
      {loading && <div style={{ color: T.sub, fontSize: 14, marginBottom: 12 }}>Đang tải hóa đơn...</div>}
      {theoNgay && !ngay && !loading && (
        <Card style={{ padding: 44, textAlign: "center" }}>
          <CalendarDays size={30} style={{ color: T.line, marginBottom: 12 }} />
          <div style={{ fontWeight: 800, color: T.ink, fontSize: 15.5, marginBottom: 6 }}>Chưa chọn ngày</div>
          <div style={{ color: T.sub, fontSize: 14, marginBottom: 16 }}>Mở lịch và chọn một ngày được tô màu để xem bệnh nhân đã thanh toán hôm đó.</div>
          <Btn kind="mint" onClick={() => setMoLich(true)}><CalendarDays size={16} /> Mở lịch doanh thu</Btn>
        </Card>
      )}
      {!loading && !err && data.length === 0 && (!theoNgay || ngay) && (
        <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>
          {theoNgay ? `Không có khoản thu nào trong ngày ${ngay.split("-").reverse().join("/")}.` : "Chưa có hóa đơn nào."}
        </Card>
      )}
      {theoNgay && ngay && data.length > 0 && (
        <SectionHead title={`Bệnh nhân đã thanh toán ngày ${ngay.split("-").reverse().join("/")}`} />
      )}

      <div style={{ display: "grid", gap: 12 }}>
        {data.map((t) => {
          const s = TT_TT[t.trang_thai] || TT_TT.cho_thanh_toan;
          return (
            <Card key={t.id} style={{ padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <span style={{ width: 46, height: 46, borderRadius: 13, background: s.soft, color: s.tone, display: "grid", placeItems: "center", flexShrink: 0 }}><Wallet size={21} /></span>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 800, color: T.ink, fontSize: 15.5 }}>{t.ma_thanh_toan}</span>
                    <Pill tone={s.tone} soft={s.soft}>{s.l}</Pill>
                    {t.nguon === "y_lenh" && <Pill tone={T.gold} soft={T.goldSoft}>Y lệnh</Pill>}
                    {t.nguon === "y_lenh" && t.con_lai > 0 && <Pill tone="#C0392B" soft="#FDECEA">Còn {fmtVND(t.con_lai)}</Pill>}
                  </div>
                  <div style={{ color: T.sub, fontSize: 13.5, marginTop: 4 }}>
                    {t.lich_hen ? `${t.lich_hen.benh_nhan || "—"} · ${t.nguon === "y_lenh" ? "Phiếu" : "Lịch"} ${t.lich_hen.ma_lich_hen}` : "—"}
                    {t.lich_hen && t.lich_hen.khoa ? ` · ${t.lich_hen.khoa}` : ""} · {fmtDate(t.ngay_tao)}
                  </div>
                  <div style={{ color: T.sub, fontSize: 13, marginTop: 3 }}>
                    <Stethoscope size={13} style={{ verticalAlign: -2, marginRight: 4 }} />
                    {tenBacSi(t)}{t.lich_hen && t.lich_hen.ngay_kham ? ` · Khám ${fmtDate(t.lich_hen.ngay_kham)}${t.lich_hen.gio_kham ? ` ${t.lich_hen.gio_kham}` : ""}` : ""}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 800, color: T.ink, fontSize: 18 }}>{fmtVND(t.tong_tien)}</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end" }}>
                    {t.trang_thai !== "da_huy" && <Btn kind="ghost" size="sm" onClick={() => xuatHoaDon(t)}><Printer size={14} /> Xuất hóa đơn</Btn>}
                    {/* Phiếu y lệnh thu tiền ở màn hình Y lệnh (nhiều lần thu, trừ tồn kho)
                        nên ở đây chỉ hiển thị, không gọi API thu/hủy hóa đơn dịch vụ. */}
                    {t.nguon === "y_lenh" && t.trang_thai === "cho_thanh_toan" &&
                      <span style={{ fontSize: 12.5, color: T.sub }}>Thu tiếp ở mục Y lệnh viện phí</span>}
                    {t.nguon !== "y_lenh" && mode === "reception" && t.trang_thai === "cho_thanh_toan" && <Btn kind="mint" size="sm" disabled={busyId === t.id} onClick={() => thu(t)}><CreditCard size={14} /> {busyId === t.id ? "..." : "Thu tiền"}</Btn>}
                    {t.nguon !== "y_lenh" && mode === "admin" && t.trang_thai === "cho_thanh_toan" && <Btn kind="ghost" size="sm" style={{ color: "#C0392B", borderColor: "#FDECEA" }} disabled={busyId === t.id} onClick={() => huy(t)}><X size={14} /> Hủy</Btn>}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.line}55` }}>
                {t.chi_tiet.map((c) => (
                  <div key={c.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, color: T.sub, padding: "3px 0" }}>
                    <span>{c.ten_dich_vu} {c.so_luong > 1 ? `× ${c.so_luong}` : ""}</span>
                    <span style={{ color: T.ink, fontWeight: 600 }}>{fmtVND(c.thanh_tien)}</span>
                  </div>
                ))}
                {t.ghi_chu && <div style={{ fontSize: 12.5, color: T.sub, marginTop: 6, fontStyle: "italic" }}>Ghi chú: {t.ghi_chu}</div>}
                {t.nguoi_tao && <div style={{ fontSize: 12, color: T.sub, marginTop: 6 }}>Lập bởi {t.nguoi_tao.ho_ten}{t.ngay_thanh_toan ? ` · Đã thu lúc ${fmtDateTime(t.ngay_thanh_toan)}` : ""}</div>}
              </div>
            </Card>
          );
        })}
      </div>

      {moLich && (
        <PopupLichDoanhThu ngayChon={ngay} onChon={setNgay} onClose={() => setMoLich(false)} />
      )}
    </div>
  );
}
