import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import {
  ProjectRole,
  SystemRole,
  TestExecutionStatus,
  TestRunStatus,
  BugStatus,
  BugSeverity,
  TestCasePriority,
  TestCaseStatus,
} from '@prisma/client';
import * as XLSX from 'xlsx';
import { PrismaService } from '../prisma/prisma.service.js';
import { JwtPayload } from '../auth/strategies/jwt.strategy.js';

export interface DashboardSummaryResponse {
  overview: {
    totalTestCases: number;
    testCasesByStatus: Record<TestCaseStatus, number>;
    testCasesByPriority: Record<TestCasePriority, number>;
    totalTestSuites: number;
    totalTestRuns: number;
    testRunsByStatus: Record<TestRunStatus, number>;
    totalExecutions: number;
    executionsByStatus: Record<TestExecutionStatus, number>;
    passRate: number;
    totalBugs: number;
    activeBugs: number;
    resolvedBugs: number;
    bugsBySeverity: Record<BugSeverity, number>;
    bugsByStatus: Record<BugStatus, number>;
  };
  recentRuns: Array<{
    id: string;
    name: string;
    status: TestRunStatus;
    createdAt: Date;
    completedAt: Date | null;
    assignedTo: { id: string; fullName: string; email: string } | null;
    totalTests: number;
    passed: number;
    failed: number;
    blocked: number;
    skipped: number;
    untested: number;
    passRate: number;
  }>;
  testerWorkload: Array<{
    user: {
      id: string;
      fullName: string;
      email: string;
      avatarUrl: string | null;
    };
    totalExecuted: number;
    passed: number;
    failed: number;
    blocked: number;
    skipped: number;
    bugsReported: number;
  }>;
  executionTrend: Array<{
    date: string;
    passed: number;
    failed: number;
    blocked: number;
    skipped: number;
    total: number;
  }>;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertProjectMember(projectId: string, user: JwtPayload): Promise<ProjectRole> {
    if (user.systemRole === SystemRole.ADMIN) {
      return ProjectRole.QA_LEAD;
    }

    const member = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: user.sub,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException('Bạn không phải thành viên của dự án này');
    }

