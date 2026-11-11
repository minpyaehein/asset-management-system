import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Asset, AssetStatus } from "../assets/entities/asset.entity";
import { MaintenanceRecord, MaintenanceTab } from "../maintenance-center/entities/maintenance-record.entity";
import { RolePermission } from "../roles/entities/role-permission.entity";
import { Role } from "../roles/entities/role.entity";
import { SoftwareManagementRecord, SoftwareRecordType } from "../software-management/entities/software-management-record.entity";
import { User } from "../users/entities/user.entity";

type AccessLevel = "Own Only" | "Assigned" | "All";
type ReportSection = "inventory" | "software" | "maintenance";
type ReportSections = Record<ReportSection, boolean>;

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Asset) private readonly assets: Repository<Asset>,
    @InjectRepository(SoftwareManagementRecord) private readonly software: Repository<SoftwareManagementRecord>,
    @InjectRepository(MaintenanceRecord) private readonly maintenance: Repository<MaintenanceRecord>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Role) private readonly roles: Repository<Role>,
    @InjectRepository(RolePermission) private readonly permissions: Repository<RolePermission>,
  ) {}

  async summary(userId: number) {
    const access = await this.getAccess(userId);
    const [inventory, software, maintenance] = await Promise.all([
      access.sections.inventory ? this.inventorySummary() : Promise.resolve(this.emptyInventory()),
      access.sections.software ? this.softwareSummary() : Promise.resolve(this.emptySoftware()),
      access.sections.maintenance ? this.maintenanceSummary(userId, access.access) : Promise.resolve(this.emptyMaintenance()),
    ]);
    return { generatedAt: new Date().toISOString(), access: access.access, sections: access.sections, inventory, software, maintenance };
  }

  private async inventorySummary() {
    const rows = await this.assets
      .createQueryBuilder("asset")
      .select(["asset.id", "asset.category", "asset.status"])
      .where("asset.status NOT IN (:...excluded)", { excluded: [AssetStatus.INACTIVE, AssetStatus.RETIRED] })
      .getMany();
    const categories = new Map<string, number>();
    rows.forEach((row) => { const name = row.category?.trim() || "Uncategorized"; categories.set(name, (categories.get(name) ?? 0) + 1); });
    return {
      total: rows.length,
      available: rows.filter((row) => [AssetStatus.AVAILABLE, AssetStatus.ACTIVE].includes(row.status)).length,
      assigned: rows.filter((row) => row.status === AssetStatus.ASSIGNED).length,
      maintenance: rows.filter((row) => row.status === AssetStatus.MAINTENANCE).length,
      categories: [...categories.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
    };
  }

  private async softwareSummary() {
    const rows = await this.software.createQueryBuilder("record")
      .where("record.isActive = :active", { active: true })
      .andWhere("record.expiry IS NOT NULL")
      .andWhere("record.recordType IN (:...types)", { types: [SoftwareRecordType.LICENSE, SoftwareRecordType.WARRANTY] })
      .orderBy("record.expiry", "ASC").getMany();
    const today = this.today();
    const cutoff = new Date(today); cutoff.setUTCDate(cutoff.getUTCDate() + 90);
    const upcomingRenewals = rows.filter((row) => { const expiry = this.parseDate(row.expiry); return expiry && expiry >= today && expiry <= cutoff; })
      .slice(0, 25)
      .map((row) => ({ name: row.product || row.license || row.reference || row.assetTag || `Software record #${row.id}`, expiryDate: row.expiry as string, owner: row.owner || row.vendor || "Not assigned" }));
    const dueWithin30Days = upcomingRenewals.filter((row) => { const expiry = this.parseDate(row.expiryDate); return expiry && Math.ceil((expiry.getTime() - today.getTime()) / 86400000) <= 30; }).length;
    return { upcomingRenewals, dueWithin30Days };
  }

  private async maintenanceSummary(userId: number, access: AccessLevel) {
    const rows = await this.maintenance.find({ where: access === "Own Only" ? { createdByUserId: userId } : {} });
    const active = rows.filter((row) => row.isActive);
    const planner = active.filter((row) => row.tab === MaintenanceTab.PLANNER);
    const history = active.filter((row) => row.tab === MaintenanceTab.HISTORY);
    return { total: active.length, planned: planner.length, open: planner.filter((row) => !["Completed", "Cancelled"].includes(row.status ?? "")).length, completed: history.length, cost: history.reduce((sum, row) => sum + Number(row.cost ?? 0), 0) };
  }

  private async getAccess(userId: number): Promise<{ access: AccessLevel; sections: ReportSections }> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException("Current user was not found.");
    if (user.status !== "Active") throw new ForbiddenException("Your user account is inactive.");
    const role = await this.roles.findOne({ where: { id: user.roleId } });
    if (!role) throw new NotFoundException("Assigned role was not found.");
    if (!role.isActive) throw new ForbiddenException("Your assigned role is inactive.");
    const permissions = await this.permissions.find({ where: { roleId: role.id } });
    const reportPermission = permissions.find((item) => item.module === "Reports & Analytics");
    if (reportPermission && !reportPermission.canView) throw new ForbiddenException("Reports & Analytics View permission is required.");
    const sections: ReportSections = {
      inventory: this.canView(permissions, ["Assets & Hardware", "Assets"]),
      software: this.canView(permissions, ["Software & Warranty"]),
      maintenance: this.canView(permissions, ["Maintenance Center"]),
    };
    const access: AccessLevel = reportPermission?.access === "Own Only" || reportPermission?.access === "Assigned" || reportPermission?.access === "All" ? reportPermission.access : "All";
    return { access, sections };
  }

  private canView(rows: RolePermission[], modules: string[]) { return rows.some((row) => modules.includes(row.module) && row.canView); }
  private parseDate(value: string | null) { if (!value) return null; const date = new Date(`${value}T00:00:00.000Z`); return Number.isNaN(date.getTime()) ? null : date; }
  private today() { const now = new Date(); return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())); }
  private emptyInventory() { return { total: 0, available: 0, assigned: 0, maintenance: 0, categories: [] as { name: string; value: number }[] }; }
  private emptySoftware() { return { upcomingRenewals: [] as { name: string; expiryDate: string; owner: string }[], dueWithin30Days: 0 }; }
  private emptyMaintenance() { return { total: 0, planned: 0, open: 0, completed: 0, cost: 0 }; }
}
