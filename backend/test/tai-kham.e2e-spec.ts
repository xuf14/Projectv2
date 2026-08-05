import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { khoiTaoApp, lamSachDuLieu, taoNenTang, taoBenhNhan, dangNhap, ngayISO } from './helpers';

// ============================================================================
//  TÁI KHÁM — không được xác nhận "đã tái khám" trước ngày hẹn; muốn tái khám
//  sớm thì phải nêu lý do và có xác nhận của chính bác sĩ phụ trách.
// ============================================================================
describe('Xác nhận tái khám', () => {
  let app: INestApplication;
  let ds: DataSource;
  let http: any;
  let leTan: string;
  let bsSan: string;
  let bsIvf: string;
  let ids: { som: number; homNay: number; khac: number };

  const henTaiKham = (hoSoId: number, ngay: string, bacSiId: number) =>
    request(http).patch(`/api/reception/patients/${hoSoId}/revisit`).set('Authorization', `Bearer ${leTan}`)
      .send({ ngay_tai_kham: ngay, bac_si_tai_kham_id: bacSiId });
  const xacNhan = (token: string, hoSoId: number, body: any = {}) =>
    request(http).patch(`/api/doctor/revisits/${hoSoId}/done`).set('Authorization', `Bearer ${token}`).send(body);

  beforeAll(async () => {
    ({ app, ds, http } = await khoiTaoApp());
    await lamSachDuLieu(ds);
    const nen = await taoNenTang(ds);
    leTan = await dangNhap(http, 'letan@test.vn');
    bsSan = await dangNhap(http, 'bssan@test.vn');
    bsIvf = await dangNhap(http, 'bsivf@test.vn');

    const a = await taoBenhNhan(ds, 'Bệnh nhân hẹn tuần sau');
    const b = await taoBenhNhan(ds, 'Bệnh nhân hẹn hôm nay');
    const c = await taoBenhNhan(ds, 'Bệnh nhân của bác sĩ khác');
    ids = { som: a.id, homNay: b.id, khac: c.id };
    await henTaiKham(a.id, ngayISO(7), nen.bsSan.id);
    await henTaiKham(b.id, ngayISO(0), nen.bsSan.id);
    await henTaiKham(c.id, ngayISO(3), nen.bsIvf.id);
  });
  afterAll(async () => { await app.close(); });

  it('lễ tân ghi hẹn tái khám thành công và bác sĩ thấy trong danh sách của mình', async () => {
    const res = await request(http).get('/api/doctor/revisits').set('Authorization', `Bearer ${bsSan}`);
    expect(res.status).toBe(200);
    expect(res.body.map((r: any) => r.ho_so_id).sort()).toEqual([ids.som, ids.homNay].sort());
  });

  it('chặn xác nhận tái khám trước hẹn khi không nêu lý do', async () => {
    const res = await xacNhan(bsSan, ids.som);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('xác nhận');
  });

  it('chặn khi có cờ xác nhận nhưng lý do quá ngắn / bỏ trống', async () => {
    expect((await xacNhan(bsSan, ids.som, { xac_nhan_som: true })).status).toBe(400);
    expect((await xacNhan(bsSan, ids.som, { xac_nhan_som: true, ly_do: 'ho' })).status).toBe(400);
  });

  it('chặn khi có lý do nhưng thiếu xác nhận của bác sĩ', async () => {
    const res = await xacNhan(bsSan, ids.som, { ly_do: 'Bệnh nhân đau bụng nhiều, đến sớm hơn hẹn' });
    expect(res.status).toBe(400);
  });

  it('bác sĩ khác không xác nhận thay được', async () => {
    const res = await xacNhan(bsIvf, ids.som, { xac_nhan_som: true, ly_do: 'Bệnh nhân đau bụng nhiều' });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('bác sĩ khác');
  });

  it('lễ tân không được xác nhận tái khám', async () => {
    const res = await xacNhan(leTan, ids.homNay);
    expect([401, 403]).toContain(res.status);
  });

  it('đủ lý do + xác nhận của bác sĩ phụ trách → chấp nhận, đánh dấu trước hẹn', async () => {
    const res = await xacNhan(bsSan, ids.som, { xac_nhan_som: true, ly_do: 'Bệnh nhân ra huyết bất thường, cần khám sớm' });
    expect(res.status).toBe(200);
    expect(res.body.truoc_han).toBe(true);
    // Nhật ký lưu lại lý do để truy vết
    const log = await ds.query(`SELECT noi_dung FROM nhat_ky_hoat_dong WHERE hanh_dong = 'xac_nhan_tai_kham' ORDER BY id DESC LIMIT 1`);
    expect(log[0].noi_dung).toContain('ra huyết bất thường');
  });

  it('đúng ngày hẹn thì xác nhận bình thường, không cần lý do', async () => {
    const res = await xacNhan(bsSan, ids.homNay);
    expect(res.status).toBe(200);
    expect(res.body.truoc_han).toBe(false);
  });

  it('hẹn đã xác nhận thì không xác nhận lại được', async () => {
    const res = await xacNhan(bsSan, ids.homNay);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('không có hẹn tái khám');
  });

  it('ngày hẹn sai định dạng bị từ chối', async () => {
    const res = await request(http).patch(`/api/reception/patients/${ids.khac}/revisit`)
      .set('Authorization', `Bearer ${leTan}`).send({ ngay_tai_kham: '30-07-2026' });
    expect(res.status).toBe(400);
  });
});
