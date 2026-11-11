import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { AssetsController } from "./assets.controller";
import { AssetsService } from "./assets.service";
import { Asset } from "./entities/asset.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Asset]), AuditLogsModule],
  controllers: [AssetsController],
  providers: [AssetsService],
  exports: [AssetsService],
})
export class AssetsModule {}
