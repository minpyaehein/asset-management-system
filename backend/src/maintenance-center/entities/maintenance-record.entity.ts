import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export enum MaintenanceTab {
  PLANNER = "planner",
  HISTORY = "history",
}

@Entity({ name: "maintenance_records" })
@Index("UQ_maintenance_records_record_code", ["recordCode"], { unique: true })
@Index("IDX_maintenance_records_tab_date", ["tab", "date"])
export class MaintenanceRecord {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "record_code", type: "varchar", length: 80 })
  recordCode!: string;

  @Column({ type: "varchar", length: 20 })
  tab!: MaintenanceTab;

  @Column({ name: "asset_tag", type: "varchar", length: 100 })
  assetTag!: string;

  @Column({ type: "varchar", length: 80 })
  type!: string;

  @Column({ type: "date" })
  date!: string;

  @Column({ type: "varchar", length: 150, nullable: true })
  technician!: string | null;

  @Column({ type: "varchar", length: 50, nullable: true })
  status!: string | null;

  @Column({ type: "numeric", precision: 14, scale: 2, nullable: true })
  cost!: string | null;

  @Column({ type: "text", nullable: true })
  detail!: string | null;

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive!: boolean;

  @Column({ name: "created_by_user_id", type: "int", nullable: true })
  createdByUserId!: number | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
