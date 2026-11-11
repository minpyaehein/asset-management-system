import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { CreateServiceDeskTicketDto } from "./dto/create-service-desk-ticket.dto";
import { UpdateServiceDeskStatusDto } from "./dto/update-service-desk-status.dto";
import { UpdateServiceDeskTicketDto } from "./dto/update-service-desk-ticket.dto";
import { ServiceDeskService } from "./service-desk.service";

@Controller("service-desk")
export class ServiceDeskController {
  constructor(private readonly service: ServiceDeskService) {}

  @Get()
  findAll(@Headers("x-user-id") actor?: string) {
    return this.service.findAll(this.userId(actor));
  }

  @Get(":id")
  findOne(
    @Param("id", ParseIntPipe) id: number,
    @Headers("x-user-id") actor?: string,
  ) {
    return this.service.findOne(id, this.userId(actor));
  }

  @Post()
  create(
    @Body() dto: CreateServiceDeskTicketDto,
    @Headers("x-user-id") actor: string | undefined,
    @Req() request: Request,
  ) {
    return this.service.create(
      dto,
      this.userId(actor),
      request.ip ?? null,
    );
  }

  @Patch(":id")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateServiceDeskTicketDto,
    @Headers("x-user-id") actor: string | undefined,
    @Req() request: Request,
  ) {
    return this.service.update(
      id,
      dto,
      this.userId(actor),
      request.ip ?? null,
    );
  }

  @Patch(":id/status")
  status(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateServiceDeskStatusDto,
    @Headers("x-user-id") actor: string | undefined,
    @Req() request: Request,
  ) {
    return this.service.updateActive(
      id,
      dto.isActive,
      this.userId(actor),
      request.ip ?? null,
    );
  }

  private userId(value?: string): number {
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) {
      throw new UnauthorizedException("A valid X-User-Id header is required.");
    }
    return id;
  }
}
