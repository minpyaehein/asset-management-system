import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AuditLog } from "./entities/audit-log.entity";

export type CreateAuditLogInput = {
  userId: number | null;
  action: string;
  module: string;
  entityType: string;
  entityId?: string | null;
  description: string;
  oldValues?: unknown;
  newValues?: unknown;
  ipAddress?: string | null;
};

@Injectable()
export class AuditLogsService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly repository: Repository<AuditLog>,
  ) {}

  create(input: CreateAuditLogInput): Promise<AuditLog> {
    return this.repository.save(
      this.repository.create({
        userId: input.userId,
        action: input.action,
        module: input.module,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        description: input.description,
        oldValues: this.jsonObject(input.oldValues),
        newValues: this.jsonObject(input.newValues),
        ipAddress: input.ipAddress ?? null,
      }),
    );
  }

  findAll(): Promise<AuditLog[]> {
    return this.repository.find({
      order: { createdAt: "DESC", id: "DESC" },
      take: 1000,
    });
  }

  private jsonObject(value: unknown): Record<string, unknown> | null {
    if (value === undefined || value === null) return null;
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  }
}
