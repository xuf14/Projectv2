import React, { useState, useEffect } from "react";
import { ClipboardList, Clock, Plus, Stethoscope, User } from "lucide-react";
import { T, store, api, useNav, Btn, Card, Pill, PageTitle, input } from "./shared";

// ============================================================================
//  PHIẾU THEO DÕI ĐIỀU TRỊ — bác sĩ ghi diễn biến bệnh theo thời gian và chỉ định.
//  Chọn phiếu khám bệnh của bệnh nhân (liên kết từ thongtinbenhnhan), rồi thêm các
//  mốc diễn biến. Lưu vào bảng dien_bien_dieu_tri qua:
//    POST /treatment/progress, GET /treatment/progress/:phieuKhamId
// ============================================================================

const inp = { ...input, padding: "11px 13px", fontSize: 14, borderRadius: 11 };
const fmtNgay = (d) => { const x = new Date(d); return isNaN(x) ? "" : x.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); };

export default function PhieuDieuTri() {
  const { online } = useNav();
  const live = online && !!store.token;
  const [sheets, setSheets] = useState([]);
  const [phieuKhamId, setPhieuKhamId] = useState("");
  const [progress, setProgress] = useState([]);
  const [thoiDiem, setThoiDiem] = useState("");
  const [dienBien, setDienBien] = useState("");
  const [chiDinh, setChiDinh] = useState("");
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (live) api.examSheets().then((r) => setSheets(Array.isArray(r) ? r : [])).catch(() => {}); }, [live]);

  const loadProgress = (id) => {
    if (!id) { setProgress([]); return; }
    api.progressList(id).then((r) => setProgress(Array.isArray(r) ? r : [])).catch(() => setProgress([]));
  };
  useEffect(() => loadProgress(phieuKhamId), [phieuKhamId]);

  const sheet = sheets.find((s) => String(s.id) === String(phieuKhamId));

  const them = async () => {
    setMsg(null);
    if (!phieuKhamId) { setMsg({ type: "err", text: "Chọn bệnh nhân (phiếu khám) trước." }); return; }
    if (!dienBien.trim()) { setMsg({ type: "err", text: "Nhập diễn biến bệnh." }); return; }
    setSaving(true);
    try {
      await api.addProgress({ phieu_kham_id: phieuKhamId, thoi_diem: thoiDiem || undefined, dien_bien: dienBien, chi_dinh: chiDinh || undefined });
      setThoiDiem(""); setDienBien(""); setChiDinh("");
      setMsg({ type: "ok", text: "Đã ghi diễn biến điều trị vào hệ thống." });
      loadProgress(phieuKhamId);
    } catch (e) { setMsg({ type: "err", text: e.message }); }
    finally { setSaving(false); }
  };

  if (!live) {
    return (<div><PageTitle title="Phiếu theo dõi điều trị" sub="Ghi diễn biến bệnh của bệnh nhân." />
      <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>Cần đăng nhập tài khoản bác sĩ.</Card></div>);
  }

  return (
    <div>
      <PageTitle title="Phiếu theo dõi điều trị" sub="Ghi lại diễn biến bệnh theo thời gian và chỉ định — liên kết với phiếu khám của bệnh nhân." />

      {msg && <Card style={{ padding: 14, marginBottom: 16, border: "none", fontSize: 14,
        background: msg.type === "ok" ? T.mintSoft : "#FDECEA", color: msg.type === "ok" ? "#2F8F73" : "#C0392B" }}>{msg.text}</Card>}

      <Card style={{ padding: 20, marginBottom: 16 }}>
        <label style={{ display: "block", maxWidth: 520 }}>
          <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 600, display: "block", marginBottom: 5 }}>Bệnh nhân (phiếu khám)</span>
          <select style={inp} value={phieuKhamId} onChange={(e) => setPhieuKhamId(e.target.value)}>
            <option value="">— Chọn phiếu khám bệnh —</option>
            {sheets.map((s) => <option key={s.id} value={s.id}>{s.ten_bn}{s.ma_kcb ? ` · ${s.ma_kcb}` : ` · #${s.id}`}{s.ma_benh_nhan ? ` · ${s.ma_benh_nhan}` : ""}</option>)}
          </select>
        </label>
        {sheet && <div style={{ marginTop: 12, padding: "12px 14px", background: T.bg, borderRadius: 12, fontSize: 13.5, color: T.sub, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, background: T.skySoft, color: T.sky, display: "grid", placeItems: "center" }}><User size={17} /></span>
          <span><b style={{ color: T.ink }}>{sheet.ten_bn}</b>{sheet.chuyen_khoa ? ` · ${sheet.chuyen_khoa}` : ""}{sheet.chan_doan_so_bo ? ` — CĐ: ${sheet.chan_doan_so_bo}` : ""}</span>
        </div>}
      </Card>

      {phieuKhamId && (
        <Card style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ fontWeight: 800, color: T.ink, fontSize: 15, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}><Plus size={17} color={T.sky} /> Thêm diễn biến</div>
          <div style={{ display: "grid", gap: 12 }}>
            <label style={{ display: "block", maxWidth: 280 }}>
              <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 600, display: "block", marginBottom: 5 }}>Thời điểm (giờ/ngày lâm sàng)</span>
              <input style={inp} value={thoiDiem} onChange={(e) => setThoiDiem(e.target.value)} placeholder="VD: 30/06 13:30" />
            </label>
            <label style={{ display: "block" }}>
              <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 600, display: "block", marginBottom: 5 }}>Diễn biến bệnh *</span>
              <textarea style={{ ...inp, resize: "vertical" }} rows={3} value={dienBien} onChange={(e) => setDienBien(e.target.value)} placeholder="Toàn trạng, dấu hiệu sinh tồn, triệu chứng..." />
            </label>
            <label style={{ display: "block" }}>
              <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 600, display: "block", marginBottom: 5 }}>Chỉ định</span>
              <textarea style={{ ...inp, resize: "vertical" }} rows={2} value={chiDinh} onChange={(e) => setChiDinh(e.target.value)} placeholder="Thuốc, xét nghiệm, theo dõi..." />
            </label>
            <div><Btn kind="mint" disabled={saving} onClick={them}><Plus size={16} /> {saving ? "Đang lưu..." : "Ghi diễn biến"}</Btn></div>
          </div>
        </Card>
      )}

      {phieuKhamId && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.line}`, fontWeight: 800, color: T.ink, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}><ClipboardList size={17} color={T.sky} /> Diễn biến điều trị ({progress.length})</div>
          {progress.length === 0 ? (
            <div style={{ padding: 36, textAlign: "center", color: T.sub }}>Chưa có diễn biến nào cho bệnh nhân này.</div>
          ) : progress.map((p, i) => (
            <div key={p.id} style={{ display: "grid", gridTemplateColumns: "180px 1.4fr 1fr", gap: 16, padding: "16px 20px", borderBottom: i < progress.length - 1 ? `1px solid ${T.line}55` : "none" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, color: T.ink, fontSize: 13.5 }}><Clock size={14} color={T.sky} /> {p.thoi_diem || "—"}</div>
                <div style={{ fontSize: 12, color: T.sub, marginTop: 4 }}>{fmtNgay(p.ngay_tao)}</div>
                {p.bac_si && <div style={{ fontSize: 12, color: T.sub, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}><Stethoscope size={12} /> {p.bac_si.ho_ten}</div>}
              </div>
              <div style={{ fontSize: 13.5, color: T.ink, whiteSpace: "pre-wrap" }}>{p.dien_bien}</div>
              <div style={{ fontSize: 13.5, color: T.sub, whiteSpace: "pre-wrap" }}>{p.chi_dinh || "—"}</div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
