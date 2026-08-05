import {
  Injectable, Controller, Get, Post, Patch, Body, Param, Query, Request, UseGuards,
  BadRequestException, NotFoundException, ForbiddenException, StreamableFile,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  ThanhToan, ChiTietThanhToan, LichHen, DichVu, NhatKyHoatDong, HoSoBenhNhan,
  PhieuYLenh, LanThuTienYLenh,
  TrangThaiThanhToan, TrangThaiLich, VaiTro,
} from './entities';
import { JwtAuthGuard, RolesGuard, Roles } from './auth';

const laNhanVien = (vaiTro: string) =>
  [VaiTro.LE_TAN, VaiTro.ADMIN].includes(vaiTro as VaiTro);

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(ThanhToan) private tt: Repository<ThanhToan>,
    @InjectRepository(LichHen) private lich: Repository<LichHen>,
    @InjectRepository(DichVu) private dichVu: Repository<DichVu>,
    // Tiền viện phí đến từ HAI nguồn: hóa đơn dịch vụ và phiếu y lệnh. Sổ thu và
    // danh sách thanh toán phải gộp cả hai, nếu không lễ tân thu ở mục Y lệnh mà
    // sổ thu trong ngày lại thiếu tiền.
    @InjectRepository(PhieuYLenh) private yLenh: Repository<PhieuYLenh>,
    @InjectRepository(LanThuTienYLenh) private lanThu: Repository<LanThuTienYLenh>,
    private ds: DataSource,
  ) {}

  // Danh mục dịch vụ cho lễ tân chọn khi lập hóa đơn
  danhSachDichVu() {
    return this.dichVu.find({ relations: ['khoa'], order: { id: 'ASC' } });
  }

  // Quan hệ cần nạp cho mọi truy vấn hóa đơn. khung_gio/luot_kham tuy khai báo
  // eager nhưng TypeORM chỉ tự nạp eager ở entity gốc (ThanhToan) nên phải liệt kê.
  private static readonly REL_HOA_DON = [
    'lich_hen', 'lich_hen.ho_so', 'lich_hen.khoa',
    'lich_hen.khung_gio', 'lich_hen.khung_gio.bac_si',
    'lich_hen.luot_kham', 'lich_hen.luot_kham.bac_si',
    'nguoi_tao', 'chi_tiet',
  ];

  // Bác sĩ khám: ưu tiên bác sĩ thực khám (lượt khám), nếu chưa khám thì lấy
  // bác sĩ của khung giờ đã đặt.
  private bacSiKham(t: ThanhToan) {
    const lh: any = t.lich_hen;
    const bs = (lh && lh.luot_kham && lh.luot_kham.bac_si) || (lh && lh.khung_gio && lh.khung_gio.bac_si);
    if (!bs) return null;
    return { id: bs.id, ho_ten: bs.ho_ten, hoc_ham: bs.hoc_ham || null, da_kham: !!(lh.luot_kham && lh.luot_kham.bac_si) };
  }

  private goiTien(t: ThanhToan) {
    const kg: any = t.lich_hen ? (t.lich_hen as any).khung_gio : null;
    return {
      id: t.id, ma_thanh_toan: t.ma_thanh_toan, tong_tien: t.tong_tien,
      trang_thai: t.trang_thai, ghi_chu: t.ghi_chu,
      ngay_tao: t.ngay_tao, ngay_thanh_toan: t.ngay_thanh_toan,
      nguoi_tao: t.nguoi_tao ? { id: t.nguoi_tao.id, ho_ten: t.nguoi_tao.ho_ten } : null,
      lich_hen: t.lich_hen ? {
        id: t.lich_hen.id, ma_lich_hen: t.lich_hen.ma_lich_hen, trang_thai: t.lich_hen.trang_thai,
        ho_so_id: t.lich_hen.ho_so ? t.lich_hen.ho_so.id : null,
        benh_nhan: t.lich_hen.ho_so ? t.lich_hen.ho_so.ho_ten : null,
        ma_benh_nhan: t.lich_hen.ho_so ? t.lich_hen.ho_so.ma_benh_nhan : null,
        khoa: t.lich_hen.khoa ? t.lich_hen.khoa.ten_khoa : null,
        bac_si: this.bacSiKham(t),
        ngay_kham: kg ? kg.ngay : null,
        gio_kham: kg ? kg.gio_bat_dau : null,
      } : null,
      chi_tiet: (t.chi_tiet || [])
        .sort((a, b) => a.id - b.id)
        .map((c) => ({ id: c.id, ten_dich_vu: c.ten_dich_vu, don_gia: c.don_gia, so_luong: c.so_luong, thanh_tien: c.thanh_tien })),
    };
  }

  // ---- Nguồn thứ hai của sổ thu: phiếu y lệnh (thuốc, vật tư, dịch vụ) ----
  // Quy MỘT LẦN THU của phiếu y lệnh về đúng hình dạng dòng hóa đơn để lễ tân và
  // quản trị chỉ phải đọc một sổ. id có tiền tố "yl-" nên không bao giờ đụng id
  // hóa đơn dịch vụ, và giao diện dựa vào trường `nguon` để không gọi nhầm API
  // thu/hủy hóa đơn lên phiếu y lệnh.
  private goiLanThu(l: LanThuTienYLenh) {
    const y = l.y_lenh;
    const pk = y ? y.phieu_kham : null;
    const hs = pk ? pk.ho_so : null;
    return {
      id: `yl-${l.id}`, nguon: 'y_lenh' as const,
      ma_thanh_toan: y ? y.ma_phieu : '—',
      tong_tien: l.so_tien,
      trang_thai: TrangThaiThanhToan.DA_THANH_TOAN,
      ghi_chu: y ? y.ghi_chu : null,
      ngay_tao: l.thoi_gian, ngay_thanh_toan: l.thoi_gian,
      nguoi_tao: l.nguoi_thu ? { id: l.nguoi_thu.id, ho_ten: l.nguoi_thu.ho_ten } : null,
      lich_hen: {
        id: null as number | null, ma_lich_hen: y ? y.ma_phieu : null, trang_thai: null as string | null,
        ho_so_id: hs ? hs.id : null,
        benh_nhan: (pk && pk.ten_bn) || (hs && hs.ho_ten) || null,
        ma_benh_nhan: hs ? hs.ma_benh_nhan : null,
        khoa: pk ? pk.chuyen_khoa : null,
        bac_si: y && y.bs_dt ? { id: null as number | null, ho_ten: y.bs_dt, hoc_ham: null, da_kham: true } : null,
        ngay_kham: pk ? pk.ngay_kham : null, gio_kham: null as string | null,
      },
      // Một lần thu có thể chỉ là một phần phiếu — không liệt kê lại toàn bộ dòng
      // thuốc/vật tư để tránh cộng trùng tiền trong phần gom theo bệnh nhân.
      chi_tiet: [{
        id: `yl-ct-${l.id}`, ten_dich_vu: `Thu tiền phiếu y lệnh ${y ? y.ma_phieu : ''}`.trim(),
        don_gia: l.so_tien, so_luong: 1, thanh_tien: l.so_tien,
      }],
    };
  }

  // Các lần thu tiền y lệnh trong một ngày (theo thời điểm thu, không phải ngày lập)
  private async lanThuTrongNgay(day: string) {
    const list = await this.lanThu.createQueryBuilder('l')
      .leftJoinAndSelect('l.y_lenh', 'y')
      .leftJoinAndSelect('y.phieu_kham', 'pk')
      .leftJoinAndSelect('pk.ho_so', 'hs')
      .leftJoinAndSelect('l.nguoi_thu', 'nt')
      .where('l.thoi_gian::date = :day', { day })
      .orderBy('l.thoi_gian', 'DESC')
      .getMany();
    return list.map((l) => this.goiLanThu(l));
  }

  // Lễ tân lập hóa đơn cho một lịch hẹn ĐÃ KHÁM, gồm các dịch vụ đã chọn.
  async lapHoaDon(user: any, lichId: number, dto: any) {
    const lich = await this.lich.findOne({ where: { id: lichId }, relations: ['ho_so'] });
    if (!lich) throw new NotFoundException('Không tìm thấy lịch hẹn');
    if (lich.trang_thai !== TrangThaiLich.DA_KHAM)
      throw new BadRequestException('Chỉ lập thanh toán sau khi bệnh nhân đã khám xong');

    const items: any[] = Array.isArray(dto.items) ? dto.items : [];
    if (items.length === 0) throw new BadRequestException('Vui lòng chọn ít nhất một dịch vụ');

    // Đã có hóa đơn còn hiệu lực cho lịch này thì không lập thêm
    const daCo = await this.tt.findOne({
      where: [
        { lich_hen: { id: lichId }, trang_thai: TrangThaiThanhToan.CHO_THANH_TOAN },
        { lich_hen: { id: lichId }, trang_thai: TrangThaiThanhToan.DA_THANH_TOAN },
      ],
    });
    if (daCo) throw new BadRequestException(`Lịch hẹn này đã có hóa đơn ${daCo.ma_thanh_toan}`);

    return this.ds.transaction(async (m) => {
      const chiTiet: ChiTietThanhToan[] = [];
      let tong = 0;
      for (const it of items) {
        const dv = await m.findOne(DichVu, { where: { id: +it.dich_vu_id || 0 } });
        if (!dv) throw new BadRequestException('Dịch vụ không tồn tại');
        const soLuong = Math.max(1, Math.min(50, +it.so_luong || 1));
        const thanhTien = dv.gia * soLuong;
        tong += thanhTien;
        chiTiet.push(m.create(ChiTietThanhToan, {
          ten_dich_vu: dv.ten_dich_vu, don_gia: dv.gia, so_luong: soLuong, thanh_tien: thanhTien,
          dich_vu: { id: dv.id } as any,
        }));
      }
      const hoaDon = await m.save(m.create(ThanhToan, {
        ma_thanh_toan: 'TT' + Math.random().toString(36).slice(2, 8).toUpperCase(),
        tong_tien: tong, trang_thai: TrangThaiThanhToan.CHO_THANH_TOAN,
        ghi_chu: dto.ghi_chu ? String(dto.ghi_chu).slice(0, 500) : null,
        lich_hen: { id: lich.id } as any, nguoi_tao: { id: user.id } as any,
        chi_tiet: chiTiet,
      }));
      await m.save(m.create(NhatKyHoatDong, {
        hanh_dong: 'lap_thanh_toan',
        noi_dung: `Lập hóa đơn ${hoaDon.ma_thanh_toan} (${tong.toLocaleString('vi-VN')}đ) cho lịch hẹn ${lich.ma_lich_hen}`,
        nguoi_dung: { id: user.id } as any,
      }));
      const full = await m.findOne(ThanhToan, { where: { id: hoaDon.id }, relations: PaymentService.REL_HOA_DON });
      return this.goiTien(full);
    });
  }

  // Lễ tân xác nhận bệnh nhân đã thanh toán tại quầy
  async xacNhanThanhToan(user: any, id: number) {
    const t = await this.tt.findOne({ where: { id }, relations: PaymentService.REL_HOA_DON });
    if (!t) throw new NotFoundException('Không tìm thấy hóa đơn');
    if (t.trang_thai === TrangThaiThanhToan.DA_HUY) throw new BadRequestException('Hóa đơn đã bị hủy');
    if (t.trang_thai === TrangThaiThanhToan.DA_THANH_TOAN) return this.goiTien(t);
    t.trang_thai = TrangThaiThanhToan.DA_THANH_TOAN;
    t.ngay_thanh_toan = new Date();
    await this.tt.save(t);
    await this.ds.getRepository(NhatKyHoatDong).save({
      hanh_dong: 'thu_thanh_toan',
      noi_dung: `Thu thanh toán hóa đơn ${t.ma_thanh_toan} (${t.tong_tien.toLocaleString('vi-VN')}đ)`,
      nguoi_dung: { id: user.id } as any,
    });
    return this.goiTien(t);
  }

  // Admin hủy hóa đơn (chỉ hóa đơn chưa thanh toán)
  async huyHoaDon(user: any, id: number) {
    const t = await this.tt.findOne({ where: { id }, relations: PaymentService.REL_HOA_DON });
    if (!t) throw new NotFoundException('Không tìm thấy hóa đơn');
    if (t.trang_thai === TrangThaiThanhToan.DA_THANH_TOAN)
      throw new BadRequestException('Hóa đơn đã thanh toán, không thể hủy');
    t.trang_thai = TrangThaiThanhToan.DA_HUY;
    await this.tt.save(t);
    await this.ds.getRepository(NhatKyHoatDong).save({
      hanh_dong: 'huy_thanh_toan',
      noi_dung: `Hủy hóa đơn ${t.ma_thanh_toan}`,
      nguoi_dung: { id: user.id } as any,
    });
    return this.goiTien(t);
  }

  // Toàn bộ hóa đơn (lễ tân & admin)
  async danhSach() {
    const list = await this.tt.find({
      relations: PaymentService.REL_HOA_DON,
      order: { id: 'DESC' }, take: 200,
    });
    // Kèm phiếu y lệnh để danh sách thanh toán phản ánh đủ tiền viện phí; thu tiền
    // cho phiếu y lệnh vẫn làm ở mục Y lệnh (giao diện khóa nút theo `nguon`).
    const yl = await this.yLenh.find({
      relations: ['phieu_kham', 'phieu_kham.ho_so', 'nguoi_tao', 'chi_tiet', 'lan_thu'],
      order: { id: 'DESC' }, take: 200,
    });
    return [
      ...list.map((t) => this.goiTien(t)),
      ...yl.map((y) => this.goiYLenh(y)),
    ].sort((a, b) => new Date(b.ngay_tao as any).getTime() - new Date(a.ngay_tao as any).getTime());
  }

  // Một PHIẾU y lệnh (không phải từng lần thu) hiển thị trong danh sách thanh toán
  private goiYLenh(y: PhieuYLenh) {
    const pk = y.phieu_kham;
    const hs = pk ? pk.ho_so : null;
    const lanThuCuoi = (y.lan_thu || []).reduce<Date | null>(
      (max, l) => (!max || new Date(l.thoi_gian) > new Date(max) ? l.thoi_gian : max), null);
    return {
      id: `yl-${y.id}`, nguon: 'y_lenh' as const,
      ma_thanh_toan: y.ma_phieu, tong_tien: y.tong_tien,
      da_nop: y.da_nop, con_lai: Math.max(0, y.tong_tien - y.da_nop),
      // Chưa thu đủ vẫn xếp vào "chờ thanh toán" để lễ tân thấy khoản còn thiếu
      trang_thai: y.trang_thai === 'da_du' ? TrangThaiThanhToan.DA_THANH_TOAN : TrangThaiThanhToan.CHO_THANH_TOAN,
      ghi_chu: y.ghi_chu,
      ngay_tao: y.ngay_tao,
      // Giờ thu là lần thu GẦN NHẤT, không phải giờ lập phiếu — phiếu có thể thu
      // làm nhiều lần vào những ngày khác nhau.
      ngay_thanh_toan: y.trang_thai === 'da_du' ? lanThuCuoi : null,
      nguoi_tao: y.nguoi_tao ? { id: y.nguoi_tao.id, ho_ten: y.nguoi_tao.ho_ten } : null,
      lich_hen: {
        id: null as number | null, ma_lich_hen: y.ma_phieu, trang_thai: null as string | null,
        ho_so_id: hs ? hs.id : null,
        benh_nhan: (pk && pk.ten_bn) || (hs && hs.ho_ten) || null,
        ma_benh_nhan: hs ? hs.ma_benh_nhan : null,
        khoa: pk ? pk.chuyen_khoa : null,
        bac_si: y.bs_dt ? { id: null as number | null, ho_ten: y.bs_dt, hoc_ham: null, da_kham: true } : null,
        ngay_kham: pk ? pk.ngay_kham : null, gio_kham: null as string | null,
      },
      chi_tiet: (y.chi_tiet || []).sort((a, b) => a.id - b.id).map((c) => ({
        id: `yl-ct-${c.id}`, ten_dich_vu: c.ten, don_gia: c.don_gia,
        so_luong: c.so_luong, thanh_tien: c.thanh_tien,
      })),
    };
  }

  // Hóa đơn của một lịch hẹn — nhân viên xem bất kỳ; bệnh nhân chỉ xem của mình
  async choLichHen(user: any, lichId: number) {
    const list = await this.tt.find({
      where: { lich_hen: { id: lichId } },
      relations: [...PaymentService.REL_HOA_DON, 'lich_hen.ho_so.nguoi_dung'],
      order: { id: 'DESC' },
    });
    if (!laNhanVien(user.vai_tro)) {
      const cuaMinh = list.every((t) => t.lich_hen.ho_so.nguoi_dung?.id === user.id);
      if (!cuaMinh) throw new ForbiddenException('Không có quyền xem hóa đơn này');
    }
    return list.map((t) => this.goiTien(t));
  }

  // Bệnh nhân xem toàn bộ hóa đơn của mình
  async cuaBenhNhan(userId: number) {
    const list = await this.tt.find({
      where: { lich_hen: { ho_so: { nguoi_dung: { id: userId } } } },
      relations: PaymentService.REL_HOA_DON,
      order: { id: 'DESC' },
    });
    return list.map((t) => this.goiTien(t));
  }

  // Chuẩn hóa ngày về YYYY-MM-DD; mặc định là hôm nay (giờ địa phương)
  private chuanNgay(ngay?: string) {
    if (ngay && /^\d{4}-\d{2}-\d{2}$/.test(ngay)) return ngay;
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // Sổ thu: các hóa đơn ĐÃ THANH TOÁN trong một ngày (theo ngày thu tiền).
  // Dữ liệu lưu sẵn trong bảng thanh_toan — đây là truy vấn theo ngay_thanh_toan.
  async thanhToanTrongNgay(ngay?: string) {
    const day = this.chuanNgay(ngay);
    const list = await this.tt.createQueryBuilder('t')
      .leftJoinAndSelect('t.lich_hen', 'lh')
      .leftJoinAndSelect('lh.ho_so', 'hs')
      .leftJoinAndSelect('lh.khoa', 'k')
      .leftJoinAndSelect('lh.khung_gio', 'kg')
      .leftJoinAndSelect('kg.bac_si', 'bskg')
      .leftJoinAndSelect('lh.luot_kham', 'lk')
      .leftJoinAndSelect('lk.bac_si', 'bslk')
      .leftJoinAndSelect('t.nguoi_tao', 'nt')
      .leftJoinAndSelect('t.chi_tiet', 'ct')
      .where('t.trang_thai = :tt', { tt: TrangThaiThanhToan.DA_THANH_TOAN })
      .andWhere('t.ngay_thanh_toan::date = :day', { day })
      .orderBy('t.ngay_thanh_toan', 'DESC')
      .getMany();
    // Gộp hai nguồn rồi xếp theo thời điểm thu để sổ thu đọc như một dòng tiền
    const dong = [
      ...list.map((t) => this.goiTien(t)),
      ...(await this.lanThuTrongNgay(day)),
    ].sort((a, b) => new Date(b.ngay_thanh_toan as any).getTime() - new Date(a.ngay_thanh_toan as any).getTime());
    const tongHoaDon = list.reduce((s, t) => s + t.tong_tien, 0);
    const tong = dong.reduce((s, t) => s + t.tong_tien, 0);
    return {
      ngay: day, so_hoa_don: dong.length, tong_tien: tong,
      // Tách nguồn để lễ tân đối chiếu: bao nhiêu từ hóa đơn dịch vụ, bao nhiêu
      // từ phiếu y lệnh
      theo_nguon: {
        hoa_don: { so_phieu: list.length, tong_tien: tongHoaDon },
        y_lenh: { so_phieu: dong.length - list.length, tong_tien: tong - tongHoaDon },
      },
      danh_sach: dong,
    };
  }

  // Doanh thu trong ngày GOM THEO TỪNG BỆNH NHÂN: mỗi bệnh nhân một dòng với
  // tổng tiền, số hóa đơn, các dịch vụ đã dùng (gộp trùng) và chi tiết hóa đơn.
  async doanhThuTheoBenhNhan(ngay?: string) {
    const { ngay: day, danh_sach } = await this.thanhToanTrongNgay(ngay);
    const nhom = new Map<string, any>();
    for (const t of danh_sach) {
      const lh = t.lich_hen;
      // Khóa gom: ưu tiên id hồ sơ; thiếu hồ sơ thì gom riêng theo hóa đơn để
      // không trộn nhầm nhiều bệnh nhân vào một dòng "không rõ".
      const khoa = lh && lh.ho_so_id ? `hs:${lh.ho_so_id}` : `hd:${t.id}`;
      if (!nhom.has(khoa)) {
        nhom.set(khoa, {
          ho_so_id: lh ? lh.ho_so_id : null,
          ma_benh_nhan: lh ? lh.ma_benh_nhan : null,
          ho_ten: (lh && lh.benh_nhan) || 'Không rõ bệnh nhân',
          so_hoa_don: 0, tong_tien: 0,
          dich_vu: [] as { ten_dich_vu: string; so_luong: number; thanh_tien: number }[],
          hoa_don: [] as any[],
        });
      }
      const b = nhom.get(khoa);
      b.so_hoa_don += 1;
      b.tong_tien += t.tong_tien;
      b.hoa_don.push({
        id: t.id, ma_thanh_toan: t.ma_thanh_toan, tong_tien: t.tong_tien,
        ngay_thanh_toan: t.ngay_thanh_toan, ghi_chu: t.ghi_chu,
        ma_lich_hen: lh ? lh.ma_lich_hen : null,
        khoa: lh ? lh.khoa : null,
        bac_si: lh && lh.bac_si ? lh.bac_si.ho_ten : null,
        nguoi_thu: t.nguoi_tao ? t.nguoi_tao.ho_ten : null,
        chi_tiet: t.chi_tiet,
      });
      for (const c of t.chi_tiet) {
        const cu = b.dich_vu.find((d) => d.ten_dich_vu === c.ten_dich_vu);
        if (cu) { cu.so_luong += c.so_luong; cu.thanh_tien += c.thanh_tien; }
        else b.dich_vu.push({ ten_dich_vu: c.ten_dich_vu, so_luong: c.so_luong, thanh_tien: c.thanh_tien });
      }
    }
    const benh_nhan = [...nhom.values()].sort((a, b) => b.tong_tien - a.tong_tien);
    return {
      ngay: day,
      so_benh_nhan: benh_nhan.length,
      so_hoa_don: benh_nhan.reduce((s, b) => s + b.so_hoa_don, 0),
      tong_tien: benh_nhan.reduce((s, b) => s + b.tong_tien, 0),
      benh_nhan,
    };
  }

  // Toàn bộ tiền đã thu của MỘT bệnh nhân (mọi ngày) — xem lũy kế trong popup
  async doanhThuMotBenhNhan(hoSoId: number) {
    if (!Number.isInteger(hoSoId) || hoSoId <= 0) throw new BadRequestException('Hồ sơ bệnh nhân không hợp lệ');
    const hs = await this.ds.getRepository(HoSoBenhNhan).findOne({ where: { id: hoSoId } });
    if (!hs) throw new NotFoundException('Hồ sơ bệnh nhân không tồn tại');
    const list = await this.tt.createQueryBuilder('t')
      .leftJoinAndSelect('t.lich_hen', 'lh')
      .leftJoinAndSelect('lh.ho_so', 'hsx')
      .leftJoinAndSelect('lh.khoa', 'k')
      .leftJoinAndSelect('lh.khung_gio', 'kg')
      .leftJoinAndSelect('kg.bac_si', 'bskg')
      .leftJoinAndSelect('lh.luot_kham', 'lk')
      .leftJoinAndSelect('lk.bac_si', 'bslk')
      .leftJoinAndSelect('t.nguoi_tao', 'nt')
      .leftJoinAndSelect('t.chi_tiet', 'ct')
      .where('hsx.id = :id', { id: hoSoId })
      .andWhere('t.trang_thai = :tt', { tt: TrangThaiThanhToan.DA_THANH_TOAN })
      .orderBy('t.ngay_thanh_toan', 'DESC')
      .getMany();
    const hoaDon = list.map((t) => this.goiTien(t));
    return {
      ho_so_id: hs.id, ma_benh_nhan: hs.ma_benh_nhan, ho_ten: hs.ho_ten,
      so_hoa_don: hoaDon.length,
      tong_tien: hoaDon.reduce((s, t) => s + t.tong_tien, 0),
      lan_thu_dau: hoaDon.length ? hoaDon[hoaDon.length - 1].ngay_thanh_toan : null,
      lan_thu_cuoi: hoaDon.length ? hoaDon[0].ngay_thanh_toan : null,
      hoa_don: hoaDon,
    };
  }

  // Doanh thu từng ngày trong MỘT THÁNG — nguồn để tô màu lịch chọn ngày.
  // Chỉ tính hóa đơn đã thanh toán, gom theo ngày thu tiền.
  async doanhThuTheoThang(thang?: string) {
    const th = (thang ?? '').toString().trim();
    if (th && !/^\d{4}-(0[1-9]|1[0-2])$/.test(th))
      throw new BadRequestException('Tháng không hợp lệ (định dạng YYYY-MM)');
    const month = th || this.chuanNgay().slice(0, 7);
    const rows = await this.tt.createQueryBuilder('t')
      .select("to_char(t.ngay_thanh_toan, 'YYYY-MM-DD')", 'ngay')
      .addSelect('COUNT(*)', 'so_hoa_don')
      .addSelect('SUM(t.tong_tien)', 'tong_tien')
      .where('t.trang_thai = :tt', { tt: TrangThaiThanhToan.DA_THANH_TOAN })
      .andWhere("to_char(t.ngay_thanh_toan, 'YYYY-MM') = :th", { th: month })
      .groupBy("to_char(t.ngay_thanh_toan, 'YYYY-MM-DD')")
      .getRawMany();
    // Cộng thêm tiền thu từ phiếu y lệnh để lịch doanh thu và sổ thu trong ngày
    // luôn khớp nhau — ngày chỉ thu y lệnh vẫn được tô màu trên lịch.
    const rowsYl = await this.lanThu.createQueryBuilder('l')
      .select("to_char(l.thoi_gian, 'YYYY-MM-DD')", 'ngay')
      .addSelect('COUNT(*)', 'so_hoa_don')
      .addSelect('SUM(l.so_tien)', 'tong_tien')
      .where("to_char(l.thoi_gian, 'YYYY-MM') = :th", { th: month })
      .groupBy("to_char(l.thoi_gian, 'YYYY-MM-DD')")
      .getRawMany();
    const gom = new Map<string, { ngay: string; so_hoa_don: number; tong_tien: number }>();
    for (const r of [...rows, ...rowsYl]) {
      const d = gom.get(r.ngay) || { ngay: r.ngay as string, so_hoa_don: 0, tong_tien: 0 };
      d.so_hoa_don += Number(r.so_hoa_don);
      d.tong_tien += Number(r.tong_tien);
      gom.set(r.ngay, d);
    }
    const ngay = [...gom.values()].sort((a, b) => a.ngay.localeCompare(b.ngay));
    return {
      thang: month,
      so_ngay_co_thu: ngay.length,
      so_hoa_don: ngay.reduce((s, d) => s + d.so_hoa_don, 0),
      tong_tien: ngay.reduce((s, d) => s + d.tong_tien, 0),
      ngay,
    };
  }

  // Trích xuất sổ thu trong ngày ra CSV (Excel mở được, UTF-8 BOM)
  async xuatExcelNgay(ngay?: string) {
    const { ngay: day, so_hoa_don, tong_tien, danh_sach } = await this.thanhToanTrongNgay(ngay);
    const cell = (v: any) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const row = (...c: any[]) => c.map(cell).join(',');
    const lines: string[] = [];
    lines.push(row('SỔ THU DỊCH VỤ TRONG NGÀY — BV PHỤ SẢN HẢI PHÒNG'));
    lines.push(row('Ngày', day.split('-').reverse().join('/')));
    lines.push(row('Số hóa đơn đã thu', so_hoa_don));
    lines.push(row('Tổng thu (đồng)', tong_tien));
    lines.push('');
    lines.push(row('STT', 'Nguồn', 'Mã phiếu', 'Bệnh nhân', 'Mã lịch hẹn', 'Khoa', 'BS khám', 'Nội dung', 'Thành tiền', 'Giờ thu', 'Người thu'));
    danh_sach.forEach((t, i) => {
      const dv = t.chi_tiet.map((c) => `${c.ten_dich_vu}${c.so_luong > 1 ? ` x${c.so_luong}` : ''}`).join('; ');
      const gio = t.ngay_thanh_toan ? new Date(t.ngay_thanh_toan).toLocaleTimeString('vi-VN') : '';
      const bs = t.lich_hen && t.lich_hen.bac_si ? t.lich_hen.bac_si.ho_ten : '';
      const nguon = (t as any).nguon === 'y_lenh' ? 'Y lệnh' : 'Hóa đơn dịch vụ';
      lines.push(row(i + 1, nguon, t.ma_thanh_toan, t.lich_hen ? t.lich_hen.benh_nhan : '',
        t.lich_hen ? t.lich_hen.ma_lich_hen : '', t.lich_hen ? t.lich_hen.khoa : '',
        bs, dv, t.tong_tien, gio, t.nguoi_tao ? t.nguoi_tao.ho_ten : ''));
    });
    lines.push('');
    lines.push(row('', '', '', '', '', '', 'TỔNG CỘNG', tong_tien));
    return { day, buffer: Buffer.from('﻿' + lines.join('\r\n'), 'utf8') };
  }
}

