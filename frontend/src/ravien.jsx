import React, { useState, useEffect } from "react";
import { HeartPulse, Search, User, CheckCircle2, Circle, Save, X } from "lucide-react";
import { T, store, api, useNav, Btn, Card, Pill, PageTitle, input } from "./shared";

// ============================================================================
//  RA VIỆN (cổng BÁC SĨ) — bác sĩ điều trị lập y lệnh ra viện + kết luận tình
//  trạng sức khỏe cho bệnh nhân. Đây là điều kiện để lễ tân được tích "Đăng ký
//  ra viện (ĐKRV)" ở phiếu khám (kèm thanh toán đủ viện phí + tích TTRV).
//  Việc lập y lệnh ra viện dùng CỬA SỔ POPUP (modal), không rời danh sách.
//    POST /doctor/ra-vien   GET /doctor/ra-vien   PATCH /doctor/ra-vien/:id/huy
// ============================================================================

const inp = { ...input, padding: "10px 12px", fontSize: 14, borderRadius: 10 };
const fmtNgay = (d) => { const x = new Date(d); return isNaN(x) ? "" : x.toLocaleDateString("vi-VN"); };
const todayISO = () => new Date().toLocaleDateString("en-CA");

// Tình trạng ra viện — hai giá trị đầu là "an toàn về nhà" (mở khóa ĐKRV)
const TINH_TRANG = [
  { v: "hoi_phuc", l: "Hồi phục", an_toan: true },
  { v: "qua_nguy_hiem", l: "Qua giai đoạn nguy hiểm", an_toan: true },
  { v: "chuyen_vien", l: "Chuyển viện", an_toan: false },
  { v: "nang_hon", l: "Nặng hơn", an_toan: false },
  { v: "tu_vong", l: "Tử vong", an_toan: false },
];

