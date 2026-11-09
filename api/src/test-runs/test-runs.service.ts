import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { CreateTestRunDto } from './dto/create-test-run.dto.js';
import { UpdateTestRunDto } from './dto/update-test-run.dto.js';
import { QueryTestRunDto } from './dto/query-test-run.dto.js';
import { JwtPayload } from '../auth/strategies/jwt.strategy.js';
import { ProjectRole, SystemRole, TestRunStatus, TestExecutionStatus, NotificationType } from '@prisma/client';

@Injectable()
export class TestRunsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  // ─── PERMISSION HELPERS ──────────────────────────────────────────────────────

  private async assertProjectMember(projectId: string, user: JwtPayload): Promise<ProjectRole> {
    if (user.systemRole === SystemRole.ADMIN) return ProjectRole.QA_LEAD;

    const member = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId: user.sub },
      },
    });

    if (!member) {
      throw new ForbiddenException('Bạn không phải thành viên của dự án này');
    }

    return member.role;
  }

  private async assertCanWrite(projectId: string, user: JwtPayload) {
    if (user.systemRole === SystemRole.ADMIN) return;
    const role = await this.assertProjectMember(projectId, user);
    if (
      role !== ProjectRole.QA_LEAD &&
      role !== ProjectRole.TESTER &&
      role !== ProjectRole.DEVELOPER
    ) {
      throw new ForbiddenException('Chỉ QA Lead, Tester hoặc Developer mới có quyền thực hiện thao tác này');
    }
  }

  private async assertCanManage(projectId: string, user: JwtPayload) {
    if (user.systemRole === SystemRole.ADMIN) return;
    const role = await this.assertProjectMember(projectId, user);
    if (role !== ProjectRole.QA_LEAD) {
      throw new ForbiddenException('Chỉ QA Lead mới có quyền quản lý và đóng đợt kiểm thử');
    }
  }

  // ─── STATS HELPER ───────────────────────────────────────────────────────────

  private computeRunStats(executions: { status: TestExecutionStatus }[]) {
    const total = executions.length;
    let passed = 0;
    let failed = 0;
    let blocked = 0;
    let skipped = 0;
    let untested = 0;

    executions.forEach((e) => {
      switch (e.status) {
        case TestExecutionStatus.PASSED:
          passed++;
          break;
        case TestExecutionStatus.FAILED:
          failed++;
          break;
        case TestExecutionStatus.BLOCKED:
          blocked++;
          break;
        case TestExecutionStatus.SKIPPED:
          skipped++;
          break;
        default:
          untested++;
      }
    });

    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
    return { total, passed, failed, blocked, skipped, untested, passRate };
  }

  // ─── CRUD OPERATIONS ────────────────────────────────────────────────────────

  async create(projectId: string, dto: CreateTestRunDto, user: JwtPayload) {
    await this.assertCanWrite(projectId, user);

    // Resolve test cases to include in this run
    let targetCaseIds = new Set<string>();

    if (dto.includeAll) {
      const allCases = await this.prisma.testCase.findMany({
        where: { projectId },
        select: { id: true },
      });
      allCases.forEach((c) => targetCaseIds.add(c.id));
    }

    if (dto.suiteIds && dto.suiteIds.length > 0) {
      const suiteCases = await this.prisma.testCase.findMany({
        where: { projectId, suiteId: { in: dto.suiteIds } },
        select: { id: true },
      });
      suiteCases.forEach((c) => targetCaseIds.add(c.id));
    }

    if (dto.testCaseIds && dto.testCaseIds.length > 0) {
      dto.testCaseIds.forEach((id) => targetCaseIds.add(id));
    }

    if (targetCaseIds.size === 0) {
      throw new BadRequestException('Vui lòng chọn ít nhất 1 Test Case để tạo đợt kiểm thử');
    }

    // Fetch full data of the chosen test cases to freeze their snapshots
    const testCases = await this.prisma.testCase.findMany({
      where: { id: { in: Array.from(targetCaseIds) }, projectId },
      orderBy: [{ code: 'asc' }],
    });

    if (testCases.length === 0) {
      throw new NotFoundException('Không tìm thấy Test Case hợp lệ nào trong dự án này');
    }

    // Check project name for notification
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true },
    });

    // Create Test Run & Test Executions inside a database transaction
    const newRun = await this.prisma.$transaction(async (tx) => {
      const run = await tx.testRun.create({
        data: {
          projectId,
          name: dto.name.trim(),
          description: dto.description?.trim(),
          createdById: user.sub,
          assignedToId: dto.assignedToId || null,
          status: TestRunStatus.OPEN,
        },
        include: {
          createdBy: { select: { id: true, fullName: true, email: true } },
          assignedTo: { select: { id: true, fullName: true, email: true } },
        },
      });

      // Bulk create TestExecutions with frozen snapshots
      const executionData = testCases.map((tc) => ({
        testRunId: run.id,
        testCaseId: tc.id,
        testCaseCode: tc.code,
        testCaseTitle: tc.title,
        testCasePreconditions: tc.preconditions,
        testCaseSteps: tc.steps as any,
        testCasePriority: tc.priority,
        testCaseVersion: tc.version,
        status: TestExecutionStatus.UNTESTED,
      }));

      await tx.testExecution.createMany({
        data: executionData,
      });

      return run;
    });

    // Trigger in-app notification if assigned to another user
    if (dto.assignedToId && dto.assignedToId !== user.sub) {
      await this.notificationsService.create({
        userId: dto.assignedToId,
        projectId,
        title: 'Bạn được gán Test Run mới',
        message: `Bạn được giao thực thi đợt kiểm thử "${newRun.name}" trong dự án ${project?.name || ''}`,
        type: NotificationType.TEST_RUN_ASSIGNED,
        link: `/projects/${projectId}/test-runs/${newRun.id}/runner`,
      });
    }

    return this.findOne(projectId, newRun.id, user);
  }

  async findAll(projectId: string, user: JwtPayload, query: QueryTestRunDto) {
    await this.assertProjectMember(projectId, user);

    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 10);
    const skip = (page - 1) * limit;

    const where: any = { projectId };
    if (query.status) {
      where.status = query.status;
    }
    if (query.assignedToId) {
      where.assignedToId = query.assignedToId;
    }
    if (query.search) {
      const s = query.search.trim();
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { description: { contains: s, mode: 'insensitive' } },
      ];
    }

    const [runs, total] = await this.prisma.$transaction([
      this.prisma.testRun.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }],
        include: {
          createdBy: { select: { id: true, fullName: true, email: true } },
          assignedTo: { select: { id: true, fullName: true, email: true } },
          executions: {
            select: { status: true },
          },
        },
      }),
      this.prisma.testRun.count({ where }),
    ]);

    const data = runs.map((run) => {
      const stats = this.computeRunStats(run.executions);
      const { executions, ...rest } = run;
      return {
        ...rest,
        stats,
      };
    });

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async findOne(projectId: string, id: string, user: JwtPayload) {
    await this.assertProjectMember(projectId, user);

    const run = await this.prisma.testRun.findFirst({
      where: { id, projectId },
      include: {
        createdBy: { select: { id: true, fullName: true, email: true } },
        assignedTo: { select: { id: true, fullName: true, email: true } },
        executions: {
          orderBy: [{ testCaseCode: 'asc' }],
          include: {
            executedBy: { select: { id: true, fullName: true, email: true } },
            testCase: {
              select: {
                id: true,
                code: true,
                title: true,
                suite: { select: { id: true, name: true } },
              },
            },
            bugs: {
              select: {
                id: true,
                code: true,
                title: true,
                severity: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!run) {
      throw new NotFoundException('Đợt kiểm thử không tồn tại trong dự án này');
    }

    const stats = this.computeRunStats(run.executions);

    return {
      ...run,
      stats,
    };
  }

  async update(projectId: string, id: string, dto: UpdateTestRunDto, user: JwtPayload) {
    await this.assertCanWrite(projectId, user);

    const current = await this.prisma.testRun.findFirst({
      where: { id, projectId },
    });

    if (!current) {
      throw new NotFoundException('Đợt kiểm thử không tồn tại trong dự án');
    }

    // Only QA Lead can close / complete a run
    if (dto.status === TestRunStatus.COMPLETED && current.status !== TestRunStatus.COMPLETED) {
      await this.assertCanManage(projectId, user);
    }

    let startedAt = current.startedAt;
    if (dto.status === TestRunStatus.IN_PROGRESS && !startedAt) {
      startedAt = new Date();
    }

    let completedAt = current.completedAt;
    if (dto.status === TestRunStatus.COMPLETED) {
      completedAt = new Date();
    } else if (dto.status === TestRunStatus.OPEN || dto.status === TestRunStatus.IN_PROGRESS) {
      completedAt = null;
    }

    const updated = await this.prisma.testRun.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.description !== undefined && { description: dto.description?.trim() }),
        ...(dto.assignedToId !== undefined && { assignedToId: dto.assignedToId || null }),
        ...(dto.status !== undefined && { status: dto.status }),
        startedAt,
        completedAt,
      },
    });

    // Notify new assignee if changed
    if (
      dto.assignedToId &&
      dto.assignedToId !== current.assignedToId &&
      dto.assignedToId !== user.sub
    ) {
      await this.notificationsService.create({
        userId: dto.assignedToId,
        projectId,
        title: 'Bạn được gán Test Run',
        message: `Bạn được giao thực thi đợt kiểm thử "${updated.name}"`,
        type: NotificationType.TEST_RUN_ASSIGNED,
        link: `/projects/${projectId}/test-runs/${updated.id}/runner`,
      });
    }

    return this.findOne(projectId, id, user);
  }

  async remove(projectId: string, id: string, user: JwtPayload) {
    await this.assertCanManage(projectId, user);

    const current = await this.prisma.testRun.findFirst({
      where: { id, projectId },
    });

    if (!current) {
      throw new NotFoundException('Đợt kiểm thử không tồn tại trong dự án');
    }

    return this.prisma.testRun.delete({
      where: { id },
    });
  }
}
