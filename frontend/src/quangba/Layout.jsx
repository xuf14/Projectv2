import React from "react";
import { Heart, MapPin, Phone, Mail, Clock, ShieldCheck } from "lucide-react";
import { T, Btn } from "../shared";
import { sectionWrap } from "./ui";

// ============================================================================
//  LAYOUT trang quảng bá — header điều hướng + footer, dùng chung cho mọi trang
//  con. Bấm mục trên menu gọi onNav(name) để router (TrangQuangBa) đổi trang.
// ============================================================================

// Danh sách mục menu — mỗi mục là một trang con riêng
export const NAV_LINKS = [
  { key: "gioi-thieu", label: "Giới thiệu" },
  { key: "khoa-phong", label: "Khoa phòng" },
  { key: "vi-sao", label: "Vì sao chọn" },
  { key: "tin-tuc", label: "Tin tức" },
  { key: "dang-ky", label: "Đăng ký khám" },
  { key: "lien-he", label: "Liên hệ" },
];

const LIEN_HE = [
  { icon: MapPin, t: "Số 19 Trần Quang Khải, Hồng Bàng, Hải Phòng" },
  { icon: Phone, t: "1900 xxxx" },
  { icon: Mail, t: "lienhe@bvphusanhp.vn" },
  { icon: Clock, t: "Khám bệnh: 7:00 – 17:00 hằng ngày" },
];

export default function Layout({ page, onNav, onEnter, children }) {
  return (
    <div style={{ background: T.bg, minHeight: "100vh" }}>
      {/* ---------- Thanh điều hướng ---------- */}
      <header style={{
        position: "sticky", top: 0, zIndex: 20, background: "rgba(255,247,244,.85)", backdropFilter: "blur(10px)",
        borderBottom: `1px solid ${T.line}`,
      }}>
        <div className="qb-header-inner" style={{ ...sectionWrap, height: 72, display: "flex", alignItems: "center", gap: 20 }}>
          <button onClick={() => onNav("home")} style={{ display: "flex", alignItems: "center", gap: 12, background: "none", border: "none", cursor: "pointer", marginRight: "auto", padding: 0, fontFamily: "inherit" }}>
            <span style={{ width: 42, height: 42, borderRadius: 13, background: `linear-gradient(135deg, ${T.peach}, ${T.lav})`, display: "grid", placeItems: "center", flexShrink: 0 }}>
              <Heart size={21} fill="#fff" color="#fff" />
            </span>
            <div style={{ lineHeight: 1.15, textAlign: "left" }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: T.ink }}>BV Phụ sản Hải Phòng</div>
              <div style={{ fontSize: 11.5, color: T.sub, fontWeight: 700, letterSpacing: .4 }}>CHĂM SÓC MẸ & BÉ TOÀN DIỆN</div>
            </div>
          </button>
          <nav style={{ display: "flex", gap: 26, alignItems: "center" }} className="qb-links">
            {NAV_LINKS.map((l) => {
              const active = page === l.key;
              return (
                <button key={l.key} onClick={() => onNav(l.key)}
                  style={{ fontSize: 14.5, fontWeight: 700, color: active ? T.peach : T.sub, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = T.peach)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = active ? T.peach : T.sub)}>{l.label}</button>
              );
            })}
          </nav>
          <Btn kind="primary" onClick={onEnter}><ShieldCheck size={16} /> Hệ thống nội bộ</Btn>
        </div>
        {/* Menu điều hướng cho màn hình nhỏ — cuộn ngang trong khối riêng, không tràn trang */}
        <nav className="qb-mobile-nav" aria-label="Điều hướng (di động)" style={{ ...sectionWrap, gap: 8, overflowX: "auto", paddingBottom: 10, WebkitOverflowScrolling: "touch" }}>
          {NAV_LINKS.map((l) => {
            const active = page === l.key;
            return (
              <button key={l.key} onClick={() => onNav(l.key)}
                style={{ flexShrink: 0, fontSize: 14, fontWeight: 700, color: active ? "#fff" : T.sub, background: active ? T.peach : T.surface, border: `1px solid ${active ? T.peach : T.line}`, borderRadius: 999, padding: "7px 14px", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                {l.label}
              </button>
            );
          })}
        </nav>
      </header>

      {children}

      {/* ---------- Footer ---------- */}
      <footer style={{ background: T.surface, borderTop: `1px solid ${T.line}`, padding: "48px 0 32px" }}>
        <div style={{ ...sectionWrap, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 32 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <span style={{ width: 40, height: 40, borderRadius: 12, background: `linear-gradient(135deg, ${T.peach}, ${T.lav})`, display: "grid", placeItems: "center" }}><Heart size={20} fill="#fff" color="#fff" /></span>
              <div style={{ fontSize: 16.5, fontWeight: 800, color: T.ink }}>BV Phụ sản Hải Phòng</div>
            </div>
            <p style={{ fontSize: 14, color: T.sub, lineHeight: 1.6, margin: 0, maxWidth: 320 }}>
              Chăm sóc sức khỏe sinh sản cho phụ nữ và trẻ sơ sinh với sự tận tâm và chuyên nghiệp.
            </p>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.ink, textTransform: "uppercase", letterSpacing: .6, marginBottom: 14 }}>Khám phá</div>
            {NAV_LINKS.map((l) => (
              <button key={l.key} onClick={() => onNav(l.key)}
                style={{ display: "block", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 14, color: T.sub, padding: "0 0 11px", textAlign: "left" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = T.peach)}
                onMouseLeave={(e) => (e.currentTarget.style.color = T.sub)}>{l.label}</button>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.ink, textTransform: "uppercase", letterSpacing: .6, marginBottom: 14 }}>Liên hệ</div>
            {LIEN_HE.map((c) => (
              <div key={c.t} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 11, fontSize: 14, color: T.sub }}>
                <c.icon size={16} color={T.peach} /> {c.t}
              </div>
            ))}
            <div style={{ marginTop: 6 }}><Btn kind="primary" onClick={onEnter}><ShieldCheck size={16} /> Hệ thống nội bộ</Btn></div>
          </div>
        </div>
        <div style={{ ...sectionWrap, marginTop: 32, paddingTop: 20, borderTop: `1px solid ${T.line}`, fontSize: 13, color: T.sub, textAlign: "center" }}>
          © {new Date().getFullYear()} Bệnh viện Phụ sản Hải Phòng. Đồ án tốt nghiệp — hệ thống mô phỏng & quản lý.
        </div>
      </footer>
    </div>
  );
}
