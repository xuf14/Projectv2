# Backend — Website BV Phụ sản Hải Phòng

API server bằng **NestJS + TypeORM + JWT**, khớp với ERD và frontend React đã thiết kế.
Sử dụng **PostgreSQL** làm cơ sở dữ liệu.

---

## 1. Yêu cầu môi trường
- **Node.js 18+** (khuyến nghị 20+) và npm
- **PostgreSQL 14+** đã cài và đang chạy

### Cài PostgreSQL
- **Windows**: tải bộ cài tại https://www.postgresql.org/download/windows/ → chạy, ghi nhớ mật khẩu bạn đặt cho user `postgres`.
- **macOS**: `brew install postgresql@16 && brew services start postgresql@16`
- **Linux (Ubuntu)**: `sudo apt install postgresql && sudo service postgresql start`

### Tạo database
Mở công cụ dòng lệnh `psql` (hoặc pgAdmin) và tạo database rỗng:
```sql
CREATE DATABASE bv_phusan;
```
> Trên Windows, mở "SQL Shell (psql)" từ Start Menu, đăng nhập rồi gõ lệnh trên.

## 2. Cài đặt & chạy

```bash
cd backend
npm install                 # cài dependencies (gồm driver pg)
cp .env.example .env         # tạo file cấu hình
# → MỞ .env và sửa DB_USER, DB_PASS, DB_NAME cho khớp PostgreSQL của bạn
npm run seed                # tạo bảng + nạp dữ liệu mẫu + 4 tài khoản demo
npm run start:dev           # chạy server tại http://localhost:3000
```

### Cấu hình kết nối trong `.env`
```
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres        # user PostgreSQL của bạn
DB_PASS=postgres        # đổi thành mật khẩu bạn đặt khi cài
DB_NAME=bv_phusan       # tên database đã tạo ở bước trên
DB_SYNC=true            # tự tạo bảng theo entity (dev). Production nên đặt false + dùng migration
```

> Nhờ `DB_SYNC=true`, TypeORM tự tạo toàn bộ bảng theo entity khi khởi động — bạn không cần viết SQL tạo bảng thủ công.

### Tài khoản demo (mật khẩu chung: `123456`)
| Vai trò | Tài khoản |
|---------|-----------|
| Bệnh nhân | `benhnhan@demo.vn` |
| Lễ tân | `letan@demo.vn` |
| Bác sĩ | `bacsi@demo.vn` |
| Admin | `admin@demo.vn` |

---

## 3. Danh sách API chính

| Method | Endpoint | Quyền | Mô tả |
|--------|----------|-------|-------|
| POST | `/api/auth/request-otp` | Công khai | Gửi OTP (demo trả luôn mã) |
| POST | `/api/auth/register` | Công khai | Đăng ký + xác thực OTP |
| POST | `/api/auth/login` | Công khai | Đăng nhập, trả JWT |
| GET | `/api/auth/me` | JWT | Thông tin tài khoản hiện tại |
| GET | `/api/departments` | Công khai | Danh sách khoa phòng |
| GET | `/api/doctors?khoa=` | Công khai | Bác sĩ theo khoa |
| GET | `/api/slots?bacSi=&ngay=` | Công khai | Khung giờ trống |
| GET | `/api/news` | Công khai | Tin tức |
| POST | `/api/appointments` | Bệnh nhân | Đặt lịch khám |
| GET | `/api/appointments/me` | Bệnh nhân | Lịch hẹn của tôi |
| PATCH | `/api/appointments/:id/cancel` | Bệnh nhân | Hủy lịch |
| GET | `/api/reception/lookup/:ma` | Lễ tân | Tra cứu lịch hẹn |
| POST | `/api/reception/checkin/:id` | Lễ tân | Check-in bệnh nhân |
| GET | `/api/queue` | Bác sĩ | Hàng chờ khám |
| POST | `/api/visits/:id/result` | Bác sĩ | Ghi kết quả khám |
| GET | `/api/admin/reports` | Admin | Báo cáo thống kê |

---

## 4. Cách TEST BACKEND

### Cách A — Test tự động (khuyến nghị)
```bash
npm run seed     # cần PostgreSQL đang chạy + đã seed để có tài khoản demo
npm test         # chạy bộ test E2E (Jest + Supertest)
```
Bộ test kiểm tra: danh sách khoa, đăng nhập, chặn sai mật khẩu, JWT, phân quyền RBAC, chặn truy cập không token.
> Lưu ý: bộ test kết nối vào database thật trong `.env`, nên PostgreSQL phải đang chạy và đã `npm run seed`.