    return member.role;
  }

  /**
   * Lấy dữ liệu thống kê tổng hợp cho Dashboard của Dự án
   */
  async getProjectDashboard(projectId: string, user: JwtPayload): Promise<DashboardSummaryResponse> {
    await this.assertProjectMember(projectId, user);

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true },
    });
    if (!project) {
      throw new NotFoundException('Dự án không tồn tại');
    }

    // 1. Thống kê Test Cases & Test Suites
    const [
      totalTestSuites,
      totalTestCases,
      tcStatusGroups,
      tcPriorityGroups,
    ] = await Promise.all([
      this.prisma.testSuite.count({ where: { projectId } }),
      this.prisma.testCase.count({ where: { projectId } }),
      this.prisma.testCase.groupBy({
        by: ['status'],
        where: { projectId },
        _count: { _all: true },
      }),
      this.prisma.testCase.groupBy({
        by: ['priority'],
        where: { projectId },
        _count: { _all: true },
      }),
    ]);

    const testCasesByStatus: Record<TestCaseStatus, number> = {
      DRAFT: 0,
      READY: 0,
      DEPRECATED: 0,
    };
    tcStatusGroups.forEach((g) => {
      testCasesByStatus[g.status] = g._count._all;
    });

    const testCasesByPriority: Record<TestCasePriority, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    };
    tcPriorityGroups.forEach((g) => {
      testCasesByPriority[g.priority] = g._count._all;
    });

    // 2. Thống kê Test Runs
    const [totalTestRuns, runStatusGroups] = await Promise.all([
      this.prisma.testRun.count({ where: { projectId } }),
      this.prisma.testRun.groupBy({
        by: ['status'],
        where: { projectId },
        _count: { _all: true },
      }),
    ]);

    const testRunsByStatus: Record<TestRunStatus, number> = {
      OPEN: 0,
      IN_PROGRESS: 0,
      IN_REVIEW: 0,
      COMPLETED: 0,
    };
    runStatusGroups.forEach((g) => {
      testRunsByStatus[g.status] = g._count._all;
    });

    // 3. Thống kê Test Executions
    const executionGroups = await this.prisma.testExecution.groupBy({
      by: ['status'],
      where: { testRun: { projectId } },
      _count: { _all: true },
    });

    const executionsByStatus: Record<TestExecutionStatus, number> = {
      UNTESTED: 0,
      PASSED: 0,
      FAILED: 0,
      BLOCKED: 0,
      SKIPPED: 0,
    };
    let totalExecutions = 0;
    executionGroups.forEach((g) => {
      executionsByStatus[g.status] = g._count._all;
      totalExecutions += g._count._all;
    });

    const evaluated =
      executionsByStatus.PASSED +
      executionsByStatus.FAILED +
      executionsByStatus.BLOCKED +
      executionsByStatus.SKIPPED;
    const passRate =
      evaluated > 0 ? Math.round((executionsByStatus.PASSED / evaluated) * 1000) / 10 : 0;

    // 4. Thống kê Bugs
    const [totalBugs, bugStatusGroups, bugSeverityGroups] = await Promise.all([
      this.prisma.bug.count({ where: { projectId } }),
      this.prisma.bug.groupBy({
        by: ['status'],
        where: { projectId },
        _count: { _all: true },
      }),
      this.prisma.bug.groupBy({
        by: ['severity'],
        where: { projectId },
        _count: { _all: true },
      }),
    ]);

    const bugsByStatus: Record<BugStatus, number> = {
      OPEN: 0,
      IN_PROGRESS: 0,
      RESOLVED: 0,
      VERIFIED: 0,
      CLOSED: 0,
      REOPENED: 0,
    };
    bugStatusGroups.forEach((g) => {
      bugsByStatus[g.status] = g._count._all;
    });

    const bugsBySeverity: Record<BugSeverity, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    };
    bugSeverityGroups.forEach((g) => {
      bugsBySeverity[g.severity] = g._count._all;
    });

    const activeBugs = bugsByStatus.OPEN + bugsByStatus.IN_PROGRESS + bugsByStatus.REOPENED;
    const resolvedBugs = bugsByStatus.RESOLVED + bugsByStatus.VERIFIED + bugsByStatus.CLOSED;

    // 5. Đợt kiểm thử gần nhất (Recent Runs)
    const recentRunsRaw = await this.prisma.testRun.findMany({
      where: { projectId },
      take: 6,
      orderBy: { createdAt: 'desc' },
      include: {
        assignedTo: { select: { id: true, fullName: true, email: true } },
        executions: { select: { status: true } },
      },
    });

    const recentRuns = recentRunsRaw.map((run) => {
      let passed = 0;
      let failed = 0;
      let blocked = 0;
      let skipped = 0;
      let untested = 0;
      run.executions.forEach((e) => {
        if (e.status === TestExecutionStatus.PASSED) passed++;
        else if (e.status === TestExecutionStatus.FAILED) failed++;
        else if (e.status === TestExecutionStatus.BLOCKED) blocked++;
        else if (e.status === TestExecutionStatus.SKIPPED) skipped++;
        else untested++;
      });
      const totalTests = run.executions.length;
      const tested = passed + failed + blocked + skipped;
      const rPassRate = tested > 0 ? Math.round((passed / tested) * 1000) / 10 : 0;

      return {
        id: run.id,
        name: run.name,
        status: run.status,
        createdAt: run.createdAt,
        completedAt: run.completedAt,
        assignedTo: run.assignedTo,
        totalTests,
        passed,
        failed,
        blocked,
        skipped,
        untested,
        passRate: rPassRate,
      };
    });

    // 6. Năng suất và đóng góp của Tester (Tester Workload)
    const executedItems = await this.prisma.testExecution.findMany({
      where: {
        testRun: { projectId },
        executedById: { not: null },
      },
      select: {
        status: true,
        executedById: true,
        executedBy: {
          select: { id: true, fullName: true, email: true, avatarUrl: true },
        },
      },
    });

    const workloadMap = new Map<
      string,
      {
        user: { id: string; fullName: string; email: string; avatarUrl: string | null };
        totalExecuted: number;
        passed: number;
        failed: number;
        blocked: number;
        skipped: number;
        bugsReported: number;
      }
    >();

    executedItems.forEach((item) => {
      if (!item.executedById || !item.executedBy) return;
      let entry = workloadMap.get(item.executedById);
      if (!entry) {
        entry = {
          user: item.executedBy,
          totalExecuted: 0,
          passed: 0,
          failed: 0,
          blocked: 0,
          skipped: 0,
          bugsReported: 0,
        };
        workloadMap.set(item.executedById, entry);
      }
      entry.totalExecuted++;
      if (item.status === TestExecutionStatus.PASSED) entry.passed++;
      else if (item.status === TestExecutionStatus.FAILED) entry.failed++;
      else if (item.status === TestExecutionStatus.BLOCKED) entry.blocked++;
      else if (item.status === TestExecutionStatus.SKIPPED) entry.skipped++;
    });

    // Đếm số bug do từng user tạo trong project
    const bugsCreatedByUser = await this.prisma.bug.groupBy({
      by: ['createdById'],
      where: { projectId },
      _count: { _all: true },
    });
    bugsCreatedByUser.forEach((b) => {
      const entry = workloadMap.get(b.createdById);
      if (entry) {
        entry.bugsReported = b._count._all;
      }
    });

    const testerWorkload = Array.from(workloadMap.values()).sort(
      (a, b) => b.totalExecuted - a.totalExecuted,
    );

    // 7. Xu hướng thực thi (Execution Trend - 14 ngày gần nhất)
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);
    fourteenDaysAgo.setHours(0, 0, 0, 0);

    const trendExecutions = await this.prisma.testExecution.findMany({
      where: {
        testRun: { projectId },
        executedAt: { gte: fourteenDaysAgo },
      },
      select: {
        status: true,
        executedAt: true,
      },
    });

    const trendMap = new Map<
      string,
      { passed: number; failed: number; blocked: number; skipped: number; total: number }
    >();

    // Khởi tạo 14 ngày
    for (let i = 0; i < 14; i++) {
      const d = new Date(fourteenDaysAgo);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      trendMap.set(key, { passed: 0, failed: 0, blocked: 0, skipped: 0, total: 0 });
    }

    trendExecutions.forEach((e) => {
      if (!e.executedAt) return;
      const key = e.executedAt.toISOString().slice(0, 10);
      const entry = trendMap.get(key);
      if (entry) {
        entry.total++;
        if (e.status === TestExecutionStatus.PASSED) entry.passed++;
        else if (e.status === TestExecutionStatus.FAILED) entry.failed++;
        else if (e.status === TestExecutionStatus.BLOCKED) entry.blocked++;
        else if (e.status === TestExecutionStatus.SKIPPED) entry.skipped++;
      }
    });

    const executionTrend = Array.from(trendMap.entries()).map(([date, data]) => ({
      date,
      ...data,
    }));

    return {
      overview: {
        totalTestCases,
        testCasesByStatus,
        testCasesByPriority,
        totalTestSuites,
        totalTestRuns,
        testRunsByStatus,
        totalExecutions,
        executionsByStatus,
        passRate,
        totalBugs,
        activeBugs,
        resolvedBugs,
        bugsBySeverity,
        bugsByStatus,
      },
      recentRuns,
      testerWorkload,
      executionTrend,
    };
  }

  /**
   * Lấy dữ liệu chi tiết tóm tắt của một Test Run để hiển thị báo cáo hoặc in PDF
   */
  async getTestRunSummary(projectId: string, runId: string, user: JwtPayload) {
    await this.assertProjectMember(projectId, user);

    const run = await this.prisma.testRun.findFirst({
      where: { id: runId, projectId },
      include: {
        project: { select: { id: true, name: true, description: true } },
        createdBy: { select: { id: true, fullName: true, email: true } },
        assignedTo: { select: { id: true, fullName: true, email: true } },
        parentRun: { select: { id: true, name: true } },
        executions: {
          include: {
            executedBy: { select: { id: true, fullName: true, email: true } },
            bugs: {
              select: {
                id: true,
                code: true,
                title: true,
                severity: true,
                status: true,
                assignee: { select: { id: true, fullName: true } },
              },
            },
          },
          orderBy: [{ testCaseCode: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!run) {
      throw new NotFoundException('Đợt kiểm thử không tồn tại trong dự án này');
    }

    let passed = 0;
    let failed = 0;
    let blocked = 0;
    let skipped = 0;
    let untested = 0;
    let totalDurationMs = 0;

    run.executions.forEach((e) => {
      if (e.status === TestExecutionStatus.PASSED) passed++;
      else if (e.status === TestExecutionStatus.FAILED) failed++;
      else if (e.status === TestExecutionStatus.BLOCKED) blocked++;
      else if (e.status === TestExecutionStatus.SKIPPED) skipped++;
      else untested++;

      if (e.executionDurationMs) {
        totalDurationMs += e.executionDurationMs;
      }
    });

    const total = run.executions.length;
    const executed = passed + failed + blocked + skipped;
    const passRate = executed > 0 ? Math.round((passed / executed) * 1000) / 10 : 0;
    const progressRate = total > 0 ? Math.round((executed / total) * 1000) / 10 : 0;

    // Lấy tất cả bugs phát sinh trong run này
    const bugs = await this.prisma.bug.findMany({
      where: {
        testExecution: {
          testRunId: runId,
        },
      },
      include: {
        createdBy: { select: { id: true, fullName: true } },
        assignee: { select: { id: true, fullName: true } },
        testCase: { select: { id: true, code: true, title: true } },
      },
      orderBy: { code: 'asc' },
    });

    return {
      run: {
        id: run.id,
        name: run.name,
        description: run.description,
        status: run.status,
        createdAt: run.createdAt,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        reworkReason: run.reworkReason,
        createdBy: run.createdBy,
        assignedTo: run.assignedTo,
        parentRun: run.parentRun,
        projectName: run.project.name,
      },
      metrics: {
        total,
        executed,
        passed,
        failed,
        blocked,
        skipped,
        untested,
        passRate,
        progressRate,
        totalDurationMs,
        totalBugs: bugs.length,
      },
      executions: run.executions.map((e) => ({
        id: e.id,
        testCaseId: e.testCaseId,
        testCaseCode: e.testCaseCode,
        testCaseTitle: e.testCaseTitle,
        testCasePriority: e.testCasePriority,
        testCaseVersion: e.testCaseVersion,
        status: e.status,
        actualResult: e.actualResult,
        executedBy: e.executedBy,
        executedAt: e.executedAt,
        executionDurationMs: e.executionDurationMs,
        bugs: e.bugs,
      })),
      bugs,
    };
  }

  /**
   * Xuất báo cáo tổng kết Test Run thành tệp Excel (.xlsx) gồm 3 Sheets
   */
  async exportTestRunExcel(projectId: string, runId: string, user: JwtPayload): Promise<Buffer> {
    const summary = await this.getTestRunSummary(projectId, runId, user);
    const { run, metrics, executions, bugs } = summary;

    const wb = XLSX.utils.book_new();

    // ── SHEET 1: TỔNG QUAN (Summary) ──────────────────────────────────────────
    const summaryRows = [
      { 'Thông số': 'Tên Đợt Kiểm Thử', 'Giá trị': run.name },
      { 'Thông số': 'Dự án', 'Giá trị': run.projectName },
      { 'Thông số': 'Mô tả', 'Giá trị': run.description || '(Không có)' },
      { 'Thông số': 'Trạng thái', 'Giá trị': run.status },
      { 'Thông số': 'Người tạo', 'Giá trị': `${run.createdBy.fullName} (${run.createdBy.email})` },
      {
        'Thông số': 'Người được giao',
        'Giá trị': run.assignedTo
          ? `${run.assignedTo.fullName} (${run.assignedTo.email})`
          : 'Chưa phân công',
      },
      { 'Thông số': 'Ngày khởi tạo', 'Giá trị': run.createdAt.toISOString() },
      {
        'Thông số': 'Ngày bắt đầu thực thi',
        'Giá trị': run.startedAt ? run.startedAt.toISOString() : 'Chưa bắt đầu',
      },
      {
        'Thông số': 'Ngày hoàn thành / Duyệt',
        'Giá trị': run.completedAt ? run.completedAt.toISOString() : 'Chưa hoàn thành',
      },
      { 'Thông số': 'Tổng số ca kiểm thử', 'Giá trị': metrics.total },
      { 'Thông số': 'Đã thực hiện', 'Giá trị': metrics.executed },
      { 'Thông số': 'Đạt (Passed)', 'Giá trị': metrics.passed },
      { 'Thông số': 'Thất bại (Failed)', 'Giá trị': metrics.failed },
      { 'Thông số': 'Bị chặn (Blocked)', 'Giá trị': metrics.blocked },
      { 'Thông số': 'Bỏ qua (Skipped)', 'Giá trị': metrics.skipped },
      { 'Thông số': 'Chưa thực hiện (Untested)', 'Giá trị': metrics.untested },
      { 'Thông số': 'Tỷ lệ Vượt qua (Pass Rate)', 'Giá trị': `${metrics.passRate}%` },
      { 'Thông số': 'Tiến độ hoàn thành', 'Giá trị': `${metrics.progressRate}%` },
      { 'Thông số': 'Tổng số Bug phát hiện', 'Giá trị': metrics.totalBugs },
    ];

    if (run.reworkReason) {
      summaryRows.push({
        'Thông số': 'Lý do QA Lead yêu cầu làm lại',
        'Giá trị': run.reworkReason,
      });
    }

    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    wsSummary['!cols'] = [{ wch: 30 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Tổng Quan');

    // ── SHEET 2: CHI TIẾT THỰC THI (Executions) ──────────────────────────────
    const executionRows = executions.map((e, index) => ({
      STT: index + 1,
      'Mã Test Case': e.testCaseCode,
      'Tiêu đề Test Case': e.testCaseTitle,
      'Độ ưu tiên': e.testCasePriority,
      'Phiên bản': `v${e.testCaseVersion}`,
      'Kết quả kiểm thử': e.status,
      'Người thực hiện': e.executedBy ? e.executedBy.fullName : 'Chưa chạy',
      'Thời điểm thực hiện': e.executedAt ? e.executedAt.toISOString().replace('T', ' ').slice(0, 19) : '',
      'Thời lượng (giây)': e.executionDurationMs ? Math.round(e.executionDurationMs / 1000) : '',
      'Kết quả thực tế / Ghi chú': e.actualResult || '',
      'Số Bug liên kết': e.bugs.length,
      'Mã các Bug liên kết': e.bugs.map((b) => b.code).join(', '),
    }));

    const wsExecutions = XLSX.utils.json_to_sheet(executionRows);
    wsExecutions['!cols'] = [
      { wch: 6 },
      { wch: 14 },
      { wch: 35 },
      { wch: 12 },
      { wch: 10 },
      { wch: 18 },
      { wch: 20 },
      { wch: 22 },
      { wch: 16 },
      { wch: 40 },
      { wch: 14 },
      { wch: 20 },
    ];
    XLSX.utils.book_append_sheet(wb, wsExecutions, 'Chi Tiết Thực Thi');

    // ── SHEET 3: DANH SÁCH BUGS PHÁT HIỆN ─────────────────────────────────────
    const bugRows = bugs.map((b, index) => ({
      STT: index + 1,
      'Mã Bug': b.code,
      'Tiêu đề Bug': b.title,
      'Ca kiểm thử liên quan': b.testCase ? `[${b.testCase.code}] ${b.testCase.title}` : '',
      'Mức độ nghiêm trọng': b.severity,
      'Trạng thái': b.status,
      'Người phát hiện': b.createdBy ? b.createdBy.fullName : '',
      'Người được phân công': b.assignee ? b.assignee.fullName : 'Chưa gán',
      'Thời điểm tạo': b.createdAt.toISOString().replace('T', ' ').slice(0, 19),
    }));

    const wsBugs = XLSX.utils.json_to_sheet(bugRows);
    wsBugs['!cols'] = [
      { wch: 6 },
      { wch: 12 },
      { wch: 35 },
      { wch: 30 },
      { wch: 18 },
      { wch: 16 },
      { wch: 20 },
      { wch: 22 },
      { wch: 22 },
    ];
    XLSX.utils.book_append_sheet(wb, wsBugs, 'Danh Sách Bugs');

    const buffer: Buffer = XLSX.write(wb, {
      type: 'buffer',
      bookType: 'xlsx',
    });

    return buffer;
  }
}
