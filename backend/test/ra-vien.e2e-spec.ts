import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { khoiTaoApp, lamSachDuLieu, taoNenTang, taoBenhNhan, dangNhap } from './helpers';

// ============================================================================
//  ĐIỀU KIỆN ĐĂNG KÝ RA VIỆN (ĐKRV) — ràng buộc nghiệp vụ phức tạp nhất hệ thống.
//  Chỉ được tích ĐKRV khi HỘI ĐỦ: liên kết hồ sơ + tích TTRV + viện phí thu đủ
//  + có y lệnh ra viện của bác sĩ với kết luận an toàn về nhà.
//  Test đi theo đúng thứ tự thực tế: thiếu → bổ sung dần → đủ.
// ============================================================================
describe('Điều kiện Đăng ký ra viện (ĐKRV)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let http: any;
  let leTan: string;
  let bacSi: string;
  let hoSoId: number;
  let phieuKhamId: number;
  let yLenhId: number;

  const dkrv = (body: any) => request(http).post('/api/reception/exam-sheets')
    .set('Authorization', `Bearer ${leTan}`).send(body);
  const dieuKien = () => request(http).get(`/api/reception/discharge-eligibility/${hoSoId}`)
    .set('Authorization', `Bearer ${leTan}`);

  beforeAll(async () => {
    ({ app, ds, http } = await khoiTaoApp());
    await lamSachDuLieu(ds);
    await taoNenTang(ds);
    leTan = await dangNhap(http, 'letan@test.vn');
    bacSi = await dangNhap(http, 'bssan@test.vn');

    const bn = await taoBenhNhan(ds, 'Trần Thị Ra Viện');
    hoSoId = bn.id;
    // Phiếu khám gắn hồ sơ + một phiếu viện phí 500.000đ chưa nộp đồng nào
    const pk = await dkrv({ ten_bn: bn.ho_ten, ho_so_id: hoSoId, chan_doan_so_bo: 'Theo dõi' });
    phieuKhamId = pk.body.id;
    const yl = await request(http).post('/api/reception/y-lenh').set('Authorization', `Bearer ${leTan}`)
      .send({ phieu_kham_id: phieuKhamId, da_nop: 0, chi_tiet: [{ loai: 'dich_vu', ten: 'Giường nội trú', so_luong: 1, don_gia: 500000 }] });
    yLenhId = yl.body.id;
  });
  afterAll(async () => { await app.close(); });

  it('ban đầu: chưa đủ điều kiện — thiếu cả viện phí lẫn y lệnh ra viện', async () => {
    const res = await dieuKien();
    expect(res.status).toBe(200);
    expect(res.body.du_dieu_kien).toBe(false);
    expect(res.body.thanh_toan.xong).toBe(false);
    expect(res.body.thanh_toan.con_lai).toBe(500000);
    expect(res.body.y_lenh_ra_vien.co).toBe(false);
    expect(res.body.thieu.length).toBe(2);
  });

  it('chặn ĐKRV khi chưa liên kết hồ sơ bệnh nhân', async () => {
    const res = await dkrv({ ten_bn: 'Không hồ sơ', dkrv: true, ttrv: true });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('hồ sơ');
  });

  it('chặn ĐKRV khi chưa tích TTRV (chưa thanh toán ra viện)', async () => {
    const res = await dkrv({ ten_bn: 'Trần Thị Ra Viện', ho_so_id: hoSoId, dkrv: true, ttrv: false });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('TTRV');
  });

  it('chặn ĐKRV khi viện phí chưa thu đủ (dù đã tích TTRV)', async () => {
    const res = await dkrv({ ten_bn: 'Trần Thị Ra Viện', ho_so_id: hoSoId, dkrv: true, ttrv: true });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('chưa thu đủ');
  });

  it('thu đủ viện phí vẫn chưa đủ — còn thiếu y lệnh ra viện của bác sĩ', async () => {
    const thu = await request(http).post(`/api/reception/y-lenh/${yLenhId}/thu`)
      .set('Authorization', `Bearer ${leTan}`).send({ so_tien: 500000 });
    expect(thu.status).toBe(201);

    const dk = await dieuKien();
    expect(dk.body.thanh_toan.xong).toBe(true);
    expect(dk.body.du_dieu_kien).toBe(false);
    expect(dk.body.thieu).toEqual([expect.stringContaining('y lệnh ra viện')]);

    const res = await dkrv({ ten_bn: 'Trần Thị Ra Viện', ho_so_id: hoSoId, dkrv: true, ttrv: true });
    expect(res.status).toBe(400);
  });

  it('y lệnh ra viện với kết luận KHÔNG an toàn ("nặng hơn") vẫn bị chặn', async () => {
    const rv = await request(http).post('/api/doctor/ra-vien').set('Authorization', `Bearer ${bacSi}`)
      .send({ ho_so_id: hoSoId, tinh_trang: 'nang_hon', ket_luan_suc_khoe: 'Cần theo dõi tiếp' });
    expect(rv.status).toBe(201);

    const dk = await dieuKien();
    expect(dk.body.y_lenh_ra_vien.co).toBe(true);
    expect(dk.body.y_lenh_ra_vien.an_toan_ve_nha).toBe(false);
    expect(dk.body.du_dieu_kien).toBe(false);

    const res = await dkrv({ ten_bn: 'Trần Thị Ra Viện', ho_so_id: hoSoId, dkrv: true, ttrv: true });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('an toàn');
  });

  it('bác sĩ kết luận hồi phục → đủ điều kiện và ĐKRV được chấp nhận', async () => {
    const rv = await request(http).post('/api/doctor/ra-vien').set('Authorization', `Bearer ${bacSi}`)
      .send({ ho_so_id: hoSoId, tinh_trang: 'hoi_phuc', ket_luan_suc_khoe: 'Sức khỏe ổn định, an toàn về nhà' });
    expect(rv.status).toBe(201);

    const dk = await dieuKien();
    expect(dk.body.du_dieu_kien).toBe(true);
    expect(dk.body.thieu).toEqual([]);

    const res = await dkrv({ ten_bn: 'Trần Thị Ra Viện', ho_so_id: hoSoId, dkrv: true, ttrv: true });
    expect(res.status).toBe(201);
    expect(res.body.dkrv).toBe(true);
  });

  it('hủy y lệnh ra viện thì ĐKRV bị chặn trở lại', async () => {
    const ds1 = await request(http).get('/api/doctor/ra-vien').set('Authorization', `Bearer ${bacSi}`);
    const hieuLuc = ds1.body.find((r: any) => r.trang_thai === 'hieu_luc');
    expect(hieuLuc).toBeDefined();

    const huy = await request(http).patch(`/api/doctor/ra-vien/${hieuLuc.id}/huy`).set('Authorization', `Bearer ${bacSi}`);
    expect(huy.status).toBe(200);

    expect((await dieuKien()).body.du_dieu_kien).toBe(false);
    const res = await dkrv({ ten_bn: 'Trần Thị Ra Viện', ho_so_id: hoSoId, dkrv: true, ttrv: true });
    expect(res.status).toBe(400);
  });

  it('lễ tân không được tự lập y lệnh ra viện (chỉ bác sĩ điều trị)', async () => {
    const res = await request(http).post('/api/doctor/ra-vien').set('Authorization', `Bearer ${leTan}`)
      .send({ ho_so_id: hoSoId, tinh_trang: 'hoi_phuc' });
    expect([401, 403]).toContain(res.status);
  });

  it('tình trạng ra viện ngoài danh mục bị từ chối', async () => {
    const res = await request(http).post('/api/doctor/ra-vien').set('Authorization', `Bearer ${bacSi}`)
      .send({ ho_so_id: hoSoId, tinh_trang: 'tu_nghi_ra_vien' });
    expect(res.status).toBe(400);
  });
});
