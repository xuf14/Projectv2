import {
  Injectable, Controller, Get, Post, Patch, Delete, Body, Param, Query, Request, UseGuards,
  BadRequestException, NotFoundException, StreamableFile,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import {
  LichHen, KhungGio, HoSoBenhNhan, LuotKham, DonThuoc, BacSi, NhatKyHoatDong,
  PhieuKhamBenh, NguoiDung, TrangThaiLich, TrangThaiKham, VaiTro,
} from './entities';
import { JwtAuthGuard, RolesGuard, Roles } from './auth';
import { phamViBacSi } from './pham-vi-bac-si';
import { guiThongBao, idQuanTriVien } from './notification.module';

// Một dòng thuốc bác sĩ kê — tên lấy từ danh mục thuốc hoặc gõ tay.
// KHÔNG có đơn giá ở đây: bảng giá do lễ tân nhập khi lập phiếu viện phí.
function chuanDongThuoc(raw: any) {
  const ten = String(raw?.ten || '').trim();
  if (!ten) throw new BadRequestException('Mỗi dòng thuốc phải có tên');
  if (ten.length > 300) throw new BadRequestException('Tên thuốc quá dài');
  const so_luong = Number(raw?.so_luong);
  if (!isFinite(so_luong) || so_luong <= 0 || so_luong > 100000)
    throw new BadRequestException(`Số lượng không hợp lệ ở "${ten}"`);
  const cat = (v: any, n: number) => {
    const s = v === null || v === undefined ? '' : String(v).trim();
    return s ? s.slice(0, n) : null;
  };
  return {
    // Mã danh mục thuốc (nếu bác sĩ chọn từ danh mục) — lễ tân dùng để trừ tủ thuốc
    ma_thuoc: cat(raw?.ma_thuoc, 50), ten, so_luong,
    dvt: cat(raw?.dvt, 50), lieu_dung: cat(raw?.lieu_dung, 200), cach_dung: cat(raw?.cach_dung, 200),
  };
}

// Hẹn tái khám theo khoảng thời gian bác sĩ chọn (VD 10 ngày, 2 tuần).
// Ngày hẹn tính ở SERVER để không phụ thuộc đồng hồ máy trạm.
function hanTaiKham(raw: any): { ngay: string; mo_ta: string } | null {
  if (raw === undefined || raw === null || raw === '') return null;
  const so = Number(raw?.so);
  const donVi = String(raw?.don_vi || 'ngay');
  if (donVi !== 'ngay' && donVi !== 'tuan')
    throw new BadRequestException('Đơn vị hẹn tái khám chỉ nhận "ngay" hoặc "tuan"');
  if (!Number.isInteger(so) || so <= 0)
    throw new BadRequestException('Số ngày/tuần tái khám phải là số nguyên dương');
  const soNgay = donVi === 'tuan' ? so * 7 : so;
  if (soNgay > 365) throw new BadRequestException('Hẹn tái khám tối đa 365 ngày');
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + soNgay);
  return { ngay: d.toLocaleDateString('en-CA'), mo_ta: `${so} ${donVi === 'tuan' ? 'tuần' : 'ngày'}` };
}

// Ngày lọc từ query string: bỏ trống = không lọc, sai định dạng = 400.
// Trả chuỗi YYYY-MM-DD nên so sánh chuỗi cũng đúng thứ tự thời gian.
function chuanNgayLoc(raw: any, nhan: string): string | null {
  if (raw === undefined || raw === null || String(raw).trim() === '') return null;
  const v = String(raw).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(new Date(v).getTime()))
    throw new BadRequestException(`${nhan} không hợp lệ (định dạng YYYY-MM-DD)`);
  return v;
}

@Injectable()
export class ApptService {
  constructor(
    @InjectRepository(LichHen) private lich: Repository<LichHen>,
    @InjectRepository(KhungGio) private slot: Repository<KhungGio>,
    @InjectRepository(HoSoBenhNhan) private hoSo: Repository<HoSoBenhNhan>,
    @InjectRepository(LuotKham) private luot: Repository<LuotKham>,
    @InjectRepository(DonThuoc) private don: Repository<DonThuoc>,
    private ds: DataSource,
  ) {}

  // ----- Đặt lịch (giao dịch để tránh đặt trùng quá slot) -----
  async datLich(userId: number, dto: any) {
    // Bắt buộc id hợp lệ: id null/undefined khiến TypeORM bỏ qua điều kiện
    // và trả về khung giờ ĐẦU TIÊN trong bảng (đặt nhầm lịch cho bác sĩ khác).
    const khungGioId = Number(dto?.khung_gio_id);
    if (!Number.isInteger(khungGioId) || khungGioId <= 0)
      throw new BadRequestException('Thiếu hoặc sai khung giờ (khung_gio_id)');
    return this.ds.transaction(async (m) => {
      const slot = await m.findOne(KhungGio, { where: { id: khungGioId }, relations: ['bac_si', 'bac_si.khoa'] });
      if (!slot) throw new NotFoundException('Khung giờ không tồn tại');
      if (slot.da_dat >= slot.so_luong) throw new BadRequestException('Khung giờ đã hết chỗ');

      // Chỉ dùng hồ sơ thuộc chính người đang đặt lịch.
      // Lưu ý: không được truyền id undefined vào findOne — TypeORM sẽ bỏ qua
      // điều kiện và trả về bản ghi đầu tiên (gắn lịch vào bệnh nhân khác).
      let hoSo = dto.ho_so_id
        ? await m.findOne(HoSoBenhNhan, { where: { id: dto.ho_so_id, nguoi_dung: { id: userId } } })
        : await m.findOne(HoSoBenhNhan, { where: { nguoi_dung: { id: userId } } });
      if (dto.ho_so_id && !hoSo) throw new NotFoundException('Hồ sơ không tồn tại hoặc không thuộc tài khoản này');
      if (!hoSo) {
        // tự tạo hồ sơ nhanh từ thông tin gửi lên
        hoSo = await m.save(m.create(HoSoBenhNhan, {
          ma_benh_nhan: 'BN' + Date.now().toString().slice(-8),
          ho_ten: dto.ho_ten, sdt: dto.sdt, so_bhyt: dto.so_bhyt,
          nguoi_dung: { id: userId } as any,
        }));
      }

      slot.da_dat += 1;
      await m.save(slot);

      const ma = 'BV' + Math.random().toString(36).slice(2, 7).toUpperCase();
      const lich = await m.save(m.create(LichHen, {
        ma_lich_hen: ma, ho_so: hoSo, khung_gio: slot, khoa: slot.bac_si.khoa,
        trang_thai: TrangThaiLich.CHO_XAC_NHAN, so_thu_tu: slot.da_dat,
      }));
      return { ma_lich_hen: ma, so_thu_tu: lich.so_thu_tu, trang_thai: lich.trang_thai, id: lich.id };
    });
  }

