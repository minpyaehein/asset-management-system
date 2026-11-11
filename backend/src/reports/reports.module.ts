import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Asset } from "../assets/entities/asset.entity";
import { MaintenanceRecord } from "../maintenance-center/entities/maintenance-record.entity";
import { RolePermission } from "../roles/entities/role-permission.entity";
import { Role } from "../roles/entities/role.entity";
import { SoftwareManagementRecord } from "../software-management/entities/software-management-record.entity";
import { User } from "../users/entities/user.entity";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";

@Module({
  imports: [TypeOrmModule.forFeature([Asset, SoftwareManagementRecord, MaintenanceRecord, User, Role, RolePermission])],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
