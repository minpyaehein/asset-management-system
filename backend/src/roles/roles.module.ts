import { Module } from "@nestjs/common";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RolePermission } from "./entities/role-permission.entity";
import { Role } from "./entities/role.entity";
import { RolesController } from "./roles.controller";
import { RolesService } from "./roles.service";

@Module({
  imports: [TypeOrmModule.forFeature([Role, RolePermission]), AuditLogsModule, NotificationsModule],
  controllers: [RolesController],
  providers: [RolesService],
  exports: [RolesService],
})
export class RolesModule {}