  // ----- Lễ tân tạo LỊCH TÁI KHÁM từ hồ sơ bệnh nhân (trang Lịch sử khám) -----
  // Tạo lịch hẹn thật để hiện ở "Tất cả lịch hẹn", đồng thời ghi hẹn tái khám lên
  // hồ sơ và gửi thông báo cho bác sĩ phụ trách + quản trị viên.
  async taoLichTaiKham(userId: number, dto: any) {
    const hoSoId = Number(dto?.ho_so_id);
    const bacSiId = Number(dto?.bac_si_id);
    const ngay = String(dto?.ngay || '').trim();
    const gio = String(dto?.gio || '').trim() || '08:00';
    if (!Number.isInteger(hoSoId) || hoSoId <= 0) throw new BadRequestException('Thiếu hồ sơ bệnh nhân');
    if (!Number.isInteger(bacSiId) || bacSiId <= 0) throw new BadRequestException('Vui lòng chọn bác sĩ tái khám');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ngay) || isNaN(new Date(ngay).getTime()))
      throw new BadRequestException('Ngày tái khám không hợp lệ (định dạng YYYY-MM-DD)');
    if (!/^\d{2}:\d{2}$/.test(gio)) throw new BadRequestException('Giờ tái khám không hợp lệ (định dạng HH:mm)');
    const homNay = new Date().toLocaleDateString('en-CA');
    if (ngay < homNay) throw new BadRequestException('Ngày tái khám không được ở quá khứ');
    const ghiChu = String(dto?.ghi_chu || '').trim().slice(0, 1000);

    const ketQua = await this.ds.transaction(async (m) => {
      const hoSo = await m.findOne(HoSoBenhNhan, { where: { id: hoSoId } });
      if (!hoSo) throw new NotFoundException('Hồ sơ bệnh nhân không tồn tại');
      const bacSi = await m.findOne(BacSi, { where: { id: bacSiId }, relations: ['khoa', 'nguoi_dung'] });
      if (!bacSi) throw new NotFoundException('Bác sĩ không tồn tại');

      // Dùng lại khung giờ sẵn có của bác sĩ trong ngày; chưa có thì tạo mới
      let slot = await m.findOne(KhungGio, {
        where: { ngay, gio_bat_dau: gio, bac_si: { id: bacSiId } },
      });
      if (!slot) {
        const ketThuc = `${String((+gio.slice(0, 2) + 1) % 24).padStart(2, '0')}:${gio.slice(3)}`;
        slot = m.create(KhungGio, {
          ngay, gio_bat_dau: gio, gio_ket_thuc: ketThuc, so_luong: 5, da_dat: 0,
          bac_si: { id: bacSiId } as any,
        });
      }
      if (slot.da_dat >= slot.so_luong) throw new BadRequestException('Khung giờ này của bác sĩ đã kín lịch');
      slot.da_dat += 1;
      await m.save(slot);

      const ma = 'BV' + Math.random().toString(36).slice(2, 7).toUpperCase();
      const lich = await m.save(m.create(LichHen, {
        ma_lich_hen: ma, ho_so: hoSo, khung_gio: slot, khoa: bacSi.khoa,
        trang_thai: TrangThaiLich.DA_XAC_NHAN,   // lễ tân tạo nên đã xác nhận sẵn
        so_thu_tu: slot.da_dat,
      }));

      // Đồng bộ hẹn tái khám trên hồ sơ (nguồn của tab Tái khám & chuông bác sĩ)
      hoSo.ngay_tai_kham = ngay;
      hoSo.ghi_chu_tai_kham = (ghiChu || null) as any;
      hoSo.bac_si_tai_kham = { id: bacSiId } as any;
      await m.save(hoSo);

      const ngayVN = new Date(ngay).toLocaleDateString('vi-VN');
      const noiDung = `Bệnh nhân ${hoSo.ho_ten} (${hoSo.ma_benh_nhan}) tái khám ngày ${ngayVN} lúc ${gio}` +
        ` — mã lịch ${ma}${ghiChu ? `. Ghi chú: ${ghiChu}` : ''}`;
      // Thông báo: bác sĩ phụ trách (nếu có tài khoản) + toàn bộ quản trị viên
      const nguoiNhan = [
        ...(bacSi.nguoi_dung ? [bacSi.nguoi_dung.id] : []),
        ...(await idQuanTriVien(m)),
      ];
      const soThongBao = await guiThongBao(m, nguoiNhan, {
        loai: 'tai_kham', tieu_de: 'Lịch tái khám mới', noi_dung: noiDung, lich_hen_id: lich.id,
      });
      await m.save(m.create(NhatKyHoatDong, {
        hanh_dong: 'tao_lich_tai_kham',
        noi_dung: `Tạo lịch tái khám ${ma} cho ${hoSo.ma_benh_nhan} (${hoSo.ho_ten}) với ${bacSi.ho_ten} ngày ${ngay} ${gio}`,
        nguoi_dung: { id: userId } as any,
      }));
      return {
        id: lich.id, ma_lich_hen: ma, ngay, gio, so_thu_tu: lich.so_thu_tu,
        trang_thai: lich.trang_thai, benh_nhan: hoSo.ho_ten, ma_benh_nhan: hoSo.ma_benh_nhan,
        bac_si: bacSi.ho_ten, khoa: bacSi.khoa ? bacSi.khoa.ten_khoa : null,
        so_thong_bao: soThongBao,
      };
    });
    return ketQua;
  }

  // ----- Lễ tân tạo LỊCH KHÁM MỚI cho bệnh nhân đến khám hôm nay -----
  // Tạo lịch hẹn trong ngày với bác sĩ được chọn, đưa thẳng vào hàng chờ khám
  // (da_checkin) và cấp số thứ tự. Trả về id để lễ tân đính kèm tài liệu điều
  // trị ngoại trú (nếu bệnh nhân mang từ nơi khác đến).
  async taoLichKhamMoi(userId: number, dto: any) {
    const hoSoId = Number(dto?.ho_so_id);
    const bacSiId = Number(dto?.bac_si_id);
    if (!Number.isInteger(hoSoId) || hoSoId <= 0) throw new BadRequestException('Thiếu hồ sơ bệnh nhân');
    if (!Number.isInteger(bacSiId) || bacSiId <= 0) throw new BadRequestException('Vui lòng chọn bác sĩ khám');
    const homNay = new Date().toLocaleDateString('en-CA');
    const ngay = String(dto?.ngay || '').trim() || homNay;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ngay) || isNaN(new Date(ngay).getTime()))
      throw new BadRequestException('Ngày khám không hợp lệ (định dạng YYYY-MM-DD)');
    if (ngay < homNay) throw new BadRequestException('Ngày khám không được ở quá khứ');
    const gio = String(dto?.gio || '').trim() || '08:00';
    if (!/^\d{2}:\d{2}$/.test(gio)) throw new BadRequestException('Giờ khám không hợp lệ (định dạng HH:mm)');

    return this.ds.transaction(async (m) => {
      const hoSo = await m.findOne(HoSoBenhNhan, { where: { id: hoSoId } });
      if (!hoSo) throw new NotFoundException('Hồ sơ bệnh nhân không tồn tại');
      const bacSi = await m.findOne(BacSi, { where: { id: bacSiId }, relations: ['khoa'] });
      if (!bacSi) throw new NotFoundException('Bác sĩ không tồn tại');

      let slot = await m.findOne(KhungGio, { where: { ngay, gio_bat_dau: gio, bac_si: { id: bacSiId } } });
      if (!slot) {
        const ketThuc = `${String((+gio.slice(0, 2) + 1) % 24).padStart(2, '0')}:${gio.slice(3)}`;
        slot = m.create(KhungGio, {
          ngay, gio_bat_dau: gio, gio_ket_thuc: ketThuc, so_luong: 5, da_dat: 0,
          bac_si: { id: bacSiId } as any,
        });
      }
      if (slot.da_dat >= slot.so_luong) throw new BadRequestException('Khung giờ này của bác sĩ đã kín lịch');
      slot.da_dat += 1;
      await m.save(slot);

      const ma = 'BV' + Math.random().toString(36).slice(2, 7).toUpperCase();
      const lich = await m.save(m.create(LichHen, {
        ma_lich_hen: ma, ho_so: hoSo, khung_gio: slot, khoa: bacSi.khoa,
        trang_thai: TrangThaiLich.DA_CHECKIN,   // bệnh nhân đã đến → vào hàng chờ khám
        so_thu_tu: slot.da_dat,
      }));
      await m.save(m.create(NhatKyHoatDong, {
        hanh_dong: 'tao_lich_kham_moi',
        noi_dung: `Tạo lịch khám mới ${ma} cho ${hoSo.ma_benh_nhan} (${hoSo.ho_ten}) với ${bacSi.ho_ten} ngày ${ngay} ${gio}`,
        nguoi_dung: { id: userId } as any,
      }));
      return {
        id: lich.id, ma_lich_hen: ma, ngay, gio, so_thu_tu: lich.so_thu_tu, trang_thai: lich.trang_thai,
        benh_nhan: hoSo.ho_ten, ma_benh_nhan: hoSo.ma_benh_nhan,
        bac_si: bacSi.ho_ten, khoa: bacSi.khoa ? bacSi.khoa.ten_khoa : null,
      };
    });
  }

  async lichCuaToi(userId: number) {
    return this.lich.find({
      where: { ho_so: { nguoi_dung: { id: userId } } },
      order: { ngay_tao: 'DESC' },
    });
  }

  async huyLich(userId: number, id: number) {
    const lich = await this.lich.findOne({ where: { id }, relations: ['khung_gio', 'ho_so', 'ho_so.nguoi_dung'] });
    if (!lich) throw new NotFoundException('Không tìm thấy lịch hẹn');
    if (lich.ho_so.nguoi_dung?.id !== userId) throw new BadRequestException('Không thể hủy lịch của người khác');
    lich.trang_thai = TrangThaiLich.DA_HUY;
    await this.lich.save(lich);
    const slot = lich.khung_gio;
    if (slot.da_dat > 0) { slot.da_dat -= 1; await this.slot.save(slot); }
    return { message: 'Đã hủy lịch hẹn', ma_lich_hen: lich.ma_lich_hen };
  }

  // Xóa hẳn lịch hẹn khỏi database — chỉ cho phép với lịch đã hủy của chính mình
  async xoaLich(userId: number, id: number) {
    const lich = await this.lich.findOne({ where: { id }, relations: ['ho_so', 'ho_so.nguoi_dung'] });
    if (!lich) throw new NotFoundException('Không tìm thấy lịch hẹn');
    if (lich.ho_so.nguoi_dung?.id !== userId) throw new BadRequestException('Không thể xóa lịch của người khác');
    if (lich.trang_thai !== TrangThaiLich.DA_HUY) throw new BadRequestException('Chỉ xóa được lịch hẹn đã hủy');
    await this.lich.delete(id);
    return { message: 'Đã xóa lịch hẹn', ma_lich_hen: lich.ma_lich_hen };
  }

  // ----- Tiếp đón: tra cứu + check-in -----
  // Tra cứu tiếp đón theo mã LỊCH HẸN hoặc mã BỆNH NHÂN (không phân biệt hoa/thường).
  // Một bệnh nhân có thể có nhiều lịch hẹn → trả về danh sách (mới nhất trước).
  async traCuu(ma: string) {
    const key = (ma || '').trim();
    if (!key) return [];
    return this.lich.createQueryBuilder('lh')
      .leftJoinAndSelect('lh.ho_so', 'hs')
      .leftJoinAndSelect('lh.khung_gio', 'kg')
      .leftJoinAndSelect('kg.bac_si', 'bs')
      .leftJoinAndSelect('lh.khoa', 'k')
      .where('lh.ma_lich_hen ILIKE :key OR hs.ma_benh_nhan ILIKE :key', { key })
      .orderBy('kg.ngay', 'DESC').addOrderBy('kg.gio_bat_dau', 'ASC')
      .take(50).getMany();
  }

  // Toàn bộ lịch hẹn cho lễ tân (không giới hạn hôm nay). Lọc theo trạng thái,
  // theo khoảng ngày khám và tìm theo tên/mã BN/mã lịch. Sắp theo ngày mới nhất.
  async tatCaLichHen(trangThai?: string, q?: string, tu?: string, den?: string) {
    const tuNgay = chuanNgayLoc(tu, 'Ngày bắt đầu');
    const denNgay = chuanNgayLoc(den, 'Ngày kết thúc');
    if (tuNgay && denNgay && tuNgay > denNgay)
      throw new BadRequestException('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc');

    const qb = this.lich.createQueryBuilder('lh')
      .leftJoinAndSelect('lh.ho_so', 'hs')
      .leftJoinAndSelect('lh.khung_gio', 'kg')
      .leftJoinAndSelect('kg.bac_si', 'bs')
      .leftJoinAndSelect('lh.khoa', 'k')
      .orderBy('kg.ngay', 'DESC')
      .addOrderBy('kg.gio_bat_dau', 'ASC')
      .take(200);
    const TT = Object.values(TrangThaiLich) as string[];
    if (trangThai && TT.includes(trangThai)) qb.andWhere('lh.trang_thai = :tt', { tt: trangThai });
    if (q && q.trim())
      qb.andWhere('(hs.ho_ten ILIKE :q OR hs.ma_benh_nhan ILIKE :q OR lh.ma_lich_hen ILIKE :q)', { q: `%${q.trim()}%` });
    if (tuNgay) qb.andWhere('kg.ngay >= :tuNgay', { tuNgay });
    if (denNgay) qb.andWhere('kg.ngay <= :denNgay', { denNgay });
    return qb.getMany();
  }

  // Lễ tân xác nhận lịch hẹn: chờ xác nhận → đã xác nhận
  async xacNhanLich(id: number) {
    const lich = await this.lich.findOneBy({ id });
    if (!lich) throw new NotFoundException('Không tìm thấy lịch hẹn');
    if (lich.trang_thai === TrangThaiLich.DA_HUY) throw new BadRequestException('Lịch hẹn đã bị hủy, không thể xác nhận');
    if (lich.trang_thai !== TrangThaiLich.CHO_XAC_NHAN) throw new BadRequestException('Lịch hẹn đã được xác nhận hoặc đã xử lý');
    lich.trang_thai = TrangThaiLich.DA_XAC_NHAN;
    return this.lich.save(lich);
  }

  // Lịch hẹn trong ngày hôm nay (chưa hủy, chưa khám xong) cho màn hình tiếp đón
  // Lịch hẹn của một ngày (mặc định hôm nay) — lễ tân chọn ngày để xem/check-in.
  // Trả mọi trạng thái để ngày đã qua vẫn xem được lịch đã khám / đã hủy.
  lichTheoNgay(ngayChon?: string) {
    let ngay: string;
    if (ngayChon !== undefined && ngayChon !== null && ngayChon !== '') {
      const v = String(ngayChon).trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(new Date(v).getTime()))
        throw new BadRequestException('Ngày không hợp lệ (định dạng YYYY-MM-DD)');
      ngay = v;
    } else {
      const d = new Date();
      ngay = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    return this.lich.find({
      where: { khung_gio: { ngay } },
      order: { so_thu_tu: 'ASC', id: 'ASC' },
    });
  }
  async checkin(id: number) {
    const lich = await this.lich.findOneBy({ id });
    if (!lich) throw new NotFoundException('Không tìm thấy lịch hẹn');
    if (lich.trang_thai === TrangThaiLich.DA_HUY) throw new BadRequestException('Lịch hẹn đã bị hủy, không thể check-in');
    if (lich.trang_thai === TrangThaiLich.DA_KHAM) throw new BadRequestException('Lịch hẹn đã khám xong');
    if (lich.trang_thai === TrangThaiLich.DA_CHECKIN) return lich; // đã check-in rồi thì trả nguyên trạng
    lich.trang_thai = TrangThaiLich.DA_CHECKIN;
    return this.lich.save(lich);
  }

  // Phạm vi dữ liệu theo vai trò: bác sĩ chỉ thấy bệnh nhân của mình; tài khoản
  // bác sĩ chưa gắn hồ sơ bác sĩ bị từ chối thay vì được xem toàn bộ (xem pham-vi-bac-si.ts).
  private bacSiCuaUser(user: any) {
    return phamViBacSi(this.ds, user);
  }

  // Số liệu hôm nay cho trang tổng quan — chỉ đếm lịch của chính bác sĩ đó
  async tongQuanHomNay(user: any) {
    const d = new Date();
    const ngay = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const { bs } = await this.bacSiCuaUser(user);
    const khungGio = bs ? { ngay, bac_si: { id: bs.id } } : { ngay };
    const [homNay, choKham, daKham] = await Promise.all([
      this.lich.count({ where: { khung_gio: khungGio } }),
      this.lich.count({ where: { khung_gio: khungGio, trang_thai: TrangThaiLich.DA_CHECKIN } }),
      this.lich.count({ where: { khung_gio: khungGio, trang_thai: TrangThaiLich.DA_KHAM } }),
    ]);
    return { hom_nay: homNay, cho_kham: choKham, da_kham: daKham, bac_si: bs ? bs.ho_ten : null };
  }

  // ----- Bác sĩ: hàng chờ + ghi kết quả -----
  async hangCho(user: any) {
    const { bs } = await this.bacSiCuaUser(user);
    return this.lich.find({
      where: {
        trang_thai: TrangThaiLich.DA_CHECKIN,
        ...(bs ? { khung_gio: { bac_si: { id: bs.id } } } : {}),
      },
      order: { so_thu_tu: 'ASC' },
    });
  }

  // Lịch khám sắp tới của bác sĩ đang đăng nhập (hôm nay trở đi, chưa hủy/chưa khám).
  // Nguồn gồm cả lịch do lễ tân xác nhận từ phiếu đăng ký khám online.
  async lichSapToi(user: any) {
    const { bs } = await this.bacSiCuaUser(user);
    const homNay = new Date().toLocaleDateString('en-CA');
    const qb = this.lich.createQueryBuilder('lh')
      .leftJoinAndSelect('lh.ho_so', 'hs')
      .leftJoinAndSelect('lh.khung_gio', 'kg')
      .leftJoinAndSelect('kg.bac_si', 'bs')
      .leftJoinAndSelect('lh.khoa', 'k')
      .where('kg.ngay >= :ngay', { ngay: homNay })
      .andWhere('lh.trang_thai IN (:...tt)', {
        tt: [TrangThaiLich.CHO_XAC_NHAN, TrangThaiLich.DA_XAC_NHAN, TrangThaiLich.DA_CHECKIN],
      })
      .orderBy('kg.ngay', 'ASC').addOrderBy('kg.gio_bat_dau', 'ASC')
      .take(100);
    if (bs) qb.andWhere('bs.id = :bsId', { bsId: bs.id });
    const list = await qb.getMany();
    return list.map((l) => ({
      id: l.id, ma_lich_hen: l.ma_lich_hen, trang_thai: l.trang_thai, so_thu_tu: l.so_thu_tu,
      ngay: l.khung_gio ? l.khung_gio.ngay : null,
      gio: l.khung_gio ? l.khung_gio.gio_bat_dau : null,
      bac_si: l.khung_gio && l.khung_gio.bac_si ? l.khung_gio.bac_si.ho_ten : null,
      khoa: l.khoa ? l.khoa.ten_khoa : null,
      ho_so_id: l.ho_so ? l.ho_so.id : null,
      benh_nhan: l.ho_so ? l.ho_so.ho_ten : null,
      ma_benh_nhan: l.ho_so ? l.ho_so.ma_benh_nhan : null,
      ngay_sinh: l.ho_so ? l.ho_so.ngay_sinh : null,
      sdt: l.ho_so ? l.ho_so.sdt : null,
    }));
  }

  // Bác sĩ lưu kết quả khám. MỘT transaction ghi trọn gói:
  //  1) lượt khám + đơn thuốc (kèm bản JSON để lễ tân nạp vào chi tiết viện phí),
  //  2) cập nhật phiếu khám bệnh — "Thông tin khám bệnh" mà lễ tân đang xem,
  //  3) hẹn tái khám: sinh lịch hẹn thật nên bệnh nhân hiện luôn trong danh sách
  //     check-in của lễ tân đúng ngày hẹn.
  async ghiKetQua(lichId: number, user: any, dto: any) {
    const lich = await this.lich.findOne({
      where: { id: lichId }, relations: ['khung_gio', 'khung_gio.bac_si', 'ho_so'],
    });
    if (!lich) throw new NotFoundException('Không tìm thấy lịch hẹn');
    // Ghi theo bác sĩ đang đăng nhập; admin ghi hộ thì lấy bác sĩ của khung giờ.
    // Không đoán bừa một id nào khác — kết quả khám phải gắn đúng người thực hiện.
    const { bs } = await this.bacSiCuaUser(user);
    const bacSiId = (bs && bs.id) || (lich.khung_gio && lich.khung_gio.bac_si && lich.khung_gio.bac_si.id);
    if (!bacSiId) throw new BadRequestException('Không xác định được bác sĩ thực hiện lần khám này');

    const thuoc = Array.isArray(dto?.thuoc) ? dto.thuoc.map(chuanDongThuoc) : [];
    if (thuoc.length > 100) throw new BadRequestException('Quá nhiều dòng thuốc trong một đơn');
    const hen = hanTaiKham(dto?.tai_kham);

    return this.ds.transaction(async (m) => {
      const bacSi = await m.findOne(BacSi, { where: { id: bacSiId }, relations: ['khoa', 'nguoi_dung'] });
      if (!bacSi) throw new NotFoundException('Bác sĩ không tồn tại');

      const luot = await m.save(m.create(LuotKham, {
        lich_hen: lich, bac_si: { id: bacSiId } as any,
        chan_doan: dto.chan_doan, chi_dinh: dto.chi_dinh, ghi_chu: dto.ghi_chu,
        trang_thai: TrangThaiKham.HOAN_THANH,
      }));

      // Đơn thuốc: bản chữ để hiển thị + bản JSON để lễ tân nạp vào viện phí.
      // Vẫn nhận don_thuoc dạng chữ của luồng cũ khi bác sĩ không chọn danh mục.
      const banChu = thuoc.length
        ? thuoc.map((t) =>
            `${t.ten} · SL ${t.so_luong}${t.dvt ? ` ${t.dvt}` : ''}` +
            `${t.lieu_dung ? ` · ${t.lieu_dung}` : ''}${t.cach_dung ? ` · ${t.cach_dung}` : ''}`).join('\n')
        : String(dto?.don_thuoc || '').trim();
      if (banChu) {
        await m.save(m.create(DonThuoc, {
          luot_kham: luot, danh_sach_thuoc: banChu, lieu_dung: dto.lieu_dung,
          danh_sach_json: thuoc.length ? JSON.stringify(thuoc) : null,
        }));
      }

      lich.trang_thai = TrangThaiLich.DA_KHAM;
      await m.save(lich);

      const hoSo = lich.ho_so || null;
      const phieuKham = await this.capNhatPhieuKham(m, lich, hoSo, bacSi, dto, user.id);

      let taiKham: { id: number; ma_lich_hen: string; ngay: string; gio: string; mo_ta: string } | null = null;
      if (hen) {
        if (!hoSo) throw new BadRequestException('Lịch hẹn chưa gắn hồ sơ bệnh nhân nên không đặt được lịch tái khám');
        taiKham = await this.datLichTaiKham(m, hoSo, bacSi, hen, String(dto?.ghi_chu || ''));
        // Lễ tân là người check-in bệnh nhân ngày hẹn nên phải nhận thông báo
        const leTan = await m.find(NguoiDung, { where: { vai_tro: VaiTro.LE_TAN }, select: ['id'] });
        await guiThongBao(m, [...leTan.map((u) => u.id), ...(await idQuanTriVien(m))], {
          loai: 'tai_kham', tieu_de: 'Lịch tái khám mới do bác sĩ hẹn',
          noi_dung: `${bacSi.ho_ten} hẹn ${hoSo.ho_ten} (${hoSo.ma_benh_nhan}) tái khám sau ${hen.mo_ta}` +
            ` — ngày ${new Date(hen.ngay).toLocaleDateString('vi-VN')} lúc ${taiKham.gio}, mã lịch ${taiKham.ma_lich_hen}`,
          lich_hen_id: taiKham.id,
        });
      }

      await m.save(m.create(NhatKyHoatDong, {
        hanh_dong: 'ghi_ket_qua_kham',
        noi_dung: `Ghi kết quả khám lịch ${lich.ma_lich_hen}` +
          (thuoc.length ? ` — kê ${thuoc.length} thuốc` : '') +
          (taiKham ? ` — hẹn tái khám ${taiKham.ngay}` : ''),
        nguoi_dung: { id: user.id } as any,
      }));

      return {
        message: 'Đã lưu kết quả khám',
        luot_kham_id: luot.id,
        phieu_kham_id: phieuKham ? phieuKham.id : null,
        so_thuoc: thuoc.length,
        tai_kham: taiKham,
      };
    });
  }

  // Cập nhật "Thông tin khám bệnh" (phiếu khám của lễ tân) từ kết quả bác sĩ vừa ghi.
  // Ưu tiên phiếu gắn đúng lần khám, sau đó phiếu gần nhất của bệnh nhân; chưa có
  // thì lập phiếu mới để lễ tân luôn thấy được thông tin. Chỉ ghi đè ô bác sĩ có
  // nhập — không xóa dữ liệu lễ tân đã nhập trước đó.
  private async capNhatPhieuKham(
    m: any, lich: LichHen, hoSo: HoSoBenhNhan | null, bacSi: BacSi, dto: any, userId: number,
  ) {
    let phieu: PhieuKhamBenh | null = await m.findOne(PhieuKhamBenh, {
      where: { lich_hen: { id: lich.id } }, relations: ['lich_hen'], order: { id: 'DESC' },
    });
    if (!phieu && hoSo) {
      phieu = await m.findOne(PhieuKhamBenh, {
        where: { ho_so: { id: hoSo.id } }, relations: ['lich_hen'], order: { id: 'DESC' },
      });
    }
    if (!phieu) {
      if (!hoSo) return null;  // không có hồ sơ bệnh nhân thì không đủ dữ liệu lập phiếu
      phieu = m.create(PhieuKhamBenh, {
        ten_bn: hoSo.ho_ten, gioi_tinh: hoSo.gioi_tinh, ngay_sinh: hoSo.ngay_sinh,
        dia_chi: hoSo.dia_chi, so_the: hoSo.so_bhyt, ho_so: hoSo, lich_hen: lich,
        nguoi_tao: { id: userId } as any,   // bác sĩ lập phiếu khi lễ tân chưa có phiếu
      });
    }
    const cat = (v: any) => String(v ?? '').trim().slice(0, 2000);
    const chanDoan = cat(dto?.chan_doan);
    const chiDinh = cat(dto?.chi_dinh);
    const ghiChu = cat(dto?.ghi_chu);
    if (!phieu.lich_hen) phieu.lich_hen = lich;
    phieu.ngay_kham = new Date().toLocaleDateString('en-CA');
    phieu.bs_kham = bacSi.ho_ten;
    if (!phieu.chuyen_khoa && bacSi.khoa) phieu.chuyen_khoa = bacSi.khoa.ten_khoa;
    if (chanDoan) phieu.chan_doan_so_bo = chanDoan;
    if (chiDinh) phieu.ghi_chu_kb = chiDinh;
    if (ghiChu) phieu.ket_luan = ghiChu;
    return m.save(phieu);
  }

  // Sinh lịch hẹn tái khám thật (khung giờ + lịch hẹn đã xác nhận) để bệnh nhân
  // xuất hiện trong danh sách check-in của lễ tân đúng ngày hẹn, đồng thời ghi
  // hẹn lên hồ sơ (nguồn của tab Tái khám & chuông bác sĩ).
  // Public vì bước 5 (encounter.module) cũng hẹn tái khám theo đúng cách này.
  async datLichTaiKham(
    m: any, hoSo: HoSoBenhNhan, bacSi: BacSi, hen: { ngay: string; mo_ta: string }, ghiChu: string,
  ) {
    const gio = '08:00';
    let slot = await m.findOne(KhungGio, {
      where: { ngay: hen.ngay, gio_bat_dau: gio, bac_si: { id: bacSi.id } },
    });
    if (!slot) {
      slot = m.create(KhungGio, {
        ngay: hen.ngay, gio_bat_dau: gio, gio_ket_thuc: '09:00', so_luong: 5, da_dat: 0,
        bac_si: { id: bacSi.id } as any,
      });
    }
    if (slot.da_dat >= slot.so_luong)
      throw new BadRequestException(`Khung giờ ${gio} ngày ${hen.ngay} của bác sĩ đã kín lịch — chọn khoảng tái khám khác`);
    slot.da_dat += 1;
    await m.save(slot);

    const ma = 'BV' + Math.random().toString(36).slice(2, 7).toUpperCase();
    const lich = await m.save(m.create(LichHen, {
      ma_lich_hen: ma, ho_so: hoSo, khung_gio: slot, khoa: bacSi.khoa,
      trang_thai: TrangThaiLich.DA_XAC_NHAN, so_thu_tu: slot.da_dat,
    }));
    hoSo.ngay_tai_kham = hen.ngay;
    hoSo.ghi_chu_tai_kham = (ghiChu.trim().slice(0, 1000) || null) as any;
    hoSo.bac_si_tai_kham = { id: bacSi.id } as any;
    await m.save(hoSo);
    return { id: lich.id, ma_lich_hen: ma, ngay: hen.ngay, gio, mo_ta: hen.mo_ta };
  }

  lichSuKham(hoSoId: number) {
    return this.luot.find({
      where: { lich_hen: { ho_so: { id: hoSoId } } },
      relations: ['lich_hen', 'don_thuoc'],
      order: { thoi_gian: 'DESC' },
    });
  }

  // Danh sách hồ sơ bệnh nhân kèm tổng số lượt đặt lịch.
  // q (tùy chọn): tìm theo tên, mã bệnh nhân hoặc số điện thoại.
  danhSachHoSo(q?: string) {
    const qb = this.hoSo
      .createQueryBuilder('hs')
      // QueryBuilder không tự nạp quan hệ — join tường minh bác sĩ mong muốn + khoa
      .leftJoinAndSelect('hs.bac_si_mong_muon', 'bsmm')
      .leftJoinAndSelect('bsmm.khoa', 'bsmm_khoa')
      .leftJoinAndSelect('hs.bac_si_tai_kham', 'bstk')
      .loadRelationCountAndMap('hs.so_luot_dat', 'hs.lich_hen')
      .orderBy('hs.id', 'DESC');
    if (q && q.trim()) {
      qb.where('(hs.ho_ten ILIKE :q OR hs.ma_benh_nhan ILIKE :q OR hs.sdt LIKE :q)', { q: `%${q.trim()}%` });
    }
    return qb.getMany();
  }

  // Toàn bộ lịch hẹn của một hồ sơ — nguồn cho calendar ở trang Hồ sơ bệnh nhân
  lichCuaHoSo(hoSoId: number) {
    return this.lich.find({ where: { ho_so: { id: hoSoId } }, order: { id: 'DESC' } });
  }

  // Xuất báo cáo CSV (mở được bằng Excel) từ dữ liệu thật trong database:
  // tổng quan, thống kê theo khoa, theo bác sĩ và danh sách lịch hẹn chi tiết
  async xuatBaoCao() {
    const csvCell = (v: any) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const row = (...cells: any[]) => cells.map(csvCell).join(',');

    const tong = await this.baoCao();
    const theoKhoa = await this.lich.createQueryBuilder('lh')
      .leftJoin('lh.khoa', 'k')
      .select(`COALESCE(k.ten_khoa, '(không rõ)')`, 'khoa')
      .addSelect('COUNT(*)', 'tong')
      .addSelect(`SUM(CASE WHEN lh.trang_thai = 'da_kham' THEN 1 ELSE 0 END)`, 'da_kham')
      .addSelect(`SUM(CASE WHEN lh.trang_thai = 'da_huy' THEN 1 ELSE 0 END)`, 'da_huy')
      .groupBy('k.ten_khoa').orderBy('k.ten_khoa').getRawMany();
    const theoBacSi = await this.lich.createQueryBuilder('lh')
      .leftJoin('lh.khung_gio', 'kg').leftJoin('kg.bac_si', 'bs')
      .select(`COALESCE(bs.ho_ten, '(không rõ)')`, 'bac_si')
      .addSelect('COUNT(*)', 'tong')
      .addSelect(`SUM(CASE WHEN lh.trang_thai = 'da_kham' THEN 1 ELSE 0 END)`, 'da_kham')
      .groupBy('bs.ho_ten').orderBy('bs.ho_ten').getRawMany();
    const chiTiet = await this.lich.find({ order: { id: 'ASC' } }); // eager: ho_so, khung_gio, khoa

    const lines: string[] = [];
    lines.push(row('BÁO CÁO HOẠT ĐỘNG KHÁM CHỮA BỆNH — BV PHỤ SẢN HẢI PHÒNG'));
    lines.push(row('Xuất lúc', new Date().toLocaleString('vi-VN')));
    lines.push('');
    lines.push(row('TỔNG QUAN'));
    lines.push(row('Tổng lượt đặt', tong.tong_luot_dat));
    lines.push(row('Đã khám', tong.da_kham));
    lines.push(row('Đã hủy', tong.da_huy));
    lines.push(row('Tỷ lệ đến khám (%)', tong.ty_le_den_kham));
    lines.push('');
    lines.push(row('THEO KHOA'));
    lines.push(row('Khoa', 'Tổng lượt đặt', 'Đã khám', 'Đã hủy'));
    for (const k of theoKhoa) lines.push(row(k.khoa, k.tong, k.da_kham, k.da_huy));
    lines.push('');
    lines.push(row('THEO BÁC SĨ'));
    lines.push(row('Bác sĩ', 'Tổng lượt đặt', 'Đã khám'));
    for (const b of theoBacSi) lines.push(row(b.bac_si, b.tong, b.da_kham));
    lines.push('');
    lines.push(row('CHI TIẾT LỊCH HẸN'));
    lines.push(row('Mã lịch hẹn', 'Bệnh nhân', 'Mã BN', 'Khoa', 'Bác sĩ', 'Ngày khám', 'Giờ', 'STT', 'Trạng thái', 'Ngày tạo'));
    for (const l of chiTiet) {
      lines.push(row(
        l.ma_lich_hen,
        l.ho_so ? l.ho_so.ho_ten : '', l.ho_so ? l.ho_so.ma_benh_nhan : '',
        l.khoa ? l.khoa.ten_khoa : '',
        l.khung_gio && l.khung_gio.bac_si ? l.khung_gio.bac_si.ho_ten : '',
        l.khung_gio ? l.khung_gio.ngay : '', l.khung_gio ? l.khung_gio.gio_bat_dau : '',
        l.so_thu_tu || '', l.trang_thai,
        l.ngay_tao ? new Date(l.ngay_tao).toLocaleString('vi-VN') : '',
      ));
    }
    // BOM để Excel nhận đúng tiếng Việt UTF-8
    return Buffer.from('﻿' + lines.join('\r\n'), 'utf8');
  }

  // ----- Báo cáo (admin) -----
  async baoCao() {
    const tong = await this.lich.count();
    const daKham = await this.lich.count({ where: { trang_thai: TrangThaiLich.DA_KHAM } });
    const daHuy = await this.lich.count({ where: { trang_thai: TrangThaiLich.DA_HUY } });
    return {
      tong_luot_dat: tong,
      da_kham: daKham,
      da_huy: daHuy,
      ty_le_den_kham: tong ? Math.round((daKham / tong) * 100) : 0,
    };
  }
}

