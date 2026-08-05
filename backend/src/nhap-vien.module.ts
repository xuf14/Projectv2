import {
  Injectable, Controller, Get, Post, Patch, Body, Param, Query, Request, UseGuards,
  BadRequestException, NotFoundException, ForbiddenException, ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager, In } from 'typeorm';
import {
  Giuong, YeuCauNhapVien, DotNoiTru, KhoaPhong, LichHen, NguoiDung, BacSi,
  NhatKyHoatDong, VaiTro,
} from './entities';
import { JwtAuthGuard, RolesGuard, Roles } from './auth';
import { phamViBacSi } from './pham-vi-bac-si';
import { guiThongBao, idQuanTriVien } from './notification.module';

// ============================================================================
//  NHẬP VIỆN "MỘT CHẠM" — đặc tả Quy trình nhập viện một chạm (bản 1.0).
//  Ba điểm kiểm soát, mỗi điểm một trách nhiệm và một trạng thái:
//    1. BÁC SĨ   ký yêu cầu ngay tại bước 5 kết luận (encounter.module gọi
//                taoYeuCau trong CÙNG transaction với kết luận)
//    2. LỄ TÂN   tiếp nhận (claim) → xác minh danh tính/BHYT → chọn giường →
//                xác nhận nhập viện: sinh số vào viện, mở đợt nội trú, khóa giường
//    3. KHOA     bác sĩ của khoa xác nhận đã tiếp nhận người bệnh
//
//    GET   /nhap-vien/hang-cho?trang_thai=&q=   hàng chờ tiếp nhận
//    GET   /nhap-vien/:id                       chi tiết một yêu cầu
//    POST  /nhap-vien/:id/tiep-nhan             lễ tân nhận quyền xử lý
//    PATCH /nhap-vien/:id/xac-minh              lưu kết quả xác minh hành chính
//    POST  /nhap-vien/:id/xac-nhan              tạo đợt nội trú + khóa giường
//    POST  /nhap-vien/:id/ket-thuc              hủy / từ chối / chuyển viện
//    GET   /noi-tru?trang_thai=&q=              danh sách đợt nội trú
//    POST  /noi-tru/:id/khoa-nhan               khoa xác nhận đã nhận người bệnh
//    GET   /giuong?khoa_id=&trong=1             danh mục giường
//    POST  /admin/giuong                        quản trị thêm/sửa giường
// ============================================================================

export const UU_TIEN = ['cap_cuu', 'khan', 'thuong', 'theo_lich'];
export const NHAN_UU_TIEN: Record<string, string> = {
  cap_cuu: 'Cấp cứu', khan: 'Khẩn', thuong: 'Thông thường', theo_lich: 'Theo lịch',
};
export const HO_TRO_DI_CHUYEN = ['di_bo', 'xe_lan', 'cang'];
export const DOI_TUONG_TT = ['bhyt', 'vien_phi', 'bao_lanh'];
export const BHYT_TRANG_THAI = ['chua_xac_minh', 'hop_le', 'khong_co'];
// Yêu cầu còn đang chạy — chưa thành hồ sơ nội trú và chưa bị đóng
export const TRANG_THAI_MO = ['cho_tiep_nhan', 'dang_xac_minh', 'cho_giuong'];
export const TRANG_THAI_YEU_CAU = [
  ...TRANG_THAI_MO, 'da_nhap_vien', 'khoa_da_nhan', 'tu_choi', 'da_huy', 'chuyen_vien',
];
export const NHAN_TRANG_THAI: Record<string, string> = {
  cho_tiep_nhan: 'Chờ tiếp nhận', dang_xac_minh: 'Đang xác minh', cho_giuong: 'Chờ giường',
  da_nhap_vien: 'Đã nhập viện', khoa_da_nhan: 'Khoa đã tiếp nhận',
  tu_choi: 'Người bệnh từ chối', da_huy: 'Đã hủy', chuyen_vien: 'Chuyển viện',
};

const cat = (v: any, n: number) => { const s = v == null ? '' : String(v).trim(); return s ? s.slice(0, n) : null; };
const ma = (dau: string) => dau + Math.random().toString(36).slice(2, 7).toUpperCase();
// Nhãn giường: mã giường thường đã chứa số phòng ("P201-G1") nên không ghép lặp
export const tenGiuong = (g: { phong: string; ma: string }) =>
  g.ma.startsWith(g.phong) ? g.ma : `${g.phong}-${g.ma}`;

@Injectable()
export class NhapVienService {
  constructor(
    @InjectRepository(YeuCauNhapVien) private yc: Repository<YeuCauNhapVien>,
    @InjectRepository(DotNoiTru) private dnt: Repository<DotNoiTru>,
    @InjectRepository(Giuong) private giuong: Repository<Giuong>,
    private ds: DataSource,
  ) {}

  private ghiNhatKy(m: EntityManager, userId: number, hanhDong: string, noiDung: string) {
    return m.save(m.create(NhatKyHoatDong, {
      hanh_dong: hanhDong, noi_dung: noiDung, nguoi_dung: { id: userId } as any,
    }));
  }

