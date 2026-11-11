import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { Employee } from "../employees/entities/employee.entity";
import { RolePermission } from "../roles/entities/role-permission.entity";
import { Role } from "../roles/entities/role.entity";
import { User } from "../users/entities/user.entity";
import { Acknowledgement } from "./entities/acknowledgement.entity";
import { AcknowledgementsController } from "./acknowledgements.controller";
import { AcknowledgementsService } from "./acknowledgements.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Acknowledgement,
      Employee,
      User,
      Role,
      RolePermission,
    ]),
    AuditLogsModule,
  ],
  controllers: [AcknowledgementsController],
  providers: [AcknowledgementsService],
  exports: [AcknowledgementsService],
})
export class AcknowledgementsModule {}
