import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BugsService } from './bugs.service.js';
import { SystemRole, BugSeverity, BugStatus } from '@prisma/client';

describe('BugsService', () => {
  let service: BugsService;
  let mockPrisma: any;
  let mockNotificationsService: any;

  const mockAdminUser = {
    sub: 'admin-id',
    email: 'admin@example.com',
    fullName: 'Admin User',
    systemRole: SystemRole.ADMIN,
  };

  beforeEach(() => {
    mockPrisma = {
      project: {
        findUnique: vi.fn(),
        update: vi.fn().mockResolvedValue({ bugSeq: 1 }),
      },
      projectMember: { findUnique: vi.fn().mockResolvedValue({ role: 'DEVELOPER' }) },
      testCase: { findFirst: vi.fn() },
      testExecution: { findFirst: vi.fn() },
      bug: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
        groupBy: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => {
        if (typeof cb === 'function') {
          return cb(mockPrisma);
        }
        return Promise.all(cb);
      }),
    };

    mockNotificationsService = {
      create: vi.fn().mockResolvedValue({ id: 'notif-1' }),
    };

    service = new BugsService(mockPrisma, mockNotificationsService);
  });

  it('tạo Bug mới với mã tự tăng BUG-1 và gửi thông báo nếu gán người xử lý', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1', name: 'Project Alpha' });
    mockPrisma.bug.findMany.mockResolvedValue([]); // No existing bugs yet

    const createdBug = {
      id: 'bug-1',
      projectId: 'proj-1',
      code: 'BUG-1',
      title: 'Lỗi nút Đăng nhập không bấm được',
      description: 'Mô tả chi tiết',
      severity: BugSeverity.HIGH,
      status: BugStatus.OPEN,
      assigneeId: 'dev-1',
      createdById: 'admin-id',
    };
    mockPrisma.bug.create.mockResolvedValue(createdBug);

    const result = await service.create(
      'proj-1',
      {
        title: 'Lỗi nút Đăng nhập không bấm được',
        description: 'Mô tả chi tiết',
        severity: BugSeverity.HIGH,
        assigneeId: 'dev-1',
      },
      mockAdminUser,
    );

    expect(result.code).toBe('BUG-1');
    expect(mockNotificationsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'dev-1',
        title: expect.stringContaining('BUG-1'),
      }),
    );
  });

  it('tự tăng mã BUG-2 khi đã có BUG-1', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1', name: 'Project Alpha' });
    mockPrisma.project.update.mockResolvedValueOnce({ bugSeq: 2 });
    mockPrisma.bug.findMany.mockResolvedValue([{ code: 'BUG-1' }]);

    mockPrisma.bug.create.mockImplementation(({ data }: any) => {
      return { id: 'bug-2', ...data };
    });

    const result = await service.create(
      'proj-1',
      {
        title: 'Lỗi vỡ giao diện trên mobile',
        description: 'Màn hình dưới 500px bị tràn',
      },
      mockAdminUser,
    );

    expect(result.code).toBe('BUG-2');
  });

  it('cập nhật trạng thái Bug và gửi thông báo cho người tạo lỗi', async () => {
    mockPrisma.bug.findFirst.mockResolvedValue({
      id: 'bug-1',
      projectId: 'proj-1',
      code: 'BUG-1',
      title: 'Lỗi vỡ layout',
      status: BugStatus.OPEN,
      createdById: 'tester-1',
      assigneeId: 'dev-1',
      project: { name: 'Project Alpha' },
    });

    mockPrisma.bug.update.mockResolvedValue({
      id: 'bug-1',
      projectId: 'proj-1',
      code: 'BUG-1',
      title: 'Lỗi vỡ layout',
      status: BugStatus.RESOLVED,
      createdById: 'tester-1',
    });

    const result = await service.update(
      'proj-1',
      'bug-1',
      { status: BugStatus.RESOLVED },
      mockAdminUser,
    );

    expect(result.status).toBe(BugStatus.RESOLVED);
    expect(mockNotificationsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'tester-1',
        title: expect.stringContaining('BUG-1'),
      }),
    );
  });

  it('thống kê tổng hợp số lượng lỗi theo trạng thái và mức độ nghiêm trọng', async () => {
    mockPrisma.bug.groupBy
      .mockResolvedValueOnce([
        { status: BugStatus.OPEN, _count: { id: 3 } },
        { status: BugStatus.RESOLVED, _count: { id: 2 } },
      ])
      .mockResolvedValueOnce([
        { severity: BugSeverity.HIGH, _count: { id: 2 } },
        { severity: BugSeverity.CRITICAL, _count: { id: 1 } },
      ]);
    mockPrisma.bug.count.mockResolvedValue(5);

    const summary = await service.getSummary('proj-1', mockAdminUser);
    expect(summary.total).toBe(5);
    expect(summary.byStatus.OPEN).toBe(3);
    expect(summary.byStatus.RESOLVED).toBe(2);
    expect(summary.activeBugs).toBe(3);
    expect(summary.resolvedRate).toBe(40);
  });
});
