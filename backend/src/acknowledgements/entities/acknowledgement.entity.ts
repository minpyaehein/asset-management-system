import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export enum AcknowledgementStatus {
  PENDING = "Pending",
  ACKNOWLEDGED = "Acknowledged",
  DECLINED = "Declined",
}

@Entity({ name: "acknowledgements" })
@Index("UQ_acknowledgements_reference", ["reference"], { unique: true })
export class Acknowledgement {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 100 })
  reference!: string;

  @Column({ name: "asset_tag", type: "varchar", length: 100, nullable: true })
  assetTag!: string | null;

  @Column({ name: "employee_id", type: "int", nullable: true })
  employeeId!: number | null;

  @Column({ name: "employee_name", type: "varchar", length: 150, nullable: true })
  employeeName!: string | null;

  @Column({ name: "issued_date", type: "date", nullable: true })
  issuedDate!: string | null;

  @Column({
    type: "enum",
    enum: AcknowledgementStatus,
    enumName: "acknowledgement_status_enum",
    default: AcknowledgementStatus.PENDING,
  })
  status!: AcknowledgementStatus;

  @Column({ type: "text", nullable: true })
  notes!: string | null;

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive!: boolean;

  @Column({ name: "created_by_user_id", type: "int", nullable: true })
  createdByUserId!: number | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
