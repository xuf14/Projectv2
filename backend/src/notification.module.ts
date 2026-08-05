import {
  Injectable, Controller, Get, Patch, Param, Request, UseGuards, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager, In } from 'typeorm';
import { ThongBao, NguoiDung, VaiTro } from './entities';
import { JwtAuthGuard } from './auth';

// ============================================================================
//  THÔNG BÁO trong hệ thống — mỗi bản ghi gửi tới một tài khoản cụ thể.
//  Nguồn phát: các nghiệp vụ khác gọi guiThongBao() BÊN TRONG transaction của
//  mình để thông báo chỉ tồn tại khi nghiệp vụ thành công.
//  Mỗi người chỉ đọc/đánh dấu được thông báo của chính mình.
// ============================================================================

// Gửi thông báo tới nhiều tài khoản trong cùng transaction của nghiệp vụ gọi nó.
// Trả về số thông báo đã tạo (bỏ qua id trùng và danh sách rỗng).
export async function guiThongBao(
  m: EntityManager,
  nguoiNhanIds: number[],
  data: { loai: string; tieu_de: string; noi_dung?: string; lich_hen_id?: number },
) {
  const ids = [...new Set(nguoiNhanIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (!ids.length) return 0;
  await m.save(ids.map((id) => m.create(ThongBao, {
    loai: data.loai, tieu_de: data.tieu_de, noi_dung: data.noi_dung || null,
    nguoi_nhan: { id } as any,
    lich_hen: data.lich_hen_id ? ({ id: data.lich_hen_id } as any) : null,
  })));
  return ids.length;
}

// Danh sách id tài khoản quản trị viên — dùng khi nghiệp vụ cần báo cho admin.
export async function idQuanTriVien(m: EntityManager) {
  const admins = await m.find(NguoiDung, {
    where: { vai_tro: VaiTro.ADMIN }, select: ['id'],
  });
  return admins.map((a) => a.id);
}

@Injectable()
export class NotificationService {
  constructor(@InjectRepository(ThongBao) private tb: Repository<ThongBao>) {}

  async cuaToi(userId: number) {
    const list = await this.tb.find({
      where: { nguoi_nhan: { id: userId } },
      relations: ['lich_hen'],
      order: { id: 'DESC' },
      take: 50,
    });
    return list.map((t) => ({
      id: t.id, loai: t.loai, tieu_de: t.tieu_de, noi_dung: t.noi_dung,
      da_doc: t.da_doc, thoi_gian: t.thoi_gian,
      ma_lich_hen: t.lich_hen ? t.lich_hen.ma_lich_hen : null,
    }));
  }

  async danhDauDaDoc(userId: number, id: number) {
    const t = await this.tb.findOne({ where: { id, nguoi_nhan: { id: userId } } });
    if (!t) throw new NotFoundException('Thông báo không tồn tại');
    t.da_doc = true;
    await this.tb.save(t);
    return { message: 'Đã đánh dấu đã đọc', id: t.id };
  }

  async danhDauTatCa(userId: number) {
    const chuaDoc = await this.tb.find({
      where: { nguoi_nhan: { id: userId }, da_doc: false }, select: ['id'],
    });
    if (chuaDoc.length)
      await this.tb.update({ id: In(chuaDoc.map((t) => t.id)) }, { da_doc: true });
    return { message: 'Đã đánh dấu tất cả đã đọc', so_luong: chuaDoc.length };
  }
}

@Controller('api')
export class NotificationController {
  constructor(private svc: NotificationService) {}

  // Mọi tài khoản đăng nhập đều xem được thông báo CỦA CHÍNH MÌNH
  @UseGuards(JwtAuthGuard)
  @Get('notifications') cuaToi(@Request() r) { return this.svc.cuaToi(r.user.id); }

  @UseGuards(JwtAuthGuard)
  @Patch('notifications/:id/read') doc(@Request() r, @Param('id') id) {
    return this.svc.danhDauDaDoc(r.user.id, +id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('notifications/read-all') docTatCa(@Request() r) {
    return this.svc.danhDauTatCa(r.user.id);
  }
}