### Cách B — Test thủ công bằng file `api.http`
Mở `api.http` trong VS Code (cài extension **REST Client**), bấm *Send Request* lần lượt từng block. Token được tự lưu và tái sử dụng.

### Cách C — Test bằng curl
```bash
# Đăng nhập lấy token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"tai_khoan":"benhnhan@demo.vn","mat_khau":"123456"}'

# Lấy danh sách khoa
curl http://localhost:3000/api/departments

# Gọi API cần quyền (thay <TOKEN>)
curl http://localhost:3000/api/appointments/me -H "Authorization: Bearer <TOKEN>"
```

### Cách D — Test bằng Postman
Import các endpoint ở mục 3. Với API cần đăng nhập: gọi `/api/auth/login` trước, copy `access_token`, đặt vào tab *Authorization → Bearer Token*.

---

## 5. Cách TEST FRONTEND + kết nối Backend

Frontend hiện dùng **dữ liệu mẫu (mock)**. Để kết nối thật:

1. **Chạy frontend** (file `Frontend_BV_PhuSan.jsx`): tạo project React/Vite, đặt component vào `App.jsx`, cài `lucide-react`, chạy `npm run dev` → mở `http://localhost:5173`.
2. **Test giao diện độc lập**: dùng nút tròn góc phải dưới để chuyển 3 vai trò, click thử toàn bộ luồng (đặt lịch, dashboard...). Đây là kiểm thử UI/UX không cần backend.
3. **Nối API thật**: thay các mảng mock (`DEPARTMENTS`, `DOCTORS`...) bằng lời gọi `fetch`:
   ```js
   const res = await fetch('http://localhost:3000/api/departments');
   const departments = await res.json();
   ```
   Với API cần đăng nhập, lưu token sau khi login và gắn header `Authorization: Bearer <token>`.
4. **Kiểm thử end-to-end thủ công**: bật cả backend (cổng 3000) và frontend (cổng 5173), thực hiện luồng: đăng nhập → đặt lịch → (vai trò lễ tân) check-in → (vai trò bác sĩ) ghi kết quả → kiểm tra lịch sử khám.

> CORS đã được bật sẵn ở backend nên frontend gọi trực tiếp được.

---

## 6. Lưu ý & xử lý sự cố PostgreSQL

**Cấu hình kết nối** nằm tập trung tại `src/data-source.config.ts`, đọc từ `.env`. Cả server (`npm run start:dev`) và seed (`npm run seed`) đều dùng chung cấu hình này.

**Production**: đặt `DB_SYNC=false` trong `.env` và dùng migration của TypeORM thay vì `synchronize` để tránh mất dữ liệu khi entity thay đổi.

**Các lỗi thường gặp:**
| Lỗi | Nguyên nhân & cách xử lý |
|-----|--------------------------|
| `ECONNREFUSED ...:5432` | PostgreSQL chưa chạy. Khởi động dịch vụ PostgreSQL. |
| `password authentication failed` | Sai `DB_USER`/`DB_PASS` trong `.env`. |
| `database "bv_phusan" does not exist` | Chưa tạo database. Chạy `CREATE DATABASE bv_phusan;` trong psql. |
| `relation ... does not exist` | Chưa chạy `npm run seed` (seed tạo bảng + dữ liệu). |

---

## 7. Cấu trúc thư mục
```
backend/
├── src/
│   ├── entities.ts            # 10 entity khớp ERD
│   ├── data-source.config.ts  # cấu hình kết nối PostgreSQL (đọc .env)
│   ├── auth.ts                # JWT strategy + RBAC guard
│   ├── auth.module.ts         # đăng ký/đăng nhập/OTP
│   ├── catalog.module.ts      # khoa, bác sĩ, slot, tin tức
│   ├── appointment.module.ts  # đặt lịch, tiếp đón, khám, báo cáo
│   ├── app.module.ts          # gắn tất cả module
│   ├── main.ts                # bootstrap + CORS
│   └── seed.ts                # tạo bảng + nạp dữ liệu mẫu
├── test/app.e2e-spec.ts       # bộ test E2E
├── api.http                   # test nhanh bằng REST Client
├── .env.example               # mẫu cấu hình
└── package.json
```
