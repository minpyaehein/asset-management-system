import { PartialType } from "@nestjs/mapped-types";
import { CreateServiceDeskTicketDto } from "./create-service-desk-ticket.dto";
export class UpdateServiceDeskTicketDto extends PartialType(CreateServiceDeskTicketDto) {}
