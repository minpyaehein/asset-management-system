import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

export enum TicketCategory { HARDWARE = "Hardware", SOFTWARE = "Software", ACCESS = "Access", NETWORK = "Network", OTHER = "Other" }
export enum TicketPriority { LOW = "Low", MEDIUM = "Medium", HIGH = "High", URGENT = "Urgent" }
export enum TicketStatus { OPEN = "Open", IN_PROGRESS = "In Progress", WAITING = "Waiting", RESOLVED = "Resolved", CLOSED = "Closed" }

@Entity({ name: "service_desk_tickets" })
@Index("UQ_service_desk_ticket_id", ["ticketId"], { unique: true })
export class ServiceDeskTicket {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ name: "ticket_id", type: "varchar", length: 80 }) ticketId!: string;
  @Column({ type: "varchar", length: 150, nullable: true }) requester!: string | null;
  @Column({ type: "enum", enum: TicketCategory, enumName: "service_desk_tickets_category_enum" }) category!: TicketCategory;
  @Column({ type: "enum", enum: TicketPriority, enumName: "service_desk_tickets_priority_enum", default: TicketPriority.MEDIUM }) priority!: TicketPriority;
  @Column({ type: "enum", enum: TicketStatus, enumName: "service_desk_tickets_status_enum", default: TicketStatus.OPEN }) status!: TicketStatus;
  @Column({ name: "created_date", type: "date", nullable: true }) createdDate!: string | null;
  @Column({ type: "varchar", length: 500, nullable: true }) summary!: string | null;
  @Column({ name: "is_active", type: "boolean", default: true }) isActive!: boolean;
  @Column({ name: "created_by_user_id", type: "int", nullable: true }) createdByUserId!: number | null;
  @CreateDateColumn({ name: "created_at", type: "timestamptz" }) createdAt!: Date;
  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" }) updatedAt!: Date;
}
