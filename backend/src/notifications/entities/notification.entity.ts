import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: "notifications" })
@Index("IDX_notifications_user_created", ["userId", "createdAt"])
export class Notification {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: "user_id", type: "int" })
  userId!: number;

  @Column({ type: "varchar", length: 60 })
  type!: string;

  @Column({ type: "varchar", length: 180 })
  title!: string;

  @Column({ type: "varchar", length: 500 })
  message!: string;

  @Column({ name: "reference_type", type: "varchar", length: 80, nullable: true })
  referenceType!: string | null;

  @Column({ name: "reference_id", type: "varchar", length: 80, nullable: true })
  referenceId!: string | null;

  @Column({ name: "is_read", type: "boolean", default: false })
  isRead!: boolean;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
