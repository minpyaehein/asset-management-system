import { Transform } from "class-transformer";
import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from "class-validator";
import { TransferStatus } from "../entities/asset-transfer.entity";

const emptyToNull = ({ value }: { value: unknown }) =>
  typeof value === "string" && value.trim() === "" ? null : value;

export class CreateAssetTransferDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  @Matches(/^[A-Za-z0-9._-]+$/, {
    message: "Transfer ID can contain letters, numbers, dots, underscores, and hyphens only.",
  })
  transferId!: string;

  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(100)
  assetTag?: string | null;

  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(150)
  fromLocation?: string | null;

  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(150)
  toLocation?: string | null;

  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(150)
  requestedBy?: string | null;

  @IsOptional() @Transform(emptyToNull) @IsDateString()
  date?: string | null;

  @IsEnum(TransferStatus)
  status!: TransferStatus;
}
