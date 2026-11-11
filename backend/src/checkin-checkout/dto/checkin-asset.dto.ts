import { IsOptional, IsString, MaxLength } from "class-validator";

export class CheckinAssetDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}
