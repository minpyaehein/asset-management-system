import { PartialType } from "@nestjs/mapped-types";
import { CreateSoftwareRecordDto } from "./create-software-record.dto";
export class UpdateSoftwareRecordDto extends PartialType(CreateSoftwareRecordDto) {}
