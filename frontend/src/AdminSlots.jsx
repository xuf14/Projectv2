import React, { useState, useEffect } from "react";
import { Plus, Trash2, Minus, Clock, CheckCircle2, X, CalendarRange } from "lucide-react";
import { T, store, api, useNav, Btn, Card, Pill, PageTitle, FormField, input } from "./shared";

// ============================================================================
//  QUẢN LÝ KHUNG GIỜ — trang "Khung giờ" của cổng Quản trị viên.
//  Chọn bác sĩ + ngày → xem toàn bộ khung giờ trong database (GET /admin/slots,
//  gồm cả khung đã đầy), thêm khung mới (POST), tăng/giảm số chỗ (PATCH),
//  xóa khung chưa có lượt đặt (DELETE). Khung giờ ở đây chính là các lựa chọn
//  bệnh nhân thấy khi đặt lịch.
// ============================================================================

const ymdLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function AdminSlots() {
  const { online, doctors } = useNav();
  const live = online && !!store.token;
  const dsBacSi = doctors || [];
  const [bacSi, setBacSi] = useState("");
  const [ngay, setNgay] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 1); return ymdLocal(d); });
  const [list, setList] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ gio_bat_dau: "", so_luong: 5 });
  const [busy, setBusy] = useState(false);
  // Tạo hàng loạt: nhiều bác sĩ × nhiều ngày trong một lần
  const [moHangLoat, setMoHangLoat] = useState(false);
  const [hl, setHl] = useState(() => {
    const mai = new Date(); mai.setDate(mai.getDate() + 1);
    const cuoi = new Date(); cuoi.setDate(cuoi.getDate() + 30);
    return {
      tu: ymdLocal(mai), den: ymdLocal(cuoi),
      gio_bat_dau: "07:30", gio_ket_thuc: "17:00", buoc_phut: 30, so_luong: 5,
      nghi_trua_tu: "11:30", nghi_trua_den: "13:30",
      bo_qua_cuoi_tuan: true, tat_ca_bac_si: true, bac_si_ids: [],
    };
  });
  const [hlBusy, setHlBusy] = useState(false);
  const [hlKetQua, setHlKetQua] = useState(null);

  useEffect(() => { if (!bacSi && dsBacSi.length) setBacSi(String(dsBacSi[0].id)); }, [dsBacSi]);

  const load = () => {
    if (!live || !bacSi || !ngay) return;
    setLoading(true); setErr(null);
    api.adminSlots(bacSi, ngay)
      .then((r) => setList(Array.isArray(r) ? r : []))
      .catch((e) => { setErr(e.message); setList([]); })
      .finally(() => setLoading(false));
  };
  useEffect(load, [live, bacSi, ngay]);

  const doAdd = async () => {
    if (!f.gio_bat_dau) { setErr("Vui lòng chọn giờ bắt đầu."); return; }
    setBusy(true); setErr(null);
    try {
      await api.addSlot({ bac_si_id: +bacSi, ngay, gio_bat_dau: f.gio_bat_dau, so_luong: +f.so_luong || 5 });
      setAdding(false); setF({ gio_bat_dau: "", so_luong: 5 });
      load();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const doiHl = (k, v) => setHl((s) => ({ ...s, [k]: v }));
  const chonBacSi = (id) => setHl((s) => {
    const ids = s.bac_si_ids.includes(id) ? s.bac_si_ids.filter((x) => x !== id) : [...s.bac_si_ids, id];
    return { ...s, bac_si_ids: ids };
  });

  // Số khung dự kiến — chỉ để người dùng ước lượng trước khi bấm tạo;
  // số thật do backend trả về sau khi đã bỏ qua các khung trùng.
  const duKien = (() => {
    const phut = (g) => (/^\d{2}:\d{2}$/.test(g) ? +g.slice(0, 2) * 60 + +g.slice(3) : NaN);
    const b = phut(hl.gio_bat_dau); const k = phut(hl.gio_ket_thuc);
    const tt = phut(hl.nghi_trua_tu); const td = phut(hl.nghi_trua_den);
    const buoc = +hl.buoc_phut || 30;
    if (!isFinite(b) || !isFinite(k) || b >= k) return null;
    let soGio = 0;
    for (let p = b; p < k; p += buoc) {
      if (isFinite(tt) && isFinite(td) && tt < td && p >= tt && p < td) continue;
      soGio++;
    }
    const d1 = new Date(hl.tu + "T00:00:00"); const d2 = new Date(hl.den + "T00:00:00");
    if (isNaN(d1) || isNaN(d2) || d1 > d2) return null;
    let soNgay = 0;
    for (const d = new Date(d1); d <= d2; d.setDate(d.getDate() + 1)) {
      if (hl.bo_qua_cuoi_tuan && (d.getDay() === 0 || d.getDay() === 6)) continue;
      soNgay++;
      if (soNgay > 200) return null;
    }
    const soBs = hl.tat_ca_bac_si ? dsBacSi.length : hl.bac_si_ids.length;
    if (!soBs || !soNgay || !soGio) return null;
    return { soBs, soNgay, soGio, tong: soBs * soNgay * soGio };
  })();

  const taoHangLoat = async () => {
    setErr(null); setHlKetQua(null);
    if (!hl.tat_ca_bac_si && hl.bac_si_ids.length === 0) { setErr("Chọn ít nhất một bác sĩ hoặc tích \"Tất cả bác sĩ\"."); return; }
    setHlBusy(true);
    try {
      const r = await api.addSlotsBulk({
        bac_si_ids: hl.tat_ca_bac_si ? [] : hl.bac_si_ids,
        tu: hl.tu, den: hl.den,
        gio_bat_dau: hl.gio_bat_dau, gio_ket_thuc: hl.gio_ket_thuc,
        buoc_phut: +hl.buoc_phut, so_luong: +hl.so_luong,
        nghi_trua_tu: hl.nghi_trua_tu || undefined, nghi_trua_den: hl.nghi_trua_den || undefined,
        bo_qua_cuoi_tuan: hl.bo_qua_cuoi_tuan,
      });
      setHlKetQua(r);
      load();
    } catch (e) { setErr(e.message); }
    finally { setHlBusy(false); }
  };

  const doiSoCho = async (s, delta) => {
    setErr(null);
    try { await api.updateSlot(s.id, { so_luong: s.so_luong + delta }); load(); }
    catch (e) { setErr(e.message); }
  };

  const remove = async (s) => {
    if (!window.confirm(`Xóa khung giờ ${s.gio_bat_dau} ngày ${ngay}?`)) return;
    setErr(null);
    try { await api.deleteSlot(s.id); load(); }
    catch (e) { setErr(e.message); }
  };

  if (!live) {
    return (
      <div>
        <PageTitle title="Khung giờ" sub="Quản lý lịch làm việc và khung giờ khám của bác sĩ." />
        <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>Cần kết nối backend để quản lý khung giờ thật.</Card>
      </div>
    );
  }

  const data = list || [];
  const tenBacSi = (dsBacSi.find((d) => String(d.id) === bacSi) || {}).name || "";
  return (
    <div>
      <PageTitle title="Khung giờ" sub="Khung giờ ở đây chính là các lựa chọn bệnh nhân thấy khi đặt lịch."
        action={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Btn kind="mint" onClick={() => { setMoHangLoat(!moHangLoat); setErr(null); setHlKetQua(null); }}>
              {moHangLoat ? <><X size={16} /> Đóng</> : <><CalendarRange size={16} /> Tạo hàng loạt</>}
            </Btn>
            <Btn kind="lav" onClick={() => { setAdding(!adding); setErr(null); }}>
              {adding ? <><X size={16} /> Đóng</> : <><Plus size={16} /> Thêm mới</>}
            </Btn>
          </div>
        } />

      {/* Tạo khung giờ cho NHIỀU bác sĩ trong NHIỀU ngày */}
      {moHangLoat && (
        <Card style={{ padding: 20, marginBottom: 16, background: T.mintSoft, border: "none" }}>
          <div style={{ fontWeight: 800, color: T.ink, fontSize: 15, marginBottom: 4 }}>Tạo khung giờ hàng loạt</div>
          <div style={{ fontSize: 12.5, color: T.sub, marginBottom: 14 }}>
            Sinh khung giờ đều nhau cho nhiều bác sĩ trong một khoảng ngày. Khung đã có sẵn sẽ được bỏ qua, không ghi đè số chỗ hay lượt đã đặt.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 12 }}>
            <FormField label="Từ ngày"><input type="date" value={hl.tu} onChange={(e) => doiHl("tu", e.target.value)} style={input} /></FormField>
            <FormField label="Đến ngày"><input type="date" value={hl.den} onChange={(e) => doiHl("den", e.target.value)} style={input} /></FormField>
            <FormField label="Giờ bắt đầu"><input type="time" value={hl.gio_bat_dau} onChange={(e) => doiHl("gio_bat_dau", e.target.value)} style={input} /></FormField>
            <FormField label="Giờ kết thúc"><input type="time" value={hl.gio_ket_thuc} onChange={(e) => doiHl("gio_ket_thuc", e.target.value)} style={input} /></FormField>
            <FormField label="Mỗi khung (phút)">
              <select value={hl.buoc_phut} onChange={(e) => doiHl("buoc_phut", e.target.value)} style={{ ...input, background: T.surface }}>
                {[15, 20, 30, 45, 60].map((n) => <option key={n} value={n}>{n} phút</option>)}
              </select>
            </FormField>
            <FormField label="Số chỗ / khung"><input type="number" min="1" max="50" value={hl.so_luong} onChange={(e) => doiHl("so_luong", e.target.value)} style={input} /></FormField>
            <FormField label="Nghỉ trưa từ"><input type="time" value={hl.nghi_trua_tu} onChange={(e) => doiHl("nghi_trua_tu", e.target.value)} style={input} /></FormField>
            <FormField label="Nghỉ trưa đến"><input type="time" value={hl.nghi_trua_den} onChange={(e) => doiHl("nghi_trua_den", e.target.value)} style={input} /></FormField>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: T.ink, marginBottom: 10, cursor: "pointer" }}>
            <input type="checkbox" checked={hl.bo_qua_cuoi_tuan} onChange={(e) => doiHl("bo_qua_cuoi_tuan", e.target.checked)} />
            Bỏ qua thứ Bảy và Chủ nhật
          </label>

          <div style={{ fontSize: 12.5, color: T.sub, fontWeight: 700, marginBottom: 7 }}>Áp dụng cho bác sĩ</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <button onClick={() => doiHl("tat_ca_bac_si", !hl.tat_ca_bac_si)}
              style={{ padding: "7px 14px", borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                border: `1.5px solid ${hl.tat_ca_bac_si ? T.mint : T.line}`,
                background: hl.tat_ca_bac_si ? T.mint : T.surface, color: hl.tat_ca_bac_si ? "#fff" : T.sub }}>
              Tất cả bác sĩ ({dsBacSi.length})
            </button>
            {!hl.tat_ca_bac_si && dsBacSi.map((d) => {
              const on = hl.bac_si_ids.includes(d.id);
              return (
                <button key={d.id} onClick={() => chonBacSi(d.id)}
                  style={{ padding: "7px 14px", borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                    border: `1.5px solid ${on ? T.mint : T.line}`, background: on ? T.mintSoft : T.surface, color: on ? "#2F8F73" : T.sub }}>
                  {d.name}
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <Btn kind="mint" disabled={hlBusy || !duKien} onClick={taoHangLoat}>
              <CheckCircle2 size={16} /> {hlBusy ? "Đang tạo..." : "Tạo khung giờ"}
            </Btn>
            <span style={{ fontSize: 13, color: T.sub }}>
              {duKien
                ? `Dự kiến ${duKien.soBs} bác sĩ × ${duKien.soNgay} ngày × ${duKien.soGio} khung = ${duKien.tong.toLocaleString("vi-VN")} khung giờ`
                : "Kiểm tra lại khoảng ngày, khoảng giờ và danh sách bác sĩ."}
            </span>
          </div>

          {hlKetQua && (
            <div style={{ marginTop: 12, background: "#fff", borderRadius: 12, padding: "11px 14px", fontSize: 13.5, color: T.ink, lineHeight: 1.55 }}>
              <b>{hlKetQua.message}.</b> {hlKetQua.so_bac_si} bác sĩ · {hlKetQua.so_ngay} ngày ·
              {" "}{hlKetQua.so_khung_moi_ngay} khung/ngày ({hlKetQua.gio_dau}–{hlKetQua.gio_cuoi}).
            </div>
          )}
        </Card>
      )}

      <Card style={{ padding: 20, marginBottom: 16, display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <FormField label="Bác sĩ">
            <select value={bacSi} onChange={(e) => setBacSi(e.target.value)} style={{ ...input, background: T.surface }}>
              {dsBacSi.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </FormField>
        </div>
        <div style={{ flex: 1, minWidth: 170 }}>
          <FormField label="Ngày"><input type="date" value={ngay} onChange={(e) => setNgay(e.target.value)} style={input} /></FormField>
        </div>
      </Card>

      {adding && (
        <Card style={{ padding: 20, marginBottom: 16, background: T.lavSoft, border: "none" }}>
          <div style={{ fontWeight: 800, color: T.ink, fontSize: 15, marginBottom: 12 }}>Thêm khung giờ cho {tenBacSi} — ngày {ngay.split("-").reverse().join("/")}</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ minWidth: 140 }}><FormField label="Giờ bắt đầu"><input type="time" value={f.gio_bat_dau} onChange={(e) => setF({ ...f, gio_bat_dau: e.target.value })} style={input} /></FormField></div>
            <div style={{ minWidth: 110 }}><FormField label="Số chỗ"><input type="number" min="1" max="50" value={f.so_luong} onChange={(e) => setF({ ...f, so_luong: e.target.value })} style={input} /></FormField></div>
            <Btn kind="lav" disabled={busy} onClick={doAdd}><CheckCircle2 size={16} /> {busy ? "Đang lưu..." : "Lưu khung giờ"}</Btn>
          </div>
        </Card>
      )}

      {err && <Card style={{ padding: 16, marginBottom: 14, background: "#FDECEA", border: "none", color: "#C0392B", fontSize: 14 }}>{err}</Card>}
      {loading && <div style={{ color: T.sub, fontSize: 14, marginBottom: 12 }}>Đang tải khung giờ...</div>}
      {!loading && data.length === 0 && !err && (
        <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>
          {tenBacSi} chưa có khung giờ nào trong ngày này — bấm "Thêm mới" để tạo.
        </Card>
      )}

      <div style={{ display: "grid", gap: 10 }}>
        {data.map((s) => {
          const conLai = s.so_luong - s.da_dat;
          const day = s.da_dat >= s.so_luong;
          return (
            <Card key={s.id} style={{ padding: 16, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <span style={{ width: 46, height: 46, borderRadius: 13, background: day ? "#FDECEA" : T.lavSoft, color: day ? "#C0392B" : T.lav, display: "grid", placeItems: "center", flexShrink: 0 }}><Clock size={20} /></span>
              <div style={{ flex: 1, minWidth: 140 }}>
                <div style={{ display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 800, color: T.ink, fontSize: 16 }}>{s.gio_bat_dau}</span>
                  {day
                    ? <Pill tone="#C0392B" soft="#FDECEA">Đã đầy</Pill>
                    : <Pill tone={T.mint} soft={T.mintSoft}>Còn {conLai} chỗ</Pill>}
                </div>
                <div style={{ color: T.sub, fontSize: 13, marginTop: 4 }}>Đã đặt {s.da_dat}/{s.so_luong} chỗ</div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <Btn kind="ghost" size="sm" onClick={() => doiSoCho(s, -1)} disabled={s.so_luong <= 1}><Minus size={14} /></Btn>
                <span style={{ fontWeight: 800, color: T.ink, minWidth: 26, textAlign: "center" }}>{s.so_luong}</span>
                <Btn kind="ghost" size="sm" onClick={() => doiSoCho(s, 1)}><Plus size={14} /></Btn>
                <Btn kind="ghost" size="sm" style={{ color: "#C0392B", borderColor: "#FDECEA", marginLeft: 6 }} onClick={() => remove(s)} title={s.da_dat > 0 ? "Khung đã có lượt đặt — không thể xóa" : "Xóa khung giờ"}><Trash2 size={14} /></Btn>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
