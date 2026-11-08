import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { VerifyOtpDto, ResendOtpDto } from './dto/verify-otp.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { VerifyResetOtpDto } from './dto/verify-reset-otp.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { JwtPayload } from './strategies/jwt.strategy.js';
import { SystemRole } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private mailService: MailService,
  ) {}

  // ─── OTP REGISTRATION FLOW ──────────────────────────────────────────────────

  /**
   * Bước 1: Người dùng nhập thông tin đăng ký -> Hệ thống sinh mã OTP 6 số và gửi về email
   */
  async initiateRegister(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();

    // Kiểm tra email đã có tài khoản chưa
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Email này đã được sử dụng để đăng ký tài khoản');
    }

    // Băm mật khẩu sẵn sàng
    const passwordHash = await bcrypt.hash(dto.password, 12);

    // Sinh mã OTP 6 chữ số ngẫu nhiên an toàn
    const rawOtp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = this.hashOtp(rawOtp);

    // Xóa các mã xác thực cũ của email này nếu có
    await this.prisma.emailVerification.deleteMany({ where: { email } });

    // Lưu yêu cầu xác thực mới (hạn 5 phút)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await this.prisma.emailVerification.create({
      data: {
        email,
        fullName: dto.fullName.trim(),
        passwordHash,
        otpHash,
        expiresAt,
      },
    });

    // Gửi email chứa OTP
    const sent = await this.mailService.sendOtpEmail(email, rawOtp, dto.fullName.trim());
    const isConfigured = this.mailService.isConfigured();

    return {
      message: isConfigured && sent
        ? `Mã xác thực OTP gồm 6 chữ số đã được gửi tới hộp thư Gmail ${email}. Vui lòng kiểm tra hộp thư của bạn.`
        : `[DEV - Chưa cấu hình Gmail trong .env] Mã OTP của bạn là: ${rawOtp}. Hãy nhập mã này để hoàn tất đăng ký!`,
      email,
      expiresInSeconds: 300,
      devOtp: isConfigured ? undefined : rawOtp,
    };
  }

  /**
   * Bước 2: Người dùng nhập mã OTP 6 số -> Xác thực và kích hoạt tài khoản
   */
  async verifyOtpAndRegister(dto: VerifyOtpDto) {
    const email = dto.email.trim().toLowerCase();
    const otp = dto.otp.trim();

    const record = await this.prisma.emailVerification.findFirst({
      where: { email },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      throw new BadRequestException('Không tìm thấy yêu cầu đăng ký cho email này hoặc mã đã hết hạn. Vui lòng đăng ký lại.');
    }

    // Kiểm tra thời hạn
    if (record.expiresAt < new Date()) {
      await this.prisma.emailVerification.delete({ where: { id: record.id } });
      throw new BadRequestException('Mã OTP đã hết hạn (sau 5 phút). Vui lòng yêu cầu gửi lại mã mới.');
    }

    // Kiểm tra số lần thử sai
    if (record.attempts >= 5) {
      await this.prisma.emailVerification.delete({ where: { id: record.id } });
      throw new BadRequestException('Bạn đã nhập sai mã OTP quá 5 lần. Vui lòng yêu cầu gửi lại mã mới.');
    }

    // So khớp mã OTP
    const inputOtpHash = this.hashOtp(otp);
    if (inputOtpHash !== record.otpHash) {
      await this.prisma.emailVerification.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      const remainingAttempts = 5 - (record.attempts + 1);
      throw new BadRequestException(`Mã xác thực OTP không chính xác. Bạn còn ${remainingAttempts} lần thử.`);
    }

    // Kiểm tra lại tính duy nhất của email (phòng ngừa race condition)
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Email này đã được sử dụng.');
    }

    // Tạo User thật trong Database
    const user = await this.prisma.user.create({
      data: {
        email: record.email,
        fullName: record.fullName,
        passwordHash: record.passwordHash,
        systemRole: SystemRole.USER,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        systemRole: true,
        createdAt: true,
      },
    });

    // Xóa bản ghi OTP đã hoàn tất
    await this.prisma.emailVerification.deleteMany({ where: { email } });

    // Tự động đăng nhập và phát hành token
    const tokens = await this.generateTokens(user.id, user.email, user.systemRole);

    return {
      message: 'Đăng ký tài khoản thành công!',
      user,
      ...tokens,
    };
  }

  /**
   * Gửi lại mã OTP
   */
  async resendOtp(dto: ResendOtpDto) {
    const email = dto.email.trim().toLowerCase();

    const record = await this.prisma.emailVerification.findFirst({
      where: { email },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      throw new BadRequestException('Không tìm thấy yêu cầu đăng ký chưa hoàn tất cho email này. Vui lòng đăng ký lại.');
    }

    // Rate limit: Tối thiểu 60 giây giữa các lần gửi lại
    const secondsSinceLastRequest = (Date.now() - record.createdAt.getTime()) / 1000;
    if (secondsSinceLastRequest < 60) {
      const waitSeconds = Math.ceil(60 - secondsSinceLastRequest);
      throw new BadRequestException(`Vui lòng chờ thêm ${waitSeconds} giây trước khi gửi lại mã OTP.`);
    }

    // Sinh mã OTP mới
    const rawOtp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = this.hashOtp(rawOtp);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await this.prisma.emailVerification.update({
      where: { id: record.id },
      data: {
        otpHash,
        attempts: 0,
        expiresAt,
        createdAt: new Date(),
      },
    });

    const sent = await this.mailService.sendOtpEmail(email, rawOtp, record.fullName);
    const isConfigured = this.mailService.isConfigured();

    return {
      message: isConfigured && sent
        ? `Đã gửi lại mã OTP mới tới hộp thư Gmail ${email}. Vui lòng kiểm tra hộp thư.`
        : `[DEV - Chưa cấu hình Gmail trong .env] Mã OTP mới của bạn là: ${rawOtp}`,
      email,
      expiresInSeconds: 300,
      devOtp: isConfigured ? undefined : rawOtp,
    };
  }

  // ─── FORGOT & RESET PASSWORD (OTP) ──────────────────────────────────────────

  /**
   * Yêu cầu gửi mã OTP để đặt lại mật khẩu
   */
  async forgotPassword(dto: ForgotPasswordDto) {
    const email = dto.email.trim().toLowerCase();

    // 1. Kiểm tra tài khoản người dùng có tồn tại không
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản với email này trong hệ thống.');
    }

    if (!user.isActive) {
      throw new BadRequestException('Tài khoản này hiện đang bị khóa. Vui lòng liên hệ Quản trị viên để được hỗ trợ.');
    }

    // 2. Rate limit: tối thiểu 60 giây giữa các lần yêu cầu
    const recentReset = await this.prisma.passwordReset.findFirst({
      where: { email },
      orderBy: { createdAt: 'desc' },
    });

    if (recentReset) {
      const secondsSinceLast = (Date.now() - recentReset.createdAt.getTime()) / 1000;
      if (secondsSinceLast < 60) {
        const waitSeconds = Math.ceil(60 - secondsSinceLast);
        throw new BadRequestException(`Vui lòng chờ thêm ${waitSeconds} giây trước khi yêu cầu lại mã OTP mới.`);
      }
    }

    // 3. Sinh mã OTP 6 chữ số
    const rawOtp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = this.hashOtp(rawOtp);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 phút

    // 4. Xóa các mã reset cũ của email này
    await this.prisma.passwordReset.deleteMany({ where: { email } });

    // 5. Lưu mã reset mới vào bảng password_resets
    await this.prisma.passwordReset.create({
      data: {
        email,
        otpHash,
        expiresAt,
      },
    });

    // 6. Gửi email OTP
    const sent = await this.mailService.sendPasswordResetOtp(email, rawOtp, user.fullName);
    const isConfigured = this.mailService.isConfigured();

    return {
      message: isConfigured && sent
        ? `Mã OTP đặt lại mật khẩu gồm 6 chữ số đã được gửi tới email ${email}. Vui lòng kiểm tra hộp thư của bạn.`
        : `[DEV - Chưa cấu hình Gmail] Mã OTP đặt lại mật khẩu của bạn là: ${rawOtp}`,
      email,
      expiresInSeconds: 300,
      devOtp: isConfigured ? undefined : rawOtp,
    };
  }

  /**
   * Bước 2 luồng Quên mật khẩu: Xác thực mã OTP 6 số.
   * Nếu hợp lệ -> sinh resetToken tạm thời có hạn 10 phút để người dùng chuyển sang bước tạo mật khẩu mới.
   */
  async verifyResetOtp(dto: VerifyResetOtpDto) {
    const email = dto.email.trim().toLowerCase();
    const otp = dto.otp.trim();

    // 1. Tìm bản ghi OTP đặt lại mật khẩu
    const record = await this.prisma.passwordReset.findFirst({
      where: { email },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      throw new BadRequestException(
        'Không tìm thấy yêu cầu đặt lại mật khẩu cho email này hoặc mã đã hết hạn. Vui lòng yêu cầu lại mã OTP.',
      );
    }

    // 2. Kiểm tra thời hạn hiệu lực (5 phút)
    if (record.expiresAt < new Date()) {
      await this.prisma.passwordReset.delete({ where: { id: record.id } });
      throw new BadRequestException('Mã OTP đã hết hạn (sau 5 phút). Vui lòng yêu cầu lại mã mới.');
    }

    // 3. Kiểm tra số lần thử sai (tối đa 5 lần)
    if (record.attempts >= 5) {
      await this.prisma.passwordReset.delete({ where: { id: record.id } });
      throw new BadRequestException('Bạn đã nhập sai mã OTP quá 5 lần. Vui lòng yêu cầu lại mã mới.');
    }

    // 4. So khớp mã OTP
    const inputHash = this.hashOtp(otp);
    if (inputHash !== record.otpHash) {
      await this.prisma.passwordReset.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      const remaining = 5 - (record.attempts + 1);
      throw new BadRequestException(`Mã xác thực OTP không chính xác. Bạn còn ${remaining} lần thử.`);
    }

    // 5. Tìm user tương ứng
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new NotFoundException('Tài khoản người dùng không tồn tại.');
    }

    // 6. Xóa bản ghi OTP để không bị dùng lại
    await this.prisma.passwordReset.deleteMany({ where: { email } });

    // 7. Tạo resetToken có thời hạn 10 phút
    const resetToken = this.jwt.sign(
      { sub: user.id, email: user.email, purpose: 'PASSWORD_RESET' },
      {
        secret: this.config.getOrThrow('JWT_SECRET'),
        expiresIn: '10m',
      },
    );

    return {
      message: 'Xác thực mã OTP thành công! Vui lòng thiết lập mật khẩu mới.',
      resetToken,
      email: user.email,
    };
  }

  /**
   * Bước 3 luồng Quên mật khẩu: Đặt mật khẩu mới bằng resetToken đã xác thực (hoặc OTP trực tiếp)
   */
  async resetPassword(dto: ResetPasswordDto) {
    let targetUserId: string;
    let targetEmail: string | undefined;

    if (dto.resetToken) {
      // Xác thực resetToken được cấp từ bước verifyResetOtp
      let payload: any;
      try {
        payload = this.jwt.verify(dto.resetToken, {
          secret: this.config.getOrThrow('JWT_SECRET'),
        });
      } catch {
        throw new BadRequestException(
          'Phiên đặt lại mật khẩu đã hết hạn hoặc không hợp lệ. Vui lòng thao tác lại từ đầu.',
        );
      }

      if (payload.purpose !== 'PASSWORD_RESET' || !payload.sub) {
        throw new BadRequestException('Token xác thực không hợp lệ.');
      }

      targetUserId = payload.sub;
      targetEmail = payload.email;
    } else if (dto.email && dto.otp) {
      // Fallback: nếu gọi thẳng với email và otp
      const email = dto.email.trim().toLowerCase();
      const otp = dto.otp.trim();

      const record = await this.prisma.passwordReset.findFirst({
        where: { email },
        orderBy: { createdAt: 'desc' },
      });

      if (!record) {
        throw new BadRequestException(
          'Không tìm thấy yêu cầu đặt lại mật khẩu cho email này hoặc mã đã hết hạn. Vui lòng thử lại.',
        );
      }

      if (record.expiresAt < new Date()) {
        await this.prisma.passwordReset.delete({ where: { id: record.id } });
        throw new BadRequestException('Mã OTP đã hết hạn (sau 5 phút). Vui lòng yêu cầu lại mã mới.');
      }

      if (record.attempts >= 5) {
        await this.prisma.passwordReset.delete({ where: { id: record.id } });
        throw new BadRequestException('Bạn đã nhập sai mã OTP quá 5 lần. Vui lòng yêu cầu lại mã mới.');
      }

      const inputHash = this.hashOtp(otp);
      if (inputHash !== record.otpHash) {
        await this.prisma.passwordReset.update({
          where: { id: record.id },
          data: { attempts: { increment: 1 } },
        });
        const remaining = 5 - (record.attempts + 1);
        throw new BadRequestException(`Mã xác thực OTP không chính xác. Bạn còn ${remaining} lần thử.`);
      }

      const user = await this.prisma.user.findUnique({ where: { email } });
      if (!user) {
        throw new NotFoundException('Tài khoản người dùng không tồn tại.');
      }

      targetUserId = user.id;
      targetEmail = user.email;
      await this.prisma.passwordReset.deleteMany({ where: { email } });
    } else {
      throw new BadRequestException('Thiếu thông tin xác thực (resetToken hoặc mã OTP).');
    }

    // Băm mật khẩu mới và lưu vào cơ sở dữ liệu
    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id: targetUserId },
      data: { passwordHash },
    });

    // Thu hồi tất cả refresh token cũ vì lý do an toàn
    await this.prisma.refreshToken.updateMany({
      where: { userId: targetUserId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return {
      message: 'Đặt lại mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới.',
      email: targetEmail,
    };
  }

  // ─── LEGACY REGISTER FALLBACK ───────────────────────────────────────────────

  async register(dto: RegisterDto) {
    return this.initiateRegister(dto);
  }

  // ─── LOGIN ──────────────────────────────────────────────────────────────────

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) throw new UnauthorizedException('Email hoặc mật khẩu không đúng');

    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatch) throw new UnauthorizedException('Email hoặc mật khẩu không đúng');

    const tokens = await this.generateTokens(user.id, user.email, user.systemRole);
    return { user: { id: user.id, email: user.email, fullName: user.fullName, systemRole: user.systemRole }, ...tokens };
  }

  // ─── REFRESH TOKEN ───────────────────────────────────────────────────────────

  async refresh(rawToken: string) {
    const tokenHash = this.hashToken(rawToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token không hợp lệ hoặc đã hết hạn');
    }

    // Rotate: revoke old, issue new
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: stored.userId } });
    return this.generateTokens(user.id, user.email, user.systemRole);
  }

  // ─── LOGOUT ─────────────────────────────────────────────────────────────────

  async logout(rawToken: string) {
    const tokenHash = this.hashToken(rawToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // ─── HELPERS ────────────────────────────────────────────────────────────────

  private async generateTokens(userId: string, email: string, systemRole: string) {
    const payload: JwtPayload = { sub: userId, email, systemRole: systemRole as any };

    const accessToken = this.jwt.sign(payload, {
      secret: this.config.getOrThrow('JWT_SECRET'),
      expiresIn: this.config.get('JWT_ACCESS_EXPIRES_IN', '15m'),
    });

    const rawRefresh = crypto.randomBytes(48).toString('hex');
    const tokenHash = this.hashToken(rawRefresh);

    const days = parseInt(this.config.get('JWT_REFRESH_EXPIRES_DAYS', '7'), 10);
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: { tokenHash, userId, expiresAt },
    });

    return { accessToken, refreshToken: rawRefresh };
  }

  private hashToken(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  private hashOtp(otp: string): string {
    return crypto.createHash('sha256').update(otp).digest('hex');
  }
}
