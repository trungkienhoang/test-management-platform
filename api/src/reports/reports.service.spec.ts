import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReportsService } from './reports.service.js';
import {
  SystemRole,
  ProjectRole,
  TestExecutionStatus,
  TestRunStatus,
  BugStatus,
  BugSeverity,
  TestCasePriority,
  TestCaseStatus,
} from '@prisma/client';
import * as XLSX from 'xlsx';

describe('ReportsService', () => {
  let service: ReportsService;
  let mockPrisma: any;

  const mockAdminUser = {
    sub: 'admin-1',
    email: 'admin@example.com',
    fullName: 'System Admin',
    systemRole: SystemRole.ADMIN,
  };

  const mockTesterUser = {
    sub: 'user-tester',
    email: 'tester@example.com',
    fullName: 'Nguyen Tester',
    systemRole: SystemRole.USER,
  };

  beforeEach(() => {
    mockPrisma = {
      project: {
        findUnique: vi.fn(),
      },
      projectMember: {
        findUnique: vi.fn(),
      },
      testSuite: {
        count: vi.fn(),
      },
      testCase: {
        count: vi.fn(),
        groupBy: vi.fn(),
      },
      testRun: {
        count: vi.fn(),
        groupBy: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
      testExecution: {
        groupBy: vi.fn(),
        findMany: vi.fn(),
      },
      bug: {
        count: vi.fn(),
        groupBy: vi.fn(),
        findMany: vi.fn(),
      },
    };

    service = new ReportsService(mockPrisma);
  });

  describe('getProjectDashboard', () => {
    it('chặn truy cập nếu người dùng không phải thành viên dự án và không phải Admin', async () => {
      mockPrisma.projectMember.findUnique.mockResolvedValue(null);

      await expect(
        service.getProjectDashboard('proj-1', mockTesterUser),
      ).rejects.toThrow('Bạn không phải thành viên của dự án này');
    });

    it('tính toán chính xác các chỉ số KPI, passRate, workload và trend cho Admin/thành viên', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1', name: 'Project 1' });
      mockPrisma.testSuite.count.mockResolvedValue(4);
      mockPrisma.testCase.count.mockResolvedValue(10);
      mockPrisma.testCase.groupBy
        .mockResolvedValueOnce([
          { status: TestCaseStatus.READY, _count: { _all: 8 } },
          { status: TestCaseStatus.DRAFT, _count: { _all: 2 } },
        ])
        .mockResolvedValueOnce([
          { priority: TestCasePriority.HIGH, _count: { _all: 6 } },
          { priority: TestCasePriority.MEDIUM, _count: { _all: 4 } },
        ]);

      mockPrisma.testRun.count.mockResolvedValue(2);
      mockPrisma.testRun.groupBy.mockResolvedValue([
        { status: TestRunStatus.COMPLETED, _count: { _all: 1 } },
        { status: TestRunStatus.IN_PROGRESS, _count: { _all: 1 } },
      ]);

      mockPrisma.testExecution.groupBy.mockResolvedValue([
        { status: TestExecutionStatus.PASSED, _count: { _all: 8 } },
        { status: TestExecutionStatus.FAILED, _count: { _all: 2 } },
      ]);

      mockPrisma.bug.count.mockResolvedValue(2);
      mockPrisma.bug.groupBy
        .mockResolvedValueOnce([
          { status: BugStatus.OPEN, _count: { _all: 1 } },
          { status: BugStatus.RESOLVED, _count: { _all: 1 } },
        ])
        .mockResolvedValueOnce([
          { severity: BugSeverity.HIGH, _count: { _all: 1 } },
          { severity: BugSeverity.MEDIUM, _count: { _all: 1 } },
        ]);

      mockPrisma.testRun.findMany.mockResolvedValue([
        {
          id: 'run-1',
          name: 'Sprint 3 Smoke Test',
          status: TestRunStatus.COMPLETED,
          createdAt: new Date(),
          completedAt: new Date(),
          assignedTo: { id: 'user-tester', fullName: 'Nguyen Tester', email: 'tester@example.com' },
          executions: [
            { status: TestExecutionStatus.PASSED },
            { status: TestExecutionStatus.PASSED },
            { status: TestExecutionStatus.FAILED },
          ],
        },
      ]);

      mockPrisma.testExecution.findMany
        .mockResolvedValueOnce([
          {
            status: TestExecutionStatus.PASSED,
            executedById: 'user-tester',
            executedBy: {
              id: 'user-tester',
              fullName: 'Nguyen Tester',
              email: 'tester@example.com',
              avatarUrl: null,
            },
          },
          {
            status: TestExecutionStatus.FAILED,
            executedById: 'user-tester',
            executedBy: {
              id: 'user-tester',
              fullName: 'Nguyen Tester',
              email: 'tester@example.com',
              avatarUrl: null,
            },
          },
        ])
        .mockResolvedValueOnce([]); // trend executions

      mockPrisma.bug.groupBy.mockResolvedValueOnce([
        { createdById: 'user-tester', _count: { _all: 1 } },
      ]);

      const result = await service.getProjectDashboard('proj-1', mockAdminUser);

      expect(result.overview.totalTestSuites).toBe(4);
      expect(result.overview.totalTestCases).toBe(10);
      expect(result.overview.totalTestRuns).toBe(2);
      expect(result.overview.totalExecutions).toBe(10);
      expect(result.overview.executionsByStatus.PASSED).toBe(8);
      expect(result.overview.executionsByStatus.FAILED).toBe(2);
      expect(result.overview.passRate).toBe(80); // 8 / 10 * 100 = 80%
      expect(result.overview.totalBugs).toBe(2);
      expect(result.overview.activeBugs).toBe(1);

      expect(result.recentRuns).toHaveLength(1);
      expect(result.recentRuns[0].passRate).toBe(66.7); // 2 / 3 * 100 = 66.7%

      expect(result.testerWorkload).toHaveLength(1);
      expect(result.testerWorkload[0].user.fullName).toBe('Nguyen Tester');
      expect(result.testerWorkload[0].totalExecuted).toBe(2);
      expect(result.testerWorkload[0].passed).toBe(1);
      expect(result.testerWorkload[0].failed).toBe(1);
      expect(result.testerWorkload[0].bugsReported).toBe(1);
      expect(result.executionTrend).toHaveLength(14);
    });
  });

  describe('getTestRunSummary & exportTestRunExcel', () => {
    it('lấy tóm tắt và xuất file Excel thành công với 3 sheets', async () => {
      const mockRun = {
        id: 'run-1',
        projectId: 'proj-1',
        name: 'Smoke Test Release 1.0',
        description: 'Kiểm thử khói hệ thống',
        status: TestRunStatus.COMPLETED,
        createdAt: new Date('2026-11-10T10:00:00Z'),
        startedAt: new Date('2026-11-10T10:05:00Z'),
        completedAt: new Date('2026-11-10T11:00:00Z'),
        reworkReason: null,
        project: { id: 'proj-1', name: 'Web QA', description: 'Desc' },
        createdBy: { id: 'user-lead', fullName: 'Tran QA Lead', email: 'lead@example.com' },
        assignedTo: { id: 'user-tester', fullName: 'Nguyen Tester', email: 'tester@example.com' },
        parentRun: null,
        executions: [
          {
            id: 'exec-1',
            testCaseId: 'tc-1',
            testCaseCode: 'TC-1',
            testCaseTitle: 'Đăng nhập thành công',
            testCasePriority: TestCasePriority.HIGH,
            testCaseVersion: 1,
            status: TestExecutionStatus.PASSED,
            actualResult: 'Đăng nhập bình thường',
            executedBy: { id: 'user-tester', fullName: 'Nguyen Tester', email: 'tester@example.com' },
            executedAt: new Date('2026-11-10T10:15:00Z'),
            executionDurationMs: 45000,
            bugs: [],
          },
          {
            id: 'exec-2',
            testCaseId: 'tc-2',
            testCaseCode: 'TC-2',
            testCaseTitle: 'Đăng xuất',
            testCasePriority: TestCasePriority.MEDIUM,
            testCaseVersion: 1,
            status: TestExecutionStatus.FAILED,
            actualResult: 'Không thấy nút đăng xuất',
            executedBy: { id: 'user-tester', fullName: 'Nguyen Tester', email: 'tester@example.com' },
            executedAt: new Date('2026-11-10T10:20:00Z'),
            executionDurationMs: 30000,
            bugs: [{ id: 'bug-1', code: 'BUG-1', title: 'Lỗi nút đăng xuất', severity: BugSeverity.HIGH, status: BugStatus.OPEN, assignee: null }],
          },
        ],
      };

      mockPrisma.testRun.findFirst.mockResolvedValue(mockRun);
      mockPrisma.bug.findMany.mockResolvedValue([
        {
          id: 'bug-1',
          code: 'BUG-1',
          title: 'Lỗi nút đăng xuất',
          severity: BugSeverity.HIGH,
          status: BugStatus.OPEN,
          createdAt: new Date('2026-11-10T10:22:00Z'),
          createdBy: { id: 'user-tester', fullName: 'Nguyen Tester' },
          assignee: null,
          testCase: { id: 'tc-2', code: 'TC-2', title: 'Đăng xuất' },
        },
      ]);

      const summary = await service.getTestRunSummary('proj-1', 'run-1', mockAdminUser);
      expect(summary.run.name).toBe('Smoke Test Release 1.0');
      expect(summary.metrics.total).toBe(2);
      expect(summary.metrics.passed).toBe(1);
      expect(summary.metrics.failed).toBe(1);
      expect(summary.metrics.passRate).toBe(50);
      expect(summary.bugs).toHaveLength(1);

      const buffer = await service.exportTestRunExcel('proj-1', 'run-1', mockAdminUser);
      expect(Buffer.isBuffer(buffer)).toBe(true);

      // Đọc lại workbook từ buffer để kiểm tra đúng 3 sheets
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      expect(workbook.SheetNames).toEqual(['Tổng Quan', 'Chi Tiết Thực Thi', 'Danh Sách Bugs']);
    });
  });
});
