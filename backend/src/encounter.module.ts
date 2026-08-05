import {
  Injectable, Controller, Get, Post, Patch, Delete, Body, Param, Request, UseGuards,
  BadRequestException, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager, In, Not } from 'typeorm';
import {
  LichHen, TrangThaiLich, SinhHieu, KhamLamSang, ChiDinhCLS, KetLuanKham,
  ThanhToan, DichVu, NhatKyHoatDong, VaiTro, BacSi, NguoiDung,
} from './entities';
import { JwtAuthGuard, RolesGuard, Roles } from './auth';
import { phamViBacSi } from './pham-vi-bac-si';
import { guiThongBao, idQuanTriVien } from './notification.module';
import { ApptService } from './appointment.module';
import { NhapVienService } from './nhap-vien.module';

// ============================================================================
// QUY TRÌNH KHÁM 6 BƯỚC (mục 6 tài liệu thiết kế). Mỗi lần khám = một LichHen:
//   B1 Tiếp đón     — lich_hen (xác nhận/check-in, đã có ở appointment.module)
//   B2 Sinh hiệu    — sinh_hieu               POST /encounters/:id/vitals
//   B3 Khám bác sĩ  — kham_lam_sang           POST /encounters/:id/exam
//   B4 Cận lâm sàng — chi_dinh_cls            POST /encounters/:id/orders
//                                             PATCH /encounters/orders/:id/result
//   B5 Kết luận     — ket_luan_kham           POST /encounters/:id/conclusion
//                     (tự chuyển lich_hen -> da_kham để mở bước 6)
//   B6 Thanh toán   — thanh_toan (payment.module, lễ tân lập & thu)
// GET /encounters/today và GET /encounters/:id/flow trả trạng thái từng bước.
// ============================================================================

const LOAI_CLS = ['xet_nghiem', 'sieu_am', 'thu_thuat'];
const PHAN_LOAI = ['binh_thuong', 'theo_doi', 'nguy_co_cao'];
const HUONG_XU_TRI = ['ke_don', 'hen_tai_kham', 'de_nghi_nhap_vien', 'ket_thuc'];

const cat = (v: any, n: number) => { const s = v == null ? '' : String(v).trim(); return s ? s.slice(0, n) : null; };

@Injectable()
export class EncounterService {
  constructor(
    @InjectRepository(LichHen) private lich: Repository<LichHen>,
    @InjectRepository(SinhHieu) private sh: Repository<SinhHieu>,
    @InjectRepository(KhamLamSang) private kls: Repository<KhamLamSang>,
    @InjectRepository(ChiDinhCLS) private cls: Repository<ChiDinhCLS>,
    @InjectRepository(KetLuanKham) private kl: Repository<KetLuanKham>,
    @InjectRepository(ThanhToan) private tt: Repository<ThanhToan>,
    private ds: DataSource,
    // Dùng lại đúng cách đặt lịch tái khám của lễ tân (khung giờ + lịch hẹn thật)
    private appt: ApptService,
    // Yêu cầu nhập viện được ký ngay tại bước 5, cùng transaction với kết luận
    private nhapVien: NhapVienService,
  ) {}

  private ghiNhatKy(m: EntityManager, userId: number, hanhDong: string, noiDung: string) {
    return m.save(m.create(NhatKyHoatDong, {
      hanh_dong: hanhDong, noi_dung: noiDung, nguoi_dung: { id: userId } as any,
    }));
  }

  // Bác sĩ gắn với tài khoản đang đăng nhập; null = lễ tân/admin (xem toàn bộ).
  // Tài khoản bác sĩ chưa gắn hồ sơ bác sĩ bị TỪ CHỐI (xem pham-vi-bac-si.ts).
  private async bacSiCuaUser(user: any): Promise<BacSi | null> {
    if (!user) return null;
    return (await phamViBacSi(this.ds, user)).bs;
  }

