import './env';
import { DataSource } from 'typeorm';
import { dbConfig } from './data-source.config';

// ============================================================================
//  DataSource dành riêng cho TypeORM CLI (sinh / chạy / hoàn tác migration).
//  Luôn synchronize: false — thay đổi schema chỉ đi qua migration để có lịch sử
//  và có thể hoàn tác, không để TypeORM tự sửa bảng trên dữ liệu thật.
//  Dùng qua các script npm: migration:generate | migration:run | migration:revert
// ============================================================================
export default new DataSource({
  ...dbConfig,
  synchronize: false,
  migrations: ['src/migrations/*.ts'],
  migrationsTableName: 'migrations',
});
