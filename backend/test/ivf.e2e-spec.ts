import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { khoiTaoApp, lamSachDuLieu, taoNenTang, taoBenhNhan, dangNhap } from './helpers';

// ============================================================================
//  QUY TRÌNH IVF — chỉ được làm IVF SAU KHI khám lâm sàng và cận lâm sàng
//  (đủ 8 bước khám hiếm muộn), kể cả hồ sơ đăng ký "làm thẳng IVF".
//  Ngoài ra chỉ bác sĩ khoa Hỗ trợ sinh sản mới thao tác được.
// ============================================================================
describe('Quy trình IVF & điều kiện khám lâm sàng/cận lâm sàng', () => {
  let app: INestApplication;
  let ds: DataSource;
  let http: any;
  let bsIvf: string;
  let bsSan: string;
  let hoSoIvfId: number;
  let hoSoLamThangId: number;

  const buoc = (token: string, id: number, giai_doan: string, b: number) =>
    request(http).patch(`/api/ivf/ho-so/${id}/buoc`).set('Authorization', `Bearer ${token}`)
      .send({ giai_doan, buoc: b });

  beforeAll(async () => {
    ({ app, ds, http } = await khoiTaoApp());
    await lamSachDuLieu(ds);
    await taoNenTang(ds);
    bsIvf = await dangNhap(http, 'bsivf@test.vn');
    bsSan = await dangNhap(http, 'bssan@test.vn');

    const bn1 = await taoBenhNhan(ds, 'Lê Thị Hiếm Muộn');
    const bn2 = await taoBenhNhan(ds, 'Phạm Thị Làm Thẳng');
    const r1 = await request(http).post('/api/ivf/ho-so').set('Authorization', `Bearer ${bsIvf}`).send({ ho_so_id: bn1.id });
    hoSoIvfId = r1.body.id;
    const r2 = await request(http).post('/api/ivf/ho-so').set('Authorization', `Bearer ${bsIvf}`)
      .send({ ho_so_id: bn2.id, lam_thang_ivf: true });
    hoSoLamThangId = r2.body.id;
  });
  afterAll(async () => { await app.close(); });

  it('bác sĩ khoa khác không thao tác được hồ sơ IVF', async () => {
    expect((await request(http).get('/api/ivf/ho-so').set('Authorization', `Bearer ${bsSan}`)).body.la_ivf).toBe(false);
    const res = await buoc(bsSan, hoSoIvfId, 'kham_hiem_muon', 1);
    expect(res.status).toBe(403);
  });

  it('hồ sơ mới luôn bắt đầu ở giai đoạn khám hiếm muộn', async () => {
    const res = await request(http).get(`/api/ivf/ho-so/${hoSoIvfId}`).set('Authorization', `Bearer ${bsIvf}`);
    expect(res.body.giai_doan).toBe('kham_hiem_muon');
    expect(res.body.buoc_kham).toEqual([]);
  });

  it('"làm thẳng IVF" vẫn phải vào giai đoạn khám trước (giữ nguyện vọng làm cờ)', async () => {
    const res = await request(http).get(`/api/ivf/ho-so/${hoSoLamThangId}`).set('Authorization', `Bearer ${bsIvf}`);
    expect(res.body.giai_doan).toBe('kham_hiem_muon');
    expect(res.body.lam_thang_ivf).toBe(true);
  });

  it('chặn đánh dấu bước IVF khi chưa khám xong', async () => {
    const res = await buoc(bsIvf, hoSoIvfId, 'ivf', 1);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('khám lâm sàng và cận lâm sàng');
  });

  it('chặn chuyển sang giai đoạn IVF khi chưa khám xong', async () => {
    const res = await request(http).patch(`/api/ivf/ho-so/${hoSoIvfId}/giai-doan`)
      .set('Authorization', `Bearer ${bsIvf}`).send({ giai_doan: 'ivf' });
    expect(res.status).toBe(400);
  });

  it('khám dở dang (7/8 bước) vẫn chưa được làm IVF', async () => {
    for (let i = 1; i <= 7; i++) expect((await buoc(bsIvf, hoSoIvfId, 'kham_hiem_muon', i)).status).toBe(200);
    const ct = await request(http).get(`/api/ivf/ho-so/${hoSoIvfId}`).set('Authorization', `Bearer ${bsIvf}`);
    expect(ct.body.buoc_kham.length).toBe(7);
    expect((await buoc(bsIvf, hoSoIvfId, 'ivf', 1)).status).toBe(400);
  });

  it('đủ 8/8 bước khám → được chuyển giai đoạn và thao tác bước IVF', async () => {
    expect((await buoc(bsIvf, hoSoIvfId, 'kham_hiem_muon', 8)).status).toBe(200);
    const gd = await request(http).patch(`/api/ivf/ho-so/${hoSoIvfId}/giai-doan`)
      .set('Authorization', `Bearer ${bsIvf}`).send({ giai_doan: 'ivf' });
    expect(gd.status).toBe(200);
    expect(gd.body.giai_doan).toBe('ivf');

    const b = await buoc(bsIvf, hoSoIvfId, 'ivf', 1);
    expect(b.status).toBe(200);
    expect(b.body.buoc_ivf).toEqual([1]);
  });

  it('bỏ bớt một bước khám thì bước IVF bị khóa trở lại', async () => {
    expect((await buoc(bsIvf, hoSoIvfId, 'kham_hiem_muon', 8)).status).toBe(200); // toggle → còn 7 bước
    const res = await buoc(bsIvf, hoSoIvfId, 'ivf', 2);
    expect(res.status).toBe(400);
  });

  it('số bước ngoài phạm vi bị từ chối', async () => {
    expect((await buoc(bsIvf, hoSoIvfId, 'kham_hiem_muon', 9)).status).toBe(400);
    expect((await buoc(bsIvf, hoSoIvfId, 'kham_hiem_muon', 0)).status).toBe(400);
  });
});
