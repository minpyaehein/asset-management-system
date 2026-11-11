import { Transform } from "class-transformer";
import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from "class-validator";
import { TicketCategory, TicketPriority, TicketStatus } from "../entities/service-desk-ticket.entity";
const emptyToNull = ({ value }: { value: unknown }) => typeof value === "string" && value.trim() === "" ? null : value;
export class CreateServiceDeskTicketDto {
  @IsString() @IsNotEmpty() @MaxLength(80) @Matches(/^[A-Za-z0-9._-]+$/) ticketId!: string;
  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(150) requester?: string | null;
  @IsEnum(TicketCategory) category!: TicketCategory;
  @IsEnum(TicketPriority) priority!: TicketPriority;
  @IsEnum(TicketStatus) status!: TicketStatus;
  @IsOptional() @Transform(emptyToNull) @IsDateString() createdDate?: string | null;
  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(500) summary?: string | null;
}
