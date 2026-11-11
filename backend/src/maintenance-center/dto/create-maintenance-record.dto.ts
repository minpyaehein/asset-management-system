import { Transform, Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from "class-validator";
import { MaintenanceTab } from "../entities/maintenance-record.entity";

const emptyToNull = ({ value }: { value: unknown }) =>
  typeof value === "string" && value.trim() === "" ? null : value;

export class CreateMaintenanceRecordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  @Matches(/^[A-Za-z0-9._-]+$/)
  recordCode!: string;

  @IsEnum(MaintenanceTab)
  tab!: MaintenanceTab;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  assetTag!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  type!: string;

  @IsDateString()
  date!: string;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(150)
  technician?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(50)
  status?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  cost?: number | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(2000)
  detail?: string | null;
}
