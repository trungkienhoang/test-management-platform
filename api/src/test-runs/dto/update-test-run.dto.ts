import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTestRunDto {
  @ApiPropertyOptional({ description: 'Tên đợt kiểm thử' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Mô tả đợt kiểm thử' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'ID người được giao thực thi' })
  @IsOptional()
  @IsString()
  assignedToId?: string | null;
}
