import React, { useState } from "react";
import { FlaskConical, ScanLine, Activity, Baby, ChevronDown, Plus, Info } from "lucide-react";
import { T, Btn, Pill } from "./shared";

// ============================================================================
//  CẬN LÂM SÀNG THEO GIAI ĐOẠN THAI KỲ — bảng gợi ý danh mục cận lâm sàng cho
//  bác sĩ sản khoa, dùng trong Bước 4 (Chỉ định cận lâm sàng) của quy trình khám.
//  Nội dung tham khảo phác đồ chăm sóc trước sinh (Bộ Y tế / ACOG / WHO); mang
//  tính GỢI Ý — bác sĩ quyết định chỉ định thực tế theo tình trạng bệnh nhân,
//  yếu tố nguy cơ và quy định của cơ sở. Bấm "Chỉ định" để thêm nhanh vào phiếu.
//  loai: null = mục theo dõi / tư vấn (không phải chỉ định CLS, chỉ để tham khảo).
// ============================================================================

export const GIAI_DOAN_THAI_KY = [
  {
    key: "lan_dau",
    ten: "Lần khám đầu",
    tuan: "Trước ~10 tuần",
    ghi_chu: "Danh mục lựa chọn theo quy định bệnh viện và yếu tố nguy cơ, thường gồm:",
    muc: [
      { ten: "Tổng phân tích tế bào máu", loai: "xet_nghiem" },
      { ten: "Nhóm máu ABO và Rh", loai: "xet_nghiem" },
      { ten: "Tổng phân tích nước tiểu; cấy nước tiểu khi phù hợp", loai: "xet_nghiem" },
      { ten: "Sàng lọc HIV, viêm gan B, giang mai", loai: "xet_nghiem" },
      { ten: "Đường huyết và xét nghiệm nội khoa theo nguy cơ", loai: "xet_nghiem" },
      { ten: "Siêu âm xác định vị trí thai, số thai, tim thai và tuổi thai", loai: "sieu_am" },
      { ten: "Tư vấn lựa chọn phương pháp sàng lọc bất thường nhiễm sắc thể", loai: null },
    ],
  },
  {
    key: "quy1",
    ten: "Khoảng 11–13 tuần 6 ngày",
    tuan: "Quý I",
    ghi_chu: "Sàng lọc quý I:",
    muc: [
      { ten: "Siêu âm quý I", loai: "sieu_am" },
      { ten: "Đánh giá hình thái thai sớm và khoảng sáng sau gáy (NT)", loai: "sieu_am" },
      { ten: "Sàng lọc lệch bội bằng một phương pháp phù hợp (Double test / cfDNA-NIPT)", loai: "xet_nghiem" },
      { ten: "Đánh giá nguy cơ tiền sản giật khi cơ sở triển khai", loai: null },
    ],
  },
  {
    key: "hinh_thai",
    ten: "Khoảng 18–22 tuần",
    tuan: "Quý II",
    ghi_chu: "Siêu âm hình thái học:",
    muc: [
      { ten: "Siêu âm hình thái học thai", loai: "sieu_am" },
      { ten: "Đánh giá bánh rau, nước ối, cổ tử cung khi cần", loai: "sieu_am" },
      { ten: "Khảo sát tăng trưởng và các cơ quan thai", loai: "sieu_am" },
    ],
  },
  {
    key: "dtd",
    ten: "Khoảng 24–28 tuần",
    tuan: "Quý II–III",
    ghi_chu: "Sàng lọc đái tháo đường thai kỳ và theo dõi:",
    muc: [
      { ten: "Nghiệm pháp dung nạp glucose (sàng lọc đái tháo đường thai kỳ)", loai: "xet_nghiem" },
      { ten: "Kiểm tra công thức máu hoặc dự trữ sắt theo chỉ định", loai: "xet_nghiem" },
      { ten: "Đánh giá huyết áp, tăng cân, chiều cao tử cung và tim thai", loai: null },
      { ten: "Tiêm chủng và dự phòng miễn dịch theo tình trạng cá nhân", loai: null },
    ],
  },
  {
    key: "quy3",
    ten: "Ba tháng cuối",
    tuan: "Quý III",
    ghi_chu: "Theo dõi cuối thai kỳ và chuẩn bị sinh:",
    muc: [
      { ten: "Theo dõi tăng trưởng thai, nước ối và bánh rau khi có chỉ định", loai: "sieu_am" },
      { ten: "Xác định ngôi thai", loai: "sieu_am" },
      { ten: "Đánh giá nguy cơ tiền sản giật, thai chậm tăng trưởng và sinh non", loai: null },
      { ten: "Xét nghiệm/nuôi cấy liên cầu nhóm B (GBS) theo quy định cơ sở", loai: "xet_nghiem" },
      { ten: "Xây dựng kế hoạch sinh và nơi sinh", loai: null },
      { ten: "Đánh giá chỉ định sinh tại cơ sở có hồi sức sơ sinh/chuyên khoa sâu", loai: null },
    ],
  },
];

