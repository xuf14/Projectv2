import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, OneToOne,
  JoinColumn, CreateDateColumn, UpdateDateColumn, Unique,
} from 'typeorm';

// ---- Vai trò ----
export enum VaiTro {
  BENH_NHAN = 'benh_nhan',
  LE_TAN = 'le_tan',
  BAC_SI = 'bac_si',
  ADMIN = 'admin',
}

@Entity('nguoi_dung')
export class NguoiDung {
  @PrimaryGeneratedColumn() id: number;
  @Column() ho_ten: string;
  @Column({ unique: true, nullable: true }) sdt: string;
  @Column({ unique: true, nullable: true }) email: string;
  @Column() mat_khau_hash: string;
  @Column({ type: 'varchar', default: VaiTro.BENH_NHAN }) vai_tro: VaiTro;
  @Column({ default: true }) trang_thai: boolean;
  @CreateDateColumn() ngay_tao: Date;

  @OneToMany(() => HoSoBenhNhan, (h) => h.nguoi_dung) ho_so: HoSoBenhNhan[];
}

@Entity('khoa_phong')
export class KhoaPhong {
  @PrimaryGeneratedColumn() id: number;
  @Column() ten_khoa: string;
  @Column({ nullable: true }) ma: string;
  @Column({ type: 'text', nullable: true }) mo_ta: string;
  @Column({ nullable: true }) vi_tri: string;

  @OneToMany(() => BacSi, (b) => b.khoa) bac_si: BacSi[];
  @OneToMany(() => DichVu, (d) => d.khoa) dich_vu: DichVu[];
}

@Entity('bac_si')
export class BacSi {
  @PrimaryGeneratedColumn() id: number;
  @Column() ho_ten: string;
  @Column({ nullable: true }) hoc_ham: string;
  @Column({ nullable: true }) chuyen_mon: string;
  @Column({ type: 'int', default: 0 }) so_nam_kn: number;
  @Column({ type: 'float', default: 5 }) danh_gia: number;

  @ManyToOne(() => KhoaPhong, (k) => k.bac_si, { eager: true }) @JoinColumn({ name: 'khoa_id' }) khoa: KhoaPhong;
  @OneToMany(() => KhungGio, (s) => s.bac_si) khung_gio: KhungGio[];

  // Tài khoản đăng nhập riêng của từng bác sĩ; null = bác sĩ chưa có tài khoản
  @ManyToOne(() => NguoiDung, { nullable: true })
  @JoinColumn({ name: 'nguoi_dung_id' }) nguoi_dung: NguoiDung;
}

@Entity('dich_vu')
export class DichVu {
  @PrimaryGeneratedColumn() id: number;
  @Column() ten_dich_vu: string;
  @Column({ type: 'int', default: 0 }) gia: number;
  @ManyToOne(() => KhoaPhong, (k) => k.dich_vu) @JoinColumn({ name: 'khoa_id' }) khoa: KhoaPhong;
}

// Danh mục VẬT TƯ TIÊU HAO người bệnh có thể phải chi trả (sản phụ khoa).
// Nguồn để lễ tân chọn dòng vật tư khi lập phiếu viện phí và để tổng hợp báo cáo
// số lượng — chi phí thực tế vẫn lấy từ chi_tiet_y_lenh của từng phiếu.
@Entity('vat_tu_tieu_hao')
export class VatTuTieuHao {
  @PrimaryGeneratedColumn() id: number;
  @Column({ unique: true }) ma_vt: string;
  @Column() ten: string;
  @Column({ type: 'int' }) nhom_id: number;
  @Column() nhom_ten: string;
  // Mã các khoa thường dùng vật tư này (san, phu, ivf, sosinh) — dùng để lọc
  @Column({ type: 'simple-array', nullable: true }) khoa: string[];
  @Column({ nullable: true }) dvt: string;
  // Giá thu niêm yết (0 = chưa phê duyệt giá, lễ tân nhập tay khi lập phiếu)
  @Column({ type: 'int', default: 0 }) don_gia: number;
  @Column({ type: 'text', nullable: true }) ghi_chu: string;
  @Column({ default: true }) hoat_dong: boolean;
}

// Danh mục THUỐC sản phụ khoa dùng trong bệnh viện. Nguồn cho ô chọn thuốc của
// bác sĩ (kê đơn) lẫn của lễ tân (chi tiết viện phí); mã thuốc là khóa ổn định
// để trừ tồn kho ở tủ thuốc.
@Entity('thuoc')
export class Thuoc {
  @PrimaryGeneratedColumn() id: number;
  @Column({ unique: true }) ma_thuoc: string;
  @Column() hoat_chat: string;
  @Column({ nullable: true }) nhom: string;
  // Mức kiểm soát kê đơn (Nguy cơ cao, Hạn chế, Kê đơn...) — nhắc người nhập
  @Column({ nullable: true }) kiem_soat: string;
  @Column({ type: 'text', nullable: true }) ung_dung: string;
  @Column({ nullable: true }) dvt: string;
  // Giá thu niêm yết (0 = chưa phê duyệt giá, người lập phiếu nhập tay)
  @Column({ type: 'int', default: 0 }) don_gia: number;
  @Column({ default: true }) hoat_dong: boolean;
}

// TỒN KHO — mỗi dòng là một mặt hàng trong tủ thuốc (loai='thuoc') hoặc tủ vật
// tư tiêu hao (loai='vat_tu'). Số lượng bị trừ khi lễ tân lập phiếu y lệnh và
// được cộng lại khi nhập kho. Cặp (loai, ma) là khóa nghiệp vụ duy nhất.
@Entity('ton_kho')
@Unique('uq_ton_kho_loai_ma', ['loai', 'ma'])
export class TonKho {
  @PrimaryGeneratedColumn() id: number;
  @Column() loai: string;                 // thuoc | vat_tu
  @Column() ma: string;                   // ma_thuoc hoặc ma_vt của danh mục
  @Column() ten: string;
  @Column({ nullable: true }) dvt: string;
  // Đơn giá kho: dùng để tính GIÁ TRỊ TỒN KHO và là giá điền sẵn cho dòng
  // thuốc/vật tư trên phiếu viện phí. Sửa qua nhập kho hoặc POST /kho/gia.
  @Column({ type: 'int', default: 0 }) don_gia: number;
  @Column({ type: 'float', default: 0 }) so_luong: number;
  @Column({ type: 'float', default: 0 }) ton_toi_thieu: number;  // dưới mức này = cảnh báo sắp hết
  @Column({ default: true }) hoat_dong: boolean;
  @UpdateDateColumn() ngay_cap_nhat: Date;
}

