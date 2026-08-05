import './env';
import { DataSource } from 'typeorm';
import { dbConfig, ENTITIES } from './data-source.config';
import { VatTuTieuHao } from './entities';
import { NHOM_VAT_TU, DANH_MUC_VAT_TU } from './danh-muc-vat-tu';

// ============================================================================
//  NẠP DANH MỤC VẬT TƯ TIÊU HAO vào bảng vat_tu_tieu_hao.
//  Chạy: npm run seed:vat-tu
//
//  Idempotent: khớp theo ma_vt, có thì cập nhật tên/nhóm/khoa/ghi chú, chưa có
//  thì thêm mới. KHÔNG xóa bản ghi nào và KHÔNG ghi đè don_gia / dvt / hoat_dong
//  vì đó là số liệu bệnh viện tự cấu hình sau khi phê duyệt giá.
// ============================================================================

async function chay() {
  const ds = new DataSource({ ...dbConfig, entities: ENTITIES, synchronize: false });
  await ds.initialize();
  const repo = ds.getRepository(VatTuTieuHao);
  const tenNhom = new Map(NHOM_VAT_TU.map((n) => [n.id, n]));

  let them = 0;
  let capNhat = 0;
  for (const v of DANH_MUC_VAT_TU) {
    const nhom = tenNhom.get(v.nhom);
    if (!nhom) throw new Error(`Vật tư "${v.ten}" thuộc nhóm ${v.nhom} không có trong NHOM_VAT_TU`);
    const ma_vt = `VT${v.stt}`;
    const cu = await repo.findOne({ where: { ma_vt } });
    if (cu) {
      cu.ten = v.ten;
      cu.nhom_id = nhom.id;
      cu.nhom_ten = nhom.ten;
      cu.khoa = nhom.khoa;
      cu.ghi_chu = v.ghi_chu;
      await repo.save(cu);
      capNhat++;
    } else {
      await repo.save(repo.create({
        ma_vt, ten: v.ten, nhom_id: nhom.id, nhom_ten: nhom.ten,
        khoa: nhom.khoa, ghi_chu: v.ghi_chu, don_gia: 0, hoat_dong: true,
      }));
      them++;
    }
  }

  const tong = await repo.count();
  console.log(`Danh muc vat tu tieu hao: them ${them}, cap nhat ${capNhat}, tong ${tong} ban ghi.`);
  await ds.destroy();
}

chay().catch((e) => {
  console.error('Nap danh muc vat tu that bai:', e.message);
  process.exit(1);
});
