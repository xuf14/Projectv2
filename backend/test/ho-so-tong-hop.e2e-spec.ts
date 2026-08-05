import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { khoiTaoApp, lamSachDuLieu, taoNenTang, taoBenhNhan, dangNhap, ngayISO } from './helpers';
import { DichVu, LichHen, TrangThaiLich } from '../src/entities';

// ============================================================================
//  HỒ SƠ TỔNG HỢP CỦA BỆNH NHÂN — nguồn cho cửa sổ hồ sơ (in / lưu PDF).
//  Gom phiếu khám, lịch hẹn, y lệnh viện phí và hóa đơn dịch vụ của ĐÚNG một
//  bệnh nhân; số tổng hợp phải khớp với dữ liệu thật.
// ============================================================================
describe('Hồ sơ tổng hợp của bệnh nhân', () => {
  let app: INestApplication;
  let ds: DataSource;
  let http: any;
  let leTan: string;
  let bacSi: string;
  let bnId: number;
  let bnKhacId: number;

  const tongHop = (token: string, id: number) =>
    request(http).get(`/api/patients/${id}/summary`).set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    ({ app, ds, http } = await khoiTaoApp());
    await lamSachDuLieu(ds);
    const nen = await taoNenTang(ds);
    leTan = await dangNhap(http, 'letan@test.vn');
    bacSi = await dangNhap(http, 'bssan@test.vn');

    const bn = await taoBenhNhan(ds, 'BN hồ sơ tổng hợp');
    const bnKhac = await taoBenhNhan(ds, 'BN không liên quan');
    bnId = bn.id; bnKhacId = bnKhac.id;

    // Lịch khám hôm nay + phiếu khám gắn hồ sơ
    const lich = await request(http).post('/api/reception/new-exam').set('Authorization', `Bearer ${leTan}`)
      .send({ ho_so_id: bnId, bac_si_id: nen.bsSan.id, ngay: ngayISO(0), gio: '08:00' });
    expect(lich.status).toBe(201);
    const pk = await request(http).post('/api/reception/exam-sheets').set('Authorization', `Bearer ${leTan}`)
      .send({ ten_bn: bn.ho_ten, ho_so_id: bnId, chuyen_khoa: 'Khoa Sản', chan_doan_so_bo: 'Thai 24 tuần' });
    expect(pk.status).toBe(201);

    // Y lệnh viện phí: 2 dòng, nộp trước một phần
    const yl = await request(http).post('/api/reception/y-lenh').set('Authorization', `Bearer ${leTan}`)
      .send({
        phieu_kham_id: pk.body.id, da_nop: 100000,
        chi_tiet: [
          { loai: 'vat_tu', ten: 'Bơm tiêm', so_luong: 2, don_gia: 3000 },
          { loai: 'thuoc', ten: 'Ferrous sulfate', so_luong: 30, don_gia: 8000 },
        ],
      });
    expect(yl.status).toBe(201);

    // Hóa đơn dịch vụ cho lịch hẹn đã khám, rồi thu tiền
    const dv = await ds.getRepository(DichVu).save(
      ds.getRepository(DichVu).create({ ten_dich_vu: 'Siêu âm 4D', gia: 350000, khoa: nen.khoaSan }),
    );
    await ds.getRepository(LichHen).update(lich.body.id, { trang_thai: TrangThaiLich.DA_KHAM });
    const hd = await request(http).post(`/api/reception/appointments/${lich.body.id}/payment`)
      .set('Authorization', `Bearer ${leTan}`).send({ items: [{ dich_vu_id: dv.id, so_luong: 1 }] });
    expect(hd.status).toBe(201);
    expect((await request(http).post(`/api/payments/${hd.body.id}/pay`).set('Authorization', `Bearer ${leTan}`)).status).toBe(201);
  });
  afterAll(async () => { await app.close(); });

  it('gom đủ phiếu khám, lịch hẹn, y lệnh và thanh toán của bệnh nhân', async () => {
    const res = await tongHop(leTan, bnId);
    expect(res.status).toBe(200);
    const b = res.body;
    expect(b.ho_so.ho_ten).toBe('BN hồ sơ tổng hợp');
    expect(b.phieu_kham).toHaveLength(1);
    expect(b.phieu_kham[0].chan_doan_so_bo).toBe('Thai 24 tuần');
    expect(b.lich_hen).toHaveLength(1);
    expect(b.lich_hen[0].bac_si).toBe('BS Sản Test');
    expect(b.y_lenh).toHaveLength(1);
    expect(b.y_lenh[0].chi_tiet).toHaveLength(2);
    expect(b.thanh_toan).toHaveLength(1);
    expect(b.thanh_toan[0].chi_tiet[0].ten_dich_vu).toBe('Siêu âm 4D');
  });

  it('số tổng hợp khớp dữ liệu thật', async () => {
    const th = (await tongHop(leTan, bnId)).body.tong_hop;
    // Viện phí = 2×3000 + 30×8000 = 246.000đ, đã nộp 100.000đ → còn nợ 146.000đ
    expect(th.tong_vien_phi).toBe(246000);
    expect(th.da_nop_vien_phi).toBe(100000);
    expect(th.con_no_vien_phi).toBe(146000);
    expect(th.hoa_don_da_thu).toBe(350000);
    expect(th.hoa_don_cho_thu).toBe(0);
    expect(th.so_lich_hen).toBe(1);
    expect(th.so_lan_da_kham).toBe(1);
    expect(th.so_phieu_kham).toBe(1);
  });

  it('không trộn dữ liệu của bệnh nhân khác', async () => {
    const b = (await tongHop(leTan, bnKhacId)).body;
    expect(b.ho_so.ho_ten).toBe('BN không liên quan');
    expect(b.phieu_kham).toEqual([]);
    expect(b.lich_hen).toEqual([]);
    expect(b.y_lenh).toEqual([]);
    expect(b.thanh_toan).toEqual([]);
    expect(b.tong_hop.tong_vien_phi).toBe(0);
  });

  it('bác sĩ xem được, hồ sơ không tồn tại trả 404, chưa đăng nhập trả 401', async () => {
    expect((await tongHop(bacSi, bnId)).status).toBe(200);
    expect((await tongHop(leTan, 999999)).status).toBe(404);
    expect((await request(http).get(`/api/patients/${bnId}/summary`)).status).toBe(401);
  });
});
