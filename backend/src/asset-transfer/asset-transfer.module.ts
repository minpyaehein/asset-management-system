import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { RolePermission } from "../roles/entities/role-permission.entity";
import { Role } from "../roles/entities/role.entity";
import { User } from "../users/entities/user.entity";
import { AssetTransferController } from "./asset-transfer.controller";
import { AssetTransferService } from "./asset-transfer.service";
import { AssetTransferRecord } from "./entities/asset-transfer.entity";
@Module({ imports: [TypeOrmModule.forFeature([AssetTransferRecord, User, Role, RolePermission]), AuditLogsModule], controllers: [AssetTransferController], providers: [AssetTransferService], exports: [AssetTransferService] })
export class AssetTransferModule {}
