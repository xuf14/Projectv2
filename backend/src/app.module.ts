import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';

import { JwtStrategy, RolesGuard, JWT_SECRET } from './auth';
import { AuthService, AuthController } from './auth.module';
import { CatalogService, CatalogController } from './catalog.module';
import { ApptService, ApptController } from './appointment.module';
import { ProfileService, ProfileController } from './profile.module';
import { DocumentService, DocumentController } from './document.module';
import { UserAdminService, UserAdminController } from './user.module';
import { PaymentService, PaymentController } from './payment.module';
import { PatientInfoService, PatientInfoController } from './patient-info.module';
import { YLenhService, YLenhController } from './y-lenh.module';
import { EncounterService, EncounterController } from './encounter.module';
import { MediaService, MediaController } from './media.module';
import { NotificationService, NotificationController } from './notification.module';
import { ReportService, ReportController } from './report.module';
import { ChatService, ChatController } from './chat.module';
import { IvfService, IvfController } from './ivf.module';
import { DangKyKhamService, DangKyKhamController } from './dang-ky-kham.module';
import { RaVienService, RaVienController } from './ra-vien.module';
import { KhoService, KhoController } from './kho.module';
import { NhapVienService, NhapVienController } from './nhap-vien.module';
import { dbConfig, ENTITIES } from './data-source.config';

@Module({
  imports: [
    TypeOrmModule.forRoot(dbConfig),
    TypeOrmModule.forFeature(ENTITIES),
    PassportModule,
    // Giới hạn tần suất — chỉ áp cho các route "bề mặt tấn công": đăng nhập và
    // đăng ký khám công khai (xem @Throttle ở từng controller), không áp toàn cục
    // để không cản trở màn hình nội bộ tải nhiều dữ liệu.
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    JwtModule.register({ secret: JWT_SECRET, signOptions: { expiresIn: '7d' } }),
  ],
  controllers: [AuthController, CatalogController, ApptController, ProfileController, DocumentController, UserAdminController, PaymentController, PatientInfoController, YLenhController, EncounterController, MediaController, NotificationController, ReportController, ChatController, IvfController, DangKyKhamController, RaVienController, KhoController, NhapVienController],
  providers: [NhapVienService, KhoService,AuthService, CatalogService, ApptService, ProfileService, DocumentService, UserAdminService, PaymentService, PatientInfoService, YLenhService, EncounterService, MediaService, NotificationService, ReportService, ChatService, IvfService, DangKyKhamService, RaVienService, JwtStrategy, RolesGuard],
})
export class AppModule {}
