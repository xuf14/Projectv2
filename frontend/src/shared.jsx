import React, { useState, useEffect, createContext, useContext } from "react";
import { Heart, Menu, Search, Bell, LogOut, Shield, Stethoscope, User, Star } from "lucide-react";

// ============================================================================
//  SHARED — theme, lớp gọi API, điều hướng và UI primitive dùng chung
//  giữa App.jsx và các cổng tách riêng (DoctorPortal.jsx).
// ============================================================================

// ---------- THEME TOKENS ----------
const T = {
  bg: "#FFF7F4",        // nền kem-hồng
  surface: "#FFFFFF",
  ink: "#2D3A4E",       // navy chữ chính
  sub: "#7A8699",       // chữ phụ
  line: "#F0E6E2",      // viền nhạt
  peach: "#F08A7C",     // hồng đào - màu chủ đạo ấm
  peachSoft: "#FDEDE9",
  lav: "#9B7EDE",       // tím lavender
  lavSoft: "#EFE9FB",
  mint: "#4FB89A",      // xanh mint
  mintSoft: "#E2F4EF",
  sky: "#5BA8D0",       // xanh trời
  skySoft: "#E4F1F8",
  gold: "#F4B942",
  goldSoft: "#FDF2DA",
};

// ============================================================================
//  LỚP GỌI API + QUẢN LÝ ĐĂNG NHẬP  (kết nối backend NestJS tại :3000)
// ============================================================================
const API_BASE = "http://localhost:3000/api";

// Lưu token trong bộ nhớ (không dùng localStorage trong môi trường sandbox)
const store = {
  token: null,
  user: null,
  set(token, user) { this.token = token; this.user = user; },
  clear() { this.token = null; this.user = null; },
};

