import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { Asset } from "../assets/entities/asset.entity";
import { RolePermission } from "../roles/entities/role-permission.entity";
import { Role } from "../roles/entities/role.entity";
import { User } from "../users/entities/user.entity";
import { AssetDisposalsController } from "./asset-disposals.controller";
import { AssetDisposalsService } from "./asset-disposals.service";
import { AssetDisposal } from "./entities/asset-disposal.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AssetDisposal,
      Asset,
      User,
      Role,
      RolePermission,
    ]),
    AuditLogsModule,
  ],
  controllers: [AssetDisposalsController],
  providers: [AssetDisposalsService],
  exports: [AssetDisposalsService],
})
export class AssetDisposalsModule {}
