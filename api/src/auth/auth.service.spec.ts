import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthService } from './auth.service.js';
import {
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';

// Mock PrismaService
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  refreshToken: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  emailVerification: {
    deleteMany: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
  },
  passwordReset: {
    findFirst: vi.fn(),
    deleteMany: vi.fn(),
    delete: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
};

const mockJwt = {
  sign: vi.fn(() => 'mock.access.token'),
  verify: vi.fn(),
};
const mockConfig = { getOrThrow: vi.fn(() => 'mock-secret'), get: vi.fn(() => '7') };
const mockMail = {
  sendOtpEmail: vi.fn().mockResolvedValue(true),
  sendPasswordResetOtp: vi.fn().mockResolvedValue(true),
  isConfigured: vi.fn().mockReturnValue(true),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService(mockPrisma as any, mockJwt as any, mockConfig as any, mockMail as any);
  });

  // ─── REGISTER (INITIATE OTP) ───────────────────────────────────────────────

  describe('initiateRegister', () => {
    it('gửi OTP và tạo bản ghi emailVerification thành công', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.emailVerification.deleteMany.mockResolvedValue({});
      mockPrisma.emailVerification.create.mockResolvedValue({});

      const result = await service.initiateRegister({
        email: 'test@gmail.com',
        fullName: 'Test User',
        password: 'Password123!',
      });

      expect(result.email).toBe('test@gmail.com');
      expect(mockMail.sendOtpEmail).toHaveBeenCalledOnce();
      expect(mockPrisma.emailVerification.create).toHaveBeenCalledOnce();
    });

    it('ném ConflictException khi email đã tồn tại', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.initiateRegister({ email: 'dup@gmail.com', fullName: 'X', password: 'Password123!' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  // ─── VERIFY OTP ─────────────────────────────────────────────────────────────

  describe('verifyOtpAndRegister', () => {
    it('xác thực OTP đúng và hoàn tất tạo tài khoản', async () => {
      const plainOtp = '123456';
      const otpHash = crypto.createHash('sha256').update(plainOtp).digest('hex');

      mockPrisma.emailVerification.findFirst.mockResolvedValue({
        id: 'ev-1',
        email: 'test@gmail.com',
        fullName: 'Test User',
        passwordHash: 'hashed_pwd',
        otpHash,
        attempts: 0,
        expiresAt: new Date(Date.now() + 100000),
      });

      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'u-new',
        email: 'test@gmail.com',
        fullName: 'Test User',
        systemRole: 'USER',
      });
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.verifyOtpAndRegister({
        email: 'test@gmail.com',
        otp: '123456',
      });

      expect(result.user.email).toBe('test@gmail.com');
      expect(result.accessToken).toBe('mock.access.token');
      expect(mockPrisma.user.create).toHaveBeenCalledOnce();
    });

    it('ném BadRequestException khi mã OTP sai', async () => {
      const realOtp = '654321';
      const otpHash = crypto.createHash('sha256').update(realOtp).digest('hex');

      mockPrisma.emailVerification.findFirst.mockResolvedValue({
        id: 'ev-1',
        email: 'test@gmail.com',
        otpHash,
        attempts: 0,
        expiresAt: new Date(Date.now() + 100000),
      });

      await expect(
        service.verifyOtpAndRegister({ email: 'test@gmail.com', otp: '000000' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('ném BadRequestException khi mã OTP đã hết hạn', async () => {
      mockPrisma.emailVerification.findFirst.mockResolvedValue({
        id: 'ev-1',
        email: 'test@gmail.com',
        expiresAt: new Date(Date.now() - 1000), // expired
      });

      await expect(
        service.verifyOtpAndRegister({ email: 'test@gmail.com', otp: '123456' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  // ─── LOGIN ──────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('ném UnauthorizedException khi user không tồn tại', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nope@test.com', password: 'pass' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('ném UnauthorizedException khi mật khẩu sai', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: '1',
        email: 'x@x.com',
        passwordHash: '$2b$12$invalid_hash_that_wont_match',
        isActive: true,
        systemRole: 'USER',
      });

      await expect(
        service.login({ email: 'x@x.com', password: 'WrongPass1!' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  // ─── REFRESH ────────────────────────────────────────────────────────────────

  describe('refresh', () => {
    it('ném UnauthorizedException khi token không tồn tại', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refresh('invalid-token')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('ném UnauthorizedException khi token đã bị thu hồi', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: '1',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 1000000),
        userId: 'u1',
      });

      await expect(service.refresh('revoked-token')).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  // ─── FORGOT PASSWORD ────────────────────────────────────────────────────────

  describe('forgotPassword', () => {
    it('gửi OTP đặt lại mật khẩu thành công khi email tồn tại', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'user@gmail.com',
        fullName: 'Nguyen Van A',
        isActive: true,
      });
      mockPrisma.passwordReset.findFirst.mockResolvedValue(null);
      mockPrisma.passwordReset.deleteMany.mockResolvedValue({});
      mockPrisma.passwordReset.create.mockResolvedValue({});

      const result = await service.forgotPassword({ email: 'user@gmail.com' });

      expect(result.email).toBe('user@gmail.com');
      expect(mockMail.sendPasswordResetOtp).toHaveBeenCalledOnce();
      expect(mockPrisma.passwordReset.create).toHaveBeenCalledOnce();
    });

    it('ném NotFoundException khi không tìm thấy email người dùng', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.forgotPassword({ email: 'unknown@gmail.com' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('ném BadRequestException khi tài khoản bị khóa', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'locked@gmail.com',
        isActive: false,
      });

      await expect(
        service.forgotPassword({ email: 'locked@gmail.com' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  // ─── VERIFY RESET OTP ──────────────────────────────────────────────────────

  describe('verifyResetOtp', () => {
    it('xác thực OTP đúng, xóa bản ghi OTP và trả về resetToken', async () => {
      const plainOtp = '123456';
      const otpHash = crypto.createHash('sha256').update(plainOtp).digest('hex');

      mockPrisma.passwordReset.findFirst.mockResolvedValue({
        id: 'pr-1',
        email: 'user@gmail.com',
        otpHash,
        attempts: 0,
        expiresAt: new Date(Date.now() + 100000),
      });

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'user@gmail.com',
      });
      mockPrisma.passwordReset.deleteMany.mockResolvedValue({});

      const result = await service.verifyResetOtp({
        email: 'user@gmail.com',
        otp: '123456',
      });

      expect(result.resetToken).toBeDefined();
      expect(result.email).toBe('user@gmail.com');
      expect(mockPrisma.passwordReset.deleteMany).toHaveBeenCalledOnce();
      expect(mockJwt.sign).toHaveBeenCalled();
    });

    it('ném BadRequestException khi mã OTP sai', async () => {
      const realOtp = '654321';
      const otpHash = crypto.createHash('sha256').update(realOtp).digest('hex');

      mockPrisma.passwordReset.findFirst.mockResolvedValue({
        id: 'pr-1',
        email: 'user@gmail.com',
        otpHash,
        attempts: 0,
        expiresAt: new Date(Date.now() + 100000),
      });

      await expect(
        service.verifyResetOtp({ email: 'user@gmail.com', otp: '000000' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('ném BadRequestException khi mã OTP đã hết hạn', async () => {
      mockPrisma.passwordReset.findFirst.mockResolvedValue({
        id: 'pr-1',
        email: 'user@gmail.com',
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(
        service.verifyResetOtp({ email: 'user@gmail.com', otp: '123456' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  // ─── RESET PASSWORD ─────────────────────────────────────────────────────────

  describe('resetPassword', () => {
    it('cập nhật mật khẩu mới thành công khi truyền resetToken hợp lệ', async () => {
      mockJwt.verify.mockReturnValue({
        sub: 'u1',
        email: 'user@gmail.com',
        purpose: 'PASSWORD_RESET',
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'user@gmail.com',
      });
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.refreshToken.updateMany.mockResolvedValue({});

      const result = await service.resetPassword({
        resetToken: 'valid.reset.token',
        newPassword: 'NewPassword123!',
      });

      expect(result.message).toContain('thành công');
      expect(mockPrisma.user.update).toHaveBeenCalledOnce();
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledOnce();
    });

    it('ném BadRequestException khi resetToken không hợp lệ hoặc hết hạn', async () => {
      mockJwt.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(
        service.resetPassword({
          resetToken: 'expired.token',
          newPassword: 'NewPassword123!',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('xác thực OTP đúng và cập nhật mật khẩu mới thành công (fallback email + otp)', async () => {
      const plainOtp = '654321';
      const otpHash = crypto.createHash('sha256').update(plainOtp).digest('hex');

      mockPrisma.passwordReset.findFirst.mockResolvedValue({
        id: 'pr-1',
        email: 'user@gmail.com',
        otpHash,
        attempts: 0,
        expiresAt: new Date(Date.now() + 100000),
      });

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'user@gmail.com',
      });
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.refreshToken.updateMany.mockResolvedValue({});
      mockPrisma.passwordReset.deleteMany.mockResolvedValue({});

      const result = await service.resetPassword({
        email: 'user@gmail.com',
        otp: '654321',
        newPassword: 'NewPassword123!',
      });

      expect(result.message).toContain('thành công');
      expect(mockPrisma.user.update).toHaveBeenCalledOnce();
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledOnce();
    });

    it('ném BadRequestException khi OTP sai trong fallback', async () => {
      const realOtp = '654321';
      const otpHash = crypto.createHash('sha256').update(realOtp).digest('hex');

      mockPrisma.passwordReset.findFirst.mockResolvedValue({
        id: 'pr-1',
        email: 'user@gmail.com',
        otpHash,
        attempts: 0,
        expiresAt: new Date(Date.now() + 100000),
      });

      await expect(
        service.resetPassword({
          email: 'user@gmail.com',
          otp: '000000',
          newPassword: 'NewPassword123!',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
