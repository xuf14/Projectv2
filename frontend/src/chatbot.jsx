import React, { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Bot, User as UserIcon } from "lucide-react";
import { T, store, api, useNav, Btn } from "./shared";

// ============================================================================
//  TRỢ LÝ ẢO — nút nổi ở góc màn hình trong các cổng đã đăng nhập.
//  Gọi POST /api/chat (cần JWT). Máy chủ mới là nơi giữ khóa API và quyết định
//  công cụ nào được phép chạy theo vai trò — frontend chỉ gửi câu hỏi và
//  lịch sử hội thoại của phiên hiện tại (không lưu xuống đâu cả).
// ============================================================================

const GOI_Y = [
  "Bệnh viện có những khoa nào?",
  "Bác sĩ nào thuộc Khoa Sản?",
  "Quy trình khám gồm mấy bước?",
];

const oNhap = {
  flex: 1, border: "none", outline: "none", background: "transparent",
  fontSize: 14, fontFamily: "inherit", color: T.ink, resize: "none", maxHeight: 90,
};

// Một bong bóng hội thoại
const BongBong = ({ vaiTro, noiDung }) => {
  const cuaToi = vaiTro === "user";
  return (
    <div style={{ display: "flex", gap: 9, flexDirection: cuaToi ? "row-reverse" : "row", alignItems: "flex-start" }}>
      <span style={{ width: 28, height: 28, borderRadius: 9, flexShrink: 0, display: "grid", placeItems: "center",
        background: cuaToi ? T.peachSoft : T.lavSoft, color: cuaToi ? T.peach : T.lav }}>
        {cuaToi ? <UserIcon size={15} /> : <Bot size={15} />}
      </span>
      <div style={{ maxWidth: "78%", padding: "9px 13px", borderRadius: 14, fontSize: 13.5, lineHeight: 1.5,
        whiteSpace: "pre-wrap", wordBreak: "break-word",
        background: cuaToi ? T.peachSoft : T.bg, color: T.ink }}>
        {noiDung}
      </div>
    </div>
  );
};

export default function ChatBot() {
  const { online } = useNav();
  const live = online && !!store.token;
  const [mo, setMo] = useState(false);
  const [tin, setTin] = useState([]);          // { vai_tro: "user"|"assistant", noi_dung }
  const [nhap, setNhap] = useState("");
  const [dangGui, setDangGui] = useState(false);
  const [err, setErr] = useState(null);
  const cuoiRef = useRef(null);

  useEffect(() => { if (cuoiRef.current) cuoiRef.current.scrollIntoView({ behavior: "smooth" }); }, [tin, dangGui]);

  if (!live) return null;

  const gui = async (text) => {
    const noiDung = (text ?? nhap).trim();
    if (!noiDung || dangGui) return;
    const lichSu = tin.slice(-20);
    setTin((s) => [...s, { vai_tro: "user", noi_dung: noiDung }]);
    setNhap(""); setErr(null); setDangGui(true);
    try {
      const r = await api.chat(noiDung, lichSu);
      setTin((s) => [...s, { vai_tro: "assistant", noi_dung: r.tra_loi }]);
    } catch (e) {
      setErr(e.message);
    } finally { setDangGui(false); }
  };

  return (
    <div style={{ position: "fixed", right: 22, bottom: 22, zIndex: 70 }}>
      {mo && (
        <div style={{ width: 380, maxWidth: "92vw", height: 520, maxHeight: "76vh", marginBottom: 12,
          background: T.surface, border: `1px solid ${T.line}`, borderRadius: 20, boxShadow: "0 20px 50px rgba(45,58,78,.2)",
          display: "flex", flexDirection: "column", overflow: "hidden" }}>

          <div style={{ padding: "13px 16px", borderBottom: `1px solid ${T.line}`, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 32, height: 32, borderRadius: 10, background: T.lavSoft, color: T.lav, display: "grid", placeItems: "center" }}><Bot size={17} /></span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, color: T.ink, fontSize: 14.5 }}>Trợ lý ảo</div>
              <div style={{ color: T.sub, fontSize: 11.5 }}>Hỏi về khoa phòng, bác sĩ, lịch khám</div>
            </div>
            <button onClick={() => setMo(false)} title="Đóng"
              style={{ background: "none", border: "none", cursor: "pointer", color: T.sub, padding: 4 }}><X size={18} /></button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "grid", gap: 12, alignContent: "start" }}>
            {tin.length === 0 && (
              <div>
                <div style={{ color: T.sub, fontSize: 13, lineHeight: 1.55, marginBottom: 12 }}>
                  Mình có thể tra cứu khoa phòng, bác sĩ, khung giờ trống và lịch hẹn của bạn.
                  <br />Mình <b>không tư vấn y khoa</b> — các câu hỏi về bệnh, thuốc hay kết quả xét nghiệm bạn hãy hỏi trực tiếp bác sĩ.
                </div>
                <div style={{ display: "grid", gap: 7 }}>
                  {GOI_Y.map((g) => (
                    <button key={g} onClick={() => gui(g)}
                      style={{ textAlign: "left", padding: "9px 12px", borderRadius: 11, border: `1px solid ${T.line}`,
                        background: T.bg, color: T.ink, fontSize: 13, fontFamily: "inherit", cursor: "pointer" }}>{g}</button>
                  ))}
                </div>
              </div>
            )}
            {tin.map((m, i) => <BongBong key={i} vaiTro={m.vai_tro} noiDung={m.noi_dung} />)}
            {dangGui && <div style={{ color: T.sub, fontSize: 13, paddingLeft: 37 }}>Đang tra cứu...</div>}
            {err && <div style={{ padding: "10px 13px", borderRadius: 12, background: "#FDECEA", color: "#C0392B", fontSize: 13 }}>{err}</div>}
            <div ref={cuoiRef} />
          </div>

          <div style={{ padding: 12, borderTop: `1px solid ${T.line}`, display: "flex", gap: 8, alignItems: "flex-end" }}>
            <textarea rows={1} style={oNhap} value={nhap} placeholder="Nhập câu hỏi..."
              onChange={(e) => setNhap(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); gui(); } }} />
            <Btn kind="lav" size="sm" disabled={dangGui || !nhap.trim()} onClick={() => gui()}><Send size={14} /></Btn>
          </div>
        </div>
      )}

      <button onClick={() => setMo(!mo)} title="Trợ lý ảo"
        style={{ width: 54, height: 54, borderRadius: "50%", border: "none", cursor: "pointer", float: "right",
          background: `linear-gradient(135deg, ${T.lav}, #8A6BD0)`, color: "#fff",
          boxShadow: "0 12px 30px rgba(155,126,222,.42)", display: "grid", placeItems: "center" }}>
        {mo ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </div>
  );
}
