import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import {
  NguoiDung, KhoaPhong, BacSi, DichVu, HoSoBenhNhan, KhungGio, LichHen, LuotKham, DonThuoc, TinTuc, VaiTro,
} from './entities';
import { dbConfig, ENTITIES } from './data-source.config';

async function seed() {
  const ds = new DataSource(dbConfig);
  await ds.initialize();

  // Xóa sạch dữ liệu cũ (TRUNCATE ... CASCADE để bỏ qua ràng buộc khóa ngoại)
  const tables = ds.entityMetadatas.map((m) => `"${m.tableName}"`).join(', ');
  await ds.query(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);

  const hash = await bcrypt.hash('123456', 10);

  // --- Tài khoản demo 4 vai trò ---
  const users = await ds.getRepository(NguoiDung).save([
    { ho_ten: 'Trần Mai Phương', sdt: '0912345678', email: 'benhnhan@demo.vn', mat_khau_hash: hash, vai_tro: VaiTro.BENH_NHAN },
    { ho_ten: 'Lễ tân Nguyễn Hoa', sdt: '0900000001', email: 'letan@demo.vn', mat_khau_hash: hash, vai_tro: VaiTro.LE_TAN },
    { ho_ten: 'BS.CKII Nguyễn Thị Lan', sdt: '0900000002', email: 'bacsi@demo.vn', mat_khau_hash: hash, vai_tro: VaiTro.BAC_SI },
    { ho_ten: 'Quản trị viên', sdt: '0900000003', email: 'admin@demo.vn', mat_khau_hash: hash, vai_tro: VaiTro.ADMIN },
  ]);

  // --- Khoa phòng ---
  const khoa = await ds.getRepository(KhoaPhong).save([
    { ten_khoa: 'Khoa Sản', ma: 'san', mo_ta: 'Theo dõi thai kỳ, sinh thường & sinh mổ, chăm sóc sau sinh.', vi_tri: 'Tầng 2, Tòa A' },
    { ten_khoa: 'Khoa Phụ', ma: 'phu', mo_ta: 'Khám và điều trị bệnh lý phụ khoa, tầm soát ung thư.', vi_tri: 'Tầng 3, Tòa A' },
    { ten_khoa: 'Hỗ trợ sinh sản (IVF)', ma: 'ivf', mo_ta: 'Tư vấn hiếm muộn, thụ tinh ống nghiệm, IUI.', vi_tri: 'Tầng 4, Tòa B' },
    { ten_khoa: 'Sơ sinh', ma: 'sosinh', mo_ta: 'Chăm sóc & hồi sức sơ sinh, sàng lọc sau sinh.', vi_tri: 'Tầng 1, Tòa B' },
  ]);

  // --- Bác sĩ ---
  const bacSi = await ds.getRepository(BacSi).save([
    { ho_ten: 'BS.CKII Nguyễn Thị Lan', hoc_ham: 'BS.CKII', chuyen_mon: 'Sản khoa', so_nam_kn: 22, danh_gia: 4.9, khoa: khoa[0] },
    { ho_ten: 'BS.CKI Trần Văn Minh', hoc_ham: 'BS.CKI', chuyen_mon: 'Sản khoa', so_nam_kn: 12, danh_gia: 4.7, khoa: khoa[0] },
    { ho_ten: 'TS.BS Phạm Thu Hà', hoc_ham: 'TS.BS', chuyen_mon: 'Phụ khoa', so_nam_kn: 18, danh_gia: 4.8, khoa: khoa[1] },
    { ho_ten: 'BS.CKII Lê Hữu Phúc', hoc_ham: 'BS.CKII', chuyen_mon: 'IVF', so_nam_kn: 15, danh_gia: 4.9, khoa: khoa[2] },
    { ho_ten: 'BS.CKI Vũ Mai Anh', hoc_ham: 'BS.CKI', chuyen_mon: 'Sơ sinh', so_nam_kn: 10, danh_gia: 4.6, khoa: khoa[3] },
  ]);

  // --- Tài khoản đăng nhập riêng cho từng bác sĩ (mật khẩu 123456) ---
  // Email cố định bacsi{id}@demo.vn khớp ô chọn nhanh ở cổng đăng nhập bác sĩ;
  // liên kết bac_si.nguoi_dung để cổng bác sĩ nhận diện đúng hồ sơ.
  for (const bs of bacSi) {
    const acc = await ds.getRepository(NguoiDung).save({
      ho_ten: bs.ho_ten, email: `bacsi${bs.id}@demo.vn`, mat_khau_hash: hash, vai_tro: VaiTro.BAC_SI,
    });
    bs.nguoi_dung = acc;
  }
  await ds.getRepository(BacSi).save(bacSi);

  // --- Dịch vụ ---
  await ds.getRepository(DichVu).save([
    { ten_dich_vu: 'Khám thai định kỳ', gia: 200000, khoa: khoa[0] },
    { ten_dich_vu: 'Siêu âm 4D', gia: 350000, khoa: khoa[0] },
    { ten_dich_vu: 'Tầm soát ung thư cổ tử cung', gia: 500000, khoa: khoa[1] },
    { ten_dich_vu: 'Tư vấn hiếm muộn', gia: 300000, khoa: khoa[2] },
  ]);

  // --- Khung giờ (7 ngày tới cho mỗi bác sĩ) ---
  const gio = ['07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '13:30', '14:00', '14:30', '15:00'];
  const slots: Partial<KhungGio>[] = [];
  for (const bs of bacSi) {
    for (let d = 1; d <= 7; d++) {
      const date = new Date(); date.setDate(date.getDate() + d);
      const ngay = date.toISOString().slice(0, 10);
      for (const g of gio) {
        const [h, m] = g.split(':').map(Number);
        const end = `${h}:${(m + 30) % 60 === 0 && m === 30 ? h + 1 : h}:00`.slice(0, 5);
        slots.push({ ngay, gio_bat_dau: g, gio_ket_thuc: g, so_luong: 5, da_dat: Math.floor(Math.random() * 3), bac_si: bs });
      }
    }
  }
  await ds.getRepository(KhungGio).save(slots);

  // --- Tin tức ---
  await ds.getRepository(TinTuc).save([
    { tieu_de: '10 dấu hiệu chuyển dạ mẹ bầu cần biết', tag: 'Cẩm nang', noi_dung: 'Nội dung bài viết...' },
    { tieu_de: 'Lịch khám thai theo yêu cầu dịp hè 2026', tag: 'Thông báo', noi_dung: 'Nội dung bài viết...' },
    { tieu_de: 'Chế độ ăn cho mẹ trong tam cá nguyệt đầu', tag: 'Dinh dưỡng', noi_dung: 'Nội dung bài viết...' },
  ]);

  console.log('✅ Seed dữ liệu thành công!');
  console.log('   Tài khoản demo (mật khẩu: 123456):');
  console.log('   - Bệnh nhân:  benhnhan@demo.vn');
  console.log('   - Lễ tân:     letan@demo.vn');
  console.log('   - Bác sĩ:     bacsi@demo.vn');
  console.log('   - Admin:      admin@demo.vn');
  await ds.destroy();
}

seed().catch((e) => { console.error(e); process.exit(1); });
