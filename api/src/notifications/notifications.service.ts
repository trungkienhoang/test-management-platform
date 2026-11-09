import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationType } from '@prisma/client';
import { QueryNotificationDto } from './dto/query-notification.dto.js';

export interface CreateNotificationPayload {
  userId: string;
  projectId?: string | null;
  title: string;
  message: string;
  type?: NotificationType;
  link?: string | null;
}

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async create(payload: CreateNotificationPayload) {
    return this.prisma.notification.create({
      data: {
        userId: payload.userId,
        projectId: payload.projectId || null,
        title: payload.title,
        message: payload.message,
        type: payload.type || NotificationType.SYSTEM,
        link: payload.link || null,
      },
    });
  }

  async findAll(userId: string, query: QueryNotificationDto) {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (query.isRead !== undefined) {
      where.isRead = query.isRead;
    }

    const [data, total, unreadCount] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return {
      data,
      unreadCount,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async markAsRead(id: string, userId: string) {
    const notif = await this.prisma.notification.findFirst({
      where: { id, userId },
    });
    if (!notif) {
      throw new NotFoundException('Thông báo không tồn tại');
    }

    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }
}
