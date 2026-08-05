# CLAUDE.md

<!--
Ghi chú cho người bảo trì: giữ file này dưới ~200 dòng và cập nhật mỗi khi kiến trúc
hoặc lệnh chạy thay đổi. File này được nạp vào ngữ cảnh khởi động của Claude.
-->

## Project

- Product: Hệ thống quản lý khám chữa bệnh của BV Phụ sản Hải Phòng (đồ án tốt nghiệp) — trang công khai giới thiệu + đăng ký khám online, và hệ thống nội bộ cho nhân viên.
- Repo: hai thư mục độc lập, mỗi bên có `package.json` riêng — `backend/` (API) và `frontend/` (web). Không phải monorepo.
- Backend: NestJS 10 + TypeORM + PostgreSQL, TypeScript strict.
- Frontend: React 18 + Vite 5, **JSX thuần (không TypeScript)**.
- Package manager: npm (không dùng pnpm/yarn).
- Database: PostgreSQL — DB phát triển `bv_phusan` tại localhost:5432; DB kiểm thử riêng `bv_phusan_test` do test tự tạo.
- ORM: TypeORM; entity tập trung ở `backend/src/entities.ts`, đăng ký ở `backend/src/data-source.config.ts`.
- Schema: **chỉ đổi qua migration** (`backend/src/migrations/`). `synchronize` mặc định TẮT, chỉ bật khi `DB_SYNC=true`.
- Dữ liệu lưu: tài khoản, hồ sơ bệnh nhân, lịch hẹn/lần khám, phiếu khám, y lệnh viện phí, danh mục thuốc, danh mục vật tư tiêu hao, tồn kho + nhật ký kho, yêu cầu nhập viện + đợt nội trú + danh mục giường, phiếu ra viện, hồ sơ IVF, đăng ký khám online, tài liệu bệnh án, nhật ký hoạt động.
- Authentication: JWT (hạn 7 ngày) + bcrypt; phân quyền vai trò qua `RolesGuard`.
- Vai trò dùng thật: `le_tan`, `bac_si`, `admin`. Enum còn `benh_nhan` và dữ liệu lịch sử, nhưng **không còn cổng bệnh nhân** trên giao diện.
- Trợ lý ảo: model chạy nội bộ qua LM Studio (mặc định); `CHAT_PROVIDER=claude` để chuyển sang Claude API.
- Deployment: chạy cục bộ, chưa triển khai production.
- Ngôn ngữ UI, comment, thông báo lỗi: **tiếng Việt**.
- Ưu tiên hiện tại: correctness, security, maintainability, minimal changes.

## Commands

Chỉ dùng lệnh có thật dưới đây, chạy trong đúng thư mục.

