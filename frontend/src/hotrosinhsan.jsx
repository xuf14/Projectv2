import React, { useState } from "react";
import { FlaskConical, ScanLine, Activity, User, Users, ChevronDown, Plus, Info, Baby } from "lucide-react";
import { T, Btn, Pill } from "./shared";

// ============================================================================
//  CẬN LÂM SÀNG KHOA HỖ TRỢ SINH SẢN (IVF) — bảng gợi ý danh mục khám & xét
//  nghiệm cho cặp vợ chồng hiếm muộn, dùng trong Bước 4 (Chỉ định cận lâm sàng)
//  của quy trình khám khi lần khám thuộc khoa Hỗ trợ sinh sản (IVF).
//  Nội dung theo quy trình thăm khám hiếm muộn của Trung tâm IVF (khám vợ/chồng,
//  xét nghiệm theo thời điểm chu kỳ kinh); mang tính GỢI Ý — bác sĩ quyết định
//  chỉ định thực tế theo tình trạng bệnh nhân và quy định của cơ sở.
//  Bấm "Chỉ định" để thêm nhanh vào phiếu. loai: null = mục khám/tư vấn (không
//  phải chỉ định cận lâm sàng, chỉ để tham khảo).
// ============================================================================

export const CLS_HO_TRO_SINH_SAN = [
  {
    key: "vo",
    ten: "Người vợ / Người cho trứng",
    phu: "Khám & xét nghiệm",
    icon: User,
    ghi_chu: "Khám phát hiện bệnh lý toàn thân và cơ quan sinh dục; chỉ định theo thời điểm chu kỳ kinh:",
    muc: [
      { ten: "Siêu âm tử cung – buồng trứng, đếm nang thứ cấp (AFC) đánh giá dự trữ buồng trứng", loai: "sieu_am", moc: "Ngày có kinh thứ 2" },
      { ten: "Xét nghiệm nội tiết sinh sản đánh giá chức năng buồng trứng", loai: "xet_nghiem", moc: "Ngày có kinh thứ 2" },
      { ten: "Chụp tử cung – vòi tử cung (HSG) đánh giá buồng tử cung và sự thông của 2 vòi tử cung", loai: "thu_thuat", moc: "Sạch kinh 2–5 ngày" },
      { ten: "Nội soi buồng tử cung đánh giá bất thường buồng tử cung", loai: "thu_thuat", moc: "Sạch kinh 2–5 ngày" },
      { ten: "Xét nghiệm AMH đánh giá dự trữ buồng trứng", loai: "xet_nghiem" },
      { ten: "Xét nghiệm cơ bản: công thức máu, nhóm máu, bệnh lây truyền qua đường tình dục", loai: "xet_nghiem" },
      { ten: "Xét nghiệm chuyên sâu (nếu cần)", loai: null },
    ],
  },
  {
    key: "chong",
    ten: "Người chồng",
    phu: "Khám & xét nghiệm",
    icon: Users,
    ghi_chu: "Khám phát hiện bệnh lý toàn thân và cơ quan sinh dục:",
    muc: [
      { ten: "Tinh dịch đồ — xác định số lượng và chất lượng tinh trùng (kiêng xuất tinh 3–5 ngày trước khám)", loai: "xet_nghiem" },
      { ten: "Siêu âm tinh hoàn — đánh giá bất thường tinh hoàn, mào tinh, mạch tinh", loai: "sieu_am" },
      { ten: "Xét nghiệm cơ bản: công thức máu, nhóm máu, bệnh lây truyền qua đường tình dục, nội tiết, siêu âm ổ bụng", loai: "xet_nghiem" },
      { ten: "Xét nghiệm chuyên sâu (nếu cần)", loai: null },
    ],
  },
];

// Các mốc điều trị IVF (tham khảo) — hiển thị read-only để bác sĩ nắm quy trình.
export const MOC_DIEU_TRI_IVF = [
  "Kích thích buồng trứng (10–12 ngày)",
  "Chọc hút trứng & chuẩn bị tinh trùng → tạo phôi",
  "Nuôi phôi 2–5 ngày; sinh thiết phôi (tùy trường hợp)",
  "Trữ đông phôi",
  "Soi buồng tử cung & chụp TC – VTC",
  "Chuẩn bị niêm mạc (10–12 ngày)",
  "Rã đông phôi",
  "Chuyển phôi",
  "Thử thai (10–13 ngày sau chuyển phôi)",
];

const LOAI_META = {
  xet_nghiem: { l: "Xét nghiệm", icon: FlaskConical, tone: T.lav, soft: T.lavSoft },
  sieu_am: { l: "Siêu âm", icon: ScanLine, tone: T.sky, soft: T.skySoft },
  thu_thuat: { l: "Thủ thuật", icon: Activity, tone: T.gold, soft: T.goldSoft },
};

