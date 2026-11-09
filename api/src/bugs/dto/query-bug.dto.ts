import { IsOptional, IsString, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BugSeverity, BugStatus } from '@prisma/client';

export class QueryBugDto {
  @ApiPropertyOptional({ description: 'Tìm kiếm theo mã lỗi hoặc tiêu đề' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: BugStatus })
  @IsOptional()
  @IsEnum(BugStatus)
  status?: BugStatus;

  @ApiPropertyOptional({ enum: BugSeverity })
  @IsOptional()
  @IsEnum(BugSeverity)
  severity?: BugSeverity;

  @ApiPropertyOptional({ description: 'Lọc theo người được giao xử lý' })
  @IsOptional()
  @IsString()
  assigneeId?: string;

  @ApiPropertyOptional({ description: 'Lọc theo Test Case ID' })
  @IsOptional()
  @IsString()
  testCaseId?: string;

  @ApiPropertyOptional({ description: 'Lọc theo Test Execution ID' })
  @IsOptional()
  @IsString()
  testExecutionId?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
