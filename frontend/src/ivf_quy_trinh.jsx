import React, { useState, useEffect } from "react";
import {
  FlaskConical, ArrowLeft, Search, User, CheckCircle2, Circle, Plus, ChevronRight,
  Save, Stethoscope, Baby, Sparkles, Lock,
} from "lucide-react";
import { T, store, api, useNav, Btn, Card, Pill, PageTitle, input } from "./shared";

// ============================================================================
//  HỖ TRỢ SINH SẢN (IVF) — hồ sơ điều trị hiếm muộn theo TỪNG BỆNH NHÂN.
//  Giai đoạn 1: KHÁM HIẾM MUỘN (8 bước) → Giai đoạn 2: LÀM IVF (10 bước).
//  IVF là bước tiếp theo sau khám & tư vấn; có thể chọn "làm thẳng IVF".
//  Tiến độ lưu trong database (bảng ho_so_ivf). Chỉ bác sĩ khoa IVF thao tác.
// ============================================================================

const BUOC_KHAM = [
  "Đăng ký và tiếp nhận", "Khai thác tiền sử hai vợ chồng", "Khám người vợ", "Khám người chồng",
  "Siêu âm và xét nghiệm", "Tổng hợp kết quả", "Tư vấn phương pháp điều trị", "Lập kế hoạch theo dõi",
];
const BUOC_IVF = [
  "Tư vấn và đánh giá", "Kích thích buồng trứng", "Theo dõi nang noãn", "Chọc hút noãn",
  "Lấy và xử lý tinh trùng", "Thụ tinh IVF hoặc ICSI", "Nuôi cấy và đánh giá phôi", "Chuyển phôi",
  "Thử thai", "Theo dõi thai sớm",
];
const GIAI_DOAN = {
  kham_hiem_muon: { l: "Đang khám hiếm muộn", tone: T.sky, soft: T.skySoft },
  ivf: { l: "Đang làm IVF", tone: T.lav, soft: T.lavSoft },
  hoan_tat: { l: "Hoàn tất", tone: T.mint, soft: T.mintSoft },
};
const inp = { ...input, padding: "10px 12px", fontSize: 14, borderRadius: 10 };
const fmtNgay = (d) => { const x = new Date(d); return isNaN(x) ? "" : x.toLocaleDateString("vi-VN"); };

