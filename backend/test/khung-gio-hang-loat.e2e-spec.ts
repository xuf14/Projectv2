import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { khoiTaoApp, lamSachDuLieu, taoNenTang, dangNhap, ngayISO } from './helpers';
import { KhungGio } from '../src/entities';

// ============================================================================
//  TẠO KHUNG GIỜ HÀNG LOẠT — admin sinh khung giờ khám cho nhiều bác sĩ trong
//  nhiều ngày. Chạy lại nhiều lần phải an toàn: khung đã có được bỏ qua, không
//  ghi đè số chỗ hay số lượt đã đặt.
// ============================================================================
describe('Tạo khung giờ hàng loạt', () => {
  let app: INestApplication;
  let ds: DataSource;
  let http: any;
  let admin: string;
  let leTan: string;
  let bsSanId: number;
  let bsIvfId: number;

  const tao = (body: any, token?: string) =>
    request(http).post('/api/admin/slots/bulk').set('Authorization', `Bearer ${token || admin}`).send(body);
  const demKhung = (bacSiId: number, ngay: string) =>
    ds.getRepository(KhungGio).count({ where: { bac_si: { id: bacSiId }, ngay } });

  beforeAll(async () => {
    ({ app, ds, http } = await khoiTaoApp());
    await lamSachDuLieu(ds);
    const nen = await taoNenTang(ds);
    bsSanId = nen.bsSan.id; bsIvfId = nen.bsIvf.id;
    admin = await dangNhap(http, 'admin@test.vn');
    leTan = await dangNhap(http, 'letan@test.vn');
  });
  afterAll(async () => { await app.close(); });

  it('sinh đúng số khung cho từng bác sĩ và từng ngày', async () => {
    const res = await tao({
      bac_si_ids: [bsSanId, bsIvfId], tu: ngayISO(1), den: ngayISO(2),
      gio_bat_dau: '08:00', gio_ket_thuc: '10:00', buoc_phut: 30, so_luong: 4,
    });
    expect(res.status).toBe(201);
    // 08:00, 08:30, 09:00, 09:30 = 4 khung/ngày × 2 ngày × 2 bác sĩ = 16
    expect(res.body.so_khung_moi_ngay).toBe(4);
    expect(res.body.so_ngay).toBe(2);
    expect(res.body.so_bac_si).toBe(2);
    expect(res.body.da_tao).toBe(16);
    expect(await demKhung(bsSanId, ngayISO(1))).toBe(4);
    expect(await demKhung(bsIvfId, ngayISO(2))).toBe(4);

    const khung = await ds.getRepository(KhungGio).findOne({
      where: { bac_si: { id: bsSanId }, ngay: ngayISO(1), gio_bat_dau: '08:00' },
    });
    expect(khung.gio_ket_thuc).toBe('08:30');
    expect(khung.so_luong).toBe(4);
    expect(khung.da_dat).toBe(0);
  });

  it('chạy lại thì bỏ qua khung đã có, không ghi đè số chỗ', async () => {
    // Đổi số chỗ của một khung rồi chạy lại với số chỗ khác
    const repo = ds.getRepository(KhungGio);
    const cu = await repo.findOne({ where: { bac_si: { id: bsSanId }, ngay: ngayISO(1), gio_bat_dau: '08:00' } });
    await repo.update(cu.id, { so_luong: 9, da_dat: 2 });

    const res = await tao({
      bac_si_ids: [bsSanId, bsIvfId], tu: ngayISO(1), den: ngayISO(2),
      gio_bat_dau: '08:00', gio_ket_thuc: '10:00', buoc_phut: 30, so_luong: 4,
    });
    expect(res.status).toBe(201);
    expect(res.body.da_tao).toBe(0);
    expect(res.body.da_bo_qua).toBe(16);

    const sau = await repo.findOneBy({ id: cu.id });
    expect(sau.so_luong).toBe(9);
    expect(sau.da_dat).toBe(2);
  });

  it('bỏ khung trong giờ nghỉ trưa và bỏ qua cuối tuần', async () => {
    // Khoảng 7 ngày liên tiếp luôn chứa đúng 2 ngày cuối tuần
    const res = await tao({
      bac_si_ids: [bsIvfId], tu: ngayISO(10), den: ngayISO(16),
      gio_bat_dau: '11:00', gio_ket_thuc: '14:00', buoc_phut: 60, so_luong: 3,
      nghi_trua_tu: '11:30', nghi_trua_den: '13:30', bo_qua_cuoi_tuan: true,
    });
    expect(res.status).toBe(201);
    // 11:00 (giữ), 12:00 & 13:00 (rơi vào nghỉ trưa) → còn 1 khung/ngày
    expect(res.body.so_khung_moi_ngay).toBe(1);
    expect(res.body.so_ngay).toBe(5);
    expect(res.body.da_tao).toBe(5);
  });

  it('không truyền bác sĩ = áp dụng cho toàn bộ bác sĩ', async () => {
    const res = await tao({
      tu: ngayISO(20), den: ngayISO(20),
      gio_bat_dau: '08:00', gio_ket_thuc: '09:00', buoc_phut: 60, so_luong: 5,
    });
    expect(res.status).toBe(201);
    expect(res.body.so_bac_si).toBe(2);
    expect(res.body.da_tao).toBe(2);
  });

  it('chặn tham số không hợp lệ', async () => {
    const nen = { tu: ngayISO(1), den: ngayISO(2), gio_bat_dau: '08:00', gio_ket_thuc: '10:00' };
    expect((await tao({ ...nen, tu: '01-08-2026' })).status).toBe(400);              // sai định dạng ngày
    expect((await tao({ ...nen, tu: ngayISO(5), den: ngayISO(1) })).status).toBe(400); // đảo ngày
    expect((await tao({ ...nen, gio_bat_dau: '10:00', gio_ket_thuc: '08:00' })).status).toBe(400);
    expect((await tao({ ...nen, buoc_phut: 7 })).status).toBe(400);
    expect((await tao({ ...nen, so_luong: 0 })).status).toBe(400);
    expect((await tao({ ...nen, so_luong: 99 })).status).toBe(400);
    expect((await tao({ ...nen, bac_si_ids: [999999] })).status).toBe(400);
    expect((await tao({ ...nen, tu: ngayISO(-30), den: ngayISO(-20) })).status).toBe(400); // quá khứ
  });

  it('chỉ quản trị viên được tạo hàng loạt', async () => {
    const res = await tao({ tu: ngayISO(1), den: ngayISO(1), gio_bat_dau: '08:00', gio_ket_thuc: '09:00' }, leTan);
    expect([401, 403]).toContain(res.status);
  });
});