// hoSoBanDau: id hồ sơ bệnh nhân cần xử lý, truyền khi cổng khác mở tab này qua
// liên kết (?cong=bac-si&tab=ravien&hs=...) — tự mở sẵn form với đúng bệnh nhân.
export default function RaVienBacSi({ hoSoBanDau }) {
  const { online } = useNav();
  const live = online && !!store.token;
  const [list, setList] = useState(null);
  const [adding, setAdding] = useState(!!hoSoBanDau);
  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = () => {
    if (!live) return;
    setErr(null);
    api.raVienList().then((r) => setList(Array.isArray(r) ? r : [])).catch((e) => { setErr(e.message); setList([]); });
  };
  useEffect(load, [live]);

  const huy = async (r) => {
    setBusyId(r.id); setErr(null); setMsg(null);
    try { await api.cancelRaVien(r.id); setMsg(`Đã hủy y lệnh ra viện của ${r.ho_so ? r.ho_so.ho_ten : `#${r.id}`}.`); load(); }
    catch (e) { setErr(e.message); }
    finally { setBusyId(null); }
  };

  if (!live) {
    return (<div><PageTitle title="Ra viện" sub="Lập y lệnh ra viện và kết luận sức khỏe cho bệnh nhân." />
      <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>Cần đăng nhập tài khoản bác sĩ.</Card></div>);
  }

  const data = list || [];
  return (
    <div>
      <PageTitle title="Ra viện" sub="Bác sĩ điều trị lập y lệnh ra viện + kết luận tình trạng sức khỏe — mở khóa Đăng ký ra viện cho lễ tân."
        action={<Btn kind="primary" onClick={() => setAdding(true)}><HeartPulse size={16} /> Lập y lệnh ra viện</Btn>} />

      {msg && <Card style={{ padding: 13, marginBottom: 14, border: "none", background: T.mintSoft, color: "#1E7A5F", fontSize: 14 }}>{msg}</Card>}
      {err && <Card style={{ padding: 13, marginBottom: 14, border: "none", background: "#FDECEA", color: "#C0392B", fontSize: 14 }}>{err}</Card>}

      {!list && <div style={{ color: T.sub, fontSize: 14 }}>Đang tải danh sách…</div>}
      {list && data.length === 0 && (
        <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>
          <HeartPulse size={26} style={{ color: T.line, marginBottom: 10 }} /><br />
          Chưa có y lệnh ra viện nào. Bấm "Lập y lệnh ra viện" để bắt đầu.
        </Card>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        {data.map((r) => {
          const huyRoi = r.trang_thai === "da_huy";
          const at = r.an_toan_ve_nha;
          return (
            <Card key={r.id} style={{ padding: 18, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", opacity: huyRoi ? 0.6 : 1 }}>
              <span style={{ width: 46, height: 46, borderRadius: 14, background: at ? T.mintSoft : T.goldSoft, color: at ? T.mint : T.gold, display: "grid", placeItems: "center", flexShrink: 0 }}><User size={21} /></span>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 800, color: T.ink, fontSize: 15.5 }}>{r.ho_so ? r.ho_so.ho_ten : "—"}</span>
                  {huyRoi
                    ? <Pill tone="#C0392B" soft="#FDECEA">Đã hủy</Pill>
                    : <Pill tone={at ? T.mint : T.gold} soft={at ? T.mintSoft : T.goldSoft}>{r.nhan_tinh_trang}{at ? " · an toàn về nhà" : ""}</Pill>}
                </div>
                <div style={{ color: T.sub, fontSize: 13, marginTop: 4 }}>
                  {r.ho_so ? r.ho_so.ma_benh_nhan : ""}{r.ngay_ra_vien ? ` · Ra viện ${fmtNgay(r.ngay_ra_vien)}` : ""}{r.bac_si ? ` · BS ${r.bac_si}` : ""}
                </div>
                {r.ket_luan_suc_khoe && <div style={{ fontSize: 13, color: T.ink, marginTop: 5, whiteSpace: "pre-wrap" }}>🩺 {r.ket_luan_suc_khoe}</div>}
              </div>
              {!huyRoi && (
                <Btn kind="ghost" size="sm" disabled={busyId === r.id} onClick={() => huy(r)}><X size={14} /> Hủy</Btn>
              )}
            </Card>
          );
        })}
      </div>

      {adding && <PhieuMoiModal hoSoBanDau={hoSoBanDau} onClose={() => setAdding(false)} onDone={(m) => { setAdding(false); setMsg(m); load(); }} />}
    </div>
  );
}

// ---------- POPUP: lập phiếu ra viện (tìm bệnh nhân + tình trạng + kết luận) ----------
function PhieuMoiModal({ hoSoBanDau, onClose, onDone }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState(null);
  const [chon, setChon] = useState(null);
  const [f, setF] = useState({ tinh_trang: "hoi_phuc", ket_luan_suc_khoe: "", chan_doan_ra_vien: "", ngay_ra_vien: todayISO() });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  // Được mở kèm bệnh nhân cần xử lý: tự tìm và chọn sẵn hồ sơ đó
  useEffect(() => {
    if (!hoSoBanDau) return;
    let huy = false;
    api.patients()
      .then((r) => {
        if (huy) return;
        const bn = (Array.isArray(r) ? r : []).find((h) => String(h.id) === String(hoSoBanDau));
        if (bn) setChon(bn);
        else setErr("Không tìm thấy hồ sơ bệnh nhân được chuyển sang. Hãy tìm thủ công bên dưới.");
      })
      .catch((e) => { if (!huy) setErr(e.message); });
    return () => { huy = true; };
  }, [hoSoBanDau]);

  const tim = () => {
    setErr(null);
    api.patients(q.trim()).then((r) => setRes(Array.isArray(r) ? r : [])).catch((e) => { setErr(e.message); setRes([]); });
  };
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const lap = async () => {
    if (!chon) { setErr("Chọn một bệnh nhân."); return; }
    setBusy(true); setErr(null);
    try {
      const r = await api.createRaVien({ ho_so_id: chon.id, ...f });
      onDone(`Đã lập y lệnh ra viện cho ${r.ho_so ? r.ho_so.ho_ten : chon.ho_ten} — ${r.nhan_tinh_trang}.`);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const tt = TINH_TRANG.find((t) => t.v === f.tinh_trang);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "grid", placeItems: "center", zIndex: 70, padding: 16 }}>
      <Card onClick={(e) => e.stopPropagation()} style={{ padding: 0, maxWidth: 720, width: "100%", maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: `1px solid ${T.line}` }}>
          <div style={{ fontWeight: 800, color: T.ink, fontSize: 17, display: "flex", alignItems: "center", gap: 8 }}>
            <HeartPulse size={19} color={T.peach} /> Lập y lệnh ra viện
          </div>
          <button onClick={onClose} title="Đóng" style={{ background: "none", border: "none", cursor: "pointer", color: T.sub, padding: 2 }}><X size={20} /></button>
        </div>

        {/* Nội dung (cuộn được) */}
        <div style={{ padding: 22, overflowY: "auto" }}>
          {err && <div style={{ background: "#FDECEA", color: "#C0392B", fontSize: 13.5, padding: "10px 14px", borderRadius: 12, marginBottom: 14 }}>{err}</div>}

          {!chon ? (
            <>
              <div style={{ display: "flex", gap: 10, alignItems: "center", border: `1.5px solid ${T.line}`, borderRadius: 12, padding: "0 12px", marginBottom: 14 }}>
                <Search size={17} color={T.sub} />
                <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && tim()} placeholder="Tìm bệnh nhân theo tên, mã BN, SĐT…" style={{ flex: 1, border: "none", outline: "none", padding: "11px 0", fontSize: 14, fontFamily: "inherit", background: "transparent" }} />
                <Btn kind="ghost" size="sm" onClick={tim}>Tìm</Btn>
              </div>
              {res && res.length === 0 && <div style={{ fontSize: 13.5, color: T.sub }}>Không tìm thấy bệnh nhân.</div>}
              {res && res.length > 0 && (
                <div style={{ display: "grid", gap: 8 }}>
                  {res.slice(0, 20).map((p) => (
                    <button key={p.id} onClick={() => setChon(p)} style={{ textAlign: "left", display: "flex", alignItems: "center", gap: 10, border: `1.5px solid ${T.line}`, borderRadius: 11, padding: "10px 13px", background: "#fff", cursor: "pointer", fontFamily: "inherit" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = T.bg)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}>
                      <Circle size={18} color={T.line} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: T.ink, fontSize: 14 }}>{p.ho_ten}</div>
                        <div style={{ fontSize: 12.5, color: T.sub, marginTop: 2 }}>{p.ma_benh_nhan}{p.sdt ? ` · ${p.sdt}` : ""}{p.ngay_sinh ? ` · ${fmtNgay(p.ngay_sinh)}` : ""}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {res === null && <div style={{ fontSize: 13, color: T.sub }}>Nhập tên hoặc mã bệnh nhân rồi bấm "Tìm".</div>}
            </>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, background: T.peachSoft, borderRadius: 12, padding: "10px 14px", marginBottom: 16 }}>
                <CheckCircle2 size={18} color={T.peach} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: T.ink, fontSize: 14 }}>{chon.ho_ten}</div>
                  <div style={{ fontSize: 12.5, color: T.sub }}>{chon.ma_benh_nhan}</div>
                </div>
                <Btn kind="ghost" size="sm" onClick={() => setChon(null)}>Đổi bệnh nhân</Btn>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }} className="grid2">
                <label style={{ display: "block" }}>
                  <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 600, display: "block", marginBottom: 5 }}>Tình trạng ra viện *</span>
                  <select style={inp} value={f.tinh_trang} onChange={(e) => set("tinh_trang", e.target.value)}>
                    {TINH_TRANG.map((t) => <option key={t.v} value={t.v}>{t.l}{t.an_toan ? " (an toàn về nhà)" : ""}</option>)}
                  </select>
                </label>
                <label style={{ display: "block" }}>
                  <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 600, display: "block", marginBottom: 5 }}>Ngày ra viện</span>
                  <input type="date" style={inp} value={f.ngay_ra_vien} onChange={(e) => set("ngay_ra_vien", e.target.value)} />
                </label>
                <label style={{ display: "block", gridColumn: "span 2" }}>
                  <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 600, display: "block", marginBottom: 5 }}>Chẩn đoán ra viện</span>
                  <input style={inp} value={f.chan_doan_ra_vien} onChange={(e) => set("chan_doan_ra_vien", e.target.value)} placeholder="VD: Hậu sản thường, ổn định" />
                </label>
                <label style={{ display: "block", gridColumn: "span 2" }}>
                  <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 600, display: "block", marginBottom: 5 }}>Kết luận sức khỏe / lời dặn</span>
                  <textarea rows={3} style={{ ...inp, resize: "vertical" }} value={f.ket_luan_suc_khoe} onChange={(e) => set("ket_luan_suc_khoe", e.target.value)} placeholder="VD: Sức khỏe hồi phục tốt, đủ điều kiện xuất viện; tái khám sau 7 ngày." />
                </label>
              </div>
              <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 12, fontSize: 13, background: tt && tt.an_toan ? T.mintSoft : T.goldSoft, color: tt && tt.an_toan ? "#1E7A5F" : "#B5851B" }}>
                {tt && tt.an_toan
                  ? "Tình trạng an toàn về nhà — lễ tân sẽ được tích ĐKRV khi viện phí đã thu đủ và tích TTRV."
                  : "Tình trạng KHÔNG đủ an toàn về nhà — lễ tân sẽ không tích được ĐKRV với phiếu này."}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", padding: "14px 22px", borderTop: `1px solid ${T.line}` }}>
          <Btn kind="ghost" onClick={onClose}>Hủy</Btn>
          <Btn kind="primary" disabled={busy || !chon} onClick={lap}><Save size={15} /> {busy ? "Đang lưu…" : "Lưu y lệnh ra viện"}</Btn>
        </div>
      </Card>
    </div>
  );
}
