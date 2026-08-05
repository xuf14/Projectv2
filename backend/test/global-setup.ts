import './setup-env';   // đặt DB_NAME test trước
import '../src/env';    // rồi mới nạp .env (không ghi đè biến đã đặt) để lấy thông tin kết nối
import { DataSource } from 'typeorm';

// ============================================================================
//  Tạo database test nếu chưa có (chỉ CREATE, không xóa gì của database khác).
//  Kết nối tạm vào database "postgres" để phát lệnh CREATE DATABASE.
// ============================================================================
export default async function globalSetup() {
  const ten = process.env.DB_NAME;
  const quanTri = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || 'postgres',
    database: 'postgres',
  });
  await quanTri.initialize();
  const co = await quanTri.query('SELECT 1 FROM pg_database WHERE datname = $1', [ten]);
  if (co.length === 0) {
    await quanTri.query(`CREATE DATABASE "${ten}"`);
    console.log(`\n[test] Đã tạo database test "${ten}"`);
  }
  await quanTri.destroy();
}
