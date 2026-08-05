import React, { useState, useEffect } from "react";
import {
  ClipboardList, Phone, Mail, MapPin, CalendarDays, Stethoscope, CheckCircle2, X, User,
  UserCheck, RotateCcw, Clock, Search, Link2,
} from "lucide-react";
import { T, store, api, useNav, Btn, Card, Pill, PageTitle, input } from "./shared";

// ============================================================================
//  ĐĂNG KÝ KHÁM ONLINE (cổng LỄ TÂN) — hàng chờ các phiếu bệnh nhân gửi từ
//  trang công khai. Lễ tân XÁC NHẬN LẠI phiếu: chỉnh khoa, chọn bác sĩ và chốt
//  ngày/giờ khám → hệ thống tạo hồ sơ (hoặc gắn hồ sơ cũ) + lịch khám thật, lịch
//  này hiện ngay ở cổng bác sĩ của khoa. Phiếu không hợp lệ thì hủy.
//    GET   /reception/dang-ky-kham?trang_thai=
//    PATCH /reception/dang-ky-kham/:id
//          { trang_thai: 'da_tiep_nhan', khoa_id, bac_si_id, ngay_kham, gio_kham,
//            ho_so_id?, ghi_chu_le_tan? }  |  { trang_thai: 'da_huy', ghi_chu_le_tan? }
// ============================================================================

const inp = { ...input, padding: "9px 12px", fontSize: 13.5, borderRadius: 10 };
const GIO_KHAM = [
  "07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00",
  "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
];
const todayISO = () => new Date().toLocaleDateString("en-CA");
const fmtNgay = (d) => { const x = new Date(d); return isNaN(x) ? "—" : x.toLocaleDateString("vi-VN"); };
const fmtLuc = (d) => { const x = new Date(d); return isNaN(x) ? "" : x.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); };

const TT = {
  cho_tiep_don: { text: "Chờ tiếp đón", tone: T.gold, soft: T.goldSoft },
  da_tiep_nhan: { text: "Đã tiếp nhận", tone: T.mint, soft: T.mintSoft },
  da_huy: { text: "Đã hủy", tone: "#C0392B", soft: "#FDECEA" },
};
const LOC = [
  { id: "cho_tiep_don", label: "Chờ tiếp đón" },
  { id: "da_tiep_nhan", label: "Đã tiếp nhận" },
  { id: "da_huy", label: "Đã hủy" },
];

const InfoLine = ({ icon: Icon, children }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: T.sub, fontSize: 13 }}>
    <Icon size={13} style={{ flexShrink: 0 }} /> {children}
  </span>
);

