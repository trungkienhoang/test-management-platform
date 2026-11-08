import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto.js';
import { AddMemberDto, UpdateMemberRoleDto } from './dto/member.dto.js';
import { JwtPayload } from '../auth/strategies/jwt.strategy.js';
import { ProjectRole, SystemRole } from '@prisma/client';

const PROJECT_SELECT = {
  id: true,
  name: true,
  description: true,
  status: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, fullName: true, email: true } },
  _count: { select: { members: true } },
} as const;

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  // ─── HELPERS ────────────────────────────────────────────────────────────────

  /** Lấy role của user trong project. null = không phải thành viên. */
  async getMemberRole(projectId: string, userId: string): Promise<ProjectRole | null> {
    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    return member?.role ?? null;
  }

  private async assertProjectExists(id: string) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException('Dự án không tồn tại');
    return project;
  }

  private async assertCanManage(projectId: string, user: JwtPayload) {
    if (user.systemRole === SystemRole.ADMIN) return;
    const role = await this.getMemberRole(projectId, user.sub);
    if (!role) throw new ForbiddenException('Bạn không phải thành viên của dự án này');
    if (role !== ProjectRole.QA_LEAD) throw new ForbiddenException('Chỉ QA Lead mới có thể thực hiện thao tác này');
  }

  // ─── PROJECTS CRUD ───────────────────────────────────────────────────────────

  async create(dto: CreateProjectDto, user: JwtPayload) {
    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: { ...dto, createdById: user.sub },
        select: PROJECT_SELECT,
      });
      // Creator becomes QA_LEAD automatically
      await tx.projectMember.create({
        data: { projectId: project.id, userId: user.sub, role: ProjectRole.QA_LEAD },
      });
      return project;
    });
  }

  async findAll(user: JwtPayload, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    // Admin sees all; others see only their projects
    const where = user.systemRole === SystemRole.ADMIN
      ? {}
      : { members: { some: { userId: user.sub } } };

    const [projects, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({ where, skip, take: limit, select: PROJECT_SELECT, orderBy: { createdAt: 'desc' } }),
      this.prisma.project.count({ where }),
    ]);

    return { data: projects, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, user: JwtPayload) {
    await this.assertProjectExists(id);

    if (user.systemRole !== SystemRole.ADMIN) {
      const role = await this.getMemberRole(id, user.sub);
      if (!role) throw new ForbiddenException('Bạn không có quyền xem dự án này');
    }

    return this.prisma.project.findUnique({ where: { id }, select: PROJECT_SELECT });
  }

  async update(id: string, dto: UpdateProjectDto, user: JwtPayload) {
    await this.assertProjectExists(id);
    await this.assertCanManage(id, user);
    return this.prisma.project.update({ where: { id }, data: dto, select: PROJECT_SELECT });
  }

  async remove(id: string, user: JwtPayload) {
    await this.assertProjectExists(id);
    // Chỉ Admin hoặc creator mới xóa được project
    if (user.systemRole !== SystemRole.ADMIN) {
      const project = await this.prisma.project.findUniqueOrThrow({ where: { id } });
      if (project.createdById !== user.sub) throw new ForbiddenException('Chỉ người tạo dự án mới có thể xóa');
    }
    await this.prisma.project.delete({ where: { id } });
  }

  // ─── MEMBERS ────────────────────────────────────────────────────────────────

  async getMembers(projectId: string, user: JwtPayload) {
    await this.assertProjectExists(projectId);

    if (user.systemRole !== SystemRole.ADMIN) {
      const role = await this.getMemberRole(projectId, user.sub);
      if (!role) throw new ForbiddenException('Bạn không phải thành viên của dự án này');
    }

    return this.prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { id: true, fullName: true, email: true, avatarUrl: true } } },
      orderBy: { joinedAt: 'asc' },
    });
  }

  async addMember(projectId: string, dto: AddMemberDto, user: JwtPayload) {
    await this.assertProjectExists(projectId);
    await this.assertCanManage(projectId, user);

    const target = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!target) throw new NotFoundException('Người dùng không tồn tại');

    const existing = await this.getMemberRole(projectId, dto.userId);
    if (existing) throw new ConflictException('Người dùng đã là thành viên của dự án');

    return this.prisma.projectMember.create({
      data: { projectId, userId: dto.userId, role: dto.role },
      include: { user: { select: { id: true, fullName: true, email: true } } },
    });
  }

  async updateMemberRole(projectId: string, userId: string, dto: UpdateMemberRoleDto, user: JwtPayload) {
    await this.assertProjectExists(projectId);
    await this.assertCanManage(projectId, user);

    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (!member) throw new NotFoundException('Thành viên không tồn tại trong dự án');

    return this.prisma.projectMember.update({
      where: { projectId_userId: { projectId, userId } },
      data: { role: dto.role },
      include: { user: { select: { id: true, fullName: true, email: true } } },
    });
  }

  async removeMember(projectId: string, userId: string, user: JwtPayload) {
    await this.assertProjectExists(projectId);
    await this.assertCanManage(projectId, user);

    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (!member) throw new NotFoundException('Thành viên không tồn tại trong dự án');

    // Không thể xóa chính mình nếu là QA Lead duy nhất
    const qaLeads = await this.prisma.projectMember.count({
      where: { projectId, role: ProjectRole.QA_LEAD },
    });
    if (member.role === ProjectRole.QA_LEAD && qaLeads === 1) {
      throw new ForbiddenException('Dự án phải có ít nhất 1 QA Lead');
    }

    await this.prisma.projectMember.delete({
      where: { projectId_userId: { projectId, userId } },
    });
  }
}
