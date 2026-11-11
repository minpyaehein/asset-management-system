import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { Asset } from "../assets/entities/asset.entity";
import { Employee } from "../employees/entities/employee.entity";
import { RolePermission } from "../roles/entities/role-permission.entity";
import { Role } from "../roles/entities/role.entity";
import { User } from "../users/entities/user.entity";
import { CheckinCheckoutController } from "./checkin-checkout.controller";
import { CheckinCheckoutService } from "./checkin-checkout.service";
import { AssetAllocation } from "./entities/asset-allocation.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AssetAllocation,
      Asset,
      Employee,
      User,
      Role,
      RolePermission,
    ]),
    AuditLogsModule,
  ],
  controllers: [CheckinCheckoutController],
  providers: [CheckinCheckoutService],
  exports: [CheckinCheckoutService],
})
export class CheckinCheckoutModule {}
