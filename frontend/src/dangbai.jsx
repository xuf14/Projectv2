import React, { useState, useEffect, useRef } from "react";
import { ArrowLeft, ImagePlus, Send, X, Trash2 } from "lucide-react";
import { T, api, Btn, Card } from "./shared";

// ============================================================================
//  ĐĂNG BÀI MỚI (truyền thông) — giao diện theo mẫu trình soạn bài của bệnh viện:
//  Tiêu đề bài viết*, Chuyên mục*, Nội dung bài viết* (khung soạn thảo có nút
//  "Thêm ảnh"), Thẻ (tags). Bài + ảnh gửi multipart lên POST /media/posts và
//  lưu vào PostgreSQL (bảng bai_truyen_thong + anh_truyen_thong, xếp theo ngày).
//  Được mở từ nút "Tạo bài truyền thông mới" trong tab Truyền thông của admin.
// ============================================================================

// Danh mục bài — phải khớp whitelist CHUYEN_MUC ở backend media.module.ts
export const CHUYEN_MUC = ["Tin bệnh viện", "Chuyên môn", "Giáo dục sức khỏe", "Sự kiện", "Ưu đãi", "Tuyển dụng"];

const SO_ANH_TOI_DA = 10;
const DUNG_LUONG_TOI_DA = 5 * 1024 * 1024; // 5MB / ảnh

const khungInput = {
  width: "100%", boxSizing: "border-box", padding: "11px 13px", borderRadius: 12,
  border: `1.5px solid ${T.line}`, fontSize: 14.5, fontFamily: "inherit", outline: "none",
  background: T.surface, color: T.ink,
};

// Hàng nhãn bên trái — theo bố cục mẫu "Đăng bài mới"
function Row({ label, required, top, children }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "170px 1fr", gap: 16, alignItems: top ? "start" : "center" }} className="grid2">
      <label style={{ fontSize: 14, fontWeight: 700, color: T.ink, paddingTop: top ? 11 : 0 }}>
        {label} {required && <span style={{ color: "#C0392B" }}>*</span>}
      </label>
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}

