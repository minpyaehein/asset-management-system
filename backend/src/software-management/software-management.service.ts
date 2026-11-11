import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { QueryFailedError, Repository } from "typeorm";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { CreateSoftwareRecordDto } from "./dto/create-software-record.dto";
import { UpdateSoftwareRecordDto } from "./dto/update-software-record.dto";
import {
  SoftwareManagementRecord,
  SoftwareRecordType,
} from "./entities/software-management-record.entity";

@Injectable()
export class SoftwareManagementService {
  constructor(
    @InjectRepository(SoftwareManagementRecord)
    private readonly repository: Repository<SoftwareManagementRecord>,
    private readonly auditLogs: AuditLogsService,
  ) {}

  findAll(type: SoftwareRecordType): Promise<SoftwareManagementRecord[]> {
    return this.repository.find({
      where: { recordType: type },
      order: { createdAt: "DESC", id: "DESC" },
    });
  }

  async create(
    type: SoftwareRecordType,
    dto: CreateSoftwareRecordDto,
    actorId: number | null,
    ipAddress: string | null,
  ): Promise<SoftwareManagementRecord> {
    this.validate(type, dto);

    try {
      const saved = await this.repository.save(
        this.repository.create({
          recordType: type,
          product: this.text(dto.product),
          vendor: this.text(dto.vendor),
          licenseKey: this.text(dto.licenseKey),
          seats: dto.seats ?? null,
          expiry: dto.expiry ?? null,
          assetTag: this.text(dto.assetTag),
          license: this.text(dto.license),
          installedDate: dto.installedDate ?? null,
          installedBy: this.text(dto.installedBy),
          reference: this.text(dto.reference),
          owner: this.text(dto.owner),
          status: this.text(dto.status),
          notes: this.text(dto.notes),
          isActive: true,
        }),
      );

      await this.auditLogs.create({
        userId: actorId,
        ipAddress,
        action: "CREATE",
        module: "Software & Warranty",
        entityType: "SoftwareManagementRecord",
        entityId: String(saved.id),
        description: `Created ${type} record ${this.label(saved)}`,
        newValues: saved,
      });

      return saved;
    } catch (error) {
      this.rethrowDatabaseError(error);
    }
  }

  async update(
    type: SoftwareRecordType,
    id: number,
    dto: UpdateSoftwareRecordDto,
    actorId: number | null,
    ipAddress: string | null,
  ): Promise<SoftwareManagementRecord> {
    const existing = await this.findOne(type, id);
    const before = { ...existing };
    const merged: CreateSoftwareRecordDto = {
      product: dto.product === undefined ? existing.product : dto.product,
      vendor: dto.vendor === undefined ? existing.vendor : dto.vendor,
      licenseKey:
        dto.licenseKey === undefined ? existing.licenseKey : dto.licenseKey,
      seats: dto.seats === undefined ? existing.seats : dto.seats,
      expiry: dto.expiry === undefined ? existing.expiry : dto.expiry,
      assetTag: dto.assetTag === undefined ? existing.assetTag : dto.assetTag,
      license: dto.license === undefined ? existing.license : dto.license,
      installedDate:
        dto.installedDate === undefined
          ? existing.installedDate
          : dto.installedDate,
      installedBy:
        dto.installedBy === undefined ? existing.installedBy : dto.installedBy,
      reference:
        dto.reference === undefined ? existing.reference : dto.reference,
      owner: dto.owner === undefined ? existing.owner : dto.owner,
      status: dto.status === undefined ? existing.status : dto.status,
      notes: dto.notes === undefined ? existing.notes : dto.notes,
    };

    this.validate(type, merged);

    try {
      await this.repository.update(id, {
        ...(dto.product !== undefined
          ? { product: this.text(dto.product) }
          : {}),
        ...(dto.vendor !== undefined ? { vendor: this.text(dto.vendor) } : {}),
        ...(dto.licenseKey !== undefined
          ? { licenseKey: this.text(dto.licenseKey) }
          : {}),
        ...(dto.seats !== undefined ? { seats: dto.seats ?? null } : {}),
        ...(dto.expiry !== undefined ? { expiry: dto.expiry ?? null } : {}),
        ...(dto.assetTag !== undefined
          ? { assetTag: this.text(dto.assetTag) }
          : {}),
        ...(dto.license !== undefined
          ? { license: this.text(dto.license) }
          : {}),
        ...(dto.installedDate !== undefined
          ? { installedDate: dto.installedDate ?? null }
          : {}),
        ...(dto.installedBy !== undefined
          ? { installedBy: this.text(dto.installedBy) }
          : {}),
        ...(dto.reference !== undefined
          ? { reference: this.text(dto.reference) }
          : {}),
        ...(dto.owner !== undefined ? { owner: this.text(dto.owner) } : {}),
        ...(dto.status !== undefined
          ? { status: this.text(dto.status) }
          : {}),
        ...(dto.notes !== undefined ? { notes: this.text(dto.notes) } : {}),
      });

      const updated = await this.findOne(type, id);

      await this.auditLogs.create({
        userId: actorId,
        ipAddress,
        action: "UPDATE",
        module: "Software & Warranty",
        entityType: "SoftwareManagementRecord",
        entityId: String(id),
        description: `Updated ${type} record ${this.label(updated)}`,
        oldValues: before,
        newValues: updated,
      });

      return updated;
    } catch (error) {
      this.rethrowDatabaseError(error);
    }
  }

