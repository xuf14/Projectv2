import {
  Injectable, CanActivate, ExecutionContext, SetMetadata, UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PassportStrategy } from '@nestjs/passport';
import { AuthGuard } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { VaiTro } from './entities';
import { bienBatBuoc } from './env';

// Khóa ký JWT bắt buộc lấy từ .env — KHÔNG có giá trị mặc định trong mã nguồn,
// vì bí mật nằm trong mã nguồn thì bất kỳ ai đọc được repo cũng giả mạo được token.
export const JWT_SECRET = bienBatBuoc('JWT_SECRET', 16);

// ---- JWT Strategy ----
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: JWT_SECRET,
    });
  }
  async validate(payload: any) {
    return { id: payload.sub, vai_tro: payload.vai_tro, ho_ten: payload.ho_ten };
  }
}

// ---- Guard xác thực JWT ----
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

// ---- Decorator & Guard phân quyền theo vai trò (RBAC) ----
export const ROLES_KEY = 'roles';
export const Roles = (...roles: VaiTro[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<VaiTro[]>(ROLES_KEY, [
      ctx.getHandler(), ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const { user } = ctx.switchToHttp().getRequest();
    if (!user || !required.includes(user.vai_tro)) {
      throw new UnauthorizedException('Bạn không có quyền truy cập chức năng này');
    }
    return true;
  }
}
