import {
  Injectable, Controller, Get, Post, Body, Param, Query, Request, UseGuards,
  BadRequestException, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import {
  PhieuYLenh, ChiTietYLenh, DienBienDieuTri, LanThuTienYLenh, PhieuKhamBenh, ChiDinhCLS,
  LuotKham, NhatKyHoatDong, TonKho, VaiTro,
} from './entities';
import { JwtAuthGuard, RolesGuard, Roles } from './auth';
import { KhoService } from './kho.module';

const LOAI_HOP_LE = ['thuoc', 'vat_tu', 'dich_vu'];

// Trạng thái thu tiền dựa trên tổng phải thu và tổng đã nộp
function trangThaiThu(tong: number, daNop: number): string {
  if (daNop <= 0) return 'chua_nop';
  if (daNop >= tong) return 'da_du';
  return 'mot_phan';
}

// Chuẩn hóa + kiểm tra một dòng chi tiết y lệnh tại biên tin cậy.
function chuanDong(raw: any) {
  const loai = String(raw?.loai || '').trim();
  if (!LOAI_HOP_LE.includes(loai))
    throw new BadRequestException('Loại dòng phải là thuoc, vat_tu hoặc dich_vu');
  const ten = String(raw?.ten || '').trim();
  if (!ten) throw new BadRequestException('Mỗi dòng phải có tên thuốc/vật tư/dịch vụ');
  if (ten.length > 300) throw new BadRequestException('Tên dòng quá dài');

  const so_luong = Number(raw?.so_luong);
  if (!isFinite(so_luong) || so_luong <= 0) throw new BadRequestException(`Số lượng không hợp lệ ở "${ten}"`);
  const don_gia = Math.round(Number(raw?.don_gia) || 0);
  if (don_gia < 0) throw new BadRequestException(`Đơn giá không hợp lệ ở "${ten}"`);
  let ty_le = raw?.ty_le === undefined || raw?.ty_le === null || raw?.ty_le === '' ? 100 : Math.round(Number(raw.ty_le));
  if (!isFinite(ty_le) || ty_le < 0 || ty_le > 100) throw new BadRequestException(`Tỷ lệ % không hợp lệ ở "${ten}"`);

  const thanh_tien = Math.round(so_luong * don_gia * (ty_le / 100));
  const cap = (v: any, n = 100) => { const s = v == null ? '' : String(v).trim(); return s ? s.slice(0, n) : null; };
  return {
    loai, ten, ma_vt: cap(raw?.ma_vt, 50), dvt: cap(raw?.dvt, 50),
    lieu_dung: cap(raw?.lieu_dung, 200), cach_dung: cap(raw?.cach_dung, 200),
    so_luong, don_gia, ty_le, thanh_tien,
  };
}

@Injectable()
export class YLenhService {
  constructor(
    @InjectRepository(PhieuYLenh) private yl: Repository<PhieuYLenh>,
    @InjectRepository(DienBienDieuTri) private db: Repository<DienBienDieuTri>,
    @InjectRepository(PhieuKhamBenh) private pk: Repository<PhieuKhamBenh>,
    private ds: DataSource,
    private kho: KhoService,
  ) {}

  private layChiTiet(id: number) {
    return this.yl.findOne({ where: { id }, relations: ['nguoi_tao', 'phieu_kham', 'phieu_kham.ho_so', 'chi_tiet', 'lan_thu', 'lan_thu.nguoi_thu'] });
  }

  private ghiNhatKy(m: EntityManager, userId: number, hanhDong: string, noiDung: string) {
    return m.save(m.create(NhatKyHoatDong, {
      hanh_dong: hanhDong, noi_dung: noiDung, nguoi_dung: { id: userId } as any,
    }));
  }

  private ngayHopLe(v: any, ten: string): string | null {
    if (v === undefined || v === null || v === '') return null;
    const s = String(v).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || isNaN(new Date(s).getTime()))
      throw new BadRequestException(`Ngày không hợp lệ ở trường ${ten}`);
    return s;
  }

  // ----- Y LỆNH (phiếu thanh toán viện phí) -----
  async taoYLenh(userId: number, dto: any) {
    const dongRaw = Array.isArray(dto?.chi_tiet) ? dto.chi_tiet : [];
    if (!dongRaw.length) throw new BadRequestException('Phiếu y lệnh cần ít nhất một dòng');
    if (dongRaw.length > 200) throw new BadRequestException('Quá nhiều dòng trong một phiếu');
    const dong = dongRaw.map(chuanDong);
    const tong_tien = dong.reduce((s, d) => s + d.thanh_tien, 0);
    const da_nop = Math.max(0, Math.round(Number(dto?.da_nop) || 0));
    const tra_lai = Math.max(0, da_nop - tong_tien);
    const bs_dt = dto?.bs_dt ? String(dto.bs_dt).trim().slice(0, 150) : null;
    const ghi_chu = dto?.ghi_chu ? String(dto.ghi_chu).trim().slice(0, 2000) : null;
    const ngay_yl = this.ngayHopLe(dto?.ngay_yl, 'ngay_yl');
    const ngay_cdht = this.ngayHopLe(dto?.ngay_cdht, 'ngay_cdht');

    // Bắt buộc liên kết phiếu khám bệnh để phiếu y lệnh luôn gắn với bệnh nhân
    // (tránh dữ liệu viện phí không có tên bệnh nhân).
    if (!dto?.phieu_kham_id)
      throw new BadRequestException('Cần chọn phiếu khám bệnh của bệnh nhân để liên kết phiếu y lệnh');
    const ketQua = await this.ds.transaction(async (m) => {
      const phieu_kham = await m.findOne(PhieuKhamBenh, { where: { id: +dto.phieu_kham_id } });
      if (!phieu_kham) throw new NotFoundException('Phiếu khám bệnh liên kết không tồn tại');
      const yLenh = m.create(PhieuYLenh, {
        ma_phieu: 'YL' + Date.now().toString().slice(-9),
        ngay_yl, bs_dt, ngay_cdht, tong_tien, da_nop, tra_lai, ghi_chu,
        trang_thai: trangThaiThu(tong_tien, da_nop),
        phieu_kham,
        nguoi_tao: { id: userId } as any,
        chi_tiet: dong.map((d) => m.create(ChiTietYLenh, d)),
        // Khoản nộp ban đầu (nếu có) là một lần thu do chính lễ tân lập phiếu xác nhận
        lan_thu: da_nop > 0 ? [m.create(LanThuTienYLenh, { so_tien: da_nop, nguoi_thu: { id: userId } as any })] : [],
      });
      const saved = await m.save(yLenh);
      // Xuất kho ngay trong transaction: thiếu tồn thì hủy luôn cả phiếu
      const kho = await this.kho.xuatKhoTheoYLenh(m, userId, dong, saved.ma_phieu);
      await this.ghiNhatKy(m, userId, 'tao_y_lenh',
        `Lập phiếu y lệnh ${saved.ma_phieu} (${dong.length} dòng, tổng ${tong_tien}đ, đã nộp ${da_nop}đ` +
        `${kho.da_xuat.length ? `, xuất kho ${kho.da_xuat.length} mặt hàng` : ''})`);
      return { id: saved.id, kho };
    });
    // Nạp lại sau khi transaction đã commit để có đủ quan hệ (tên người thu...)
    return { ...(await this.chiTietYLenh(ketQua.id)), kho: ketQua.kho };
  }

  // Lễ tân xác nhận thu thêm tiền cho phiếu chưa nộp đủ (nộp nhiều lần)
  async thuThem(userId: number, id: number, dto: any) {
    const so_tien = Math.round(Number(dto?.so_tien) || 0);
    if (so_tien <= 0) throw new BadRequestException('Số tiền thu phải lớn hơn 0');
    await this.ds.transaction(async (m) => {
      const y = await m.findOne(PhieuYLenh, { where: { id } });
      if (!y) throw new NotFoundException('Phiếu y lệnh không tồn tại');
      if (y.da_nop >= y.tong_tien) throw new BadRequestException('Phiếu đã thu đủ, không cần thu thêm');
      const daNopMoi = y.da_nop + so_tien;
      y.da_nop = daNopMoi;
      y.tra_lai = Math.max(0, daNopMoi - y.tong_tien);
      y.trang_thai = trangThaiThu(y.tong_tien, daNopMoi);
      await m.save(m.create(LanThuTienYLenh, { so_tien, nguoi_thu: { id: userId } as any, y_lenh: { id } as any }));
      await m.save(y);
      await this.ghiNhatKy(m, userId, 'thu_tien_y_lenh',
        `Thu thêm ${so_tien}đ cho phiếu ${y.ma_phieu} (đã nộp ${daNopMoi}/${y.tong_tien}đ)`);
    });
    // Nạp lại sau khi commit để trả về số liệu mới nhất
    return this.chiTietYLenh(id);
  }

  // Danh sách phiếu — lọc theo khoảng thời gian (tu/den) và tìm theo BN, mã phiếu, BS
  async danhSachYLenh(tu?: string, den?: string, q?: string) {
    const qb = this.yl.createQueryBuilder('y')
      .leftJoinAndSelect('y.phieu_kham', 'pk')
      .leftJoinAndSelect('pk.ho_so', 'hs')
      .leftJoinAndSelect('y.nguoi_tao', 'nt')
      .leftJoinAndSelect('y.chi_tiet', 'ct')
      .leftJoinAndSelect('y.lan_thu', 'lt')
      .leftJoinAndSelect('lt.nguoi_thu', 'ltu')
      .orderBy('y.ngay_tao', 'DESC').take(100);
    const parseTs = (v?: string) => { if (!v) return null; const d = new Date(v); return isNaN(d.getTime()) ? null : d; };
    const tuTs = parseTs(tu), denTs = parseTs(den);
    if (tuTs) qb.andWhere('y.ngay_tao >= :tu', { tu: tuTs });
    if (denTs) qb.andWhere('y.ngay_tao <= :den', { den: denTs });
    const kw = (q || '').trim();
    if (kw) qb.andWhere('(pk.ten_bn ILIKE :q OR y.ma_phieu ILIKE :q OR y.bs_dt ILIKE :q)', { q: `%${kw}%` });
    const list = await qb.getMany();
    return list.map((y) => ({
      id: y.id, ma_phieu: y.ma_phieu, ngay_yl: y.ngay_yl, bs_dt: y.bs_dt,
      tong_tien: y.tong_tien, da_nop: y.da_nop, tra_lai: y.tra_lai,
      con_lai: Math.max(0, y.tong_tien - y.da_nop), trang_thai: y.trang_thai, ngay_tao: y.ngay_tao,
      so_dong: y.chi_tiet ? y.chi_tiet.length : 0,
      ten_bn: y.phieu_kham ? y.phieu_kham.ten_bn : null,
      ma_benh_nhan: y.phieu_kham && y.phieu_kham.ho_so ? y.phieu_kham.ho_so.ma_benh_nhan : null,
      nguoi_tao: y.nguoi_tao ? y.nguoi_tao.ho_ten : null,
      nguoi_thu: this.nguoiThuGanNhat(y),
    }));
  }

  async chiTietYLenh(id: number) {
    const y = await this.layChiTiet(id);
    if (!y) throw new NotFoundException('Phiếu y lệnh không tồn tại');
    return this.goiYLenh(y);
  }

  // Người thu tiền của lần thu gần nhất (hiển thị trên phiếu & danh sách)
  private nguoiThuGanNhat(y: PhieuYLenh): string | null {
    const ls = (y.lan_thu || []).slice().sort((a, b) => b.id - a.id);
    return ls.length && ls[0].nguoi_thu ? ls[0].nguoi_thu.ho_ten : null;
  }

  private goiYLenh(y: PhieuYLenh) {
    return {
      id: y.id, ma_phieu: y.ma_phieu, ngay_yl: y.ngay_yl, bs_dt: y.bs_dt, ngay_cdht: y.ngay_cdht,
      tong_tien: y.tong_tien, da_nop: y.da_nop, tra_lai: y.tra_lai,
      con_lai: Math.max(0, y.tong_tien - y.da_nop), trang_thai: y.trang_thai,
      ghi_chu: y.ghi_chu, ngay_tao: y.ngay_tao,
      phieu_kham: y.phieu_kham
        ? { id: y.phieu_kham.id, ten_bn: y.phieu_kham.ten_bn, ma_kcb: y.phieu_kham.ma_kcb,
            so_benh_an: y.phieu_kham.so_benh_an, chan_doan_so_bo: y.phieu_kham.chan_doan_so_bo,
            ma_benh_nhan: y.phieu_kham.ho_so ? y.phieu_kham.ho_so.ma_benh_nhan : null }
        : null,
      nguoi_tao: y.nguoi_tao ? { id: y.nguoi_tao.id, ho_ten: y.nguoi_tao.ho_ten } : null,
      nguoi_thu: this.nguoiThuGanNhat(y),
      chi_tiet: (y.chi_tiet || []).map((c) => ({
        id: c.id, loai: c.loai, ma_vt: c.ma_vt, ten: c.ten, dvt: c.dvt, so_luong: c.so_luong,
        lieu_dung: c.lieu_dung, cach_dung: c.cach_dung, don_gia: c.don_gia, ty_le: c.ty_le, thanh_tien: c.thanh_tien,
      })),
      lan_thu: (y.lan_thu || []).sort((a, b) => a.id - b.id).map((l) => ({
        id: l.id, so_tien: l.so_tien, thoi_gian: l.thoi_gian,
        nguoi_thu: l.nguoi_thu ? l.nguoi_thu.ho_ten : null,
      })),
    };
  }

  // Giá dịch vụ cận lâm sàng dùng cho phiếu viện phí. Ưu tiên giá danh mục nếu
  // chỉ định gắn với dịch vụ có giá; nếu không, dùng giá TẠM THỜI (placeholder)
  // theo loại — sinh tất định từ id để ổn định giữa các lần tải (không đổi ngẫu
  // nhiên mỗi lần mở phiếu). TODO: thay bằng bảng giá dịch vụ thật khi có.
  private giaChiDinh(cd: ChiDinhCLS): number {
    if (cd.dich_vu && cd.dich_vu.gia > 0) return cd.dich_vu.gia;
    const dai: Record<string, [number, number]> = {
      xet_nghiem: [80000, 260000], sieu_am: [150000, 520000], thu_thuat: [300000, 1200000],
    };
    const [min, max] = dai[cd.loai] || [100000, 300000];
    const buoc = 10000;
    const soBuoc = Math.floor((max - min) / buoc) + 1;
    const h = (cd.id * 2654435761) >>> 0; // hash tất định từ id
    return min + (h % soBuoc) * buoc;
  }

  // Chỉ định cận lâm sàng của lần khám gắn với phiếu khám bệnh — trả về dưới dạng
  // các dòng dịch vụ sẵn sàng đưa vào "Chi tiết viện phí" của phiếu y lệnh.
  // Ưu tiên lần khám (lich_hen) liên kết trực tiếp; nếu phiếu khám chỉ gắn bệnh
  // nhân (ho_so), lấy chỉ định của lần khám gần nhất của bệnh nhân đó có CLS.
  async chiDinhTheoPhieuKham(phieuKhamId: number) {
    const pk = await this.pk.findOne({ where: { id: phieuKhamId }, relations: ['lich_hen', 'ho_so'] });
    if (!pk) throw new NotFoundException('Phiếu khám bệnh không tồn tại');
    const clsRepo = this.ds.getRepository(ChiDinhCLS);
    let lich = pk.lich_hen || null;
    if (!lich && pk.ho_so) {
      const gan = await clsRepo.findOne({
        where: { lich_hen: { ho_so: { id: pk.ho_so.id } } },
        relations: ['lich_hen'], order: { id: 'DESC' },
      });
      lich = gan ? gan.lich_hen : null;
    }
    if (!lich) return { lich_hen: null, chi_tiet: [] };
    const ds = await clsRepo.find({
      where: { lich_hen: { id: lich.id } }, relations: ['dich_vu'], order: { id: 'ASC' },
    });
    const chi_tiet = ds.map((cd) => {
      const don_gia = this.giaChiDinh(cd);
      return {
        loai: 'dich_vu', ten: cd.ten_chi_dinh, ma_vt: 'CLS' + cd.id, dvt: 'Lần',
        so_luong: 1, lieu_dung: null, cach_dung: null, don_gia, ty_le: 100,
        thanh_tien: don_gia, loai_cls: cd.loai, trang_thai: cd.trang_thai,
      };
    });
    return { lich_hen: { id: lich.id, ma_lich_hen: lich.ma_lich_hen }, chi_tiet };
  }

  // Đơn thuốc bác sĩ đã kê ở lần khám gắn với phiếu khám bệnh — trả về các dòng
  // thuốc sẵn sàng đưa vào "Chi tiết viện phí", đơn giá điền sẵn từ thẻ kho tủ
  // thuốc (lễ tân vẫn sửa được trên phiếu nếu cần).
  // Chỉ đọc bản JSON do bác sĩ chọn từ danh mục — KHÔNG suy đoán từ đơn chữ cũ.
  async donThuocTheoPhieuKham(phieuKhamId: number) {
    const pk = await this.pk.findOne({ where: { id: phieuKhamId }, relations: ['lich_hen', 'ho_so'] });
    if (!pk) throw new NotFoundException('Phiếu khám bệnh không tồn tại');
    const luotRepo = this.ds.getRepository(LuotKham);
    let luot = pk.lich_hen
      ? await luotRepo.findOne({
          where: { lich_hen: { id: pk.lich_hen.id } }, relations: ['don_thuoc', 'bac_si'], order: { id: 'DESC' },
        })
      : null;
    if (!luot && pk.ho_so) {
      luot = await luotRepo.findOne({
        where: { lich_hen: { ho_so: { id: pk.ho_so.id } } }, relations: ['don_thuoc', 'bac_si'], order: { id: 'DESC' },
      });
    }
    const don = luot && luot.don_thuoc;
    if (!luot || !don || !don.danh_sach_json) return { luot_kham: null, chi_tiet: [] };

    let dong: any[] = [];
    try {
      const parsed = JSON.parse(don.danh_sach_json);
      if (Array.isArray(parsed)) dong = parsed;
    } catch {
      return { luot_kham: null, chi_tiet: [] };  // dữ liệu hỏng thì báo rỗng, không đoán
    }
    // Đơn giá lấy từ thẻ kho của tủ thuốc; mặt hàng chưa có thẻ hoặc chưa đặt
    // giá thì để 0 để lễ tân nhập tay — không suy đoán giá.
    const theKho = await this.ds.getRepository(TonKho).find({ where: { loai: 'thuoc' } });
    const giaKho = new Map(theKho.map((k) => [k.ma, k]));

    const chi_tiet = dong
      .map((t, i) => {
        // Ưu tiên mã danh mục thuốc để lễ tân trừ đúng tủ thuốc; đơn thuốc cũ
        // chưa có mã thì giữ mã tham chiếu lượt khám (dòng không theo dõi tồn).
        const maThuoc = t?.ma_thuoc ? String(t.ma_thuoc) : null;
        const the = maThuoc ? giaKho.get(maThuoc) : undefined;
        const so_luong = Number(t?.so_luong) > 0 ? Number(t.so_luong) : 1;
        const don_gia = the ? the.don_gia : 0;
        return {
          loai: 'thuoc', ten: String(t?.ten || '').trim(),
          ma_vt: maThuoc || `DT${luot!.id}-${i + 1}`,
          dvt: t?.dvt || (the ? the.dvt : null), so_luong,
          lieu_dung: t?.lieu_dung || null, cach_dung: t?.cach_dung || null,
          don_gia, ty_le: 100, thanh_tien: Math.round(so_luong * don_gia),
          ton_kho: the ? the.so_luong : null,
        };
      })
      .filter((d) => d.ten);
    return {
      luot_kham: {
        id: luot.id, thoi_gian: luot.thoi_gian, chan_doan: luot.chan_doan,
        bac_si: luot.bac_si ? luot.bac_si.ho_ten : null,
      },
      chi_tiet,
    };
  }

  // ----- PHIẾU ĐIỀU TRỊ (diễn biến bệnh do bác sĩ ghi) -----
  async themDienBien(userId: number, dto: any) {
    const phieuKhamId = +dto?.phieu_kham_id;
    if (!phieuKhamId) throw new BadRequestException('Cần chọn phiếu khám bệnh của bệnh nhân');
    const dien_bien = String(dto?.dien_bien || '').trim();
    if (!dien_bien) throw new BadRequestException('Diễn biến bệnh không được để trống');
    if (dien_bien.length > 4000) throw new BadRequestException('Diễn biến quá dài');
    const chi_dinh = dto?.chi_dinh ? String(dto.chi_dinh).trim().slice(0, 4000) : null;
    const thoi_diem = dto?.thoi_diem ? String(dto.thoi_diem).trim().slice(0, 100) : null;

    return this.ds.transaction(async (m) => {
      const pk = await m.findOne(PhieuKhamBenh, { where: { id: phieuKhamId } });
      if (!pk) throw new NotFoundException('Phiếu khám bệnh không tồn tại');
      const rec = m.create(DienBienDieuTri, {
        thoi_diem, dien_bien, chi_dinh, phieu_kham: pk, bac_si: { id: userId } as any,
      });
      const saved = await m.save(rec);
      await this.ghiNhatKy(m, userId, 'ghi_dien_bien',
        `Ghi diễn biến điều trị cho ${pk.ten_bn} (phiếu khám #${pk.id})`);
      return this.goiDienBien(saved);
    });
  }

  async danhSachDienBien(phieuKhamId: number) {
    const list = await this.db.find({
      where: { phieu_kham: { id: phieuKhamId } },
      relations: ['bac_si'], order: { id: 'ASC' },
    });
    return list.map((d) => this.goiDienBien(d));
  }

  // Diễn biến điều trị của MỘT bệnh nhân — gộp qua tất cả phiếu khám của hồ sơ.
  async danhSachDienBienTheoHoSo(hoSoId: number) {
    const list = await this.db.createQueryBuilder('d')
      .leftJoinAndSelect('d.bac_si', 'bs')
      .leftJoinAndSelect('d.phieu_kham', 'pk')
      .leftJoin('pk.ho_so', 'hs')
      .where('hs.id = :id', { id: hoSoId })
      .orderBy('d.id', 'DESC')
      .getMany();
    return list.map((d) => ({
      ...this.goiDienBien(d),
      phieu_kham: d.phieu_kham
        ? { id: d.phieu_kham.id, ma_kcb: d.phieu_kham.ma_kcb, chan_doan_so_bo: d.phieu_kham.chan_doan_so_bo }
        : null,
    }));
  }

  private goiDienBien(d: DienBienDieuTri) {
    return {
      id: d.id, thoi_diem: d.thoi_diem, dien_bien: d.dien_bien, chi_dinh: d.chi_dinh, ngay_tao: d.ngay_tao,
      bac_si: d.bac_si ? { id: d.bac_si.id, ho_ten: d.bac_si.ho_ten } : null,
    };
  }
}

