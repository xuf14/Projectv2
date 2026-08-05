// ============================================================================
//  Chạy TRƯỚC mọi import của test (jest "setupFiles").
//  Ép toàn bộ test dùng DATABASE RIÊNG bv_phusan_test — không bao giờ chạm vào
//  database phát triển. dotenv.config() trong src/env.ts không ghi đè biến đã có
//  nên các giá trị đặt ở đây luôn thắng .env.
// ============================================================================
process.env.DB_NAME = process.env.TEST_DB_NAME || 'bv_phusan_test';
process.env.DB_SYNC = 'true';   // schema test tự tạo từ entity
process.env.DB_LOGGING = 'false';
process.env.JWT_SECRET = 'test-secret-khong-dung-cho-moi-truong-that';
// Nới giới hạn tần suất cho các bộ test nghiệp vụ (chúng gọi API liên tục).
// Riêng bộ test throttle tự đặt giới hạn thấp trước khi nạp AppModule.
process.env.THROTTLE_LOGIN_LIMIT = process.env.THROTTLE_LOGIN_LIMIT || '1000';
process.env.THROTTLE_DANG_KY_LIMIT = process.env.THROTTLE_DANG_KY_LIMIT || '1000';
