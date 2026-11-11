import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

export enum SoftwareRecordType {
  LICENSE = "licenses",
  INSTALLATION = "installations",
  WARRANTY = "warranties",
}

@Entity({ name: "software_management_records" })
@Index("IDX_software_management_records_type", ["recordType"])
export class SoftwareManagementRecord {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "record_type", type: "varchar", length: 30 })
  recordType!: SoftwareRecordType;

  @Column({ type: "varchar", length: 150, nullable: true })
  product!: string | null;

  @Column({ type: "varchar", length: 150, nullable: true })
  vendor!: string | null;

  @Column({ name: "license_key", type: "varchar", length: 255, nullable: true })
  licenseKey!: string | null;

  @Column({ type: "int", nullable: true })
  seats!: number | null;

  @Column({ type: "date", nullable: true })
  expiry!: string | null;

  @Column({ name: "asset_tag", type: "varchar", length: 100, nullable: true })
  assetTag!: string | null;

  @Column({ type: "varchar", length: 180, nullable: true })
  license!: string | null;

  @Column({ name: "installed_date", type: "date", nullable: true })
  installedDate!: string | null;

  @Column({ name: "installed_by", type: "varchar", length: 150, nullable: true })
  installedBy!: string | null;

  @Column({ type: "varchar", length: 180, nullable: true })
  reference!: string | null;

  @Column({ type: "varchar", length: 150, nullable: true })
  owner!: string | null;

  @Column({ type: "varchar", length: 40, nullable: true })
  status!: string | null;

  @Column({ type: "text", nullable: true })
  notes!: string | null;

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