  // Nạp lần khám. Khi có user là bác sĩ đã gắn hồ sơ, chặn thao tác trên lịch
  // của bác sĩ khác — chỉ bác sĩ được phân công mới được khám bệnh nhân đó.
  private async layLich(id: number, user?: any) {
    const lich = await this.lich.findOne({ where: { id } });
    if (!lich) throw new NotFoundException('Lịch hẹn (lần khám) không tồn tại');
    if (user) {
      const bs = await this.bacSiCuaUser(user);
      if (bs) {
        const chuLich = lich.khung_gio && lich.khung_gio.bac_si ? lich.khung_gio.bac_si.id : null;
        if (chuLich !== bs.id) throw new ForbiddenException('Lần khám này thuộc bác sĩ khác');
      }
    }
    return lich;
  }

  // Trạng thái 6 bước của một lần khám — dùng cho stepper ở frontend
  private buocTrangThai(lich: LichHen, coSinhHieu: boolean, coKham: boolean,
    dsCls: ChiDinhCLS[], coKetLuan: boolean, thanhToan: ThanhToan | null) {
    const daTiepDon = [TrangThaiLich.DA_CHECKIN, TrangThaiLich.DA_KHAM].includes(lich.trang_thai);
    const clsXong = dsCls.length > 0 && dsCls.every((c) => c.trang_thai === 'da_co_ket_qua');
    return {
      b1_tiep_don: daTiepDon ? 'xong' : lich.trang_thai === TrangThaiLich.DA_XAC_NHAN ? 'da_xac_nhan' : lich.trang_thai === TrangThaiLich.DA_HUY ? 'da_huy' : 'cho',
      b2_sinh_hieu: coSinhHieu ? 'xong' : 'cho',
      b3_kham: coKham ? 'xong' : 'cho',
      b4_cls: dsCls.length === 0 ? 'khong_co' : clsXong ? 'xong' : 'cho_ket_qua',
      b5_ket_luan: coKetLuan ? 'xong' : 'cho',
      b6_thanh_toan: !thanhToan ? 'chua_lap' : thanhToan.trang_thai,
    };
  }

  // Danh sách lần khám hôm nay kèm tiến độ 6 bước.
  // Bác sĩ chỉ thấy bệnh nhân được phân công cho mình; lễ tân/admin thấy toàn bộ.
  async homNay(user?: any) {
    const d = new Date();
    const ngay = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const bs = await this.bacSiCuaUser(user);
    const qb = this.lich.createQueryBuilder('lh')
      .leftJoinAndSelect('lh.ho_so', 'hs')
      .leftJoinAndSelect('lh.khung_gio', 'kg')
      .leftJoinAndSelect('kg.bac_si', 'bs')
      .leftJoinAndSelect('lh.khoa', 'k')
      .where('kg.ngay = :ngay', { ngay });
    if (bs) qb.andWhere('bs.id = :bsId', { bsId: bs.id });
    const list = await qb.orderBy('kg.gio_bat_dau', 'ASC').take(200).getMany();
    if (!list.length) return [];

    const ids = list.map((l) => l.id);
    // Nạp gộp dữ liệu các bước để tránh N+1 truy vấn
    const [shList, klsList, clsList, klList, ttList] = await Promise.all([
      this.sh.find({ where: { lich_hen: { id: In(ids) } }, relations: ['lich_hen'] }),
      this.kls.find({ where: { lich_hen: { id: In(ids) } }, relations: ['lich_hen'] }),
      this.cls.find({ where: { lich_hen: { id: In(ids) } }, relations: ['lich_hen'] }),
      this.kl.find({ where: { lich_hen: { id: In(ids) } }, relations: ['lich_hen'] }),
      this.tt.find({ where: { lich_hen: { id: In(ids) } } }),
    ]);
    const co = (arr: { lich_hen: LichHen }[]) => new Set(arr.map((x) => x.lich_hen.id));
    const shSet = co(shList), klsSet = co(klsList), klSet = co(klList);
    return list.map((lh) => ({
      id: lh.id, ma_lich_hen: lh.ma_lich_hen, trang_thai: lh.trang_thai, so_thu_tu: lh.so_thu_tu,
      benh_nhan: lh.ho_so ? lh.ho_so.ho_ten : null, ma_benh_nhan: lh.ho_so ? lh.ho_so.ma_benh_nhan : null,
      khoa: lh.khoa ? lh.khoa.ten_khoa : null,
      bac_si: lh.khung_gio && lh.khung_gio.bac_si ? lh.khung_gio.bac_si.ho_ten : null,
      gio: lh.khung_gio ? lh.khung_gio.gio_bat_dau : null,
      buoc: this.buocTrangThai(lh, shSet.has(lh.id), klsSet.has(lh.id),
        clsList.filter((c) => c.lich_hen.id === lh.id), klSet.has(lh.id),
        ttList.find((t) => t.lich_hen && t.lich_hen.id === lh.id) || null),
    }));
  }

