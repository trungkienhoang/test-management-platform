import { IsOptional, IsString, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TestRunStatus } from '@prisma/client';

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

  @ApiPropertyOptional({ enum: TestRunStatus, description: 'Trạng thái đợt kiểm thử' })
  @IsOptional()
  @IsEnum(TestRunStatus)
  status?: TestRunStatus;
}
