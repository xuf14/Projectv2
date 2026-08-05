import React from "react";
import { Stethoscope, Users, Activity, ChevronRight } from "lucide-react";
import { T, useNav } from "../shared";
import { sectionWrap, PageHeader } from "./ui";

// ============================================================================
//  TRANG KHOA PHÒNG — lưới các chuyên khoa, dữ liệu lấy từ Nav context (khớp
//  danh mục thật của backend, fallback về mock khi backend chưa chạy).
// ============================================================================

function DeptCard({ d, onOpen }) {
  const Icon = d.icon || Stethoscope;
  const clickable = !!onOpen;
  return (
    <div role={clickable ? "button" : undefined} tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? onOpen : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } } : undefined}
      style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 20, padding: 26, display: "flex", flexDirection: "column", gap: 12, transition: "transform .18s, box-shadow .18s", cursor: clickable ? "pointer" : "default" }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 18px 40px rgba(45,58,78,.08)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}>
      <span style={{ width: 56, height: 56, borderRadius: 16, background: d.soft, color: d.tone, display: "grid", placeItems: "center" }}>
        <Icon size={26} aria-hidden="true" />
      </span>
      <div style={{ fontSize: 19, fontWeight: 800, color: T.ink }}>{d.name}</div>
      <div style={{ fontSize: 14, color: T.sub, lineHeight: 1.6, flex: 1 }}>{d.desc || "Khám và điều trị chuyên sâu với đội ngũ bác sĩ giàu kinh nghiệm."}</div>
      <div style={{ display: "flex", gap: 16, marginTop: 4, fontSize: 12.5, color: T.sub, fontWeight: 700 }}>
        {d.docCount > 0 && <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Users size={14} color={d.tone} /> {d.docCount} bác sĩ</span>}
        {d.services > 0 && <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Activity size={14} color={d.tone} /> {d.services} dịch vụ</span>}
      </div>
      {clickable && (
        <span style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 5, color: d.tone, fontWeight: 700, fontSize: 13.5 }}>
          Xem chi tiết <ChevronRight size={15} />
        </span>
      )}
    </div>
  );
}

// Khoa có trang chi tiết riêng — khóa theo mã khoa (d.id)
const TRANG_KHOA = { san: "khoa-san", phu: "khoa-phu", ivf: "khoa-ivf", sosinh: "khoa-so-sinh" };

export default function KhoaPhong({ onNav }) {
  const { departments } = useNav();
  return (
    <section style={{ padding: "56px 0" }}>
      <div style={sectionWrap}>
        <PageHeader eyebrowText="Khoa phòng" tone={T.peach} soft={T.peachSoft}
          title="Các chuyên khoa của chúng tôi"
          sub="Mạng lưới chuyên khoa toàn diện, phối hợp chặt chẽ để chăm sóc mẹ và bé ở mọi giai đoạn." />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 22 }}>
          {(departments || []).map((d) => {
            const route = TRANG_KHOA[d.id];
            return <DeptCard key={d.dbId || d.id} d={d} onOpen={route && onNav ? () => onNav(route) : undefined} />;
          })}
        </div>
      </div>
    </section>
  );
}
