import { Transform, Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";
import { AcknowledgementStatus } from "../entities/acknowledgement.entity";

const emptyToNull = ({ value }: { value: unknown }) =>
  typeof value === "string" && value.trim() === "" ? null : value;

export class CreateAcknowledgementDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  reference!: string;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(100)
  assetTag?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId?: number | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(150)
  employeeName?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsDateString()
  issuedDate?: string | null;

  @IsEnum(AcknowledgementStatus)
  status!: AcknowledgementStatus;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}
