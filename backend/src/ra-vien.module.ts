import {
  Injectable, Controller, Get, Post, Patch, Body, Param, Query, Request, UseGuards,
  BadRequestException, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { PhieuRaVien, PhieuYLenh, HoSoBenhNhan, NhatKyHoatDong, VaiTro } from './entities';
import { JwtAuthGuard, RolesGuard, Roles } from './auth';
import { ketThucNoiTruKhiRaVien } from './nhap-vien.module';

// ============================================================================
//  RA VIỆN — bác sĩ điều trị lập y lệnh ra viện + kết luận tình trạng sức khỏe.
//  Là điều kiện để lễ tân tích "Đăng ký ra viện (ĐKRV)" trên phiếu khám.
//    POST  /doctor/ra-vien                 bác sĩ lập phiếu ra viện cho bệnh nhân
//    GET   /doctor/ra-vien?q=              danh sách phiếu ra viện gần đây
//    PATCH /doctor/ra-vien/:id/huy         hủy phiếu ra viện
//    GET   /reception/discharge-eligibility/:hoSoId   lễ tân kiểm tra điều kiện
// ============================================================================

export const TINH_TRANG_RA_VIEN = ['hoi_phuc', 'qua_nguy_hiem', 'chuyen_vien', 'nang_hon', 'tu_vong'];
// Chỉ hai tình trạng này là "an toàn về nhà" → cho phép Đăng ký ra viện
export const TINH_TRANG_AN_TOAN = ['hoi_phuc', 'qua_nguy_hiem'];
export const NHAN_TINH_TRANG: Record<string, string> = {
  hoi_phuc: 'Hồi phục', qua_nguy_hiem: 'Qua giai đoạn nguy hiểm',
  chuyen_vien: 'Chuyển viện', nang_hon: 'Nặng hơn', tu_vong: 'Tử vong',
};

// Tính điều kiện ra viện của một bệnh nhân (dùng chung cho lễ tân + chốt khi lưu
// phiếu khám). Điều kiện DB: viện phí đã thu đủ + có y lệnh ra viện hiệu lực với
// tình trạng an toàn về nhà. (Việc tích TTRV là ở form phiếu khám, chốt riêng.)
export async function tinhDieuKienRaVien(ds: DataSource, hoSoId: number) {
  const yls = await ds.getRepository(PhieuYLenh).createQueryBuilder('y')
    .leftJoin('y.phieu_kham', 'pk').leftJoin('pk.ho_so', 'hs')
    .where('hs.id = :id', { id: hoSoId }).getMany();
  const chuaDu = yls.filter((y) => (y.tong_tien - y.da_nop) > 0);
  const conLai = chuaDu.reduce((s, y) => s + (y.tong_tien - y.da_nop), 0);
  const thanhToanXong = chuaDu.length === 0;

  const rv = await ds.getRepository(PhieuRaVien).findOne({
    where: { ho_so: { id: hoSoId }, trang_thai: 'hieu_luc' },
    order: { ngay_tao: 'DESC' }, relations: ['bac_si'],
  });
  const coRaVien = !!rv;
  const anToanVeNha = !!rv && TINH_TRANG_AN_TOAN.includes(rv.tinh_trang);

  const thieu: string[] = [];
  if (!thanhToanXong) thieu.push(`Còn ${chuaDu.length} phiếu viện phí chưa thu đủ (còn lại ${conLai.toLocaleString('vi-VN')}đ)`);
  if (!coRaVien) thieu.push('Chưa có y lệnh ra viện của bác sĩ điều trị');
  else if (!anToanVeNha) thieu.push(`Bác sĩ kết luận "${NHAN_TINH_TRANG[rv.tinh_trang] || rv.tinh_trang}" — chưa đủ an toàn để về nhà`);

  return {
    thanh_toan: { xong: thanhToanXong, so_phieu: yls.length, so_chua_du: chuaDu.length, con_lai: conLai },
    y_lenh_ra_vien: {
      co: coRaVien, tinh_trang: rv ? rv.tinh_trang : null,
      nhan: rv ? (NHAN_TINH_TRANG[rv.tinh_trang] || rv.tinh_trang) : null,
      bac_si: rv && rv.bac_si ? rv.bac_si.ho_ten : null,
      ngay: rv ? (rv.ngay_ra_vien || rv.ngay_tao) : null,
      an_toan_ve_nha: anToanVeNha,
    },
    du_dieu_kien: thanhToanXong && coRaVien && anToanVeNha,
    thieu,
  };
}

@Injectable()
export class RaVienService {
  constructor(
    @InjectRepository(PhieuRaVien) private repo: Repository<PhieuRaVien>,
    @InjectRepository(HoSoBenhNhan) private hoSo: Repository<HoSoBenhNhan>,
    private ds: DataSource,
  ) {}

  private ghiNhatKy(m: EntityManager, userId: number, hanhDong: string, noiDung: string) {
    return m.save(m.create(NhatKyHoatDong, {
      hanh_dong: hanhDong, noi_dung: noiDung, nguoi_dung: { id: userId } as any,
    }));
  }

  private goi(h: PhieuRaVien) {
    return {
      id: h.id, tinh_trang: h.tinh_trang, nhan_tinh_trang: NHAN_TINH_TRANG[h.tinh_trang] || h.tinh_trang,
      an_toan_ve_nha: TINH_TRANG_AN_TOAN.includes(h.tinh_trang),
      ket_luan_suc_khoe: h.ket_luan_suc_khoe || '', chan_doan_ra_vien: h.chan_doan_ra_vien || '',
      ngay_ra_vien: h.ngay_ra_vien, trang_thai: h.trang_thai, ngay_tao: h.ngay_tao,
      ho_so: h.ho_so ? { id: h.ho_so.id, ma_benh_nhan: h.ho_so.ma_benh_nhan, ho_ten: h.ho_so.ho_ten } : null,
      bac_si: h.bac_si ? h.bac_si.ho_ten : null,
    };
  }

  async lap(userId: number, dto: any) {
    const hoSoId = Number(dto?.ho_so_id);
    if (!Number.isInteger(hoSoId) || hoSoId <= 0) throw new BadRequestException('Thiếu hồ sơ bệnh nhân');
    const hs = await this.hoSo.findOne({ where: { id: hoSoId } });
    if (!hs) throw new NotFoundException('Hồ sơ bệnh nhân không tồn tại');
    const tinhTrang = String(dto?.tinh_trang || '');
    if (!TINH_TRANG_RA_VIEN.includes(tinhTrang)) throw new BadRequestException('Tình trạng ra viện không hợp lệ');
    const ketLuan = (dto?.ket_luan_suc_khoe ?? '').toString().trim().slice(0, 2000) || null;
    const chanDoan = (dto?.chan_doan_ra_vien ?? '').toString().trim().slice(0, 2000) || null;
    let ngay: string | null = (dto?.ngay_ra_vien ?? '').toString().trim() || null;
    if (ngay && (!/^\d{4}-\d{2}-\d{2}$/.test(ngay) || isNaN(new Date(ngay).getTime())))
      throw new BadRequestException('Ngày ra viện không hợp lệ (YYYY-MM-DD)');

    return this.ds.transaction(async (m) => {
      // Mỗi bệnh nhân chỉ giữ một phiếu ra viện hiệu lực — hủy phiếu cũ nếu lập lại
      await m.update(PhieuRaVien, { ho_so: { id: hoSoId }, trang_thai: 'hieu_luc' }, { trang_thai: 'da_huy' });
      const h = await m.save(m.create(PhieuRaVien, {
        tinh_trang: tinhTrang, ket_luan_suc_khoe: ketLuan, chan_doan_ra_vien: chanDoan,
        ngay_ra_vien: ngay, trang_thai: 'hieu_luc',
        ho_so: { id: hoSoId } as any, bac_si: { id: userId } as any,
      }));
      // Ra viện thì đóng đợt nội trú đang mở và trả giường về trạng thái trống
      const dot = await ketThucNoiTruKhiRaVien(m, hoSoId);
      await this.ghiNhatKy(m, userId, 'lap_phieu_ra_vien',
        `Lập y lệnh ra viện cho ${hs.ma_benh_nhan} (${hs.ho_ten}) — ${NHAN_TINH_TRANG[tinhTrang] || tinhTrang}` +
        (dot ? ` — kết thúc đợt nội trú ${dot.so_vao_vien}` : ''));
      const full = await m.findOne(PhieuRaVien, { where: { id: h.id }, relations: ['bac_si'] });
      return { ...this.goi(full), noi_tru: dot ? { so_vao_vien: dot.so_vao_vien, giuong_da_tra: !!dot.giuong } : null };
    });
  }

  async danhSach(q?: string) {
    const qb = this.repo.createQueryBuilder('rv')
      .leftJoinAndSelect('rv.ho_so', 'hs').leftJoinAndSelect('rv.bac_si', 'bs')
      .orderBy('rv.ngay_tao', 'DESC').take(100);
    if (q && q.trim())
      qb.andWhere('(hs.ho_ten ILIKE :q OR hs.ma_benh_nhan ILIKE :q)', { q: `%${q.trim()}%` });
    const list = await qb.getMany();
    return list.map((h) => this.goi(h));
  }

  async huy(userId: number, id: number) {
    return this.ds.transaction(async (m) => {
      const h = await m.findOne(PhieuRaVien, { where: { id }, relations: ['bac_si'] });
      if (!h) throw new NotFoundException('Phiếu ra viện không tồn tại');
      if (h.trang_thai === 'da_huy') return this.goi(h);
      h.trang_thai = 'da_huy';
      await m.save(h);
      await this.ghiNhatKy(m, userId, 'huy_phieu_ra_vien',
        `Hủy y lệnh ra viện #${id}${h.ho_so ? ` — ${h.ho_so.ma_benh_nhan}` : ''}`);
      const full = await m.findOne(PhieuRaVien, { where: { id }, relations: ['bac_si'] });
      return this.goi(full);
    });
  }

  async dieuKien(hoSoId: number) {
    return tinhDieuKienRaVien(this.ds, hoSoId);
  }
}

@Controller('api')
export class RaVienController {
  constructor(private svc: RaVienService) {}

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.BAC_SI, VaiTro.ADMIN)
  @Post('doctor/ra-vien') lap(@Request() r, @Body() b) { return this.svc.lap(r.user.id, b); }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.BAC_SI, VaiTro.ADMIN)
  @Get('doctor/ra-vien') danhSach(@Query('q') q?: string) { return this.svc.danhSach(q); }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.BAC_SI, VaiTro.ADMIN)
  @Patch('doctor/ra-vien/:id/huy') huy(@Request() r, @Param('id') id: string) { return this.svc.huy(r.user.id, +id); }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.ADMIN)
  @Get('reception/discharge-eligibility/:hoSoId') dieuKien(@Param('hoSoId') id: string) { return this.svc.dieuKien(+id); }
}
