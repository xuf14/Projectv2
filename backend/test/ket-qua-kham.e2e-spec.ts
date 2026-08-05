import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { khoiTaoApp, lamSachDuLieu, taoNenTang, taoBenhNhan, dangNhap, ngayISO } from './helpers';

// ============================================================================
//  KẾT QUẢ KHÁM CỦA BÁC SĨ — một lần lưu phải kéo theo cả ba việc:
//   1) cập nhật "Thông tin khám bệnh" (phiếu khám) mà lễ tân đang xem,
//   2) đơn thuốc kê từ danh mục trở thành dòng thuốc cho chi tiết viện phí,
//   3) hẹn tái khám theo số ngày/tuần sinh lịch hẹn thật đúng ngày → hiện
//      trong danh sách check-in của lễ tân.
// ============================================================================
describe('Lưu kết quả khám: phiếu khám + đơn thuốc + hẹn tái khám', () => {
  let app: INestApplication;
  let ds: DataSource;
  let http: any;
  let leTan: string;
  let bacSi: string;
  let bsSanId: number;

  // Lễ tân tạo lịch khám hôm nay (đã check-in) → id lịch để bác sĩ ghi kết quả
  const taoLichKham = async (hoSoId: number, gio = '08:00') => {
    const r = await request(http).post('/api/reception/new-exam').set('Authorization', `Bearer ${leTan}`)
      .send({ ho_so_id: hoSoId, bac_si_id: bsSanId, ngay: ngayISO(0), gio });
    expect(r.status).toBe(201);
    return r.body.id as number;
  };
  const ghiKetQua = (lichId: number, body: any) =>
    request(http).post(`/api/visits/${lichId}/result`).set('Authorization', `Bearer ${bacSi}`).send(body);
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

  it('cập nhật phiếu khám bệnh của lễ tân từ kết quả bác sĩ ghi', async () => {
    const bn = await taoBenhNhan(ds, 'BN cập nhật phiếu khám');
    const lichId = await taoLichKham(bn.id);
    const res = await ghiKetQua(lichId, {
      chan_doan: 'Thai 24 tuần phát triển bình thường',
      chi_dinh: 'Siêu âm 4D',
      ghi_chu: 'Uống sắt sau ăn',
    });
    expect(res.status).toBe(201);
    expect(res.body.phieu_kham_id).toBeGreaterThan(0);

    const phieu = await request(http).get(`/api/reception/exam-sheets/${res.body.phieu_kham_id}`)
      .set('Authorization', `Bearer ${leTan}`);
    expect(phieu.status).toBe(200);
    expect(phieu.body.ten_bn).toBe('BN cập nhật phiếu khám');
    expect(phieu.body.bs_kham).toBe('BS Sản Test');
    expect(phieu.body.chuyen_khoa).toBe('Khoa Sản');
    expect(phieu.body.ngay_kham).toBe(ngayISO(0));
    expect(phieu.body.chan_doan_so_bo).toBe('Thai 24 tuần phát triển bình thường');
    expect(phieu.body.ghi_chu_kb).toBe('Siêu âm 4D');
    expect(phieu.body.ket_luan).toBe('Uống sắt sau ăn');
  });

  it('đơn thuốc bác sĩ kê thành dòng viện phí cho lễ tân, đơn giá để lễ tân nhập', async () => {
    const bn = await taoBenhNhan(ds, 'BN có đơn thuốc');
    const lichId = await taoLichKham(bn.id, '09:00');
    const res = await ghiKetQua(lichId, {
      chan_doan: 'Thiếu máu thiếu sắt',
      thuoc: [
        { ten: 'Ferrous sulfate', so_luong: 30, dvt: 'Viên', lieu_dung: '1 viên/ngày', cach_dung: 'Uống sau ăn' },
        { ten: 'Folic acid', so_luong: 30, dvt: 'Viên' },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.body.so_thuoc).toBe(2);

    const don = await request(http).get(`/api/reception/y-lenh/don-thuoc/${res.body.phieu_kham_id}`)
      .set('Authorization', `Bearer ${leTan}`);
    expect(don.status).toBe(200);
    expect(don.body.luot_kham.bac_si).toBe('BS Sản Test');
    expect(don.body.chi_tiet).toHaveLength(2);
    const [d1, d2] = don.body.chi_tiet;
    expect(d1).toMatchObject({
      loai: 'thuoc', ten: 'Ferrous sulfate', so_luong: 30, dvt: 'Viên',
      lieu_dung: '1 viên/ngày', cach_dung: 'Uống sau ăn', don_gia: 0, ty_le: 100,
    });
    expect(d2.ten).toBe('Folic acid');
    // Mã dòng khác nhau để lễ tân xóa/nạp lại từng dòng không bị trùng
    expect(d1.ma_vt).not.toBe(d2.ma_vt);
  });

  it('không có đơn thuốc thì trả danh sách rỗng, không đoán từ đơn chữ', async () => {
    const bn = await taoBenhNhan(ds, 'BN không kê thuốc');
    const lichId = await taoLichKham(bn.id, '10:00');
    const res = await ghiKetQua(lichId, { chan_doan: 'Khám thai định kỳ', don_thuoc: 'Paracetamol khi sốt' });
    expect(res.status).toBe(201);
    const don = await request(http).get(`/api/reception/y-lenh/don-thuoc/${res.body.phieu_kham_id}`)
      .set('Authorization', `Bearer ${leTan}`);
    expect(don.body.chi_tiet).toEqual([]);
    expect(don.body.luot_kham).toBeNull();
  });

  it('chặn dòng thuốc thiếu tên hoặc số lượng không hợp lệ', async () => {
    const bn = await taoBenhNhan(ds, 'BN thuốc sai');
    const lichId = await taoLichKham(bn.id, '11:00');
    expect((await ghiKetQua(lichId, { chan_doan: 'x', thuoc: [{ ten: '  ', so_luong: 1 }] })).status).toBe(400);
    expect((await ghiKetQua(lichId, { chan_doan: 'x', thuoc: [{ ten: 'Oxytocin', so_luong: 0 }] })).status).toBe(400);
  });

  it('hẹn tái khám sau 10 ngày sinh lịch hẹn đúng ngày trong danh sách check-in của lễ tân', async () => {
    const bn = await taoBenhNhan(ds, 'BN hẹn 10 ngày');
    const lichId = await taoLichKham(bn.id, '13:00');
    const res = await ghiKetQua(lichId, { chan_doan: 'Viêm nhẹ', ghi_chu: 'Mang theo kết quả xét nghiệm', tai_kham: { so: 10, don_vi: 'ngay' } });
    expect(res.status).toBe(201);
    expect(res.body.tai_kham.ngay).toBe(ngayISO(10));
    expect(res.body.tai_kham.gio).toBe('08:00');

    const ds10 = await lichNgay(ngayISO(10));
    expect(ds10.status).toBe(200);
    const cua = ds10.body.filter((l: any) => l.ho_so && l.ho_so.id === bn.id);
    expect(cua).toHaveLength(1);
    expect(cua[0].ma_lich_hen).toBe(res.body.tai_kham.ma_lich_hen);
    expect(cua[0].trang_thai).toBe('da_xac_nhan');
    expect(cua[0].khung_gio.bac_si.id).toBe(bsSanId);

    // Hẹn cũng ghi lên hồ sơ nên bác sĩ thấy trong danh sách tái khám của mình
    const tk = await request(http).get('/api/doctor/revisits').set('Authorization', `Bearer ${bacSi}`);
    const dong = tk.body.find((r: any) => r.ho_so_id === bn.id);
    expect(dong).toBeTruthy();
    expect(dong.ngay_tai_kham).toBe(ngayISO(10));
    expect(dong.ghi_chu_tai_kham).toBe('Mang theo kết quả xét nghiệm');
  });

  it('hẹn theo tuần quy ra đúng số ngày', async () => {
    const bn = await taoBenhNhan(ds, 'BN hẹn 2 tuần');
    const lichId = await taoLichKham(bn.id, '14:00');
    const res = await ghiKetQua(lichId, { chan_doan: 'Theo dõi', tai_kham: { so: 2, don_vi: 'tuan' } });
    expect(res.status).toBe(201);
    expect(res.body.tai_kham.ngay).toBe(ngayISO(14));
  });

  it('chặn khoảng hẹn tái khám không hợp lệ', async () => {
    const bn = await taoBenhNhan(ds, 'BN hẹn sai');
    const lichId = await taoLichKham(bn.id, '15:00');
    expect((await ghiKetQua(lichId, { chan_doan: 'x', tai_kham: { so: 0, don_vi: 'ngay' } })).status).toBe(400);
    expect((await ghiKetQua(lichId, { chan_doan: 'x', tai_kham: { so: 2.5, don_vi: 'ngay' } })).status).toBe(400);
    expect((await ghiKetQua(lichId, { chan_doan: 'x', tai_kham: { so: 400, don_vi: 'ngay' } })).status).toBe(400);
    expect((await ghiKetQua(lichId, { chan_doan: 'x', tai_kham: { so: 3, don_vi: 'thang' } })).status).toBe(400);
  });

  it('không hẹn tái khám thì không sinh thêm lịch hẹn nào', async () => {
    const bn = await taoBenhNhan(ds, 'BN không hẹn lại');
    const lichId = await taoLichKham(bn.id, '16:00');
    const res = await ghiKetQua(lichId, { chan_doan: 'Ổn định' });
    expect(res.status).toBe(201);
    expect(res.body.tai_kham).toBeNull();
    const mai = await lichNgay(ngayISO(1));
    expect(mai.body.filter((l: any) => l.ho_so && l.ho_so.id === bn.id)).toHaveLength(0);
  });

  it('lễ tân không được ghi kết quả khám', async () => {
    const bn = await taoBenhNhan(ds, 'BN phân quyền');
    const lichId = await taoLichKham(bn.id, '17:00');
    const res = await request(http).post(`/api/visits/${lichId}/result`)
      .set('Authorization', `Bearer ${leTan}`).send({ chan_doan: 'x' });
    expect([401, 403]).toContain(res.status);
  });
});