async function apiFetch(path, { method = "GET", body, auth = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth && store.token) headers.Authorization = "Bearer " + store.token;
  const res = await fetch(API_BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = null;
  try { data = await res.json(); } catch { /* no body */ }
  if (!res.ok) throw new Error((data && data.message) || `Lỗi ${res.status}`);
  return data;
}

const api = {
  // Auth
  login: (tai_khoan, mat_khau) => apiFetch("/auth/login", { method: "POST", body: { tai_khoan, mat_khau } }),
  // Catalog (dùng trong các cổng nhân viên)
  departments: () => apiFetch("/departments"),
  doctors: (khoaId) => apiFetch("/doctors" + (khoaId ? `?khoa=${khoaId}` : "")),
  news: () => apiFetch("/news"),
  // Lễ tân / Quản trị viên — hồ sơ cá nhân của bệnh nhân được chọn (mọi thao tác ghi nhật ký)
  receptionPatient: (id) => apiFetch(`/reception/ho-so/${id}`, { auth: true }),
  createPatientRecord: (b) => apiFetch("/reception/ho-so", { method: "POST", body: b, auth: true }),
  updatePatientRecord: (id, b) => apiFetch(`/reception/ho-so/${id}`, { method: "PATCH", body: b, auth: true }),
  deletePatientRecord: (id) => apiFetch(`/reception/ho-so/${id}`, { method: "DELETE", auth: true }),
  // Mẫu bệnh án đính kèm lịch hẹn (tệp PDF/Word lưu nhị phân trong database)
  documents: (lichId) => apiFetch(`/appointments/${lichId}/documents`, { auth: true }),
  uploadDocument: async (lichId, file) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${API_BASE}/appointments/${lichId}/documents`, {
      method: "POST", headers: { Authorization: "Bearer " + store.token }, body: fd,
    });
    let data = null;
    try { data = await res.json(); } catch { /* không có body */ }
    if (!res.ok) throw new Error((data && data.message) || `Lỗi ${res.status}`);
    return data;
  },
  downloadDocument: async (id) => {
    const res = await fetch(`${API_BASE}/documents/${id}/download`, {
      headers: { Authorization: "Bearer " + store.token },
    });
    if (!res.ok) throw new Error(`Không tải được tệp (lỗi ${res.status})`);
    return res.blob();
  },
  deleteDocument: (id) => apiFetch(`/documents/${id}`, { method: "DELETE", auth: true }),
  // Bác sĩ (trang Hàng chờ khám + Tổng quan)
  queue: () => apiFetch("/queue", { auth: true }),
  doctorSummary: () => apiFetch("/doctor/summary", { auth: true }),
  // Lịch khám sắp tới của bác sĩ (gồm lịch lễ tân xác nhận từ đăng ký online)
  doctorUpcoming: () => apiFetch("/doctor/upcoming", { auth: true }),
  saveResult: (lichId, b) => apiFetch(`/visits/${lichId}/result`, { method: "POST", body: b, auth: true }),
  // Lễ tân (trang Tiếp đón)
  receptionToday: (ngay) => apiFetch("/reception/today" + (ngay ? `?ngay=${ngay}` : ""), { auth: true }),
  lookupAppt: (ma) => apiFetch(`/reception/lookup/${encodeURIComponent(ma)}`, { auth: true }),
  checkin: (id) => apiFetch(`/reception/checkin/${id}`, { method: "POST", auth: true }),
  // Trang Hồ sơ bệnh nhân + Lịch sử khám
  patients: (q) => apiFetch("/patients" + (q ? `?q=${encodeURIComponent(q)}` : ""), { auth: true }),
  patientAppts: (hoSoId) => apiFetch(`/patients/${hoSoId}/appointments`, { auth: true }),
  // Lễ tân — tiếp nhận bệnh nhân mới đến trực tiếp (tạo hồ sơ walk-in)
  createReceptionPatient: (b) => apiFetch("/reception/patients", { method: "POST", body: b, auth: true }),
  // Lễ tân tạo lịch khám mới cho bệnh nhân đến khám hôm nay (vào hàng chờ khám)
  createNewExam: (b) => apiFetch("/reception/new-exam", { method: "POST", body: b, auth: true }),
  // Doanh thu từng ngày trong một tháng (YYYY-MM) — để lịch tô màu ngày có thu
  monthlyRevenue: (thang) => apiFetch("/reception/payments/monthly" + (thang ? `?thang=${thang}` : ""), { auth: true }),
  // Doanh thu trong ngày gom theo bệnh nhân + tổng đã thu của một bệnh nhân
  dailyByPatient: (ngay) => apiFetch("/reception/payments/by-patient" + (ngay ? `?ngay=${ngay}` : ""), { auth: true }),
  patientRevenue: (hoSoId) => apiFetch(`/reception/payments/patient/${hoSoId}`, { auth: true }),
  // Đăng ký khám online: bệnh nhân gửi ở trang công khai (không đăng nhập);
  // lễ tân xem hàng chờ và tiếp nhận / hủy ở trang Tiếp đón.
  dangKyKham: (b) => apiFetch("/public/dang-ky-kham", { method: "POST", body: b }),
  dangKyKhamList: (trangThai) => apiFetch("/reception/dang-ky-kham" + (trangThai ? `?trang_thai=${trangThai}` : ""), { auth: true }),
  updateDangKyKham: (id, b) => apiFetch(`/reception/dang-ky-kham/${id}`, { method: "PATCH", body: b, auth: true }),
  // Ra viện: bác sĩ điều trị lập y lệnh ra viện; lễ tân kiểm tra điều kiện ĐKRV
  createRaVien: (b) => apiFetch("/doctor/ra-vien", { method: "POST", body: b, auth: true }),
  raVienList: (q) => apiFetch("/doctor/ra-vien" + (q ? `?q=${encodeURIComponent(q)}` : ""), { auth: true }),
  cancelRaVien: (id) => apiFetch(`/doctor/ra-vien/${id}/huy`, { method: "PATCH", auth: true }),
  dischargeEligibility: (hoSoId) => apiFetch(`/reception/discharge-eligibility/${hoSoId}`, { auth: true }),
  // Tái khám: lễ tân note ngày hẹn; thông tin phục vụ tái khám; danh sách của bác sĩ
  setRevisit: (hoSoId, b) => apiFetch(`/reception/patients/${hoSoId}/revisit`, { method: "PATCH", body: b, auth: true }),
  revisitInfo: (hoSoId) => apiFetch(`/patients/${hoSoId}/revisit-info`, { auth: true }),
  // Hồ sơ tổng hợp: phiếu khám + lịch hẹn + y lệnh viện phí + thanh toán
  patientSummary: (hoSoId) => apiFetch(`/patients/${hoSoId}/summary`, { auth: true }),
  doctorRevisits: () => apiFetch("/doctor/revisits", { auth: true }),
  // Lễ tân: toàn bộ lịch tái khám (lọc ngày/bác sĩ/từ khóa); bác sĩ: xác nhận đã tái khám
  revisits: ({ tu, den, bac_si, q } = {}) => {
    const p = new URLSearchParams();
    if (tu) p.set("tu", tu);
    if (den) p.set("den", den);
    if (bac_si) p.set("bac_si", bac_si);
    if (q) p.set("q", q);
    const s = p.toString();
    return apiFetch("/reception/revisits" + (s ? `?${s}` : ""), { auth: true });
  },
  doneRevisit: (hoSoId, b) => apiFetch(`/doctor/revisits/${hoSoId}/done`, { method: "PATCH", body: b, auth: true }),
  // Tạo lịch tái khám thật (vào "Tất cả lịch hẹn") + báo bác sĩ, quản trị viên
  createRevisitAppointment: (b) => apiFetch("/reception/revisit-appointments", { method: "POST", body: b, auth: true }),
  // Thông báo của tài khoản đang đăng nhập
  notifications: () => apiFetch("/notifications", { auth: true }),
  readNotification: (id) => apiFetch(`/notifications/${id}/read`, { method: "PATCH", auth: true }),
  readAllNotifications: () => apiFetch("/notifications/read-all", { method: "PATCH", auth: true }),
  records: (hoSoId) => apiFetch(`/records/${hoSoId}`, { auth: true }),
  // Admin
  reports: () => apiFetch("/admin/reports", { auth: true }),
  activityLogs: () => apiFetch("/admin/activity", { auth: true }),
  adminUsers: () => apiFetch("/admin/users", { auth: true }),
  createUser: (b) => apiFetch("/admin/users", { method: "POST", body: b, auth: true }),
  toggleUser: (id) => apiFetch(`/admin/users/${id}/status`, { method: "PATCH", auth: true }),
  resetPassword: (id, mat_khau) => apiFetch(`/admin/users/${id}/password`, { method: "PATCH", body: { mat_khau }, auth: true }),
  // Người đang đăng nhập tự đổi mật khẩu của chính mình (nhập đúng mật khẩu hiện tại)
  changeMyPassword: (mat_khau_cu, mat_khau_moi) => apiFetch("/auth/doi-mat-khau", { method: "PATCH", body: { mat_khau_cu, mat_khau_moi }, auth: true }),
  // Lễ tân — tất cả lịch hẹn + xác nhận. loc: { tu, den } lọc theo ngày khám (YYYY-MM-DD)
  allAppointments: (trangThai, q, loc) => {
    const p = new URLSearchParams();
    if (trangThai) p.set("trang_thai", trangThai);
    if (q) p.set("q", q);
    if (loc && loc.tu) p.set("tu", loc.tu);
    if (loc && loc.den) p.set("den", loc.den);
    const s = p.toString();
    return apiFetch("/reception/appointments" + (s ? `?${s}` : ""), { auth: true });
  },
  confirmAppt: (id) => apiFetch(`/reception/confirm/${id}`, { method: "POST", auth: true }),
  // Lễ tân — phiếu thông tin khám bệnh (mẫu bệnh án của bệnh viện)
  lookupPatientInfo: (ma) => apiFetch(`/reception/patient-lookup?ma=${encodeURIComponent(ma)}`, { auth: true }),
  examSheets: () => apiFetch("/reception/exam-sheets", { auth: true }),
  examSheet: (id) => apiFetch(`/reception/exam-sheets/${id}`, { auth: true }),
  createExamSheet: (b) => apiFetch("/reception/exam-sheets", { method: "POST", body: b, auth: true }),
  // Lễ tân — phiếu y lệnh (thanh toán viện phí: thuốc, vật tư, dịch vụ)
  createYLenh: (b) => apiFetch("/reception/y-lenh", { method: "POST", body: b, auth: true }),
  yLenhList: ({ tu, den, q } = {}) => {
    const p = new URLSearchParams();
    if (tu) p.set("tu", tu); if (den) p.set("den", den); if (q) p.set("q", q);
    const qs = p.toString();
    return apiFetch("/reception/y-lenh" + (qs ? `?${qs}` : ""), { auth: true });
  },
  yLenh: (id) => apiFetch(`/reception/y-lenh/${id}`, { auth: true }),
  // Chỉ định cận lâm sàng của phiếu khám → dòng dịch vụ cho chi tiết viện phí
  yLenhCls: (phieuKhamId) => apiFetch(`/reception/y-lenh/cls/${phieuKhamId}`, { auth: true }),
  // Đơn thuốc bác sĩ đã kê ở lần khám → dòng thuốc cho chi tiết viện phí
  yLenhDonThuoc: (phieuKhamId) => apiFetch(`/reception/y-lenh/don-thuoc/${phieuKhamId}`, { auth: true }),
  // Danh mục vật tư tiêu hao trong database (lọc theo khoa/nhóm/từ khóa)
  vatTuCatalog: (p = {}) => {
    const q = new URLSearchParams();
    if (p.khoa) q.set("khoa", p.khoa);
    if (p.nhom) q.set("nhom", p.nhom);
    if (p.q) q.set("q", p.q);
    const s = q.toString();
    return apiFetch("/catalog/vat-tu" + (s ? `?${s}` : ""), { auth: true });
  },
  // Danh mục thuốc trong database — nguồn cho ô kê đơn và ô chọn thuốc viện phí
  thuocCatalog: (q) => apiFetch("/catalog/thuoc" + (q ? `?q=${encodeURIComponent(q)}` : ""), { auth: true }),
  payYLenh: (id, so_tien) => apiFetch(`/reception/y-lenh/${id}/thu`, { method: "POST", body: { so_tien }, auth: true }),
  // Kho — tủ thuốc & tủ vật tư tiêu hao
  khoTon: (p = {}) => {
    const q = new URLSearchParams();
    if (p.loai) q.set("loai", p.loai);
    if (p.q) q.set("q", p.q);
    if (p.sap_het) q.set("sap_het", "1");
    const s = q.toString();
    return apiFetch("/kho/ton" + (s ? `?${s}` : ""), { auth: true });
  },
  khoNhap: (b) => apiFetch("/kho/nhap", { method: "POST", body: b, auth: true }),
  khoSuaGia: (b) => apiFetch("/kho/gia", { method: "POST", body: b, auth: true }),
  khoDieuChinh: (b) => apiFetch("/kho/dieu-chinh", { method: "POST", body: b, auth: true }),
  khoNhatKy: (p = {}) => {
    const q = new URLSearchParams();
    if (p.loai) q.set("loai", p.loai);
    if (p.ma) q.set("ma", p.ma);
    if (p.loai_gd) q.set("loai_gd", p.loai_gd);
    const s = q.toString();
    return apiFetch("/kho/nhat-ky" + (s ? `?${s}` : ""), { auth: true });
  },
  // Nhập viện một chạm — yêu cầu của bác sĩ, hàng chờ lễ tân, đợt nội trú, giường
  nvHangCho: (p = {}) => {
    const q = new URLSearchParams();
    if (p.trang_thai) q.set("trang_thai", p.trang_thai);
    if (p.q) q.set("q", p.q);
    const s = q.toString();
    return apiFetch("/nhap-vien/hang-cho" + (s ? `?${s}` : ""), { auth: true });
  },
  nvChiTiet: (id) => apiFetch(`/nhap-vien/${id}`, { auth: true }),
  nvTiepNhan: (id) => apiFetch(`/nhap-vien/${id}/tiep-nhan`, { method: "POST", auth: true }),
  nvXacMinh: (id, b) => apiFetch(`/nhap-vien/${id}/xac-minh`, { method: "PATCH", body: b, auth: true }),
  nvXacNhan: (id, b) => apiFetch(`/nhap-vien/${id}/xac-nhan`, { method: "POST", body: b, auth: true }),
  nvKetThuc: (id, b) => apiFetch(`/nhap-vien/${id}/ket-thuc`, { method: "POST", body: b, auth: true }),
  noiTru: (p = {}) => {
    const q = new URLSearchParams();
    if (p.trang_thai) q.set("trang_thai", p.trang_thai);
    if (p.q) q.set("q", p.q);
    const s = q.toString();
    return apiFetch("/noi-tru" + (s ? `?${s}` : ""), { auth: true });
  },
  noiTruKhoaNhan: (id) => apiFetch(`/noi-tru/${id}/khoa-nhan`, { method: "POST", auth: true }),
  giuongList: (p = {}) => {
    const q = new URLSearchParams();
    if (p.khoa_id) q.set("khoa_id", String(p.khoa_id));
    if (p.trong) q.set("trong", "1");
    const s = q.toString();
    return apiFetch("/giuong" + (s ? `?${s}` : ""), { auth: true });
  },
  giuongLuu: (b) => apiFetch("/admin/giuong", { method: "POST", body: b, auth: true }),
  // Bác sĩ — phiếu điều trị (diễn biến bệnh theo thời gian)
  addProgress: (b) => apiFetch("/treatment/progress", { method: "POST", body: b, auth: true }),
  progressList: (phieuKhamId) => apiFetch(`/treatment/progress/${phieuKhamId}`, { auth: true }),
  progressByPatient: (hoSoId) => apiFetch(`/treatment/progress-by-patient/${hoSoId}`, { auth: true }),
  // Truyền thông — bài viết + ảnh lưu database, nhóm theo ngày
  mediaPosts: (ngay) => apiFetch("/media/posts" + (ngay ? `?ngay=${ngay}` : "")),
  mediaPost: (id) => apiFetch(`/media/posts/${id}`),
  mediaImageUrl: (id) => `${API_BASE}/media/images/${id}`,
  adminMediaPosts: () => apiFetch("/admin/media/posts", { auth: true }),
  createMediaPost: async (fields, files) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) if (v) fd.append(k, v);
    for (const f of files || []) fd.append("anh", f);
    const res = await fetch(`${API_BASE}/media/posts`, {
      method: "POST", headers: { Authorization: "Bearer " + store.token }, body: fd,
    });
    let data = null;
    try { data = await res.json(); } catch { /* không có body */ }
    if (!res.ok) throw new Error((data && data.message) || `Lỗi ${res.status}`);
    return data;
  },
  toggleMediaPost: (id) => apiFetch(`/media/posts/${id}/visibility`, { method: "PATCH", auth: true }),
  deleteMediaPost: (id) => apiFetch(`/media/posts/${id}`, { method: "DELETE", auth: true }),
  // Quy trình khám 6 bước (encounter = lần khám, gắn với lịch hẹn)
  encountersToday: () => apiFetch("/encounters/today", { auth: true }),
  encounterFlow: (id) => apiFetch(`/encounters/${id}/flow`, { auth: true }),
  saveVitals: (id, b) => apiFetch(`/encounters/${id}/vitals`, { method: "POST", body: b, auth: true }),
  saveExam: (id, b) => apiFetch(`/encounters/${id}/exam`, { method: "POST", body: b, auth: true }),
  addOrder: (id, b) => apiFetch(`/encounters/${id}/orders`, { method: "POST", body: b, auth: true }),
  orderResult: (orderId, b) => apiFetch(`/encounters/orders/${orderId}/result`, { method: "PATCH", body: b, auth: true }),
  deleteOrder: (orderId) => apiFetch(`/encounters/orders/${orderId}`, { method: "DELETE", auth: true }),
  // Hỗ trợ sinh sản (IVF) — hồ sơ điều trị hiếm muộn theo từng bệnh nhân
  ivfList: () => apiFetch("/ivf/ho-so", { auth: true }),
  ivfStart: (b) => apiFetch("/ivf/ho-so", { method: "POST", body: b, auth: true }),
  ivfToggleStep: (id, b) => apiFetch(`/ivf/ho-so/${id}/buoc`, { method: "PATCH", body: b, auth: true }),
  ivfSetPhase: (id, b) => apiFetch(`/ivf/ho-so/${id}/giai-doan`, { method: "PATCH", body: b, auth: true }),
  ivfNote: (id, b) => apiFetch(`/ivf/ho-so/${id}`, { method: "PATCH", body: b, auth: true }),
  saveConclusion: (id, b) => apiFetch(`/encounters/${id}/conclusion`, { method: "POST", body: b, auth: true }),
  // Dịch vụ & thanh toán
  services: () => apiFetch("/services", { auth: true }),
  createPayment: (lichId, b) => apiFetch(`/reception/appointments/${lichId}/payment`, { method: "POST", body: b, auth: true }),
  payPayment: (id) => apiFetch(`/payments/${id}/pay`, { method: "POST", auth: true }),
  receptionPayments: () => apiFetch("/reception/payments", { auth: true }),
  dailyPayments: (ngay) => apiFetch("/reception/payments/daily" + (ngay ? `?ngay=${ngay}` : ""), { auth: true }),
  exportDailyPayments: async (ngay) => {
    const res = await fetch(`${API_BASE}/reception/payments/daily/export` + (ngay ? `?ngay=${ngay}` : ""), {
      headers: { Authorization: "Bearer " + store.token },
    });
    if (!res.ok) throw new Error(`Không xuất được sổ thu (lỗi ${res.status})`);
    return res.blob();
  },
  adminPayments: () => apiFetch("/admin/payments", { auth: true }),
  cancelPayment: (id) => apiFetch(`/admin/payments/${id}/cancel`, { method: "PATCH", auth: true }),
  myPayments: () => apiFetch("/payments/me", { auth: true }),
  // Admin — khung giờ khám (trả đủ mọi khung, kể cả đã đầy)
  adminSlots: (bacSi, ngay) => apiFetch(`/admin/slots?bacSi=${bacSi}&ngay=${ngay}`, { auth: true }),
  addSlot: (b) => apiFetch("/admin/slots", { method: "POST", body: b, auth: true }),
  // Tạo khung giờ hàng loạt cho nhiều bác sĩ trong nhiều ngày
  addSlotsBulk: (b) => apiFetch("/admin/slots/bulk", { method: "POST", body: b, auth: true }),
  updateSlot: (id, b) => apiFetch(`/admin/slots/${id}`, { method: "PATCH", body: b, auth: true }),
  deleteSlot: (id) => apiFetch(`/admin/slots/${id}`, { method: "DELETE", auth: true }),
  // Trợ lý ảo: gửi câu hỏi + lịch sử phiên hiện tại (không lưu ở client lẫn server)
  chat: (noi_dung, lich_su) => apiFetch("/chat", { method: "POST", body: { noi_dung, lich_su }, auth: true }),
  reportTypes: () => apiFetch("/admin/report-types", { auth: true }),
  report: (loai, tu, den) => apiFetch(`/admin/report/${loai}?tu=${tu}&den=${den}`, { auth: true }),
  exportReportByType: async (loai, tu, den) => {
    const res = await fetch(`${API_BASE}/admin/report/${loai}/export?tu=${tu}&den=${den}`, {
      headers: { Authorization: "Bearer " + store.token },
    });
    if (!res.ok) throw new Error("Không xuất được báo cáo");
    return res.blob();
  },
  createDepartment: (b) => apiFetch("/admin/departments", { method: "POST", body: b, auth: true }),
  updateDepartment: (id, b) => apiFetch(`/admin/departments/${id}`, { method: "PATCH", body: b, auth: true }),
  deleteDepartment: (id) => apiFetch(`/admin/departments/${id}`, { method: "DELETE", auth: true }),
  createDoctor: (b) => apiFetch("/admin/doctors", { method: "POST", body: b, auth: true }),
  updateDoctor: (id, b) => apiFetch(`/admin/doctors/${id}`, { method: "PATCH", body: b, auth: true }),
  // Admin — xuất báo cáo CSV (mở bằng Excel)
  exportReport: async () => {
    const res = await fetch(`${API_BASE}/admin/reports/export`, {
      headers: { Authorization: "Bearer " + store.token },
    });
    if (!res.ok) throw new Error(`Không xuất được báo cáo (lỗi ${res.status})`);
    return res.blob();
  },
};

// ---------- NAV CONTEXT ----------
const Nav = createContext(null);
const useNav = () => useContext(Nav);

// ---------- PRIMITIVE UI ----------
function Btn({ children, kind = "primary", size = "md", full, style, ...p }) {
  const base = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
    border: "none", cursor: "pointer", fontWeight: 700, borderRadius: 999,
    fontFamily: "inherit", transition: "transform .12s, box-shadow .12s, background .15s",
    width: full ? "100%" : undefined,
    padding: size === "sm" ? "8px 16px" : size === "lg" ? "15px 28px" : "12px 22px",
    fontSize: size === "sm" ? 13.5 : size === "lg" ? 16 : 14.5,
  };
  const kinds = {
    primary: { background: `linear-gradient(135deg, ${T.peach}, #ED7263)`, color: "#fff", boxShadow: "0 8px 20px rgba(240,138,124,.32)" },
    lav: { background: `linear-gradient(135deg, ${T.lav}, #8A6BD0)`, color: "#fff", boxShadow: "0 8px 20px rgba(155,126,222,.3)" },
    mint: { background: `linear-gradient(135deg, ${T.mint}, #3FA589)`, color: "#fff", boxShadow: "0 8px 20px rgba(79,184,154,.3)" },
    gold: { background: `linear-gradient(135deg, ${T.gold}, #E0A427)`, color: "#fff", boxShadow: "0 8px 20px rgba(244,185,66,.3)" },
    ghost: { background: T.surface, color: T.ink, border: `1.5px solid ${T.line}` },
    soft: { background: T.peachSoft, color: T.peach },
    dark: { background: T.ink, color: "#fff" },
  };
  return (
    <button {...p} style={{ ...base, ...kinds[kind], ...style }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}>
      {children}
    </button>
  );
}

function Card({ children, style, hover, onClick, ...p }) {
  return (
    <div {...p} onClick={onClick} className={hover ? "hoverCard" : ""}
      style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 22, ...style }}>
      {children}
    </div>
  );
}

