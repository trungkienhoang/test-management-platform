import { IsEmail, IsNotEmpty, IsString, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ example: 'user@example.com', description: 'Địa chỉ email của tài khoản' })
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  email: string;

  @ApiProperty({ example: '123456', description: 'Mã xác thực OTP gồm 6 chữ số gửi về email' })
  @IsString({ message: 'Mã OTP phải là chuỗi ký tự' })
  @Length(6, 6, { message: 'Mã OTP phải gồm chính xác 6 chữ số' })
  @Matches(/^[0-9]{6}$/, { message: 'Mã OTP chỉ bao gồm các chữ số' })
  otp: string;

  @ApiProperty({ example: 'NewSecret123!', description: 'Mật khẩu mới (tối thiểu 8 ký tự, có chữ hoa, thường và số)' })
  @IsString({ message: 'Mật khẩu phải là chuỗi ký tự' })
  @Length(8, 50, { message: 'Mật khẩu mới phải có từ 8 đến 50 ký tự' })
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Mật khẩu mới phải chứa ít nhất 1 chữ hoa, 1 chữ thường và 1 số',
  })
  newPassword: string;
}
