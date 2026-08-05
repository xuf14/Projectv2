import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { khoiTaoApp, lamSachDuLieu, taoNenTang, taoBenhNhan, dangNhap, MAT_KHAU, ngayISO } from './helpers';
import { NguoiDung, VaiTro } from '../src/entities';

// ============================================================================
//  PHẠM VI DỮ LIỆU CỦA BÁC SĨ — bác sĩ chỉ thấy bệnh nhân của chính mình, và
//  tài khoản bác sĩ CHƯA gắn hồ sơ bác sĩ phải bị TỪ CHỐI (không được rơi vào
//  nhánh "xem toàn bộ" — đó là lộ dữ liệu bệnh nhân).
// ============================================================================
describe('Phạm vi dữ liệu theo bác sĩ đăng nhập', () => {
  let app: INestApplication;
  let ds: DataSource;
  let http: any;
  let bsSan: string;
  let bsIvf: string;
  let bsChuaGan: string;
  let admin: string;
  let leTan: string;

  const CHI_CUA_BAC_SI = ['/api/queue', '/api/doctor/summary', '/api/doctor/upcoming', '/api/encounters/today'];

  beforeAll(async () => {
    ({ app, ds, http } = await khoiTaoApp());
    await lamSachDuLieu(ds);
    const nen = await taoNenTang(ds);
    leTan = await dangNhap(http, 'letan@test.vn');
    bsSan = await dangNhap(http, 'bssan@test.vn');
    bsIvf = await dangNhap(http, 'bsivf@test.vn');
    admin = await dangNhap(http, 'admin@test.vn');

    // Tài khoản vai trò bác sĩ nhưng CHƯA được gán vào hồ sơ bác sĩ nào
    const users = ds.getRepository(NguoiDung);
    await users.save(users.create({
      ho_ten: 'BS Chưa Gán', email: 'bschuagan@test.vn',
      mat_khau_hash: await bcrypt.hash(MAT_KHAU, 4), vai_tro: VaiTro.BAC_SI,
    }));
    bsChuaGan = await dangNhap(http, 'bschuagan@test.vn');

    // Mỗi bác sĩ một bệnh nhân có lịch khám hôm nay (đã check-in)
    const bnSan = await taoBenhNhan(ds, 'Bệnh nhân của BS Sản');
    const bnIvf = await taoBenhNhan(ds, 'Bệnh nhân của BS IVF');
    for (const [bn, bacSiId] of [[bnSan, nen.bsSan.id], [bnIvf, nen.bsIvf.id]] as any[]) {
      const lich = await request(http).post('/api/reception/new-exam').set('Authorization', `Bearer ${leTan}`)
        .send({ ho_so_id: bn.id, bac_si_id: bacSiId, ngay: ngayISO(0), gio: '08:00' });
      expect(lich.status).toBe(201);
    }
  });
  afterAll(async () => { await app.close(); });

  it('tài khoản bác sĩ chưa gắn hồ sơ bác sĩ bị TỪ CHỐI (không xem được gì)', async () => {
    for (const p of CHI_CUA_BAC_SI) {
      const res = await request(http).get(p).set('Authorization', `Bearer ${bsChuaGan}`);
      expect(res.status).toBe(403);
      expect(res.body.message).toContain('chưa được gắn');
    }
  });

  it('bác sĩ chỉ thấy bệnh nhân của mình trong hàng chờ', async () => {
    const san = await request(http).get('/api/queue').set('Authorization', `Bearer ${bsSan}`);
    expect(san.status).toBe(200);
    expect(san.body.map((l: any) => l.ho_so.ho_ten)).toEqual(['Bệnh nhân của BS Sản']);

    const ivf = await request(http).get('/api/queue').set('Authorization', `Bearer ${bsIvf}`);
    expect(ivf.body.map((l: any) => l.ho_so.ho_ten)).toEqual(['Bệnh nhân của BS IVF']);
  });

  it('số liệu tổng quan đếm riêng cho từng bác sĩ', async () => {
    const san = await request(http).get('/api/doctor/summary').set('Authorization', `Bearer ${bsSan}`);
    expect(san.body.hom_nay).toBe(1);
    expect(san.body.bac_si).toBe('BS Sản Test');
  });

  it('lần khám trong ngày cũng lọc theo bác sĩ', async () => {
    const san = await request(http).get('/api/encounters/today').set('Authorization', `Bearer ${bsSan}`);
    expect(san.status).toBe(200);
    expect(san.body.length).toBe(1);
    expect(san.body[0].benh_nhan).toBe('Bệnh nhân của BS Sản');
    expect(san.body[0].bac_si).toBe('BS Sản Test');
  });

  it('admin và lễ tân vẫn xem được toàn bộ', async () => {
    const ad = await request(http).get('/api/queue').set('Authorization', `Bearer ${admin}`);
    expect(ad.body.length).toBe(2);
    const lt = await request(http).get('/api/encounters/today').set('Authorization', `Bearer ${leTan}`);
    expect(lt.body.length).toBe(2);
  });

  it('bác sĩ không ghi kết quả cho lần khám của bác sĩ khác', async () => {
    const cuaIvf = (await request(http).get('/api/queue').set('Authorization', `Bearer ${bsIvf}`)).body[0];
    const res = await request(http).post(`/api/encounters/${cuaIvf.id}/exam`)
      .set('Authorization', `Bearer ${bsSan}`).send({ ly_do_kham: 'Thử vượt quyền' });
    expect(res.status).toBe(403);
  });
});
