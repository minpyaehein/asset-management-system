import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { RolePermission } from "../roles/entities/role-permission.entity";
import { Role } from "../roles/entities/role.entity";
import { User } from "../users/entities/user.entity";
import { CreateServiceDeskTicketDto } from "./dto/create-service-desk-ticket.dto";
import { UpdateServiceDeskTicketDto } from "./dto/update-service-desk-ticket.dto";
import { ServiceDeskTicket } from "./entities/service-desk-ticket.entity";

@Injectable()
export class ServiceDeskService {
  constructor(
    @InjectRepository(ServiceDeskTicket)
    private readonly repository: Repository<ServiceDeskTicket>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly rolesRepository: Repository<Role>,
    @InjectRepository(RolePermission)
    private readonly permissionsRepository: Repository<RolePermission>,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async findAll(userId: number) {
    const permission = await this.getPermission(userId);
    if (!permission.canView) {
      throw new ForbiddenException("View permission is required.");
    }

    const where =
      permission.access === "Own Only"
        ? { createdByUserId: userId }
        : {};

    return this.repository.find({
      where,
      order: { createdAt: "DESC", id: "DESC" },
    });
  }

  async findOne(id: number, userId: number) {
    const permission = await this.getPermission(userId);
    if (!permission.canView) {
      throw new ForbiddenException("View permission is required.");
    }

    const row = await this.repository.findOne({ where: { id } });
    if (!row) throw new NotFoundException("Service Desk ticket not found.");

    if (
      permission.access === "Own Only" &&
      row.createdByUserId !== userId
    ) {
      throw new ForbiddenException("You can only view tickets created by your account.");
    }

    return row;
  }

  async create(
    dto: CreateServiceDeskTicketDto,
    actorId: number,
    ipAddress: string | null,
  ) {
    const permission = await this.getPermission(actorId);
    if (!permission.canAdd) {
      throw new ForbiddenException("Add permission is required.");
    }

    await this.ensureUnique(dto.ticketId);

    const saved = await this.repository.save(
      this.repository.create({
        ticketId: dto.ticketId.trim(),
        requester: this.text(dto.requester),
        category: dto.category,
        priority: dto.priority,
        status: dto.status,
        createdDate: dto.createdDate ?? null,
        summary: this.text(dto.summary),
        isActive: true,
        createdByUserId: actorId,
      }),
    );

    await this.auditLogs.create({
      userId: actorId,
      ipAddress,
      action: "CREATE",
      module: "Service Desk",
      entityType: "ServiceDeskTicket",
      entityId: String(saved.id),
      description: `Created service desk ticket ${saved.ticketId}`,
      newValues: saved,
    });

    return saved;
  }

  async update(
    id: number,
    dto: UpdateServiceDeskTicketDto,
    actorId: number,
    ipAddress: string | null,
  ) {
    const permission = await this.getPermission(actorId);
    if (!permission.canEdit) {
      throw new ForbiddenException("Edit permission is required.");
    }

    const existing = await this.findOne(id, actorId);
    const before = { ...existing };

    if (dto.ticketId !== undefined) {
      await this.ensureUnique(dto.ticketId, id);
    }

    await this.repository.update(id, {
      ...(dto.ticketId !== undefined
        ? { ticketId: dto.ticketId.trim() }
        : {}),
      ...(dto.requester !== undefined
        ? { requester: this.text(dto.requester) }
        : {}),
      ...(dto.category !== undefined ? { category: dto.category } : {}),
      ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.createdDate !== undefined
        ? { createdDate: dto.createdDate ?? null }
        : {}),
      ...(dto.summary !== undefined
        ? { summary: this.text(dto.summary) }
        : {}),
    });

    const updated = await this.findOne(id, actorId);

    await this.auditLogs.create({
      userId: actorId,
      ipAddress,
      action: "UPDATE",
      module: "Service Desk",
      entityType: "ServiceDeskTicket",
      entityId: String(id),
      description: `Updated service desk ticket ${updated.ticketId}`,
      oldValues: before,
      newValues: updated,
    });

    return updated;
  }

  async updateActive(
    id: number,
    isActive: boolean,
    actorId: number,
    ipAddress: string | null,
  ) {
    const permission = await this.getPermission(actorId);
    if (!permission.canDeactivate) {
      throw new ForbiddenException("Deactivate permission is required.");
    }

    const row = await this.findOne(id, actorId);
    const previous = row.isActive;
    row.isActive = isActive;
    const updated = await this.repository.save(row);

    await this.auditLogs.create({
      userId: actorId,
      ipAddress,
      action: isActive ? "ACTIVATE" : "DEACTIVATE",
      module: "Service Desk",
      entityType: "ServiceDeskTicket",
      entityId: String(id),
      description: `${isActive ? "Activated" : "Deactivated"} service desk ticket ${row.ticketId}`,
      oldValues: { isActive: previous },
      newValues: { isActive },
    });

    return updated;
  }

  private async getPermission(userId: number) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException("Current user was not found.");
    if (user.status !== "Active") {
      throw new ForbiddenException("Your user account is inactive.");
    }

    const role = await this.rolesRepository.findOne({ where: { id: user.roleId } });
    if (!role) throw new NotFoundException("Assigned role was not found.");
    if (!role.isActive) {
      throw new ForbiddenException("Your assigned role is inactive.");
    }

    const permission = await this.permissionsRepository.findOne({
      where: {
        roleId: role.id,
        module: "Service Desk",
      },
    });

    if (!permission) {
      throw new ForbiddenException("Service Desk permission is not configured.");
    }

    return permission;
  }

  private async ensureUnique(ticketId: string, excludedId?: number) {
    const query = this.repository
      .createQueryBuilder("ticket")
      .where("LOWER(ticket.ticketId) = LOWER(:ticketId)", {
        ticketId: ticketId.trim(),
      });

    if (excludedId) {
      query.andWhere("ticket.id != :excludedId", { excludedId });
    }

    if (await query.getOne()) {
      throw new ConflictException("Ticket ID already exists.");
    }
  }

  private text(value: string | null | undefined): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }
}
