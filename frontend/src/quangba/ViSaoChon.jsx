import React from "react";
import { Award, Microscope, Sparkles, Heart, ShieldCheck, Clock } from "lucide-react";
import { T, Card } from "../shared";
import { sectionWrap, PageHeader } from "./ui";

// ============================================================================
//  TRANG VÌ SAO CHỌN — 6 lý do lựa chọn BV Phụ sản Hải Phòng.
// ============================================================================

const LY_DO = [
  { icon: Award, tone: T.peach, soft: T.peachSoft, ten: "Đội ngũ chuyên môn cao", mo_ta: "Bác sĩ chuyên khoa I, II và tiến sĩ giàu kinh nghiệm trong sản – phụ khoa và hỗ trợ sinh sản." },
  { icon: Microscope, tone: T.sky, soft: T.skySoft, ten: "Trang thiết bị hiện đại", mo_ta: "Hệ thống siêu âm, xét nghiệm và phòng mổ đạt chuẩn, cập nhật công nghệ mới." },
  { icon: Sparkles, tone: T.mint, soft: T.mintSoft, ten: "Đào tạo mô phỏng chuẩn hóa", mo_ta: "Bác sĩ được huấn luyện trên hệ thống mô phỏng định lượng trước khi thực hành lâm sàng." },
  { icon: Heart, tone: T.lav, soft: T.lavSoft, ten: "Chăm sóc tận tâm mẹ & bé", mo_ta: "Đồng hành cùng gia đình từ thai kỳ, sinh nở đến chăm sóc sau sinh một cách chu đáo." },
  { icon: ShieldCheck, tone: T.gold, soft: T.goldSoft, ten: "An toàn người bệnh", mo_ta: "Quy trình khám chữa bệnh chuẩn hóa, kiểm soát chất lượng chặt chẽ ở từng bước." },
  { icon: Clock, tone: T.sky, soft: T.skySoft, ten: "Hỗ trợ tận tình", mo_ta: "Tiếp đón, tư vấn và hướng dẫn quy trình rõ ràng, giảm thời gian chờ đợi cho người bệnh." },
];

export default function ViSaoChon() {
  return (
    <section style={{ padding: "56px 0" }}>
      <div style={sectionWrap}>
        <PageHeader eyebrowText="Lợi ích vượt trội" tone={T.mint} soft={T.mintSoft}
          title="Vì sao chọn BV Phụ sản Hải Phòng?"
          sub="Sự kết hợp giữa con người, công nghệ và quy trình để mỗi lần thăm khám đều an tâm." />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 22 }}>
          {LY_DO.map((f) => (
            <Card key={f.ten} style={{ padding: 26 }}>
              <span style={{ width: 52, height: 52, borderRadius: 15, background: f.soft, color: f.tone, display: "grid", placeItems: "center", marginBottom: 16 }}><f.icon size={24} /></span>
              <div style={{ fontSize: 18, fontWeight: 800, color: T.ink, marginBottom: 8 }}>{f.ten}</div>
              <div style={{ fontSize: 14, color: T.sub, lineHeight: 1.6 }}>{f.mo_ta}</div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
