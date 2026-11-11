import { IsBoolean } from "class-validator";
export class UpdateSoftwareStatusDto { @IsBoolean() isActive!: boolean; }
