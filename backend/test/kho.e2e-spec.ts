import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { khoiTaoApp, lamSachDuLieu, taoNenTang, taoBenhNhan, dangNhap } from './helpers';
import { TonKho, Thuoc, VatTuTieuHao } from '../src/entities';

// ============================================================================
//  KHO — tủ thuốc và tủ vật tư tiêu hao. Lập phiếu y lệnh phải TRỪ đúng số
//  lượng khỏi thẻ kho; thiếu tồn thì hủy cả phiếu (không được lưu nửa vời).
//  Giá trị tồn kho = đơn giá vốn × số lượng, do server tính.
// ============================================================================
describe('Tồn kho tủ thuốc & tủ vật tư', () => {
  let app: INestApplication;
  let ds: DataSource;
  let http: any;
  let leTan: string;
  let admin: string;
  let bacSi: string;
  let phieuKhamId: number;

  const xemTon = (qs = '', token?: string) =>
    request(http).get(`/api/kho/ton${qs}`).set('Authorization', `Bearer ${token || leTan}`);
  const nhap = (body: any, token?: string) =>
    request(http).post('/api/kho/nhap').set('Authorization', `Bearer ${token || leTan}`).send(body);
  const dieuChinh = (body: any, token?: string) =>
    request(http).post('/api/kho/dieu-chinh').set('Authorization', `Bearer ${token || admin}`).send(body);
  const lapYLenh = (chi_tiet: any[]) =>
    request(http).post('/api/reception/y-lenh').set('Authorization', `Bearer ${leTan}`)
      .send({ phieu_kham_id: phieuKhamId, chi_tiet });
  const soLuong = async (loai: string, ma: string) =>
    (await ds.getRepository(TonKho).findOne({ where: { loai, ma } })).so_luong;

  beforeAll(async () => {
    ({ app, ds, http } = await khoiTaoApp());
    await lamSachDuLieu(ds);
    await taoNenTang(ds);
    leTan = await dangNhap(http, 'letan@test.vn');
    admin = await dangNhap(http, 'admin@test.vn');
    bacSi = await dangNhap(http, 'bssan@test.vn');

    const bn = await taoBenhNhan(ds, 'Vũ Thị Tồn Kho');
    const pk = await request(http).post('/api/reception/exam-sheets').set('Authorization', `Bearer ${leTan}`)
      .send({ ten_bn: bn.ho_ten, ho_so_id: bn.id });
    phieuKhamId = pk.body.id;

    // Danh mục + thẻ kho tương ứng: 1 thuốc, 1 vật tư (bản thật do npm run seed:kho nạp)
    const thuocRepo = ds.getRepository(Thuoc);
    await thuocRepo.save(thuocRepo.create({
      ma_thuoc: 'TH01', hoat_chat: 'Oxytocin', nhom: 'Thuốc co hồi tử cung',
      kiem_soat: 'Nguy cơ cao', dvt: 'Ống', don_gia: 0, hoat_dong: true,
    }));
    const vtRepo = ds.getRepository(VatTuTieuHao);
    await vtRepo.save(vtRepo.create({
      ma_vt: 'VT1', ten: 'Bơm tiêm 5ml', nhom_id: 1, nhom_ten: 'Vật tư khám',
      khoa: ['san'], dvt: 'Cái', don_gia: 0, hoat_dong: true,
    }));

    const repo = ds.getRepository(TonKho);
    await repo.save(repo.create({ loai: 'thuoc', ma: 'TH01', ten: 'Oxytocin', dvt: 'Ống', don_gia: 12000, so_luong: 0, ton_toi_thieu: 5 }));
    await repo.save(repo.create({ loai: 'vat_tu', ma: 'VT1', ten: 'Bơm tiêm 5ml', dvt: 'Cái', don_gia: 2000, so_luong: 0, ton_toi_thieu: 10 }));
  });
  afterAll(async () => { await app.close(); });

  it('nhập kho cộng đúng số lượng; admin đặt được đơn giá trong phiếu nhập', async () => {
    const res = await nhap({
      ghi_chu: 'Nhập đầu kỳ',
      dong: [
        { loai: 'thuoc', ma: 'TH01', so_luong: 50, don_gia: 15000 },
        { loai: 'vat_tu', ma: 'VT1', so_luong: 100 },
      ],
    }, admin);
    expect(res.status).toBe(201);
    expect(res.body.so_dong).toBe(2);
    expect(await soLuong('thuoc', 'TH01')).toBe(50);
    expect(await soLuong('vat_tu', 'VT1')).toBe(100);

    const ton = await xemTon();
    const th = ton.body.items.find((i: any) => i.ma === 'TH01');
    expect(th.don_gia).toBe(15000);            // đơn giá theo lần nhập gần nhất của admin
    expect(th.gia_tri).toBe(50 * 15000);
    // Tổng giá trị tồn = 50×15000 + 100×2000
    expect(ton.body.tong_hop.tong_gia_tri).toBe(950000);
    expect(ton.body.tong_hop.thuoc.tong_gia_tri).toBe(750000);
    expect(ton.body.tong_hop.vat_tu.tong_gia_tri).toBe(200000);
  });

  it('lập phiếu y lệnh trừ tồn của cả tủ thuốc và tủ vật tư', async () => {
    const res = await lapYLenh([
      { loai: 'thuoc', ma_vt: 'TH01', ten: 'Oxytocin', so_luong: 10, don_gia: 20000 },
      { loai: 'vat_tu', ma_vt: 'VT1', ten: 'Bơm tiêm 5ml', so_luong: 25, don_gia: 3000 },
      { loai: 'dich_vu', ten: 'Siêu âm', so_luong: 1, don_gia: 200000 },
    ]);
    expect(res.status).toBe(201);
    expect(res.body.kho.da_xuat).toHaveLength(2);
    expect(await soLuong('thuoc', 'TH01')).toBe(40);
    expect(await soLuong('vat_tu', 'VT1')).toBe(75);

    // Nhật ký kho ghi lại lần xuất kèm mã phiếu
    const nk = await request(http).get('/api/kho/nhat-ky?loai_gd=xuat').set('Authorization', `Bearer ${leTan}`);
    expect(nk.body[0].ma_phieu).toBe(res.body.ma_phieu);
    expect(nk.body[0].so_luong).toBeLessThan(0);
  });

  it('gộp nhiều dòng cùng mặt hàng trước khi trừ', async () => {
    const truoc = await soLuong('vat_tu', 'VT1');
    const res = await lapYLenh([
      { loai: 'vat_tu', ma_vt: 'VT1', ten: 'Bơm tiêm 5ml', so_luong: 5, don_gia: 3000 },
      { loai: 'vat_tu', ma_vt: 'VT1', ten: 'Bơm tiêm 5ml', so_luong: 7, don_gia: 3000 },
    ]);
    expect(res.status).toBe(201);
    expect(res.body.kho.da_xuat).toHaveLength(1);
    expect(await soLuong('vat_tu', 'VT1')).toBe(truoc - 12);
  });

  it('thiếu tồn thì từ chối và KHÔNG lưu phiếu, không trừ mặt hàng nào', async () => {
    const thuocTruoc = await soLuong('thuoc', 'TH01');
    const vatTuTruoc = await soLuong('vat_tu', 'VT1');
    const demPhieu = async () =>
      (await request(http).get('/api/reception/y-lenh').set('Authorization', `Bearer ${leTan}`)).body.length;
    const soPhieuTruoc = await demPhieu();

    const res = await lapYLenh([
      { loai: 'thuoc', ma_vt: 'TH01', ten: 'Oxytocin', so_luong: 1, don_gia: 20000 },
      { loai: 'vat_tu', ma_vt: 'VT1', ten: 'Bơm tiêm 5ml', so_luong: 9999, don_gia: 3000 },
    ]);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Không đủ tồn kho');
    expect(await soLuong('thuoc', 'TH01')).toBe(thuocTruoc);   // transaction rollback
    expect(await soLuong('vat_tu', 'VT1')).toBe(vatTuTruoc);
    expect(await demPhieu()).toBe(soPhieuTruoc);
  });

  it('dòng nhập tay không thuộc danh mục thì không theo dõi tồn', async () => {
    const res = await lapYLenh([
      { loai: 'thuoc', ten: 'Thuốc ngoài danh mục', so_luong: 3, don_gia: 5000 },
      { loai: 'vat_tu', ma_vt: 'KHONG-CO-THAT', ten: 'Vật tư lạ', so_luong: 2, don_gia: 1000 },
    ]);
    expect(res.status).toBe(201);
    expect(res.body.kho.da_xuat).toHaveLength(0);
    expect(res.body.kho.khong_theo_doi).toHaveLength(2);
  });

  it('cảnh báo sắp hết và bộ lọc sap_het', async () => {
    await dieuChinh({ loai: 'thuoc', ma: 'TH01', so_luong_moi: 3, ly_do: 'Kiểm kê cuối tháng' });
    expect(await soLuong('thuoc', 'TH01')).toBe(3);           // ton_toi_thieu = 5
    const ton = await xemTon('?sap_het=1');
    expect(ton.body.items.map((i: any) => i.ma)).toContain('TH01');
    expect(ton.body.items.find((i: any) => i.ma === 'TH01').canh_bao).toBe('sap_het');
  });

  it('chặn tham số nhập kho không hợp lệ', async () => {
    expect((await nhap({ dong: [] })).status).toBe(400);
    expect((await nhap({ dong: [{ loai: 'tu_lanh', ma: 'TH01', so_luong: 1 }] })).status).toBe(400);
    expect((await nhap({ dong: [{ loai: 'thuoc', ma: 'TH01', so_luong: 0 }] })).status).toBe(400);
    expect((await nhap({ dong: [{ loai: 'thuoc', ma: 'TH01', so_luong: -5 }] })).status).toBe(400);
    expect((await nhap({ dong: [{ loai: 'thuoc', ma: 'TH01', so_luong: 1, don_gia: -1 }] }, admin)).status).toBe(400);
    // Lặp mặt hàng trong cùng phiếu → chặn để không cộng hai lần
    expect((await nhap({ dong: [{ loai: 'thuoc', ma: 'TH01', so_luong: 1 }, { loai: 'thuoc', ma: 'TH01', so_luong: 2 }] })).status).toBe(400);
    // Mặt hàng chưa mở thẻ kho
    expect((await nhap({ dong: [{ loai: 'thuoc', ma: 'TH99', so_luong: 1 }] })).status).toBe(404);
  });

  it('điều chỉnh kiểm kê bắt buộc có lý do và chỉ dành cho quản trị viên', async () => {
    expect((await dieuChinh({ loai: 'thuoc', ma: 'TH01', so_luong_moi: 10, ly_do: '' })).status).toBe(400);
    expect((await dieuChinh({ loai: 'thuoc', ma: 'TH01', so_luong_moi: -1, ly_do: 'x' })).status).toBe(400);
    const res = await dieuChinh({ loai: 'thuoc', ma: 'TH01', so_luong_moi: 10, ly_do: 'Kiểm kê' }, leTan);
    expect([401, 403]).toContain(res.status);
  });

  it('lễ tân chỉ được nhập số lượng, không được đặt đơn giá', async () => {
    const giaTruoc = (await xemTon('?loai=thuoc')).body.items.find((i: any) => i.ma === 'TH01').don_gia;
    const tonTruoc = await soLuong('thuoc', 'TH01');

    // Gửi kèm đơn giá → bị từ chối, không cộng số lượng nào
    const chan = await nhap({ dong: [{ loai: 'thuoc', ma: 'TH01', so_luong: 10, don_gia: 99000 }] }, leTan);
    expect([401, 403]).toContain(chan.status);
    expect(await soLuong('thuoc', 'TH01')).toBe(tonTruoc);

    // Chỉ gửi số lượng → nhập được, đơn giá giữ nguyên
    const ok = await nhap({ dong: [{ loai: 'thuoc', ma: 'TH01', so_luong: 10 }] }, leTan);
    expect(ok.status).toBe(201);
    expect(await soLuong('thuoc', 'TH01')).toBe(tonTruoc + 10);
    const sau = (await xemTon('?loai=thuoc')).body.items.find((i: any) => i.ma === 'TH01');
    expect(sau.don_gia).toBe(giaTruoc);

    // Sửa giá là quyền riêng của quản trị viên
    const suaGia = await request(http).post('/api/kho/gia').set('Authorization', `Bearer ${leTan}`)
      .send({ loai: 'thuoc', ma: 'TH01', don_gia: 99000 });
    expect([401, 403]).toContain(suaGia.status);
    expect((await xemTon('?loai=thuoc')).body.items.find((i: any) => i.ma === 'TH01').don_gia).toBe(giaTruoc);
  });

  it('sửa đơn giá kho: đổi giá, giữ nguyên số lượng, ghi vào nhật ký', async () => {
    const truoc = await soLuong('vat_tu', 'VT1');
    const res = await request(http).post('/api/kho/gia').set('Authorization', `Bearer ${admin}`)
      .send({ loai: 'vat_tu', ma: 'VT1', don_gia: 3500, ly_do: 'Nhà cung cấp tăng giá' });
    expect(res.status).toBe(201);
    expect(res.body.don_gia_cu).toBe(2000);
    expect(res.body.don_gia).toBe(3500);
    expect(await soLuong('vat_tu', 'VT1')).toBe(truoc);          // không đụng tồn

    const ton = await xemTon('?loai=vat_tu');
    const vt = ton.body.items.find((i: any) => i.ma === 'VT1');
    expect(vt.gia_tri).toBe(Math.round(3500 * truoc));

    const nk = await request(http).get('/api/kho/nhat-ky?loai_gd=sua_gia').set('Authorization', `Bearer ${leTan}`);
    expect(nk.body[0].ghi_chu).toContain('2000đ → 3500đ');
    expect(nk.body[0].ton_truoc).toBe(nk.body[0].ton_sau);
  });

  it('chặn đơn giá không hợp lệ hoặc trùng giá cũ', async () => {
    const gia = (b: any) =>
      request(http).post('/api/kho/gia').set('Authorization', `Bearer ${admin}`).send(b);
    expect((await gia({ loai: 'vat_tu', ma: 'VT1', don_gia: -1 })).status).toBe(400);
    expect((await gia({ loai: 'vat_tu', ma: 'VT1', don_gia: 'abc' })).status).toBe(400);
    expect((await gia({ loai: 'vat_tu', ma: 'VT1', don_gia: 3500 })).status).toBe(400);  // trùng giá hiện tại
    expect((await gia({ loai: 'vat_tu', ma: 'KHONG-CO', don_gia: 100 })).status).toBe(404);
  });

  it('danh mục thuốc & vật tư trả về đơn giá và tồn lấy từ thẻ kho', async () => {
    const thuoc = await request(http).get('/api/catalog/thuoc').set('Authorization', `Bearer ${leTan}`);
    const th01 = thuoc.body.find((t: any) => t.ma_thuoc === 'TH01');
    expect(th01.don_gia).toBe(15000);                 // giá từ ton_kho, không phải giá danh mục
    expect(th01.ton).toBe(await soLuong('thuoc', 'TH01'));

    const vatTu = await request(http).get('/api/catalog/vat-tu').set('Authorization', `Bearer ${leTan}`);
    const vt1 = vatTu.body.find((v: any) => v.ma_vt === 'VT1');
    expect(vt1.don_gia).toBe(3500);
    expect(vt1.ton).toBe(await soLuong('vat_tu', 'VT1'));
  });

  it('bác sĩ không được xem hoặc nhập kho', async () => {
    expect([401, 403]).toContain((await xemTon('', bacSi)).status);
    expect([401, 403]).toContain((await nhap({ dong: [{ loai: 'thuoc', ma: 'TH01', so_luong: 1 }] }, bacSi)).status);
  });
});
