import {
  Injectable, Controller, Get, Post, Patch, Delete, Body, Param, Request, UseGuards,
  BadRequestException, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { HoSoBenhNhan, LichHen, NhatKyHoatDong, VaiTro } from './entities';
import { JwtAuthGuard, RolesGuard, Roles } from './auth';

// Các trường bệnh nhân được phép ghi — mọi trường khác trong body bị bỏ qua
const WRITABLE = ['ho_ten', 'ngay_sinh', 'gioi_tinh', 'dia_chi', 'sdt', 'so_bhyt'] as const;

// Lọc + kiểm tra dữ liệu hồ sơ từ client. partial=true cho PATCH (chỉ trường gửi lên).
// Export để trang đăng ký (auth.module) dùng chung khi tạo hồ sơ kèm tài khoản.
export function chuanHoaHoSo(dto: any, partial: boolean) {
  const out: Record<string, string | null> = {};
  for (const k of WRITABLE) {
    if (dto[k] === undefined) continue;
    const v = dto[k] === null ? '' : String(dto[k]).trim();
    out[k] = v || null;
  }
  if (!partial && !out.ho_ten) throw new BadRequestException('Họ và tên là bắt buộc');
  if (out.ho_ten !== undefined) {
    if (!out.ho_ten) throw new BadRequestException('Họ và tên không được để trống');
    if (out.ho_ten.length > 100) throw new BadRequestException('Họ và tên quá dài');
  }
  if (out.ngay_sinh) {
    const d = new Date(out.ngay_sinh);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(out.ngay_sinh) || isNaN(d.getTime()))
      throw new BadRequestException('Ngày sinh không hợp lệ (định dạng YYYY-MM-DD)');
    if (d > new Date()) throw new BadRequestException('Ngày sinh không được ở tương lai');
  }
  if (out.gioi_tinh && !['Nữ', 'Nam', 'Khác'].includes(out.gioi_tinh))
    throw new BadRequestException('Giới tính phải là Nữ, Nam hoặc Khác');
  if (out.sdt) {
    const sdt = out.sdt.replace(/[\s.]/g, '');
    if (!/^0\d{9,10}$/.test(sdt)) throw new BadRequestException('Số điện thoại không hợp lệ');
    out.sdt = sdt;
  }
  if (out.dia_chi && out.dia_chi.length > 200) throw new BadRequestException('Địa chỉ quá dài');
  if (out.so_bhyt && out.so_bhyt.length > 50) throw new BadRequestException('Số BHYT quá dài');
  return out;
}

