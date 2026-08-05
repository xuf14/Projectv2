import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { khoiTaoApp, lamSachDuLieu, taoNenTang, taoBenhNhan, dangNhap, ngayISO } from './helpers';

// ============================================================================
//  ĐĂNG KÝ KHÁM ONLINE — bệnh nhân gửi phiếu ở trang công khai; lễ tân xác nhận
//  lại (chốt khoa / bác sĩ / ngày giờ) và hệ thống tạo lịch khám thật hiện ở
//  cổng bác sĩ của khoa. Endpoint công khai phải kiểm tra dữ liệu chặt chẽ.
// ============================================================================
describe('Đăng ký khám online → lễ tân xác nhận → lịch của bác sĩ', () => {
  let app: INestApplication;
  let ds: DataSource;
  let http: any;
  let leTan: string;
  let bsSan: string;
  let nen: any;
  let phieuId: number;
  let maDangKy: string;

  const guiDangKy = (body: any) => request(http).post('/api/public/dang-ky-kham').send(body);
  const xacNhan = (id: number, body: any, token = leTan) =>
    request(http).patch(`/api/reception/dang-ky-kham/${id}`).set('Authorization', `Bearer ${token}`).send(body);
  const dsCho = async () => (await request(http).get('/api/reception/dang-ky-kham?trang_thai=cho_tiep_don')
    .set('Authorization', `Bearer ${leTan}`)).body;

  beforeAll(async () => {
    ({ app, ds, http } = await khoiTaoApp());
    await lamSachDuLieu(ds);
    nen = await taoNenTang(ds);
    leTan = await dangNhap(http, 'letan@test.vn');
    bsSan = await dangNhap(http, 'bssan@test.vn');
  });
  afterAll(async () => { await app.close(); });

  it('gửi đăng ký công khai (không đăng nhập) thành công, có mã tra cứu', async () => {
    const res = await guiDangKy({
      ho_ten: 'Nguyễn Thị Đăng Ký', sdt: '0912345678', gioi_tinh: 'Nữ',
      khoa_id: nen.khoaSan.id, ngay_mong_muon: ngayISO(2), gio_mong_muon: '09:30',
      ly_do: 'Khám thai định kỳ',
    });
    expect(res.status).toBe(201);
    expect(res.body.ma_dang_ky).toMatch(/^DK\d{8}$/);
    expect(res.body.trang_thai).toBe('cho_tiep_don');
    maDangKy = res.body.ma_dang_ky;
  });

  it('từ chối dữ liệu không hợp lệ ở endpoint công khai', async () => {
    const khoa = nen.khoaSan.id;
    expect((await guiDangKy({ ho_ten: 'A', sdt: '0912345678', khoa_id: khoa })).status).toBe(400);          // tên quá ngắn
    expect((await guiDangKy({ ho_ten: 'Nguyễn Văn B', sdt: '123', khoa_id: khoa })).status).toBe(400);      // sđt không hợp lệ
    expect((await guiDangKy({ ho_ten: 'Nguyễn Văn B', sdt: '0912345678', khoa_id: khoa, email: 'sai-email' })).status).toBe(400);
    expect((await guiDangKy({ ho_ten: 'Nguyễn Văn B', sdt: '0912345678', khoa_id: khoa, ngay_mong_muon: ngayISO(-2) })).status).toBe(400);
    expect((await guiDangKy({ ho_ten: 'Nguyễn Văn B', sdt: '0912345678', khoa_id: khoa, ngay_mong_muon: ngayISO(1), gio_mong_muon: '21:00' })).status).toBe(400);
    expect((await guiDangKy({ ho_ten: 'Nguyễn Văn B', sdt: '0912345678', khoa_id: 999999 })).status).toBe(400);
  });

  it('khoa là trường bắt buộc', async () => {
    const thieuKhoa = await guiDangKy({ ho_ten: 'Nguyễn Văn B', sdt: '0912345678' });
    expect(thieuKhoa.status).toBe(400);
    expect(thieuKhoa.body.message).toContain('chọn khoa');
    expect((await guiDangKy({ ho_ten: 'Nguyễn Văn B', sdt: '0912345678', khoa_id: '' })).status).toBe(400);
  });

  it('chặn spam: một số điện thoại chỉ được tối đa 5 phiếu chờ', async () => {
    const spam = { ho_ten: 'Người gửi nhiều lần', sdt: '0999888777', khoa_id: nen.khoaSan.id };
    for (let i = 0; i < 4; i++) {
      expect((await guiDangKy(spam)).status).toBe(201);
    }
    expect((await guiDangKy(spam)).status).toBe(201); // phiếu thứ 5
    const res = await guiDangKy(spam);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('quá nhiều phiếu');
  });

  it('lễ tân thấy phiếu trong hàng chờ kèm ngày/giờ mong muốn', async () => {
    const data = await dsCho();
    const p = data.danh_sach.find((x: any) => x.ma_dang_ky === maDangKy);
    expect(p).toBeDefined();
    expect(p.gio_mong_muon).toBe('09:30');
    expect(p.khoa.ten_khoa).toBe('Khoa Sản');
    expect(data.cho_tiep_don).toBeGreaterThan(0);
    phieuId = p.id;
  });

  it('xác nhận thiếu bác sĩ / ngày / giờ đều bị từ chối', async () => {
    expect((await xacNhan(phieuId, { trang_thai: 'da_tiep_nhan' })).status).toBe(400);
    expect((await xacNhan(phieuId, { trang_thai: 'da_tiep_nhan', bac_si_id: nen.bsSan.id })).status).toBe(400);
    expect((await xacNhan(phieuId, { trang_thai: 'da_tiep_nhan', bac_si_id: nen.bsSan.id, ngay_kham: ngayISO(2) })).status).toBe(400);
    expect((await xacNhan(phieuId, { trang_thai: 'da_tiep_nhan', bac_si_id: nen.bsSan.id, ngay_kham: ngayISO(-1), gio_kham: '09:30' })).status).toBe(400);
  });

  it('chặn xếp bác sĩ không thuộc khoa đã chọn', async () => {
    const res = await xacNhan(phieuId, {
      trang_thai: 'da_tiep_nhan', khoa_id: nen.khoaSan.id, bac_si_id: nen.bsIvf.id,
      ngay_kham: ngayISO(2), gio_kham: '09:30',
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('không thuộc khoa');
  });

  it('xác nhận hợp lệ → tạo hồ sơ bệnh nhân + lịch khám đã xác nhận', async () => {
    const res = await xacNhan(phieuId, {
      trang_thai: 'da_tiep_nhan', khoa_id: nen.khoaSan.id, bac_si_id: nen.bsSan.id,
      ngay_kham: ngayISO(2), gio_kham: '09:30', ghi_chu_le_tan: 'Đã gọi xác nhận',
    });
    expect(res.status).toBe(200);
    expect(res.body.trang_thai).toBe('da_tiep_nhan');
    expect(res.body.ho_so.ma_benh_nhan).toMatch(/^BN\d+/);
    expect(res.body.lich_hen.ngay).toBe(ngayISO(2));
    expect(res.body.lich_hen.gio).toBe('09:30');
    expect(res.body.lich_hen.trang_thai).toBe('da_xac_nhan');
  });

  it('lịch xuất hiện ở cổng bác sĩ được xếp và bác sĩ nhận thông báo', async () => {
    const up = await request(http).get('/api/doctor/upcoming').set('Authorization', `Bearer ${bsSan}`);
    expect(up.status).toBe(200);
    const lich = up.body.find((x: any) => x.benh_nhan === 'Nguyễn Thị Đăng Ký');
    expect(lich).toBeDefined();
    expect(lich.gio).toBe('09:30');
    expect(lich.khoa).toBe('Khoa Sản');

    const tb = await request(http).get('/api/notifications').set('Authorization', `Bearer ${bsSan}`);
    expect(tb.body.some((t: any) => t.loai === 'lich_kham' && t.ma_lich_hen === lich.ma_lich_hen)).toBe(true);
  });

  it('bác sĩ khoa khác không thấy lịch này', async () => {
    const bsIvf = await dangNhap(http, 'bsivf@test.vn');
    const up = await request(http).get('/api/doctor/upcoming').set('Authorization', `Bearer ${bsIvf}`);
    expect(up.body.some((x: any) => x.benh_nhan === 'Nguyễn Thị Đăng Ký')).toBe(false);
  });

  it('phiếu đã xử lý không xử lý lại được', async () => {
    const res = await xacNhan(phieuId, { trang_thai: 'da_huy' });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('đã được xử lý');
  });

  it('bệnh nhân cũ: gắn hồ sơ sẵn có thay vì tạo hồ sơ trùng', async () => {
    const cu = await taoBenhNhan(ds, 'Bệnh nhân đã từng khám');
    const gui = await guiDangKy({ ho_ten: cu.ho_ten, sdt: '0911222333', khoa_id: nen.khoaSan.id, benh_nhan_cu: true, ma_benh_nhan_cu: cu.ma_benh_nhan });
    const p = (await dsCho()).danh_sach.find((x: any) => x.ma_dang_ky === gui.body.ma_dang_ky);

    const truoc = await ds.query('SELECT COUNT(*)::int AS n FROM ho_so_benh_nhan');
    const res = await xacNhan(p.id, {
      trang_thai: 'da_tiep_nhan', bac_si_id: nen.bsSan.id, ngay_kham: ngayISO(1), gio_kham: '14:00', ho_so_id: cu.id,
    });
    const sau = await ds.query('SELECT COUNT(*)::int AS n FROM ho_so_benh_nhan');
    expect(res.status).toBe(200);
    expect(res.body.ho_so.id).toBe(cu.id);
    expect(sau[0].n).toBe(truoc[0].n);   // không sinh hồ sơ mới
  });

  it('hủy phiếu không tạo lịch khám', async () => {
    const gui = await guiDangKy({ ho_ten: 'Phiếu sẽ bị hủy', sdt: '0900111222', khoa_id: nen.khoaSan.id });
    const p = (await dsCho()).danh_sach.find((x: any) => x.ma_dang_ky === gui.body.ma_dang_ky);
    const res = await xacNhan(p.id, { trang_thai: 'da_huy', ghi_chu_le_tan: 'Số điện thoại không liên hệ được' });
    expect(res.status).toBe(200);
    expect(res.body.trang_thai).toBe('da_huy');
    expect(res.body.lich_hen).toBeNull();
  });
});
