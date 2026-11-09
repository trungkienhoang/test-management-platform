import { IsEnum, IsOptional, IsString, IsArray, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TestExecutionStatus } from '@prisma/client';

export class UpdateExecutionDto {
  @ApiProperty({ enum: TestExecutionStatus, description: 'Kết quả thực thi (PASSED, FAILED, BLOCKED, SKIPPED)' })
  @IsEnum(TestExecutionStatus)
  status: TestExecutionStatus;

  @ApiPropertyOptional({ description: 'Ghi chú kết quả thực tế' })
  @IsOptional()
  @IsString()
  actualResult?: string;

  @ApiPropertyOptional({ description: 'Kết quả chi tiết từng bước' })
  @IsOptional()
  stepResults?: any;

  @ApiPropertyOptional({ description: 'URLs ảnh đính kèm minh chứng lỗi', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];

  @ApiPropertyOptional({ description: 'Thời gian thực thi (milliseconds)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  executionDurationMs?: number;
}
