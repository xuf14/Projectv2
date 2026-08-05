import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { khoiTaoApp, lamSachDuLieu, taoNenTang, taoBenhNhan, dangNhap, ngayISO } from './helpers';

// ============================================================================
//  BƯỚC 5 — KẾT LUẬN & HƯỚNG XỬ TRÍ (trang Khám lâm sàng và cận lâm sàng)
//  Quy tắc: hướng xử trí "hẹn tái khám" bắt buộc có ngày và phải sinh lịch hẹn
//  thật + thông báo cho lễ tân; các hướng khác không cần ngày, không tạo lịch.
// ============================================================================
describe('Kết luận bước 5: hẹn tái khám gửi về lễ tân', () => {
  let app: INestApplication;
  let ds: DataSource;
  let http: any;
  let leTan: string;
  let bacSi: string;
  let bsSanId: number;

  const taoLichKham = async (hoSoId: number, gio = '08:00') => {
    const r = await request(http).post('/api/reception/new-exam').set('Authorization', `Bearer ${leTan}`)
      .send({ ho_so_id: hoSoId, bac_si_id: bsSanId, ngay: ngayISO(0), gio });
    expect(r.status).toBe(201);
    return r.body.id as number;
  };
  const ketLuan = (lichId: number, body: any) =>
    request(http).post(`/api/encounters/${lichId}/conclusion`).set('Authorization', `Bearer ${bacSi}`).send(body);
  const lichNgay = (ngay: string) =>
    request(http).get(`/api/reception/today?ngay=${ngay}`).set('Authorization', `Bearer ${leTan}`);

  beforeAll(async () => {
    ({ app, ds, http } = await khoiTaoApp());
    await lamSachDuLieu(ds);
    const nen = await taoNenTang(ds);
    bsSanId = nen.bsSan.id;
    leTan = await dangNhap(http, 'letan@test.vn');
    bacSi = await dangNhap(http, 'bssan@test.vn');
  });
  afterAll(async () => { await app.close(); });

  it('hẹn tái khám mà thiếu ngày thì bị chặn, không tạo lịch nào', async () => {
    const bn = await taoBenhNhan(ds, 'BN thiếu ngày tái khám');
    const lichId = await taoLichKham(bn.id, '08:00');
    const res = await ketLuan(lichId, { chan_doan_chinh: 'Theo dõi thai', huong_xu_tri: 'hen_tai_kham' });
    expect(res.status).toBe(400);
    const mai = await lichNgay(ngayISO(1));
    expect(mai.body.filter((l: any) => l.ho_so && l.ho_so.id === bn.id)).toHaveLength(0);
  });

  it('chặn ngày tái khám sai định dạng hoặc ở quá khứ', async () => {
    const bn = await taoBenhNhan(ds, 'BN ngày tái khám sai');
    const lichId = await taoLichKham(bn.id, '09:00');
    expect((await ketLuan(lichId, {
      chan_doan_chinh: 'x', huong_xu_tri: 'hen_tai_kham', ngay_tai_kham: '30-07-2026',
    })).status).toBe(400);
    expect((await ketLuan(lichId, {
      chan_doan_chinh: 'x', huong_xu_tri: 'hen_tai_kham', ngay_tai_kham: ngayISO(-1),
    })).status).toBe(400);
  });

  it('hẹn tái khám sinh lịch hẹn thật cho lễ tân và báo cho lễ tân', async () => {
    const bn = await taoBenhNhan(ds, 'BN có hẹn tái khám');
    const lichId = await taoLichKham(bn.id, '10:00');
    const res = await ketLuan(lichId, {
      chan_doan_chinh: 'Thai 30 tuần, thiếu máu nhẹ',
      huong_xu_tri: 'hen_tai_kham', ngay_tai_kham: ngayISO(7),
      loi_dan: 'Mang theo kết quả xét nghiệm máu',
    });
    expect(res.status).toBe(201);
    expect(res.body.ngay_tai_kham).toBe(ngayISO(7));
    expect(res.body.tai_kham).toMatchObject({ ngay: ngayISO(7), gio: '08:00', moi: true });

    // Lịch tái khám nằm trong danh sách check-in của lễ tân đúng ngày hẹn
    const ds7 = await lichNgay(ngayISO(7));
    expect(ds7.status).toBe(200);
    const cua = ds7.body.filter((l: any) => l.ho_so && l.ho_so.id === bn.id);
    expect(cua).toHaveLength(1);
    expect(cua[0].ma_lich_hen).toBe(res.body.tai_kham.ma_lich_hen);
    expect(cua[0].trang_thai).toBe('da_xac_nhan');
    expect(cua[0].khung_gio.bac_si.id).toBe(bsSanId);

    // Lễ tân nhận thông báo về lịch tái khám
    const tb = await request(http).get('/api/notifications').set('Authorization', `Bearer ${leTan}`);
    expect(tb.status).toBe(200);
    const cuaBN = tb.body.filter((t: any) => t.loai === 'tai_kham' && String(t.noi_dung || '').includes(bn.ma_benh_nhan));
    expect(cuaBN.length).toBeGreaterThan(0);

    // Hẹn cũng ghi lên hồ sơ nên bác sĩ thấy trong danh sách tái khám của mình
    const tk = await request(http).get('/api/doctor/revisits').set('Authorization', `Bearer ${bacSi}`);
    expect(tk.body.find((r: any) => r.ho_so_id === bn.id).ngay_tai_kham).toBe(ngayISO(7));
  });

  it('sửa lại kết luận với cùng ngày không đẻ thêm lịch tái khám trùng', async () => {
    const bn = await taoBenhNhan(ds, 'BN sửa kết luận');
    const lichId = await taoLichKham(bn.id, '11:00');
    const lan1 = await ketLuan(lichId, {
      chan_doan_chinh: 'Theo dõi', huong_xu_tri: 'hen_tai_kham', ngay_tai_kham: ngayISO(9),
    });
    expect(lan1.status).toBe(201);
    const lan2 = await ketLuan(lichId, {
      chan_doan_chinh: 'Theo dõi (sửa)', huong_xu_tri: 'hen_tai_kham', ngay_tai_kham: ngayISO(9),
    });
    expect(lan2.status).toBe(201);
    expect(lan2.body.tai_kham.ma_lich_hen).toBe(lan1.body.tai_kham.ma_lich_hen);
    expect(lan2.body.tai_kham.moi).toBe(false);

    const ds9 = await lichNgay(ngayISO(9));
    expect(ds9.body.filter((l: any) => l.ho_so && l.ho_so.id === bn.id)).toHaveLength(1);
  });

  it('không hẹn tái khám thì bỏ qua ngày gửi lên và không tạo lịch', async () => {
    const bn = await taoBenhNhan(ds, 'BN kết thúc khám');
    const lichId = await taoLichKham(bn.id, '13:00');
    const res = await ketLuan(lichId, {
      chan_doan_chinh: 'Bình thường', huong_xu_tri: 'ket_thuc', ngay_tai_kham: ngayISO(5),
    });
    expect(res.status).toBe(201);
    expect(res.body.ngay_tai_kham).toBeNull();
    expect(res.body.tai_kham).toBeNull();
    const ds5 = await lichNgay(ngayISO(5));
    expect(ds5.body.filter((l: any) => l.ho_so && l.ho_so.id === bn.id)).toHaveLength(0);

    // Lần khám vẫn hoàn tất để lễ tân lập thanh toán
    const flow = await request(http).get(`/api/encounters/${lichId}/flow`).set('Authorization', `Bearer ${bacSi}`);
    expect(flow.body.buoc.b5_ket_luan).toBe('xong');
    expect(flow.body.lich_hen.trang_thai).toBe('da_kham');
  });
});
