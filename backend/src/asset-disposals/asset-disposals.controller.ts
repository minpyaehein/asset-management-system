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
import { AssetDisposalsService } from "./asset-disposals.service";
import { CreateAssetDisposalDto } from "./dto/create-asset-disposal.dto";
import { UpdateAssetDisposalActiveDto } from "./dto/update-asset-disposal-active.dto";
import { UpdateAssetDisposalDto } from "./dto/update-asset-disposal.dto";

@Controller("asset-disposals")
export class AssetDisposalsController {
  constructor(private readonly service: AssetDisposalsService) {}

  @Get()
  findAll(@Headers("x-user-id") value?: string) {
    return this.service.findAll(this.userId(value));
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
    @Body() dto: CreateAssetDisposalDto,
    @Headers("x-user-id") value: string | undefined,
    @Req() request: Request,
  ) {
    return this.service.create(dto, this.userId(value), request.ip ?? null);
  }

  @Patch(":id")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateAssetDisposalDto,
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
    @Body() dto: UpdateAssetDisposalActiveDto,
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
