import React, { useState, useEffect } from "react";
import { ArrowLeft, CalendarDays, User, ImageIcon } from "lucide-react";
import { T, api, Card, Pill, Btn } from "../shared";
import { sectionWrap } from "./ui";

// ============================================================================
//  TRANG CHI TIẾT BÀI VIẾT (đọc ngay trong trang) — render nội dung văn bản
//  thuần + ảnh của một bài tin tức. Dữ liệu: GET /media/posts/:id.
// ============================================================================

const MAU_MUC = {
  "Tin bệnh viện": T.peach, "Chuyên môn": T.sky, "Giáo dục sức khỏe": T.mint,
  "Sự kiện": T.lav, "Ưu đãi": T.gold, "Tuyển dụng": T.ink,
};

export default function BaiViet({ id, onBack }) {
  const [bai, setBai] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    setBai(null); setErr(null);
    api.mediaPost(id).then(setBai).catch((e) => setErr(e.message));
  }, [id]);

  const tone = bai ? (MAU_MUC[bai.chuyen_muc] || T.peach) : T.peach;

  return (
    <section style={{ padding: "36px 0 70px" }}>
      <div style={{ ...sectionWrap, maxWidth: 820 }}>
        <div style={{ marginBottom: 18 }}>
          <Btn kind="ghost" onClick={() => onBack()}><ArrowLeft size={16} /> Quay lại tin tức</Btn>
        </div>

        {err && <Card style={{ padding: 24, background: "#FDECEA", border: "none", color: "#C0392B" }}>{err}</Card>}
        {!bai && !err && <div style={{ color: T.sub, textAlign: "center" }}>Đang tải bài viết…</div>}
        {bai && (
          <article>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
              {bai.chuyen_muc && <Pill tone={tone} soft={tone + "1A"}>{bai.chuyen_muc}</Pill>}
              <span style={{ fontSize: 13, color: T.sub, display: "inline-flex", alignItems: "center", gap: 5 }}>
                <CalendarDays size={13} /> {new Date(bai.ngay_dang).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
              {bai.nguoi_dang && <span style={{ fontSize: 13, color: T.sub, display: "inline-flex", alignItems: "center", gap: 5 }}><User size={13} /> {bai.nguoi_dang}</span>}
            </div>
            <h1 style={{ fontSize: 32, fontWeight: 800, color: T.ink, letterSpacing: -0.6, margin: "0 0 14px", lineHeight: 1.25 }}>{bai.tieu_de}</h1>
            {bai.tom_tat && <p style={{ fontSize: 16.5, color: T.sub, lineHeight: 1.6, margin: "0 0 22px", fontWeight: 600 }}>{bai.tom_tat}</p>}

            {bai.anh.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <img src={api.mediaImageUrl(bai.anh[0].id)} alt={bai.anh[0].ten_tep} style={{ width: "100%", borderRadius: 18, border: `1px solid ${T.line}` }} />
              </div>
            )}

            {/* Nội dung văn bản thuần — không render HTML thô */}
            <div style={{ fontSize: 16, color: T.ink, lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{bai.noi_dung}</div>

            {bai.the && (
              <div style={{ marginTop: 20, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {bai.the.split(",").map((t) => t.trim()).filter(Boolean).map((t) => (
                  <Pill key={t} tone={T.sub} soft="#F0F0F2">#{t}</Pill>
                ))}
              </div>
            )}

            {bai.anh.length > 1 && (
              <div style={{ marginTop: 28 }}>
                <div style={{ fontWeight: 800, color: T.ink, fontSize: 16, marginBottom: 12 }}><ImageIcon size={16} style={{ verticalAlign: -3 }} /> Hình ảnh ({bai.anh.length})</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
                  {bai.anh.slice(1).map((a) => (
                    <img key={a.id} src={api.mediaImageUrl(a.id)} alt={a.ten_tep} style={{ width: "100%", borderRadius: 14, border: `1px solid ${T.line}` }} />
                  ))}
                </div>
              </div>
            )}
          </article>
        )}
      </div>
    </section>
  );
}
