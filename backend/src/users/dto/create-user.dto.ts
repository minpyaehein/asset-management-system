import { IsEmail, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { UserStatus } from "../entities/user.entity";

export class CreateUserDto {
  @IsString() @IsNotEmpty() @MaxLength(80) username!: string;
  @IsString() @IsNotEmpty() @MaxLength(120) fullName!: string;
  @IsOptional() @IsEmail() @MaxLength(180) email?: string | null;
  @IsString() @MinLength(8) @MaxLength(72) password!: string;
  @IsInt() roleId!: number;
  @IsEnum(UserStatus) status!: UserStatus;
}