// NHẬT KÝ KHO — mọi lần nhập, xuất (do phiếu y lệnh) và điều chỉnh kiểm kê.
// so_luong dương = nhập vào, âm = xuất ra; ton_sau là tồn ngay sau giao dịch.
@Entity('nhat_ky_kho')
export class NhatKyKho {
  @PrimaryGeneratedColumn() id: number;
  @Column() loai_gd: string;              // nhap | xuat | dieu_chinh
  @Column({ type: 'float' }) so_luong: number;
  @Column({ type: 'float' }) ton_truoc: number;
  @Column({ type: 'float' }) ton_sau: number;
  @Column({ nullable: true }) ma_phieu: string;   // mã phiếu y lệnh gây ra xuất kho
  @Column({ type: 'text', nullable: true }) ghi_chu: string;
  @CreateDateColumn() thoi_gian: Date;

  @ManyToOne(() => TonKho, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'ton_kho_id' }) ton_kho: TonKho;
  @ManyToOne(() => NguoiDung, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'nguoi_dung_id' }) nguoi_dung: NguoiDung;
}

@Entity('ho_so_benh_nhan')
export class HoSoBenhNhan {
  @PrimaryGeneratedColumn() id: number;
  @Column({ unique: true }) ma_benh_nhan: string;
  @Column() ho_ten: string;
  @Column({ type: 'date', nullable: true }) ngay_sinh: string;
  @Column({ nullable: true }) gioi_tinh: string;
  @Column({ nullable: true }) dia_chi: string;
  @Column({ nullable: true }) sdt: string;
  @Column({ nullable: true }) so_bhyt: string;

  @ManyToOne(() => NguoiDung, (n) => n.ho_so) @JoinColumn({ name: 'nguoi_dung_id' }) nguoi_dung: NguoiDung;
  @OneToMany(() => LichHen, (l) => l.ho_so) lich_hen: LichHen[];

  // Bác sĩ bệnh nhân mong muốn được khám, ghi nhận lúc tiếp đón; null = không yêu cầu
  @ManyToOne(() => BacSi, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'bac_si_mong_muon_id' }) bac_si_mong_muon: BacSi;

  // Hẹn tái khám do lễ tân ghi nhận: ngày hẹn, bác sĩ sẽ khám lại (được thông báo
  // ở cổng bác sĩ) và ghi chú chuẩn bị (mang toa thuốc cũ, phim chụp...)
  @Column({ type: 'date', nullable: true }) ngay_tai_kham: string;
  @Column({ type: 'text', nullable: true }) ghi_chu_tai_kham: string;
  @ManyToOne(() => BacSi, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'bac_si_tai_kham_id' }) bac_si_tai_kham: BacSi;
}

@Entity('khung_gio')
export class KhungGio {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'date' }) ngay: string;
  @Column() gio_bat_dau: string;
  @Column() gio_ket_thuc: string;
  @Column({ type: 'int', default: 5 }) so_luong: number;
  @Column({ type: 'int', default: 0 }) da_dat: number;

  @ManyToOne(() => BacSi, (b) => b.khung_gio, { eager: true }) @JoinColumn({ name: 'bac_si_id' }) bac_si: BacSi;
  @OneToMany(() => LichHen, (l) => l.khung_gio) lich_hen: LichHen[];
}

export enum TrangThaiLich {
  CHO_XAC_NHAN = 'cho_xac_nhan',
  DA_XAC_NHAN = 'da_xac_nhan',
  DA_CHECKIN = 'da_checkin',
  DA_KHAM = 'da_kham',
  DA_HUY = 'da_huy',
}

@Entity('lich_hen')
export class LichHen {
  @PrimaryGeneratedColumn() id: number;
  @Column({ unique: true }) ma_lich_hen: string;
  @Column({ type: 'varchar', default: TrangThaiLich.CHO_XAC_NHAN }) trang_thai: TrangThaiLich;
  @Column({ type: 'int', nullable: true }) so_thu_tu: number;
  @CreateDateColumn() ngay_tao: Date;

  @ManyToOne(() => HoSoBenhNhan, (h) => h.lich_hen, { eager: true }) @JoinColumn({ name: 'ho_so_id' }) ho_so: HoSoBenhNhan;
  @ManyToOne(() => KhungGio, { eager: true }) @JoinColumn({ name: 'khung_gio_id' }) khung_gio: KhungGio;
  @ManyToOne(() => KhoaPhong, { eager: true }) @JoinColumn({ name: 'khoa_id' }) khoa: KhoaPhong;
  @OneToOne('LuotKham', 'lich_hen') luot_kham: any;
}

export enum TrangThaiKham {
  DANG_KHAM = 'dang_kham',
  HOAN_THANH = 'hoan_thanh',
}

@Entity('luot_kham')
export class LuotKham {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'text', nullable: true }) chan_doan: string;
  @Column({ type: 'text', nullable: true }) chi_dinh: string;
  @Column({ type: 'text', nullable: true }) ghi_chu: string;
  @Column({ type: 'varchar', default: TrangThaiKham.DANG_KHAM }) trang_thai: TrangThaiKham;
  @CreateDateColumn() thoi_gian: Date;

  @OneToOne(() => LichHen, (l) => l.luot_kham) @JoinColumn({ name: 'lich_hen_id' }) lich_hen: LichHen;
  @ManyToOne(() => BacSi, { eager: true }) @JoinColumn({ name: 'bac_si_id' }) bac_si: BacSi;
  @OneToOne('DonThuoc', 'luot_kham') don_thuoc: any;
}

