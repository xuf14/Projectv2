# Website BV Phụ sản Hải Phòng — Bộ tài liệu đồ án tốt nghiệp

Hệ thống web hỗ trợ **quảng bá, đăng ký khám tại các khoa phòng và quản lý bệnh nhân**.

---

## A. Liệt kê chi tiết các hạng mục cần xây dựng

### 1. Phân hệ Cổng thông tin (Portal / quảng bá)
- Trang chủ: hero, giới thiệu, dịch vụ nổi bật, tin tức, thông báo
- Trang giới thiệu bệnh viện, lịch sử, sứ mệnh
- Danh sách & chi tiết **khoa phòng** (Sản, Phụ, IVF, Sơ sinh, Khám theo yêu cầu…)
- Hồ sơ **bác sĩ**: học hàm, chuyên môn, lịch làm việc, đánh giá
- Tin tức / cẩm nang sức khỏe sản phụ khoa
- Bảng giá dịch vụ, trang liên hệ + bản đồ
- Tìm kiếm & bộ lọc theo khoa / bác sĩ / dịch vụ

### 2. Phân hệ Tài khoản & Xác thực
- Đăng ký bằng SĐT/email + xác thực **OTP**
- Đăng nhập / đăng xuất, quên mật khẩu
- Phân quyền theo vai trò **(RBAC)**: Khách, Bệnh nhân, Lễ tân, Bác sĩ, Admin
- Quản lý hồ sơ cá nhân + hồ sơ người thân + thông tin **BHYT**

### 3. Phân hệ Đăng ký khám trực tuyến
- Đặt lịch: chọn khoa → bác sĩ → ngày → khung giờ trống → xác nhận
- Kiểm tra **slot trống theo thời gian thực**
- Quản lý lịch hẹn: xem / đổi / hủy, nhận mã + số thứ tự dự kiến
- Nhắc lịch tự động qua email/SMS

### 4. Phân hệ Tiếp đón & Hàng chờ
- Lễ tân xác nhận lịch hẹn & **check-in** bệnh nhân
- Cấp số thứ tự, bảng hàng chờ theo phòng khám
- Khởi tạo phiếu/hồ sơ lượt khám

### 5. Phân hệ Quản lý bệnh nhân (Bác sĩ)
- Danh sách bệnh nhân chờ khám theo thứ tự
- Ghi nhận kết quả khám: chẩn đoán, chỉ định, ghi chú
- Kê **đơn thuốc điện tử**
- Tra cứu toàn bộ lịch sử khám của bệnh nhân

### 6. Phân hệ Quản trị (Admin)
- CRUD danh mục: khoa phòng, bác sĩ, dịch vụ, khung giờ, bảng giá
- Quản lý người dùng & phân quyền
- Quản lý nội dung: tin tức, banner, trang giới thiệu
- Thống kê & báo cáo: lượt đặt, tỷ lệ đến khám, công suất bác sĩ, doanh thu

### 7. Hạ tầng kỹ thuật xuyên suốt
- Thiết kế CSDL quan hệ (11 bảng chính — xem ERD)
- REST API + JWT, kiến trúc 3 lớp
- Bảo mật: bcrypt, HTTPS, chống XSS/CSRF/SQLi, nhật ký truy cập
- Sao lưu định kỳ, cache (Redis), lưu trữ ảnh/tệp
- Triển khai: Docker + VPS/Cloud, môi trường dev/staging/production

---

## B. Danh sách deliverables (tài liệu thực tế đã tạo)

| # | Tài liệu | File | Nội dung |
|---|----------|------|----------|
| 1 | Đặc tả yêu cầu (SRS) | `01_SRS_DacTaYeuCau.docx` | 23 yêu cầu chức năng, 8 phi chức năng, use case, tiêu chí nghiệm thu |
| 2 | Kế hoạch dự án | `02_KeHoachDuAn.docx` | Lộ trình 16 tuần, 7 giai đoạn, công nghệ, rủi ro, kế hoạch test |
| 3 | Thiết kế hệ thống | `03_ThietKe_KienTruc_CSDL.docx` | Kiến trúc 3 lớp, sơ đồ ERD, từ điển dữ liệu, thiết kế API & bảo mật |
| 4 | Prototype web mẫu | `04_Prototype_Web.jsx` | Demo React tương tác: cổng thông tin + luồng đặt lịch 4 bước |

---

## C. Gợi ý công nghệ triển khai

- **Frontend:** React/Next.js + TailwindCSS
- **Backend:** Node.js (NestJS) hoặc Spring Boot / Laravel
- **CSDL:** PostgreSQL hoặc MySQL · **Cache:** Redis
- **Xác thực:** JWT + OTP (email/SMS)
- **Triển khai:** Docker + VPS/Cloud
- **Công cụ:** Git/GitHub, Figma, Postman, Jira/Trello

> Toàn bộ tài liệu phục vụ mục đích học tập (đồ án tốt nghiệp). Dữ liệu trong prototype là dữ liệu mẫu.
