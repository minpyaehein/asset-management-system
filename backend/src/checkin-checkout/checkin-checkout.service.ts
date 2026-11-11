import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, IsNull, Repository } from "typeorm";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { Asset, AssetStatus } from "../assets/entities/asset.entity";
import { Employee, EmployeeStatus } from "../employees/entities/employee.entity";
import { RolePermission } from "../roles/entities/role-permission.entity";
import { Role } from "../roles/entities/role.entity";
import { User } from "../users/entities/user.entity";
import { CheckinAssetDto } from "./dto/checkin-asset.dto";
import { CheckoutAssetDto } from "./dto/checkout-asset.dto";
import { AssetAllocation } from "./entities/asset-allocation.entity";

@Injectable()
export class CheckinCheckoutService {
  constructor(
    @InjectRepository(AssetAllocation)
    private readonly allocationsRepository: Repository<AssetAllocation>,
    @InjectRepository(Asset)
    private readonly assetsRepository: Repository<Asset>,
    @InjectRepository(Employee)
    private readonly employeesRepository: Repository<Employee>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly rolesRepository: Repository<Role>,
    @InjectRepository(RolePermission)
    private readonly permissionsRepository: Repository<RolePermission>,
    private readonly dataSource: DataSource,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async getAccess(userId: number) {
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
        module: "Check-in / Check-out",
      },
    });

    if (!permission) {
      throw new ForbiddenException(
        "Check-in / Check-out permission is not configured.",
      );
    }

    return {
      userId: user.id,
      roleName: role.name,
      permission,
    };
  }

  async findAll(userId: number): Promise<AssetAllocation[]> {
    const access = await this.getAccess(userId);
    if (!access.permission.canView) {
      throw new ForbiddenException("View permission is required.");
    }

    const where =
      access.permission.access === "Own Only"
        ? { createdByUserId: userId }
        : {};

    return this.allocationsRepository.find({
      where,
      order: { issuedAt: "DESC", id: "DESC" },
    });
  }

  async availableAssets(userId: number): Promise<Asset[]> {
    const access = await this.getAccess(userId);
    if (!access.permission.canAdd) return [];

    return this.assetsRepository.find({
      where: [
        { status: AssetStatus.AVAILABLE },
        { status: AssetStatus.ACTIVE },
      ],
      order: { assetTag: "ASC" },
      select: {
        id: true,
        assetTag: true,
        brand: true,
        model: true,
        status: true,
      },
    });
  }

  async activeEmployees(userId: number): Promise<Employee[]> {
    const access = await this.getAccess(userId);
    if (!access.permission.canAdd) return [];

    return this.employeesRepository.find({
      where: { status: EmployeeStatus.ACTIVE },
      order: { fullName: "ASC" },
      select: {
        id: true,
        staffCode: true,
        fullName: true,
        status: true,
      },
    });
  }

  async checkout(
    dto: CheckoutAssetDto,
    userId: number,
    ipAddress: string | null,
  ): Promise<AssetAllocation> {
    const access = await this.getAccess(userId);
    if (!access.permission.canAdd) {
      throw new ForbiddenException("Check Out permission is required.");
    }

    const allocation = await this.dataSource.transaction(async (manager) => {
      const asset = await manager
        .getRepository(Asset)
        .createQueryBuilder("asset")
        .setLock("pessimistic_write")
        .where("asset.id = :id", { id: dto.assetId })
        .getOne();

      if (!asset) throw new NotFoundException("Asset not found.");
      if (![AssetStatus.AVAILABLE, AssetStatus.ACTIVE].includes(asset.status)) {
        throw new ConflictException(
          "This asset is not available for check-out.",
        );
      }

      const openAllocation = await manager
        .getRepository(AssetAllocation)
        .findOne({
          where: {
            assetId: asset.id,
            returnedAt: IsNull(),
          },
        });

      if (openAllocation) {
        throw new ConflictException("This asset is already checked out.");
      }

      const employee = await manager
        .getRepository(Employee)
        .findOne({ where: { id: dto.employeeId } });

      if (!employee) throw new NotFoundException("Employee not found.");
      if (employee.status !== EmployeeStatus.ACTIVE) {
        throw new BadRequestException(
          "Only active employees can receive assets.",
        );
      }

      const saved = await manager.getRepository(AssetAllocation).save(
        manager.getRepository(AssetAllocation).create({
          assetId: asset.id,
          employeeId: employee.id,
          assetTag: asset.assetTag,
          employeeName: employee.fullName,
          employeeStaffCode: employee.staffCode,
          issuedAt: new Date(),
          returnedAt: null,
          checkoutNotes: dto.notes?.trim() || null,
          returnNotes: null,
          createdByUserId: userId,
          checkedInByUserId: null,
        }),
      );

      asset.status = AssetStatus.ASSIGNED;
      asset.assignedTo = employee.fullName;
      await manager.getRepository(Asset).save(asset);

      return saved;
    });

    await this.auditLogs.create({
      userId,
      ipAddress,
      action: "CHECK_OUT",
      module: "Check-in / Check-out",
      entityType: "AssetAllocation",
      entityId: String(allocation.id),
      description: `Checked out asset ${allocation.assetTag} to ${allocation.employeeName}`,
      newValues: allocation,
    });

    return allocation;
  }

  async checkin(
    id: number,
    dto: CheckinAssetDto,
    userId: number,
    ipAddress: string | null,
  ): Promise<AssetAllocation> {
    const access = await this.getAccess(userId);
    if (!access.permission.canEdit) {
      throw new ForbiddenException("Check In permission is required.");
    }

    const completed = await this.dataSource.transaction(async (manager) => {
      const allocation = await manager
        .getRepository(AssetAllocation)
        .createQueryBuilder("allocation")
        .setLock("pessimistic_write")
        .where("allocation.id = :id", { id })
        .getOne();

      if (!allocation) {
        throw new NotFoundException("Allocation record not found.");
      }
      if (allocation.returnedAt) {
        throw new ConflictException("This asset has already been checked in.");
      }
      if (
        access.permission.access === "Own Only" &&
        allocation.createdByUserId !== userId
      ) {
        throw new ForbiddenException(
          "You can only check in allocations created by your account.",
        );
      }

      const asset = await manager
        .getRepository(Asset)
        .createQueryBuilder("asset")
        .setLock("pessimistic_write")
        .where("asset.id = :id", { id: allocation.assetId })
        .getOne();

      if (!asset) throw new NotFoundException("Allocated asset not found.");

      allocation.returnedAt = new Date();
      allocation.returnNotes = dto.notes?.trim() || null;
      allocation.checkedInByUserId = userId;
      const saved = await manager
        .getRepository(AssetAllocation)
        .save(allocation);

      asset.status = AssetStatus.AVAILABLE;
      asset.assignedTo = null;
      await manager.getRepository(Asset).save(asset);

      return saved;
    });

    await this.auditLogs.create({
      userId,
      ipAddress,
      action: "CHECK_IN",
      module: "Check-in / Check-out",
      entityType: "AssetAllocation",
      entityId: String(completed.id),
      description: `Checked in asset ${completed.assetTag} from ${completed.employeeName}`,
      oldValues: { returnedAt: null },
      newValues: {
        returnedAt: completed.returnedAt,
        returnNotes: completed.returnNotes,
      },
    });

    return completed;
  }
}
