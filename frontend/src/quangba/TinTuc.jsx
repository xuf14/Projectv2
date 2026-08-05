import React, { useState, useEffect } from "react";
import { Newspaper, CalendarDays, ImageIcon, ChevronRight } from "lucide-react";
import { T, api, Card, Pill } from "../shared";
import { sectionWrap, PageHeader } from "./ui";

// ============================================================================
//  TRANG TIN TỨC (công khai) — danh sách bài truyền thông nhóm theo từng ngày
//  đăng, lọc theo ngày. Bấm một bài để đọc chi tiết ngay trong trang (onNav).
//  Dữ liệu: GET /media/posts?ngay= (chỉ bài đang hiển thị).
// ============================================================================

const MAU_MUC = {
  "Tin bệnh viện": T.peach, "Chuyên môn": T.sky, "Giáo dục sức khỏe": T.mint,
  "Sự kiện": T.lav, "Ưu đãi": T.gold, "Tuyển dụng": T.ink,
};
const fmtNgay = (s) => { const [y, m, d] = s.split("-"); return `${d}/${m}/${y}`; };
const fmtGio = (t) => { const x = new Date(t); return isNaN(x) ? "" : x.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }); };

function BaiCard({ b, onNav }) {
  const tone = MAU_MUC[b.chuyen_muc] || T.peach;
  return (
    <Card hover onClick={() => onNav("bai-viet", { id: b.id })} style={{ overflow: "hidden", cursor: "pointer", display: "flex", flexDirection: "column" }}>
      <div style={{ height: 170, background: `${tone}14`, display: "grid", placeItems: "center", overflow: "hidden" }}>
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
        {b.tom_tat && <div style={{ color: T.sub, fontSize: 13.5, lineHeight: 1.5, flex: 1 }}>{b.tom_tat.slice(0, 120)}{b.tom_tat.length > 120 ? "…" : ""}</div>}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5, color: T.sub, marginTop: "auto" }}>
          <span>{fmtGio(b.ngay_dang)}{b.nguoi_dang ? ` · ${b.nguoi_dang}` : ""}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: T.peach, fontWeight: 700 }}>Đọc bài <ChevronRight size={13} /></span>
        </div>
      </div>
    </Card>
  );
}

export default function TinTuc({ onNav }) {
  const [groups, setGroups] = useState(null);
  const [ngay, setNgay] = useState("");
  const [err, setErr] = useState(null);

  useEffect(() => {
    setErr(null);
    api.mediaPosts(ngay || undefined)
      .then((r) => setGroups(Array.isArray(r) ? r : []))
      .catch((e) => { setErr(e.message); setGroups([]); });
  }, [ngay]);

  return (
    <section style={{ padding: "56px 0" }}>
      <div style={sectionWrap}>
        <PageHeader eyebrowText="Tin tức & sự kiện" tone={T.sky} soft={T.skySoft}
          title="Tin tức bệnh viện"
          sub="Bài viết được lưu trữ theo từng ngày đăng — bấm vào một bài để đọc chi tiết." />

        <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 30, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, border: `1.5px solid ${T.line}`, borderRadius: 13, padding: "0 14px", background: T.surface }}>
            <CalendarDays size={17} color={T.sub} />
            <input type="date" value={ngay} onChange={(e) => setNgay(e.target.value)} style={{ border: "none", outline: "none", padding: "11px 0", fontSize: 14.5, fontFamily: "inherit", background: "transparent", color: T.ink }} />
          </div>
          {ngay && <button onClick={() => setNgay("")} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 14, color: T.peach, fontWeight: 700 }}>Xem tất cả các ngày</button>}
        </div>

        {err && <Card style={{ padding: 16, marginBottom: 16, background: "#FDECEA", border: "none", color: "#C0392B", fontSize: 14 }}>{err}</Card>}
        {!groups && <div style={{ textAlign: "center", color: T.sub }}>Đang tải tin tức…</div>}
        {groups && groups.length === 0 && <Card style={{ padding: 46, textAlign: "center", color: T.sub }}>Chưa có bài tin tức nào{ngay ? ` trong ngày ${fmtNgay(ngay)}` : ""}.</Card>}

        {(groups || []).map((g) => (
          <div key={g.ngay} style={{ marginBottom: 36 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <span style={{ width: 40, height: 40, borderRadius: 12, background: T.peachSoft, color: T.peach, display: "grid", placeItems: "center" }}><CalendarDays size={19} /></span>
              <div>
                <div style={{ fontWeight: 800, color: T.ink, fontSize: 17 }}>Ngày {fmtNgay(g.ngay)}</div>
                <div style={{ fontSize: 12.5, color: T.sub }}>{g.bai_viet.length} bài viết</div>
              </div>
              <div style={{ flex: 1, height: 1, background: T.line }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 18 }}>
              {g.bai_viet.map((b) => <BaiCard key={b.id} b={b} onNav={onNav} />)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
