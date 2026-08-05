import React, { useState, useEffect } from "react";
import { User, Plus, ArrowLeft, Lock, Unlock, CheckCircle2, KeyRound, X } from "lucide-react";
import { T, store, api, useNav, Btn, Card, Pill, Avatar, PageTitle, FormField, input } from "./shared";

// ============================================================================
//  QUẢN LÝ TÀI KHOẢN & PHÂN QUYỀN — trang "Người dùng" của cổng Quản trị viên.
//  - Danh sách tài khoản:  GET /admin/users           (admin)
//  - Tạo tài khoản mới:    POST /admin/users          (admin)
//    Mỗi bác sĩ có tên đăng nhập riêng; tạo tài khoản Bác sĩ sẽ đồng thời tạo
//    hồ sơ bác sĩ thuộc khoa đã chọn + khung giờ khám 14 ngày tới, để bệnh
//    nhân đặt lịch được ngay với bác sĩ đó.
//  - Khóa / mở khóa:       PATCH /admin/users/:id/status
// ============================================================================

const VAI_TRO = {
  benh_nhan: { l: "Bệnh nhân", tone: T.peach, soft: T.peachSoft },
  le_tan: { l: "Lễ tân", tone: T.gold, soft: T.goldSoft },
  bac_si: { l: "Bác sĩ", tone: T.sky, soft: T.skySoft },
  admin: { l: "Quản trị viên", tone: T.lav, soft: T.lavSoft },
};