// Bảng gợi ý cận lâm sàng khoa Hỗ trợ sinh sản (IVF).
//  - onChon(loai, ten): thêm nhanh một mục thành chỉ định (chỉ mục có loai).
//  - dangThem: tên mục đang được thêm (để khóa nút, tránh bấm trùng).
//  - readOnly: chỉ xem (không hiện nút Chỉ định).
export default function CanLamSangHoTroSinhSan({ onChon, dangThem, readOnly }) {
  const [mo, setMo] = useState(CLS_HO_TRO_SINH_SAN[0].key); // nhóm đang mở (accordion)

  return (
    <div style={{ border: `1.5px solid ${T.line}`, borderRadius: 14, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "12px 16px", background: T.lavSoft }}>
        <Baby size={17} color={T.lav} />
        <b style={{ color: T.ink, fontSize: 14.5, flex: 1 }}>Cận lâm sàng hỗ trợ sinh sản (IVF)</b>
        <span style={{ fontSize: 12, color: T.sub }}>Hiếm muộn · gợi ý</span>
      </div>

      {CLS_HO_TRO_SINH_SAN.map((g) => {
        const on = mo === g.key;
        const GIcon = g.icon || User;
        return (
          <div key={g.key} style={{ borderTop: `1px solid ${T.line}66` }}>
            <button
              onClick={() => setMo(on ? null : g.key)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
                background: on ? T.bg : T.surface, border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
              }}>
              <span style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, display: "grid", placeItems: "center", background: T.lavSoft, color: T.lav }}>
                <GIcon size={15} />
              </span>
              <span style={{ fontWeight: 800, color: T.ink, fontSize: 14, flex: 1 }}>{g.ten}</span>
              <Pill tone={T.sub} soft={T.bg}>{g.phu}</Pill>
              <ChevronDown size={17} color={T.sub} style={{ transform: on ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
            </button>
            {on && (
              <div style={{ padding: "6px 16px 16px" }}>
                {g.ghi_chu && <div style={{ fontSize: 12.5, color: T.sub, margin: "4px 0 10px" }}>{g.ghi_chu}</div>}
                <div style={{ display: "grid", gap: 8 }}>
                  {g.muc.map((m, i) => {
                    const meta = m.loai ? LOAI_META[m.loai] : null;
                    const MetaIcon = meta ? meta.icon : Info;
                    const themDuoc = !!m.loai && !readOnly && onChon;
                    return (
                      <div key={i} style={{
                        display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
                        border: `1px solid ${T.line}`, borderRadius: 11, background: m.loai ? T.surface : T.bg,
                      }}>
                        <span style={{
                          width: 26, height: 26, borderRadius: 8, flexShrink: 0, display: "grid", placeItems: "center",
                          background: meta ? meta.soft : T.line, color: meta ? meta.tone : T.sub,
                        }}>
                          <MetaIcon size={14} />
                        </span>
                        <div style={{ flex: 1 }}>
                          {m.moc && <Pill tone={T.mint} soft={T.mintSoft}>{m.moc}</Pill>}
                          <span style={{ fontSize: 13.5, color: T.ink, marginLeft: m.moc ? 8 : 0 }}>{m.ten}</span>
                        </div>
                        {m.loai
                          ? <Pill tone={meta.tone} soft={meta.soft}>{meta.l}</Pill>
                          : <span style={{ fontSize: 12, color: T.sub, fontStyle: "italic" }}>Khám / tư vấn</span>}
                        {themDuoc && (
                          <Btn kind="ghost" size="sm" disabled={dangThem === m.ten} onClick={() => onChon(m.loai, m.ten)}>
                            <Plus size={13} /> {dangThem === m.ten ? "Đang thêm..." : "Chỉ định"}
                          </Btn>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Các mốc điều trị IVF — tham khảo quy trình sau khi hoàn tất thăm khám */}
      <div style={{ padding: "11px 16px", borderTop: `1px solid ${T.line}66`, background: T.bg }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.sub, marginBottom: 8 }}>Các mốc điều trị IVF (tham khảo)</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {MOC_DIEU_TRI_IVF.map((m, i) => (
            <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: T.ink, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 999, padding: "4px 11px" }}>
              <b style={{ color: T.lav }}>{i + 1}</b> {m}
            </span>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "11px 16px", borderTop: `1px solid ${T.line}66`, background: T.bg }}>
        <Info size={14} color={T.sub} style={{ marginTop: 2, flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: T.sub }}>
          Danh mục mang tính tham khảo theo quy trình thăm khám hiếm muộn. Bác sĩ quyết định chỉ định thực tế theo tình
          trạng của từng người, thời điểm chu kỳ kinh và quy định của cơ sở.
        </span>
      </div>
    </div>
  );
}
