import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateExecutionDto } from './dto/update-execution.dto.js';
import { JwtPayload } from '../auth/strategies/jwt.strategy.js';
import { ProjectRole, SystemRole, TestRunStatus, TestExecutionStatus } from '@prisma/client';

@Injectable()
export class TestExecutionsService {
  constructor(private prisma: PrismaService) {}

  private async assertCanExecute(projectId: string, runId: string, user: JwtPayload) {
    if (user.systemRole === SystemRole.ADMIN) return;

    const member = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId: user.sub },
      },
    });

    if (!member) {
      throw new ForbiddenException('Bạn không phải thành viên của dự án này');
    }

    // Check if user is explicitly assigned to this test run or created it
    const testRun = await this.prisma.testRun.findUnique({
      where: { id: runId },
      select: { assignedToId: true, createdById: true },
    });

    const isAssignedOrCreator =
      testRun && (testRun.assignedToId === user.sub || testRun.createdById === user.sub);

    // If assigned to this run, they are authorized to execute regardless of general role
    if (isAssignedOrCreator) return;

    if (
      member.role !== ProjectRole.QA_LEAD &&
      member.role !== ProjectRole.TESTER &&
      member.role !== ProjectRole.DEVELOPER
    ) {
      throw new ForbiddenException('Chỉ người được giao đợt kiểm thử, QA Lead, Tester hoặc Developer mới có quyền thực thi ca kiểm thử');
    }
  }

  async update(
    projectId: string,
    runId: string,
    executionId: string,
    dto: UpdateExecutionDto,
    user: JwtPayload,
  ) {
    await this.assertCanExecute(projectId, runId, user);

    const execution = await this.prisma.testExecution.findFirst({
      where: {
        id: executionId,
        testRunId: runId,
        testRun: { projectId },
      },
      include: {
        testRun: { select: { id: true, status: true, startedAt: true } },
      },
    });

    if (!execution) {
      throw new NotFoundException('Bản ghi thực thi kiểm thử không tồn tại trong đợt chạy này');
    }

    // If run is completed, only QA Lead / Admin can adjust results
    if (execution.testRun.status === TestRunStatus.COMPLETED) {
      const isQAOrAdmin =
        user.systemRole === SystemRole.ADMIN ||
        (await this.prisma.projectMember.findUnique({
          where: { projectId_userId: { projectId, userId: user.sub } },
        }))?.role === ProjectRole.QA_LEAD;

      if (!isQAOrAdmin) {
        throw new BadRequestException('Đợt kiểm thử này đã đóng (COMPLETED), không thể cập nhật kết quả');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Update the execution record
      const updated = await tx.testExecution.update({
        where: { id: executionId },
        data: {
          status: dto.status,
          actualResult: dto.actualResult?.trim(),
          stepResults: dto.stepResults !== undefined ? dto.stepResults : undefined,
          attachments: dto.attachments ?? undefined,
          executionDurationMs: dto.executionDurationMs,
          executedById: user.sub,
          executedAt: new Date(),
        },
        include: {
          executedBy: { select: { id: true, fullName: true, email: true } },
          bugs: {
            select: { id: true, code: true, title: true, severity: true, status: true },
          },
        },
      });

      // 2. If parent TestRun was OPEN, auto transition to IN_PROGRESS
      if (execution.testRun.status === TestRunStatus.OPEN) {
        await tx.testRun.update({
          where: { id: runId },
          data: {
            status: TestRunStatus.IN_PROGRESS,
            startedAt: execution.testRun.startedAt || new Date(),
          },
        });
      }

      return updated;
    });
  }
}
