import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { Asset } from "../assets/entities/asset.entity";
import { RolePermission } from "../roles/entities/role-permission.entity";
import { Role } from "../roles/entities/role.entity";
import { User } from "../users/entities/user.entity";
import { MaintenanceRecord } from "./entities/maintenance-record.entity";
import { MaintenanceCenterController } from "./maintenance-center.controller";
import { MaintenanceCenterService } from "./maintenance-center.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MaintenanceRecord,
      Asset,
      User,
      Role,
      RolePermission,
    ]),
    AuditLogsModule,
  ],
  controllers: [MaintenanceCenterController],
  providers: [MaintenanceCenterService],
  exports: [MaintenanceCenterService],
})
export class MaintenanceCenterModule {}
