import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UsersService } from './users.service.js';
import { ConflictException, ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { SystemRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  $transaction: vi.fn(),
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new UsersService(mockPrisma as any);
  });

  describe('findById', () => {
    it('trả về user khi tìm thấy', async () => {
      const mockUser = { id: 'u1', email: 'test@test.com', fullName: 'Test' };
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const res = await service.findById('u1');
      expect(res.id).toBe('u1');
    });

    it('ném NotFoundException khi không tìm thấy', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.findById('u999')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('create (Admin)', () => {
    it('tạo user mới thành công', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'u-new',
        email: 'new@test.com',
        fullName: 'New User',
        systemRole: SystemRole.USER,
      });

      const res = await service.create({
        email: 'new@test.com',
        fullName: 'New User',
        password: 'Password123!',
      });

      expect(res.id).toBe('u-new');
      expect(mockPrisma.user.create).toHaveBeenCalledOnce();
    });

    it('ném ConflictException nếu email đã tồn tại', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.create({ email: 'dup@test.com', fullName: 'X', password: 'Password123!' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('delete (Admin)', () => {
    it('ném ForbiddenException nếu tự xóa tài khoản của mình', async () => {
      await expect(service.delete('admin-1', 'admin-1')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('xóa user thành công khi ID khác admin ID', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u2' });
      mockPrisma.user.delete.mockResolvedValue({ id: 'u2' });

      await service.delete('u2', 'admin-1');
      expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: 'u2' } });
    });
  });

  describe('changePassword', () => {
    it('đổi mật khẩu thành công khi mật khẩu hiện tại đúng', async () => {
      const currentHash = await bcrypt.hash('OldPass123!', 10);
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordHash: currentHash });
      mockPrisma.user.update.mockResolvedValue({});

      const res = await service.changePassword('u1', {
        currentPassword: 'OldPass123!',
        newPassword: 'NewPass123!',
      });

      expect(res.message).toContain('thành công');
      expect(mockPrisma.user.update).toHaveBeenCalledOnce();
    });

    it('ném BadRequestException khi mật khẩu hiện tại sai', async () => {
      const currentHash = await bcrypt.hash('CorrectPass123!', 10);
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordHash: currentHash });

      await expect(
        service.changePassword('u1', {
          currentPassword: 'WrongPassword!',
          newPassword: 'NewPass123!',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('ném BadRequestException khi mật khẩu mới trùng mật khẩu cũ', async () => {
      const currentHash = await bcrypt.hash('OldPass123!', 10);
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordHash: currentHash });

      await expect(
        service.changePassword('u1', {
          currentPassword: 'OldPass123!',
          newPassword: 'OldPass123!',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('searchCandidates', () => {
    it('trả về danh sách ứng viên phù hợp', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'u1', email: 'a@test.com', fullName: 'Alice' },
      ]);

      const res = await service.searchCandidates('Ali', 'proj-1');
      expect(res).toHaveLength(1);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            projectMembers: { none: { projectId: 'proj-1' } },
          }),
        }),
      );
    });
  });
});
