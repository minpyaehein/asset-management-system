import { Transform, Type } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

const emptyToNull = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  return value;
};

export class CreateSoftwareRecordDto {
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(150)
  product?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(150)
  vendor?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(255)
  licenseKey?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  seats?: number | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsDateString()
  expiry?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(100)
  assetTag?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(180)
  license?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsDateString()
  installedDate?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(150)
  installedBy?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(180)
  reference?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(150)
  owner?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsIn(["Active", "Expiring Soon", "Expired", "Inactive"])
  status?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}
