import { PartialType } from "@nestjs/mapped-types";
import { CreateAssetDisposalDto } from "./create-asset-disposal.dto";

export class UpdateAssetDisposalDto extends PartialType(
  CreateAssetDisposalDto,
) {}