  // Khóa một hàng bằng SQL thay vì lock của findOne: các entity ở đây có quan hệ
  // eager nên findOne sinh LEFT JOIN, mà Postgres không cho FOR UPDATE trên nhánh
  // nullable của outer join. Tên bảng là hằng trong mã, không ghép từ dữ liệu vào.
  private async khoaHang(m: EntityManager, bang: 'yeu_cau_nhap_vien' | 'giuong' | 'dot_noi_tru', id: number) {
    const rows = await m.query(`SELECT id FROM "${bang}" WHERE id = $1 FOR UPDATE`, [id]);
    return rows.length > 0;
  }

  // Đọc lại trong CÙNG transaction — repository ngoài transaction không thấy dữ
  // liệu vừa ghi nên không được dùng để dựng phản hồi.
  private async ycTrong(m: EntityManager, id: number) {
    const y = await m.findOne(YeuCauNhapVien, {
      where: { id }, relations: ['bac_si', 'nguoi_tiep_nhan', 'lich_hen'],
    });
    if (!y) throw new NotFoundException('Yêu cầu nhập viện không tồn tại');
    const dot = await m.findOne(DotNoiTru, {
      where: { yeu_cau: { id } }, relations: ['yeu_cau', 'nguoi_lam_thu_tuc', 'nguoi_khoa_nhan'],
    });
    return this.goiYeuCau(y, dot);
  }

  private async dotTrong(m: EntityManager, id: number) {
    const d = await m.findOne(DotNoiTru, {
      where: { id }, relations: ['yeu_cau', 'nguoi_lam_thu_tuc', 'nguoi_khoa_nhan'],
    });
    if (!d) throw new NotFoundException('Đợt nội trú không tồn tại');
    return this.goiDot(d);
  }

  private goiYeuCau(y: YeuCauNhapVien, dot?: DotNoiTru | null) {
    return {
      id: y.id, ma_yeu_cau: y.ma_yeu_cau, trang_thai: y.trang_thai,
      nhan_trang_thai: NHAN_TRANG_THAI[y.trang_thai] || y.trang_thai,
      uu_tien: y.uu_tien, nhan_uu_tien: NHAN_UU_TIEN[y.uu_tien] || y.uu_tien,
      ly_do_uu_tien: y.ly_do_uu_tien, chan_doan_chinh: y.chan_doan_chinh, ma_icd: y.ma_icd,
      ly_do: y.ly_do, canh_bao: y.canh_bao, ho_tro_di_chuyen: y.ho_tro_di_chuyen,
      ngay_du_kien: y.ngay_du_kien, ly_do_ket_thuc: y.ly_do_ket_thuc, phien_ban: y.phien_ban,
      doi_tuong_tt: y.doi_tuong_tt, bhyt_trang_thai: y.bhyt_trang_thai,
      ghi_chu_tiep_nhan: y.ghi_chu_tiep_nhan,
      thoi_gian_ky: y.thoi_gian_ky, thoi_gian_tiep_nhan: y.thoi_gian_tiep_nhan,
      ho_so: y.ho_so ? {
        id: y.ho_so.id, ma_benh_nhan: y.ho_so.ma_benh_nhan, ho_ten: y.ho_so.ho_ten,
        ngay_sinh: y.ho_so.ngay_sinh, gioi_tinh: y.ho_so.gioi_tinh,
        sdt: y.ho_so.sdt, dia_chi: y.ho_so.dia_chi, so_bhyt: y.ho_so.so_bhyt,
      } : null,
      lich_hen_id: y.lich_hen ? y.lich_hen.id : null,
      khoa: y.khoa ? { id: y.khoa.id, ten_khoa: y.khoa.ten_khoa } : null,
      bac_si: y.bac_si ? y.bac_si.ho_ten : null,
      nguoi_tiep_nhan: y.nguoi_tiep_nhan ? { id: y.nguoi_tiep_nhan.id, ho_ten: y.nguoi_tiep_nhan.ho_ten } : null,
      noi_tru: dot ? this.goiDot(dot) : null,
    };
  }

  private goiDot(d: DotNoiTru) {
    return {
      id: d.id, so_vao_vien: d.so_vao_vien, trang_thai: d.trang_thai,
      doi_tuong_tt: d.doi_tuong_tt, bhyt_trang_thai: d.bhyt_trang_thai, ghi_chu: d.ghi_chu,
      thoi_gian_vao: d.thoi_gian_vao, thoi_gian_khoa_nhan: d.thoi_gian_khoa_nhan,
      thoi_gian_ra: d.thoi_gian_ra,
      ho_so: d.ho_so ? {
        id: d.ho_so.id, ma_benh_nhan: d.ho_so.ma_benh_nhan, ho_ten: d.ho_so.ho_ten,
        ngay_sinh: d.ho_so.ngay_sinh, gioi_tinh: d.ho_so.gioi_tinh,
      } : null,
      khoa: d.khoa ? { id: d.khoa.id, ten_khoa: d.khoa.ten_khoa } : null,
      giuong: d.giuong ? { id: d.giuong.id, ma: d.giuong.ma, phong: d.giuong.phong } : null,
      yeu_cau: d.yeu_cau ? {
        id: d.yeu_cau.id, ma_yeu_cau: d.yeu_cau.ma_yeu_cau, uu_tien: d.yeu_cau.uu_tien,
        nhan_uu_tien: NHAN_UU_TIEN[d.yeu_cau.uu_tien] || d.yeu_cau.uu_tien,
        chan_doan_chinh: d.yeu_cau.chan_doan_chinh, ly_do: d.yeu_cau.ly_do,
        canh_bao: d.yeu_cau.canh_bao, ho_tro_di_chuyen: d.yeu_cau.ho_tro_di_chuyen,
      } : null,
      nguoi_lam_thu_tuc: d.nguoi_lam_thu_tuc ? d.nguoi_lam_thu_tuc.ho_ten : null,
      nguoi_khoa_nhan: d.nguoi_khoa_nhan ? d.nguoi_khoa_nhan.ho_ten : null,
    };
  }

