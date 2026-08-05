import { ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BacSi, VaiTro } from './entities';

// ============================================================================
//  PHẠM VI DỮ LIỆU CỦA BÁC SĨ — quy tắc dùng chung cho mọi màn hình có lọc theo
//  bác sĩ đăng nhập (hàng chờ, lịch sắp tới, lần khám trong ngày...).
//
//  Nguyên tắc tối thiểu quyền: tài khoản vai trò BÁC SĨ chỉ được xem bệnh nhân
//  của CHÍNH mình. Nếu tài khoản chưa được gắn với hồ sơ bác sĩ nào thì TỪ CHỐI,
//  tuyệt đối không rơi vào nhánh "xem toàn bộ" — đó là lỗ hổng lộ dữ liệu bệnh nhân.
//  Lễ tân / quản trị viên xem toàn bộ (quyền đã được RolesGuard chốt ở route).
// ============================================================================

export type PhamVi = { xemTatCa: boolean; bs: BacSi | null };

export const CHUA_GAN_BAC_SI =
  'Tài khoản bác sĩ chưa được gắn với hồ sơ bác sĩ nào. Liên hệ quản trị viên để được gán trước khi xem dữ liệu bệnh nhân.';

export async function phamViBacSi(ds: DataSource, user: any): Promise<PhamVi> {
  if (user?.vai_tro === VaiTro.BAC_SI) {
    const bs = await ds.getRepository(BacSi).findOne({ where: { nguoi_dung: { id: user.id } } });
    if (!bs) throw new ForbiddenException(CHUA_GAN_BAC_SI);
    return { xemTatCa: false, bs };
  }
  return { xemTatCa: true, bs: null };
}
