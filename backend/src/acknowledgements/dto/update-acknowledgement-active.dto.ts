import { IsBoolean } from "class-validator";

export class UpdateAcknowledgementActiveDto {
  @IsBoolean()
  isActive!: boolean;
}
