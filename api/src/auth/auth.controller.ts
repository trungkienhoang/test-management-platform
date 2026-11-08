import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { VerifyOtpDto, ResendOtpDto } from './dto/verify-otp.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { VerifyResetOtpDto } from './dto/verify-reset-otp.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import type { JwtPayload } from './strategies/jwt.strategy.js';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Khởi tạo đăng ký tài khoản (Gửi mã OTP về email)' })
  @ApiResponse({ status: 201, description: 'Đã gửi mã OTP về email' })
  @ApiResponse({ status: 409, description: 'Email đã tồn tại' })
  register(@Body() dto: RegisterDto) {
    return this.authService.initiateRegister(dto);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xác thực mã OTP và hoàn tất đăng ký' })
  @ApiResponse({ status: 200, description: 'Đăng ký thành công, tự động đăng nhập' })
  @ApiResponse({ status: 400, description: 'Mã OTP không đúng hoặc đã hết hạn' })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtpAndRegister(dto);
  }

  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Gửi lại mã OTP qua email' })
  resendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendOtp(dto);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Yêu cầu gửi mã OTP đặt lại mật khẩu' })
  @ApiResponse({ status: 200, description: 'Đã gửi mã OTP về email' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy tài khoản với email này' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('verify-reset-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xác thực mã OTP đặt lại mật khẩu (Bước 2: kiểm tra OTP đúng)' })
  @ApiResponse({ status: 200, description: 'Mã OTP chính xác, trả về resetToken tạm thời' })
  @ApiResponse({ status: 400, description: 'Mã OTP không đúng hoặc đã hết hạn' })
  verifyResetOtp(@Body() dto: VerifyResetOtpDto) {
    return this.authService.verifyResetOtp(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đặt mật khẩu mới (Bước 3: cập nhật mật khẩu với resetToken hoặc OTP)' })
  @ApiResponse({ status: 200, description: 'Đổi mật khẩu thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ hoặc token hết hạn' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng nhập' })
  @ApiResponse({ status: 200, description: 'Đăng nhập thành công, trả về access + refresh token' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Làm mới access token' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đăng xuất (thu hồi refresh token)' })
  logout(@Body() dto: RefreshTokenDto, @CurrentUser() _user: JwtPayload) {
    return this.authService.logout(dto.refreshToken);
  }

  @Post('me')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy thông tin người dùng hiện tại' })
  me(@CurrentUser() user: JwtPayload) {
    return user;
  }
}