@Entity('don_thuoc')
export class DonThuoc {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'text', nullable: true }) danh_sach_thuoc: string;
  @Column({ type: 'text', nullable: true }) lieu_dung: string;
  @Column({ type: 'text', nullable: true }) ghi_chu: string;
  // Bản CẤU TRÚC của đơn thuốc (JSON mảng {ten, so_luong, dvt, lieu_dung, cach_dung})
  // khi bác sĩ kê bằng cách chọn từ danh mục thuốc. Đây là nguồn để lễ tân nạp
  // thẳng vào "Chi tiết viện phí"; danh_sach_thuoc vẫn giữ bản chữ để các màn
  // hình cũ (lịch sử khám, tái khám) hiển thị như trước.
  @Column({ type: 'text', nullable: true }) danh_sach_json: string;
  @OneToOne(() => LuotKham, (v) => v.don_thuoc) @JoinColumn({ name: 'luot_kham_id' }) luot_kham: LuotKham;
}

// Mẫu bệnh án bệnh nhân tải lên cho một lịch hẹn — lưu nhị phân (bytea) ngay
// trong PostgreSQL theo yêu cầu; bác sĩ truy xuất online hoặc tải về PDF/Word.
@Entity('tai_lieu_benh_an')
export class TaiLieuBenhAn {
  @PrimaryGeneratedColumn() id: number;
  @Column() ten_tep: string;
  @Column() loai_tep: string; // MIME: application/pdf hoặc Word
  @Column({ type: 'int' }) kich_thuoc: number;
  @Column({ type: 'bytea' }) du_lieu: Buffer;
  @CreateDateColumn() thoi_gian: Date;

  @ManyToOne(() => LichHen, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lich_hen_id' }) lich_hen: LichHen;
}

export enum TrangThaiThanhToan {
  CHO_THANH_TOAN = 'cho_thanh_toan',
  DA_THANH_TOAN = 'da_thanh_toan',
  DA_HUY = 'da_huy',
}

// Yêu cầu thanh toán (hóa đơn) do lễ tân lập cho một lịch hẹn sau khi bệnh nhân
// đã khám. Gồm nhiều dòng dịch vụ. Admin xem & quản lý toàn bộ các hóa đơn này.
@Entity('thanh_toan')
export class ThanhToan {
  @PrimaryGeneratedColumn() id: number;
  @Column({ unique: true }) ma_thanh_toan: string;
  @Column({ type: 'int', default: 0 }) tong_tien: number;
  @Column({ type: 'varchar', default: TrangThaiThanhToan.CHO_THANH_TOAN }) trang_thai: TrangThaiThanhToan;
  @Column({ type: 'text', nullable: true }) ghi_chu: string;
  @CreateDateColumn() ngay_tao: Date;
  @Column({ type: 'timestamp', nullable: true }) ngay_thanh_toan: Date;

  @ManyToOne(() => LichHen, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lich_hen_id' }) lich_hen: LichHen;
  // Lễ tân đã lập hóa đơn; giữ nhật ký kể cả khi tài khoản bị xóa
  @ManyToOne(() => NguoiDung, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'nguoi_tao_id' }) nguoi_tao: NguoiDung;
  @OneToMany(() => ChiTietThanhToan, (c) => c.thanh_toan, { eager: true, cascade: true })
  chi_tiet: ChiTietThanhToan[];
}

// Dòng dịch vụ trong một hóa đơn — lưu snapshot tên/đơn giá tại thời điểm lập
// để hóa đơn không đổi khi giá dịch vụ được cập nhật về sau.
@Entity('chi_tiet_thanh_toan')
export class ChiTietThanhToan {
  @PrimaryGeneratedColumn() id: number;
  @Column() ten_dich_vu: string;
  @Column({ type: 'int' }) don_gia: number;
  @Column({ type: 'int', default: 1 }) so_luong: number;
  @Column({ type: 'int' }) thanh_tien: number;

  @ManyToOne(() => ThanhToan, (t) => t.chi_tiet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'thanh_toan_id' }) thanh_toan: ThanhToan;
  @ManyToOne(() => DichVu, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'dich_vu_id' }) dich_vu: DichVu;
}

// Phiếu thông tin khám bệnh do lễ tân nhập theo mẫu bệnh án của bệnh viện
// (màn hình HIS "Thông tin khám bệnh"). Liên kết tùy chọn tới hồ sơ bệnh nhân
// và lịch hẹn đã có; SET NULL để phiếu vẫn còn khi hồ sơ/lịch bị xóa.
@Entity('phieu_kham_benh')
export class PhieuKhamBenh {
  @PrimaryGeneratedColumn() id: number;

  // --- Hành chính ---
  @Column({ nullable: true }) ma_kcb: string;
  @Column({ nullable: true }) so_benh_an: string;
  @Column({ type: 'date', nullable: true }) ngay_dk: string;
  @Column({ default: false }) noi_tru: boolean;
  @Column({ default: false }) dtnt: boolean;
  @Column({ default: false }) dkrv: boolean;
  @Column({ default: false }) ttrv: boolean;
  @Column({ default: false }) chuyen_vien: boolean;
  @Column({ default: false }) cap_cuu: boolean;

  // --- Thông tin bệnh nhân ---
  @Column() ten_bn: string;
  @Column({ nullable: true }) gioi_tinh: string;
  @Column({ type: 'date', nullable: true }) ngay_sinh: string;
  @Column({ nullable: true }) tuoi: string;
  @Column({ nullable: true }) dan_toc: string;
  @Column({ nullable: true }) dia_chi: string;
  @Column({ nullable: true }) nghe_nghiep: string;

