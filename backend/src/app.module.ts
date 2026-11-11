import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesModule } from './roles/roles.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { AssetsModule } from './assets/assets.module';
import { EmployeesModule } from './employees/employees.module';
import { CheckinCheckoutModule } from './checkin-checkout/checkin-checkout.module';
import { SoftwareManagementModule } from './software-management/software-management.module';
import { ServiceDeskModule } from './service-desk/service-desk.module';
import { AssetTransferModule } from './asset-transfer/asset-transfer.module';
import { AcknowledgementsModule } from './acknowledgements/acknowledgements.module';
import { AssetDisposalsModule } from './asset-disposals/asset-disposals.module';
import { MaintenanceCenterModule } from './maintenance-center/maintenance-center.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { NotificationsModule } from "./notifications/notifications.module";
import {
  DashboardModule,
} from "./dashboard/dashboard.module";
import {
  ReportsModule,
} from "./reports/reports.module";


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],

      useFactory: (configService: ConfigService) => ({
        type: 'postgres' as const,
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: Number(configService.get<string>('DB_PORT', '5432')),
        username: configService.get<string>('DB_USERNAME', 'postgres'),
        password: configService.get<string>('DB_PASSWORD', ''),
        database: configService.get<string>('DB_NAME', 'asset_management'),
        autoLoadEntities: true,
        synchronize: false,
        logging: true,
      }),
    }),

    RolesModule,
    UsersModule,
    AuthModule,
    AssetsModule,
    EmployeesModule,
    CheckinCheckoutModule,
    SoftwareManagementModule,
    ServiceDeskModule,
    AssetTransferModule,
    AcknowledgementsModule,
    AssetDisposalsModule,
    MaintenanceCenterModule,
    AuditLogsModule,
    NotificationsModule,
    DashboardModule,
    ReportsModule,

  ],
})
export class AppModule {}
