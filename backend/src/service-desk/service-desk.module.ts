import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { RolePermission } from "../roles/entities/role-permission.entity";
import { Role } from "../roles/entities/role.entity";
import { User } from "../users/entities/user.entity";
import { ServiceDeskTicket } from "./entities/service-desk-ticket.entity";
import { ServiceDeskController } from "./service-desk.controller";
import { ServiceDeskService } from "./service-desk.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ServiceDeskTicket,
      User,
      Role,
      RolePermission,
    ]),
    AuditLogsModule,
  ],
  controllers: [ServiceDeskController],
  providers: [ServiceDeskService],
  exports: [ServiceDeskService],
})
export class ServiceDeskModule {}