export default function AdminUsers() {
  const { online } = useNav();
  const live = online && !!store.token;
  const [list, setList] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState(null); // thông báo sau khi tạo tài khoản
  const [pwFor, setPwFor] = useState(null); // id tài khoản đang đặt lại mật khẩu
  const [pw, setPw] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [selfOpen, setSelfOpen] = useState(false); // form đổi mật khẩu của chính admin
  const [sf, setSf] = useState({ cu: "", moi: "", xn: "" });
  const [selfBusy, setSelfBusy] = useState(false);
  const supd = (k) => (e) => setSf((s) => ({ ...s, [k]: e.target.value }));

  const load = () => {
    if (!live) return;
    setLoading(true); setErr(null);
    api.adminUsers()
      .then((r) => setList(Array.isArray(r) ? r : []))
      .catch((e) => { setErr(e.message); setList([]); })
      .finally(() => setLoading(false));
  };
  useEffect(load, [online]);

  const toggle = async (u) => {
    const moKhoa = !u.trang_thai;
    if (!window.confirm(`${moKhoa ? "Bỏ khóa" : "Khóa"} tài khoản "${u.ho_ten}"?`)) return;
    setErr(null);
    try {
      await api.toggleUser(u.id);
      setMsg(moKhoa
        ? `Đã bỏ khóa "${u.ho_ten}" — tài khoản đăng nhập lại được.`
        : `Đã khóa "${u.ho_ten}" — tài khoản không đăng nhập được cho tới khi bỏ khóa.`);
      load();
    } catch (e) { setErr(e.message); }
  };

  const saveSelf = async () => {
    setErr(null);
    if (sf.moi.length < 6) { setErr("Mật khẩu mới phải có ít nhất 6 ký tự."); return; }
    if (sf.moi !== sf.xn) { setErr("Xác nhận mật khẩu mới không khớp."); return; }
    setSelfBusy(true);
    try {
      await api.changeMyPassword(sf.cu, sf.moi);
      setSelfOpen(false); setSf({ cu: "", moi: "", xn: "" });
      setMsg("Đã đổi mật khẩu của bạn — lần đăng nhập sau hãy dùng mật khẩu mới.");
    } catch (e) { setErr(e.message); }
    finally { setSelfBusy(false); }
  };

  const savePw = async (u) => {
    if (pw.length < 6) { setErr("Mật khẩu mới phải có ít nhất 6 ký tự."); return; }
    setPwBusy(true); setErr(null);
    try {
      await api.resetPassword(u.id, pw);
      setPwFor(null); setPw("");
      setMsg(`Đã đặt mật khẩu mới cho "${u.ho_ten}" — đăng nhập bằng ${u.email || u.sdt} với mật khẩu vừa nhập.`);
    } catch (e) { setErr(e.message); }
    finally { setPwBusy(false); }
  };

  if (!live) {
    return (
      <div>
        <PageTitle title="Người dùng & Phân quyền" sub="Quản lý tài khoản và vai trò trong hệ thống." />
        <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>Cần kết nối backend để quản lý tài khoản thật.</Card>
      </div>
    );
  }
  if (adding) return <UserForm onBack={() => setAdding(false)} onSaved={(u) => { setAdding(false); setMsg(`Đã tạo tài khoản ${VAI_TRO[u.vai_tro].l} "${u.ho_ten}" — đăng nhập bằng ${u.email}.`); load(); }} />;

  const data = list || [];
  return (
    <div>
      <PageTitle title="Người dùng & Phân quyền" sub="Mỗi nhân sự một tên đăng nhập riêng với quyền theo vai trò." action={
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Btn kind="ghost" onClick={() => { setMsg(null); setErr(null); setSelfOpen((v) => !v); }}><KeyRound size={16} /> Đổi mật khẩu của tôi</Btn>
          <Btn kind="lav" onClick={() => { setMsg(null); setAdding(true); }}><Plus size={16} /> Tạo tài khoản</Btn>
        </div>
      } />
      <Card style={{ padding: "14px 18px", marginBottom: 14, background: T.lavSoft, border: "none", fontSize: 13.5, color: T.ink }}>
        <KeyRound size={14} style={{ verticalAlign: -2 }} /> Mật khẩu được mã hóa một chiều (bcrypt) trong database nên <b>không thể xem lại</b> — chỉ có thể cấp mật khẩu mới bằng nút "Đặt mật khẩu".
        Các tài khoản demo có sẵn (benhnhan / letan / bacsi / admin @demo.vn) dùng mật khẩu <b>123456</b>.
      </Card>
      {selfOpen && (
        <Card style={{ padding: 20, marginBottom: 14 }}>
          <div style={{ fontWeight: 800, color: T.ink, fontSize: 15, marginBottom: 4 }}>Đổi mật khẩu của tôi</div>
          <div style={{ color: T.sub, fontSize: 13, marginBottom: 14 }}>Đổi mật khẩu cho tài khoản đang đăng nhập ({store.user?.email || store.user?.ho_ten || "quản trị viên"}). Cần nhập đúng mật khẩu hiện tại.</div>
          <div style={{ display: "grid", gap: 12, maxWidth: 360 }}>
            <input type="password" value={sf.cu} onChange={supd("cu")} placeholder="Mật khẩu hiện tại" autoComplete="current-password" style={input} />
            <input type="password" value={sf.moi} onChange={supd("moi")} placeholder="Mật khẩu mới (≥ 6 ký tự)" autoComplete="new-password" style={input} />
            <input type="password" value={sf.xn} onChange={supd("xn")} placeholder="Nhập lại mật khẩu mới" autoComplete="new-password" style={input} />
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <Btn kind="ghost" onClick={() => { setSelfOpen(false); setSf({ cu: "", moi: "", xn: "" }); setErr(null); }}><X size={14} /> Hủy</Btn>
            <Btn kind="lav" disabled={selfBusy} onClick={saveSelf}><CheckCircle2 size={16} /> {selfBusy ? "Đang lưu..." : "Đổi mật khẩu"}</Btn>
          </div>
        </Card>
      )}
      {msg && <Card style={{ padding: 16, marginBottom: 14, background: T.mintSoft, border: "none", color: T.ink, fontSize: 14 }}><CheckCircle2 size={15} style={{ verticalAlign: -3, color: T.mint }} /> {msg}</Card>}
      {loading && <div style={{ color: T.sub, fontSize: 14, marginBottom: 12 }}>Đang tải danh sách tài khoản...</div>}
      {err && <Card style={{ padding: 18, marginBottom: 14, background: "#FDECEA", border: "none", color: "#C0392B", fontSize: 14 }}>{err}</Card>}
      <div style={{ display: "grid", gap: 12 }}>
        {data.map((u) => {
          const r = VAI_TRO[u.vai_tro] || VAI_TRO.benh_nhan;
          return (
            <Card key={u.id} style={{ padding: 18, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", opacity: u.trang_thai ? 1 : 0.6 }}>
              <Avatar size={44} tone={r.soft} color={r.tone} icon={User} />
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 800, color: T.ink, fontSize: 15 }}>{u.ho_ten}</span>
                  <Pill tone={r.tone} soft={r.soft}>{r.l}</Pill>
                  {!u.trang_thai && <Pill tone="#C0392B" soft="#FDECEA">Đã khóa</Pill>}
                </div>
                <div style={{ color: T.sub, fontSize: 13, marginTop: 4 }}>
                  Tên đăng nhập: <b style={{ color: T.ink }}>{u.email || u.sdt}</b>
                  {u.email && u.sdt ? <> (hoặc {u.sdt})</> : null}
                  {u.bac_si && <> · {u.bac_si.khoa || "—"}{u.bac_si.chuyen_mon ? ` · ${u.bac_si.chuyen_mon}` : ""}</>}
                </div>
                {pwFor === u.id && (
                  <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <input type="text" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Mật khẩu mới (≥ 6 ký tự)"
                      style={{ ...input, padding: "9px 14px", width: 220 }} />
                    <Btn kind="lav" size="sm" disabled={pwBusy} onClick={() => savePw(u)}><CheckCircle2 size={14} /> {pwBusy ? "Đang lưu..." : "Lưu mật khẩu"}</Btn>
                    <Btn kind="ghost" size="sm" onClick={() => { setPwFor(null); setPw(""); }}><X size={14} /></Btn>
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn kind="ghost" size="sm" onClick={() => { setPwFor(pwFor === u.id ? null : u.id); setPw(""); setErr(null); }}><KeyRound size={14} /> Đặt mật khẩu</Btn>
                {u.trang_thai ? (
                  <Btn kind="ghost" size="sm" style={{ color: "#C0392B", borderColor: "#FDECEA" }} onClick={() => toggle(u)}><Lock size={14} /> Khóa</Btn>
                ) : (
                  <Btn kind="mint" size="sm" onClick={() => toggle(u)}><Unlock size={14} /> Bỏ khóa</Btn>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// Form tạo tài khoản nhân sự với vai trò (quyền) tương ứng.
// Với vai trò Bác sĩ có 2 chế độ: gắn vào bác sĩ CÓ SẴN (chưa có tài khoản)
// hoặc tạo bác sĩ MỚI thuộc một khoa (tự sinh khung giờ khám).
function UserForm({ onBack, onSaved }) {
  const { departments } = useNav();
  const [f, setF] = useState({ vai_tro: "bac_si", ho_ten: "", email: "", sdt: "", mat_khau: "", khoa_id: "", hoc_ham: "", chuyen_mon: "", bac_si_id: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [dsChuaCoTk, setDsChuaCoTk] = useState([]);   // bác sĩ có sẵn chưa gắn tài khoản
  const upd = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const laBacSi = f.vai_tro === "bac_si";
  const ganCoSan = laBacSi && f.bac_si_id !== "";
  // Khoa từ Nav context có dbId khi backend online
  const dsKhoa = (departments || []).filter((d) => d.dbId);

  // Bác sĩ chưa có tài khoản = danh sách bác sĩ trừ những người đã gắn user
  useEffect(() => {
    Promise.all([api.doctors(), api.adminUsers()])
      .then(([docs, users]) => {
        const daGan = new Set(users.filter((u) => u.bac_si).map((u) => u.bac_si.id));
        setDsChuaCoTk((Array.isArray(docs) ? docs : []).filter((d) => !daGan.has(d.id)));
      })
      .catch(() => setDsChuaCoTk([]));
  }, []);

  const chonBacSi = (e) => {
    const id = e.target.value;
    const bs = dsChuaCoTk.find((d) => String(d.id) === id);
    // Chọn bác sĩ có sẵn thì lấy luôn họ tên từ hồ sơ để hai bảng khớp nhau
    setF((s) => ({ ...s, bac_si_id: id, ho_ten: bs ? bs.ho_ten : s.ho_ten }));
  };

  const save = async () => {
    setErr(null);
    if (!f.ho_ten.trim()) { setErr("Vui lòng nhập họ và tên."); return; }
    if (!/^\S+@\S+\.\S+$/.test(f.email)) { setErr("Email đăng nhập không hợp lệ."); return; }
    if (f.mat_khau.length < 6) { setErr("Mật khẩu phải có ít nhất 6 ký tự."); return; }
    if (laBacSi && !ganCoSan && !f.khoa_id) { setErr("Vui lòng chọn khoa cho bác sĩ (hoặc chọn bác sĩ có sẵn)."); return; }
    setBusy(true);
    try {
      const u = await api.createUser({
        ...f,
        bac_si_id: ganCoSan ? +f.bac_si_id : undefined,
        khoa_id: laBacSi && !ganCoSan ? +f.khoa_id : undefined,
      });
      onSaved(u);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", color: T.sub, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", gap: 5, marginBottom: 16 }}><ArrowLeft size={15} /> Về danh sách</button>
      <PageTitle title="Tạo tài khoản mới" sub="Tài khoản đăng nhập riêng với quyền theo vai trò được chọn." />
      <Card style={{ padding: 26, maxWidth: 640 }}>
        <div style={{ display: "grid", gap: 16 }}>
          <FormField label="Vai trò (quyền truy cập)">
            <select value={f.vai_tro} onChange={upd("vai_tro")} style={{ ...input, background: T.surface }}>
              <option value="bac_si">Bác sĩ — hàng chờ khám, ghi kết quả, hồ sơ bệnh nhân</option>
              <option value="le_tan">Lễ tân — tiếp đón, check-in, hồ sơ bệnh nhân</option>
              <option value="admin">Quản trị viên — toàn quyền hệ thống</option>
            </select>
          </FormField>
          <FormField label="Họ và tên *"><input value={f.ho_ten} onChange={upd("ho_ten")} placeholder="VD: BS.CKI Hoàng Văn Nam" style={input} /></FormField>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }} className="grid2">
            <FormField label="Email đăng nhập *"><input value={f.email} onChange={upd("email")} placeholder="ten@benhvien.vn" style={input} /></FormField>
            <FormField label="Số điện thoại"><input value={f.sdt} onChange={upd("sdt")} placeholder="Không bắt buộc" style={input} /></FormField>
          </div>
          <FormField label="Mật khẩu * (ít nhất 6 ký tự)"><input type="password" value={f.mat_khau} onChange={upd("mat_khau")} placeholder="Mật khẩu đăng nhập" style={input} /></FormField>
          {laBacSi && (
            <>
              <FormField label="Gắn với bác sĩ có sẵn (chưa có tài khoản)">
                <select value={f.bac_si_id} onChange={chonBacSi} style={{ ...input, background: T.surface }}>
                  <option value="">— Không, tạo bác sĩ mới —</option>
                  {dsChuaCoTk.map((d) => <option key={d.id} value={d.id}>{d.ho_ten}{d.khoa ? ` — ${d.khoa.ten_khoa}` : ""}</option>)}
                </select>
              </FormField>
              {!ganCoSan && (
                <>
                  <FormField label="Khoa *">
                    <select value={f.khoa_id} onChange={upd("khoa_id")} style={{ ...input, background: T.surface }}>
                      <option value="">— Chọn khoa —</option>
                      {dsKhoa.map((d) => <option key={d.dbId} value={d.dbId}>{d.name}</option>)}
                    </select>
                  </FormField>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }} className="grid2">
                    <FormField label="Học hàm"><input value={f.hoc_ham} onChange={upd("hoc_ham")} placeholder="VD: BS.CKI" style={input} /></FormField>
                    <FormField label="Chuyên môn"><input value={f.chuyen_mon} onChange={upd("chuyen_mon")} placeholder="VD: Sản khoa" style={input} /></FormField>
                  </div>
                </>
              )}
              <div style={{ background: T.skySoft, borderRadius: 12, padding: "10px 14px", fontSize: 13, color: T.ink }}>
                {ganCoSan
                  ? "Tài khoản sẽ gắn vào hồ sơ bác sĩ đã chọn — giữ nguyên khoa và khung giờ khám hiện có."
                  : "Bác sĩ mới sẽ xuất hiện trong danh sách đặt lịch và tự động có khung giờ khám 14 ngày tới để bệnh nhân đăng ký."}
              </div>
            </>
          )}
        </div>
        {err && <div style={{ background: "#FDECEA", color: "#C0392B", fontSize: 13.5, padding: "10px 14px", borderRadius: 12, marginTop: 14 }}>{err}</div>}
        <div style={{ display: "flex", gap: 12, marginTop: 22 }}>
          <Btn kind="ghost" onClick={onBack}>Hủy bỏ</Btn>
          <Btn kind="lav" disabled={busy} onClick={save}><CheckCircle2 size={16} /> {busy ? "Đang tạo..." : "Tạo tài khoản"}</Btn>
        </div>
      </Card>
    </div>
  );
}
