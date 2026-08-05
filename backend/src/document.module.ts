import {
  Injectable, Controller, Get, Post, Delete, Param, Request, UseGuards, UseInterceptors,
  UploadedFile, StreamableFile, BadRequestException, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { LichHen, TaiLieuBenhAn, NhatKyHoatDong, VaiTro } from './entities';
import { JwtAuthGuard } from './auth';

// Kiểu file multer trả về (tránh phụ thuộc @types/multer)
type TepTaiLen = { originalname: string; mimetype: string; size: number; buffer: Buffer };

// Chỉ nhận PDF và Word theo yêu cầu nghiệp vụ
const LOAI_CHO_PHEP: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/msword': 'Word',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
};
const DUNG_LUONG_TOI_DA = 10 * 1024 * 1024; // 10MB

const laNhanVien = (vaiTro: string) =>
  [VaiTro.BAC_SI, VaiTro.LE_TAN, VaiTro.ADMIN].includes(vaiTro as VaiTro);

@Injectable()
export class DocumentService {
  constructor(
    @InjectRepository(TaiLieuBenhAn) private taiLieu: Repository<TaiLieuBenhAn>,
    @InjectRepository(LichHen) private lich: Repository<LichHen>,
    private ds: DataSource,
  ) {}

  // Lịch hẹn + kiểm tra quyền: bệnh nhân chỉ thao tác trên lịch của chính mình
  private async layLich(user: any, lichId: number) {
    const lich = await this.lich.findOne({
      where: { id: lichId }, relations: ['ho_so', 'ho_so.nguoi_dung'],
    });
    if (!lich) throw new NotFoundException('Không tìm thấy lịch hẹn');
    if (!laNhanVien(user.vai_tro) && lich.ho_so.nguoi_dung?.id !== user.id)
      throw new ForbiddenException('Lịch hẹn không thuộc tài khoản này');
    return lich;
  }

  private metadata(t: TaiLieuBenhAn) {
    return { id: t.id, ten_tep: t.ten_tep, loai_tep: t.loai_tep, kich_thuoc: t.kich_thuoc, thoi_gian: t.thoi_gian };
  }

  async taiLen(user: any, lichId: number, file?: TepTaiLen) {
    if (!file) throw new BadRequestException('Chưa chọn tệp để tải lên');
    if (!LOAI_CHO_PHEP[file.mimetype])
      throw new BadRequestException('Chỉ chấp nhận tệp PDF hoặc Word (.pdf, .doc, .docx)');
    if (file.size > DUNG_LUONG_TOI_DA) throw new BadRequestException('Tệp vượt quá 10MB');
    const lich = await this.layLich(user, lichId);
    // Tên tệp gửi qua multipart là latin1 — chuyển lại UTF-8 và bỏ ký tự đường dẫn
    const tenTep = Buffer.from(file.originalname, 'latin1').toString('utf8')
      .replace(/[\\/:*?"<>|]/g, '_').slice(0, 150) || 'benh-an';

    return this.ds.transaction(async (m) => {
      const t = await m.save(m.create(TaiLieuBenhAn, {
        ten_tep: tenTep, loai_tep: file.mimetype, kich_thuoc: file.size,
        du_lieu: file.buffer, lich_hen: { id: lich.id } as any,
      }));
      await m.save(m.create(NhatKyHoatDong, {
        hanh_dong: 'tai_len_benh_an',
        noi_dung: `Tải lên bệnh án "${tenTep}" cho lịch hẹn ${lich.ma_lich_hen}`,
        nguoi_dung: { id: user.id } as any,
      }));
      return this.metadata(t);
    });
  }

  // Danh sách metadata (không kèm dữ liệu nhị phân) của một lịch hẹn
  async danhSach(user: any, lichId: number) {
    await this.layLich(user, lichId);
    const list = await this.taiLieu.find({
      where: { lich_hen: { id: lichId } },
      select: ['id', 'ten_tep', 'loai_tep', 'kich_thuoc', 'thoi_gian'],
      order: { thoi_gian: 'DESC' },
    });
    return list.map((t) => this.metadata(t));
  }

  // Tải nội dung tệp — bệnh nhân sở hữu hoặc nhân viên y tế
  async taiVe(user: any, id: number) {
    const t = await this.taiLieu.findOne({
      where: { id }, relations: ['lich_hen', 'lich_hen.ho_so', 'lich_hen.ho_so.nguoi_dung'],
    });
    if (!t) throw new NotFoundException('Không tìm thấy tài liệu');
    if (!laNhanVien(user.vai_tro) && t.lich_hen.ho_so.nguoi_dung?.id !== user.id)
      throw new ForbiddenException('Tài liệu không thuộc tài khoản này');
    return t;
  }

  // Bệnh nhân xóa tệp mình đã tải lên
  async xoa(user: any, id: number) {
    const t = await this.taiLieu.findOne({
      where: { id }, relations: ['lich_hen', 'lich_hen.ho_so', 'lich_hen.ho_so.nguoi_dung'],
    });
    if (!t) throw new NotFoundException('Không tìm thấy tài liệu');
    if (t.lich_hen.ho_so.nguoi_dung?.id !== user.id)
      throw new ForbiddenException('Chỉ xóa được tài liệu do chính bạn tải lên');
    return this.ds.transaction(async (m) => {
      await m.delete(TaiLieuBenhAn, id);
      await m.save(m.create(NhatKyHoatDong, {
        hanh_dong: 'xoa_benh_an',
        noi_dung: `Xóa bệnh án "${t.ten_tep}" khỏi lịch hẹn ${t.lich_hen.ma_lich_hen}`,
        nguoi_dung: { id: user.id } as any,
      }));
      return { message: 'Đã xóa tài liệu', ten_tep: t.ten_tep };
    });
  }
}

@Controller('api')
export class DocumentController {
  constructor(private svc: DocumentService) {}

  @UseGuards(JwtAuthGuard)
  @Post('appointments/:id/documents')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: DUNG_LUONG_TOI_DA } }))
  taiLen(@Request() r, @Param('id') id, @UploadedFile() file: TepTaiLen) {
    return this.svc.taiLen(r.user, +id, file);
  }

  @UseGuards(JwtAuthGuard)
  @Get('appointments/:id/documents')
  danhSach(@Request() r, @Param('id') id) { return this.svc.danhSach(r.user, +id); }

  @UseGuards(JwtAuthGuard)
  @Get('documents/:id/download')
  async taiVe(@Request() r, @Param('id') id) {
    const t = await this.svc.taiVe(r.user, +id);
    return new StreamableFile(t.du_lieu, {
      type: t.loai_tep,
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(t.ten_tep)}`,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Delete('documents/:id')
  xoa(@Request() r, @Param('id') id) { return this.svc.xoa(r.user, +id); }
}
