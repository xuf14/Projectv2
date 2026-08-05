import React, { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, X, CalendarDays } from "lucide-react";
import { T, api, Btn, Card } from "./shared";

// ============================================================================
//  LỊCH DOANH THU — lịch tháng tô màu những ngày CÓ TIỀN THU, đậm dần theo số
//  tiền, dùng chung cho "Sổ thu trong ngày" (lễ tân) và "Thanh toán" (admin).
//  Nguồn dữ liệu: GET /reception/payments/monthly?thang=YYYY-MM
//  (chỉ tính hóa đơn đã thanh toán, gom theo ngày thu tiền).
// ============================================================================

const THU = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
export const ymdLocal = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const fmtVND = (n) => (Number(n) || 0).toLocaleString("vi-VN") + "đ";

// Rút gọn tiền để vừa ô lịch: 1.350.000 → "1,35tr" · 500.000 → "500N"
export function tienGon(n) {
  const v = Number(n) || 0;
  if (v >= 1e9) return (v / 1e9).toFixed(1).replace(".", ",") + "tỷ";
  if (v >= 1e6) return (v / 1e6).toFixed(v >= 1e7 ? 0 : 2).replace(".", ",").replace(/,00$/, "") + "tr";
  if (v >= 1000) return Math.round(v / 1000) + "N";
  return String(v);
}

// 3 mức đậm nhạt theo tỷ lệ với ngày thu cao nhất trong tháng
const MUC = [
  { nen: "#E6F5EF", chu: "#2F8F73", vien: "#BFE6D7" },
  { nen: "#BFE6D7", chu: "#1E7A5F", vien: "#8FD3BB" },
  { nen: "#7ACBAD", chu: "#0F5C46", vien: "#4FB894" },
];
const mucDo = (tien, max) => (max <= 0 ? 0 : tien >= max * 0.66 ? 2 : tien >= max * 0.33 ? 1 : 0);

// Lưới ngày của một tháng, tuần bắt đầu từ Thứ 2 (ô rỗng = null)
function luoiThang(thang) {
  const [nam, thg] = thang.split("-").map(Number);
  const dau = new Date(nam, thg - 1, 1);
  const soNgay = new Date(nam, thg, 0).getDate();
  const lech = (dau.getDay() + 6) % 7;
  const o = Array(lech).fill(null);
  for (let i = 1; i <= soNgay; i++) o.push(`${thang}-${String(i).padStart(2, "0")}`);
  while (o.length % 7 !== 0) o.push(null);
  return o;
}

