import {
  Injectable, Controller, Get, Post, Patch, Body, Param, Query, Request, UseGuards,
  BadRequestException, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { HoSoIVF, HoSoBenhNhan, BacSi, NhatKyHoatDong, VaiTro } from './entities';
import { JwtAuthGuard, RolesGuard, Roles } from './auth';

// ============================================================================
//  HỖ TRỢ SINH SẢN (IVF) — hồ sơ điều trị hiếm muộn theo TỪNG BỆNH NHÂN.
//  Hai giai đoạn: khám hiếm muộn (8 bước) → làm IVF (10 bước). IVF là bước
//  tiếp theo sau khám & tư vấn, nhưng bệnh nhân có thể "làm thẳng IVF".
//  Chỉ bác sĩ khoa Hỗ trợ sinh sản (và admin) mới thao tác.
//    GET   /ivf/ho-so                 danh sách hồ sơ IVF (+ cờ quyền)
//    GET   /ivf/ho-so/:id             chi tiết một hồ sơ
//    POST  /ivf/ho-so                 mở hồ sơ cho một bệnh nhân
//    PATCH /ivf/ho-so/:id/buoc        đánh dấu/bỏ đánh dấu một bước
//    PATCH /ivf/ho-so/:id/giai-doan   chuyển giai đoạn (sang IVF / hoàn tất)
//    PATCH /ivf/ho-so/:id             cập nhật ghi chú
// ============================================================================

const GIAI_DOAN = ['kham_hiem_muon', 'ivf', 'hoan_tat'];
const SO_BUOC = { kham_hiem_muon: 8, ivf: 10 };  // số bước tối đa mỗi giai đoạn
// Điều kiện bắt buộc: chỉ được làm IVF sau khi khám lâm sàng và cận lâm sàng
// (hoàn thành đủ 8 bước khám hiếm muộn) — áp dụng cả với hồ sơ "làm thẳng IVF".
const MSG_CHUA_KHAM = 'Chỉ được làm IVF sau khi bệnh nhân hoàn thành khám lâm sàng và cận lâm sàng (đủ 8 bước khám hiếm muộn)';
const khamDaXong = (h: HoSoIVF) =>
  (Array.isArray(h.buoc_kham) ? h.buoc_kham.length : 0) >= SO_BUOC.kham_hiem_muon;

@Injectable()
export class IvfService {
  constructor(
    @InjectRepository(HoSoIVF) private repo: Repository<HoSoIVF>,
    @InjectRepository(HoSoBenhNhan) private hoSo: Repository<HoSoBenhNhan>,
    private ds: DataSource,
  ) {}

  private ghiNhatKy(m: EntityManager, userId: number, hanhDong: string, noiDung: string) {
    return m.save(m.create(NhatKyHoatDong, {
      hanh_dong: hanhDong, noi_dung: noiDung, nguoi_dung: { id: userId } as any,
    }));
  }

  // Bác sĩ đang đăng nhập thuộc khoa Hỗ trợ sinh sản (IVF)? Admin luôn được phép.
  private async quyenIVF(user: any): Promise<{ la_ivf: boolean; bs: BacSi | null }> {
    if (user?.vai_tro === VaiTro.ADMIN) return { la_ivf: true, bs: null };
    if (user?.vai_tro !== VaiTro.BAC_SI) return { la_ivf: false, bs: null };
    const bs = await this.ds.getRepository(BacSi).findOne({ where: { nguoi_dung: { id: user.id } } });
    const ma = (bs?.khoa?.ma || '').toLowerCase();
    const ten = (bs?.khoa?.ten_khoa || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const la_ivf = ma === 'ivf' || ten.includes('ho tro sinh san') || ten.includes('ivf');
    return { la_ivf, bs: bs || null };
  }

  private async batBuocIVF(user: any) {
    const q = await this.quyenIVF(user);
    if (!q.la_ivf) throw new ForbiddenException('Chỉ bác sĩ khoa Hỗ trợ sinh sản (IVF) mới thao tác được mục này');
    return q;
  }

  private goi(h: HoSoIVF) {
    return {
      id: h.id, giai_doan: h.giai_doan, lam_thang_ivf: h.lam_thang_ivf,
      buoc_kham: Array.isArray(h.buoc_kham) ? h.buoc_kham : [],
      buoc_ivf: Array.isArray(h.buoc_ivf) ? h.buoc_ivf : [],
      ghi_chu: h.ghi_chu || '', ngay_tao: h.ngay_tao, ngay_cap_nhat: h.ngay_cap_nhat,
      ho_so: h.ho_so
        ? { id: h.ho_so.id, ma_benh_nhan: h.ho_so.ma_benh_nhan, ho_ten: h.ho_so.ho_ten,
            gioi_tinh: h.ho_so.gioi_tinh, ngay_sinh: h.ho_so.ngay_sinh, sdt: h.ho_so.sdt }
        : null,
      bac_si: h.bac_si ? h.bac_si.ho_ten : null,
    };
  }

  async danhSach(user: any) {
    const { la_ivf } = await this.quyenIVF(user);
    if (!la_ivf) return { la_ivf: false, danh_sach: [] };
    const list = await this.repo.find({ order: { ngay_cap_nhat: 'DESC' }, take: 200 });
    return { la_ivf: true, danh_sach: list.map((h) => this.goi(h)) };
  }

  async chiTiet(user: any, id: number) {
    await this.batBuocIVF(user);
    const h = await this.repo.findOne({ where: { id } });
    if (!h) throw new NotFoundException('Hồ sơ IVF không tồn tại');
    return this.goi(h);
  }

  // Mở hồ sơ IVF cho một bệnh nhân. lam_thang_ivf=true → vào thẳng giai đoạn IVF.
  async moHoSo(user: any, dto: any) {
    const { bs } = await this.batBuocIVF(user);
    const hoSoId = Number(dto?.ho_so_id);
    if (!Number.isInteger(hoSoId) || hoSoId <= 0) throw new BadRequestException('Thiếu hồ sơ bệnh nhân');
    const hs = await this.hoSo.findOne({ where: { id: hoSoId } });
    if (!hs) throw new NotFoundException('Hồ sơ bệnh nhân không tồn tại');
    const lamThang = dto?.lam_thang_ivf === true || dto?.lam_thang_ivf === 'true';

    return this.ds.transaction(async (m) => {
      // Một bệnh nhân chỉ một hồ sơ IVF — nếu đã có thì trả về hồ sơ hiện tại
      const cu = await m.findOne(HoSoIVF, { where: { ho_so: { id: hoSoId } } });
      if (cu) return this.goi(cu);
      // Luôn bắt đầu ở giai đoạn khám: kể cả "làm thẳng IVF" vẫn phải khám lâm
      // sàng và cận lâm sàng trước. Cờ lam_thang_ivf chỉ ghi nhận nguyện vọng.
      const h = await m.save(m.create(HoSoIVF, {
        giai_doan: 'kham_hiem_muon',
        lam_thang_ivf: lamThang, buoc_kham: [], buoc_ivf: [],
        ho_so: { id: hoSoId } as any, bac_si: bs ? ({ id: bs.id } as any) : null,
      }));
      await this.ghiNhatKy(m, user.id, 'mo_ho_so_ivf',
        `Mở hồ sơ IVF cho ${hs.ma_benh_nhan} (${hs.ho_ten})${lamThang ? ' — nguyện vọng làm thẳng IVF' : ''}`);
      const full = await m.findOne(HoSoIVF, { where: { id: h.id } });
      return this.goi(full);
    });
  }

  // Đánh dấu / bỏ đánh dấu một bước trong một giai đoạn
  async toggleBuoc(user: any, id: number, dto: any) {
    const { bs } = await this.batBuocIVF(user);
    const gd = String(dto?.giai_doan || '');
    if (gd !== 'kham_hiem_muon' && gd !== 'ivf') throw new BadRequestException('Giai đoạn không hợp lệ');
    const buoc = Number(dto?.buoc);
    if (!Number.isInteger(buoc) || buoc < 1 || buoc > SO_BUOC[gd])
      throw new BadRequestException(`Bước phải từ 1 đến ${SO_BUOC[gd]}`);

    return this.ds.transaction(async (m) => {
      const h = await m.findOne(HoSoIVF, { where: { id } });
      if (!h) throw new NotFoundException('Hồ sơ IVF không tồn tại');
      // Chưa khám xong lâm sàng + cận lâm sàng thì chưa được thao tác bước IVF
      if (gd === 'ivf' && !khamDaXong(h)) throw new BadRequestException(MSG_CHUA_KHAM);
      const cot = gd === 'ivf' ? 'buoc_ivf' : 'buoc_kham';
      const set = new Set(Array.isArray(h[cot]) ? h[cot] : []);
      if (set.has(buoc)) set.delete(buoc); else set.add(buoc);
      h[cot] = [...set].sort((a, b) => a - b);
      if (bs) h.bac_si = { id: bs.id } as any;
      await m.save(h);
      const full = await m.findOne(HoSoIVF, { where: { id } });
      return this.goi(full);
    });
  }

  // Chuyển giai đoạn: kham_hiem_muon → ivf (sau khám & tư vấn) hoặc → hoan_tat
  async datGiaiDoan(user: any, id: number, dto: any) {
    const { bs } = await this.batBuocIVF(user);
    const gd = String(dto?.giai_doan || '');
    if (!GIAI_DOAN.includes(gd)) throw new BadRequestException('Giai đoạn không hợp lệ');

    return this.ds.transaction(async (m) => {
      const h = await m.findOne(HoSoIVF, { where: { id } });
      if (!h) throw new NotFoundException('Hồ sơ IVF không tồn tại');
      // Chỉ được chuyển sang IVF khi đã khám lâm sàng và cận lâm sàng đủ 8 bước
      if (gd === 'ivf' && !khamDaXong(h)) throw new BadRequestException(MSG_CHUA_KHAM);
      h.giai_doan = gd;
      if (bs) h.bac_si = { id: bs.id } as any;
      await m.save(h);
      const nhan = gd === 'ivf' ? 'chuyển sang giai đoạn IVF' : gd === 'hoan_tat' ? 'đánh dấu hoàn tất' : 'quay lại giai đoạn khám hiếm muộn';
      await this.ghiNhatKy(m, user.id, 'cap_nhat_ivf',
        `Hồ sơ IVF ${h.ho_so ? h.ho_so.ma_benh_nhan : `#${id}`} — ${nhan}`);
      const full = await m.findOne(HoSoIVF, { where: { id } });
      return this.goi(full);
    });
  }

  async luuGhiChu(user: any, id: number, dto: any) {
    const { bs } = await this.batBuocIVF(user);
    const ghi = (dto?.ghi_chu ?? '').toString().trim().slice(0, 4000);
    return this.ds.transaction(async (m) => {
      const h = await m.findOne(HoSoIVF, { where: { id } });
      if (!h) throw new NotFoundException('Hồ sơ IVF không tồn tại');
      h.ghi_chu = ghi || null;
      if (bs) h.bac_si = { id: bs.id } as any;
      await m.save(h);
      const full = await m.findOne(HoSoIVF, { where: { id } });
      return this.goi(full);
    });
  }
}

@Controller('api')
export class IvfController {
  constructor(private svc: IvfService) {}

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.BAC_SI, VaiTro.ADMIN)
  @Get('ivf/ho-so') danhSach(@Request() r) { return this.svc.danhSach(r.user); }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.BAC_SI, VaiTro.ADMIN)
  @Get('ivf/ho-so/:id') chiTiet(@Request() r, @Param('id') id: string) { return this.svc.chiTiet(r.user, +id); }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.BAC_SI, VaiTro.ADMIN)
  @Post('ivf/ho-so') moHoSo(@Request() r, @Body() b) { return this.svc.moHoSo(r.user, b); }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.BAC_SI, VaiTro.ADMIN)
  @Patch('ivf/ho-so/:id/buoc') toggleBuoc(@Request() r, @Param('id') id: string, @Body() b) { return this.svc.toggleBuoc(r.user, +id, b); }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.BAC_SI, VaiTro.ADMIN)
  @Patch('ivf/ho-so/:id/giai-doan') datGiaiDoan(@Request() r, @Param('id') id: string, @Body() b) { return this.svc.datGiaiDoan(r.user, +id, b); }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.BAC_SI, VaiTro.ADMIN)
  @Patch('ivf/ho-so/:id') luuGhiChu(@Request() r, @Param('id') id: string, @Body() b) { return this.svc.luuGhiChu(r.user, +id, b); }
}
