import React from "react";
import { CheckCircle2, Target, Eye, HeartHandshake } from "lucide-react";
import { T, Card } from "../shared";
import { sectionWrap, PageHeader } from "./ui";

// ============================================================================
//  TRANG GIỚI THIỆU — giới thiệu bệnh viện, sứ mệnh, tầm nhìn, giá trị cốt lõi.
// ============================================================================

const GIA_TRI = [
  { icon: Target, tone: T.peach, soft: T.peachSoft, ten: "Sứ mệnh", mo_ta: "Mang lại dịch vụ chăm sóc sức khỏe sinh sản an toàn, chất lượng và nhân văn cho mọi phụ nữ và trẻ sơ sinh." },
  { icon: Eye, tone: T.lav, soft: T.lavSoft, ten: "Tầm nhìn", mo_ta: "Trở thành bệnh viện phụ sản hàng đầu khu vực, đi đầu về đào tạo mô phỏng và ứng dụng công nghệ trong khám chữa bệnh." },
  { icon: HeartHandshake, tone: T.mint, soft: T.mintSoft, ten: "Giá trị cốt lõi", mo_ta: "Tận tâm — An toàn — Chuyên nghiệp. Lấy người bệnh làm trung tâm trong mọi quy trình chăm sóc." },
];

const DIEM_MANH = [
  "Chăm sóc thai kỳ và sinh nở an toàn theo quy trình chuẩn hóa.",
  "Tư vấn và điều trị hiếm muộn – IVF/IUI với đội ngũ chuyên sâu.",
  "Hồi sức và sàng lọc sơ sinh, tiêm chủng ngay tại bệnh viện.",
  "Đào tạo bác sĩ trên hệ thống mô phỏng định lượng trước lâm sàng.",
];

export default function GioiThieu() {
  return (
    <section style={{ padding: "56px 0" }}>
      <div style={sectionWrap}>
        <PageHeader eyebrowText="Giới thiệu" tone={T.lav} soft={T.lavSoft}
          title="Về Bệnh viện Phụ sản Hải Phòng"
          sub="Địa chỉ tin cậy trong chăm sóc sức khỏe sinh sản cho phụ nữ và trẻ sơ sinh." />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 28, alignItems: "center", marginBottom: 48 }}>
          <p style={{ fontSize: 15.5, color: T.sub, lineHeight: 1.8, margin: 0 }}>
            Bệnh viện Phụ sản Hải Phòng cung cấp dịch vụ khám và điều trị toàn diện ở các chuyên khoa Sản, Phụ,
            Hỗ trợ sinh sản (IVF) và Sơ sinh. Chúng tôi kết hợp chuyên môn vững vàng, trang thiết bị hiện đại và
            quy trình đào tạo mô phỏng chuẩn hóa để mang lại dịch vụ y tế an toàn, chất lượng cho mỗi gia đình.
          </p>
          <div style={{ display: "grid", gap: 14 }}>
            {DIEM_MANH.map((t) => (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: 12, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: "14px 18px" }}>
                <span style={{ width: 30, height: 30, borderRadius: 9, background: T.mintSoft, color: T.mint, display: "grid", placeItems: "center", flexShrink: 0 }}><CheckCircle2 size={17} /></span>
                <span style={{ fontSize: 14.5, color: T.ink, fontWeight: 700 }}>{t}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 22 }}>
          {GIA_TRI.map((g) => (
            <Card key={g.ten} style={{ padding: 26 }}>
              <span style={{ width: 52, height: 52, borderRadius: 15, background: g.soft, color: g.tone, display: "grid", placeItems: "center", marginBottom: 16 }}><g.icon size={24} /></span>
              <div style={{ fontSize: 18, fontWeight: 800, color: T.ink, marginBottom: 8 }}>{g.ten}</div>
              <div style={{ fontSize: 14, color: T.sub, lineHeight: 1.65 }}>{g.mo_ta}</div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
