import { MigrationInterface, QueryRunner } from "typeorm";

export class ThemDonThuocJson1785596702425 implements MigrationInterface {
    name = 'ThemDonThuocJson1785596702425'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "don_thuoc" ADD "danh_sach_json" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "don_thuoc" DROP COLUMN "danh_sach_json"`);
    }

}
