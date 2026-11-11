import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { CreateEmployeeDto } from "./dto/create-employee.dto";
import { UpdateEmployeeDto } from "./dto/update-employee.dto";
import { Employee, EmployeeStatus } from "./entities/employee.entity";

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(Employee)
    private readonly employeesRepository: Repository<Employee>,
    private readonly auditLogs: AuditLogsService,
  ) {}

  findAll(): Promise<Employee[]> {
    return this.employeesRepository.find({
      order: { createdAt: "DESC", id: "DESC" },
    });
  }

  async findOne(id: number): Promise<Employee> {
    const employee = await this.employeesRepository.findOne({ where: { id } });
    if (!employee) throw new NotFoundException("Employee not found.");
    return employee;
  }

  async create(
    dto: CreateEmployeeDto,
    actorId: number | null,
    ipAddress: string | null,
  ): Promise<Employee> {
    await this.ensureUnique(dto.staffCode, dto.email ?? null);

    const saved = await this.employeesRepository.save(
      this.employeesRepository.create({
        staffCode: dto.staffCode.trim(),
        fullName: dto.fullName.trim(),
        department: this.text(dto.department),
        email: this.email(dto.email),
        phone: this.text(dto.phone),
        jobTitle: this.text(dto.jobTitle),
        location: this.text(dto.location),
        status: dto.status,
      }),
    );

    await this.auditLogs.create({
      userId: actorId,
      ipAddress,
      action: "CREATE",
      module: "Employees",
      entityType: "Employee",
      entityId: String(saved.id),
      description: `Created employee ${saved.fullName} (${saved.staffCode})`,
      newValues: saved,
    });

    return saved;
  }

  async update(
    id: number,
    dto: UpdateEmployeeDto,
    actorId: number | null,
    ipAddress: string | null,
  ): Promise<Employee> {
    const existing = await this.findOne(id);
    const before = { ...existing };

    await this.ensureUnique(
      dto.staffCode ?? existing.staffCode,
      dto.email === undefined ? existing.email : dto.email,
      id,
    );

    const changes: Partial<Employee> = {};
    if (dto.staffCode !== undefined) changes.staffCode = dto.staffCode.trim();
    if (dto.fullName !== undefined) changes.fullName = dto.fullName.trim();
    if (dto.department !== undefined) changes.department = this.text(dto.department);
    if (dto.email !== undefined) changes.email = this.email(dto.email);
    if (dto.phone !== undefined) changes.phone = this.text(dto.phone);
    if (dto.jobTitle !== undefined) changes.jobTitle = this.text(dto.jobTitle);
    if (dto.location !== undefined) changes.location = this.text(dto.location);
    if (dto.status !== undefined) changes.status = dto.status;

    await this.employeesRepository.update(id, changes);
    const updated = await this.findOne(id);

    await this.auditLogs.create({
      userId: actorId,
      ipAddress,
      action: "UPDATE",
      module: "Employees",
      entityType: "Employee",
      entityId: String(id),
      description: `Updated employee ${updated.fullName} (${updated.staffCode})`,
      oldValues: before,
      newValues: updated,
    });

    return updated;
  }

  async updateStatus(
    id: number,
    status: EmployeeStatus,
    actorId: number | null,
    ipAddress: string | null,
  ): Promise<Employee> {
    const employee = await this.findOne(id);
    const previousStatus = employee.status;

    if (previousStatus === status) return employee;

    employee.status = status;
    const updated = await this.employeesRepository.save(employee);

    await this.auditLogs.create({
      userId: actorId,
      ipAddress,
      action: status === EmployeeStatus.ACTIVE ? "ACTIVATE" : "DEACTIVATE",
      module: "Employees",
      entityType: "Employee",
      entityId: String(id),
      description: `${status === EmployeeStatus.ACTIVE ? "Activated" : "Deactivated"} employee ${updated.fullName}`,
      oldValues: { status: previousStatus },
      newValues: { status },
    });

    return updated;
  }

  private async ensureUnique(
    staffCode: string,
    email: string | null | undefined,
    excludedId?: number,
  ) {
    const codeQuery = this.employeesRepository
      .createQueryBuilder("employee")
      .where("LOWER(employee.staffCode) = LOWER(:staffCode)", {
        staffCode: staffCode.trim(),
      });

    if (excludedId) codeQuery.andWhere("employee.id != :excludedId", { excludedId });
    if (await codeQuery.getOne()) throw new ConflictException("Staff code already exists.");

    const normalizedEmail = this.email(email);
    if (!normalizedEmail) return;

    const emailQuery = this.employeesRepository
      .createQueryBuilder("employee")
      .where("LOWER(employee.email) = LOWER(:email)", { email: normalizedEmail });

    if (excludedId) emailQuery.andWhere("employee.id != :excludedId", { excludedId });
    if (await emailQuery.getOne()) throw new ConflictException("Employee email already exists.");
  }

  private text(value: string | null | undefined): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private email(value: string | null | undefined): string | null {
    const normalized = value?.trim().toLowerCase();
    return normalized ? normalized : null;
  }
}
