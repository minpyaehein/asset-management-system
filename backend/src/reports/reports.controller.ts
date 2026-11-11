import { Controller, Get, Headers, UnauthorizedException } from "@nestjs/common";
import { ReportsService } from "./reports.service";

@Controller("reports")
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get("summary")
  summary(@Headers("x-user-id") value?: string) {
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) throw new UnauthorizedException("A valid X-User-Id header is required.");
    return this.service.summary(id);
  }
}
