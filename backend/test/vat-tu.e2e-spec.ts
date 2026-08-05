import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { khoiTaoApp, lamSachDuLieu, taoNenTang, taoBenhNhan, dangNhap, ngayISO } from './helpers';
import { VatTuTieuHao } from '../src/entities';

// ============================================================================
//  VẬT TƯ TIÊU HAO — danh mục nằm trong database, lọc theo khoa dùng; báo cáo
//  tổng hợp SỐ LƯỢNG và CHI PHÍ từ các dòng vật tư trên phiếu y lệnh.
// ============================================================================
describe('Danh mục và báo cáo vật tư tiêu hao', () => {
  let app: INestApplication;
  let ds: DataSource;
  let http: any;
  let leTan: string;
  let admin: string;
  let bacSi: string;
  let phieuKhamId: number;

  const danhMuc = (token: string, qs = '') =>
    request(http).get('/api/catalog/vat-tu' + qs).set('Authorization', `Bearer ${token}`);
  const baoCao = (qs = '') =>
    request(http).get('/api/admin/report/vat_tu' + qs).set('Authorization', `Bearer ${admin}`);

  beforeAll(async () => {
    ({ app, ds, http } = await khoiTaoApp());
    await lamSachDuLieu(ds);
    await taoNenTang(ds);
    leTan = await dangNhap(http, 'letan@test.vn');
    admin = await dangNhap(http, 'admin@test.vn');
    bacSi = await dangNhap(http, 'bssan@test.vn');

    // Danh mục mẫu: 2 vật tư khoa sản, 1 của IVF, 1 đã ngừng dùng
    const repo = ds.getRepository(VatTuTieuHao);
    await repo.save([
      repo.create({ ma_vt: 'VT1', ten: 'Băng vệ sinh sản phụ', nhom_id: 4, nhom_ten: 'Khám thai và theo dõi sản khoa', khoa: ['san'], ghi_chu: 'Sau thủ thuật' }),
      repo.create({ ma_vt: 'VT2', ten: 'Bơm tiêm các cỡ', nhom_id: 7, nhom_ten: 'Tiêm truyền và điều trị ngoại trú', khoa: ['san', 'ivf'], dvt: 'Cái', don_gia: 3000 }),
      repo.create({ ma_vt: 'VT3', ten: 'Kim chọc hút noãn', nhom_id: 11, nhom_ten: 'Hỗ trợ sinh sản và IVF', khoa: ['ivf'] }),
      repo.create({ ma_vt: 'VT4', ten: 'Vật tư đã ngừng dùng', nhom_id: 12, nhom_ten: 'Tiện ích người bệnh tự nguyện', khoa: ['san'], hoat_dong: false }),
    ]);

    // Một phiếu khám để phiếu y lệnh liên kết bệnh nhân
    const bn = await taoBenhNhan(ds, 'BN dùng vật tư');
    const pk = await request(http).post('/api/reception/exam-sheets').set('Authorization', `Bearer ${leTan}`)
      .send({ ten_bn: bn.ho_ten, ho_so_id: bn.id, chuyen_khoa: 'Khoa Sản' });
    expect(pk.status).toBe(201);
    phieuKhamId = pk.body.id;
  });
  afterAll(async () => { await app.close(); });

  it('trả danh mục vật tư đang hoạt động, bỏ vật tư đã ngừng dùng', async () => {
    const res = await danhMuc(leTan);
    expect(res.status).toBe(200);
    const ma = res.body.map((v: any) => v.ma_vt);
    expect(ma).toEqual(['VT1', 'VT2', 'VT3']);
    expect(res.body[0].nhom_ten).toBe('Khám thai và theo dõi sản khoa');
  });

  it('lọc theo khoa điều trị, không khớp nhầm mã khoa gần giống', async () => {
    expect((await danhMuc(leTan, '?khoa=ivf')).body.map((v: any) => v.ma_vt)).toEqual(['VT2', 'VT3']);
    expect((await danhMuc(leTan, '?khoa=san')).body.map((v: any) => v.ma_vt)).toEqual(['VT1', 'VT2']);
    expect((await danhMuc(leTan, '?khoa=sosinh')).body).toEqual([]);
  });

  it('lọc theo nhóm và theo từ khóa', async () => {
    expect((await danhMuc(leTan, '?nhom=11')).body.map((v: any) => v.ma_vt)).toEqual(['VT3']);
    expect((await danhMuc(leTan, `?q=${encodeURIComponent('bơm tiêm')}`)).body.map((v: any) => v.ma_vt)).toEqual(['VT2']);
    expect((await danhMuc(leTan, '?nhom=abc')).status).toBe(400);
  });

  it('bác sĩ xem được danh mục, người chưa đăng nhập thì không', async () => {
    expect((await danhMuc(bacSi)).status).toBe(200);
    expect((await request(http).get('/api/catalog/vat-tu')).status).toBe(401);
  });

  it('báo cáo báo rõ khi trong kỳ chưa có dòng vật tư nào', async () => {
    const res = await baoCao(`?tu=${ngayISO(0)}&den=${ngayISO(0)}`);
    expect(res.status).toBe(200);
    expect(res.body.chua_co_du_lieu).toBe(true);
    expect(res.body.chu_thich).toContain('chưa có dòng vật tư');
  });

  it('tổng hợp số lượng và chi phí vật tư từ phiếu y lệnh', async () => {
    const lap = (chiTiet: any[]) =>
      request(http).post('/api/reception/y-lenh').set('Authorization', `Bearer ${leTan}`)
        .send({ phieu_kham_id: phieuKhamId, chi_tiet: chiTiet });

    // Phiếu 1: 2 dòng vật tư + 1 dòng thuốc (thuốc không được tính vào báo cáo vật tư)
    expect((await lap([
      { loai: 'vat_tu', ma_vt: 'VT2', ten: 'Bơm tiêm các cỡ', dvt: 'Cái', so_luong: 4, don_gia: 3000 },
      { loai: 'vat_tu', ma_vt: 'VT1', ten: 'Băng vệ sinh sản phụ', so_luong: 2, don_gia: 10000 },
      { loai: 'thuoc', ten: 'Ferrous sulfate', so_luong: 30, don_gia: 2000 },
    ])).status).toBe(201);
    // Phiếu 2: dùng lại VT2 để kiểm tra việc cộng dồn giữa các phiếu
    expect((await lap([
      { loai: 'vat_tu', ma_vt: 'VT2', ten: 'Bơm tiêm các cỡ', dvt: 'Cái', so_luong: 6, don_gia: 3000 },
    ])).status).toBe(201);

    const res = await baoCao(`?tu=${ngayISO(0)}&den=${ngayISO(0)}`);
    expect(res.status).toBe(200);
    expect(res.body.chua_co_du_lieu).toBe(false);

    const the = (nhan: string) => res.body.the.find((t: any) => t.nhan === nhan);
    // Chi phí vật tư = 4×3000 + 2×10000 + 6×3000 = 50.000đ (không gồm dòng thuốc)
    expect(the('Chi phí vật tư trong kỳ').gia_tri).toBe(50000);
    expect(the('Số lượng đã dùng').gia_tri).toBe(12);
    expect(the('Phiếu viện phí có vật tư').gia_tri).toBe(2);
    expect(the('Vật tư trong danh mục').gia_tri).toBe(3);

    const theoVatTu = res.body.bang.find((b: any) => b.tieu_de.includes('theo vật tư'));
    const bomTiem = theoVatTu.dong.find((d: any[]) => d[0] === 'Bơm tiêm các cỡ');
    expect(bomTiem).toEqual(['Bơm tiêm các cỡ', 'Tiêm truyền và điều trị ngoại trú', 'Cái', 10, 2, 30000]);
    const bang = theoVatTu.dong.find((d: any[]) => d[0] === 'Băng vệ sinh sản phụ');
    expect(bang[3]).toBe(2);
    expect(bang[5]).toBe(20000);
    // Dòng thuốc không lọt vào báo cáo vật tư
    expect(theoVatTu.dong.some((d: any[]) => d[0] === 'Ferrous sulfate')).toBe(false);

    const theoKhoa = res.body.bang.find((b: any) => b.tieu_de.includes('khoa điều trị'));
    expect(theoKhoa.dong).toEqual([['Khoa Sản', 2, 12, 50000]]);
  });

  it('chỉ quản trị viên xem được báo cáo vật tư', async () => {
    const res = await request(http).get('/api/admin/report/vat_tu').set('Authorization', `Bearer ${leTan}`);
    expect([401, 403]).toContain(res.status);
  });
});
