import { MigrationInterface, QueryRunner } from "typeorm";

export class ThemNhapVienNoiTru1785747249928 implements MigrationInterface {
    name = 'ThemNhapVienNoiTru1785747249928'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "giuong" ("id" SERIAL NOT NULL, "ma" character varying NOT NULL, "phong" character varying NOT NULL, "loai" character varying NOT NULL DEFAULT 'thuong', "trang_thai" character varying NOT NULL DEFAULT 'trong', "hoat_dong" boolean NOT NULL DEFAULT true, "ngay_cap_nhat" TIMESTAMP NOT NULL DEFAULT now(), "khoa_id" integer, CONSTRAINT "uq_giuong_khoa_ma" UNIQUE ("khoa_id", "ma"), CONSTRAINT "PK_c16697c9300ef009dde3734b090" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "yeu_cau_nhap_vien" ("id" SERIAL NOT NULL, "ma_yeu_cau" character varying NOT NULL, "trang_thai" character varying NOT NULL DEFAULT 'cho_tiep_nhan', "uu_tien" character varying NOT NULL DEFAULT 'thuong', "ly_do_uu_tien" text, "chan_doan_chinh" character varying NOT NULL, "ma_icd" character varying, "ly_do" text NOT NULL, "canh_bao" text, "ho_tro_di_chuyen" character varying NOT NULL DEFAULT 'di_bo', "ngay_du_kien" date, "ly_do_ket_thuc" text, "doi_tuong_tt" character varying NOT NULL DEFAULT 'vien_phi', "bhyt_trang_thai" character varying NOT NULL DEFAULT 'chua_xac_minh', "ghi_chu_tiep_nhan" text, "phien_ban" integer NOT NULL DEFAULT '1', "thoi_gian_ky" TIMESTAMP NOT NULL DEFAULT now(), "thoi_gian_tiep_nhan" TIMESTAMP, "ngay_cap_nhat" TIMESTAMP NOT NULL DEFAULT now(), "ho_so_id" integer, "lich_hen_id" integer, "khoa_id" integer, "bac_si_id" integer, "nguoi_tiep_nhan_id" integer, CONSTRAINT "UQ_6a4370671d0e4359baf2562edcd" UNIQUE ("ma_yeu_cau"), CONSTRAINT "PK_b162d754a9038df5ea34378e899" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "dot_noi_tru" ("id" SERIAL NOT NULL, "so_vao_vien" character varying NOT NULL, "trang_thai" character varying NOT NULL DEFAULT 'dang_dieu_tri', "doi_tuong_tt" character varying NOT NULL DEFAULT 'vien_phi', "bhyt_trang_thai" character varying NOT NULL DEFAULT 'chua_xac_minh', "ghi_chu" text, "thoi_gian_vao" TIMESTAMP NOT NULL DEFAULT now(), "thoi_gian_khoa_nhan" TIMESTAMP, "thoi_gian_ra" TIMESTAMP, "ngay_cap_nhat" TIMESTAMP NOT NULL DEFAULT now(), "yeu_cau_id" integer, "ho_so_id" integer, "khoa_id" integer, "giuong_id" integer, "nguoi_lam_thu_tuc_id" integer, "nguoi_khoa_nhan_id" integer, CONSTRAINT "UQ_741628ad8c7fe185c20d8cacbf4" UNIQUE ("so_vao_vien"), CONSTRAINT "REL_46a28f34841f960a757940bf24" UNIQUE ("yeu_cau_id"), CONSTRAINT "PK_93bc579f67edef862d932e23116" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "giuong" ADD CONSTRAINT "FK_d5890bcc4a4ee7fc79cdeaea7ac" FOREIGN KEY ("khoa_id") REFERENCES "khoa_phong"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "yeu_cau_nhap_vien" ADD CONSTRAINT "FK_dc68cc64563353075b1bc91f9ed" FOREIGN KEY ("ho_so_id") REFERENCES "ho_so_benh_nhan"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "yeu_cau_nhap_vien" ADD CONSTRAINT "FK_3ee3d7222816a93acba45e2daca" FOREIGN KEY ("lich_hen_id") REFERENCES "lich_hen"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "yeu_cau_nhap_vien" ADD CONSTRAINT "FK_16022ac830d2c07f9721ee6f808" FOREIGN KEY ("khoa_id") REFERENCES "khoa_phong"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "yeu_cau_nhap_vien" ADD CONSTRAINT "FK_087cfe7cd197ec28dbd29089b26" FOREIGN KEY ("bac_si_id") REFERENCES "nguoi_dung"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "yeu_cau_nhap_vien" ADD CONSTRAINT "FK_f1def4a2949030c30f5fe2c1886" FOREIGN KEY ("nguoi_tiep_nhan_id") REFERENCES "nguoi_dung"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dot_noi_tru" ADD CONSTRAINT "FK_46a28f34841f960a757940bf244" FOREIGN KEY ("yeu_cau_id") REFERENCES "yeu_cau_nhap_vien"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dot_noi_tru" ADD CONSTRAINT "FK_ecb9b0053478a320090996625b2" FOREIGN KEY ("ho_so_id") REFERENCES "ho_so_benh_nhan"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dot_noi_tru" ADD CONSTRAINT "FK_58a99618f52554135ccd8d180dc" FOREIGN KEY ("khoa_id") REFERENCES "khoa_phong"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dot_noi_tru" ADD CONSTRAINT "FK_9939de48a95cb53fe0ee96d6338" FOREIGN KEY ("giuong_id") REFERENCES "giuong"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dot_noi_tru" ADD CONSTRAINT "FK_a75e4f8ec5b9008d7edc10836f8" FOREIGN KEY ("nguoi_lam_thu_tuc_id") REFERENCES "nguoi_dung"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dot_noi_tru" ADD CONSTRAINT "FK_c116974d0b35c5eb502f7bed5d5" FOREIGN KEY ("nguoi_khoa_nhan_id") REFERENCES "nguoi_dung"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dot_noi_tru" DROP CONSTRAINT "FK_c116974d0b35c5eb502f7bed5d5"`);
        await queryRunner.query(`ALTER TABLE "dot_noi_tru" DROP CONSTRAINT "FK_a75e4f8ec5b9008d7edc10836f8"`);
        await queryRunner.query(`ALTER TABLE "dot_noi_tru" DROP CONSTRAINT "FK_9939de48a95cb53fe0ee96d6338"`);
        await queryRunner.query(`ALTER TABLE "dot_noi_tru" DROP CONSTRAINT "FK_58a99618f52554135ccd8d180dc"`);
        await queryRunner.query(`ALTER TABLE "dot_noi_tru" DROP CONSTRAINT "FK_ecb9b0053478a320090996625b2"`);
        await queryRunner.query(`ALTER TABLE "dot_noi_tru" DROP CONSTRAINT "FK_46a28f34841f960a757940bf244"`);
        await queryRunner.query(`ALTER TABLE "yeu_cau_nhap_vien" DROP CONSTRAINT "FK_f1def4a2949030c30f5fe2c1886"`);
        await queryRunner.query(`ALTER TABLE "yeu_cau_nhap_vien" DROP CONSTRAINT "FK_087cfe7cd197ec28dbd29089b26"`);
        await queryRunner.query(`ALTER TABLE "yeu_cau_nhap_vien" DROP CONSTRAINT "FK_16022ac830d2c07f9721ee6f808"`);
        await queryRunner.query(`ALTER TABLE "yeu_cau_nhap_vien" DROP CONSTRAINT "FK_3ee3d7222816a93acba45e2daca"`);
        await queryRunner.query(`ALTER TABLE "yeu_cau_nhap_vien" DROP CONSTRAINT "FK_dc68cc64563353075b1bc91f9ed"`);
        await queryRunner.query(`ALTER TABLE "giuong" DROP CONSTRAINT "FK_d5890bcc4a4ee7fc79cdeaea7ac"`);
        await queryRunner.query(`DROP TABLE "dot_noi_tru"`);
        await queryRunner.query(`DROP TABLE "yeu_cau_nhap_vien"`);
        await queryRunner.query(`DROP TABLE "giuong"`);
    }

}
