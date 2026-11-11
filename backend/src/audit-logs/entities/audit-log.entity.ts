import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity({ name: "audit_logs" })
@Index("IDX_audit_logs_module_created", ["module", "createdAt"])
@Index("IDX_audit_logs_user_created", ["userId", "createdAt"])
export class AuditLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "user_id", type: "int", nullable: true })
  userId!: number | null;

  @Column({ type: "varchar", length: 60 })
  action!: string;

  @Column({ type: "varchar", length: 100 })
  module!: string;

  @Column({ name: "entity_type", type: "varchar", length: 100 })
  entityType!: string;

  @Column({ name: "entity_id", type: "varchar", length: 100, nullable: true })
  entityId!: string | null;

  @Column({ type: "varchar", length: 500 })
  description!: string;

  @Column({ name: "old_values", type: "jsonb", nullable: true })
  oldValues!: Record<string, unknown> | null;

  @Column({ name: "new_values", type: "jsonb", nullable: true })
  newValues!: Record<string, unknown> | null;

  @Column({ name: "ip_address", type: "varchar", length: 80, nullable: true })
  ipAddress!: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
