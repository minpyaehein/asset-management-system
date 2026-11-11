import { IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class CheckoutAssetDto {
  @IsInt()
  @Min(1)
  assetId!: number;

  @IsInt()
  @Min(1)
  employeeId!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}
