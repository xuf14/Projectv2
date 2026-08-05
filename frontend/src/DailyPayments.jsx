import React, { useState, useEffect } from "react";
import { FileSpreadsheet, User, Users, Receipt, CheckCircle2, ChevronDown, ChevronUp, X } from "lucide-react";
import { T, store, api, useNav, Btn, Card, Pill, PageTitle } from "./shared";
import LichDoanhThu, { NutNgay } from "./lichdoanhthu";

// ============================================================================
//  SỔ THU TRONG NGÀY — các thanh toán ĐÃ HOÀN THÀNH trong một ngày.
//  Dữ liệu lưu sẵn trong bảng thanh_toan (trạng thái đã thanh toán); trang này
//  truy vấn theo ngày thu tiền (GET /reception/payments/daily) và trích xuất
//  ra Excel bằng một nút (GET /reception/payments/daily/export).
// ============================================================================

const fmtVND = (n) => (Number(n) || 0).toLocaleString("vi-VN") + "đ";
const ymdLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fmtGio = (t) => { const d = new Date(t); return isNaN(d) ? "" : d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }); };
const fmtNgayGio = (t) => { const d = new Date(t); return isNaN(d) ? "" : d.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); };

export default function DailyPayments() {
  const { online } = useNav();
  const live = online && !!store.token;
  const [ngay, setNgay] = useState(() => ymdLocal(new Date()));
  const [moLich, setMoLich] = useState(true);   // lịch tô màu doanh thu, mở sẵn
  const [data, setData] = useState(null);
  const [theoBn, setTheoBn] = useState(null);     // doanh thu gom theo bệnh nhân
  const [cach, setCach] = useState("benh_nhan");  // benh_nhan | hoa_don
  const [chiTiet, setChiTiet] = useState(null);   // bệnh nhân đang xem chi tiết
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [exporting, setExporting] = useState(false);

  const load = () => {
    if (!live) return;
    setLoading(true); setErr(null);
    Promise.all([api.dailyPayments(ngay), api.dailyByPatient(ngay)])
      .then(([hd, bn]) => { setData(hd); setTheoBn(bn); })
      .catch((e) => { setErr(e.message); setData(null); setTheoBn(null); })
      .finally(() => setLoading(false));
  };
  useEffect(load, [live, ngay]);

  // Trích xuất sổ thu ra file Excel (CSV UTF-8) từ database
  const xuatExcel = async () => {
    setExporting(true); setErr(null);
    try {
      const blob = await api.exportDailyPayments(ngay);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `so-thu-${ngay}.csv`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (e) { setErr(e.message); }
    finally { setExporting(false); }
  };

  if (!live) {
    return (
      <div>
        <PageTitle title="Sổ thu trong ngày" sub="Các thanh toán đã hoàn thành trong ngày." />
        <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>Cần kết nối backend để xem sổ thu.</Card>
      </div>
    );
  }

  const list = (data && data.danh_sach) || [];
  return (
    <div>
      <PageTitle title="Sổ thu trong ngày" sub="Các hóa đơn dịch vụ đã thu, lưu trong hệ thống — trích xuất ra Excel khi cần."
        action={<Btn kind="mint" disabled={exporting || list.length === 0} onClick={xuatExcel}><FileSpreadsheet size={16} /> {exporting ? "Đang xuất..." : "Xuất Excel"}</Btn>} />

      <Card style={{ padding: 18, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          <NutNgay ngay={ngay} onClick={() => setMoLich((v) => !v)} />
          <Btn kind="ghost" size="sm" onClick={() => setMoLich((v) => !v)}>
            {moLich ? <ChevronUp size={15} /> : <ChevronDown size={15} />} {moLich ? "Thu lịch" : "Mở lịch"}
          </Btn>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", gap: 24 }}>
            <div><div style={{ fontSize: 12.5, color: T.sub }}>Bệnh nhân</div><div style={{ fontSize: 22, fontWeight: 800, color: T.lav }}>{theoBn ? theoBn.so_benh_nhan : "—"}</div></div>
            <div><div style={{ fontSize: 12.5, color: T.sub }}>Số phiếu thu</div><div style={{ fontSize: 22, fontWeight: 800, color: T.ink }}>{data ? data.so_hoa_don : "—"}</div></div>
            <div>
              <div style={{ fontSize: 12.5, color: T.sub }}>Tổng thu</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: T.mint }}>{data ? fmtVND(data.tong_tien) : "—"}</div>
              {/* Tách nguồn để đối chiếu: hóa đơn dịch vụ và phiếu y lệnh */}
              {data && data.theo_nguon && (
                <div style={{ fontSize: 11.5, color: T.sub, marginTop: 2 }}>
                  Hóa đơn {fmtVND(data.theo_nguon.hoa_don.tong_tien)} · Y lệnh {fmtVND(data.theo_nguon.y_lenh.tong_tien)}
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Lịch tô màu ngày có doanh thu — bấm vào ngày để xem sổ thu của ngày đó */}
        {moLich && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${T.line}`, maxWidth: 430 }}>
            <LichDoanhThu ngayChon={ngay} onChon={setNgay} />
          </div>
        )}
      </Card>

      {err && <Card style={{ padding: 16, marginBottom: 14, background: "#FDECEA", border: "none", color: "#C0392B", fontSize: 14 }}>{err}</Card>}
      {loading && <div style={{ color: T.sub, fontSize: 14, marginBottom: 12 }}>Đang tải sổ thu...</div>}
      {!loading && list.length === 0 && !err && <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>Chưa có khoản thu nào trong ngày này.</Card>}

      {/* Chọn cách xem: gom theo bệnh nhân (doanh thu từng người) hoặc liệt kê hóa đơn */}
      {list.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          <Btn kind={cach === "benh_nhan" ? "primary" : "ghost"} size="sm" onClick={() => setCach("benh_nhan")}>
            <Users size={15} /> Doanh thu theo bệnh nhân
          </Btn>
          <Btn kind={cach === "hoa_don" ? "primary" : "ghost"} size="sm" onClick={() => setCach("hoa_don")}>
            <Receipt size={15} /> Danh sách hóa đơn
          </Btn>
        </div>
      )}

      {cach === "benh_nhan" && theoBn && theoBn.benh_nhan.length > 0 && (
        <div style={{ display: "grid", gap: 12 }}>
          {theoBn.benh_nhan.map((b, i) => (
            <ThePatientRevenue key={b.ho_so_id || `bn${i}`} bn={b} thuHang={i + 1}
              tyLe={theoBn.tong_tien ? Math.round((b.tong_tien / theoBn.tong_tien) * 100) : 0}
              onChiTiet={() => setChiTiet(b)} />
          ))}
          <Card style={{ padding: "16px 20px", background: T.mintSoft, border: "none", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <span style={{ fontWeight: 700, color: T.ink, display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle2 size={16} color={T.mint} /> {theoBn.so_benh_nhan} bệnh nhân · {theoBn.so_hoa_don} hóa đơn · ngày {ngay.split("-").reverse().join("/")}
            </span>
            <span style={{ fontWeight: 800, color: T.mint, fontSize: 20 }}>{fmtVND(theoBn.tong_tien)}</span>
          </Card>
        </div>
      )}

      {cach === "hoa_don" && list.length > 0 && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1.5fr 1.4fr 1.8fr 1fr 0.8fr", gap: 12, padding: "14px 20px", borderBottom: `1px solid ${T.line}`, background: T.bg, fontSize: 12.5, fontWeight: 800, color: T.sub, textTransform: "uppercase", letterSpacing: .5 }} className="tableHead">
            <span>Mã HĐ</span><span>Bệnh nhân</span><span>BS khám</span><span>Dịch vụ</span><span>Thành tiền</span><span>Giờ thu</span>
          </div>
          {list.map((t, i) => (
            <div key={t.id} style={{ display: "grid", gridTemplateColumns: "1.1fr 1.5fr 1.4fr 1.8fr 1fr 0.8fr", gap: 12, padding: "14px 20px", borderBottom: i < list.length - 1 ? `1px solid ${T.line}55` : "none", alignItems: "center", fontSize: 14 }} className="tableRow">
              <span style={{ fontWeight: 700, color: T.ink }}>
                {t.ma_thanh_toan}
                {t.nguon === "y_lenh" && <span style={{ display: "block", fontSize: 11, fontWeight: 700, color: T.gold }}>Y lệnh</span>}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 30, height: 30, borderRadius: 9, background: T.mintSoft, color: T.mint, display: "grid", placeItems: "center", flexShrink: 0 }}><User size={15} /></span>
                <span style={{ color: T.ink }}>{t.lich_hen ? t.lich_hen.benh_nhan : "—"}</span>
              </div>
              <span style={{ color: T.ink, fontSize: 13 }}>{t.lich_hen && t.lich_hen.bac_si ? t.lich_hen.bac_si.ho_ten : "—"}</span>
              <span style={{ color: T.sub, fontSize: 13 }}>{t.chi_tiet.map((c) => `${c.ten_dich_vu}${c.so_luong > 1 ? ` ×${c.so_luong}` : ""}`).join(", ")}</span>
              <span style={{ fontWeight: 800, color: T.ink }}>{fmtVND(t.tong_tien)}</span>
              <span style={{ color: T.sub }} title={fmtNgayGio(t.ngay_thanh_toan)}>{fmtGio(t.ngay_thanh_toan)}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", background: T.mintSoft }}>
            <span style={{ fontWeight: 700, color: T.ink, display: "flex", alignItems: "center", gap: 8 }}><CheckCircle2 size={16} color={T.mint} /> Tổng thu ngày {ngay.split("-").reverse().join("/")}</span>
            <span style={{ fontWeight: 800, color: T.mint, fontSize: 20 }}>{fmtVND(data ? data.tong_tien : 0)}</span>
          </div>
        </Card>
      )}

      {chiTiet && <PopupChiTietBenhNhan bn={chiTiet} ngay={ngay} onClose={() => setChiTiet(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
//  Một bệnh nhân trong sổ thu: tổng tiền, tỷ trọng, dịch vụ đã dùng (gộp trùng)
// ---------------------------------------------------------------------------
function ThePatientRevenue({ bn, thuHang, tyLe, onChiTiet }) {
  return (
    <Card style={{ padding: 18 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
        <span style={{ width: 44, height: 44, borderRadius: 13, background: T.mintSoft, color: T.mint, display: "grid", placeItems: "center", fontWeight: 800, fontSize: 15, flexShrink: 0 }}>
          #{thuHang}
        </span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontWeight: 800, color: T.ink, fontSize: 15.5 }}>{bn.ho_ten}</span>
            {bn.ma_benh_nhan && <Pill tone={T.sky} soft={T.skySoft}>{bn.ma_benh_nhan}</Pill>}
            <Pill tone={T.lav} soft={T.lavSoft}>{bn.so_hoa_don} hóa đơn</Pill>
          </div>
          {/* Dịch vụ đã dùng trong ngày, gộp trùng và kèm thành tiền */}
          <div style={{ marginTop: 9, display: "grid", gap: 4 }}>
            {bn.dich_vu.map((d, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13.5, color: T.sub, maxWidth: 520 }}>
                <span>{d.ten_dich_vu}{d.so_luong > 1 ? ` × ${d.so_luong}` : ""}</span>
                <span style={{ color: T.ink, fontWeight: 600 }}>{fmtVND(d.thanh_tien)}</span>
              </div>
            ))}
          </div>
          {/* Tỷ trọng doanh thu của bệnh nhân trong tổng thu của ngày */}
          <div style={{ marginTop: 10, maxWidth: 520 }}>
            <div style={{ height: 6, borderRadius: 99, background: T.line, overflow: "hidden" }}>
              <div style={{ width: `${tyLe}%`, height: "100%", background: T.mint }} />
            </div>
            <div style={{ fontSize: 12, color: T.sub, marginTop: 4 }}>Chiếm {tyLe}% doanh thu trong ngày</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 21, fontWeight: 800, color: T.mint }}>{fmtVND(bn.tong_tien)}</div>
          <Btn kind="ghost" size="sm" style={{ marginTop: 8 }} onClick={onChiTiet}>Chi tiết →</Btn>
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
//  Popup chi tiết doanh thu của một bệnh nhân: từng hóa đơn trong ngày (đơn giá
//  × số lượng) và tổng đã thu lũy kế của bệnh nhân đó ở mọi ngày.
// ---------------------------------------------------------------------------
function PopupChiTietBenhNhan({ bn, ngay, onClose }) {
  const [luyKe, setLuyKe] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!bn.ho_so_id) return;
    let huy = false;
    api.patientRevenue(bn.ho_so_id)
      .then((r) => { if (!huy) setLuyKe(r); })
      .catch((e) => { if (!huy) setErr(e.message); });
    return () => { huy = true; };
  }, [bn.ho_so_id]);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "grid", placeItems: "center", zIndex: 70, padding: 16 }}>
      <Card onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640, width: "100%", maxHeight: "90vh", display: "flex", flexDirection: "column", padding: 0 }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.line}`, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 40, height: 40, borderRadius: 12, background: T.mintSoft, color: T.mint, display: "grid", placeItems: "center", flexShrink: 0 }}><User size={19} /></span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16.5, fontWeight: 800, color: T.ink }}>{bn.ho_ten}</div>
            <div style={{ fontSize: 12.5, color: T.sub, marginTop: 1 }}>
              {bn.ma_benh_nhan ? `${bn.ma_benh_nhan} · ` : ""}Doanh thu ngày {ngay.split("-").reverse().join("/")}
            </div>
          </div>
          <Btn kind="ghost" size="sm" onClick={onClose}><X size={16} /></Btn>
        </div>

        <div style={{ padding: 20, overflowY: "auto" }}>
          {/* Tổng trong ngày + lũy kế mọi ngày */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
            <div style={{ background: T.mintSoft, borderRadius: 13, padding: "12px 14px" }}>
              <div style={{ fontSize: 12.5, color: T.sub, fontWeight: 700 }}>Thu trong ngày</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: T.mint, marginTop: 2 }}>{fmtVND(bn.tong_tien)}</div>
              <div style={{ fontSize: 12, color: T.sub }}>{bn.so_hoa_don} hóa đơn</div>
            </div>
            <div style={{ background: T.lavSoft, borderRadius: 13, padding: "12px 14px" }}>
              <div style={{ fontSize: 12.5, color: T.sub, fontWeight: 700 }}>Lũy kế đã thu</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: T.lav, marginTop: 2 }}>
                {luyKe ? fmtVND(luyKe.tong_tien) : bn.ho_so_id ? "…" : "—"}
              </div>
              <div style={{ fontSize: 12, color: T.sub }}>
                {luyKe ? `${luyKe.so_hoa_don} hóa đơn từ trước tới nay` : bn.ho_so_id ? "Đang tải…" : "Hóa đơn chưa gắn hồ sơ"}
              </div>
            </div>
          </div>
          {err && <div style={{ background: "#FDECEA", color: "#C0392B", fontSize: 13, padding: "9px 12px", borderRadius: 10, marginBottom: 14 }}>{err}</div>}

          {/* Từng hóa đơn trong ngày */}
          <div style={{ fontSize: 13, fontWeight: 800, color: T.sub, textTransform: "uppercase", letterSpacing: .5, marginBottom: 10 }}>
            Hóa đơn trong ngày
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            {bn.hoa_don.map((h) => (
              <div key={h.id} style={{ border: `1px solid ${T.line}`, borderRadius: 14, padding: "13px 15px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ fontWeight: 800, color: T.ink, fontSize: 14.5 }}>{h.ma_thanh_toan}</span>
                  <span style={{ fontWeight: 800, color: T.ink }}>{fmtVND(h.tong_tien)}</span>
                </div>
                <div style={{ fontSize: 12.5, color: T.sub, marginTop: 3 }}>
                  {[h.ma_lich_hen, h.khoa, h.bac_si, h.ngay_thanh_toan ? `thu lúc ${fmtGio(h.ngay_thanh_toan)}` : null]
                    .filter(Boolean).join(" · ")}
                </div>
                <div style={{ marginTop: 9, display: "grid", gap: 4 }}>
                  {h.chi_tiet.map((c) => (
                    <div key={c.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13.5 }}>
                      <span style={{ color: T.sub }}>
                        {c.ten_dich_vu} <span style={{ fontSize: 12 }}>({fmtVND(c.don_gia)}{c.so_luong > 1 ? ` × ${c.so_luong}` : ""})</span>
                      </span>
                      <span style={{ color: T.ink, fontWeight: 600 }}>{fmtVND(c.thanh_tien)}</span>
                    </div>
                  ))}
                </div>
                {h.ghi_chu && <div style={{ fontSize: 12.5, color: T.sub, marginTop: 7, fontStyle: "italic" }}>Ghi chú: {h.ghi_chu}</div>}
                {h.nguoi_thu && <div style={{ fontSize: 12, color: T.sub, marginTop: 5 }}>Người thu: {h.nguoi_thu}</div>}
              </div>
            ))}
          </div>

          {/* Lịch sử các ngày đã thu khác của bệnh nhân */}
          {luyKe && luyKe.hoa_don.length > bn.hoa_don.length && (
            <>
              <div style={{ fontSize: 13, fontWeight: 800, color: T.sub, textTransform: "uppercase", letterSpacing: .5, margin: "20px 0 10px" }}>
                Các lần thu khác
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                {luyKe.hoa_don
                  .filter((h) => !bn.hoa_don.some((x) => x.id === h.id))
                  .map((h) => (
                    <div key={h.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13.5, padding: "8px 12px", background: T.bg, borderRadius: 10 }}>
                      <span style={{ color: T.sub }}>{h.ma_thanh_toan} · {fmtNgayGio(h.ngay_thanh_toan)}</span>
                      <span style={{ color: T.ink, fontWeight: 700 }}>{fmtVND(h.tong_tien)}</span>
                    </div>
                  ))}
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
