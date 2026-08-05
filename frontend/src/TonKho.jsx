import React, { useState, useEffect } from "react";
import {
  Package, Pill as PillIcon, Search, Plus, Minus, RotateCcw, X, ClipboardList,
  AlertTriangle, Wallet, Boxes, CheckCircle2,
} from "lucide-react";
import { T, store, api, useNav, Btn, Card, Pill, PageTitle, input } from "./shared";

// ============================================================================
//  TỒN KHO — tủ thuốc và tủ vật tư tiêu hao.
//  Số tồn bị trừ tự động khi lễ tân lưu phiếu y lệnh (POST /reception/y-lenh);
//  ở đây chỉ NHẬP KHO, KIỂM KÊ và xem tồn + tổng giá trị tồn.
//    GET  /kho/ton        (le_tan, admin)
//    POST /kho/nhap       (le_tan, admin)
//    POST /kho/dieu-chinh (admin)
//    GET  /kho/nhat-ky    (le_tan, admin)
// ============================================================================

const inp = { ...input, padding: "9px 11px", fontSize: 13.5, borderRadius: 9 };
const fmtVND = (n) => (Number(n) || 0).toLocaleString("vi-VN") + "đ";
const fmtSo = (n) => (Number(n) || 0).toLocaleString("vi-VN");
const fmtGio = (t) => { const d = new Date(t); return isNaN(d) ? "" : d.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); };

const TU = {
  thuoc: { ten: "Tủ thuốc", icon: PillIcon, tone: T.peach, soft: T.peachSoft },
  vat_tu: { ten: "Tủ vật tư tiêu hao", icon: Package, tone: T.sky, soft: T.skySoft },
};
const CANH_BAO = {
  am_kho: { l: "Âm kho", tone: "#C0392B", soft: "#FDECEA" },
  het: { l: "Đã hết", tone: "#C0392B", soft: "#FDECEA" },
  sap_het: { l: "Sắp hết", tone: "#B7791F", soft: T.goldSoft },
};
const GD = {
  nhap: { l: "Nhập kho", tone: T.mint, soft: T.mintSoft },
  xuat: { l: "Xuất theo phiếu", tone: "#C0392B", soft: "#FDECEA" },
  dieu_chinh: { l: "Kiểm kê", tone: T.lav, soft: T.lavSoft },
  sua_gia: { l: "Sửa đơn giá", tone: T.gold, soft: T.goldSoft },
};

const th = { padding: "10px 8px", fontSize: 11.5, fontWeight: 800, color: T.sub, textTransform: "uppercase", letterSpacing: .4, textAlign: "left" };
const td = { padding: "7px 8px", fontSize: 13.5, color: T.ink, verticalAlign: "middle" };

// Thẻ số liệu tổng hợp
function TheSo({ icon: Icon, nhan, so, phu, tone, soft }) {
  return (
    <Card style={{ padding: 16, display: "flex", alignItems: "center", gap: 13, flex: "1 1 200px" }}>
      <span style={{ width: 42, height: 42, borderRadius: 13, background: soft, color: tone, display: "grid", placeItems: "center", flexShrink: 0 }}>
        <Icon size={20} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, color: T.sub, fontWeight: 700 }}>{nhan}</div>
        <div style={{ fontSize: 19, fontWeight: 800, color: tone, lineHeight: 1.25 }}>{so}</div>
        {phu && <div style={{ fontSize: 11.5, color: T.sub, marginTop: 1 }}>{phu}</div>}
      </div>
    </Card>
  );
}

// Đơn giá kho là quyền của quản trị viên; lễ tân chỉ nhập số lượng.
// Đây chỉ là phản ánh lại quy tắc — chốt chặn thật nằm ở backend.
const laAdmin = () => ((store.user && store.user.vai_tro) || "") === "admin";

