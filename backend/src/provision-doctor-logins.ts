import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { NguoiDung, BacSi, VaiTro } from './entities';
import { dbConfig } from './data-source.config';

// Cấp tài khoản đăng nhập cho MỌI bác sĩ và đặt mật khẩu chung '123456'.
// Idempotent — chạy lại an toàn, KHÔNG xóa dữ liệu. Mỗi bác sĩ có email
// đăng nhập cố định `bacsi{id}@demo.vn` (cổng đăng nhập bác sĩ dùng đúng
// công thức này cho ô chọn nhanh). Cổng bác sĩ nhận diện bác sĩ qua
// bac_si.nguoi_dung nên tài khoản phải được liên kết đúng hồ sơ.
async function provision() {
  const ds = new DataSource({ ...dbConfig, synchronize: false, logging: false });
  await ds.initialize();
  try {
    const hash = await bcrypt.hash('123456', 10);
    const repoBS = ds.getRepository(BacSi);
    const repoND = ds.getRepository(NguoiDung);

    const dsBacSi = await repoBS.find({ relations: ['nguoi_dung'] });
    let taoMoi = 0;
    let lienKet = 0;

    for (const bs of dsBacSi) {
      const email = `bacsi${bs.id}@demo.vn`;
      let acc = await repoND.findOne({ where: { email } });
      if (!acc) {
        acc = await repoND.save(
          repoND.create({
            ho_ten: bs.ho_ten,
            email,
            mat_khau_hash: hash,
            vai_tro: VaiTro.BAC_SI,
            trang_thai: true,
          }),
        );
        taoMoi++;
      } else {
        // giữ đồng bộ họ tên & vai trò, mật khẩu sẽ đặt lại ở bước dưới
        acc.ho_ten = bs.ho_ten;
        acc.vai_tro = VaiTro.BAC_SI;
        acc.trang_thai = true;
        await repoND.save(acc);
      }
      if (!bs.nguoi_dung || bs.nguoi_dung.id !== acc.id) {
        bs.nguoi_dung = acc;
        await repoBS.save(bs);
        lienKet++;
      }
    }

    // Đặt lại mật khẩu '123456' cho TẤT CẢ tài khoản vai trò bác sĩ
    // (gồm cả tài khoản demo cũ bacsi@demo.vn). Update tham số hóa qua ORM.
    const kq = await repoND.update({ vai_tro: VaiTro.BAC_SI }, { mat_khau_hash: hash });

    console.log('✅ Cấp tài khoản bác sĩ xong.');
    console.log(`   - Bác sĩ trong hệ thống: ${dsBacSi.length}`);
    console.log(`   - Tài khoản tạo mới:     ${taoMoi}`);
    console.log(`   - Liên kết bác sĩ↔TK:    ${lienKet}`);
    console.log(`   - Đặt lại mật khẩu (123456) cho tài khoản bác sĩ: ${kq.affected ?? '?'}`);
    console.log('   Email đăng nhập: bacsi{id}@demo.vn — vd bacsi1@demo.vn, bacsi2@demo.vn ...');
  } finally {
    await ds.destroy();
  }
}

provision().catch((e) => {
  console.error('❌ Lỗi cấp tài khoản bác sĩ:', e.message);
  process.exit(1);
});
