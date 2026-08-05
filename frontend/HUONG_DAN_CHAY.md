# Frontend — Website BV Phụ sản Hải Phòng (đã nối Backend)

Đây là project React đã cắm sẵn giao diện **và kết nối với backend thật**.
Giao diện tự động lấy dữ liệu từ backend (khoa, bác sĩ, đặt lịch, lịch hẹn...).
Nếu backend chưa chạy, giao diện vẫn hoạt động với dữ liệu mẫu (chế độ demo).

---

## Chạy đầy đủ (khuyến nghị): Backend + Frontend

Mở **2 cửa sổ Command Prompt riêng**.

### Cửa sổ 1 — Backend (chạy trước)
```
cd backend
npm install
npm run seed
npm run start:dev
```
Chờ dòng `🚀 Backend chạy tại http://localhost:3000`. Giữ nguyên cửa sổ này.

### Cửa sổ 2 — Frontend
```
cd frontend
npm install
npm run dev
```
Trình duyệt tự mở `http://localhost:5173`. Giao diện sẽ tự kết nối backend.

---

## Bước 1 — Cài Node.js (nếu chưa có)

1. Vào **https://nodejs.org** → tải bản **LTS** (nút xanh bên trái).
2. Chạy file `.msi`, bấm Next đến khi Finish (giữ mặc định).
3. **Đóng hết cửa sổ, mở lại** để máy nhận Node.

Kiểm tra: mở Command Prompt (phím Windows, gõ `cmd`, Enter), gõ `node -v` — hiện số phiên bản là được.

---

## Thử luồng hoàn chỉnh (khi cả 2 đang chạy)

1. **Đăng nhập**: bấm nút tròn hồng góc dưới phải → chọn "Bệnh nhân" → bấm "Điền nhanh" (tự điền tài khoản demo `benhnhan@demo.vn` / `123456`) → Đăng nhập.
2. **Đặt lịch**: bấm "Đặt lịch" → chọn khoa → chọn **một bác sĩ cụ thể** (để thấy khung giờ thật từ backend) → chọn ngày & giờ → điền thông tin → Xác nhận. Lịch được ghi thật vào database.
3. **Xem lịch hẹn**: vào "Lịch hẹn của tôi" — thấy lịch vừa đặt, có thể bấm Hủy.
4. **Vai trò Admin**: đăng xuất → nút tròn → "Quản trị viên" → điền nhanh `admin@demo.vn` → xem Báo cáo có số liệu thật.

> Tài khoản demo (mật khẩu chung `123456`): `benhnhan@demo.vn`, `bacsi@demo.vn`, `admin@demo.vn`.

---

## Lưu ý kỹ thuật

- **Chế độ demo tự động**: nếu backend chưa chạy, frontend hiển thị dữ liệu mẫu để bạn vẫn xem được giao diện. Khi backend chạy, nó tự chuyển sang dữ liệu thật.
- **Đăng nhập bằng số điện thoại** cho bệnh nhân (vd `0912345678`), **email** cho bác sĩ/admin.
- Token đăng nhập lưu trong bộ nhớ — **tải lại trang (F5) sẽ phải đăng nhập lại**. Đây là hành vi bình thường của bản demo.
- Backend cần chạy `npm run seed` một lần để có dữ liệu khoa/bác sĩ/khung giờ.

---

## Lỗi thường gặp

| Lỗi | Cách xử lý |
|-----|-----------|
| `'npm' is not recognized` | Chưa cài Node.js hoặc chưa mở lại cmd. Làm lại Bước 1. |
| Giao diện không có dữ liệu thật | Backend chưa chạy hoặc chưa `npm run seed`. Kiểm tra cửa sổ 1. |
| Không đặt được lịch | Cần đăng nhập trước; và chọn bác sĩ cụ thể (không phải "bất kỳ") để có slot thật. |
| `Port in use` | Đóng cmd cũ đang chiếm cổng, hoặc đổi cổng. |

---

## Cấu trúc thư mục
```
frontend/
├── index.html
├── package.json
├── vite.config.js
└── src/
    ├── main.jsx      # điểm khởi động
    └── App.jsx       # toàn bộ giao diện + lớp gọi API (API_BASE ở đầu file)
```

> Muốn đổi địa chỉ backend? Sửa hằng `API_BASE` ở đầu `src/App.jsx`.

