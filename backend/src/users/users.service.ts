import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import * as bcrypt from "bcryptjs";
import { Repository } from "typeorm";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { NotificationsService } from "../notifications/notifications.service";
import { Role } from "../roles/entities/role.entity";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { User, UserStatus } from "./entities/user.entity";

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Role) private readonly roles: Repository<Role>,
    private readonly auditLogs: AuditLogsService,
    private readonly notifications: NotificationsService,
  ) {}

  findAll() { return this.users.find({ order: { createdAt: "DESC", id: "DESC" } }); }

  async findOne(id: number) {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException("User not found.");
    return user;
  }

  async create(dto: CreateUserDto, actorId: number | null, ipAddress: string | null) {
    await this.ensureUnique(dto.username, dto.email ?? null);
    await this.ensureActiveRole(dto.roleId);
    const saved = await this.users.save(this.users.create({
      username: dto.username.trim(),
      fullName: dto.fullName.trim(),
      email: dto.email?.trim().toLowerCase() || null,
      passwordHash: await bcrypt.hash(dto.password, 12),
      roleId: dto.roleId,
      status: dto.status,
    }));
    const result = await this.findOne(saved.id);
    await this.auditLogs.create({ userId: actorId, ipAddress, action: "CREATE", module: "User Management", entityType: "User", entityId: String(result.id), description: `Created user ${result.username}`, newValues: this.safe(result) });
    await this.notify(result.id, "ACCOUNT_CREATED", "Your account was created", "An administrator created your Asset Management account.", actorId);
    return result;
  }

  async update(
  id: number,
  dto: UpdateUserDto,
  actorId: number | null,
  ipAddress: string | null,
) {
  const existingUser = await this.findOne(id);

  const previousValues = this.safe(existingUser);
  const previousRoleId = existingUser.roleId;

  await this.ensureUnique(
    dto.username ?? existingUser.username,
    dto.email === undefined ? existingUser.email : dto.email,
    id,
  );

  if (dto.roleId !== undefined) {
    await this.ensureActiveRole(dto.roleId);
  }

  const changes: Partial<User> = {};

  if (dto.username !== undefined) {
    changes.username = dto.username.trim();
  }

  if (dto.fullName !== undefined) {
    changes.fullName = dto.fullName.trim();
  }

  if (dto.email !== undefined) {
    changes.email = dto.email?.trim().toLowerCase() || null;
  }

  if (dto.roleId !== undefined) {
    changes.roleId = dto.roleId;
  }

  if (dto.status !== undefined) {
    changes.status = dto.status;
  }

  await this.users.update(id, changes);

  const updatedUser = await this.findOne(id);

  await this.auditLogs.create({
    userId: actorId,
    ipAddress,
    action: "UPDATE",
    module: "User Management",
    entityType: "User",
    entityId: String(id),
    description: `Updated user ${updatedUser.username}`,
    oldValues: previousValues,
    newValues: this.safe(updatedUser),
  });

  if (previousRoleId !== updatedUser.roleId) {
    await this.notify(
      updatedUser.id,
      "ROLE_CHANGED",
      "Your assigned role changed",
      `Your assigned role is now ${
        updatedUser.role?.name ?? `role #${updatedUser.roleId}`
      }.`,
      actorId,
    );
  } else {
    await this.notify(
      updatedUser.id,
      "PROFILE_UPDATED",
      "Your account was updated",
      "Someone updated your account information.",
      actorId,
    );
  }

  return updatedUser;
}

  async updateStatus(id: number, status: UserStatus, actorId: number | null, ipAddress: string | null) {
    if (actorId === id && status === UserStatus.INACTIVE) throw new BadRequestException("You cannot deactivate your own account.");
    const user = await this.findOne(id);
    const previous = user.status;
    user.status = status;
    await this.users.save(user);
    await this.auditLogs.create({ userId: actorId, ipAddress, action: status === UserStatus.ACTIVE ? "ACTIVATE" : "DEACTIVATE", module: "User Management", entityType: "User", entityId: String(id), description: `${status === UserStatus.ACTIVE ? "Activated" : "Deactivated"} user ${user.username}`, oldValues: { status: previous }, newValues: { status } });
    await this.notify(id, status === UserStatus.ACTIVE ? "ACCOUNT_ACTIVATED" : "ACCOUNT_DEACTIVATED", status === UserStatus.ACTIVE ? "Your account was activated" : "Your account was deactivated", status === UserStatus.ACTIVE ? "An administrator activated your account." : "An administrator deactivated your account.", actorId);
    return this.findOne(id);
  }

  async resetPassword(id: number, actorId: number | null, ipAddress: string | null) {
    const user = await this.users.createQueryBuilder("user").addSelect("user.passwordHash").where("user.id = :id", { id }).getOne();
    if (!user) throw new NotFoundException("User not found.");
    user.passwordHash = await bcrypt.hash("Default@12345", 12);
    await this.users.save(user);
    await this.auditLogs.create({ userId: actorId, ipAddress, action: "RESET_PASSWORD", module: "User Management", entityType: "User", entityId: String(id), description: `Reset password for ${user.username}` });
    await this.notify(id, "PASSWORD_RESET", "Your password was reset", "Someone reset your password. Sign in with the temporary password and change it.", actorId);
    return { success: true, message: "Password reset successfully." };
  }

  private async notify(userId: number, type: string, title: string, baseMessage: string, actorId: number | null) {
    const actor = actorId ? await this.users.findOne({ where: { id: actorId } }) : null;
    const by = actor ? ` Action performed by ${actor.fullName}.` : "";
    await this.notifications.create({ userId, type, title, message: `${baseMessage}${by}`, referenceType: "User", referenceId: String(userId) });
  }

  private async ensureActiveRole(roleId: number) {
    const role = await this.roles.findOne({ where: { id: roleId } });
    if (!role) throw new BadRequestException("Selected role does not exist.");
    if (!role.isActive) throw new BadRequestException("Selected role is inactive.");
  }

  private async ensureUnique(username: string, email?: string | null, excludedId?: number) {
    const uq = this.users.createQueryBuilder("u").where("LOWER(u.username)=LOWER(:username)", { username: username.trim() });
    if (excludedId) uq.andWhere("u.id != :excludedId", { excludedId });
    if (await uq.getOne()) throw new ConflictException("Username already exists.");
    if (email) {
      const eq = this.users.createQueryBuilder("u").where("LOWER(u.email)=LOWER(:email)", { email: email.trim() });
      if (excludedId) eq.andWhere("u.id != :excludedId", { excludedId });
      if (await eq.getOne()) throw new ConflictException("Email already exists.");
    }
  }

  private safe(user: User) { const { passwordHash: _hidden, ...safe } = user; return safe; }
}