function Pill({ children, tone = T.peach, soft }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 700, color: tone, background: soft || tone + "1A", padding: "5px 12px", borderRadius: 999 }}>{children}</span>;
}

function Avatar({ tone = T.peachSoft, color = T.peach, size = 52, icon: Icon = User }) {
  return <span style={{ width: size, height: size, borderRadius: "50%", background: tone, color, display: "grid", placeItems: "center", flexShrink: 0 }}><Icon size={size * 0.42} /></span>;
}

function Stars({ r }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 13, color: T.ink, fontWeight: 700 }}><Star size={13} fill={T.gold} color={T.gold} /> {r}</span>;
}

function SectionHead({ kicker, title, sub, action }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
      <div>
        {kicker && <span style={{ fontSize: 13, fontWeight: 800, color: T.peach, letterSpacing: 0.5, textTransform: "uppercase" }}>{kicker}</span>}
        <h2 style={{ fontSize: 28, margin: "6px 0 0", color: T.ink, fontWeight: 800, letterSpacing: -0.5 }}>{title}</h2>
        {sub && <p style={{ margin: "8px 0 0", color: T.sub, fontSize: 15, maxWidth: 520 }}>{sub}</p>}
      </div>
      {action}
    </div>
  );
}

function StatCard({ icon: Icon, tone, soft, n, l }) {
  return (
    <Card style={{ padding: 22 }}>
      <span style={{ width: 46, height: 46, borderRadius: 14, background: soft, color: tone, display: "grid", placeItems: "center" }}><Icon size={22} /></span>
      <div style={{ fontSize: 28, fontWeight: 800, color: T.ink, marginTop: 14 }}>{n}</div>
      <div style={{ color: T.sub, fontSize: 13.5, marginTop: 2 }}>{l}</div>
    </Card>
  );
}

