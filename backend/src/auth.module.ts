import {
  Injectable, Controller, Post, Patch, Body, BadRequestException, UnauthorizedException, Get, UseGuards, Request,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { NguoiDung } from './entities';
import { JwtAuthGuard } from './auth';

// Số lần đăng nhập tối đa của MỘT IP trong 1 phút (cấu hình qua .env)
const GIOI_HAN_LOGIN = Math.max(1, Number(process.env.THROTTLE_LOGIN_LIMIT) || 10);

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(NguoiDung) private users: Repository<NguoiDung>,
    private jwt: JwtService,
  ) {}

  async login(dto: any) {
    const { tai_khoan, mat_khau } = dto; // tai_khoan = sdt hoặc email
    const user = await this.users.findOne({ where: [{ sdt: tai_khoan }, { email: tai_khoan }] });
    if (!user) throw new UnauthorizedException('Tài khoản không tồn tại');
    if (!user.trang_thai) throw new UnauthorizedException('Tài khoản đã bị khóa');
    const ok = await bcrypt.compare(mat_khau, user.mat_khau_hash);
    if (!ok) throw new UnauthorizedException('Mật khẩu không đúng');
    return this.sign(user);
  }

  // Người dùng tự đổi mật khẩu của CHÍNH mình: phải nhập đúng mật khẩu hiện tại.
  // Áp dụng cho mọi vai trò (admin, bác sĩ, lễ tân, bệnh nhân) đang đăng nhập.
  async doiMatKhau(userId: number, matKhauCu: string, matKhauMoi: string) {
    if (!matKhauCu || !matKhauMoi)
      throw new BadRequestException('Thiếu mật khẩu hiện tại hoặc mật khẩu mới');
    if (String(matKhauMoi).length < 6)
      throw new BadRequestException('Mật khẩu mới phải có ít nhất 6 ký tự');
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Tài khoản không tồn tại');
    const ok = await bcrypt.compare(String(matKhauCu), user.mat_khau_hash);
    if (!ok) throw new BadRequestException('Mật khẩu hiện tại không đúng');
    if (await bcrypt.compare(String(matKhauMoi), user.mat_khau_hash))
      throw new BadRequestException('Mật khẩu mới phải khác mật khẩu hiện tại');
    user.mat_khau_hash = await bcrypt.hash(String(matKhauMoi), 10);
    await this.users.save(user);
    return { message: 'Đổi mật khẩu thành công' };
  }

  private sign(user: NguoiDung) {
    const payload = { sub: user.id, vai_tro: user.vai_tro, ho_ten: user.ho_ten };
    return {
      access_token: this.jwt.sign(payload),
      user: { id: user.id, ho_ten: user.ho_ten, vai_tro: user.vai_tro, sdt: user.sdt, email: user.email },
    };
  }
}

@Controller('api/auth')
export class AuthController {
  constructor(private svc: AuthService) {}

  // Giới hạn số lần đăng nhập của một IP trong 1 phút để chống dò mật khẩu
  @Throttle({ default: { limit: GIOI_HAN_LOGIN, ttl: 60000 } })
  @UseGuards(ThrottlerGuard)
  @Post('login') login(@Body() b: any) { return this.svc.login(b); }

  @UseGuards(JwtAuthGuard)
  @Get('me') me(@Request() req) { return req.user; }

  @UseGuards(JwtAuthGuard)
  @Patch('doi-mat-khau') doiMatKhau(@Request() req, @Body() b: any) {
    return this.svc.doiMatKhau(req.user.id, b.mat_khau_cu, b.mat_khau_moi);
  }
}
