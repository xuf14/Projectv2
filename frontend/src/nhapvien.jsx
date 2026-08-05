import React, { useState, useEffect, useCallback } from "react";
import {
  BedDouble, Search, X, ShieldCheck, AlertTriangle, CheckCircle2, Clock,
  UserCheck, LogIn, Settings2, Ban, RefreshCw,
} from "lucide-react";
import { T, store, api, useNav, Btn, Card, Pill, PageTitle, input } from "./shared";

// ============================================================================
//  NHẬP VIỆN "MỘT CHẠM" — màn hình lễ tân (hàng chờ + panel xử lý) và màn hình
//  khoa nội trú của bác sĩ (xác nhận đã tiếp nhận người bệnh).
//  Bác sĩ ký yêu cầu ở bước 5 của quy trình khám; ở đây KHÔNG nhập lại chẩn đoán
//  hay dữ liệu hành chính — chỉ xác minh, chọn giường và xác nhận.
//    GET   /nhap-vien/hang-cho     POST /nhap-vien/:id/tiep-nhan
//    PATCH /nhap-vien/:id/xac-minh POST /nhap-vien/:id/xac-nhan
//    POST  /nhap-vien/:id/ket-thuc GET  /noi-tru   POST /noi-tru/:id/khoa-nhan
//    GET   /giuong                 POST /admin/giuong (quản trị)
//  Mọi ràng buộc được chốt ở backend; ẩn/hiện nút chỉ là hỗ trợ thao tác.
// ============================================================================

const inp = { ...input, padding: "9px 11px", fontSize: 13.5, borderRadius: 9 };
const fmtGio = (t) => { const d = new Date(t); return isNaN(d) ? "" : d.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); };
const fmtNgay = (s) => { const d = new Date(s); return isNaN(d) ? "" : d.toLocaleDateString("vi-VN"); };

const UU_TIEN = {
  cap_cuu: { l: "Cấp cứu", tone: "#C0392B", soft: "#FDECEA" },
  khan: { l: "Khẩn", tone: "#B7791F", soft: T.goldSoft },
  thuong: { l: "Thông thường", tone: T.sky, soft: T.skySoft },
  theo_lich: { l: "Theo lịch", tone: T.lav, soft: T.lavSoft },
};
const TRANG_THAI = {
  cho_tiep_nhan: { l: "Chờ tiếp nhận", tone: "#B7791F", soft: T.goldSoft },
  dang_xac_minh: { l: "Đang xác minh", tone: T.sky, soft: T.skySoft },
  cho_giuong: { l: "Chờ giường", tone: "#C0392B", soft: "#FDECEA" },
  da_nhap_vien: { l: "Đã nhập viện", tone: T.mint, soft: T.mintSoft },
  khoa_da_nhan: { l: "Khoa đã tiếp nhận", tone: T.mint, soft: T.mintSoft },
  tu_choi: { l: "Người bệnh từ chối", tone: T.sub, soft: T.bg },
  da_huy: { l: "Đã hủy", tone: T.sub, soft: T.bg },
  chuyen_vien: { l: "Chuyển viện", tone: T.sub, soft: T.bg },
};
const DOI_TUONG = { bhyt: "Bảo hiểm y tế", vien_phi: "Viện phí", bao_lanh: "Bảo lãnh" };
const BHYT = { chua_xac_minh: "Chưa xác minh", hop_le: "Thẻ hợp lệ", khong_co: "Không có thẻ" };
const DI_CHUYEN = { di_bo: "Đi bộ", xe_lan: "Xe lăn", cang: "Cáng" };
const KET_THUC = { tu_choi: "Người bệnh từ chối", chuyen_vien: "Chuyển cơ sở khác", da_huy: "Hủy yêu cầu" };

// Mã giường thường đã chứa số phòng ("P201-G1") — không ghép lặp khi hiển thị
const tenGiuong = (g) => (g && g.ma ? (g.ma.startsWith(g.phong) ? g.ma : `${g.phong}-${g.ma}`) : "—");

const laAdmin = () => ((store.user && store.user.vai_tro) || "") === "admin";
const tuoiText = (ns) => {
  if (!ns) return "";
  const d = new Date(ns);
  if (isNaN(d)) return "";
  return `${d.toLocaleDateString("vi-VN")} (${new Date().getFullYear() - d.getFullYear()}t)`;
};

const th = { padding: "10px 8px", fontSize: 11.5, fontWeight: 800, color: T.sub, textTransform: "uppercase", letterSpacing: .4, textAlign: "left" };
const td = { padding: "8px", fontSize: 13.5, color: T.ink, verticalAlign: "middle" };

const Nhan = ({ map, k }) => {
  const v = map[k];
  return v ? <Pill tone={v.tone} soft={v.soft}>{v.l}</Pill> : <Pill>{k}</Pill>;
};

