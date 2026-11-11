import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { CreateMaintenanceRecordDto } from "./dto/create-maintenance-record.dto";
import { UpdateMaintenanceActiveDto } from "./dto/update-maintenance-active.dto";
import { UpdateMaintenanceRecordDto } from "./dto/update-maintenance-record.dto";
import { MaintenanceTab } from "./entities/maintenance-record.entity";
import { MaintenanceCenterService } from "./maintenance-center.service";

@Controller("maintenance-center")
export class MaintenanceCenterController {
  constructor(private readonly service: MaintenanceCenterService) {}

  @Get()
  findAll(
    @Query("tab") tab: string,
    @Headers("x-user-id") value?: string,
  ) {
    return this.service.findAll(this.tab(tab), this.userId(value));
  }

  @Get(":id")
  findOne(
    @Param("id", ParseIntPipe) id: number,
    @Headers("x-user-id") value?: string,
  ) {
    return this.service.findOne(id, this.userId(value));
  }

  @Post()
  create(
    @Body() dto: CreateMaintenanceRecordDto,
    @Headers("x-user-id") value: string | undefined,
    @Req() request: Request,
  ) {
    return this.service.create(dto, this.userId(value), request.ip ?? null);
  }

  @Patch(":id")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateMaintenanceRecordDto,
    @Headers("x-user-id") value: string | undefined,
    @Req() request: Request,
  ) {
    return this.service.update(
      id,
      dto,
      this.userId(value),
      request.ip ?? null,
    );
  }

  @Patch(":id/active")
  updateActive(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateMaintenanceActiveDto,
    @Headers("x-user-id") value: string | undefined,
    @Req() request: Request,
  ) {
    return this.service.updateActive(
      id,
      dto.isActive,
      this.userId(value),
      request.ip ?? null,
    );
  }

  private tab(value: string): MaintenanceTab {
    if (!Object.values(MaintenanceTab).includes(value as MaintenanceTab)) {
      throw new BadRequestException("Tab must be planner or history.");
    }
    return value as MaintenanceTab;
  }

  private userId(value?: string): number {
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) {
      throw new UnauthorizedException("A valid X-User-Id header is required.");
    }
    return id;
  }
}