export default function DangKyOnline() {
  const { online } = useNav();
  const live = online && !!store.token;
  const [loc, setLoc] = useState("cho_tiep_don");
  const [data, setData] = useState(null);       // { cho_tiep_don, danh_sach }
  const [notes, setNotes] = useState({});        // ghi chú lễ tân theo id
  const [busyId, setBusyId] = useState(null);
  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState(null);
  const [xacNhan, setXacNhan] = useState(null);  // phiếu đang mở cửa sổ xác nhận

  const load = (trangThai) => {
    if (!live) return;
    setErr(null);
    api.dangKyKhamList(trangThai)
      .then((r) => setData(r && typeof r === "object" ? r : { cho_tiep_don: 0, danh_sach: [] }))
      .catch((e) => { setErr(e.message); setData({ cho_tiep_don: 0, danh_sach: [] }); });
  };
  useEffect(() => { load(loc); }, [live, loc]); // eslint-disable-line react-hooks/exhaustive-deps

  const huyPhieu = async (r) => {
    setBusyId(r.id); setErr(null); setMsg(null);
    try {
      await api.updateDangKyKham(r.id, { trang_thai: "da_huy", ghi_chu_le_tan: notes[r.id] || undefined });
      setMsg(`Đã hủy phiếu ${r.ma_dang_ky} — ${r.ho_ten}.`);
      setNotes((s) => { const n = { ...s }; delete n[r.id]; return n; });
      load(loc);
    } catch (e) { setErr(e.message); }
    finally { setBusyId(null); }
  };

  const daXacNhan = (r, kq) => {
    setXacNhan(null);
    const lh = kq && kq.lich_hen;
    setErr(null);
    setMsg(`Đã xác nhận phiếu ${r.ma_dang_ky} — ${r.ho_ten}` +
      (lh ? `: lịch ${lh.ma_lich_hen}, BS ${lh.bac_si || "—"}, ${fmtNgay(lh.ngay)} ${lh.gio || ""} (đã gửi tới cổng bác sĩ).` : "."));
    setNotes((s) => { const n = { ...s }; delete n[r.id]; return n; });
    load(loc);
  };

  if (!live) {
    return (<div><PageTitle title="Đăng ký khám online" sub="Phiếu đăng ký khám bệnh nhân gửi từ trang công khai." />
      <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>Cần đăng nhập tài khoản lễ tân với backend.</Card></div>);
  }

  const list = (data && data.danh_sach) || [];
  const soCho = (data && data.cho_tiep_don) || 0;

  return (
    <div>
      <PageTitle title="Đăng ký khám online"
        sub="Bệnh nhân đăng ký ở trang công khai — tiếp nhận để liên hệ và sắp lịch, hoặc hủy phiếu không hợp lệ." />

      {msg && <Card style={{ padding: 13, marginBottom: 14, border: "none", background: T.mintSoft, color: "#1E7A5F", fontSize: 14 }}>{msg}</Card>}
      {err && <Card style={{ padding: 13, marginBottom: 14, border: "none", background: "#FDECEA", color: "#C0392B", fontSize: 14 }}>{err}</Card>}

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        {LOC.map((l) => (
          <Btn key={l.id} kind={loc === l.id ? "primary" : "ghost"} size="sm" onClick={() => setLoc(l.id)}>
            {l.label}{l.id === "cho_tiep_don" && soCho > 0 ? ` (${soCho})` : ""}
          </Btn>
        ))}
        <Btn kind="ghost" size="sm" onClick={() => load(loc)}><RotateCcw size={14} style={{ verticalAlign: -2, marginRight: 4 }} />Tải lại</Btn>
      </div>

      {!data && <div style={{ color: T.sub, fontSize: 14 }}>Đang tải danh sách…</div>}
      {data && list.length === 0 && (
        <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>
          <ClipboardList size={26} style={{ color: T.line, marginBottom: 10 }} /><br />
          Không có phiếu đăng ký nào ở mục này.
        </Card>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        {list.map((r) => {
          const st = TT[r.trang_thai] || TT.cho_tiep_don;
          const dangCho = r.trang_thai === "cho_tiep_don";
          return (
            <Card key={r.id} style={{ padding: 18 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
                <span style={{ width: 46, height: 46, borderRadius: 14, background: st.soft, color: st.tone, display: "grid", placeItems: "center", flexShrink: 0 }}><User size={21} /></span>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 800, color: T.ink, fontSize: 15.5 }}>{r.ho_ten}</span>
                    <Pill tone={st.tone} soft={st.soft}>{st.text}</Pill>
                    {r.benh_nhan_cu
                      ? <Pill tone={T.sky} soft={T.skySoft}>Bệnh nhân cũ{r.ma_benh_nhan_cu ? ` · ${r.ma_benh_nhan_cu}` : ""}</Pill>
                      : <Pill tone={T.lav} soft={T.lavSoft}>Bệnh nhân mới</Pill>}
                  </div>
                  <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 7 }}>
                    <InfoLine icon={Phone}>{r.sdt || "—"}</InfoLine>
                    {r.ngay_sinh && <InfoLine icon={CalendarDays}>{fmtNgay(r.ngay_sinh)}</InfoLine>}
                    {r.gioi_tinh && <InfoLine icon={User}>{r.gioi_tinh}</InfoLine>}
                    {r.email && <InfoLine icon={Mail}>{r.email}</InfoLine>}
                  </div>
                  <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 6 }}>
                    <InfoLine icon={Stethoscope}>{r.khoa ? r.khoa.ten_khoa : "Chưa chọn khoa"}</InfoLine>
                    {r.ngay_mong_muon && (
                      <InfoLine icon={CalendarDays}>
                        Mong muốn: {fmtNgay(r.ngay_mong_muon)}{r.gio_mong_muon ? ` · ${r.gio_mong_muon}` : ""}
                      </InfoLine>
                    )}
                    {r.dia_chi && <InfoLine icon={MapPin}>{r.dia_chi}</InfoLine>}
                  </div>
                  {r.ly_do && <div style={{ fontSize: 13.5, color: T.ink, marginTop: 8, whiteSpace: "pre-wrap" }}>📝 {r.ly_do}</div>}
                  {r.lich_hen && (
                    <div style={{ marginTop: 9, background: T.mintSoft, borderRadius: 12, padding: "9px 12px", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: "#1E7A5F" }}>
                        <CheckCircle2 size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
                        Lịch khám {r.lich_hen.ma_lich_hen}
                      </span>
                      <InfoLine icon={CalendarDays}>{fmtNgay(r.lich_hen.ngay)}{r.lich_hen.gio ? ` · ${r.lich_hen.gio}` : ""}</InfoLine>
                      <InfoLine icon={Stethoscope}>BS. {r.lich_hen.bac_si || "—"}</InfoLine>
                      {r.ho_so && <InfoLine icon={User}>{r.ho_so.ma_benh_nhan}</InfoLine>}
                      {r.lich_hen.so_thu_tu ? <InfoLine icon={ClipboardList}>STT {r.lich_hen.so_thu_tu}</InfoLine> : null}
                    </div>
                  )}
                  {r.ghi_chu_le_tan && <div style={{ fontSize: 13, color: T.sub, marginTop: 6 }}>Ghi chú lễ tân: {r.ghi_chu_le_tan}{r.nguoi_xu_ly ? ` — ${r.nguoi_xu_ly}` : ""}</div>}
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: T.peach }}>{r.ma_dang_ky}</div>
                  <div style={{ fontSize: 12, color: T.sub, marginTop: 3 }}>{fmtLuc(r.ngay_tao)}</div>
                </div>
              </div>

              {dangCho && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.line}`, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <input style={{ ...inp, flex: 1, minWidth: 200 }} placeholder="Ghi chú (tùy chọn): đã gọi xác nhận, sắp lịch…"
                    value={notes[r.id] || ""} onChange={(e) => setNotes((s) => ({ ...s, [r.id]: e.target.value }))} />
                  <Btn kind="mint" size="sm" disabled={busyId === r.id} onClick={() => { setMsg(null); setErr(null); setXacNhan(r); }}>
                    <UserCheck size={15} /> Xác nhận & sắp lịch
                  </Btn>
                  <Btn kind="ghost" size="sm" disabled={busyId === r.id} onClick={() => huyPhieu(r)}>
                    <X size={15} /> {busyId === r.id ? "Đang lưu…" : "Hủy phiếu"}
                  </Btn>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {xacNhan && (
        <XacNhanModal r={xacNhan} ghiChu={notes[xacNhan.id] || ""}
          onClose={() => setXacNhan(null)} onDone={(kq) => daXacNhan(xacNhan, kq)} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
//  CỬA SỔ XÁC NHẬN — lễ tân chỉnh khoa, chọn bác sĩ, chốt ngày giờ khám và (với
//  bệnh nhân cũ) gắn hồ sơ sẵn có thay vì tạo hồ sơ mới.
// ---------------------------------------------------------------------------
function XacNhanModal({ r, ghiChu: ghiChuBanDau, onClose, onDone }) {
  const { departments } = useNav();
  const [khoaList, setKhoaList] = useState(Array.isArray(departments) ? departments : []);
  const [bsList, setBsList] = useState([]);
  const [khoaId, setKhoaId] = useState(r.khoa ? String(r.khoa.id) : "");
  const [bacSiId, setBacSiId] = useState("");
  const [ngay, setNgay] = useState(r.ngay_mong_muon && r.ngay_mong_muon >= todayISO() ? r.ngay_mong_muon : todayISO());
  const [gio, setGio] = useState(r.gio_mong_muon || "08:00");
  const [ghiChu, setGhiChu] = useState(ghiChuBanDau);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  // Gắn hồ sơ cũ (bệnh nhân đã từng khám)
  const [timHoSo, setTimHoSo] = useState(r.benh_nhan_cu ? (r.ma_benh_nhan_cu || r.sdt || r.ho_ten) : "");
  const [hoSoList, setHoSoList] = useState(null);
  const [hoSo, setHoSo] = useState(null);

  useEffect(() => {
    if (khoaList.length === 0) api.departments().then((d) => setKhoaList(Array.isArray(d) ? d : [])).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Danh sách bác sĩ theo khoa đã chọn (không chọn khoa = toàn bộ bác sĩ)
  useEffect(() => {
    api.doctors(khoaId ? +khoaId : undefined)
      .then((d) => { const l = Array.isArray(d) ? d : []; setBsList(l); setBacSiId((v) => (l.some((b) => String(b.id) === v) ? v : "")); })
      .catch(() => setBsList([]));
  }, [khoaId]);

  const tim = async () => {
    setErr(null);
    try { const l = await api.patients(timHoSo.trim()); setHoSoList(Array.isArray(l) ? l.slice(0, 8) : []); }
    catch (e) { setErr(e.message); }
  };

  const luu = async () => {
    setErr(null);
    if (!bacSiId) { setErr("Vui lòng chọn bác sĩ khám."); return; }
    setBusy(true);
    try {
      const kq = await api.updateDangKyKham(r.id, {
        trang_thai: "da_tiep_nhan",
        khoa_id: khoaId || undefined,
        bac_si_id: +bacSiId,
        ngay_kham: ngay,
        gio_kham: gio,
        ho_so_id: hoSo ? hoSo.id : undefined,
        ghi_chu_le_tan: ghiChu.trim() || undefined,
      });
      onDone(kq);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const lb = { fontSize: 12.5, color: T.sub, fontWeight: 700, display: "block", marginBottom: 6 };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "grid", placeItems: "center", zIndex: 70, padding: 16 }}>
      <Card onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640, width: "100%", maxHeight: "90vh", display: "flex", flexDirection: "column", padding: 0 }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.line}`, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16.5, fontWeight: 800, color: T.ink }}>Xác nhận lịch khám</div>
            <div style={{ fontSize: 13, color: T.sub, marginTop: 2 }}>
              {r.ma_dang_ky} · {r.ho_ten} · {r.sdt}
            </div>
          </div>
          <Btn kind="ghost" size="sm" onClick={onClose}><X size={16} /></Btn>
        </div>

        <div style={{ padding: 20, overflowY: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <label>
              <span style={lb}>Khoa khám</span>
              <select style={inp} value={khoaId} onChange={(e) => setKhoaId(e.target.value)}>
                <option value="">— Tất cả khoa —</option>
                {khoaList.map((k) => <option key={k.id} value={k.id}>{k.ten_khoa}</option>)}
              </select>
            </label>
            <label>
              <span style={lb}>Bác sĩ khám *</span>
              <select style={inp} value={bacSiId} onChange={(e) => setBacSiId(e.target.value)}>
                <option value="">— Chọn bác sĩ —</option>
                {bsList.map((b) => (
                  <option key={b.id} value={b.id}>
                    {[b.hoc_ham, b.ho_ten].filter(Boolean).join(" ")}{b.khoa ? ` — ${b.khoa.ten_khoa}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span style={lb}>Ngày khám *</span>
              <input type="date" min={todayISO()} style={inp} value={ngay} onChange={(e) => setNgay(e.target.value)} />
            </label>
            <label>
              <span style={lb}>Giờ khám *</span>
              <select style={inp} value={gio} onChange={(e) => setGio(e.target.value)}>
                {(GIO_KHAM.includes(gio) ? GIO_KHAM : [gio, ...GIO_KHAM]).map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </label>
          </div>

          {r.ngay_mong_muon && (
            <div style={{ fontSize: 13, color: T.sub, marginTop: 10 }}>
              <Clock size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
              Bệnh nhân mong muốn: {fmtNgay(r.ngay_mong_muon)}{r.gio_mong_muon ? ` · ${r.gio_mong_muon}` : ""}
              {r.khoa ? ` · ${r.khoa.ten_khoa}` : ""}
            </div>
          )}

          {/* Gắn hồ sơ cũ — tránh tạo trùng hồ sơ cho bệnh nhân đã từng khám */}
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${T.line}` }}>
            <span style={lb}>Hồ sơ bệnh nhân</span>
            {hoSo ? (
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", background: T.skySoft, borderRadius: 12, padding: "10px 12px" }}>
                <Link2 size={14} style={{ color: T.sky }} />
                <span style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>{hoSo.ho_ten}</span>
                <Pill tone={T.sky} soft="#fff">{hoSo.ma_benh_nhan}</Pill>
                <Btn kind="ghost" size="sm" onClick={() => setHoSo(null)}>Bỏ gắn</Btn>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 13, color: T.sub, marginBottom: 8 }}>
                  Chưa gắn hồ sơ — hệ thống sẽ tạo hồ sơ mới từ thông tin phiếu. Với bệnh nhân cũ, hãy tra cứu và gắn hồ sơ sẵn có.
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input style={{ ...inp, flex: 1, minWidth: 200 }} placeholder="Tìm theo tên, mã BN hoặc SĐT"
                    value={timHoSo} onChange={(e) => setTimHoSo(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") tim(); }} />
                  <Btn kind="soft" size="sm" onClick={tim} disabled={!timHoSo.trim()}><Search size={14} /> Tra cứu</Btn>
                </div>
                {hoSoList && hoSoList.length === 0 && (
                  <div style={{ fontSize: 13, color: T.sub, marginTop: 8 }}>Không tìm thấy hồ sơ phù hợp.</div>
                )}
                {hoSoList && hoSoList.length > 0 && (
                  <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                    {hoSoList.map((h) => (
                      <button key={h.id} type="button" onClick={() => setHoSo(h)}
                        style={{ textAlign: "left", background: T.bg, border: `1px solid ${T.line}`, borderRadius: 10, padding: "8px 11px", cursor: "pointer", fontFamily: "inherit" }}>
                        <span style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>{h.ho_ten}</span>
                        <span style={{ fontSize: 12.5, color: T.sub, marginLeft: 8 }}>{h.ma_benh_nhan}{h.sdt ? ` · ${h.sdt}` : ""}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <label style={{ display: "block", marginTop: 16 }}>
            <span style={lb}>Ghi chú lễ tân</span>
            <input style={inp} value={ghiChu} onChange={(e) => setGhiChu(e.target.value)}
              placeholder="VD: đã gọi xác nhận, bệnh nhân đến trước 15 phút" />
          </label>

          {err && <div style={{ background: "#FDECEA", color: "#C0392B", fontSize: 13.5, padding: "10px 13px", borderRadius: 12, marginTop: 14 }}>{err}</div>}
        </div>

        <div style={{ padding: "14px 20px", borderTop: `1px solid ${T.line}`, display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, color: T.sub, marginRight: "auto", maxWidth: 320 }}>
            Sau khi xác nhận, lịch khám hiện ở cổng bác sĩ được chọn và bác sĩ nhận thông báo.
          </span>
          <Btn kind="ghost" onClick={onClose} disabled={busy}>Đóng</Btn>
          <Btn kind="mint" onClick={luu} disabled={busy}>
            <CheckCircle2 size={16} /> {busy ? "Đang lưu…" : "Xác nhận & tạo lịch khám"}
          </Btn>
        </div>
      </Card>
    </div>
  );
}
