# Chạy chương trình — Backend + Frontend + PostgreSQL

## Yêu cầu
- Node.js 18+ · PostgreSQL 14+

## Bước 1 — Tạo database PostgreSQL
Mở psql (hoặc pgAdmin) và chạy:
```sql
CREATE USER bvphusan WITH PASSWORD 'bvphusan123';
CREATE DATABASE bv_phusan OWNER bvphusan;
```
Nếu dùng user/mật khẩu khác → sửa `DATABASE_URL` trong `backend/.env`.

## Bước 2 — Backend (cửa sổ terminal 1)
```
cd backend
npm install
npm run seed        # tạo bảng + dữ liệu mẫu (khoa, bác sĩ, tài khoản demo)
npm run start:dev   # chạy tại http://localhost:3000
```

## Bước 3 — Frontend (cửa sổ terminal 2)
```
cd frontend
npm install
npm run dev         # mở http://localhost:5173
```

## Tài khoản demo (mật khẩu: 123456)
- Bệnh nhân: benhnhan@demo.vn
- Bác sĩ:    bacsi@demo.vn
- Admin:     admin@demo.vn

## Ghi chú
- Backend chạy → mọi thao tác (thêm/xóa bệnh nhân, bệnh án, đặt lịch) lưu vào PostgreSQL.
- Backend KHÔNG chạy → app tự chuyển sang chế độ demo (dữ liệu lưu tạm trên trình duyệt).
- Xóa bệnh nhân sẽ xóa kèm toàn bộ bệnh án & lịch hẹn (ON DELETE CASCADE).