function PageTitle({ title, sub, action }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 14, marginBottom: 26 }}>
      <div><h1 style={{ fontSize: 26, fontWeight: 800, color: T.ink, margin: 0, letterSpacing: -0.5 }}>{title}</h1>{sub && <p style={{ color: T.sub, fontSize: 14.5, margin: "6px 0 0" }}>{sub}</p>}</div>
      {action}
    </div>
  );
}

const FormField = ({ label, children }) => <label style={{ display: "block" }}><span style={{ fontSize: 13.5, color: T.sub, fontWeight: 600, display: "block", marginBottom: 7 }}>{label}</span>{children}</label>;
const input = { width: "100%", boxSizing: "border-box", padding: "13px 16px", borderRadius: 13, border: `1.5px solid ${T.line}`, fontSize: 15, outline: "none", fontFamily: "inherit", color: T.ink, background: T.surface };
const pickRow = { display: "flex", alignItems: "center", gap: 14, background: T.surface, border: `1.5px solid ${T.line}`, borderRadius: 16, padding: 14, cursor: "pointer", width: "100%", transition: "all .15s" };

// bell (tùy chọn): { count, panel } — chuông thông báo có badge số + bảng thả xuống
// khi bấm (dùng ở cổng bác sĩ cho danh sách bệnh nhân hẹn tái khám).
function PortalShell({ role, tone, soft, name, sub, items, tab, setTab, bell, children }) {
  const { go } = useNav();
  const [open, setOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex" }}>
      {/* Sidebar */}
      <aside className={"sidebar" + (open ? " sidebarOpen" : "")} style={{ width: 256, background: T.surface, borderRight: `1px solid ${T.line}`, padding: "22px 16px", display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh" }}>
        <button onClick={() => go("home")} style={{ display: "flex", alignItems: "center", gap: 11, background: "none", border: "none", cursor: "pointer", marginBottom: 28, padding: "0 6px" }}>
          <span style={{ width: 38, height: 38, borderRadius: 13, background: `linear-gradient(135deg, ${T.peach}, ${T.lav})`, display: "grid", placeItems: "center" }}><Heart size={18} fill="#fff" color="#fff" /></span>
          <span style={{ textAlign: "left", lineHeight: 1.15 }}><b style={{ color: T.ink, fontSize: 14.5 }}>Phụ sản HP</b><br /><small style={{ color: tone, fontSize: 10.5, fontWeight: 700, letterSpacing: 1 }}>{sub.toUpperCase()}</small></span>
        </button>
        <nav style={{ display: "grid", gap: 4, flex: 1 }}>
          {items.map((it) => {
            const on = tab === it.id;
            return (
              <button key={it.id} onClick={() => { setTab(it.id); setOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 14, border: "none", cursor: "pointer", fontSize: 14.5, fontWeight: 700, textAlign: "left", background: on ? soft : "transparent", color: on ? tone : T.sub, transition: "all .15s" }}>
                <it.icon size={19} /> {it.label}
              </button>
            );
          })}
        </nav>
        <div style={{ borderTop: `1px solid ${T.line}`, paddingTop: 14, marginTop: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "0 6px 12px" }}>
            <Avatar size={40} tone={soft} color={tone} icon={role === "admin" ? Shield : role === "doctor" ? Stethoscope : User} />
            <div style={{ overflow: "hidden" }}><div style={{ fontWeight: 800, color: T.ink, fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div><div style={{ fontSize: 12, color: T.sub }}>{sub}</div></div>
          </div>
          <button onClick={() => { store.clear(); go("home"); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 12, border: "none", background: "transparent", color: T.sub, fontSize: 14, fontWeight: 700, cursor: "pointer", width: "100%" }}><LogOut size={18} /> Đăng xuất</button>
        </div>
      </aside>
      {open && <div onClick={() => setOpen(false)} className="overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.3)", zIndex: 45, display: "none" }} />}

      {/* Main */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <header style={{ height: 66, borderBottom: `1px solid ${T.line}`, background: "rgba(255,255,255,.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 26px", position: "sticky", top: 0, zIndex: 30 }}>
          <button className="hamb" onClick={() => setOpen(true)} style={{ display: "none", background: "none", border: "none", cursor: "pointer" }}><Menu size={22} color={T.ink} /></button>
          <div style={{ position: "relative", flex: 1, maxWidth: 380 }} className="searchWrap">
            <Search size={17} color={T.sub} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
            <input placeholder="Tìm kiếm..." style={{ width: "100%", boxSizing: "border-box", padding: "10px 14px 10px 40px", borderRadius: 12, border: `1px solid ${T.line}`, background: T.bg, fontSize: 14, outline: "none", fontFamily: "inherit" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ position: "relative" }}>
              <button onClick={bell ? () => setBellOpen((o) => !o) : undefined} aria-label="Thông báo"
                style={{ position: "relative", background: bellOpen ? soft : T.bg, border: `1px solid ${T.line}`, borderRadius: 12, padding: 9, cursor: "pointer" }}>
                <Bell size={18} color={T.ink} />
                {bell && bell.count > 0 ? (
                  <span style={{ position: "absolute", top: -6, right: -6, minWidth: 18, height: 18, borderRadius: 9, background: T.peach, color: "#fff", fontSize: 11, fontWeight: 800, display: "grid", placeItems: "center", padding: "0 4px", border: "2px solid #fff", boxSizing: "border-box" }}>{bell.count}</span>
                ) : !bell ? (
                  <span style={{ position: "absolute", top: 6, right: 7, width: 8, height: 8, borderRadius: "50%", background: T.peach, border: "2px solid #fff" }} />
                ) : null}
              </button>
              {bell && bellOpen && (
                <div style={{ position: "absolute", right: 0, top: "calc(100% + 10px)", width: 360, maxHeight: 420, overflowY: "auto", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, boxShadow: "0 12px 32px rgba(45,58,78,.14)", zIndex: 60 }}>
                  {bell.panel}
                </div>
              )}
            </div>
            <Avatar size={38} tone={soft} color={tone} icon={role === "admin" ? Shield : role === "doctor" ? Stethoscope : User} />
          </div>
        </header>
        <main style={{ padding: "30px 26px 50px", flex: 1, maxWidth: 1080, width: "100%" }}>{children}</main>
      </div>
    </div>
  );
}

// Tin tức mẫu — dùng ở trang public (App.jsx) và trang quản trị nội dung (AdminPortal.jsx)
const NEWS = [
  { id: 1, tag: "Cẩm nang", title: "10 dấu hiệu chuyển dạ mẹ bầu cần biết", date: "24/06/2026", read: 5, tone: T.peach },
  { id: 2, tag: "Thông báo", title: "Lịch khám thai theo yêu cầu dịp hè 2026", date: "20/06/2026", read: 3, tone: T.sky },
  { id: 3, tag: "Dinh dưỡng", title: "Chế độ ăn cho mẹ trong tam cá nguyệt đầu", date: "18/06/2026", read: 7, tone: T.mint },
  { id: 4, tag: "Hiếm muộn", title: "Hành trình IVF: những điều nên chuẩn bị", date: "15/06/2026", read: 8, tone: T.lav },
];

// ============================================================================
//  THÔNG BÁO — hook + panel dùng chung cho chuông ở mọi cổng (bác sĩ, admin...).
//  Nguồn: GET /notifications (chỉ thông báo của tài khoản đang đăng nhập).
// ============================================================================
function useThongBao(live) {
  const [list, setList] = useState([]);
  const load = () => {
    if (!live) return;
    api.notifications().then((r) => setList(Array.isArray(r) ? r : [])).catch(() => {});
  };
  useEffect(load, [live]);
  const chuaDoc = list.filter((t) => !t.da_doc).length;
  const docTatCa = () => api.readAllNotifications().then(load).catch(() => {});
  return { list, chuaDoc, load, docTatCa };
}

function ThongBaoPanel({ list, docTatCa, onMo }) {
  const fmt = (t) => { const d = new Date(t); return isNaN(d) ? "" : d.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); };
  return (
    <div>
      <div style={{ padding: "13px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <span style={{ fontWeight: 800, color: T.ink, fontSize: 14 }}>Thông báo ({list.length})</span>
        {list.some((t) => !t.da_doc) && <Btn kind="ghost" size="sm" onClick={docTatCa}>Đánh dấu đã đọc</Btn>}
      </div>
      {list.length === 0 ? (
        <div style={{ padding: "8px 16px 20px", textAlign: "center", color: T.sub, fontSize: 13.5 }}>Chưa có thông báo nào.</div>
      ) : list.map((t) => (
        <div key={t.id} onClick={onMo ? () => onMo(t) : undefined}
          style={{ padding: "11px 16px", borderTop: `1px solid ${T.line}`, background: t.da_doc ? "transparent" : T.goldSoft, cursor: onMo ? "pointer" : "default" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
            <span style={{ fontWeight: 700, color: T.ink, fontSize: 13.5 }}>{t.tieu_de}</span>
            <span style={{ fontSize: 11.5, color: T.sub, whiteSpace: "nowrap" }}>{fmt(t.thoi_gian)}</span>
          </div>
          {t.noi_dung && <div style={{ fontSize: 12.5, color: T.sub, marginTop: 3 }}>{t.noi_dung}</div>}
        </div>
      ))}
    </div>
  );
}

export {
  T, store, api, Nav, useNav,
  Btn, Card, Pill, Avatar, Stars, SectionHead, StatCard, PageTitle,
  FormField, input, pickRow, PortalShell, NEWS,
  useThongBao, ThongBaoPanel,
};
