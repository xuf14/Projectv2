import React, { useState, useEffect } from "react";
import {
  Newspaper, CalendarDays, ImageIcon, ExternalLink, Plus, Trash2, Eye, EyeOff, Heart, User,
} from "lucide-react";
import { T, store, api, useNav, Btn, Card, Pill, PageTitle } from "./shared";
import DangBaiMoi from "./dangbai";

// ============================================================================
//  TRUYỀN THÔNG BỆNH VIỆN — bài viết + hình ảnh lưu PostgreSQL theo ngày đăng.
//  - TruyenThongPage (public): danh sách bài nhóm theo từng ngày; bấm một bài
//    sẽ MỞ TAB TRÌNH DUYỆT MỚI qua đường dẫn #/truyen-thong/<id>.
//  - ArticleTab: trang chi tiết đứng độc lập, render khi URL có hash trên
//    (App.jsx bắt hash lúc tải trang — mỗi bài một tab riêng).
//  - MediaAdmin: quản trị viên đăng bài kèm tối đa 10 ảnh, ẩn/hiện, xóa.
//  API: GET /media/posts?ngay=, GET /media/posts/:id, GET /media/images/:id,
//       POST /media/posts (multipart), PATCH .../visibility, DELETE /media/posts/:id
// ============================================================================

const MAU_MUC = {
  "Tin bệnh viện": T.peach, "Chuyên môn": T.sky, "Giáo dục sức khỏe": T.mint,
  "Sự kiện": T.lav, "Ưu đãi": T.gold, "Tuyển dụng": T.ink,
};
const fmtNgay = (s) => { const [y, m, d] = s.split("-"); return `${d}/${m}/${y}`; };
const fmtGio = (t) => { const x = new Date(t); return isNaN(x) ? "" : x.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }); };

// Mở bài viết ở MỘT TAB TRÌNH DUYỆT MỚI — mỗi bài một tab riêng
const moTabBai = (id) => window.open(`${window.location.pathname}#/truyen-thong/${id}`, "_blank");

// ---------- Trang public: danh sách bài nhóm theo ngày ----------
export default function TruyenThongPage() {
  const [groups, setGroups] = useState(null);
  const [ngay, setNgay] = useState("");
  const [err, setErr] = useState(null);

  const load = (n) => {
    api.mediaPosts(n || undefined)
      .then((r) => setGroups(Array.isArray(r) ? r : []))
      .catch((e) => { setErr(e.message); setGroups([]); });
  };
  useEffect(() => load(ngay), [ngay]);

  return (
    <div style={{ maxWidth: 1140, margin: "0 auto", padding: "40px 22px 70px" }}>
      <div style={{ textAlign: "center", marginBottom: 34 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: T.peach, letterSpacing: 0.5, textTransform: "uppercase" }}>Truyền thông</span>
        <h1 style={{ fontSize: 38, fontWeight: 800, color: T.ink, margin: "14px 0 8px", letterSpacing: -0.8 }}>Bản tin truyền thông bệnh viện</h1>
        <p style={{ color: T.sub, fontSize: 15.5, margin: 0 }}>Bài viết lưu trữ theo từng ngày — bấm vào một bài để mở trong tab mới.</p>
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 30, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, border: `1.5px solid ${T.line}`, borderRadius: 13, padding: "0 14px", background: T.surface }}>
          <CalendarDays size={17} color={T.sub} />
          <input type="date" value={ngay} onChange={(e) => setNgay(e.target.value)} style={{ border: "none", outline: "none", padding: "11px 0", fontSize: 14.5, fontFamily: "inherit", background: "transparent", color: T.ink }} />
        </div>
        {ngay && <Btn kind="ghost" size="sm" onClick={() => setNgay("")}>Xem tất cả các ngày</Btn>}
      </div>

      {err && <Card style={{ padding: 16, marginBottom: 16, background: "#FDECEA", border: "none", color: "#C0392B", fontSize: 14 }}>{err}</Card>}
      {!groups && <div style={{ textAlign: "center", color: T.sub }}>Đang tải bản tin...</div>}
      {groups && groups.length === 0 && <Card style={{ padding: 46, textAlign: "center", color: T.sub }}>Chưa có bài truyền thông nào{ngay ? ` trong ngày ${fmtNgay(ngay)}` : ""}.</Card>}

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
            {g.bai_viet.map((b) => <BaiCard key={b.id} b={b} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

// Thẻ bài viết — bấm mở tab mới
function BaiCard({ b }) {
  const tone = MAU_MUC[b.chuyen_muc] || T.peach;
  return (
    <Card hover onClick={() => moTabBai(b.id)} style={{ overflow: "hidden", cursor: "pointer", display: "flex", flexDirection: "column" }}>
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
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: T.peach, fontWeight: 700 }}>Mở tab mới <ExternalLink size={13} /></span>
        </div>
      </div>
    </Card>
  );
}

