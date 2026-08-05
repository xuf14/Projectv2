import React from "react";
import { MapPin, Phone, Mail, Clock, ShieldCheck } from "lucide-react";
import { T, Card, Btn } from "../shared";
import { sectionWrap, PageHeader } from "./ui";

// ============================================================================
//  TRANG LIÊN HỆ — thông tin liên hệ, giờ làm việc và lối vào hệ thống nội bộ.
// ============================================================================

const MUC = [
  { icon: MapPin, tone: T.peach, soft: T.peachSoft, ten: "Địa chỉ", noi_dung: "Số 19 Trần Quang Khải, Hồng Bàng, Hải Phòng" },
  { icon: Phone, tone: T.mint, soft: T.mintSoft, ten: "Tổng đài", noi_dung: "1900 xxxx (7:00 – 17:00 hằng ngày)" },
  { icon: Mail, tone: T.lav, soft: T.lavSoft, ten: "Email", noi_dung: "lienhe@bvphusanhp.vn" },
  { icon: Clock, tone: T.gold, soft: T.goldSoft, ten: "Giờ khám bệnh", noi_dung: "Thứ 2 – Chủ nhật: 7:00 – 17:00" },
];

export default function LienHe({ onEnter }) {
  return (
    <section style={{ padding: "56px 0" }}>
      <div style={sectionWrap}>
        <PageHeader eyebrowText="Liên hệ" tone={T.peach} soft={T.peachSoft}
          title="Liên hệ với chúng tôi"
          sub="Mọi thắc mắc về dịch vụ khám chữa bệnh, xin liên hệ theo thông tin dưới đây." />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 22, marginBottom: 34 }}>
          {MUC.map((m) => (
            <Card key={m.ten} style={{ padding: 24 }}>
              <span style={{ width: 50, height: 50, borderRadius: 14, background: m.soft, color: m.tone, display: "grid", placeItems: "center", marginBottom: 14 }}><m.icon size={22} /></span>
              <div style={{ fontSize: 15.5, fontWeight: 800, color: T.ink, marginBottom: 6 }}>{m.ten}</div>
              <div style={{ fontSize: 14, color: T.sub, lineHeight: 1.6 }}>{m.noi_dung}</div>
            </Card>
          ))}
        </div>

        <Card style={{ padding: 30, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 22, alignItems: "center", background: `linear-gradient(130deg, ${T.ink}, #3C4E6B)`, border: "none" }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", marginBottom: 8 }}>Bạn là nhân viên bệnh viện?</div>
            <p style={{ fontSize: 14.5, color: "rgba(255,255,255,.8)", lineHeight: 1.6, margin: 0 }}>
              Đăng nhập hệ thống quản lý nội bộ dành cho Lễ tân, Bác sĩ và Quản trị viên.
            </p>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button onClick={onEnter} style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "#fff", color: T.ink, border: "none", borderRadius: 16, padding: "14px 24px", fontSize: 15.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 14px 34px rgba(0,0,0,.2)" }}>
              <ShieldCheck size={19} color={T.peach} /> Vào hệ thống nội bộ
            </button>
          </div>
        </Card>
      </div>
    </section>
  );
}
