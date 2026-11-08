import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  IsEnum,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TestCasePriority, TestCaseStatus } from '@prisma/client';

export class TestCaseStepDto {
  @ApiProperty({ example: 1, description: 'Số thứ tự của bước thực hiện' })
  @IsInt()
  @Min(1)
  stepNumber: number;

  @ApiProperty({ example: 'Nhập email và mật khẩu rồi bấm Đăng nhập', description: 'Hành động thực hiện' })
  @IsString()
  @IsNotEmpty({ message: 'Hành động không được để trống' })
  action: string;

  @ApiProperty({ example: 'Chuyển hướng vào trang Dashboard và hiển thị thông báo thành công', description: 'Kết quả mong đợi' })
  @IsString()
  @IsNotEmpty({ message: 'Kết quả mong đợi không được để trống' })
  expectedResult: string;
}

export class CreateTestCaseDto {
  @ApiProperty({ example: 'Đăng nhập thành công với thông tin hợp lệ' })
  @IsString()
  @IsNotEmpty({ message: 'Tiêu đề Test Case không được để trống' })
  @MaxLength(255, { message: 'Tiêu đề không quá 255 ký tự' })
  title: string;

  @ApiPropertyOptional({ example: 'Kiểm tra luồng đăng nhập cơ bản của người dùng' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'Người dùng đã có tài khoản và ở trạng thái Active' })
  @IsOptional()
  @IsString()
  preconditions?: string;

  @ApiPropertyOptional({ type: [TestCaseStepDto], description: 'Danh sách các bước kiểm thử chi tiết' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TestCaseStepDto)
  steps?: TestCaseStepDto[];

  @ApiPropertyOptional({ enum: TestCasePriority, default: TestCasePriority.MEDIUM })
  @IsOptional()
  @IsEnum(TestCasePriority, { message: 'Độ ưu tiên không hợp lệ (LOW, MEDIUM, HIGH, CRITICAL)' })
  priority?: TestCasePriority;

  @ApiPropertyOptional({ enum: TestCaseStatus, default: TestCaseStatus.DRAFT })
  @IsOptional()
  @IsEnum(TestCaseStatus, { message: 'Trạng thái không hợp lệ (DRAFT, READY, DEPRECATED)' })
  status?: TestCaseStatus;

  @ApiPropertyOptional({ example: ['auth', 'smoke', 'p1'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ example: 'cuid...', description: 'ID của Test Suite chứa test case này' })
  @IsOptional()
  @IsString()
  suiteId?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
