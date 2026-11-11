import { Body, Controller, Get, Headers, Param, ParseIntPipe, Patch, Post } from "@nestjs/common";
import { CreateRoleDto } from "./dto/create-role.dto";
import { UpdateRoleStatusDto } from "./dto/update-role-status.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { RolesService } from "./roles.service";

@Controller("roles")
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  findAll() { return this.rolesService.findAll(); }

  @Get(":id")
  findOne(@Param("id", ParseIntPipe) id: number) { return this.rolesService.findOne(id); }

  @Post()
  create(@Body() dto: CreateRoleDto, @Headers("x-user-id") _userId?: string) {
    return this.rolesService.create(dto, Number(_userId) || null);
  }

  @Patch(":id")
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateRoleDto, @Headers("x-user-id") _userId?: string) {
    return this.rolesService.update(id, dto, Number(_userId) || null);
  }

  @Patch(":id/status")
  updateStatus(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateRoleStatusDto, @Headers("x-user-id") _userId?: string) {
    return this.rolesService.updateStatus(id, dto.isActive, Number(_userId) || null);
  }
}
