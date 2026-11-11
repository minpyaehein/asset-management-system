import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { RolePermission } from "./role-permission.entity";

@Entity({ name: "roles" })
export class Role {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 100, unique: true })
  name!: string;

  @Column({ type: "varchar", length: 500, nullable: true })
  description!: string | null;

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive!: boolean;

  @OneToMany(() => RolePermission, (permission) => permission.role, {
    cascade: false,
    eager: false,
  })
  permissions!: RolePermission[];

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
