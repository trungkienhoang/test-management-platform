import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { SystemRole, Prisma } from '@prisma/client';

const USER_SELECT = {
  id: true,
  email: true,
  fullName: true,
  avatarUrl: true,
  systemRole: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: USER_SELECT });
    if (!user) throw new NotFoundException('Người dùng không tồn tại');
    return user;
  }

  async findAll(options: {
    page?: number;
    limit?: number;
    search?: string;
    role?: SystemRole;
    isActive?: boolean;
  }) {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.max(1, options.limit ?? 20);
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};

    if (options.role) {
      where.systemRole = options.role;
    }

    if (options.isActive !== undefined) {
      where.isActive = options.isActive;
    }

    if (options.search) {
      const s = options.search.trim();
      where.OR = [
        { fullName: { contains: s, mode: 'insensitive' } },
        { email: { contains: s, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: USER_SELECT,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Search users by name or email for autocomplete (used when adding members to project)
   */
  async searchCandidates(query: string, excludeProjectId?: string) {
    const trimmed = query?.trim() ?? '';
    const where: Prisma.UserWhereInput = {
      isActive: true,
    };

    if (trimmed) {
      where.OR = [
        { fullName: { contains: trimmed, mode: 'insensitive' } },
        { email: { contains: trimmed, mode: 'insensitive' } },
      ];
    }

    if (excludeProjectId) {
      where.projectMembers = {
        none: { projectId: excludeProjectId },
      };
    }

    return this.prisma.user.findMany({
      where,
      take: 10,
      select: {
        id: true,
        email: true,
        fullName: true,
        avatarUrl: true,
        systemRole: true,
      },
      orderBy: { fullName: 'asc' },
    });
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('Email này đã được sử dụng trong hệ thống');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    return this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        fullName: dto.fullName.trim(),
        passwordHash,
        systemRole: dto.systemRole ?? SystemRole.USER,
      },
      select: USER_SELECT,
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findById(id);

    return this.prisma.user.update({
      where: { id },
      data: {
        fullName: dto.fullName?.trim(),
        systemRole: dto.systemRole,
        isActive: dto.isActive,
      },
      select: USER_SELECT,
    });
  }

  async delete(id: string, currentAdminId: string) {
    if (id === currentAdminId) {
      throw new ForbiddenException('Bạn không thể tự xóa tài khoản của chính mình');
    }

    await this.findById(id);

    return this.prisma.user.delete({
      where: { id },
    });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        fullName: dto.fullName.trim(),
        avatarUrl: dto.avatarUrl,
      },
      select: USER_SELECT,
    });
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException('Người dùng không tồn tại');

    const isMatch = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new BadRequestException('Mật khẩu hiện tại không chính xác');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('Mật khẩu mới không được trùng với mật khẩu hiện tại');
    }

    const newHash = await bcrypt.hash(dto.newPassword, 12);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    return { message: 'Đổi mật khẩu thành công' };
  }
}
