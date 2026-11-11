import { Body, Controller, Get, Headers, Param, ParseIntPipe, Patch, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserStatusDto } from "./dto/update-user-status.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UsersService } from "./users.service";

@Controller("users")
export class UsersController {
  constructor(private readonly service: UsersService) {}
  @Get() findAll() { return this.service.findAll(); }
  @Get(":id") findOne(@Param("id", ParseIntPipe) id: number) { return this.service.findOne(id); }
  @Post() create(@Body() dto: CreateUserDto, @Headers("x-user-id") actor: string | undefined, @Req() req: Request) { return this.service.create(dto, Number(actor) || null, req.ip ?? null); }
  @Patch(":id") update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateUserDto, @Headers("x-user-id") actor: string | undefined, @Req() req: Request) { return this.service.update(id, dto, Number(actor) || null, req.ip ?? null); }
  @Patch(":id/status") status(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateUserStatusDto, @Headers("x-user-id") actor: string | undefined, @Req() req: Request) { return this.service.updateStatus(id, dto.status, Number(actor) || null, req.ip ?? null); }
  @Patch(":id/reset-password") reset(@Param("id", ParseIntPipe) id: number, @Headers("x-user-id") actor: string | undefined, @Req() req: Request) { return this.service.resetPassword(id, Number(actor) || null, req.ip ?? null); }
}
