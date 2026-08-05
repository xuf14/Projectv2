# CLAUDE.md — backend

Quy tắc chung của cả dự án nằm ở `../CLAUDE.md` (nạp sẵn cùng file này). Đây chỉ là phần riêng của backend.

## Ngăn xếp

- NestJS 10 + TypeORM + PostgreSQL, TypeScript strict, npm.
- Xác thực JWT (7 ngày) + bcrypt; phân quyền `RolesGuard` theo `le_tan | bac_si | admin`.
- `helmet`, CORS whitelist, rate limit `@nestjs/throttler`.
- Trợ lý ảo: `openai` SDK trỏ tới LM Studio nội bộ (mặc định) hoặc `@anthropic-ai/sdk` khi `CHAT_PROVIDER=claude`.

## Lệnh

- `npm install` · `npm run start:dev` (cổng 3000) · `npm run build`
- Type check: `npx tsc --noEmit -p tsconfig.json` (không có script `typecheck`, cũng không có `lint`)
- Test e2e thật: `npm test`
- Migration: `npm run migration:generate -- src/migrations/TenThayDoi` · `npm run migration:run` · `npm run migration:revert` · `npm run migration:show`
- Dữ liệu mẫu: `npm run seed` · Cấp tài khoản bác sĩ: `npm run provision:bacsi`

## Cấu trúc

- Mỗi nghiệp vụ là MỘT file `src/*.module.ts` chứa cả service `@Injectable()` lẫn `@Controller('api')`. Không tách thư mục theo tầng.
- `src/app.module.ts` — đăng ký thủ công mọi controller và provider.
- `src/entities.ts` — toàn bộ entity. `src/data-source.config.ts` — cấu hình kết nối + mảng `ENTITIES`.
- `src/data-source.ts` — DataSource cho TypeORM CLI (migration). `src/migrations/` — lịch sử schema.
- `src/env.ts` — nạp `.env` và đọc biến bắt buộc. `src/auth.ts` — JwtStrategy, `JwtAuthGuard`, `RolesGuard`, `@Roles`.
- `src/pham-vi-bac-si.ts` — quy tắc phạm vi dữ liệu theo bác sĩ đăng nhập.
- `test/` — e2e thật (`*.e2e-spec.ts`) + `helpers.ts`, `setup-env.ts`, `global-setup.ts`.

## Quy ước khi viết code

- **Thêm entity**: khai báo ở `entities.ts` → thêm vào import **và** mảng `ENTITIES` ở `data-source.config.ts` → `npm run migration:generate` → `npm run migration:run`. `TypeOrmModule.forFeature(ENTITIES)` là global nên module nào cũng inject repository được.
- **Thêm route**: gắn guard trên từng route `@UseGuards(JwtAuthGuard, RolesGuard) @Roles(...)`; route công khai thì không gắn guard nhưng phải validate chặt và cân nhắc rate limit.
- `RolesGuard` trả **401** khi sai vai trò — đây là quy ước sẵn có, test viết theo mã này.
- Dữ liệu vào: tự validate và whitelist từng trường trong service (dự án không dùng DTO class + class-validator); không đưa nguyên `body` vào `create/update`.
- Ghi `NhatKyHoatDong` và gọi `guiThongBao()` bên TRONG `ds.transaction` của nghiệp vụ.
- Lọc dữ liệu theo bác sĩ: luôn dùng `phamViBacSi()`; không tự viết lại `findOne(BacSi, { nguoi_dung: ... })` rồi cho `null` nghĩa là "xem tất cả".
- Quy tắc nghiệp vụ (ĐKRV, IVF, tái khám, viện phí…) phải chốt ở server, kèm test trong `test/`.
- Thông báo lỗi trả về cho người dùng viết bằng **tiếng Việt**, ngắn và nói rõ thiếu gì.
