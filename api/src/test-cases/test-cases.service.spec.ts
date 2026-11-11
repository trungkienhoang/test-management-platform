import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestCasesService } from './test-cases.service.js';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProjectRole, SystemRole, TestCasePriority, TestCaseStatus } from '@prisma/client';
import * as XLSX from 'xlsx';

const mockPrisma = {
  projectMember: {
    findUnique: vi.fn(),
  },
  project: {
    findUnique: vi.fn(),
    update: vi.fn().mockResolvedValue({ testCaseSeq: 1 }),
  },
  testSuite: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
  },
  testCase: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  testCaseHistory: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  $transaction: vi.fn((callback) => callback(mockPrisma)),
};

describe('TestCasesService', () => {
  let service: TestCasesService;

  beforeEach(() => {
    vi.resetAllMocks();
    mockPrisma.$transaction.mockImplementation((callback) => callback(mockPrisma));
    mockPrisma.project.update.mockResolvedValue({ testCaseSeq: 1 });
    service = new TestCasesService(mockPrisma as any);
  });

  const mockLeadUser: any = { sub: 'u-lead', email: 'lead@test.dev', systemRole: SystemRole.USER };
  const mockTesterUser: any = { sub: 'u-tester', email: 'tester@test.dev', systemRole: SystemRole.USER };
  const mockViewerUser: any = { sub: 'u-viewer', email: 'viewer@test.dev', systemRole: SystemRole.USER };

  describe('create', () => {
    it('Tester tạo Test Case thành công và sinh mã TC-1', async () => {
      mockPrisma.projectMember.findUnique.mockResolvedValue({ role: ProjectRole.TESTER });
      mockPrisma.testCase.findMany.mockResolvedValue([]); // Chưa có test case nào
      mockPrisma.testCase.create.mockResolvedValue({
        id: 'tc-1',
        projectId: 'p-1',
        code: 'TC-1',
        title: 'Đăng nhập thành công',
        priority: TestCasePriority.HIGH,
        status: TestCaseStatus.DRAFT,
        tags: ['auth', 'smoke'],
        version: 1,
      });
      mockPrisma.testCaseHistory.create.mockResolvedValue({});

      const result = await service.create(
        'p-1',
        {
          title: 'Đăng nhập thành công',
          priority: TestCasePriority.HIGH,
          tags: ['auth', 'smoke'],
        },
        mockTesterUser,
      );

      expect(result.code).toBe('TC-1');
      expect(mockPrisma.testCase.create).toHaveBeenCalledOnce();
      expect(mockPrisma.testCaseHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          testCaseId: 'tc-1',
          version: 1,
          changeReason: 'Khởi tạo Test Case',
        }),
      });
    });

    it('Người dùng ngoài dự án ném ForbiddenException', async () => {
      mockPrisma.projectMember.findUnique.mockResolvedValue(null);

      await expect(
        service.create('p-1', { title: 'Test Case' }, mockTesterUser),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('Viewer không có quyền tạo Test Case', async () => {
      mockPrisma.projectMember.findUnique.mockResolvedValue({ role: ProjectRole.VIEWER });

      await expect(
        service.create('p-1', { title: 'Test Case' }, mockViewerUser),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('findAll', () => {
    it('tìm kiếm và lọc danh sách Test Case có phân trang', async () => {
      mockPrisma.projectMember.findUnique.mockResolvedValue({ role: ProjectRole.DEVELOPER });
      mockPrisma.testCase.count.mockResolvedValue(1);
      mockPrisma.testCase.findMany.mockResolvedValue([
        {
          id: 'tc-1',
          code: 'TC-1',
          title: 'Đăng nhập thành công',
          priority: TestCasePriority.MEDIUM,
        },
      ]);

      const res = await service.findAll(
        'p-1',
        { search: 'Đăng nhập', page: 1, limit: 10 },
        mockLeadUser,
      );

      expect(res.data.length).toBe(1);
      expect(res.pagination.total).toBe(1);
      expect(res.pagination.totalPages).toBe(1);
    });
  });

  describe('update', () => {
    it('cập nhật Test Case, tăng version lên 2 và lưu snapshot lịch sử', async () => {
      mockPrisma.projectMember.findUnique.mockResolvedValue({ role: ProjectRole.TESTER });
      mockPrisma.testCase.findFirst.mockResolvedValue({
        id: 'tc-1',
        projectId: 'p-1',
        version: 1,
        title: 'Cũ',
        steps: [],
        tags: [],
        priority: TestCasePriority.MEDIUM,
        status: TestCaseStatus.DRAFT,
      });

      mockPrisma.testCase.update.mockResolvedValue({
        id: 'tc-1',
        version: 2,
        title: 'Mới',
        steps: [],
        tags: [],
        priority: TestCasePriority.HIGH,
        status: TestCaseStatus.READY,
      });
      mockPrisma.testCaseHistory.create.mockResolvedValue({});

      const updated = await service.update(
        'p-1',
        'tc-1',
        {
          title: 'Mới',
          priority: TestCasePriority.HIGH,
          status: TestCaseStatus.READY,
          changeReason: 'Sửa độ ưu tiên lên HIGH',
        },
        mockTesterUser,
      );

      expect(updated.version).toBe(2);
      expect(mockPrisma.testCaseHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          testCaseId: 'tc-1',
          version: 2,
          changeReason: 'Sửa độ ưu tiên lên HIGH',
        }),
      });
    });
  });

  describe('exportTestCases', () => {
    it('xuất danh sách test cases ra file Excel/CSV', async () => {
      mockPrisma.projectMember.findUnique.mockResolvedValue({ role: ProjectRole.QA_LEAD });
      mockPrisma.project.findUnique.mockResolvedValue({ name: 'Web Portal' });
      mockPrisma.testCase.findMany.mockResolvedValue([
        {
          code: 'TC-1',
          title: 'Đăng nhập',
          suite: { name: 'Auth' },
          priority: TestCasePriority.HIGH,
          status: TestCaseStatus.READY,
          tags: ['smoke'],
          preconditions: 'None',
          description: 'Desc',
          steps: [{ stepNumber: 1, action: 'Click', expectedResult: 'Success' }],
          version: 1,
          createdAt: new Date(),
        },
      ]);

      const result = await service.exportTestCases('p-1', 'xlsx', mockLeadUser);

      expect(result.buffer).toBeDefined();
      expect(result.filename).toContain('Web_Portal_test_cases_');
      expect(result.contentType).toContain('spreadsheetml');
    });
  });

  describe('importTestCases', () => {
    it('đọc file Excel và nhập danh sách test cases', async () => {
      mockPrisma.projectMember.findUnique.mockResolvedValue({ role: ProjectRole.QA_LEAD });
      mockPrisma.testSuite.findMany.mockResolvedValue([]);
      mockPrisma.testSuite.create.mockResolvedValue({ id: 'ts-new', name: 'UI Suite' });
      mockPrisma.testCase.findMany.mockResolvedValue([]);
      mockPrisma.testCase.create.mockResolvedValue({ id: 'tc-imp', code: 'TC-1' });
      mockPrisma.testCaseHistory.create.mockResolvedValue({});

      // Tạo buffer Excel mẫu trong bộ nhớ
      const sampleRows = [
        {
          'Tiêu đề': 'Kiểm tra tìm kiếm sản phẩm',
          'Test Suite': 'UI Suite',
          'Độ ưu tiên': 'HIGH',
          'Trạng thái': 'READY',
          'Tags': 'search, ui',
          'Mô tả': 'Tìm theo từ khóa',
        },
      ];
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(sampleRows);
      XLSX.utils.book_append_sheet(wb, ws, 'TestCases');
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      const res = await service.importTestCases('p-1', buffer, mockLeadUser);

      expect(res.total).toBe(1);
      expect(res.imported).toBe(1);
      expect(res.failed).toBe(0);
      expect(mockPrisma.testCase.create).toHaveBeenCalledOnce();
    });
  });
});
