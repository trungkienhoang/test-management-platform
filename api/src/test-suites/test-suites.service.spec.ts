import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestSuitesService } from './test-suites.service.js';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { ProjectRole, SystemRole } from '@prisma/client';

const mockPrisma = {
  projectMember: {
    findUnique: vi.fn(),
  },
  testSuite: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
};

describe('TestSuitesService', () => {
  let service: TestSuitesService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new TestSuitesService(mockPrisma as any);
  });

  const mockAdminUser: any = { sub: 'u-admin', email: 'admin@test.dev', systemRole: SystemRole.ADMIN };
  const mockLeadUser: any = { sub: 'u-lead', email: 'lead@test.dev', systemRole: SystemRole.USER };
  const mockViewerUser: any = { sub: 'u-viewer', email: 'viewer@test.dev', systemRole: SystemRole.USER };

  describe('create', () => {
    it('QA Lead tạo Test Suite thành công', async () => {
      mockPrisma.projectMember.findUnique.mockResolvedValue({ role: ProjectRole.QA_LEAD });
      mockPrisma.testSuite.create.mockResolvedValue({
        id: 'ts-1',
        projectId: 'p-1',
        name: 'Auth Module',
        order: 0,
        _count: { testCases: 0 },
      });

      const result = await service.create(
        'p-1',
        { name: 'Auth Module', description: 'Test auth' },
        mockLeadUser,
      );

      expect(result.id).toBe('ts-1');
      expect(mockPrisma.testSuite.create).toHaveBeenCalledOnce();
    });

    it('Người dùng ngoài dự án ném ForbiddenException', async () => {
      mockPrisma.projectMember.findUnique.mockResolvedValue(null);

      await expect(
        service.create('p-1', { name: 'Suite' }, mockLeadUser),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('Viewer không có quyền tạo Test Suite', async () => {
      mockPrisma.projectMember.findUnique.mockResolvedValue({ role: ProjectRole.VIEWER });

      await expect(
        service.create('p-1', { name: 'Suite' }, mockViewerUser),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('findAll', () => {
    it('trả về cấu trúc cây phân cấp Test Suites', async () => {
      mockPrisma.projectMember.findUnique.mockResolvedValue({ role: ProjectRole.TESTER });
      mockPrisma.testSuite.findMany.mockResolvedValue([
        {
          id: 'ts-root',
          projectId: 'p-1',
          name: 'Root Module',
          description: null,
          parentId: null,
          order: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { testCases: 5 },
        },
        {
          id: 'ts-child',
          projectId: 'p-1',
          name: 'Child Module',
          description: null,
          parentId: 'ts-root',
          order: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { testCases: 3 },
        },
      ]);

      const tree = await service.findAll('p-1', mockLeadUser);

      expect(tree.length).toBe(1);
      expect(tree[0].id).toBe('ts-root');
      expect(tree[0].children.length).toBe(1);
      expect(tree[0].children[0].id).toBe('ts-child');
      // Root test cases (5) + child test cases (3) = 8
      expect(tree[0].totalCaseCount).toBe(8);
    });
  });

  describe('update', () => {
    it('ném BadRequestException khi chọn chính mình làm Suite cha', async () => {
      mockPrisma.projectMember.findUnique.mockResolvedValue({ role: ProjectRole.QA_LEAD });
      mockPrisma.testSuite.findFirst.mockResolvedValue({ id: 'ts-1', projectId: 'p-1' });

      await expect(
        service.update('p-1', 'ts-1', { parentId: 'ts-1' }, mockLeadUser),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('remove', () => {
    it('QA Lead có thể xóa Suite', async () => {
      mockPrisma.projectMember.findUnique.mockResolvedValue({ role: ProjectRole.QA_LEAD });
      mockPrisma.testSuite.findFirst.mockResolvedValue({ id: 'ts-1', projectId: 'p-1' });
      mockPrisma.testSuite.delete.mockResolvedValue({});

      const result = await service.remove('p-1', 'ts-1', mockLeadUser);
      expect(result.message).toContain('thành công');
      expect(mockPrisma.testSuite.delete).toHaveBeenCalledWith({ where: { id: 'ts-1' } });
    });

    it('Tester không có quyền xóa Suite', async () => {
      mockPrisma.projectMember.findUnique.mockResolvedValue({ role: ProjectRole.TESTER });

      await expect(service.remove('p-1', 'ts-1', mockLeadUser)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });
});
