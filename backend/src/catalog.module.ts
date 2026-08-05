import {
  Injectable, Controller, Get, Post, Patch, Delete, Body, Param, Query, Request, UseGuards,
  BadRequestException, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { KhoaPhong, BacSi, KhungGio, TinTuc, VatTuTieuHao, Thuoc, TonKho, NhatKyHoatDong, VaiTro } from './entities';
import { JwtAuthGuard, RolesGuard, Roles } from './auth';

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(KhoaPhong) private khoa: Repository<KhoaPhong>,
    @InjectRepository(BacSi) private bacSi: Repository<BacSi>,
    @InjectRepository(KhungGio) private slot: Repository<KhungGio>,
    @InjectRepository(TinTuc) private tin: Repository<TinTuc>,
    @InjectRepository(VatTuTieuHao) private vatTu: Repository<VatTuTieuHao>,
    @InjectRepository(Thuoc) private thuoc: Repository<Thuoc>,
    @InjectRepository(TonKho) private ton: Repository<TonKho>,
  ) {}

  getKhoa() { return this.khoa.find({ relations: ['bac_si'] }); }

  getBacSi(khoaId?: number) {
    const where = khoaId ? { khoa: { id: khoaId } } : {};
    return this.bacSi.find({ where });
  }

  // Ngày nằm trong cửa sổ đặt lịch (hôm nay → 1 năm tới)?
  private trongCuaSoDat(ngay: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ngay || '')) return false;
    const d = new Date(ngay + 'T00:00:00');
    if (isNaN(d.getTime())) return false;
    const homNay = new Date(); homNay.setHours(0, 0, 0, 0);
    const max = new Date(homNay); max.setFullYear(max.getFullYear() + 1);
    return d >= homNay && d <= max;
  }

  async getSlots(bacSiId: number, ngay: string) {
    let all = await this.slot.find({ where: { bac_si: { id: bacSiId }, ngay }, order: { gio_bat_dau: 'ASC' } });

    // Ngày chưa được cấu hình khung giờ → tự sinh bộ khung mặc định để bệnh
    // nhân luôn đặt được trong cửa sổ 30 ngày; admin chỉnh lại ở trang Khung giờ.
    if (all.length === 0 && this.trongCuaSoDat(ngay)) {
      const bs = await this.bacSi.findOneBy({ id: bacSiId });
      if (bs) {
        const GIO_MAC_DINH = ['07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '13:30', '14:00', '14:30', '15:00'];
        await this.slot.manager.transaction(async (m) => {
          // kiểm tra lại trong transaction để hạn chế sinh trùng khi gọi đồng thời
          const daCo = await m.count(KhungGio, { where: { bac_si: { id: bacSiId }, ngay } });
          if (daCo === 0) {
            await m.save(GIO_MAC_DINH.map((g) =>
              m.create(KhungGio, { ngay, gio_bat_dau: g, gio_ket_thuc: g, so_luong: 5, da_dat: 0, bac_si: bs })));
          }
        });
        all = await this.slot.find({ where: { bac_si: { id: bacSiId }, ngay }, order: { gio_bat_dau: 'ASC' } });
      }
    }

    return all
      .filter((s) => s.da_dat < s.so_luong)
      .map((s) => ({ id: s.id, gio_bat_dau: s.gio_bat_dau, gio_ket_thuc: s.gio_ket_thuc, con_lai: s.so_luong - s.da_dat }));
  }

  getTinTuc() { return this.tin.find({ order: { ngay_dang: 'DESC' } }); }

  // --- Admin: quản lý khung giờ khám của bác sĩ ---
  // Khác /slots công khai: trả đủ mọi khung (kể cả đã đầy) kèm số đã đặt
  adminSlots(bacSiId: number, ngay: string) {
    return this.slot.find({ where: { bac_si: { id: bacSiId }, ngay }, order: { gio_bat_dau: 'ASC' } });
  }

  async addSlot(dto: any) {
    const ngay = String(dto.ngay || '');
    const gio = String(dto.gio_bat_dau || '');
    const soLuong = +dto.so_luong || 5;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ngay)) throw new BadRequestException('Ngày không hợp lệ (YYYY-MM-DD)');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(gio)) throw new BadRequestException('Giờ không hợp lệ (HH:mm)');
    if (soLuong < 1 || soLuong > 50) throw new BadRequestException('Số chỗ phải từ 1 đến 50');
    const bs = await this.bacSi.findOneBy({ id: +dto.bac_si_id || 0 });
    if (!bs) throw new NotFoundException('Không tìm thấy bác sĩ');
    const trung = await this.slot.findOne({ where: { bac_si: { id: bs.id }, ngay, gio_bat_dau: gio } });
    if (trung) throw new BadRequestException('Bác sĩ đã có khung giờ này trong ngày');
    return this.slot.save(this.slot.create({ ngay, gio_bat_dau: gio, gio_ket_thuc: gio, so_luong: soLuong, da_dat: 0, bac_si: bs }));
  }

  // --- Admin: TẠO KHUNG GIỜ HÀNG LOẠT cho nhiều bác sĩ trong nhiều ngày ---
  // Sinh khung giờ đều nhau từ giờ bắt đầu đến giờ kết thúc theo bước phút.
  // Khung đã tồn tại (cùng bác sĩ + ngày + giờ) được BỎ QUA, không ghi đè số chỗ
  // hay số đã đặt — nên chạy lại nhiều lần vẫn an toàn.
  async taoKhungGioHangLoat(userId: number, dto: any) {
    const ngayHopLe = (v: any, ten: string) => {
      const s = String(v || '').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || isNaN(new Date(s).getTime()))
        throw new BadRequestException(`${ten} không hợp lệ (YYYY-MM-DD)`);
      return s;
    };
    const gioHopLe = (v: any, ten: string) => {
      const s = String(v || '').trim();
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) throw new BadRequestException(`${ten} không hợp lệ (HH:mm)`);
      return s;
    };
    const phut = (g: string) => +g.slice(0, 2) * 60 + +g.slice(3);
    const chuoiGio = (p: number) => `${String(Math.floor(p / 60)).padStart(2, '0')}:${String(p % 60).padStart(2, '0')}`;

    const tu = ngayHopLe(dto?.tu, 'Ngày bắt đầu');
    const den = ngayHopLe(dto?.den, 'Ngày kết thúc');
    if (tu > den) throw new BadRequestException('Ngày bắt đầu phải trước ngày kết thúc');
    const homNay = new Date().toLocaleDateString('en-CA');
    if (den < homNay) throw new BadRequestException('Khoảng ngày đã ở quá khứ');

    const batDau = phut(gioHopLe(dto?.gio_bat_dau, 'Giờ bắt đầu'));
    const ketThuc = phut(gioHopLe(dto?.gio_ket_thuc, 'Giờ kết thúc'));
    if (batDau >= ketThuc) throw new BadRequestException('Giờ bắt đầu phải trước giờ kết thúc');

    const buoc = Math.round(Number(dto?.buoc_phut ?? 30));
    if (![15, 20, 30, 45, 60].includes(buoc))
      throw new BadRequestException('Bước phút chỉ nhận 15, 20, 30, 45 hoặc 60');
    const soLuong = Math.round(Number(dto?.so_luong ?? 5));
    if (!Number.isFinite(soLuong) || soLuong < 1 || soLuong > 50)
      throw new BadRequestException('Số chỗ phải từ 1 đến 50');

    // Nghỉ trưa (tùy chọn): bỏ các khung có giờ bắt đầu nằm trong khoảng này
    let truaTu: number | null = null;
    let truaDen: number | null = null;
    if (dto?.nghi_trua_tu || dto?.nghi_trua_den) {
      truaTu = phut(gioHopLe(dto?.nghi_trua_tu, 'Giờ nghỉ trưa (từ)'));
      truaDen = phut(gioHopLe(dto?.nghi_trua_den, 'Giờ nghỉ trưa (đến)'));
      if (truaTu >= truaDen) throw new BadRequestException('Giờ nghỉ trưa không hợp lệ');
    }
    const boQuaCuoiTuan = dto?.bo_qua_cuoi_tuan === true || dto?.bo_qua_cuoi_tuan === 'true';

    // Danh sách bác sĩ: rỗng = toàn bộ bác sĩ của bệnh viện
    const idsRaw = Array.isArray(dto?.bac_si_ids) ? dto.bac_si_ids : [];
    const ids = [...new Set(idsRaw.map((v: any) => Number(v)))] as number[];
    if (ids.some((v) => !Number.isInteger(v) || v <= 0))
      throw new BadRequestException('Danh sách bác sĩ không hợp lệ');
    const bacSis = ids.length
      ? await this.bacSi.find({ where: { id: In(ids) } })
      : await this.bacSi.find();
    if (!bacSis.length) throw new BadRequestException('Không có bác sĩ nào để tạo khung giờ');
    if (ids.length && bacSis.length !== ids.length)
      throw new BadRequestException('Có bác sĩ trong danh sách không tồn tại');

    // Các giờ trong một ngày
    const gio: string[] = [];
    for (let p = batDau; p < ketThuc; p += buoc) {
      if (truaTu !== null && p >= truaTu && p < truaDen) continue;
      gio.push(chuoiGio(p));
    }
    if (!gio.length) throw new BadRequestException('Khoảng giờ đã chọn không sinh được khung nào');

    // Các ngày trong khoảng
    const ngays: string[] = [];
    for (const d = new Date(tu + 'T00:00:00'); d <= new Date(den + 'T00:00:00'); d.setDate(d.getDate() + 1)) {
      if (boQuaCuoiTuan && (d.getDay() === 0 || d.getDay() === 6)) continue;
      ngays.push(d.toLocaleDateString('en-CA'));
      if (ngays.length > 180) throw new BadRequestException('Khoảng ngày tối đa 180 ngày');
    }
    if (!ngays.length) throw new BadRequestException('Khoảng ngày đã chọn không còn ngày làm việc nào');

    const tongDuKien = bacSis.length * ngays.length * gio.length;
    if (tongDuKien > 20000)
      throw new BadRequestException(`Yêu cầu sinh ${tongDuKien} khung giờ — vượt giới hạn 20000, hãy thu hẹp khoảng ngày hoặc số bác sĩ`);

    const ketQua = await this.slot.manager.transaction(async (m) => {
      const daCo = await m.find(KhungGio, {
        where: { bac_si: { id: In(bacSis.map((b) => b.id)) }, ngay: In(ngays) },
        relations: ['bac_si'],
      });
      const khoa = new Set(daCo.map((s) => `${s.bac_si.id}|${s.ngay}|${s.gio_bat_dau}`));

      const moi: KhungGio[] = [];
      for (const bs of bacSis) {
        for (const ngay of ngays) {
          for (const g of gio) {
            if (khoa.has(`${bs.id}|${ngay}|${g}`)) continue;
            moi.push(m.create(KhungGio, {
              ngay, gio_bat_dau: g, gio_ket_thuc: chuoiGio(phut(g) + buoc),
              so_luong: soLuong, da_dat: 0, bac_si: bs,
            }));
          }
        }
      }
      // Lưu theo lô để tránh câu lệnh INSERT quá lớn
      for (let i = 0; i < moi.length; i += 500) await m.save(moi.slice(i, i + 500));

      await m.save(m.create(NhatKyHoatDong, {
        hanh_dong: 'tao_khung_gio_hang_loat',
        noi_dung: `Tạo ${moi.length} khung giờ cho ${bacSis.length} bác sĩ, ${ngays.length} ngày (${tu} → ${den}), ` +
          `${gio[0]}–${chuoiGio(ketThuc)} mỗi ${buoc} phút, ${soLuong} chỗ/khung`,
        nguoi_dung: { id: userId } as any,
      }));

      return { da_tao: moi.length, da_bo_qua: tongDuKien - moi.length };
    });

    return {
      ...ketQua,
      so_bac_si: bacSis.length, so_ngay: ngays.length, so_khung_moi_ngay: gio.length,
      tu, den, gio_dau: gio[0], gio_cuoi: gio[gio.length - 1],
      message: `Đã tạo ${ketQua.da_tao} khung giờ` + (ketQua.da_bo_qua ? `, bỏ qua ${ketQua.da_bo_qua} khung đã có` : ''),
    };
  }

  async updateSlot(id: number, dto: any) {
    const s = await this.slot.findOneBy({ id });
    if (!s) throw new NotFoundException('Không tìm thấy khung giờ');
    const soLuong = +dto.so_luong;
    if (!soLuong || soLuong < 1 || soLuong > 50) throw new BadRequestException('Số chỗ phải từ 1 đến 50');
    if (soLuong < s.da_dat) throw new BadRequestException(`Đã có ${s.da_dat} lượt đặt — không thể giảm dưới mức đó`);
    s.so_luong = soLuong;
    return this.slot.save(s);
  }

  async deleteSlot(id: number) {
    const s = await this.slot.findOneBy({ id });
    if (!s) throw new NotFoundException('Không tìm thấy khung giờ');
    if (s.da_dat > 0) throw new BadRequestException('Khung giờ đã có lượt đặt, không thể xóa');
    await this.slot.delete(id);
    return { message: 'Đã xóa khung giờ' };
  }

  // --- Admin: quản lý khoa phòng & nhân sự ---
  // Chỉ nhận đúng các trường được phép ghi; không truyền thẳng body vào create/save.
  private chuanKhoa(dto: any, batBuocTen: boolean) {
    const ra: Partial<KhoaPhong> = {};
    const ten = dto.ten_khoa === undefined ? undefined : String(dto.ten_khoa).trim();
    if (batBuocTen || ten !== undefined) {
      if (!ten) throw new BadRequestException('Vui lòng nhập tên khoa');
      if (ten.length > 120) throw new BadRequestException('Tên khoa tối đa 120 ký tự');
      ra.ten_khoa = ten;
    }
    if (dto.ma !== undefined) ra.ma = String(dto.ma).trim().slice(0, 30) || null;
    if (dto.mo_ta !== undefined) ra.mo_ta = String(dto.mo_ta).trim().slice(0, 1000) || null;
    if (dto.vi_tri !== undefined) ra.vi_tri = String(dto.vi_tri).trim().slice(0, 200) || null;
    return ra;
  }

  private async kiemTraTrungTen(ten: string, boQuaId?: number) {
    const trung = await this.khoa.findOne({ where: { ten_khoa: ten } });
    if (trung && trung.id !== boQuaId) throw new BadRequestException(`Đã có khoa tên "${ten}"`);
  }

  async addKhoa(dto: any) {
    const data = this.chuanKhoa(dto, true);
    await this.kiemTraTrungTen(data.ten_khoa);
    const k = await this.khoa.save(this.khoa.create(data));
    return this.khoa.findOne({ where: { id: k.id }, relations: ['bac_si'] });
  }

  async updateKhoa(id: number, dto: any) {
    const k = await this.khoa.findOneBy({ id });
    if (!k) throw new NotFoundException('Không tìm thấy khoa phòng');
    const data = this.chuanKhoa(dto, false);
    if (data.ten_khoa) await this.kiemTraTrungTen(data.ten_khoa, id);
    Object.assign(k, data);
    await this.khoa.save(k);
    return this.khoa.findOne({ where: { id }, relations: ['bac_si'] });
  }

  // Chỉ xóa được khoa rỗng — còn bác sĩ hoặc dịch vụ thì chặn để không mất dữ liệu liên quan
  async deleteKhoa(id: number) {
    const k = await this.khoa.findOne({ where: { id }, relations: ['bac_si', 'dich_vu'] });
    if (!k) throw new NotFoundException('Không tìm thấy khoa phòng');
    if (k.bac_si && k.bac_si.length)
      throw new BadRequestException(`Khoa còn ${k.bac_si.length} bác sĩ — chuyển hoặc xóa bác sĩ trước`);
    if (k.dich_vu && k.dich_vu.length)
      throw new BadRequestException(`Khoa còn ${k.dich_vu.length} dịch vụ — xóa dịch vụ trước`);
    await this.khoa.delete(id);
    return { message: `Đã xóa khoa ${k.ten_khoa}` };
  }

  private chuanBacSi(dto: any, batBuocTen: boolean) {
    const ra: Partial<BacSi> = {};
    const ten = dto.ho_ten === undefined ? undefined : String(dto.ho_ten).trim();
    if (batBuocTen || ten !== undefined) {
      if (!ten) throw new BadRequestException('Vui lòng nhập họ tên bác sĩ');
      if (ten.length > 120) throw new BadRequestException('Họ tên tối đa 120 ký tự');
      ra.ho_ten = ten;
    }
    if (dto.hoc_ham !== undefined) ra.hoc_ham = String(dto.hoc_ham).trim().slice(0, 50) || null;
    if (dto.chuyen_mon !== undefined) ra.chuyen_mon = String(dto.chuyen_mon).trim().slice(0, 200) || null;
    if (dto.so_nam_kn !== undefined) {
      const n = Number(dto.so_nam_kn);
      if (!Number.isFinite(n) || n < 0 || n > 70) throw new BadRequestException('Số năm kinh nghiệm phải từ 0 đến 70');
      ra.so_nam_kn = Math.round(n);
    }
    return ra;
  }

  async addBacSi(dto: any) {
    const khoa = await this.khoa.findOneBy({ id: +dto.khoa_id || 0 });
    if (!khoa) throw new BadRequestException('Khoa phòng không tồn tại');
    const data = this.chuanBacSi(dto, true);
    const bs = await this.bacSi.save(this.bacSi.create({ ...data, khoa }));
    return this.bacSi.findOne({ where: { id: bs.id }, relations: ['khoa'] });
  }

  // Danh mục vật tư tiêu hao đang hoạt động, lọc theo khoa dùng và nhóm.
  // Lọc theo khoa dùng cột simple-array nên so khớp theo chuỗi có ranh giới dấu
  // phẩy để "san" không khớp nhầm "sosinh".
  async getVatTu(khoa?: string, nhom?: string, q?: string) {
    const qb = this.vatTu.createQueryBuilder('v')
      .where('v.hoat_dong = true')
      .orderBy('v.nhom_id', 'ASC').addOrderBy('v.id', 'ASC');
    if (khoa && /^[a-z]{2,12}$/.test(khoa.trim())) {
      qb.andWhere(`concat(',', v.khoa, ',') LIKE :k`, { k: `%,${khoa.trim()},%` });
    }
    if (nhom !== undefined && nhom !== null && String(nhom).trim() !== '') {
      const n = Number(nhom);
      if (!Number.isInteger(n) || n <= 0) throw new BadRequestException('Nhóm vật tư không hợp lệ');
      qb.andWhere('v.nhom_id = :n', { n });
    }
    if (q && q.trim()) {
      qb.andWhere('(v.ten ILIKE :q OR v.nhom_ten ILIKE :q OR v.ghi_chu ILIKE :q)', { q: `%${q.trim()}%` });
    }
    const ds = await qb.take(500).getMany();
    return this.kemTonKho('vat_tu', ds, (v) => v.ma_vt);
  }

  // Danh mục thuốc đang hoạt động — nguồn cho ô kê đơn của bác sĩ và ô chọn
  // thuốc của lễ tân; ma_thuoc là khóa để trừ tủ thuốc.
  async getThuoc(q?: string) {
    const qb = this.thuoc.createQueryBuilder('t')
      .where('t.hoat_dong = true')
      .orderBy('t.ma_thuoc', 'ASC');
    if (q && q.trim())
      qb.andWhere('(t.hoat_chat ILIKE :q OR t.nhom ILIKE :q OR t.ung_dung ILIKE :q)', { q: `%${q.trim()}%` });
    const ds = await qb.take(500).getMany();
    return this.kemTonKho('thuoc', ds, (t) => t.ma_thuoc);
  }

  // Gắn số tồn và ĐƠN GIÁ KHO vào từng dòng danh mục. Thẻ kho là nguồn giá chuẩn
  // (sửa được ở trang Tồn kho); mặt hàng chưa mở thẻ thì giữ giá của danh mục.
  private async kemTonKho<X extends { don_gia: number }>(
    loai: string, ds: X[], layMa: (x: X) => string,
  ) {
    if (!ds.length) return [];
    const the = await this.ton.find({ where: { loai } });
    const theo = new Map(the.map((k) => [k.ma, k]));
    return ds.map((x) => {
      const k = theo.get(layMa(x));
      return {
        ...x,
        don_gia: k ? k.don_gia : x.don_gia,
        ton: k ? k.so_luong : null,       // null = chưa mở thẻ kho, không theo dõi tồn
        dvt_kho: k ? k.dvt : null,
      };
    });
  }

  async updateBacSi(id: number, dto: any) {
    const bs = await this.bacSi.findOne({ where: { id }, relations: ['khoa'] });
    if (!bs) throw new NotFoundException('Không tìm thấy bác sĩ');
    Object.assign(bs, this.chuanBacSi(dto, false));
    if (dto.khoa_id !== undefined) {
      const khoa = await this.khoa.findOneBy({ id: +dto.khoa_id || 0 });
      if (!khoa) throw new BadRequestException('Khoa phòng không tồn tại');
      bs.khoa = khoa;
    }
    await this.bacSi.save(bs);
    return this.bacSi.findOne({ where: { id }, relations: ['khoa'] });
  }
}

