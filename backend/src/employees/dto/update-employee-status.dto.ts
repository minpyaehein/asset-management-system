import { IsEnum } from "class-validator";
import { EmployeeStatus } from "../entities/employee.entity";

export class UpdateEmployeeStatusDto {
  @IsEnum(EmployeeStatus)
  status!: EmployeeStatus;
}
