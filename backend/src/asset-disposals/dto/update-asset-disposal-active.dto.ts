import { IsBoolean } from "class-validator";

export class UpdateAssetDisposalActiveDto {
  @IsBoolean()
  isActive!: boolean;
}
