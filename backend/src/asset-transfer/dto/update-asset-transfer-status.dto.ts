import { IsBoolean } from "class-validator";
export class UpdateAssetTransferStatusDto { @IsBoolean() isActive!: boolean; }