  // Chi tiết toàn bộ 6 bước của một lần khám.
  // Chặn bác sĩ mở lần khám của bác sĩ khác (layLich kiểm tra quyền sở hữu).
  async flow(id: number, user?: any) {
    const lich = await this.layLich(id, user);
    const [sinhHieu, kham, dsCls, ketLuan, thanhToan] = await Promise.all([
      this.sh.findOne({ where: { lich_hen: { id } }, relations: ['nguoi_do'], order: { id: 'DESC' } }),
      this.kls.findOne({ where: { lich_hen: { id } }, relations: ['bac_si'], order: { id: 'DESC' } }),
      this.cls.find({ where: { lich_hen: { id } }, relations: ['nguoi_chi_dinh', 'nguoi_thuc_hien', 'dich_vu'], order: { id: 'ASC' } }),
      this.kl.findOne({ where: { lich_hen: { id } }, relations: ['bac_si'], order: { id: 'DESC' } }),
      this.tt.findOne({ where: { lich_hen: { id } }, order: { id: 'DESC' } }),
    ]);
    const ten = (u: any) => (u ? u.ho_ten : null);
    return {
      lich_hen: {
        id: lich.id, ma_lich_hen: lich.ma_lich_hen, trang_thai: lich.trang_thai, so_thu_tu: lich.so_thu_tu,
        benh_nhan: lich.ho_so ? {
          ho_ten: lich.ho_so.ho_ten, ma_benh_nhan: lich.ho_so.ma_benh_nhan,
          ngay_sinh: lich.ho_so.ngay_sinh, gioi_tinh: lich.ho_so.gioi_tinh, so_bhyt: lich.ho_so.so_bhyt,
        } : null,
        khoa: lich.khoa ? lich.khoa.ten_khoa : null,
        bac_si: lich.khung_gio && lich.khung_gio.bac_si ? lich.khung_gio.bac_si.ho_ten : null,
        ngay: lich.khung_gio ? lich.khung_gio.ngay : null,
        gio: lich.khung_gio ? lich.khung_gio.gio_bat_dau : null,
      },
      buoc: this.buocTrangThai(lich, !!sinhHieu, !!kham, dsCls, !!ketLuan, thanhToan),
      sinh_hieu: sinhHieu ? { ...sinhHieu, lich_hen: undefined, nguoi_do: ten(sinhHieu.nguoi_do) } : null,
      kham: kham ? { ...kham, lich_hen: undefined, bac_si: ten(kham.bac_si) } : null,
      chi_dinh: dsCls.map((c) => ({
        id: c.id, loai: c.loai, ten_chi_dinh: c.ten_chi_dinh, trang_thai: c.trang_thai,
        ket_qua: c.ket_qua, ket_luan: c.ket_luan, ngay_tao: c.ngay_tao, ngay_ket_qua: c.ngay_ket_qua,
        nguoi_chi_dinh: ten(c.nguoi_chi_dinh), nguoi_thuc_hien: ten(c.nguoi_thuc_hien),
      })),
      ket_luan: ketLuan ? { ...ketLuan, lich_hen: undefined, bac_si: ten(ketLuan.bac_si) } : null,
      // Yêu cầu nhập viện của lần khám (nếu có) để bác sĩ theo dõi tiến độ tiếp nhận
      nhap_vien: await this.nhapVien.theoLanKham(id),
      thanh_toan: thanhToan ? {
        id: thanhToan.id, ma_thanh_toan: thanhToan.ma_thanh_toan, tong_tien: thanhToan.tong_tien,
        trang_thai: thanhToan.trang_thai, ngay_thanh_toan: thanhToan.ngay_thanh_toan,
        chi_tiet: (thanhToan.chi_tiet || []).map((x) => ({ ten_dich_vu: x.ten_dich_vu, so_luong: x.so_luong, thanh_tien: x.thanh_tien })),
      } : null,
    };
  }

