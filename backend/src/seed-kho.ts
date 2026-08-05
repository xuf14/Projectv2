import './env';
import { DataSource } from 'typeorm';
import { dbConfig, ENTITIES } from './data-source.config';
import { Thuoc, VatTuTieuHao, TonKho } from './entities';
import { DANH_MUC_THUOC } from './danh-muc-thuoc';

// ============================================================================
//  NẠP DANH MỤC THUỐC (bảng `thuoc`) và MỞ THẺ KHO cho tủ thuốc + tủ vật tư.
//  Chạy: npm run seed:kho
//
//  Idempotent:
//  - Thuốc khớp theo ma_thuoc: có thì cập nhật mô tả, chưa có thì thêm mới.
//    KHÔNG ghi đè don_gia / hoat_dong (bệnh viện tự cấu hình sau khi duyệt giá).
//  - Thẻ kho khớp theo (loai, ma): chỉ TẠO thẻ còn thiếu với tồn 0.
//    KHÔNG bao giờ đụng vào so_luong của thẻ đã có — số tồn chỉ thay đổi qua
//    nhập kho / xuất theo phiếu y lệnh / điều chỉnh kiểm kê.
//
//  Muốn nạp sẵn một mức tồn ban đầu cho các thẻ MỚI TẠO (dựng môi trường demo):
//    TON_BAN_DAU=100 npm run seed:kho
// ============================================================================

async function chay() {
  const tonBanDau = Math.max(0, Number(process.env.TON_BAN_DAU) || 0);
  const ds = new DataSource({ ...dbConfig, entities: ENTITIES, synchronize: false });
  await ds.initialize();

  // --- 1. Danh mục thuốc ---
  const thuocRepo = ds.getRepository(Thuoc);
  let themThuoc = 0;
  let capNhatThuoc = 0;
  for (const t of DANH_MUC_THUOC) {
    const cu = await thuocRepo.findOne({ where: { ma_thuoc: t.ma_thuoc } });
    if (cu) {
      cu.hoat_chat = t.hoat_chat;
      cu.nhom = t.nhom;
      cu.kiem_soat = t.kiem_soat;
      cu.ung_dung = t.ung_dung;
      if (!cu.dvt) cu.dvt = t.dvt;
      await thuocRepo.save(cu);
      capNhatThuoc++;
    } else {
      await thuocRepo.save(thuocRepo.create({
        ma_thuoc: t.ma_thuoc, hoat_chat: t.hoat_chat, nhom: t.nhom,
        kiem_soat: t.kiem_soat, ung_dung: t.ung_dung, dvt: t.dvt,
        don_gia: 0, hoat_dong: true,
      }));
      themThuoc++;
    }
  }

  // --- 2. Thẻ kho cho từng mặt hàng của hai tủ ---
  const khoRepo = ds.getRepository(TonKho);
  const moThe = async (loai: string, ma: string, ten: string, dvt: string, don_gia: number) => {
    const cu = await khoRepo.findOne({ where: { loai, ma } });
    if (cu) return false;
    await khoRepo.save(khoRepo.create({
      loai, ma, ten, dvt: dvt || null, don_gia, so_luong: tonBanDau, ton_toi_thieu: 0, hoat_dong: true,
    }));
    return true;
  };

  let theMoi = 0;
  for (const t of await thuocRepo.find({ order: { ma_thuoc: 'ASC' } }))
    if (await moThe('thuoc', t.ma_thuoc, t.hoat_chat, t.dvt, t.don_gia)) theMoi++;
  for (const v of await ds.getRepository(VatTuTieuHao).find({ order: { id: 'ASC' } }))
    if (await moThe('vat_tu', v.ma_vt, v.ten, v.dvt, v.don_gia)) theMoi++;

  const tongThe = await khoRepo.count();
  console.log(`Danh muc thuoc: them ${themThuoc}, cap nhat ${capNhatThuoc}.`);
  console.log(`The kho: tao moi ${theMoi} (ton ban dau ${tonBanDau}), tong ${tongThe} the.`);
  await ds.destroy();
}

chay().catch((e) => {
  console.error('Nap kho that bai:', e.message);
  process.exit(1);
});
