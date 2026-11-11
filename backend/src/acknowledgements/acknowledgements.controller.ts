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
import { AcknowledgementsService } from "./acknowledgements.service";
import { CreateAcknowledgementDto } from "./dto/create-acknowledgement.dto";
import { UpdateAcknowledgementActiveDto } from "./dto/update-acknowledgement-active.dto";
import { UpdateAcknowledgementDto } from "./dto/update-acknowledgement.dto";

@Controller("acknowledgements")
export class AcknowledgementsController {
  constructor(private readonly service: AcknowledgementsService) {}

  @Get()
  findAll(@Headers("x-user-id") value?: string) {
    return this.service.findAll(this.userId(value));
  }

  @Post()
  create(
    @Body() dto: CreateAcknowledgementDto,
    @Headers("x-user-id") value: string | undefined,
    @Req() request: Request,
  ) {
    return this.service.create(dto, this.userId(value), request.ip ?? null);
  }

  @Patch(":id")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateAcknowledgementDto,
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
    @Body() dto: UpdateAcknowledgementActiveDto,
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

  private userId(value?: string): number {
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) {
      throw new UnauthorizedException("A valid X-User-Id header is required.");
    }
    return id;
  }
}