  // B2 — lưu sinh hiệu (ghi đè bản ghi cũ nếu đo lại)
  async luuSinhHieu(user: any, lichId: number, dto: any) {
    const userId = user.id;
    const lich = await this.layLich(lichId, user);
    if (lich.trang_thai === TrangThaiLich.DA_HUY) throw new BadRequestException('Lịch hẹn đã hủy');
    const phan_loai = dto?.phan_loai && PHAN_LOAI.includes(dto.phan_loai) ? dto.phan_loai : 'binh_thuong';
    const cao = parseFloat(dto?.chieu_cao), nang = parseFloat(dto?.can_nang);
    const bmi = cao > 0 && nang > 0 ? (nang / Math.pow(cao / 100, 2)).toFixed(1) : null;
    return this.ds.transaction(async (m) => {
      const cu = await m.findOne(SinhHieu, { where: { lich_hen: { id: lichId } } });
      const data = {
        huyet_ap: cat(dto?.huyet_ap, 20), mach: cat(dto?.mach, 20), nhiet_do: cat(dto?.nhiet_do, 20),
        nhip_tho: cat(dto?.nhip_tho, 20), spo2: cat(dto?.spo2, 20),
        chieu_cao: cat(dto?.chieu_cao, 20), can_nang: cat(dto?.can_nang, 20), bmi,
        phan_loai, ghi_chu: cat(dto?.ghi_chu, 1000),
        nguoi_do: { id: userId } as any, lich_hen: { id: lichId } as any,
      };
      const saved = await m.save(cu ? m.merge(SinhHieu, cu, data) : m.create(SinhHieu, data));
      await this.ghiNhatKy(m, userId, 'ghi_sinh_hieu', `Ghi sinh hiệu cho lần khám ${lich.ma_lich_hen}`);
      return { ...saved, lich_hen: undefined };
    });
  }

  // B3 — lưu khám lâm sàng (bác sĩ)
  async luuKham(user: any, lichId: number, dto: any) {
    const userId = user.id;
    const lich = await this.layLich(lichId, user);
    if (lich.trang_thai === TrangThaiLich.DA_HUY) throw new BadRequestException('Lịch hẹn đã hủy');
    return this.ds.transaction(async (m) => {
      const cu = await m.findOne(KhamLamSang, { where: { lich_hen: { id: lichId } } });
      const data = {
        benh_su: cat(dto?.benh_su, 4000), tien_su: cat(dto?.tien_su, 4000), di_ung: cat(dto?.di_ung, 2000),
        kham_thuc_the: cat(dto?.kham_thuc_the, 4000), chan_doan_so_bo: cat(dto?.chan_doan_so_bo, 2000),
        bac_si: { id: userId } as any, lich_hen: { id: lichId } as any,
      };
      const saved = await m.save(cu ? m.merge(KhamLamSang, cu, data) : m.create(KhamLamSang, data));
      await this.ghiNhatKy(m, userId, 'ghi_kham_lam_sang', `Ghi khám lâm sàng cho lần khám ${lich.ma_lich_hen}`);
      return { ...saved, lich_hen: undefined };
    });
  }