  // --- Bảo hiểm y tế ---
  @Column({ nullable: true }) doi_tuong: string;
  @Column({ nullable: true }) so_the: string;
  @Column({ nullable: true }) ky_hieu: string;
  @Column({ type: 'date', nullable: true }) han_the: string;
  @Column({ nullable: true }) ty_le_the: string;
  @Column({ nullable: true }) dia_chi_the: string;
  @Column({ nullable: true }) noi_dk_kcb: string;
  @Column({ nullable: true }) noi_cap: string;

  // --- Vào viện ---
  @Column({ type: 'date', nullable: true }) ngay_vao: string;
  @Column({ nullable: true }) buong: string;
  @Column({ nullable: true }) giuong: string;

  // --- Thông tin khám bệnh ---
  @Column({ default: false }) kham_lai: boolean;
  @Column({ default: false }) nho_kham: boolean;
  @Column({ default: false }) hoan_kham: boolean;
  @Column({ type: 'date', nullable: true }) ngay_kham: string;
  @Column({ nullable: true }) bs_kham: string;
  @Column({ nullable: true }) chuyen_khoa: string;
  @Column({ type: 'text', nullable: true }) cdtt: string;
  @Column({ type: 'text', nullable: true }) ghi_chu: string;
  @Column({ type: 'text', nullable: true }) trieu_chung: string;
  @Column({ type: 'text', nullable: true }) chan_doan_so_bo: string;
  @Column({ type: 'text', nullable: true }) ghi_chu_kb: string;
  @Column({ type: 'text', nullable: true }) ket_luan: string;

  // --- Chỉ số sinh tồn ---
  @Column({ nullable: true }) huyet_ap: string;
  @Column({ nullable: true }) mach: string;
  @Column({ nullable: true }) nhiet_do: string;
  @Column({ nullable: true }) nhip_tho: string;
  @Column({ nullable: true }) chieu_cao: string;
  @Column({ nullable: true }) can_nang: string;
  @Column({ nullable: true }) bmi: string;
  @Column({ nullable: true }) spo2: string;
  @Column({ nullable: true }) vong_2: string;

  // --- Chẩn đoán ---
  @Column({ type: 'text', nullable: true }) ten_benh: string;
  @Column({ nullable: true }) ma_icd: string;
  @Column({ type: 'text', nullable: true }) dien_giai: string;

  @CreateDateColumn() ngay_tao: Date;

  @ManyToOne(() => HoSoBenhNhan, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'ho_so_id' }) ho_so: HoSoBenhNhan;
  @ManyToOne(() => LichHen, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'lich_hen_id' }) lich_hen: LichHen;
  // Lễ tân đã nhập phiếu; giữ nhật ký kể cả khi tài khoản bị xóa
  @ManyToOne(() => NguoiDung, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'nguoi_tao_id' }) nguoi_tao: NguoiDung;
}

// Phiếu Y LỆNH — lễ tân lập phiếu thanh toán viện phí gồm thuốc, vật tư tiêu hao
// và dịch vụ. Liên kết tùy chọn tới phiếu khám bệnh (thông tin bệnh nhân).
@Entity('y_lenh')
export class PhieuYLenh {
  @PrimaryGeneratedColumn() id: number;
  @Column({ unique: true }) ma_phieu: string;
  @Column({ type: 'date', nullable: true }) ngay_yl: string;
  @Column({ nullable: true }) bs_dt: string;             // bác sĩ điều trị
  @Column({ type: 'date', nullable: true }) ngay_cdht: string;
  @Column({ type: 'int', default: 0 }) tong_tien: number;  // tổng chi phí = tổng thành tiền
  @Column({ type: 'int', default: 0 }) da_nop: number;     // tổng đã nộp (cộng dồn các lần thu)
  @Column({ type: 'int', default: 0 }) tra_lai: number;    // trả lại = đã nộp − tổng tiền (≥ 0)
  // Trạng thái thu tiền: chua_nop | mot_phan | da_du — cho phép nộp nhiều lần
  @Column({ type: 'varchar', default: 'chua_nop' }) trang_thai: string;
  @Column({ type: 'text', nullable: true }) ghi_chu: string;
  @CreateDateColumn() ngay_tao: Date;

  @ManyToOne(() => PhieuKhamBenh, { nullable: true, eager: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'phieu_kham_id' }) phieu_kham: PhieuKhamBenh;
  @ManyToOne(() => NguoiDung, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'nguoi_tao_id' }) nguoi_tao: NguoiDung;
  @OneToMany(() => ChiTietYLenh, (c) => c.y_lenh, { eager: true, cascade: true })
  chi_tiet: ChiTietYLenh[];
  @OneToMany(() => LanThuTienYLenh, (l) => l.y_lenh, { cascade: true })
  lan_thu: LanThuTienYLenh[];
}

// Mỗi lần lễ tân xác nhận thu tiền cho một phiếu y lệnh — cho phép bệnh nhân
// nộp làm nhiều lần; da_nop của phiếu = tổng các lần thu.
@Entity('lan_thu_tien_y_lenh')
export class LanThuTienYLenh {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'int' }) so_tien: number;
  @CreateDateColumn() thoi_gian: Date;

  @ManyToOne(() => PhieuYLenh, (y) => y.lan_thu, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'y_lenh_id' }) y_lenh: PhieuYLenh;
  // Lễ tân xác nhận khoản thu; giữ lại kể cả khi tài khoản bị xóa
  @ManyToOne(() => NguoiDung, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'nguoi_thu_id' }) nguoi_thu: NguoiDung;
}

// Dòng chi tiết của một phiếu Y lệnh — thuốc / vật tư tiêu hao / dịch vụ.
// Lưu snapshot tên & đơn giá tại thời điểm lập để phiếu không đổi về sau.
@Entity('chi_tiet_y_lenh')
export class ChiTietYLenh {
  @PrimaryGeneratedColumn() id: number;
  @Column() loai: string;                 // thuoc | vat_tu | dich_vu
  @Column({ nullable: true }) ma_vt: string;
  @Column() ten: string;
  @Column({ nullable: true }) dvt: string;               // đơn vị tính
  @Column({ type: 'float', default: 1 }) so_luong: number;
  @Column({ nullable: true }) lieu_dung: string;
  @Column({ nullable: true }) cach_dung: string;
  @Column({ type: 'int', default: 0 }) don_gia: number;
  @Column({ type: 'int', default: 100 }) ty_le: number;  // tỷ lệ chi trả %
  @Column({ type: 'int', default: 0 }) thanh_tien: number;

