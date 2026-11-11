import { IsEnum } from "class-validator";
import { AssetStatus } from "../entities/asset.entity";

export class UpdateAssetStatusDto {
  @IsEnum(AssetStatus)
  status!: AssetStatus;
}
