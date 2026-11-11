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
} from "@nestjs/common";
import type { Request } from "express";
import { AssetsService } from "./assets.service";
import { BulkImportAssetsDto } from "./dto/bulk-import-assets.dto";
import { CreateAssetDto } from "./dto/create-asset.dto";
import { UpdateAssetStatusDto } from "./dto/update-asset-status.dto";
import { UpdateAssetDto } from "./dto/update-asset.dto";

@Controller("assets")
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get()
  findAll() {
    return this.assetsService.findAll();
  }

  @Get(":id")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.assetsService.findOne(id);
  }

  @Post("bulk")
  bulkImport(
    @Body() dto: BulkImportAssetsDto,
    @Headers("x-user-id") actorHeader: string | undefined,
    @Req() request: Request,
  ) {
    return this.assetsService.bulkImport(
      dto,
      this.actorId(actorHeader),
      request.ip ?? null,
    );
  }

  @Post()
  create(
    @Body() dto: CreateAssetDto,
    @Headers("x-user-id") actorHeader: string | undefined,
    @Req() request: Request,
  ) {
    return this.assetsService.create(
      dto,
      this.actorId(actorHeader),
      request.ip ?? null,
    );
  }

  @Patch(":id")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateAssetDto,
    @Headers("x-user-id") actorHeader: string | undefined,
    @Req() request: Request,
  ) {
    return this.assetsService.update(
      id,
      dto,
      this.actorId(actorHeader),
      request.ip ?? null,
    );
  }

  @Patch(":id/status")
  updateStatus(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateAssetStatusDto,
    @Headers("x-user-id") actorHeader: string | undefined,
    @Req() request: Request,
  ) {
    return this.assetsService.updateStatus(
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
