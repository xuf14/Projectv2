import React, { useState, useEffect } from "react";
import {
  CalendarClock, Search, Stethoscope, Phone, AlertTriangle, CheckCircle2, RotateCcw, Users,
} from "lucide-react";
import { T, store, api, useNav, Btn, Card, Pill, PageTitle, input } from "./shared";

// ============================================================================
//  TÁI KHÁM — dùng chung hai cổng, cùng một nguồn dữ liệu (cột ngay_tai_kham
//  trên hồ sơ bệnh nhân, do lễ tân note ở trang Tiếp đón):
//   - TaiKham (mặc định, LỄ TÂN): toàn bộ lịch tái khám, lọc theo khoảng ngày,
//     bác sĩ phụ trách và từ khóa;  GET /reception/revisits
//   - TaiKhamBacSi (BÁC SĨ): chỉ bệnh nhân hẹn với chính mình, xác nhận đã đến
//     tái khám;  GET /doctor/revisits + PATCH /doctor/revisits/:hoSoId/done
//  Bác sĩ xác nhận xong thì hẹn biến khỏi cả hai danh sách và chuông thông báo.
// ============================================================================

const inp = { ...input, padding: "10px 12px", fontSize: 14, borderRadius: 10 };
const fmtNgay = (d) => { const x = new Date(d); return isNaN(x) ? "—" : x.toLocaleDateString("vi-VN"); };
const ngayISO = (them = 0) => {
  const d = new Date(); d.setDate(d.getDate() + them);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const tinhTuoi = (ns) => {
  if (!ns) return "";
  const d = new Date(ns); if (isNaN(d)) return "";
  const now = new Date();
  let t = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) t--;
  return t >= 0 && t < 200 ? `${t} tuổi` : "";
};
// Nhãn trạng thái theo ngày hẹn so với hôm nay
const trangThai = (ngay) => {
  const hn = ngayISO();
  if (ngay < hn) return { text: "Quá hạn", tone: "#C0392B", soft: "#FDECEA" };
  if (ngay === hn) return { text: "Hôm nay", tone: T.mint, soft: T.mintSoft };
  if (ngay === ngayISO(1)) return { text: "Ngày mai", tone: T.gold, soft: T.goldSoft };
  return { text: "Sắp tới", tone: T.sky, soft: T.skySoft };
};

