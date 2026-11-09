import { IsNotEmpty, IsString, IsOptional, IsArray, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTestRunDto {
  @ApiProperty({ description: 'Tên đợt kiểm thử (Test Run)' })
  @IsNotEmpty({ message: 'Tên đợt kiểm thử không được để trống' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Mô tả chi tiết mục tiêu đợt kiểm thử' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'ID người được giao thực thi (Tester)' })
  @IsOptional()
  @IsString()
  assignedToId?: string;

  @ApiPropertyOptional({ description: 'Danh sách ID các Test Case được chọn', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  testCaseIds?: string[];

  @ApiPropertyOptional({ description: 'Danh sách ID Test Suite để lấy toàn bộ ca test bên trong', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  suiteIds?: string[];

  @ApiPropertyOptional({ description: 'Bao gồm tất cả Test Cases trong dự án', default: false })
  @IsOptional()
  @IsBoolean()
  includeAll?: boolean;
}
