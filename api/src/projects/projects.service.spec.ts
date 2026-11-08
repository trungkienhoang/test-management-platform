import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProjectsService } from './projects.service.js';
import { ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { ProjectRole, SystemRole } from '@prisma/client';

const mockPrisma = {
  project: {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  projectMember: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  user: { findUnique: vi.fn() },
  $transaction: vi.fn(),
};

const adminUser = { sub: 'admin-1', email: 'admin@test.com', systemRole: SystemRole.ADMIN };
const qaUser = { sub: 'qa-1', email: 'qa@test.com', systemRole: SystemRole.USER };
const mockProject = { id: 'proj-1', name: 'Test', createdById: 'qa-1' };

describe('ProjectsService', () => {
  let service: ProjectsService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new ProjectsService(mockPrisma as any);
  });

  // ─── CREATE ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('tạo project và thêm creator làm QA_LEAD', async () => {
      const created = { id: 'proj-new', name: 'New', createdById: 'qa-1' };
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.project.create.mockResolvedValue(created);
      mockPrisma.projectMember.create.mockResolvedValue({});

      const result = await service.create({ name: 'New' }, qaUser);

      expect(result.id).toBe('proj-new');
      expect(mockPrisma.projectMember.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ role: ProjectRole.QA_LEAD }) }),
      );
    });
  });

  // ─── PERMISSIONS ────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('ném ForbiddenException khi user không phải thành viên', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.projectMember.findUnique.mockResolvedValue(null);

      const outsider = { sub: 'outsider', email: 'x@x.com', systemRole: SystemRole.USER };
      await expect(service.findOne('proj-1', outsider)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('Admin có thể xem mọi project', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);

      const result = await service.findOne('proj-1', adminUser);
      expect(result).toBeDefined();
    });
  });

  // ─── MEMBERS ────────────────────────────────────────────────────────────────

  describe('removeMember', () => {
    it('ném ForbiddenException khi xóa QA_LEAD duy nhất', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.projectMember.findUnique.mockResolvedValue({
        id: 'pm-1',
        projectId: 'proj-1',
        userId: 'qa-1',
        role: ProjectRole.QA_LEAD,
      });
      mockPrisma.projectMember.count.mockResolvedValue(1); // only 1 QA Lead

      await expect(
        service.removeMember('proj-1', 'qa-1', adminUser),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('ném NotFoundException khi thành viên không tồn tại', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.projectMember.findUnique.mockResolvedValue(null);

      await expect(
        service.removeMember('proj-1', 'nonexistent', adminUser),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
