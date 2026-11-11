import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Asset } from "../../assets/entities/asset.entity";
import { Employee } from "../../employees/entities/employee.entity";

@Entity({ name: "asset_allocations" })
@Index("IDX_asset_allocations_asset_returned", ["assetId", "returnedAt"])
export class AssetAllocation {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "asset_id", type: "int" })
  assetId!: number;

  @ManyToOne(() => Asset, { eager: false, onDelete: "RESTRICT" })
  @JoinColumn({ name: "asset_id" })
  asset!: Asset;

  @Column({ name: "employee_id", type: "int" })
  employeeId!: number;

  @ManyToOne(() => Employee, { eager: false, onDelete: "RESTRICT" })
  @JoinColumn({ name: "employee_id" })
  employee!: Employee;

  @Column({ name: "asset_tag", type: "varchar", length: 100 })
  assetTag!: string;

  @Column({ name: "employee_name", type: "varchar", length: 150 })
  employeeName!: string;

  @Column({ name: "employee_staff_code", type: "varchar", length: 50 })
  employeeStaffCode!: string;

  @Column({ name: "issued_at", type: "timestamptz" })
  issuedAt!: Date;

  @Column({ name: "returned_at", type: "timestamptz", nullable: true })
  returnedAt!: Date | null;

  @Column({ name: "checkout_notes", type: "varchar", length: 500, nullable: true })
  checkoutNotes!: string | null;

  @Column({ name: "return_notes", type: "varchar", length: 500, nullable: true })
  returnNotes!: string | null;

  @Column({ name: "created_by_user_id", type: "int", nullable: true })
  createdByUserId!: number | null;

  @Column({ name: "checked_in_by_user_id", type: "int", nullable: true })
  checkedInByUserId!: number | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