  // ---------------------------------------------------------------- BÁC SĨ KÝ
  // Gọi từ encounter.module trong CÙNG transaction với kết luận khám: kết luận
  // và yêu cầu nhập viện phải cùng thành công hoặc cùng thất bại.
  // Ký lại trên một lần khám đã có yêu cầu đang mở = sửa yêu cầu + tăng phiên bản,
  // KHÔNG tạo yêu cầu thứ hai (ràng buộc "một lần khám tối đa một yêu cầu mở").
  async taoYeuCau(
    m: EntityManager, userId: number, lich: LichHen,
    kl: { chan_doan_chinh: string; ma_icd: string | null }, dto: any,
  ) {
    const hoSo = lich.ho_so;
    if (!hoSo) throw new BadRequestException('Lần khám chưa gắn hồ sơ bệnh nhân nên không tạo được yêu cầu nhập viện');

    const uuTien = UU_TIEN.includes(dto?.uu_tien) ? dto.uu_tien : 'thuong';
    const lyDoUuTien = cat(dto?.ly_do_uu_tien, 500);
    if (['cap_cuu', 'khan'].includes(uuTien) && !lyDoUuTien)
      throw new BadRequestException('Mức ưu tiên cấp cứu/khẩn phải ghi rõ lý do ưu tiên');
    const lyDo = cat(dto?.ly_do, 2000) || kl.chan_doan_chinh;
    const hoTro = HO_TRO_DI_CHUYEN.includes(dto?.ho_tro_di_chuyen) ? dto.ho_tro_di_chuyen : 'di_bo';

    let ngayDuKien: string | null = null;
    if (uuTien === 'theo_lich') {
      const s = String(dto?.ngay_du_kien ?? '').trim();
      if (!s) throw new BadRequestException('Nhập viện theo lịch phải có ngày dự kiến');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || isNaN(new Date(s).getTime()))
        throw new BadRequestException('Ngày dự kiến không hợp lệ (YYYY-MM-DD)');
      if (s < new Date().toLocaleDateString('en-CA'))
        throw new BadRequestException('Ngày dự kiến nhập viện không được ở quá khứ');
      ngayDuKien = s;
    }

    // Khoa nhập viện: bác sĩ chọn, mặc định theo khoa của lần khám
    const khoaId = Number(dto?.khoa_id) || (lich.khoa ? lich.khoa.id : 0);
    if (!khoaId) throw new BadRequestException('Chọn khoa nhập viện');
    const khoa = await m.findOne(KhoaPhong, { where: { id: khoaId } });
    if (!khoa) throw new NotFoundException('Khoa nhập viện không tồn tại');

    const data = {
      trang_thai: 'cho_tiep_nhan', uu_tien: uuTien, ly_do_uu_tien: lyDoUuTien,
      chan_doan_chinh: kl.chan_doan_chinh, ma_icd: kl.ma_icd, ly_do: lyDo,
      canh_bao: cat(dto?.canh_bao, 1000), ho_tro_di_chuyen: hoTro, ngay_du_kien: ngayDuKien,
      khoa: { id: khoaId } as any, ho_so: { id: hoSo.id } as any,
      lich_hen: { id: lich.id } as any, bac_si: { id: userId } as any,
    };

    const dangMo = await m.findOne(YeuCauNhapVien, {
      where: { lich_hen: { id: lich.id }, trang_thai: In(TRANG_THAI_MO) },
      order: { id: 'DESC' },
    });
    if (dangMo) {
      // Đã có hồ sơ nội trú thì nội dung đã ký là bất biến — không cho sửa âm thầm
      const daCoDot = await m.findOne(DotNoiTru, { where: { yeu_cau: { id: dangMo.id } } });
      if (daCoDot)
        throw new BadRequestException('Yêu cầu nhập viện đã thành hồ sơ nội trú, không sửa được');
      m.merge(YeuCauNhapVien, dangMo, { ...data, phien_ban: dangMo.phien_ban + 1 } as any);
      const luu = await m.save(dangMo);
      await this.ghiNhatKy(m, userId, 'sua_yeu_cau_nhap_vien',
        `Ký lại yêu cầu nhập viện ${luu.ma_yeu_cau} (phiên bản ${luu.phien_ban}) cho ${hoSo.ma_benh_nhan}`);
      return { id: luu.id, ma_yeu_cau: luu.ma_yeu_cau, trang_thai: luu.trang_thai, phien_ban: luu.phien_ban, moi: false };
    }