// ---------- Trang chi tiết — render độc lập trong tab trình duyệt mới ----------
export function ArticleTab({ id }) {
  const [bai, setBai] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    api.mediaPost(id).then(setBai).catch((e) => setErr(e.message));
  }, [id]);
  useEffect(() => { if (bai) document.title = bai.tieu_de; }, [bai]);

  const tone = bai ? (MAU_MUC[bai.chuyen_muc] || T.peach) : T.peach;
  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Nunito', 'Segoe UI', system-ui, sans-serif" }}>
      <header style={{ background: "rgba(255,247,244,.9)", borderBottom: `1px solid ${T.line}`, padding: "14px 22px", display: "flex", alignItems: "center", gap: 11, position: "sticky", top: 0, zIndex: 10 }}>
        <span style={{ width: 36, height: 36, borderRadius: 12, background: `linear-gradient(135deg, ${T.peach}, ${T.lav})`, display: "grid", placeItems: "center" }}><Heart size={17} fill="#fff" color="#fff" /></span>
        <b style={{ color: T.ink, fontSize: 15 }}>Phụ sản Hải Phòng</b>
        <span style={{ color: T.sub, fontSize: 13 }}>· Truyền thông</span>
      </header>

      <main style={{ maxWidth: 780, margin: "0 auto", padding: "36px 22px 70px" }}>
        {err && <Card style={{ padding: 24, background: "#FDECEA", border: "none", color: "#C0392B" }}>{err}</Card>}
        {!bai && !err && <div style={{ color: T.sub, textAlign: "center" }}>Đang tải bài viết...</div>}
        {bai && (
          <article>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
              {bai.chuyen_muc && <Pill tone={tone} soft={tone + "1A"}>{bai.chuyen_muc}</Pill>}
              <span style={{ fontSize: 13, color: T.sub, display: "inline-flex", alignItems: "center", gap: 5 }}>
                <CalendarDays size={13} /> {new Date(bai.ngay_dang).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
              {bai.nguoi_dang && <span style={{ fontSize: 13, color: T.sub, display: "inline-flex", alignItems: "center", gap: 5 }}><User size={13} /> {bai.nguoi_dang}</span>}
            </div>
            <h1 style={{ fontSize: 32, fontWeight: 800, color: T.ink, letterSpacing: -0.6, margin: "0 0 14px", lineHeight: 1.25 }}>{bai.tieu_de}</h1>
            {bai.tom_tat && <p style={{ fontSize: 16.5, color: T.sub, lineHeight: 1.6, margin: "0 0 22px", fontWeight: 600 }}>{bai.tom_tat}</p>}

            {bai.anh.length > 0 && (
              <div style={{ display: "grid", gap: 14, marginBottom: 24 }}>
                <img src={api.mediaImageUrl(bai.anh[0].id)} alt={bai.anh[0].ten_tep} style={{ width: "100%", borderRadius: 18, border: `1px solid ${T.line}` }} />
              </div>
            )}

            {/* Nội dung văn bản thuần — không render HTML thô */}
            <div style={{ fontSize: 16, color: T.ink, lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{bai.noi_dung}</div>

            {bai.the && (
              <div style={{ marginTop: 20, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {bai.the.split(",").map((t) => t.trim()).filter(Boolean).map((t) => (
                  <Pill key={t} tone={T.sub} soft="#F0F0F2">#{t}</Pill>
                ))}
              </div>
            )}

            {bai.anh.length > 1 && (
              <div style={{ marginTop: 28 }}>
                <div style={{ fontWeight: 800, color: T.ink, fontSize: 16, marginBottom: 12 }}><ImageIcon size={16} style={{ verticalAlign: -3 }} /> Hình ảnh ({bai.anh.length})</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
                  {bai.anh.slice(1).map((a) => (
                    <img key={a.id} src={api.mediaImageUrl(a.id)} alt={a.ten_tep} style={{ width: "100%", borderRadius: 14, border: `1px solid ${T.line}` }} />
                  ))}
                </div>
              </div>
            )}
          </article>
        )}
      </main>
    </div>
  );
}

// ---------- Quản trị: đăng bài + ảnh, ẩn/hiện, xóa ----------
export function MediaAdmin() {
  const { online } = useNav();
  const live = online && !!store.token;
  const [list, setList] = useState(null);
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  const load = () => {
    if (!live) return;
    api.adminMediaPosts().then((r) => setList(Array.isArray(r) ? r : []))
      .catch((e) => { setErr(e.message); setList([]); });
  };
  useEffect(load, [live]);

  const toggle = async (b) => {
    try { await api.toggleMediaPost(b.id); load(); } catch (e) { setErr(e.message); }
  };
  const del = async (b) => {
    if (!window.confirm(`Xóa vĩnh viễn bài "${b.tieu_de}" cùng toàn bộ ảnh?`)) return;
    try { await api.deleteMediaPost(b.id); setMsg(`Đã xóa bài "${b.tieu_de}".`); load(); }
    catch (e) { setErr(e.message); }
  };

  if (!live) {
    return (<div><PageTitle title="Truyền thông" sub="Đăng và quản lý bài truyền thông." />
      <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>Cần đăng nhập quản trị viên.</Card></div>);
  }
  if (adding) return <DangBaiMoi onBack={() => setAdding(false)} onSaved={(b) => { setAdding(false); setMsg(`Đã đăng bài "${b.tieu_de}" (${b.anh.length} ảnh) — lưu vào database theo ngày ${new Date(b.ngay_dang).toLocaleDateString("vi-VN")}.`); load(); }} />;

  return (
    <div>
      <PageTitle title="Truyền thông" sub="Bài viết và hình ảnh lưu trong database, nhóm theo ngày đăng."
        action={<Btn kind="lav" onClick={() => { setMsg(null); setAdding(true); }}><Plus size={16} /> Tạo bài truyền thông mới</Btn>} />
      {msg && <Card style={{ padding: 14, marginBottom: 14, border: "none", background: T.mintSoft, color: "#2F8F73", fontSize: 14 }}>{msg}</Card>}
      {err && <Card style={{ padding: 14, marginBottom: 14, border: "none", background: "#FDECEA", color: "#C0392B", fontSize: 14 }}>{err}</Card>}
      {!list && <div style={{ color: T.sub, fontSize: 14 }}>Đang tải danh sách bài...</div>}
      {list && list.length === 0 && <Card style={{ padding: 40, textAlign: "center", color: T.sub }}>Chưa có bài truyền thông nào — bấm "Đăng bài mới".</Card>}
      <div style={{ display: "grid", gap: 12 }}>
        {(list || []).map((b) => (
          <Card key={b.id} style={{ padding: 18, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", opacity: b.hien_thi ? 1 : 0.55 }}>
            <span style={{ width: 44, height: 44, borderRadius: 13, background: T.lavSoft, color: T.lav, display: "grid", placeItems: "center", flexShrink: 0 }}><Newspaper size={20} /></span>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontWeight: 800, color: T.ink, fontSize: 15 }}>{b.tieu_de}</span>
                {b.chuyen_muc && <Pill tone={MAU_MUC[b.chuyen_muc] || T.peach} soft={(MAU_MUC[b.chuyen_muc] || T.peach) + "1A"}>{b.chuyen_muc}</Pill>}
                {!b.hien_thi && <Pill tone="#C0392B" soft="#FDECEA">Đã gỡ</Pill>}
              </div>
              <div style={{ color: T.sub, fontSize: 13, marginTop: 4 }}>
                {new Date(b.ngay_dang).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                {" · "}{b.so_anh} ảnh{b.nguoi_dang ? ` · ${b.nguoi_dang}` : ""}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {b.hien_thi && <Btn kind="ghost" size="sm" onClick={() => moTabBai(b.id)}><ExternalLink size={14} /> Xem tab mới</Btn>}
              <Btn kind="ghost" size="sm" onClick={() => toggle(b)}>{b.hien_thi ? <><EyeOff size={14} /> Gỡ bài</> : <><Eye size={14} /> Hiện lại</>}</Btn>
              <Btn kind="ghost" size="sm" style={{ color: "#C0392B" }} onClick={() => del(b)}><Trash2 size={14} /> Xóa</Btn>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Form đăng bài đã chuyển thành trang riêng "Đăng bài mới" — xem dangbai.jsx
