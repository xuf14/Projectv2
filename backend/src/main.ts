import './env'; // nạp .env trước mọi module đọc biến môi trường
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

// Chỉ những origin được liệt kê mới gọi được API. Mặc định là các cổng dev của
// Vite; môi trường thật khai báo qua CORS_ORIGINS (danh sách ngăn cách dấu phẩy).
const ORIGIN_MAC_DINH = ['http://localhost:5173', 'http://localhost:4173', 'http://127.0.0.1:5173'];

function danhSachOrigin(): string[] {
  const raw = (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return raw.length ? raw : ORIGIN_MAC_DINH;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Header bảo mật cơ bản (X-Frame-Options, nosniff, HSTS...). Tắt CSP mặc định
  // vì API chỉ trả JSON/tệp tải về, không phục vụ HTML.
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  const origins = danhSachOrigin();
  app.enableCors({ origin: origins, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Backend chạy tại http://localhost:${port}`);
  console.log(`   CORS cho phép: ${origins.join(', ')}`);
}
bootstrap();
