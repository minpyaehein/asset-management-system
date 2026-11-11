import { PartialType } from "@nestjs/mapped-types";
import { CreateAssetTransferDto } from "./create-asset-transfer.dto";
export class UpdateAssetTransferDto extends PartialType(CreateAssetTransferDto) {}
