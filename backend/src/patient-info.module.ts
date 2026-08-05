import {
  Injectable, Controller, Get, Post, Patch, Body, Param, Query, Request, UseGuards,
  BadRequestException, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager, In, MoreThanOrEqual } from 'typeorm';
import {
  PhieuKhamBenh, HoSoBenhNhan, LichHen, BacSi, LuotKham, KetLuanKham, ChiDinhCLS,
  TaiLieuBenhAn, NhatKyHoatDong, PhieuYLenh, ThanhToan, VaiTro,
} from './entities';
import { JwtAuthGuard, RolesGuard, Roles } from './auth';
import { chuanHoaHoSo } from './profile.module';
import { tinhDieuKienRaVien } from './ra-vien.module';

// Bỏ dấu tiếng Việt + chuẩn hóa để so khớp tên không phụ thuộc dấu / hoa thường.
function khongDau(s: string): string {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}
// Khoảng cách Levenshtein (số phép sửa) giữa hai chuỗi.
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[n];
}
const tyLeGiong = (a: string, b: string): number => {
  const max = Math.max(a.length, b.length);
  return max === 0 ? 1 : 1 - levenshtein(a, b) / max;
};
// Điểm tương đồng tên tra cứu vs tên hồ sơ (0..1). Ưu tiên khớp chuỗi con,
// sau đó khớp theo từng từ (họ/tên), cuối cùng là độ giống toàn chuỗi.
function diemGiongTen(query: string, ten: string): number {
  const q = khongDau(query), n = khongDau(ten);
  if (!q || !n) return 0;
  if (n === q) return 1;
  if (n.includes(q)) return 0.9 + 0.1 * (q.length / n.length);
  const qt = q.split(' ').filter(Boolean), nt = n.split(' ').filter(Boolean);
  let sum = 0;
  for (const t of qt) {
    let best = 0;
    for (const w of nt) {
      let d: number;
      if (w === t) d = 1;
      else if (w.includes(t) || t.includes(w)) {
        // Chỉ coi là gần giống khi độ dài xấp xỉ nhau, tránh khớp nhầm khi một
        // từ ngắn tình cờ nằm trong từ dài ("hong" trong "xyzkhongton").
        const r = Math.min(t.length, w.length) / Math.max(t.length, w.length);
        d = r >= 0.6 ? 0.95 : tyLeGiong(t, w);
      } else d = tyLeGiong(t, w);
      best = Math.max(best, d);
    }
    sum += best;
  }
  const diemTu = qt.length ? sum / qt.length : 0;
  return Math.max(diemTu * 0.92, tyLeGiong(q, n));
}

// Các trường văn bản được phép ghi từ phiếu — mọi trường khác trong body bị bỏ qua.
const TEXT_FIELDS = [
  'ma_kcb', 'so_benh_an', 'ten_bn', 'gioi_tinh', 'tuoi', 'dan_toc', 'dia_chi', 'nghe_nghiep',
  'doi_tuong', 'so_the', 'ky_hieu', 'ty_le_the', 'dia_chi_the', 'noi_dk_kcb', 'noi_cap',
  'buong', 'giuong', 'bs_kham', 'chuyen_khoa', 'cdtt', 'ghi_chu', 'trieu_chung',
  'chan_doan_so_bo', 'ghi_chu_kb', 'ket_luan', 'huyet_ap', 'mach', 'nhiet_do', 'nhip_tho',
  'chieu_cao', 'can_nang', 'bmi', 'spo2', 'vong_2', 'ten_benh', 'ma_icd', 'dien_giai',
] as const;
const DATE_FIELDS = ['ngay_dk', 'ngay_sinh', 'han_the', 'ngay_vao', 'ngay_kham'] as const;
const BOOL_FIELDS = [
  'noi_tru', 'dtnt', 'dkrv', 'ttrv', 'chuyen_vien', 'cap_cuu', 'kham_lai', 'nho_kham', 'hoan_kham',
] as const;

@Injectable()
export class PatientInfoService {
  constructor(
    @InjectRepository(PhieuKhamBenh) private phieu: Repository<PhieuKhamBenh>,
    @InjectRepository(HoSoBenhNhan) private hoSo: Repository<HoSoBenhNhan>,
    @InjectRepository(LichHen) private lichHen: Repository<LichHen>,
    private ds: DataSource,
  ) {}

  private ghiNhatKy(m: EntityManager, userId: number, hanhDong: string, noiDung: string) {
    return m.save(m.create(NhatKyHoatDong, {
      hanh_dong: hanhDong, noi_dung: noiDung, nguoi_dung: { id: userId } as any,
    }));
  }

