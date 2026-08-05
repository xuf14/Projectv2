import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { NguoiDung, KhoaPhong, BacSi, HoSoBenhNhan, VaiTro } from '../src/entities';

// ============================================================================
//  Tiện ích dùng chung cho e2e: khởi tạo app thật (guard, pipe, DB như production),
//  làm sạch dữ liệu và tạo bộ dữ liệu nền tối thiểu.
//  Mọi thao tác chỉ chạy trên database test (tên phải kết thúc bằng "_test").
// ============================================================================

export const MAT_KHAU = 'test123456';

export async function khoiTaoApp() {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = mod.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  const ds = app.get(DataSource);
  return { app, ds, http: app.getHttpServer() };
}

// Xóa sạch dữ liệu giữa các bộ test. Chốt an toàn: từ chối nếu không phải DB test.
export async function lamSachDuLieu(ds: DataSource) {
  const ten = ds.options.database as string;
  if (!/_test$/.test(ten)) throw new Error(`Từ chối xóa dữ liệu: "${ten}" không phải database test`);
  const bang = ds.entityMetadatas.map((m) => `"${m.tableName}"`).join(', ');
  await ds.query(`TRUNCATE ${bang} RESTART IDENTITY CASCADE`);
}

// Dữ liệu nền: 2 khoa, 2 bác sĩ (có tài khoản), tài khoản lễ tân + admin.
export async function taoNenTang(ds: DataSource) {
  const hash = await bcrypt.hash(MAT_KHAU, 4); // vòng lặp thấp cho test chạy nhanh
  const users = ds.getRepository(NguoiDung);
  const taiKhoan = async (ho_ten: string, email: string, vai_tro: VaiTro) =>
    users.save(users.create({ ho_ten, email, mat_khau_hash: hash, vai_tro }));

  const admin = await taiKhoan('Quản trị Test', 'admin@test.vn', VaiTro.ADMIN);
  const leTan = await taiKhoan('Lễ tân Test', 'letan@test.vn', VaiTro.LE_TAN);
  const uBsSan = await taiKhoan('BS Sản Test', 'bssan@test.vn', VaiTro.BAC_SI);
  const uBsIvf = await taiKhoan('BS IVF Test', 'bsivf@test.vn', VaiTro.BAC_SI);

  const khoas = ds.getRepository(KhoaPhong);
  const khoaSan = await khoas.save(khoas.create({ ten_khoa: 'Khoa Sản', ma: 'SAN' }));
  const khoaIvf = await khoas.save(khoas.create({ ten_khoa: 'Khoa Hỗ trợ sinh sản', ma: 'IVF' }));

  const bacSis = ds.getRepository(BacSi);
  const bsSan = await bacSis.save(bacSis.create({ ho_ten: 'BS Sản Test', khoa: khoaSan, nguoi_dung: uBsSan }));
  const bsIvf = await bacSis.save(bacSis.create({ ho_ten: 'BS IVF Test', khoa: khoaIvf, nguoi_dung: uBsIvf }));

  return { admin, leTan, uBsSan, uBsIvf, khoaSan, khoaIvf, bsSan, bsIvf };
}

export async function taoBenhNhan(ds: DataSource, ho_ten = 'Nguyễn Thị Test') {
  const repo = ds.getRepository(HoSoBenhNhan);
  return repo.save(repo.create({
    ma_benh_nhan: 'BN' + Math.random().toString().slice(2, 10),
    ho_ten, gioi_tinh: 'Nữ', sdt: '09' + Math.random().toString().slice(2, 10),
  }));
}

// Đăng nhập qua API thật (không tự ký token) để test luôn cả luồng xác thực.
export async function dangNhap(http: any, email: string): Promise<string> {
  const request = require('supertest');
  const res = await request(http).post('/api/auth/login').send({ tai_khoan: email, mat_khau: MAT_KHAU });
  if (!res.body?.access_token) throw new Error(`Đăng nhập thất bại cho ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.access_token;
}

export const ngayISO = (lech = 0) =>
  new Date(Date.now() + lech * 86400000).toLocaleDateString('en-CA');
