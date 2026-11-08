import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
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
    await this.mailService.sendOtpEmail(email, rawOtp, dto.fullName.trim());

    return {
      message: `Mã xác thực OTP gồm 6 chữ số đã được gửi tới ${email}. Vui lòng kiểm tra hộp thư của bạn.`,
      email,
      expiresInSeconds: 300,
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

    await this.mailService.sendOtpEmail(email, rawOtp, record.fullName);

    return {
      message: `Đã gửi lại mã OTP mới tới ${email}. Vui lòng kiểm tra hộp thư.`,
      email,
      expiresInSeconds: 300,
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
