import { Type } from "class-transformer";
import { ArrayNotEmpty, IsArray, IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateNested } from "class-validator";
import { AccessLevel } from "../entities/role-permission.entity";

export class RolePermissionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  module!: string;

  @IsEnum(AccessLevel)
  access!: AccessLevel;

  @IsBoolean()
  canView!: boolean;

  @IsBoolean()
  canAdd!: boolean;

  @IsBoolean()
  canEdit!: boolean;

  @IsBoolean()
  canDeactivate!: boolean;

  @IsBoolean()
  canExport!: boolean;
}

export class CreateRoleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => RolePermissionDto)
  permissions!: RolePermissionDto[];
}
