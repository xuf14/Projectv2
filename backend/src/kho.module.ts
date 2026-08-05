import {
  Injectable, Controller, Get, Post, Body, Query, Request, UseGuards,
  BadRequestException, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { TonKho, NhatKyKho, NhatKyHoatDong, VaiTro } from './entities';
import { JwtAuthGuard, RolesGuard, Roles } from './auth';

// ============================================================================
//  KHO — tủ thuốc (loai='thuoc') và tủ vật tư tiêu hao (loai='vat_tu').
//  Tồn kho bị TRỪ khi lễ tân lập phiếu y lệnh và được CỘNG khi nhập kho.
//  Mọi thay đổi đều ghi nhat_ky_kho để đối chiếu sau này.
// ============================================================================

const LOAI_KHO = ['thuoc', 'vat_tu'];
export const TEN_LOAI_KHO: Record<string, string> = { thuoc: 'Tủ thuốc', vat_tu: 'Tủ vật tư tiêu hao' };

// Số lượng kho: cho phép số lẻ (vd 0.5 lọ) nhưng chặn giá trị vô lý.
function chuanSoLuong(raw: any, nhan: string): number {
  const v = Number(raw);
  if (!isFinite(v) || v <= 0) throw new BadRequestException(`${nhan} phải là số lớn hơn 0`);
  if (v > 1_000_000) throw new BadRequestException(`${nhan} vượt quá giới hạn cho phép`);
  return Math.round(v * 100) / 100;
}

function chuanLoai(raw: any): string {
  const loai = String(raw || '').trim();
  if (!LOAI_KHO.includes(loai)) throw new BadRequestException('Loại kho phải là thuoc hoặc vat_tu');
  return loai;
}

@Injectable()
export class KhoService {
  constructor(
    @InjectRepository(TonKho) private kho: Repository<TonKho>,
    @InjectRepository(NhatKyKho) private nk: Repository<NhatKyKho>,
    private ds: DataSource,
  ) {}

  private ghiNhatKyHeThong(m: EntityManager, userId: number, hanhDong: string, noiDung: string) {
    return m.save(m.create(NhatKyHoatDong, {
      hanh_dong: hanhDong, noi_dung: noiDung, nguoi_dung: { id: userId } as any,
    }));
  }

  private ghiSoKho(
    m: EntityManager, userId: number, the: TonKho,
    loai_gd: string, so_luong: number, ton_truoc: number, ton_sau: number,
    ma_phieu: string | null, ghi_chu: string | null,
  ) {
    return m.save(m.create(NhatKyKho, {
      loai_gd, so_luong, ton_truoc, ton_sau, ma_phieu, ghi_chu,
      ton_kho: { id: the.id } as any, nguoi_dung: { id: userId } as any,
    }));
  }

  // ----- Xem tồn kho -----
  // loai: lọc một tủ; q: tìm theo mã/tên; sap_het=1: chỉ mặt hàng dưới mức tối
  // thiểu hoặc đã hết. Tổng hợp luôn tính trên tập ĐANG LỌC để khớp bảng hiển thị.
  async tonKho(loai?: string, q?: string, sapHet?: string) {
    const qb = this.kho.createQueryBuilder('k').orderBy('k.loai', 'ASC').addOrderBy('k.ma', 'ASC');
    if (loai) qb.andWhere('k.loai = :loai', { loai: chuanLoai(loai) });
    const kw = (q || '').trim();
    if (kw) qb.andWhere('(k.ten ILIKE :q OR k.ma ILIKE :q)', { q: `%${kw}%` });
    if (sapHet === '1' || sapHet === 'true') qb.andWhere('k.so_luong <= k.ton_toi_thieu');
    const list = await qb.getMany();

    const items = list.map((k) => ({
      id: k.id, loai: k.loai, ma: k.ma, ten: k.ten, dvt: k.dvt,
      don_gia: k.don_gia, so_luong: k.so_luong, ton_toi_thieu: k.ton_toi_thieu,
      gia_tri: Math.round(k.don_gia * k.so_luong),
      canh_bao: k.so_luong < 0 ? 'am_kho' : k.so_luong <= 0 ? 'het' : k.so_luong <= k.ton_toi_thieu ? 'sap_het' : null,
      hoat_dong: k.hoat_dong, ngay_cap_nhat: k.ngay_cap_nhat,
    }));
    const tongTheo = (l: string) => {
      const ds = items.filter((i) => i.loai === l);
      return {
        so_mat_hang: ds.length,
        tong_so_luong: Math.round(ds.reduce((s, i) => s + i.so_luong, 0) * 100) / 100,
        tong_gia_tri: ds.reduce((s, i) => s + i.gia_tri, 0),
      };
    };
    return {
      items,
      tong_hop: {
        so_mat_hang: items.length,
        tong_so_luong: Math.round(items.reduce((s, i) => s + i.so_luong, 0) * 100) / 100,
        tong_gia_tri: items.reduce((s, i) => s + i.gia_tri, 0),
        chua_co_gia: items.filter((i) => i.don_gia <= 0).length,
        sap_het: items.filter((i) => i.canh_bao === 'sap_het').length,
        het: items.filter((i) => i.canh_bao === 'het').length,
        am_kho: items.filter((i) => i.canh_bao === 'am_kho').length,
        thuoc: tongTheo('thuoc'),
        vat_tu: tongTheo('vat_tu'),
      },
    };
  }

  // ----- Nhập kho: cộng số lượng cho nhiều mặt hàng trong một lần -----
  // Lễ tân CHỈ được thay đổi số lượng; đơn giá kho là quyền của quản trị viên
  // nên dòng nhập có don_gia của lễ tân bị từ chối thay vì âm thầm bỏ qua.
  async nhapKho(user: { id: number; vai_tro: string }, dto: any) {
    const userId = user.id;
    const laAdmin = user.vai_tro === VaiTro.ADMIN;
    const raw = Array.isArray(dto?.dong) ? dto.dong : [];
    if (!raw.length) throw new BadRequestException('Phiếu nhập kho cần ít nhất một dòng');
    if (raw.length > 200) throw new BadRequestException('Mỗi phiếu nhập tối đa 200 dòng');
    const ghiChuPhieu = dto?.ghi_chu ? String(dto.ghi_chu).trim().slice(0, 500) : null;

    // Chuẩn hóa trước khi mở transaction; chặn trùng mặt hàng để tránh cộng hai lần
    const dong = raw.map((d: any) => ({
      loai: chuanLoai(d?.loai),
      ma: String(d?.ma || '').trim().slice(0, 50),
      so_luong: chuanSoLuong(d?.so_luong, 'Số lượng nhập'),
      don_gia: d?.don_gia === undefined || d?.don_gia === null || d?.don_gia === ''
        ? null : Math.round(Number(d.don_gia)),
    }));
    for (const d of dong) {
      if (!d.ma) throw new BadRequestException('Thiếu mã mặt hàng ở một dòng nhập kho');
      if (d.don_gia !== null && !laAdmin)
        throw new ForbiddenException('Chỉ quản trị viên được đặt đơn giá kho. Lễ tân chỉ nhập số lượng.');
      if (d.don_gia !== null && (!isFinite(d.don_gia) || d.don_gia < 0))
        throw new BadRequestException(`Đơn giá nhập không hợp lệ ở mặt hàng ${d.ma}`);
    }
    const khoa = new Set<string>();
    for (const d of dong) {
      const k = `${d.loai}:${d.ma}`;
      if (khoa.has(k)) throw new BadRequestException(`Mặt hàng ${d.ma} bị lặp trong cùng một phiếu nhập`);
      khoa.add(k);
    }

    return this.ds.transaction(async (m) => {
      const ketQua: any[] = [];
      for (const d of dong) {
        // Khóa dòng tồn để hai phiếu nhập/xuất song song không ghi đè nhau
        const the = await m.findOne(TonKho, { where: { loai: d.loai, ma: d.ma }, lock: { mode: 'pessimistic_write' } });
        if (!the) throw new NotFoundException(`Mặt hàng ${d.ma} chưa có thẻ kho ở ${TEN_LOAI_KHO[d.loai]}`);
        const truoc = the.so_luong;
        the.so_luong = Math.round((truoc + d.so_luong) * 100) / 100;
        if (d.don_gia !== null) the.don_gia = d.don_gia;   // chỉ admin tới được nhánh này
        await m.save(the);
        await this.ghiSoKho(m, userId, the, 'nhap', d.so_luong, truoc, the.so_luong, null, ghiChuPhieu);
        ketQua.push({ loai: the.loai, ma: the.ma, ten: the.ten, nhap: d.so_luong, ton_sau: the.so_luong });
      }
      await this.ghiNhatKyHeThong(m, userId, 'nhap_kho',
        `Nhập kho ${dong.length} mặt hàng${ghiChuPhieu ? ` — ${ghiChuPhieu}` : ''}`);
      return { so_dong: ketQua.length, dong: ketQua };
    });
  }

  // ----- Sửa đơn giá kho -----
  // Dùng khi nhập sai giá hoặc giá thuốc/vật tư thay đổi. KHÔNG đụng số lượng;
  // ghi vào nhật ký kho để đối chiếu giá cũ → giá mới.
  async suaGia(userId: number, dto: any) {
    const loai = chuanLoai(dto?.loai);
    const ma = String(dto?.ma || '').trim().slice(0, 50);
    if (!ma) throw new BadRequestException('Thiếu mã mặt hàng cần sửa giá');
    const gia = Math.round(Number(dto?.don_gia));
    if (!isFinite(gia) || gia < 0) throw new BadRequestException('Đơn giá phải là số không âm');
    if (gia > 1_000_000_000) throw new BadRequestException('Đơn giá vượt quá giới hạn cho phép');
    const lyDo = dto?.ly_do ? String(dto.ly_do).trim().slice(0, 500) : null;

    return this.ds.transaction(async (m) => {
      const the = await m.findOne(TonKho, { where: { loai, ma }, lock: { mode: 'pessimistic_write' } });
      if (!the) throw new NotFoundException(`Mặt hàng ${ma} chưa có thẻ kho ở ${TEN_LOAI_KHO[loai]}`);
      const giaCu = the.don_gia;
      if (giaCu === gia) throw new BadRequestException('Đơn giá mới trùng với đơn giá hiện tại');
      the.don_gia = gia;
      if (dto?.ton_toi_thieu !== undefined && dto?.ton_toi_thieu !== null && dto?.ton_toi_thieu !== '') {
        const tt = Number(dto.ton_toi_thieu);
        if (!isFinite(tt) || tt < 0) throw new BadRequestException('Mức tồn tối thiểu phải là số không âm');
        the.ton_toi_thieu = Math.round(tt * 100) / 100;
      }
      await m.save(the);
      await this.ghiSoKho(m, userId, the, 'sua_gia', 0, the.so_luong, the.so_luong, null,
        `Đơn giá ${giaCu}đ → ${gia}đ${lyDo ? ` — ${lyDo}` : ''}`);
      await this.ghiNhatKyHeThong(m, userId, 'sua_gia_kho',
        `Sửa đơn giá ${the.ten} (${the.ma}): ${giaCu}đ → ${gia}đ${lyDo ? ` — ${lyDo}` : ''}`);
      return {
        loai: the.loai, ma: the.ma, ten: the.ten, don_gia_cu: giaCu, don_gia: gia,
        so_luong: the.so_luong, gia_tri: Math.round(gia * the.so_luong),
      };
    });
  }

  // ----- Điều chỉnh kiểm kê: đặt lại tồn thực tế đếm được (chỉ quản trị viên) -----
  async dieuChinh(userId: number, dto: any) {
    const loai = chuanLoai(dto?.loai);
    const ma = String(dto?.ma || '').trim().slice(0, 50);
    if (!ma) throw new BadRequestException('Thiếu mã mặt hàng cần điều chỉnh');
    const moi = Number(dto?.so_luong_moi);
    if (!isFinite(moi) || moi < 0) throw new BadRequestException('Số lượng kiểm kê phải là số không âm');
    if (moi > 1_000_000) throw new BadRequestException('Số lượng kiểm kê vượt quá giới hạn cho phép');
    const lyDo = String(dto?.ly_do || '').trim().slice(0, 500);
    if (!lyDo) throw new BadRequestException('Cần ghi lý do điều chỉnh tồn kho');

    return this.ds.transaction(async (m) => {
      const the = await m.findOne(TonKho, { where: { loai, ma }, lock: { mode: 'pessimistic_write' } });
      if (!the) throw new NotFoundException(`Mặt hàng ${ma} chưa có thẻ kho ở ${TEN_LOAI_KHO[loai]}`);
      const truoc = the.so_luong;
      const sau = Math.round(moi * 100) / 100;
      the.so_luong = sau;
      if (dto?.ton_toi_thieu !== undefined && dto?.ton_toi_thieu !== null && dto?.ton_toi_thieu !== '') {
        const tt = Number(dto.ton_toi_thieu);
        if (!isFinite(tt) || tt < 0) throw new BadRequestException('Mức tồn tối thiểu phải là số không âm');
        the.ton_toi_thieu = Math.round(tt * 100) / 100;
      }
      await m.save(the);
      await this.ghiSoKho(m, userId, the, 'dieu_chinh', Math.round((sau - truoc) * 100) / 100, truoc, sau, null, lyDo);
      await this.ghiNhatKyHeThong(m, userId, 'dieu_chinh_kho',
        `Kiểm kê ${the.ten} (${the.ma}): ${truoc} → ${sau} — ${lyDo}`);
      return { loai: the.loai, ma: the.ma, ten: the.ten, ton_truoc: truoc, ton_sau: sau };
    });
  }

  // ----- Trừ kho theo phiếu y lệnh -----
  // Gọi TRONG transaction của nghiệp vụ lập phiếu để phiếu và tồn kho luôn khớp.
  // Chỉ trừ dòng thuốc/vật tư khớp được thẻ kho theo mã; dòng nhập tay không có
  // trong danh mục thì không theo dõi tồn và được trả về ở "khong_theo_doi".
  async xuatKhoTheoYLenh(
    m: EntityManager, userId: number,
    dong: { loai: string; ma_vt: string | null; ten: string; so_luong: number }[],
    maPhieu: string,
  ) {
    const canTru = dong.filter((d) => LOAI_KHO.includes(d.loai));
    // Gộp các dòng cùng mặt hàng để trừ một lần và kiểm tra tồn trên tổng số
    const gop = new Map<string, { loai: string; ma: string; ten: string; so_luong: number }>();
    const khongTheoDoi: { loai: string; ten: string; ly_do: string }[] = [];
    for (const d of canTru) {
      const ma = (d.ma_vt || '').trim();
      if (!ma) { khongTheoDoi.push({ loai: d.loai, ten: d.ten, ly_do: 'Dòng nhập tay, không thuộc danh mục' }); continue; }
      const k = `${d.loai}:${ma}`;
      const cu = gop.get(k);
      if (cu) cu.so_luong = Math.round((cu.so_luong + d.so_luong) * 100) / 100;
      else gop.set(k, { loai: d.loai, ma, ten: d.ten, so_luong: d.so_luong });
    }

    const daXuat: any[] = [];
    const thieu: string[] = [];
    for (const g of gop.values()) {
      const the = await m.findOne(TonKho, { where: { loai: g.loai, ma: g.ma }, lock: { mode: 'pessimistic_write' } });
      if (!the) { khongTheoDoi.push({ loai: g.loai, ten: g.ten, ly_do: `Mã ${g.ma} không có thẻ kho` }); continue; }
      const truoc = the.so_luong;
      const sau = Math.round((truoc - g.so_luong) * 100) / 100;
      if (sau < 0) {
        thieu.push(`${the.ten} (${TEN_LOAI_KHO[the.loai]}): cần ${g.so_luong}${the.dvt ? ' ' + the.dvt : ''}, tồn ${truoc}`);
        continue;
      }
      the.so_luong = sau;
      await m.save(the);
      await this.ghiSoKho(m, userId, the, 'xuat', -g.so_luong, truoc, sau, maPhieu, null);
      daXuat.push({ loai: the.loai, ma: the.ma, ten: the.ten, xuat: g.so_luong, ton_sau: sau });
    }
    // Thiếu kho thì hủy cả phiếu — throw ở đây làm transaction rollback
    if (thieu.length)
      throw new BadRequestException(`Không đủ tồn kho: ${thieu.join('; ')}. Vui lòng nhập kho trước khi lập phiếu.`);
    return { da_xuat: daXuat, khong_theo_doi: khongTheoDoi };
  }

  // ----- Nhật ký kho -----
  async nhatKy(loai?: string, ma?: string, loaiGd?: string) {
    const qb = this.nk.createQueryBuilder('n')
      .leftJoinAndSelect('n.ton_kho', 'k')
      .leftJoinAndSelect('n.nguoi_dung', 'u')
      .orderBy('n.id', 'DESC').take(200);
    if (loai) qb.andWhere('k.loai = :loai', { loai: chuanLoai(loai) });
    const maSach = (ma || '').trim();
    if (maSach) qb.andWhere('k.ma = :ma', { ma: maSach });
    const gd = (loaiGd || '').trim();
    if (gd) {
      if (!['nhap', 'xuat', 'dieu_chinh', 'sua_gia'].includes(gd))
        throw new BadRequestException('Loại giao dịch phải là nhap, xuat, dieu_chinh hoặc sua_gia');
      qb.andWhere('n.loai_gd = :gd', { gd });
    }
    const list = await qb.getMany();
    return list.map((n) => ({
      id: n.id, loai_gd: n.loai_gd, so_luong: n.so_luong, ton_truoc: n.ton_truoc, ton_sau: n.ton_sau,
      ma_phieu: n.ma_phieu, ghi_chu: n.ghi_chu, thoi_gian: n.thoi_gian,
      mat_hang: n.ton_kho ? { loai: n.ton_kho.loai, ma: n.ton_kho.ma, ten: n.ton_kho.ten, dvt: n.ton_kho.dvt } : null,
      nguoi_dung: n.nguoi_dung ? n.nguoi_dung.ho_ten : null,
    }));
  }
}

@Controller('api')
export class KhoController {
  constructor(private svc: KhoService) {}

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.ADMIN)
  @Get('kho/ton') ton(@Query('loai') loai?: string, @Query('q') q?: string, @Query('sap_het') sapHet?: string) {
    return this.svc.tonKho(loai, q, sapHet);
  }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.ADMIN)
  // Lễ tân nhập kho được, nhưng chỉ đổi số lượng — đơn giá bị chặn trong service
  @Post('kho/nhap') nhap(@Request() r, @Body() b) { return this.svc.nhapKho(r.user, b); }

  // Sửa đơn giá kho (nhập sai giá / giá thay đổi) — chỉ quản trị viên
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.ADMIN)
  @Post('kho/gia') suaGia(@Request() r, @Body() b) { return this.svc.suaGia(r.user.id, b); }

  // Kiểm kê đặt lại tồn — chỉ quản trị viên
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.ADMIN)
  @Post('kho/dieu-chinh') dieuChinh(@Request() r, @Body() b) { return this.svc.dieuChinh(r.user.id, b); }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.ADMIN)
  @Get('kho/nhat-ky') nhatKy(@Query('loai') loai?: string, @Query('ma') ma?: string, @Query('loai_gd') gd?: string) {
    return this.svc.nhatKy(loai, ma, gd);
  }
}
