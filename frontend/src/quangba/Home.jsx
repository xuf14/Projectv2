import React, { useState, useEffect } from "react";
import {
  Heart, Stethoscope, Users, Building2, Star, CheckCircle2, ArrowRight, ChevronRight,
  ShieldCheck, Newspaper, CalendarDays, ImageIcon, ClipboardCheck, Phone,
} from "lucide-react";
import { T, Btn, Card, Pill, useNav, api } from "../shared";
import { sectionWrap, eyebrow, h2, lead } from "./ui";

// ============================================================================
//  TRANG CHỦ quảng bá — hero, số liệu, giới thiệu ngắn, MỤC TIN TỨC (xem trước
//  bài mới nhất) và dải kêu gọi vào hệ thống nội bộ.
// ============================================================================

const MAU_MUC = {
  "Tin bệnh viện": T.peach, "Chuyên môn": T.sky, "Giáo dục sức khỏe": T.mint,
  "Sự kiện": T.lav, "Ưu đãi": T.gold, "Tuyển dụng": T.ink,
};
const fmtNgay = (t) => { const x = new Date(t); return isNaN(x) ? "" : x.toLocaleDateString("vi-VN"); };

export default function Home({ onNav, onEnter }) {
  const { departments, doctors } = useNav();
  const soBacSi = Array.isArray(doctors) ? doctors.length : 0;
  const soKhoa = Array.isArray(departments) ? departments.length : 0;

  const stats = [
    { icon: Users, n: "500+", l: "Bệnh nhân tin tưởng" },
    { icon: Stethoscope, n: soBacSi ? `${soBacSi}+` : "15+", l: "Bác sĩ chuyên khoa" },
    { icon: Building2, n: soKhoa ? String(soKhoa) : "4", l: "Khoa chuyên sâu" },
    { icon: Star, n: "98%", l: "Mức độ hài lòng" },
  ];

  // Tin tức mới nhất — gộp các nhóm-theo-ngày thành danh sách phẳng, lấy 3 bài đầu
  const [tinMoi, setTinMoi] = useState(null);
  useEffect(() => {
    api.mediaPosts()
      .then((groups) => {
        const flat = (Array.isArray(groups) ? groups : []).flatMap((g) => g.bai_viet || []);
        setTinMoi(flat.slice(0, 3));
      })
      .catch(() => setTinMoi([]));
  }, []);

  return (
    <>
      {/* ---------- Hero ---------- */}
      <section style={{ position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -120, right: -80, width: 420, height: 420, borderRadius: "50%", background: T.peachSoft, filter: "blur(20px)", opacity: .7 }} />
        <div style={{ position: "absolute", bottom: -160, left: -100, width: 380, height: 380, borderRadius: "50%", background: T.lavSoft, filter: "blur(20px)", opacity: .7 }} />
        <div style={{ ...sectionWrap, position: "relative", padding: "72px 24px 64px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(340px, 100%), 1fr))", gap: 48, alignItems: "center" }}>
          <div>
            <span style={eyebrow(T.peach, T.peachSoft)}>● Bệnh viện chuyên khoa hàng đầu Hải Phòng</span>
            <h1 style={{ fontSize: 48, fontWeight: 800, color: T.ink, lineHeight: 1.12, margin: "0 0 18px" }}>
              Trọn vẹn hành trình <span style={{ background: `linear-gradient(120deg, ${T.peach}, ${T.lav})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>làm mẹ</span> cùng bạn
            </h1>
            <p style={{ fontSize: 17, color: T.sub, lineHeight: 1.65, maxWidth: 520, margin: "0 0 28px" }}>
              Từ chăm sóc thai kỳ, sinh nở an toàn đến hỗ trợ sinh sản và chăm sóc sơ sinh — đội ngũ bác sĩ tận tâm
              cùng công nghệ hiện đại đồng hành với mỗi gia đình.
            </p>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <Btn kind="primary" onClick={() => onNav("dang-ky")}><ClipboardCheck size={17} /> Đăng ký khám bệnh</Btn>
              <Btn kind="soft" onClick={() => onNav("khoa-phong")}>Khám phá khoa phòng <ArrowRight size={16} /></Btn>
            </div>
            <div style={{ display: "flex", gap: 30, flexWrap: "wrap", marginTop: 40 }}>
              {stats.map((s) => (
                <div key={s.l} style={{ display: "flex", alignItems: "center", gap: 11 }}>
                  <span style={{ width: 42, height: 42, borderRadius: 12, background: T.surface, border: `1px solid ${T.line}`, color: T.peach, display: "grid", placeItems: "center" }}><s.icon size={20} /></span>
                  <div style={{ lineHeight: 1.1 }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: T.ink }}>{s.n}</div>
                    <div style={{ fontSize: 12.5, color: T.sub }}>{s.l}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ position: "relative", minHeight: 380 }}>
            <div style={{ background: `linear-gradient(150deg, ${T.lav}, ${T.peach})`, borderRadius: 28, height: 360, display: "grid", placeItems: "center", boxShadow: "0 30px 60px rgba(155,126,222,.28)", overflow: "hidden" }}>
              <Heart size={130} fill="rgba(255,255,255,.9)" color="rgba(255,255,255,.9)" />
              <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 70% 30%, rgba(255,255,255,.22), transparent 55%)" }} />
            </div>
            <div style={{ position: "absolute", top: 26, left: -18, background: T.surface, borderRadius: 16, padding: "12px 16px", boxShadow: "0 14px 34px rgba(45,58,78,.12)", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 38, height: 38, borderRadius: 11, background: T.mintSoft, color: T.mint, display: "grid", placeItems: "center" }}><CheckCircle2 size={19} /></span>
              <div style={{ lineHeight: 1.15 }}><div style={{ fontSize: 14.5, fontWeight: 800, color: T.ink }}>An toàn 100%</div><div style={{ fontSize: 12, color: T.sub }}>Chuẩn hóa quy trình</div></div>
            </div>
            <div style={{ position: "absolute", bottom: 22, right: -14, background: T.surface, borderRadius: 16, padding: "12px 16px", boxShadow: "0 14px 34px rgba(45,58,78,.12)", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 38, height: 38, borderRadius: 11, background: T.goldSoft, color: T.gold, display: "grid", placeItems: "center" }}><Star size={19} fill={T.gold} /></span>
              <div style={{ lineHeight: 1.15 }}><div style={{ fontSize: 14.5, fontWeight: 800, color: T.ink }}>98% hài lòng</div><div style={{ fontSize: 12, color: T.sub }}>Từ hơn 500 gia đình</div></div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Giới thiệu ngắn ---------- */}
      <section style={{ padding: "40px 0 8px" }}>
        <div style={{ ...sectionWrap, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 28, alignItems: "center" }}>
          <div>
            <span style={eyebrow(T.lav, T.lavSoft)}>Giới thiệu</span>
            <h2 style={h2}>Đồng hành cùng sức khỏe phụ nữ và trẻ sơ sinh</h2>
            <p style={{ fontSize: 15.5, color: T.sub, lineHeight: 1.7 }}>
              Bệnh viện Phụ sản Hải Phòng là địa chỉ tin cậy trong chăm sóc sức khỏe sinh sản, với các chuyên khoa
              Sản, Phụ, Hỗ trợ sinh sản (IVF) và Sơ sinh.
            </p>
            <div style={{ marginTop: 16 }}><Btn kind="lav" onClick={() => onNav("gioi-thieu")}>Tìm hiểu thêm <ChevronRight size={16} /></Btn></div>
          </div>
          <div style={{ display: "grid", gap: 14 }}>
            {["Chăm sóc thai kỳ và sinh nở an toàn", "Tư vấn và điều trị hiếm muộn – IVF/IUI", "Hồi sức và sàng lọc sơ sinh", "Đào tạo bác sĩ trên hệ thống mô phỏng"].map((t) => (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: 12, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: "14px 18px" }}>
                <span style={{ width: 30, height: 30, borderRadius: 9, background: T.mintSoft, color: T.mint, display: "grid", placeItems: "center", flexShrink: 0 }}><CheckCircle2 size={17} /></span>
                <span style={{ fontSize: 14.5, color: T.ink, fontWeight: 700 }}>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Đăng ký khám ---------- */}
      <section style={{ padding: "40px 0 8px" }}>
        <div style={sectionWrap}>
          <div style={{ background: `linear-gradient(130deg, ${T.peach}, ${T.lav})`, borderRadius: 28, padding: "40px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24, alignItems: "center" }}>
            <div>
              <span style={{ ...eyebrow("#fff", "rgba(255,255,255,.2)"), marginBottom: 14 }}>Dành cho bệnh nhân</span>
              <h2 style={{ ...h2, color: "#fff", marginBottom: 10 }}>Đăng ký khám bệnh trực tuyến</h2>
              <p style={{ fontSize: 15.5, color: "rgba(255,255,255,.9)", lineHeight: 1.6, margin: 0, maxWidth: 560 }}>
                Bệnh nhân mới và bệnh nhân cũ điền thông tin để đến khám tại các khoa. Phiếu đăng ký được gửi tới
                bộ phận tiếp đón — lễ tân sẽ liên hệ xác nhận lịch khám cho bạn.
              </p>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, flexWrap: "wrap" }}>
              <button onClick={() => onNav("dang-ky")} style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "#fff", color: T.ink, border: "none", borderRadius: 16, padding: "16px 28px", fontSize: 16, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 14px 34px rgba(0,0,0,.18)" }}>
                <ClipboardCheck size={20} color={T.peach} /> Đăng ký khám ngay <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Tin tức mới nhất ---------- */}
      <section style={{ padding: "48px 0" }}>
        <div style={sectionWrap}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 26 }}>
            <div>
              <span style={eyebrow(T.sky, T.skySoft)}>Tin tức & sự kiện</span>
              <h2 style={{ ...h2, margin: 0 }}>Bản tin mới nhất</h2>
            </div>
            <Btn kind="ghost" onClick={() => onNav("tin-tuc")}>Xem tất cả tin tức <ChevronRight size={16} /></Btn>
          </div>

          {tinMoi === null && <div style={{ color: T.sub, fontSize: 14.5 }}>Đang tải tin tức…</div>}
          {tinMoi && tinMoi.length === 0 && (
            <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>
              <Newspaper size={34} color={T.sub} style={{ opacity: .5, marginBottom: 10 }} />
              <div>Chưa có bài tin tức nào. Quản trị viên có thể đăng bài trong hệ thống nội bộ.</div>
            </Card>
          )}
          {tinMoi && tinMoi.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
              {tinMoi.map((b) => {
                const tone = MAU_MUC[b.chuyen_muc] || T.peach;
                return (
                  <Card key={b.id} hover onClick={() => onNav("bai-viet", { id: b.id })} style={{ overflow: "hidden", cursor: "pointer", display: "flex", flexDirection: "column" }}>
                    <div style={{ height: 172, background: `${tone}14`, display: "grid", placeItems: "center", overflow: "hidden" }}>
                      {b.anh_dai_dien_id
                        ? <img src={api.mediaImageUrl(b.anh_dai_dien_id)} alt={b.tieu_de} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <Newspaper size={42} color={tone} style={{ opacity: 0.5 }} />}
                    </div>
                    <div style={{ padding: 18, flex: 1, display: "flex", flexDirection: "column", gap: 9 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        {b.chuyen_muc && <Pill tone={tone} soft={tone + "1A"}>{b.chuyen_muc}</Pill>}
                        {b.so_anh > 0 && <span style={{ fontSize: 12, color: T.sub, display: "inline-flex", alignItems: "center", gap: 4 }}><ImageIcon size={12} /> {b.so_anh} ảnh</span>}
                      </div>
                      <div style={{ fontWeight: 800, color: T.ink, fontSize: 16, lineHeight: 1.35 }}>{b.tieu_de}</div>
                      {b.tom_tat && <div style={{ color: T.sub, fontSize: 13.5, lineHeight: 1.5, flex: 1 }}>{b.tom_tat.slice(0, 110)}{b.tom_tat.length > 110 ? "…" : ""}</div>}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5, color: T.sub, marginTop: "auto" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><CalendarDays size={13} /> {fmtNgay(b.ngay_dang)}</span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: T.peach, fontWeight: 700 }}>Đọc bài <ChevronRight size={13} /></span>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ---------- CTA nội bộ ---------- */}
      <section style={{ padding: "20px 0 64px" }}>
        <div style={sectionWrap}>
          <div style={{ background: `linear-gradient(130deg, ${T.ink}, #3C4E6B)`, borderRadius: 28, padding: "48px 40px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 26, alignItems: "center" }}>
            <div>
              <span style={{ ...eyebrow("#fff", "rgba(255,255,255,.16)"), marginBottom: 14 }}>Dành cho nhân viên</span>
              <h2 style={{ ...h2, color: "#fff", marginBottom: 10 }}>Bạn là nhân viên bệnh viện?</h2>
              <p style={{ fontSize: 15.5, color: "rgba(255,255,255,.8)", lineHeight: 1.6, margin: 0, maxWidth: 560 }}>
                Truy cập hệ thống quản lý nội bộ để tiếp đón bệnh nhân, thực hiện quy trình khám, lập viện phí và
                quản lý hồ sơ — dành cho Lễ tân, Bác sĩ và Quản trị viên.
              </p>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button onClick={onEnter} style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "#fff", color: T.ink, border: "none", borderRadius: 16, padding: "16px 28px", fontSize: 16, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 14px 34px rgba(0,0,0,.2)" }}>
                <ShieldCheck size={20} color={T.peach} /> Vào hệ thống quản lý nội bộ <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
