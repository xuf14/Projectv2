import * as dotenv from 'dotenv';

// ============================================================================
//  BIẾN MÔI TRƯỜNG — nạp .env một lần, sớm nhất có thể.
//  Module này phải được import TRƯỚC mọi module đọc process.env (auth, config
//  database...). dotenv.config() không ghi đè biến đã có sẵn trong môi trường,
//  nên biến truyền từ shell/CI vẫn được ưu tiên.
// ============================================================================
dotenv.config();

// Đọc biến bắt buộc. Thiếu hoặc quá ngắn → dừng ứng dụng ngay khi khởi động
// thay vì chạy tiếp với giá trị mặc định (bí mật lộ trong mã nguồn).
export function bienBatBuoc(ten: string, doDaiToiThieu = 1): string {
  const v = (process.env[ten] ?? '').trim();
  if (!v)
    throw new Error(
      `Thiếu biến môi trường ${ten}. Hãy khai báo trong file .env (xem .env.example) trước khi chạy ứng dụng.`,
    );
  if (v.length < doDaiToiThieu)
    throw new Error(
      `Biến môi trường ${ten} quá ngắn (cần tối thiểu ${doDaiToiThieu} ký tự) — không đủ an toàn.`,
    );
  return v;
}
