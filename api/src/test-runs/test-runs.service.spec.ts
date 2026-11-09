import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestRunsService } from './test-runs.service.js';
import { SystemRole, ProjectRole, TestRunStatus, TestCasePriority, TestExecutionStatus } from '@prisma/client';

describe('TestRunsService', () => {
  let service: TestRunsService;
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
      project: { findUnique: vi.fn() },
      projectMember: { findUnique: vi.fn() },
      testCase: { findMany: vi.fn() },
      testRun: {
        create: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      testExecution: {
        createMany: vi.fn(),
        findMany: vi.fn(),
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

    service = new TestRunsService(mockPrisma, mockNotificationsService);
  });

  it('tạo Test Run thành công và đóng băng snapshot của Test Case', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1', key: 'TEST' });
    mockPrisma.testCase.findMany.mockResolvedValue([
      {
        id: 'tc-1',
        code: 'TC-1',
        title: 'Đăng nhập thành công',
        preconditions: 'Có tài khoản',
        steps: [{ stepNumber: 1, action: 'Nhập email', expectedResult: 'Hợp lệ' }],
        priority: TestCasePriority.HIGH,
        version: 1,
      },
    ]);

    const createdRun = {
      id: 'run-1',
      name: 'Sprint 3 Regression Run',
      projectId: 'proj-1',
      status: TestRunStatus.OPEN,
      assignedToId: 'tester-1',
      executions: [
        {
          id: 'exec-1',
          testCaseCode: 'TC-1',
          testCaseTitle: 'Đăng nhập thành công',
          status: TestExecutionStatus.UNTESTED,
        },
      ],
    };

    mockPrisma.testRun.create.mockResolvedValue(createdRun);
    mockPrisma.testRun.findFirst.mockResolvedValue(createdRun);
    mockPrisma.testExecution.findMany.mockResolvedValue([
      { status: TestExecutionStatus.UNTESTED },
    ]);

    const result = await service.create(
      'proj-1',
      {
        name: 'Sprint 3 Regression Run',
        includeAll: true,
        assignedToId: 'tester-1',
      },
      mockAdminUser,
    );

    expect(result.id).toBe('run-1');
    expect(mockPrisma.testRun.create).toHaveBeenCalled();
    expect(mockNotificationsService.create).toHaveBeenCalled();
  });

  it('tính toán đúng thống kê tỷ lệ tiến độ Pass/Fail/Blocked của Test Run', async () => {
    mockPrisma.testRun.findMany.mockResolvedValue([
      {
        id: 'run-1',
        title: 'Test Run 1',
        status: TestRunStatus.IN_PROGRESS,
        executions: [
          { status: TestExecutionStatus.PASSED },
          { status: TestExecutionStatus.PASSED },
          { status: TestExecutionStatus.FAILED },
          { status: TestExecutionStatus.UNTESTED },
        ],
      },
    ]);
    mockPrisma.testRun.count.mockResolvedValue(1);

    const result = await service.findAll('proj-1', mockAdminUser, { page: 1, limit: 10 });
    expect(result.data.length).toBe(1);
    const stats = result.data[0].stats;
    expect(stats.total).toBe(4);
    expect(stats.passed).toBe(2);
    expect(stats.failed).toBe(1);
    expect(stats.untested).toBe(1);
    expect(stats.passRate).toBe(50);
  });
});
