import {
  Controller,
  Get,
  Headers,
  UnauthorizedException,
} from "@nestjs/common";
import { DashboardService } from "./dashboard.service";

@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("summary")
  summary(@Headers("x-user-id") value?: string) {
    const userId = Number(value);
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new UnauthorizedException("A valid X-User-Id header is required.");
    }
    return this.dashboardService.summary(userId);
  }
}