@Controller('api')
export class PaymentController {
  constructor(private svc: PaymentService) {}

  // Danh mục dịch vụ (nhân viên y tế)
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.BAC_SI, VaiTro.ADMIN)
  @Get('services') dichVu() { return this.svc.danhSachDichVu(); }

  // Lễ tân lập hóa đơn + thu tiền
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.ADMIN)
  @Post('reception/appointments/:id/payment') lap(@Request() r, @Param('id') id, @Body() b) { return this.svc.lapHoaDon(r.user, +id, b); }
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.ADMIN)
  @Post('payments/:id/pay') thu(@Request() r, @Param('id') id) { return this.svc.xacNhanThanhToan(r.user, +id); }
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.ADMIN)
  @Get('reception/payments') dsLeTan() { return this.svc.danhSach(); }
  // Sổ thu trong ngày + trích xuất Excel
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.ADMIN)
  @Get('reception/payments/daily') soThuNgay(@Query('ngay') ngay?: string) { return this.svc.thanhToanTrongNgay(ngay); }
  // Doanh thu từng ngày trong tháng — để lịch tô màu ngày có thu
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.ADMIN)
  @Get('reception/payments/monthly') soThuThang(@Query('thang') thang?: string) { return this.svc.doanhThuTheoThang(thang); }
  // Doanh thu trong ngày gom theo từng bệnh nhân
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.ADMIN)
  @Get('reception/payments/by-patient') soThuTheoBenhNhan(@Query('ngay') ngay?: string) {
    return this.svc.doanhThuTheoBenhNhan(ngay);
  }
  // Tổng tiền đã thu của một bệnh nhân (mọi ngày)
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.ADMIN)
  @Get('reception/payments/patient/:hoSoId') soThuMotBenhNhan(@Param('hoSoId') id: string) {
    return this.svc.doanhThuMotBenhNhan(+id);
  }
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.LE_TAN, VaiTro.ADMIN)
  @Get('reception/payments/daily/export') async xuatSoThu(@Query('ngay') ngay?: string) {
    const { day, buffer } = await this.svc.xuatExcelNgay(ngay);
    return new StreamableFile(buffer, {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(`so-thu-${day}.csv`)}`,
    });
  }

  // Hóa đơn theo lịch hẹn (bệnh nhân xem của mình, nhân viên xem bất kỳ)
  @UseGuards(JwtAuthGuard)
  @Get('appointments/:id/payment') theoLich(@Request() r, @Param('id') id) { return this.svc.choLichHen(r.user, +id); }
  // Bệnh nhân xem toàn bộ hóa đơn của mình
  @UseGuards(JwtAuthGuard)
  @Get('payments/me') cuaToi(@Request() r) { return this.svc.cuaBenhNhan(r.user.id); }

  // Admin xem & quản lý toàn bộ hóa đơn
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.ADMIN)
  @Get('admin/payments') dsAdmin() { return this.svc.danhSach(); }
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(VaiTro.ADMIN)
  @Patch('admin/payments/:id/cancel') huy(@Request() r, @Param('id') id) { return this.svc.huyHoaDon(r.user, +id); }
}