// Một dòng bệnh nhân tái khám — dùng chung hai cổng; `action` là nút riêng của cổng.
// hienBacSi: chỉ cổng lễ tân cần cột bác sĩ (ở cổng bác sĩ thì luôn là chính họ).
function DongTaiKham({ r, action, hienBacSi }) {
  const st = trangThai(r.ngay_tai_kham);
  return (
    <Card style={{ padding: 18, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
      <span style={{ width: 48, height: 48, borderRadius: 14, background: st.soft, color: st.tone, display: "grid", placeItems: "center", flexShrink: 0 }}>
        <CalendarClock size={22} />
      </span>
      <div style={{ flex: 1, minWidth: 210 }}>
        <div style={{ display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontWeight: 800, color: T.ink, fontSize: 15.5 }}>{r.ho_ten}</span>
          <Pill tone={st.tone} soft={st.soft}>{st.text} · {fmtNgay(r.ngay_tai_kham)}</Pill>
        </div>
        <div style={{ color: T.sub, fontSize: 13.5, marginTop: 4 }}>
          {r.ma_benh_nhan}
          {r.sdt ? ` · ${r.sdt}` : ""}
          {r.ngay_sinh && tinhTuoi(r.ngay_sinh) ? ` · ${tinhTuoi(r.ngay_sinh)}` : ""}
          {hienBacSi && (r.bac_si_tai_kham
            ? ` · ${r.bac_si_tai_kham.ho_ten}${r.bac_si_tai_kham.khoa ? ` (${r.bac_si_tai_kham.khoa})` : ""}`
            : " · chưa chỉ định bác sĩ")}
        </div>
        {r.ghi_chu_tai_kham && (
          <div style={{ fontSize: 13, color: T.ink, marginTop: 5, whiteSpace: "pre-wrap" }}>📎 {r.ghi_chu_tai_kham}</div>
        )}
      </div>
      {action}
    </Card>
  );
}

// ---------- Cổng LỄ TÂN: toàn bộ lịch tái khám ----------
export default function TaiKham() {
  const { online } = useNav();
  const live = online && !!store.token;
  const [list, setList] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [loc, setLoc] = useState({ tu: "", den: "", bac_si: "", q: "" });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const load = (dieuKien) => {
    if (!live) return;
    const d = dieuKien || loc;
    setLoading(true); setErr(null);
    api.revisits(d)
      .then((r) => setList(Array.isArray(r) ? r : []))
      .catch((e) => { setErr(e.message); setList([]); })
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    if (!live) return;
    api.doctors().then((r) => setDoctors(Array.isArray(r) ? r : [])).catch(() => {});
    load();
  }, [live]);

  const dat = (k, v) => setLoc((s) => ({ ...s, [k]: v }));
  const nhanh = (tu, den) => { const d = { ...loc, tu, den }; setLoc(d); load(d); };
  const xoaLoc = () => { const d = { tu: "", den: "", bac_si: "", q: "" }; setLoc(d); load(d); };

  const data = list || [];
  const quaHan = data.filter((r) => r.qua_han).length;
  const homNay = data.filter((r) => r.ngay_tai_kham === ngayISO()).length;

  if (!live) {
    return (<div><PageTitle title="Lịch tái khám" sub="Danh sách bệnh nhân được hẹn tái khám." />
      <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>Cần đăng nhập tài khoản lễ tân với backend.</Card></div>);
  }

  return (
    <div>
      <PageTitle title="Lịch tái khám"
        sub="Bệnh nhân được hẹn tái khám — bác sĩ phụ trách thấy cùng danh sách này ở cổng bác sĩ." />

      <Card style={{ padding: 20, marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          <Btn size="sm" kind="ghost" onClick={() => nhanh(ngayISO(), ngayISO())}>Hôm nay</Btn>
          <Btn size="sm" kind="ghost" onClick={() => nhanh(ngayISO(), ngayISO(7))}>7 ngày tới</Btn>
          <Btn size="sm" kind="ghost" onClick={() => nhanh("", ngayISO(-1))}>Quá hạn</Btn>
          <Btn size="sm" kind="ghost" onClick={xoaLoc}><RotateCcw size={14} style={{ verticalAlign: -2, marginRight: 5 }} />Tất cả</Btn>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }} className="grid2">
          <label><span style={{ fontSize: 12.5, color: T.sub, fontWeight: 600, display: "block", marginBottom: 5 }}>Từ ngày</span>
            <input type="date" style={inp} value={loc.tu} onChange={(e) => dat("tu", e.target.value)} /></label>
          <label><span style={{ fontSize: 12.5, color: T.sub, fontWeight: 600, display: "block", marginBottom: 5 }}>Đến ngày</span>
            <input type="date" style={inp} value={loc.den} onChange={(e) => dat("den", e.target.value)} /></label>
          <label><span style={{ fontSize: 12.5, color: T.sub, fontWeight: 600, display: "block", marginBottom: 5 }}>Bác sĩ tái khám</span>
            <select style={inp} value={loc.bac_si} onChange={(e) => dat("bac_si", e.target.value)}>
              <option value="">— Tất cả bác sĩ —</option>
              {doctors.map((d) => <option key={d.id} value={d.id}>{d.ho_ten}</option>)}
            </select></label>
          <label><span style={{ fontSize: 12.5, color: T.sub, fontWeight: 600, display: "block", marginBottom: 5 }}>Tìm bệnh nhân</span>
            <input style={inp} value={loc.q} placeholder="Tên, mã BN hoặc SĐT"
              onChange={(e) => dat("q", e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} /></label>
        </div>
        <div style={{ marginTop: 14 }}>
          <Btn size="sm" onClick={() => load()} disabled={loading}>
            <Search size={14} style={{ verticalAlign: -2, marginRight: 6 }} />{loading ? "Đang tải…" : "Lọc danh sách"}
          </Btn>
        </div>
      </Card>

      {err && <Card style={{ padding: 16, marginBottom: 14, border: "none", background: "#FDECEA", color: "#C0392B", fontSize: 14 }}>{err}</Card>}

      {list && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
          <Pill tone={T.ink} soft="#F0F0F2"><Users size={12} style={{ verticalAlign: -2, marginRight: 4 }} />{data.length} lịch hẹn</Pill>
          {homNay > 0 && <Pill tone={T.mint} soft={T.mintSoft}>{homNay} hẹn hôm nay</Pill>}
          {quaHan > 0 && <Pill tone="#C0392B" soft="#FDECEA"><AlertTriangle size={12} style={{ verticalAlign: -2, marginRight: 4 }} />{quaHan} quá hạn</Pill>}
        </div>
      )}

      {!list && <div style={{ color: T.sub, fontSize: 14 }}>Đang tải danh sách tái khám…</div>}
      {list && data.length === 0 && (
        <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>
          Không có lịch tái khám nào khớp bộ lọc. Hẹn tái khám được tạo ở trang <b>Tiếp đón → Tra cứu &amp; tiếp nhận bệnh nhân</b>.
        </Card>
      )}
      <div style={{ display: "grid", gap: 12 }}>
        {data.map((r) => <DongTaiKham key={r.ho_so_id} r={r} hienBacSi />)}
      </div>
    </div>
  );
}

// ---------- Form tạo lịch tái khám từ tên bệnh nhân (trang Lịch sử khám) ----------
// Tạo LỊCH HẸN THẬT: hiện ở "Tất cả lịch hẹn", đồng thời gửi thông báo cho bác sĩ
// phụ trách và quản trị viên.  POST /reception/revisit-appointments
export function FormTaoTaiKham({ hoSoId, tenBenhNhan, maBenhNhan, onXong, onHuy }) {
  const [f, setF] = useState({ ngay: ngayISO(7), gio: "08:00", bac_si_id: "", ghi_chu: "" });
  const [doctors, setDoctors] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [ok, setOk] = useState(null);   // kết quả tạo thành công

  useEffect(() => {
    api.doctors().then((r) => setDoctors(Array.isArray(r) ? r : [])).catch(() => {});
  }, []);
  const dat = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const tao = async () => {
    setErr(null);
    if (!f.bac_si_id) { setErr("Vui lòng chọn bác sĩ tái khám."); return; }
    if (!f.ngay) { setErr("Vui lòng chọn ngày tái khám."); return; }
    setBusy(true);
    try {
      const r = await api.createRevisitAppointment({
        ho_so_id: hoSoId, bac_si_id: f.bac_si_id, ngay: f.ngay, gio: f.gio, ghi_chu: f.ghi_chu,
      });
      setOk(r);
      if (onXong) onXong(r);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  // Xác nhận tạo lịch thành công
  if (ok) {
    return (
      <Card style={{ padding: 22, border: "none", background: T.mintSoft }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <CheckCircle2 size={22} style={{ color: "#1E7A5F", flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, color: "#1E7A5F", fontSize: 15.5, marginBottom: 8 }}>
              Đã tạo lịch tái khám thành công
            </div>
            <div style={{ fontSize: 14, color: T.ink, display: "grid", gap: 4 }}>
              <div><b>Mã lịch hẹn:</b> {ok.ma_lich_hen} · STT #{ok.so_thu_tu}</div>
              <div><b>Bệnh nhân:</b> {ok.benh_nhan} ({ok.ma_benh_nhan})</div>
              <div><b>Bác sĩ:</b> {ok.bac_si}{ok.khoa ? ` — ${ok.khoa}` : ""}</div>
              <div><b>Thời gian:</b> {fmtNgay(ok.ngay)} lúc {ok.gio}</div>
              <div style={{ color: T.sub, marginTop: 4 }}>
                Đã gửi thông báo tới {ok.so_thong_bao} tài khoản (bác sĩ phụ trách &amp; quản trị viên).
                Lịch đã có trong <b>Tất cả lịch hẹn</b> với trạng thái <b>Đã xác nhận</b>.
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <Btn kind="ghost" size="sm" onClick={onHuy}>Đóng</Btn>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card style={{ padding: 22 }}>
      <div style={{ fontWeight: 800, color: T.ink, fontSize: 16, marginBottom: 4 }}>
        <CalendarClock size={17} style={{ verticalAlign: -3, marginRight: 8, color: T.gold }} />
        Tạo lịch tái khám
      </div>
      <div style={{ fontSize: 13.5, color: T.sub, marginBottom: 16 }}>
        Bệnh nhân <b style={{ color: T.ink }}>{tenBenhNhan}</b>{maBenhNhan ? ` (${maBenhNhan})` : ""} — lịch sẽ được thêm vào
        Tất cả lịch hẹn và gửi thông báo cho bác sĩ, quản trị viên.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }} className="grid2">
        <label><span style={{ fontSize: 12.5, color: T.sub, fontWeight: 600, display: "block", marginBottom: 5 }}>Ngày tái khám *</span>
          <input type="date" style={inp} value={f.ngay} min={ngayISO()} onChange={(e) => dat("ngay", e.target.value)} /></label>
        <label><span style={{ fontSize: 12.5, color: T.sub, fontWeight: 600, display: "block", marginBottom: 5 }}>Giờ khám</span>
          <input type="time" style={inp} value={f.gio} onChange={(e) => dat("gio", e.target.value)} /></label>
        <label><span style={{ fontSize: 12.5, color: T.sub, fontWeight: 600, display: "block", marginBottom: 5 }}>Bác sĩ tái khám *</span>
          <select style={inp} value={f.bac_si_id} onChange={(e) => dat("bac_si_id", e.target.value)}>
            <option value="">— Chọn bác sĩ —</option>
            {doctors.map((d) => <option key={d.id} value={d.id}>{d.ho_ten}{d.khoa && d.khoa.ten_khoa ? ` — ${d.khoa.ten_khoa}` : ""}</option>)}
          </select></label>
      </div>
      <label style={{ display: "block", marginTop: 14 }}>
        <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 600, display: "block", marginBottom: 5 }}>Ghi chú chuẩn bị</span>
        <input style={inp} value={f.ghi_chu} placeholder="VD: mang toa thuốc cũ, phim siêu âm lần trước"
          onChange={(e) => dat("ghi_chu", e.target.value)} />
      </label>
      {err && <div style={{ background: "#FDECEA", color: "#C0392B", fontSize: 13.5, padding: "10px 14px", borderRadius: 12, marginTop: 14 }}>{err}</div>}
      <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
        <Btn size="sm" onClick={tao} disabled={busy}>{busy ? "Đang tạo…" : "Tạo lịch tái khám"}</Btn>
        <Btn kind="ghost" size="sm" onClick={onHuy}>Hủy</Btn>
      </div>
    </Card>
  );
}

// ---------- Cổng BÁC SĨ: bệnh nhân hẹn tái khám với chính mình ----------
// onChanged: báo cổng bác sĩ tải lại badge chuông sau khi xác nhận
export function TaiKhamBacSi({ onChanged }) {
  const { online } = useNav();
  const live = online && !!store.token;
  const [list, setList] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const [somId, setSomId] = useState(null);  // hồ sơ đang mở form tái khám trước hẹn
  const [lyDo, setLyDo] = useState("");
  const [ack, setAck] = useState(false);

  const load = () => {
    if (!live) return;
    api.doctorRevisits()
      .then((r) => setList(Array.isArray(r) ? r : []))
      .catch((e) => { setErr(e.message); setList([]); });
  };
  useEffect(load, [live]);

  const moForm = (r) => { setSomId(somId === r.ho_so_id ? null : r.ho_so_id); setLyDo(""); setAck(false); setErr(null); };

  // payload=null: đúng/quá hẹn, xác nhận trực tiếp. Có payload: tái khám trước hẹn.
  const xacNhan = async (r, payload) => {
    setBusyId(r.ho_so_id); setErr(null);
    try {
      await api.doneRevisit(r.ho_so_id, payload || undefined);
      setMsg(`Đã xác nhận ${r.ho_ten} (${r.ma_benh_nhan}) ${payload ? "tái khám trước ngày hẹn" : "đến tái khám"}.`);
      setSomId(null); setLyDo(""); setAck(false);
      load();
      if (onChanged) onChanged();
    } catch (e) { setErr(e.message); }
    finally { setBusyId(null); }
  };

  if (!live) {
    return (<div><PageTitle title="Bệnh nhân tái khám" sub="Danh sách bệnh nhân được hẹn tái khám với bạn." />
      <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>Cần đăng nhập tài khoản bác sĩ với backend.</Card></div>);
  }

  const data = list || [];
  return (
    <div>
      <PageTitle title="Bệnh nhân tái khám"
        sub="Lễ tân hẹn tái khám cho bạn ở trang Tiếp đón — xác nhận khi bệnh nhân đã đến." />
      {msg && <Card style={{ padding: 14, marginBottom: 14, border: "none", background: T.mintSoft, color: "#1E7A5F", fontSize: 14 }}>{msg}</Card>}
      {err && <Card style={{ padding: 14, marginBottom: 14, border: "none", background: "#FDECEA", color: "#C0392B", fontSize: 14 }}>{err}</Card>}
      {!list && <div style={{ color: T.sub, fontSize: 14 }}>Đang tải danh sách…</div>}
      {list && data.length === 0 && (
        <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>
          <Stethoscope size={26} style={{ color: T.line, marginBottom: 10 }} /><br />
          Chưa có bệnh nhân nào được hẹn tái khám với bạn.
        </Card>
      )}
      <div style={{ display: "grid", gap: 12 }}>
        {data.map((r) => {
          const truocHan = r.ngay_tai_kham > ngayISO();  // chưa tới ngày hẹn
          const dangMo = somId === r.ho_so_id;
          return (
            <React.Fragment key={r.ho_so_id}>
              <DongTaiKham r={r} action={
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {r.sdt && <Pill tone={T.sub} soft="#F0F0F2"><Phone size={12} style={{ verticalAlign: -2, marginRight: 4 }} />{r.sdt}</Pill>}
                  {truocHan ? (
                    <Btn kind="gold" size="sm" disabled={busyId === r.ho_so_id} onClick={() => moForm(r)}>
                      <AlertTriangle size={15} /> Tái khám trước hẹn
                    </Btn>
                  ) : (
                    <Btn kind="mint" size="sm" disabled={busyId === r.ho_so_id} onClick={() => xacNhan(r)}>
                      <CheckCircle2 size={15} /> {busyId === r.ho_so_id ? "Đang lưu…" : "Đã tái khám"}
                    </Btn>
                  )}
                </div>
              } />
              {truocHan && dangMo && (
                <Card style={{ padding: 16, border: `1px solid ${T.gold}`, background: T.goldSoft }}>
                  <div style={{ fontSize: 13.5, color: T.ink, fontWeight: 700, marginBottom: 10, display: "flex", gap: 6, alignItems: "center" }}>
                    <AlertTriangle size={15} color={T.gold} /> Chưa tới ngày hẹn ({fmtNgay(r.ngay_tai_kham)}) — tái khám sớm cần nêu lý do và xác nhận của bác sĩ phụ trách.
                  </div>
                  <textarea rows={2} value={lyDo} onChange={(e) => setLyDo(e.target.value)}
                    placeholder="Lý do tái khám trước ngày hẹn (VD: bệnh nhân đau bất thường, ra máu, cần can thiệp sớm…)"
                    style={{ ...inp, width: "100%", boxSizing: "border-box", resize: "vertical" }} />
                  <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13.5, color: T.ink, margin: "10px 0" }}>
                    <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} style={{ width: 16, height: 16, accentColor: T.gold, marginTop: 1 }} />
                    <span>Tôi (bác sĩ phụ trách) xác nhận cho bệnh nhân tái khám trước ngày hẹn.</span>
                  </label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Btn kind="gold" size="sm" disabled={busyId === r.ho_so_id || lyDo.trim().length < 3 || !ack}
                      onClick={() => xacNhan(r, { ly_do: lyDo.trim(), xac_nhan_som: true })}>
                      <CheckCircle2 size={15} /> {busyId === r.ho_so_id ? "Đang lưu…" : "Xác nhận tái khám sớm"}
                    </Btn>
                    <Btn kind="ghost" size="sm" onClick={() => moForm(r)}>Hủy</Btn>
                  </div>
                </Card>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
