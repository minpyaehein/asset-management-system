import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

export enum TransferStatus {
  PENDING = "Pending",
  APPROVED = "Approved",
  COMPLETED = "Completed",
  REJECTED = "Rejected",
}

@Entity({ name: "asset_transfers" })
@Index("UQ_asset_transfers_transfer_id", ["transferId"], { unique: true })
export class AssetTransferRecord {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "transfer_id", type: "varchar", length: 80 })
  transferId!: string;

  @Column({ name: "asset_tag", type: "varchar", length: 100, nullable: true })
  assetTag!: string | null;

  @Column({ name: "from_location", type: "varchar", length: 150, nullable: true })
  fromLocation!: string | null;

  @Column({ name: "to_location", type: "varchar", length: 150, nullable: true })
  toLocation!: string | null;

  @Column({ name: "requested_by", type: "varchar", length: 150, nullable: true })
  requestedBy!: string | null;

  @Column({ type: "date", nullable: true })
  date!: string | null;

  @Column({ type: "enum", enum: TransferStatus, enumName: "asset_transfers_status_enum", default: TransferStatus.PENDING })
  status!: TransferStatus;

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive!: boolean;

  @Column({ name: "created_by_user_id", type: "int", nullable: true })
  createdByUserId!: number | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
