import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Role } from "../../roles/entities/role.entity";

export enum UserStatus { ACTIVE = "Active", INACTIVE = "Inactive" }

@Entity({ name: "users" })
export class User {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: "varchar", length: 80, unique: true }) username!: string;
  @Column({ name: "full_name", type: "varchar", length: 120 }) fullName!: string;
  @Column({ type: "varchar", length: 180, nullable: true, unique: true }) email!: string | null;
  @Column({ name: "password_hash", type: "varchar", length: 255, select: false }) passwordHash!: string;
  @Column({ name: "role_id", type: "int" }) roleId!: number;
  @ManyToOne(() => Role, { eager: true, onDelete: "RESTRICT" })
  @JoinColumn({ name: "role_id" }) role!: Role;
  @Column({ type: "enum", enum: UserStatus, enumName: "user_status_enum", default: UserStatus.ACTIVE }) status!: UserStatus;
  @CreateDateColumn({ name: "created_at", type: "timestamptz" }) createdAt!: Date;
  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" }) updatedAt!: Date;
}
