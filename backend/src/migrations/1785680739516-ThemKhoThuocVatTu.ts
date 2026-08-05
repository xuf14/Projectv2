import { MigrationInterface, QueryRunner } from "typeorm";

export class ThemKhoThuocVatTu1785680739516 implements MigrationInterface {
    name = 'ThemKhoThuocVatTu1785680739516'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "thuoc" ("id" SERIAL NOT NULL, "ma_thuoc" character varying NOT NULL, "hoat_chat" character varying NOT NULL, "nhom" character varying, "kiem_soat" character varying, "ung_dung" text, "dvt" character varying, "don_gia" integer NOT NULL DEFAULT '0', "hoat_dong" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_6535a11a29950c398717cf242bc" UNIQUE ("ma_thuoc"), CONSTRAINT "PK_4a02117fa72d505c81054ce1c7b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "ton_kho" ("id" SERIAL NOT NULL, "loai" character varying NOT NULL, "ma" character varying NOT NULL, "ten" character varying NOT NULL, "dvt" character varying, "don_gia" integer NOT NULL DEFAULT '0', "so_luong" double precision NOT NULL DEFAULT '0', "ton_toi_thieu" double precision NOT NULL DEFAULT '0', "hoat_dong" boolean NOT NULL DEFAULT true, "ngay_cap_nhat" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "uq_ton_kho_loai_ma" UNIQUE ("loai", "ma"), CONSTRAINT "PK_116b642036cbb1857c85d7b9a07" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "nhat_ky_kho" ("id" SERIAL NOT NULL, "loai_gd" character varying NOT NULL, "so_luong" double precision NOT NULL, "ton_truoc" double precision NOT NULL, "ton_sau" double precision NOT NULL, "ma_phieu" character varying, "ghi_chu" text, "thoi_gian" TIMESTAMP NOT NULL DEFAULT now(), "ton_kho_id" integer, "nguoi_dung_id" integer, CONSTRAINT "PK_30f7589e62d11b18a8680abc402" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "nhat_ky_kho" ADD CONSTRAINT "FK_e402e993130b53f12a806e28f4a" FOREIGN KEY ("ton_kho_id") REFERENCES "ton_kho"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "nhat_ky_kho" ADD CONSTRAINT "FK_376c50a3bc38b61bad40713f3de" FOREIGN KEY ("nguoi_dung_id") REFERENCES "nguoi_dung"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "nhat_ky_kho" DROP CONSTRAINT "FK_376c50a3bc38b61bad40713f3de"`);
        await queryRunner.query(`ALTER TABLE "nhat_ky_kho" DROP CONSTRAINT "FK_e402e993130b53f12a806e28f4a"`);
        await queryRunner.query(`DROP TABLE "nhat_ky_kho"`);
        await queryRunner.query(`DROP TABLE "ton_kho"`);
        await queryRunner.query(`DROP TABLE "thuoc"`);
    }

}
