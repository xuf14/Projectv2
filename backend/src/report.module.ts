import {
  Injectable, Controller, Get, Param, Query, UseGuards, Res,
  BadRequestException, NotFoundException, StreamableFile,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { VaiTro } from './entities';
import { JwtAuthGuard, RolesGuard, Roles } from './auth';

// ============================================================================
//  BÁO CÁO HOẠT ĐỘNG BỆNH VIỆN (admin)
//  Mỗi loại báo cáo trả về cùng một cấu trúc { the[], bang[] } để giao diện
//  dùng chung một bộ hiển thị. Toàn bộ số liệu lấy trực tiếp từ database bằng
//  truy vấn tham số hóa — không có số liệu minh họa.
//    GET /api/admin/report/:loai?tu=&den=
//    GET /api/admin/report/:loai/export?tu=&den=   (CSV cho Excel)
// ============================================================================

type The = { nhan: string; gia_tri: number | string; dinh_dang?: 'tien' | 'phan_tram' | 'so' };
type Bang = { tieu_de: string; cot: string[]; dong: (string | number)[][] };
export type KetQuaBaoCao = {
  loai: string; ten: string; mo_ta: string; ky: { tu: string; den: string };
  the: The[]; bang: Bang[]; chu_thich?: string; chua_co_du_lieu?: boolean;
};

export const LOAI_BAO_CAO = [
  { id: 'dieu_hanh', ten: 'Điều hành & khám chữa bệnh', mo_ta: 'Lượt đặt lịch, tỷ lệ đến khám, công suất khung giờ theo khoa và bác sĩ.' },
  { id: 'tai_chinh', ten: 'Tài chính & doanh thu', mo_ta: 'Doanh thu dịch vụ đã thu, công nợ hóa đơn và viện phí theo y lệnh.' },
  { id: 'benh_nhan', ten: 'Bệnh nhân & hồ sơ', mo_ta: 'Quy mô hồ sơ, bệnh nhân đến khám trong kỳ và lịch tái khám.' },
  { id: 'nhan_su', ten: 'Nhân sự & công suất', mo_ta: 'Đội ngũ bác sĩ theo khoa và khối lượng khám của từng bác sĩ.' },
  { id: 'vat_tu', ten: 'Vật tư tiêu hao', mo_ta: 'Số lượng vật tư đã dùng và chi phí theo vật tư, nhóm và khoa điều trị.' },
];

@Injectable()
export class ReportService {
  constructor(private ds: DataSource) {}

  private chuanNgay(v: any, macDinh: string) {
    if (v === undefined || v === null || v === '') return macDinh;
    const s = String(v);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new BadRequestException('Ngày phải có dạng YYYY-MM-DD');
    return s;
  }

  // Kỳ báo cáo mặc định: từ đầu tháng hiện tại đến hôm nay
  private khoangNgay(tu?: string, den?: string) {
    const d = new Date();
    const ymd = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
    const ketQua = {
      tu: this.chuanNgay(tu, ymd(new Date(d.getFullYear(), d.getMonth(), 1))),
      den: this.chuanNgay(den, ymd(d)),
    };
    if (ketQua.tu > ketQua.den) throw new BadRequestException('"Từ ngày" phải trước "đến ngày"');
    return ketQua;
  }

  private so = (v: any) => Number(v) || 0;

  async lay(loai: string, tu?: string, den?: string): Promise<KetQuaBaoCao> {
    const meta = LOAI_BAO_CAO.find((l) => l.id === loai);
    if (!meta) throw new NotFoundException('Loại báo cáo không tồn tại');
    const ky = this.khoangNgay(tu, den);
    const nen = { loai: meta.id, ten: meta.ten, mo_ta: meta.mo_ta, ky };
    if (loai === 'dieu_hanh') return { ...nen, ...(await this.dieuHanh(ky)) };
    if (loai === 'tai_chinh') return { ...nen, ...(await this.taiChinh(ky)) };
    if (loai === 'benh_nhan') return { ...nen, ...(await this.benhNhan(ky)) };
    if (loai === 'nhan_su') return { ...nen, ...(await this.nhanSu(ky)) };
    return { ...nen, ...(await this.vatTu(ky)) };
  }

  // --- Điều hành: lịch hẹn tính theo NGÀY KHÁM (khung_gio.ngay) ---
  private async dieuHanh(ky: { tu: string; den: string }) {
    const P = [ky.tu, ky.den];
    const [tong] = await this.ds.query(`
      SELECT COUNT(*)::int AS tong,
             COUNT(*) FILTER (WHERE lh.trang_thai = 'da_kham')::int AS da_kham,
             COUNT(*) FILTER (WHERE lh.trang_thai = 'da_huy')::int AS da_huy,
             COUNT(*) FILTER (WHERE lh.trang_thai IN ('cho_xac_nhan','da_xac_nhan','da_checkin'))::int AS dang_cho
        FROM lich_hen lh JOIN khung_gio kg ON kg.id = lh.khung_gio_id
       WHERE kg.ngay BETWEEN $1 AND $2`, P);

    const [suc] = await this.ds.query(`
      SELECT COALESCE(SUM(so_luong),0)::int AS cho, COALESCE(SUM(da_dat),0)::int AS dat
        FROM khung_gio WHERE ngay BETWEEN $1 AND $2`, P);

    const theoKhoa = await this.ds.query(`
      SELECT COALESCE(k.ten_khoa,'(không rõ)') AS khoa, COUNT(*)::int AS tong,
             COUNT(*) FILTER (WHERE lh.trang_thai = 'da_kham')::int AS da_kham,
             COUNT(*) FILTER (WHERE lh.trang_thai = 'da_huy')::int AS da_huy
        FROM lich_hen lh JOIN khung_gio kg ON kg.id = lh.khung_gio_id
        LEFT JOIN khoa_phong k ON k.id = lh.khoa_id
       WHERE kg.ngay BETWEEN $1 AND $2
       GROUP BY k.ten_khoa ORDER BY tong DESC`, P);

    const theoBacSi = await this.ds.query(`
      SELECT COALESCE(bs.ho_ten,'(không rõ)') AS bac_si, COUNT(*)::int AS tong,
             COUNT(*) FILTER (WHERE lh.trang_thai = 'da_kham')::int AS da_kham
        FROM lich_hen lh JOIN khung_gio kg ON kg.id = lh.khung_gio_id
        LEFT JOIN bac_si bs ON bs.id = kg.bac_si_id
       WHERE kg.ngay BETWEEN $1 AND $2
       GROUP BY bs.ho_ten ORDER BY tong DESC`, P);

    const theoThang = await this.ds.query(`
      SELECT to_char(kg.ngay,'MM/YYYY') AS thang, COUNT(*)::int AS tong,
             COUNT(*) FILTER (WHERE lh.trang_thai = 'da_kham')::int AS da_kham
        FROM lich_hen lh JOIN khung_gio kg ON kg.id = lh.khung_gio_id
       WHERE kg.ngay BETWEEN $1 AND $2
       GROUP BY 1 ORDER BY min(kg.ngay)`, P);

    const t = this.so(tong.tong);
    return {
      the: [
        { nhan: 'Lượt đặt trong kỳ', gia_tri: t },
        { nhan: 'Đã khám', gia_tri: this.so(tong.da_kham) },
        { nhan: 'Đang chờ khám', gia_tri: this.so(tong.dang_cho) },
        { nhan: 'Đã hủy', gia_tri: this.so(tong.da_huy) },
        { nhan: 'Tỷ lệ đến khám', gia_tri: t ? Math.round((this.so(tong.da_kham) / t) * 100) : 0, dinh_dang: 'phan_tram' as const },
        { nhan: 'Công suất khung giờ', gia_tri: this.so(suc.cho) ? Math.round((this.so(suc.dat) / this.so(suc.cho)) * 100) : 0, dinh_dang: 'phan_tram' as const },
      ],
      bang: [
        { tieu_de: 'Lượt đặt theo tháng', cot: ['Tháng', 'Lượt đặt', 'Đã khám'],
          dong: theoThang.map((r) => [r.thang, this.so(r.tong), this.so(r.da_kham)]) },
        { tieu_de: 'Theo khoa', cot: ['Khoa', 'Lượt đặt', 'Đã khám', 'Đã hủy'],
          dong: theoKhoa.map((r) => [r.khoa, this.so(r.tong), this.so(r.da_kham), this.so(r.da_huy)]) },
        { tieu_de: 'Theo bác sĩ', cot: ['Bác sĩ', 'Lượt đặt', 'Đã khám'],
          dong: theoBacSi.map((r) => [r.bac_si, this.so(r.tong), this.so(r.da_kham)]) },
      ],
      chu_thich: `Lịch hẹn được tính theo ngày khám. Tổng chỗ khám mở trong kỳ: ${this.so(suc.cho)}, đã đặt: ${this.so(suc.dat)}.`,
    };
  }

  // --- Tài chính: doanh thu theo NGÀY THU TIỀN (thanh_toan.ngay_thanh_toan) ---
  private async taiChinh(ky: { tu: string; den: string }) {
    const P = [ky.tu, ky.den];
    const [thu] = await this.ds.query(`
      SELECT COUNT(*)::int AS so_hd, COALESCE(SUM(tong_tien),0)::int AS tien
        FROM thanh_toan
       WHERE trang_thai = 'da_thanh_toan' AND ngay_thanh_toan::date BETWEEN $1 AND $2`, P);
    const [cho] = await this.ds.query(`
      SELECT COUNT(*)::int AS so_hd, COALESCE(SUM(tong_tien),0)::int AS tien
        FROM thanh_toan
       WHERE trang_thai = 'cho_thanh_toan' AND ngay_tao::date BETWEEN $1 AND $2`, P);
    const [vienPhi] = await this.ds.query(`
      SELECT COUNT(*)::int AS so_phieu, COALESCE(SUM(tong_tien),0)::int AS tong,
             COALESCE(SUM(da_nop),0)::int AS da_nop
        FROM y_lenh WHERE ngay_tao::date BETWEEN $1 AND $2`, P);

    const theoDichVu = await this.ds.query(`
      SELECT ct.ten_dich_vu AS dich_vu, SUM(ct.so_luong)::int AS sl,
             COALESCE(SUM(ct.thanh_tien),0)::int AS tien
        FROM chi_tiet_thanh_toan ct JOIN thanh_toan t ON t.id = ct.thanh_toan_id
       WHERE t.trang_thai = 'da_thanh_toan' AND t.ngay_thanh_toan::date BETWEEN $1 AND $2
       GROUP BY ct.ten_dich_vu ORDER BY tien DESC`, P);

    const theoKhoa = await this.ds.query(`
      SELECT COALESCE(k.ten_khoa,'(không rõ)') AS khoa, COUNT(*)::int AS so_hd,
             COALESCE(SUM(t.tong_tien),0)::int AS tien
        FROM thanh_toan t LEFT JOIN lich_hen lh ON lh.id = t.lich_hen_id
        LEFT JOIN khoa_phong k ON k.id = lh.khoa_id
       WHERE t.trang_thai = 'da_thanh_toan' AND t.ngay_thanh_toan::date BETWEEN $1 AND $2
       GROUP BY k.ten_khoa ORDER BY tien DESC`, P);

    const theoNgay = await this.ds.query(`
      SELECT to_char(ngay_thanh_toan::date,'DD/MM/YYYY') AS ngay, COUNT(*)::int AS so_hd,
             COALESCE(SUM(tong_tien),0)::int AS tien
        FROM thanh_toan
       WHERE trang_thai = 'da_thanh_toan' AND ngay_thanh_toan::date BETWEEN $1 AND $2
       GROUP BY ngay_thanh_toan::date ORDER BY ngay_thanh_toan::date`, P);

    const conNo = this.so(vienPhi.tong) - this.so(vienPhi.da_nop);
    return {
      the: [
        { nhan: 'Doanh thu đã thu', gia_tri: this.so(thu.tien), dinh_dang: 'tien' as const },
        { nhan: 'Hóa đơn đã thu', gia_tri: this.so(thu.so_hd) },
        { nhan: 'Hóa đơn chờ thu', gia_tri: this.so(cho.tien), dinh_dang: 'tien' as const },
        { nhan: 'Viện phí đã nộp', gia_tri: this.so(vienPhi.da_nop), dinh_dang: 'tien' as const },
        { nhan: 'Viện phí còn thiếu', gia_tri: conNo > 0 ? conNo : 0, dinh_dang: 'tien' as const },
      ],
      bang: [
        { tieu_de: 'Doanh thu theo ngày', cot: ['Ngày', 'Số hóa đơn', 'Doanh thu'],
          dong: theoNgay.map((r) => [r.ngay, this.so(r.so_hd), this.so(r.tien)]) },
        { tieu_de: 'Doanh thu theo dịch vụ', cot: ['Dịch vụ', 'Số lượng', 'Doanh thu'],
          dong: theoDichVu.map((r) => [r.dich_vu, this.so(r.sl), this.so(r.tien)]) },
        { tieu_de: 'Doanh thu theo khoa', cot: ['Khoa', 'Số hóa đơn', 'Doanh thu'],
          dong: theoKhoa.map((r) => [r.khoa, this.so(r.so_hd), this.so(r.tien)]) },
      ],
      chu_thich: `Doanh thu tính theo ngày thu tiền. Phiếu y lệnh viện phí lập trong kỳ: ${this.so(vienPhi.so_phieu)}.`,
    };
  }

  private async benhNhan(ky: { tu: string; den: string }) {
    const P = [ky.tu, ky.den];
    const [tong] = await this.ds.query('SELECT COUNT(*)::int AS n FROM ho_so_benh_nhan');
    const [denKham] = await this.ds.query(`
      SELECT COUNT(DISTINCT lh.ho_so_id)::int AS n
        FROM lich_hen lh JOIN khung_gio kg ON kg.id = lh.khung_gio_id
       WHERE kg.ngay BETWEEN $1 AND $2 AND lh.trang_thai <> 'da_huy'`, P);
    const [taiKham] = await this.ds.query(`
      SELECT COUNT(*)::int AS n FROM ho_so_benh_nhan
       WHERE ngay_tai_kham BETWEEN $1 AND $2`, P);
    const [coTk] = await this.ds.query('SELECT COUNT(*)::int AS n FROM ho_so_benh_nhan WHERE nguoi_dung_id IS NOT NULL');

    const theoGioi = await this.ds.query(`
      SELECT COALESCE(NULLIF(gioi_tinh,''),'(chưa ghi)') AS gioi, COUNT(*)::int AS n
        FROM ho_so_benh_nhan GROUP BY 1 ORDER BY n DESC`);
    const theoTuoi = await this.ds.query(`
      SELECT CASE
               WHEN ngay_sinh IS NULL THEN '(chưa ghi ngày sinh)'
               WHEN date_part('year', age(ngay_sinh)) < 18 THEN 'Dưới 18'
               WHEN date_part('year', age(ngay_sinh)) < 30 THEN '18 - 29'
               WHEN date_part('year', age(ngay_sinh)) < 40 THEN '30 - 39'
               WHEN date_part('year', age(ngay_sinh)) < 50 THEN '40 - 49'
               ELSE 'Từ 50' END AS nhom, COUNT(*)::int AS n
        FROM ho_so_benh_nhan GROUP BY 1 ORDER BY n DESC`);
    const nhieuNhat = await this.ds.query(`
      SELECT hs.ma_benh_nhan, hs.ho_ten, COUNT(*)::int AS so_lich
        FROM lich_hen lh JOIN khung_gio kg ON kg.id = lh.khung_gio_id
        JOIN ho_so_benh_nhan hs ON hs.id = lh.ho_so_id
       WHERE kg.ngay BETWEEN $1 AND $2 AND lh.trang_thai <> 'da_huy'
       GROUP BY hs.ma_benh_nhan, hs.ho_ten ORDER BY so_lich DESC LIMIT 20`, P);

    return {
      the: [
        { nhan: 'Tổng hồ sơ bệnh nhân', gia_tri: this.so(tong.n) },
        { nhan: 'Bệnh nhân đến khám trong kỳ', gia_tri: this.so(denKham.n) },
        { nhan: 'Hẹn tái khám trong kỳ', gia_tri: this.so(taiKham.n) },
        { nhan: 'Hồ sơ có tài khoản', gia_tri: this.so(coTk.n) },
      ],
      bang: [
        { tieu_de: 'Theo giới tính', cot: ['Giới tính', 'Số hồ sơ'], dong: theoGioi.map((r) => [r.gioi, this.so(r.n)]) },
        { tieu_de: 'Theo nhóm tuổi', cot: ['Nhóm tuổi', 'Số hồ sơ'], dong: theoTuoi.map((r) => [r.nhom, this.so(r.n)]) },
        { tieu_de: 'Bệnh nhân có nhiều lịch nhất trong kỳ', cot: ['Mã BN', 'Họ tên', 'Số lịch'],
          dong: nhieuNhat.map((r) => [r.ma_benh_nhan, r.ho_ten, this.so(r.so_lich)]) },
      ],
      chu_thich: 'Bảng phân bố giới tính và nhóm tuổi tính trên toàn bộ hồ sơ (không giới hạn kỳ) vì hồ sơ không lưu ngày tạo.',
    };
  }

  private async nhanSu(ky: { tu: string; den: string }) {
    const P = [ky.tu, ky.den];
    const [dem] = await this.ds.query(`
      SELECT (SELECT COUNT(*) FROM bac_si)::int AS bac_si,
             (SELECT COUNT(*) FROM khoa_phong)::int AS khoa,
             (SELECT COUNT(*) FROM bac_si WHERE nguoi_dung_id IS NOT NULL)::int AS co_tk`);
    const theoBacSi = await this.ds.query(`
      SELECT bs.ho_ten AS bac_si, COALESCE(k.ten_khoa,'(chưa gán khoa)') AS khoa,
             COALESCE(SUM(kg.so_luong),0)::int AS cho,
             COALESCE(SUM(kg.da_dat),0)::int AS da_dat,
             (SELECT COUNT(*) FROM lich_hen lh JOIN khung_gio g ON g.id = lh.khung_gio_id
               WHERE g.bac_si_id = bs.id AND g.ngay BETWEEN $1 AND $2 AND lh.trang_thai = 'da_kham')::int AS da_kham
        FROM bac_si bs
        LEFT JOIN khoa_phong k ON k.id = bs.khoa_id
        LEFT JOIN khung_gio kg ON kg.bac_si_id = bs.id AND kg.ngay BETWEEN $1 AND $2
       GROUP BY bs.id, bs.ho_ten, k.ten_khoa ORDER BY da_dat DESC, bs.ho_ten`, P);
    const theoKhoa = await this.ds.query(`
      SELECT k.ten_khoa AS khoa, COUNT(bs.id)::int AS so_bs
        FROM khoa_phong k LEFT JOIN bac_si bs ON bs.khoa_id = k.id
       GROUP BY k.ten_khoa ORDER BY so_bs DESC`);

    const tongDat = theoBacSi.reduce((s, r) => s + this.so(r.da_dat), 0);
    return {
      the: [
        { nhan: 'Bác sĩ', gia_tri: this.so(dem.bac_si) },
        { nhan: 'Khoa phòng', gia_tri: this.so(dem.khoa) },
        { nhan: 'Bác sĩ có tài khoản', gia_tri: this.so(dem.co_tk) },
        { nhan: 'Lượt đặt TB / bác sĩ', gia_tri: this.so(dem.bac_si) ? Math.round(tongDat / this.so(dem.bac_si)) : 0 },
      ],
      bang: [
        { tieu_de: 'Khối lượng theo bác sĩ', cot: ['Bác sĩ', 'Khoa', 'Chỗ mở', 'Đã đặt', 'Đã khám', 'Công suất'],
          dong: theoBacSi.map((r) => [r.bac_si, r.khoa, this.so(r.cho), this.so(r.da_dat), this.so(r.da_kham),
            this.so(r.cho) ? Math.round((this.so(r.da_dat) / this.so(r.cho)) * 100) + '%' : '—']) },
        { tieu_de: 'Số bác sĩ theo khoa', cot: ['Khoa', 'Số bác sĩ'], dong: theoKhoa.map((r) => [r.khoa, this.so(r.so_bs)]) },
      ],
      chu_thich: 'Chỗ mở và đã đặt tính trên các khung giờ trong kỳ báo cáo.',
    };
  }

  // --- Vật tư tiêu hao: tổng hợp SỐ LƯỢNG ĐÃ DÙNG và CHI PHÍ từ các dòng vật tư
  // trên phiếu y lệnh (chi_tiet_y_lenh.loai = 'vat_tu') trong kỳ, đối chiếu với
  // danh mục vat_tu_tieu_hao. Đây là số thực tế đã ghi vào phiếu viện phí, chưa
  // phải xuất/tồn kho — hệ thống chưa có phân hệ kho.
  private async vatTu(ky: { tu: string; den: string }) {
    const P = [ky.tu, ky.den];
    const [tong] = await this.ds.query(`
      SELECT COUNT(*)::int AS so_dong,
             COUNT(DISTINCT y.id)::int AS so_phieu,
             COALESCE(SUM(ct.so_luong),0)::float AS so_luong,
             COALESCE(SUM(ct.thanh_tien),0)::int AS chi_phi,
             COUNT(*) FILTER (WHERE ct.don_gia = 0)::int AS chua_co_gia
        FROM chi_tiet_y_lenh ct JOIN y_lenh y ON y.id = ct.y_lenh_id
       WHERE ct.loai = 'vat_tu' AND y.ngay_tao::date BETWEEN $1 AND $2`, P);

    const theoVatTu = await this.ds.query(`
      SELECT ct.ten AS vat_tu,
             COALESCE(vt.nhom_ten, '(ngoài danh mục)') AS nhom,
             COALESCE(vt.dvt, ct.dvt, '') AS dvt,
             SUM(ct.so_luong)::float AS sl,
             COUNT(DISTINCT y.id)::int AS so_phieu,
             COALESCE(SUM(ct.thanh_tien),0)::int AS chi_phi
        FROM chi_tiet_y_lenh ct
        JOIN y_lenh y ON y.id = ct.y_lenh_id
        LEFT JOIN vat_tu_tieu_hao vt ON vt.ma_vt = ct.ma_vt
       WHERE ct.loai = 'vat_tu' AND y.ngay_tao::date BETWEEN $1 AND $2
       GROUP BY ct.ten, vt.nhom_ten, vt.dvt, ct.dvt
       ORDER BY chi_phi DESC, sl DESC`, P);

    const theoNhom = await this.ds.query(`
      SELECT COALESCE(vt.nhom_ten, '(ngoài danh mục)') AS nhom,
             COUNT(DISTINCT ct.ten)::int AS so_loai,
             SUM(ct.so_luong)::float AS sl,
             COALESCE(SUM(ct.thanh_tien),0)::int AS chi_phi
        FROM chi_tiet_y_lenh ct
        JOIN y_lenh y ON y.id = ct.y_lenh_id
        LEFT JOIN vat_tu_tieu_hao vt ON vt.ma_vt = ct.ma_vt
       WHERE ct.loai = 'vat_tu' AND y.ngay_tao::date BETWEEN $1 AND $2
       GROUP BY vt.nhom_ten ORDER BY chi_phi DESC`, P);

    // Khoa lấy từ chuyên khoa ghi trên phiếu khám bệnh mà phiếu y lệnh liên kết
    const theoKhoa = await this.ds.query(`
      SELECT COALESCE(NULLIF(pk.chuyen_khoa,''), '(không rõ khoa)') AS khoa,
             COUNT(DISTINCT y.id)::int AS so_phieu,
             SUM(ct.so_luong)::float AS sl,
             COALESCE(SUM(ct.thanh_tien),0)::int AS chi_phi
        FROM chi_tiet_y_lenh ct
        JOIN y_lenh y ON y.id = ct.y_lenh_id
        LEFT JOIN phieu_kham_benh pk ON pk.id = y.phieu_kham_id
       WHERE ct.loai = 'vat_tu' AND y.ngay_tao::date BETWEEN $1 AND $2
       GROUP BY pk.chuyen_khoa ORDER BY chi_phi DESC`, P);

    const [danhMuc] = await this.ds.query(`
      SELECT COUNT(*)::int AS tong,
             COUNT(*) FILTER (WHERE hoat_dong)::int AS dang_dung,
             COUNT(*) FILTER (WHERE don_gia > 0)::int AS co_gia
        FROM vat_tu_tieu_hao`);

    const sl = (v: any) => Math.round(this.so(v) * 100) / 100;
    return {
      the: [
        { nhan: 'Chi phí vật tư trong kỳ', gia_tri: this.so(tong.chi_phi), dinh_dang: 'tien' as const },
        { nhan: 'Số lượng đã dùng', gia_tri: sl(tong.so_luong) },
        { nhan: 'Phiếu viện phí có vật tư', gia_tri: this.so(tong.so_phieu) },
        { nhan: 'Vật tư trong danh mục', gia_tri: this.so(danhMuc ? danhMuc.dang_dung : 0) },
      ],
      bang: [
        { tieu_de: 'Số lượng và chi phí theo vật tư',
          cot: ['Vật tư', 'Nhóm', 'ĐVT', 'Số lượng', 'Số phiếu', 'Chi phí'],
          dong: theoVatTu.map((r) => [r.vat_tu, r.nhom, r.dvt, sl(r.sl), this.so(r.so_phieu), this.so(r.chi_phi)]) },
        { tieu_de: 'Theo nhóm vật tư',
          cot: ['Nhóm', 'Số loại', 'Số lượng', 'Chi phí'],
          dong: theoNhom.map((r) => [r.nhom, this.so(r.so_loai), sl(r.sl), this.so(r.chi_phi)]) },
        { tieu_de: 'Theo khoa điều trị',
          cot: ['Khoa', 'Số phiếu', 'Số lượng', 'Chi phí'],
          dong: theoKhoa.map((r) => [r.khoa, this.so(r.so_phieu), sl(r.sl), this.so(r.chi_phi)]) },
      ],
      chua_co_du_lieu: this.so(tong.so_dong) === 0,
      chu_thich: this.so(tong.so_dong) === 0
        ? 'Trong kỳ chưa có dòng vật tư tiêu hao nào trên phiếu viện phí. '
          + `Danh mục hiện có ${this.so(danhMuc ? danhMuc.tong : 0)} vật tư (chạy "npm run seed:vat-tu" nếu chưa nạp).`
        : 'Số liệu lấy từ các dòng vật tư trên phiếu y lệnh lập trong kỳ (chưa phải xuất/tồn kho). '
          + (this.so(tong.chua_co_gia) > 0
            ? `Có ${this.so(tong.chua_co_gia)} dòng chưa nhập đơn giá nên chi phí chưa phản ánh đủ. `
            : '')
          + `Danh mục có ${this.so(danhMuc ? danhMuc.co_gia : 0)}/${this.so(danhMuc ? danhMuc.tong : 0)} vật tư đã có giá niêm yết.`,
    };
  }

  // Xuất CSV cho Excel (UTF-8 BOM)
  async xuatCsv(loai: string, tu?: string, den?: string) {
    const r = await this.lay(loai, tu, den);
    const cell = (v: any) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const row = (...c: any[]) => c.map(cell).join(',');
    const lines: string[] = [];
    lines.push(row(`BÁO CÁO: ${r.ten.toUpperCase()} — BV PHỤ SẢN HẢI PHÒNG`));
    lines.push(row('Kỳ báo cáo', `${r.ky.tu.split('-').reverse().join('/')} - ${r.ky.den.split('-').reverse().join('/')}`));
    lines.push(row('Xuất lúc', new Date().toLocaleString('vi-VN')));
    if (r.chu_thich) lines.push(row('Ghi chú', r.chu_thich));
    lines.push('');
    if (r.the.length) {
      lines.push(row('CHỈ SỐ TỔNG HỢP'));
      for (const t of r.the) lines.push(row(t.nhan, t.gia_tri));
      lines.push('');
    }
    for (const b of r.bang) {
      lines.push(row(b.tieu_de.toUpperCase()));
      lines.push(row(...b.cot));
      for (const d of b.dong) lines.push(row(...d));
      lines.push('');
    }
    return Buffer.from('﻿' + lines.join('\r\n'), 'utf8');
  }
}

@Controller('api')
export class ReportController {
  constructor(private svc: ReportService) {}

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.ADMIN)
  @Get('admin/report-types') loai() { return LOAI_BAO_CAO; }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.ADMIN)
  @Get('admin/report/:loai') baoCao(@Param('loai') loai: string, @Query('tu') tu?: string, @Query('den') den?: string) {
    return this.svc.lay(loai, tu, den);
  }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.ADMIN)
  @Get('admin/report/:loai/export')
  async xuat(@Param('loai') loai: string, @Res({ passthrough: true }) res: any,
             @Query('tu') tu?: string, @Query('den') den?: string) {
    const buf = await this.svc.xuatCsv(loai, tu, den);
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="bao-cao-${loai}.csv"`,
    });
    return new StreamableFile(buf);
  }
}
