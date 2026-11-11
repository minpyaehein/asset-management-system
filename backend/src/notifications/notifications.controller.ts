import { Controller, Get, Headers, Param, ParseIntPipe, Patch, UnauthorizedException } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  findMine(@Headers("x-user-id") value?: string) {
    return this.service.findForUser(this.userId(value));
  }

  @Patch("read-all")
  readAll(@Headers("x-user-id") value?: string) {
    return this.service.markAllRead(this.userId(value));
  }

  @Patch(":id/read")
  readOne(@Param("id", ParseIntPipe) id: number, @Headers("x-user-id") value?: string) {
    return this.service.markRead(id, this.userId(value));
  }

  private userId(value?: string) {
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) throw new UnauthorizedException("Valid X-User-Id is required.");
    return id;
  }
}
