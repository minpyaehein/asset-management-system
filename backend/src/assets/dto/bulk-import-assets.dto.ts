import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayNotEmpty, IsArray, ValidateNested } from "class-validator";
import { CreateAssetDto } from "./create-asset.dto";

export class BulkImportAssetsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => CreateAssetDto)
  assets!: CreateAssetDto[];
}