  // B4 — thêm chỉ định cận lâm sàng
  async themChiDinh(user: any, lichId: number, dto: any) {
    const userId = user.id;
    const lich = await this.layLich(lichId, user);
    if (lich.trang_thai === TrangThaiLich.DA_HUY) throw new BadRequestException('Lịch hẹn đã hủy');
    const loai = String(dto?.loai || '').trim();
    if (!LOAI_CLS.includes(loai)) throw new BadRequestException('Loại chỉ định phải là xet_nghiem, sieu_am hoặc thu_thuat');
    const ten = cat(dto?.ten_chi_dinh, 300);
    if (!ten) throw new BadRequestException('Tên chỉ định là bắt buộc');
    return this.ds.transaction(async (m) => {
      let dich_vu: DichVu | null = null;
      if (dto?.dich_vu_id) dich_vu = await m.findOne(DichVu, { where: { id: +dto.dich_vu_id } });
      const saved = await m.save(m.create(ChiDinhCLS, {
        loai, ten_chi_dinh: ten, dich_vu: dich_vu || undefined,
        nguoi_chi_dinh: { id: userId } as any, lich_hen: { id: lichId } as any,
      }));
      await this.ghiNhatKy(m, userId, 'tao_chi_dinh_cls', `Chỉ định ${ten} cho lần khám ${lich.ma_lich_hen}`);
      return { ...saved, lich_hen: undefined };
    });
  }

  // B4 — nhập kết quả cho một chỉ định
  async nhapKetQua(user: any, chiDinhId: number, dto: any) {
    const userId = user.id;
    const ket_qua = cat(dto?.ket_qua, 4000);
    if (!ket_qua) throw new BadRequestException('Kết quả không được để trống');
    return this.ds.transaction(async (m) => {
      const cd = await m.findOne(ChiDinhCLS, { where: { id: chiDinhId }, relations: ['lich_hen'] });
      if (!cd) throw new NotFoundException('Chỉ định không tồn tại');
      // Chặn bác sĩ nhập kết quả cho chỉ định thuộc lần khám của bác sĩ khác
      await this.layLich(cd.lich_hen.id, user);
      cd.ket_qua = ket_qua;
      cd.ket_luan = cat(dto?.ket_luan, 2000);
      cd.trang_thai = 'da_co_ket_qua';
      cd.ngay_ket_qua = new Date();
      cd.nguoi_thuc_hien = { id: userId } as any;
      const saved = await m.save(cd);
      await this.ghiNhatKy(m, userId, 'nhap_ket_qua_cls',
        `Nhập kết quả "${cd.ten_chi_dinh}" cho lần khám ${cd.lich_hen.ma_lich_hen}`);
      return { ...saved, lich_hen: undefined };
    });
  }

  // B4 — xóa một chỉ định cận lâm sàng (kèm kết quả nếu có)
  async xoaChiDinh(user: any, chiDinhId: number) {
    const userId = user.id;
    return this.ds.transaction(async (m) => {
      const cd = await m.findOne(ChiDinhCLS, { where: { id: chiDinhId }, relations: ['lich_hen'] });
      if (!cd) throw new NotFoundException('Chỉ định không tồn tại');
      // Chặn bác sĩ xóa chỉ định thuộc lần khám của bác sĩ khác
      const lich = await this.layLich(cd.lich_hen.id, user);
      if (lich.trang_thai === TrangThaiLich.DA_HUY) throw new BadRequestException('Lịch hẹn đã hủy');
      const ten = cd.ten_chi_dinh;
      await m.remove(cd);
      await this.ghiNhatKy(m, userId, 'xoa_chi_dinh_cls',
        `Xóa chỉ định "${ten}" khỏi lần khám ${lich.ma_lich_hen}`);
      return { ok: true };
    });
  }

