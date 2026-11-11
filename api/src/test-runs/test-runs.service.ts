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
        { name: { contains: s } },
        { description: { contains: s } },
        { assignedTo: { fullName: { contains: s } } },
        { assignedTo: { email: { contains: s } } },
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
          parentRun: { select: { id: true, name: true } },
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
        parentRun: { select: { id: true, name: true } },
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

    // Compute dynamic user permissions for this test run
    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: user.sub } },
      select: { role: true },
    });
    const memberRole = user.systemRole === SystemRole.ADMIN ? ProjectRole.QA_LEAD : member?.role;
    const isQALead = user.systemRole === SystemRole.ADMIN || memberRole === ProjectRole.QA_LEAD;
    const canWrite =
      isQALead || memberRole === ProjectRole.TESTER || memberRole === ProjectRole.DEVELOPER;
    const isAssignee = run.assignedToId === user.sub;
    const isCompleted = run.status === TestRunStatus.COMPLETED;
    const isInReview = run.status === TestRunStatus.IN_REVIEW;

    const permissions = {
      isQALeadOrAdmin: isQALead,
      canExecute: !isCompleted && !isInReview && (canWrite || isAssignee),
      canSubmitForReview: !isCompleted && !isInReview && canWrite,
      canReview: isInReview && isQALead,
      canApprove: isInReview && isQALead,
      canRequestRework: isInReview && isQALead,
      canRetest: isCompleted && canWrite,
      canEdit: !isCompleted && canWrite,
      canDelete: !isCompleted && isQALead,
    };

    return {
      ...run,
      stats,
      permissions,
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

    // Lock update if run is completed
    if (current.status === TestRunStatus.COMPLETED) {
      throw new ForbiddenException(
        'Đợt kiểm thử đã hoàn thành (COMPLETED) và khóa chỉ đọc, không thể chỉnh sửa thông tin',
      );
    }

    const updated = await this.prisma.testRun.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.description !== undefined && { description: dto.description?.trim() }),
        ...(dto.assignedToId !== undefined && { assignedToId: dto.assignedToId || null }),
      },
    });

    // Notify new assignee if changed
    if (
      dto.assignedToId &&
      dto.assignedToId !== current.assignedToId &&
      dto.assignedToId !== user.sub
    ) {
      try {
        await this.notificationsService.create({
          userId: dto.assignedToId,
          projectId,
          title: 'Bạn được gán Test Run',
          message: `Bạn được giao thực thi đợt kiểm thử "${updated.name}"`,
          type: NotificationType.TEST_RUN_ASSIGNED,
          link: `/projects/${projectId}/test-runs/${updated.id}/runner`,
        });
      } catch (err) {
        console.error('Failed to send assignment notification', err);
      }
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

    if (current.status === TestRunStatus.COMPLETED) {
      throw new ForbiddenException(
        'Không thể xóa đợt kiểm thử đã hoàn thành (COMPLETED) để bảo toàn tính toàn vẹn của lịch sử và báo cáo kiểm thử',
      );
    }

    return this.prisma.testRun.delete({
      where: { id },
    });
  }

  // ─── REVIEW & SIGN-OFF WORKFLOW ──────────────────────────────────────────────

  async submitForReview(projectId: string, id: string, user: JwtPayload) {
    await this.assertCanWrite(projectId, user);

    const run = await this.prisma.testRun.findFirst({
      where: { id, projectId },
      include: {
        project: { select: { name: true } },
        executions: { select: { id: true, status: true } },
      },
    });

    if (!run) {
      throw new NotFoundException('Đợt kiểm thử không tồn tại trong dự án');
    }

    if (run.status === TestRunStatus.COMPLETED) {
      throw new BadRequestException('Đợt kiểm thử đã hoàn thành và đóng, không thể gửi duyệt');
    }

    if (run.status === TestRunStatus.IN_REVIEW) {
      throw new BadRequestException('Đợt kiểm thử hiện đang ở trạng thái Chờ QA duyệt');
    }

    if (!run.executions || run.executions.length === 0) {
      throw new BadRequestException('Đợt kiểm thử chưa có ca kiểm thử nào');
    }

    const untestedCount = run.executions.filter((e) => e.status === TestExecutionStatus.UNTESTED).length;
    if (untestedCount > 0) {
      throw new BadRequestException(
        `Không thể gửi duyệt: Còn ${untestedCount} ca kiểm thử chưa thực hiện (UNTESTED). Vui lòng hoàn thành toàn bộ ca kiểm thử trước khi gửi QA Lead rà soát.`,
      );
    }

    await this.prisma.testRun.update({
      where: { id },
      data: {
        status: TestRunStatus.IN_REVIEW,
        reworkReason: null,
      },
    });

    // Notify all QA Leads in the project safely
    const qaLeads = await this.prisma.projectMember.findMany({
      where: { projectId, role: ProjectRole.QA_LEAD },
      select: { userId: true },
    });

    for (const lead of qaLeads) {
      if (lead.userId !== user.sub) {
        try {
          await this.notificationsService.create({
            userId: lead.userId,
            projectId,
            title: `Đợt kiểm thử chờ duyệt: [${run.name}]`,
            message: `${user.email} đã hoàn thành kiểm thử và gửi yêu cầu rà soát đợt chạy "${run.name}".`,
            type: NotificationType.TEST_RUN_REVIEW_REQUESTED,
            link: `/projects/${projectId}/test-runs/${run.id}/runner`,
          });
        } catch (err) {
          console.error('Failed to notify QA Lead', err);
        }
      }
    }

    return this.findOne(projectId, id, user);
  }

  async requestRework(projectId: string, id: string, reason: string, user: JwtPayload) {
    await this.assertCanManage(projectId, user);

    if (!reason || !reason.trim()) {
      throw new BadRequestException('Vui lòng cung cấp lý do cụ thể yêu cầu làm lại');
    }

    const run = await this.prisma.testRun.findFirst({
      where: { id, projectId },
      include: { project: { select: { name: true } } },
    });

    if (!run) {
      throw new NotFoundException('Đợt kiểm thử không tồn tại trong dự án');
    }

    if (run.status !== TestRunStatus.IN_REVIEW) {
      throw new BadRequestException('Chỉ có thể yêu cầu làm lại khi đợt kiểm thử đang ở trạng thái Chờ QA duyệt (IN_REVIEW)');
    }

    await this.prisma.testRun.update({
      where: { id },
      data: {
        status: TestRunStatus.IN_PROGRESS,
        reworkReason: reason.trim(),
      },
    });

    // Notify assignee and creator safely
    const recipients = new Set<string>();
    if (run.assignedToId && run.assignedToId !== user.sub) recipients.add(run.assignedToId);
    if (run.createdById && run.createdById !== user.sub) recipients.add(run.createdById);

    for (const rId of recipients) {
      try {
        await this.notificationsService.create({
          userId: rId,
          projectId,
          title: `Yêu cầu làm lại đợt kiểm thử: [${run.name}]`,
          message: `QA Lead yêu cầu làm lại với lý do: "${reason.trim()}".`,
          type: NotificationType.TEST_RUN_REWORK_REQUESTED,
          link: `/projects/${projectId}/test-runs/${run.id}/runner`,
        });
      } catch (err) {
        console.error('Failed to notify rework recipient', err);
      }
    }

    return this.findOne(projectId, id, user);
  }

  async approveAndClose(projectId: string, id: string, user: JwtPayload) {
    await this.assertCanManage(projectId, user);

    const run = await this.prisma.testRun.findFirst({
      where: { id, projectId },
      include: {
        project: { select: { name: true } },
        executions: {
          select: {
            id: true,
            status: true,
            testCaseCode: true,
            bugs: { select: { id: true } },
          },
        },
      },
    });

    if (!run) {
      throw new NotFoundException('Đợt kiểm thử không tồn tại trong dự án');
    }

    if (run.status !== TestRunStatus.IN_REVIEW) {
      throw new BadRequestException(
        'Đợt kiểm thử phải được gửi duyệt (trạng thái IN_REVIEW) trước khi QA Lead phê duyệt và chốt.',
      );
    }

    const untested = run.executions.filter((e) => e.status === TestExecutionStatus.UNTESTED);
    if (untested.length > 0) {
      throw new BadRequestException(
        `Không thể chốt đợt kiểm thử: Còn ${untested.length} ca kiểm thử chưa thực hiện (UNTESTED).`,
      );
    }

    const failedWithoutBug = run.executions.filter(
      (e) => e.status === TestExecutionStatus.FAILED && (!e.bugs || e.bugs.length === 0),
    );
    if (failedWithoutBug.length > 0) {
      throw new BadRequestException(
        `Không thể chốt đợt kiểm thử: Có ${failedWithoutBug.length} ca kiểm thử bị THẤT BẠI (FAILED) nhưng chưa có Bug nào được liên kết (${failedWithoutBug.map((e) => e.testCaseCode).join(', ')}). Vui lòng yêu cầu bổ sung Bug trước khi chốt.`,
      );
    }

    await this.prisma.testRun.update({
      where: { id },
      data: {
        status: TestRunStatus.COMPLETED,
        completedAt: new Date(),
        reworkReason: null,
      },
    });

    // Notify assignee and creator safely
    const recipients = new Set<string>();
    if (run.assignedToId && run.assignedToId !== user.sub) recipients.add(run.assignedToId);
    if (run.createdById && run.createdById !== user.sub) recipients.add(run.createdById);

    for (const rId of recipients) {
      try {
        await this.notificationsService.create({
          userId: rId,
          projectId,
          title: `Đợt kiểm thử đã hoàn thành: [${run.name}]`,
          message: `QA Lead đã rà soát và chính thức chốt đợt kiểm thử "${run.name}". Toàn bộ kết quả đã được khóa chỉ đọc.`,
          type: NotificationType.TEST_RUN_COMPLETED,
          link: `/projects/${projectId}/test-runs/${run.id}/runner`,
        });
      } catch (err) {
        console.error('Failed to notify complete recipient', err);
      }
    }

    return this.findOne(projectId, id, user);
  }

  async createRetest(projectId: string, id: string, user: JwtPayload) {
    await this.assertCanWrite(projectId, user);

    const originalRun = await this.prisma.testRun.findFirst({
      where: { id, projectId },
      include: {
        project: { select: { name: true } },
        executions: {
          where: {
            status: { in: [TestExecutionStatus.FAILED, TestExecutionStatus.BLOCKED] },
          },
        },
      },
    });

    if (!originalRun) {
      throw new NotFoundException('Không tìm thấy đợt kiểm thử gốc');
    }

    if (!originalRun.executions.length) {
      throw new BadRequestException(
        'Đợt kiểm thử này không có ca test nào bị Thất bại (FAIL) hoặc Bị chặn (BLOCKED) để chạy lại.',
      );
    }

    const retestRun = await this.prisma.$transaction(async (tx) => {
      const newRun = await tx.testRun.create({
        data: {
          projectId,
          parentRunId: originalRun.id,
          name: `[Retest] ${originalRun.name}`,
          description: `Đợt chạy lại (Retest) cho ${originalRun.executions.length} ca kiểm thử FAILED/BLOCKED từ đợt: "${originalRun.name}"`,
          createdById: user.sub,
          assignedToId: originalRun.assignedToId || user.sub,
          status: TestRunStatus.OPEN,
        },
      });

      const executionData = originalRun.executions.map((e) => ({
        testRunId: newRun.id,
        testCaseId: e.testCaseId,
        testCaseCode: e.testCaseCode,
        testCaseTitle: e.testCaseTitle,
        testCasePreconditions: e.testCasePreconditions,
        testCaseSteps: e.testCaseSteps as any,
        testCasePriority: e.testCasePriority,
        testCaseVersion: e.testCaseVersion,
        status: TestExecutionStatus.UNTESTED,
      }));

      await tx.testExecution.createMany({
        data: executionData,
      });

      return newRun;
    });

    // Notify assignee safely
    if (retestRun.assignedToId && retestRun.assignedToId !== user.sub) {
      try {
        await this.notificationsService.create({
          userId: retestRun.assignedToId,
          projectId,
          title: 'Bạn được gán đợt Retest mới',
          message: `Bạn được giao thực thi đợt chạy lại "${retestRun.name}" gồm ${originalRun.executions.length} ca test.`,
          type: NotificationType.TEST_RUN_ASSIGNED,
          link: `/projects/${projectId}/test-runs/${retestRun.id}/runner`,
        });
      } catch (err) {
        console.error('Failed to notify retest recipient', err);
      }
    }

    return this.findOne(projectId, retestRun.id, user);
  }
}
