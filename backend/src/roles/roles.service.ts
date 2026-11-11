import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { NotificationsService } from "../notifications/notifications.service";
import { CreateRoleDto, RolePermissionDto } from "./dto/create-role.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { Role } from "./entities/role.entity";
import { RolePermission } from "./entities/role-permission.entity";

const MODULES = [
  "Dashboard", "Assets & Hardware", "Employees", "Check-in / Check-out",
  "Software & Warranty", "Service Desk", "Asset Transfer", "Acknowledgement",
  "Asset Disposal", "Maintenance Center", "Reports & Analytics", "Notifications",
  "Audit Logs", "User Management", "Role Management",
] as const;

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role) private readonly rolesRepository: Repository<Role>,
    @InjectRepository(RolePermission) private readonly permissionsRepository: Repository<RolePermission>,
    private readonly dataSource: DataSource,
    private readonly auditLogs: AuditLogsService,
    private readonly notifications: NotificationsService,
  ) {}

  findAll(): Promise<Role[]> {
    return this.rolesRepository.find({ relations: { permissions: true }, order: { createdAt: "DESC", id: "DESC" } });
  }

  async findOne(id: number): Promise<Role> {
    const role = await this.rolesRepository.findOne({ where: { id }, relations: { permissions: true } });
    if (!role) throw new NotFoundException("Role not found.");
    return role;
  }

  async create(dto: CreateRoleDto, actorId: number | null): Promise<Role> {
    this.validateModules(dto.permissions);
    await this.ensureUniqueName(dto.name);
    const created = await this.dataSource.transaction(async (manager) => {
      const role = await manager.getRepository(Role).save(manager.getRepository(Role).create({
        name: dto.name.trim(), description: dto.description?.trim() || null, isActive: true,
      }));
      const permissions = dto.permissions.map((item) => manager.getRepository(RolePermission).create({ ...item, roleId: role.id }));
      await manager.getRepository(RolePermission).save(permissions);
      return manager.getRepository(Role).findOneOrFail({ where: { id: role.id }, relations: { permissions: true } });
    });
    await this.auditLogs.create({userId:actorId,action:"CREATE",module:"Role Management",entityType:"Role",entityId:String(created.id),description:`Created role ${created.name}`,newValues:created});
    return created;
  }

  async update(id: number, dto: UpdateRoleDto, actorId: number | null): Promise<Role> {
    const existing = await this.findOne(id);
    if (dto.name) await this.ensureUniqueName(dto.name, id);
    if (dto.permissions) this.validateModules(dto.permissions);
    const updated = await this.dataSource.transaction(async (manager) => {
      existing.name = dto.name?.trim() || existing.name;
      if (dto.description !== undefined) existing.description = dto.description.trim() || null;
      await manager.getRepository(Role).save(existing);
      if (dto.permissions) {
        await manager.getRepository(RolePermission).delete({ roleId: id });
        await manager.getRepository(RolePermission).save(dto.permissions.map((item) => manager.getRepository(RolePermission).create({ ...item, roleId: id })));
      }
      return manager.getRepository(Role).findOneOrFail({ where: { id }, relations: { permissions: true } });
    });
    await this.auditLogs.create({userId:actorId,action:"UPDATE",module:"Role Management",entityType:"Role",entityId:String(id),description:`Updated role ${updated.name}`,oldValues:existing,newValues:updated});
    await this.notifications.notifyRoleUsers(id,{type:"ROLE_UPDATED",title:"Role permissions updated",message:`Permissions for your ${updated.name} role were updated.`,referenceType:"Role",referenceId:String(id)});
    return updated;
  }

  async updateStatus(id: number, isActive: boolean, actorId: number | null): Promise<Role> {
    const role = await this.findOne(id);
    if (!isActive && role.isActive) {
      // Uses the existing users table and role_id column. Change these two names only if your schema differs.
      const rows: Array<{ count: string }> = await this.dataSource.query(
        'SELECT COUNT(*)::text AS count FROM "users" WHERE "role_id" = $1', [id],
      );
      if (Number(rows[0]?.count ?? 0) > 0) throw new ConflictException("This role is in use and cannot be deactivated.");
    }
    role.isActive = isActive;
    await this.rolesRepository.save(role);
    const updated = await this.findOne(id);
    await this.auditLogs.create({userId:actorId,action:isActive?"ACTIVATE":"DEACTIVATE",module:"Role Management",entityType:"Role",entityId:String(id),description:`${isActive?"Activated":"Deactivated"} role ${updated.name}`,oldValues:{isActive:!isActive},newValues:{isActive}});
    return updated;
  }

  private validateModules(permissions: RolePermissionDto[]) {
    const names = permissions.map((item) => item.module);
    const invalid = names.filter((name) => !MODULES.includes(name as typeof MODULES[number]));
    if (invalid.length) throw new BadRequestException(`Invalid modules: ${invalid.join(", ")}`);
    if (new Set(names).size !== names.length) throw new BadRequestException("Duplicate module permissions are not allowed.");
  }

  private async ensureUniqueName(name: string, excludedId?: number) {
    const query = this.rolesRepository.createQueryBuilder("role").where("LOWER(role.name) = LOWER(:name)", { name: name.trim() });
    if (excludedId) query.andWhere("role.id != :excludedId", { excludedId });
    if (await query.getOne()) throw new ConflictException("A role with this name already exists.");
  }
}