  // B5 — kết luận lần khám; chuyển lich_hen sang da_kham để mở bước thanh toán.
  // Hướng xử trí "hẹn tái khám" BẮT BUỘC có ngày và sinh lịch hẹn thật + thông báo
  // cho lễ tân; các hướng khác không cần ngày và không tạo lịch nào.
  async ketLuan(user: any, lichId: number, dto: any) {
    const userId = user.id;
    const lich = await this.layLich(lichId, user);
    if (lich.trang_thai === TrangThaiLich.DA_HUY) throw new BadRequestException('Lịch hẹn đã hủy');
    const chan_doan_chinh = cat(dto?.chan_doan_chinh, 500);
    if (!chan_doan_chinh) throw new BadRequestException('Chẩn đoán chính là bắt buộc');
    const huong_xu_tri = HUONG_XU_TRI.includes(dto?.huong_xu_tri) ? dto.huong_xu_tri : 'ket_thuc';
    // Không hẹn tái khám thì bỏ hẳn ngày — tránh để lại ngày cũ làm lễ tân hiểu nhầm
    let ngay_tai_kham: string | null = null;
    if (huong_xu_tri === 'hen_tai_kham') {
      const s = String(dto?.ngay_tai_kham ?? '').trim();
      if (!s) throw new BadRequestException('Chọn ngày tái khám khi hướng xử trí là hẹn tái khám');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || isNaN(new Date(s).getTime()))
        throw new BadRequestException('Ngày tái khám không hợp lệ (YYYY-MM-DD)');
      if (s < new Date().toLocaleDateString('en-CA'))
        throw new BadRequestException('Ngày tái khám không được ở quá khứ');
      ngay_tai_kham = s;
    }
    return this.ds.transaction(async (m) => {
      const cu = await m.findOne(KetLuanKham, { where: { lich_hen: { id: lichId } } });
      const data = {
        chan_doan_chinh, ma_icd: cat(dto?.ma_icd, 30), chan_doan_phu: cat(dto?.chan_doan_phu, 2000),
        huong_xu_tri, don_thuoc: cat(dto?.don_thuoc, 4000), loi_dan: cat(dto?.loi_dan, 2000), ngay_tai_kham,
        bac_si: { id: userId } as any, lich_hen: { id: lichId } as any,
      };
      const saved = await m.save(cu ? m.merge(KetLuanKham, cu, data) : m.create(KetLuanKham, data));
      const taiKham = ngay_tai_kham
        ? await this.henTaiKham(m, lich, user, ngay_tai_kham, cat(dto?.loi_dan, 1000) || '')
        : null;
      // Đề nghị nhập viện: ký yêu cầu ngay trong transaction này — kết luận và
      // yêu cầu nhập viện phải cùng thành công hoặc cùng thất bại (tài liệu §3.1)
      const nhapVien = huong_xu_tri === 'de_nghi_nhap_vien'
        ? await this.nhapVien.taoYeuCau(m, userId, lich,
            { chan_doan_chinh, ma_icd: cat(dto?.ma_icd, 30) }, dto?.nhap_vien || {})
        : null;
      if (lich.trang_thai !== TrangThaiLich.DA_KHAM) {
        lich.trang_thai = TrangThaiLich.DA_KHAM;
        await m.save(lich);
      }
      await this.ghiNhatKy(m, userId, 'ket_luan_kham',
        `Kết luận lần khám ${lich.ma_lich_hen}: ${chan_doan_chinh}` +
        (taiKham ? ` — hẹn tái khám ${taiKham.ngay} (${taiKham.ma_lich_hen})` : '') +
        (nhapVien ? ` — đề nghị nhập viện ${nhapVien.ma_yeu_cau}` : ''));
      return { ...saved, lich_hen: undefined, tai_kham: taiKham, nhap_vien: nhapVien };
    });
  }

  // Sinh lịch tái khám từ bước 5 và báo cho lễ tân (người check-in bệnh nhân).
  // Idempotent: bác sĩ sửa lại kết luận với cùng ngày sẽ dùng lại lịch đã có,
  // không đẻ thêm lịch trùng và không gửi lại thông báo.
  private async henTaiKham(
    m: EntityManager, lich: LichHen, user: any, ngay: string, ghiChu: string,
  ) {
    const hoSo = lich.ho_so;
    if (!hoSo) throw new BadRequestException('Lần khám chưa gắn hồ sơ bệnh nhân nên không hẹn tái khám được');
    const bacSi = (lich.khung_gio && lich.khung_gio.bac_si) || (await this.bacSiCuaUser(user));
    if (!bacSi) throw new BadRequestException('Không xác định được bác sĩ hẹn tái khám cho lần khám này');

    const daCo = await m.findOne(LichHen, {
      where: {
        ho_so: { id: hoSo.id }, khung_gio: { ngay, bac_si: { id: bacSi.id } },
        trang_thai: Not(TrangThaiLich.DA_HUY),
      },
      order: { id: 'DESC' },
    });
    if (daCo) {
      hoSo.ngay_tai_kham = ngay;
      hoSo.bac_si_tai_kham = { id: bacSi.id } as any;
      await m.save(hoSo);
      return {
        id: daCo.id, ma_lich_hen: daCo.ma_lich_hen, ngay,
        gio: daCo.khung_gio ? daCo.khung_gio.gio_bat_dau : null, moi: false,
      };
    }

    const moi = await this.appt.datLichTaiKham(m, hoSo, bacSi, { ngay, mo_ta: '' }, ghiChu);
    const leTan = await m.find(NguoiDung, { where: { vai_tro: VaiTro.LE_TAN }, select: ['id'] });
    await guiThongBao(m, [...leTan.map((u) => u.id), ...(await idQuanTriVien(m))], {
      loai: 'tai_kham', tieu_de: 'Lịch tái khám mới do bác sĩ hẹn',
      noi_dung: `${bacSi.ho_ten} hẹn ${hoSo.ho_ten} (${hoSo.ma_benh_nhan}) tái khám ngày ` +
        `${new Date(ngay).toLocaleDateString('vi-VN')} lúc ${moi.gio} — mã lịch ${moi.ma_lich_hen}` +
        `${ghiChu ? `. Lời dặn: ${ghiChu}` : ''}`,
      lich_hen_id: moi.id,
    });
    return { id: moi.id, ma_lich_hen: moi.ma_lich_hen, ngay, gio: moi.gio, moi: true };
  }
}