export default function IvfProcess() {
  const { online } = useNav();
  const live = online && !!store.token;
  const [data, setData] = useState(null);   // { la_ivf, danh_sach }
  const [sel, setSel] = useState(null);      // hồ sơ đang xem
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState(null);

  const load = () => {
    if (!live) return;
    setErr(null);
    api.ivfList().then((r) => setData(r && typeof r === "object" ? r : { la_ivf: false, danh_sach: [] }))
      .catch((e) => { setErr(e.message); setData({ la_ivf: false, danh_sach: [] }); });
  };
  useEffect(load, [live]);

  if (!live) {
    return (<div><PageTitle title="Hỗ trợ sinh sản (IVF)" sub="Quy trình khám hiếm muộn và làm IVF theo từng bệnh nhân." />
      <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>Cần đăng nhập tài khoản bác sĩ.</Card></div>);
  }
  if (!data) return (<div><PageTitle title="Hỗ trợ sinh sản (IVF)" /><div style={{ color: T.sub }}>Đang tải hồ sơ IVF...</div></div>);
  if (!data.la_ivf) {
    return (<div><PageTitle title="Hỗ trợ sinh sản (IVF)" sub="Quy trình khám hiếm muộn và làm IVF." />
      <Card style={{ padding: 44, textAlign: "center", color: T.sub }}>
        <FlaskConical size={34} color={T.sub} style={{ opacity: .5, marginBottom: 10 }} />
        <div style={{ fontSize: 14.5 }}>Mục này dành cho bác sĩ khoa <b>Hỗ trợ sinh sản (IVF)</b>.</div>
      </Card></div>);
  }

  if (adding) return <NewHoSo onBack={() => setAdding(false)} onCreated={(h) => { setAdding(false); setSel(h); load(); }} />;
  if (sel) return <HoSoDetail hs={sel} onBack={() => { setSel(null); load(); }} onChanged={setSel} />;

  const list = data.danh_sach || [];
  return (
    <div>
      <PageTitle title="Hỗ trợ sinh sản (IVF)" sub="Quy trình khám hiếm muộn và làm IVF theo từng bệnh nhân — tiến độ lưu vào hệ thống."
        action={<Btn kind="lav" onClick={() => setAdding(true)}><Plus size={16} /> Mở hồ sơ IVF mới</Btn>} />
      {err && <Card style={{ padding: 16, marginBottom: 14, background: "#FDECEA", border: "none", color: "#C0392B", fontSize: 14 }}>{err}</Card>}
      {list.length === 0 && <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>Chưa có hồ sơ IVF nào — bấm "Mở hồ sơ IVF mới" để bắt đầu.</Card>}
      <div style={{ display: "grid", gap: 12 }}>
        {list.map((h) => {
          const gd = GIAI_DOAN[h.giai_doan] || GIAI_DOAN.kham_hiem_muon;
          const nk = (h.buoc_kham || []).length, ni = (h.buoc_ivf || []).length;
          return (
            <Card key={h.id} hover onClick={() => setSel(h)} style={{ padding: 18, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", cursor: "pointer" }}>
              <span style={{ width: 46, height: 46, borderRadius: 14, background: T.lavSoft, color: T.lav, display: "grid", placeItems: "center", flexShrink: 0 }}><User size={21} /></span>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontWeight: 800, color: T.ink, fontSize: 15.5 }}>{h.ho_so ? h.ho_so.ho_ten : "—"}</div>
                <div style={{ color: T.sub, fontSize: 13, marginTop: 4 }}>
                  {h.ho_so ? h.ho_so.ma_benh_nhan : ""}{h.lam_thang_ivf ? " · Làm thẳng IVF" : ""} · Cập nhật {fmtNgay(h.ngay_cap_nhat)}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <Pill tone={gd.tone} soft={gd.soft}>{gd.l}</Pill>
                <span style={{ fontSize: 12.5, color: T.sub }}>Khám {nk}/8 · IVF {ni}/10</span>
              </div>
              <ChevronRight size={18} color={T.sub} />
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Mở hồ sơ mới: chọn bệnh nhân + lựa chọn làm thẳng IVF ----------
function NewHoSo({ onBack, onCreated }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState(null);
  const [chon, setChon] = useState(null);   // bệnh nhân được chọn
  const [thang, setThang] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const tim = () => {
    setErr(null);
    api.patients(q.trim()).then((r) => setRes(Array.isArray(r) ? r : []))
      .catch((e) => { setErr(e.message); setRes([]); });
  };

  const tao = async () => {
    if (!chon) { setErr("Chọn một bệnh nhân."); return; }
    setBusy(true); setErr(null);
    try { const h = await api.ivfStart({ ho_so_id: chon.id, lam_thang_ivf: thang }); onCreated(h); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div>
      <button onClick={onBack} style={backBtn}><ArrowLeft size={16} /> Danh sách hồ sơ IVF</button>
      <PageTitle title="Mở hồ sơ IVF mới" sub="Chọn bệnh nhân để bắt đầu quy trình khám hiếm muộn hoặc làm thẳng IVF." />
      {err && <Card style={{ padding: 14, marginBottom: 14, background: "#FDECEA", border: "none", color: "#C0392B", fontSize: 14 }}>{err}</Card>}

      <Card style={{ padding: 16, marginBottom: 16, display: "flex", gap: 10, alignItems: "center" }}>
        <Search size={18} color={T.sub} />
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && tim()} placeholder="Tìm bệnh nhân theo tên, mã BN, số điện thoại..." style={{ flex: 1, border: "none", outline: "none", fontSize: 14.5, fontFamily: "inherit", background: "transparent", padding: "6px 0" }} />
        <Btn kind="ghost" onClick={tim}>Tìm</Btn>
      </Card>

      {res && res.length === 0 && <Card style={{ padding: 24, textAlign: "center", color: T.sub, marginBottom: 16 }}>Không tìm thấy bệnh nhân.</Card>}
      {res && res.length > 0 && (
        <div style={{ display: "grid", gap: 10, marginBottom: 18 }}>
          {res.slice(0, 20).map((p) => (
            <Card key={p.id} onClick={() => setChon(p)} style={{ padding: 14, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", border: chon && chon.id === p.id ? `2px solid ${T.lav}` : `1px solid ${T.line}` }}>
              {chon && chon.id === p.id ? <CheckCircle2 size={20} color={T.lav} /> : <Circle size={20} color={T.line} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: T.ink, fontSize: 14.5 }}>{p.ho_ten}</div>
                <div style={{ fontSize: 12.5, color: T.sub, marginTop: 2 }}>{p.ma_benh_nhan}{p.sdt ? ` · ${p.sdt}` : ""}{p.ngay_sinh ? ` · ${fmtNgay(p.ngay_sinh)}` : ""}</div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {chon && (
        <Card style={{ padding: 20 }}>
          <div style={{ fontSize: 14.5, color: T.ink, marginBottom: 14 }}>Bắt đầu quy trình cho <b>{chon.ho_ten}</b> ({chon.ma_benh_nhan}):</div>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", fontSize: 14, color: T.ink, marginBottom: 18 }}>
            <input type="checkbox" checked={thang} onChange={(e) => setThang(e.target.checked)} style={{ width: 17, height: 17, accentColor: T.lav, marginTop: 1 }} />
            <span><b>Làm thẳng IVF</b> — bệnh nhân chọn tiến hành IVF ngay, nhưng vẫn phải hoàn thành khám lâm sàng và cận lâm sàng (đủ 8 bước) trước khi mở giai đoạn IVF.</span>
          </label>
          <Btn kind="lav" disabled={busy} onClick={tao}>
            {busy ? "Đang tạo..." : thang ? "Mở hồ sơ (ưu tiên làm IVF)" : "Mở hồ sơ khám hiếm muộn"}
          </Btn>
        </Card>
      )}
    </div>
  );
}

// ---------- Chi tiết hồ sơ: checklist 2 giai đoạn ----------
function HoSoDetail({ hs, onBack, onChanged }) {
  const [h, setH] = useState(hs);
  const [ghi, setGhi] = useState(hs.ghi_chu || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const apply = (moi) => { setH(moi); onChanged(moi); };
  const run = async (fn) => {
    setBusy(true); setErr(null);
    try { const moi = await fn(); apply(moi); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const toggle = (giai_doan, buoc) => run(() => api.ivfToggleStep(h.id, { giai_doan, buoc }));
  const datGiaiDoan = (giai_doan) => run(() => api.ivfSetPhase(h.id, { giai_doan }));
  const luuGhi = () => run(() => api.ivfNote(h.id, { ghi_chu: ghi }));

  const gd = GIAI_DOAN[h.giai_doan] || GIAI_DOAN.kham_hiem_muon;
  const bn = h.ho_so || {};
  const khamXong = (h.buoc_kham || []).length, ivfXong = (h.buoc_ivf || []).length;

  const Phase = ({ giai_doan, icon: Icon, tieu_de, buoc, tong, tone, soft, active, disabled, khoaMsg }) => (
    <Card style={{ padding: 20, opacity: disabled ? 0.6 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <span style={{ width: 42, height: 42, borderRadius: 13, background: soft, color: tone, display: "grid", placeItems: "center" }}><Icon size={20} /></span>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontWeight: 800, color: T.ink, fontSize: 16 }}>{tieu_de}</div>
          <div style={{ fontSize: 12.5, color: T.sub }}>{buoc.length}/{tong} bước hoàn thành</div>
        </div>
        {active && <Pill tone={tone} soft={soft}>Giai đoạn hiện tại</Pill>}
      </div>
      {disabled && khoaMsg && <div style={{ fontSize: 13.5, color: T.gold, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}><Lock size={14} /> {khoaMsg}</div>}
      <div style={{ display: "grid", gap: 8 }}>
        {(giai_doan === "kham_hiem_muon" ? BUOC_KHAM : BUOC_IVF).map((label, idx) => {
          const n = idx + 1;
          const done = buoc.includes(n);
          return (
            <button key={n} disabled={busy || disabled} onClick={() => toggle(giai_doan, n)}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: 12, border: `1px solid ${done ? tone : T.line}`,
                background: done ? soft : T.surface, cursor: busy || disabled ? "default" : "pointer", fontFamily: "inherit", textAlign: "left", width: "100%" }}>
              <span style={{ width: 26, height: 26, borderRadius: 8, background: done ? tone : T.bg, color: done ? "#fff" : T.sub, display: "grid", placeItems: "center", fontWeight: 800, fontSize: 12.5, flexShrink: 0 }}>{n}</span>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: T.ink }}>{label}</span>
              {done ? <CheckCircle2 size={18} color={tone} /> : <Circle size={18} color={T.line} />}
            </button>
          );
        })}
      </div>
    </Card>
  );

  return (
    <div>
      <button onClick={onBack} style={backBtn}><ArrowLeft size={16} /> Danh sách hồ sơ IVF</button>
      <PageTitle title={bn.ho_ten || "Hồ sơ IVF"} sub={`${bn.ma_benh_nhan || ""}${bn.gioi_tinh ? ` · ${bn.gioi_tinh}` : ""}${bn.ngay_sinh ? ` · ${fmtNgay(bn.ngay_sinh)}` : ""}`} />
      {err && <Card style={{ padding: 14, marginBottom: 14, background: "#FDECEA", border: "none", color: "#C0392B", fontSize: 14 }}>{err}</Card>}

      {/* Thanh trạng thái + hành động chuyển giai đoạn */}
      <Card style={{ padding: 16, marginBottom: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Pill tone={gd.tone} soft={gd.soft}><Sparkles size={13} /> {gd.l}</Pill>
        <span style={{ fontSize: 13, color: T.sub }}>Khám hiếm muộn {khamXong}/8 · IVF {ivfXong}/10</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          {h.giai_doan === "kham_hiem_muon" &&
            <Btn kind="lav" size="sm" disabled={busy || khamXong < 8} onClick={() => datGiaiDoan("ivf")}><FlaskConical size={14} /> Chuyển sang IVF</Btn>}
          {h.giai_doan === "ivf" && <>
            <Btn kind="ghost" size="sm" disabled={busy} onClick={() => datGiaiDoan("kham_hiem_muon")}>Quay lại khám</Btn>
            <Btn kind="mint" size="sm" disabled={busy} onClick={() => datGiaiDoan("hoan_tat")}><CheckCircle2 size={14} /> Đánh dấu hoàn tất</Btn>
          </>}
          {h.giai_doan === "hoan_tat" &&
            <Btn kind="ghost" size="sm" disabled={busy} onClick={() => datGiaiDoan("ivf")}>Mở lại giai đoạn IVF</Btn>}
        </div>
      </Card>

      {h.giai_doan === "kham_hiem_muon" && khamXong < 8 && (
        <div style={{ fontSize: 13, color: T.gold, margin: "-4px 2px 14px", display: "flex", alignItems: "center", gap: 6 }}>
          <Lock size={13} /> Hoàn thành đủ 8 bước khám lâm sàng và cận lâm sàng ({khamXong}/8) để mở giai đoạn IVF.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, marginBottom: 16 }}>
        <Phase giai_doan="kham_hiem_muon" icon={Stethoscope} tieu_de="Giai đoạn 1 — Khám lâm sàng và cận lâm sàng"
          buoc={h.buoc_kham || []} tong={8} tone={T.sky} soft={T.skySoft}
          active={h.giai_doan === "kham_hiem_muon"} disabled={false} />
        <Phase giai_doan="ivf" icon={Baby} tieu_de="Giai đoạn 2 — Làm IVF"
          buoc={h.buoc_ivf || []} tong={10} tone={T.lav} soft={T.lavSoft}
          active={h.giai_doan === "ivf"} disabled={khamXong < 8}
          khoaMsg="Cần hoàn thành đủ 8 bước khám lâm sàng và cận lâm sàng trước khi làm IVF." />
      </div>

      <Card style={{ padding: 20 }}>
        <div style={{ fontWeight: 800, color: T.ink, fontSize: 15, marginBottom: 10 }}>Ghi chú điều trị</div>
        <textarea rows={3} value={ghi} onChange={(e) => setGhi(e.target.value)} placeholder="Ghi chú phác đồ, diễn biến, hẹn lịch..." style={{ ...inp, resize: "vertical", width: "100%", boxSizing: "border-box" }} />
        <div style={{ marginTop: 12 }}><Btn kind="mint" disabled={busy} onClick={luuGhi}><Save size={15} /> Lưu ghi chú</Btn></div>
      </Card>
    </div>
  );
}

const backBtn = { background: "none", border: "none", color: T.sub, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", gap: 6, marginBottom: 14, fontFamily: "inherit" };
