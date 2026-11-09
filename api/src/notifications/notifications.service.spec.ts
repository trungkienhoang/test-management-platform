import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotificationsService } from './notifications.service.js';
import { NotificationType } from '@prisma/client';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      notification: {
        create: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      $transaction: vi.fn((calls) => Promise.all(calls)),
    };

    service = new NotificationsService(mockPrisma);
  });

  it('tạo thông báo mới thành công', async () => {
    const payload = {
      userId: 'user-1',
      title: 'Bạn được gán Test Run mới',
      message: 'QA Lead đã gán cho bạn đợt kiểm thử Regression Sprint 3',
      type: NotificationType.TEST_RUN_ASSIGNED,
    };

    mockPrisma.notification.create.mockResolvedValue({ id: 'notif-1', ...payload, isRead: false });

    const result = await service.create(payload);
    expect(result.id).toBe('notif-1');
    expect(mockPrisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'user-1', title: payload.title }),
    });
  });

  it('lấy danh sách thông báo và đếm số lượng chưa đọc', async () => {
    mockPrisma.notification.findMany.mockResolvedValue([{ id: 'n-1', isRead: false }]);
    mockPrisma.notification.count.mockResolvedValueOnce(1).mockResolvedValueOnce(1);

    const result = await service.findAll('user-1', { page: 1, limit: 10 });
    expect(result.data.length).toBe(1);
    expect(result.unreadCount).toBe(1);
  });

  it('đánh dấu một thông báo đã đọc', async () => {
    mockPrisma.notification.findFirst.mockResolvedValue({ id: 'n-1', userId: 'user-1', isRead: false });
    mockPrisma.notification.update.mockResolvedValue({ id: 'n-1', isRead: true });

    const result = await service.markAsRead('n-1', 'user-1');
    expect(result.isRead).toBe(true);
    expect(mockPrisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'n-1' },
      data: { isRead: true },
    });
  });

  it('đánh dấu tất cả thông báo đã đọc', async () => {
    mockPrisma.notification.updateMany.mockResolvedValue({ count: 3 });

    const result = await service.markAllAsRead('user-1');
    expect(result.count).toBe(3);
    expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', isRead: false },
      data: { isRead: true },
    });
  });
});
