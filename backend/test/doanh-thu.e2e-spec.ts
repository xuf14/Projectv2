import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { khoiTaoApp, lamSachDuLieu, taoNenTang, taoBenhNhan, dangNhap, ngayISO } from './helpers';
import { DichVu, LichHen, ThanhToan, TrangThaiLich } from '../src/entities';

// ============================================================================
//  DOANH THU THEO THÁNG — nguồn dữ liệu để lịch tô màu ngày có tiền thu.
//  Chỉ tính hóa đơn ĐÃ THANH TOÁN, gom theo ngày thu tiền.
// ============================================================================
describe('Doanh thu theo tháng (tô màu lịch)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let http: any;
  let leTan: string;
  let admin: string;
  let bacSi: string;
  let thang: string;
  let homNay: string;

  // Lập hóa đơn cho một lịch hẹn đã khám rồi thu tiền; trả về id hóa đơn
  const taoHoaDon = async (hoSoId: number, bacSiId: number, dichVuId: number, soLuong = 1) => {
    const lich = await request(http).post('/api/reception/new-exam').set('Authorization', `Bearer ${leTan}`)
      .send({ ho_so_id: hoSoId, bac_si_id: bacSiId, ngay: homNay, gio: '08:00' });
    expect(lich.status).toBe(201);
    // Hóa đơn chỉ lập được sau khi bệnh nhân đã khám xong
    await ds.getRepository(LichHen).update(lich.body.id, { trang_thai: TrangThaiLich.DA_KHAM });
    const hd = await request(http).post(`/api/reception/appointments/${lich.body.id}/payment`)
      .set('Authorization', `Bearer ${leTan}`).send({ items: [{ dich_vu_id: dichVuId, so_luong: soLuong }] });
    expect(hd.status).toBe(201);
    return hd.body.id;
  };
  const thu = (id: number) => request(http).post(`/api/payments/${id}/pay`).set('Authorization', `Bearer ${leTan}`);
  const doanhThu = (token: string, th?: string) =>
    request(http).get('/api/reception/payments/monthly' + (th ? `?thang=${th}` : '')).set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    ({ app, ds, http } = await khoiTaoApp());
    await lamSachDuLieu(ds);
    const nen = await taoNenTang(ds);
    leTan = await dangNhap(http, 'letan@test.vn');
    admin = await dangNhap(http, 'admin@test.vn');
    bacSi = await dangNhap(http, 'bssan@test.vn');
    homNay = ngayISO(0);
    thang = homNay.slice(0, 7);

    const dv = ds.getRepository(DichVu);
    const kham = await dv.save(dv.create({ ten_dich_vu: 'Khám thai định kỳ', gia: 200000, khoa: nen.khoaSan }));
    const bn1 = await taoBenhNhan(ds, 'Bệnh nhân đã thu 1');
    const bn2 = await taoBenhNhan(ds, 'Bệnh nhân đã thu 2');
    const bn3 = await taoBenhNhan(ds, 'Bệnh nhân chưa thu');

    await thu(await taoHoaDon(bn1.id, nen.bsSan.id, kham.id, 2));   // 400.000 đã thu
    await thu(await taoHoaDon(bn2.id, nen.bsSan.id, kham.id, 1));   // 200.000 đã thu
    await taoHoaDon(bn3.id, nen.bsSan.id, kham.id, 1);              // 200.000 CHƯA thu
  });
  afterAll(async () => { await app.close(); });

  it('trả về đúng tổng thu và số hóa đơn của ngày đã thu tiền', async () => {
    const res = await doanhThu(leTan, thang);
    expect(res.status).toBe(200);
    expect(res.body.thang).toBe(thang);
    const homNayData = res.body.ngay.find((d: any) => d.ngay === homNay);
    expect(homNayData).toBeDefined();
    expect(homNayData.so_hoa_don).toBe(2);          // hóa đơn chưa thu KHÔNG được tính
    expect(homNayData.tong_tien).toBe(600000);
    expect(res.body.tong_tien).toBe(600000);
    expect(res.body.so_ngay_co_thu).toBe(1);
  });

  it('khớp với sổ thu trong ngày (cùng một nguồn số liệu)', async () => {
    const ngayRes = await request(http).get(`/api/reception/payments/daily?ngay=${homNay}`)
      .set('Authorization', `Bearer ${leTan}`);
    const thangRes = await doanhThu(leTan, thang);
    const cuaNgay = thangRes.body.ngay.find((d: any) => d.ngay === homNay);
    expect(ngayRes.body.tong_tien).toBe(cuaNgay.tong_tien);
    expect(ngayRes.body.so_hoa_don).toBe(cuaNgay.so_hoa_don);
  });

  it('tháng không có khoản thu nào trả về mảng rỗng, không lỗi', async () => {
    const res = await doanhThu(admin, '2000-01');
    expect(res.status).toBe(200);
    expect(res.body.ngay).toEqual([]);
    expect(res.body.tong_tien).toBe(0);
  });

  it('hủy hóa đơn/chưa thu không làm sai doanh thu', async () => {
    const truoc = (await doanhThu(admin, thang)).body.tong_tien;
    const chuaThu = await ds.getRepository(ThanhToan).findOne({ where: { trang_thai: 'cho_thanh_toan' as any } });
    expect(chuaThu).toBeTruthy();
    const huy = await request(http).patch(`/api/admin/payments/${chuaThu.id}/cancel`).set('Authorization', `Bearer ${admin}`);
    expect(huy.status).toBe(200);
    expect((await doanhThu(admin, thang)).body.tong_tien).toBe(truoc);
  });

  it('tham số tháng sai định dạng bị từ chối', async () => {
    for (const th of ['2026-13', '07-2026', 'thang-7', '2026']) {
      expect((await doanhThu(leTan, th)).status).toBe(400);
    }
  });

  it('không token → 401; bác sĩ không xem được doanh thu', async () => {
    expect((await request(http).get('/api/reception/payments/monthly')).status).toBe(401);
    expect([401, 403]).toContain((await doanhThu(bacSi, thang)).status);
  });

  // ---- Doanh thu chi tiết theo từng bệnh nhân ----
  const theoBenhNhan = (token: string, ng: string) =>
    request(http).get(`/api/reception/payments/by-patient?ngay=${ng}`).set('Authorization', `Bearer ${token}`);

  it('gom đúng doanh thu theo từng bệnh nhân, sắp xếp giảm dần', async () => {
    const res = await theoBenhNhan(leTan, homNay);
    expect(res.status).toBe(200);
    expect(res.body.so_benh_nhan).toBe(2);          // bệnh nhân chưa thu tiền không xuất hiện
    expect(res.body.tong_tien).toBe(600000);
    const [nhat, nhi] = res.body.benh_nhan;
    expect(nhat.ho_ten).toBe('Bệnh nhân đã thu 1');
    expect(nhat.tong_tien).toBe(400000);            // 200.000 × 2
    expect(nhat.so_hoa_don).toBe(1);
    expect(nhi.tong_tien).toBe(200000);
    expect(nhat.tong_tien).toBeGreaterThanOrEqual(nhi.tong_tien);
    // Dịch vụ được gộp kèm số lượng + thành tiền, và có chi tiết từng hóa đơn
    expect(nhat.dich_vu).toEqual([{ ten_dich_vu: 'Khám thai định kỳ', so_luong: 2, thanh_tien: 400000 }]);
    expect(nhat.hoa_don[0].chi_tiet[0].don_gia).toBe(200000);
    expect(nhat.hoa_don[0].nguoi_thu).toBe('Lễ tân Test');
  });

  it('nhiều hóa đơn của cùng một bệnh nhân được cộng vào một dòng', async () => {
    const truoc = (await theoBenhNhan(leTan, homNay)).body;
    const bn1 = truoc.benh_nhan.find((b: any) => b.ho_ten === 'Bệnh nhân đã thu 1');
    const dv = await ds.getRepository(DichVu).findOneBy({ ten_dich_vu: 'Khám thai định kỳ' });
    const nen = await ds.getRepository('bac_si').query('SELECT id FROM bac_si ORDER BY id ASC LIMIT 1');
    await thu(await taoHoaDon(bn1.ho_so_id, nen[0].id, dv.id, 1));

    const sau = (await theoBenhNhan(leTan, homNay)).body;
    expect(sau.so_benh_nhan).toBe(2);               // vẫn 2 bệnh nhân, không tách dòng mới
    const moi = sau.benh_nhan.find((b: any) => b.ho_so_id === bn1.ho_so_id);
    expect(moi.so_hoa_don).toBe(2);
    expect(moi.tong_tien).toBe(600000);
    expect(moi.dich_vu[0].so_luong).toBe(3);        // 2 + 1 lần khám, gộp chung dịch vụ
    expect(sau.tong_tien).toBe(800000);
  });

  it('lũy kế đã thu của một bệnh nhân khớp với tổng các hóa đơn của họ', async () => {
    const ds1 = (await theoBenhNhan(leTan, homNay)).body.benh_nhan[0];
    const res = await request(http).get(`/api/reception/payments/patient/${ds1.ho_so_id}`)
      .set('Authorization', `Bearer ${leTan}`);
    expect(res.status).toBe(200);
    expect(res.body.ho_ten).toBe(ds1.ho_ten);
    expect(res.body.tong_tien).toBe(ds1.tong_tien);
    expect(res.body.so_hoa_don).toBe(ds1.so_hoa_don);
    expect(res.body.hoa_don.every((h: any) => h.trang_thai === 'da_thanh_toan')).toBe(true);
  });

  it('hồ sơ không tồn tại → 404; bác sĩ và khách không xem được', async () => {
    expect((await request(http).get('/api/reception/payments/patient/999999').set('Authorization', `Bearer ${leTan}`)).status).toBe(404);
    expect((await request(http).get(`/api/reception/payments/by-patient?ngay=${homNay}`)).status).toBe(401);
    expect([401, 403]).toContain((await theoBenhNhan(bacSi, homNay)).status);
  });
});
