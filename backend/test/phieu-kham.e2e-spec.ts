import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { khoiTaoApp, lamSachDuLieu, taoNenTang, taoBenhNhan, dangNhap, ngayISO } from './helpers';

// ============================================================================
//  PHIẾU KHÁM BỆNH — kiểm chứng dữ liệu lễ tân nhập được LƯU THẬT vào database:
//  gửi đủ các nhóm trường (chữ / ngày / ô tích), đọc lại qua API và đối chiếu
//  thẳng với bảng phieu_kham_benh trong PostgreSQL.
// ============================================================================
describe('Lưu phiếu khám bệnh vào database', () => {
  let app: INestApplication;
  let ds: DataSource;
  let http: any;
  let leTan: string;
  let hoSoId: number;
  let phieuId: number;

  const DU_LIEU = {
    ma_kcb: 'KCBTEST0001', so_benh_an: '2026/000999',
    ten_bn: 'Nguyễn Thị Kiểm Thử', gioi_tinh: 'Nữ', tuoi: '34',
    dan_toc: 'Kinh', dia_chi: '12 Lê Lợi, Hải Phòng', nghe_nghiep: 'Giáo viên',
    doi_tuong: 'BHYT', so_the: 'HC4030123456789', noi_dk_kcb: 'BV Phụ sản Hải Phòng',
    buong: 'B12', giuong: '05', bs_kham: 'BS.CKII Nguyễn Thị Lan', chuyen_khoa: 'Khoa Sản',
    trieu_chung: 'Đau bụng hạ vị, ra huyết ít', chan_doan_so_bo: 'Theo dõi dọa sảy thai',
    ket_luan: 'Nhập viện theo dõi', huyet_ap: '120/80', mach: '82', nhiet_do: '37',
    nhip_tho: '18', chieu_cao: '158', can_nang: '56', spo2: '98', vong_2: '86',
    ten_benh: 'Dọa sảy thai', ma_icd: 'O20.0', dien_giai: 'Thai 9 tuần',
    ngay_dk: ngayISO(0), ngay_sinh: '1992-03-04', ngay_vao: ngayISO(0), ngay_kham: ngayISO(0),
    noi_tru: true, dtnt: false, ttrv: true, cap_cuu: false, kham_lai: true,
  };

  beforeAll(async () => {
    ({ app, ds, http } = await khoiTaoApp());
    await lamSachDuLieu(ds);
    await taoNenTang(ds);
    leTan = await dangNhap(http, 'letan@test.vn');
    const bn = await taoBenhNhan(ds, 'Nguyễn Thị Kiểm Thử');
    hoSoId = bn.id;
  });
  afterAll(async () => { await app.close(); });

  it('lưu phiếu → API trả về id và tên bệnh nhân đã lưu', async () => {
    const res = await request(http).post('/api/reception/exam-sheets')
      .set('Authorization', `Bearer ${leTan}`).send({ ...DU_LIEU, ho_so_id: hoSoId });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeGreaterThan(0);
    expect(res.body.ten_bn).toBe(DU_LIEU.ten_bn);
    phieuId = res.body.id;
  });

  it('mọi trường đã nhập đều nằm trong database, đúng giá trị', async () => {
    const [row] = await ds.query('SELECT * FROM phieu_kham_benh WHERE id = $1', [phieuId]);
    expect(row).toBeTruthy();
    for (const [k, v] of Object.entries(DU_LIEU)) {
      const trongDb = row[k] instanceof Date ? row[k].toLocaleDateString('en-CA') : row[k];
      expect({ [k]: trongDb }).toEqual({ [k]: v });
    }
    expect(row.ho_so_id).toBe(hoSoId);        // liên kết hồ sơ bệnh nhân
    expect(row.nguoi_tao_id).toBeTruthy();    // ghi lại người lập phiếu
    expect(row.ngay_tao).toBeTruthy();
  });

  it('đọc lại qua API cho đúng dữ liệu đã lưu (không phụ thuộc trạng thái frontend)', async () => {
    const res = await request(http).get(`/api/reception/exam-sheets/${phieuId}`)
      .set('Authorization', `Bearer ${leTan}`);
    expect(res.status).toBe(200);
    for (const [k, v] of Object.entries(DU_LIEU)) {
      const tra = typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
        ? String(res.body[k]).slice(0, 10) : res.body[k];
      expect({ [k]: tra }).toEqual({ [k]: v });
    }
    expect(res.body.ma_benh_nhan).toBeTruthy();
  });

  it('phiếu hiện trong danh sách "Phiếu đã nhập gần đây"', async () => {
    const res = await request(http).get('/api/reception/exam-sheets').set('Authorization', `Bearer ${leTan}`);
    expect(res.status).toBe(200);
    const p = res.body.find((x: any) => x.id === phieuId);
    expect(p).toBeDefined();
    expect(p.ma_kcb).toBe(DU_LIEU.ma_kcb);
    expect(p.chuyen_khoa).toBe(DU_LIEU.chuyen_khoa);
    expect(p.chan_doan_so_bo).toBe(DU_LIEU.chan_doan_so_bo);
  });

  it('trường bỏ trống được lưu là null, không phải chuỗi rỗng', async () => {
    const res = await request(http).post('/api/reception/exam-sheets')
      .set('Authorization', `Bearer ${leTan}`).send({ ten_bn: 'Bệnh nhân tối thiểu', chuyen_khoa: '' });
    expect(res.status).toBe(201);
    const [row] = await ds.query('SELECT chuyen_khoa, chan_doan_so_bo, ngay_dk FROM phieu_kham_benh WHERE id = $1', [res.body.id]);
    expect(row.chuyen_khoa).toBeNull();
    expect(row.chan_doan_so_bo).toBeNull();
    expect(row.ngay_dk).toBeNull();
  });

  it('thiếu tên bệnh nhân thì không lưu gì vào database', async () => {
    const truoc = await ds.query('SELECT COUNT(*)::int AS n FROM phieu_kham_benh');
    const res = await request(http).post('/api/reception/exam-sheets')
      .set('Authorization', `Bearer ${leTan}`).send({ chuyen_khoa: 'Khoa Sản' });
    expect(res.status).toBe(400);
    const sau = await ds.query('SELECT COUNT(*)::int AS n FROM phieu_kham_benh');
    expect(sau[0].n).toBe(truoc[0].n);
  });
});