@Controller('api')
export class EncounterController {
  constructor(private svc: EncounterService) {}

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.BAC_SI, VaiTro.ADMIN)
  @Get('encounters/today') homNay(@Request() r) { return this.svc.homNay(r.user); }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.BAC_SI, VaiTro.ADMIN)
  @Get('encounters/:id/flow') flow(@Request() r, @Param('id') id: string) { return this.svc.flow(+id, r.user); }

  // B2 — sinh hiệu: điều dưỡng/lễ tân hoặc bác sĩ đo
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.BAC_SI, VaiTro.ADMIN)
  @Post('encounters/:id/vitals') vitals(@Request() r, @Param('id') id: string, @Body() b) { return this.svc.luuSinhHieu(r.user, +id, b); }

  // B3 — khám lâm sàng: chỉ bác sĩ
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.BAC_SI, VaiTro.ADMIN)
  @Post('encounters/:id/exam') exam(@Request() r, @Param('id') id: string, @Body() b) { return this.svc.luuKham(r.user, +id, b); }

  // B4 — chỉ định + kết quả: bác sĩ (kỹ thuật viên chưa có vai trò riêng)
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.BAC_SI, VaiTro.ADMIN)
  @Post('encounters/:id/orders') order(@Request() r, @Param('id') id: string, @Body() b) { return this.svc.themChiDinh(r.user, +id, b); }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.BAC_SI, VaiTro.ADMIN)
  @Patch('encounters/orders/:orderId/result') result(@Request() r, @Param('orderId') id: string, @Body() b) { return this.svc.nhapKetQua(r.user, +id, b); }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.BAC_SI, VaiTro.ADMIN)
  @Delete('encounters/orders/:orderId') removeOrder(@Request() r, @Param('orderId') id: string) { return this.svc.xoaChiDinh(r.user, +id); }

  // B5 — kết luận: chỉ bác sĩ
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.BAC_SI, VaiTro.ADMIN)
  @Post('encounters/:id/conclusion') conclusion(@Request() r, @Param('id') id: string, @Body() b) { return this.svc.ketLuan(r.user, +id, b); }
}
