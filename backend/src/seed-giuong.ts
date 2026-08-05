import './env';
import { DataSource } from 'typeorm';
import { dbConfig, ENTITIES } from './data-source.config';
import { Giuong, KhoaPhong } from './entities';

// ============================================================================
//  MỞ DANH MỤC PHÒNG/GIƯỜNG NỘI TRÚ cho mọi khoa đang có trong hệ thống.
//  Chạy: npm run seed:giuong
//
//  Idempotent: khớp theo (khoa, mã giường). Giường đã có thì GIỮ NGUYÊN trạng
//  thái — không bao giờ đẩy giường đang có người bệnh về "trống". Chỉ tạo thêm
//  giường còn thiếu. Số phòng/giường mặc định là bộ khởi tạo để dùng thử; bệnh
//  viện tự cấu hình lại ở màn hình Quản trị → Danh mục giường.
// ============================================================================

const SO_PHONG = 3;      // mỗi khoa mở 3 phòng
const GIUONG_MOI_PHONG = 4;

async function chay() {
  const ds = new DataSource({ ...dbConfig, entities: ENTITIES, synchronize: false });
  await ds.initialize();
  const khoas = await ds.getRepository(KhoaPhong).find({ order: { id: 'ASC' } });
  const repo = ds.getRepository(Giuong);

  let them = 0;
  let boQua = 0;
  for (const [i, khoa] of khoas.entries()) {
    const tang = i + 2;   // Khoa 1 ở tầng 2, khoa 2 ở tầng 3...
    for (let p = 1; p <= SO_PHONG; p++) {
      const phong = `P${tang}${String(p).padStart(2, '0')}`;
      for (let g = 1; g <= GIUONG_MOI_PHONG; g++) {
        const maG = `${phong}-G${g}`;
        const cu = await repo.findOne({ where: { khoa: { id: khoa.id }, ma: maG } });
        if (cu) { boQua++; continue; }
        await repo.save(repo.create({
          ma: maG, phong, loai: g === GIUONG_MOI_PHONG ? 'dich_vu' : 'thuong',
          trang_thai: 'trong', hoat_dong: true, khoa: { id: khoa.id } as any,
        }));
        them++;
      }
    }
  }

  const tong = await repo.count();
  console.log(`Danh muc giuong: them ${them}, giu nguyen ${boQua}, tong ${tong} giuong / ${khoas.length} khoa.`);
  await ds.destroy();
}

chay().catch((e) => {
  console.error('Mo danh muc giuong that bai:', e.message);
  process.exit(1);
});
