import { IsString, IsNotEmpty, IsOptional, IsEnum, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BugSeverity, BugStatus } from '@prisma/client';

export class CreateBugDto {
  @ApiProperty({ example: 'Nút Đăng ký không phản hồi khi bấm', description: 'Tiêu đề ngắn gọn của lỗi' })
  @IsString({ message: 'Tiêu đề phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Tiêu đề không được để trống' })
  @MinLength(3, { message: 'Tiêu đề tối thiểu 3 ký tự' })
  @MaxLength(200, { message: 'Tiêu đề tối đa 200 ký tự' })
  title: string;

  @ApiProperty({
    example: 'Các bước tái hiện:\n1. Vào trang đăng ký\n2. Nhập thông tin\n3. Bấm Đăng ký -> không có phản hồi',
    description: 'Mô tả chi tiết lỗi, các bước tái hiện và kết quả thực tế',
  })
  @IsString({ message: 'Mô tả phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Mô tả không được để trống' })
  description: string;

  @ApiPropertyOptional({ enum: BugSeverity, default: BugSeverity.MEDIUM })
  @IsOptional()
  @IsEnum(BugSeverity, { message: 'Mức độ nghiêm trọng không hợp lệ' })
  severity?: BugSeverity;

  @ApiPropertyOptional({ enum: BugStatus, default: BugStatus.OPEN })
  @IsOptional()
  @IsEnum(BugStatus, { message: 'Trạng thái không hợp lệ' })
  status?: BugStatus;

  @ApiPropertyOptional({ description: 'ID người được giao xử lý (Developer / Tester)' })
  @IsOptional()
  @IsString()
  assigneeId?: string;

  @ApiPropertyOptional({ description: 'ID của lượt chạy kiểm thử (nếu phát hiện khi test)' })
  @IsOptional()
  @IsString()
  testExecutionId?: string;

  @ApiPropertyOptional({ description: 'ID của Test Case liên quan' })
  @IsOptional()
  @IsString()
  testCaseId?: string;
}
