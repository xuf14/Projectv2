import {
  Injectable, Controller, Get, Post, Delete, Patch, Body, Param, Query, Request,
  UseGuards, UseInterceptors, UploadedFiles, StreamableFile,
  BadRequestException, NotFoundException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { BaiTruyenThong, AnhTruyenThong, NhatKyHoatDong, VaiTro } from './entities';
import { JwtAuthGuard, RolesGuard, Roles } from './auth';

// ============================================================================
// TRUYỀN THÔNG BỆNH VIỆN — bài viết + hình ảnh lưu PostgreSQL, nhóm theo ngày.
//  Public (độc giả):  GET /media/posts?ngay=   danh sách nhóm theo ngày đăng
//                     GET /media/posts/:id     chi tiết một bài (mở ở tab mới)
//                     GET /media/images/:id    ảnh nhị phân (render inline)
//  Admin (quản trị):  POST /media/posts        đăng bài + tối đa 10 ảnh
//                     PATCH /media/posts/:id/visibility   ẩn/hiện bài
//                     DELETE /media/posts/:id  xóa bài (ảnh xóa theo CASCADE)
// Public API chỉ trả bài hien_thi = true — không lộ bản nháp/bài đã gỡ.
// ============================================================================

type TepTaiLen = { originalname: string; mimetype: string; size: number; buffer: Buffer };

const ANH_CHO_PHEP = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const DUNG_LUONG_TOI_DA = 5 * 1024 * 1024;  // 5MB mỗi ảnh
const SO_ANH_TOI_DA = 10;
const CHUYEN_MUC = ['Tin bệnh viện', 'Chuyên môn', 'Giáo dục sức khỏe', 'Sự kiện', 'Ưu đãi', 'Tuyển dụng'];

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

@Injectable()
export class MediaService {
  constructor(
    @InjectRepository(BaiTruyenThong) private bai: Repository<BaiTruyenThong>,
    @InjectRepository(AnhTruyenThong) private anh: Repository<AnhTruyenThong>,
    private ds: DataSource,
  ) {}

  // Danh sách công khai — không kèm nhị phân; lọc theo ?ngay= và nhóm theo ngày
  async danhSach(ngay?: string) {
    const qb = this.bai.createQueryBuilder('b')
      .leftJoinAndSelect('b.nguoi_dang', 'nd')
      .leftJoin('b.anh', 'a').addSelect(['a.id', 'a.thu_tu'])
      .where('b.hien_thi = true')
      .orderBy('b.ngay_dang', 'DESC').addOrderBy('a.thu_tu', 'ASC').take(200);
    if (ngay) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ngay)) throw new BadRequestException('Ngày lọc không hợp lệ (YYYY-MM-DD)');
      qb.andWhere('b.ngay_dang::date = :ngay', { ngay });
    }
    const list = await qb.getMany();
    // Gom bài theo từng ngày đăng — đúng yêu cầu "lưu trữ theo ngày"
    const theoNgay: { ngay: string; bai_viet: any[] }[] = [];
    for (const b of list) {
      const key = ymd(b.ngay_dang);
      let nhom = theoNgay.find((g) => g.ngay === key);
      if (!nhom) { nhom = { ngay: key, bai_viet: [] }; theoNgay.push(nhom); }
      nhom.bai_viet.push({
        id: b.id, tieu_de: b.tieu_de, chuyen_muc: b.chuyen_muc, tom_tat: b.tom_tat,
        ngay_dang: b.ngay_dang, nguoi_dang: b.nguoi_dang ? b.nguoi_dang.ho_ten : null,
        so_anh: (b.anh || []).length,
        anh_dai_dien_id: b.anh && b.anh.length ? b.anh[0].id : null,
      });
    }
    return theoNgay;
  }

  // Chi tiết một bài — trang mở ở tab trình duyệt mới
  async chiTiet(id: number) {
    const b = await this.bai.createQueryBuilder('b')
      .leftJoinAndSelect('b.nguoi_dang', 'nd')
      .leftJoin('b.anh', 'a').addSelect(['a.id', 'a.ten_tep', 'a.thu_tu'])
      .where('b.id = :id AND b.hien_thi = true', { id })
      .orderBy('a.thu_tu', 'ASC').getOne();
    if (!b) throw new NotFoundException('Bài viết không tồn tại hoặc đã gỡ');
    return {
      id: b.id, tieu_de: b.tieu_de, chuyen_muc: b.chuyen_muc, tom_tat: b.tom_tat,
      noi_dung: b.noi_dung, the: b.the, ngay_dang: b.ngay_dang,
      nguoi_dang: b.nguoi_dang ? b.nguoi_dang.ho_ten : null,
      anh: (b.anh || []).map((a) => ({ id: a.id, ten_tep: a.ten_tep })),
    };
  }

  async layAnh(id: number) {
    const a = await this.anh.findOne({ where: { id }, relations: ['bai'] });
    if (!a || !a.bai || !a.bai.hien_thi) throw new NotFoundException('Ảnh không tồn tại');
    return a;
  }

  // Admin đăng bài mới kèm ảnh — tất cả trong một transaction, có nhật ký
  async dangBai(userId: number, dto: any, files: TepTaiLen[]) {
    const tieuDe = String(dto?.tieu_de || '').trim();
    if (!tieuDe) throw new BadRequestException('Tiêu đề là bắt buộc');
    if (tieuDe.length > 300) throw new BadRequestException('Tiêu đề quá dài (tối đa 300 ký tự)');
    const noiDung = String(dto?.noi_dung || '').trim();
    if (!noiDung) throw new BadRequestException('Nội dung bài viết là bắt buộc');
    if (noiDung.length > 50000) throw new BadRequestException('Nội dung quá dài');
    const chuyenMuc = dto?.chuyen_muc && CHUYEN_MUC.includes(dto.chuyen_muc) ? dto.chuyen_muc : null;
    const tomTat = dto?.tom_tat ? String(dto.tom_tat).trim().slice(0, 500) : null;
    // Thẻ (tags) phân tách bằng dấu phẩy — chuẩn hóa khoảng trắng, bỏ thẻ rỗng
    const the = dto?.the
      ? String(dto.the).split(',').map((t) => t.trim()).filter(Boolean).join(', ').slice(0, 300) || null
      : null;

    const anhList = files || [];
    if (anhList.length > SO_ANH_TOI_DA) throw new BadRequestException(`Tối đa ${SO_ANH_TOI_DA} ảnh mỗi bài`);
    for (const f of anhList) {
      if (!ANH_CHO_PHEP.includes(f.mimetype))
        throw new BadRequestException('Chỉ chấp nhận ảnh JPEG, PNG, WebP hoặc GIF');
      if (f.size > DUNG_LUONG_TOI_DA) throw new BadRequestException('Mỗi ảnh tối đa 5MB');
    }

    const id = await this.ds.transaction(async (m) => {
      const b = await m.save(m.create(BaiTruyenThong, {
        tieu_de: tieuDe, chuyen_muc: chuyenMuc, tom_tat: tomTat, noi_dung: noiDung, the,
        nguoi_dang: { id: userId } as any,
      }));
      let thuTu = 0;
      for (const f of anhList) {
        // Tên tệp multipart là latin1 — chuyển UTF-8 và bỏ ký tự đường dẫn
        const ten = Buffer.from(f.originalname, 'latin1').toString('utf8')
          .replace(/[\\/:*?"<>|]/g, '_').slice(0, 150) || `anh-${thuTu + 1}`;
        await m.save(m.create(AnhTruyenThong, {
          ten_tep: ten, loai_tep: f.mimetype, kich_thuoc: f.size, du_lieu: f.buffer,
          thu_tu: thuTu++, bai: { id: b.id } as any,
        }));
      }
      await m.save(m.create(NhatKyHoatDong, {
        hanh_dong: 'dang_bai_truyen_thong',
        noi_dung: `Đăng bài truyền thông "${tieuDe}" (${anhList.length} ảnh)`,
        nguoi_dung: { id: userId } as any,
      }));
      return b.id;
    });
    return this.chiTiet(id);
  }

  // Ẩn/hiện bài — giữ dữ liệu, chỉ đổi cờ hiển thị
  async doiHienThi(userId: number, id: number) {
    const b = await this.bai.findOne({ where: { id } });
    if (!b) throw new NotFoundException('Bài viết không tồn tại');
    b.hien_thi = !b.hien_thi;
    await this.bai.save(b);
    await this.ds.getRepository(NhatKyHoatDong).save({
      hanh_dong: b.hien_thi ? 'hien_bai_truyen_thong' : 'go_bai_truyen_thong',
      noi_dung: `${b.hien_thi ? 'Hiện lại' : 'Gỡ'} bài truyền thông "${b.tieu_de}"`,
      nguoi_dung: { id: userId } as any,
    });
    return { id: b.id, hien_thi: b.hien_thi };
  }

  async xoaBai(userId: number, id: number) {
    const b = await this.bai.findOne({ where: { id } });
    if (!b) throw new NotFoundException('Bài viết không tồn tại');
    return this.ds.transaction(async (m) => {
      await m.delete(BaiTruyenThong, id);   // ảnh xóa theo CASCADE
      await m.save(m.create(NhatKyHoatDong, {
        hanh_dong: 'xoa_bai_truyen_thong',
        noi_dung: `Xóa bài truyền thông "${b.tieu_de}"`,
        nguoi_dung: { id: userId } as any,
      }));
      return { message: 'Đã xóa bài viết', tieu_de: b.tieu_de };
    });
  }

  // Admin xem mọi bài (kể cả đã gỡ) để quản lý
  async danhSachQuanTri() {
    const list = await this.bai.createQueryBuilder('b')
      .leftJoinAndSelect('b.nguoi_dang', 'nd')
      .leftJoin('b.anh', 'a').addSelect(['a.id'])
      .orderBy('b.ngay_dang', 'DESC').take(200).getMany();
    return list.map((b) => ({
      id: b.id, tieu_de: b.tieu_de, chuyen_muc: b.chuyen_muc, hien_thi: b.hien_thi,
      ngay_dang: b.ngay_dang, nguoi_dang: b.nguoi_dang ? b.nguoi_dang.ho_ten : null,
      so_anh: (b.anh || []).length,
    }));
  }
}

@Controller('api')
export class MediaController {
  constructor(private svc: MediaService) {}

  // --- Công khai: độc giả xem bài, không cần đăng nhập ---
  @Get('media/posts') danhSach(@Query('ngay') ngay: string) { return this.svc.danhSach(ngay); }
  @Get('media/posts/:id') chiTiet(@Param('id') id: string) { return this.svc.chiTiet(+id); }

  @Get('media/images/:id')
  async anh(@Param('id') id: string) {
    const a = await this.svc.layAnh(+id);
    return new StreamableFile(a.du_lieu, {
      type: a.loai_tep,
      disposition: `inline; filename*=UTF-8''${encodeURIComponent(a.ten_tep)}`,
    });
  }

  // --- Quản trị: chỉ admin đăng/gỡ/xóa bài ---
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.ADMIN)
  @Get('admin/media/posts') dsQuanTri() { return this.svc.danhSachQuanTri(); }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.ADMIN)
  @Post('media/posts')
  @UseInterceptors(FilesInterceptor('anh', SO_ANH_TOI_DA, { limits: { fileSize: DUNG_LUONG_TOI_DA } }))
  dang(@Request() r, @Body() b, @UploadedFiles() files: TepTaiLen[]) {
    return this.svc.dangBai(r.user.id, b, files);
  }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.ADMIN)
  @Patch('media/posts/:id/visibility') doiHienThi(@Request() r, @Param('id') id: string) { return this.svc.doiHienThi(r.user.id, +id); }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.ADMIN)
  @Delete('media/posts/:id') xoa(@Request() r, @Param('id') id: string) { return this.svc.xoaBai(r.user.id, +id); }
}
