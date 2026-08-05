import { MigrationInterface, QueryRunner } from "typeorm";

export class ThemBangVatTuTieuHao1785609363758 implements MigrationInterface {
    name = 'ThemBangVatTuTieuHao1785609363758'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "vat_tu_tieu_hao" ("id" SERIAL NOT NULL, "ma_vt" character varying NOT NULL, "ten" character varying NOT NULL, "nhom_id" integer NOT NULL, "nhom_ten" character varying NOT NULL, "khoa" text, "dvt" character varying, "don_gia" integer NOT NULL DEFAULT '0', "ghi_chu" text, "hoat_dong" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_be1726b0c6f127bd3e92114db85" UNIQUE ("ma_vt"), CONSTRAINT "PK_046158593919ee069c370e3b80e" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "vat_tu_tieu_hao"`);
    }

}