@Controller('api')
export class ApptController {
  constructor(private svc: ApptService) {}

  // Tiếp đón
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.ADMIN)
  @Get('reception/today') lichHomNay(@Query('ngay') ngay?: string) { return this.svc.lichTheoNgay(ngay); }
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.ADMIN)
  @Get('reception/lookup/:ma') traCuu(@Param('ma') ma) { return this.svc.traCuu(ma); }
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.ADMIN)
  @Post('reception/checkin/:id') checkin(@Param('id') id) { return this.svc.checkin(+id); }
  // Lễ tân xem tất cả lịch hẹn + xác nhận
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.ADMIN)
  @Get('reception/appointments') tatCaLich(
    @Query('trang_thai') tt?: string,
    @Query('q') q?: string,
    @Query('tu') tu?: string,
    @Query('den') den?: string,
  ) { return this.svc.tatCaLichHen(tt, q, tu, den); }
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.ADMIN)
  @Post('reception/confirm/:id') xacNhan(@Param('id') id) { return this.svc.xacNhanLich(+id); }
  // Tạo lịch tái khám từ hồ sơ bệnh nhân (trang Lịch sử khám) — sinh lịch hẹn thật
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.ADMIN)
  @Post('reception/revisit-appointments') taoTaiKham(@Request() r, @Body() b) {
    return this.svc.taoLichTaiKham(r.user.id, b);
  }
  // Tạo lịch khám mới cho bệnh nhân đến khám hôm nay (vào hàng chờ khám)
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.ADMIN)
  @Post('reception/new-exam') taoKhamMoi(@Request() r, @Body() b) {
    return this.svc.taoLichKhamMoi(r.user.id, b);
  }

  // Bác sĩ
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.BAC_SI, VaiTro.ADMIN)
  @Get('queue') hangCho(@Request() r) { return this.svc.hangCho(r.user); }
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.BAC_SI, VaiTro.ADMIN)
  @Get('doctor/summary') tongQuan(@Request() r) { return this.svc.tongQuanHomNay(r.user); }
  // Lịch khám sắp tới của chính bác sĩ (gồm lịch từ đăng ký khám online)
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.BAC_SI, VaiTro.ADMIN)
  @Get('doctor/upcoming') lichSapToi(@Request() r) { return this.svc.lichSapToi(r.user); }
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.BAC_SI, VaiTro.ADMIN)
  @Post('visits/:id/result') ghi(@Request() r, @Param('id') id, @Body() b) { return this.svc.ghiKetQua(+id, r.user, b); }
  // Lịch sử khám của một hồ sơ — chỉ nhân viên y tế được xem
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.BAC_SI, VaiTro.LE_TAN, VaiTro.ADMIN)
  @Get('records/:hoSoId') lichSu(@Param('hoSoId') id) { return this.svc.lichSuKham(+id); }

  // Hồ sơ bệnh nhân (bác sĩ, lễ tân, admin) — hỗ trợ ?q= tìm theo tên/mã BN/SĐT
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.BAC_SI, VaiTro.LE_TAN, VaiTro.ADMIN)
  @Get('patients') danhSachHoSo(@Query('q') q?: string) { return this.svc.danhSachHoSo(q); }
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.BAC_SI, VaiTro.LE_TAN, VaiTro.ADMIN)
  @Get('patients/:id/appointments') lichHoSo(@Param('id') id) { return this.svc.lichCuaHoSo(+id); }

  // Admin
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.ADMIN)
  @Get('admin/reports') baoCao() { return this.svc.baoCao(); }
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.ADMIN)
  @Get('admin/reports/export') async xuatBaoCao() {
    const ngay = new Date().toISOString().slice(0, 10);
    return new StreamableFile(await this.svc.xuatBaoCao(), {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(`bao-cao-${ngay}.csv`)}`,
    });
  }
}
