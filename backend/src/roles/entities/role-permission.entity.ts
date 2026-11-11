import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from "typeorm";
import { Role } from "./role.entity";

export enum AccessLevel {
  OWN_ONLY = "Own Only",
  ASSIGNED = "Assigned",
  ALL = "All",
}

@Entity({ name: "role_permissions" })
@Unique("UQ_role_permission_module", ["roleId", "module"])
export class RolePermission {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "role_id", type: "int" })
  roleId!: number;

  @ManyToOne(() => Role, (role) => role.permissions, { onDelete: "CASCADE" })
  @JoinColumn({ name: "role_id" })
  role!: Role;

  @Column({ type: "varchar", length: 100 })
  module!: string;

  @Column({ type: "enum", enum: AccessLevel, default: AccessLevel.OWN_ONLY })
  access!: AccessLevel;

  @Column({ name: "can_view", type: "boolean", default: false })
  canView!: boolean;

  @Column({ name: "can_add", type: "boolean", default: false })
  canAdd!: boolean;

  @Column({ name: "can_edit", type: "boolean", default: false })
  canEdit!: boolean;

  @Column({ name: "can_deactivate", type: "boolean", default: false })
  canDeactivate!: boolean;

  @Column({ name: "can_export", type: "boolean", default: false })
  canExport!: boolean;
}
