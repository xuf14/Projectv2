import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';

// ============================================================================
//  GIỚI HẠN TẦN SUẤT (rate limit) — bảo vệ hai bề mặt tấn công: đăng nhập (dò
//  mật khẩu) và đăng ký khám công khai (gửi phiếu hàng loạt).
//  Bộ test này đặt giới hạn THẤP TRƯỚC khi nạp AppModule (decorator @Throttle
//  đọc biến môi trường lúc định nghĩa class) nên phải require động, không import tĩnh.
// ============================================================================
describe('Giới hạn tần suất route công khai', () => {
  let app: INestApplication;
  let ds: DataSource;
  let http: any;
  let helpers: any;
  let tokenAdmin: string;
  let nen: any;

  beforeAll(async () => {
    process.env.THROTTLE_LOGIN_LIMIT = '3';
    process.env.THROTTLE_DANG_KY_LIMIT = '3';
    helpers = require('./helpers');       // nạp AppModule sau khi đã đặt giới hạn
    ({ app, ds, http } = await helpers.khoiTaoApp());
    await helpers.lamSachDuLieu(ds);
    nen = await helpers.taoNenTang(ds);
    // Lấy token trước khi các test dưới đây dùng hết hạn mức đăng nhập
    tokenAdmin = await helpers.dangNhap(http, 'admin@test.vn');
  });
  afterAll(async () => { await app.close(); });

  it('đăng nhập sai quá số lần cho phép bị chặn 429', async () => {
    const thu = () => request(http).post('/api/auth/login')
      .send({ tai_khoan: 'letan@test.vn', mat_khau: 'sai-mat-khau' });
    // 1 lần đăng nhập đúng đã dùng ở beforeAll → còn 2 lần trong hạn mức 3/phút
    for (let i = 0; i < 2; i++) expect((await thu()).status).toBe(401);
    const res = await thu();
    expect(res.status).toBe(429);   // Too Many Requests
  });

  it('gửi phiếu đăng ký khám quá nhanh bị chặn 429', async () => {
    const gui = (i: number) => request(http).post('/api/public/dang-ky-kham')
      .send({ ho_ten: `Người gửi ${i}`, sdt: `090000000${i}`, khoa_id: nen.khoaSan.id });
    for (let i = 0; i < 3; i++) expect((await gui(i)).status).toBe(201);
    const res = await gui(9);
    expect(res.status).toBe(429);
  });

  it('route nội bộ không bị giới hạn tần suất (màn hình tải nhiều dữ liệu)', async () => {
    for (let i = 0; i < 12; i++) {
      const res = await request(http).get('/api/patients').set('Authorization', `Bearer ${tokenAdmin}`);
      expect(res.status).toBe(200);
    }
  });
});