  @ManyToOne(() => PhieuYLenh, (y) => y.chi_tiet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'y_lenh_id' }) y_lenh: PhieuYLenh;
}

// Phiếu theo dõi điều trị — bác sĩ ghi diễn biến bệnh theo thời gian và chỉ định.
// Mỗi bản ghi là một mốc diễn biến, gắn với phiếu khám bệnh của bệnh nhân.
@Entity('dien_bien_dieu_tri')
export class DienBienDieuTri {
  @PrimaryGeneratedColumn() id: number;
  @Column({ nullable: true }) thoi_diem: string;         // thời gian lâm sàng bác sĩ nhập
  @Column({ type: 'text' }) dien_bien: string;
  @Column({ type: 'text', nullable: true }) chi_dinh: string;
  @CreateDateColumn() ngay_tao: Date;

  @ManyToOne(() => PhieuKhamBenh, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'phieu_kham_id' }) phieu_kham: PhieuKhamBenh;
  @ManyToOne(() => NguoiDung, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'bac_si_id' }) bac_si: NguoiDung;
}

// ============================================================================
// QUY TRÌNH KHÁM 6 BƯỚC (theo tài liệu thiết kế): mỗi "lần khám" = một LichHen.
// Bước 1 Tiếp đón dùng lich_hen; bước 6 Thanh toán dùng thanh_toan.
// Các bảng dưới đây bổ sung bước 2-5: sinh hiệu, khám lâm sàng, cận lâm sàng,
// kết luận. Tất cả gắn với lich_hen_id (encounter_id trong tài liệu).
// ============================================================================

// Bước 2 — Sinh hiệu do điều dưỡng/lễ tân đo khi tiếp nhận. Một bản ghi mỗi lần
// khám (ghi đè khi đo lại); BMI tính ở server từ chiều cao/cân nặng.
@Entity('sinh_hieu')
export class SinhHieu {
  @PrimaryGeneratedColumn() id: number;
  @Column({ nullable: true }) huyet_ap: string;
  @Column({ nullable: true }) mach: string;
  @Column({ nullable: true }) nhiet_do: string;
  @Column({ nullable: true }) nhip_tho: string;
  @Column({ nullable: true }) spo2: string;
  @Column({ nullable: true }) chieu_cao: string;
  @Column({ nullable: true }) can_nang: string;
  @Column({ nullable: true }) bmi: string;
  // binh_thuong | theo_doi | nguy_co_cao
  @Column({ type: 'varchar', default: 'binh_thuong' }) phan_loai: string;
  @Column({ type: 'text', nullable: true }) ghi_chu: string;
  @CreateDateColumn() thoi_gian: Date;

  @ManyToOne(() => LichHen, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lich_hen_id' }) lich_hen: LichHen;
  @ManyToOne(() => NguoiDung, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'nguoi_do_id' }) nguoi_do: NguoiDung;
}

// Bước 3 — Khám lâm sàng của bác sĩ: bệnh sử, tiền sử, dị ứng, khám thực thể,
// chẩn đoán sơ bộ. Một bản ghi mỗi lần khám (ghi đè khi cập nhật).
@Entity('kham_lam_sang')
export class KhamLamSang {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'text', nullable: true }) benh_su: string;
  @Column({ type: 'text', nullable: true }) tien_su: string;
  @Column({ type: 'text', nullable: true }) di_ung: string;
  @Column({ type: 'text', nullable: true }) kham_thuc_the: string;
  @Column({ type: 'text', nullable: true }) chan_doan_so_bo: string;
  @CreateDateColumn() thoi_gian: Date;

  @ManyToOne(() => LichHen, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lich_hen_id' }) lich_hen: LichHen;
  @ManyToOne(() => NguoiDung, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'bac_si_id' }) bac_si: NguoiDung;
}

// Bước 4 — Chỉ định cận lâm sàng (xét nghiệm / siêu âm / thủ thuật) và kết quả.
// Nhiều chỉ định mỗi lần khám; snapshot tên chỉ định tại thời điểm tạo.
@Entity('chi_dinh_cls')
export class ChiDinhCLS {
  @PrimaryGeneratedColumn() id: number;
  @Column() loai: string;                                 // xet_nghiem | sieu_am | thu_thuat
  @Column() ten_chi_dinh: string;
  // cho_thuc_hien | da_co_ket_qua
  @Column({ type: 'varchar', default: 'cho_thuc_hien' }) trang_thai: string;
  @Column({ type: 'text', nullable: true }) ket_qua: string;
  @Column({ type: 'text', nullable: true }) ket_luan: string;
  @CreateDateColumn() ngay_tao: Date;
  @Column({ type: 'timestamp', nullable: true }) ngay_ket_qua: Date;

  @ManyToOne(() => LichHen, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lich_hen_id' }) lich_hen: LichHen;
  @ManyToOne(() => DichVu, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'dich_vu_id' }) dich_vu: DichVu;
  @ManyToOne(() => NguoiDung, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'nguoi_chi_dinh_id' }) nguoi_chi_dinh: NguoiDung;
  @ManyToOne(() => NguoiDung, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'nguoi_thuc_hien_id' }) nguoi_thuc_hien: NguoiDung;
}

// Bước 5 — Kết luận lần khám: chẩn đoán chính/phụ theo ICD, hướng xử trí,
// đơn thuốc và hẹn tái khám. Khi lưu, lịch hẹn chuyển sang da_kham để lễ tân
// lập thanh toán (bước 6).
@Entity('ket_luan_kham')
export class KetLuanKham {
  @PrimaryGeneratedColumn() id: number;
  @Column() chan_doan_chinh: string;
  @Column({ nullable: true }) ma_icd: string;
  @Column({ type: 'text', nullable: true }) chan_doan_phu: string;
  // ke_don | hen_tai_kham | de_nghi_nhap_vien | ket_thuc
  @Column({ type: 'varchar', default: 'ket_thuc' }) huong_xu_tri: string;
  @Column({ type: 'text', nullable: true }) don_thuoc: string;
  @Column({ type: 'text', nullable: true }) loi_dan: string;
  @Column({ type: 'date', nullable: true }) ngay_tai_kham: string;
  @CreateDateColumn() thoi_gian: Date;