  // Lọc, chuẩn hóa và kiểm tra dữ liệu phiếu tại biên tin cậy (không tin body trực tiếp).
  private chuanHoa(dto: any) {
    const out: Record<string, string | boolean | null> = {};
    for (const k of TEXT_FIELDS) {
      if (dto[k] === undefined) continue;
      const v = dto[k] === null ? '' : String(dto[k]).trim();
      if (v.length > 2000) throw new BadRequestException(`Trường ${k} quá dài`);
      out[k] = v || null;
    }
    for (const k of DATE_FIELDS) {
      if (dto[k] === undefined || dto[k] === null || dto[k] === '') { out[k] = null; continue; }
      const v = String(dto[k]).trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(new Date(v).getTime()))
        throw new BadRequestException(`Ngày không hợp lệ ở trường ${k} (định dạng YYYY-MM-DD)`);
      out[k] = v;
    }
    for (const k of BOOL_FIELDS) {
      if (dto[k] === undefined) continue;
      out[k] = dto[k] === true || dto[k] === 'true' || dto[k] === 1 || dto[k] === '1';
    }
    const ten = out.ten_bn;
    if (typeof ten !== 'string' || !ten) throw new BadRequestException('Tên bệnh nhân là bắt buộc');
    if (ten.length > 100) throw new BadRequestException('Tên bệnh nhân quá dài');
    return out;
  }

  // Tra cứu hồ sơ có sẵn để điền nhanh phiếu. Trả về DANH SÁCH ứng viên:
  // - Mã bệnh nhân hoặc SĐT: khớp trực tiếp (điểm 1).
  // - Tên: xếp theo độ giống (không phụ thuộc dấu, cho phép sai chính tả nhẹ).
  async traCuuBenhNhan(ma: string) {
    const q = (ma || '').trim();
    if (!q) throw new BadRequestException('Cần mã bệnh nhân, số điện thoại hoặc tên để tra cứu');
    const like = `%${q}%`;
    // Ứng viên: khớp mã/SĐT trực tiếp trong SQL, gộp thêm nhóm hồ sơ gần đây để
    // xếp hạng theo tên (bỏ dấu) ở tầng ứng dụng vì SQL không bỏ dấu tiếng Việt.
    const [truc_tiep, ganDay] = await Promise.all([
      this.hoSo.createQueryBuilder('hs')
        .where('hs.ma_benh_nhan ILIKE :like OR hs.sdt LIKE :like', { like })
        .orderBy('hs.id', 'DESC').take(20).getMany(),
      this.hoSo.createQueryBuilder('hs').orderBy('hs.id', 'DESC').take(1000).getMany(),
    ]);

    const diemCuaMa = new Map<number, number>();
    for (const hs of truc_tiep) diemCuaMa.set(hs.id, 1);

    const nguong = 0.5;
    const goc = new Map<number, HoSoBenhNhan>();
    for (const hs of [...truc_tiep, ...ganDay]) goc.set(hs.id, hs);
    const chamDiem = (hs: HoSoBenhNhan) =>
      Math.max(diemCuaMa.get(hs.id) ?? 0, diemGiongTen(q, hs.ho_ten));

    const ketQua = [...goc.values()]
      .map((hs) => ({ hs, diem: chamDiem(hs) }))
      .filter((x) => x.diem >= nguong)
      .sort((a, b) => b.diem - a.diem || b.hs.id - a.hs.id)
      .slice(0, 8)
      .map(({ hs, diem }) => ({
        ho_so_id: hs.id, ma_benh_nhan: hs.ma_benh_nhan, ten_bn: hs.ho_ten,
        gioi_tinh: hs.gioi_tinh || '', ngay_sinh: hs.ngay_sinh || '',
        dia_chi: hs.dia_chi || '', so_the: hs.so_bhyt || '', sdt: hs.sdt || '',
        do_giong: Math.round(diem * 100),
      }));

    if (!ketQua.length) throw new NotFoundException(`Không tìm thấy bệnh nhân với "${q}"`);
    return ketQua;
  }

  // Lễ tân tiếp nhận bệnh nhân mới đến (chưa có tài khoản) — tạo hồ sơ trực tiếp.
  // Chặn trùng SĐT trừ khi lễ tân xác nhận cho_phep_trung (VD: người thân dùng chung số).
  async tiepNhanBenhNhanMoi(userId: number, dto: any) {
    const data = chuanHoaHoSo(dto, false);
    if (data.sdt && dto.cho_phep_trung !== true) {
      const trung = await this.hoSo.find({ where: { sdt: data.sdt as string }, take: 5 });
      if (trung.length)
        throw new BadRequestException(
          `SĐT này đã có hồ sơ: ${trung.map((h) => `${h.ma_benh_nhan} (${h.ho_ten})`).join(', ')}. ` +
          'Hãy tra cứu hồ sơ cũ hoặc xác nhận tạo mới.');
    }
    // Bác sĩ mong muốn khám (tùy chọn) — chỉ nhận id có thật trong danh sách bác sĩ
    let bacSiMongMuon: BacSi | null = null;
    if (dto.bac_si_mong_muon_id !== undefined && dto.bac_si_mong_muon_id !== null && dto.bac_si_mong_muon_id !== '') {
      const bsId = Number(dto.bac_si_mong_muon_id);
      if (!Number.isInteger(bsId) || bsId <= 0) throw new BadRequestException('Bác sĩ mong muốn không hợp lệ');
      bacSiMongMuon = await this.ds.getRepository(BacSi).findOne({ where: { id: bsId } });
      if (!bacSiMongMuon) throw new BadRequestException('Bác sĩ mong muốn không tồn tại');
    }
    return this.ds.transaction(async (m) => {
      const hs = await m.save(m.create(HoSoBenhNhan, {
        ...data,
        ma_benh_nhan: 'BN' + Date.now().toString().slice(-8),
        bac_si_mong_muon: bacSiMongMuon,
      }));
      await this.ghiNhatKy(m, userId, 'tiep_nhan_benh_nhan',
        `Tiếp nhận bệnh nhân mới ${hs.ma_benh_nhan} (${hs.ho_ten})` +
        (bacSiMongMuon ? ` — mong muốn khám ${bacSiMongMuon.ho_ten}` : ''));
      return hs;
    });
  }

  // Lễ tân note ngày tái khám cho một hồ sơ (kèm bác sĩ sẽ khám lại + ghi chú
  // chuẩn bị). Gửi ngay_tai_kham rỗng để xóa hẹn.
  async datTaiKham(userId: number, hoSoId: number, dto: any) {
    const hs = await this.hoSo.findOne({ where: { id: hoSoId } });
    if (!hs) throw new NotFoundException('Hồ sơ bệnh nhân không tồn tại');
    const ngay = (dto.ngay_tai_kham ?? '').toString().trim();
    let bsTaiKham: BacSi | null = null;
    if (!ngay) {
      hs.ngay_tai_kham = null as any; hs.ghi_chu_tai_kham = null as any; hs.bac_si_tai_kham = null as any;
    } else {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ngay) || isNaN(new Date(ngay).getTime()))
        throw new BadRequestException('Ngày tái khám không hợp lệ (định dạng YYYY-MM-DD)');
      if (dto.bac_si_tai_kham_id !== undefined && dto.bac_si_tai_kham_id !== null && dto.bac_si_tai_kham_id !== '') {
        const bsId = Number(dto.bac_si_tai_kham_id);
        if (!Number.isInteger(bsId) || bsId <= 0) throw new BadRequestException('Bác sĩ tái khám không hợp lệ');
        bsTaiKham = await this.ds.getRepository(BacSi).findOne({ where: { id: bsId } });
        if (!bsTaiKham) throw new BadRequestException('Bác sĩ tái khám không tồn tại');
      }
      const ghiChu = (dto.ghi_chu_tai_kham ?? '').toString().trim();
      if (ghiChu.length > 1000) throw new BadRequestException('Ghi chú tái khám quá dài');
      hs.ngay_tai_kham = ngay; hs.ghi_chu_tai_kham = (ghiChu || null) as any; hs.bac_si_tai_kham = bsTaiKham as any;
    }
    return this.ds.transaction(async (m) => {
      const saved = await m.save(hs);
      await this.ghiNhatKy(m, userId, 'hen_tai_kham',
        ngay
          ? `Hẹn tái khám ${hs.ma_benh_nhan} (${hs.ho_ten}) ngày ${ngay}` + (bsTaiKham ? ` với ${bsTaiKham.ho_ten}` : '')
          : `Xóa hẹn tái khám của ${hs.ma_benh_nhan} (${hs.ho_ten})`);
      return saved;
    });
  }

  // Hồ sơ TỔNG HỢP của một bệnh nhân: thông tin hành chính, phiếu khám bệnh,
  // lịch hẹn, phiếu y lệnh viện phí và hóa đơn thanh toán dịch vụ — nguồn cho
  // cửa sổ hồ sơ bệnh nhân (in / lưu PDF).
  // Chỉ trả các trường cần hiển thị, không trả nguyên entity.
  async hoSoTongHop(hoSoId: number) {
    const hs = await this.hoSo.findOne({
      where: { id: hoSoId },
      relations: ['bac_si_mong_muon', 'bac_si_mong_muon.khoa', 'bac_si_tai_kham', 'bac_si_tai_kham.khoa'],
    });
    if (!hs) throw new NotFoundException('Hồ sơ bệnh nhân không tồn tại');

    const lichs = await this.lichHen.find({ where: { ho_so: { id: hoSoId } }, order: { id: 'DESC' } });
    const lichIds = lichs.map((l) => l.id);

    const phieus = await this.phieu.find({
      where: { ho_so: { id: hoSoId } }, relations: ['nguoi_tao', 'lich_hen'], order: { id: 'DESC' },
    });
    const phieuIds = phieus.map((p) => p.id);

    const [yLenhs, hoaDons] = await Promise.all([
      phieuIds.length
        ? this.ds.getRepository(PhieuYLenh).find({
            where: { phieu_kham: { id: In(phieuIds) } },
            relations: ['chi_tiet', 'nguoi_tao'], order: { id: 'DESC' },
          })
        : Promise.resolve([]),
      lichIds.length
        ? this.ds.getRepository(ThanhToan).find({
            where: { lich_hen: { id: In(lichIds) } },
            relations: ['chi_tiet', 'nguoi_tao'], order: { id: 'DESC' },
          })
        : Promise.resolve([]),
    ]);

    const y_lenh = yLenhs.map((y) => ({
      id: y.id, ma_phieu: y.ma_phieu, ngay_yl: y.ngay_yl, bs_dt: y.bs_dt,
      tong_tien: y.tong_tien, da_nop: y.da_nop, tra_lai: y.tra_lai,
      con_lai: Math.max(0, y.tong_tien - y.da_nop),
      trang_thai: y.trang_thai, ngay_tao: y.ngay_tao,
      nguoi_tao: y.nguoi_tao ? y.nguoi_tao.ho_ten : null,
      chi_tiet: (y.chi_tiet || []).map((c) => ({
        loai: c.loai, ma_vt: c.ma_vt, ten: c.ten, dvt: c.dvt, so_luong: c.so_luong,
        lieu_dung: c.lieu_dung, cach_dung: c.cach_dung, don_gia: c.don_gia, ty_le: c.ty_le,
        thanh_tien: c.thanh_tien,
      })),
    }));

    const thanh_toan = hoaDons.map((t) => ({
      id: t.id, ma_thanh_toan: t.ma_thanh_toan, tong_tien: t.tong_tien, trang_thai: t.trang_thai,
      ngay_tao: t.ngay_tao, ngay_thanh_toan: t.ngay_thanh_toan,
      ma_lich_hen: t.lich_hen ? t.lich_hen.ma_lich_hen : null,
      nguoi_tao: t.nguoi_tao ? t.nguoi_tao.ho_ten : null,
      chi_tiet: (t.chi_tiet || []).map((c) => ({
        ten_dich_vu: c.ten_dich_vu, don_gia: c.don_gia, so_luong: c.so_luong, thanh_tien: c.thanh_tien,
      })),
    }));

    const tongYL = y_lenh.reduce((s, y) => s + y.tong_tien, 0);
    const daNopYL = y_lenh.reduce((s, y) => s + y.da_nop, 0);
    const daThuHD = thanh_toan
      .filter((t) => t.trang_thai === 'da_thanh_toan')
      .reduce((s, t) => s + t.tong_tien, 0);
    const choThuHD = thanh_toan
      .filter((t) => t.trang_thai === 'cho_thanh_toan')
      .reduce((s, t) => s + t.tong_tien, 0);

    return {
      ho_so: {
        id: hs.id, ma_benh_nhan: hs.ma_benh_nhan, ho_ten: hs.ho_ten, ngay_sinh: hs.ngay_sinh,
        gioi_tinh: hs.gioi_tinh, sdt: hs.sdt, dia_chi: hs.dia_chi, so_bhyt: hs.so_bhyt,
        ngay_tai_kham: hs.ngay_tai_kham, ghi_chu_tai_kham: hs.ghi_chu_tai_kham,
        bac_si_tai_kham: hs.bac_si_tai_kham
          ? { ho_ten: hs.bac_si_tai_kham.ho_ten, khoa: hs.bac_si_tai_kham.khoa ? hs.bac_si_tai_kham.khoa.ten_khoa : null }
          : null,
        bac_si_mong_muon: hs.bac_si_mong_muon
          ? { ho_ten: hs.bac_si_mong_muon.ho_ten, khoa: hs.bac_si_mong_muon.khoa ? hs.bac_si_mong_muon.khoa.ten_khoa : null }
          : null,
      },
      phieu_kham: phieus.map((p) => ({
        id: p.id, ma_kcb: p.ma_kcb, so_benh_an: p.so_benh_an, ngay_kham: p.ngay_kham,
        bs_kham: p.bs_kham, chuyen_khoa: p.chuyen_khoa, cdtt: p.cdtt, trieu_chung: p.trieu_chung,
        chan_doan_so_bo: p.chan_doan_so_bo, ghi_chu_kb: p.ghi_chu_kb, ket_luan: p.ket_luan,
        ten_benh: p.ten_benh, ma_icd: p.ma_icd,
        huyet_ap: p.huyet_ap, mach: p.mach, nhiet_do: p.nhiet_do, can_nang: p.can_nang,
        ngay_tao: p.ngay_tao, ma_lich_hen: p.lich_hen ? p.lich_hen.ma_lich_hen : null,
        nguoi_tao: p.nguoi_tao ? p.nguoi_tao.ho_ten : null,
      })),
      lich_hen: lichs.map((l) => ({
        id: l.id, ma_lich_hen: l.ma_lich_hen, trang_thai: l.trang_thai, so_thu_tu: l.so_thu_tu,
        ngay: l.khung_gio ? l.khung_gio.ngay : null,
        gio: l.khung_gio ? l.khung_gio.gio_bat_dau : null,
        bac_si: l.khung_gio && l.khung_gio.bac_si ? l.khung_gio.bac_si.ho_ten : null,
        khoa: l.khoa ? l.khoa.ten_khoa : null,
      })),
      y_lenh,
      thanh_toan,
      tong_hop: {
        so_lich_hen: lichs.length,
        so_lan_da_kham: lichs.filter((l) => l.trang_thai === 'da_kham').length,
        so_phieu_kham: phieus.length,
        tong_vien_phi: tongYL,
        da_nop_vien_phi: daNopYL,
        con_no_vien_phi: Math.max(0, tongYL - daNopYL),
        hoa_don_da_thu: daThuHD,
        hoa_don_cho_thu: choThuHD,
      },
    };
  }

  // Tổng hợp mọi dữ liệu phục vụ tái khám của một hồ sơ: theo từng lần khám cũ —
  // kết luận + toa thuốc, sổ khám (lượt khám/đơn thuốc), kết quả cận lâm sàng
  // (xét nghiệm, siêu âm, X-quang) và tài liệu bệnh án đã tải lên (phim, giấy ra viện).
  async thongTinTaiKham(hoSoId: number) {
    const hs = await this.hoSo.findOne({
      where: { id: hoSoId },
      relations: ['bac_si_mong_muon', 'bac_si_mong_muon.khoa', 'bac_si_tai_kham', 'bac_si_tai_kham.khoa'],
    });
    if (!hs) throw new NotFoundException('Hồ sơ bệnh nhân không tồn tại');
    const lichs = await this.lichHen.find({ where: { ho_so: { id: hoSoId } }, order: { id: 'DESC' } });
    const ids = lichs.map((l) => l.id);
    const [luots, ketLuans, clss, taiLieus] = ids.length
      ? await Promise.all([
          this.ds.getRepository(LuotKham).find({ where: { lich_hen: { id: In(ids) } }, relations: ['lich_hen', 'don_thuoc'] }),
          this.ds.getRepository(KetLuanKham).find({ where: { lich_hen: { id: In(ids) } }, relations: ['lich_hen', 'bac_si'] }),
          this.ds.getRepository(ChiDinhCLS).find({ where: { lich_hen: { id: In(ids) } }, relations: ['lich_hen'], order: { id: 'ASC' } }),
          // Chỉ metadata — tuyệt đối không nạp cột bytea du_lieu
          this.ds.getRepository(TaiLieuBenhAn).find({
            where: { lich_hen: { id: In(ids) } },
            select: ['id', 'ten_tep', 'loai_tep', 'kich_thuoc', 'thoi_gian'],
            relations: ['lich_hen'], order: { thoi_gian: 'DESC' },
          }),
        ])
      : [[], [], [], []];

    const cua = <T extends { lich_hen: LichHen }>(arr: T[], lichId: number) =>
      arr.filter((x) => x.lich_hen && x.lich_hen.id === lichId);

    return {
      ho_so: hs,
      lan_kham: lichs.map((l) => {
        const luot = luots.find((x) => x.lich_hen && x.lich_hen.id === l.id);
        const kl = ketLuans.find((x) => x.lich_hen && x.lich_hen.id === l.id);
        return {
          lich_hen_id: l.id, ma_lich_hen: l.ma_lich_hen, trang_thai: l.trang_thai,
          ngay: l.khung_gio ? l.khung_gio.ngay : null,
          gio: l.khung_gio ? l.khung_gio.gio_bat_dau : null,
          bac_si: l.khung_gio && l.khung_gio.bac_si ? l.khung_gio.bac_si.ho_ten : null,
          khoa: l.khoa ? l.khoa.ten_khoa : null,
          ket_luan: kl ? {
            chan_doan_chinh: kl.chan_doan_chinh, ma_icd: kl.ma_icd, huong_xu_tri: kl.huong_xu_tri,
            don_thuoc: kl.don_thuoc, loi_dan: kl.loi_dan, ngay_tai_kham: kl.ngay_tai_kham,
            bac_si: kl.bac_si ? kl.bac_si.ho_ten : null,
          } : null,
          so_kham: luot ? {
            chan_doan: luot.chan_doan, chi_dinh: luot.chi_dinh, ghi_chu: luot.ghi_chu,
            don_thuoc: luot.don_thuoc ? {
              danh_sach_thuoc: luot.don_thuoc.danh_sach_thuoc,
              lieu_dung: luot.don_thuoc.lieu_dung, ghi_chu: luot.don_thuoc.ghi_chu,
            } : null,
          } : null,
          can_lam_sang: cua(clss, l.id).map((c) => ({
            id: c.id, loai: c.loai, ten_chi_dinh: c.ten_chi_dinh, trang_thai: c.trang_thai,
            ket_qua: c.ket_qua, ket_luan: c.ket_luan, ngay_ket_qua: c.ngay_ket_qua,
          })),
          tai_lieu: cua(taiLieus, l.id).map((t) => ({
            id: t.id, ten_tep: t.ten_tep, loai_tep: t.loai_tep, kich_thuoc: t.kich_thuoc, thoi_gian: t.thoi_gian,
          })),
        };
      }),
    };
  }

  // Bác sĩ đăng nhập xem danh sách bệnh nhân được hẹn tái khám với mình (từ hôm nay)
  async taiKhamCuaBacSi(userId: number) {
    const bs = await this.ds.getRepository(BacSi).findOne({ where: { nguoi_dung: { id: userId } } });
    if (!bs) return [];
    const homNay = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD giờ địa phương
    const list = await this.hoSo.find({
      where: { bac_si_tai_kham: { id: bs.id }, ngay_tai_kham: MoreThanOrEqual(homNay) },
      order: { ngay_tai_kham: 'ASC' },
    });
    return list.map((h) => ({
      ho_so_id: h.id, ma_benh_nhan: h.ma_benh_nhan, ho_ten: h.ho_ten, sdt: h.sdt,
      ngay_tai_kham: h.ngay_tai_kham, ghi_chu_tai_kham: h.ghi_chu_tai_kham,
    }));
  }

  // Lễ tân xem toàn bộ lịch tái khám — lọc theo khoảng ngày, bác sĩ, từ khóa.
  // Cùng nguồn dữ liệu với danh sách của bác sĩ (cột ngay_tai_kham trên hồ sơ).
  async danhSachTaiKham(tu?: string, den?: string, bacSiId?: string, q?: string) {
    const kiemTraNgay = (v: string, ten: string) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(new Date(v).getTime()))
        throw new BadRequestException(`${ten} không hợp lệ (định dạng YYYY-MM-DD)`);
      return v;
    };
    const qb = this.hoSo.createQueryBuilder('hs')
      .leftJoinAndSelect('hs.bac_si_tai_kham', 'bs')
      .leftJoinAndSelect('bs.khoa', 'khoa')
      .where('hs.ngay_tai_kham IS NOT NULL')
      .orderBy('hs.ngay_tai_kham', 'ASC');
    if (tu) qb.andWhere('hs.ngay_tai_kham >= :tu', { tu: kiemTraNgay(tu.trim(), 'Ngày bắt đầu') });
    if (den) qb.andWhere('hs.ngay_tai_kham <= :den', { den: kiemTraNgay(den.trim(), 'Ngày kết thúc') });
    if (bacSiId) {
      const id = Number(bacSiId);
      if (!Number.isInteger(id) || id <= 0) throw new BadRequestException('Bác sĩ không hợp lệ');
      qb.andWhere('hs.bac_si_tai_kham_id = :id', { id });
    }
    if (q && q.trim())
      qb.andWhere('(hs.ho_ten ILIKE :q OR hs.ma_benh_nhan ILIKE :q OR hs.sdt LIKE :q)', { q: `%${q.trim()}%` });

    const list = await qb.getMany();
    const homNay = new Date().toLocaleDateString('en-CA');
    return list.map((h) => ({
      ho_so_id: h.id, ma_benh_nhan: h.ma_benh_nhan, ho_ten: h.ho_ten, sdt: h.sdt,
      ngay_sinh: h.ngay_sinh, gioi_tinh: h.gioi_tinh,
      ngay_tai_kham: h.ngay_tai_kham, ghi_chu_tai_kham: h.ghi_chu_tai_kham,
      bac_si_tai_kham: h.bac_si_tai_kham
        ? { id: h.bac_si_tai_kham.id, ho_ten: h.bac_si_tai_kham.ho_ten,
            khoa: h.bac_si_tai_kham.khoa ? h.bac_si_tai_kham.khoa.ten_khoa : null }
        : null,
      qua_han: h.ngay_tai_kham < homNay,
    }));
  }

  // Bác sĩ xác nhận bệnh nhân đã đến tái khám — xóa hẹn khỏi hàng chờ và ghi nhật ký.
  // Chỉ xác nhận được bệnh nhân hẹn với chính mình.
  // Không cho xác nhận trước ngày hẹn, TRỪ KHI có xác nhận của bác sĩ phụ trách
  // kèm lý do (tái khám sớm). dto: { ly_do?, xac_nhan_som? }.
  async xacNhanDaTaiKham(userId: number, hoSoId: number, dto: any = {}) {
    const bs = await this.ds.getRepository(BacSi).findOne({ where: { nguoi_dung: { id: userId } } });
    const hs = await this.hoSo.findOne({ where: { id: hoSoId }, relations: ['bac_si_tai_kham'] });
    if (!hs) throw new NotFoundException('Hồ sơ bệnh nhân không tồn tại');
    if (!hs.ngay_tai_kham) throw new BadRequestException('Bệnh nhân này không có hẹn tái khám');
    if (bs && hs.bac_si_tai_kham && hs.bac_si_tai_kham.id !== bs.id)
      throw new BadRequestException('Bệnh nhân này được hẹn với bác sĩ khác');

    const ngayCu = hs.ngay_tai_kham;
    const homNay = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD giờ địa phương
    const truocHan = ngayCu > homNay;                      // tái khám trước ngày hẹn
    let lyDo = '';
    if (truocHan) {
      // Tái khám sớm phải có xác nhận của chính bác sĩ phụ trách + nêu lý do
      if (!bs) throw new ForbiddenException('Tái khám trước ngày hẹn cần xác nhận của bác sĩ phụ trách');
      if (dto?.xac_nhan_som !== true && dto?.xac_nhan_som !== 'true')
        throw new BadRequestException('Cần bác sĩ xác nhận cho trường hợp tái khám trước ngày hẹn');
      lyDo = (dto?.ly_do ?? '').toString().trim();
      if (lyDo.length < 3) throw new BadRequestException('Vui lòng nêu lý do tái khám trước ngày hẹn');
      lyDo = lyDo.slice(0, 500);
    }

    return this.ds.transaction(async (m) => {
      hs.ngay_tai_kham = null as any; hs.ghi_chu_tai_kham = null as any; hs.bac_si_tai_kham = null as any;
      await m.save(hs);
      await this.ghiNhatKy(m, userId, 'xac_nhan_tai_kham', truocHan
        ? `Xác nhận ${hs.ma_benh_nhan} (${hs.ho_ten}) tái khám SỚM trước hẹn ngày ${ngayCu} — lý do: ${lyDo}`
        : `Xác nhận ${hs.ma_benh_nhan} (${hs.ho_ten}) đã đến tái khám (hẹn ngày ${ngayCu})`);
      return { message: 'Đã xác nhận bệnh nhân tái khám', ho_so_id: hs.id, truoc_han: truocHan };
    });
  }

  async tao(userId: number, dto: any) {
    const data = this.chuanHoa(dto);
    // Chốt điều kiện Đăng ký ra viện (ĐKRV): chỉ cho tích khi đã liên kết hồ sơ,
    // đã tích TTRV (thanh toán ra viện) và bệnh nhân đủ điều kiện ra viện thật
    // (viện phí thu đủ + có y lệnh ra viện an toàn về nhà từ bác sĩ điều trị).
    if (data.dkrv === true) {
      if (!dto.ho_so_id) throw new BadRequestException('Đăng ký ra viện (ĐKRV) cần liên kết hồ sơ bệnh nhân');
      if (data.ttrv !== true) throw new BadRequestException('Đăng ký ra viện cần tích TTRV (đã thanh toán ra viện)');
      const dk = await tinhDieuKienRaVien(this.ds, +dto.ho_so_id);
      if (!dk.du_dieu_kien) throw new BadRequestException('Chưa đủ điều kiện ra viện: ' + dk.thieu.join('; '));
    }
    return this.ds.transaction(async (m) => {
      const phieu = m.create(PhieuKhamBenh, { ...data, nguoi_tao: { id: userId } as any });
      // Liên kết tùy chọn tới hồ sơ / lịch hẹn đã có, chỉ khi tồn tại thật.
      if (dto.ho_so_id) {
        const hs = await m.findOne(HoSoBenhNhan, { where: { id: +dto.ho_so_id } });
        if (hs) phieu.ho_so = hs;
      }
      if (dto.lich_hen_id) {
        const lh = await m.findOne(LichHen, { where: { id: +dto.lich_hen_id } });
        if (lh) { phieu.lich_hen = lh; if (!phieu.ho_so && lh.ho_so) phieu.ho_so = lh.ho_so; }
      }
      const saved = await m.save(phieu);
      await this.ghiNhatKy(m, userId, 'tao_phieu_kham',
        `Tạo phiếu khám bệnh #${saved.id} (${saved.ten_bn})`);
      return this.goi(saved);
    });
  }

  async danhSach() {
    const list = await this.phieu.find({
      relations: ['nguoi_tao', 'ho_so'], order: { id: 'DESC' }, take: 100,
    });
    return list.map((p) => ({
      id: p.id, ten_bn: p.ten_bn, ma_kcb: p.ma_kcb, so_benh_an: p.so_benh_an,
      chuyen_khoa: p.chuyen_khoa, chan_doan_so_bo: p.chan_doan_so_bo, ngay_tao: p.ngay_tao,
      ma_benh_nhan: p.ho_so ? p.ho_so.ma_benh_nhan : null,
      nguoi_tao: p.nguoi_tao ? p.nguoi_tao.ho_ten : null,
    }));
  }

  async chiTiet(id: number) {
    const p = await this.phieu.findOne({ where: { id }, relations: ['nguoi_tao', 'ho_so', 'lich_hen'] });
    if (!p) throw new NotFoundException('Phiếu khám không tồn tại');
    return this.goi(p);
  }

  private goi(p: PhieuKhamBenh) {
    const { nguoi_tao, ho_so, lich_hen, ...fields } = p;
    return {
      ...fields,
      ma_benh_nhan: ho_so ? ho_so.ma_benh_nhan : null,
      ma_lich_hen: lich_hen ? lich_hen.ma_lich_hen : null,
      nguoi_tao: nguoi_tao ? { id: nguoi_tao.id, ho_ten: nguoi_tao.ho_ten } : null,
    };
  }
}