export default function DangBaiMoi({ onBack, onSaved }) {
  const [f, setF] = useState({ tieu_de: "", chuyen_muc: "", tom_tat: "", noi_dung: "", the: "" });
  const [anh, setAnh] = useState([]);          // [{ file, url }] — xem trước bằng object URL
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const fileRef = useRef(null);
  const upd = (k) => (e) => setF({ ...f, [k]: e.target.value });

  useEffect(() => () => anh.forEach((a) => URL.revokeObjectURL(a.url)), []);

  // "Thêm ảnh" cộng dồn vào các ảnh đã chọn (không thay thế), chặn trùng và quá 10
  const themAnh = (e) => {
    setErr(null);
    const moi = [...(e.target.files || [])];
    e.target.value = ""; // cho phép chọn lại cùng tệp lần sau
    const them = [];
    for (const file of moi) {
      if (!file.type.startsWith("image/")) { setErr(`"${file.name}" không phải tệp ảnh.`); return; }
      if (file.size > DUNG_LUONG_TOI_DA) { setErr(`"${file.name}" vượt quá 5MB.`); return; }
      if (anh.some((a) => a.file.name === file.name && a.file.size === file.size)) continue;
      them.push({ file, url: URL.createObjectURL(file) });
    }
    if (anh.length + them.length > SO_ANH_TOI_DA) {
      them.forEach((a) => URL.revokeObjectURL(a.url));
      setErr(`Tối đa ${SO_ANH_TOI_DA} ảnh mỗi bài.`);
      return;
    }
    setAnh([...anh, ...them]);
  };
  const boAnh = (a) => { URL.revokeObjectURL(a.url); setAnh(anh.filter((x) => x !== a)); };

  const dang = async () => {
    setErr(null);
    if (!f.tieu_de.trim()) { setErr("Vui lòng nhập tiêu đề bài viết."); return; }
    if (!f.chuyen_muc) { setErr("Vui lòng chọn chuyên mục."); return; }
    if (!f.noi_dung.trim()) { setErr("Vui lòng nhập nội dung bài viết."); return; }
    setBusy(true);
    try { onSaved(await api.createMediaPost(f, anh.map((a) => a.file))); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", color: T.sub, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", gap: 5, marginBottom: 16, fontFamily: "inherit" }}>
        <ArrowLeft size={15} /> Về danh sách
      </button>
      <h1 style={{ fontSize: 30, fontWeight: 800, color: T.ink, letterSpacing: -0.5, margin: "0 0 22px" }}>Đăng bài mới</h1>

      <Card style={{ padding: 26, maxWidth: 820 }}>
        <div style={{ display: "grid", gap: 18 }}>
          <Row label="Tiêu đề bài viết" required>
            <input value={f.tieu_de} onChange={upd("tieu_de")} style={khungInput} placeholder="VD: Khai trương khu khám VIP mẹ và bé" />
          </Row>

          <Row label="Chuyên mục" required>
            <select value={f.chuyen_muc} onChange={upd("chuyen_muc")} style={{ ...khungInput, maxWidth: 280 }}>
              <option value="">— Chọn —</option>
              {CHUYEN_MUC.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Row>

          <Row label="Tóm tắt" top>
            <input value={f.tom_tat} onChange={upd("tom_tat")} style={khungInput} placeholder="1-2 câu hiển thị ở danh sách bài (không bắt buộc)" />
          </Row>

          <Row label="Nội dung bài viết" required top>
            <div style={{ border: `1.5px solid ${T.line}`, borderRadius: 12, overflow: "hidden" }}>
              {/* Thanh công cụ của khung soạn thảo — nút Thêm ảnh như "Add Media" */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "#FAFAF8", borderBottom: `1px solid ${T.line}` }}>
                <Btn kind="ghost" size="sm" onClick={() => fileRef.current && fileRef.current.click()}>
                  <ImagePlus size={15} style={{ verticalAlign: -2, marginRight: 6 }} />Thêm ảnh
                </Btn>
                <span style={{ fontSize: 12.5, color: T.sub, fontWeight: 700, padding: "5px 12px", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 8 }}>Văn bản</span>
              </div>
              <textarea rows={11} value={f.noi_dung} onChange={upd("noi_dung")} placeholder="Nội dung bài truyền thông..."
                style={{ width: "100%", boxSizing: "border-box", border: "none", outline: "none", padding: 14, resize: "vertical", fontFamily: "inherit", fontSize: 14.5, color: T.ink, background: T.surface }} />
              <div style={{ padding: "7px 12px", borderTop: `1px solid ${T.line}`, background: "#FAFAF8", fontSize: 12.5, color: T.sub }}>
                Đã đính kèm {anh.length}/{SO_ANH_TOI_DA} ảnh · mỗi ảnh tối đa 5MB (JPEG, PNG, WebP, GIF)
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple onChange={themAnh} style={{ display: "none" }} />

            {anh.length > 0 && (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                {anh.map((a) => (
                  <div key={a.url} style={{ width: 112, position: "relative" }}>
                    <img src={a.url} alt={a.file.name} style={{ width: 112, height: 82, objectFit: "cover", borderRadius: 10, border: `1px solid ${T.line}` }} />
                    <button onClick={() => boAnh(a)} title="Bỏ ảnh này"
                      style={{ position: "absolute", top: -7, right: -7, width: 22, height: 22, borderRadius: "50%", border: "2px solid #fff", background: "#C0392B", color: "#fff", cursor: "pointer", display: "grid", placeItems: "center", padding: 0 }}>
                      <Trash2 size={11} />
                    </button>
                    <div style={{ fontSize: 11, color: T.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 3 }}>{a.file.name}</div>
                  </div>
                ))}
              </div>
            )}
          </Row>

          <Row label="Thẻ">
            <input value={f.the} onChange={upd("the")} style={khungInput} placeholder="Phân tách bằng dấu phẩy — VD: khám thai, quy trình mới" />
          </Row>
        </div>

        {err && <div style={{ background: "#FDECEA", color: "#C0392B", fontSize: 13.5, padding: "10px 14px", borderRadius: 12, marginTop: 16 }}>{err}</div>}
        <div style={{ display: "flex", gap: 12, marginTop: 22, paddingLeft: 186 }} className="grid2">
          <Btn kind="lav" disabled={busy} onClick={dang}><Send size={15} /> {busy ? "Đang đăng..." : "Đăng bài & lưu vào database"}</Btn>
          <Btn kind="ghost" onClick={onBack}><X size={15} /> Hủy</Btn>
        </div>
      </Card>
    </div>
  );
}