@Controller('api')
export class CatalogController {
  constructor(private svc: CatalogService) {}

  @Get('departments') khoa() { return this.svc.getKhoa(); }
  @Get('doctors') bacSi(@Query('khoa') khoa?: string) { return this.svc.getBacSi(khoa ? +khoa : undefined); }
  @Get('slots') slots(@Query('bacSi') bacSi: string, @Query('ngay') ngay: string) { return this.svc.getSlots(+bacSi, ngay); }
  @Get('news') tin() { return this.svc.getTinTuc(); }

  // Danh mục vật tư tiêu hao — nhân viên y tế dùng khi lập phiếu viện phí
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.BAC_SI, VaiTro.ADMIN)
  @Get('catalog/vat-tu') vatTuTieuHao(
    @Query('khoa') khoa?: string, @Query('nhom') nhom?: string, @Query('q') q?: string,
  ) {
    return this.svc.getVatTu(khoa, nhom, q);
  }

  // Danh mục thuốc — bác sĩ kê đơn, lễ tân lập phiếu viện phí
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.BAC_SI, VaiTro.ADMIN)
  @Get('catalog/thuoc') danhMucThuoc(@Query('q') q?: string) { return this.svc.getThuoc(q); }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.ADMIN)
  @Get('admin/slots') adminSlots(@Query('bacSi') bacSi: string, @Query('ngay') ngay: string) { return this.svc.adminSlots(+bacSi, ngay); }
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.ADMIN)
  @Post('admin/slots') addSlot(@Body() b: any) { return this.svc.addSlot(b); }
  // Tạo khung giờ hàng loạt cho nhiều bác sĩ trong nhiều ngày
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.ADMIN)
  @Post('admin/slots/bulk') taoHangLoat(@Request() r, @Body() b: any) {
    return this.svc.taoKhungGioHangLoat(r.user.id, b);
  }
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.ADMIN)
  @Patch('admin/slots/:id') updateSlot(@Param('id') id: string, @Body() b: any) { return this.svc.updateSlot(+id, b); }
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.ADMIN)
  @Delete('admin/slots/:id') deleteSlot(@Param('id') id: string) { return this.svc.deleteSlot(+id); }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.ADMIN)
  @Post('admin/departments') addKhoa(@Body() b: any) { return this.svc.addKhoa(b); }
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.ADMIN)
  @Patch('admin/departments/:id') suaKhoa(@Param('id') id: string, @Body() b: any) { return this.svc.updateKhoa(+id, b); }
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.ADMIN)
  @Delete('admin/departments/:id') xoaKhoa(@Param('id') id: string) { return this.svc.deleteKhoa(+id); }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.ADMIN)
  @Post('admin/doctors') addBacSi(@Body() b: any) { return this.svc.addBacSi(b); }
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.ADMIN)
  @Patch('admin/doctors/:id') suaBacSi(@Param('id') id: string, @Body() b: any) { return this.svc.updateBacSi(+id, b); }
}