    const y = await m.save(m.create(YeuCauNhapVien, { ...data, ma_yeu_cau: ma('NV') }));
    // Hàng chờ của lễ tân là thời gian thực → báo ngay cho lễ tân + quản trị
    const leTan = await m.find(NguoiDung, { where: { vai_tro: VaiTro.LE_TAN }, select: ['id'] });
    await guiThongBao(m, [...leTan.map((u) => u.id), ...(await idQuanTriVien(m))], {
      loai: 'nhap_vien',
      tieu_de: `Yêu cầu nhập viện ${NHAN_UU_TIEN[uuTien]} — ${khoa.ten_khoa}`,
      noi_dung: `${hoSo.ho_ten} (${hoSo.ma_benh_nhan}) — ${lyDo}. Mã yêu cầu ${y.ma_yeu_cau}` +
        `${dto?.canh_bao ? `. Cảnh báo: ${cat(dto.canh_bao, 200)}` : ''}`,
      lich_hen_id: lich.id,
    });
    await this.ghiNhatKy(m, userId, 'tao_yeu_cau_nhap_vien',
      `Tạo yêu cầu nhập viện ${y.ma_yeu_cau} cho ${hoSo.ma_benh_nhan} (${hoSo.ho_ten}) — ${khoa.ten_khoa}, ${NHAN_UU_TIEN[uuTien]}`);
    return { id: y.id, ma_yeu_cau: y.ma_yeu_cau, trang_thai: y.trang_thai, phien_ban: y.phien_ban, moi: true };
  }

  // ------------------------------------------------------------- HÀNG CHỜ
  // Cấp cứu/khẩn lên đầu, sau đó tới yêu cầu chờ lâu nhất.
  async hangCho(trangThai?: string, q?: string) {
    const loc = String(trangThai || '').trim();
    if (loc && loc !== 'mo' && !TRANG_THAI_YEU_CAU.includes(loc))
      throw new BadRequestException('Trạng thái yêu cầu nhập viện không hợp lệ');
    const qb = this.yc.createQueryBuilder('y')
      .leftJoinAndSelect('y.ho_so', 'hs')
      .leftJoinAndSelect('y.khoa', 'k')
      .leftJoinAndSelect('y.bac_si', 'bs')
      .leftJoinAndSelect('y.nguoi_tiep_nhan', 'ntn')
      .orderBy('y.thoi_gian_ky', 'ASC')
      .take(200);
    if (!loc || loc === 'mo') qb.where('y.trang_thai IN (:...mo)', { mo: TRANG_THAI_MO });
    else qb.where('y.trang_thai = :tt', { tt: loc });
    if (q && q.trim())
      qb.andWhere('(hs.ho_ten ILIKE :q OR hs.ma_benh_nhan ILIKE :q OR y.ma_yeu_cau ILIKE :q)', { q: `%${q.trim()}%` });
    const list = await qb.getMany();
    if (!list.length) return [];
    // Cấp cứu/khẩn lên đầu, cùng mức thì ai chờ lâu hơn xử lý trước. Sắp xếp ở
    // tầng ứng dụng vì danh sách đã giới hạn 200 dòng và biểu thức CASE trong
    // ORDER BY không dùng được với getMany của TypeORM.
    const bac = (u: string) => UU_TIEN.indexOf(u) < 0 ? UU_TIEN.length : UU_TIEN.indexOf(u);
    list.sort((a, b) => bac(a.uu_tien) - bac(b.uu_tien)
      || new Date(a.thoi_gian_ky).getTime() - new Date(b.thoi_gian_ky).getTime());
    const dots = await this.dnt.find({
      where: { yeu_cau: { id: In(list.map((x) => x.id)) } },
      // Nạp luôn người làm thủ tục và người của khoa để hàng chờ hiển thị đủ mốc
      // bàn giao, không phải mở chi tiết mới biết khoa đã nhận hay chưa.
      relations: ['yeu_cau', 'nguoi_lam_thu_tuc', 'nguoi_khoa_nhan'],
    });
    const theo = new Map(dots.map((d) => [d.yeu_cau.id, d]));
    return list.map((y) => this.goiYeuCau(y, theo.get(y.id) || null));
  }

  // Yêu cầu mới nhất của một lần khám — bước 5 hiển thị trạng thái tiếp nhận
  async theoLanKham(lichId: number) {
    const y = await this.yc.findOne({
      where: { lich_hen: { id: lichId } },
      relations: ['bac_si', 'nguoi_tiep_nhan', 'lich_hen'], order: { id: 'DESC' },
    });
    if (!y) return null;
    const dot = await this.dnt.findOne({
      where: { yeu_cau: { id: y.id } }, relations: ['yeu_cau', 'nguoi_lam_thu_tuc', 'nguoi_khoa_nhan'],
    });
    return this.goiYeuCau(y, dot);
  }

  async chiTiet(id: number) {
    const y = await this.yc.findOne({
      where: { id }, relations: ['bac_si', 'nguoi_tiep_nhan', 'lich_hen'],
    });
    if (!y) throw new NotFoundException('Yêu cầu nhập viện không tồn tại');
    const dot = await this.dnt.findOne({
      where: { yeu_cau: { id } }, relations: ['yeu_cau', 'nguoi_lam_thu_tuc', 'nguoi_khoa_nhan'],
    });
    return this.goiYeuCau(y, dot);
  }

  // --------------------------------------------------------------- LỄ TÂN
  // Nhận quyền xử lý để hai nhân viên không cùng làm một hồ sơ.
  async tiepNhan(userId: number, id: number) {
    return this.ds.transaction(async (m) => {
      if (!(await this.khoaHang(m, 'yeu_cau_nhap_vien', id)))
        throw new NotFoundException('Yêu cầu nhập viện không tồn tại');
      const y = await m.findOne(YeuCauNhapVien, { where: { id }, relations: ['nguoi_tiep_nhan'] });
      if (!TRANG_THAI_MO.includes(y.trang_thai))
        throw new BadRequestException(`Yêu cầu đang ở trạng thái "${NHAN_TRANG_THAI[y.trang_thai]}" — không tiếp nhận được`);
      if (y.nguoi_tiep_nhan && y.nguoi_tiep_nhan.id !== userId)
        throw new ConflictException(`Hồ sơ đang được ${y.nguoi_tiep_nhan.ho_ten} xử lý`);
      y.nguoi_tiep_nhan = { id: userId } as any;
      y.thoi_gian_tiep_nhan = y.thoi_gian_tiep_nhan || new Date();
      if (y.trang_thai === 'cho_tiep_nhan') y.trang_thai = 'dang_xac_minh';
      await m.save(y);
      await this.ghiNhatKy(m, userId, 'tiep_nhan_yeu_cau_nhap_vien',
        `Tiếp nhận yêu cầu nhập viện ${y.ma_yeu_cau}`);
      return this.ycTrong(m, id);
    });
  }

  // Lưu kết quả xác minh hành chính. Không đụng tới dữ liệu bệnh nhân — thông tin
  // hành chính sửa ở màn hình hồ sơ bệnh nhân, đây chỉ ghi nhận đã xác minh.
  async xacMinh(userId: number, id: number, dto: any) {
    return this.ds.transaction(async (m) => {
      if (!(await this.khoaHang(m, 'yeu_cau_nhap_vien', id)))
        throw new NotFoundException('Yêu cầu nhập viện không tồn tại');
      const y = await m.findOne(YeuCauNhapVien, { where: { id }, relations: ['nguoi_tiep_nhan'] });
      if (!TRANG_THAI_MO.includes(y.trang_thai))
        throw new BadRequestException(`Yêu cầu đang ở trạng thái "${NHAN_TRANG_THAI[y.trang_thai]}" — không sửa được`);

      if (dto?.doi_tuong_tt !== undefined) {
        if (!DOI_TUONG_TT.includes(dto.doi_tuong_tt)) throw new BadRequestException('Đối tượng thanh toán không hợp lệ');
        y.doi_tuong_tt = dto.doi_tuong_tt;
      }
      if (dto?.bhyt_trang_thai !== undefined) {
        if (!BHYT_TRANG_THAI.includes(dto.bhyt_trang_thai)) throw new BadRequestException('Trạng thái BHYT không hợp lệ');
        y.bhyt_trang_thai = dto.bhyt_trang_thai;
      }
      if (dto?.ghi_chu_tiep_nhan !== undefined) y.ghi_chu_tiep_nhan = cat(dto.ghi_chu_tiep_nhan, 2000);
      if (dto?.khoa_id !== undefined) {
        const khoaId = Number(dto.khoa_id);
        if (!Number.isInteger(khoaId) || khoaId <= 0) throw new BadRequestException('Khoa nhập viện không hợp lệ');
        if (!(await m.findOne(KhoaPhong, { where: { id: khoaId } })))
          throw new NotFoundException('Khoa nhập viện không tồn tại');
        y.khoa = { id: khoaId } as any;
      }
      // Chờ giường là trạng thái hành chính đã đủ nhưng chưa có giường trống
      if (dto?.trang_thai !== undefined) {
        if (!['dang_xac_minh', 'cho_giuong'].includes(dto.trang_thai))
          throw new BadRequestException('Chỉ chuyển được sang Đang xác minh hoặc Chờ giường');
        y.trang_thai = dto.trang_thai;
      }
      if (!y.nguoi_tiep_nhan) {
        y.nguoi_tiep_nhan = { id: userId } as any;
        y.thoi_gian_tiep_nhan = new Date();
      }
      await m.save(y);
      await this.ghiNhatKy(m, userId, 'xac_minh_nhap_vien',
        `Xác minh hồ sơ nhập viện ${y.ma_yeu_cau} — ${y.doi_tuong_tt}, BHYT ${y.bhyt_trang_thai}`);
      return this.ycTrong(m, id);
    });
  }

  // Một chạm của lễ tân: sinh số vào viện, mở đợt nội trú, khóa giường, báo khoa.
  // Toàn bộ nằm trong một transaction; giường được khóa bi quan nên hai lễ tân
  // không thể giữ cùng một giường.
  async xacNhanNhapVien(userId: number, id: number, dto: any) {
    return this.ds.transaction(async (m) => {
      if (!(await this.khoaHang(m, 'yeu_cau_nhap_vien', id)))
        throw new NotFoundException('Yêu cầu nhập viện không tồn tại');
      const y = await m.findOne(YeuCauNhapVien, { where: { id }, relations: ['bac_si'] });

      // Bấm lại nút không tạo thêm hồ sơ nội trú — trả lại kết quả cũ
      const daCo = await m.findOne(DotNoiTru, {
        where: { yeu_cau: { id } }, relations: ['yeu_cau', 'nguoi_lam_thu_tuc', 'nguoi_khoa_nhan'],
      });
      if (daCo) return this.goiDot(daCo);
      if (!TRANG_THAI_MO.includes(y.trang_thai))
        throw new BadRequestException(`Yêu cầu đang ở trạng thái "${NHAN_TRANG_THAI[y.trang_thai]}" — không nhập viện được`);

      const doiTuong = dto?.doi_tuong_tt !== undefined ? String(dto.doi_tuong_tt) : y.doi_tuong_tt;
      if (!DOI_TUONG_TT.includes(doiTuong)) throw new BadRequestException('Đối tượng thanh toán không hợp lệ');
      const bhyt = dto?.bhyt_trang_thai !== undefined ? String(dto.bhyt_trang_thai) : y.bhyt_trang_thai;
      if (!BHYT_TRANG_THAI.includes(bhyt)) throw new BadRequestException('Trạng thái BHYT không hợp lệ');
      if (doiTuong === 'bhyt' && bhyt === 'khong_co')
        throw new BadRequestException('Đối tượng BHYT nhưng thẻ được đánh dấu không có — chọn lại đối tượng thanh toán');

      const giuongId = Number(dto?.giuong_id);
      if (!Number.isInteger(giuongId) || giuongId <= 0)
        throw new BadRequestException('Chọn giường trước khi xác nhận nhập viện');
      if (!(await this.khoaHang(m, 'giuong', giuongId))) throw new NotFoundException('Giường không tồn tại');
      const g = await m.findOne(Giuong, { where: { id: giuongId } });
      if (!g.hoat_dong || g.trang_thai !== 'trong')
        throw new ConflictException(`Giường ${tenGiuong(g)} không còn trống — chọn giường khác`);
      const khoaId = g.khoa ? g.khoa.id : (y.khoa ? y.khoa.id : 0);
      if (!khoaId) throw new BadRequestException('Không xác định được khoa nhận bệnh');

      g.trang_thai = 'dang_dung';
      await m.save(g);

      const dot = await m.save(m.create(DotNoiTru, {
        so_vao_vien: ma('VV'), trang_thai: 'dang_dieu_tri',
        doi_tuong_tt: doiTuong, bhyt_trang_thai: bhyt, ghi_chu: cat(dto?.ghi_chu, 2000),
        yeu_cau: { id: y.id } as any, ho_so: { id: y.ho_so.id } as any,
        khoa: { id: khoaId } as any, giuong: { id: g.id } as any,
        nguoi_lam_thu_tuc: { id: userId } as any,
      }));

      y.trang_thai = 'da_nhap_vien';
      y.doi_tuong_tt = doiTuong;
      y.bhyt_trang_thai = bhyt;
      if (!y.nguoi_tiep_nhan) y.nguoi_tiep_nhan = { id: userId } as any;
      y.khoa = { id: khoaId } as any;
      await m.save(y);

      // Bàn giao: báo cho bác sĩ của khoa nhận bệnh + bác sĩ ký yêu cầu + quản trị
      const bsKhoa = await m.find(BacSi, { where: { khoa: { id: khoaId } }, relations: ['nguoi_dung'] });
      const nhan = [
        ...bsKhoa.filter((b) => b.nguoi_dung).map((b) => b.nguoi_dung.id),
        ...(y.bac_si ? [y.bac_si.id] : []),
        ...(await idQuanTriVien(m)),
      ];
      await guiThongBao(m, nhan, {
        loai: 'nhap_vien', tieu_de: 'Bàn giao người bệnh nhập viện',
        noi_dung: `${y.ho_so.ho_ten} (${y.ho_so.ma_benh_nhan}) — số vào viện ${dot.so_vao_vien}, ` +
          `giường ${tenGiuong(g)}. ${NHAN_UU_TIEN[y.uu_tien]}` +
          `${y.canh_bao ? `. Cảnh báo: ${y.canh_bao}` : ''}`,
      });
      await this.ghiNhatKy(m, userId, 'xac_nhan_nhap_vien',
        `Nhập viện ${y.ho_so.ma_benh_nhan} (${y.ho_so.ho_ten}) — số vào viện ${dot.so_vao_vien}, giường ${tenGiuong(g)}`);

      return this.dotTrong(m, dot.id);
    });
  }

  // Đóng yêu cầu khi người bệnh từ chối / hủy / chuyển viện. Không xóa khỏi lịch sử.
  async ketThuc(user: any, id: number, dto: any) {
    const trangThai = String(dto?.trang_thai || 'da_huy');
    if (!['da_huy', 'tu_choi', 'chuyen_vien'].includes(trangThai))
      throw new BadRequestException('Chỉ đóng yêu cầu ở trạng thái Hủy, Từ chối hoặc Chuyển viện');
    const lyDo = cat(dto?.ly_do, 1000);
    if (!lyDo) throw new BadRequestException('Phải ghi lý do khi đóng yêu cầu nhập viện');
    return this.ds.transaction(async (m) => {
      if (!(await this.khoaHang(m, 'yeu_cau_nhap_vien', id)))
        throw new NotFoundException('Yêu cầu nhập viện không tồn tại');
      const y = await m.findOne(YeuCauNhapVien, { where: { id }, relations: ['bac_si'] });
      if (!TRANG_THAI_MO.includes(y.trang_thai))
        throw new BadRequestException('Yêu cầu đã đóng hoặc đã thành hồ sơ nội trú — không hủy được');
      // Bác sĩ chỉ đóng được yêu cầu do chính mình ký; lễ tân/quản trị đóng được
      // theo thẩm quyền hành chính (người bệnh từ chối tại quầy).
      if (user.vai_tro === VaiTro.BAC_SI && y.bac_si && y.bac_si.id !== user.id)
        throw new ForbiddenException('Yêu cầu nhập viện này do bác sĩ khác ký');
      y.trang_thai = trangThai;
      y.ly_do_ket_thuc = lyDo;
      await m.save(y);
      await this.ghiNhatKy(m, user.id, 'ket_thuc_yeu_cau_nhap_vien',
        `Đóng yêu cầu nhập viện ${y.ma_yeu_cau} — ${NHAN_TRANG_THAI[trangThai]}: ${lyDo}`);
      return this.ycTrong(m, id);
    });
  }

  // ---------------------------------------------------------------- NỘI TRÚ
  // Bác sĩ chỉ thấy đợt nội trú của khoa mình; lễ tân/quản trị thấy toàn bộ.
  async danhSachNoiTru(user: any, trangThai?: string, q?: string) {
    const loc = String(trangThai || '').trim();
    if (loc && !['dang_dieu_tri', 'da_ra_vien'].includes(loc))
      throw new BadRequestException('Trạng thái đợt nội trú không hợp lệ');
    const qb = this.dnt.createQueryBuilder('d')
      .leftJoinAndSelect('d.ho_so', 'hs')
      .leftJoinAndSelect('d.khoa', 'k')
      .leftJoinAndSelect('d.giuong', 'g')
      .leftJoinAndSelect('d.yeu_cau', 'y')
      .leftJoinAndSelect('d.nguoi_lam_thu_tuc', 'nlt')
      .leftJoinAndSelect('d.nguoi_khoa_nhan', 'nkn')
      .orderBy('d.thoi_gian_vao', 'DESC').take(200);
    qb.where(loc ? 'd.trang_thai = :tt' : 'd.trang_thai IS NOT NULL', { tt: loc });
    const bs = (await phamViBacSi(this.ds, user)).bs;
    if (bs) qb.andWhere('k.id = :khoaId', { khoaId: bs.khoa ? bs.khoa.id : 0 });
    if (q && q.trim())
      qb.andWhere('(hs.ho_ten ILIKE :q OR hs.ma_benh_nhan ILIKE :q OR d.so_vao_vien ILIKE :q)', { q: `%${q.trim()}%` });
    return (await qb.getMany()).map((d) => this.goiDot(d));
  }

  // Điểm kiểm soát thứ ba: khoa đối chiếu người bệnh rồi xác nhận đã nhận.
  async khoaNhan(user: any, id: number) {
    const bs = (await phamViBacSi(this.ds, user)).bs;
    return this.ds.transaction(async (m) => {
      if (!(await this.khoaHang(m, 'dot_noi_tru', id))) throw new NotFoundException('Đợt nội trú không tồn tại');
      const d = await m.findOne(DotNoiTru, {
        where: { id }, relations: ['yeu_cau', 'nguoi_lam_thu_tuc', 'nguoi_khoa_nhan'],
      });
      if (bs && (!d.khoa || !bs.khoa || d.khoa.id !== bs.khoa.id))
        throw new ForbiddenException('Người bệnh này thuộc khoa khác');
      if (d.thoi_gian_khoa_nhan) return this.goiDot(d);   // bấm lại không đổi gì
      d.thoi_gian_khoa_nhan = new Date();
      d.nguoi_khoa_nhan = { id: user.id } as any;
      await m.save(d);
      if (d.yeu_cau) await m.update(YeuCauNhapVien, { id: d.yeu_cau.id }, { trang_thai: 'khoa_da_nhan' });
      await this.ghiNhatKy(m, user.id, 'khoa_tiep_nhan_nguoi_benh',
        `Khoa xác nhận đã tiếp nhận ${d.ho_so.ma_benh_nhan} (${d.ho_so.ho_ten}) — số vào viện ${d.so_vao_vien}`);
      return this.dotTrong(m, id);
    });
  }

  // ---------------------------------------------------------------- GIƯỜNG
  async danhSachGiuong(khoaId?: string, chiTrong?: string) {
    const qb = this.giuong.createQueryBuilder('g').leftJoinAndSelect('g.khoa', 'k')
      .orderBy('k.ten_khoa', 'ASC').addOrderBy('g.phong', 'ASC').addOrderBy('g.ma', 'ASC')
      .take(500);
    const id = Number(khoaId);
    if (khoaId !== undefined && khoaId !== '') {
      if (!Number.isInteger(id) || id <= 0) throw new BadRequestException('Khoa không hợp lệ');
      qb.where('k.id = :id', { id });
    }
    if (chiTrong === '1' || chiTrong === 'true')
      qb.andWhere(`g.trang_thai = 'trong' AND g.hoat_dong = true`);
    const list = await qb.getMany();
    const tong = { tong: list.length, trong: 0, dang_dung: 0, bao_tri: 0 };
    for (const g of list) {
      if (!g.hoat_dong) continue;
      if (g.trang_thai === 'trong') tong.trong += 1;
      else if (g.trang_thai === 'dang_dung') tong.dang_dung += 1;
      else tong.bao_tri += 1;
    }
    return {
      items: list.map((g) => ({
        id: g.id, ma: g.ma, phong: g.phong, loai: g.loai, trang_thai: g.trang_thai,
        hoat_dong: g.hoat_dong,
        khoa: g.khoa ? { id: g.khoa.id, ten_khoa: g.khoa.ten_khoa } : null,
      })),
      tong_hop: tong,
    };
  }

  // Quản trị cấu hình danh mục giường. Không cho sửa giường đang có người nằm
  // sang trạng thái khác — trạng thái đó do đợt nội trú giữ.
  async luuGiuong(userId: number, dto: any) {
    const khoaId = Number(dto?.khoa_id);
    if (!Number.isInteger(khoaId) || khoaId <= 0) throw new BadRequestException('Chọn khoa cho giường');
    const maG = cat(dto?.ma, 30);
    const phong = cat(dto?.phong, 30);
    if (!maG || !phong) throw new BadRequestException('Giường phải có số phòng và mã giường');
    const loai = ['thuong', 'dich_vu'].includes(dto?.loai) ? dto.loai : 'thuong';
    return this.ds.transaction(async (m) => {
      if (!(await m.findOne(KhoaPhong, { where: { id: khoaId } })))
        throw new NotFoundException('Khoa không tồn tại');
      const cu = await m.findOne(Giuong, { where: { khoa: { id: khoaId }, ma: maG } });
      const g = cu || m.create(Giuong, { ma: maG, khoa: { id: khoaId } as any, trang_thai: 'trong' });
      g.phong = phong;
      g.loai = loai;
      if (dto?.hoat_dong !== undefined) g.hoat_dong = !!dto.hoat_dong;
      if (dto?.trang_thai !== undefined) {
        if (!['trong', 'bao_tri'].includes(dto.trang_thai))
          throw new BadRequestException('Chỉ đặt được giường ở trạng thái Trống hoặc Bảo trì');
        if (g.trang_thai === 'dang_dung')
          throw new BadRequestException('Giường đang có người bệnh — không đổi trạng thái');
        g.trang_thai = dto.trang_thai;
      }
      const luu = await m.save(g);
      await this.ghiNhatKy(m, userId, cu ? 'sua_giuong' : 'them_giuong',
        `${cu ? 'Sửa' : 'Thêm'} giường ${tenGiuong(luu)}`);
      return { id: luu.id, ma: luu.ma, phong: luu.phong, loai: luu.loai, trang_thai: luu.trang_thai, hoat_dong: luu.hoat_dong };
    });
  }
}