**backend/**

- Install `npm install` · Dev `npm run start:dev` (cổng 3000) · Build `npm run build`
- Type check `npx tsc --noEmit -p tsconfig.json` (không có script `typecheck`)
- Test e2e (chạy thật với DB) `npm test`
- Migration: `npm run migration:generate -- src/migrations/TenThayDoi` · `npm run migration:run` · `npm run migration:revert` · `npm run migration:show`
- Dữ liệu: `npm run seed` · `npm run provision:bacsi` · `npm run seed:vat-tu` (nạp danh mục vật tư tiêu hao, idempotent) · `npm run seed:kho` (nạp danh mục thuốc + mở thẻ kho cho tủ thuốc/tủ vật tư, idempotent, không bao giờ ghi đè số tồn) · `npm run seed:giuong` (mở phòng/giường nội trú cho mọi khoa, idempotent, không đụng giường đang có người bệnh)

**frontend/**

- Install `npm install` · Dev `npm run dev` (cổng 5173) · Build `npm run build` · Preview `npm run preview`

**Không bên nào có script `lint`.** Đừng gọi `pnpm`, `yarn`, `npm run lint`, `npm run typecheck` — không tồn tại.

## Kiến trúc cần biết trước khi sửa

**Backend**

- Mỗi nghiệp vụ là MỘT file `*.module.ts` chứa cả service `@Injectable()` lẫn `@Controller('api')`; đăng ký thủ công trong `app.module.ts` (mảng `controllers` + `providers`).
- Thêm entity: khai báo ở `entities.ts` → thêm vào import **và** mảng `ENTITIES` ở `data-source.config.ts` → sinh migration. `TypeOrmModule.forFeature(ENTITIES)` là global nên module nào cũng inject repository được.
- JWT payload `{ sub, vai_tro, ho_ten }` → `req.user = { id, vai_tro, ho_ten }`.
- Guard đặt trên TỪNG route: `@UseGuards(JwtAuthGuard, RolesGuard) @Roles(...)`. Route công khai không gắn guard (`GET /api/departments`, `POST /api/public/dang-ky-kham`).
- `RolesGuard` trả **401** khi sai vai trò (quy ước sẵn có của dự án, không phải 403).
- Phạm vi dữ liệu bác sĩ: luôn dùng `phamViBacSi()` ở `src/pham-vi-bac-si.ts`. Tài khoản vai trò bác sĩ chưa gắn hồ sơ `BacSi` bị **từ chối**, không được rơi vào nhánh "xem toàn bộ".
- Bảo mật vận hành: `helmet`, CORS theo whitelist (`CORS_ORIGINS`), rate limit (`@nestjs/throttler`) trên `POST /api/auth/login` và `POST /api/public/dang-ky-kham`.
- Biến môi trường đọc qua `src/env.ts`; `JWT_SECRET` không có mặc định — thiếu thì app dừng ngay khi khởi động.
- Ghi `NhatKyHoatDong` và `guiThongBao()` phải nằm TRONG transaction của nghiệp vụ.

**Frontend**

- Điều hướng bằng state trong `App.jsx` (không có router): `TrangQuangBa.jsx` (công khai) → `StaffLanding` → đăng nhập → `ReceptionPortal` / `DoctorPortal` / `AdminPortal`.
- `shared.jsx` là hạ tầng chung: token màu `T`, component (`Btn`, `Card`, `Pill`, `PortalShell`…), `store` (token giữ trong bộ nhớ, không localStorage), context `useNav`, và **toàn bộ hàm gọi API trong object `api`** — thêm endpoint mới thì thêm ở đây.
- Style là inline style theo token `T`; không có CSS framework.
- Popup theo mẫu overlay `position:fixed; inset:0` + `Card` chặn `stopPropagation` (xem `y_lenh.jsx`, `ravien.jsx`).

## Source of Truth

1. Yêu cầu hiện tại của người dùng. 2. Code và test gần nơi sửa nhất. 3. Cấu hình, entity, migration. 4. File này. 5. Quy ước framework.

Không đoán phiên bản thư viện, tên biến môi trường, hợp đồng API, trường database hay đường dẫn khi có thể kiểm chứng tại chỗ.

## Token and Context Discipline

- Làm thay đổi nhỏ nhất mà vẫn xong việc; tận dụng ngữ cảnh đã có, không đọc lại file vô cớ.
- Tìm hẹp bằng `rg`/glob trước khi mở file; chỉ đọc phần cần dùng.
- Không quét toàn repo theo mặc định; không đọc `node_modules/`, `dist/`, lockfile, tệp sinh tự động, media.
- Giới hạn output shell; dừng đọc log ở nguyên nhân gốc đầu tiên.
- Không dán lại code không đổi, file đầy đủ hay output dài.
- Sửa đơn giản thì sửa thẳng; chỉ nêu kế hoạch ngắn khi việc phức tạp, rủi ro, mơ hồ hoặc chạm kiến trúc.
- Chỉ hỏi khi câu trả lời làm thay đổi tính đúng đắn; còn lại nêu giả định ngắn rồi làm tiếp.

## Change Boundaries

- Không mở rộng phạm vi, không refactor tiện tay, không format file không liên quan.
- Giữ nguyên hành vi và hợp đồng công khai trừ khi yêu cầu đòi đổi.
- Theo mẫu sẵn có xung quanh trước khi tạo abstraction mới.
- Không thêm dependency khi stack hiện tại giải quyết được.
- Diff gọn, dễ review.
- Không deploy, publish, push, reset database, xóa dữ liệu, xoay secret hay chạy lệnh phá hủy khi chưa được cho phép rõ ràng.

## Implementation Standards

**General** — Code rõ ràng hơn code "khôn ngoan". Tên mô tả đúng việc, hàm nhỏ một trách nhiệm. Comment giải thích **vì sao** và ràng buộc, không giải thích cú pháp. Xóa code chết do thay đổi tạo ra. Không để implementation giả, fallback im lặng hay trạng thái "thành công" giả. Chỉ thêm `TODO` khi người dùng chấp nhận phần việc dang dở.

**TypeScript (backend)** — Giữ strict typing; tránh `any`, ép kiểu không an toàn, `!`, `@ts-ignore`. Nếu buộc phải dùng thì thu hẹp phạm vi và ghi lý do trong code. Validate tại biên tin cậy, không dựa vào kiểu TypeScript ở runtime.

**Web và API** — Coi mọi dữ liệu client, tham số URL, header, cookie, phản hồi bên ngoài là KHÔNG tin cậy. Validate và trả mã HTTP có chủ đích. Kiểm tra quyền và quyền sở hữu ở phía server. Trả shape phản hồi tối thiểu, ổn định; không lộ stack trace. Giữ secret ngoài bundle client. Giữ khả năng tiếp cận (HTML ngữ nghĩa, nhãn, bàn phím). Xử lý đủ trạng thái loading / rỗng / thành công / lỗi.

**Database và luồng dữ liệu**

- Dùng lại stack sẵn có; không thêm database, ORM hay client thứ hai.
- Luồng chuẩn: form trên trình duyệt → API route → validate runtime → xác thực/phân quyền → service → TypeORM → PostgreSQL. Trình duyệt không bao giờ nối thẳng tới database.
- Entity và migration đã commit là nguồn chân lý; không suy diễn trường từ nhãn giao diện.
- Validate, chuẩn hóa và whitelist trường được ghi. Không đưa nguyên `body` vào `create/update/insert/upsert`.
- Kiểm tra quyền sở hữu trước khi đọc/sửa/xóa bản ghi được bảo vệ.
- Transaction cho các thao tác ghi phụ thuộc nhau; khóa nghiệp vụ duy nhất hoặc upsert an toàn cho form có thể gửi nhiều lần.
- Chỉ lưu dữ liệu cá nhân cần thiết; không log mật khẩu, token, dữ liệu y tế/thanh toán, chuỗi kết nối.
- Chọn đúng trường cần dùng, phân trang dữ liệu không giới hạn, tránh N+1, chỉ thêm index khi có nhu cầu thật.
- Xử lý có chủ đích: trùng khóa, bản ghi không tồn tại, lỗi khóa ngoại, timeout, mất kết nối.
- **Không sửa migration đã chạy** — tạo migration mới.
- Không chạy reset, drop, truncate, cập nhật/xóa hàng loạt, seed hay migration production khi chưa được cho phép rõ ràng.

**Security** — Không in, commit, lộ hay bịa secret. Không mở hay chép lại giá trị trong `.env`; dùng tên biến theo `.env.example`. Dùng ORM/truy vấn tham số hóa. Không nới lỏng xác thực, phân quyền, validate, CORS, CSRF, rate limit hay nhật ký chỉ để làm biến mất một lỗi. Nêu rõ giả định ảnh hưởng bảo mật trước khi implement.

## Testing

- Test e2e thật ở `backend/test/*.e2e-spec.ts`, chạy trên **database riêng `bv_phusan_test`** (tự tạo bởi `test/global-setup.ts`). Không bao giờ chạy test trên `bv_phusan`.
- `test/helpers.ts` cung cấp `khoiTaoApp`, `lamSachDuLieu` (chốt an toàn: từ chối nếu tên DB không kết thúc bằng `_test`), `taoNenTang`, `taoBenhNhan`, `dangNhap`.
- Đã có test bảo vệ: điều kiện ĐKRV, quy trình IVF, xác nhận tái khám, viện phí/thu tiền, đăng ký khám online, phạm vi dữ liệu bác sĩ, rate limit, xác thực/phân quyền.
- **Sửa quy tắc nghiệp vụ thì phải cập nhật hoặc bổ sung test tương ứng.**

## Validation

- Đổi chữ/style: xem lại giao diện liên quan.
- Đổi logic backend: chạy bộ test liên quan + `npx tsc --noEmit`.
- Đổi quy tắc nghiệp vụ: thêm/sửa test rồi chạy.
- Đổi API/auth/database: kiểm tra lưu trữ, dữ liệu sai, trùng, truy cập trái phép, bản ghi không tồn tại, lỗi database.
- Đổi entity: sinh migration, chạy thử, rồi `npm test`.
- Đổi dependency/config/build: chạy type check và build production.

Không lặp lại lệnh đang lỗi mà không đổi code hoặc giả thuyết. Không tuyên bố một kiểm tra đã pass nếu chưa thực sự chạy.

## Response Format

Dùng cùng ngôn ngữ với người dùng, mặc định ngắn gọn. Với việc đã hoàn thành chỉ báo: `Changed:` (file + hành vi cốt lõi), `Verified:` (lệnh/kiểm tra đã thực sự chạy), `Notes:` (giới hạn thật, giả định, migration, việc cần làm tiếp).

Không nhắc lại yêu cầu, không tường thuật từng tool call, không viết hướng dẫn dài, không dán diff đầy đủ trừ khi được yêu cầu.

## Definition of Done

Hành vi yêu cầu đã implement với diff gọn · đã xử lý biên và ranh giới bảo mật · dữ liệu lưu qua đường server đã validate · kiểm chứng phù hợp đã chạy và pass · không đổi file hay hành vi không liên quan · câu trả lời cuối nói đúng những gì đã và chưa kiểm chứng.
