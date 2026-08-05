import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { khoiTaoApp, lamSachDuLieu, taoNenTang, taoBenhNhan, dangNhap } from './helpers';

// ============================================================================
//  Y LỆNH VIỆN PHÍ — tiền là dữ liệu nhạy cảm nhất: tổng tiền phải do SERVER tính
//  từ số lượng × đơn giá × tỷ lệ, không tin số client gửi lên; trạng thái thu
//  (chưa nộp / một phần / đã đủ) phải tự suy ra từ số tiền đã thu.
// ============================================================================
describe('Y lệnh viện phí & thu tiền', () => {
  let app: INestApplication;
  let ds: DataSource;
  let http: any;
  let leTan: string;
  let bacSi: string;
  let phieuKhamId: number;

  const taoYLenh = (body: any, token = leTan) =>
    request(http).post('/api/reception/y-lenh').set('Authorization', `Bearer ${token}`).send(body);
  const thu = (id: number, so_tien: number) =>
    request(http).post(`/api/reception/y-lenh/${id}/thu`).set('Authorization', `Bearer ${leTan}`).send({ so_tien });

  beforeAll(async () => {
    ({ app, ds, http } = await khoiTaoApp());
    await lamSachDuLieu(ds);
    await taoNenTang(ds);
    leTan = await dangNhap(http, 'letan@test.vn');
    bacSi = await dangNhap(http, 'bssan@test.vn');
    const bn = await taoBenhNhan(ds, 'Đỗ Thị Viện Phí');
    const pk = await request(http).post('/api/reception/exam-sheets').set('Authorization', `Bearer ${leTan}`)
      .send({ ten_bn: bn.ho_ten, ho_so_id: bn.id });
    phieuKhamId = pk.body.id;
  });
  afterAll(async () => { await app.close(); });

  it('tổng tiền do server tính, bỏ qua tổng tiền client gửi lên', async () => {
    const res = await taoYLenh({
      phieu_kham_id: phieuKhamId, tong_tien: 1, da_nop: 0,
      chi_tiet: [
        { loai: 'thuoc', ten: 'Paracetamol', so_luong: 2, don_gia: 15000 },
        { loai: 'dich_vu', ten: 'Siêu âm', so_luong: 1, don_gia: 200000 },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.body.tong_tien).toBe(230000);
    expect(res.body.trang_thai).toBe('chua_nop');
    expect(res.body.ma_phieu).toMatch(/^YL\d+/);
  });

  it('phiếu y lệnh bắt buộc gắn với phiếu khám của bệnh nhân', async () => {
    const res = await taoYLenh({ chi_tiet: [{ loai: 'thuoc', ten: 'A', so_luong: 1, don_gia: 1000 }] });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('phiếu khám');
  });

  it('từ chối dòng chi tiết không hợp lệ', async () => {
    expect((await taoYLenh({ phieu_kham_id: phieuKhamId, chi_tiet: [] })).status).toBe(400);
    expect((await taoYLenh({ phieu_kham_id: phieuKhamId, chi_tiet: [{ loai: 'xe_om', ten: 'A', so_luong: 1, don_gia: 1000 }] })).status).toBe(400);
    expect((await taoYLenh({ phieu_kham_id: phieuKhamId, chi_tiet: [{ loai: 'thuoc', ten: '', so_luong: 1, don_gia: 1000 }] })).status).toBe(400);
    expect((await taoYLenh({ phieu_kham_id: phieuKhamId, chi_tiet: [{ loai: 'thuoc', ten: 'A', so_luong: -3, don_gia: 1000 }] })).status).toBe(400);
  });

  it('nộp một phần → trạng thái "một phần"; thu tiếp cho đủ → "đã đủ"', async () => {
    const yl = await taoYLenh({
      phieu_kham_id: phieuKhamId, da_nop: 100000,
      chi_tiet: [{ loai: 'dich_vu', ten: 'Xét nghiệm máu', so_luong: 1, don_gia: 300000 }],
    });
    expect(yl.body.trang_thai).toBe('mot_phan');
    expect(yl.body.da_nop).toBe(100000);

    const t1 = await thu(yl.body.id, 100000);
    expect(t1.status).toBe(201);
    expect(t1.body.trang_thai).toBe('mot_phan');
    expect(t1.body.da_nop).toBe(200000);

    const t2 = await thu(yl.body.id, 100000);
    expect(t2.body.trang_thai).toBe('da_du');
    expect(t2.body.da_nop).toBe(300000);
    expect(t2.body.lan_thu.length).toBe(3);   // lưu đủ 3 lần thu để đối soát
  });

  it('số tiền thu không hợp lệ bị từ chối', async () => {
    const yl = await taoYLenh({ phieu_kham_id: phieuKhamId, chi_tiet: [{ loai: 'thuoc', ten: 'B', so_luong: 1, don_gia: 50000 }] });
    expect((await thu(yl.body.id, 0)).status).toBe(400);
    expect((await thu(yl.body.id, -10000)).status).toBe(400);
  });

  it('bác sĩ không lập / không thu tiền phiếu viện phí', async () => {
    const res = await taoYLenh({ phieu_kham_id: phieuKhamId, chi_tiet: [{ loai: 'thuoc', ten: 'C', so_luong: 1, don_gia: 1000 }] }, bacSi);
    expect([401, 403]).toContain(res.status);
  });

  it('phiếu y lệnh luôn hiển thị được tên bệnh nhân (không có phiếu "mồ côi")', async () => {
    const dsPhieu = await request(http).get('/api/reception/y-lenh').set('Authorization', `Bearer ${leTan}`);
    expect(dsPhieu.status).toBe(200);
    expect(dsPhieu.body.length).toBeGreaterThan(0);
    for (const p of dsPhieu.body) expect(p.ten_bn).toBe('Đỗ Thị Viện Phí');
  });
});
