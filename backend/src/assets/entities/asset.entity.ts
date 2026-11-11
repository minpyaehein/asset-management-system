import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export enum AssetStatus {
  ACTIVE = "Active",
  AVAILABLE = "Available",
  ASSIGNED = "Assigned",
  MAINTENANCE = "Maintenance",
  INACTIVE = "Inactive",
  RETIRED = "Retired",
}

@Entity({ name: "assets" })
@Index("UQ_assets_asset_tag", ["assetTag"], { unique: true })
@Index("UQ_assets_serial_number", ["serialNumber"], {
  unique: true,
  where: '"serial_number" IS NOT NULL',
})
export class Asset {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "asset_tag", type: "varchar", length: 100 })
  assetTag!: string;

  @Column({ type: "varchar", length: 100 })
  category!: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  brand!: string | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  model!: string | null;

  @Column({ name: "serial_number", type: "varchar", length: 150, nullable: true })
  serialNumber!: string | null;

  @Column({
    type: "enum",
    enum: AssetStatus,
    enumName: "asset_status_enum",
    default: AssetStatus.AVAILABLE,
  })
  status!: AssetStatus;

  @Column({ name: "assigned_to", type: "varchar", length: 150, nullable: true })
  assignedTo!: string | null;

  @Column({ name: "purchase_date", type: "date", nullable: true })
  purchaseDate!: string | null;

  @Column({ name: "purchase_cost", type: "numeric", precision: 14, scale: 2, nullable: true })
  purchaseCost!: string | null;

  @Column({ name: "warranty_end", type: "date", nullable: true })
  warrantyEnd!: string | null;

  @Column({ type: "varchar", length: 150, nullable: true })
  location!: string | null;

  @Column({ type: "text", nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
