import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { RolePermission } from "../roles/entities/role-permission.entity";
import { Role } from "../roles/entities/role.entity";
import { User } from "../users/entities/user.entity";
import { CreateAssetTransferDto } from "./dto/create-asset-transfer.dto";
import { UpdateAssetTransferDto } from "./dto/update-asset-transfer.dto";
import { AssetTransferRecord } from "./entities/asset-transfer.entity";

@Injectable()
export class AssetTransferService {
  constructor(
    @InjectRepository(AssetTransferRecord) private readonly repository: Repository<AssetTransferRecord>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Role) private readonly roles: Repository<Role>,
    @InjectRepository(RolePermission) private readonly permissions: Repository<RolePermission>,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async findAll(userId: number) {
    const permission = await this.permission(userId);
    if (!permission.canView) throw new ForbiddenException("View permission is required.");
    const where = permission.access === "Own Only" ? { createdByUserId: userId } : {};
    return this.repository.find({ where, order: { createdAt: "DESC", id: "DESC" } });
  }

  async findOne(id: number, userId: number) {
    const permission = await this.permission(userId);
    if (!permission.canView) throw new ForbiddenException("View permission is required.");
    const row = await this.repository.findOne({ where: { id } });
    if (!row) throw new NotFoundException("Asset transfer not found.");
    if (permission.access === "Own Only" && row.createdByUserId !== userId) {
      throw new ForbiddenException("You can only view transfers created by your account.");
    }
    return row;
  }

  async create(dto: CreateAssetTransferDto, actorId: number, ipAddress: string | null) {
    const permission = await this.permission(actorId);
    if (!permission.canAdd) throw new ForbiddenException("Add permission is required.");
    await this.ensureUnique(dto.transferId);
    const saved = await this.repository.save(this.repository.create({
      transferId: dto.transferId.trim(), assetTag: this.text(dto.assetTag),
      fromLocation: this.text(dto.fromLocation), toLocation: this.text(dto.toLocation),
      requestedBy: this.text(dto.requestedBy), date: dto.date ?? null,
      status: dto.status, isActive: true, createdByUserId: actorId,
    }));
    await this.auditLogs.create({ userId: actorId, ipAddress, action: "CREATE", module: "Asset Transfer", entityType: "AssetTransfer", entityId: String(saved.id), description: `Created asset transfer ${saved.transferId}`, newValues: saved });
    return saved;
  }

  async update(id: number, dto: UpdateAssetTransferDto, actorId: number, ipAddress: string | null) {
    const permission = await this.permission(actorId);
    if (!permission.canEdit) throw new ForbiddenException("Edit permission is required.");
    const existing = await this.findOne(id, actorId);
    const before = { ...existing };
    if (dto.transferId !== undefined) await this.ensureUnique(dto.transferId, id);
    await this.repository.update(id, {
      ...(dto.transferId !== undefined ? { transferId: dto.transferId.trim() } : {}),
      ...(dto.assetTag !== undefined ? { assetTag: this.text(dto.assetTag) } : {}),
      ...(dto.fromLocation !== undefined ? { fromLocation: this.text(dto.fromLocation) } : {}),
      ...(dto.toLocation !== undefined ? { toLocation: this.text(dto.toLocation) } : {}),
      ...(dto.requestedBy !== undefined ? { requestedBy: this.text(dto.requestedBy) } : {}),
      ...(dto.date !== undefined ? { date: dto.date ?? null } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
    });
    const updated = await this.findOne(id, actorId);
    await this.auditLogs.create({ userId: actorId, ipAddress, action: "UPDATE", module: "Asset Transfer", entityType: "AssetTransfer", entityId: String(id), description: `Updated asset transfer ${updated.transferId}`, oldValues: before, newValues: updated });
    return updated;
  }

  async updateActive(id: number, isActive: boolean, actorId: number, ipAddress: string | null) {
    const permission = await this.permission(actorId);
    if (!permission.canDeactivate) throw new ForbiddenException("Deactivate permission is required.");
    const row = await this.findOne(id, actorId);
    const previous = row.isActive;
    row.isActive = isActive;
    const updated = await this.repository.save(row);
    await this.auditLogs.create({ userId: actorId, ipAddress, action: isActive ? "ACTIVATE" : "DEACTIVATE", module: "Asset Transfer", entityType: "AssetTransfer", entityId: String(id), description: `${isActive ? "Activated" : "Deactivated"} asset transfer ${row.transferId}`, oldValues: { isActive: previous }, newValues: { isActive } });
    return updated;
  }

  private async permission(userId: number) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException("Current user was not found.");
    if (user.status !== "Active") throw new ForbiddenException("Your user account is inactive.");
    const role = await this.roles.findOne({ where: { id: user.roleId } });
    if (!role) throw new NotFoundException("Assigned role was not found.");
    if (!role.isActive) throw new ForbiddenException("Your assigned role is inactive.");
    const permission = await this.permissions.findOne({ where: { roleId: role.id, module: "Asset Transfer" } });
    if (!permission) throw new ForbiddenException("Asset Transfer permission is not configured.");
    return permission;
  }

  private async ensureUnique(transferId: string, excludedId?: number) {
    const query = this.repository.createQueryBuilder("transfer").where("LOWER(transfer.transferId) = LOWER(:transferId)", { transferId: transferId.trim() });
    if (excludedId) query.andWhere("transfer.id != :excludedId", { excludedId });
    if (await query.getOne()) throw new ConflictException("Transfer ID already exists.");
  }

  private text(value: string | null | undefined) { const normalized = value?.trim(); return normalized ? normalized : null; }
}
