import { Body, Controller, Get, Headers, Param, ParseIntPipe, Patch, Post, Req, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { CheckinCheckoutService } from "./checkin-checkout.service";
import { CheckinAssetDto } from "./dto/checkin-asset.dto";
import { CheckoutAssetDto } from "./dto/checkout-asset.dto";

@Controller("checkin-checkout")
export class CheckinCheckoutController {
  constructor(private readonly service: CheckinCheckoutService) {}

  @Get("access")
  access(@Headers("x-user-id") value?: string) {
    return this.service.getAccess(this.userId(value));
  }

  @Get("options/assets")
  assets(@Headers("x-user-id") value?: string) {
    return this.service.availableAssets(this.userId(value));
  }

  @Get("options/employees")
  employees(@Headers("x-user-id") value?: string) {
    return this.service.activeEmployees(this.userId(value));
  }

  @Get()
  findAll(@Headers("x-user-id") value?: string) {
    return this.service.findAll(this.userId(value));
  }

  @Post("checkout")
  checkout(
    @Body() dto: CheckoutAssetDto,
    @Headers("x-user-id") value: string | undefined,
    @Req() request: Request,
  ) {
    return this.service.checkout(dto, this.userId(value), request.ip ?? null);
  }

  @Patch(":id/checkin")
  checkin(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: CheckinAssetDto,
    @Headers("x-user-id") value: string | undefined,
    @Req() request: Request,
  ) {
    return this.service.checkin(id, dto, this.userId(value), request.ip ?? null);
  }

  private userId(value?: string) {
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) {
      throw new UnauthorizedException("A valid X-User-Id header is required.");
    }
    return id;
  }
}
