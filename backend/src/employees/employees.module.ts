import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { Employee } from "./entities/employee.entity";
import { EmployeesController } from "./employees.controller";
import { EmployeesService } from "./employees.service";

@Module({
  imports: [TypeOrmModule.forFeature([Employee]), AuditLogsModule],
  controllers: [EmployeesController],
  providers: [EmployeesService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