@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(HoSoBenhNhan) private hoSo: Repository<HoSoBenhNhan>,
    @InjectRepository(NhatKyHoatDong) private nhatKy: Repository<NhatKyHoatDong>,
    private ds: DataSource,
  ) {}

  // Ghi nhật ký kèm timestamp — luôn gọi bên trong transaction của thao tác chính
  private ghiNhatKy(m: EntityManager, userId: number, hanhDong: string, noiDung: string) {
    return m.save(m.create(NhatKyHoatDong, {
      hanh_dong: hanhDong, noi_dung: noiDung, nguoi_dung: { id: userId } as any,
    }));
  }

  // --- Lễ tân / Quản trị viên quản lý hồ sơ bệnh nhân theo ho_so_id ---
  // (hồ sơ do lễ tân lập không gắn tài khoản đăng nhập; thao tác theo id trực tiếp)
  async layMot(id: number) {
    const hs = await this.hoSo.findOne({ where: { id } });
    if (!hs) throw new NotFoundException('Hồ sơ bệnh nhân không tồn tại');
    return hs;
  }

  taoHoSoLeTan(userId: number, dto: any) {
    const data = chuanHoaHoSo(dto, false);
    return this.ds.transaction(async (m) => {
      const hs = await m.save(m.create(HoSoBenhNhan, {
        ...data, ma_benh_nhan: 'BN' + Date.now().toString().slice(-8),
      }));
      await this.ghiNhatKy(m, userId, 'tao_ho_so', `Tạo hồ sơ ${hs.ma_benh_nhan} (${hs.ho_ten})`);
      return hs;
    });
  }

  capNhatHoSoLeTan(userId: number, id: number, dto: any) {
    const data = chuanHoaHoSo(dto, true);
    const truongDoi = Object.keys(data);
    if (!truongDoi.length) throw new BadRequestException('Không có trường nào để cập nhật');
    return this.ds.transaction(async (m) => {
      const hs = await m.findOne(HoSoBenhNhan, { where: { id } });
      if (!hs) throw new NotFoundException('Hồ sơ bệnh nhân không tồn tại');
      Object.assign(hs, data);
      const saved = await m.save(hs);
      await this.ghiNhatKy(m, userId, 'cap_nhat_ho_so',
        `Cập nhật hồ sơ ${hs.ma_benh_nhan} (${hs.ho_ten}): ${truongDoi.join(', ')}`);
      return saved;
    });
  }

  xoaHoSoLeTan(userId: number, id: number) {
    return this.ds.transaction(async (m) => {
      const hs = await m.findOne(HoSoBenhNhan, { where: { id } });
      if (!hs) throw new NotFoundException('Hồ sơ bệnh nhân không tồn tại');
      const soLich = await m.count(LichHen, { where: { ho_so: { id } } });
      if (soLich > 0)
        throw new BadRequestException('Hồ sơ đang có lịch hẹn trong hệ thống. Hãy hủy và xóa các lịch hẹn trước.');
      await m.delete(HoSoBenhNhan, id);
      await this.ghiNhatKy(m, userId, 'xoa_ho_so', `Xóa hồ sơ ${hs.ma_benh_nhan} (${hs.ho_ten})`);
      return { message: 'Đã xóa hồ sơ', ma_benh_nhan: hs.ma_benh_nhan };
    });
  }

  // Lịch sử khám của chính bệnh nhân: mọi lượt khám thuộc các hồ sơ trong tài khoản
  // Quản trị viên xem nhật ký — chỉ trả các trường cần thiết, không kèm hash mật khẩu
  async nhatKyHoatDong() {
    const logs = await this.nhatKy.find({
      relations: ['nguoi_dung'], order: { thoi_gian: 'DESC' }, take: 100,
    });
    return logs.map((l) => ({
      id: l.id, thoi_gian: l.thoi_gian, hanh_dong: l.hanh_dong, noi_dung: l.noi_dung,
      nguoi_dung: l.nguoi_dung
        ? { id: l.nguoi_dung.id, ho_ten: l.nguoi_dung.ho_ten, email: l.nguoi_dung.email, vai_tro: l.nguoi_dung.vai_tro }
        : null,
    }));
  }
}

@Controller('api')
export class ProfileController {
  constructor(private svc: ProfileService) {}

  // Lễ tân / Quản trị viên quản lý hồ sơ bệnh nhân được chọn (xem/sửa/xóa/tạo).
  // Dùng tiền tố /reception/ho-so để tránh trùng route với POST /reception/patients
  // (tiếp nhận bệnh nhân walk-in) trong patient-info.module.
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.ADMIN)
  @Get('reception/ho-so/:id') ltMot(@Param('id') id) { return this.svc.layMot(+id); }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.ADMIN)
  @Post('reception/ho-so') ltTao(@Request() r, @Body() b) { return this.svc.taoHoSoLeTan(r.user.id, b); }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.ADMIN)
  @Patch('reception/ho-so/:id') ltCapNhat(@Request() r, @Param('id') id, @Body() b) { return this.svc.capNhatHoSoLeTan(r.user.id, +id, b); }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.ADMIN)
  @Delete('reception/ho-so/:id') ltXoa(@Request() r, @Param('id') id) { return this.svc.xoaHoSoLeTan(r.user.id, +id); }

  // Quản trị viên theo dõi nhật ký thao tác (timestamp từng hành động)
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.ADMIN)
  @Get('admin/activity') nhatKy() { return this.svc.nhatKyHoatDong(); }
}
