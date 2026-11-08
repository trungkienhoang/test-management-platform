import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CreateTestCaseDto } from './create-test-case.dto.js';

export class UpdateTestCaseDto extends PartialType(CreateTestCaseDto) {
  @ApiPropertyOptional({
    example: 'Cập nhật thêm bước kiểm tra validation mã OTP',
    description: 'Lý do thay đổi phiên bản (lưu vào lịch sử test case)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Lý do thay đổi không quá 255 ký tự' })
  changeReason?: string;
}
