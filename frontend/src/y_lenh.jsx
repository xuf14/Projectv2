import React, { useState, useEffect, useRef } from "react";
import { ClipboardList, Pill as PillIcon, Package, Stethoscope, Plus, Trash2, Save, RotateCcw, Receipt, Filter, Search, CreditCard, X, CheckCircle2, ChevronDown } from "lucide-react";
import { T, store, api, useNav, Btn, Card, Pill, PageTitle, input } from "./shared";
import { MUC_KIEM_SOAT } from "./danhmucthuoc";

// Mã khoa suy từ tên khoa — phiếu khám chỉ lưu chuyên khoa dạng chữ. Trả về null
// khi không nhận ra để giao diện hiện toàn bộ danh mục thay vì lọc nhầm.
function maKhoaTuTen(tenKhoa) {
  const s = (tenKhoa || "").toLowerCase();
  if (!s) return null;
  if (s.includes("ivf") || s.includes("hỗ trợ sinh sản")) return "ivf";
  if (s.includes("sơ sinh")) return "sosinh";
  if (s.includes("phụ")) return "phu";
  if (s.includes("sản")) return "san";
  return null;
}

// ============================================================================
//  Y LỆNH — lễ tân lập phiếu thanh toán viện phí (thuốc, vật tư tiêu hao, dịch vụ).
//  Phiếu liên kết với phiếu khám bệnh (thongtinbenhnhan) để lấy thông tin bệnh nhân.
//  Lưu vào bảng y_lenh + chi_tiet_y_lenh qua:
//    POST /reception/y-lenh, GET /reception/y-lenh, GET /reception/y-lenh/:id
// ============================================================================

const inp = { ...input, padding: "9px 11px", fontSize: 13.5, borderRadius: 9 };
const fmtVND = (n) => (Number(n) || 0).toLocaleString("vi-VN") + "đ";
const fmtNgay = (d) => { const x = new Date(d); return isNaN(x) ? "" : x.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); };
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const LOAI = {
  thuoc: { label: "Thuốc", tone: T.peach, soft: T.peachSoft, icon: PillIcon },
  vat_tu: { label: "Vật tư", tone: T.sky, soft: T.skySoft, icon: Package },
  dich_vu: { label: "Dịch vụ", tone: T.lav, soft: T.lavSoft, icon: Stethoscope },
};
const thanhTien = (r) => Math.round((Number(r.so_luong) || 0) * (Number(r.don_gia) || 0) * ((Number(r.ty_le) || 0) / 100));
const dongMoi = (loai) => ({ loai, ten: "", ma_vt: "", dvt: "", so_luong: 1, lieu_dung: "", cach_dung: "", don_gia: 0, ty_le: 100 });
// Dòng bắt nguồn từ chỉ định cận lâm sàng (mã CLS+id) — tự nạp từ phiếu khám
const laDongCls = (r) => typeof r.ma_vt === "string" && r.ma_vt.startsWith("CLS");
// Dòng tự nạp từ đơn thuốc bác sĩ kê. Đánh dấu bằng cờ riêng (không gửi lên
// server) vì ma_vt nay là mã danh mục thuốc dùng để trừ tủ thuốc.
const laDongDonThuoc = (r) => r.tu_don_thuoc === true;
const TT = {
  chua_nop: { label: "Chưa nộp", tone: "#C0392B", soft: "#FDECEA" },
  mot_phan: { label: "Nộp một phần", tone: "#B7791F", soft: T.goldSoft },
  da_du: { label: "Đã nộp đủ", tone: T.mint, soft: T.mintSoft },
};
// Tên hiển thị bác sĩ điều trị. ho_ten trong dữ liệu đã kèm học hàm nên chỉ thêm
// tiền tố khi ho_ten chưa chứa sẵn, tránh lặp "BS.CKI BS.CKI ...".
const tenBS = (d) => {
  const ten = (d.ho_ten || "").trim();
  const hh = (d.hoc_ham || "").trim();
  return hh && !ten.startsWith(hh) ? `${hh} ${ten}` : ten;
};

// Bỏ dấu để tìm kiếm không phụ thuộc dấu ("oxy", "tien san giat", "khang sinh")
const khongDau = (s) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

const escHtml = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const TEN_LOAI = { thuoc: "Thuốc", vat_tu: "Vật tư", dich_vu: "Dịch vụ" };

