import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { khoiTaoApp, lamSachDuLieu, taoNenTang, taoBenhNhan, dangNhap, ngayISO } from './helpers';

// ============================================================================
//  TIỀN THU Ở MỤC Y LỆNH PHẢI VÀO SỔ THU VÀ DANH SÁCH THANH TOÁN.
//  Viện phí đến từ hai nguồn (hóa đơn dịch vụ + phiếu y lệnh); lễ tân và quản trị
//  chỉ đọc MỘT sổ nên tổng thu, lịch doanh thu và bản CSV đều phải cộng cả hai.
// ============================================================================
describe('Sổ thu trong ngày gộp tiền phiếu y lệnh', () => {
  let app: INestApplication;
  let ds: DataSource;
  let http: any;
  let leTan: string;
  let admin: string;
  let bacSi: string;
  let phieuKhamId: number;
  let hoSoId: number;
  const homNay = ngayISO(0);

  const soThu = (token = leTan, ng = homNay) =>
    request(http).get(`/api/reception/payments/daily?ngay=${ng}`).set('Authorization', `Bearer ${token}`);
  const theoBenhNhan = (ng = homNay) =>
    request(http).get(`/api/reception/payments/by-patient?ngay=${ng}`).set('Authorization', `Bearer ${leTan}`);

  beforeAll(async () => {
    ({ app, ds, http } = await khoiTaoApp());
    await lamSachDuLieu(ds);
    await taoNenTang(ds);
    leTan = await dangNhap(http, 'letan@test.vn');
    admin = await dangNhap(http, 'admin@test.vn');
    bacSi = await dangNhap(http, 'bssan@test.vn');
    const bn = await taoBenhNhan(ds, 'Vũ Thị Sổ Thu');
    hoSoId = bn.id;
    const pk = await request(http).post('/api/reception/exam-sheets').set('Authorization', `Bearer ${leTan}`)
      .send({ ten_bn: bn.ho_ten, ho_so_id: bn.id });
    phieuKhamId = pk.body.id;
  });
  afterAll(async () => { await app.close(); });

  it('phiếu y lệnh thu tiền được cộng vào sổ thu trong ngày', async () => {
    const truoc = await soThu();
    expect(truoc.status).toBe(200);
    const tongTruoc = truoc.body.tong_tien;

    const yl = await request(http).post('/api/reception/y-lenh').set('Authorization', `Bearer ${leTan}`)
      .send({
        phieu_kham_id: phieuKhamId, da_nop: 200000,
        chi_tiet: [{ loai: 'dich_vu', ten: 'Truyền dịch', so_luong: 1, don_gia: 300000 }],
      });
    expect(yl.status).toBe(201);
    expect(yl.body.tong_tien).toBe(300000);

    const sau = await soThu();
    expect(sau.body.tong_tien).toBe(tongTruoc + 200000);
    expect(sau.body.theo_nguon.y_lenh.tong_tien).toBe(200000);
    expect(sau.body.theo_nguon.y_lenh.so_phieu).toBe(1);

    const dong = sau.body.danh_sach.find((t: any) => t.nguon === 'y_lenh');
    expect(dong).toBeTruthy();
    expect(dong.ma_thanh_toan).toBe(yl.body.ma_phieu);
    expect(dong.tong_tien).toBe(200000);                 // ghi đúng số đã thu, không phải tổng phiếu
    expect(dong.lich_hen.benh_nhan).toBe('Vũ Thị Sổ Thu');
    expect(dong.nguoi_tao.ho_ten).toBe('Lễ tân Test');
    expect(String(dong.id).startsWith('yl-')).toBe(true); // không đụng id hóa đơn dịch vụ

    // Thu tiếp phần còn lại → sổ thu cộng thêm đúng lần thu thứ hai
    const thu2 = await request(http).post(`/api/reception/y-lenh/${yl.body.id}/thu`)
      .set('Authorization', `Bearer ${leTan}`).send({ so_tien: 100000 });
    expect(thu2.status).toBe(201);
    const sau2 = await soThu();
    expect(sau2.body.tong_tien).toBe(tongTruoc + 300000);
    expect(sau2.body.theo_nguon.y_lenh.so_phieu).toBe(2);  // hai lần thu = hai dòng sổ
  });

  it('gom theo bệnh nhân tính đúng tiền y lệnh, không cộng trùng dòng thuốc', async () => {
    const r = await theoBenhNhan();
    expect(r.status).toBe(200);
    const bn = r.body.benh_nhan.find((b: any) => b.ho_so_id === hoSoId);
    expect(bn).toBeTruthy();
    expect(bn.tong_tien).toBe(300000);      // 200.000 + 100.000, không phải 300.000 × 2
    expect(bn.so_hoa_don).toBe(2);
  });

  it('lịch doanh thu tháng khớp với sổ thu trong ngày', async () => {
    const thang = homNay.slice(0, 7);
    const th = await request(http).get(`/api/reception/payments/monthly?thang=${thang}`)
      .set('Authorization', `Bearer ${leTan}`);
    const cuaNgay = th.body.ngay.find((d: any) => d.ngay === homNay);
    const ngay = await soThu();
    expect(cuaNgay.tong_tien).toBe(ngay.body.tong_tien);
    expect(cuaNgay.so_hoa_don).toBe(ngay.body.so_hoa_don);
  });

  it('danh sách thanh toán của lễ tân và quản trị đều có phiếu y lệnh', async () => {
    for (const [token, duong] of [[leTan, '/api/reception/payments'], [admin, '/api/admin/payments']] as const) {
      const r = await request(http).get(duong).set('Authorization', `Bearer ${token}`);
      expect(r.status).toBe(200);
      const dong = r.body.find((t: any) => t.nguon === 'y_lenh');
      expect(dong).toBeTruthy();
      expect(dong.tong_tien).toBe(300000);          // dòng này là cả PHIẾU
      expect(dong.con_lai).toBe(0);
      expect(dong.trang_thai).toBe('da_thanh_toan');
      expect(dong.chi_tiet[0].ten_dich_vu).toBe('Truyền dịch');
      // Giờ thu phải là lần thu gần nhất, không phải giờ lập phiếu
      expect(new Date(dong.ngay_thanh_toan).getTime())
        .toBeGreaterThan(new Date(dong.ngay_tao).getTime());
    }
  });

  it('phiếu y lệnh chưa thu đủ hiện là chờ thanh toán kèm số còn lại', async () => {
    const yl = await request(http).post('/api/reception/y-lenh').set('Authorization', `Bearer ${leTan}`)
      .send({
        phieu_kham_id: phieuKhamId, da_nop: 50000,
        chi_tiet: [{ loai: 'dich_vu', ten: 'Siêu âm', so_luong: 1, don_gia: 150000 }],
      });
    expect(yl.status).toBe(201);
    const r = await request(http).get('/api/reception/payments').set('Authorization', `Bearer ${leTan}`);
    const dong = r.body.find((t: any) => t.ma_thanh_toan === yl.body.ma_phieu);
    expect(dong.trang_thai).toBe('cho_thanh_toan');
    expect(dong.con_lai).toBe(100000);
  });

  it('bản CSV sổ thu ghi rõ nguồn tiền', async () => {
    const r = await request(http).get(`/api/reception/payments/daily/export?ngay=${homNay}`)
      .set('Authorization', `Bearer ${leTan}`);
    expect(r.status).toBe(200);
    const csv = r.text || r.body.toString();
    expect(csv).toContain('Nguồn');
    expect(csv).toContain('Y lệnh');
  });

  it('bác sĩ không xem được sổ thu', async () => {
    expect([401, 403]).toContain((await soThu(bacSi)).status);
  });
});
