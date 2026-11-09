import { PartialType } from '@nestjs/swagger';
import { CreateBugDto } from './create-bug.dto.js';

export class UpdateBugDto extends PartialType(CreateBugDto) {}
