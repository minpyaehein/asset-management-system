import { PartialType } from "@nestjs/mapped-types";
import { CreateAcknowledgementDto } from "./create-acknowledgement.dto";

export class UpdateAcknowledgementDto extends PartialType(
  CreateAcknowledgementDto,
) {}
