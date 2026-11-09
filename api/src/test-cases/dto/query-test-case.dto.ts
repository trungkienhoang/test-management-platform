import { IsOptional, IsString, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TestCasePriority, TestCaseStatus } from '@prisma/client';

export class QueryTestCaseDto {
  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm theo tiêu đề, mô tả hoặc mã (TC-1...)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Lọc theo Test Suite ID (chọn "none" để lấy các test case chưa phân suite)' })
  @IsOptional()
  @IsString()
  suiteId?: string;

  @ApiPropertyOptional({ enum: TestCasePriority, description: 'Lọc theo độ ưu tiên' })
  @IsOptional()
  @IsEnum(TestCasePriority)
  priority?: TestCasePriority;

  @ApiPropertyOptional({ enum: TestCaseStatus, description: 'Lọc theo trạng thái' })
  @IsOptional()
  @IsEnum(TestCaseStatus)
  status?: TestCaseStatus;

  @ApiPropertyOptional({ description: 'Lọc theo tag' })
  @IsOptional()
  @IsString()
  tag?: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number = 20;

  @ApiPropertyOptional({ example: 'createdAt', enum: ['code', 'title', 'priority', 'status', 'createdAt', 'updatedAt'] })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ example: 'desc', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';
}
