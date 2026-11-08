import { IsNotEmpty, IsOptional, IsString, MaxLength, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTestSuiteDto {
  @ApiProperty({ example: 'Xác thực & Phân quyền', description: 'Tên test suite' })
  @IsString({ message: 'Tên suite phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Tên suite không được để trống' })
  @MaxLength(100, { message: 'Tên suite không vượt quá 100 ký tự' })
  name: string;

  @ApiPropertyOptional({ example: 'Các ca kiểm thử đăng nhập, đăng ký, quên mật khẩu', description: 'Mô tả test suite' })
  @IsOptional()
  @IsString({ message: 'Mô tả phải là chuỗi ký tự' })
  @MaxLength(500, { message: 'Mô tả không vượt quá 500 ký tự' })
  description?: string;

  @ApiPropertyOptional({ example: 'cuid...', description: 'ID của suite cha nếu là suite con (phân cấp cây)' })
  @IsOptional()
  @IsString({ message: 'Parent ID phải là chuỗi ký tự' })
  parentId?: string;

  @ApiPropertyOptional({ example: 0, description: 'Thứ tự hiển thị' })
  @IsOptional()
  @IsInt({ message: 'Thứ tự phải là số nguyên' })
  @Min(0, { message: 'Thứ tự không âm' })
  order?: number;
}
