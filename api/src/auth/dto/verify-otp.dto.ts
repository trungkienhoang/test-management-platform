import { IsEmail, IsString, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyOtpDto {
  @ApiProperty({ example: 'user@gmail.com' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6, { message: 'Mã OTP phải gồm đúng 6 chữ số' })
  @Matches(/^\d{6}$/, { message: 'Mã OTP chỉ bao gồm các chữ số' })
  otp: string;
}

export class ResendOtpDto {
  @ApiProperty({ example: 'user@gmail.com' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;
}
