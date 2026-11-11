import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Asset, AssetStatus } from "../assets/entities/asset.entity";
import { RolePermission } from "../roles/entities/role-permission.entity";
import { Role } from "../roles/entities/role.entity";
import { User } from "../users/entities/user.entity";

type AccessLevel = "Own Only" | "Assigned" | "All";

type DashboardPermission = {
  module: string;
  access: AccessLevel;
  canView: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canDeactivate: boolean;
  canExport: boolean;
};

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Asset)
    private readonly assetsRepository: Repository<Asset>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly rolesRepository: Repository<Role>,
    @InjectRepository(RolePermission)
    private readonly permissionsRepository: Repository<RolePermission>,
  ) {}

  async summary(userId: number) {
    const { role, permissions, dashboardAccess } = await this.getAccess(userId);
    const canViewAssets = permissions.some(
      (permission) =>
        ["Assets & Hardware", "Assets"].includes(permission.module) &&
        permission.canView,
    );

    const assets = canViewAssets
      ? await this.assetsRepository
          .createQueryBuilder("asset")
          .select(["asset.id", "asset.status"])
          .where("asset.status NOT IN (:...excludedStatuses)", {
            excludedStatuses: [
              AssetStatus.INACTIVE,
              AssetStatus.RETIRED,
            ],
          })
          .getMany()
      : [];

    return {
      generatedAt: new Date().toISOString(),
      roleName: role.name,
      dashboardAccess,
      stats: {
        inventory: assets.length,
        available: assets.filter((asset) =>
          [AssetStatus.AVAILABLE, AssetStatus.ACTIVE].includes(asset.status),
        ).length,
        assigned: assets.filter((asset) => asset.status === AssetStatus.ASSIGNED)
          .length,
        maintenance: assets.filter(
          (asset) => asset.status === AssetStatus.MAINTENANCE,
        ).length,
      },
      permissions: permissions.map((permission) =>
        this.toDashboardPermission(permission),
      ),
    };
  }

  private async getAccess(userId: number) {
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

    const permissions = await this.permissionsRepository.find({
      where: { roleId: role.id },
      order: { module: "ASC" },
    });

    const dashboardPermission = permissions.find(
      (permission) => permission.module === "Dashboard",
    );

    if (dashboardPermission && !dashboardPermission.canView) {
      throw new ForbiddenException("Dashboard View permission is required.");
    }

    const dashboardAccess = this.accessLevel(dashboardPermission?.access);
    return { role, permissions, dashboardAccess };
  }

  private toDashboardPermission(
    permission: RolePermission,
  ): DashboardPermission {
    return {
      module: permission.module,
      access: this.accessLevel(permission.access),
      canView: permission.canView,
      canAdd: permission.canAdd,
      canEdit: permission.canEdit,
      canDeactivate: permission.canDeactivate,
      canExport: permission.canExport,
    };
  }

  private accessLevel(value: string | null | undefined): AccessLevel {
    return value === "Own Only" || value === "Assigned" || value === "All"
      ? value
      : "All";
  }
}