  @ManyToOne(() => LichHen, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lich_hen_id' }) lich_hen: LichHen;
  @ManyToOne(() => NguoiDung, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'bac_si_id' }) bac_si: NguoiDung;
}

// Nhật ký thao tác trên dữ liệu (tạo/sửa/xóa hồ sơ...) — mỗi bản ghi mang
// timestamp để quản trị viên theo dõi ai làm gì, lúc nào.
@Entity('nhat_ky_hoat_dong')
export class NhatKyHoatDong {
  @PrimaryGeneratedColumn() id: number;
  @Column() hanh_dong: string; // tao_ho_so | cap_nhat_ho_so | xoa_ho_so
  @Column({ type: 'text', nullable: true }) noi_dung: string;
  @CreateDateColumn() thoi_gian: Date;

  // SET NULL để giữ lại nhật ký kể cả khi tài khoản bị xóa
  @ManyToOne(() => NguoiDung, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'nguoi_dung_id' }) nguoi_dung: NguoiDung;
}

// Thông báo trong hệ thống gửi tới từng tài khoản (bác sĩ, quản trị viên...).
// VD: lễ tân tạo lịch tái khám → bác sĩ phụ trách và admin nhận thông báo.
@Entity('thong_bao')
export class ThongBao {
  @PrimaryGeneratedColumn() id: number;
  @Column() loai: string;                                  // tai_kham | ...
  @Column() tieu_de: string;
  @Column({ type: 'text', nullable: true }) noi_dung: string;
  @Column({ type: 'boolean', default: false }) da_doc: boolean;
  @CreateDateColumn() thoi_gian: Date;

  @ManyToOne(() => NguoiDung, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'nguoi_nhan_id' }) nguoi_nhan: NguoiDung;
  // Lịch hẹn liên quan (nếu có) — xóa lịch thì thông báo vẫn còn nhưng bỏ liên kết
  @ManyToOne(() => LichHen, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'lich_hen_id' }) lich_hen: LichHen;
}

// ============================================================================
// PHÂN HỆ TRUYỀN THÔNG (theo tài liệu thiết kế tin tức & truyền thông):
// bài viết + hình ảnh lưu trong PostgreSQL, tra cứu theo ngày đăng.
// Ảnh lưu bytea theo tiền lệ TaiLieuBenhAn của dự án; public API chỉ trả
// nội dung truyền thông, tuyệt đối không dính dữ liệu bệnh án.
// ============================================================================

@Entity('bai_truyen_thong')
export class BaiTruyenThong {
  @PrimaryGeneratedColumn() id: number;
  @Column() tieu_de: string;
  @Column({ nullable: true }) chuyen_muc: string;   // Tin bệnh viện | Chuyên môn | Giáo dục sức khỏe | Sự kiện...
  @Column({ type: 'text', nullable: true }) tom_tat: string;
  @Column({ type: 'text' }) noi_dung: string;
  // Thẻ (tags) phân tách bằng dấu phẩy — VD: "khám thai, quy trình mới"
  @Column({ nullable: true }) the: string;       // văn bản thuần — không render HTML thô
  @Column({ default: true }) hien_thi: boolean;     // ẩn bài mà không xóa (giữ lịch sử)
  @CreateDateColumn() ngay_dang: Date;              // lưu trữ & nhóm bài theo ngày

  @ManyToOne(() => NguoiDung, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'nguoi_dang_id' }) nguoi_dang: NguoiDung;
  @OneToMany(() => AnhTruyenThong, (a) => a.bai) anh: AnhTruyenThong[];
}

// Ảnh của bài truyền thông — nhị phân bytea trong PostgreSQL, kèm metadata
@Entity('anh_truyen_thong')
export class AnhTruyenThong {
  @PrimaryGeneratedColumn() id: number;
  @Column() ten_tep: string;
  @Column() loai_tep: string;                       // MIME: image/jpeg, image/png...
  @Column({ type: 'int' }) kich_thuoc: number;
  @Column({ type: 'bytea' }) du_lieu: Buffer;
  @Column({ type: 'int', default: 0 }) thu_tu: number;

  @ManyToOne(() => BaiTruyenThong, (b) => b.anh, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bai_id' }) bai: BaiTruyenThong;
}

@Entity('tin_tuc')
export class TinTuc {
  @PrimaryGeneratedColumn() id: number;
  @Column() tieu_de: string;
  @Column({ nullable: true }) tag: string;
  @Column({ type: 'text', nullable: true }) noi_dung: string;
  @Column({ nullable: true }) anh: string;
  @CreateDateColumn() ngay_dang: Date;
}

// ============================================================================
// HỖ TRỢ SINH SẢN (IVF) — hồ sơ điều trị hiếm muộn theo TỪNG BỆNH NHÂN, kéo
// dài nhiều buổi. Hai giai đoạn: khám hiếm muộn (8 bước) → làm IVF (10 bước).
// Bác sĩ khoa Hỗ trợ sinh sản đánh dấu tiến độ; có thể "làm thẳng IVF".
// ============================================================================
@Entity('ho_so_ivf')
export class HoSoIVF {
  @PrimaryGeneratedColumn() id: number;
  // kham_hiem_muon | ivf | hoan_tat
  @Column({ default: 'kham_hiem_muon' }) giai_doan: string;
  // Danh sách chỉ số bước ĐÃ HOÀN THÀNH của mỗi giai đoạn (1..8 và 1..10)
  @Column({ type: 'simple-json', nullable: true }) buoc_kham: number[];
  @Column({ type: 'simple-json', nullable: true }) buoc_ivf: number[];
  @Column({ default: false }) lam_thang_ivf: boolean;  // bỏ qua khám, vào thẳng IVF
  @Column({ type: 'text', nullable: true }) ghi_chu: string;
  @CreateDateColumn() ngay_tao: Date;
  @UpdateDateColumn() ngay_cap_nhat: Date;

