import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateTestCaseDto } from './dto/create-test-case.dto.js';
import { UpdateTestCaseDto } from './dto/update-test-case.dto.js';
import { QueryTestCaseDto } from './dto/query-test-case.dto.js';
import { JwtPayload } from '../auth/strategies/jwt.strategy.js';
import { ProjectRole, SystemRole, TestCasePriority, TestCaseStatus } from '@prisma/client';
import * as XLSX from 'xlsx';

@Injectable()
export class TestCasesService {
  constructor(private prisma: PrismaService) {}

  // ─── PERMISSIONS ────────────────────────────────────────────────────────────

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
      throw new ForbiddenException('Bạn không có quyền tạo hoặc chỉnh sửa Test Case trong dự án này');
    }
  }

  async assertCanManage(projectId: string, user: JwtPayload) {
    if (user.systemRole === SystemRole.ADMIN) return;
    const role = await this.assertProjectMember(projectId, user);
    if (role !== ProjectRole.QA_LEAD) {
      throw new ForbiddenException('Chỉ QA Lead hoặc Admin mới có quyền xóa Test Case');
    }
  }

  // ─── CODE GENERATION ────────────────────────────────────────────────────────

  private async generateNextCode(tx: any, projectId: string): Promise<string> {
    const updated = await tx.project.update({
      where: { id: projectId },
      data: { testCaseSeq: { increment: 1 } },
      select: { testCaseSeq: true },
    });

    return `TC-${updated.testCaseSeq}`;
  }

  // ─── CRUD ───────────────────────────────────────────────────────────────────

  async create(projectId: string, dto: CreateTestCaseDto, user: JwtPayload) {
    await this.assertCanWrite(projectId, user);

    if (dto.suiteId) {
      const suite = await this.prisma.testSuite.findFirst({
        where: { id: dto.suiteId, projectId },
      });
      if (!suite) {
        throw new NotFoundException('Test Suite không tồn tại trong dự án này');
      }
    }

    const stepsJson = (dto.steps || []) as any;

    return this.prisma.$transaction(async (tx) => {
      const code = await this.generateNextCode(tx, projectId);
      const testCase = await tx.testCase.create({
        data: {
          projectId,
          suiteId: dto.suiteId || null,
          code,
          title: dto.title.trim(),
          description: dto.description?.trim(),
          preconditions: dto.preconditions?.trim(),
          steps: stepsJson,
          priority: dto.priority ?? TestCasePriority.MEDIUM,
          status: dto.status ?? TestCaseStatus.DRAFT,
          tags: dto.tags || [],
          order: dto.order ?? 0,
          version: 1,
          createdById: user.sub,
        },
        include: {
          suite: { select: { id: true, name: true } },
          createdBy: { select: { id: true, fullName: true, email: true } },
        },
      });

      // Tạo bản ghi lịch sử phiên bản đầu tiên (v1)
      await tx.testCaseHistory.create({
        data: {
          testCaseId: testCase.id,
          version: 1,
          title: testCase.title,
          description: testCase.description,
          preconditions: testCase.preconditions,
          steps: stepsJson,
          priority: testCase.priority,
          status: testCase.status,
          tags: (testCase.tags as any) ?? [],
          changedById: user.sub,
          changeReason: 'Khởi tạo Test Case',
        },
      });

      return testCase;
    });
  }

  async findAll(projectId: string, query: QueryTestCaseDto, user: JwtPayload) {
    await this.assertProjectMember(projectId, user);

    const {
      search,
      suiteId,
      priority,
      status,
      tag,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const where: any = { projectId };

    if (suiteId) {
      if (suiteId === 'none') {
        where.suiteId = null;
      } else {
        where.suiteId = suiteId;
      }
    }

    if (priority) {
      where.priority = priority;
    }

    if (status) {
      where.status = status;
    }

    if (tag) {
      where.tags = { array_contains: tag.trim() };
    }

    if (search && search.trim()) {
      const term = search.trim();
      where.OR = [
        { title: { contains: term } },
        { description: { contains: term } },
        { code: { contains: term } },
      ];
    }

    const skip = (page - 1) * limit;

    const [total, data] = await Promise.all([
      this.prisma.testCase.count({ where }),
      this.prisma.testCase.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          suite: { select: { id: true, name: true } },
          createdBy: { select: { id: true, fullName: true, email: true } },
        },
      }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async findOne(projectId: string, id: string, user: JwtPayload) {
    await this.assertProjectMember(projectId, user);

    const testCase = await this.prisma.testCase.findFirst({
      where: { id, projectId },
      include: {
        suite: { select: { id: true, name: true } },
        createdBy: { select: { id: true, fullName: true, email: true } },
      },
    });

    if (!testCase) {
      throw new NotFoundException('Test Case không tồn tại trong dự án');
    }

    return testCase;
  }

  async update(projectId: string, id: string, dto: UpdateTestCaseDto, user: JwtPayload) {
    await this.assertCanWrite(projectId, user);

    const current = await this.prisma.testCase.findFirst({
      where: { id, projectId },
    });

    if (!current) {
      throw new NotFoundException('Test Case không tồn tại trong dự án');
    }

    if (dto.suiteId) {
      const suite = await this.prisma.testSuite.findFirst({
        where: { id: dto.suiteId, projectId },
      });
      if (!suite) {
        throw new NotFoundException('Test Suite không tồn tại trong dự án này');
      }
    }

    const nextVersion = current.version + 1;
    const stepsJson = (dto.steps !== undefined ? dto.steps : current.steps) as any;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.testCase.update({
        where: { id },
        data: {
          ...(dto.title !== undefined && { title: dto.title.trim() }),
          ...(dto.description !== undefined && { description: dto.description?.trim() }),
          ...(dto.preconditions !== undefined && { preconditions: dto.preconditions?.trim() }),
          ...(dto.steps !== undefined && { steps: stepsJson }),
          ...(dto.priority !== undefined && { priority: dto.priority }),
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.tags !== undefined && { tags: dto.tags }),
          ...(dto.suiteId !== undefined && { suiteId: dto.suiteId || null }),
          ...(dto.order !== undefined && { order: dto.order }),
          version: nextVersion,
        },
        include: {
          suite: { select: { id: true, name: true } },
          createdBy: { select: { id: true, fullName: true, email: true } },
        },
      });

      // Tự động lưu bản ghi snapshot phiên bản mới
      await tx.testCaseHistory.create({
        data: {
          testCaseId: id,
          version: nextVersion,
          title: updated.title,
          description: updated.description,
          preconditions: updated.preconditions,
          steps: updated.steps as any,
          priority: updated.priority,
          status: updated.status,
          tags: (updated.tags as any) ?? [],
          changedById: user.sub,
          changeReason: dto.changeReason?.trim() || `Cập nhật lên phiên bản ${nextVersion}`,
        },
      });

      return updated;
    });
  }

  async remove(projectId: string, id: string, user: JwtPayload) {
    await this.assertCanManage(projectId, user);

    const current = await this.prisma.testCase.findFirst({
      where: { id, projectId },
    });

    if (!current) {
      throw new NotFoundException('Test Case không tồn tại trong dự án');
    }

    await this.prisma.testCase.delete({ where: { id } });

    return { message: 'Đã xóa Test Case thành công' };
  }

  // ─── VERSION HISTORY & DIFF ─────────────────────────────────────────────────

  async findHistories(projectId: string, id: string, user: JwtPayload) {
    await this.assertProjectMember(projectId, user);

    const testCase = await this.prisma.testCase.findFirst({
      where: { id, projectId },
    });

    if (!testCase) {
      throw new NotFoundException('Test Case không tồn tại');
    }

    return this.prisma.testCaseHistory.findMany({
      where: { testCaseId: id },
      orderBy: { version: 'desc' },
      include: {
        changedBy: { select: { id: true, fullName: true, email: true } },
      },
    });
  }

  async findHistoryVersion(projectId: string, id: string, version: number, user: JwtPayload) {
    await this.assertProjectMember(projectId, user);

    const history = await this.prisma.testCaseHistory.findUnique({
      where: { testCaseId_version: { testCaseId: id, version } },
      include: {
        changedBy: { select: { id: true, fullName: true, email: true } },
      },
    });

    if (!history) {
      throw new NotFoundException(`Không tìm thấy phiên bản ${version} của Test Case này`);
    }

    return history;
  }

  // ─── EXPORT TO EXCEL / CSV ──────────────────────────────────────────────────

  async exportTestCases(projectId: string, format: 'xlsx' | 'csv', user: JwtPayload) {
    await this.assertProjectMember(projectId, user);

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true },
    });

    const cases = await this.prisma.testCase.findMany({
      where: { projectId },
      orderBy: [{ code: 'asc' }],
      include: {
        suite: { select: { name: true } },
      },
    });

    const rows = cases.map((tc) => {
      let formattedSteps = '';
      if (Array.isArray(tc.steps)) {
        formattedSteps = (tc.steps as any[])
          .map((s, idx) => `${idx + 1}. ${s.action || ''} -> Kỳ vọng: ${s.expectedResult || ''}`)
          .join('\n');
      }

      return {
        'Mã': tc.code,
        'Tiêu đề': tc.title,
        'Test Suite': tc.suite?.name || 'Chưa phân loại',
        'Độ ưu tiên': tc.priority,
        'Trạng thái': tc.status,
        'Tags': Array.isArray(tc.tags) ? (tc.tags as string[]).join(', ') : '',
        'Điều kiện tiên quyết': tc.preconditions || '',
        'Mô tả': tc.description || '',
        'Các bước thực hiện': formattedSteps,
        'Phiên bản': `v${tc.version}`,
        'Ngày tạo': tc.createdAt.toISOString().slice(0, 10),
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);

    // Đặt độ rộng cột mặc định
    ws['!cols'] = [
      { wch: 10 }, // Mã
      { wch: 35 }, // Tiêu đề
      { wch: 20 }, // Test Suite
      { wch: 14 }, // Độ ưu tiên
      { wch: 14 }, // Trạng thái
      { wch: 20 }, // Tags
      { wch: 30 }, // Điều kiện
      { wch: 30 }, // Mô tả
      { wch: 45 }, // Các bước
      { wch: 10 }, // Phiên bản
      { wch: 14 }, // Ngày tạo
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'TestCases');

    let buffer: Buffer = XLSX.write(wb, {
      type: 'buffer',
      bookType: format === 'csv' ? 'csv' : 'xlsx',
    });

    // Thêm UTF-8 BOM nếu là CSV để Microsoft Excel trên Windows hiển thị tiếng Việt chuẩn 100%
    if (format === 'csv') {
      const bom = Buffer.from([0xef, 0xbb, 0xbf]);
      buffer = Buffer.concat([bom, buffer]);
    }

    const safeName = (project?.name || 'project').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${safeName}_test_cases_${new Date().toISOString().slice(0, 10)}.${format}`;
    const contentType =
      format === 'csv'
        ? 'text/csv; charset=utf-8'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    return { buffer, filename, contentType };
  }

  // ─── IMPORT FROM EXCEL / CSV ────────────────────────────────────────────────

  async importTestCases(projectId: string, fileBuffer: Buffer, user: JwtPayload) {
    await this.assertCanWrite(projectId, user);

    let rows: any[];
    try {
      const wb = XLSX.read(fileBuffer, { type: 'buffer', codepage: 65001 });
      const firstSheet = wb.SheetNames[0];
      if (!firstSheet) {
        throw new BadRequestException('Tệp không có trang tính dữ liệu nào');
      }
      rows = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets[firstSheet]);
    } catch (err: any) {
      throw new BadRequestException(`Không thể đọc tệp Excel/CSV: ${err.message}`);
    }

    if (!rows || rows.length === 0) {
      throw new BadRequestException('Tệp không chứa dòng dữ liệu nào để nhập');
    }

    // Lấy danh sách các Suite đã có trong dự án
    const existingSuites = await this.prisma.testSuite.findMany({
      where: { projectId },
      select: { id: true, name: true },
    });
    const suiteNameMap = new Map<string, string>();
    existingSuites.forEach((s) => suiteNameMap.set(s.name.toLowerCase().trim(), s.id));

    let importedCount = 0;
    const errors: { row: number; reason: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2; // Dòng 1 là tiêu đề
      const row = rows[i];

      // Đọc tiêu đề test case từ các tên cột phổ biến
      const title = (
        row['Tiêu đề'] ||
        row['Title'] ||
        row['title'] ||
        row['Name'] ||
        row['name']
      )?.toString()?.trim();

      if (!title) {
        errors.push({ row: rowNum, reason: 'Thiếu trường Tiêu đề (Title)' });
        continue;
      }

      // Đọc Suite nếu có
      const suiteName = (
        row['Test Suite'] ||
        row['Suite'] ||
        row['suite'] ||
        row['Module']
      )?.toString()?.trim();

      let suiteId: string | null = null;
      if (suiteName && suiteName !== 'Chưa phân loại') {
        const key = suiteName.toLowerCase();
        if (suiteNameMap.has(key)) {
          suiteId = suiteNameMap.get(key)!;
        } else {
          // Tự động tạo Test Suite mới
          const newSuite = await this.prisma.testSuite.create({
            data: {
              projectId,
              name: suiteName,
            },
          });
          suiteId = newSuite.id;
          suiteNameMap.set(key, newSuite.id);
        }
      }

      // Đọc độ ưu tiên (Priority)
      const rawPriority = (row['Độ ưu tiên'] || row['Priority'] || row['priority'])?.toString()?.toUpperCase()?.trim();
      let priority: TestCasePriority = TestCasePriority.MEDIUM;
      if (rawPriority === 'LOW') priority = TestCasePriority.LOW;
      else if (rawPriority === 'HIGH') priority = TestCasePriority.HIGH;
      else if (rawPriority === 'CRITICAL') priority = TestCasePriority.CRITICAL;

      // Đọc trạng thái (Status)
      const rawStatus = (row['Trạng thái'] || row['Status'] || row['status'])?.toString()?.toUpperCase()?.trim();
      let status: TestCaseStatus = TestCaseStatus.DRAFT;
      if (rawStatus === 'READY') status = TestCaseStatus.READY;
      else if (rawStatus === 'DEPRECATED') status = TestCaseStatus.DEPRECATED;

      // Đọc tags
      const rawTags = (row['Tags'] || row['tags'])?.toString();
      const tags = rawTags
        ? rawTags.split(/[,;]/).map((t: string) => t.trim()).filter(Boolean)
        : [];

      // Đọc preconditions & description
      const preconditions = (row['Điều kiện tiên quyết'] || row['Preconditions'] || row['preconditions'])?.toString()?.trim();
      const description = (row['Mô tả'] || row['Description'] || row['description'])?.toString()?.trim();

      // Đọc các bước (Steps)
      const rawSteps = (row['Các bước thực hiện'] || row['Steps'] || row['steps'])?.toString();
      const steps: any[] = [];
      if (rawSteps) {
        const lines = rawSteps.split('\n').map((l: string) => l.trim()).filter(Boolean);
        lines.forEach((line: string, sIdx: number) => {
          const parts = line.split(/->|Kỳ vọng:|Expected:/i);
          steps.push({
            stepNumber: sIdx + 1,
            action: parts[0]?.replace(/^\d+[\.\)]\s*/, '')?.trim() || line,
            expectedResult: parts[1]?.trim() || 'Hệ thống phản hồi bình thường',
          });
        });
      }

      try {
        await this.prisma.$transaction(async (tx) => {
          const code = await this.generateNextCode(tx, projectId);
          const tc = await tx.testCase.create({
            data: {
              projectId,
              suiteId,
              code,
              title,
              description: description || null,
              preconditions: preconditions || null,
              steps,
              priority,
              status,
              tags,
              createdById: user.sub,
              version: 1,
            },
          });

          await tx.testCaseHistory.create({
            data: {
              testCaseId: tc.id,
              version: 1,
              title: tc.title,
              description: tc.description,
              preconditions: tc.preconditions,
              steps,
              priority: tc.priority,
              status: tc.status,
              tags: (tc.tags as any) ?? [],
              changedById: user.sub,
              changeReason: 'Nhập khẩu từ tệp Excel/CSV',
            },
          });
        });

        importedCount++;
      } catch (err: any) {
        errors.push({ row: rowNum, reason: err.message || 'Lỗi khi lưu vào cơ sở dữ liệu' });
      }
    }

    return {
      total: rows.length,
      imported: importedCount,
      failed: errors.length,
      errors,
    };
  }
}
