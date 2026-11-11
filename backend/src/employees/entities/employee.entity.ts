import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

export enum EmployeeStatus {
  ACTIVE = "Active",
  INACTIVE = "Inactive",
}

@Entity({ name: "employees" })
@Index("UQ_employees_staff_code", ["staffCode"], { unique: true })
@Index("UQ_employees_email", ["email"], { unique: true, where: '"email" IS NOT NULL' })
export class Employee {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "staff_code", type: "varchar", length: 50 })
  staffCode!: string;

  @Column({ name: "full_name", type: "varchar", length: 150 })
  fullName!: string;

  @Column({ type: "varchar", length: 120, nullable: true })
  department!: string | null;

  @Column({ type: "varchar", length: 180, nullable: true })
  email!: string | null;

  @Column({ type: "varchar", length: 50, nullable: true })
  phone!: string | null;

  @Column({ name: "job_title", type: "varchar", length: 120, nullable: true })
  jobTitle!: string | null;

  @Column({ type: "varchar", length: 150, nullable: true })
  location!: string | null;

  @Column({ type: "enum", enum: EmployeeStatus, enumName: "employee_status_enum", default: EmployeeStatus.ACTIVE })
  status!: EmployeeStatus;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