@Controller('api')
export class YLenhController {
  constructor(private svc: YLenhService) {}

  // --- Y lệnh: lễ tân lập phiếu viện phí ---
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.ADMIN)
  @Post('reception/y-lenh') taoYLenh(@Request() r, @Body() b) { return this.svc.taoYLenh(r.user.id, b); }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.ADMIN)
  @Get('reception/y-lenh') dsYLenh(@Query('tu') tu: string, @Query('den') den: string, @Query('q') q: string) {
    return this.svc.danhSachYLenh(tu, den, q);
  }

  // Gợi ý chỉ định cận lâm sàng của phiếu khám để đưa vào chi tiết viện phí
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.ADMIN)
  @Get('reception/y-lenh/cls/:phieuKhamId') clsPhieuKham(@Param('phieuKhamId') id: string) {
    return this.svc.chiDinhTheoPhieuKham(+id);
  }

  // Đơn thuốc bác sĩ đã kê ở lần khám — nguồn để lễ tân nạp vào chi tiết viện phí
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.ADMIN)
  @Get('reception/y-lenh/don-thuoc/:phieuKhamId') donThuocPhieuKham(@Param('phieuKhamId') id: string) {
    return this.svc.donThuocTheoPhieuKham(+id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.ADMIN)
  @Get('reception/y-lenh/:id') ctYLenh(@Param('id') id: string) { return this.svc.chiTietYLenh(+id); }

  // Lễ tân xác nhận thu thêm tiền (nộp làm nhiều lần)
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.ADMIN)
  @Post('reception/y-lenh/:id/thu') thuThem(@Request() r, @Param('id') id: string, @Body() b) { return this.svc.thuThem(r.user.id, +id, b); }

  // --- Phiếu điều trị: bác sĩ ghi diễn biến bệnh ---
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.BAC_SI, VaiTro.ADMIN)
  @Post('treatment/progress') themDienBien(@Request() r, @Body() b) { return this.svc.themDienBien(r.user.id, b); }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.BAC_SI, VaiTro.LE_TAN, VaiTro.ADMIN)
  @Get('treatment/progress/:phieuKhamId') dsDienBien(@Param('phieuKhamId') id: string) { return this.svc.danhSachDienBien(+id); }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.BAC_SI, VaiTro.LE_TAN, VaiTro.ADMIN)
  @Get('treatment/progress-by-patient/:hoSoId') dsDienBienHoSo(@Param('hoSoId') id: string) { return this.svc.danhSachDienBienTheoHoSo(+id); }
}
