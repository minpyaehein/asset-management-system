import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { BulkImportAssetsDto } from "./dto/bulk-import-assets.dto";
import { BulkImportResult } from "./dto/bulk-import-result.dto";
import { CreateAssetDto } from "./dto/create-asset.dto";
import { UpdateAssetDto } from "./dto/update-asset.dto";
import { Asset, AssetStatus } from "./entities/asset.entity";

@Injectable()
export class AssetsService {
  constructor(
    @InjectRepository(Asset)
    private readonly assetsRepository: Repository<Asset>,
    private readonly auditLogs: AuditLogsService,
  ) {}

  findAll(): Promise<Asset[]> {
    return this.assetsRepository.find({
      order: { createdAt: "DESC", id: "DESC" },
    });
  }

  async findOne(id: number): Promise<Asset> {
    const asset = await this.assetsRepository.findOne({ where: { id } });
    if (!asset) throw new NotFoundException("Asset not found.");
    return asset;
  }

  async bulkImport(
    dto: BulkImportAssetsDto,
    actorId: number | null,
    ipAddress: string | null,
  ): Promise<BulkImportResult> {
    const result: BulkImportResult = {
      totalRows: dto.assets.length,
      importedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      skipped: [],
      failed: [],
    };

    const seenAssetTags = new Set<string>();
    const seenSerialNumbers = new Set<string>();

    for (let index = 0; index < dto.assets.length; index += 1) {
      const row = index + 2;
      const input = dto.assets[index];
      const assetTag = input.assetTag.trim();
      const normalizedTag = assetTag.toLowerCase();
      const serialNumber = this.text(input.serialNumber);
      const normalizedSerial = serialNumber?.toLowerCase() ?? null;

      if (seenAssetTags.has(normalizedTag)) {
        result.skipped.push({
          row,
          assetTag,
          reason: "Duplicate Asset Tag inside the CSV file.",
        });
        result.skippedCount += 1;
        continue;
      }

      if (normalizedSerial && seenSerialNumbers.has(normalizedSerial)) {
        result.skipped.push({
          row,
          assetTag,
          reason: "Duplicate Serial Number inside the CSV file.",
        });
        result.skippedCount += 1;
        continue;
      }

      seenAssetTags.add(normalizedTag);
      if (normalizedSerial) seenSerialNumbers.add(normalizedSerial);

      try {
        await this.ensureUnique(assetTag, serialNumber);
        this.validateDates(
          input.purchaseDate ?? null,
          input.warrantyEnd ?? null,
        );

        const saved = await this.assetsRepository.save(
          this.assetsRepository.create({
            assetTag,
            category: input.category.trim(),
            brand: this.text(input.brand),
            model: this.text(input.model),
            serialNumber,
            status: input.status,
            assignedTo: this.text(input.assignedTo),
            purchaseDate: input.purchaseDate ?? null,
            purchaseCost:
              input.purchaseCost === null || input.purchaseCost === undefined
                ? null
                : input.purchaseCost.toFixed(2),
            warrantyEnd: input.warrantyEnd ?? null,
            location: this.text(input.location),
            notes: this.text(input.notes),
          }),
        );

        result.importedCount += 1;

        await this.auditLogs.create({
          userId: actorId,
          ipAddress,
          action: "BULK_IMPORT",
          module: "Assets & Hardware",
          entityType: "Asset",
          entityId: String(saved.id),
          description: `Imported asset ${saved.assetTag}`,
          newValues: saved,
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : "Import failed.";
        const duplicate = error instanceof ConflictException;
        const issue = { row, assetTag, reason };

        if (duplicate) {
          result.skipped.push(issue);
          result.skippedCount += 1;
        } else {
          result.failed.push(issue);
          result.failedCount += 1;
        }
      }
    }

    await this.auditLogs.create({
      userId: actorId,
      ipAddress,
      action: "BULK_IMPORT_SUMMARY",
      module: "Assets & Hardware",
      entityType: "AssetImport",
      entityId: null,
      description: `Bulk asset import completed: ${result.importedCount} imported, ${result.skippedCount} skipped, ${result.failedCount} failed`,
      newValues: result,
    });

    return result;
  }

  async create(
    dto: CreateAssetDto,
    actorId: number | null,
    ipAddress: string | null,
  ): Promise<Asset> {
    await this.ensureUnique(dto.assetTag, dto.serialNumber ?? null);
    this.validateDates(dto.purchaseDate ?? null, dto.warrantyEnd ?? null);

    const asset = this.assetsRepository.create({
      assetTag: dto.assetTag.trim(),
      category: dto.category.trim(),
      brand: this.text(dto.brand),
      model: this.text(dto.model),
      serialNumber: this.text(dto.serialNumber),
      status: dto.status,
      assignedTo: this.text(dto.assignedTo),
      purchaseDate: dto.purchaseDate ?? null,
      purchaseCost:
        dto.purchaseCost === null || dto.purchaseCost === undefined
          ? null
          : dto.purchaseCost.toFixed(2),
      warrantyEnd: dto.warrantyEnd ?? null,
      location: this.text(dto.location),
      notes: this.text(dto.notes),
    });

    const saved = await this.assetsRepository.save(asset);

    await this.auditLogs.create({
      userId: actorId,
      ipAddress,
      action: "CREATE",
      module: "Assets & Hardware",
      entityType: "Asset",
      entityId: String(saved.id),
      description: `Created asset ${saved.assetTag}`,
      newValues: saved,
    });

    return saved;
  }

  async update(
    id: number,
    dto: UpdateAssetDto,
    actorId: number | null,
    ipAddress: string | null,
  ): Promise<Asset> {
    const existing = await this.findOne(id);
    const before = { ...existing };

    await this.ensureUnique(
      dto.assetTag ?? existing.assetTag,
      dto.serialNumber === undefined ? existing.serialNumber : dto.serialNumber,
      id,
    );

    this.validateDates(
      dto.purchaseDate === undefined ? existing.purchaseDate : dto.purchaseDate,
      dto.warrantyEnd === undefined ? existing.warrantyEnd : dto.warrantyEnd,
    );

    const changes: Partial<Asset> = {};
    if (dto.assetTag !== undefined) changes.assetTag = dto.assetTag.trim();
    if (dto.category !== undefined) changes.category = dto.category.trim();
    if (dto.brand !== undefined) changes.brand = this.text(dto.brand);
    if (dto.model !== undefined) changes.model = this.text(dto.model);
    if (dto.serialNumber !== undefined) {
      changes.serialNumber = this.text(dto.serialNumber);
    }
    if (dto.status !== undefined) changes.status = dto.status;
    if (dto.assignedTo !== undefined) {
      changes.assignedTo = this.text(dto.assignedTo);
    }
    if (dto.purchaseDate !== undefined) {
      changes.purchaseDate = dto.purchaseDate ?? null;
    }
    if (dto.purchaseCost !== undefined) {
      changes.purchaseCost =
        dto.purchaseCost === null ? null : dto.purchaseCost.toFixed(2);
    }
    if (dto.warrantyEnd !== undefined) {
      changes.warrantyEnd = dto.warrantyEnd ?? null;
    }
    if (dto.location !== undefined) changes.location = this.text(dto.location);
    if (dto.notes !== undefined) changes.notes = this.text(dto.notes);

    await this.assetsRepository.update(id, changes);
    const updated = await this.findOne(id);

    await this.auditLogs.create({
      userId: actorId,
      ipAddress,
      action: "UPDATE",
      module: "Assets & Hardware",
      entityType: "Asset",
      entityId: String(id),
      description: `Updated asset ${updated.assetTag}`,
      oldValues: before,
      newValues: updated,
    });

    return updated;
  }

  async updateStatus(
    id: number,
    status: AssetStatus,
    actorId: number | null,
    ipAddress: string | null,
  ): Promise<Asset> {
    const asset = await this.findOne(id);
    const previousStatus = asset.status;

    if (previousStatus === status) return asset;
    if (status === AssetStatus.AVAILABLE && asset.assignedTo) {
      throw new BadRequestException(
        "Clear the assigned user before changing this asset to Available.",
      );
    }

    asset.status = status;
    const updated = await this.assetsRepository.save(asset);

    await this.auditLogs.create({
      userId: actorId,
      ipAddress,
      action:
        status === AssetStatus.INACTIVE ? "DEACTIVATE" : "ACTIVATE",
      module: "Assets & Hardware",
      entityType: "Asset",
      entityId: String(id),
      description: `${status === AssetStatus.INACTIVE ? "Deactivated" : "Activated"} asset ${updated.assetTag}`,
      oldValues: { status: previousStatus },
      newValues: { status },
    });

    return updated;
  }

  private async ensureUnique(
    assetTag: string,
    serialNumber: string | null | undefined,
    excludedId?: number,
  ) {
    const assetTagQuery = this.assetsRepository
      .createQueryBuilder("asset")
      .where("LOWER(asset.assetTag) = LOWER(:assetTag)", {
        assetTag: assetTag.trim(),
      });

    if (excludedId) {
      assetTagQuery.andWhere("asset.id != :excludedId", { excludedId });
    }

    if (await assetTagQuery.getOne()) {
      throw new ConflictException("Asset tag already exists.");
    }

    const serial = this.text(serialNumber);
    if (!serial) return;

    const serialQuery = this.assetsRepository
      .createQueryBuilder("asset")
      .where("LOWER(asset.serialNumber) = LOWER(:serialNumber)", {
        serialNumber: serial,
      });

    if (excludedId) {
      serialQuery.andWhere("asset.id != :excludedId", { excludedId });
    }

    if (await serialQuery.getOne()) {
      throw new ConflictException("Serial number already exists.");
    }
  }

  private validateDates(
    purchaseDate: string | null,
    warrantyEnd: string | null,
  ) {
    if (
      purchaseDate &&
      warrantyEnd &&
      new Date(warrantyEnd).getTime() < new Date(purchaseDate).getTime()
    ) {
      throw new BadRequestException(
        "Warranty end date cannot be earlier than purchase date.",
      );
    }
  }

  private text(value: string | null | undefined): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }
}
