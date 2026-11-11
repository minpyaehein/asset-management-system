import { Transform } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";
import { AssetDisposalStatus } from "../entities/asset-disposal.entity";

const emptyToNull = ({ value }: { value: unknown }) =>
  typeof value === "string" && value.trim() === "" ? null : value;

export class CreateAssetDisposalDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  @Matches(/^[A-Za-z0-9._-]+$/, {
    message: "Disposal ID can contain letters, numbers, dots, underscores, and hyphens only.",
  })
  disposalId!: string;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(100)
  assetTag?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(1000)
  reason?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(150)
  requestedBy?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsDateString()
  date?: string | null;

  @IsEnum(AssetDisposalStatus)
  status!: AssetDisposalStatus;
}
