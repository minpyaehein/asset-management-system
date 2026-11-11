import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { Asset } from "../assets/entities/asset.entity";
import { RolePermission } from "../roles/entities/role-permission.entity";
import { Role } from "../roles/entities/role.entity";
import { User } from "../users/entities/user.entity";
import { CreateMaintenanceRecordDto } from "./dto/create-maintenance-record.dto";
import { UpdateMaintenanceRecordDto } from "./dto/update-maintenance-record.dto";
import {
  MaintenanceRecord,
  MaintenanceTab,
} from "./entities/maintenance-record.entity";

@Injectable()
export class MaintenanceCenterService {
  constructor(
    @InjectRepository(MaintenanceRecord)
    private readonly repository: Repository<MaintenanceRecord>,
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

  async findAll(tab: MaintenanceTab, userId: number) {
    const permission = await this.getPermission(userId);
    if (!permission.canView) {
      throw new ForbiddenException("View permission is required.");
    }

    return this.repository.find({
      where:
        permission.access === "Own Only"
          ? { tab, createdByUserId: userId }
          : { tab },
      order: { date: "DESC", id: "DESC" },
    });
  }

  async findOne(id: number, userId: number) {
    const permission = await this.getPermission(userId);
    const record = await this.repository.findOne({ where: { id } });

    if (!record) throw new NotFoundException("Maintenance record not found.");

    if (
      permission.access === "Own Only" &&
      record.createdByUserId !== userId
    ) {
      throw new ForbiddenException(
        "You can only access maintenance records created by your account.",
      );
    }

    return record;
  }

  async create(
    dto: CreateMaintenanceRecordDto,
    actorId: number,
    ipAddress: string | null,
  ) {
    const permission = await this.getPermission(actorId);
    if (!permission.canAdd) {
      throw new ForbiddenException("Add permission is required.");
    }

    this.validateTabFields(dto);
    await this.ensureUnique(dto.recordCode);
    await this.ensureAsset(dto.assetTag);

    const saved = await this.repository.save(
      this.repository.create({
        recordCode: dto.recordCode.trim(),
        tab: dto.tab,
        assetTag: dto.assetTag.trim(),
        type: dto.type.trim(),
        date: dto.date,
        technician: this.text(dto.technician),
        status: dto.tab === MaintenanceTab.PLANNER ? this.text(dto.status) : null,
        cost:
          dto.tab === MaintenanceTab.HISTORY && dto.cost != null
            ? dto.cost.toFixed(2)
            : null,
        detail: this.text(dto.detail),
        isActive: true,
        createdByUserId: actorId,
      }),
    );

    await this.auditLogs.create({
      userId: actorId,
      ipAddress,
      action: "CREATE",
      module: "Maintenance Center",
      entityType: "MaintenanceRecord",
      entityId: String(saved.id),
      description: `Created maintenance record ${saved.recordCode}`,
      newValues: saved,
    });

    return saved;
  }

  async update(
    id: number,
    dto: UpdateMaintenanceRecordDto,
    actorId: number,
    ipAddress: string | null,
  ) {
    const permission = await this.getPermission(actorId);
    if (!permission.canEdit) {
      throw new ForbiddenException("Edit permission is required.");
    }

    const existing = await this.findOne(id, actorId);
    const before = { ...existing };
    const merged = { ...existing, ...dto } as CreateMaintenanceRecordDto;

    this.validateTabFields(merged);

    if (dto.recordCode !== undefined) {
      await this.ensureUnique(dto.recordCode, id);
    }
    if (dto.assetTag !== undefined) {
      await this.ensureAsset(dto.assetTag);
    }

    const effectiveTab = dto.tab ?? existing.tab;

    await this.repository.update(id, {
      ...(dto.recordCode !== undefined
        ? { recordCode: dto.recordCode.trim() }
        : {}),
      ...(dto.tab !== undefined ? { tab: dto.tab } : {}),
      ...(dto.assetTag !== undefined
        ? { assetTag: dto.assetTag.trim() }
        : {}),
      ...(dto.type !== undefined ? { type: dto.type.trim() } : {}),
      ...(dto.date !== undefined ? { date: dto.date } : {}),
      ...(dto.technician !== undefined
        ? { technician: this.text(dto.technician) }
        : {}),
      ...(dto.status !== undefined || effectiveTab === MaintenanceTab.HISTORY
        ? {
            status:
              effectiveTab === MaintenanceTab.PLANNER
                ? this.text(dto.status ?? existing.status)
                : null,
          }
        : {}),
      ...(dto.cost !== undefined || effectiveTab === MaintenanceTab.PLANNER
        ? {
            cost:
              effectiveTab === MaintenanceTab.HISTORY && dto.cost != null
                ? dto.cost.toFixed(2)
                : effectiveTab === MaintenanceTab.HISTORY
                  ? existing.cost
                  : null,
          }
        : {}),
      ...(dto.detail !== undefined ? { detail: this.text(dto.detail) } : {}),
    });

    const updated = await this.findOne(id, actorId);

    await this.auditLogs.create({
      userId: actorId,
      ipAddress,
      action: "UPDATE",
      module: "Maintenance Center",
      entityType: "MaintenanceRecord",
      entityId: String(id),
      description: `Updated maintenance record ${updated.recordCode}`,
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
      module: "Maintenance Center",
      entityType: "MaintenanceRecord",
      entityId: String(id),
      description: `${isActive ? "Activated" : "Deactivated"} maintenance record ${record.recordCode}`,
      oldValues: { isActive: previous },
      newValues: { isActive },
    });

    return updated;
  }

  private validateTabFields(dto: CreateMaintenanceRecordDto) {
    if (dto.tab === MaintenanceTab.PLANNER && !this.text(dto.status)) {
      throw new BadRequestException("Planner status is required.");
    }

    if (dto.tab === MaintenanceTab.HISTORY && dto.cost != null && dto.cost < 0) {
      throw new BadRequestException("Maintenance cost cannot be negative.");
    }
  }

  private async ensureAsset(assetTag: string) {
    const asset = await this.assetsRepository
      .createQueryBuilder("asset")
      .where("LOWER(asset.assetTag) = LOWER(:assetTag)", {
        assetTag: assetTag.trim(),
      })
      .getOne();

    if (!asset) throw new NotFoundException("Selected asset was not found.");
  }

  private async ensureUnique(recordCode: string, excludedId?: number) {
    const query = this.repository
      .createQueryBuilder("record")
      .where("LOWER(record.recordCode) = LOWER(:recordCode)", {
        recordCode: recordCode.trim(),
      });

    if (excludedId) {
      query.andWhere("record.id != :excludedId", { excludedId });
    }

    if (await query.getOne()) {
      throw new ConflictException("Maintenance record ID already exists.");
    }
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
      where: { roleId: role.id, module: "Maintenance Center" },
    });

    if (!permission) {
      throw new ForbiddenException(
        "Maintenance Center permission is not configured.",
      );
    }

    return permission;
  }

  private text(value: string | null | undefined): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }
}
