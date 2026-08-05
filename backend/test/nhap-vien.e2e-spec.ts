import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { khoiTaoApp, lamSachDuLieu, taoNenTang, taoBenhNhan, dangNhap, ngayISO } from './helpers';

// ============================================================================
//  NHẬP VIỆN "MỘT CHẠM" — ba điểm kiểm soát của đặc tả:
//    1. Bác sĩ ký yêu cầu ngay tại bước 5 kết luận (cùng transaction)
//    2. Lễ tân tiếp nhận → xác minh → xác nhận: số vào viện + khóa giường
//    3. Bác sĩ của khoa xác nhận đã tiếp nhận người bệnh
//  Kiểm tra kèm: chống trùng yêu cầu/đợt nội trú, xung đột giường, phân quyền,
//  và giường được trả lại khi bệnh nhân ra viện.
// ============================================================================
describe('Quy trình nhập viện một chạm', () => {
  let app: INestApplication;
  let ds: DataSource;
  let http: any;
  let leTan: string;
  let bacSi: string;
  let bacSiIvf: string;
  let admin: string;
  let bsSanId: number;
  let khoaSanId: number;
  let giuongA: number;
  let giuongB: number;

  const taoLichKham = async (hoSoId: number, gio: string) => {
    const r = await request(http).post('/api/reception/new-exam').set('Authorization', `Bearer ${leTan}`)
      .send({ ho_so_id: hoSoId, bac_si_id: bsSanId, ngay: ngayISO(0), gio });
    expect(r.status).toBe(201);
    return r.body.id as number;
  };
  const ketLuan = (lichId: number, body: any) =>
    request(http).post(`/api/encounters/${lichId}/conclusion`).set('Authorization', `Bearer ${bacSi}`).send(body);
  const deNghiNhapVien = (lichId: number, nv: any = {}, chanDoan = 'Tiền sản giật') =>
    ketLuan(lichId, { chan_doan_chinh: chanDoan, huong_xu_tri: 'de_nghi_nhap_vien', nhap_vien: nv });
  const hangCho = (qs = '') =>
    request(http).get(`/api/nhap-vien/hang-cho${qs}`).set('Authorization', `Bearer ${leTan}`);
  const xacNhan = (id: number, body: any, token = leTan) =>
    request(http).post(`/api/nhap-vien/${id}/xac-nhan`).set('Authorization', `Bearer ${token}`).send(body);

  // Một bệnh nhân mới đi hết đoạn bác sĩ ký → trả về id yêu cầu nhập viện
  const yeuCauMoi = async (ten: string, gio: string, nv: any = {}) => {
    const bn = await taoBenhNhan(ds, ten);
    const lichId = await taoLichKham(bn.id, gio);
    const kl = await deNghiNhapVien(lichId, nv);
    expect(kl.status).toBe(201);
    return { bn, lichId, yeuCauId: kl.body.nhap_vien.id as number, ma: kl.body.nhap_vien.ma_yeu_cau as string };
  };

  beforeAll(async () => {
    ({ app, ds, http } = await khoiTaoApp());
    await lamSachDuLieu(ds);
    const nen = await taoNenTang(ds);
    bsSanId = nen.bsSan.id;
    khoaSanId = nen.khoaSan.id;
    leTan = await dangNhap(http, 'letan@test.vn');
    bacSi = await dangNhap(http, 'bssan@test.vn');
    bacSiIvf = await dangNhap(http, 'bsivf@test.vn');
    admin = await dangNhap(http, 'admin@test.vn');

    // Danh mục giường do quản trị viên cấu hình
    for (const ma of ['P201-G1', 'P201-G2']) {
      const r = await request(http).post('/api/admin/giuong').set('Authorization', `Bearer ${admin}`)
        .send({ khoa_id: khoaSanId, phong: 'P201', ma });
      expect(r.status).toBe(201);
      if (ma === 'P201-G1') giuongA = r.body.id; else giuongB = r.body.id;
    }
  });
  afterAll(async () => { await app.close(); });

  it('lễ tân không được cấu hình danh mục giường', async () => {
    const r = await request(http).post('/api/admin/giuong').set('Authorization', `Bearer ${leTan}`)
      .send({ khoa_id: khoaSanId, phong: 'P999', ma: 'P999-G1' });
    expect([401, 403]).toContain(r.status);
  });

  it('bác sĩ ký ở bước 5 sinh yêu cầu và báo ngay cho lễ tân', async () => {
    const { bn, ma } = await yeuCauMoi('BN nhập viện chuẩn', '08:00', {
      uu_tien: 'khan', ly_do_uu_tien: 'Huyết áp 170/110', canh_bao: 'Dị ứng Penicillin',
      ly_do: 'Tiền sản giật nặng', ho_tro_di_chuyen: 'xe_lan',
    });

    const hc = await hangCho();
    expect(hc.status).toBe(200);
    const dong = hc.body.find((y: any) => y.ma_yeu_cau === ma);
    expect(dong).toMatchObject({
      trang_thai: 'cho_tiep_nhan', uu_tien: 'khan', ly_do: 'Tiền sản giật nặng',
      canh_bao: 'Dị ứng Penicillin', ho_tro_di_chuyen: 'xe_lan', phien_ban: 1,
    });
    expect(dong.ho_so.ma_benh_nhan).toBe(bn.ma_benh_nhan);
    expect(dong.khoa.id).toBe(khoaSanId);           // mặc định theo khoa của lần khám
    expect(dong.chan_doan_chinh).toBe('Tiền sản giật'); // tự lấy từ kết luận, không nhập lại

    const tb = await request(http).get('/api/notifications').set('Authorization', `Bearer ${leTan}`);
    expect(tb.body.some((t: any) => t.loai === 'nhap_vien' && String(t.noi_dung).includes(ma))).toBe(true);
  });

  it('cấp cứu/khẩn thiếu lý do ưu tiên thì hủy cả kết luận lẫn yêu cầu', async () => {
    const bn = await taoBenhNhan(ds, 'BN thiếu lý do ưu tiên');
    const lichId = await taoLichKham(bn.id, '09:00');
    const res = await deNghiNhapVien(lichId, { uu_tien: 'cap_cuu' });
    expect(res.status).toBe(400);
    // Cùng transaction: kết luận cũng không được lưu
    const flow = await request(http).get(`/api/encounters/${lichId}/flow`).set('Authorization', `Bearer ${bacSi}`);
    expect(flow.body.ket_luan).toBeNull();
    expect(flow.body.nhap_vien).toBeNull();
  });

  it('nhập viện theo lịch phải có ngày dự kiến hợp lệ', async () => {
    const bn = await taoBenhNhan(ds, 'BN theo lịch');
    const lichId = await taoLichKham(bn.id, '09:30');
    expect((await deNghiNhapVien(lichId, { uu_tien: 'theo_lich' })).status).toBe(400);
    expect((await deNghiNhapVien(lichId, { uu_tien: 'theo_lich', ngay_du_kien: ngayISO(-2) })).status).toBe(400);
    const ok = await deNghiNhapVien(lichId, { uu_tien: 'theo_lich', ngay_du_kien: ngayISO(3) });
    expect(ok.status).toBe(201);
  });

  it('ký lại trên cùng lần khám tạo phiên bản mới, không tạo yêu cầu thứ hai', async () => {
    const bn = await taoBenhNhan(ds, 'BN ký lại');
    const lichId = await taoLichKham(bn.id, '10:00');
    const lan1 = await deNghiNhapVien(lichId, {}, 'Dọa sinh non');
    const lan2 = await deNghiNhapVien(lichId, { ly_do: 'Dọa sinh non 32 tuần' }, 'Dọa sinh non');
    expect(lan2.status).toBe(201);
    expect(lan2.body.nhap_vien.id).toBe(lan1.body.nhap_vien.id);
    expect(lan2.body.nhap_vien.phien_ban).toBe(2);
    expect(lan2.body.nhap_vien.moi).toBe(false);

    const hc = await hangCho();
    expect(hc.body.filter((y: any) => y.ho_so.id === bn.id)).toHaveLength(1);
    const flow = await request(http).get(`/api/encounters/${lichId}/flow`).set('Authorization', `Bearer ${bacSi}`);
    expect(flow.body.nhap_vien.ly_do).toBe('Dọa sinh non 32 tuần');
  });

  it('hai nhân viên không cùng xử lý một yêu cầu', async () => {
    const { yeuCauId } = await yeuCauMoi('BN tranh chấp tiếp nhận', '10:30');
    const nhan = await request(http).post(`/api/nhap-vien/${yeuCauId}/tiep-nhan`)
      .set('Authorization', `Bearer ${leTan}`).send({});
    expect(nhan.status).toBe(201);
    expect(nhan.body.trang_thai).toBe('dang_xac_minh');
    expect(nhan.body.nguoi_tiep_nhan.ho_ten).toBe('Lễ tân Test');

    const nguoiKhac = await request(http).post(`/api/nhap-vien/${yeuCauId}/tiep-nhan`)
      .set('Authorization', `Bearer ${admin}`).send({});
    expect(nguoiKhac.status).toBe(409);
  });

  it('xác nhận nhập viện sinh số vào viện, khóa giường và báo khoa', async () => {
    const { bn, yeuCauId } = await yeuCauMoi('BN vào giường A', '11:00');
    await request(http).post(`/api/nhap-vien/${yeuCauId}/tiep-nhan`).set('Authorization', `Bearer ${leTan}`).send({});

    const xm = await request(http).patch(`/api/nhap-vien/${yeuCauId}/xac-minh`)
      .set('Authorization', `Bearer ${leTan}`)
      .send({ doi_tuong_tt: 'bhyt', bhyt_trang_thai: 'hop_le', ghi_chu_tiep_nhan: 'Đã đối chiếu CCCD' });
    expect(xm.status).toBe(200);
    expect(xm.body).toMatchObject({ doi_tuong_tt: 'bhyt', bhyt_trang_thai: 'hop_le' });

    // Chưa chọn giường thì không xác nhận được
    expect((await xacNhan(yeuCauId, {})).status).toBe(400);

    const nv = await xacNhan(yeuCauId, { giuong_id: giuongA });
    expect(nv.status).toBe(201);
    expect(nv.body.so_vao_vien).toMatch(/^VV/);
    expect(nv.body.giuong.id).toBe(giuongA);
    expect(nv.body.khoa.id).toBe(khoaSanId);
    expect(nv.body.ho_so.id).toBe(bn.id);

    const ct = await request(http).get(`/api/nhap-vien/${yeuCauId}`).set('Authorization', `Bearer ${leTan}`);
    expect(ct.body.trang_thai).toBe('da_nhap_vien');

    const g = await request(http).get(`/api/giuong?khoa_id=${khoaSanId}`).set('Authorization', `Bearer ${leTan}`);
    expect(g.body.items.find((x: any) => x.id === giuongA).trang_thai).toBe('dang_dung');
    // Giường đang dùng không nằm trong danh sách giường trống
    const trong = await request(http).get('/api/giuong?trong=1').set('Authorization', `Bearer ${leTan}`);
    expect(trong.body.items.some((x: any) => x.id === giuongA)).toBe(false);
  });

  it('bấm xác nhận nhiều lần không tạo thêm đợt nội trú', async () => {
    const { yeuCauId } = await yeuCauMoi('BN bấm hai lần', '11:30');
    const lan1 = await xacNhan(yeuCauId, { giuong_id: giuongB });
    expect(lan1.status).toBe(201);
    const lan2 = await xacNhan(yeuCauId, { giuong_id: giuongB });
    expect(lan2.status).toBe(201);
    expect(lan2.body.so_vao_vien).toBe(lan1.body.so_vao_vien);
    expect(lan2.body.id).toBe(lan1.body.id);

    const dsNt = await request(http).get('/api/noi-tru').set('Authorization', `Bearer ${leTan}`);
    expect(dsNt.body.filter((d: any) => d.so_vao_vien === lan1.body.so_vao_vien)).toHaveLength(1);
  });

  it('không hai người bệnh nào giữ cùng một giường', async () => {
    const { yeuCauId } = await yeuCauMoi('BN tranh giường', '13:00');
    const r = await xacNhan(yeuCauId, { giuong_id: giuongB });   // giuongB đang có người
    expect(r.status).toBe(409);
    const ct = await request(http).get(`/api/nhap-vien/${yeuCauId}`).set('Authorization', `Bearer ${leTan}`);
    expect(ct.body.trang_thai).not.toBe('da_nhap_vien');
    expect(ct.body.noi_tru).toBeNull();
  });

  it('chỉ bác sĩ của khoa nhận bệnh mới xác nhận tiếp nhận tại khoa', async () => {
    const dsNt = await request(http).get('/api/noi-tru?trang_thai=dang_dieu_tri')
      .set('Authorization', `Bearer ${leTan}`);
    const dot = dsNt.body[0];
    expect(dot).toBeTruthy();

    // Lễ tân không phải người của khoa
    const cuaLeTan = await request(http).post(`/api/noi-tru/${dot.id}/khoa-nhan`)
      .set('Authorization', `Bearer ${leTan}`).send({});
    expect([401, 403]).toContain(cuaLeTan.status);

    // Bác sĩ khoa IVF không nhận người bệnh của khoa Sản
    const khoaKhac = await request(http).post(`/api/noi-tru/${dot.id}/khoa-nhan`)
      .set('Authorization', `Bearer ${bacSiIvf}`).send({});
    expect(khoaKhac.status).toBe(403);

    const nhan = await request(http).post(`/api/noi-tru/${dot.id}/khoa-nhan`)
      .set('Authorization', `Bearer ${bacSi}`).send({});
    expect(nhan.status).toBe(201);
    expect(nhan.body.thoi_gian_khoa_nhan).toBeTruthy();
    expect(nhan.body.nguoi_khoa_nhan).toBe('BS Sản Test');

    const ct = await request(http).get(`/api/nhap-vien/${dot.yeu_cau.id}`).set('Authorization', `Bearer ${leTan}`);
    expect(ct.body.trang_thai).toBe('khoa_da_nhan');

    // Hàng chờ của lễ tân phải thấy ngay mốc bàn giao mà không cần mở chi tiết
    const hc = await hangCho('?trang_thai=khoa_da_nhan');
    const dong = hc.body.find((y: any) => y.noi_tru && y.noi_tru.so_vao_vien === dot.so_vao_vien);
    expect(dong.noi_tru.thoi_gian_khoa_nhan).toBeTruthy();
    expect(dong.noi_tru.nguoi_khoa_nhan).toBe('BS Sản Test');
    expect(dong.noi_tru.nguoi_lam_thu_tuc).toBe('Lễ tân Test');
  });

  it('bác sĩ chỉ thấy đợt nội trú của khoa mình', async () => {
    const cuaIvf = await request(http).get('/api/noi-tru').set('Authorization', `Bearer ${bacSiIvf}`);
    expect(cuaIvf.status).toBe(200);
    expect(cuaIvf.body).toHaveLength(0);
    const cuaSan = await request(http).get('/api/noi-tru').set('Authorization', `Bearer ${bacSi}`);
    expect(cuaSan.body.length).toBeGreaterThan(0);
  });

  it('đóng yêu cầu phải có lý do và không đóng được khi đã nhập viện', async () => {
    const { yeuCauId } = await yeuCauMoi('BN từ chối nhập viện', '14:00');
    expect((await request(http).post(`/api/nhap-vien/${yeuCauId}/ket-thuc`)
      .set('Authorization', `Bearer ${bacSi}`).send({ trang_thai: 'tu_choi' })).status).toBe(400);

    const huy = await request(http).post(`/api/nhap-vien/${yeuCauId}/ket-thuc`)
      .set('Authorization', `Bearer ${bacSi}`).send({ trang_thai: 'tu_choi', ly_do: 'Người bệnh xin về' });
    expect(huy.status).toBe(201);
    expect(huy.body.trang_thai).toBe('tu_choi');
    // Đã đóng thì không còn trong hàng chờ và không nhập viện được nữa
    expect((await hangCho()).body.some((y: any) => y.id === yeuCauId)).toBe(false);
    expect((await xacNhan(yeuCauId, { giuong_id: giuongA })).status).toBe(400);
  });

  it('ra viện đóng đợt nội trú và trả giường về trống', async () => {
    const { bn, yeuCauId } = await yeuCauMoi('BN ra viện trả giường', '15:00');
    const nv = await xacNhan(yeuCauId, { giuong_id: giuongA });
    expect(nv.status).toBe(409);   // giường A vẫn đang có người từ ca trước
    const g2 = await request(http).post('/api/admin/giuong').set('Authorization', `Bearer ${admin}`)
      .send({ khoa_id: khoaSanId, phong: 'P202', ma: 'P202-G1' });
    const nv2 = await xacNhan(yeuCauId, { giuong_id: g2.body.id });
    expect(nv2.status).toBe(201);

    const rv = await request(http).post('/api/doctor/ra-vien').set('Authorization', `Bearer ${bacSi}`)
      .send({ ho_so_id: bn.id, tinh_trang: 'hoi_phuc', ket_luan_suc_khoe: 'Ổn định' });
    expect(rv.status).toBe(201);
    expect(rv.body.noi_tru.so_vao_vien).toBe(nv2.body.so_vao_vien);

    const g = await request(http).get(`/api/giuong?khoa_id=${khoaSanId}`).set('Authorization', `Bearer ${leTan}`);
    expect(g.body.items.find((x: any) => x.id === g2.body.id).trang_thai).toBe('trong');
    const dsNt = await request(http).get('/api/noi-tru?trang_thai=da_ra_vien').set('Authorization', `Bearer ${leTan}`);
    expect(dsNt.body.some((d: any) => d.so_vao_vien === nv2.body.so_vao_vien)).toBe(true);
  });
});
