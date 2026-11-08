import { IsEmail, IsNotEmpty, IsString, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyResetOtpDto {
  @ApiProperty({ example: 'user@example.com', description: 'Địa chỉ email của tài khoản' })
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  email: string;

  @ApiProperty({ example: '123456', description: 'Mã xác thực OTP gồm 6 chữ số gửi về email' })
  @IsString({ message: 'Mã OTP phải là chuỗi ký tự' })
  @Length(6, 6, { message: 'Mã OTP phải gồm chính xác 6 chữ số' })
  @Matches(/^[0-9]{6}$/, { message: 'Mã OTP chỉ bao gồm các chữ số' })
  otp: string;
}
