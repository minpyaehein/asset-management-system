import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { SoftwareManagementRecord } from "./entities/software-management-record.entity";
import { SoftwareManagementController } from "./software-management.controller";
import { SoftwareManagementService } from "./software-management.service";

@Module({
  imports: [TypeOrmModule.forFeature([SoftwareManagementRecord]), AuditLogsModule],
  controllers: [SoftwareManagementController],
  providers: [SoftwareManagementService],
  exports: [SoftwareManagementService],
})
export class SoftwareManagementModule {}
