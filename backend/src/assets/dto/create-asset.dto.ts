import { Transform } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";
import { AssetStatus } from "../entities/asset.entity";

const emptyToNull = ({ value }: { value: unknown }) =>
  typeof value === "string" && value.trim() === "" ? null : value;

export class CreateAssetDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  assetTag!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  category!: string;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(100)
  brand?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(100)
  model?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(150)
  serialNumber?: string | null;

  @IsEnum(AssetStatus)
  status!: AssetStatus;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(150)
  assignedTo?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsDateString()
  purchaseDate?: string | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  purchaseCost?: number | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsDateString()
  warrantyEnd?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(150)
  location?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}