// Cửa sổ nhập kho: chọn sẵn một mặt hàng hoặc nhập nhiều dòng cùng lúc.
// Lễ tân chỉ thấy cột số lượng; cột đơn giá dành riêng cho quản trị viên.
function PopupNhapKho({ banDau, onClose, onXong }) {
  const suaGiaDuoc = laAdmin();
  // banDau: một mặt hàng hoặc cả danh sách đã tick ở bảng tồn kho
  const [dong, setDong] = useState(() => {
    const ds0 = !banDau ? [] : Array.isArray(banDau) ? banDau : [banDau];
    return ds0.map((m) => ({ loai: m.loai, ma: m.ma, ten: m.ten, dvt: m.dvt, so_luong: "", don_gia: m.don_gia || "" }));
  });
  // Điền nhanh cùng một số lượng cho mọi dòng — nhập hàng loạt đỡ gõ lại
  const [slChung, setSlChung] = useState("");
  const [ghiChu, setGhiChu] = useState("");
  const [tim, setTim] = useState("");
  const [ds, setDs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loi, setLoi] = useState(null);

  useEffect(() => {
    let alive = true;
    api.khoTon({ q: tim.trim() })
      .then((r) => { if (alive) setDs((r.items || []).slice(0, 40)); })
      .catch((e) => { if (alive) setLoi(e.message); });
    return () => { alive = false; };
  }, [tim]);

  const them = (m) => setDong((cu) => (
    cu.some((d) => d.loai === m.loai && d.ma === m.ma)
      ? cu
      : [...cu, { loai: m.loai, ma: m.ma, ten: m.ten, dvt: m.dvt, so_luong: "", don_gia: m.don_gia || "" }]
  ));
  const sua = (i, k, v) => setDong((cu) => cu.map((d, idx) => (idx === i ? { ...d, [k]: v } : d)));
  const xoa = (i) => setDong((cu) => cu.filter((_, idx) => idx !== i));

  const luu = async () => {
    setLoi(null);
    if (!dong.length) { setLoi("Chọn ít nhất một mặt hàng để nhập kho."); return; }
    if (dong.some((d) => !(Number(d.so_luong) > 0))) { setLoi("Mỗi dòng phải có số lượng nhập lớn hơn 0."); return; }
    setBusy(true);
    try {
      const r = await api.khoNhap({
        ghi_chu: ghiChu || undefined,
        dong: dong.map((d) => ({
          loai: d.loai, ma: d.ma, so_luong: Number(d.so_luong),
          // Lễ tân không gửi đơn giá — backend từ chối nếu cố tình gửi
          don_gia: suaGiaDuoc && d.don_gia !== "" ? Number(d.don_gia) : undefined,
        })),
      });
      onXong(`Đã nhập kho ${r.so_dong} mặt hàng.`);
    } catch (e) { setLoi(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "grid", placeItems: "center", zIndex: 80, padding: 16 }}>
      <Card onClick={(e) => e.stopPropagation()} style={{ width: 880, maxWidth: "100%", maxHeight: "88vh", padding: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "15px 18px", borderBottom: `1px solid ${T.line}`, display: "flex", alignItems: "center", gap: 11 }}>
          <span style={{ width: 36, height: 36, borderRadius: 11, background: T.mintSoft, color: T.mint, display: "grid", placeItems: "center" }}><Plus size={18} /></span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15.5, fontWeight: 800, color: T.ink }}>Nhập kho</div>
            <div style={{ fontSize: 12.5, color: T.sub, marginTop: 1 }}>
              {suaGiaDuoc
                ? "Cộng số lượng vào tủ thuốc / tủ vật tư. Để trống đơn giá nếu không đổi giá hiện tại."
                : "Cộng số lượng vào tủ thuốc / tủ vật tư. Đơn giá kho do quản trị viên đặt."}
            </div>
          </div>
          <Btn kind="ghost" size="sm" onClick={onClose}><X size={16} /></Btn>
        </div>

        <div style={{ padding: 18, overflowY: "auto", display: "grid", gap: 14 }}>
          {loi && <Card style={{ padding: 13, background: "#FDECEA", border: "none", color: "#C0392B", fontSize: 13.5 }}>{loi}</Card>}

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 9, border: `1.5px solid ${T.line}`, borderRadius: 12, padding: "0 12px", marginBottom: 8 }}>
              <Search size={16} color={T.sub} />
              <input value={tim} onChange={(e) => setTim(e.target.value)} placeholder="Tìm mặt hàng theo tên hoặc mã để thêm vào phiếu nhập..."
                style={{ flex: 1, border: "none", outline: "none", padding: "10px 0", fontSize: 14, fontFamily: "inherit", background: "transparent" }} />
            </div>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap", maxHeight: 96, overflowY: "auto" }}>
              {ds.length === 0 && <span style={{ fontSize: 13, color: T.sub }}>Không có mặt hàng phù hợp.</span>}
              {ds.map((m) => (
                <button key={`${m.loai}:${m.ma}`} type="button" onClick={() => them(m)} title={`Thêm ${m.ten} vào phiếu nhập`}
                  style={{
                    padding: "6px 11px", borderRadius: 999, cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 700,
                    border: `1.5px solid ${TU[m.loai].tone}`, background: TU[m.loai].soft, color: TU[m.loai].tone,
                  }}>
                  {m.ten} <span style={{ opacity: .75 }}>· tồn {fmtSo(m.so_luong)}</span>
                </button>
              ))}
            </div>
          </div>

          {dong.length === 0 ? (
            <div style={{ padding: 26, textAlign: "center", color: T.sub, fontSize: 13.5, border: `1.5px dashed ${T.line}`, borderRadius: 12 }}>
              Chưa chọn mặt hàng nào. Bấm vào mặt hàng ở trên để thêm dòng nhập.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              {dong.length > 1 && (
                <div style={{ display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
                  <span style={{ fontSize: 13, color: T.sub, fontWeight: 700 }}>{dong.length} mặt hàng · điền nhanh số lượng:</span>
                  <input style={{ ...inp, width: 110 }} type="number" min="0" step="any" value={slChung}
                    onChange={(e) => setSlChung(e.target.value)} placeholder="VD: 50" />
                  <Btn kind="ghost" size="sm" disabled={!(Number(slChung) > 0)}
                    onClick={() => setDong((cu) => cu.map((d) => ({ ...d, so_luong: slChung })))}>
                    Áp cho tất cả
                  </Btn>
                </div>
              )}
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
                <thead><tr style={{ borderBottom: `1px solid ${T.line}` }}>
                  <th style={{ ...th, minWidth: 200 }}>Mặt hàng</th>
                  <th style={{ ...th, width: 90 }}>Tủ</th>
                  <th style={{ ...th, width: 110 }}>SL nhập</th>
                  {suaGiaDuoc && <th style={{ ...th, width: 130 }}>Đơn giá kho (đ)</th>}
                  <th style={{ ...th, width: 36 }}></th>
                </tr></thead>
                <tbody>
                  {dong.map((d, i) => (
                    <tr key={`${d.loai}:${d.ma}`} style={{ borderBottom: `1px solid ${T.line}55` }}>
                      <td style={td}>
                        <div style={{ fontWeight: 700 }}>{d.ten}</div>
                        <div style={{ fontSize: 12, color: T.sub }}>{d.ma}{d.dvt ? ` · ${d.dvt}` : ""}</div>
                      </td>
                      <td style={td}><Pill tone={TU[d.loai].tone} soft={TU[d.loai].soft}>{d.loai === "thuoc" ? "Thuốc" : "Vật tư"}</Pill></td>
                      <td style={td}><input style={inp} type="number" min="0" step="any" value={d.so_luong} onChange={(e) => sua(i, "so_luong", e.target.value)} /></td>
                      {suaGiaDuoc && (
                        <td style={td}><input style={inp} type="number" min="0" value={d.don_gia} onChange={(e) => sua(i, "don_gia", e.target.value)} placeholder="Giữ nguyên" /></td>
                      )}
                      <td style={td}>
                        <button onClick={() => xoa(i)} title="Bỏ dòng" style={{ background: "none", border: "none", cursor: "pointer", color: "#C0392B", padding: 4 }}><X size={16} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <label style={{ display: "block" }}>
            <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 700 }}>Ghi chú phiếu nhập</span>
            <input style={{ ...inp, marginTop: 5 }} value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} placeholder="VD: Nhập từ kho dược ngày 02/08" />
          </label>
        </div>

        <div style={{ padding: "13px 18px", borderTop: `1px solid ${T.line}`, display: "flex", justifyContent: "flex-end", gap: 9 }}>
          <Btn kind="ghost" size="sm" onClick={onClose}>Hủy</Btn>
          <Btn kind="mint" size="sm" disabled={busy} onClick={luu}><CheckCircle2 size={15} /> {busy ? "Đang lưu..." : "Lưu phiếu nhập"}</Btn>
        </div>
      </Card>
    </div>
  );
}

// Cửa sổ sửa đơn giá kho — dùng khi nhập sai giá hoặc giá thuốc/vật tư thay đổi.
// Chỉ đổi giá, KHÔNG đụng số lượng tồn.
function PopupSuaGia({ mat, onClose, onXong }) {
  const [gia, setGia] = useState(String(mat.don_gia || ""));
  const [lyDo, setLyDo] = useState("");
  const [busy, setBusy] = useState(false);
  const [loi, setLoi] = useState(null);

  const giaMoi = Number(gia) || 0;
  const luu = async () => {
    setLoi(null);
    if (!(giaMoi >= 0) || gia === "") { setLoi("Đơn giá phải là số không âm."); return; }
    setBusy(true);
    try {
      const r = await api.khoSuaGia({ loai: mat.loai, ma: mat.ma, don_gia: giaMoi, ly_do: lyDo.trim() || undefined });
      onXong(`Đã sửa đơn giá ${r.ten}: ${fmtVND(r.don_gia_cu)} → ${fmtVND(r.don_gia)}. Giá trị tồn còn ${fmtVND(r.gia_tri)}.`);
    } catch (e) { setLoi(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "grid", placeItems: "center", zIndex: 80, padding: 16 }}>
      <Card onClick={(e) => e.stopPropagation()} style={{ width: 460, maxWidth: "100%", padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span style={{ width: 34, height: 34, borderRadius: 11, background: T.goldSoft, color: T.gold, display: "grid", placeItems: "center" }}><Wallet size={17} /></span>
          <div style={{ flex: 1, fontSize: 15.5, fontWeight: 800, color: T.ink }}>Sửa đơn giá kho</div>
          <Btn kind="ghost" size="sm" onClick={onClose}><X size={16} /></Btn>
        </div>
        <div style={{ fontSize: 13.5, color: T.sub, marginBottom: 14 }}>
          {mat.ten} ({mat.ma}) — {TU[mat.loai].ten}. Đơn giá hiện tại: <b style={{ color: T.ink }}>{mat.don_gia > 0 ? fmtVND(mat.don_gia) : "chưa đặt"}</b>.
          Giá này dùng để tính giá trị tồn và điền sẵn vào dòng thuốc/vật tư trên phiếu viện phí.
        </div>
        {loi && <Card style={{ padding: 12, marginBottom: 12, background: "#FDECEA", border: "none", color: "#C0392B", fontSize: 13 }}>{loi}</Card>}
        <div style={{ display: "grid", gap: 11 }}>
          <label>
            <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 700 }}>Đơn giá mới (đ)</span>
            <input style={{ ...inp, marginTop: 5 }} type="number" min="0" value={gia} onChange={(e) => setGia(e.target.value)} autoFocus />
          </label>
          <label>
            <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 700 }}>Lý do (không bắt buộc)</span>
            <input style={{ ...inp, marginTop: 5 }} value={lyDo} onChange={(e) => setLyDo(e.target.value)} placeholder="VD: Nhập sai giá, nhà cung cấp tăng giá..." />
          </label>
        </div>
        <div style={{ fontSize: 12.5, color: T.sub, marginTop: 10 }}>
          Tồn {fmtSo(mat.so_luong)}{mat.dvt ? ` ${mat.dvt}` : ""} → giá trị tồn mới <b style={{ color: T.ink }}>{fmtVND(giaMoi * mat.so_luong)}</b>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 16 }}>
          <Btn kind="ghost" size="sm" onClick={onClose}>Hủy</Btn>
          <Btn kind="gold" size="sm" disabled={busy} onClick={luu}>{busy ? "Đang lưu..." : "Lưu đơn giá"}</Btn>
        </div>
      </Card>
    </div>
  );
}

