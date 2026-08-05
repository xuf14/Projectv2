import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { khoiTaoApp, lamSachDuLieu, taoNenTang, taoBenhNhan, dangNhap, ngayISO } from './helpers';
import { KhungGio, LichHen, TrangThaiLich } from '../src/entities';

// ============================================================================
//  LỌC LỊCH HẸN THEO NGÀY KHÁM — lễ tân mở "Tất cả lịch hẹn" và lọc theo
//  khoảng ngày (?tu=&den=), kết hợp được với lọc trạng thái và tìm từ khóa.
// ============================================================================
describe('Lọc lịch hẹn theo ngày khám', () => {
  let app: INestApplication;
  let ds: DataSource;
  let http: any;
  let leTan: string;
  let bacSi: string;

  const goi = (qs: string, token?: string) =>
    request(http).get(`/api/reception/appointments${qs}`).set('Authorization', `Bearer ${token || leTan}`);
  const maCua = (body: any[]) => body.map((a) => a.ma_lich_hen).sort();

  beforeAll(async () => {
    ({ app, ds, http } = await khoiTaoApp());
    await lamSachDuLieu(ds);
    const nen = await taoNenTang(ds);
    leTan = await dangNhap(http, 'letan@test.vn');
    bacSi = await dangNhap(http, 'bssan@test.vn');

    const bnA = await taoBenhNhan(ds, 'Trần Thị Hôm Qua');
    const bnB = await taoBenhNhan(ds, 'Lê Thị Hôm Nay');
    const kgRepo = ds.getRepository(KhungGio);
    const lhRepo = ds.getRepository(LichHen);
    const taoLich = async (ma: string, ngay: string, hoSo: any, tt: TrangThaiLich) => {
      const kg = await kgRepo.save(kgRepo.create({
        ngay, gio_bat_dau: '08:00', gio_ket_thuc: '08:30', so_luong: 5, bac_si: nen.bsSan,
      }));
      await lhRepo.save(lhRepo.create({ ma_lich_hen: ma, trang_thai: tt, ho_so: hoSo, khung_gio: kg, khoa: nen.khoaSan }));
    };
    await taoLich('LH-QUA', ngayISO(-1), bnA, TrangThaiLich.DA_KHAM);
    await taoLich('LH-NAY', ngayISO(0), bnB, TrangThaiLich.DA_XAC_NHAN);
    await taoLich('LH-MAI', ngayISO(1), bnB, TrangThaiLich.CHO_XAC_NHAN);
    await taoLich('LH-TUAN', ngayISO(7), bnA, TrangThaiLich.CHO_XAC_NHAN);
  });
  afterAll(async () => { await app.close(); });

  it('không truyền ngày thì trả toàn bộ lịch hẹn', async () => {
    const res = await goi('');
    expect(res.status).toBe(200);
    expect(maCua(res.body)).toEqual(['LH-MAI', 'LH-NAY', 'LH-QUA', 'LH-TUAN']);
  });

  it('lọc đúng một ngày khi tu = den', async () => {
    const res = await goi(`?tu=${ngayISO(0)}&den=${ngayISO(0)}`);
    expect(res.status).toBe(200);
    expect(maCua(res.body)).toEqual(['LH-NAY']);
  });

  it('lọc theo khoảng ngày, bao gồm cả hai đầu mốc', async () => {
    const res = await goi(`?tu=${ngayISO(0)}&den=${ngayISO(1)}`);
    expect(maCua(res.body)).toEqual(['LH-MAI', 'LH-NAY']);
  });

  it('chỉ truyền tu hoặc chỉ truyền den', async () => {
    expect(maCua((await goi(`?tu=${ngayISO(1)}`)).body)).toEqual(['LH-MAI', 'LH-TUAN']);
    expect(maCua((await goi(`?den=${ngayISO(0)}`)).body)).toEqual(['LH-NAY', 'LH-QUA']);
  });

  it('kết hợp được với lọc trạng thái và tìm từ khóa', async () => {
    const tt = await goi(`?trang_thai=cho_xac_nhan&tu=${ngayISO(1)}&den=${ngayISO(1)}`);
    expect(maCua(tt.body)).toEqual(['LH-MAI']);
    const q = await goi(`?q=${encodeURIComponent('Hôm Nay')}&tu=${ngayISO(-1)}&den=${ngayISO(1)}`);
    expect(maCua(q.body)).toEqual(['LH-MAI', 'LH-NAY']);
  });

  it('ngày sai định dạng hoặc đảo khoảng thì trả 400', async () => {
    expect((await goi('?tu=01-08-2026')).status).toBe(400);
    expect((await goi('?den=2026-13-45')).status).toBe(400);
    expect((await goi(`?tu=${ngayISO(5)}&den=${ngayISO(1)}`)).status).toBe(400);
  });

  it('ngày rỗng được bỏ qua, không coi là lỗi', async () => {
    const res = await goi('?tu=&den=');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(4);
  });

  it('bác sĩ không được gọi danh sách lịch hẹn của lễ tân', async () => {
    const res = await goi(`?tu=${ngayISO(0)}`, bacSi);
    expect([401, 403]).toContain(res.status);
  });
});
