import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { CreateBugDto } from './dto/create-bug.dto.js';
import { UpdateBugDto } from './dto/update-bug.dto.js';
import { QueryBugDto } from './dto/query-bug.dto.js';
import { JwtPayload } from '../auth/strategies/jwt.strategy.js';
import { ProjectRole, SystemRole, BugStatus, BugSeverity, NotificationType, Prisma } from '@prisma/client';

@Injectable()
export class BugsService {
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
      throw new ForbiddenException('Bạn không có quyền tạo hoặc chỉnh sửa lỗi trong dự án này');
    }
  }

  // ─── CODE GENERATION HELPER ──────────────────────────────────────────────────

  private async generateNextBugCode(tx: Prisma.TransactionClient, projectId: string): Promise<string> {
    const updated = await tx.project.update({
      where: { id: projectId },
      data: { bugSeq: { increment: 1 } },
      select: { bugSeq: true },
    });

    return `BUG-${updated.bugSeq}`;
  }

  // ─── CREATE ──────────────────────────────────────────────────────────────────

  async create(projectId: string, dto: CreateBugDto, user: JwtPayload) {
    await this.assertCanWrite(projectId, user);

    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Không tìm thấy dự án');

    // Reject creating bug with terminal/verified status immediately
    if (
      dto.status &&
      dto.status !== BugStatus.OPEN &&
      dto.status !== BugStatus.IN_PROGRESS
    ) {
      throw new BadRequestException('Lỗi mới tạo chỉ có thể bắt đầu ở trạng thái MỞ (OPEN) hoặc ĐANG XỬ LÝ (IN_PROGRESS)');
    }

    // Validate assignee is a project member
    if (dto.assigneeId) {
      const member = await this.prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId: dto.assigneeId } },
      });
      if (!member) {
        throw new BadRequestException('Người được giao xử lý không phải là thành viên của dự án này');
      }
    }

    let resolvedTestCaseId = dto.testCaseId;

    if (dto.testExecutionId) {
      const execution = await this.prisma.testExecution.findFirst({
        where: { id: dto.testExecutionId, testRun: { projectId } },
        include: { testRun: { select: { id: true, status: true, name: true } } },
      });
      if (!execution) {
        throw new BadRequestException('Lượt thực thi kiểm thử không thuộc dự án này');
      }
      if (execution.testRun.status === 'COMPLETED') {
        throw new ForbiddenException('Đợt kiểm thử đã hoàn thành (COMPLETED) và khóa chỉ đọc, không thể liên kết thêm lỗi');
      }
      if (!resolvedTestCaseId && execution.testCaseId) {
        resolvedTestCaseId = execution.testCaseId;
      }
    }

    if (resolvedTestCaseId) {
      const tc = await this.prisma.testCase.findFirst({
        where: { id: resolvedTestCaseId, projectId },
      });
      if (!tc) {
        throw new BadRequestException('Test case không thuộc dự án này');
      }
    }

    const bug = await this.prisma.$transaction(async (tx) => {
      const code = await this.generateNextBugCode(tx, projectId);

      return tx.bug.create({
        data: {
          projectId,
          code,
          title: dto.title.trim(),
          description: dto.description.trim(),
          severity: dto.severity || BugSeverity.MEDIUM,
          status: dto.status || BugStatus.OPEN,
          assigneeId: dto.assigneeId || null,
          testExecutionId: dto.testExecutionId || null,
          testCaseId: resolvedTestCaseId || null,
          createdById: user.sub,
        },
        include: {
          createdBy: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
          assignee: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
          testCase: { select: { id: true, code: true, title: true } },
          testExecution: {
            select: {
              id: true,
              testRunId: true,
              status: true,
              testCaseCode: true,
              testCaseTitle: true,
              testRun: { select: { id: true, name: true } },
            },
          },
        },
      });
    });

    // Notify assignee if assigned to someone else (safe execution)
    if (bug.assigneeId && bug.assigneeId !== user.sub) {
      try {
        await this.notificationsService.create({
          userId: bug.assigneeId,
          projectId,
          title: `Bạn được giao xử lý lỗi mới [${bug.code}]`,
          message: `Bạn đã được giao xử lý lỗi: "${bug.title}" trong dự án ${project.name}.`,
          type: NotificationType.BUG_ASSIGNED,
          link: `/projects/${projectId}/bugs?bugId=${bug.id}`,
        });
      } catch (err) {
        console.error('Failed to send notification for bug assignment', err);
      }
    }

    return bug;
  }

  // ─── FIND ALL WITH FILTERS & PAGINATION ───────────────────────────────────────

  async findAll(projectId: string, user: JwtPayload, query: QueryBugDto) {
    await this.assertProjectMember(projectId, user);

    const { search, status, severity, assigneeId, testCaseId, testExecutionId, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.BugWhereInput = {
      projectId,
      ...(status && { status }),
      ...(severity && { severity }),
      ...(assigneeId && { assigneeId }),
      ...(testCaseId && { testCaseId }),
      ...(testExecutionId && { testExecutionId }),
      ...(search && {
        OR: [
          { code: { contains: search, mode: 'insensitive' } },
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [total, data] = await Promise.all([
      this.prisma.bug.count({ where }),
      this.prisma.bug.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        include: {
          createdBy: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
          assignee: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
          testCase: { select: { id: true, code: true, title: true } },
          testExecution: {
            select: {
              id: true,
              testRunId: true,
              status: true,
              testCaseCode: true,
              testCaseTitle: true,
              testRun: { select: { id: true, name: true } },
            },
          },
        },
      }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── FIND ONE ────────────────────────────────────────────────────────────────

  async findOne(projectId: string, id: string, user: JwtPayload) {
    await this.assertProjectMember(projectId, user);

    const bug = await this.prisma.bug.findFirst({
      where: { id, projectId },
      include: {
        createdBy: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
        assignee: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
        testCase: { select: { id: true, code: true, title: true, priority: true } },
        testExecution: {
          select: {
            id: true,
            testRunId: true,
            status: true,
            actualResult: true,
            stepResults: true,
            testCaseCode: true,
            testCaseTitle: true,
            testRun: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!bug) throw new NotFoundException('Không tìm thấy thông tin lỗi');
    return bug;
  }

  // ─── UPDATE ──────────────────────────────────────────────────────────────────

  async update(projectId: string, id: string, dto: UpdateBugDto, user: JwtPayload) {
    await this.assertCanWrite(projectId, user);

    const existing = await this.prisma.bug.findFirst({
      where: { id, projectId },
      include: { project: { select: { name: true } } },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy thông tin lỗi');

    // Validate assignee is a project member if provided
    if (dto.assigneeId) {
      const member = await this.prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId: dto.assigneeId } },
      });
      if (!member) {
        throw new BadRequestException('Người được giao xử lý không phải là thành viên của dự án này');
      }
    }

    const updateData: Prisma.BugUpdateInput = {};

    if (dto.title !== undefined) updateData.title = dto.title.trim();
    if (dto.description !== undefined) updateData.description = dto.description.trim();
    if (dto.severity !== undefined) updateData.severity = dto.severity;
    if (dto.assigneeId !== undefined) {
      updateData.assignee = dto.assigneeId ? { connect: { id: dto.assigneeId } } : { disconnect: true };
    }

    if (dto.status !== undefined && dto.status !== existing.status) {
      const role = await this.assertProjectMember(projectId, user);
      const isTesterOrQALead =
        user.systemRole === SystemRole.ADMIN ||
        role === ProjectRole.QA_LEAD ||
        role === ProjectRole.TESTER;

      // Developer cannot arbitrarily close/verify bugs without QA/Tester re-testing
      if ((dto.status === BugStatus.VERIFIED || dto.status === BugStatus.CLOSED) && !isTesterOrQALead) {
        throw new ForbiddenException(
          'Chỉ Tester hoặc QA Lead mới có quyền xác minh (VERIFIED) hoặc đóng (CLOSED) lỗi sau khi Developer sửa xong',
        );
      }

      if (dto.status === BugStatus.REOPENED && !isTesterOrQALead) {
        throw new ForbiddenException(
          'Chỉ Tester hoặc QA Lead mới có quyền mở lại (REOPENED) lỗi khi ca kiểm thử thất bại',
        );
      }

      updateData.status = dto.status;
      if (dto.status === BugStatus.RESOLVED) {
        updateData.resolvedAt = new Date();
      } else if (dto.status === BugStatus.CLOSED || dto.status === BugStatus.VERIFIED) {
        updateData.closedAt = new Date();
      } else if (
        dto.status === BugStatus.OPEN ||
        dto.status === BugStatus.IN_PROGRESS ||
        dto.status === BugStatus.REOPENED
      ) {
        updateData.resolvedAt = null;
        updateData.closedAt = null;
      }
    }

    const updated = await this.prisma.bug.update({
      where: { id },
      data: updateData,
      include: {
        createdBy: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
        assignee: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
        testCase: { select: { id: true, code: true, title: true } },
        testExecution: {
          select: {
            id: true,
            testRunId: true,
            status: true,
            testCaseCode: true,
            testCaseTitle: true,
            testRun: { select: { id: true, name: true } },
          },
        },
      },
    });

    // Notify new assignee if changed (safely)
    if (dto.assigneeId && dto.assigneeId !== existing.assigneeId && dto.assigneeId !== user.sub) {
      try {
        await this.notificationsService.create({
          userId: dto.assigneeId,
          projectId,
          title: `Bạn được giao xử lý lỗi [${updated.code}]`,
          message: `Bạn đã được giao xử lý lỗi "${updated.title}".`,
          type: NotificationType.BUG_ASSIGNED,
          link: `/projects/${projectId}/bugs?bugId=${updated.id}`,
        });
      } catch (err) {
        console.error('Failed to send bug assignment notification', err);
      }
    }

    // Notify creator & assignee if status changed (safely)
    if (dto.status && dto.status !== existing.status) {
      const recipients = new Set<string>();
      if (updated.assigneeId && updated.assigneeId !== user.sub) recipients.add(updated.assigneeId);
      if (updated.createdById && updated.createdById !== user.sub) recipients.add(updated.createdById);

      for (const recId of recipients) {
        try {
          await this.notificationsService.create({
            userId: recId,
            projectId,
            title: `Lỗi [${updated.code}] đã cập nhật trạng thái sang ${updated.status}`,
            message: `${user.email} đã cập nhật trạng thái lỗi "${updated.title}" sang ${updated.status}.`,
            type: NotificationType.BUG_STATUS_CHANGED,
            link: `/projects/${projectId}/bugs?bugId=${updated.id}`,
          });
        } catch (err) {
          console.error('Failed to send bug status change notification', err);
        }
      }
    }

    return updated;
  }

  // ─── DELETE ──────────────────────────────────────────────────────────────────

  async remove(projectId: string, id: string, user: JwtPayload) {
    const role = await this.assertProjectMember(projectId, user);
    if (user.systemRole !== SystemRole.ADMIN && role !== ProjectRole.QA_LEAD) {
      throw new ForbiddenException('Chỉ QA Lead hoặc Admin mới có quyền xóa lỗi');
    }

    const existing = await this.prisma.bug.findFirst({ where: { id, projectId } });
    if (!existing) throw new NotFoundException('Không tìm thấy thông tin lỗi');

    await this.prisma.bug.delete({ where: { id } });
    return { success: true, message: 'Đã xóa lỗi thành công' };
  }

  // ─── STATISTICAL SUMMARY ─────────────────────────────────────────────────────

  async getSummary(projectId: string, user: JwtPayload) {
    await this.assertProjectMember(projectId, user);

    const [statusCounts, severityCounts, total] = await Promise.all([
      this.prisma.bug.groupBy({
        by: ['status'],
        where: { projectId },
        _count: { id: true },
      }),
      this.prisma.bug.groupBy({
        by: ['severity'],
        where: { projectId },
        _count: { id: true },
      }),
      this.prisma.bug.count({ where: { projectId } }),
    ]);

    const byStatus: Record<BugStatus, number> = {
      OPEN: 0,
      IN_PROGRESS: 0,
      RESOLVED: 0,
      VERIFIED: 0,
      CLOSED: 0,
      REOPENED: 0,
    };
    statusCounts.forEach((s) => {
      byStatus[s.status] = s._count.id;
    });

    const bySeverity = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    };
    severityCounts.forEach((s) => {
      bySeverity[s.severity] = s._count.id;
    });

    return {
      total,
      byStatus,
      bySeverity,
      activeBugs: byStatus.OPEN + byStatus.IN_PROGRESS + byStatus.REOPENED,
      resolvedRate:
        total > 0
          ? Math.round(((byStatus.RESOLVED + byStatus.VERIFIED + byStatus.CLOSED) / total) * 100)
          : 100,
    };
  }
}