  // Mỗi bệnh nhân một hồ sơ IVF (ràng buộc duy nhất ở tầng ứng dụng)
  @ManyToOne(() => HoSoBenhNhan, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ho_so_id' }) ho_so: HoSoBenhNhan;
  // Bác sĩ cập nhật gần nhất
  @ManyToOne(() => BacSi, { nullable: true, eager: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'bac_si_id' }) bac_si: BacSi;
}

// ============================================================================
// ĐĂNG KÝ KHÁM ONLINE — bệnh nhân (mới hoặc cũ) tự điền thông tin trên trang
// công khai để đến khám tại một khoa phòng. Bản ghi vào hàng chờ của lễ tân ở
// trang Tiếp đón (trang_thai: cho_tiep_don → da_tiep_nhan | da_huy). Đây là
// phiếu đăng ký, KHÔNG phải hồ sơ bệnh án; lễ tân mới tạo hồ sơ/lịch khám thật.
// ============================================================================
@Entity('dang_ky_kham')
export class DangKyKham {
  @PrimaryGeneratedColumn() id: number;
  @Column({ unique: true }) ma_dang_ky: string;            // mã ngẫu nhiên có quy luật: DK + 8 số
  @Column() ho_ten: string;
  @Column({ type: 'date', nullable: true }) ngay_sinh: string;
  @Column({ nullable: true }) gioi_tinh: string;
  @Column() sdt: string;                                   // bắt buộc để lễ tân liên hệ
  @Column({ nullable: true }) email: string;
  @Column({ type: 'text', nullable: true }) dia_chi: string;
  @Column({ default: false }) benh_nhan_cu: boolean;       // bệnh nhân tự khai là đã từng khám
  @Column({ nullable: true }) ma_benh_nhan_cu: string;     // mã BN cũ (nếu bệnh nhân nhớ)
  @Column({ type: 'text', nullable: true }) ly_do: string; // lý do / triệu chứng
  @Column({ type: 'date', nullable: true }) ngay_mong_muon: string; // ngày mong muốn đến khám
  @Column({ nullable: true }) gio_mong_muon: string;       // giờ mong muốn (HH:mm)
  @Column({ default: 'cho_tiep_don' }) trang_thai: string; // cho_tiep_don | da_tiep_nhan | da_huy
  @Column({ type: 'text', nullable: true }) ghi_chu_le_tan: string;
  @CreateDateColumn() ngay_tao: Date;
  @UpdateDateColumn() ngay_cap_nhat: Date;

  // Khoa muốn khám (tùy chọn) — SET NULL để giữ phiếu khi khoa bị xóa
  @ManyToOne(() => KhoaPhong, { nullable: true, eager: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'khoa_id' }) khoa: KhoaPhong;
  // Lễ tân đã xử lý phiếu — SET NULL để giữ lịch sử
  @ManyToOne(() => NguoiDung, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'nguoi_xu_ly_id' }) nguoi_xu_ly: NguoiDung;
  // Lễ tân xác nhận phiếu → hồ sơ bệnh nhân (mới tạo hoặc hồ sơ cũ được gắn) và
  // lịch khám thật với bác sĩ của khoa; lịch này là nguồn hiển thị ở cổng bác sĩ
  @ManyToOne(() => HoSoBenhNhan, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'ho_so_id' }) ho_so: HoSoBenhNhan;
  @ManyToOne(() => LichHen, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'lich_hen_id' }) lich_hen: LichHen;
}

// ============================================================================
// PHIẾU RA VIỆN — y lệnh ra viện chính thức do BÁC SĨ ĐIỀU TRỊ lập ở cổng bác sĩ,
// kèm kết luận tình trạng sức khỏe. Là điều kiện để lễ tân được tích "Đăng ký ra
// viện (ĐKRV)" trên phiếu khám: chỉ khi tình trạng an toàn về nhà (hồi phục / qua
// giai đoạn nguy hiểm) + đã thanh toán đủ viện phí.
// ============================================================================
@Entity('phieu_ra_vien')
export class PhieuRaVien {
  @PrimaryGeneratedColumn() id: number;
  // hoi_phuc | qua_nguy_hiem | chuyen_vien | nang_hon | tu_vong
  @Column({ default: 'hoi_phuc' }) tinh_trang: string;
  @Column({ type: 'text', nullable: true }) ket_luan_suc_khoe: string;
  @Column({ type: 'text', nullable: true }) chan_doan_ra_vien: string;
  @Column({ type: 'date', nullable: true }) ngay_ra_vien: string;
  @Column({ default: 'hieu_luc' }) trang_thai: string; // hieu_luc | da_huy
  @CreateDateColumn() ngay_tao: Date;
  @UpdateDateColumn() ngay_cap_nhat: Date;

  @ManyToOne(() => HoSoBenhNhan, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ho_so_id' }) ho_so: HoSoBenhNhan;
  // Bác sĩ điều trị lập phiếu — SET NULL giữ lịch sử khi tài khoản bị xóa
  @ManyToOne(() => NguoiDung, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'bac_si_id' }) bac_si: NguoiDung;
}

// ============================================================================
// NHẬP VIỆN "MỘT CHẠM" (đặc tả Quy trình nhập viện một chạm, bản 1.0):
//   Giuong          — danh mục phòng/giường theo khoa, quản trị viên cấu hình
//   YeuCauNhapVien  — bác sĩ ký ở bước 5 kết luận; THAM CHIẾU hồ sơ + lần khám,
//                     KHÔNG sao chép dữ liệu bệnh nhân
//   DotNoiTru       — đợt điều trị nội trú, sinh ra khi lễ tân xác nhận nhập viện
// Ba điểm kiểm soát: bác sĩ ký → lễ tân xác minh & phân giường → khoa tiếp nhận.
// ============================================================================

