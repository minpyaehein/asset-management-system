import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { Employee, EmployeeStatus } from "../employees/entities/employee.entity";
import { RolePermission } from "../roles/entities/role-permission.entity";
import { Role } from "../roles/entities/role.entity";
import { User } from "../users/entities/user.entity";
import { CreateAcknowledgementDto } from "./dto/create-acknowledgement.dto";
import { UpdateAcknowledgementDto } from "./dto/update-acknowledgement.dto";
import { Acknowledgement } from "./entities/acknowledgement.entity";

@Injectable()
export class AcknowledgementsService {
  constructor(
    @InjectRepository(Acknowledgement)
    private readonly repository: Repository<Acknowledgement>,
    @InjectRepository(Employee)
    private readonly employeesRepository: Repository<Employee>,
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
    dto: CreateAcknowledgementDto,
    actorId: number,
    ipAddress: string | null,
  ) {
    const permission = await this.getPermission(actorId);
    if (!permission.canAdd) {
      throw new ForbiddenException("Add permission is required.");
    }

    await this.ensureUnique(dto.reference);
    const employee = await this.resolveEmployee(dto.employeeId ?? null);

    const saved = await this.repository.save(
      this.repository.create({
        reference: dto.reference.trim(),
        assetTag: this.text(dto.assetTag),
        employeeId: employee?.id ?? null,
        employeeName: employee?.fullName ?? this.text(dto.employeeName),
        issuedDate: dto.issuedDate ?? null,
        status: dto.status,
        notes: this.text(dto.notes),
        isActive: true,
        createdByUserId: actorId,
      }),
    );

    await this.auditLogs.create({
      userId: actorId,
      ipAddress,
      action: "CREATE",
      module: "Acknowledgement",
      entityType: "Acknowledgement",
      entityId: String(saved.id),
      description: `Created acknowledgement ${saved.reference}`,
      newValues: saved,
    });

    return saved;
  }

  async update(
    id: number,
    dto: UpdateAcknowledgementDto,
    actorId: number,
    ipAddress: string | null,
  ) {
    const permission = await this.getPermission(actorId);
    if (!permission.canEdit) {
      throw new ForbiddenException("Edit permission is required.");
    }

    const existing = await this.findOne(id, actorId);
    const before = { ...existing };

    if (dto.reference !== undefined) {
      await this.ensureUnique(dto.reference, id);
    }

    const employee =
      dto.employeeId === undefined
        ? undefined
        : await this.resolveEmployee(dto.employeeId ?? null);

    await this.repository.update(id, {
      ...(dto.reference !== undefined
        ? { reference: dto.reference.trim() }
        : {}),
      ...(dto.assetTag !== undefined
        ? { assetTag: this.text(dto.assetTag) }
        : {}),
      ...(dto.employeeId !== undefined
        ? {
            employeeId: employee?.id ?? null,
            employeeName: employee?.fullName ?? this.text(dto.employeeName),
          }
        : dto.employeeName !== undefined
          ? { employeeName: this.text(dto.employeeName) }
          : {}),
      ...(dto.issuedDate !== undefined
        ? { issuedDate: dto.issuedDate ?? null }
        : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.notes !== undefined ? { notes: this.text(dto.notes) } : {}),
    });

    const updated = await this.findOne(id, actorId);

    await this.auditLogs.create({
      userId: actorId,
      ipAddress,
      action: "UPDATE",
      module: "Acknowledgement",
      entityType: "Acknowledgement",
      entityId: String(id),
      description: `Updated acknowledgement ${updated.reference}`,
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
      module: "Acknowledgement",
      entityType: "Acknowledgement",
      entityId: String(id),
      description: `${isActive ? "Activated" : "Deactivated"} acknowledgement ${record.reference}`,
      oldValues: { isActive: previous },
      newValues: { isActive },
    });

    return updated;
  }

  private async findOne(id: number, userId: number) {
    const permission = await this.getPermission(userId);
    const record = await this.repository.findOne({ where: { id } });

    if (!record) {
      throw new NotFoundException("Acknowledgement not found.");
    }

    if (
      permission.access === "Own Only" &&
      record.createdByUserId !== userId
    ) {
      throw new ForbiddenException(
        "You can only access acknowledgements created by your account.",
      );
    }

    return record;
  }

  private async resolveEmployee(employeeId: number | null) {
    if (!employeeId) return null;

    const employee = await this.employeesRepository.findOne({
      where: { id: employeeId },
    });

    if (!employee) {
      throw new NotFoundException("Employee not found.");
    }

    if (employee.status !== EmployeeStatus.ACTIVE) {
      throw new ForbiddenException("Only active employees can be selected.");
    }

    return employee;
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
      where: { roleId: role.id, module: "Acknowledgement" },
    });

    if (!permission) {
      throw new ForbiddenException(
        "Acknowledgement permission is not configured.",
      );
    }

    return permission;
  }

  private async ensureUnique(reference: string, excludedId?: number) {
    const query = this.repository
      .createQueryBuilder("acknowledgement")
      .where("LOWER(acknowledgement.reference) = LOWER(:reference)", {
        reference: reference.trim(),
      });

    if (excludedId) {
      query.andWhere("acknowledgement.id != :excludedId", { excludedId });
    }

    if (await query.getOne()) {
      throw new ConflictException("Acknowledgement reference already exists.");
    }
  }

  private text(value: string | null | undefined): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }
}