// Mở cửa sổ in "Phiếu thanh toán viện phí" từ chi tiết một phiếu y lệnh (api.yLenh).
// Phiếu ghi rõ bệnh nhân, người lập phiếu và người thu tiền theo yêu cầu nghiệp vụ.
function inPhieuThanhToan(y) {
  const rows = (y.chi_tiet || []).map((c, i) => `
    <tr><td class="c">${i + 1}</td><td>${escHtml(c.ten)}${c.dvt ? ` <span style="color:#7A8699">(${escHtml(c.dvt)})</span>` : ""}</td>
    <td class="c">${escHtml(TEN_LOAI[c.loai] || c.loai)}</td>
    <td class="r">${fmtVND(c.don_gia)}</td><td class="c">${c.so_luong}</td><td class="c">${c.ty_le}%</td>
    <td class="r">${fmtVND(c.thanh_tien)}</td></tr>`).join("");
  const lanThu = (y.lan_thu || []).map((l) => `
    <tr><td>${escHtml(fmtNgay(l.thoi_gian))}</td><td class="r">${fmtVND(l.so_tien)}</td><td>${escHtml(l.nguoi_thu || "—")}</td></tr>`).join("");
  const bn = (y.phieu_kham && y.phieu_kham.ten_bn) || "—";
  const maBN = (y.phieu_kham && y.phieu_kham.ma_benh_nhan) || "—";
  const conLai = Math.max(0, (y.tong_tien || 0) - (y.da_nop || 0));
  const daDu = y.trang_thai === "da_du";
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Phiếu thanh toán ${escHtml(y.ma_phieu)}</title>
  <style>
    * { box-sizing: border-box; font-family: 'Segoe UI', Arial, sans-serif; }
    body { color: #2D3A4E; padding: 32px; max-width: 780px; margin: 0 auto; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #F4B942; padding-bottom: 16px; }
    .bv { font-size: 20px; font-weight: 800; color: #E0A427; }
    .sub { font-size: 12px; color: #7A8699; letter-spacing: 1px; }
    h1 { font-size: 23px; margin: 20px 0 4px; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; font-size: 14px; margin: 16px 0; }
    .meta b { color: #2D3A4E; } .meta span { color: #7A8699; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13.5px; }
    th, td { padding: 9px 11px; border-bottom: 1px solid #E7EBF0; text-align: left; }
    th { background: #FDF2DA; font-size: 11.5px; text-transform: uppercase; letter-spacing: .5px; }
    td.r, th.r { text-align: right; } td.c, th.c { text-align: center; }
    .total { display: flex; justify-content: flex-end; margin-top: 16px; }
    .total .box { min-width: 280px; }
    .total .line { display: flex; justify-content: space-between; padding: 5px 0; font-size: 15px; }
    .total .grand { border-top: 2px solid #2D3A4E; margin-top: 6px; padding-top: 10px; font-size: 19px; font-weight: 800; }
    .stamp { display: inline-block; margin-top: 8px; padding: 4px 14px; border-radius: 999px; font-weight: 700; font-size: 13px;
      background: ${daDu ? "#E2F4EF" : "#FDF2DA"}; color: ${daDu ? "#3FA589" : "#B5851B"}; }
    h3 { font-size: 13px; text-transform: uppercase; color: #7A8699; letter-spacing: .5px; margin: 24px 0 6px; }
    .sign { margin-top: 40px; display: flex; justify-content: space-between; text-align: center; font-size: 13px; color: #2D3A4E; }
    .sign .col { width: 45%; } .sign .role { color: #7A8699; } .sign .nm { margin-top: 54px; font-weight: 700; }
    .btns { margin-top: 28px; text-align: center; }
    button { background: #E0A427; color: #fff; border: none; padding: 11px 26px; border-radius: 999px; font-size: 15px; font-weight: 700; cursor: pointer; }
    @media print { .btns { display: none; } body { padding: 8px; } }
  </style></head><body>
    <div class="head">
      <div><div class="bv">Bệnh viện Phụ sản Hải Phòng</div><div class="sub">CHĂM SÓC MẸ & BÉ</div></div>
      <div style="text-align:right;font-size:13px;color:#7A8699">Số phiếu: <b style="color:#2D3A4E">${escHtml(y.ma_phieu)}</b><br>Ngày lập: ${escHtml(fmtNgay(y.ngay_tao))}</div>
    </div>
    <h1>PHIẾU THANH TOÁN VIỆN PHÍ</h1>
    <span class="stamp">${daDu ? "ĐÃ THANH TOÁN ĐỦ" : conLai > 0 ? "CÒN THIẾU " + fmtVND(conLai) : "CHƯA THANH TOÁN"}</span>
    <div class="meta">
      <div><span>Bệnh nhân:</span> <b>${escHtml(bn)}</b></div>
      <div><span>Mã bệnh nhân:</span> <b>${escHtml(maBN)}</b></div>
      <div><span>Bác sĩ điều trị:</span> <b>${escHtml(y.bs_dt || "—")}</b></div>
      <div><span>Ngày y lệnh:</span> <b>${escHtml(y.ngay_yl ? String(y.ngay_yl).slice(0, 10) : "—")}</b></div>
      <div><span>Người lập phiếu:</span> <b>${escHtml((y.nguoi_tao && y.nguoi_tao.ho_ten) || "—")}</b></div>
      <div><span>Người thu tiền:</span> <b>${escHtml(y.nguoi_thu || "—")}</b></div>
    </div>
    <table>
      <thead><tr><th class="c">STT</th><th>Nội dung</th><th class="c">Loại</th><th class="r">Đơn giá</th><th class="c">SL</th><th class="c">TL%</th><th class="r">Thành tiền</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="total"><div class="box">
      <div class="line"><span>Tổng chi phí</span><span>${fmtVND(y.tong_tien)}</span></div>
      <div class="line"><span>Đã nộp</span><span>${fmtVND(y.da_nop)}</span></div>
      <div class="line"><span>Trả lại</span><span>${fmtVND(y.tra_lai)}</span></div>
      <div class="line grand"><span>CÒN LẠI</span><span>${fmtVND(conLai)}</span></div>
    </div></div>
    ${lanThu ? `<h3>Lịch sử thu tiền</h3><table><thead><tr><th>Thời gian</th><th class="r">Số tiền</th><th>Người thu</th></tr></thead><tbody>${lanThu}</tbody></table>` : ""}
    ${y.ghi_chu ? `<div style="margin-top:14px;font-size:13px;color:#7A8699">Ghi chú: ${escHtml(y.ghi_chu)}</div>` : ""}
    <div class="sign">
      <div class="col"><div class="role">Người nộp tiền</div><div class="nm">${escHtml(bn)}</div></div>
      <div class="col"><div class="role">Người thu tiền</div><div class="nm">${escHtml(y.nguoi_thu || "")}</div></div>
    </div>
    <div class="btns"><button onclick="window.print()">In / Lưu PDF</button></div>
  </body></html>`;
  const w = window.open("", "_blank", "width=800,height=900");
  if (!w) { alert("Trình duyệt đã chặn cửa sổ in phiếu. Vui lòng cho phép popup rồi thử lại."); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
}

// Dòng "tồn kho · đơn giá" hiện trong ô chọn thuốc/vật tư. ton = null nghĩa là
// mặt hàng chưa mở thẻ kho nên không theo dõi tồn.
function ThongTinKho({ m }) {
  const het = m.ton !== null && m.ton !== undefined && m.ton <= 0;
  return (
    <div style={{ display: "flex", gap: 10, marginTop: 4, fontSize: 11.5, flexWrap: "wrap" }}>
      {m.ton === null || m.ton === undefined ? (
        <span style={{ color: T.sub }}>Chưa theo dõi tồn kho</span>
      ) : (
        <span style={{ fontWeight: 700, color: het ? "#C0392B" : T.mint }}>
          Tồn: {Number(m.ton).toLocaleString("vi-VN")}{het ? " — đã hết" : ""}
        </span>
      )}
      <span style={{ color: m.don_gia > 0 ? T.ink : T.sub, fontWeight: m.don_gia > 0 ? 700 : 400 }}>
        {m.don_gia > 0 ? `Đơn giá kho: ${fmtVND(m.don_gia)}` : "Chưa đặt giá kho"}
      </span>
    </div>
  );
}

// Ô chọn thuốc từ danh mục sản phụ khoa: bấm để xổ danh sách, gõ để lọc.
// Danh mục lấy từ database (GET /catalog/thuoc) — cùng nguồn với tủ thuốc, nên
// mã thuốc đi kèm dòng viện phí và tồn kho trừ đúng mặt hàng.
// Đơn giá và liều dùng vẫn do người lập phiếu nhập theo bảng giá và y lệnh thực tế.
// Dùng chung cho ô kê đơn của bác sĩ (DoctorPortal) để hai bên cùng một danh mục.
export function ChonThuoc({ onChon, nhan }) {
  const [mo, setMo] = useState(false);
  const [tim, setTim] = useState("");
  const [danhMuc, setDanhMuc] = useState(null);
  const [loi, setLoi] = useState(null);
  const boxRef = useRef(null);

  useEffect(() => {
    api.thuocCatalog()
      .then((r) => setDanhMuc(Array.isArray(r) ? r : []))
      .catch((e) => { setLoi(e.message); setDanhMuc([]); });
  }, []);

  useEffect(() => {
    if (!mo) return;
    const ngoai = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) { setMo(false); setTim(""); } };
    document.addEventListener("mousedown", ngoai);
    return () => document.removeEventListener("mousedown", ngoai);
  }, [mo]);

  const tatCa = danhMuc || [];
  const tu = khongDau(tim).trim();
  const ds = tu
    ? tatCa.filter((t) => khongDau(t.hoat_chat).includes(tu) || khongDau(t.nhom).includes(tu)
        || khongDau(t.ung_dung).includes(tu) || khongDau(t.kiem_soat).includes(tu))
    : tatCa;

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      <Btn kind="soft" size="sm" onClick={() => setMo(!mo)}>
        <PillIcon size={14} /> {nhan || "Thuốc từ danh mục"} ({danhMuc === null ? "…" : tatCa.length}) <ChevronDown size={14} />
      </Btn>
      {mo && (
        <div style={{ position: "absolute", zIndex: 40, top: "calc(100% + 6px)", right: 0, width: 460, maxWidth: "90vw",
          background: "#fff", border: `1.5px solid ${T.line}`, borderRadius: 14, boxShadow: "0 16px 40px rgba(0,0,0,.14)", overflow: "hidden" }}>
          <div style={{ padding: 10, borderBottom: `1px solid ${T.line}`, display: "flex", alignItems: "center", gap: 8 }}>
            <Search size={15} color={T.sub} />
            <input autoFocus value={tim} onChange={(e) => setTim(e.target.value)} placeholder="Tìm hoạt chất, nhóm thuốc hoặc chỉ định..."
              style={{ flex: 1, border: "none", outline: "none", fontSize: 13.5, fontFamily: "inherit", background: "transparent", color: T.ink }} />
          </div>
          <div style={{ maxHeight: 330, overflowY: "auto" }}>
            {loi && <div style={{ padding: 16, fontSize: 13, color: "#C0392B" }}>Không tải được danh mục thuốc: {loi}</div>}
            {!loi && danhMuc === null && <div style={{ padding: 16, fontSize: 13, color: T.sub }}>Đang tải danh mục thuốc...</div>}
            {!loi && danhMuc !== null && ds.length === 0 && (
              <div style={{ padding: 16, fontSize: 13, color: T.sub }}>Không có thuốc phù hợp. Dùng nút "Thuốc trống" để nhập tay.</div>
            )}
            {ds.map((t) => (
              <div key={t.ma_thuoc} onMouseDown={(e) => { e.preventDefault(); onChon(t); setMo(false); setTim(""); }}
                style={{ padding: "10px 13px", cursor: "pointer", borderBottom: `1px solid ${T.line}44` }}
                onMouseEnter={(e) => { e.currentTarget.style.background = T.bg; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 800, color: T.ink, fontSize: 13.5 }}>{t.hoat_chat}</span>
                  <span style={{ fontSize: 12, color: T.sub }}>· {t.nhom}</span>
                  {t.dvt && <span style={{ fontSize: 11.5, color: T.sub }}>· {t.dvt}</span>}
                  <span style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 700, color: MUC_KIEM_SOAT[t.kiem_soat] || T.sub,
                    background: (MUC_KIEM_SOAT[t.kiem_soat] || T.sub) + "1A", padding: "2px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>{t.kiem_soat}</span>
                </div>
                <div style={{ fontSize: 12, color: T.sub, marginTop: 3, lineHeight: 1.45 }}>{t.ung_dung}</div>
                <ThongTinKho m={t} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Ô chọn vật tư tiêu hao người bệnh có thể phải chi trả.
// Danh mục lấy từ database (GET /catalog/vat-tu) — cùng nguồn với báo cáo vật tư.
// maKhoa: khoa đang điều trị cho bệnh nhân (suy từ bác sĩ điều trị hoặc chuyên
// khoa trên phiếu khám) — mặc định chỉ hiện các nhóm vật tư khoa đó thường dùng,
// bấm "Tất cả khoa" để xem trọn danh mục.
// Đơn giá điền sẵn từ thẻ kho (sửa ở trang Tồn kho); mặt hàng chưa đặt giá thì
// để 0 cho lễ tân nhập theo bảng giá thực tế.
function ChonVatTu({ danhMuc, loi, onChon, maKhoa, tenKhoa }) {
  const [mo, setMo] = useState(false);
  const [tim, setTim] = useState("");
  const [nhomChon, setNhomChon] = useState(null);   // null = tất cả nhóm trong phạm vi
  const [moiKhoa, setMoiKhoa] = useState(false);    // true = bỏ lọc theo khoa
  const boxRef = useRef(null);

  useEffect(() => {
    if (!mo) return;
    const ngoai = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) { setMo(false); setTim(""); } };
    document.addEventListener("mousedown", ngoai);
    return () => document.removeEventListener("mousedown", ngoai);
  }, [mo]);

  // Đổi bệnh nhân/bác sĩ thì bỏ nhóm đã chọn để không giữ bộ lọc của ca trước
  useEffect(() => { setNhomChon(null); setMoiKhoa(false); }, [maKhoa]);

  const locKhoa = !moiKhoa && !!maKhoa;
  const trongKhoa = (v) => !locKhoa || (Array.isArray(v.khoa) && v.khoa.includes(maKhoa));
  // Nhóm hiện trên thanh lọc: suy từ chính danh mục đã nạp, không hard-code
  const nhomHien = [];
  for (const v of danhMuc) {
    if (trongKhoa(v) && !nhomHien.some((n) => n.id === v.nhom_id)) {
      nhomHien.push({ id: v.nhom_id, ten: v.nhom_ten });
    }
  }

  const tu = khongDau(tim).trim();
  const ds = danhMuc.filter((v) => {
    if (!trongKhoa(v)) return false;
    if (nhomChon && v.nhom_id !== nhomChon) return false;
    if (!tu) return true;
    return khongDau(v.ten).includes(tu) || khongDau(v.ghi_chu || "").includes(tu)
      || khongDau(v.nhom_ten).includes(tu);
  });

  const chipNhom = (dang, nhan, key) => (
    <button key={key} onClick={dang.onClick}
      style={{ padding: "5px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, cursor: "pointer",
        fontFamily: "inherit", whiteSpace: "nowrap",
        border: `1.5px solid ${dang.on ? T.sky : T.line}`,
        background: dang.on ? T.skySoft : "transparent", color: dang.on ? T.sky : T.sub }}>
      {nhan}
    </button>
  );

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      <Btn kind="soft" size="sm" onClick={() => setMo(!mo)}>
        <Package size={14} /> Vật tư từ danh mục ({ds.length}) <ChevronDown size={14} />
      </Btn>
      {mo && (
        <div style={{ position: "absolute", zIndex: 40, top: "calc(100% + 6px)", right: 0, width: 520, maxWidth: "92vw",
          background: "#fff", border: `1.5px solid ${T.line}`, borderRadius: 14, boxShadow: "0 16px 40px rgba(0,0,0,.14)", overflow: "hidden" }}>
          <div style={{ padding: 10, borderBottom: `1px solid ${T.line}`, display: "flex", alignItems: "center", gap: 8 }}>
            <Search size={15} color={T.sub} />
            <input autoFocus value={tim} onChange={(e) => setTim(e.target.value)} placeholder="Tìm vật tư, nhóm hoặc trường hợp sử dụng..."
              style={{ flex: 1, border: "none", outline: "none", fontSize: 13.5, fontFamily: "inherit", background: "transparent", color: T.ink }} />
          </div>

          {/* Lọc theo khoa đang điều trị + theo nhóm vật tư */}
          <div style={{ padding: "9px 10px", borderBottom: `1px solid ${T.line}`, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {maKhoa ? (
              <>
                {chipNhom({ on: !moiKhoa, onClick: () => setMoiKhoa(false) }, tenKhoa || "Khoa điều trị", "k-khoa")}
                {chipNhom({ on: moiKhoa, onClick: () => setMoiKhoa(true) }, "Tất cả khoa", "k-all")}
                <span style={{ width: 1, height: 18, background: T.line, margin: "0 3px" }} />
              </>
            ) : (
              <span style={{ fontSize: 11.5, color: T.sub, marginRight: 4 }}>
                Chưa xác định khoa điều trị — đang hiện toàn bộ danh mục.
              </span>
            )}
            {chipNhom({ on: !nhomChon, onClick: () => setNhomChon(null) }, "Mọi nhóm", "n-all")}
            {nhomHien.map((n) => chipNhom({ on: nhomChon === n.id, onClick: () => setNhomChon(n.id) }, n.ten, `n${n.id}`))}
          </div>

          <div style={{ maxHeight: 330, overflowY: "auto" }}>
            {loi && (
              <div style={{ padding: 16, fontSize: 13, color: "#C0392B" }}>
                Không nạp được danh mục vật tư: {loi}
              </div>
            )}
            {!loi && ds.length === 0 && (
              <div style={{ padding: 16, fontSize: 13, color: T.sub }}>
                {danhMuc.length === 0
                  ? 'Danh mục vật tư trong hệ thống đang trống — chạy "npm run seed:vat-tu" ở backend để nạp.'
                  : 'Không có vật tư phù hợp. Bỏ lọc khoa/nhóm hoặc dùng nút "Vật tư trống" để nhập tay.'}
              </div>
            )}
            {ds.map((v) => (
              <div key={v.id} onMouseDown={(e) => { e.preventDefault(); onChon(v); setMo(false); setTim(""); }}
                style={{ padding: "10px 13px", cursor: "pointer", borderBottom: `1px solid ${T.line}44` }}
                onMouseEnter={(e) => { e.currentTarget.style.background = T.bg; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 800, color: T.ink, fontSize: 13.5 }}>{v.ten}</span>
                  <span style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 700, color: T.sky,
                    background: T.skySoft, padding: "2px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>{v.nhom_ten}</span>
                </div>
                <div style={{ fontSize: 12, color: T.sub, marginTop: 3, lineHeight: 1.45 }}>{v.ghi_chu}</div>
                <ThongTinKho m={v} />
              </div>
            ))}
          </div>
          <div style={{ padding: "8px 12px", borderTop: `1px solid ${T.line}`, fontSize: 11.5, color: T.sub, lineHeight: 1.45 }}>
            Danh mục tham khảo: chỉ thu riêng khi vật tư chưa nằm trong giá dịch vụ/gói và đã đối chiếu phạm vi BHYT.
          </div>
        </div>
      )}
    </div>
  );
}

// Ô chọn bệnh nhân bằng cách TRA CỨU / GÕ TÊN: lọc trong danh sách phiếu khám
// theo tên bệnh nhân, mã KCB hoặc mã BN. Giá trị trả về là id phiếu khám (để giữ
// liên kết bệnh nhân + tự nạp chỉ định cận lâm sàng như trước).
function ChonBenhNhan({ sheets, value, onChon }) {
  const [mo, setMo] = useState(false);
  const [tim, setTim] = useState("");
  const boxRef = useRef(null);
  const daChon = sheets.find((s) => String(s.id) === String(value));
  const nhan = (s) => `${s.ten_bn}${s.ma_benh_nhan ? ` · ${s.ma_benh_nhan}` : ""}${s.ma_kcb ? ` · ${s.ma_kcb}` : ` · #${s.id}`}`;

  useEffect(() => {
    if (!mo) return;
    const ngoai = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) { setMo(false); setTim(""); } };
    document.addEventListener("mousedown", ngoai);
    return () => document.removeEventListener("mousedown", ngoai);
  }, [mo]);

  const tu = khongDau(tim).trim();
  const ds = tu
    ? sheets.filter((s) => khongDau(s.ten_bn).includes(tu) || khongDau(s.ma_kcb || "").includes(tu) || khongDau(s.ma_benh_nhan || "").includes(tu))
    : sheets;

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      <div style={{ ...inp, padding: "0 10px", fontSize: 14, display: "flex", alignItems: "center", gap: 8,
        border: `1.5px solid ${mo ? T.gold : T.line}` }}>
        <Search size={15} color={T.sub} style={{ flexShrink: 0 }} />
        <input value={mo ? tim : (daChon ? nhan(daChon) : "")}
          onChange={(e) => { setTim(e.target.value); if (!mo) setMo(true); }}
          onFocus={() => setMo(true)}
          placeholder="Gõ tên bệnh nhân, mã KCB hoặc mã BN để tìm…"
          style={{ flex: 1, minWidth: 0, border: "none", outline: "none", padding: "10px 0", fontSize: 14, fontFamily: "inherit", background: "transparent", color: T.ink }} />
        {daChon && !mo && (
          <button onMouseDown={(e) => { e.preventDefault(); onChon(""); }} title="Bỏ chọn"
            style={{ background: "none", border: "none", cursor: "pointer", color: T.sub, padding: 2, flexShrink: 0 }}><X size={15} /></button>
        )}
        <ChevronDown size={15} color={T.sub} style={{ flexShrink: 0, cursor: "pointer" }} onMouseDown={(e) => { e.preventDefault(); setMo((v) => !v); setTim(""); }} />
      </div>
      {mo && (
        <div style={{ position: "absolute", zIndex: 40, top: "calc(100% + 6px)", left: 0, right: 0,
          background: "#fff", border: `1.5px solid ${T.line}`, borderRadius: 12, boxShadow: "0 16px 40px rgba(0,0,0,.14)", overflow: "hidden" }}>
          <div style={{ maxHeight: 300, overflowY: "auto" }}>
            {sheets.length === 0 && <div style={{ padding: 16, fontSize: 13, color: T.sub }}>Chưa có phiếu khám bệnh nào. Tạo ở mục "Thông tin khám bệnh" trước.</div>}
            {sheets.length > 0 && ds.length === 0 && <div style={{ padding: 16, fontSize: 13, color: T.sub }}>Không tìm thấy bệnh nhân khớp "{tim}".</div>}
            {ds.map((s) => {
              const chon = String(s.id) === String(value);
              return (
                <div key={s.id} onMouseDown={(e) => { e.preventDefault(); onChon(String(s.id)); setMo(false); setTim(""); }}
                  style={{ padding: "10px 13px", cursor: "pointer", borderBottom: `1px solid ${T.line}44`, background: chon ? T.goldSoft : "transparent" }}
                  onMouseEnter={(e) => { if (!chon) e.currentTarget.style.background = T.bg; }}
                  onMouseLeave={(e) => { if (!chon) e.currentTarget.style.background = "transparent"; }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 800, color: T.ink, fontSize: 13.5 }}>{s.ten_bn}</span>
                    {s.ma_benh_nhan && <span style={{ fontSize: 12, color: T.gold, fontWeight: 700 }}>{s.ma_benh_nhan}</span>}
                    <span style={{ marginLeft: "auto", fontSize: 11.5, color: T.sub }}>{s.ma_kcb || `#${s.id}`}</span>
                  </div>
                  {s.chan_doan_so_bo && <div style={{ fontSize: 12, color: T.sub, marginTop: 3 }}>CĐ: {s.chan_doan_so_bo}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// tuKhoaBanDau: mở sẵn với bộ lọc theo một bệnh nhân — dùng khi màn hình khác
// (vd điều kiện ĐKRV ở "Thông tin khám bệnh") chuyển sang đây để thu nốt viện phí.
export default function YLenh({ tuKhoaBanDau }) {
  const { online } = useNav();
  const live = online && !!store.token;
  const [sheets, setSheets] = useState([]);       // phiếu khám để liên kết
  const [services, setServices] = useState([]);
  const [doctors, setDoctors] = useState([]);     // danh sách bác sĩ bệnh viện
  const [phieuKhamId, setPhieuKhamId] = useState("");
  const [ngayYl, setNgayYl] = useState(() => ymd(new Date()));
  const [ngayCdht, setNgayCdht] = useState("");
  const [bsDt, setBsDt] = useState("");
  const [daNop, setDaNop] = useState("");
  const [ghiChu, setGhiChu] = useState("");
  const [rows, setRows] = useState([]);
  const [clsGoi, setClsGoi] = useState([]);       // chỉ định CLS của phiếu khám đã chọn
  const [vatTu, setVatTu] = useState([]);         // danh mục vật tư tiêu hao (database)
  const [loiVatTu, setLoiVatTu] = useState(null);
  const [thuocGoi, setThuocGoi] = useState([]);   // đơn thuốc bác sĩ kê ở lần khám đó
  const [luotKham, setLuotKham] = useState(null); // lần khám nguồn của đơn thuốc
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [list, setList] = useState([]);
  // Bộ lọc danh sách phiếu gần đây
  const [fTu, setFTu] = useState(""); const [fDen, setFDen] = useState(""); const [fQ, setFQ] = useState(tuKhoaBanDau || "");
  // Thu thêm (nộp nhiều lần)
  const [payFor, setPayFor] = useState(null); const [paySo, setPaySo] = useState(""); const [paying, setPaying] = useState(false);

  const loadList = (flt) => {
    if (!live) return;
    const f = flt || { tu: fTu, den: fDen, q: fQ };
    api.yLenhList({ tu: f.tu || undefined, den: f.den || undefined, q: f.q || undefined })
      .then((r) => setList(Array.isArray(r) ? r : [])).catch(() => {});
  };
  useEffect(() => {
    if (!live) return;
    api.examSheets().then((r) => setSheets(Array.isArray(r) ? r : [])).catch(() => {});
    api.services().then((r) => setServices(Array.isArray(r) ? r : [])).catch(() => {});
    api.doctors().then((r) => setDoctors(Array.isArray(r) ? r : [])).catch(() => {});
    api.vatTuCatalog()
      .then((r) => { setVatTu(Array.isArray(r) ? r : []); setLoiVatTu(null); })
      .catch((e) => { setVatTu([]); setLoiVatTu(e.message); });
    loadList({ q: tuKhoaBanDau || undefined });
  }, [live, tuKhoaBanDau]);

  // Khi chọn phiếu khám: tự nạp chỉ định cận lâm sàng của lần khám vào chi tiết
  // viện phí (dòng dịch vụ). Thay các dòng CLS của phiếu khám trước, giữ nguyên
  // các dòng thuốc/vật tư/dịch vụ nhập tay.
  useEffect(() => {
    if (!live || !phieuKhamId) {
      setClsGoi([]);
      setRows((rs) => rs.filter((r) => !laDongCls(r)));
      return;
    }
    let alive = true;
    api.yLenhCls(phieuKhamId).then((r) => {
      if (!alive) return;
      const goi = (Array.isArray(r?.chi_tiet) ? r.chi_tiet : []).map((t) => ({
        ...t, dvt: t.dvt || "", lieu_dung: t.lieu_dung || "", cach_dung: t.cach_dung || "",
      }));
      setClsGoi(goi);
      setRows((rs) => [...rs.filter((r2) => !laDongCls(r2)), ...goi]);
    }).catch(() => { if (alive) setClsGoi([]); });
    return () => { alive = false; };
  }, [phieuKhamId, live]);

  // Đơn thuốc bác sĩ đã kê ở lần khám → tự thành dòng thuốc trong chi tiết viện phí.
  // Đơn giá về 0 vì danh mục thuốc không có bảng giá — lễ tân nhập giá thực tế.
  useEffect(() => {
    if (!live || !phieuKhamId) {
      setThuocGoi([]); setLuotKham(null);
      setRows((rs) => rs.filter((r) => !laDongDonThuoc(r)));
      return;
    }
    let alive = true;
    api.yLenhDonThuoc(phieuKhamId).then((r) => {
      if (!alive) return;
      // Server trả null cho trường trống — đổi về "" để ô nhập không thành uncontrolled
      const goi = (Array.isArray(r?.chi_tiet) ? r.chi_tiet : []).map((t) => ({
        ...t, tu_don_thuoc: true,
        dvt: t.dvt || "", lieu_dung: t.lieu_dung || "", cach_dung: t.cach_dung || "", ma_vt: t.ma_vt || "",
      }));
      setThuocGoi(goi); setLuotKham(r?.luot_kham || null);
      setRows((rs) => [...rs.filter((r2) => !laDongDonThuoc(r2)), ...goi]);
    }).catch(() => { if (alive) { setThuocGoi([]); setLuotKham(null); } });
    return () => { alive = false; };
  }, [phieuKhamId, live]);

  const xoaLoc = () => { setFTu(""); setFDen(""); setFQ(""); loadList({ tu: "", den: "", q: "" }); };
  // Lập / in phiếu thanh toán viện phí: nạp chi tiết đầy đủ rồi mở cửa sổ in
  const inPhieu = async (y) => {
    try { const full = await api.yLenh(y.id); inPhieuThanhToan(full); }
    catch (e) { setMsg({ type: "err", text: e.message }); }
  };
  const xacNhanThu = async () => {
    if (!payFor) return;
    const so = Math.round(Number(paySo) || 0);
    if (so <= 0) { setMsg({ type: "err", text: "Số tiền thu phải lớn hơn 0." }); return; }
    setPaying(true);
    try {
      const r = await api.payYLenh(payFor.id, so);
      setMsg({ type: "ok", text: `Đã thu thêm ${fmtVND(so)} cho ${r.ma_phieu} — còn lại ${fmtVND(r.con_lai)}.` });
      setPayFor(null); setPaySo(""); loadList();
    } catch (e) { setMsg({ type: "err", text: e.message }); }
    finally { setPaying(false); }
  };

  const sheet = sheets.find((s) => String(s.id) === String(phieuKhamId));
  // Khoa đang điều trị cho bệnh nhân — dùng để lọc danh mục vật tư tiêu hao.
  // Ưu tiên khoa của BS điều trị đã chọn trên phiếu, sau đó là chuyên khoa ghi
  // trên phiếu khám bệnh (do bác sĩ cập nhật khi lưu kết quả khám).
  const khoaDieuTri = (() => {
    const d = doctors.find((x) => tenBS(x) === bsDt);
    if (d && d.khoa) return { ma: d.khoa.ma || maKhoaTuTen(d.khoa.ten_khoa), ten: d.khoa.ten_khoa };
    if (sheet && sheet.chuyen_khoa) return { ma: maKhoaTuTen(sheet.chuyen_khoa), ten: sheet.chuyen_khoa };
    return { ma: null, ten: "" };
  })();
  const setRow = (i, k, v) => setRows((rs) => rs.map((r, idx) => idx === i ? { ...r, [k]: v } : r));
  const addRow = (loai) => setRows((rs) => [...rs, dongMoi(loai)]);
  const delRow = (i) => setRows((rs) => rs.filter((_, idx) => idx !== i));
  // Thêm dòng thuốc từ danh mục: chỉ lấy tên hoạt chất, các số liệu để trống
  // cho người lập phiếu nhập theo bảng giá và y lệnh thực tế.
  // Mã thuốc đi kèm dòng viện phí để tồn kho trừ đúng mặt hàng ở tủ thuốc
  const addThuoc = (t) => setRows((rs) => [...rs, {
    ...dongMoi("thuoc"), ten: t.hoat_chat, ma_vt: t.ma_thuoc,
    dvt: t.dvt || t.dvt_kho || "", don_gia: t.don_gia || 0,
  }]);
  // Thêm dòng vật tư từ danh mục database. Mã vật tư giữ nguyên để báo cáo đối
  // chiếu được với danh mục; đơn giá chỉ điền sẵn khi đã có giá niêm yết.
  const addVatTu = (v) => setRows((rs) => [...rs, {
    ...dongMoi("vat_tu"), ten: v.ten, ma_vt: v.ma_vt,
    dvt: v.dvt || v.dvt_kho || "", don_gia: v.don_gia || 0,
  }]);
  const addDichVu = (id) => {
    const dv = services.find((s) => String(s.id) === String(id));
    if (!dv) return;
    setRows((rs) => [...rs, { ...dongMoi("dich_vu"), ten: dv.ten_dich_vu, don_gia: dv.gia, dvt: "Lần", ma_vt: dv.id ? `DV${dv.id}` : "" }]);
  };

  const tong = rows.reduce((s, r) => s + thanhTien(r), 0);
  const traLai = Math.max(0, (Number(daNop) || 0) - tong);

  // Nạp lại chỉ định CLS từ phiếu khám (nếu đã lỡ xóa) — thêm dòng còn thiếu
  const themLaiCls = () => {
    if (!clsGoi.length) return;
    setRows((rs) => {
      const daCo = new Set(rs.map((r) => r.ma_vt));
      return [...rs, ...clsGoi.filter((g) => !daCo.has(g.ma_vt))];
    });
  };

  // Nạp lại đơn thuốc của bác sĩ (nếu đã lỡ xóa) — thêm dòng còn thiếu
  const themLaiThuoc = () => {
    if (!thuocGoi.length) return;
    setRows((rs) => {
      const daCo = new Set(rs.map((r) => r.ma_vt));
      return [...rs, ...thuocGoi.filter((g) => !daCo.has(g.ma_vt))];
    });
  };

  const reset = () => { setPhieuKhamId(""); setNgayYl(ymd(new Date())); setNgayCdht(""); setBsDt(""); setDaNop(""); setGhiChu(""); setRows([]); setClsGoi([]); setThuocGoi([]); setLuotKham(null); setMsg(null); };

  const luu = async () => {
    setMsg(null);
    if (!phieuKhamId) { setMsg({ type: "err", text: "Vui lòng chọn phiếu khám bệnh để liên kết bệnh nhân với phiếu y lệnh." }); return; }
    if (rows.length === 0) { setMsg({ type: "err", text: "Thêm ít nhất một dòng thuốc / vật tư / dịch vụ." }); return; }
    if (rows.some((r) => !r.ten.trim())) { setMsg({ type: "err", text: "Mỗi dòng phải có tên." }); return; }
    setSaving(true);
    try {
      const r = await api.createYLenh({
        phieu_kham_id: phieuKhamId || undefined, ngay_yl: ngayYl || undefined,
        ngay_cdht: ngayCdht || undefined, bs_dt: bsDt || undefined,
        da_nop: Number(daNop) || 0, ghi_chu: ghiChu || undefined,
        chi_tiet: rows.map((r) => ({ loai: r.loai, ten: r.ten, ma_vt: r.ma_vt, dvt: r.dvt,
          so_luong: r.so_luong, lieu_dung: r.lieu_dung, cach_dung: r.cach_dung, don_gia: r.don_gia, ty_le: r.ty_le })),
      });
      // Báo luôn kết quả trừ kho để lễ tân biết dòng nào không theo dõi tồn
      const kho = r.kho || {};
      const daXuat = kho.da_xuat || [];
      const boQua = kho.khong_theo_doi || [];
      const chiTietKho = daXuat.length
        ? ` Đã trừ kho ${daXuat.length} mặt hàng: ${daXuat.map((d) => `${d.ten} còn ${d.ton_sau}`).join(", ")}.`
        : "";
      const chuaTheoDoi = boQua.length ? ` ${boQua.length} dòng nhập tay không theo dõi tồn kho.` : "";
      // reset() xóa thông báo nên phải đặt lại sau khi dọn form
      reset(); loadList();
      setMsg({ type: "ok", text: `Đã lưu phiếu y lệnh ${r.ma_phieu} — tổng ${fmtVND(r.tong_tien)}.${chiTietKho}${chuaTheoDoi}` });
    } catch (e) { setMsg({ type: "err", text: e.message }); }
    finally { setSaving(false); }
  };

  if (!live) {
    return (<div><PageTitle title="Y lệnh — thanh toán viện phí" sub="Lập phiếu thuốc, vật tư và dịch vụ." />
      <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>Cần đăng nhập tài khoản lễ tân.</Card></div>);
  }

  const th = { padding: "10px 8px", fontSize: 11.5, fontWeight: 800, color: T.sub, textTransform: "uppercase", letterSpacing: .4, textAlign: "left" };
  const td = { padding: "6px 8px", verticalAlign: "top" };

  return (
    <div>
      <PageTitle title="Y lệnh — thanh toán viện phí" sub="Thuốc, vật tư tiêu hao và dịch vụ — lưu vào hệ thống, liên kết bệnh nhân từ phiếu khám."
        action={<Btn kind="ghost" onClick={reset}><RotateCcw size={15} /> Làm mới</Btn>} />

      {msg && <Card style={{ padding: 14, marginBottom: 16, border: "none", fontSize: 14,
        background: msg.type === "ok" ? T.mintSoft : "#FDECEA", color: msg.type === "ok" ? "#2F8F73" : "#C0392B" }}>{msg.text}</Card>}

      {/* Liên kết bệnh nhân + thông tin phiếu */}
      <Card style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ fontWeight: 800, color: T.ink, fontSize: 15, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}><ClipboardList size={17} color={T.gold} /> Thông tin phiếu</div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 14 }} className="grid3">
          <label style={{ display: "block" }}>
            <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 600, display: "block", marginBottom: 5 }}>Bệnh nhân * — tra cứu theo tên / mã</span>
            <ChonBenhNhan sheets={sheets} value={phieuKhamId} onChon={setPhieuKhamId} />
          </label>
          <label style={{ display: "block" }}>
            <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 600, display: "block", marginBottom: 5 }}>Ngày YL</span>
            <input type="date" style={{ ...inp, padding: "10px 12px", fontSize: 14 }} value={ngayYl} onChange={(e) => setNgayYl(e.target.value)} />
          </label>
          <label style={{ display: "block" }}>
            <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 600, display: "block", marginBottom: 5 }}>Ngày CĐHT</span>
            <input type="date" style={{ ...inp, padding: "10px 12px", fontSize: 14 }} value={ngayCdht} onChange={(e) => setNgayCdht(e.target.value)} />
          </label>
          <label style={{ display: "block", gridColumn: "span 2" }}>
            <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 600, display: "block", marginBottom: 5 }}>BS điều trị</span>
            <select style={{ ...inp, padding: "10px 12px", fontSize: 14 }} value={bsDt} onChange={(e) => setBsDt(e.target.value)}>
              <option value="">— Chọn bác sĩ điều trị —</option>
              {doctors.map((d) => <option key={d.id} value={tenBS(d)}>{tenBS(d)}{d.khoa ? ` — ${d.khoa.ten_khoa}` : ""}</option>)}
            </select>
          </label>
          <label style={{ display: "block" }}>
            <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 600, display: "block", marginBottom: 5 }}>Ghi chú</span>
            <input style={{ ...inp, padding: "10px 12px", fontSize: 14 }} value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} />
          </label>
        </div>
        {sheet && <div style={{ marginTop: 12, padding: "10px 14px", background: T.bg, borderRadius: 12, fontSize: 13.5, color: T.sub }}>
          Liên kết: <b style={{ color: T.ink }}>{sheet.ten_bn}</b>{sheet.chan_doan_so_bo ? ` — CĐ: ${sheet.chan_doan_so_bo}` : ""}
          {clsGoi.length > 0
            ? <span> · Đã tự thêm <b style={{ color: T.lav }}>{clsGoi.length}</b> chỉ định cận lâm sàng vào chi tiết viện phí.</span>
            : <span> · Lần khám này chưa có chỉ định cận lâm sàng.</span>}
          {thuocGoi.length > 0
            ? <span> · Đã tự thêm <b style={{ color: T.mint }}>{thuocGoi.length}</b> thuốc từ đơn của {luotKham && luotKham.bac_si ? luotKham.bac_si : "bác sĩ"} — <b style={{ color: T.ink }}>cần nhập đơn giá</b>.</span>
            : <span> · Bác sĩ chưa kê đơn thuốc từ danh mục cho lần khám này.</span>}
        </div>}
      </Card>

      {/* Bảng chi tiết thuốc / vật tư / dịch vụ */}
      <Card style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
          <div style={{ fontWeight: 800, color: T.ink, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}><Receipt size={17} color={T.gold} /> Chi tiết viện phí</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {clsGoi.length > 0 && (
              <Btn kind="lav" size="sm" onClick={themLaiCls} title="Nạp lại các chỉ định cận lâm sàng từ phiếu khám">
                <Stethoscope size={14} /> Chỉ định CLS ({clsGoi.length})
              </Btn>
            )}
            {thuocGoi.length > 0 && (
              <Btn kind="mint" size="sm" onClick={themLaiThuoc} title="Nạp lại đơn thuốc bác sĩ đã kê ở lần khám">
                <PillIcon size={14} /> Đơn thuốc BS ({thuocGoi.length})
              </Btn>
            )}
            <ChonThuoc onChon={addThuoc} />
            <Btn kind="soft" size="sm" onClick={() => addRow("thuoc")}><Plus size={14} /> Thuốc trống</Btn>
            <ChonVatTu danhMuc={vatTu} loi={loiVatTu} onChon={addVatTu}
              maKhoa={khoaDieuTri.ma} tenKhoa={khoaDieuTri.ten} />
            <Btn kind="soft" size="sm" onClick={() => addRow("vat_tu")}><Plus size={14} /> Vật tư trống</Btn>
            <select style={{ ...inp, width: "auto", padding: "8px 10px" }} value="" onChange={(e) => { addDichVu(e.target.value); e.target.value = ""; }}>
              <option value="">+ Dịch vụ từ danh mục…</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.ten_dich_vu} — {fmtVND(s.gia)}</option>)}
            </select>
            <Btn kind="soft" size="sm" onClick={() => addRow("dich_vu")}><Plus size={14} /> Dịch vụ trống</Btn>
          </div>
        </div>

        {rows.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: T.sub, fontSize: 14, border: `1.5px dashed ${T.line}`, borderRadius: 12 }}>
            Chưa có dòng nào. Dùng các nút bên trên để thêm thuốc, vật tư tiêu hao hoặc dịch vụ.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
              <thead><tr style={{ borderBottom: `1px solid ${T.line}` }}>
                <th style={{ ...th, width: 82 }}>Loại</th><th style={{ ...th, minWidth: 200 }}>Tên</th>
                <th style={{ ...th, width: 70 }}>ĐVT</th><th style={{ ...th, width: 70 }}>SL</th>
                <th style={{ ...th, minWidth: 130 }}>Liều/Cách dùng</th>
                <th style={{ ...th, width: 110 }}>Đơn giá</th><th style={{ ...th, width: 60 }}>TL%</th>
                <th style={{ ...th, width: 110, textAlign: "right" }}>Thành tiền</th><th style={{ ...th, width: 36 }}></th>
              </tr></thead>
              <tbody>
                {rows.map((r, i) => { const L = LOAI[r.loai]; return (
                  <tr key={i} style={{ borderBottom: `1px solid ${T.line}55` }}>
                    <td style={td}><Pill tone={L.tone} soft={L.soft}><L.icon size={12} /> {L.label}</Pill></td>
                    <td style={td}><input style={inp} value={r.ten} onChange={(e) => setRow(i, "ten", e.target.value)} placeholder="Tên..." /></td>
                    <td style={td}><input style={inp} value={r.dvt} onChange={(e) => setRow(i, "dvt", e.target.value)} placeholder="Cái" /></td>
                    <td style={td}><input style={inp} type="number" min="0" step="any" value={r.so_luong} onChange={(e) => setRow(i, "so_luong", e.target.value)} /></td>
                    <td style={td}>
                      <input style={{ ...inp, marginBottom: 4 }} value={r.lieu_dung} onChange={(e) => setRow(i, "lieu_dung", e.target.value)} placeholder="Liều dùng" />
                      <input style={inp} value={r.cach_dung} onChange={(e) => setRow(i, "cach_dung", e.target.value)} placeholder="Cách dùng" />
                    </td>
                    <td style={td}><input style={inp} type="number" min="0" value={r.don_gia} onChange={(e) => setRow(i, "don_gia", e.target.value)} /></td>
                    <td style={td}><input style={inp} type="number" min="0" max="100" value={r.ty_le} onChange={(e) => setRow(i, "ty_le", e.target.value)} /></td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 800, color: T.ink }}>{fmtVND(thanhTien(r))}</td>
                    <td style={td}><button onClick={() => delRow(i)} title="Xóa dòng" style={{ background: "none", border: "none", cursor: "pointer", color: "#C0392B", padding: 4 }}><Trash2 size={16} /></button></td>
                  </tr>
                ); })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Tổng kết thanh toán */}
      <Card style={{ padding: 20, marginBottom: 24, display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-end", justifyContent: "space-between" }}>
        <label style={{ display: "block", maxWidth: 240 }}>
          <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 600, display: "block", marginBottom: 5 }}>Bệnh nhân nộp lần đầu (đ) — lễ tân xác nhận</span>
          <input style={{ ...inp, padding: "10px 12px", fontSize: 14 }} type="number" min="0" value={daNop} onChange={(e) => setDaNop(e.target.value)} placeholder="0" />
          <span style={{ fontSize: 11.5, color: T.sub, display: "block", marginTop: 5 }}>Nộp chưa đủ có thể thu tiếp lần sau ở danh sách bên dưới.</span>
        </label>
        {/* Nút lưu đặt ngay dưới số tiền — lễ tân xem lại tổng rồi mới chốt phiếu */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12 }}>
          <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
            <div><div style={{ fontSize: 12.5, color: T.sub }}>Tổng chi phí</div><div style={{ fontSize: 22, fontWeight: 800, color: T.ink }}>{fmtVND(tong)}</div></div>
            <div><div style={{ fontSize: 12.5, color: T.sub }}>Đã nộp</div><div style={{ fontSize: 22, fontWeight: 800, color: T.mint }}>{fmtVND(Number(daNop) || 0)}</div></div>
            <div><div style={{ fontSize: 12.5, color: T.sub }}>Trả lại</div><div style={{ fontSize: 22, fontWeight: 800, color: T.gold }}>{fmtVND(traLai)}</div></div>
          </div>
          <Btn kind="gold" disabled={saving} onClick={luu}><Save size={16} /> {saving ? "Đang lưu..." : "Lưu phiếu"}</Btn>
        </div>
      </Card>

      {/* Phiếu y lệnh gần đây — lọc theo thời gian hoặc tìm theo người thanh toán */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.line}`, fontWeight: 800, color: T.ink, fontSize: 15 }}>Phiếu y lệnh gần đây</div>
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.line}`, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ display: "block" }}>
            <span style={{ fontSize: 12, color: T.sub, fontWeight: 600, display: "block", marginBottom: 4 }}>Từ (ngày giờ)</span>
            <input type="datetime-local" style={{ ...inp, padding: "9px 11px" }} value={fTu} onChange={(e) => setFTu(e.target.value)} />
          </label>
          <label style={{ display: "block" }}>
            <span style={{ fontSize: 12, color: T.sub, fontWeight: 600, display: "block", marginBottom: 4 }}>Đến (ngày giờ)</span>
            <input type="datetime-local" style={{ ...inp, padding: "9px 11px" }} value={fDen} onChange={(e) => setFDen(e.target.value)} />
          </label>
          <label style={{ display: "block", flex: 1, minWidth: 180 }}>
            <span style={{ fontSize: 12, color: T.sub, fontWeight: 600, display: "block", marginBottom: 4 }}>Tìm (bệnh nhân, mã phiếu, bác sĩ)</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8, border: `1.5px solid ${T.line}`, borderRadius: 9, padding: "0 11px" }}>
              <Search size={16} color={T.sub} />
              <input value={fQ} onChange={(e) => setFQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && loadList()} placeholder="VD: Nguyễn / YL123 / BS Lan" style={{ flex: 1, border: "none", outline: "none", padding: "9px 0", fontSize: 13.5, fontFamily: "inherit", background: "transparent" }} />
            </div>
          </label>
          <Btn kind="ghost" onClick={() => loadList()}><Filter size={15} /> Lọc</Btn>
          <Btn kind="ghost" onClick={xoaLoc}><RotateCcw size={15} /> Xóa lọc</Btn>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr 0.9fr 0.8fr 1.4fr 1fr 1.6fr", gap: 12, padding: "12px 20px", background: T.bg, fontSize: 12, fontWeight: 800, color: T.sub, textTransform: "uppercase", letterSpacing: .4 }} className="tableHead">
          <span>Mã phiếu</span><span>Bệnh nhân</span><span>Tổng tiền</span><span>Còn lại</span><span>Người lập / thu</span><span>Trạng thái</span><span>Thời gian & thao tác</span>
        </div>
        {list.length === 0 ? (
          <div style={{ padding: 36, textAlign: "center", color: T.sub }}>Không có phiếu nào khớp bộ lọc.</div>
        ) : list.map((y, i) => { const st = TT[y.trang_thai] || TT.chua_nop; return (
          <div key={y.id} style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr 0.9fr 0.8fr 1.4fr 1fr 1.6fr", gap: 12, padding: "12px 20px", borderBottom: i < list.length - 1 ? `1px solid ${T.line}55` : "none", alignItems: "center", fontSize: 13.5 }} className="tableRow">
            <span style={{ fontWeight: 700, color: T.ink }}>{y.ma_phieu}</span>
            <span>
              <div style={{ color: T.ink, fontWeight: 700 }}>{y.ten_bn || "—"}</div>
              {y.ma_benh_nhan && <div style={{ fontSize: 12, color: T.sub }}>{y.ma_benh_nhan}</div>}
            </span>
            <span style={{ fontWeight: 800, color: T.ink }}>{fmtVND(y.tong_tien)}</span>
            <span style={{ fontWeight: 700, color: y.con_lai > 0 ? "#C0392B" : T.mint }}>{fmtVND(y.con_lai)}</span>
            <span style={{ fontSize: 12.5, color: T.sub, lineHeight: 1.5 }}>
              <div>Lập: <b style={{ color: T.ink }}>{y.nguoi_tao || "—"}</b></div>
              <div>Thu: <b style={{ color: T.ink }}>{y.nguoi_thu || "—"}</b></div>
            </span>
            <span><Pill tone={st.tone} soft={st.soft}>{st.label}</Pill></span>
            <span>
              <div style={{ color: T.sub, marginBottom: 6 }}>{fmtNgay(y.ngay_tao)}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <Btn kind="ghost" size="sm" onClick={() => inPhieu(y)}><Receipt size={14} /> In phiếu</Btn>
                {y.trang_thai !== "da_du" && <Btn kind="gold" size="sm" onClick={() => { setPayFor(y); setPaySo(String(y.con_lai || "")); }}><CreditCard size={14} /> Thu thêm</Btn>}
              </div>
            </span>
          </div>
        ); })}
      </Card>

      {/* Modal xác nhận thu thêm tiền */}
      {payFor && (
        <div onClick={() => setPayFor(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", display: "grid", placeItems: "center", zIndex: 60, padding: 16 }}>
          <Card onClick={(e) => e.stopPropagation()} style={{ padding: 24, maxWidth: 420, width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ fontWeight: 800, color: T.ink, fontSize: 17, display: "flex", alignItems: "center", gap: 8 }}><CreditCard size={19} color={T.gold} /> Thu thêm viện phí</div>
              <button onClick={() => setPayFor(null)} style={{ background: "none", border: "none", cursor: "pointer", color: T.sub }}><X size={20} /></button>
            </div>
            <div style={{ background: T.bg, borderRadius: 12, padding: "12px 14px", marginBottom: 16, fontSize: 13.5 }}>
              <div style={{ color: T.sub }}>Phiếu <b style={{ color: T.ink }}>{payFor.ma_phieu}</b> · {payFor.ten_bn || "—"}</div>
              <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between" }}><span style={{ color: T.sub }}>Tổng / đã nộp</span><span style={{ color: T.ink }}>{fmtVND(payFor.tong_tien)} / {fmtVND(payFor.da_nop)}</span></div>
              <div style={{ marginTop: 4, display: "flex", justifyContent: "space-between" }}><span style={{ color: T.sub }}>Còn lại</span><b style={{ color: "#C0392B" }}>{fmtVND(payFor.con_lai)}</b></div>
            </div>
            <label style={{ display: "block", marginBottom: 18 }}>
              <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 600, display: "block", marginBottom: 5 }}>Số tiền thu lần này (đ)</span>
              <input autoFocus type="number" min="1" style={{ ...inp, padding: "11px 13px", fontSize: 15 }} value={paySo} onChange={(e) => setPaySo(e.target.value)} onKeyDown={(e) => e.key === "Enter" && xacNhanThu()} />
            </label>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <Btn kind="ghost" onClick={() => setPayFor(null)}>Hủy</Btn>
              <Btn kind="mint" disabled={paying} onClick={xacNhanThu}><CheckCircle2 size={16} /> {paying ? "Đang thu..." : "Xác nhận thu"}</Btn>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