  async updateStatus(
    type: SoftwareRecordType,
    id: number,
    isActive: boolean,
    actorId: number | null,
    ipAddress: string | null,
  ): Promise<SoftwareManagementRecord> {
    const record = await this.findOne(type, id);
    const previous = record.isActive;
    record.isActive = isActive;

    try {
      const updated = await this.repository.save(record);

      await this.auditLogs.create({
        userId: actorId,
        ipAddress,
        action: isActive ? "ACTIVATE" : "DEACTIVATE",
        module: "Software & Warranty",
        entityType: "SoftwareManagementRecord",
        entityId: String(id),
        description: `${isActive ? "Activated" : "Deactivated"} ${type} record ${this.label(updated)}`,
        oldValues: { isActive: previous },
        newValues: { isActive },
      });

      return updated;
    } catch (error) {
      this.rethrowDatabaseError(error);
    }
  }

  private async findOne(type: SoftwareRecordType, id: number) {
    const record = await this.repository.findOne({
      where: { id, recordType: type },
    });
    if (!record) throw new NotFoundException("Software record not found.");
    return record;
  }

  private validate(
    type: SoftwareRecordType,
    dto: Partial<CreateSoftwareRecordDto>,
  ) {
    if (type === SoftwareRecordType.LICENSE) {
      if (
        !this.text(dto.product) ||
        !this.text(dto.vendor) ||
        !this.text(dto.licenseKey) ||
        dto.seats === null ||
        dto.seats === undefined ||
        !dto.expiry
      ) {
        throw new BadRequestException(
          "Product, vendor, license key, seats, and expiry date are required.",
        );
      }
    }

    if (type === SoftwareRecordType.INSTALLATION) {
      if (!this.text(dto.assetTag) || !this.text(dto.license) || !dto.installedDate) {
        throw new BadRequestException(
          "Asset tag, license, and installed date are required.",
        );
      }
    }

    if (type === SoftwareRecordType.WARRANTY) {
      if (
        !this.text(dto.assetTag) ||
        !this.text(dto.product) ||
        !this.text(dto.vendor) ||
        !this.text(dto.reference) ||
        !dto.expiry ||
        !this.text(dto.status)
      ) {
        throw new BadRequestException(
          "Asset tag, product, vendor, reference, expiry date, and status are required.",
        );
      }
    }
  }

  private text(value: string | null | undefined): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private label(record: SoftwareManagementRecord): string {
    return (
      record.product ||
      record.license ||
      record.assetTag ||
      `#${record.id}`
    );
  }

  private rethrowDatabaseError(error: unknown): never {
    if (error instanceof QueryFailedError) {
      const driver = error.driverError as {
        code?: string;
        detail?: string;
        message?: string;
      };

      if (driver.code === "23505") {
        throw new BadRequestException(
          driver.detail ?? "A duplicate software record already exists.",
        );
      }

      if (driver.code === "42P01" || driver.code === "42703") {
        throw new BadRequestException(
          "The Software & Warranty database schema is incomplete. Run fix-software-management-schema.sql.",
        );
      }

      throw new BadRequestException(
        driver.detail ?? driver.message ?? "Unable to save the software record.",
      );
    }

    throw error;
  }
}
