import {
  Injectable, Controller, Get, Post, Patch, Body, Param, Request, UseGuards,
  BadRequestException, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { NguoiDung, BacSi, KhoaPhong, KhungGio, NhatKyHoatDong, VaiTro } from './entities';
import { JwtAuthGuard, RolesGuard, Roles } from './auth';

// Quản trị viên chỉ tạo tài khoản nhân sự; bệnh nhân tự đăng ký ở trang public
const VAI_TRO_TAO_DUOC: string[] = [VaiTro.BAC_SI, VaiTro.LE_TAN, VaiTro.ADMIN];
const GIO_KHAM = ['07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '13:30', '14:00', '14:30', '15:00'];
const SO_NGAY_SINH_KHUNG_GIO = 14;

const NHAN_VAI_TRO: Record<string, string> = {
  bac_si: 'Bác sĩ', le_tan: 'Lễ tân', admin: 'Quản trị viên', benh_nhan: 'Bệnh nhân',
};

@Injectable()
export class UserAdminService {
  constructor(
    @InjectRepository(NguoiDung) private users: Repository<NguoiDung>,
    @InjectRepository(BacSi) private bacSi: Repository<BacSi>,
    private ds: DataSource,
  ) {}

  // Danh sách tài khoản kèm thông tin bác sĩ được gắn (không trả hash mật khẩu)
  async danhSach() {
    const [users, dsBacSi] = await Promise.all([
      this.users.find({ order: { id: 'ASC' } }),
      this.bacSi.find({ relations: ['nguoi_dung'] }),
    ]);
    return users.map((u) => {
      const bs = dsBacSi.find((b) => b.nguoi_dung && b.nguoi_dung.id === u.id);
      return {
        id: u.id, ho_ten: u.ho_ten, sdt: u.sdt, email: u.email,
        vai_tro: u.vai_tro, trang_thai: u.trang_thai, ngay_tao: u.ngay_tao,
        bac_si: bs ? { id: bs.id, chuyen_mon: bs.chuyen_mon, khoa: bs.khoa ? bs.khoa.ten_khoa : null } : null,
      };
    });
  }

  async taoTaiKhoan(adminId: number, dto: any) {
    const hoTen = String(dto.ho_ten || '').trim();
    const email = String(dto.email || '').trim().toLowerCase();
    const sdt = dto.sdt ? String(dto.sdt).replace(/[\s.]/g, '') : null;
    if (!hoTen) throw new BadRequestException('Họ và tên là bắt buộc');
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new BadRequestException('Email đăng nhập không hợp lệ');
    if (!dto.mat_khau || String(dto.mat_khau).length < 6)
      throw new BadRequestException('Mật khẩu phải có ít nhất 6 ký tự');
    if (!VAI_TRO_TAO_DUOC.includes(dto.vai_tro))
      throw new BadRequestException('Vai trò phải là Bác sĩ, Lễ tân hoặc Quản trị viên');
    if (sdt && !/^0\d{9,10}$/.test(sdt)) throw new BadRequestException('Số điện thoại không hợp lệ');

    const existed = await this.users.findOne({ where: sdt ? [{ email }, { sdt }] : [{ email }] });
    if (existed) throw new BadRequestException('Email hoặc số điện thoại đã được đăng ký');

    // Hai chế độ cho vai trò bác sĩ:
    //  - bac_si_id: gắn tài khoản vào BÁC SĨ CÓ SẴN (không tạo hồ sơ/khung giờ mới)
    //  - khoa_id:   tạo bác sĩ MỚI thuộc khoa + sinh khung giờ khám
    let khoa: KhoaPhong | null = null;
    let bsCoSan: BacSi | null = null;
    if (dto.vai_tro === VaiTro.BAC_SI) {
      if (dto.bac_si_id) {
        bsCoSan = await this.bacSi.findOne({ where: { id: +dto.bac_si_id }, relations: ['nguoi_dung', 'khoa'] });
        if (!bsCoSan) throw new BadRequestException('Bác sĩ được chọn không tồn tại');
        if (bsCoSan.nguoi_dung)
          throw new BadRequestException(`Bác sĩ "${bsCoSan.ho_ten}" đã có tài khoản đăng nhập`);
        khoa = bsCoSan.khoa || null;
      } else {
        khoa = await this.ds.getRepository(KhoaPhong).findOne({ where: { id: +dto.khoa_id || 0 } });
        if (!khoa) throw new BadRequestException('Bác sĩ cần được gán vào một khoa hợp lệ');
      }
    }

    const hash = await bcrypt.hash(String(dto.mat_khau), 10);
    return this.ds.transaction(async (m) => {
      const user = await m.save(m.create(NguoiDung, {
        ho_ten: hoTen, email, sdt, mat_khau_hash: hash, vai_tro: dto.vai_tro,
      }));

      let bs: BacSi | null = null;
      if (dto.vai_tro === VaiTro.BAC_SI) {
        if (bsCoSan) {
          // Gắn tài khoản vào hồ sơ bác sĩ có sẵn — khung giờ khám đã tồn tại
          bsCoSan.nguoi_dung = user;
          bs = await m.save(bsCoSan);
        } else {
          bs = await m.save(m.create(BacSi, {
            ho_ten: hoTen,
            hoc_ham: dto.hoc_ham ? String(dto.hoc_ham).trim() : null,
            chuyen_mon: dto.chuyen_mon ? String(dto.chuyen_mon).trim() : null,
            khoa, nguoi_dung: user,
          }));
          // Sinh khung giờ khám các ngày tới để bệnh nhân đặt lịch được ngay
          const slots: KhungGio[] = [];
          for (let d = 1; d <= SO_NGAY_SINH_KHUNG_GIO; d++) {
            const date = new Date(); date.setDate(date.getDate() + d);
            const ngay = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            for (const g of GIO_KHAM) {
              slots.push(m.create(KhungGio, { ngay, gio_bat_dau: g, gio_ket_thuc: g, so_luong: 5, da_dat: 0, bac_si: bs }));
            }
          }
          await m.save(slots);
        }
      }

      await m.save(m.create(NhatKyHoatDong, {
        hanh_dong: 'tao_tai_khoan',
        noi_dung: `Tạo tài khoản ${NHAN_VAI_TRO[dto.vai_tro]} "${hoTen}" (${email})`
          + (khoa ? ` — ${khoa.ten_khoa}` : '')
          + (bsCoSan ? ` (gắn bác sĩ có sẵn #${bsCoSan.id})` : ''),
        nguoi_dung: { id: adminId } as any,
      }));
      return { id: user.id, ho_ten: user.ho_ten, email: user.email, vai_tro: user.vai_tro, bac_si_id: bs ? bs.id : null };
    });
  }

  // Đặt lại mật khẩu cho một tài khoản. Mật khẩu lưu dạng băm bcrypt nên
  // không thể "xem lại" — admin chỉ có thể cấp mật khẩu mới.
  async datLaiMatKhau(adminId: number, id: number, matKhau: string) {
    if (!matKhau || String(matKhau).length < 6)
      throw new BadRequestException('Mật khẩu phải có ít nhất 6 ký tự');
    const u = await this.users.findOneBy({ id });
    if (!u) throw new NotFoundException('Không tìm thấy tài khoản');
    u.mat_khau_hash = await bcrypt.hash(String(matKhau), 10);
    await this.users.save(u);
    // Nhật ký chỉ ghi sự kiện, tuyệt đối không ghi mật khẩu
    await this.ds.getRepository(NhatKyHoatDong).save({
      hanh_dong: 'dat_lai_mat_khau',
      noi_dung: `Đặt lại mật khẩu cho tài khoản "${u.ho_ten}" (${u.email || u.sdt})`,
      nguoi_dung: { id: adminId } as any,
    });
    return { message: 'Đã đặt lại mật khẩu', id: u.id };
  }

  // Khóa / mở khóa tài khoản — tài khoản bị khóa không đăng nhập được nữa
  async doiTrangThai(adminId: number, id: number) {
    const u = await this.users.findOneBy({ id });
    if (!u) throw new NotFoundException('Không tìm thấy tài khoản');
    if (u.id === adminId) throw new BadRequestException('Không thể tự khóa tài khoản của chính mình');
    u.trang_thai = !u.trang_thai;
    await this.users.save(u);
    await this.ds.getRepository(NhatKyHoatDong).save({
      hanh_dong: u.trang_thai ? 'mo_khoa_tai_khoan' : 'khoa_tai_khoan',
      noi_dung: `${u.trang_thai ? 'Mở khóa' : 'Khóa'} tài khoản "${u.ho_ten}" (${u.email || u.sdt})`,
      nguoi_dung: { id: adminId } as any,
    });
    return { id: u.id, trang_thai: u.trang_thai };
  }
}

@Controller('api/admin')
export class UserAdminController {
  constructor(private svc: UserAdminService) {}

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.ADMIN)
  @Get('users') danhSach() { return this.svc.danhSach(); }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.ADMIN)
  @Post('users') tao(@Request() r, @Body() b) { return this.svc.taoTaiKhoan(r.user.id, b); }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.ADMIN)
  @Patch('users/:id/status') doiTrangThai(@Request() r, @Param('id') id) { return this.svc.doiTrangThai(r.user.id, +id); }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.ADMIN)
  @Patch('users/:id/password') datLaiMatKhau(@Request() r, @Param('id') id, @Body() b) { return this.svc.datLaiMatKhau(r.user.id, +id, b.mat_khau); }
}