// Trả giường về trạng thái trống và đóng đợt nội trú khi bệnh nhân ra viện.
// Đặt ở đây để module ra viện dùng lại trong CÙNG transaction của nó.
export async function ketThucNoiTruKhiRaVien(m: EntityManager, hoSoId: number) {
  const dot = await m.findOne(DotNoiTru, {
    where: { ho_so: { id: hoSoId }, trang_thai: 'dang_dieu_tri' }, order: { id: 'DESC' },
  });
  if (!dot) return null;
  dot.trang_thai = 'da_ra_vien';
  dot.thoi_gian_ra = new Date();
  await m.save(dot);
  if (dot.giuong) await m.update(Giuong, { id: dot.giuong.id, trang_thai: 'dang_dung' }, { trang_thai: 'trong' });
  return dot;
}

@Controller('api')
export class NhapVienController {
  constructor(private svc: NhapVienService) {}

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.BAC_SI, VaiTro.ADMIN)
  @Get('nhap-vien/hang-cho') hangCho(@Query('trang_thai') tt?: string, @Query('q') q?: string) {
    return this.svc.hangCho(tt, q);
  }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.BAC_SI, VaiTro.ADMIN)
  @Get('nhap-vien/:id') chiTiet(@Param('id') id: string) { return this.svc.chiTiet(+id); }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.ADMIN)
  @Post('nhap-vien/:id/tiep-nhan') tiepNhan(@Request() r, @Param('id') id: string) {
    return this.svc.tiepNhan(r.user.id, +id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.ADMIN)
  @Patch('nhap-vien/:id/xac-minh') xacMinh(@Request() r, @Param('id') id: string, @Body() b) {
    return this.svc.xacMinh(r.user.id, +id, b);
  }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.ADMIN)
  @Post('nhap-vien/:id/xac-nhan') xacNhan(@Request() r, @Param('id') id: string, @Body() b) {
    return this.svc.xacNhanNhapVien(r.user.id, +id, b);
  }

  // Bác sĩ ký yêu cầu hoặc lễ tân tại quầy đều có thể đóng khi người bệnh từ chối
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.BAC_SI, VaiTro.LE_TAN, VaiTro.ADMIN)
  @Post('nhap-vien/:id/ket-thuc') ketThuc(@Request() r, @Param('id') id: string, @Body() b) {
    return this.svc.ketThuc(r.user, +id, b);
  }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.BAC_SI, VaiTro.ADMIN)
  @Get('noi-tru') noiTru(@Request() r, @Query('trang_thai') tt?: string, @Query('q') q?: string) {
    return this.svc.danhSachNoiTru(r.user, tt, q);
  }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.BAC_SI, VaiTro.ADMIN)
  @Post('noi-tru/:id/khoa-nhan') khoaNhan(@Request() r, @Param('id') id: string) {
    return this.svc.khoaNhan(r.user, +id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.BAC_SI, VaiTro.ADMIN)
  @Get('giuong') giuong(@Query('khoa_id') khoaId?: string, @Query('trong') trong?: string) {
    return this.svc.danhSachGiuong(khoaId, trong);
  }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.ADMIN)
  @Post('admin/giuong') luuGiuong(@Request() r, @Body() b) { return this.svc.luuGiuong(r.user.id, b); }
}