@Controller('api')
export class PatientInfoController {
  constructor(private svc: PatientInfoService) {}

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.ADMIN)
  @Get('reception/patient-lookup') traCuu(@Query('ma') ma: string) { return this.svc.traCuuBenhNhan(ma); }

  // Bác sĩ cũng đọc được để chọn bệnh nhân khi ghi phiếu điều trị
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.BAC_SI, VaiTro.ADMIN)
  @Get('reception/exam-sheets') danhSach() { return this.svc.danhSach(); }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.BAC_SI, VaiTro.ADMIN)
  @Get('reception/exam-sheets/:id') chiTiet(@Param('id') id: string) { return this.svc.chiTiet(+id); }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.ADMIN)
  @Post('reception/exam-sheets') tao(@Request() r, @Body() b) { return this.svc.tao(r.user.id, b); }

  // Tiếp nhận bệnh nhân mới đến trực tiếp (walk-in, không qua tài khoản bệnh nhân)
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.ADMIN)
  @Post('reception/patients') tiepNhan(@Request() r, @Body() b) { return this.svc.tiepNhanBenhNhanMoi(r.user.id, b); }

  // Lễ tân note / xóa hẹn tái khám của một hồ sơ
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.ADMIN)
  @Patch('reception/patients/:id/revisit') taiKham(@Request() r, @Param('id') id, @Body() b) { return this.svc.datTaiKham(r.user.id, +id, b); }

  // Thông tin phục vụ tái khám (toa thuốc cũ, kết quả CLS, tài liệu bệnh án)
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.BAC_SI, VaiTro.ADMIN)
  @Get('patients/:id/revisit-info') thongTin(@Param('id') id) { return this.svc.thongTinTaiKham(+id); }

  // Hồ sơ tổng hợp của bệnh nhân (phiếu khám, lịch hẹn, y lệnh, thanh toán)
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.BAC_SI, VaiTro.ADMIN)
  @Get('patients/:id/summary') tongHop(@Param('id') id) { return this.svc.hoSoTongHop(+id); }

  // Icon thông báo ở cổng bác sĩ: bệnh nhân hẹn tái khám với bác sĩ đang đăng nhập
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.BAC_SI, VaiTro.ADMIN)
  @Get('doctor/revisits') taiKhamBacSi(@Request() r) { return this.svc.taiKhamCuaBacSi(r.user.id); }

  // Lễ tân quản lý toàn bộ lịch tái khám (lọc theo ngày / bác sĩ / từ khóa)
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.ADMIN)
  @Get('reception/revisits') dsTaiKham(
    @Query('tu') tu?: string, @Query('den') den?: string,
    @Query('bac_si') bacSi?: string, @Query('q') q?: string,
  ) { return this.svc.danhSachTaiKham(tu, den, bacSi, q); }

  // Bác sĩ xác nhận bệnh nhân đã đến tái khám
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.BAC_SI, VaiTro.ADMIN)
  @Patch('doctor/revisits/:hoSoId/done') xongTaiKham(@Request() r, @Param('hoSoId') id, @Body() b) {
    return this.svc.xacNhanDaTaiKham(r.user.id, +id, b);
  }
}