const doiThang = (thang, buoc) => {
  const [nam, thg] = thang.split("-").map(Number);
  const d = new Date(nam, thg - 1 + buoc, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/**
 * Lịch tháng có tô màu ngày có doanh thu.
 * @param ngayChon  YYYY-MM-DD đang chọn
 * @param onChon    (ngay) => void
 * @param lamMoi    đổi giá trị này để buộc nạp lại dữ liệu tháng
 */
export default function LichDoanhThu({ ngayChon, onChon, lamMoi }) {
  const homNay = ymdLocal(new Date());
  const [thang, setThang] = useState(() => (ngayChon || homNay).slice(0, 7));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let huy = false;
    setLoading(true); setErr(null);
    api.monthlyRevenue(thang)
      .then((r) => { if (!huy) setData(r); })
      .catch((e) => { if (!huy) { setErr(e.message); setData(null); } })
      .finally(() => { if (!huy) setLoading(false); });
    return () => { huy = true; };
  }, [thang, lamMoi]);

  // Nhảy lịch sang tháng của ngày được chọn từ bên ngoài
  useEffect(() => { if (ngayChon) setThang(ngayChon.slice(0, 7)); }, [ngayChon]);

  const theoNgay = useMemo(() => {
    const m = {};
    for (const d of (data && data.ngay) || []) m[d.ngay] = d;
    return m;
  }, [data]);
  const max = useMemo(
    () => ((data && data.ngay) || []).reduce((s, d) => Math.max(s, d.tong_tien), 0),
    [data],
  );
  const o = luoiThang(thang);
  const [nam, thg] = thang.split("-");

  return (
    <div style={{ minWidth: 300 }}>
      {/* Điều hướng tháng */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <button type="button" onClick={() => setThang(doiThang(thang, -1))} style={navBtn} title="Tháng trước">
          <ChevronLeft size={17} color={T.sub} />
        </button>
        <div style={{ flex: 1, textAlign: "center", fontWeight: 800, color: T.ink, fontSize: 15.5 }}>
          Tháng {Number(thg)}/{nam}
        </div>
        <button type="button" onClick={() => setThang(doiThang(thang, 1))} style={navBtn} title="Tháng sau">
          <ChevronRight size={17} color={T.sub} />
        </button>
        <Btn kind="ghost" size="sm" onClick={() => { setThang(homNay.slice(0, 7)); onChon && onChon(homNay); }}>Hôm nay</Btn>
      </div>

      {err && <div style={{ background: "#FDECEA", color: "#C0392B", fontSize: 13, padding: "9px 12px", borderRadius: 10, marginBottom: 10 }}>{err}</div>}

      {/* Tên thứ */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 6 }}>
        {THU.map((t) => (
          <div key={t} style={{ textAlign: "center", fontSize: 11.5, fontWeight: 800, color: T.sub, letterSpacing: .3 }}>{t}</div>
        ))}
      </div>

      {/* Lưới ngày */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, opacity: loading ? .55 : 1 }}>
        {o.map((ngay, i) => {
          if (!ngay) return <div key={`x${i}`} />;
          const d = theoNgay[ngay];
          const coThu = !!d;
          const m = coThu ? MUC[mucDo(d.tong_tien, max)] : null;
          const chon = ngay === ngayChon;
          const nay = ngay === homNay;
          return (
            <button key={ngay} type="button" onClick={() => onChon && onChon(ngay)}
              title={coThu ? `${fmtVND(d.tong_tien)} · ${d.so_hoa_don} hóa đơn` : "Không có khoản thu"}
              style={{
                padding: "6px 2px 5px", borderRadius: 11, cursor: "pointer", fontFamily: "inherit",
                background: coThu ? m.nen : T.surface,
                border: chon ? `2px solid ${T.peach}` : `1.5px solid ${coThu ? m.vien : T.line}`,
                boxShadow: nay && !chon ? `0 0 0 2px ${T.goldSoft}` : "none",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 1, minHeight: 46,
              }}>
              <span style={{ fontSize: 13.5, fontWeight: coThu ? 800 : 600, color: coThu ? m.chu : T.sub }}>
                {Number(ngay.slice(8))}
              </span>
              {coThu && <span style={{ fontSize: 9.5, fontWeight: 700, color: m.chu, lineHeight: 1 }}>{tienGon(d.tong_tien)}</span>}
            </button>
          );
        })}
      </div>

      {/* Chú giải + tổng tháng */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: T.sub }}>Ít</span>
        {MUC.map((m, i) => <span key={i} style={{ width: 16, height: 12, borderRadius: 4, background: m.nen, border: `1px solid ${m.vien}` }} />)}
        <span style={{ fontSize: 12, color: T.sub }}>Nhiều</span>
        <span style={{ flex: 1 }} />
        {data && (
          <span style={{ fontSize: 12.5, color: T.sub }}>
            {data.so_ngay_co_thu} ngày có thu · <b style={{ color: T.mint }}>{fmtVND(data.tong_tien)}</b>
          </span>
        )}
      </div>
    </div>
  );
}

const navBtn = {
  width: 30, height: 30, borderRadius: 9, border: `1.5px solid ${T.line}`, background: T.surface,
  cursor: "pointer", display: "grid", placeItems: "center",
};

// Cửa sổ popup bọc lịch — dùng ở cổng quản trị viên (chọn ngày rồi mới xem hóa đơn)
export function PopupLichDoanhThu({ ngayChon, onChon, onClose, tieuDe = "Chọn ngày xem doanh thu" }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "grid", placeItems: "center", zIndex: 70, padding: 16 }}>
      <Card onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480, width: "100%", padding: 0 }}>
        <div style={{ padding: "15px 18px", borderBottom: `1px solid ${T.line}`, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 34, height: 34, borderRadius: 11, background: T.mintSoft, color: T.mint, display: "grid", placeItems: "center" }}><CalendarDays size={17} /></span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15.5, fontWeight: 800, color: T.ink }}>{tieuDe}</div>
            <div style={{ fontSize: 12.5, color: T.sub, marginTop: 1 }}>Ô được tô màu là ngày có tiền thu — bấm để xem danh sách bệnh nhân đã thanh toán.</div>
          </div>
          <Btn kind="ghost" size="sm" onClick={onClose}><X size={16} /></Btn>
        </div>
        <div style={{ padding: 18 }}>
          <LichDoanhThu ngayChon={ngayChon} onChon={(ngay) => { onChon(ngay); onClose(); }} />
        </div>
      </Card>
    </div>
  );
}

// Nút hiển thị ngày đang chọn (dùng để mở popup / mở lịch)
export function NutNgay({ ngay, onClick, nhan = "Ngày xem" }) {
  return (
    <button type="button" onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 10, border: `1.5px solid ${T.line}`, borderRadius: 13,
      padding: "9px 14px", background: T.surface, cursor: "pointer", fontFamily: "inherit", textAlign: "left",
    }}>
      <CalendarDays size={18} color={T.sub} />
      <span>
        <span style={{ display: "block", fontSize: 11.5, color: T.sub, fontWeight: 700 }}>{nhan}</span>
        <span style={{ display: "block", fontSize: 15, fontWeight: 800, color: T.ink }}>
          {ngay ? ngay.split("-").reverse().join("/") : "— Chọn ngày —"}
        </span>
      </span>
    </button>
  );
}
