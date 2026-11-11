import { Body, Controller, Get, Headers, Param, ParseIntPipe, Patch, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { CreateEmployeeDto } from "./dto/create-employee.dto";
import { UpdateEmployeeStatusDto } from "./dto/update-employee-status.dto";
import { UpdateEmployeeDto } from "./dto/update-employee.dto";
import { EmployeesService } from "./employees.service";

@Controller("employees")
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  findAll() {
    return this.employeesService.findAll();
  }

  @Get(":id")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.employeesService.findOne(id);
  }

  @Post()
  create(
    @Body() dto: CreateEmployeeDto,
    @Headers("x-user-id") actorHeader: string | undefined,
    @Req() request: Request,
  ) {
    return this.employeesService.create(
      dto,
      this.actorId(actorHeader),
      request.ip ?? null,
    );
  }

  @Patch(":id")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateEmployeeDto,
    @Headers("x-user-id") actorHeader: string | undefined,
    @Req() request: Request,
  ) {
    return this.employeesService.update(
      id,
      dto,
      this.actorId(actorHeader),
      request.ip ?? null,
    );
  }

  @Patch(":id/status")
  updateStatus(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateEmployeeStatusDto,
    @Headers("x-user-id") actorHeader: string | undefined,
    @Req() request: Request,
  ) {
    return this.employeesService.updateStatus(
      id,
      dto.status,
      this.actorId(actorHeader),
      request.ip ?? null,
    );
  }

  private actorId(value?: string): number | null {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
  }
}
