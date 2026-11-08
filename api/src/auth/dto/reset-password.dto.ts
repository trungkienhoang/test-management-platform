import { IsNotEmpty, IsOptional, IsString, Length, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiPropertyOptional({ example: 'user@example.com', description: 'Địa chỉ email của tài khoản' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: '123456', description: 'Mã xác thực OTP gồm 6 chữ số gửi về email' })
  @IsOptional()
  @IsString()
  otp?: string;

  @ApiPropertyOptional({ example: 'eyJhbGciOi...', description: 'Token xác thực OTP hợp lệ sau khi gọi verify-reset-otp' })
  @IsOptional()
  @IsString()
  resetToken?: string;

  @ApiProperty({ example: 'NewSecret123!', description: 'Mật khẩu mới (tối thiểu 8 ký tự, có chữ hoa, thường và số)' })
  @IsString({ message: 'Mật khẩu phải là chuỗi ký tự' })
  @Length(8, 50, { message: 'Mật khẩu mới phải có từ 8 đến 50 ký tự' })
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Mật khẩu mới phải chứa ít nhất 1 chữ hoa, 1 chữ thường và 1 số',
  })
  @IsNotEmpty({ message: 'Mật khẩu mới không được để trống' })
  newPassword: string;
}
