import React, { useState, useEffect, useRef } from "react";
import {
  Search, UserPlus, User, Phone, CalendarCheck, CreditCard, ChevronLeft, Stethoscope,
  CalendarClock, FileText, FlaskConical, Paperclip, Download, Upload, CheckCircle2,
} from "lucide-react";
import { T, store, api, useNav, Btn, Card, Pill, PageTitle, input } from "./shared";

// ============================================================================
//  TRA CỨU & TIẾP NHẬN BỆNH NHÂN — trang Tiếp đón của lễ tân.
//  - Bệnh nhân cũ:  GET /patients?q=  (tìm theo tên / mã BN / SĐT trong database)
//                   GET /patients/:id/appointments  (lịch hẹn đã có của hồ sơ)
//  - Bệnh nhân mới: POST /reception/patients  (lễ tân tạo hồ sơ walk-in;
//                   backend chặn trùng SĐT trừ khi xác nhận cho_phep_trung)
// ============================================================================

const inp = { ...input, padding: "10px 12px", fontSize: 14, borderRadius: 10 };

const TT_LICH = {
  cho_xac_nhan: { text: "Chờ xác nhận", tone: T.gold, soft: T.goldSoft },
  da_xac_nhan: { text: "Đã xác nhận", tone: T.sky, soft: T.skySoft },
  da_checkin: { text: "Đã check-in", tone: T.lav, soft: T.lavSoft },
  da_kham: { text: "Đã khám", tone: T.mint, soft: T.mintSoft },
  da_huy: { text: "Đã hủy", tone: T.peach, soft: T.peachSoft },
};

const fmtNgay = (d) => { const x = new Date(d); return isNaN(x) ? "" : x.toLocaleDateString("vi-VN"); };

function tinhTuoi(ngaySinh) {
  if (!ngaySinh) return "";
  const d = new Date(ngaySinh); if (isNaN(d)) return "";
  const now = new Date();
  let t = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) t--;
  return t >= 0 && t < 200 ? `${t} tuổi` : "";
}

const EMPTY_MOI = { ho_ten: "", ngay_sinh: "", gioi_tinh: "", sdt: "", dia_chi: "", so_bhyt: "", bac_si_mong_muon_id: "" };

// Nhãn hiển thị bác sĩ: tên (đã gồm học hàm) + khoa
const tenBS = (d) => d ? `${d.ho_ten}${d.khoa && d.khoa.ten_khoa ? ` — ${d.khoa.ten_khoa}` : ""}` : "";

// Khai báo ngoài component để input không bị remount (mất focus) sau mỗi lần gõ phím
const Field = ({ label, children, span }) => (
  <label style={{ display: "block", gridColumn: span ? `span ${span}` : undefined }}>
    <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 600, display: "block", marginBottom: 5 }}>{label}</span>
    {children}
  </label>
);

