import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { Asset, AssetStatus } from "../assets/entities/asset.entity";
import { RolePermission } from "../roles/entities/role-permission.entity";
import { Role } from "../roles/entities/role.entity";
import { User } from "../users/entities/user.entity";
import { CreateAssetDisposalDto } from "./dto/create-asset-disposal.dto";
import { UpdateAssetDisposalDto } from "./dto/update-asset-disposal.dto";
import {
  AssetDisposal,
  AssetDisposalStatus,
} from "./entities/asset-disposal.entity";

@Injectable()
export class AssetDisposalsService {
  constructor(
    @InjectRepository(AssetDisposal)
    private readonly repository: Repository<AssetDisposal>,
    @InjectRepository(Asset)
    private readonly assetsRepository: Repository<Asset>,
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
      permission.access === "Own Only" ? { createdByUserId: userId } : {};

    return this.repository.find({
      where,
      order: { createdAt: "DESC", id: "DESC" },
    });
  }

  async create(
    dto: CreateAssetDisposalDto,
    actorId: number,
    ipAddress: string | null,
  ) {
    const permission = await this.getPermission(actorId);
    if (!permission.canAdd) {
      throw new ForbiddenException("Add permission is required.");
    }

    await this.ensureUnique(dto.disposalId);
    await this.ensureAssetExists(dto.assetTag ?? null);

    const saved = await this.repository.save(
      this.repository.create({
        disposalId: dto.disposalId.trim(),
        assetTag: this.text(dto.assetTag),
        reason: this.text(dto.reason),
        requestedBy: this.text(dto.requestedBy),
        date: dto.date ?? null,
        status: dto.status,
        isActive: true,
        createdByUserId: actorId,
      }),
    );

    await this.updateAssetForDisposedStatus(saved);

    await this.auditLogs.create({
      userId: actorId,
      ipAddress,
      action: "CREATE",
      module: "Asset Disposal",
      entityType: "AssetDisposal",
      entityId: String(saved.id),
      description: `Created asset disposal ${saved.disposalId}`,
      newValues: saved,
    });

    return saved;
  }

  async update(
    id: number,
    dto: UpdateAssetDisposalDto,
    actorId: number,
    ipAddress: string | null,
  ) {
    const permission = await this.getPermission(actorId);
    if (!permission.canEdit) {
      throw new ForbiddenException("Edit permission is required.");
    }

    const existing = await this.findOne(id, actorId);
    const before = { ...existing };

    if (dto.disposalId !== undefined) {
      await this.ensureUnique(dto.disposalId, id);
    }
    if (dto.assetTag !== undefined) {
      await this.ensureAssetExists(dto.assetTag ?? null);
    }

    await this.repository.update(id, {
      ...(dto.disposalId !== undefined
        ? { disposalId: dto.disposalId.trim() }
        : {}),
      ...(dto.assetTag !== undefined
        ? { assetTag: this.text(dto.assetTag) }
        : {}),
      ...(dto.reason !== undefined ? { reason: this.text(dto.reason) } : {}),
      ...(dto.requestedBy !== undefined
        ? { requestedBy: this.text(dto.requestedBy) }
        : {}),
      ...(dto.date !== undefined ? { date: dto.date ?? null } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
    });

    const updated = await this.findOne(id, actorId);
    await this.updateAssetForDisposedStatus(updated);

    await this.auditLogs.create({
      userId: actorId,
      ipAddress,
      action: "UPDATE",
      module: "Asset Disposal",
      entityType: "AssetDisposal",
      entityId: String(id),
      description: `Updated asset disposal ${updated.disposalId}`,
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

    const record = await this.findOne(id, actorId);
    const previous = record.isActive;
    record.isActive = isActive;
    const updated = await this.repository.save(record);

    await this.auditLogs.create({
      userId: actorId,
      ipAddress,
      action: isActive ? "ACTIVATE" : "DEACTIVATE",
      module: "Asset Disposal",
      entityType: "AssetDisposal",
      entityId: String(id),
      description: `${isActive ? "Activated" : "Deactivated"} asset disposal ${updated.disposalId}`,
      oldValues: { isActive: previous },
      newValues: { isActive },
    });

    return updated;
  }

  async findOne(id: number, userId: number) {
    const permission = await this.getPermission(userId);
    const record = await this.repository.findOne({ where: { id } });

    if (!record) throw new NotFoundException("Asset disposal not found.");

    if (
      permission.access === "Own Only" &&
      record.createdByUserId !== userId
    ) {
      throw new ForbiddenException(
        "You can only access disposal records created by your account.",
      );
    }

    return record;
  }

  private async ensureAssetExists(assetTag: string | null) {
    const normalized = this.text(assetTag);
    if (!normalized) return;

    const asset = await this.assetsRepository
      .createQueryBuilder("asset")
      .where("LOWER(asset.assetTag) = LOWER(:assetTag)", {
        assetTag: normalized,
      })
      .getOne();

    if (!asset) throw new NotFoundException("Selected asset was not found.");
  }

  private async updateAssetForDisposedStatus(record: AssetDisposal) {
    if (
      record.status !== AssetDisposalStatus.DISPOSED ||
      !record.assetTag
    ) {
      return;
    }

    const asset = await this.assetsRepository
      .createQueryBuilder("asset")
      .where("LOWER(asset.assetTag) = LOWER(:assetTag)", {
        assetTag: record.assetTag,
      })
      .getOne();

    if (!asset) return;
    asset.status = AssetStatus.RETIRED;
    asset.assignedTo = null;
    await this.assetsRepository.save(asset);
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
      where: { roleId: role.id, module: "Asset Disposal" },
    });

    if (!permission) {
      throw new ForbiddenException(
        "Asset Disposal permission is not configured.",
      );
    }

    return permission;
  }

  private async ensureUnique(disposalId: string, excludedId?: number) {
    const query = this.repository
      .createQueryBuilder("disposal")
      .where("LOWER(disposal.disposalId) = LOWER(:disposalId)", {
        disposalId: disposalId.trim(),
      });

    if (excludedId) {
      query.andWhere("disposal.id != :excludedId", { excludedId });
    }

    if (await query.getOne()) {
      throw new ConflictException("Disposal ID already exists.");
    }
  }

  private text(value: string | null | undefined): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }
}
