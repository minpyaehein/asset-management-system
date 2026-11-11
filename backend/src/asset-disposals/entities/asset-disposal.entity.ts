import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export enum AssetDisposalStatus {
  REQUESTED = "Requested",
  APPROVED = "Approved",
  DISPOSED = "Disposed",
  REJECTED = "Rejected",
}

@Entity({ name: "asset_disposals" })
@Index("UQ_asset_disposals_disposal_id", ["disposalId"], { unique: true })
export class AssetDisposal {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "disposal_id", type: "varchar", length: 80 })
  disposalId!: string;

  @Column({ name: "asset_tag", type: "varchar", length: 100, nullable: true })
  assetTag!: string | null;

  @Column({ type: "varchar", length: 1000, nullable: true })
  reason!: string | null;

  @Column({ name: "requested_by", type: "varchar", length: 150, nullable: true })
  requestedBy!: string | null;

  @Column({ type: "date", nullable: true })
  date!: string | null;

  @Column({
    type: "enum",
    enum: AssetDisposalStatus,
    enumName: "asset_disposal_status_enum",
    default: AssetDisposalStatus.REQUESTED,
  })
  status!: AssetDisposalStatus;

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive!: boolean;

  @Column({ name: "created_by_user_id", type: "int", nullable: true })
  createdByUserId!: number | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
