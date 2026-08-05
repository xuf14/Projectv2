import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { khoiTaoApp, lamSachDuLieu, taoNenTang, dangNhap, MAT_KHAU } from './helpers';

// ============================================================================
//  XÁC THỰC & PHÂN QUYỀN — lớp bảo vệ nền của mọi nghiệp vụ còn lại.
// ============================================================================
describe('Xác thực & phân quyền', () => {
  let app: INestApplication;
  let ds: DataSource;
  let http: any;
  let tokenLeTan: string;
  let tokenBacSi: string;

  beforeAll(async () => {
    ({ app, ds, http } = await khoiTaoApp());
    await lamSachDuLieu(ds);
    await taoNenTang(ds);
    tokenLeTan = await dangNhap(http, 'letan@test.vn');
    tokenBacSi = await dangNhap(http, 'bssan@test.vn');
  });
  afterAll(async () => { await app.close(); });

  it('đăng nhập đúng mật khẩu trả về access_token', async () => {
    const res = await request(http).post('/api/auth/login')
      .send({ tai_khoan: 'letan@test.vn', mat_khau: MAT_KHAU });
    expect(res.status).toBe(201);
    expect(typeof res.body.access_token).toBe('string');
  });

  it('sai mật khẩu bị từ chối 401 và không trả token', async () => {
    const res = await request(http).post('/api/auth/login')
      .send({ tai_khoan: 'letan@test.vn', mat_khau: 'sai-mat-khau' });
    expect(res.status).toBe(401);
    expect(res.body.access_token).toBeUndefined();
  });

  it('tài khoản không tồn tại bị từ chối 401', async () => {
    const res = await request(http).post('/api/auth/login')
      .send({ tai_khoan: 'khongcothat@test.vn', mat_khau: MAT_KHAU });
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/me cần JWT hợp lệ và trả đúng vai trò', async () => {
    expect((await request(http).get('/api/auth/me')).status).toBe(401);
    expect((await request(http).get('/api/auth/me').set('Authorization', 'Bearer token-gia')).status).toBe(401);
    const res = await request(http).get('/api/auth/me').set('Authorization', `Bearer ${tokenLeTan}`);
    expect(res.status).toBe(200);
    expect(res.body.vai_tro).toBe('le_tan');
  });

  it('endpoint nội bộ chặn truy cập không token', async () => {
    for (const p of ['/api/patients', '/api/reception/dang-ky-kham', '/api/doctor/upcoming', '/api/admin/reports']) {
      expect((await request(http).get(p)).status).toBe(401);
    }
  });

  it('RBAC: lễ tân không vào được chức năng của bác sĩ và ngược lại', async () => {
    const a = await request(http).get('/api/doctor/upcoming').set('Authorization', `Bearer ${tokenLeTan}`);
    expect([401, 403]).toContain(a.status);
    const b = await request(http).get('/api/reception/dang-ky-kham').set('Authorization', `Bearer ${tokenBacSi}`);
    expect([401, 403]).toContain(b.status);
  });

  it('RBAC: chỉ admin xem được báo cáo', async () => {
    const res = await request(http).get('/api/admin/reports').set('Authorization', `Bearer ${tokenLeTan}`);
    expect([401, 403]).toContain(res.status);
    const admin = await dangNhap(http, 'admin@test.vn');
    expect((await request(http).get('/api/admin/reports').set('Authorization', `Bearer ${admin}`)).status).toBe(200);
  });

  it('danh mục khoa/bác sĩ là công khai (trang đăng ký khám không đăng nhập)', async () => {
    const khoa = await request(http).get('/api/departments');
    expect(khoa.status).toBe(200);
    expect(khoa.body.length).toBeGreaterThan(0);
    expect((await request(http).get('/api/doctors')).status).toBe(200);
  });
});