const Muc = ({ nhan, children }) => (
  <div style={{ marginBottom: 12 }}>
    <div style={{ fontSize: 12, color: T.sub, fontWeight: 700, marginBottom: 5 }}>{nhan}</div>
    {children}
  </div>
);

// ---------------------------------------------------------------------------
//  Panel xử lý một yêu cầu — đúng tinh thần "một màn hình" của tài liệu:
//  danh tính, thanh toán, khoa/giường và nút xác nhận nằm cùng chỗ.
// ---------------------------------------------------------------------------
function PanelXuLy({ yeuCau, onDong, onXong }) {
  const [yc, setYc] = useState(yeuCau);
  const [giuong, setGiuong] = useState([]);
  const [chon, setChon] = useState("");
  const [doiTuong, setDoiTuong] = useState(yeuCau.doi_tuong_tt || "vien_phi");
  const [bhyt, setBhyt] = useState(yeuCau.bhyt_trang_thai || "chua_xac_minh");
  const [ghiChu, setGhiChu] = useState(yeuCau.ghi_chu_tiep_nhan || "");
  const [dongY, setDongY] = useState(false);      // ký xác nhận thông tin nhập viện
  const [busy, setBusy] = useState(false);
  const [loi, setLoi] = useState(null);
  const [ok, setOk] = useState(null);
  const [dongYc, setDongYc] = useState(false);    // mở khối đóng yêu cầu
  const [lyDoDong, setLyDoDong] = useState("");
  const [loaiDong, setLoaiDong] = useState("tu_choi");

  const khoaId = yc.khoa ? yc.khoa.id : null;
  const daXong = ["da_nhap_vien", "khoa_da_nhan"].includes(yc.trang_thai);
  const daDong = ["tu_choi", "da_huy", "chuyen_vien"].includes(yc.trang_thai);
  const cuaToi = yc.nguoi_tiep_nhan && store.user && yc.nguoi_tiep_nhan.id === store.user.id;

  // Hàng chờ tự làm mới nền; panel phải bám theo, nếu không lễ tân vẫn nhìn thấy
  // trạng thái cũ (VD "Chờ khoa xác nhận" trong khi khoa đã tiếp nhận xong).
  useEffect(() => { setYc(yeuCau); }, [yeuCau]);

  useEffect(() => {
    if (!khoaId || daXong || daDong) return;
    let alive = true;
    api.giuongList({ khoa_id: khoaId, trong: true })
      .then((r) => { if (alive) setGiuong(r.items || []); })
      .catch((e) => { if (alive) setLoi(e.message); });
    return () => { alive = false; };
  }, [khoaId, daXong, daDong]);

  const nap = async () => setYc(await api.nvChiTiet(yc.id));

  const chay = async (fn, thanhCong) => {
    setBusy(true); setLoi(null); setOk(null);
    try {
      const r = await fn();
      setYc(r && r.trang_thai ? r : await api.nvChiTiet(yc.id));
      setOk(thanhCong);
      onXong();
    } catch (e) { setLoi(e.message); } finally { setBusy(false); }
  };

  const tiepNhan = () => chay(() => api.nvTiepNhan(yc.id), "Đã nhận xử lý hồ sơ này.");
  const luuXacMinh = (trangThai) => chay(
    () => api.nvXacMinh(yc.id, {
      doi_tuong_tt: doiTuong, bhyt_trang_thai: bhyt, ghi_chu_tiep_nhan: ghiChu,
      ...(trangThai ? { trang_thai: trangThai } : {}),
    }),
    trangThai === "cho_giuong" ? "Đã chuyển sang Chờ giường." : "Đã lưu kết quả xác minh.",
  );

  const xacNhan = async () => {
    if (!chon) { setLoi("Chọn giường cho người bệnh trước khi xác nhận."); return; }
    if (!dongY) { setLoi("Cần xác nhận người bệnh đã đồng ý điều trị và nắm quy định nội trú."); return; }
    setBusy(true); setLoi(null); setOk(null);
    try {
      const d = await api.nvXacNhan(yc.id, {
        giuong_id: Number(chon), doi_tuong_tt: doiTuong, bhyt_trang_thai: bhyt, ghi_chu: ghiChu,
      });
      await nap();
      setOk(`Đã nhập viện — số vào viện ${d.so_vao_vien}, giường ${tenGiuong(d.giuong)}. Đã gửi bàn giao cho khoa.`);
      onXong();
    } catch (e) { setLoi(e.message); } finally { setBusy(false); }
  };

  const dong = async () => {
    if (!lyDoDong.trim()) { setLoi("Ghi rõ lý do đóng yêu cầu."); return; }
    await chay(() => api.nvKetThuc(yc.id, { trang_thai: loaiDong, ly_do: lyDoDong.trim() }), "Đã đóng yêu cầu nhập viện.");
    setDongYc(false);
  };

  const bn = yc.ho_so || {};
  return (
    <Card style={{ padding: 20, position: "sticky", top: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 14 }}>
        <div>
          <div style={{ fontWeight: 800, color: T.ink, fontSize: 16 }}>{bn.ho_ten}</div>
          <div style={{ fontSize: 12.5, color: T.sub, marginTop: 2 }}>
            {bn.ma_benh_nhan} · {tuoiText(bn.ngay_sinh)} · {bn.gioi_tinh || "—"} · {bn.sdt || "chưa có SĐT"}
          </div>
        </div>
        <button onClick={onDong} style={{ background: "none", border: "none", cursor: "pointer", color: T.sub }} title="Đóng panel"><X size={18} /></button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <Nhan map={UU_TIEN} k={yc.uu_tien} />
        <Nhan map={TRANG_THAI} k={yc.trang_thai} />
        <Pill>{yc.ma_yeu_cau}</Pill>
        {yc.nguoi_tiep_nhan && <Pill tone={T.sub} soft={T.bg}>{yc.nguoi_tiep_nhan.ho_ten} xử lý</Pill>}
      </div>

      {yc.canh_bao && (
        <div style={{ display: "flex", gap: 8, background: "#FDECEA", color: "#C0392B", padding: "10px 12px", borderRadius: 11, fontSize: 13.5, marginBottom: 14 }}>
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span><b>Cảnh báo lâm sàng:</b> {yc.canh_bao}</span>
        </div>
      )}

      {/* Dữ liệu bác sĩ đã ký — chỉ đọc, lễ tân không nhập lại */}
      <div style={{ background: T.bg, borderRadius: 12, padding: "12px 14px", fontSize: 13.5, marginBottom: 16 }}>
        <div style={{ marginBottom: 5 }}><span style={{ color: T.sub }}>Chẩn đoán: </span><b style={{ color: T.ink }}>{yc.chan_doan_chinh}</b>{yc.ma_icd ? ` (${yc.ma_icd})` : ""}</div>
        <div style={{ marginBottom: 5 }}><span style={{ color: T.sub }}>Lý do nhập viện: </span>{yc.ly_do}</div>
        {yc.ly_do_uu_tien && <div style={{ marginBottom: 5 }}><span style={{ color: T.sub }}>Lý do ưu tiên: </span>{yc.ly_do_uu_tien}</div>}
        <div style={{ color: T.sub }}>
          {yc.bac_si || "—"} · {yc.khoa ? yc.khoa.ten_khoa : "chưa rõ khoa"} · ký {fmtGio(yc.thoi_gian_ky)}
          {" · "}Di chuyển: {DI_CHUYEN[yc.ho_tro_di_chuyen] || yc.ho_tro_di_chuyen}
          {yc.ngay_du_kien ? ` · Dự kiến ${fmtNgay(yc.ngay_du_kien)}` : ""}
        </div>
      </div>

      {yc.noi_tru ? (
        <div style={{ border: `1.5px solid ${T.mint}`, background: T.mintSoft, borderRadius: 12, padding: 14, fontSize: 13.5 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, color: T.mint, fontWeight: 800 }}>
            <CheckCircle2 size={16} /> Số vào viện {yc.noi_tru.so_vao_vien}
          </div>
          <div style={{ color: T.ink }}>
            {yc.noi_tru.khoa ? yc.noi_tru.khoa.ten_khoa : ""} · Giường {tenGiuong(yc.noi_tru.giuong)}
            {" · "}{DOI_TUONG[yc.noi_tru.doi_tuong_tt]} · BHYT {BHYT[yc.noi_tru.bhyt_trang_thai]}
          </div>
          <div style={{ color: T.sub, marginTop: 6 }}>
            Vào lúc {fmtGio(yc.noi_tru.thoi_gian_vao)}{yc.noi_tru.nguoi_lam_thu_tuc ? ` · ${yc.noi_tru.nguoi_lam_thu_tuc}` : ""}
          </div>
          <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {yc.noi_tru.thoi_gian_khoa_nhan
              ? <Pill tone={T.mint} soft="#fff">
                  <CheckCircle2 size={13} /> Khoa đã tiếp nhận lúc {fmtGio(yc.noi_tru.thoi_gian_khoa_nhan)}
                  {yc.noi_tru.nguoi_khoa_nhan ? ` · ${yc.noi_tru.nguoi_khoa_nhan}` : ""}
                </Pill>
              : <>
                  <Pill tone="#B7791F" soft="#fff"><Clock size={13} /> Chờ khoa xác nhận tiếp nhận</Pill>
                  <Btn kind="ghost" size="sm" disabled={busy} onClick={nap}><RefreshCw size={13} /> Kiểm tra lại</Btn>
                </>}
          </div>
        </div>
      ) : daDong ? (
        <div style={{ background: T.bg, borderRadius: 12, padding: 14, fontSize: 13.5, color: T.sub }}>
          Yêu cầu đã đóng — {TRANG_THAI[yc.trang_thai].l}. Lý do: {yc.ly_do_ket_thuc || "—"}
        </div>
      ) : (
        <>
          {yc.trang_thai === "cho_tiep_nhan" && (
            <Btn kind="lav" style={{ width: "100%", justifyContent: "center", marginBottom: 14 }} disabled={busy} onClick={tiepNhan}>
              <UserCheck size={16} /> Tiếp nhận hồ sơ này
            </Btn>
          )}
          {!cuaToi && yc.nguoi_tiep_nhan && (
            <div style={{ background: T.goldSoft, color: "#B7791F", fontSize: 13, padding: "9px 12px", borderRadius: 10, marginBottom: 12 }}>
              Hồ sơ đang do {yc.nguoi_tiep_nhan.ho_ten} xử lý — tránh thao tác chồng chéo.
            </div>
          )}

          <Muc nhan="Danh tính (đối chiếu giấy tờ với hồ sơ)">
            <div style={{ fontSize: 13.5, color: T.ink, background: T.bg, borderRadius: 10, padding: "10px 12px" }}>
              {bn.ho_ten} · {tuoiText(bn.ngay_sinh)}<br />
              <span style={{ color: T.sub }}>{bn.dia_chi || "Chưa có địa chỉ"} · Thẻ BHYT: {bn.so_bhyt || "chưa có"}</span>
            </div>
          </Muc>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Muc nhan="Đối tượng thanh toán">
              <select style={inp} value={doiTuong} onChange={(e) => setDoiTuong(e.target.value)}>
                {Object.entries(DOI_TUONG).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Muc>
            <Muc nhan="Xác minh BHYT">
              <select style={inp} value={bhyt} onChange={(e) => setBhyt(e.target.value)}>
                {Object.entries(BHYT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Muc>
          </div>

          <Muc nhan="Ghi chú tiếp nhận">
            <input style={inp} value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} placeholder="Giấy chuyển tuyến, người nhà đi kèm, tạm ứng..." />
          </Muc>

          <Muc nhan={`Giường trống — ${yc.khoa ? yc.khoa.ten_khoa : "chưa rõ khoa"}`}>
            {giuong.length === 0 ? (
              <div style={{ fontSize: 13, color: "#C0392B", background: "#FDECEA", padding: "9px 12px", borderRadius: 10 }}>
                Khoa hiện không còn giường trống — chuyển hồ sơ sang Chờ giường hoặc đổi khoa.
              </div>
            ) : (
              <select style={inp} value={chon} onChange={(e) => setChon(e.target.value)}>
                <option value="">— Chọn giường —</option>
                {giuong.map((g) => (
                  <option key={g.id} value={g.id}>{g.phong} · {g.ma}{g.loai === "dich_vu" ? " (dịch vụ)" : ""}</option>
                ))}
              </select>
            )}
          </Muc>

          <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, color: T.ink, marginBottom: 14, cursor: "pointer" }}>
            <input type="checkbox" checked={dongY} onChange={(e) => setDongY(e.target.checked)} style={{ marginTop: 2 }} />
            <span>Người bệnh đã xác nhận thông tin nhập viện, đồng ý điều trị và quy định nội trú.</span>
          </label>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Btn kind="mint" disabled={busy} onClick={xacNhan}><LogIn size={16} /> {busy ? "Đang xử lý..." : "Xác nhận nhập viện"}</Btn>
            <Btn kind="ghost" disabled={busy} onClick={() => luuXacMinh()}><ShieldCheck size={15} /> Lưu xác minh</Btn>
            <Btn kind="ghost" disabled={busy} onClick={() => luuXacMinh("cho_giuong")}><Clock size={15} /> Chờ giường</Btn>
            <Btn kind="ghost" disabled={busy} onClick={() => setDongYc((v) => !v)}><Ban size={15} /> Đóng yêu cầu</Btn>
          </div>

          {dongYc && (
            <div style={{ marginTop: 12, border: `1.5px solid ${T.line}`, borderRadius: 11, padding: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <select style={inp} value={loaiDong} onChange={(e) => setLoaiDong(e.target.value)}>
                  {Object.entries(KET_THUC).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <input style={inp} value={lyDoDong} onChange={(e) => setLyDoDong(e.target.value)} placeholder="Lý do (bắt buộc)" />
              </div>
              <Btn kind="ghost" size="sm" disabled={busy} onClick={dong}>Xác nhận đóng yêu cầu</Btn>
            </div>
          )}
        </>
      )}

      {loi && <div style={{ marginTop: 12, background: "#FDECEA", color: "#C0392B", fontSize: 13.5, padding: "10px 12px", borderRadius: 11 }}>{loi}</div>}
      {ok && <div style={{ marginTop: 12, background: T.mintSoft, color: T.mint, fontSize: 13.5, padding: "10px 12px", borderRadius: 11 }}>{ok}</div>}
    </Card>
  );
}

// ---------------------------------------------------------------------------
//  Danh mục giường (quản trị viên cấu hình)
// ---------------------------------------------------------------------------
function PopupGiuong({ onClose }) {
  const { departments } = useNav();
  const dsKhoa = (departments || []).filter((d) => d.dbId);
  const [khoaId, setKhoaId] = useState("");
  const [ds, setDs] = useState([]);
  const [tong, setTong] = useState(null);
  const [f, setF] = useState({ phong: "", ma: "", loai: "thuong" });
  const [busy, setBusy] = useState(false);
  const [loi, setLoi] = useState(null);

  const nap = useCallback(() => {
    api.giuongList(khoaId ? { khoa_id: Number(khoaId) } : {})
      .then((r) => { setDs(r.items || []); setTong(r.tong_hop || null); })
      .catch((e) => setLoi(e.message));
  }, [khoaId]);
  useEffect(() => { nap(); }, [nap]);

  const them = async () => {
    setLoi(null);
    if (!khoaId) { setLoi("Chọn khoa trước khi thêm giường."); return; }
    if (!f.phong.trim() || !f.ma.trim()) { setLoi("Nhập đủ số phòng và mã giường."); return; }
    setBusy(true);
    try {
      await api.giuongLuu({ khoa_id: Number(khoaId), phong: f.phong.trim(), ma: f.ma.trim(), loai: f.loai });
      setF({ phong: "", ma: "", loai: "thuong" });
      nap();
    } catch (e) { setLoi(e.message); } finally { setBusy(false); }
  };

  const doiTrangThai = async (g, trangThai) => {
    setLoi(null);
    try {
      await api.giuongLuu({ khoa_id: g.khoa.id, phong: g.phong, ma: g.ma, loai: g.loai, trang_thai: trangThai });
      nap();
    } catch (e) { setLoi(e.message); }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "#00000055", display: "grid", placeItems: "center", zIndex: 70, padding: 16 }}>
      <Card onClick={(e) => e.stopPropagation()} style={{ padding: 22, width: "min(760px, 96vw)", maxHeight: "88vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <b style={{ color: T.ink, fontSize: 16 }}>Danh mục phòng / giường</b>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: T.sub }}><X size={18} /></button>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <select style={{ ...inp, width: "auto", minWidth: 200 }} value={khoaId} onChange={(e) => setKhoaId(e.target.value)}>
            <option value="">Tất cả khoa</option>
            {dsKhoa.map((d) => <option key={d.dbId} value={d.dbId}>{d.name}</option>)}
          </select>
          <input style={{ ...inp, width: 110 }} value={f.phong} onChange={(e) => setF({ ...f, phong: e.target.value })} placeholder="Phòng" />
          <input style={{ ...inp, width: 130 }} value={f.ma} onChange={(e) => setF({ ...f, ma: e.target.value })} placeholder="Mã giường" />
          <select style={{ ...inp, width: "auto" }} value={f.loai} onChange={(e) => setF({ ...f, loai: e.target.value })}>
            <option value="thuong">Thường</option><option value="dich_vu">Dịch vụ</option>
          </select>
          <Btn kind="lav" size="sm" disabled={busy} onClick={them}>Thêm / cập nhật</Btn>
        </div>
        {tong && <div style={{ fontSize: 13, color: T.sub, marginBottom: 10 }}>
          Tổng {tong.tong} giường · trống {tong.trong} · đang dùng {tong.dang_dung} · bảo trì {tong.bao_tri}
        </div>}
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ borderBottom: `1.5px solid ${T.line}` }}>
            <th style={th}>Khoa</th><th style={th}>Phòng</th><th style={th}>Giường</th>
            <th style={th}>Loại</th><th style={th}>Trạng thái</th><th style={th}></th>
          </tr></thead>
          <tbody>
            {ds.map((g) => (
              <tr key={g.id} style={{ borderBottom: `1px solid ${T.line}55` }}>
                <td style={td}>{g.khoa ? g.khoa.ten_khoa : "—"}</td>
                <td style={td}>{g.phong}</td>
                <td style={td}>{g.ma}</td>
                <td style={td}>{g.loai === "dich_vu" ? "Dịch vụ" : "Thường"}</td>
                <td style={td}>
                  {g.trang_thai === "dang_dung" ? <Pill tone="#C0392B" soft="#FDECEA">Đang dùng</Pill>
                    : g.trang_thai === "bao_tri" ? <Pill tone="#B7791F" soft={T.goldSoft}>Bảo trì</Pill>
                      : <Pill tone={T.mint} soft={T.mintSoft}>Trống</Pill>}
                </td>
                <td style={{ ...td, textAlign: "right" }}>
                  {g.trang_thai !== "dang_dung" && (
                    <Btn kind="ghost" size="sm" onClick={() => doiTrangThai(g, g.trang_thai === "bao_tri" ? "trong" : "bao_tri")}>
                      {g.trang_thai === "bao_tri" ? "Mở lại" : "Bảo trì"}
                    </Btn>
                  )}
                </td>
              </tr>
            ))}
            {ds.length === 0 && <tr><td style={{ ...td, color: T.sub, textAlign: "center", padding: 20 }} colSpan={6}>Chưa có giường nào.</td></tr>}
          </tbody>
        </table>
        {loi && <div style={{ marginTop: 12, background: "#FDECEA", color: "#C0392B", fontSize: 13.5, padding: "10px 12px", borderRadius: 11 }}>{loi}</div>}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
//  Trang lễ tân: hàng chờ thời gian thực + panel xử lý bên phải
// ---------------------------------------------------------------------------
export default function NhapVienPage() {
  const [ds, setDs] = useState([]);
  const [loc, setLoc] = useState("mo");
  const [q, setQ] = useState("");
  const [dangMo, setDangMo] = useState(null);   // id yêu cầu đang xử lý
  const [tai, setTai] = useState(true);
  const [loi, setLoi] = useState(null);
  const [popupGiuong, setPopupGiuong] = useState(false);
  const quanTri = laAdmin();

  const [lanCuoi, setLanCuoi] = useState(null);

  const nap = useCallback(async () => {
    setLoi(null);
    try { setDs(await api.nvHangCho({ trang_thai: loc, q: q.trim() })); setLanCuoi(new Date()); }
    catch (e) { setLoi(e.message); } finally { setTai(false); }
  }, [loc, q]);
  useEffect(() => { setTai(true); nap(); }, [nap]);
  // Hàng chờ là dữ liệu thời gian thực: yêu cầu mới của bác sĩ và mốc khoa tiếp
  // nhận phải tự hiện ra, lễ tân không phải tự tải lại trang.
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) nap(); }, 15000);
    return () => clearInterval(t);
  }, [nap]);

  const dangChon = ds.find((y) => y.id === dangMo) || null;
  const soCapCuu = ds.filter((y) => y.uu_tien === "cap_cuu" || y.uu_tien === "khan").length;

  return (
    <div>
      <PageTitle
        title="Nhập viện"
        sub={`Hàng chờ yêu cầu nhập viện do bác sĩ ký ở bước kết luận. ${quanTri ? "Quản trị viên cấu hình được danh mục giường." : "Xác minh hành chính, chọn giường và xác nhận nhập viện."}`} />

      <div style={{ display: "flex", gap: 9, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
        {[["mo", "Đang chờ xử lý"], ["cho_tiep_nhan", "Chờ tiếp nhận"], ["dang_xac_minh", "Đang xác minh"],
          ["cho_giuong", "Chờ giường"], ["da_nhap_vien", "Đã nhập viện"], ["khoa_da_nhan", "Khoa đã nhận"]].map(([k, l]) => (
          <Btn key={k} kind={loc === k ? "lav" : "ghost"} size="sm" onClick={() => { setLoc(k); setDangMo(null); }}>{l}</Btn>
        ))}
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search size={15} style={{ position: "absolute", left: 11, top: 11, color: T.sub }} />
          <input style={{ ...inp, paddingLeft: 32, width: "100%" }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo tên, mã bệnh nhân hoặc mã yêu cầu" />
        </div>
        <Btn kind="ghost" size="sm" onClick={nap} title="Hàng chờ tự làm mới mỗi 15 giây">
          <RefreshCw size={14} /> {lanCuoi ? `Cập nhật ${fmtGio(lanCuoi)}` : "Làm mới"}
        </Btn>
        {quanTri && <Btn kind="ghost" size="sm" onClick={() => setPopupGiuong(true)}><Settings2 size={15} /> Danh mục giường</Btn>}
      </div>

      {soCapCuu > 0 && loc === "mo" && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", background: "#FDECEA", color: "#C0392B", padding: "10px 14px", borderRadius: 12, fontSize: 13.5, marginBottom: 14 }}>
          <AlertTriangle size={16} /> Có {soCapCuu} yêu cầu cấp cứu/khẩn đang chờ — xử lý trước.
        </div>
      )}

      {loi && <div style={{ background: "#FDECEA", color: "#C0392B", fontSize: 13.5, padding: "10px 14px", borderRadius: 12, marginBottom: 14 }}>{loi}</div>}

      <div style={{ display: "grid", gridTemplateColumns: dangChon ? "minmax(0, 1.35fr) minmax(320px, 1fr)" : "1fr", gap: 16, alignItems: "start" }} className="grid2">
        <Card style={{ padding: 0, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
            <thead><tr style={{ borderBottom: `1.5px solid ${T.line}` }}>
              <th style={th}>Ưu tiên</th><th style={th}>Người bệnh</th><th style={th}>Chẩn đoán / khoa</th>
              <th style={th}>Chờ từ</th><th style={th}>Trạng thái</th><th style={th}></th>
            </tr></thead>
            <tbody>
              {ds.map((y) => (
                <tr key={y.id} style={{ borderBottom: `1px solid ${T.line}55`, background: y.id === dangMo ? T.lavSoft : "transparent" }}>
                  <td style={td}><Nhan map={UU_TIEN} k={y.uu_tien} /></td>
                  <td style={td}>
                    <b>{y.ho_so ? y.ho_so.ho_ten : "—"}</b>
                    <div style={{ fontSize: 12, color: T.sub }}>
                      {y.ho_so ? y.ho_so.ma_benh_nhan : ""} · {y.ma_yeu_cau}
                      {y.noi_tru ? ` · Số vào viện ${y.noi_tru.so_vao_vien}` : ""}
                    </div>
                  </td>
                  <td style={td}>
                    {y.chan_doan_chinh}
                    <div style={{ fontSize: 12, color: T.sub }}>{y.khoa ? y.khoa.ten_khoa : "—"}{y.bac_si ? ` · ${y.bac_si}` : ""}</div>
                  </td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtGio(y.thoi_gian_ky)}</td>
                  <td style={td}>
                    <Nhan map={TRANG_THAI} k={y.trang_thai} />
                    {y.canh_bao && <div style={{ fontSize: 11.5, color: "#C0392B", marginTop: 3 }}>⚠ {y.canh_bao}</div>}
                  </td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <Btn kind={y.id === dangMo ? "lav" : "ghost"} size="sm" onClick={() => setDangMo(y.id === dangMo ? null : y.id)}>
                      {y.noi_tru ? "Xem" : "Tiếp nhận"}
                    </Btn>
                  </td>
                </tr>
              ))}
              {!tai && ds.length === 0 && (
                <tr><td style={{ ...td, textAlign: "center", color: T.sub, padding: 28 }} colSpan={6}>
                  <BedDouble size={22} style={{ opacity: .5 }} />
                  <div style={{ marginTop: 6 }}>Không có yêu cầu nhập viện nào ở mục này.</div>
                </td></tr>
              )}
              {tai && <tr><td style={{ ...td, textAlign: "center", color: T.sub, padding: 24 }} colSpan={6}>Đang tải hàng chờ...</td></tr>}
            </tbody>
          </table>
        </Card>

        {dangChon && (
          <PanelXuLy key={dangChon.id} yeuCau={dangChon} onDong={() => setDangMo(null)} onXong={nap} />
        )}
      </div>

      {popupGiuong && <PopupGiuong onClose={() => { setPopupGiuong(false); nap(); }} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
//  Trang khoa nội trú (bác sĩ): đối chiếu người bệnh và xác nhận đã tiếp nhận
// ---------------------------------------------------------------------------
export function NoiTruPage() {
  const [ds, setDs] = useState([]);
  const [loc, setLoc] = useState("dang_dieu_tri");
  const [q, setQ] = useState("");
  const [tai, setTai] = useState(true);
  const [loi, setLoi] = useState(null);
  const [ok, setOk] = useState(null);
  const [dangNhan, setDangNhan] = useState(null);

  const nap = useCallback(async () => {
    setLoi(null);
    try { setDs(await api.noiTru({ trang_thai: loc, q: q.trim() })); }
    catch (e) { setLoi(e.message); } finally { setTai(false); }
  }, [loc, q]);
  useEffect(() => { setTai(true); nap(); }, [nap]);
  // Ca mới lễ tân bàn giao phải tự hiện lên màn hình khoa
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) nap(); }, 15000);
    return () => clearInterval(t);
  }, [nap]);

  const xacNhan = async (d) => {
    setDangNhan(d.id); setLoi(null); setOk(null);
    try {
      await api.noiTruKhoaNhan(d.id);
      setOk(`Đã tiếp nhận ${d.ho_so ? d.ho_so.ho_ten : ""} tại khoa — số vào viện ${d.so_vao_vien}.`);
      nap();
    } catch (e) { setLoi(e.message); } finally { setDangNhan(null); }
  };

  return (
    <div>
      <PageTitle title="Người bệnh nội trú" sub="Người bệnh được lễ tân bàn giao về khoa. Đối chiếu tối thiểu hai thông tin định danh trước khi xác nhận tiếp nhận." />

      <div style={{ display: "flex", gap: 9, flexWrap: "wrap", marginBottom: 14 }}>
        {[["dang_dieu_tri", "Đang điều trị"], ["da_ra_vien", "Đã ra viện"]].map(([k, l]) => (
          <Btn key={k} kind={loc === k ? "mint" : "ghost"} size="sm" onClick={() => setLoc(k)}>{l}</Btn>
        ))}
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search size={15} style={{ position: "absolute", left: 11, top: 11, color: T.sub }} />
          <input style={{ ...inp, paddingLeft: 32, width: "100%" }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo tên, mã bệnh nhân hoặc số vào viện" />
        </div>
      </div>

      {loi && <div style={{ background: "#FDECEA", color: "#C0392B", fontSize: 13.5, padding: "10px 14px", borderRadius: 12, marginBottom: 14 }}>{loi}</div>}
      {ok && <div style={{ background: T.mintSoft, color: T.mint, fontSize: 13.5, padding: "10px 14px", borderRadius: 12, marginBottom: 14 }}>{ok}</div>}

      <div style={{ display: "grid", gap: 12 }}>
        {ds.map((d) => (
          <Card key={d.id} style={{ padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
              <div style={{ minWidth: 240 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <b style={{ color: T.ink, fontSize: 15 }}>{d.ho_so ? d.ho_so.ho_ten : "—"}</b>
                  <Pill>{d.so_vao_vien}</Pill>
                  {d.yeu_cau && <Nhan map={UU_TIEN} k={d.yeu_cau.uu_tien} />}
                </div>
                <div style={{ fontSize: 12.5, color: T.sub, marginTop: 4 }}>
                  {d.ho_so ? d.ho_so.ma_benh_nhan : ""} · {tuoiText(d.ho_so && d.ho_so.ngay_sinh)} · {d.ho_so ? d.ho_so.gioi_tinh || "" : ""}
                </div>
                <div style={{ fontSize: 13.5, color: T.ink, marginTop: 8 }}>
                  {d.yeu_cau ? d.yeu_cau.chan_doan_chinh : ""}
                  {d.yeu_cau && d.yeu_cau.ly_do ? <span style={{ color: T.sub }}> — {d.yeu_cau.ly_do}</span> : null}
                </div>
                {d.yeu_cau && d.yeu_cau.canh_bao && (
                  <div style={{ marginTop: 8, display: "flex", gap: 7, background: "#FDECEA", color: "#C0392B", padding: "8px 11px", borderRadius: 10, fontSize: 13 }}>
                    <AlertTriangle size={15} style={{ flexShrink: 0 }} /> {d.yeu_cau.canh_bao}
                  </div>
                )}
              </div>
              <div style={{ textAlign: "right", minWidth: 210 }}>
                <div style={{ fontSize: 13.5, color: T.ink }}>
                  {d.khoa ? d.khoa.ten_khoa : "—"} · Giường {tenGiuong(d.giuong)}
                </div>
                <div style={{ fontSize: 12.5, color: T.sub, marginTop: 3 }}>
                  Vào {fmtGio(d.thoi_gian_vao)} · {DOI_TUONG[d.doi_tuong_tt]}
                  {d.yeu_cau ? ` · ${DI_CHUYEN[d.yeu_cau.ho_tro_di_chuyen] || ""}` : ""}
                </div>
                <div style={{ marginTop: 10, display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                  {d.thoi_gian_khoa_nhan
                    ? <Pill tone={T.mint} soft={T.mintSoft}><CheckCircle2 size={13} /> Đã tiếp nhận {fmtGio(d.thoi_gian_khoa_nhan)}{d.nguoi_khoa_nhan ? ` · ${d.nguoi_khoa_nhan}` : ""}</Pill>
                    : <Btn kind="mint" size="sm" disabled={dangNhan === d.id} onClick={() => xacNhan(d)}>
                        <CheckCircle2 size={15} /> {dangNhan === d.id ? "Đang lưu..." : "Đã tiếp nhận tại khoa"}
                      </Btn>}
                  {d.trang_thai === "da_ra_vien" && <Pill tone={T.sub} soft={T.bg}>Đã ra viện {fmtGio(d.thoi_gian_ra)}</Pill>}
                </div>
              </div>
            </div>
          </Card>
        ))}
        {!tai && ds.length === 0 && (
          <Card style={{ padding: 30, textAlign: "center", color: T.sub, fontSize: 14 }}>
            <BedDouble size={24} style={{ opacity: .5 }} />
            <div style={{ marginTop: 8 }}>Khoa chưa có người bệnh nội trú ở mục này.</div>
          </Card>
        )}
        {tai && <Card style={{ padding: 24, textAlign: "center", color: T.sub }}>Đang tải danh sách nội trú...</Card>}
      </div>
    </div>
  );
}
