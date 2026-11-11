import { Transform } from "class-transformer";
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from "class-validator";
import { EmployeeStatus } from "../entities/employee.entity";

const emptyToNull = ({ value }: { value: unknown }) =>
  typeof value === "string" && value.trim() === "" ? null : value;

export class CreateEmployeeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^[A-Za-z0-9._-]+$/, {
    message: "Staff code can contain letters, numbers, dots, underscores, and hyphens only.",
  })
  staffCode!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  fullName!: string;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(120)
  department?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsEmail()
  @MaxLength(180)
  email?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(50)
  phone?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(120)
  jobTitle?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(150)
  location?: string | null;

  @IsEnum(EmployeeStatus)
  status!: EmployeeStatus;
}
