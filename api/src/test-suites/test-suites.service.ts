import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateTestSuiteDto } from './dto/create-test-suite.dto.js';
import { UpdateTestSuiteDto } from './dto/update-test-suite.dto.js';
import { JwtPayload } from '../auth/strategies/jwt.strategy.js';
import { ProjectRole, SystemRole } from '@prisma/client';

export interface TestSuiteTreeNode {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  parentId: string | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  testCaseCount: number;
  totalCaseCount: number; // test cases in this suite + all descendant suites
  children: TestSuiteTreeNode[];
}

@Injectable()
export class TestSuitesService {
  constructor(private prisma: PrismaService) {}

  // ─── PERMISSION HELPERS ─────────────────────────────────────────────────────

  private async getMemberRole(projectId: string, userId: string): Promise<ProjectRole | null> {
    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    return member?.role ?? null;
  }

  async assertProjectMember(projectId: string, user: JwtPayload): Promise<ProjectRole | 'ADMIN'> {
    if (user.systemRole === SystemRole.ADMIN) return 'ADMIN';
    const role = await this.getMemberRole(projectId, user.sub);
    if (!role) {
      throw new ForbiddenException('Bạn không phải là thành viên của dự án này');
    }
    return role;
  }

  async assertCanWrite(projectId: string, user: JwtPayload) {
    if (user.systemRole === SystemRole.ADMIN) return;
    const role = await this.assertProjectMember(projectId, user);
    if (role !== ProjectRole.QA_LEAD && role !== ProjectRole.TESTER) {
      throw new ForbiddenException('Bạn không có quyền thêm hoặc chỉnh sửa Test Suite trong dự án này');
    }
  }

  async assertCanManage(projectId: string, user: JwtPayload) {
    if (user.systemRole === SystemRole.ADMIN) return;
    const role = await this.assertProjectMember(projectId, user);
    if (role !== ProjectRole.QA_LEAD) {
      throw new ForbiddenException('Chỉ QA Lead mới có quyền quản lý và xóa Test Suite');
    }
  }

  // ─── CRUD OPERATIONS ────────────────────────────────────────────────────────

  async create(projectId: string, dto: CreateTestSuiteDto, user: JwtPayload) {
    await this.assertCanWrite(projectId, user);

    if (dto.parentId) {
      const parent = await this.prisma.testSuite.findFirst({
        where: { id: dto.parentId, projectId },
      });
      if (!parent) {
        throw new NotFoundException('Test Suite cha không tồn tại trong dự án này');
      }
    }

    return this.prisma.testSuite.create({
      data: {
        projectId,
        name: dto.name.trim(),
        description: dto.description?.trim(),
        parentId: dto.parentId || null,
        order: dto.order ?? 0,
      },
      include: {
        _count: { select: { testCases: true } },
      },
    });
  }

  async findAll(projectId: string, user: JwtPayload): Promise<TestSuiteTreeNode[]> {
    await this.assertProjectMember(projectId, user);

    const suites = await this.prisma.testSuite.findMany({
      where: { projectId },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      include: {
        _count: { select: { testCases: true } },
      },
    });

    // Xây dựng cây phân cấp Test Suite
    const nodeMap = new Map<string, TestSuiteTreeNode>();
    suites.forEach((s) => {
      nodeMap.set(s.id, {
        id: s.id,
        projectId: s.projectId,
        name: s.name,
        description: s.description,
        parentId: s.parentId,
        order: s.order,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        testCaseCount: s._count.testCases,
        totalCaseCount: s._count.testCases,
        children: [],
      });
    });

    const rootNodes: TestSuiteTreeNode[] = [];
    nodeMap.forEach((node) => {
      if (node.parentId && nodeMap.has(node.parentId)) {
        nodeMap.get(node.parentId)!.children.push(node);
      } else {
        rootNodes.push(node);
      }
    });

    // Tính tổng số test case bao gồm cả suite con đệ quy
    const calculateTotals = (node: TestSuiteTreeNode): number => {
      let sum = node.testCaseCount;
      for (const child of node.children) {
        sum += calculateTotals(child);
      }
      node.totalCaseCount = sum;
      return sum;
    };

    rootNodes.forEach((root) => calculateTotals(root));

    return rootNodes;
  }

  async findOne(projectId: string, id: string, user: JwtPayload) {
    await this.assertProjectMember(projectId, user);

    const suite = await this.prisma.testSuite.findFirst({
      where: { id, projectId },
      include: {
        parent: { select: { id: true, name: true } },
        children: {
          orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
          include: { _count: { select: { testCases: true } } },
        },
        _count: { select: { testCases: true } },
      },
    });

    if (!suite) {
      throw new NotFoundException('Test Suite không tồn tại trong dự án này');
    }

    return suite;
  }

  async update(projectId: string, id: string, dto: UpdateTestSuiteDto, user: JwtPayload) {
    await this.assertCanWrite(projectId, user);

    const existing = await this.prisma.testSuite.findFirst({
      where: { id, projectId },
    });

    if (!existing) {
      throw new NotFoundException('Test Suite không tồn tại trong dự án');
    }

    // Kiểm tra không cho phép chọn chính mình hoặc con cháu làm parentId (tránh vòng lặp)
    if (dto.parentId !== undefined) {
      if (dto.parentId === id) {
        throw new BadRequestException('Không thể đặt chính Suite này làm Suite cha');
      }

      if (dto.parentId !== null) {
        const parent = await this.prisma.testSuite.findFirst({
          where: { id: dto.parentId, projectId },
        });
        if (!parent) {
          throw new NotFoundException('Suite cha không tồn tại');
        }

        // Kiểm tra xem parent có phải là con cháu của node hiện tại không
        let currentParentId: string | null = parent.parentId;
        while (currentParentId) {
          if (currentParentId === id) {
            throw new BadRequestException('Không thể chọn Suite con cháu làm Suite cha');
          }
          const p = await this.prisma.testSuite.findUnique({
            where: { id: currentParentId },
            select: { parentId: true },
          });
          currentParentId = p?.parentId ?? null;
        }
      }
    }

    return this.prisma.testSuite.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.description !== undefined && { description: dto.description?.trim() }),
        ...(dto.parentId !== undefined && { parentId: dto.parentId || null }),
        ...(dto.order !== undefined && { order: dto.order }),
      },
      include: {
        _count: { select: { testCases: true } },
      },
    });
  }

  async remove(projectId: string, id: string, user: JwtPayload) {
    await this.assertCanManage(projectId, user);

    const existing = await this.prisma.testSuite.findFirst({
      where: { id, projectId },
    });

    if (!existing) {
      throw new NotFoundException('Test Suite không tồn tại trong dự án');
    }

    await this.prisma.testSuite.delete({ where: { id } });

    return { message: 'Đã xóa Test Suite thành công' };
  }
}
