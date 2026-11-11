import { Body, Controller, Get, Headers, Param, ParseIntPipe, Patch, Post, Req, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { AssetTransferService } from "./asset-transfer.service";
import { CreateAssetTransferDto } from "./dto/create-asset-transfer.dto";
import { UpdateAssetTransferStatusDto } from "./dto/update-asset-transfer-status.dto";
import { UpdateAssetTransferDto } from "./dto/update-asset-transfer.dto";

@Controller("asset-transfer")
export class AssetTransferController {
  constructor(private readonly service: AssetTransferService) {}
  @Get() findAll(@Headers("x-user-id") value?: string) { return this.service.findAll(this.userId(value)); }
  @Get(":id") findOne(@Param("id", ParseIntPipe) id: number, @Headers("x-user-id") value?: string) { return this.service.findOne(id, this.userId(value)); }
  @Post() create(@Body() dto: CreateAssetTransferDto, @Headers("x-user-id") value: string | undefined, @Req() request: Request) { return this.service.create(dto, this.userId(value), request.ip ?? null); }
  @Patch(":id") update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateAssetTransferDto, @Headers("x-user-id") value: string | undefined, @Req() request: Request) { return this.service.update(id, dto, this.userId(value), request.ip ?? null); }
  @Patch(":id/status") status(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateAssetTransferStatusDto, @Headers("x-user-id") value: string | undefined, @Req() request: Request) { return this.service.updateActive(id, dto.isActive, this.userId(value), request.ip ?? null); }
  private userId(value?: string) { const id = Number(value); if (!Number.isInteger(id) || id <= 0) throw new UnauthorizedException("A valid X-User-Id header is required."); return id; }
}
