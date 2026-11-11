import { IsBoolean } from "class-validator";

export class UpdateMaintenanceActiveDto {
  @IsBoolean()
  isActive!: boolean;
}