// Cửa sổ kiểm kê: đặt lại số tồn thực tế đếm được (chỉ quản trị viên).
function PopupKiemKe({ mat, onClose, onXong }) {
  const [so, setSo] = useState(String(mat.so_luong));
  const [toiThieu, setToiThieu] = useState(String(mat.ton_toi_thieu));
  const [lyDo, setLyDo] = useState("");
  const [busy, setBusy] = useState(false);
  const [loi, setLoi] = useState(null);

  const luu = async () => {
    setLoi(null);
    if (!lyDo.trim()) { setLoi("Cần ghi lý do điều chỉnh để đối chiếu sau này."); return; }
    setBusy(true);
    try {
      const r = await api.khoDieuChinh({
        loai: mat.loai, ma: mat.ma, so_luong_moi: Number(so),
        ton_toi_thieu: toiThieu === "" ? undefined : Number(toiThieu), ly_do: lyDo.trim(),
      });
      onXong(`Đã điều chỉnh ${r.ten}: ${fmtSo(r.ton_truoc)} → ${fmtSo(r.ton_sau)}.`);
    } catch (e) { setLoi(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "grid", placeItems: "center", zIndex: 80, padding: 16 }}>
      <Card onClick={(e) => e.stopPropagation()} style={{ width: 460, maxWidth: "100%", padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span style={{ width: 34, height: 34, borderRadius: 11, background: T.lavSoft, color: T.lav, display: "grid", placeItems: "center" }}><ClipboardList size={17} /></span>
          <div style={{ flex: 1, fontSize: 15.5, fontWeight: 800, color: T.ink }}>Kiểm kê tồn kho</div>
          <Btn kind="ghost" size="sm" onClick={onClose}><X size={16} /></Btn>
        </div>
        <div style={{ fontSize: 13.5, color: T.sub, marginBottom: 14 }}>
          {mat.ten} ({mat.ma}) — {TU[mat.loai].ten}. Tồn hệ thống hiện tại: <b style={{ color: T.ink }}>{fmtSo(mat.so_luong)}{mat.dvt ? ` ${mat.dvt}` : ""}</b>
        </div>
        {loi && <Card style={{ padding: 12, marginBottom: 12, background: "#FDECEA", border: "none", color: "#C0392B", fontSize: 13 }}>{loi}</Card>}
        <div style={{ display: "grid", gap: 11 }}>
          <label>
            <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 700 }}>Số lượng thực tế đếm được</span>
            <input style={{ ...inp, marginTop: 5 }} type="number" min="0" step="any" value={so} onChange={(e) => setSo(e.target.value)} />
          </label>
          <label>
            <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 700 }}>Mức tồn tối thiểu (cảnh báo sắp hết)</span>
            <input style={{ ...inp, marginTop: 5 }} type="number" min="0" step="any" value={toiThieu} onChange={(e) => setToiThieu(e.target.value)} />
          </label>
          <label>
            <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 700 }}>Lý do điều chỉnh *</span>
            <input style={{ ...inp, marginTop: 5 }} value={lyDo} onChange={(e) => setLyDo(e.target.value)} placeholder="VD: Kiểm kê cuối tháng, hỏng vỡ, hết hạn..." />
          </label>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 16 }}>
          <Btn kind="ghost" size="sm" onClick={onClose}>Hủy</Btn>
          <Btn kind="lav" size="sm" disabled={busy} onClick={luu}>{busy ? "Đang lưu..." : "Lưu kiểm kê"}</Btn>
        </div>
      </Card>
    </div>
  );
}