@Entity('giuong')
@Unique('uq_giuong_khoa_ma', ['khoa', 'ma'])
export class Giuong {
  @PrimaryGeneratedColumn() id: number;
  @Column() ma: string;                       // mã giường trong khoa, VD "P201-G3"
  @Column() phong: string;                    // số/tên phòng
  @Column({ default: 'thuong' }) loai: string; // thuong | dich_vu
  // trong | dang_dung | bao_tri — dang_dung do đợt nội trú giữ, không sửa tay
  @Column({ default: 'trong' }) trang_thai: string;
  @Column({ default: true }) hoat_dong: boolean;
  @UpdateDateColumn() ngay_cap_nhat: Date;

  @ManyToOne(() => KhoaPhong, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'khoa_id' }) khoa: KhoaPhong;
}

@Entity('yeu_cau_nhap_vien')
export class YeuCauNhapVien {
  @PrimaryGeneratedColumn() id: number;
  @Column({ unique: true }) ma_yeu_cau: string;
  // cho_tiep_nhan | dang_xac_minh | cho_giuong | da_nhap_vien | khoa_da_nhan
  // | tu_choi | da_huy | chuyen_vien
  @Column({ default: 'cho_tiep_nhan' }) trang_thai: string;
  // cap_cuu | khan | thuong | theo_lich — quyết định thứ tự hàng chờ của lễ tân
  @Column({ default: 'thuong' }) uu_tien: string;
  @Column({ type: 'text', nullable: true }) ly_do_uu_tien: string;
  @Column() chan_doan_chinh: string;
  @Column({ nullable: true }) ma_icd: string;
  @Column({ type: 'text' }) ly_do: string;
  @Column({ type: 'text', nullable: true }) canh_bao: string;   // dị ứng, cách ly...
  @Column({ default: 'di_bo' }) ho_tro_di_chuyen: string;       // di_bo | xe_lan | cang
  @Column({ type: 'date', nullable: true }) ngay_du_kien: string;
  @Column({ type: 'text', nullable: true }) ly_do_ket_thuc: string; // lý do hủy/từ chối
  // Kết quả xác minh hành chính của lễ tân, chép sang đợt nội trú khi xác nhận
  @Column({ default: 'vien_phi' }) doi_tuong_tt: string;        // bhyt | vien_phi | bao_lanh
  @Column({ default: 'chua_xac_minh' }) bhyt_trang_thai: string; // chua_xac_minh | hop_le | khong_co
  @Column({ type: 'text', nullable: true }) ghi_chu_tiep_nhan: string;
  // Tăng mỗi lần bác sĩ ký lại nội dung — giữ dấu vết bản đã ký, không sửa âm thầm
  @Column({ type: 'int', default: 1 }) phien_ban: number;
  @CreateDateColumn() thoi_gian_ky: Date;
  @Column({ type: 'timestamp', nullable: true }) thoi_gian_tiep_nhan: Date;
  @UpdateDateColumn() ngay_cap_nhat: Date;

  @ManyToOne(() => HoSoBenhNhan, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ho_so_id' }) ho_so: HoSoBenhNhan;
  // Lần khám sinh ra yêu cầu — nguồn của chẩn đoán, sinh hiệu, cận lâm sàng
  @ManyToOne(() => LichHen, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'lich_hen_id' }) lich_hen: LichHen;
  @ManyToOne(() => KhoaPhong, { eager: true, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'khoa_id' }) khoa: KhoaPhong;
  @ManyToOne(() => NguoiDung, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'bac_si_id' }) bac_si: NguoiDung;
  // Lễ tân đã "Tiếp nhận" hồ sơ — chống hai người cùng xử lý một yêu cầu
  @ManyToOne(() => NguoiDung, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'nguoi_tiep_nhan_id' }) nguoi_tiep_nhan: NguoiDung;
}

@Entity('dot_noi_tru')
export class DotNoiTru {
  @PrimaryGeneratedColumn() id: number;
  @Column({ unique: true }) so_vao_vien: string;
  @Column({ default: 'dang_dieu_tri' }) trang_thai: string; // dang_dieu_tri | da_ra_vien
  @Column({ default: 'vien_phi' }) doi_tuong_tt: string;    // bhyt | vien_phi | bao_lanh
  // chua_xac_minh | hop_le | khong_co — cấp cứu được vào khoa khi chưa xác minh
  @Column({ default: 'chua_xac_minh' }) bhyt_trang_thai: string;
  @Column({ type: 'text', nullable: true }) ghi_chu: string;
  @CreateDateColumn() thoi_gian_vao: Date;
  @Column({ type: 'timestamp', nullable: true }) thoi_gian_khoa_nhan: Date;
  @Column({ type: 'timestamp', nullable: true }) thoi_gian_ra: Date;
  @UpdateDateColumn() ngay_cap_nhat: Date;

  // Một yêu cầu chỉ tạo được MỘT đợt nội trú (ràng buộc chống trùng của tài liệu)
  @OneToOne(() => YeuCauNhapVien, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'yeu_cau_id' }) yeu_cau: YeuCauNhapVien;
  @ManyToOne(() => HoSoBenhNhan, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ho_so_id' }) ho_so: HoSoBenhNhan;
  @ManyToOne(() => KhoaPhong, { eager: true, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'khoa_id' }) khoa: KhoaPhong;
  @ManyToOne(() => Giuong, { eager: true, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'giuong_id' }) giuong: Giuong;
  @ManyToOne(() => NguoiDung, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'nguoi_lam_thu_tuc_id' }) nguoi_lam_thu_tuc: NguoiDung;
  // Người của khoa xác nhận đã nhận bệnh nhân (bác sĩ khoa — hệ thống chưa có
  // vai trò điều dưỡng riêng)
  @ManyToOne(() => NguoiDung, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'nguoi_khoa_nhan_id' }) nguoi_khoa_nhan: NguoiDung;
}
