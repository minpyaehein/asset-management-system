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
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { CreateSoftwareRecordDto } from "./dto/create-software-record.dto";
import { UpdateSoftwareRecordDto } from "./dto/update-software-record.dto";
import { UpdateSoftwareStatusDto } from "./dto/update-software-status.dto";
import { SoftwareRecordType } from "./entities/software-management-record.entity";
import { SoftwareManagementService } from "./software-management.service";

@Controller("software-management")
export class SoftwareManagementController {
  constructor(private readonly service: SoftwareManagementService) {}

  @Get(":type")
  findAll(@Param("type") type: string) {
    return this.service.findAll(this.parseType(type));
  }

  @Post(":type")
  create(
    @Param("type") type: string,
    @Body() dto: CreateSoftwareRecordDto,
    @Headers("x-user-id") actor: string | undefined,
    @Req() request: Request,
  ) {
    return this.service.create(
      this.parseType(type),
      dto,
      this.actorId(actor),
      request.ip ?? null,
    );
  }

  @Patch(":type/:id")
  update(
    @Param("type") type: string,
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateSoftwareRecordDto,
    @Headers("x-user-id") actor: string | undefined,
    @Req() request: Request,
  ) {
    return this.service.update(
      this.parseType(type),
      id,
      dto,
      this.actorId(actor),
      request.ip ?? null,
    );
  }

  @Patch(":type/:id/status")
  updateStatus(
    @Param("type") type: string,
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateSoftwareStatusDto,
    @Headers("x-user-id") actor: string | undefined,
    @Req() request: Request,
  ) {
    return this.service.updateStatus(
      this.parseType(type),
      id,
      dto.isActive,
      this.actorId(actor),
      request.ip ?? null,
    );
  }

  private parseType(value: string): SoftwareRecordType {
    if (!Object.values(SoftwareRecordType).includes(value as SoftwareRecordType)) {
      throw new BadRequestException("Invalid software record type.");
    }
    return value as SoftwareRecordType;
  }

  private actorId(value?: string): number | null {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
  }
}
