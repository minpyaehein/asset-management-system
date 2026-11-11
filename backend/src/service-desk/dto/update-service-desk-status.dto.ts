import { IsBoolean } from "class-validator";
export class UpdateServiceDeskStatusDto { @IsBoolean() isActive!: boolean; }
