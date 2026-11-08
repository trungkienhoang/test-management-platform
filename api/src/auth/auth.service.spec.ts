import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthService } from './auth.service.js';
import { ConflictException, UnauthorizedException } from '@nestjs/common';

// Mock PrismaService
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  refreshToken: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
};

const mockJwt = { sign: vi.fn(() => 'mock.access.token') };
const mockConfig = { getOrThrow: vi.fn(() => 'mock-secret'), get: vi.fn(() => '7') };

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService(mockPrisma as any, mockJwt as any, mockConfig as any);
  });

  // ─── REGISTER ───────────────────────────────────────────────────────────────

  describe('register', () => {
    it('tạo user mới thành công', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        fullName: 'Test User',
        systemRole: 'USER',
        createdAt: new Date(),
      });

      const result = await service.register({
        email: 'test@test.com',
        fullName: 'Test User',
        password: 'Password123!',
      });

      expect(result.email).toBe('test@test.com');
      expect(mockPrisma.user.create).toHaveBeenCalledOnce();
    });

    it('ném ConflictException khi email đã tồn tại', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.register({ email: 'dup@test.com', fullName: 'X', password: 'Password123!' }),
      ).rejects.toBeInstanceOf(ConflictException);
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
});