// Cửa sổ nhật ký kho của một mặt hàng
function PopupNhatKy({ mat, onClose }) {
  const [list, setList] = useState(null);
  const [loi, setLoi] = useState(null);

  useEffect(() => {
    api.khoNhatKy({ loai: mat.loai, ma: mat.ma })
      .then((r) => setList(Array.isArray(r) ? r : []))
      .catch((e) => { setLoi(e.message); setList([]); });
  }, [mat.loai, mat.ma]);

  const ds = list || [];
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "grid", placeItems: "center", zIndex: 80, padding: 16 }}>
      <Card onClick={(e) => e.stopPropagation()} style={{ width: 720, maxWidth: "100%", maxHeight: "86vh", padding: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "15px 18px", borderBottom: `1px solid ${T.line}`, display: "flex", alignItems: "center", gap: 11 }}>
          <span style={{ width: 34, height: 34, borderRadius: 11, background: T.goldSoft, color: T.gold, display: "grid", placeItems: "center" }}><RotateCcw size={17} /></span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15.5, fontWeight: 800, color: T.ink }}>Nhật ký kho — {mat.ten}</div>
            <div style={{ fontSize: 12.5, color: T.sub, marginTop: 1 }}>{mat.ma} · {TU[mat.loai].ten} · tồn hiện tại {fmtSo(mat.so_luong)}{mat.dvt ? ` ${mat.dvt}` : ""}</div>
          </div>
          <Btn kind="ghost" size="sm" onClick={onClose}><X size={16} /></Btn>
        </div>
        <div style={{ padding: 18, overflowY: "auto" }}>
          {loi && <Card style={{ padding: 13, background: "#FDECEA", border: "none", color: "#C0392B", fontSize: 13.5 }}>{loi}</Card>}
          {!loi && list === null && <div style={{ color: T.sub, fontSize: 13.5 }}>Đang tải nhật ký...</div>}
          {!loi && list !== null && ds.length === 0 && (
            <div style={{ padding: 30, textAlign: "center", color: T.sub, fontSize: 13.5 }}>Mặt hàng này chưa có giao dịch kho nào.</div>
          )}
          {ds.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ borderBottom: `1px solid ${T.line}` }}>
                <th style={th}>Thời gian</th><th style={th}>Loại</th>
                <th style={{ ...th, textAlign: "right" }}>Thay đổi</th>
                <th style={{ ...th, textAlign: "right" }}>Tồn sau</th>
                <th style={th}>Người thực hiện</th><th style={th}>Ghi chú</th>
              </tr></thead>
              <tbody>
                {ds.map((n) => {
                  const g = GD[n.loai_gd] || GD.nhap;
                  return (
                    <tr key={n.id} style={{ borderBottom: `1px solid ${T.line}55` }}>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtGio(n.thoi_gian)}</td>
                      <td style={td}><Pill tone={g.tone} soft={g.soft}>{g.l}</Pill></td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 800, color: n.so_luong < 0 ? "#C0392B" : T.mint }}>
                        {n.loai_gd === "sua_gia" ? <span style={{ color: T.sub, fontWeight: 400 }}>—</span>
                          : <>{n.so_luong > 0 ? "+" : ""}{fmtSo(n.so_luong)}</>}
                      </td>
                      <td style={{ ...td, textAlign: "right" }}>{fmtSo(n.ton_sau)}</td>
                      <td style={td}>{n.nguoi_dung || "—"}</td>
                      <td style={{ ...td, color: T.sub, fontSize: 12.5 }}>{n.ma_phieu || n.ghi_chu || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}

export default function TonKhoPage() {
  const { online } = useNav();
  const live = online && !!store.token;
  const quanTri = laAdmin();   // chỉ quản trị viên được sửa đơn giá và kiểm kê

  const [loai, setLoai] = useState("");       // "" = cả hai tủ
  const [q, setQ] = useState("");
  const [sapHet, setSapHet] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [ok, setOk] = useState(null);
  const [nhapCho, setNhapCho] = useState(null);   // { mo: true, mat }
  const [suaGia, setSuaGia] = useState(null);
  const [kiemKe, setKiemKe] = useState(null);
  const [nhatKy, setNhatKy] = useState(null);
  // Khóa "loai:ma" của các mặt hàng đang được tick để nhập kho hàng loạt
  const [chon, setChon] = useState([]);
  const khoa = (m) => `${m.loai}:${m.ma}`;
  const daChon = (m) => chon.includes(khoa(m));
  const doiChon = (m) => setChon((cu) => (cu.includes(khoa(m)) ? cu.filter((k) => k !== khoa(m)) : [...cu, khoa(m)]));

  const load = (loc) => {
    if (!live) return;
    const r = loc || {};
    setLoading(true); setErr(null);
    api.khoTon({
      loai: r.loai !== undefined ? r.loai : loai,
      q: q.trim(),
      sap_het: r.sapHet !== undefined ? r.sapHet : sapHet,
    })
      .then((x) => setData(x))
      .catch((e) => { setErr(e.message); setData(null); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [live]);

  if (!live) {
    return (
      <div>
        <PageTitle title="Tồn kho" sub="Tủ thuốc và tủ vật tư tiêu hao." />
        <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>Cần đăng nhập để xem tồn kho.</Card>
      </div>
    );
  }

  const items = (data && data.items) || [];
  const th_ = (data && data.tong_hop) || null;
  const xong = (loiNhan) => { setOk(loiNhan); setNhapCho(null); setKiemKe(null); setSuaGia(null); setChon([]); load(); };
  // Chỉ giữ lựa chọn còn nằm trong kết quả lọc hiện tại — đổi bộ lọc không được
  // âm thầm nhập kho cho mặt hàng người dùng không còn nhìn thấy.
  const dsChon = items.filter(daChon);
  const chonHet = items.length > 0 && dsChon.length === items.length;

  return (
    <div>
      <PageTitle title="Tồn kho — tủ thuốc & tủ vật tư"
        sub={quanTri
          ? "Số tồn tự động trừ khi lưu phiếu y lệnh. Tại đây nhập kho, sửa đơn giá, kiểm kê và theo dõi giá trị tồn."
          : "Số tồn tự động trừ khi lưu phiếu y lệnh. Bạn được nhập thêm số lượng; đơn giá kho do quản trị viên đặt."} />

      {th_ && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <TheSo icon={Wallet} nhan="Tổng giá trị tồn kho" so={fmtVND(th_.tong_gia_tri)}
            phu={th_.chua_co_gia > 0 ? `${th_.chua_co_gia} mặt hàng chưa đặt đơn giá` : `${th_.so_mat_hang} mặt hàng`}
            tone={T.gold} soft={T.goldSoft} />
          <TheSo icon={PillIcon} nhan="Tủ thuốc" so={fmtVND(th_.thuoc.tong_gia_tri)}
            phu={`${th_.thuoc.so_mat_hang} mặt hàng · ${fmtSo(th_.thuoc.tong_so_luong)} đơn vị`}
            tone={T.peach} soft={T.peachSoft} />
          <TheSo icon={Package} nhan="Tủ vật tư tiêu hao" so={fmtVND(th_.vat_tu.tong_gia_tri)}
            phu={`${th_.vat_tu.so_mat_hang} mặt hàng · ${fmtSo(th_.vat_tu.tong_so_luong)} đơn vị`}
            tone={T.sky} soft={T.skySoft} />
          <TheSo icon={AlertTriangle} nhan="Cần nhập thêm" so={fmtSo(th_.sap_het + th_.het + th_.am_kho)}
            phu={`Hết ${th_.het} · sắp hết ${th_.sap_het}${th_.am_kho ? ` · âm kho ${th_.am_kho}` : ""}`}
            tone="#C0392B" soft="#FDECEA" />
        </div>
      )}

      <Card style={{ padding: 18, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          {[{ v: "", l: "Cả hai tủ" }, { v: "thuoc", l: "Tủ thuốc" }, { v: "vat_tu", l: "Tủ vật tư" }].map((o) => (
            <button key={o.v} type="button" onClick={() => { setLoai(o.v); load({ loai: o.v }); }}
              style={{
                padding: "8px 15px", borderRadius: 999, cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, fontWeight: 800,
                border: `1.5px solid ${loai === o.v ? T.gold : T.line}`,
                background: loai === o.v ? T.goldSoft : T.surface, color: loai === o.v ? T.gold : T.sub,
              }}>
              {o.l}
            </button>
          ))}
          <button type="button" onClick={() => { setSapHet(!sapHet); load({ sapHet: !sapHet }); }}
            style={{
              padding: "8px 15px", borderRadius: 999, cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, fontWeight: 800,
              border: `1.5px solid ${sapHet ? "#C0392B" : T.line}`,
              background: sapHet ? "#FDECEA" : T.surface, color: sapHet ? "#C0392B" : T.sub,
            }}>
            <AlertTriangle size={13} style={{ verticalAlign: -2, marginRight: 5 }} />Chỉ mặt hàng cần nhập
          </button>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            {dsChon.length > 0 && (
              <>
                <span style={{ fontSize: 13, color: T.sub, fontWeight: 700 }}>Đã chọn {dsChon.length}</span>
                <Btn kind="ghost" size="sm" onClick={() => setChon([])}>Bỏ chọn</Btn>
                <Btn kind="gold" size="sm" onClick={() => setNhapCho({ mat: dsChon })}>
                  <Plus size={15} /> Nhập {dsChon.length} mặt hàng
                </Btn>
              </>
            )}
            <Btn kind="mint" size="sm" onClick={() => setNhapCho({ mat: null })}><Plus size={15} /> Nhập kho</Btn>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200, display: "flex", alignItems: "center", gap: 10, border: `1.5px solid ${T.line}`, borderRadius: 13, padding: "0 14px" }}>
            <Search size={17} color={T.sub} />
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()}
              placeholder="Tìm theo tên hoặc mã mặt hàng..."
              style={{ flex: 1, border: "none", outline: "none", padding: "11px 0", fontSize: 14.5, fontFamily: "inherit", background: "transparent" }} />
          </div>
          <Btn size="sm" onClick={() => load()}>Tìm</Btn>
        </div>
      </Card>

      {err && <Card style={{ padding: 15, marginBottom: 14, background: "#FDECEA", border: "none", color: "#C0392B", fontSize: 14 }}>{err}</Card>}
      {ok && <Card style={{ padding: 15, marginBottom: 14, background: T.mintSoft, border: "none", color: T.mint, fontSize: 14 }}>{ok}</Card>}
      {loading && <div style={{ color: T.sub, fontSize: 14, marginBottom: 12 }}>Đang tải tồn kho...</div>}

      {!loading && items.length === 0 && !err && (
        <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>
          {q.trim() || sapHet ? "Không có mặt hàng nào khớp bộ lọc." : "Chưa mở thẻ kho cho mặt hàng nào. Chạy npm run seed:kho ở backend để mở thẻ cho toàn bộ danh mục."}
        </Card>
      )}

      {items.length > 0 && (
        <Card style={{ padding: 0, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 920 }}>
            <thead><tr style={{ borderBottom: `1px solid ${T.line}` }}>
              <th style={{ ...th, width: 40, paddingLeft: 18 }}>
                <input type="checkbox" checked={chonHet} title={chonHet ? "Bỏ chọn tất cả" : "Chọn tất cả mặt hàng đang lọc"}
                  onChange={() => setChon(chonHet ? [] : items.map(khoa))} style={{ cursor: "pointer" }} />
              </th>
              <th style={{ ...th, minWidth: 230 }}>Mặt hàng</th>
              <th style={{ ...th, width: 100 }}>Tủ</th>
              <th style={{ ...th, width: 120, textAlign: "right" }}>Tồn</th>
              <th style={{ ...th, width: 130, textAlign: "right" }}>Đơn giá kho</th>
              <th style={{ ...th, width: 130, textAlign: "right" }}>Giá trị tồn</th>
              <th style={{ ...th, width: 260, paddingRight: 18 }}>Thao tác</th>
            </tr></thead>
            <tbody>
              {items.map((m) => {
                const tu = TU[m.loai];
                const cb = m.canh_bao ? CANH_BAO[m.canh_bao] : null;
                return (
                  <tr key={`${m.loai}:${m.ma}`} style={{ borderBottom: `1px solid ${T.line}55`, background: daChon(m) ? T.goldSoft : "transparent" }}>
                    <td style={{ ...td, paddingLeft: 18 }}>
                      <input type="checkbox" checked={daChon(m)} onChange={() => doiChon(m)}
                        title={`Chọn ${m.ten} để nhập kho hàng loạt`} style={{ cursor: "pointer" }} />
                    </td>
                    <td style={td}>
                      <div style={{ fontWeight: 700 }}>{m.ten}</div>
                      <div style={{ fontSize: 12, color: T.sub }}>{m.ma}{m.dvt ? ` · ${m.dvt}` : ""}{m.ton_toi_thieu > 0 ? ` · tối thiểu ${fmtSo(m.ton_toi_thieu)}` : ""}</div>
                    </td>
                    <td style={td}><Pill tone={tu.tone} soft={tu.soft}><tu.icon size={12} /> {m.loai === "thuoc" ? "Thuốc" : "Vật tư"}</Pill></td>
                    <td style={{ ...td, textAlign: "right" }}>
                      <div style={{ fontWeight: 800, fontSize: 15, color: cb ? cb.tone : T.ink }}>{fmtSo(m.so_luong)}</div>
                      {cb && <div style={{ fontSize: 11.5, fontWeight: 700, color: cb.tone }}>{cb.l}</div>}
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>
                      {quanTri ? (
                        <button type="button" onClick={() => setSuaGia(m)} title="Sửa đơn giá kho"
                          style={{
                            background: "none", border: "none", padding: "3px 6px", borderRadius: 8, cursor: "pointer",
                            fontFamily: "inherit", fontSize: 13.5, fontWeight: m.don_gia > 0 ? 700 : 400,
                            color: m.don_gia > 0 ? T.ink : T.sub, textDecoration: "underline dotted",
                          }}>
                          {m.don_gia > 0 ? fmtVND(m.don_gia) : "Đặt giá"}
                        </button>
                      ) : (
                        <span style={{ fontWeight: m.don_gia > 0 ? 700 : 400, color: m.don_gia > 0 ? T.ink : T.sub }}>
                          {m.don_gia > 0 ? fmtVND(m.don_gia) : "Chưa có giá"}
                        </span>
                      )}
                    </td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 800 }}>{fmtVND(m.gia_tri)}</td>
                    <td style={{ ...td, paddingRight: 18 }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <Btn kind="mint" size="sm" onClick={() => setNhapCho({ mat: m })}><Plus size={13} /> Nhập</Btn>
                        {quanTri && <Btn kind="gold" size="sm" onClick={() => setSuaGia(m)}><Wallet size={13} /> Sửa giá</Btn>}
                        {quanTri && <Btn kind="lav" size="sm" onClick={() => setKiemKe(m)}><ClipboardList size={13} /> Kiểm kê</Btn>}
                        <Btn kind="ghost" size="sm" onClick={() => setNhatKy(m)}><RotateCcw size={13} /> Nhật ký</Btn>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {nhapCho && <PopupNhapKho banDau={nhapCho.mat} onClose={() => setNhapCho(null)} onXong={xong} />}
      {suaGia && <PopupSuaGia mat={suaGia} onClose={() => setSuaGia(null)} onXong={xong} />}
      {kiemKe && <PopupKiemKe mat={kiemKe} onClose={() => setKiemKe(null)} onXong={xong} />}
      {nhatKy && <PopupNhatKy mat={nhatKy} onClose={() => setNhatKy(null)} />}
    </div>
  );
}
