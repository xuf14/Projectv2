import './env'; // nạp biến từ file .env (một nơi duy nhất)

import {
  NguoiDung, KhoaPhong, BacSi, DichVu, HoSoBenhNhan, KhungGio, LichHen, LuotKham, DonThuoc, TinTuc,
  NhatKyHoatDong, TaiLieuBenhAn, ThanhToan, ChiTietThanhToan, PhieuKhamBenh,
  PhieuYLenh, ChiTietYLenh, DienBienDieuTri, LanThuTienYLenh,
  SinhHieu, KhamLamSang, ChiDinhCLS, KetLuanKham, BaiTruyenThong, AnhTruyenThong, ThongBao, HoSoIVF,
  DangKyKham, PhieuRaVien, VatTuTieuHao, Thuoc, TonKho, NhatKyKho,
  Giuong, YeuCauNhapVien, DotNoiTru,
} from './entities';

export const ENTITIES = [
  NguoiDung, KhoaPhong, BacSi, DichVu, HoSoBenhNhan, KhungGio, LichHen, LuotKham, DonThuoc, TinTuc,
  NhatKyHoatDong, TaiLieuBenhAn, ThanhToan, ChiTietThanhToan, PhieuKhamBenh,
  PhieuYLenh, ChiTietYLenh, DienBienDieuTri, LanThuTienYLenh,
  SinhHieu, KhamLamSang, ChiDinhCLS, KetLuanKham, BaiTruyenThong, AnhTruyenThong, ThongBao, HoSoIVF,
  DangKyKham, PhieuRaVien, VatTuTieuHao, Thuoc, TonKho, NhatKyKho,
  Giuong, YeuCauNhapVien, DotNoiTru,
];

// Cấu hình kết nối PostgreSQL, đọc từ biến môi trường (.env).
// Mặc định phù hợp với cài đặt PostgreSQL cục bộ thông thường.
export const dbConfig = {
  type: 'postgres' as const,
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'postgres',
  database: process.env.DB_NAME || 'bv_phusan',
  entities: ENTITIES,
  // synchronize MẶC ĐỊNH TẮT: schema chỉ thay đổi qua migration (npm run migration:*)
  // để có lịch sử, hoàn tác được và không bao giờ tự sửa bảng trên dữ liệu thật.
  // Chỉ bật (DB_SYNC=true) cho database kiểm thử hoặc khi dựng lại DB trống.
  synchronize: process.env.DB_SYNC === 'true',
  logging: process.env.DB_LOGGING === 'true',
};