const LOAI_META = {
  xet_nghiem: { l: "Xét nghiệm", icon: FlaskConical, tone: T.lav, soft: T.lavSoft },
  sieu_am: { l: "Siêu âm", icon: ScanLine, tone: T.sky, soft: T.skySoft },
  thu_thuat: { l: "Thủ thuật", icon: Activity, tone: T.gold, soft: T.goldSoft },
};

// Bảng gợi ý cận lâm sàng theo giai đoạn thai kỳ.
//  - onChon(loai, ten): thêm nhanh một mục thành chỉ định (chỉ mục có loai).
//  - dangThem: tên mục đang được thêm (để khóa nút, tránh bấm trùng).
//  - readOnly: chỉ xem (không hiện nút Chỉ định).
export default function CanLamSangThaiKy({ onChon, dangThem, readOnly }) {
  const [mo, setMo] = useState(GIAI_DOAN_THAI_KY[0].key); // giai đoạn đang mở (accordion)

  return (
    <div style={{ border: `1.5px solid ${T.line}`, borderRadius: 14, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "12px 16px", background: T.skySoft }}>
        <Baby size={17} color={T.sky} />
        <b style={{ color: T.ink, fontSize: 14.5, flex: 1 }}>Cận lâm sàng theo giai đoạn thai kỳ</b>
        <span style={{ fontSize: 12, color: T.sub }}>Sản khoa · gợi ý</span>
      </div>

      {GIAI_DOAN_THAI_KY.map((g) => {
        const on = mo === g.key;
        return (
          <div key={g.key} style={{ borderTop: `1px solid ${T.line}66` }}>
            <button
              onClick={() => setMo(on ? null : g.key)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
                background: on ? T.bg : T.surface, border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
              }}>
              <span style={{ fontWeight: 800, color: T.ink, fontSize: 14, flex: 1 }}>{g.ten}</span>
              <Pill tone={T.sub} soft={T.bg}>{g.tuan}</Pill>
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
                        <span style={{ flex: 1, fontSize: 13.5, color: T.ink }}>{m.ten}</span>
                        {m.loai
                          ? <Pill tone={meta.tone} soft={meta.soft}>{meta.l}</Pill>
                          : <span style={{ fontSize: 12, color: T.sub, fontStyle: "italic" }}>Theo dõi / tư vấn</span>}
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

      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "11px 16px", borderTop: `1px solid ${T.line}66`, background: T.bg }}>
        <Info size={14} color={T.sub} style={{ marginTop: 2, flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: T.sub }}>
          Danh mục mang tính tham khảo theo phác đồ chăm sóc trước sinh (Bộ Y tế / ACOG / WHO). Bác sĩ quyết định chỉ định
          thực tế theo tuổi thai, yếu tố nguy cơ và quy định của cơ sở.
        </span>
      </div>
    </div>
  );
}
