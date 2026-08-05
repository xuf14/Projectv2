import {
  Injectable, Controller, Get, Post, Patch, Body, Param, Query, Request, UseGuards,
  BadRequestException, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import {
  DangKyKham, KhoaPhong, NhatKyHoatDong, VaiTro, BacSi, HoSoBenhNhan, KhungGio, LichHen,
  TrangThaiLich,
} from './entities';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { JwtAuthGuard, RolesGuard, Roles } from './auth';
import { guiThongBao, idQuanTriVien } from './notification.module';

// ============================================================================
//  ĐĂNG KÝ KHÁM ONLINE — bệnh nhân mới/cũ điền thông tin ở trang công khai để
//  đến khám tại một khoa. Phiếu vào hàng chờ của lễ tân (trang Tiếp đón).
//    POST  /public/dang-ky-kham         (CÔNG KHAI, không đăng nhập)
//    GET   /reception/dang-ky-kham      lễ tân xem hàng chờ (lọc trạng thái)
//    PATCH /reception/dang-ky-kham/:id  lễ tân xác nhận (chốt khoa/bác sĩ/ngày giờ)
//                                       hoặc hủy phiếu
//  Khi lễ tân xác nhận: tạo (hoặc gắn) hồ sơ bệnh nhân + lịch khám thật với bác
//  sĩ của khoa, nên lịch xuất hiện ngay ở cổng bác sĩ và có thông báo cho bác sĩ.
//  Mọi dữ liệu client là KHÔNG tin cậy: chỉ nhận đúng trường được phép, kiểm
//  tra kiểu và độ dài, và chặn spam sơ bộ theo số điện thoại.
// ============================================================================

const TRANG_THAI = ['cho_tiep_don', 'da_tiep_nhan', 'da_huy'];
const GIOI_TINH = ['Nữ', 'Nam', 'Khác'];
const MAX_CHO_MOI_SDT = 5; // tối đa số phiếu đang chờ cho một số điện thoại
// Số lần gửi phiếu tối đa của MỘT IP trong 1 phút (cấu hình qua .env cho môi trường tải cao)
const GIOI_HAN_DANG_KY = Math.max(1, Number(process.env.THROTTLE_DANG_KY_LIMIT) || 5);
const REL = ['khoa', 'nguoi_xu_ly', 'ho_so', 'lich_hen', 'lich_hen.khung_gio', 'lich_hen.khung_gio.bac_si'];

@Injectable()
export class DangKyKhamService {
  constructor(
    @InjectRepository(DangKyKham) private repo: Repository<DangKyKham>,
    @InjectRepository(KhoaPhong) private khoa: Repository<KhoaPhong>,
    private ds: DataSource,
  ) {}

  private ghiNhatKy(m: EntityManager, userId: number | null, hanhDong: string, noiDung: string) {
    return m.save(m.create(NhatKyHoatDong, {
      hanh_dong: hanhDong, noi_dung: noiDung,
      nguoi_dung: userId ? ({ id: userId } as any) : null,
    }));
  }

  private async taoMa(m: EntityManager): Promise<string> {
    // DK + 8 chữ số ngẫu nhiên, đảm bảo không trùng
    for (let i = 0; i < 12; i++) {
      const ma = 'DK' + String(Math.floor(10000000 + Math.random() * 90000000));
      const trung = await m.findOne(DangKyKham, { where: { ma_dang_ky: ma } });
      if (!trung) return ma;
    }
    throw new BadRequestException('Không tạo được mã đăng ký, vui lòng thử lại');
  }

  private ngayHopLe(v: string, ten: string): string | null {
    const s = (v ?? '').toString().trim();
    if (!s) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || isNaN(new Date(s).getTime()))
      throw new BadRequestException(`${ten} không hợp lệ (định dạng YYYY-MM-DD)`);
    return s;
  }

  // Giờ khám dạng HH:mm trong khung giờ làm việc (07:00–17:00); rỗng = không chọn
  private gioHopLe(v: string, ten: string): string | null {
    const s = (v ?? '').toString().trim();
    if (!s) return null;
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) throw new BadRequestException(`${ten} không hợp lệ (định dạng HH:mm)`);
    if (s < '07:00' || s > '17:00') throw new BadRequestException(`${ten} phải trong giờ làm việc (07:00–17:00)`);
    return s;
  }

  private goi(h: DangKyKham) {
    const lh = h.lich_hen;
    const kg = lh ? lh.khung_gio : null;
    return {
      id: h.id, ma_dang_ky: h.ma_dang_ky, ho_ten: h.ho_ten, ngay_sinh: h.ngay_sinh,
      gioi_tinh: h.gioi_tinh, sdt: h.sdt, email: h.email, dia_chi: h.dia_chi,
      benh_nhan_cu: h.benh_nhan_cu, ma_benh_nhan_cu: h.ma_benh_nhan_cu,
      ly_do: h.ly_do, ngay_mong_muon: h.ngay_mong_muon, gio_mong_muon: h.gio_mong_muon,
      trang_thai: h.trang_thai,
      ghi_chu_le_tan: h.ghi_chu_le_tan, ngay_tao: h.ngay_tao, ngay_cap_nhat: h.ngay_cap_nhat,
      khoa: h.khoa ? { id: h.khoa.id, ten_khoa: h.khoa.ten_khoa, ma: h.khoa.ma } : null,
      nguoi_xu_ly: h.nguoi_xu_ly ? h.nguoi_xu_ly.ho_ten : null,
      ho_so: h.ho_so ? { id: h.ho_so.id, ma_benh_nhan: h.ho_so.ma_benh_nhan, ho_ten: h.ho_so.ho_ten } : null,
      lich_hen: lh ? {
        id: lh.id, ma_lich_hen: lh.ma_lich_hen, trang_thai: lh.trang_thai, so_thu_tu: lh.so_thu_tu,
        ngay: kg ? kg.ngay : null, gio: kg ? kg.gio_bat_dau : null,
        bac_si: kg && kg.bac_si ? kg.bac_si.ho_ten : null,
      } : null,
    };
  }

  // ---- CÔNG KHAI: bệnh nhân gửi phiếu đăng ký ----
  async dangKy(dto: any) {
    const hoTen = (dto?.ho_ten ?? '').toString().trim();
    if (hoTen.length < 2 || hoTen.length > 120) throw new BadRequestException('Vui lòng nhập họ và tên hợp lệ');

    const sdtRaw = (dto?.sdt ?? '').toString().trim();
    const soChuSo = (sdtRaw.match(/\d/g) || []).length;
    if (soChuSo < 8 || soChuSo > 15 || sdtRaw.length > 20 || /[^0-9+ .()-]/.test(sdtRaw))
      throw new BadRequestException('Số điện thoại không hợp lệ');

    const gioiTinh = (dto?.gioi_tinh ?? '').toString().trim();
    if (gioiTinh && !GIOI_TINH.includes(gioiTinh)) throw new BadRequestException('Giới tính không hợp lệ');

    const email = (dto?.email ?? '').toString().trim().slice(0, 160);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('Email không hợp lệ');

    const ngaySinh = this.ngayHopLe(dto?.ngay_sinh, 'Ngày sinh');
    if (ngaySinh && ngaySinh > new Date().toLocaleDateString('en-CA'))
      throw new BadRequestException('Ngày sinh không hợp lệ');
    const ngayMongMuon = this.ngayHopLe(dto?.ngay_mong_muon, 'Ngày mong muốn');
    if (ngayMongMuon && ngayMongMuon < new Date().toLocaleDateString('en-CA'))
      throw new BadRequestException('Ngày mong muốn khám không được ở quá khứ');
    const gioMongMuon = this.gioHopLe(dto?.gio_mong_muon, 'Giờ mong muốn');
    if (gioMongMuon && !ngayMongMuon)
      throw new BadRequestException('Vui lòng chọn ngày mong muốn đến khám trước khi chọn giờ');

    // Khoa là trường bắt buộc: phiếu phải biết khoa thì lễ tân mới xếp được lịch
    if (dto?.khoa_id === undefined || dto?.khoa_id === null || dto?.khoa_id === '')
      throw new BadRequestException('Vui lòng chọn khoa muốn khám');
    const khoaId = Number(dto.khoa_id);
    if (!Number.isInteger(khoaId) || khoaId <= 0) throw new BadRequestException('Khoa không hợp lệ');
    const khoa: KhoaPhong | null = await this.khoa.findOne({ where: { id: khoaId } });
    if (!khoa) throw new BadRequestException('Khoa muốn khám không tồn tại');

    const benhNhanCu = dto?.benh_nhan_cu === true || dto?.benh_nhan_cu === 'true';
    const maBnCu = benhNhanCu ? (dto?.ma_benh_nhan_cu ?? '').toString().trim().slice(0, 40) || null : null;
    const diaChi = (dto?.dia_chi ?? '').toString().trim().slice(0, 300) || null;
    const lyDo = (dto?.ly_do ?? '').toString().trim().slice(0, 1000) || null;

    return this.ds.transaction(async (m) => {
      // Chặn spam sơ bộ: một số điện thoại chỉ được có tối đa N phiếu đang chờ
      const dangCho = await m.count(DangKyKham, { where: { sdt: sdtRaw, trang_thai: 'cho_tiep_don' } });
      if (dangCho >= MAX_CHO_MOI_SDT)
        throw new BadRequestException('Số điện thoại này đang có quá nhiều phiếu chờ tiếp đón. Vui lòng liên hệ tổng đài để được hỗ trợ.');

      const ma = await this.taoMa(m);
      const h = await m.save(m.create(DangKyKham, {
        ma_dang_ky: ma, ho_ten: hoTen, ngay_sinh: ngaySinh, gioi_tinh: gioiTinh || null,
        sdt: sdtRaw, email: email || null, dia_chi: diaChi, benh_nhan_cu: benhNhanCu,
        ma_benh_nhan_cu: maBnCu, ly_do: lyDo, ngay_mong_muon: ngayMongMuon,
        gio_mong_muon: gioMongMuon,
        trang_thai: 'cho_tiep_don', khoa: { id: khoa.id } as any,
      }));
      await this.ghiNhatKy(m, null, 'dang_ky_online',
        `Đăng ký khám online ${ma} — ${hoTen} · ${khoa.ten_khoa}`);
      return { ma_dang_ky: ma, trang_thai: h.trang_thai, message: 'Đã gửi đăng ký khám. Lễ tân sẽ liên hệ xác nhận.' };
    });
  }

  // ---- LỄ TÂN: hàng chờ đăng ký ----
  async danhSach(trangThai?: string) {
    const where: any = {};
    if (trangThai) {
      if (!TRANG_THAI.includes(trangThai)) throw new BadRequestException('Trạng thái không hợp lệ');
      where.trang_thai = trangThai;
    }
    const list = await this.repo.find({
      where, relations: REL, order: { ngay_tao: 'DESC' }, take: 300,
    });
    const cho = await this.repo.count({ where: { trang_thai: 'cho_tiep_don' } });
    return { cho_tiep_don: cho, danh_sach: list.map((h) => this.goi(h)) };
  }

  // ---- LỄ TÂN: xác nhận (chốt khoa/bác sĩ/ngày giờ) hoặc hủy phiếu ----
  // Xác nhận = tạo lịch khám thật: lễ tân bắt buộc chọn bác sĩ + ngày + giờ, nhờ
  // đó lịch hiện ở cổng bác sĩ của khoa và bác sĩ nhận được thông báo.
  async capNhat(userId: number, id: number, dto: any) {
    const tt = (dto?.trang_thai ?? '').toString();
    if (!['da_tiep_nhan', 'da_huy'].includes(tt))
      throw new BadRequestException('Chỉ được đánh dấu "đã tiếp nhận" hoặc "hủy"');
    const ghiChu = (dto?.ghi_chu_le_tan ?? '').toString().trim().slice(0, 1000) || null;

    let bacSiId = 0, khoaId = 0, hoSoId = 0, ngay = '', gio = '';
    if (tt === 'da_tiep_nhan') {
      bacSiId = Number(dto?.bac_si_id);
      if (!Number.isInteger(bacSiId) || bacSiId <= 0) throw new BadRequestException('Vui lòng chọn bác sĩ khám cho bệnh nhân');
      ngay = this.ngayHopLe(dto?.ngay_kham, 'Ngày khám') || '';
      if (!ngay) throw new BadRequestException('Vui lòng chọn ngày khám');
      if (ngay < new Date().toLocaleDateString('en-CA')) throw new BadRequestException('Ngày khám không được ở quá khứ');
      gio = this.gioHopLe(dto?.gio_kham, 'Giờ khám') || '';
      if (!gio) throw new BadRequestException('Vui lòng chọn giờ khám');
      if (dto?.khoa_id !== undefined && dto?.khoa_id !== null && dto?.khoa_id !== '') {
        khoaId = Number(dto.khoa_id);
        if (!Number.isInteger(khoaId) || khoaId <= 0) throw new BadRequestException('Khoa không hợp lệ');
      }
      if (dto?.ho_so_id !== undefined && dto?.ho_so_id !== null && dto?.ho_so_id !== '') {
        hoSoId = Number(dto.ho_so_id);
        if (!Number.isInteger(hoSoId) || hoSoId <= 0) throw new BadRequestException('Hồ sơ bệnh nhân không hợp lệ');
      }
    }

    return this.ds.transaction(async (m) => {
      const h = await m.findOne(DangKyKham, { where: { id }, relations: ['khoa'] });
      if (!h) throw new NotFoundException('Phiếu đăng ký không tồn tại');
      if (h.trang_thai !== 'cho_tiep_don')
        throw new BadRequestException('Phiếu đã được xử lý trước đó');

      let moTaLich = '';
      if (tt === 'da_tiep_nhan') {
        const bacSi = await m.findOne(BacSi, { where: { id: bacSiId }, relations: ['khoa', 'nguoi_dung'] });
        if (!bacSi) throw new BadRequestException('Bác sĩ không tồn tại');
        if (khoaId) {
          const khoa = await m.findOne(KhoaPhong, { where: { id: khoaId } });
          if (!khoa) throw new BadRequestException('Khoa khám không tồn tại');
          if (!bacSi.khoa || bacSi.khoa.id !== khoa.id)
            throw new BadRequestException(`Bác sĩ ${bacSi.ho_ten} không thuộc khoa ${khoa.ten_khoa}`);
          h.khoa = { id: khoa.id } as any;
        } else if (bacSi.khoa) {
          h.khoa = { id: bacSi.khoa.id } as any;
        }

        // Hồ sơ bệnh nhân: gắn hồ sơ cũ lễ tân chọn, hoặc tạo hồ sơ mới từ phiếu
        let hoSo = hoSoId ? await m.findOne(HoSoBenhNhan, { where: { id: hoSoId } }) : null;
        if (hoSoId && !hoSo) throw new BadRequestException('Hồ sơ bệnh nhân không tồn tại');
        if (!hoSo) {
          hoSo = await m.save(m.create(HoSoBenhNhan, {
            ma_benh_nhan: 'BN' + Date.now().toString().slice(-8),
            ho_ten: h.ho_ten, ngay_sinh: h.ngay_sinh, gioi_tinh: h.gioi_tinh,
            dia_chi: h.dia_chi, sdt: h.sdt,
          }));
        }

        // Dùng lại khung giờ sẵn có của bác sĩ trong ngày; chưa có thì tạo mới
        let slot = await m.findOne(KhungGio, { where: { ngay, gio_bat_dau: gio, bac_si: { id: bacSiId } } });
        if (!slot) {
          const ketThuc = `${String((+gio.slice(0, 2) + 1) % 24).padStart(2, '0')}:${gio.slice(3)}`;
          slot = m.create(KhungGio, {
            ngay, gio_bat_dau: gio, gio_ket_thuc: ketThuc, so_luong: 5, da_dat: 0,
            bac_si: { id: bacSiId } as any,
          });
        }
        if (slot.da_dat >= slot.so_luong) throw new BadRequestException('Khung giờ này của bác sĩ đã kín lịch');
        slot.da_dat += 1;
        await m.save(slot);

        const ma = 'BV' + Math.random().toString(36).slice(2, 7).toUpperCase();
        const lich = await m.save(m.create(LichHen, {
          ma_lich_hen: ma, ho_so: hoSo, khung_gio: slot, khoa: bacSi.khoa,
          trang_thai: TrangThaiLich.DA_XAC_NHAN,   // lễ tân đã xác nhận với bệnh nhân
          so_thu_tu: slot.da_dat,
        }));
        h.ho_so = { id: hoSo.id } as any;
        h.lich_hen = { id: lich.id } as any;

        const ngayVN = new Date(ngay).toLocaleDateString('vi-VN');
        moTaLich = ` — lịch ${ma}, ${bacSi.ho_ten}, ${ngayVN} ${gio}`;
        await guiThongBao(m, [
          ...(bacSi.nguoi_dung ? [bacSi.nguoi_dung.id] : []),
          ...(await idQuanTriVien(m)),
        ], {
          loai: 'lich_kham',
          tieu_de: 'Lịch khám mới từ đăng ký online',
          noi_dung: `Bệnh nhân ${hoSo.ho_ten} (${hoSo.ma_benh_nhan}) khám ngày ${ngayVN} lúc ${gio}` +
            ` — mã lịch ${ma}, đăng ký ${h.ma_dang_ky}${h.ly_do ? `. Lý do: ${h.ly_do}` : ''}`,
          lich_hen_id: lich.id,
        });
      }

      h.trang_thai = tt;
      h.ghi_chu_le_tan = ghiChu;
      h.nguoi_xu_ly = { id: userId } as any;
      await m.save(h);
      await this.ghiNhatKy(m, userId, 'xu_ly_dang_ky_online',
        `${tt === 'da_tiep_nhan' ? 'Xác nhận' : 'Hủy'} phiếu đăng ký ${h.ma_dang_ky} — ${h.ho_ten}${moTaLich}`);
      const full = await m.findOne(DangKyKham, { where: { id }, relations: REL });
      return this.goi(full);
    });
  }
}

@Controller('api')
export class DangKyKhamController {
  constructor(private svc: DangKyKhamService) {}

  // CÔNG KHAI — không yêu cầu đăng nhập. Giới hạn số lần gửi trên mỗi IP trong
  // một phút để chống gửi phiếu hàng loạt (bổ sung cho hạn mức theo số điện thoại).
  @Throttle({ default: { limit: GIOI_HAN_DANG_KY, ttl: 60000 } })
  @UseGuards(ThrottlerGuard)
  @Post('public/dang-ky-kham') dangKy(@Body() b) { return this.svc.dangKy(b); }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.ADMIN)
  @Get('reception/dang-ky-kham') danhSach(@Query('trang_thai') tt?: string) { return this.svc.danhSach(tt); }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.ADMIN)
  @Patch('reception/dang-ky-kham/:id') capNhat(@Request() r, @Param('id') id: string, @Body() b) {
    return this.svc.capNhat(r.user.id, +id, b);
  }
}
