import React from "react";
import { T } from "../shared";

// ============================================================================
//  Style dùng chung cho trang quảng bá công khai (nhiều trang con .jsx).
// ============================================================================

export const sectionWrap = { maxWidth: 1160, margin: "0 auto", padding: "0 24px" };
export const h2 = { fontSize: 34, fontWeight: 800, color: T.ink, margin: "0 0 12px", lineHeight: 1.2 };
export const lead = { fontSize: 16, color: T.sub, lineHeight: 1.6, maxWidth: 640, margin: "0 auto" };

export const eyebrow = (color, soft) => ({
  display: "inline-block", fontSize: 12.5, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase",
  color, background: soft, padding: "6px 14px", borderRadius: 999, marginBottom: 16,
});

// Tiêu đề đầu mỗi trang con (căn giữa) — eyebrow + tên trang + mô tả ngắn.
export function PageHeader({ eyebrowText, tone = T.peach, soft = T.peachSoft, title, sub }) {
  return (
    <div style={{ textAlign: "center", marginBottom: 40 }}>
      {eyebrowText && <span style={eyebrow(tone, soft)}>{eyebrowText}</span>}
      <h2 style={h2}>{title}</h2>
      {sub && <p style={lead}>{sub}</p>}
    </div>
  );
}