export default function TiepNhanBenhNhan() {
  const { online } = useNav();
  const live = online && !!store.token;
  const [mode, setMode] = useState("cu");        // "cu" | "moi"

  // --- Tra cứu bệnh nhân cũ ---
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);  // null = chưa tìm
  const [selected, setSelected] = useState(null);
  const [appts, setAppts] = useState([]);
  const [finding, setFinding] = useState(false);

  // --- Tiếp nhận bệnh nhân mới ---
  const [f, setF] = useState(EMPTY_MOI);
  const [trung, setTrung] = useState(null);      // cảnh báo trùng SĐT từ backend
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);          // { type: "ok"|"err", text }
  const [doctors, setDoctors] = useState([]);    // danh sách bác sĩ để chọn "mong muốn khám"

  useEffect(() => {
    api.doctors().then((r) => setDoctors(Array.isArray(r) ? r : [])).catch(() => {});
  }, []);

  const tim = async (tuKhoa) => {
    const query = (tuKhoa !== undefined ? tuKhoa : q).trim();
    if (!query || !live) return;
    setFinding(true); setSelected(null); setMsg(null);
    try { setResults(await api.patients(query)); }
    catch (e) { setMsg({ type: "err", text: e.message }); setResults([]); }
    finally { setFinding(false); }
  };

  const chon = async (hs) => {
    setSelected(hs); setAppts([]);
    try { setAppts(await api.patientAppts(hs.id)); } catch { /* hồ sơ vẫn xem được */ }
  };

  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const luu = async (choPhepTrung) => {
    setMsg(null);
    if (!f.ho_ten.trim()) { setMsg({ type: "err", text: "Vui lòng nhập Họ và tên." }); return; }
    setSaving(true);
    try {
      const hs = await api.createReceptionPatient(choPhepTrung ? { ...f, cho_phep_trung: true } : f);
      setTrung(null); setF(EMPTY_MOI);
      setMsg({ type: "ok", text: `Đã tạo hồ sơ ${hs.ma_benh_nhan} cho ${hs.ho_ten}. Có thể dùng mã này để lập phiếu khám / đặt lịch.` });
      setMode("cu"); setQ(hs.ma_benh_nhan); setResults([{ ...hs, so_luot_dat: 0 }]); chon(hs);
    } catch (e) {
      // Backend báo trùng SĐT — cho lễ tân chọn: tra cứu hồ sơ cũ hoặc xác nhận tạo mới
      if (/đã có hồ sơ/.test(e.message)) setTrung(e.message);
      else setMsg({ type: "err", text: e.message });
    } finally { setSaving(false); }
  };

  return (
    <div>
      <PageTitle title="Tra cứu & tiếp nhận bệnh nhân"
        sub={live ? "Tìm bệnh nhân đã có hồ sơ trong hệ thống, hoặc tạo hồ sơ cho bệnh nhân mới đến." : "Cần đăng nhập tài khoản lễ tân với backend để thao tác."} />

      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <Btn kind={mode === "cu" ? "primary" : "ghost"} size="sm" onClick={() => { setMode("cu"); setMsg(null); }}>
          <Search size={15} style={{ marginRight: 6, verticalAlign: -2 }} />Bệnh nhân cũ
        </Btn>
        <Btn kind={mode === "moi" ? "primary" : "ghost"} size="sm" onClick={() => { setMode("moi"); setMsg(null); }}>
          <UserPlus size={15} style={{ marginRight: 6, verticalAlign: -2 }} />Bệnh nhân mới
        </Btn>
      </div>

      {msg && (
        <Card style={{ padding: 14, marginBottom: 14, border: "none", fontSize: 14,
          background: msg.type === "ok" ? T.mintSoft : "#FDECEA",
          color: msg.type === "ok" ? "#1E7A5F" : "#C0392B" }}>{msg.text}</Card>
      )}

      {mode === "cu" && (
        <div>
          <Card style={{ padding: 16, marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 10 }}>
              <input style={{ ...inp, flex: 1 }} placeholder="Nhập tên, mã bệnh nhân (BN…) hoặc số điện thoại…"
                value={q} onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && tim()} />
              <Btn onClick={() => tim()} disabled={finding || !live}>{finding ? "Đang tìm…" : "Tra cứu"}</Btn>
            </div>
          </Card>

          {selected ? (
            <PatientDetail hs={selected} appts={appts} doctors={doctors} onBack={() => setSelected(null)}
              onUpdated={(h) => { setSelected(h); setResults((rs) => rs && rs.map((x) => (x.id === h.id ? { ...x, ...h } : x))); }} />
          ) : results === null ? (
            <Card style={{ padding: 36, textAlign: "center", color: T.sub }}>
              Nhập từ khóa để tra cứu bệnh nhân đã có trong cơ sở dữ liệu.
            </Card>
          ) : results.length === 0 ? (
            <Card style={{ padding: 30, textAlign: "center", color: T.sub }}>
              Không tìm thấy bệnh nhân nào khớp "{q}".{" "}
              <Btn kind="ghost" size="sm" onClick={() => setMode("moi")}>Tiếp nhận bệnh nhân mới</Btn>
            </Card>
          ) : (
            <Card style={{ padding: 0, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ background: T.goldSoft, color: T.ink, textAlign: "left" }}>
                    {["Mã BN", "Họ tên", "Ngày sinh", "Giới tính", "SĐT", "BS mong muốn", "Tái khám", "Lượt đặt", ""].map((h) => (
                      <th key={h} style={{ padding: "11px 14px", fontWeight: 700, fontSize: 13 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map((hs) => (
                    <tr key={hs.id} style={{ borderTop: `1px solid ${T.line}`, cursor: "pointer" }} onClick={() => chon(hs)}>
                      <td style={{ padding: "11px 14px", fontWeight: 700, color: T.gold }}>{hs.ma_benh_nhan}</td>
                      <td style={{ padding: "11px 14px", color: T.ink, fontWeight: 600 }}>{hs.ho_ten}</td>
                      <td style={{ padding: "11px 14px", color: T.sub }}>{hs.ngay_sinh ? `${fmtNgay(hs.ngay_sinh)} · ${tinhTuoi(hs.ngay_sinh)}` : "—"}</td>
                      <td style={{ padding: "11px 14px", color: T.sub }}>{hs.gioi_tinh || "—"}</td>
                      <td style={{ padding: "11px 14px", color: T.sub }}>{hs.sdt || "—"}</td>
                      <td style={{ padding: "11px 14px", color: T.sub }}>{(hs.bac_si_mong_muon && hs.bac_si_mong_muon.ho_ten) || "—"}</td>
                      <td style={{ padding: "11px 14px" }}>
                        {hs.ngay_tai_kham
                          ? <Pill tone={T.gold} soft={T.goldSoft}><CalendarClock size={12} style={{ verticalAlign: -2, marginRight: 4 }} />{fmtNgay(hs.ngay_tai_kham)}</Pill>
                          : <span style={{ color: T.sub }}>—</span>}
                      </td>
                      <td style={{ padding: "11px 14px" }}><Pill tone={T.sky} soft={T.skySoft}>{hs.so_luot_dat ?? 0} lượt</Pill></td>
                      <td style={{ padding: "11px 14px" }}><Btn kind="ghost" size="sm">Xem</Btn></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}

      {mode === "moi" && (
        <Card style={{ padding: 22, maxWidth: 720 }}>
          <div style={{ fontWeight: 800, color: T.ink, fontSize: 16, marginBottom: 14 }}>
            <UserPlus size={17} style={{ verticalAlign: -3, marginRight: 8, color: T.gold }} />
            Hồ sơ bệnh nhân mới đến
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
            <Field label="Họ và tên *" span={2}>
              <input style={inp} value={f.ho_ten} onChange={(e) => set("ho_ten", e.target.value)} placeholder="VD: Nguyễn Thị Hồng" />
            </Field>
            <Field label="Ngày sinh">
              <input type="date" style={inp} value={f.ngay_sinh} onChange={(e) => set("ngay_sinh", e.target.value)} />
            </Field>
            <Field label="Giới tính">
              <select style={inp} value={f.gioi_tinh} onChange={(e) => set("gioi_tinh", e.target.value)}>
                <option value="">— Chọn —</option>
                <option>Nữ</option><option>Nam</option><option>Khác</option>
              </select>
            </Field>
            <Field label="Số điện thoại">
              <input style={inp} value={f.sdt} onChange={(e) => set("sdt", e.target.value)} placeholder="VD: 0912345678" />
            </Field>
            <Field label="Số thẻ BHYT">
              <input style={inp} value={f.so_bhyt} onChange={(e) => set("so_bhyt", e.target.value)} />
            </Field>
            <Field label="Địa chỉ" span={2}>
              <input style={inp} value={f.dia_chi} onChange={(e) => set("dia_chi", e.target.value)} />
            </Field>
            <Field label="Bác sĩ mong muốn được khám" span={2}>
              <select style={inp} value={f.bac_si_mong_muon_id} onChange={(e) => set("bac_si_mong_muon_id", e.target.value)}>
                <option value="">— Không yêu cầu —</option>
                {doctors.map((d) => <option key={d.id} value={d.id}>{tenBS(d)}</option>)}
              </select>
            </Field>
          </div>

          {trung && (
            <Card style={{ padding: 14, marginTop: 14, border: "none", background: T.goldSoft, color: T.ink, fontSize: 14 }}>
              <div style={{ marginBottom: 10 }}>⚠️ {trung}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn size="sm" onClick={() => { setTrung(null); setMode("cu"); setQ(f.sdt); tim(f.sdt); }}>Tra cứu hồ sơ cũ</Btn>
                <Btn kind="ghost" size="sm" onClick={() => luu(true)} disabled={saving}>Vẫn tạo hồ sơ mới</Btn>
              </div>
            </Card>
          )}

          <div style={{ marginTop: 18, display: "flex", gap: 10 }}>
            <Btn onClick={() => luu(false)} disabled={saving || !live}>{saving ? "Đang lưu…" : "Tạo hồ sơ bệnh nhân"}</Btn>
            <Btn kind="ghost" onClick={() => { setF(EMPTY_MOI); setTrung(null); setMsg(null); }}>Nhập lại</Btn>
          </div>
        </Card>
      )}
    </div>
  );
}

const TEN_LOAI_CLS = { xet_nghiem: "Xét nghiệm", sieu_am: "Siêu âm", thu_thuat: "Thủ thuật" };
const fmtKB = (b) => (b >= 1024 * 1024 ? (b / 1024 / 1024).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB");

// Chi tiết một hồ sơ: thông tin cơ bản + lịch hẹn + hẹn tái khám (lễ tân note ngày,
// bác sĩ tái khám được thông báo ở cổng bác sĩ) + thông tin phục vụ tái khám
// (kết luận & toa thuốc cũ, kết quả cận lâm sàng, tài liệu bệnh án lần trước).
function PatientDetail({ hs, appts, doctors, onBack, onUpdated }) {
  const [info, setInfo] = useState(null);   // GET /patients/:id/revisit-info
  const [tk, setTk] = useState({ ngay: "", bs_id: "", ghi_chu: "" });
  const [savingTk, setSavingTk] = useState(false);
  const [msgTk, setMsgTk] = useState(null);

  // Lịch khám mới (bệnh nhân đến khám hôm nay) + tải tài liệu điều trị ngoại trú
  const today = new Date().toLocaleDateString("en-CA");
  const [loaiLich, setLoaiLich] = useState("khammoi"); // "khammoi" | "taikham"
  const [nx, setNx] = useState({ bs_id: "", ngay: today });
  const [nxLich, setNxLich] = useState(null);
  const [nxMsg, setNxMsg] = useState(null);
  const [nxSaving, setNxSaving] = useState(false);
  const [docs, setDocs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    setInfo(null); setMsgTk(null);
    setTk({ ngay: hs.ngay_tai_kham || "", bs_id: (hs.bac_si_tai_kham && hs.bac_si_tai_kham.id) || "", ghi_chu: hs.ghi_chu_tai_kham || "" });
    setLoaiLich("khammoi"); setNx({ bs_id: "", ngay: today }); setNxLich(null); setNxMsg(null); setDocs([]);
    api.revisitInfo(hs.id).then(setInfo).catch(() => setInfo({ lan_kham: [] }));
  }, [hs.id]);

  const taoKhamMoi = async () => {
    setNxMsg(null);
    if (!nx.bs_id) { setNxMsg({ type: "err", text: "Vui lòng chọn bác sĩ khám." }); return; }
    setNxSaving(true);
    try {
      const r = await api.createNewExam({ ho_so_id: hs.id, bac_si_id: nx.bs_id, ngay: nx.ngay || undefined });
      setNxLich(r); setDocs([]);
      setNxMsg({ type: "ok", text: `Đã tạo lịch khám ${r.ma_lich_hen} — bệnh nhân đã vào hàng chờ khám.` });
    } catch (e) { setNxMsg({ type: "err", text: e.message }); }
    finally { setNxSaving(false); }
  };

  const taiTaiLieu = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file || !nxLich) return;
    setNxMsg(null); setUploading(true);
    try {
      await api.uploadDocument(nxLich.id, file);
      const list = await api.documents(nxLich.id);
      setDocs(Array.isArray(list) ? list : []);
      setNxMsg({ type: "ok", text: `Đã tải lên "${file.name}".` });
    } catch (err) { setNxMsg({ type: "err", text: err.message }); }
    finally { setUploading(false); }
  };

  const luuTaiKham = async (xoa) => {
    setMsgTk(null);
    if (!xoa && !tk.ngay) { setMsgTk({ type: "err", text: "Vui lòng chọn ngày tái khám." }); return; }
    setSavingTk(true);
    try {
      const saved = await api.setRevisit(hs.id, xoa
        ? { ngay_tai_kham: "" }
        : { ngay_tai_kham: tk.ngay, bac_si_tai_kham_id: tk.bs_id || undefined, ghi_chu_tai_kham: tk.ghi_chu });
      onUpdated({ ...hs, ngay_tai_kham: saved.ngay_tai_kham, ghi_chu_tai_kham: saved.ghi_chu_tai_kham, bac_si_tai_kham: saved.bac_si_tai_kham || null });
      setMsgTk({ type: "ok", text: xoa ? "Đã xóa hẹn tái khám." : "Đã lưu hẹn tái khám vào hồ sơ — bác sĩ sẽ thấy thông báo." });
    } catch (e) { setMsgTk({ type: "err", text: e.message }); }
    finally { setSavingTk(false); }
  };

  const taiVe = (t) => api.downloadDocument(t.id).then((b) => {
    const u = URL.createObjectURL(b);
    const a = document.createElement("a");
    a.href = u; a.download = t.ten_tep || "tai-lieu"; a.click();
    setTimeout(() => URL.revokeObjectURL(u), 60000);
  }).catch((e) => setMsgTk({ type: "err", text: e.message }));

  // Chỉ hiện các lần khám thực sự có dữ liệu phục vụ tái khám
  const lanCo = info && Array.isArray(info.lan_kham)
    ? info.lan_kham.filter((lk) => lk.ket_luan || lk.so_kham || (lk.can_lam_sang && lk.can_lam_sang.length) || (lk.tai_lieu && lk.tai_lieu.length))
    : [];

  const Info = ({ icon: Icon, label, value }) => (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <Icon size={16} style={{ color: T.gold, marginTop: 2, flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: 12, color: T.sub, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 14.5, color: T.ink, fontWeight: 600 }}>{value || "—"}</div>
      </div>
    </div>
  );
  return (
    <div>
      <Btn kind="ghost" size="sm" onClick={onBack} style={{ marginBottom: 12 }}>
        <ChevronLeft size={15} style={{ verticalAlign: -2 }} /> Danh sách kết quả
      </Btn>
      <Card style={{ padding: 22, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontWeight: 800, color: T.ink, fontSize: 17 }}>{hs.ho_ten}</div>
          <Pill tone={T.gold} soft={T.goldSoft}>{hs.ma_benh_nhan}</Pill>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }} className="grid3">
          <Info icon={User} label="Ngày sinh"
            value={hs.ngay_sinh ? `${fmtNgay(hs.ngay_sinh)} (${tinhTuoi(hs.ngay_sinh)})` : ""} />
          <Info icon={User} label="Giới tính" value={hs.gioi_tinh} />
          <Info icon={Phone} label="Số điện thoại" value={hs.sdt} />
          <Info icon={CreditCard} label="Số thẻ BHYT" value={hs.so_bhyt} />
          <Info icon={User} label="Địa chỉ" value={hs.dia_chi} />
          <Info icon={CalendarCheck} label="Tổng lượt đặt lịch" value={`${hs.so_luot_dat ?? appts.length} lượt`} />
          <Info icon={Stethoscope} label="Bác sĩ mong muốn khám" value={tenBS(hs.bac_si_mong_muon)} />
        </div>
      </Card>

      {/* Lịch khám: chọn Lịch khám mới (đến khám hôm nay) hoặc Lịch tái khám */}
      <Card style={{ padding: 22, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <div style={{ fontWeight: 800, color: T.ink, fontSize: 16 }}>
            <CalendarClock size={17} style={{ verticalAlign: -3, marginRight: 8, color: T.gold }} />
            Lịch khám
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, color: T.sub, fontWeight: 600 }}>Loại lịch</span>
            <select style={{ ...inp, width: "auto" }} value={loaiLich}
              onChange={(e) => { setLoaiLich(e.target.value); setNxMsg(null); setMsgTk(null); }}>
              <option value="khammoi">Lịch khám mới</option>
              <option value="taikham">Lịch tái khám</option>
            </select>
          </label>
        </div>

        {loaiLich === "khammoi" ? (
          <div>
            <div style={{ fontSize: 13.5, color: T.sub, marginBottom: 12 }}>
              Bệnh nhân đến khám hôm nay — chọn bác sĩ khám và tải lên thông tin điều trị ngoại trú (nếu có) từ nơi khác chuyển đến.
            </div>
            {nxMsg && (
              <div style={{ padding: "10px 14px", borderRadius: 12, marginBottom: 12, fontSize: 13.5,
                background: nxMsg.type === "ok" ? T.mintSoft : "#FDECEA",
                color: nxMsg.type === "ok" ? "#1E7A5F" : "#C0392B" }}>{nxMsg.text}</div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }} className="grid2">
              <Field label="Bác sĩ khám *">
                <select style={inp} value={nx.bs_id} onChange={(e) => setNx((s) => ({ ...s, bs_id: e.target.value }))} disabled={!!nxLich}>
                  <option value="">— Chọn bác sĩ —</option>
                  {doctors.map((d) => <option key={d.id} value={d.id}>{tenBS(d)}</option>)}
                </select>
              </Field>
              <Field label="Ngày khám">
                <input type="date" style={inp} value={nx.ngay} onChange={(e) => setNx((s) => ({ ...s, ngay: e.target.value }))} disabled={!!nxLich} />
              </Field>
            </div>

            {!nxLich ? (
              <div style={{ marginTop: 14 }}>
                <Btn size="sm" onClick={taoKhamMoi} disabled={nxSaving}>{nxSaving ? "Đang tạo…" : "Tạo lịch khám mới"}</Btn>
              </div>
            ) : (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 14 }}>
                  <Pill tone={T.mint} soft={T.mintSoft}><CheckCircle2 size={12} style={{ verticalAlign: -2, marginRight: 4 }} />{nxLich.ma_lich_hen} · STT #{nxLich.so_thu_tu}</Pill>
                  <span style={{ fontSize: 13.5, color: T.sub }}>{nxLich.bac_si}{nxLich.khoa ? ` — ${nxLich.khoa}` : ""} · đã vào hàng chờ khám</span>
                  <Btn kind="ghost" size="sm" onClick={() => { setNxLich(null); setNx({ bs_id: "", ngay: today }); setDocs([]); setNxMsg(null); }}>Tạo lịch khác</Btn>
                </div>
                <div style={{ fontWeight: 700, color: T.ink, fontSize: 14, marginBottom: 8 }}>
                  <Paperclip size={14} style={{ verticalAlign: -2, marginRight: 6, color: T.sky }} />
                  Thông tin điều trị ngoại trú (PDF / Word, tối đa 10MB)
                </div>
                {docs.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                    {docs.map((t) => (
                      <Btn key={t.id} kind="ghost" size="sm" onClick={() => api.downloadDocument(t.id).then((b) => { const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = t.ten_tep; a.click(); setTimeout(() => URL.revokeObjectURL(u), 60000); }).catch(() => {})}>
                        <FileText size={13} style={{ verticalAlign: -2, marginRight: 6, color: T.sky }} />{t.ten_tep} ({fmtKB(t.kich_thuoc)})
                      </Btn>
                    ))}
                  </div>
                )}
                <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" style={{ display: "none" }} onChange={taiTaiLieu} />
                <Btn kind="ghost" size="sm" onClick={() => fileRef.current && fileRef.current.click()} disabled={uploading}>
                  <Upload size={14} style={{ verticalAlign: -2, marginRight: 6 }} />{uploading ? "Đang tải lên…" : "Tải tệp lên"}
                </Btn>
              </div>
            )}
          </div>
        ) : (
          <div>
            {hs.ngay_tai_kham && <div style={{ marginBottom: 12 }}><Pill tone={T.gold} soft={T.goldSoft}>Đang hẹn: {fmtNgay(hs.ngay_tai_kham)}</Pill></div>}
            {msgTk && (
              <div style={{ padding: "10px 14px", borderRadius: 12, marginBottom: 12, fontSize: 13.5,
                background: msgTk.type === "ok" ? T.mintSoft : "#FDECEA",
                color: msgTk.type === "ok" ? "#1E7A5F" : "#C0392B" }}>{msgTk.text}</div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }} className="grid3">
              <Field label="Ngày tái khám *">
                <input type="date" style={inp} value={tk.ngay} onChange={(e) => setTk((s) => ({ ...s, ngay: e.target.value }))} />
              </Field>
              <Field label="Bác sĩ tái khám (được thông báo)">
                <select style={inp} value={tk.bs_id} onChange={(e) => setTk((s) => ({ ...s, bs_id: e.target.value }))}>
                  <option value="">— Chưa chọn —</option>
                  {doctors.map((d) => <option key={d.id} value={d.id}>{tenBS(d)}</option>)}
                </select>
              </Field>
              <Field label="Ghi chú chuẩn bị">
                <input style={inp} value={tk.ghi_chu} placeholder="VD: mang toa thuốc cũ, phim X-quang…"
                  onChange={(e) => setTk((s) => ({ ...s, ghi_chu: e.target.value }))} />
              </Field>
            </div>
            <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
              <Btn size="sm" onClick={() => luuTaiKham(false)} disabled={savingTk}>{savingTk ? "Đang lưu…" : "Lưu hẹn tái khám"}</Btn>
              {hs.ngay_tai_kham && <Btn kind="ghost" size="sm" onClick={() => luuTaiKham(true)} disabled={savingTk}>Xóa hẹn</Btn>}
            </div>
          </div>
        )}
      </Card>

      {/* Thông tin phục vụ tái khám: sổ khám/toa thuốc cũ, kết quả CLS, tài liệu bệnh án */}
      <Card style={{ padding: 0, overflow: "hidden", marginBottom: 16 }}>
        <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.line}` }}>
          <div style={{ fontWeight: 800, color: T.ink }}>Thông tin phục vụ tái khám</div>
          <div style={{ fontSize: 12.5, color: T.sub, marginTop: 3 }}>
            Sổ khám bệnh, toa thuốc cũ, kết quả xét nghiệm / siêu âm / X-quang và tài liệu các lần khám trước.
          </div>
        </div>
        {info === null ? (
          <div style={{ padding: 26, textAlign: "center", color: T.sub, fontSize: 14 }}>Đang tải dữ liệu…</div>
        ) : lanCo.length === 0 ? (
          <div style={{ padding: 26, textAlign: "center", color: T.sub, fontSize: 14 }}>
            Chưa có kết luận, toa thuốc hay kết quả cận lâm sàng nào từ các lần khám trước.
          </div>
        ) : lanCo.map((lk) => (
          <div key={lk.lich_hen_id} style={{ borderTop: `1px solid ${T.line}`, padding: "16px 18px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 10 }}>
              <Pill tone={T.sky} soft={T.skySoft}>{lk.ma_lich_hen}</Pill>
              <span style={{ fontWeight: 700, color: T.ink, fontSize: 14 }}>
                {lk.ngay ? fmtNgay(lk.ngay) : "—"}{lk.gio ? ` · ${lk.gio}` : ""}
              </span>
              <span style={{ color: T.sub, fontSize: 13.5 }}>{[lk.bac_si, lk.khoa].filter(Boolean).join(" — ")}</span>
            </div>

            {lk.ket_luan && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 4 }}>
                  <FileText size={14} style={{ verticalAlign: -2, marginRight: 6, color: T.peach }} />
                  Kết luận & toa thuốc
                </div>
                <div style={{ fontSize: 13.5, color: T.ink, paddingLeft: 20, display: "grid", gap: 3 }}>
                  <div><b>Chẩn đoán:</b> {lk.ket_luan.chan_doan_chinh}{lk.ket_luan.ma_icd ? ` (${lk.ket_luan.ma_icd})` : ""}</div>
                  {lk.ket_luan.don_thuoc && <div style={{ whiteSpace: "pre-wrap" }}><b>Đơn thuốc:</b> {lk.ket_luan.don_thuoc}</div>}
                  {lk.ket_luan.loi_dan && <div style={{ whiteSpace: "pre-wrap" }}><b>Lời dặn:</b> {lk.ket_luan.loi_dan}</div>}
                  {lk.ket_luan.ngay_tai_kham && <div><b>Bác sĩ hẹn tái khám:</b> {fmtNgay(lk.ket_luan.ngay_tai_kham)}</div>}
                </div>
              </div>
            )}

            {lk.so_kham && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 4 }}>
                  <FileText size={14} style={{ verticalAlign: -2, marginRight: 6, color: T.lav }} />
                  Sổ khám bệnh
                </div>
                <div style={{ fontSize: 13.5, color: T.ink, paddingLeft: 20, display: "grid", gap: 3 }}>
                  {lk.so_kham.chan_doan && <div><b>Chẩn đoán:</b> {lk.so_kham.chan_doan}</div>}
                  {lk.so_kham.don_thuoc && lk.so_kham.don_thuoc.danh_sach_thuoc && (
                    <div style={{ whiteSpace: "pre-wrap" }}>
                      <b>Toa thuốc cũ:</b> {lk.so_kham.don_thuoc.danh_sach_thuoc}
                      {lk.so_kham.don_thuoc.lieu_dung ? ` — ${lk.so_kham.don_thuoc.lieu_dung}` : ""}
                    </div>
                  )}
                  {lk.so_kham.ghi_chu && <div><b>Ghi chú:</b> {lk.so_kham.ghi_chu}</div>}
                </div>
              </div>
            )}

            {lk.can_lam_sang && lk.can_lam_sang.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 4 }}>
                  <FlaskConical size={14} style={{ verticalAlign: -2, marginRight: 6, color: T.mint }} />
                  Kết quả cận lâm sàng
                </div>
                <div style={{ paddingLeft: 20, display: "grid", gap: 4 }}>
                  {lk.can_lam_sang.map((c) => (
                    <div key={c.id} style={{ fontSize: 13.5, color: T.ink }}>
                      <b>{c.ten_chi_dinh}</b> <span style={{ color: T.sub }}>({TEN_LOAI_CLS[c.loai] || c.loai})</span>
                      {c.trang_thai === "da_co_ket_qua"
                        ? <span style={{ whiteSpace: "pre-wrap" }}> — {c.ket_qua}{c.ket_luan ? ` · KL: ${c.ket_luan}` : ""}</span>
                        : <span style={{ color: T.sub }}> — chờ kết quả</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {lk.tai_lieu && lk.tai_lieu.length > 0 && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 6 }}>
                  <Paperclip size={14} style={{ verticalAlign: -2, marginRight: 6, color: T.sky }} />
                  Tài liệu bệnh án (phim chụp, giấy ra viện…)
                </div>
                <div style={{ paddingLeft: 20, display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {lk.tai_lieu.map((t) => (
                    <Btn key={t.id} kind="ghost" size="sm" onClick={() => taiVe(t)}>
                      <Download size={13} style={{ verticalAlign: -2, marginRight: 6 }} />{t.ten_tep} ({fmtKB(t.kich_thuoc)})
                    </Btn>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </Card>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", fontWeight: 800, color: T.ink, borderBottom: `1px solid ${T.line}` }}>
          Lịch hẹn của bệnh nhân ({appts.length})
        </div>
        {appts.length === 0 ? (
          <div style={{ padding: 26, textAlign: "center", color: T.sub, fontSize: 14 }}>Chưa có lịch hẹn nào trong hệ thống.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "#FAFAF8", color: T.sub, textAlign: "left" }}>
                {["Mã lịch hẹn", "Ngày khám", "Giờ", "Bác sĩ", "Khoa", "Trạng thái"].map((h) => (
                  <th key={h} style={{ padding: "10px 14px", fontWeight: 700, fontSize: 12.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {appts.map((a) => {
                const tt = TT_LICH[a.trang_thai] || { text: a.trang_thai, tone: T.sub, soft: T.line };
                return (
                  <tr key={a.id} style={{ borderTop: `1px solid ${T.line}` }}>
                    <td style={{ padding: "10px 14px", fontWeight: 700, color: T.ink }}>{a.ma_lich_hen}</td>
                    <td style={{ padding: "10px 14px", color: T.sub }}>{a.khung_gio ? fmtNgay(a.khung_gio.ngay) : "—"}</td>
                    <td style={{ padding: "10px 14px", color: T.sub }}>{(a.khung_gio && a.khung_gio.gio_bat_dau) || "—"}</td>
                    <td style={{ padding: "10px 14px", color: T.sub }}>{(a.khung_gio && a.khung_gio.bac_si && a.khung_gio.bac_si.ho_ten) || "—"}</td>
                    <td style={{ padding: "10px 14px", color: T.sub }}>{(a.khoa && a.khoa.ten_khoa) || "—"}</td>
                    <td style={{ padding: "10px 14px" }}><Pill tone={tt.tone} soft={tt.soft}>{tt.text}</Pill></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
